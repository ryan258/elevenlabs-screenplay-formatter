from __future__ import annotations

try:
    from fastapi import APIRouter, Depends
    from fastapi.responses import JSONResponse, StreamingResponse
except ModuleNotFoundError as exc:  # pragma: no cover
    raise ModuleNotFoundError(
        "FastAPI is not installed. Install Python deps (see pyproject.toml) to run the API."
    ) from exc

from typing import Dict, Union

from apps.api.config import AppConfig
from apps.api.deps import get_config
from apps.api.schemas import ErrorResponse, GenerateZipRequest, ValidateProjectResponse
from lib.elevenlabs.client import ElevenLabsClient
from lib.exports.zip_bundle import build_zip_bundle
from lib.generation import generate_all_audio
from lib.manifest import build_manifest_entries
from lib.models import CharacterConfig, VoiceSettings
from lib.parser import parse_script
from lib.validation import validate_character_configs


router = APIRouter(prefix="/api")

MAX_SCRIPT_CHARS = 2_000_000
MAX_DIALOGUE_CHUNKS = 5_000


def _build_character_configs(body: GenerateZipRequest) -> Dict[str, CharacterConfig]:
    character_configs: Dict[str, CharacterConfig] = {}
    for name, raw in body.character_configs.items():
        character_configs[name] = CharacterConfig(
            voice_id=raw.voice_id,
            voice_settings=VoiceSettings(
                stability=raw.voice_settings.stability,
                similarity_boost=raw.voice_settings.similarity_boost,
                style=raw.voice_settings.style,
                speed=raw.voice_settings.speed,
            ),
        )
    return character_configs


@router.post("/projects/validate", response_model=ValidateProjectResponse)
def api_validate_project(
    body: GenerateZipRequest,
    cfg: AppConfig = Depends(get_config),
) -> ValidateProjectResponse:
    parsed = parse_script(
        body.script_text,
        preserve_stage_directions=body.project_settings.preserve_stage_directions,
    )

    character_configs = _build_character_configs(body)

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
) -> Union[StreamingResponse, JSONResponse]:
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

    character_configs = _build_character_configs(body)

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

        zip_bytes = build_zip_bundle(
            audio_files=[(g.filename, g.audio_bytes) for g in generated],
            manifest_entries=entries,
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

