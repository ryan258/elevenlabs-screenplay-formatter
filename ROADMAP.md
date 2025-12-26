# Roadmap — ElevenLabs Screenplay Formatter

This roadmap tracks the Python-first implementation on `main`. The legacy Node/React v0.4.0 app is archived in an older branch/tag and is not maintained here.

---

## Current Status (Python, `main`)

- ✅ Flask UI wizard (Jinja2 + HTMX): Script → Characters → Generation → Timeline → Exports
- ✅ Screenplay parsing (standard + Fountain) with diagnostics
- ✅ Character voice assignment + Voice ID auto-fill from scripts
- ✅ ElevenLabs voice browsing (cached) + apply-to-character flow
- ✅ Async generation jobs with SSE progress streaming
- ✅ Exports: ZIP + manifest JSON/CSV + SRT/VTT + Reaper `.rpp`
- ✅ Optional FFmpeg concatenated “listen-through” audio (best-effort; per-line clips always generated)
- ✅ Node/React/Express implementation removed from `main` (archived separately)

---

## Direction: Python-First (FastAPI + Flask)

The product is intentionally local-only and “no-bloat”: Flask serves HTML (with HTMX for interactivity) while FastAPI runs jobs and streams progress. The shared core lives in `lib/` and must remain framework-free.

### Constraints

- **No-Bloat:** Jinja2 templates + HTMX for interactivity; simple cookie/session auth; local/bare-metal assumptions (no Docker/K8s/Terraform).
- **Arsenal portability:** `lib/` must not import from app entrypoints, routers/views, or framework modules; use typed config objects (env-backed) and pass config into operations.
- **Type safety:** public functions fully typed; validate external inputs at boundaries (HTTP, files, env, model output).
- **Candlelight UI palette:** only `#121212`, `#EBD2BE`, `#A6ACCD`, `#98C379`, `#E06C75` in user-facing styles.

### Target Architecture (current)

- `lib/` (pure, reusable): Fountain/parser, project model, ElevenLabs client, export builders (ZIP, SRT/VTT, Reaper), audio pipeline helpers, and validation.
- `apps/api/` (FastAPI): REST endpoints for parsing, generation, exports, health; background job execution; file upload/download boundaries; typed request/response models.
- `apps/web/` (Flask): SSR UI (Jinja2) + HTMX actions that call into `lib/` directly (or via internal API if we choose to isolate); cookie/session; Candlelight theme.
- `py_cli/` (Python): minimal batch generation CLI that reuses `lib/`.

For historical migration notes, see [MIGRATION_ROADMAP.md](./MIGRATION_ROADMAP.md).

### Acceptance Criteria (Definition of Done)

- [x] A single `python -m ...` (or `uv run ...`) starts the Flask UI and FastAPI API in local dev without Node (after installing Python deps).
- [x] Parser + diagnostics match current behavior on existing example scripts (`EXAMPLE_*.md`/`*.txt`).
- [/] CLI supports multi-script batch generation and local concatenation (minimal; ongoing improvements).
- [x] Export formats (ZIP/manifest, SRT/VTT, Reaper) are implemented in `lib/`.
- [x] No secrets committed; `.env` remains ignored; `.env.example` documents required values.

---

## Recent Additions (v2.1 - In Progress)

### UX Improvements ✅
- **Model Picker Tooltips**: Hover descriptions for ElevenLabs models
- **FFmpeg Detection**: Real-time availability check with install guidance
- **Share Link Creation**: Generate shareable project URLs with one click

### Parser Enhancements 🔄
- **Enhanced Diagnostics**: Character detection metadata with confidence scores
- **Diagnostics API**: `/characters/diagnostics` endpoint (UI in progress)
- **Script Formatter**: Auto-fix common parsing issues (planned)

### Validation & Cost Estimation 📋
- **Cost Calculator**: Pre-generation API cost estimates (planned)
- **Character Metrics**: Line counts, detection methods, confidence bars

---

## Future Enhancements

### Docs & UX

- [x] Add a small "model picker" (cached) instead of a free-text Model ID field.
  - [x] Enhanced with tooltips showing model descriptions on hover
- [x] Detect FFmpeg availability and make concatenate defaults/UX clearer.
  - [x] Shows availability status with install instructions if missing
- [x] Add an explicit UI affordance for share links (currently decode-only).
  - [x] "Create Share Link" button with copy-to-clipboard functionality

### Testing & Quality Assurance

**Goal:** Improve reliability and prevent regressions through automated testing.

- [x] **Parser unit tests**
  - [x] Standard + Fountain parsing coverage (`tests/`)
  - [x] Share link encode/decode tests
  - [x] ZIP/manifest safety tests

- [/] **API client tests**
  - [x] HTTP safety + input boundary tests
  - [ ] Mock ElevenLabs API responses (no-network CI-safe)
  - [ ] Retry/rate-limit behavior tests

- [ ] **End-to-end tests** (Playwright for Python)
  - [ ] Load test script and assign voices
  - [ ] Mock API responses and verify UI flow

- [ ] **Maintenance scripts**
  - [ ] GitHub Actions workflow for lint + tests on push/PR
  - [ ] Automated build verification

### Explicitly Out of Scope (local-only)

- Multi-user auth/roles and enterprise features.
- “Resume after restart” job durability.

### Parser Enhancements

- [/] **Parser diagnostics mode**
  - [x] Enhanced `ParserDiagnostics` dataclass with character detection metadata
  - [x] Character detection confidence scores (0.0-1.0 based on detection method and line count)
  - [/] Optional "show parsed view" that lists detected characters and their lines (route added, UI in progress)
  - [ ] Highlight lines that failed to parse for user debugging (partially done via unmatched_lines)

- [ ] **Script formatter (auto-fix parsing issues)**
  - [ ] Detect and fix character name case issues (lowercase → UPPERCASE)
  - [ ] Normalize whitespace (tabs → spaces, multiple spaces → single)
  - [ ] Fix inconsistent line breaks
  - [ ] Add missing character declarations to Characters: list
  - [ ] Preview mode showing before/after diffs

### Workflow & Automation

- [ ] **Batch processing improvements**
  - [ ] Sequential processing of multiple screenplay files (chapters/episodes)
  - [ ] Rate-limiting and cooldown between runs
  - [ ] Progress tracking across multiple files
  - [ ] Batch configuration presets

### Error Handling & Resilience

- [ ] **Better error recovery**
  - [ ] Automatic retry for transient network failures
  - [ ] Improved localStorage/IndexedDB corruption handling
  - [ ] Graceful degradation when backend is unavailable

- [ ] **Script validation**
  - [x] Character/word count display (shown in diagnostics panel)
  - [ ] Estimated API cost calculator (in progress - module designed, needs implementation)
  - [ ] Warning before processing extremely large scripts (50K+ words)
  - [ ] Memory usage estimation

### Developer Experience

- [ ] **Python packaging & dev ergonomics**
  - [ ] Standardize tooling (`ruff`, `mypy`, `pytest`) and a single-run dev command
  - [ ] Document local ffmpeg requirements and supported OSes
  - [ ] Add pre-commit hooks (optional, non-blocking)

### Integrations & Export Formats

- [ ] **Enhanced Reaper integration**
  - [ ] Export formats tailored for Reaper track templates
  - [ ] Marker/region generation for dialogue sections
  - [ ] Automatic track coloring by character

- [ ] **Additional DAW exports**
  - [ ] Pro Tools session templates
  - [ ] Logic Pro project format
  - [ ] Studio One export

### Backlog / Nice-to-Have Ideas

Ideas to revisit after core stability and testing are solid:

- [ ] **Advanced audio processing**
  - [ ] Real-time waveform preview
  - [ ] Basic audio normalization
  - [ ] Automatic silence trimming

- [ ] **Collaboration features**
  - [ ] Multi-user project editing (if needed)
  - [ ] Version history and diff view
  - [ ] Comment threads on dialogue lines

- [ ] **Cloud integration**
  - [ ] Optional cloud storage for projects
  - [ ] Sync across devices
  - [ ] Team libraries for voice presets

---

## Contributing

See [ARCHITECTURE.md](./ARCHITECTURE.md) for system overview and [CONTRIBUTING.md](./CONTRIBUTING.md) for development guidelines.

---

## Version History

- **v0.4.0** (2025-11-28) - Comprehensive feature release with all core functionality
- **v0.3.x** - Workflow automation and CLI
- **v0.2.x** - Parsing enhancements and UX improvements
- **v0.1.x** - MVP polishing and stability

See [CHANGELOG.md](./CHANGELOG.md) for detailed release notes.
