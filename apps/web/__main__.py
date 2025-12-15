from __future__ import annotations

import os

from apps.api.config import load_config_from_env
from apps.web.app import app


def main() -> None:
    cfg = load_config_from_env()
    app.secret_key = cfg.flask_secret_key
    app.config["APP_CONFIG"] = cfg

    host = os.environ.get("HOST", "127.0.0.1")
    port = int(os.environ.get("PORT", "8000"))
    debug = os.environ.get("FLASK_DEBUG", "0").strip() == "1"
    app.run(host=host, port=port, debug=debug)


if __name__ == "__main__":
    main()
