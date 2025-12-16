# Repository Guidelines — ElevenLabs Screenplay Formatter (Python-first)

## Current State
The main branch is a Python modular monolith intended for local single-user use:
- UI: Flask + Jinja2 + HTMX (`apps/web/`)
- API + jobs/SSE: FastAPI (`apps/api/`)
- Core library: `lib/` (typed, framework-free)

The legacy Node/React implementation is archived in an older branch and removed from `main`.

## Project Structure & Module Organization
- `apps/api/` FastAPI JSON API, job execution, SSE streaming, and file exports.
- `apps/web/` Flask UI (server-rendered pages + HTMX interactions).
- `lib/` pure helpers: parser, ElevenLabs client, generation, exports, ffmpeg wrapper, validation.
- `py_cli/` Python CLI (replacement in progress).
- `tests/` pytest suite.

**Import rule:** `apps/*` and `py_cli/*` may import `lib/*`. `lib/*` must not import web/framework code.

## Build, Test, and Development Commands
- Install: `python3 -m pip install -e ".[dev]"`
- Run app: `python3 -m apps.api` (FastAPI mounts Flask; one port)
- Tests: `PYTHONPATH=. pytest -q`

## Coding Style
- Prefer explicit types and clear names.
- Keep changes local to the relevant module; avoid cross-cutting refactors.
- Maintain the “no web imports in `lib/`” rule.

## Manual QA (high-value checks)
- Wizard flow: `/` → `/characters` → `/generation` → `/timeline` → `/exports`.
- Voice assignment:
  - **Auto-fill Voice IDs** from script.
  - **Load Voices** and apply Voice IDs from ElevenLabs.
- Exports:
  - ZIP download succeeds.
  - Concatenated audio plays when FFmpeg is available (otherwise job completes and `concat_error.txt` exists in the ZIP).

## Security Notes
- Never commit API keys.
- Treat the app as local-only; the session model is not designed for multi-user environments.
