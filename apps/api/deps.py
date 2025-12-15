from __future__ import annotations

try:
    from fastapi import Request
except ModuleNotFoundError as exc:  # pragma: no cover
    raise ModuleNotFoundError(
        "FastAPI is not installed. Install Python deps (see pyproject.toml) to run the API."
    ) from exc

from apps.api.config import AppConfig
from apps.api.jobs import JobStore


def get_config(request: Request) -> AppConfig:
    cfg = getattr(request.app.state, "config", None)
    if cfg is None:
        raise RuntimeError("AppConfig is not initialized")
    return cfg


def get_job_store(request: Request) -> JobStore:
    store = getattr(request.app.state, "job_store", None)
    if store is None:
        raise RuntimeError("JobStore is not initialized")
    return store
