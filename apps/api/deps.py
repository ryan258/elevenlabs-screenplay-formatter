from __future__ import annotations

try:
    from fastapi import Request
except ModuleNotFoundError as exc:  # pragma: no cover
    raise ModuleNotFoundError(
        "FastAPI is not installed. Install Python deps (see pyproject.toml) to run the API."
    ) from exc

from apps.api.config import AppConfig


def get_config(request: Request) -> AppConfig:
    cfg = getattr(request.app.state, "config", None)
    if cfg is None:
        raise RuntimeError("AppConfig is not initialized")
    return cfg

