# Happy Path Guide — ElevenLabs Screenplay Formatter (Python)

This walkthrough shows the fastest way to convert a screenplay into per-line audio clips. The app is designed for local single-user use.

## 1) Install + Configure

```bash
uv sync
export ELEVENLABS_API_KEY="..."
export ELEVENLABS_BASE_URL="https://api.elevenlabs.io"
```

## 2) Run the App

```bash
uv run python -m apps.api
```

Open `http://localhost:8000`.

## 3) Script → Characters

1. On **Script Input**, paste your screenplay and click **Parse**.
2. Go to **Characters**:
   - Click **Auto-fill Voice IDs** if your script includes a character list like `- CHARACTER (Voice ID: abc123...)`.
   - Or click **Load Voices** to browse voices from your ElevenLabs account and apply a Voice ID to each character.
3. Click **Save & Continue**.

## 4) Generation (Job)

On **Generation**:

1. Set **Model ID** (e.g. `eleven_multilingual_v2`).
2. Choose output format (mp3 or pcm/wav).
3. Click **Start Job** and watch progress stream via SSE.

## 5) Timeline + Exports

1. Use **Timeline** to spot-check individual lines.
2. On **Exports**:
   - Download the ZIP (always available after a successful job).
