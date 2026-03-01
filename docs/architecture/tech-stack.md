# Tech Stack & Hard Constraints

## Runtime
- **Python**: 3.9+ (mypy strict target)
- **Server**: Single-process uvicorn on port 8000
- **OS**: Bare metal Darwin/Linux. No containers.

## Frameworks (exact versions pinned in pyproject.toml)
- `fastapi>=0.110` — ASGI app, serves `/api/*` JSON routes
- `flask>=3.0` — WSGI app, mounted under FastAPI via `WSGIMiddleware`, serves `/` HTML routes
- `jinja2>=3.1` — Template engine (Flask-bound)
- `pydantic>=2.6` — Request/response validation (FastAPI-bound only)
- `uvicorn>=0.27` — ASGI server, single worker
- `python-multipart>=0.0.9` — Form data parsing

## Dev Tooling
- `ruff>=0.6`, `mypy>=1.8` (strict), `pytest>=7.0`, `pre-commit>=3.7`

## Forbidden Technologies
- **NO** npm, node_modules, webpack, or any JS build toolchain
- **NO** Docker, docker-compose, Kubernetes
- **NO** Redis, Celery, or external task queues
- **NO** React, Vue, Svelte, or any JS framework
- **NO** SQLAlchemy, Postgres, or any database engine
- **NO** python-dotenv (custom .env loader in `apps/api/config.py`)
- **NO** requests, httpx, aiohttp (uses stdlib `urllib` via `lib/elevenlabs/client.py`)

## Hard Limits
- `MAX_SCRIPT_CHARS = 2_000_000` (2MB input ceiling)
- `MAX_DIALOGUE_CHUNKS = 5_000` (parser output ceiling)
- `_RateLimiter`: 5 requests / 60s per IP (process-local, not distributed)
- `ElevenLabsClient.max_retries = 2`
- `Job._events`: `deque(maxlen=2000)` — event log cap per job
- `JobStore` cleanup: 24h max job retention (`max_age_s=86400`)

## External Dependencies
- **ElevenLabs API**: `ELEVENLABS_BASE_URL` (required, no hardcoded endpoint)
- **Disk**: `UPLOAD_DIR` (default `uploads/`), `WebSessionStore` writes to disk
- **Env vars**: `ELEVENLABS_API_KEY`, `FLASK_SECRET_KEY` (32+ chars, "dev" bypasses)

## Single-Process Assumption
- All in-memory state (JobStore, RateLimiter) is process-local
- Multi-worker deployments break rate limiting and job tracking
- No shared-nothing architecture — do not scale horizontally without rearchitecting state
