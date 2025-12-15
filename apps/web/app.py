from __future__ import annotations

try:
    from flask import Flask
except ModuleNotFoundError as exc:  # pragma: no cover
    raise ModuleNotFoundError(
        "Flask is not installed. Install Python deps (see pyproject.toml) to run the app."
    ) from exc


app = Flask(__name__)
app.secret_key = (  # replaced by env-backed config during Phase 1 config wiring
    app.config.get("SECRET_KEY") or "dev"
)

from apps.web import routes  # noqa: E402
