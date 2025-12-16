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
  --concat
```

## Arguments

| Flag | Description |
| --- | --- |
| `--script <path>` | Screenplay file (text/Markdown). Repeat flag to queue multiple scripts. |
| `--config <path>` | JSON project config containing `projectSettings` + `characterConfigs` (v0.4-style shape). |
| `--out <dir>` | Output directory (defaults to `cli_output`). |
| `--delay <ms>` | Delay between API requests (defaults to 500ms). |
| `--concat` | Concatenate outputs with ffmpeg after generation. (FFmpeg required.) |

The CLI writes per-line audio files (and an optional concatenated file) into the output directory.
