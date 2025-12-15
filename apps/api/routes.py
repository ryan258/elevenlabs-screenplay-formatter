from __future__ import annotations

import json
import subprocess
import uuid
from pathlib import Path
from typing import Dict, List, Optional, Tuple

try:
    from fastapi import APIRouter, Request
    from fastapi.responses import JSONResponse, StreamingResponse
except ModuleNotFoundError as exc:  # pragma: no cover
    raise ModuleNotFoundError(
        "FastAPI is not installed. Install Python deps (see pyproject.toml) to run the API."
    ) from exc

from apps.api.config import AppConfig
from apps.api.schemas import ErrorResponse, GenerateZipRequest, ParseRequest, ParseResponse
from lib.audio.ffmpeg import MixConfig, apply_mix, concat_audio, parse_mix_config_json
from lib.elevenlabs.client import ElevenLabsClient
from lib.exports.zip_bundle import build_zip_bundle
from lib.generation import generate_all_audio
from lib.manifest import build_manifest_entries
from lib.models import CharacterConfig, VoiceSettings
from lib.parser import parse_script
from lib.validation import validate_character_configs


router = APIRouter(prefix="/api")


def _ensure_dir(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)


@router.post("/parse", response_model=ParseResponse)
def api_parse(body: ParseRequest) -> ParseResponse:
    parsed = parse_script(body.script_text, preserve_stage_directions=body.preserve_stage_directions)
    return ParseResponse.model_validate(
        {
            "characters": parsed.characters,
            "dialogue_chunks": [
                {"character": c.character, "text": c.text, "original_text": c.original_text}
                for c in parsed.dialogue_chunks
            ],
            "diagnostics": {
                "unmatched_lines": [
                    {"line_number": u.line_number, "content": u.content}
                    for u in parsed.diagnostics.unmatched_lines
                ]
            },
        }
    )


@router.post("/generate.zip")
def api_generate_zip(body: GenerateZipRequest) -> StreamingResponse | JSONResponse:
    try:
        from apps.api.main import app as fastapi_app  # local import to avoid circularity

        cfg: AppConfig = fastapi_app.state.config  # type: ignore[attr-defined]
        if not cfg.elevenlabs.api_key:
            return JSONResponse(
                status_code=400,
                content=ErrorResponse(error="Missing ELEVENLABS_API_KEY").model_dump(),
            )

        parsed = parse_script(
            body.script_text,
            preserve_stage_directions=body.project_settings.preserve_stage_directions,
        )

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

        errors = validate_character_configs(parsed.dialogue_chunks, character_configs)
        if errors:
            return JSONResponse(
                status_code=400,
                content=ErrorResponse(error="Invalid configuration", meta={"errors": errors}).model_dump(),
            )

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


def _save_uploads(upload_dir: Path, uploads: List[UploadFile]) -> Dict[str, Path]:
    mapping: Dict[str, Path] = {}
    for file in uploads:
        field = file.filename or file.name or "file"
        target = upload_dir / field
        with target.open("wb") as f:
            while True:
                chunk = file.file.read(1024 * 1024)
                if not chunk:
                    break
                f.write(chunk)
        mapping[file.filename or file.name or field] = target
    return mapping


def _sanitize_filename(value: str) -> str:
    keep = []
    for ch in value:
        if ch.isalnum() or ch in {".", "_", "-", " "}:
            keep.append(ch)
    return ("".join(keep)).strip().replace(" ", "_") or "file"


@router.post("/concatenate")
async def api_concatenate(request: Request) -> StreamingResponse | JSONResponse:
    """
    Python replacement for `server/index.js`:
    - Accepts multipart audio uploads under `audioFiles`
    - Optional `mixConfig` JSON for background + SFX overlays
    """
    try:
        from apps.api.main import app as fastapi_app  # local import to avoid circularity

        cfg: AppConfig = fastapi_app.state.config  # type: ignore[attr-defined]
        upload_root = Path(cfg.upload_dir)
        _ensure_dir(upload_root)
        request_dir = upload_root / f"req_{uuid.uuid4().hex}"
        _ensure_dir(request_dir)

        form = await request.form()

        # Save audio files in order of appearance + map auxiliary files by fieldname.
        audio_paths: List[Path] = []
        mix_config_raw: Optional[str] = None

        for key, value in form.multi_items():
            if key == "mixConfig" and isinstance(value, str):
                mix_config_raw = value
                continue

            upload = value
            if not hasattr(upload, "filename"):
                continue

            filename = getattr(upload, "filename", None) or "upload.bin"
            if key == "audioFiles":
                target = request_dir / f"audio_{len(audio_paths):04d}_{_sanitize_filename(filename)}"
                audio_paths.append(target)
            else:
                target = request_dir / key

            with target.open("wb") as f:
                while True:
                    chunk = await upload.read(1024 * 1024)
                    if not chunk:
                        break
                    f.write(chunk)

        if not audio_paths:
            return JSONResponse(status_code=400, content=ErrorResponse(error="No audio files provided").model_dump())

        out_path = request_dir / "concatenated_audio.mp3"
        concat_audio(cfg.ffmpeg, audio_paths, out_path)

        mix: MixConfig = MixConfig()
        if mix_config_raw:
            try:
                mix = parse_mix_config_json(mix_config_raw, upload_dir=request_dir)
            except Exception:
                mix = MixConfig()

        final_path = out_path
        if mix.background or (mix.sound_effects and len(mix.sound_effects) > 0):
            mixed_path = request_dir / "concatenated_audio_mixed.mp3"
            apply_mix(cfg.ffmpeg, out_path, mix, mixed_path)
            final_path = mixed_path

        def iter_once_and_cleanup() -> bytes:
            data = final_path.read_bytes()
            try:
                for p in request_dir.glob("*"):
                    try:
                        p.unlink()
                    except OSError:
                        pass
                request_dir.rmdir()
            except OSError:
                pass
            return data

        return StreamingResponse(iter([iter_once_and_cleanup()]), media_type="audio/mpeg")
    except subprocess.CalledProcessError as exc:
        return JSONResponse(
            status_code=500,
            content=ErrorResponse(error="FFmpeg failed", details=str(exc)).model_dump(),
        )
    except Exception as exc:
        return JSONResponse(
            status_code=500,
            content=ErrorResponse(error="Failed to concatenate audio files", details=str(exc)).model_dump(),
        )
