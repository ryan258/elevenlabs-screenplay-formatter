# CLI Usage

The Python CLI mirrors the web app’s core generation flow so you can automate batches.

## Install

```bash
python3 -m pip install -e ".[dev]"
```

## Basic Command

```bash
export ELEVENLABS_API_KEY="..."
export ELEVENLABS_BASE_URL="https://api.elevenlabs.io"

python3 -m py_cli \
  --script path/to/script.txt \
  --config path/to/project.json \
  --out ./cli_output \
  --delay 500 \
  --cooldown 0
```

## Batch Mode

You can run multiple scripts with a single batch config file:

```bash
python3 -m py_cli --batch ./batch.json
```

Example `batch.json`:

```json
{
  "defaults": {
    "config": "./configs/default.json",
    "out": "./cli_output",
    "delay_ms": 500,
    "cooldown_ms": 1000
  },
  "presets": {
    "fast": "./configs/fast.json"
  },
  "jobs": [
    { "script": "./scripts/episode_01.txt" },
    { "script": "./scripts/episode_02.txt", "preset": "fast" }
  ]
}
```

## Arguments

| Flag              | Description                                                                               |
| ----------------- | ----------------------------------------------------------------------------------------- |
| `--script <path>` | Screenplay file (text/Markdown). Repeat flag to queue multiple scripts.                   |
| `--config <path>` | JSON project config containing `projectSettings` + `characterConfigs` (v0.4-style shape). |
| `--batch <path>`  | Batch config JSON file (see example above).                                               |
| `--out <dir>`     | Output directory (defaults to `cli_output`).                                              |
| `--delay <ms>`    | Delay between API requests (defaults to 500ms).                                           |
| `--cooldown <ms>` | Cooldown between scripts when running batches (defaults to 0).                            |

The CLI writes per-line audio files into the output directory.
