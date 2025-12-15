from __future__ import annotations

try:
    import uvicorn
except ModuleNotFoundError as exc:  # pragma: no cover
    raise ModuleNotFoundError(
        "uvicorn is not installed. Install Python deps (see pyproject.toml) to run the app."
    ) from exc


def main() -> None:
    uvicorn.run("apps.api.main:app", host="127.0.0.1", port=8000, reload=True)


if __name__ == "__main__":
    main()

