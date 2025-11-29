# Repository Guidelines — ElevenLabs Screenplay Formatter v0.4.0

## Current State (November 2025)
Version 0.4.0 represents a feature-complete production-ready application with comprehensive screenplay parsing, ElevenLabs integration, audio production mixing, timeline management, export capabilities, and project persistence. All critical stability issues have been resolved (IndexedDB migration, memory leaks, error boundaries, resume flow). See [CHANGELOG.md](./CHANGELOG.md) for complete release notes and [ROADMAP.md](./ROADMAP.md) for future enhancements.

**Recent additions:**
- Auto-fill Voice IDs from character lists (`utils/voiceExtraction.ts`)
- Context-aware audio generation (sends previous/next dialogue to ElevenLabs API)
- Stage direction preservation with `[brackets]` for Turbo v2.5+ models
- Virtual scrolling for large scripts (react-window in Timeline and CharacterConfig panels)
- Optimized O(n) parser with Map-based character lookups
- Comprehensive error handling with user-friendly translations
- React error boundaries for component crash recovery

## Project Structure & Module Organization
The Vite/React frontend lives at the repo root: `App.tsx` wires the panels in `components/`, parsing logic sits in `hooks/useScriptParser.ts`, shared types in `types.ts`, and ElevenLabs helpers in `utils/`. Global state (script text, presets, resume data, audio-production metadata) is centralized via `store/useAppStore.ts` (Zustand + persisted localStorage/IndexedDB), with blob serialization helpers under `utils/blobSerialization.ts`. Utility modules include `utils/downloads.ts`, `utils/stringUtils.ts`, `utils/errorHandling.ts`, and `utils/voiceExtraction.ts` for auto-fill functionality. Static shell files (`index.html`, `index.tsx`, `index.css`) sit alongside `tsconfig.json` and `vite.config.ts`. The concatenation backend is isolated in `server/` (Express + FFmpeg mixing), while sample scripts for quick smoke tests live in `plays/`, `EXAMPLE_SCREENPLAY.md`, and `EXAMPLE_FOUNTAIN.md`.

Key UI panels include:
- `ApiKeyPanel` for ElevenLabs API key input with "remember key" toggle
- `ScriptInput` with fullscreen editor modal and `Ctrl+Enter` save shortcut
- `CharacterConfigPanel` with search/filter, voice presets, and **Auto-fill Voice IDs** button for extracting IDs from character lists
- `VoiceSuggestionsPanel` for role-based recommendations tied to the selected language
- `AudioProductionPanel` for background-music/SFX uploads and timing controls
- `ProjectSettingsPanel` merging ElevenLabs' latest models (Multilingual, Turbo, Flash, etc.) with fallbacks
- `TimelinePanel` with virtual scrolling and per-line preview buttons
- `GenerationProfilesPanel` for one-click profile application (Fast Draft, High Quality, etc.)
- `ExportPanel` for JSON/CSV/ZIP/SRT/VTT/Reaper template downloads
- `ProjectManagerPanel` handling save/load, shareable links, and demo loading
- `ToastContainer` for global success/error/info notifications
- `ParserDiagnosticsPanel` showing detected characters and unparsed lines

## Build, Test, and Development Commands
- `npm install` – install frontend dependencies after cloning.
- `npm run dev` – start Vite at `http://localhost:3000` with fast refresh.
- `npm run build` – emit the production bundle in `dist/`; fails on TS or Vite errors.
- `npm run preview` – serve the built assets for a production-accurate check.
- `npm run lint` / `npm run check` / `npm test` – run ESLint, TypeScript, and Vitest suites locally before pushing.
- `cd server && npm install && npm start` – boot the concatenation service on `:3001` when the “Concatenate Audio” toggle is enabled.

## Coding Style & Naming Conventions
The project uses React hooks with TypeScript options defined in `tsconfig.json`. Follow the existing 2-space indentation, single quotes, and trailing commas, and run `npm run build` before commits because no formatter script is bundled. Name components and hooks with `PascalCase`/`useCamelCase`, keep shared interfaces in `types.ts`, prefer descriptive state keys (`scriptText`, `progressMessages`), and use the `@/*` alias for cross-folder imports.

## Testing Guidelines
Use `npm run test` for parser unit tests (including `voiceExtraction.test.ts`) and `npm run lint` / `npm run check` before commits. For manual QA:
- Load `EXAMPLE_SCREENPLAY.md`, `EXAMPLE_FOUNTAIN.md`, or files in `plays/` to confirm parsing, diagnostics, and per-character settings.
- Test the **Auto-fill Voice IDs** feature by creating a character list with Voice IDs in format `- CHARACTER (Voice ID: abc123...)` and clicking the Auto-fill button in CharacterConfigPanel. Verify voice IDs populate correctly and character name normalization matches (uppercase).
- Test **Stage Direction Preservation**: Create a script with bracketed stage directions like `[whispering]` or `[shouting]`, enable the "Preserve Stage Directions [Brackets]" toggle in Project Settings, and verify the brackets are preserved in the generated dialogue chunks (check both the parser output and the text sent to the API). Test with the toggle disabled to confirm brackets are removed.
- Test **Context-Aware Generation**: Generate audio for a multi-line conversation and verify that `previousText` and `nextText` are correctly extracted and passed to the ElevenLabs API (check network requests or add logging). Confirm edge cases work (first chunk has no previous, last chunk has no next).
- Exercise both output modes: run just `npm run dev` for individual MP3 downloads, then repeat with the backend running to ensure `/concatenate` succeeds, audio production assets mix correctly, and a single file lands in `Downloads`.
- Verify subtitle exports (`srt`, `vtt`) line up with timeline previews when editing the alignment or manifest code, and spot-check non-English runs (e.g., Spanish) to ensure the language selector + curated suggestions behave.
- Test project persistence: generate audio, refresh the browser, and confirm the app resumes from the correct state with all metadata and generated audio intact (IndexedDB for blobs, localStorage for config).
- When adjusting Project Settings, confirm the model dropdown lists Multilingual/Turbo/Flash/Monolingual entries even without a fresh API fetch (thanks to bundled defaults). If you change the set, run a smoke test on at least one Turbo/Flash model.
- When touching the ElevenLabs API integration, confirm custom voices load (after entering a real API key) and can be applied from the suggestions panel without regression.
- When editing manifest/export code, download the Reaper template, unzip the audio ZIP, and open the `.rpp` in Reaper to ensure each character's clips land on the right track with the correct timing.
- When editing `utils/elevenLabsApi.ts`, monitor retry/resume behavior, adaptive rate-limiting, toasted status messages, and ensure the Output/Diagnostics panels still stream updates.
- Verify virtual scrolling performance in TimelinePanel and CharacterConfigPanel with scripts containing 200+ dialogue chunks.

## Commit & Pull Request Guidelines
Commits in `git log` follow short, imperative descriptions (“add concat server”, “update fixit prompt”); keep that tone and squash local fixups. Pull requests should include a concise summary, reproduction or validation steps (commands plus screenshots/GIFs for UI-facing work), and links to any ElevenLabs tickets or GitHub issues. Flag whether backend edits require FFmpeg updates and highlight new env vars (`ELEVENLABS_API_KEY`, ports, temp paths).

## Security & Configuration Tips
Never commit API keys; load `ELEVENLABS_API_KEY` via `.env` or shell exports so `App.tsx` picks up `process.env`. If sharing bundles, inspect `dist/` for secrets. Backend FFmpeg writes temporary files to `/tmp`, so clean them periodically when testing long screenplays.
