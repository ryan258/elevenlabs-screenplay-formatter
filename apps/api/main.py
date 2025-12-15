from __future__ import annotations

try:
    from fastapi import FastAPI
    from fastapi.middleware.wsgi import WSGIMiddleware
except ModuleNotFoundError as exc:  # pragma: no cover
    raise ModuleNotFoundError(
        "FastAPI is not installed. Install Python deps (see pyproject.toml) to run the app."
    ) from exc

from apps.api.config import load_config_from_env
from apps.api.routes import router
from apps.web.app import app as flask_app

app = FastAPI()

app.include_router(router)
app.state.config = load_config_from_env()

flask_app.secret_key = app.state.config.flask_secret_key
app.mount("/", WSGIMiddleware(flask_app))
