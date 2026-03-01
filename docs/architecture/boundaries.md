# Boundaries (Design by Contract)

## Dependency Direction Law
```
lib/ (pure)  <--  apps/api/ (FastAPI)
                  apps/web/ (Flask)
```
- `lib/` NEVER imports from `apps/`. Violation = architectural breach.
- `apps/api/` and `apps/web/` NEVER import from each other.
- All cross-layer communication flows through frozen dataclasses defined in `lib/models.py`.

## Seam 1: Script Parsing
- **Contract**: `lib/parser.parse_script(script_text: str, preserve_stage_directions: bool) -> ParsedScript`
- **Precondition**: `script_text` is a non-empty string, <= `MAX_SCRIPT_CHARS`
- **Postcondition**: Returns `ParsedScript` with `.characters`, `.dialogue_chunks`, `.diagnostics`
- **Invariant**: Pure function. No side effects. No I/O. Thread-safe.

## Seam 2: Audio Generation
- **Contract**: `lib/generation.generate_all_audio_iter(client, dialogue_chunks, character_configs, ...) -> Iterator[GeneratedAudio]`
- **Precondition**: `client` is a configured `ElevenLabsClient`; every character in chunks has a matching config
- **Postcondition**: Yields `GeneratedAudio(filename, audio_bytes, timing)` per chunk
- **Failure**: Raises `GenerationError` with `.completed` (partial results) and `.failed_index`

## Seam 3: ZIP Export
- **Contract**: `lib/exports.zip_bundle.build_zip_bundle(audio_files, manifest_entries, extra_files) -> bytes`
- **Precondition**: `audio_files` is list of `(filename, bytes)` tuples
- **Postcondition**: Returns valid ZIP archive as `bytes`. No disk I/O.

## Seam 4: Config Injection
- **FastAPI**: `apps/api/deps.get_config(request) -> AppConfig` via `Depends()`
- **Flask**: `apps/web/routes._get_cfg() -> current_app.config["APP_CONFIG"]`
- **Invariant**: `AppConfig` is frozen. Never mutated after startup.

## Seam 5: Job Lifecycle
- **Create**: `job_store.create() -> Job` (returns job with UUID)
- **Mutate**: `job.add_event(type, data)` — thread-safe via `threading.Condition`
- **Read**: `job.snapshot() -> JobSnapshot` — immutable point-in-time copy
- **Wait**: `job.wait_for_events(last_event_id, timeout_s)` — blocking SSE-style poll
- **Cleanup**: `job_store.cleanup_old_jobs(max_age_s=86400)` — periodic, lock-protected

## Seam 6: Session Persistence (Flask only)
- **Contract**: `WebSessionStore.create(payload) -> SessionData`
- **Storage**: Disk-backed JSON in `UPLOAD_DIR/sessions/`
- **Invariant**: Session IDs are UUIDs. Payloads are serialized dicts.

## Seam 7: Validation
- **Contract**: `lib/validation.validate_character_configs(chunks, configs) -> List[str]`
- **Returns error strings, not exceptions.** Caller decides severity.

## Seam 8: Security Boundaries
- `lib/filenames.safe_basename(value, default)` — strips path traversal, null bytes
- `apps/api/http_safety.sanitize_filename()` / `sanitize_fieldname()` — HTTP header safety
- All user-supplied filenames MUST pass through these before touching disk or headers
