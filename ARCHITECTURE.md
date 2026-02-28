# Architecture Overview

## Python Modular Monolith (current)

This repo is now Python-first and local-only:

- **UI**: Flask + Jinja2 + HTMX (`apps/web/`)
- **API/jobs**: FastAPI + SSE (`apps/api/`)
- **Core library**: pure typed helpers (`lib/`) with no web/framework imports

The app is mounted as a single process: `apps/api/main.py` mounts the Flask UI under the FastAPI app (one port).

## Parsing & Project State

- Parsing lives in `lib/parser.py` and returns characters, dialogue chunks, and diagnostics (unmatched lines).
- The Flask UI keeps a lightweight “session payload” in `uploads/web_sessions/` via `apps/web/session_store.py`.
- Character configs (Voice ID + settings) are stored in that payload and validated via `lib/validation.py`.

## Generation Flow

1. Flask UI writes config to the session payload.
2. `POST /api/generate` starts an async JobStore job (`apps/api/jobs.py`).
3. JobStore iterates chunks and calls ElevenLabs TTS with previous/next context (`lib/generation.py`).
4. Per-line audio is written under `uploads/jobs/<job_id>/audio/`.
5. Exports are produced in the job directory:
   - `manifest.json`, `manifest.csv`
   - `subtitles.srt`, `subtitles.vtt`
   - `reaper.rpp`
   - `bundle.zip`
6. Progress is streamed to the browser via SSE (`GET /api/jobs/{job_id}/events`).

## Timeline & Exports

- Timeline view supports per-line preview playback:
  - Generated job audio: `GET /api/jobs/{job_id}/audio/{filename}`
  - Local previews: `/timeline/preview` generates a single chunk and serves it from the web session preview directory.
- Exports:
  - ZIP: `GET /api/exports/{job_id}.zip`

## CLI Automation

- `python -m py_cli` is a minimal Python CLI for batch generation (replacement in progress).
