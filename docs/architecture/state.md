# State Management (Orthogonality)

## Principle: Every stateful component is isolated. Changing one MUST NOT cascade to others.

## Stateful Components (exhaustive list)

### 1. AppConfig (`apps/api/config.py`)
- **Scope**: Process-global singleton
- **Mutability**: FROZEN. Created once at startup via `load_config_from_env()`.
- **Location**: `app.state.config` (FastAPI) / `current_app.config["APP_CONFIG"]` (Flask)
- **Rule**: Never reassign. Never monkey-patch. Never read env vars after startup.

### 2. JobStore (`apps/api/jobs.py`)
- **Scope**: Process-global singleton
- **Mutability**: Thread-safe mutable (protected by `threading.Lock`)
- **Contains**: `_jobs: Dict[str, Job]`, `_last_cleanup_s: float`
- **Mutation rules**:
  - `create()` — only way to add a job
  - `get()` — read-only lookup
  - `cleanup_old_jobs()` — periodic pruning (called internally)
- **Rule**: Never access `_jobs` directly. Always go through public API.
- **Orthogonality**: JobStore knows nothing about HTTP, Flask, or templates.

### 3. Job (`apps/api/jobs.py`)
- **Scope**: Per-job instance
- **Mutability**: Thread-safe mutable (protected by `threading.Condition`)
- **Contains**: `_events: Deque`, status, progress, error, export_path
- **Mutation rules**:
  - `add_event()` — append-only event log
  - `set_complete()` / `set_failed()` — terminal state transitions
- **Rule**: Job status is a one-way state machine: `pending -> running -> complete|failed`
- **Orthogonality**: Job knows nothing about which route created it.

### 4. WebSessionStore (`apps/web/session_store.py`)
- **Scope**: Flask-only
- **Mutability**: Mutable (disk-backed JSON, NOT thread-safe)
- **Contains**: Session payloads keyed by UUID
- **Mutation rules**:
  - `create()` — writes new session file
  - `patch()` — merge-updates existing session
  - `delete()` — removes session file
- **Rule**: Never share between FastAPI and Flask routes.
- **Orthogonality**: Completely independent from JobStore. They serve different lifecycles.

### 5. RateLimiter (`lib/utils_web.py`)
- **Scope**: Process-global singleton (`generation_limiter`)
- **Mutability**: Thread-safe mutable (protected by `threading.Lock`)
- **Contains**: `_requests: Dict[str, List[float]]` — IP -> timestamp list
- **Rule**: Process-local only. Does NOT survive restarts. Does NOT distribute.

## State Isolation Rules

- **UI state** (session, form data) is in `WebSessionStore` — Flask only
- **Job state** (progress, events) is in `JobStore` — shared across FastAPI/Flask via `app.config`
- **Config state** is in `AppConfig` — immutable, injected everywhere
- **API client state** is NONE — `ElevenLabsClient` is stateless (created per-request or per-job)

## Anti-Patterns to Avoid
- Do NOT store state in module-level dicts outside the above components
- Do NOT use Flask `session` for generation state (it's cookie-sized)
- Do NOT cache parsed scripts in memory (parse is fast, cache invalidation is hard)
- Do NOT pass `request` objects into `lib/` functions (breaks orthogonality)
- Do NOT add database/Redis without rearchitecting all 5 state components above
