# Execution Context & Error Handling (Pragmatic Paranoia)

## Principle: Every external call will fail. Every input is hostile. Partial success is the norm.

## Error Taxonomy

### Layer 1: lib/ Errors (Business Logic)
- `NonRetryableError(RuntimeError)` — ElevenLabs auth failures (401), bad requests (400). Stop immediately.
- `GenerationError(RuntimeError)` — TTS failure mid-batch. Carries `.completed` (partial results), `.failed_index`, `.failed_character`.
- Validation functions return `List[str]` — never raise.

### Layer 2: apps/ Errors (HTTP)
- `HTTPException(400)` — malformed input, parse failure, validation errors
- `JSONResponse(429)` — rate limit exceeded (checked before any generation)
- `HTTPException(404)` — job not found, session not found
- `HTTPException(500)` — unhandled; should never occur if contracts are honored

## Retry Strategy (lib/elevenlabs/client.py)
- **Max retries**: 2 (total attempts = 3)
- **Retryable**: HTTP 429 (rate limit), 5xx (server error), network timeouts
- **Non-retryable**: HTTP 401 (auth), 400 (bad request) -> `NonRetryableError`
- **Backoff**: Not implemented. Retries are immediate.
- **Rule**: Never retry generation-level errors. Only retry individual API calls.

## Partial Failure Handling (Critical Pattern)
```
generate_all_audio_iter() yields N chunks:
  - Chunk 1: OK -> yield GeneratedAudio
  - Chunk 2: OK -> yield GeneratedAudio
  - Chunk 3: FAIL -> raise GenerationError(completed=[chunk1, chunk2], failed_index=2)
```
- **Callers MUST handle partial results.** The `.completed` list contains valid audio.
- Job runner captures partial results and marks job as failed with progress info.
- Sync endpoint (`/api/generate.zip`) aborts entirely on failure (no partial ZIP).

## Input Validation Order (Defense in Depth)
1. **Size gate**: `len(script_text) <= MAX_SCRIPT_CHARS` (routes)
2. **Pydantic validation**: Schema shape and types (FastAPI auto)
3. **Parse validation**: `parse_script()` returns diagnostics, not exceptions
4. **Character validation**: `validate_character_configs()` returns error list
5. **Filename sanitization**: `safe_basename()` strips traversal before any disk write
6. **Rate limiting**: `generation_limiter.check_limit(ip)` before generation

## Path Traversal Defense
- `safe_basename(value, default)` — null byte check FIRST, then strip `/`, `\`, reject `.`, `..`
- `sanitize_filename(value)` — HTTP Content-Disposition safety
- **Rule**: Every user-supplied string that touches a filesystem path or HTTP header MUST pass through these.

## Thread Safety Protocol
- `JobStore`: All access through `_lock: threading.Lock()`
- `Job._events`: All access through `_event_cond: threading.Condition()`
- `_RateLimiter`: All access through `_lock: threading.Lock()`
- **Rule**: Never hold two locks simultaneously. Never call `lib/` functions while holding a lock.

## Job State Machine
```
pending -> running -> complete
                   -> failed (with .error message and .completed partial results)
```
- Transitions are one-way. No restarts. No retries at job level.
- Failed jobs retain their event log for debugging (capped at 2000 events).
- All jobs expire after 24 hours regardless of state.

## Config Validation (Startup Paranoia)
- `ELEVENLABS_BASE_URL` is REQUIRED — no hardcoded fallback
- `FLASK_SECRET_KEY` must be 32+ chars (bypassed only when value is literal `"dev"`)
- `ELEVENLABS_API_KEY` is REQUIRED — empty string fails fast
- Missing env vars raise `ValueError` at startup, not at first request

## Disk Space Check
- `lib/utils.check_disk_space(path, min_bytes)` — called before large writes
- Returns bool. Caller decides to abort or warn.

## Execution Flow: What to Trust
- **Trust**: Frozen dataclasses from `lib/models.py` (immutable by construction)
- **Trust**: `AppConfig` after startup (frozen, validated)
- **Distrust**: All `request.form` / `request.json` data (validate first)
- **Distrust**: ElevenLabs API responses (check status codes, handle timeouts)
- **Distrust**: File paths from users (sanitize before use)
- **Distrust**: Job existence (jobs expire; always handle `None` from `job_store.get()`)
