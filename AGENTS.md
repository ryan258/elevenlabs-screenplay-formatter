# Repository Guidelines

## Project Structure & Module Organization
The Vite/React frontend lives at the repo root: `App.tsx` wires the panels in `components/`, parsing logic sits in `hooks/useScriptParser.ts`, shared types in `types.ts`, and ElevenLabs helpers in `utils/`. Global state (script text, presets, resume data, audio-production metadata) is centralized via `store/useAppStore.ts` (Zustand + persisted localStorage), with blob serialization helpers under `utils/blobSerialization.ts`. Static shell files (`index.html`, `index.tsx`, `index.css`) sit alongside `tsconfig.json` and `vite.config.ts`. The concatenation backend is isolated in `server/` (Express + FFmpeg mixing), while sample scripts for quick smoke tests live in `plays/` and `EXAMPLE_SCREENPLAY.md`.

Key UI panels include:
- `AudioProductionPanel` for background-music/SFX uploads and timing controls
- `VoiceSuggestionsPanel` for role-based recommendations tied to the selected language
- `ExportPanel` for JSON/CSV/ZIP/SRT/VTT downloads
- `ProjectManagerPanel` handling shareable links + demo loading
- `ToastContainer` for global success/error/info notifications

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
Use `npm run test` for parser unit tests and `npm run lint` / `npm run check` before commits. For manual QA:
- Load `EXAMPLE_SCREENPLAY.md`, `EXAMPLE_FOUNTAIN.md`, or files in `plays/` to confirm parsing, diagnostics, and per-character settings.
- Exercise both output modes: run just `npm run dev` for individual MP3 downloads, then repeat with the backend running to ensure `/concatenate` succeeds, audio production assets mix correctly, and a single file lands in `Downloads`.
- Verify subtitle exports (`srt`, `vtt`) line up with timeline previews when editing the alignment or manifest code, and spot-check non-English runs (e.g., Spanish) to ensure the language selector + voice suggestions behave.
- When editing `utils/elevenLabsApi.ts`, monitor retry/resume behavior, adaptive rate-limiting, toasted status messages, and ensure the Output/Diagnostics panels still stream updates.

## Commit & Pull Request Guidelines
Commits in `git log` follow short, imperative descriptions (“add concat server”, “update fixit prompt”); keep that tone and squash local fixups. Pull requests should include a concise summary, reproduction or validation steps (commands plus screenshots/GIFs for UI-facing work), and links to any ElevenLabs tickets or GitHub issues. Flag whether backend edits require FFmpeg updates and highlight new env vars (`ELEVENLABS_API_KEY`, ports, temp paths).

## Security & Configuration Tips
Never commit API keys; load `ELEVENLABS_API_KEY` via `.env` or shell exports so `App.tsx` picks up `process.env`. If sharing bundles, inspect `dist/` for secrets. Backend FFmpeg writes temporary files to `/tmp`, so clean them periodically when testing long screenplays.
