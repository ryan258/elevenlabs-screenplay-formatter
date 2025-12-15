from __future__ import annotations

import os
from dataclasses import dataclass

from lib.config import ElevenLabsConfig, FfmpegConfig


@dataclass(frozen=True)
class AppConfig:
    elevenlabs: ElevenLabsConfig
    ffmpeg: FfmpegConfig
    flask_secret_key: str
    upload_dir: str


def load_config_from_env() -> AppConfig:
    elevenlabs_api_key = os.environ.get("ELEVENLABS_API_KEY", "").strip()
    elevenlabs_base_url = os.environ.get("ELEVENLABS_BASE_URL", "").strip()
    timeout_s_raw = os.environ.get("ELEVENLABS_TIMEOUT_S", "30").strip()
    ffmpeg_bin = os.environ.get("FFMPEG_BIN", "ffmpeg").strip()
    flask_secret_key = os.environ.get("FLASK_SECRET_KEY", "dev").strip()
    upload_dir = os.environ.get("UPLOAD_DIR", "uploads").strip()

    if not elevenlabs_base_url:
        raise RuntimeError("Missing ELEVENLABS_BASE_URL (no hardcoded endpoints).")

    timeout_s = float(timeout_s_raw) if timeout_s_raw else 30.0

    return AppConfig(
        elevenlabs=ElevenLabsConfig(
            api_key=elevenlabs_api_key,
            base_url=elevenlabs_base_url,
            timeout_s=timeout_s,
        ),
        ffmpeg=FfmpegConfig(ffmpeg_bin=ffmpeg_bin),
        flask_secret_key=flask_secret_key,
        upload_dir=upload_dir,
    )

