# Architecture Overview

## Frontend (Vite + React)
- `App.tsx` orchestrates state: screenplay text, API key, character configs, generation settings, progress, and exports.
- Panels in `components/` are grouped by function:
  - Input/editing: `ScriptInput`, `Modal` (fullscreen editor).
  - Configuration: `ApiKeyPanel`, `ProjectSettingsPanel`, `GenerationProfilesPanel`, `ProjectManagerPanel`, `VoicePresetsPanel`, `CharacterConfigPanel`.
  - Output/status: `OutputDisplay`, `ParserDiagnosticsPanel`, `TimelinePanel`, `ExportPanel`, `ConcatenationStatus`.
- Voice presets and project configs live in localStorage (hydrated via `AppStateSnapshot`).

## Parsing & State
- `utils/parser.ts` performs parsing: alias generation, Fountain support, parenthetical stripping, unmatched-line diagnostics.
- `hooks/useScriptParser.ts` wraps the parser with `useMemo` so the UI re-renders only when script text changes.
- Dialogue chunks carry both `text` (cleaned) and `originalText` so toggles like “Speak Parentheticals” can decide which version to send.

## Generation Flow
1. `validateConfiguration` ensures every detected character has a voice ID and the API key is present.
2. `generateAllAudio` iterates through chunks, calling `generateAudioFile`, applying profile-driven delay, and returning a list of `{ blob, filename }` records.
3. If concatenation is enabled, blobs are uploaded to the backend (`server/index.js`); otherwise they download immediately.
4. Manifest data is derived from the chunks + filenames for JSON/CSV/ZIP exports.
5. Timeline previews reuse `generateAudioFile` for one-off requests and cache the resulting blobs locally.

## Backend (optional)
- `server/index.js` is a minimal Express service:
  - `/health` responds with a simple JSON payload for the UI status card.
  - `/concatenate` accepts multipart audio uploads, writes a temporary list, runs ffmpeg concat demuxer, streams the merged file, and cleans up temporary files.
- CORS and port can be configured via `server/.env` (`PORT`, `ALLOWED_ORIGIN`).

## CLI Automation
- `cli/generate.ts` reuses the parser and ElevenLabs API to batch-generate audio from project configs.
- It supports multiple `--script` inputs, configurable delay, and local concatenation through ffmpeg.
