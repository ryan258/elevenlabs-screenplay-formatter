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

# Bug 13 fix - upload size limits
MAX_UPLOAD_SIZE = 100 * 1024 * 1024  # 100MB per file
MAX_TOTAL_UPLOAD = 500 * 1024 * 1024  # 500MB total


def _ensure_dir(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)


def _check_disk_space(path: Path, required_bytes: int) -> None:
    """Raise if insufficient disk space (Bug 17 fix)"""
    import shutil
    stat = shutil.disk_usage(path)
    if stat.free < required_bytes * 2:
        raise RuntimeError(
            f"Insufficient disk space: {stat.free / 1e9:.1f}GB free, "
            f"need ~{required_bytes * 2 / 1e9:.1f}GB"
        )


def _cleanup_dir(path: Path) -> None:
    """Safely cleanup directory with shutil.rmtree (Bug 15 fix)"""
    if not path.exists():
        return

    import shutil
    import logging
    try:
        shutil.rmtree(path, ignore_errors=False)
    except FileNotFoundError:
        # Already deleted, that's fine
        pass
    except PermissionError as exc:
        # Log but don't fail - cleanup is best-effort
        logging.getLogger(__name__).warning("Permission denied cleaning up %s: %s", path, exc)
    except Exception as exc:
        logging.getLogger(__name__).warning("Failed to cleanup %s: %s", path, exc)


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
    request_dir: Optional[Path] = None
    total_bytes_written = 0  # Bug 13 fix - track total upload size
    try:
        upload_root = Path(cfg.upload_dir)
        _ensure_dir(upload_root)

        # Check disk space before upload (Bug 17 fix)
        try:
            _check_disk_space(upload_root, MAX_TOTAL_UPLOAD * 2)
        except RuntimeError as exc:
            return JSONResponse(
                status_code=507,
                content=ErrorResponse(error=str(exc)).model_dump(),
            )

        request_dir_path = upload_root / f"req_{uuid.uuid4().hex}"
        request_dir = request_dir_path
        _ensure_dir(request_dir_path)

        form = await request.form()

        audio_paths: List[Path] = []
        aux_files: Dict[str, Path] = {}
        mix_config_raw: Optional[str] = None
        parsed_mix: Optional[MixConfig] = None

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
                    _cleanup_dir(request_dir_path)
                    return JSONResponse(
                        status_code=400,
                        content=ErrorResponse(error="Invalid upload field name").model_dump(),
                    )
                target = ensure_child_path(request_dir, safe_key)
                aux_files[safe_key] = target

            # Bug 13 fix - enforce upload size limits
            file_bytes_written = 0
            with target.open("wb") as f:
                while True:
                    chunk = await upload.read(1024 * 1024)
                    if not chunk:
                        break

                    # Check per-file limit
                    file_bytes_written += len(chunk)
                    if file_bytes_written > MAX_UPLOAD_SIZE:
                        _cleanup_dir(request_dir_path)
                        return JSONResponse(
                            status_code=413,
                            content=ErrorResponse(error="File too large (max 100MB)").model_dump(),
                        )

                    # Check total limit
                    total_bytes_written += len(chunk)
                    if total_bytes_written > MAX_TOTAL_UPLOAD:
                        _cleanup_dir(request_dir_path)
                        return JSONResponse(
                            status_code=413,
                            content=ErrorResponse(error="Total upload too large (max 500MB)").model_dump(),
                        )

                    f.write(chunk)

        if not audio_paths:
            _cleanup_dir(request_dir_path)
            return JSONResponse(
                status_code=400,
                content=ErrorResponse(error="No audio files provided").model_dump(),
            )

        if mix_config_raw:
            try:
                parsed_mix = _parse_mix_config_allowlist(mix_config_raw, allowed=aux_files)
            except Exception as exc:
                _cleanup_dir(request_dir_path)
                return JSONResponse(
                    status_code=400,
                    content=ErrorResponse(error="Invalid mixConfig", details=str(exc)).model_dump(),
                )

        out_path = request_dir_path / "concatenated_audio.mp3"
        concat_audio(cfg.ffmpeg, audio_paths, out_path)

        final_path = out_path
        if parsed_mix and (parsed_mix.background or parsed_mix.sound_effects):
            mixed_path = request_dir_path / "concatenated_audio_mixed.mp3"
            apply_mix(cfg.ffmpeg, out_path, parsed_mix, mixed_path)
            final_path = mixed_path

        def iter_once_and_cleanup() -> bytes:
            data = final_path.read_bytes()
            _cleanup_dir(request_dir_path)
            return data

        return StreamingResponse(iter([iter_once_and_cleanup()]), media_type="audio/mpeg")
    except subprocess.CalledProcessError as exc:
        if request_dir is not None:
            _cleanup_dir(request_dir)
        return JSONResponse(
            status_code=500,
            content=ErrorResponse(error="FFmpeg failed", details=str(exc)).model_dump(),
        )
    except Exception as exc:
        if request_dir is not None:
            _cleanup_dir(request_dir)
        return JSONResponse(
            status_code=500,
            content=ErrorResponse(error="Failed to concatenate audio files", details=str(exc)).model_dump(),
        )
