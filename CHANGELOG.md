# Changelog

## [Unreleased]
### Added
- Word-level timestamp support via ElevenLabs alignment API plus subtitle exports (SRT/VTT) and manifest timing metadata.
- Background-music/SFX Audio Production panel with persisted presets; concatenation server now mixes uploads alongside dialogue.
- Shareable project URLs, toast notifications, and enhanced UX messaging for status/errors, including auto-loading shared configs.
- Alias-aware screenplay parser with parenthetical handling, local-storage state persistence, progress-log controls, and accessibility tweaks.
- Environment-driven output formats and concatenation URL support, plus ESLint/Vitest tooling and parser unit tests.
- Backend security knobs (configurable port/origin) and docs for advanced usage, API key handling, and contributor onboarding.
- Concatenation health-check card, resumable generation flow with progress bar/snippet previews, and optional “remember API key” toggle for transparency.
- Fountain-style screenplay parsing (uppercase lines auto-create characters), support for `V.O./O.S./CONT'D`, optional spoken parentheticals, and a new Fountain example script.
- Parser Diagnostics card with unmatched-line reporting, monospaced editor tweaks, fullscreen save shortcut, and Voice Config search/apply-to-all utilities.

### Changed
- Frontend state management now runs through a persisted Zustand store with serialized blobs, enabling resume after refresh and share-link ingestion.
- ElevenLabs generation pipeline applies dynamic rate limiting, clearer error translations, and exposes detailed progress metadata for timeline panels.
- Output format now propagates to ElevenLabs requests, downloads, and bash scripts; bash scripts escape payloads safely.
- Concatenation server emits streams with randomized temp files and improved error handling.
- README/CONCATENATION_SETUP/AGENTS now reference the correct dev ports and explain environment setup.
- Generation errors now surface inline with resume actions; ElevenLabs calls retry automatically with exponential backoff.

### Fixed
- Inline dialogue with parentheticals parses correctly; misaligned port references and missing env guidance in docs.
