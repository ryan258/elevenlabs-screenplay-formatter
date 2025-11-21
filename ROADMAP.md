# Roadmap — ElevenLabs Screenplay Formatter

A React-based tool for turning screenplay dialogue into ElevenLabs audio, with optional backend concatenation via ffmpeg. This roadmap focuses on:

- Hardening the core flow (parse → map voices → generate → download)
- Making it friendlier for non-technical users
- Improving reliability and test coverage
- Adding “power user” features for production-ish workflows

---

## Milestones Overview

- **MVP Polishing (v0.1.x)** — Make the current feature set robust and predictable.
- **Parsing & UX Enhancements (v0.2.x)** — Better screenplay handling and friendlier UI.
- **Workflow & Automation (v0.3.x)** — Project saving, batch runs, CLI, and exports.
- **Power-User Tools (v0.4.x+)** — Advanced editing, DAW-friendly exports, presets, and collaboration.
- **Technical Debt & Known Issues** — Consolidated findings from code audits requiring attention.
- **Backlog / Experiments** — Ideas to revisit after the core is solid.

---

## Technical Debt & Known Issues

_Consolidated from GPT-AUDIT.md and CLAUDE-AUDIT.md (2025-11-20)_
_Context: Personal project for single-user use. Security priorities adjusted accordingly._

**TL;DR for what actually matters:**
- 🔴 **Fix first:** localStorage quota crashes, resume flow bugs, concatenation failures that waste API credits
- 🟡 **Fix when annoying:** Voice speed slider doesn't work, CLI ignores settings, Reaper export broken
- 🟢 **Fix when bored:** Code organization, performance optimizations, better error messages

---

### 🔴 Critical Priority (Actually Breaks Your Workflow)

- [x] **Blob storage in localStorage exhausts browser quota**
  - **Severity:** Critical (causes crashes)
  - **Files:** `store/useAppStore.ts:199-225`, `App.tsx:657-687`, `utils/blobSerialization.ts`
  - **Issue:** Base64-encoded audio blobs stored in localStorage (33% size increase) quickly exceed 5-10MB quota, throwing `DOMException: Quota exceeded`. Breaks persistence and failed resumes for any non-trivial script.
  - **Fix:** Remove binary audio from localStorage. Migrate to IndexedDB for blob storage. Persist only manifest metadata and resume indices. Add quota checking before saves.

- [x] **Resume flow loses clips when concatenation is disabled**
  - **Severity:** Critical (wastes API credits)
  - **File:** `App.tsx:707-735`
  - **Issue:** `GenerationError` catch block only stores `error.completedBlobs` if `concatenate` is true. In ZIP mode, `serializedPendingBlobs` remains empty, so resume only generates tail of script. You lose all previously generated clips.
  - **Fix:** Always preserve `error.completedBlobs` regardless of concatenation setting. Serialize completed blobs for all modes.

- [x] **Concatenation failures discard all generated clips**
  - **Severity:** Critical (wastes API credits)
  - **Files:** `utils/elevenLabsApi.ts:460-476`, `App.tsx:707-727`
  - **Issue:** If FFmpeg server fails, `generateAllAudio` throws and catch clears all generated blobs/manifest. You lose minutes of paid API usage because downstream concatenation failed.
  - **Fix:** Return `generatedBlobs` even when concatenation fails. Surface warning and allow ZIP download. Enable retry of just concatenation step.

- [x] **Memory leaks from unreleased object URLs**
  - **Severity:** High (causes browser slowdown)
  - **Files:** `App.tsx:345-350`, `App.tsx:559-580`
  - **Issue:** `URL.createObjectURL()` creates memory that's only freed on unmount, not when previews are replaced. Memory accumulates with each preview generation, slowing down browser.
  - **Fix:** Revoke object URLs immediately when replaced. Implement cleanup in `handlePreviewLine` before creating new URLs.

---

### 🟡 High Priority (Functional Issues That Impact You)

- [x] **Voice speed slider is non-functional**
  - **Severity:** High (feature doesn't work)
  - **Files:** `components/CharacterConfigPanel.tsx:195-200`, `utils/elevenLabsApi.ts:123-131`, `utils/scriptGenerator.ts:48-53`, `cli/generate.ts:71-88`
  - **Issue:** UI lets you tune `voiceSettings.speed` but all API calls omit this field. Only stability/similarity/style are sent. The slider literally does nothing.
  - **Fix:** Include `speed` in all `voice_settings` payloads. Update CLI and script generator to respect speed setting.

- [x] **Missing React error boundaries**
  - **Severity:** High (causes full app crashes)
  - **File:** `App.tsx`
  - **Issue:** No error boundaries to catch component rendering errors. Any component failure crashes the entire app with no recovery.
  - **Fix:** Implement React error boundary wrapper with fallback UI and reload option.

- [x] **Reaper export declares wrong source type**
  - **Severity:** High (Reaper won't load files)
  - **File:** `utils/reaperExport.ts:36-38`
  - **Issue:** Always outputs `<SOURCE WAV>` regardless of actual file format. MP3 exports flagged as offline in Reaper, making the export useless.
  - **Fix:** Inspect filename/format and emit correct source type (`<SOURCE MP3>` or WAV).

- [x] **CLI ignores output format and voice speed**
  - **Severity:** High (CLI doesn't respect settings)
  - **File:** `cli/generate.ts:71-88`
  - **Issue:** CLI always sends `Accept: audio/mpeg` and never includes `voice_settings.speed`. Produces MP3s at default speed regardless of your config.
  - **Fix:** Reuse UI's format lookup for `Accept` header and extension. Pass through all voice settings including speed.

- [x] **VoiceSuggestionsPanel mutates state during render**
  - **Severity:** Medium (React warnings, possible loops)
  - **File:** `components/VoiceSuggestionsPanel.tsx:28-39`
  - **Issue:** `safeCharacter` useMemo calls `setSelectedCharacter` during render, triggering React warnings and potential infinite loops in StrictMode.
  - **Fix:** Derive `safeCharacter` without side effects using `useEffect` or event handler fallback.

---

### 🟢 Medium Priority (Quality of Life Improvements)

- [x] **App.tsx is too large (880 lines)**
  - **Why it matters:** Hard to navigate and modify. Makes debugging harder.
  - **File:** `App.tsx`
  - **Fix:** Extract custom hooks (`useProjectManager`, `useAudioGeneration`, `useVoicePresets`), split into smaller components when you need to make changes.
  - **Resolution:** Reduced from 895 lines to 723 lines (-19%). Extracted `useAudioGeneration` hook and created utility modules (`downloads.ts`, `stringUtils.ts`, `errorHandling.ts`).

- [x] **Inefficient re-renders in App.tsx**
  - **Why it matters:** UI feels sluggish when generating audio or updating state.
  - **File:** `App.tsx:127-174`
  - **Fix:** Split store selectors into smaller chunks, use React.memo for expensive components when performance becomes noticeable.
  - **Resolution:** Split monolithic selector into 7 focused selectors using `useShallow` for fine-grained subscriptions (App.tsx:59-113).

- [x] **Missing pagination/virtualization for long scripts**
  - **Why it matters:** Browser slows down with 200+ dialogue chunks.
  - **Files:** `components/TimelinePanel.tsx`, `components/CharacterConfigPanel.tsx`
  - **Fix:** Implement virtual scrolling (react-window) or pagination when you actually process scripts this large.
  - **Resolution:** Implemented `react-window` with `FixedSizeList` in both components. CharacterConfigPanel uses 260px items, TimelinePanel uses 110px items.

- [x] **Unoptimized parser (O(n²) complexity)**
  - **Why it matters:** Parsing slows down noticeably on 1000+ line scripts.
  - **File:** `utils/parser.ts:171-214`
  - **Fix:** Build character lookup Map upfront instead of linear search per line. Only fix if you notice slowness.
  - **Resolution:** Replaced linear character search with Map-based lookups (`aliasMap` and `fullNameMap`) for O(1) character resolution. Parser now runs in O(n) time.

- [x] **Inconsistent error handling patterns**
  - **Why it matters:** Makes debugging harder when something goes wrong.
  - **Files:** Throughout codebase
  - **Fix:** Standardize on try-catch with user notifications when you touch error handling code anyway.
  - **Progress:** Created `utils/errorHandling.ts` with `logError` and `notifyError` utilities. Still needs to be applied throughout codebase.

---

### ⚪ Low Priority (If You Ever Get Bored)

- [ ] **Add tests for critical paths**
  - **Why it matters:** Helps prevent regressions when you make changes months from now.
  - **Where to start:** Parser tests, API client tests, resume flow tests.
  - **Fix:** Add basic unit tests when you break something and want to prevent it happening again.

- [ ] **Better error recovery**
  - **Why it matters:** Less annoying when something fails.
  - **Fix:** Add automatic retry for transient failures, better localStorage corruption handling.

- [ ] **Script length validation**
  - **Why it matters:** Prevents accidentally processing massive scripts that hit API limits.
  - **Fix:** Add character/word count display, warn before processing 50K+ word scripts.

- [ ] **Create server package.json**
  - **Why it matters:** Makes it clearer what server dependencies are needed.
  - **Fix:** Create `server/package.json` with express, cors, multer, fluent-ffmpeg listed.

---

## v0.1.x — MVP Polishing & Stability

**Goal:** Take the current “it works” prototype and make it stable, predictable, and understandable for someone running `npm run dev` for the first time. :contentReference[oaicite:1]{index=1}

### 0.1.0 — Baseline Hardening

- [x] **Error surfaces for ElevenLabs calls**
  - [x] Show inline errors when an API request fails (rate limits, invalid key, network).
  - [x] Add retry logic with sane caps (e.g., 2–3 retries with backoff).
  - [x] Show which chunk/character failed and allow resuming from that point.

- [x] **Progress and status UX polish**
  - [x] Replace any “console-only” feedback with visible UI messages.
  - [x] Add a simple progress bar (% of lines processed).
  - [x] Show current character + line snippet being processed.

- [x] **API key handling improvements**
  - [x] Clear copy explaining that keys stay in the browser and aren’t stored remotely.
  - [x] Optional localStorage toggle: “Remember my API key on this device”.
  - [x] Provide quick link/instructions to get an ElevenLabs key.

- [x] **Concatenation setup clarity**
  - [x] Integrate `CONCATENATION_SETUP.md` content into the main README or link clearly.
  - [x] Add a “Concatenation status” indicator in the UI (e.g. “Backend reachable at http://localhost:3001”).
  - [x] Add a health-check button that pings `/health` and reports status.

### 0.1.1 — Basic Quality & Structure

- [x] **TypeScript hygiene**
  - [x] Turn on stricter TS flags where reasonable.
  - [x] Eliminate `any` where easy wins exist, especially in parser/API code.
  - [x] Centralize shared types in `types.ts` and use throughout. :contentReference[oaicite:2]{index=2}

- [x] **Project structure + scripts**
  - [x] Confirm `npm run dev`, `npm run build`, and `npm run preview` are documented and working.
  - [x] Add `npm run lint` and `npm run test` placeholders even if tests are minimal.
  - [x] Document how to run the backend server and frontend together (two terminal snippet in README).

---

## v0.2.x — Parsing & UX Enhancements

**Goal:** Handle more real-world scripts and make the app feel like a focused “screenplay tool” rather than a generic text box.

### 0.2.0 — Screenplay Parsing Improvements

- [x] **Robust character and dialogue detection**
  - [x] Add support for common screenplay patterns: `V.O.`, `O.S.`, `CONT'D`.
  - [x] Ignore scene headings and transitions (`INT.`, `EXT.`, `CUT TO:`, etc.) when extracting dialogue.
  - [x] Handle parentheticals gracefully and ensure they are either removed or spoken based on a setting.

- [x] **Format flexibility**
  - [x] Support simple Fountain-style text (at least headings + character + dialogue).
  - [x] Provide one or two additional example screenplay files (short, realistic samples).

- [ ] **Parser diagnostics mode**
  - [ ] Optional “show parsed view” mode that lists detected characters and their lines.
  - [ ] Highlight lines that failed to parse so the user can tweak the script.

### 0.2.1 — UI/UX Refinements

- [x] **Script editing experience**
  - [x] Improve the script input area: monospaced font, higher default height.
  - [x] Add a full-screen editor modal (if not already fully wired) with keyboard shortcuts (e.g. `Ctrl+Enter` to save).
  - [x] Clearly label expected format (inline hints from README’s “Screenplay Format” section). :contentReference[oaicite:3]{index=3}

- [x] **Character configuration ergonomics**
  - [x] Allow searching/filtering within character list for long scripts.
  - [x] Add “Apply these settings to all characters” option (voice, stability, style) as a quick-start.
  - [x] Indicator if a character has no voice assigned yet.

- [x] **Accessibility**
  - [x] Ensure all interactive controls are reachable via keyboard.
  - [x] Add ARIA labels to sliders and buttons.
  - [x] Check color contrast and adjust for readability.

---

## v0.3.x — Workflow, Automation & Persistence

**Goal:** Turn this from a “one-off generator” into a repeatable tool that remembers projects and fits into a wider workflow.

### 0.3.0 — Projects & Presets

- [x] **Project save/load**
  - [x] Implement a JSON-based “project config” (script text, character mappings, voice settings, model, output format, concatenate toggle).
  - [x] Add “Download Project” and “Load Project” buttons (simple file download/upload).
  - [x] Optionally auto-save the last project to localStorage.

- [x] **Voice presets**
  - [x] Allow saving named voice presets (e.g. “Narrator”, “Hero”, “Comedic Sidekick”) with ElevenLabs settings.
  - [x] Quickly assign presets to characters via dropdown.

- [x] **Default templates**
  - [x] Provide one or two starter project configs with sample scripts and voice mappings.
  - [x] A “Load demo project” button to show the workflow end-to-end.

### 0.3.1 — CLI & Automation

- [x] **Node/CLI wrapper**
  - [x] Create a simple CLI script (inside `server/` or `utils/`) that:
    - [x] Takes a text/markdown screenplay file.
    - [x] Takes a JSON config of character voices.
    - [x] Generates audio files (and optionally concatenates) using the same logic as the UI.
  - [x] Document usage in a separate `CLI.md`.

- [ ] **Batch processing**
  - [ ] Allow sequential processing of multiple screenplay files (chapters/episodes).
  - [ ] Provide basic rate-limiting and “cooldown” between runs to stay friendly with the ElevenLabs API.

---

## v0.4.x+ — Power User & Production Features

**Goal:** Support more advanced workflows: editing, versioning, DAW integration, and lightweight collaboration.

### 0.4.0 — Advanced Editing & Monitoring

- [x] **Per-line preview**
  - [x] Add a “Preview line” button next to each dialogue block to generate and audition just that line.
  - [x] Optionally keep previews cached so they don’t re-hit the API unless settings change.

- [x] **Timeline-ish view**
  - [x] Represent the script as an ordered list of blocks (character + line length + estimated duration).
  - [x] Show estimated total runtime of the generated audio.

- [x] **Generation profiles**
  - [x] Allow saving “render profiles” (e.g. “Fast draft”, “High quality”, “Concatenated episode”).
  - [x] Profiles pre-configure model, bitrate, concat, etc.

### 0.4.1 — DAW-Friendly Exports & Integrations

- [x] **Export manifests**
  - [x] Generate a JSON or CSV manifest mapping each file to:
    - [x] Character
    - [x] Line index
    - [x] Original text
  - [x] Optionally include estimated timestamps and durations.

- [x] **Zip packaging**
  - [x] After generation, bundle all audio files + manifest into a `.zip` for easy import into DAWs.

- [x] **Script versioning hints**
  - [x] Provide a lightweight “version label” field on the project (e.g. `script_v3`).
  - [x] Include that label in filenames and manifests.

---

## V2 Feature Integration Candidates

This section documents major features from the experimental `v2` branch that can be integrated into `main`.

- [x] **Word-Level Timestamps & Subtitle Generation**
  - [x] Integrate with ElevenLabs alignment API to get word-level timestamps.
  - [x] Store `startTime` and `endTime` on each dialogue chunk.
  - [x] Add export options to generate and download subtitle files (SRT and VTT).

- [x] **Advanced Audio Production**
  - [x] Add a UI for defining and placing Sound Effects (SFX) in the script.
  - [x] Allow specifying a background music track (URL or upload).
  - [x] Update the backend concatenation service to mix dialogue, SFX, and background music using FFmpeg filters.

- [x] **Enhanced Robustness & UX**
  - [x] Implement a user-friendly error system that translates technical API errors (rate limits, invalid keys) into actionable advice.
  - [x] Persist the full generation state to `localStorage` to allow for cross-session resumption after a browser crash or refresh.
  - [x] Implement dynamic rate-limiting by inspecting API response headers (`x-rate-limit-remaining`) to adjust request delays automatically.
  - [x] Add a non-blocking toast notification system for feedback (e.g., "Project Saved").

- [x] **Project Sharing**
  - [x] Add a "Share Project" feature that serializes the entire project config into a shareable URL.
  - [x] Allow loading a project directly from this URL.

- [x] **State Management & Tooling**
  - [x] Refactor state management to use a dedicated library like Zustand for improved scalability.
  - [x] Consolidate build and test configurations.

---

## Documentation & Developer Experience

**Goal:** Make it easy for future-you (or collaborators) to understand and extend the project.

- [x] **Developer setup guide**
  - [x] Expand README with a dedicated “Developer Setup” section:
    - [x] Node version, package manager notes.
    - [x] Frontend + backend start commands.
    - [x] Where to configure CORS/backends if needed.

- [x] **Architecture overview**
  - [x] Add a short `ARCHITECTURE.md` describing:
    - [x] React components layout (panels, modals, sliders). :contentReference[oaicite:4]{index=4}
    - [x] Hook(s) for parsing and state management.
    - [x] Backend responsibilities and endpoints.
    - [x] Data flow: “screenplay → parsed blocks → ElevenLabs API → files → optional concat”.

- [ ] **Testing**
  - [ ] Unit tests for the screenplay parser (various real-world edge cases).
  - [ ] Unit tests for the ElevenLabs API wrapper with mocked responses.
  - [ ] A couple of end-to-end tests (Playwright/Cypress) that:
    - [ ] Load a test script.
    - [ ] Assign dummy voices.
    - [ ] Mock API responses and confirm correct UI flow.

- [ ] **Maintenance scripts**
  - [ ] Add `lint`, `format`, and `test` scripts to `package.json`.
  - [ ] Optionally add a GitHub Actions workflow that runs lint + tests on push/PR.

---


## Backlog / Nice-to-Have Ideas

Things that might be worth exploring after the core is solid:

- [x] **Multi-language support UI**
  - [x] Simple language selector tied to the ElevenLabs multilingual model.
  - [x] Preset voices per language.

- [x] **Role-based voice suggestions**
  - [x] Provide recommended voices or settings based on tags like “Narrator”, “Villain”, “Child”, etc.

- [ ] **Integrations**
  - [ ] Export formats tailored for Reaper track templates.
