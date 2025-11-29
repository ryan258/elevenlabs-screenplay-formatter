# Happy Path Guide — ElevenLabs Screenplay Formatter

This walkthrough shows the fastest way to convert a screenplay into audio, validate the mix, and grab subtitles/export bundles. Assume you’ve cloned the repo, run `npm install`, and have an ElevenLabs API key handy.

## 1. Start Frontend & Backend

```bash
# Terminal A – frontend
npm run dev

# Terminal B – backend for concatenation/mixing
cd server
npm start
```

Verify the backend prints:

```
🎵 Audio concatenation server running on http://localhost:3001
📋 Health check: http://localhost:3001/health
```

## 2. Load the App

Open `http://localhost:3000` in your browser.

1. Enter your ElevenLabs API key in the **Step 1: ElevenLabs API Key** panel. Leave “Remember this key on this device” checked if you want the persisted load/resume behavior.
2. Paste a screenplay into **Screenplay Input** or click **Expand** to use the fullscreen editor. If you need a starter script, tap “Load Demo Project” inside the Project Manager card.

As soon as you type/paste, characters will appear in the **Character Voices** panel.

## 3. Configure Project Settings

In **Step 2: Project Settings**:

1. Pick an output model (typically `Eleven Multilingual v2`).
2. Set the **Dialogue Language** to match your script; this unlocks curated voice suggestions and automatically keeps multilingual mode enabled.
3. Choose the audio format (MP3 or PCM) and toggle **Speak Parentheticals** if desired.
4. Decide whether to enable **Concatenate Audio**. For the happy path, leave it on so you get one mixed file after generation.

## 4. Assign Voices

You have four options:

1. **Auto-fill Voice IDs** (fastest) – If your screenplay includes Voice IDs in the character list format `- CHARACTER (Voice ID: abc123...)`, click the **Auto-fill Voice IDs** button in the Character Voices panel to extract and apply them automatically.
2. **Character Voices panel** – manually paste voice IDs or reuse Voice Presets.
3. **Voice Suggestions panel** – choose a character, then click **Apply** for any recommended narrator/hero/villain. These are tinted by language.
4. Scroll through **My ElevenLabs Voices** (auto-loaded after entering your API key) to apply custom voices with optional preview playback.

Repeat until every character shows a voice ID (characters with missing IDs display a red badge).

## 5. Audio Production (Optional)

In the **Audio Production** panel:

1. Upload a looping background track and set a mix volume.
2. Add sound effects with labels, start times (`mm:ss`), custom volumes, and audio uploads.

These uploads live only in-memory/localStorage for privacy; reattach them if you refresh or share a project link.

## 6. Run Generation

1. Head to **Step 4: Generate**.
2. Ensure the Generate button is enabled (requires script text, API key, and at least one detected character).
3. Click **Generate Audio**.

During generation you’ll see:

- Live logs with chunk counts, statuses, and a copyable progress log.
- Timeline updates per chunk and a progress bar showing the current character/snippet.

If an error occurs (rate limit, invalid voice, etc.), the UI displays a toast, the logs note the failure, and a **Resume** button lets you recover from that exact chunk after fixing the issue.

### Output Location

- **Concatenate ON**: When complete, you’ll receive `concatenated_audio.mp3`.
- **Concatenate OFF**: You’ll get a single ZIP archive containing every generated clip plus `manifest.json`/`manifest.csv`.

Either way, a success toast confirms the download, and the Exports panel now offers:

- Standalone manifest JSON/CSV
- SRT & VTT subtitle files using ElevenLabs word alignment
- Another ZIP download button if you need to repackage everything
- A Reaper template (`.rpp`) with one track per character so you can continue mixing inside your DAW

## 7. Export & Share

- Use **Copy Share Link** in the Project Manager card to serialize the entire configuration (script, settings, voice presets, audio-production metadata) into the URL. This never includes audio assets; reattach background/SFX as needed.
- Download the project JSON if you want a local snapshot to load via “Load Project File.”

## 8. Verify & QA Checklist

1. Play `concatenated_audio.mp3` (or unzip individual clips) to confirm expected voices and SFX/backing track placement.
2. Open the timeline; preview a few lines for spot checks.
3. Inspect `manifest.json` or `subtitles.srt` to ensure timings look correct, especially for non-English scripts.
4. If running both mixing + subtitles, confirm the backend terminal shows no ffmpeg errors.

That’s it—you’ve exercised the happy path with background music, SFX, multilingual voices, shareable presets, and subtitle exports. Happy voice acting! 🎙️
