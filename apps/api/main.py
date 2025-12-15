from __future__ import annotations

from pathlib import Path

try:
    from fastapi import FastAPI
    from fastapi.middleware.wsgi import WSGIMiddleware
except ModuleNotFoundError as exc:  # pragma: no cover
    raise ModuleNotFoundError(
        "FastAPI is not installed. Install Python deps (see pyproject.toml) to run the app."
    ) from exc

from apps.api.config import load_config_from_env
from apps.api.jobs import JobStore
from apps.api.routes_concat import router as concat_router
from apps.api.routes_generate import router as generate_router
from apps.api.routes_jobs import router as jobs_router
from apps.api.routes_parse import router as parse_router
from apps.web.app import app as flask_app

app = FastAPI()

app.include_router(parse_router)
app.include_router(generate_router)
app.include_router(concat_router)
app.include_router(jobs_router)
app.state.config = load_config_from_env()
app.state.job_store = JobStore(Path(app.state.config.upload_dir).resolve())

flask_app.secret_key = app.state.config.flask_secret_key
flask_app.config["APP_CONFIG"] = app.state.config
flask_app.config["JOB_STORE"] = app.state.job_store
app.mount("/", WSGIMiddleware(flask_app))
