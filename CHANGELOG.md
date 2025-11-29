# Changelog

All notable changes to the ElevenLabs Screenplay Formatter project.

## [Unreleased]
### Added
- Auto-fill Voice IDs feature: extracts Voice IDs from character lists in screenplay format `- CHARACTER (Voice ID: <ID>)` with one-click population of character configs.
- Context-aware audio generation: sends previous and next dialogue text to ElevenLabs API for improved audio continuity and natural transitions between lines.
- Stage direction preservation: new "Preserve Stage Directions [Brackets]" toggle for Turbo v2.5+ and Multilingual v3 models to send performance instructions like `[whispering]` or `[shouting]` to the AI for more expressive audio generation.

## [0.4.0] - 2025-11-28
### Added - Core Features
- Word-level timestamp support via ElevenLabs alignment API plus subtitle exports (SRT/VTT) and manifest timing metadata.
- Background-music/SFX Audio Production panel with persisted presets; concatenation server now mixes uploads alongside dialogue.
- Shareable project URLs, toast notifications, and enhanced UX messaging for status/errors, including auto-loading shared configs.
- Dialogue language selector plus curated voice suggestions per locale with one-click role presets.
- Project settings now surface ElevenLabs' full model catalog (Multilingual, Turbo, Flash, Monolingual) and auto-load new models when an API key is present.
- Reaper `.rpp` export option: generate per-character tracks with timeline placement for DAW workflows.
- Per-line preview feature: generate and audition individual dialogue lines with caching to avoid redundant API calls.
- Timeline-ish view: ordered list of dialogue blocks with character, line length, and estimated duration display.
- Generation profiles: save and load render profiles (e.g., "Fast draft", "High quality") with pre-configured model, bitrate, concatenation settings.
- Export manifests: JSON/CSV mapping each audio file to character, line index, original text, timestamps, and durations.
- Zip packaging: bundle all generated audio files plus manifest into downloadable `.zip` for DAW import.
- Script versioning: lightweight version label field on projects with labels included in filenames and manifests.

### Added - Parsing & UX
- Alias-aware screenplay parser with parenthetical handling, local-storage state persistence, progress-log controls, and accessibility tweaks.
- Fountain-style screenplay parsing (uppercase lines auto-create characters), support for `V.O./O.S./CONT'D`, optional spoken parentheticals, and new Fountain example script.
- Parser Diagnostics card with unmatched-line reporting for troubleshooting.
- Monospaced editor with fullscreen mode and `Ctrl+Enter` save shortcut.
- Character configuration search/filter for long scripts.
- "Apply to all characters" option for voice settings.
- Visual indicators for characters without assigned voices.
- Keyboard navigation and ARIA labels for accessibility.
- Color contrast improvements for readability.

### Added - Developer Experience
- Environment-driven output formats and concatenation URL support.
- ESLint/Vitest tooling and parser unit tests.
- Backend security knobs (configurable port/origin) and docs for advanced usage.
- Developer setup guide with Node version, package manager notes, and frontend/backend start commands.
- Architecture overview documentation describing component layout, state management, backend endpoints, and data flow.

### Added - Project Management
- Project save/load: JSON-based configs with script text, character mappings, voice settings, model, output format, and concatenate toggle.
- Voice presets: save and quickly assign named presets (e.g., "Narrator", "Hero") to characters.
- Default templates and "Load demo project" button for end-to-end workflow demonstration.
- Auto-save of last project to localStorage.

### Added - API & Error Handling
- Concatenation health-check card with backend status indicator and manual health check button.
- Resumable generation flow with progress bar and snippet previews.
- Optional "remember API key" toggle with clear browser-only storage explanation.
- Error surfaces showing inline failures with resume actions for API issues.
- Automatic retry logic with exponential backoff (2-3 retries with backoff caps).
- Dynamic rate limiting by inspecting API response headers (`x-rate-limit-remaining`).
- User-friendly error translations converting technical API errors into actionable advice.

### Added - CLI & Automation
- Node/CLI wrapper (`cli/generate.ts`) for command-line screenplay processing.
- Takes screenplay file and JSON config as input.
- Generates audio files with optional concatenation using same logic as UI.
- CLI documentation in `CLI.md`.

### Changed - Architecture
- Frontend state management migrated to Zustand store with persisted serialized blobs, enabling cross-session resume after browser refresh/crash.
- Refactored `App.tsx` from 895 to 723 lines (-19%) by extracting `useAudioGeneration` hook and utility modules (`downloads.ts`, `stringUtils.ts`, `errorHandling.ts`).
- Split monolithic state selectors into 7 focused selectors using `useShallow` for fine-grained subscriptions and reduced re-renders.
- Implemented `react-window` virtual scrolling in TimelinePanel (110px items) and CharacterConfigPanel (260px items) for large script performance.
- Optimized parser from O(n²) to O(n) by replacing linear character search with Map-based lookups (`aliasMap` and `fullNameMap`).

### Changed - API & Generation
- ElevenLabs generation pipeline now applies dynamic rate limiting, clearer error translations, and exposes detailed progress metadata.
- Output format now propagates correctly to ElevenLabs requests, downloads, and bash scripts with safe payload escaping.
- Voice speed setting now properly included in all API calls (previously ignored).
- CLI respects output format and voice speed settings (previously hardcoded to MP3 and default speed).

### Changed - Backend
- Concatenation server emits streams with randomized temp files and improved error handling.
- README/CONCATENATION_SETUP/AGENTS now reference correct dev ports and environment setup.

### Fixed - Critical Issues
- **Blob storage in localStorage**: Migrated from localStorage (causing 5-10MB quota crashes with base64-encoded audio) to IndexedDB for binary blob storage. Only metadata and resume indices persist in localStorage.
- **Resume flow data loss**: Fixed bug where completed audio clips were lost when concatenation was disabled. Now preserves `error.completedBlobs` regardless of concatenation setting.
- **Concatenation failures wasting API credits**: Generation now returns `generatedBlobs` even when FFmpeg server fails, allowing ZIP download and retry of just concatenation step.
- **Memory leaks from object URLs**: Implemented proper cleanup in `handlePreviewLine` to revoke object URLs when replaced, preventing browser slowdown.

### Fixed - Functional Issues
- Voice speed slider now functional (previously UI displayed slider but API calls omitted the `speed` field).
- React error boundaries implemented to catch component rendering errors and prevent full app crashes.
- Reaper export now declares correct source type (`<SOURCE MP3>` or `<SOURCE WAV>`) based on actual file format instead of always outputting `WAV`.
- CLI now respects output format and voice speed from config instead of hardcoding values.
- VoiceSuggestionsPanel no longer mutates state during render (fixed `safeCharacter` useMemo side effect using `useEffect` pattern).

### Fixed - Parser & UX
- Inline dialogue with parentheticals now parses correctly.
- Misaligned port references and missing environment guidance in documentation.
- Inconsistent error handling patterns unified with `logError` and `notifyError` utilities.
