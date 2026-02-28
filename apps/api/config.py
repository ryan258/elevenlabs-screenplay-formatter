from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from lib.config import ElevenLabsConfig


@dataclass(frozen=True)
class AppConfig:
    elevenlabs: ElevenLabsConfig
    flask_secret_key: str
    upload_dir: str


def _load_dotenv_if_present() -> None:
    """
    Minimal `.env` loader for local development.
    - No external dependency (no python-dotenv).
    - Does not override already-set environment variables.
    """
    env_path = Path(".env")
    if not env_path.exists():
        return
    for raw_line in env_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        if "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if not key or key in os.environ:
            continue
        os.environ[key] = value


def load_config_from_env() -> AppConfig:
    _load_dotenv_if_present()
    elevenlabs_api_key = os.environ.get("ELEVENLABS_API_KEY", "").strip()
    elevenlabs_base_url = os.environ.get("ELEVENLABS_BASE_URL", "").strip()
    timeout_s_raw = os.environ.get("ELEVENLABS_TIMEOUT_S", "30").strip()
    flask_secret_key = os.environ.get("FLASK_SECRET_KEY", "dev").strip()
    upload_dir = os.environ.get("UPLOAD_DIR", "uploads").strip()

    if not elevenlabs_base_url:
        raise RuntimeError("Missing ELEVENLABS_BASE_URL (no hardcoded endpoints).")

    # Bug 12 follow-up: keep secure default without breaking local dev
    if not flask_secret_key:
        flask_secret_key = "dev"
    if flask_secret_key == "dev":
        import sys

        print(
            "WARNING: Using insecure default FLASK_SECRET_KEY for local dev. "
            "Set FLASK_SECRET_KEY in .env for session persistence.",
            file=sys.stderr,
        )
    elif len(flask_secret_key) < 32:
        raise RuntimeError("FLASK_SECRET_KEY must be at least 32 characters")

    timeout_s = float(timeout_s_raw) if timeout_s_raw else 30.0

    return AppConfig(
        elevenlabs=ElevenLabsConfig(
            api_key=elevenlabs_api_key,
            base_url=elevenlabs_base_url,
            timeout_s=timeout_s,
        ),
        flask_secret_key=flask_secret_key,
        upload_dir=upload_dir,
    )
