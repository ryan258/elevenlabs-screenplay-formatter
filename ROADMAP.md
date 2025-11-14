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
- **Backlog / Experiments** — Ideas to revisit after the core is solid.

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

- [x] **Parser diagnostics mode**
  - [x] Optional “show parsed view” mode that lists detected characters and their lines.
  - [x] Highlight lines that failed to parse so the user can tweak the script.

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

- [x] **Batch processing**
  - [x] Allow sequential processing of multiple screenplay files (chapters/episodes).
  - [x] Provide basic rate-limiting and “cooldown” between runs to stay friendly with the ElevenLabs API.

---

## v0.4.x+ — Power User & Production Features

**Goal:** Support more advanced workflows: editing, versioning, DAW integration, and lightweight collaboration.

### 0.4.0 — Advanced Editing & Monitoring

- [ ] **Per-line preview**
  - [ ] Add a “Preview line” button next to each dialogue block to generate and audition just that line.
  - [ ] Optionally keep previews cached so they don’t re-hit the API unless settings change.

- [ ] **Timeline-ish view**
  - [ ] Represent the script as an ordered list of blocks (character + line length + estimated duration).
  - [ ] Show estimated total runtime of the generated audio.

- [ ] **Generation profiles**
  - [ ] Allow saving “render profiles” (e.g. “Fast draft”, “High quality”, “Concatenated episode”).
  - [ ] Profiles pre-configure model, bitrate, concat, etc.

### 0.4.1 — DAW-Friendly Exports & Integrations

- [ ] **Export manifests**
  - [ ] Generate a JSON or CSV manifest mapping each file to:
    - [ ] Character
    - [ ] Line index
    - [ ] Original text
  - [ ] Optionally include estimated timestamps and durations.

- [ ] **Zip packaging**
  - [ ] After generation, bundle all audio files + manifest into a `.zip` for easy import into DAWs.

- [ ] **Script versioning hints**
  - [ ] Provide a lightweight “version label” field on the project (e.g. `script_v3`).
  - [ ] Include that label in filenames and manifests.

---

## Documentation & Developer Experience

**Goal:** Make it easy for future-you (or collaborators) to understand and extend the project.

- [ ] **Developer setup guide**
  - [ ] Expand README with a dedicated “Developer Setup” section:
    - [ ] Node version, package manager notes.
    - [ ] Frontend + backend start commands.
    - [ ] Where to configure CORS/backends if needed.

- [ ] **Architecture overview**
  - [ ] Add a short `ARCHITECTURE.md` describing:
    - [ ] React components layout (panels, modals, sliders). :contentReference[oaicite:4]{index=4}  
    - [ ] Hook(s) for parsing and state management.
    - [ ] Backend responsibilities and endpoints.
    - [ ] Data flow: “screenplay → parsed blocks → ElevenLabs API → files → optional concat”.

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

- [ ] **Multi-language support UI**
  - [ ] Simple language selector tied to the ElevenLabs multilingual model.
  - [ ] Preset voices per language.

- [ ] **Role-based voice suggestions**
  - [ ] Provide recommended voices or settings based on tags like “Narrator”, “Villain”, “Child”, etc.

- [ ] **Cloud-ish storage (opt-in)**
  - [ ] If ever moved behind an authenticated backend, support user accounts and server-side project storage.

- [ ] **Integrations**
  - [ ] Export formats tailored for specific tools (e.g., Reaper track templates, Adobe Audition session helpers).
