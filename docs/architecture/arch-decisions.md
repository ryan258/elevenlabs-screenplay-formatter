# Architectural Decisions (Easier to Change)

## Decision 1: Dual Framework (FastAPI + Flask via WSGIMiddleware)
- **What**: FastAPI serves `/api/*`; Flask serves `/` UI routes. Flask is mounted as WSGI middleware.
- **Why ETC**: Swap Flask for any WSGI app without touching API routes. Replace FastAPI with any ASGI framework without touching templates. The mount point is a single line in `main.py`.
- **Constraint**: Shared state passes through `app.state` (FastAPI) and `app.config` (Flask). Keep this bridge minimal.

## Decision 2: lib/ as Portable Arsenal
- **What**: All business logic lives in `lib/` with zero framework imports.
- **Why ETC**: Any module in `lib/` can be extracted to a standalone package or CLI tool. To add a new frontend (CLI, Discord bot, etc.), import `lib/` directly.
- **Constraint**: `lib/` uses only stdlib + peer `lib/` imports. Never import `flask`, `fastapi`, `pydantic`, or `uvicorn` inside `lib/`.

## Decision 3: Frozen Dataclasses as Data Contracts
- **What**: All data models in `lib/models.py` are `@dataclass(frozen=True)`.
- **Why ETC**: Changing a model field is a single edit. Frozen prevents hidden mutation bugs across threads. Replace with `attrs`, `namedtuple`, or Pydantic models by changing one file.
- **Constraint**: Never add mutable fields. Never use `__post_init__` for side effects.

## Decision 4: No ORM / No Database
- **What**: Jobs in memory (`Dict[str, Job]`). Sessions on disk (JSON files).
- **Why ETC**: Adding SQLite/Postgres later requires implementing `JobStore` and `WebSessionStore` interfaces — no other code changes. Current stores are ~100 lines each.
- **Constraint**: Accept data loss on crash. Do not build durability assumptions on top of in-memory stores.

## Decision 5: Custom .env Loader (No python-dotenv)
- **What**: `apps/api/config.py._load_dotenv_if_present()` is a 15-line stdlib implementation.
- **Why ETC**: Zero dependency. Replace with `python-dotenv` by swapping one function.
- **Constraint**: Supports only `KEY=VALUE` lines. No interpolation, no export prefix.

## Decision 6: urllib-based HTTP Client (No requests/httpx)
- **What**: `lib/elevenlabs/client.py` uses `urllib.request` directly.
- **Why ETC**: No dependency to vendor or upgrade. Swap to `httpx` by replacing one class.
- **Constraint**: No async support. No connection pooling. Acceptable for sequential TTS calls.

## Decision 7: Iterator-Based Generation
- **What**: `generate_all_audio_iter()` yields `GeneratedAudio` one chunk at a time.
- **Why ETC**: Callers choose to collect all, stream, or abort early. Sync wrapper (`generate_sync_zip_bundle`) and async job runner both consume the same iterator.
- **Constraint**: Iterator is single-pass. Do not rewind.

## Decision 8: Thread-Based Job Execution (No Celery/asyncio)
- **What**: Background jobs run in `threading.Thread`, synchronized via `threading.Condition`.
- **Why ETC**: Replace with `asyncio.Task`, `concurrent.futures`, or Celery by swapping `routes_jobs._run_generation_job`. Job interface stays the same.
- **Constraint**: Single-process only. Thread count bounded by concurrent generation requests.

## Decision 9: HTMX for Interactivity (No JS Framework)
- **What**: All dynamic UI via HTMX attributes (`hx-post`, `hx-swap`, `hx-target`).
- **Why ETC**: Server returns HTML fragments. Add/remove interactivity by editing Jinja2 templates. No build step. No JS state management.
- **Constraint**: `htmx.min.js` served from `apps/web/static/`. No CDN. Pin version manually.

## Decision 10: Validation Returns Errors, Not Exceptions
- **What**: `lib/validation.validate_character_configs()` returns `List[str]` error messages.
- **Why ETC**: Callers decide what to do with errors (400 response, template flash, log). No exception hierarchy to maintain.
- **Constraint**: Never raise from validation functions. Always return error lists.
