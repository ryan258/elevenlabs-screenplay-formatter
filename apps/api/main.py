from __future__ import annotations

try:
    from fastapi import FastAPI
    from fastapi.middleware.wsgi import WSGIMiddleware
except ModuleNotFoundError as exc:  # pragma: no cover
    raise ModuleNotFoundError(
        "FastAPI is not installed. Install Python deps (see pyproject.toml) to run the app."
    ) from exc

from apps.api.config import load_config_from_env
from apps.api.routes_concat import router as concat_router
from apps.api.routes_generate import router as generate_router
from apps.api.routes_parse import router as parse_router
from apps.web.app import app as flask_app

app = FastAPI()

app.include_router(parse_router)
app.include_router(generate_router)
app.include_router(concat_router)
app.state.config = load_config_from_env()

flask_app.secret_key = app.state.config.flask_secret_key
flask_app.config["APP_CONFIG"] = app.state.config
app.mount("/", WSGIMiddleware(flask_app))
