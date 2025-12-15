# Migration Roadmap: Node/React → Python Modular Monolith (v1.0)

**Goal:** Convert this repo into a Python-first modular monolith while maintaining v0.4 functionality (parsing, generation, audio mixing, exports, project management, share links, CLI).

**Target Stack (No-Bloat compliant):**
- HTML UI: **Flask + Jinja2 + HTMX** (progressive enhancement)
- API + jobs/progress: **FastAPI**
- Core library: **`lib/`** (pure, reusable, typed; no web/framework imports)
- Auth: simple cookie/session (if/when multi-user is needed)
- Infra: local/bare-metal assumptions (no Docker/K8s/Terraform)

---

## 1) Target Modular Monolith Structure

One repo, one Python environment, clear import direction:

```
.
├── lib/                       # reusable core (no Flask/FastAPI imports)
│   ├── config.py              # @dataclass Config types (no env reads)
│   ├── parser.py              # screenplay parsing + diagnostics
│   ├── models.py              # ProjectConfig, CharacterConfig, etc. (dataclasses)
│   ├── elevenlabs/            # API client, retries, rate limiting
│   ├── exports/               # ZIP, SRT/VTT, Reaper, manifests
│   ├── audio/                 # concat + mixing helpers (ffmpeg wrapper)
│   └── share_links.py         # base64 project payload encoding/decoding
├── apps/
│   ├── api/                   # FastAPI (JSON, jobs, SSE progress)
│   │   ├── main.py
│   │   ├── schemas.py         # Pydantic models at the boundary
│   │   └── jobs.py            # in-memory job registry (v1), pluggable
│   └── web/                   # Flask UI (Jinja2 templates + HTMX)
│       ├── app.py
│       ├── routes.py
│       ├── templates/
│       └── static/            # candlelight.css, minimal JS (optional)
├── cli/                       # Python CLI entrypoint package
│   └── __main__.py
├── tests/                     # pytest; golden fixtures from v0.4 outputs
├── pyproject.toml
└── README.md
```

**Import rule:** `apps/*` and `cli/*` may import `lib/*`. `lib/*` MUST NOT import `apps/*` or web/framework modules.

---

## 2) Feature Parity Map (what must survive the rewrite)

### Core
- Screenplay parsing (standard + Fountain), alias resolution, diagnostics
- Voice assignment per character + presets
- ElevenLabs generation (models/voices listing; text-to-speech; context previous/next)
- Retry + rate limiting behavior
- Timeline-like preview (at least per-line preview playback)
- Exports: ZIP of audio, manifest JSON/CSV, SRT/VTT, Reaper `.rpp`
- Audio production: background track + SFX overlay + concatenation
- Project management: save/load project config; demo load
- Share links: `?project=...` encodes a project payload
- CLI batch generation with local concat

### UX/Behavioral equivalence targets
- Same default voice settings (stability/similarity/style/speed) semantics
- Same parsing output for `EXAMPLE_SCREENPLAY.md` and `EXAMPLE_FOUNTAIN.md`
- Same export formats for the same inputs (byte-identical where feasible; otherwise structurally equivalent)

---

## 3) Migration Strategy (phased, verifiable, ends cleanly)

### Phase 0 — Baseline & Lockdown (1–3 days)
**Goal:** Freeze Node features and produce fixtures that prove parity.

- [ ] Tag current working version: `v0.4.0-node-final` (or equivalent)
- [ ] Collect fixtures:
  - Inputs: `EXAMPLE_SCREENPLAY.md`, `EXAMPLE_FOUNTAIN.md`, plus 2–3 real-world scripts (anonymized)
  - Expected outputs: parsed chunks JSON, manifest JSON/CSV, SRT/VTT, `.rpp`
- [ ] Decide “equivalence policy”:
  - Parser output must match exactly (fields + ordering)
  - Export text formats match exactly where deterministic
  - Audio bytes may differ if codec settings change; validate duration/order and metadata

**Exit criteria:** a small, committed fixture set that we can run through Python ports.

---

### Phase 1 — Python Project Skeleton (2–4 days)
**Goal:** Create the modular monolith scaffolding and tooling before porting logic.

- [x] Add `pyproject.toml` (minimal deps), `ruff`, `mypy`, `pytest`
- [x] Establish module layout (`lib/`, `apps/api/`, `apps/web/`, `cli/`, `tests/`)
- [x] Add typed config objects in `lib/config.py`:
  - `@dataclass ElevenLabsConfig`
  - `@dataclass AppConfig`
  - Env-reading function lives in app boundary (e.g., `apps/api/config.py`) and returns `AppConfig`
- [x] Define a single local dev command:
  - Runs one ASGI server that mounts Flask under FastAPI (one port)

**Exit criteria:** `python -m apps.api` boots and serves a placeholder page from Flask.

---

### Phase 2 — Port Core Library (`lib/`) (1–3 weeks)
**Goal:** Rebuild all non-UI functionality in `lib/` with strong typing and tests.

#### 2.1 Parser + Diagnostics (port `utils/parser.ts`)
- [x] Port parsing semantics (standard + Fountain)
- [x] Preserve diagnostics: unmatched lines, detected characters, confidence/flags (as currently implemented)
- [x] Unit tests: golden JSON outputs from Phase 0 fixtures

**Exit criteria:** fixture scripts produce the same parsed structure as TS.

#### 2.2 Voice extraction + alias helpers (port `utils/voiceExtraction.ts`)
- [x] Auto-fill voice IDs from character lists
- [x] Tests ported from `utils/voiceExtraction.test.ts`

#### 2.3 ElevenLabs integration (port `utils/elevenLabsApi.ts` + `utils/elevenLabsClient.ts`)
- [x] Implement a typed client:
  - `Client(config: ElevenLabsConfig)` with `generate_audio(...)`, `list_voices()`, `list_models()`
- [x] Retry logic (429 backoff), network error handling, and rate-limit-aware pacing
- [x] Validate external responses (status codes, JSON shape) at boundary

**Exit criteria:** mocked responses + “dry-run” mode prove parity without network calls.

#### 2.4 Exporters (port `utils/manifest.ts`, `utils/downloads.ts`, `utils/reaperExport.ts`)
- [x] Manifest JSON/CSV builder
- [x] SRT/VTT generation (timestamp formatting parity)
- [x] ZIP bundling with stable filenames
- [x] Reaper `.rpp` generator (tracks/placement parity)

**Exit criteria:** fixture outputs match (or are structurally equivalent with documented diffs).

#### 2.5 Audio concat + production mixing (port `server/index.js`)
- [x] Implement `lib/audio/ffmpeg.py` wrapper using `subprocess` (no shell=True)
- [x] Implement:
  - Concat N files (safe temp filelist)
  - Optional background mix (volume)
  - Optional SFX overlays (start time + volume)
- [x] Use safe temp directories and deterministic cleanup

**Exit criteria:** produces a playable MP3 for a known fixture set, with expected ordering and approximate duration.

---

### Phase 3 — Python CLI Parity (3–7 days)
**Goal:** Replace `cli/generate.ts` with a Python CLI that uses `lib/`.

- [ ] CLI commands:
  - Parse-only (outputs JSON diagnostics)
  - [x] Generate audio (per-chunk files)
  - [x] Concat/mix via ffmpeg wrapper
  - Export bundle generation
- [x] Input validation (file paths, config shape)
- [x] Document environment vars; no secrets in args by default

**Exit criteria:** CLI can reproduce fixture exports end-to-end on local machine.

---

### Phase 4 — FastAPI: JSON API + Jobs/Progress (1–2 weeks)
**Goal:** Provide stable programmatic endpoints and background execution.

#### 4.1 API Surface (minimum)
- [x] `POST /api/parse` → parsed chunks + diagnostics
- [x] `POST /api/projects/validate` → config validation errors (typed)
- [x] `POST /api/generate` → returns `job_id` (async jobs)
- [x] `GET /api/jobs/{job_id}` → status/progress snapshot
- [x] `GET /api/jobs/{job_id}/events` → SSE progress stream
- [x] `GET /api/exports/{job_id}.zip` → export bundle download

#### 4.2 Jobs model (v1)
- In-memory job registry (local-only; not durable across restarts)
- SSE semantics:
  - Per-job event ring buffer (bounded; supports reconnect via `Last-Event-ID`)
  - Snapshot is emitted immediately on connect
- Job state:
  - requested config hash
  - current chunk index
  - progress messages
  - produced filenames
  - error details (sanitized)
- Resume:
  - restart job from last completed chunk index

**Exit criteria:** API supports a full generation run with progress streaming.

---

### Phase 5 — Flask UI (Jinja2 + HTMX) (1–3 weeks)
**Goal:** Replace React UI with SSR screens while keeping workflows.

#### 5.1 Pages (minimum parity)
- `/` Script editor + upload/load project + share link load
- `/characters` character list + voice assignment + presets
- `/generation` start job + live progress (HTMX + SSE)
- `/timeline` per-line preview (server-rendered list + audio tags; paginate/virtualize later)
- `/exports` download ZIP/manifest/subtitles/Reaper

#### 5.2 HTMX interactions
- Validate config inline before starting generation
- Start job and subscribe to SSE for progress updates
- Trigger per-line preview generation (one-off calls)

#### 5.3 Candlelight theme enforcement
- Single CSS file with only allowed hex colors:
  - `#121212`, `#EBD2BE`, `#A6ACCD`, `#98C379`, `#E06C75`

**Exit criteria:** end-to-end “happy path” works entirely in Python UI.

---

### Phase 6 — Cutover & Node Removal (2–5 days)
**Goal:** Finish cleanly: Python is the product; Node is archived.

- [ ] Update `README.md` to make Python the default
- [ ] Remove/retire:
  - Vite/React entrypoints and build scripts
  - Node server (`server/`) and Node CLI (`cli/generate.ts`)
  - `package.json`/`package-lock.json` if no longer needed
- [ ] Keep a permanent archive reference:
  - git tag for v0.4 final Node version
  - optional `legacy/` folder only if you must keep source in-tree (prefer tag-only)
- [ ] Add a “migration notes” section:
  - Known diffs (if any) and how to validate

**Exit criteria:** fresh clone can run all functionality with Python only.

---

## 4) Validation Checklist (run at every phase gate)

- Parser: fixture scripts match expected parsed JSON exactly
- Exports: manifest JSON/CSV + SRT/VTT + `.rpp` match expected outputs
- Audio pipeline: concat and mixing produce playable output; ordering correct
- API boundaries: invalid inputs produce typed, actionable errors
- Secrets: no keys in git; `.env` ignored; `.env.example` updated as needed
- UI: candlelight palette only; core flows available without JS beyond HTMX

---

## 5) Risk Register (and mitigations)

- **Risk: behavioral drift in parser.**
  - Mitigation: golden fixtures + strict equality tests; port in small commits.
- **Risk: ElevenLabs API differences (timeouts, headers, rate limits).**
  - Mitigation: mock-first tests; configurable timeouts; conservative backoff defaults.
- **Risk: long-running generation blocks web workers.**
  - Mitigation: FastAPI background tasks + SSE; cap concurrency; clear cancellation.
- **Risk: huge scripts overwhelm SSR rendering.**
  - Mitigation: pagination on timeline; server-side filtering; avoid rendering 1k+ rows at once.
- **Risk: share links too large for URLs.**
  - Mitigation: keep base64 for parity; add optional “save project server-side” share IDs later.

---

## 6) Definition of Done (v1.0)

- [ ] One Python command starts the app (Flask UI + FastAPI API mounted together)
- [ ] Feature parity checklist is complete (section 2)
- [ ] Fixtures pass in CI (pytest) without network access
- [ ] No Node required for build/run/test
- [ ] Documentation updated (setup, env vars, troubleshooting, ffmpeg requirement)
