# CLI Usage

The CLI mirrors the web app’s generation flow so you can automate batches or run in CI.

## Install

```bash
npm install
```

## Basic Command

```bash
npm run cli -- \
  --script path/to/script.txt \
  --config path/to/project.json \
  --out ./cli_output \
  --delay 500 \
  --concat \
  --api-key YOUR_ELEVENLABS_API_KEY
```

## Arguments

| Flag | Description |
| --- | --- |
| `--script <path>` | Screenplay file (text/Markdown). Repeat flag to queue multiple scripts. |
| `--config <path>` | JSON project config exported from the UI (voices, settings, presets). |
| `--out <dir>` | Output directory (defaults to `cli_output`). |
| `--delay <ms>` | Delay between API requests (defaults to 500ms). |
| `--concat` | Concatenate outputs with ffmpeg after generation. |
| `--api-key <key>` | Overrides `ELEVENLABS_API_KEY` env var if provided. |

The CLI writes individual audio files (and an optional concatenated file) into the output directory using the same filename pattern as the web app.
