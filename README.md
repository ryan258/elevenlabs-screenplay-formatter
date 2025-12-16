# ElevenLabs Screenplay Formatter

A Python modular monolith that converts screenplay dialogue into AI-generated audio files using the ElevenLabs text-to-speech API.

## Python Migration (v1.0 in progress)

This repo is actively migrating to a Python modular monolith:
- UI: Flask + Jinja2 + HTMX
- API/jobs: FastAPI
- Core logic: `lib/` (portable, typed)

See `ROADMAP.md` and `MIGRATION_ROADMAP.md` for the execution plan.

## Current Status (Python)

- Flask UI wizard works end-to-end: paste script → parse → assign voices (auto-fill + browse voices) → start async generation → live progress via SSE → timeline playback → exports.
- FastAPI API + jobs are implemented (`/api/parse`, `/api/projects/validate`, `/api/generate`, `/api/jobs/*`, `/api/exports/*`).
- Core library exists in `lib/` (parser, ElevenLabs client, generation, ZIP/manifest, ffmpeg concat/mix helpers) with pytest coverage.

## Prerequisites

### Required

- **Python** (3.9 or higher)
- **ElevenLabs API Key** - [Get your key here](https://elevenlabs.io/)

### Optional

- **FFmpeg** - Required for concatenation/mixing features (per-line clips still work without it)
  - **Windows**: `winget install ffmpeg` or [download manually](https://ffmpeg.org/download.html)
  - **Mac**: `brew install ffmpeg`
  - **Linux**: `sudo apt install ffmpeg` (Ubuntu/Debian) or `sudo yum install ffmpeg` (RHEL/Fedora)

## Installation

1. **Clone the repository**

   ```bash
   git clone https://github.com/ryan258/elevenlabs-screenplay-formatter.git
   cd elevenlabs-screenplay-formatter
   ```

2. **Create a venv and install Python deps**

   ```bash
   python3 -m venv .venv
   source .venv/bin/activate
   python3 -m pip install -U pip
   python3 -m pip install -e ".[dev]"
   ```

3. **Configure environment variables**

   ```bash
   cp .env.example .env
   ```

   Set `ELEVENLABS_API_KEY`. Keep `.env` local (it is gitignored).

## Quick Start

### Run the combined app (FastAPI mounting Flask)

```bash
python3 -m apps.api
```

Open `http://localhost:8000`.

The Flask UI uses HTMX for progressive enhancement. The template tries `/static/htmx.min.js` first and falls back to `https://unpkg.com/` if it’s not present. If HTMX can’t load, you can still use the app via full page loads (no partial swaps).

If you want hot reload during development:

```bash
UVICORN_RELOAD=1 python3 -m apps.api
```

### Tests

```bash
PYTHONDONTWRITEBYTECODE=1 python3 -m pytest -q
```

### Python CLI (replacement in progress)

```bash
python3 -m py_cli --script path/to/screenplay.txt --config path/to/elevenlabs_project.json
```

## API Endpoints (FastAPI)

- `POST /api/parse`
- `POST /api/projects/validate`
- `POST /api/generate.zip` (sync ZIP)
- `POST /api/generate` (async job)
- `GET /api/jobs/{job_id}`
- `GET /api/jobs/{job_id}/events` (SSE; supports `Last-Event-ID`)
- `GET /api/jobs/{job_id}/audio/{filename}` (per-line clips)
- `GET /api/exports/{job_id}.zip`
- `GET /api/exports/{job_id}/concatenated` (single-file listen-through; requires FFmpeg)
- `GET /api/exports/{job_id}.json` (manifest)
- `GET /api/exports/{job_id}.csv` (manifest)
- `GET /api/exports/{job_id}.srt` (subtitles)
- `GET /api/exports/{job_id}.vtt` (subtitles)
- `GET /api/exports/{job_id}.rpp` (Reaper project)
- `POST /api/concatenate` (ffmpeg concat + optional mixing; multipart form)

## Concatenation & Mixing (FFmpeg)

Concatenation/mixing is implemented server-side via FFmpeg:
- API endpoint: `POST /api/concatenate` (multipart)
- Core wrapper: `lib/audio/ffmpeg.py`

If FFmpeg is missing or concat fails, jobs still complete and the ZIP includes `concat_error.txt`.

## Project Structure (Python)

```
elevenlabs-screenplay-formatter/
├── apps/
│   ├── api/                  # FastAPI app (JSON + jobs + SSE); mounts Flask
│   └── web/                  # Flask UI (Jinja2 templates + HTMX)
├── lib/                      # reusable core (typed; no web/framework imports)
├── py_cli/                   # Python CLI (replacement in progress)
├── tests/                    # pytest
├── pyproject.toml
└── README.md
```

## Environment Variables

Use `.env` in the repo root (copy from `.env.example`):

```bash
ELEVENLABS_API_KEY=...
ELEVENLABS_BASE_URL=https://api.elevenlabs.io
ELEVENLABS_TIMEOUT_S=30
FLASK_SECRET_KEY=dev
UPLOAD_DIR=uploads
FFMPEG_BIN=ffmpeg
```

Never commit `.env` (gitignored). If a key is ever exposed in logs/chat/screenshots, rotate it immediately in ElevenLabs.

## Screenplay Formats

The parser supports:
- Standard “Characters:” list + dialogue blocks
- Fountain-style scripts (no character list required)

See `EXAMPLE_SCREENPLAY.md` and `EXAMPLE_FOUNTAIN.md`.

## Troubleshooting

### `ModuleNotFoundError: No module named 'uvicorn'` (or `fastapi`)

Install Python deps:

```bash
python3 -m pip install -e ".[dev]"
```

### `Missing ELEVENLABS_API_KEY`

Set `ELEVENLABS_API_KEY` in `.env` (copy from `.env.example`).

### `FFmpeg failed` or `ffmpeg: command not found`

Install ffmpeg and verify `ffmpeg -version`.

## Tech Stack

### Current (Python)

- Flask + Jinja2 + HTMX (UI)
- FastAPI + Uvicorn (API + jobs + SSE)
- pytest + ruff + mypy (tooling)

## License

MIT License - Feel free to use this project for personal or commercial purposes.
