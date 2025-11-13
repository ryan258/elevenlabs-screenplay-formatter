# Changelog

## [Unreleased]
### Added
- Alias-aware screenplay parser with parenthetical handling, local-storage state persistence, progress-log controls, and accessibility tweaks.
- Environment-driven output formats and concatenation URL support, plus ESLint/Vitest tooling and parser unit tests.
- Backend security knobs (configurable port/origin) and docs for advanced usage, API key handling, and contributor onboarding.

### Changed
- Output format now propagates to ElevenLabs requests, downloads, and bash scripts; bash scripts escape payloads safely.
- Concatenation server emits streams with randomized temp files and improved error handling.
- README/CONCATENATION_SETUP/AGENTS now reference the correct dev ports and explain environment setup.

### Fixed
- Inline dialogue with parentheticals parses correctly; misaligned port references and missing env guidance in docs.
