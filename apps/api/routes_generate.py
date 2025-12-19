from __future__ import annotations

import tempfile
from pathlib import Path
from typing import Optional, Union

try:
    from fastapi import APIRouter, Depends
    from fastapi.responses import JSONResponse, StreamingResponse
    from fastapi import Request
except ModuleNotFoundError as exc:  # pragma: no cover
    raise ModuleNotFoundError(
        "FastAPI is not installed. Install Python deps (see pyproject.toml) to run the API."
    ) from exc

from apps.api.config import AppConfig
from apps.api.character_configs import build_character_configs
from apps.api.deps import get_config
from apps.api.limits import MAX_DIALOGUE_CHUNKS, MAX_SCRIPT_CHARS
from apps.api.schemas import ErrorResponse, GenerateZipRequest, ValidateProjectResponse
from lib.audio.ffmpeg import concat_audio
from lib.elevenlabs.client import ElevenLabsClient
from lib.exports.zip_bundle import build_zip_bundle
from lib.generation import generate_all_audio
from lib.manifest import build_manifest_entries, manifest_to_srt, manifest_to_vtt
from lib.reaper_export import build_reaper_project
from lib.parser import parse_script
from lib.validation import validate_character_configs
from lib.utils_web import generation_limiter


router = APIRouter(prefix="/api")


@router.post("/projects/validate", response_model=ValidateProjectResponse)
def api_validate_project(
    body: GenerateZipRequest,
    cfg: AppConfig = Depends(get_config),
) -> ValidateProjectResponse:
    parsed = parse_script(
        body.script_text,
        preserve_stage_directions=body.project_settings.preserve_stage_directions,
    )

    character_configs = build_character_configs(body)

    errors = validate_character_configs(parsed.dialogue_chunks, character_configs)
    if not body.project_settings.model:
        errors.insert(0, "Missing projectSettings.model")
    if not body.project_settings.output_format:
        errors.insert(0, "Missing projectSettings.outputFormat")
    if not cfg.elevenlabs.api_key:
        errors.insert(0, "Missing ELEVENLABS_API_KEY")

    return ValidateProjectResponse(ok=not errors, errors=errors)


@router.post("/generate.zip", response_model=None)
def api_generate_zip(
    body: GenerateZipRequest,
    cfg: AppConfig = Depends(get_config),
    request: Optional[Request] = None,  # Add request for IP
) -> Union[StreamingResponse, JSONResponse]:
    # Rate limit (Bug 18 fix applied to API)
    client_ip = request.client.host if (request and request.client) else "unknown"
    if not generation_limiter.check_limit(client_ip):
        return JSONResponse(status_code=429, content=ErrorResponse(error="Rate limit exceeded").model_dump())

    if len(body.script_text) > MAX_SCRIPT_CHARS:
        return JSONResponse(
            status_code=413,
            content=ErrorResponse(error="Script is too large").model_dump(),
        )
    if not cfg.elevenlabs.api_key:
        return JSONResponse(
            status_code=400,
            content=ErrorResponse(error="Missing ELEVENLABS_API_KEY").model_dump(),
        )

    parsed = parse_script(
        body.script_text,
        preserve_stage_directions=body.project_settings.preserve_stage_directions,
    )
    if len(parsed.dialogue_chunks) > MAX_DIALOGUE_CHUNKS:
        return JSONResponse(
            status_code=413,
            content=ErrorResponse(error="Too many dialogue chunks").model_dump(),
        )

    character_configs = build_character_configs(body)

    errors = validate_character_configs(parsed.dialogue_chunks, character_configs)
    if not body.project_settings.model:
        errors = ["Missing projectSettings.model", *errors]
    if not body.project_settings.output_format:
        errors = ["Missing projectSettings.outputFormat", *errors]
    if errors:
        return JSONResponse(
            status_code=400,
            content=ErrorResponse(error="Invalid configuration", meta={"errors": errors}).model_dump(),
        )

    try:
        client = ElevenLabsClient(cfg.elevenlabs)
        generated = generate_all_audio(
            client=client,
            dialogue_chunks=parsed.dialogue_chunks,
            character_configs=character_configs,
            model_id=body.project_settings.model,
            output_format=body.project_settings.output_format,
            filename_prefix=body.filename_prefix or "",
            delay_ms=body.project_settings.request_delay_ms or 500,
            speak_parentheticals=body.project_settings.speak_parentheticals,
            fetch_alignment=True,
        )

        entries = build_manifest_entries(
            parsed.dialogue_chunks,
            [g.filename for g in generated],
            start_times_ms=[g.start_time_ms for g in generated],
            end_times_ms=[g.end_time_ms for g in generated],
            alignments=[g.alignment for g in generated],
        )

        audio_files = [(g.filename, g.audio_bytes) for g in generated]
        extra_files = [
            ("subtitles.srt", manifest_to_srt(entries).encode("utf-8")),
            ("subtitles.vtt", manifest_to_vtt(entries).encode("utf-8")),
            ("reaper.rpp", build_reaper_project(entries).encode("utf-8")),
        ]
        if body.project_settings.concatenate:
            extension = "wav" if str(body.project_settings.output_format).startswith("pcm_") else "mp3"
            with tempfile.TemporaryDirectory(prefix="esf_api_generate_") as tmpdir:
                tmp = Path(tmpdir)
                paths = []
                for name, data in audio_files:
                    p = tmp / name
                    p.write_bytes(data)
                    paths.append(p)
                out_path = tmp / f"concatenated_audio.{extension}"
                try:
                    concat_audio(cfg.ffmpeg, paths, out_path)
                    audio_files.append((out_path.name, out_path.read_bytes()))
                except Exception as exc:
                    extra_files.append(("concat_error.txt", str(exc).encode("utf-8")))

        zip_bytes = build_zip_bundle(
            audio_files=audio_files,
            manifest_entries=entries,
            extra_files=extra_files,
        )

        return StreamingResponse(
            iter([zip_bytes]),
            media_type="application/zip",
            headers={"Content-Disposition": 'attachment; filename="bundle.zip"'},
        )
    except Exception as exc:
        return JSONResponse(
            status_code=500,
            content=ErrorResponse(error="Generation failed", details=str(exc)).model_dump(),
        )
