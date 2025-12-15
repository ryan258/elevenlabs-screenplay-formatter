from __future__ import annotations

import json
import subprocess
import uuid
from pathlib import Path
from typing import Dict, List, Optional, Union

try:
    from fastapi import APIRouter, Depends, Request
    from fastapi.responses import JSONResponse, StreamingResponse
except ModuleNotFoundError as exc:  # pragma: no cover
    raise ModuleNotFoundError(
        "FastAPI is not installed. Install Python deps (see pyproject.toml) to run the API."
    ) from exc

from apps.api.config import AppConfig
from apps.api.deps import get_config
from apps.api.http_safety import ensure_child_path, sanitize_fieldname, sanitize_filename
from apps.api.schemas import ErrorResponse
from lib.audio.ffmpeg import BackgroundMix, MixConfig, SoundEffectOverlay, apply_mix, concat_audio


router = APIRouter(prefix="/api")


def _ensure_dir(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)


def _parse_mix_config_allowlist(
    payload: str,
    *,
    allowed: Dict[str, Path],
) -> MixConfig:
    raw = json.loads(payload)
    if not isinstance(raw, dict):
        raise ValueError("mixConfig must be an object")

    background: Optional[BackgroundMix] = None
    bg = raw.get("background")
    if isinstance(bg, dict):
        ref = bg.get("ref")
        vol = bg.get("volume")
        if isinstance(ref, str) and isinstance(vol, (int, float)):
            path = allowed.get(ref)
            if path is None:
                raise ValueError("mixConfig.background.ref not found in uploads")
            background = BackgroundMix(path=path, volume=float(vol))

    sound_effects: List[SoundEffectOverlay] = []
    sfx_raw = raw.get("soundEffects")
    if isinstance(sfx_raw, list):
        for entry in sfx_raw:
            if not isinstance(entry, dict):
                continue
            ref = entry.get("ref")
            start = entry.get("startTimeMs")
            vol = entry.get("volume")
            label = entry.get("label") or ""
            if not (isinstance(ref, str) and isinstance(start, (int, float)) and isinstance(vol, (int, float))):
                continue
            path = allowed.get(ref)
            if path is None:
                raise ValueError("mixConfig.soundEffects.ref not found in uploads")
            sound_effects.append(
                SoundEffectOverlay(
                    path=path,
                    start_time_ms=int(start),
                    volume=float(vol),
                    label=str(label),
                )
            )

    return MixConfig(background=background, sound_effects=sound_effects)


@router.post("/concatenate", response_model=None)
async def api_concatenate(
    request: Request,
    cfg: AppConfig = Depends(get_config),
) -> Union[StreamingResponse, JSONResponse]:
    try:
        upload_root = Path(cfg.upload_dir)
        _ensure_dir(upload_root)
        request_dir = upload_root / f"req_{uuid.uuid4().hex}"
        _ensure_dir(request_dir)

        form = await request.form()

        audio_paths: List[Path] = []
        aux_files: Dict[str, Path] = {}
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
                target = request_dir / f"audio_{len(audio_paths):04d}_{sanitize_filename(filename)}"
                audio_paths.append(target)
            else:
                safe_key = sanitize_fieldname(key)
                if not safe_key or safe_key != key:
                    return JSONResponse(
                        status_code=400,
                        content=ErrorResponse(error="Invalid upload field name").model_dump(),
                    )
                target = ensure_child_path(request_dir, safe_key)
                aux_files[safe_key] = target

            with target.open("wb") as f:
                while True:
                    chunk = await upload.read(1024 * 1024)
                    if not chunk:
                        break
                    f.write(chunk)

        if not audio_paths:
            return JSONResponse(
                status_code=400,
                content=ErrorResponse(error="No audio files provided").model_dump(),
            )

        out_path = request_dir / "concatenated_audio.mp3"
        concat_audio(cfg.ffmpeg, audio_paths, out_path)

        final_path = out_path
        if mix_config_raw:
            try:
                mix = _parse_mix_config_allowlist(mix_config_raw, allowed=aux_files)
            except Exception as exc:
                return JSONResponse(
                    status_code=400,
                    content=ErrorResponse(error="Invalid mixConfig", details=str(exc)).model_dump(),
                )

            if mix.background or mix.sound_effects:
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

