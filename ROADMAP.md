# ELEVENLABS Screenplay Formatter — Roadmap

This roadmap organizes the code review suggestions into actionable, bite‑sized tasks that can be executed with Codex CLI.

Each task is written so it can map cleanly to a branch, PR, or single Codex CLI session.

---

## ✅ Phase 1 — Correctness & Doc Alignment

### 1.1 Align parser behavior with documented character aliases
- **Goal:** Ensure character matching behavior matches what’s promised in `EXAMPLE_SCREENPLAY.md` (e.g., `DETECTIVE SARAH MILLER` also matches `DETECTIVE MILLER` and `SARAH`).
- **Tasks:**
  - Implement an alias system for characters in `useScriptParser`:
    - Tokenize character names (e.g., `DETECTIVE SARAH MILLER` → `["DETECTIVE", "SARAH", "MILLER"]`).
    - Generate aliases like `DETECTIVE MILLER`, `SARAH MILLER`, `SARAH`.
    - Update `findCharacter` to match on full name, first token, or any alias.
  - Add tests or sample scripts to cover:
    - Matching by full name.
    - Matching by first name only.
    - Matching by first + last (e.g., `DETECTIVE MILLER`).
- **Alternative (if we don’t want aliases):**
  - Update `EXAMPLE_SCREENPLAY.md` and README to clearly state only full name and first token are supported.

### 1.2 Fix inline dialogue with parentheticals
- **Goal:** Support lines like `JOHN (V.O.): It’s starting.` when matching characters.
- **Tasks:**
  - Strip parentheticals (e.g., `(V.O.)`, `(O.S.)`) from the name before calling `findCharacter`.
  - Add at least one test/example screenplay snippet using `JOHN (V.O.):` and verify it’s parsed correctly.

### 1.3 Wire `outputFormat` into live ElevenLabs API calls
- **Goal:** Make the Output Format dropdown actually control the format used when generating audio from the browser.
- **Tasks:**
  - Update `generateAudioFile` in `utils/elevenLabsApi.ts` to include `output_format: outputFormat` in the POST body.
  - Verify that the `outputFormat` string values match ElevenLabs’ documented options.
  - Adjust the `Accept` header if necessary, or document any limitations.
  - Manually test a few runs for different formats.

---

## ✅ Phase 2 — Bash Script & Tooling Hardening

### 2.1 Robust escaping in `generateBashScript`
- **Goal:** Ensure generated `curl` commands work even when dialogue contains quotes (`I'm`, `it’s`, etc.).
- **Tasks:**
  - Escape single quotes if using single‑quoted `-d '...'` payloads:
    - e.g., `JSON.stringify(payload).replace(/'/g, '\'"'"'')` or equivalent.
  - Alternatively switch to double‑quoted payloads and escape `"`, `$`, `\`, `` ` ``.
  - Consider a short comment in the code explaining the escaping strategy.
  - Test script generation using dialogue with:
    - Single quotes.
    - Double quotes.
    - Backticks or dollar signs.

### 2.2 Optional: safer payload strategy
- **Goal:** Make the bash script more resilient for long/complex payloads.
- **Tasks (optional enhancement):**
  - Generate a script that writes JSON payloads to temp files and uses `curl -d @payload.json`.
  - Document this alternate script format in README as “advanced / more robust mode.”

---

## ✅ Phase 3 — Concatenation Backend & Configuration

### 3.1 Configurable concatenation server URL
- **Goal:** Avoid hard‑coding `http://localhost:3001/concatenate` in the client.
- **Tasks:**
  - Add support in `utils/elevenLabsApi.ts` to read `VITE_CONCAT_SERVER_URL` from environment.
  - Default to `http://localhost:3001/concatenate` if env var is missing.
  - Update README and `.env.example` with `VITE_CONCAT_SERVER_URL` usage.

### 3.2 Improve concatenation server robustness
- **Goal:** Make the Node/Express backend more reliable and ready for light deployment.
- **Tasks:**
  - Wrap top‑level `await fs.mkdir('uploads', { recursive: true })` in a small `async` initialization function with error logging.
  - Add a randomized suffix to generated filenames (`filelist_*.txt`, `output_*.mp3`) to reduce collision risk.
  - (Optional) Stream `outputPath` to the response using `fs.createReadStream` instead of `readFile` for better memory usage with large files.
  - Add basic error logs for ffmpeg failures, including stderr output if available.

### 3.3 CORS & security hygiene (lightweight)
- **Goal:** Make the backend safer if deployed beyond localhost.
- **Tasks:**
  - Restrict CORS to a configurable origin via environment variable (e.g., `ALLOWED_ORIGIN`).
  - Document that the default remains open for local development, but can be locked down in production.

---

## ✅ Phase 4 — App UX & State Quality of Life

### 4.1 Local storage persistence for user settings
- **Goal:** Preserve key settings across refreshes to avoid re‑entering everything.
- **Tasks:**
  - Define a small `AppStateSnapshot` type including:
    - `apiKey` (optional, if comfortable persisting locally).
    - `projectSettings`.
    - `characterConfigs`.
    - (Optionally) `scriptText`.
  - On app load, read `localStorage` (e.g., `elevenlabs_formatter_state`) and hydrate initial state.
  - On relevant state changes, write back a serialized snapshot.
  - Document that this data is stored only in the user’s browser and never on a server.

### 4.2 Progress messages management
- **Goal:** Keep progress logs usable for long scripts.
- **Tasks:**
  - Limit `progressMessages` to the last N entries (e.g., 200) when appending.
  - Consider a “Copy log” button in `OutputDisplay` to copy messages to clipboard.

### 4.3 Accessibility polish
- **Goal:** Improve keyboard and screen‑reader usability.
- **Tasks:**
  - Add `aria-label`s for buttons that use only icons or ambiguous text.
  - Ensure primary actions are reachable via keyboard and have visible focus states.
  - Check `textarea` and controls in `ScriptInput`, `CharacterConfigPanel`, and `ProjectSettingsPanel` for proper labeling.

---

## ✅ Phase 5 — TypeScript, Linting, and Tests

### 5.1 Tighten TypeScript compiler options
- **Goal:** Catch more issues at compile time.
- **Tasks:**
  - Enable `strict: true` in `tsconfig.json` (or at least `noImplicitAny` and `strictNullChecks`).
  - Fix resulting type errors, especially around event handlers and optional fields.

### 5.2 Add linting & formatting scripts
- **Goal:** Standardize code style and catch common mistakes automatically.
- **Tasks:**
  - Add ESLint with TypeScript support (`@typescript-eslint/parser` + plugin).
  - Add a basic `.eslintrc` consistent with the current code style.
  - Add npm scripts:
    - `"lint": "eslint src --ext .ts,.tsx"`
    - `"check": "tsc --noEmit"`
  - Optionally add Prettier and a `format` script.

### 5.3 Parser unit tests (or snapshot tests)
- **Goal:** Lock in behavior for script parsing to avoid regressions.
- **Tasks:**
  - Extract pure parsing logic from `useScriptParser` into a testable function (if needed) or test it via a small wrapper.
  - Add test cases for:
    - Method 1 (character list + multiline dialogue blocks).
    - Method 2 (pure inline `CHARACTER: dialogue`).
    - Method 3 (characters without pre‑declared list).
    - Lines with parentheticals in character names.
    - The advanced alias examples from `EXAMPLE_SCREENPLAY.md`.

---

## ✅ Phase 6 — Documentation & Cleanup

### 6.1 Port consistency and dev instructions
- **Goal:** Avoid confusion around dev server ports.
- **Tasks:**
  - Ensure all references to dev URLs in `README.md` match the actual Vite port from `vite.config.ts` (currently 3000).
  - Clarify how to run the frontend and backend together (commands + example URLs).

### 6.2 Clarify API key handling language
- **Goal:** Be precise about how the ElevenLabs API key is used.
- **Tasks:**
  - Update documentation to explicitly state:
    - The API key is stored only in the browser (and optional `localStorage` if enabled).
    - It is sent only to ElevenLabs and not to any custom backend endpoints.

### 6.3 Advanced usage & limitations section
- **Goal:** Set expectations and guide power users.
- **Tasks:**
  - Add a short “Advanced Usage & Limitations” section to README covering:
    - Rate limiting and the built‑in delay between requests.
    - Tradeoffs of browser‑based generation vs. bash script.
    - Any remaining edge cases in parsing that are intentionally out of scope.

---

## Suggested Execution Order for Codex CLI

If you’re knocking this out with Codex CLI, a practical order might be:

1. **Phase 1** — Parser alias alignment + output format wiring. ✅
2. **Phase 2** — Bash script escaping fixes. ✅
3. **Phase 3** — Server URL configurability + robustness. ✅
4. **Phase 4** — UX persistence and progress log polish. ✅
5. **Phase 5** — TS strictness, linting, and parser tests. ✅
6. **Phase 6** — Documentation updates and advanced notes. ✅

Each numbered subsection above can be treated as a separate Codex CLI “task card” (branch/PR) to keep changes scoped and reviewable.
