from __future__ import annotations

import os

try:
    import uvicorn
except ModuleNotFoundError as exc:  # pragma: no cover
    raise ModuleNotFoundError(
        "uvicorn is not installed. Install deps (e.g. `python3 -m pip install -e \".[dev]\"`) to run the app."
    ) from exc


def main() -> None:
    reload = os.environ.get("UVICORN_RELOAD", "0").strip() == "1"
    uvicorn.run("apps.api.main:app", host="127.0.0.1", port=8000, reload=reload)


if __name__ == "__main__":
    main()
