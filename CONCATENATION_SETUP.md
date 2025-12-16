# Audio Concatenation Setup Guide

Concatenation is implemented in the Python app. This guide explains how to enable it and what to expect.

## What Changed

When concatenation is enabled:

- ✅ Per-line clips are always generated
- ✅ The job attempts to create a separate `concatenated_audio.mp3` (or `.wav` for PCM output)
- ✅ The concatenated file is available via `GET /api/exports/{job_id}/concatenated`
- ✅ If FFmpeg is missing or concat fails, the job still completes and `concat_error.txt` is included in the ZIP

## Prerequisites

### 1. Install FFmpeg

**Windows:**
```bash
# Using winget (Windows Package Manager)
winget install ffmpeg

# Or download from https://ffmpeg.org/download.html
```

**Mac:**
```bash
brew install ffmpeg
```

**Linux:**
```bash
# Ubuntu/Debian
sudo apt update && sudo apt install ffmpeg

# Fedora/RHEL
sudo yum install ffmpeg
```

**Verify installation:**
```bash
ffmpeg -version
```

## Running the Application

Run the combined FastAPI + Flask app:

```bash
python3 -m apps.api
```

Open `http://localhost:8000`.

## Usage

1. Paste/parse a script, assign voices, and start a job.
2. When the job completes, go to **Exports**:
   - Download ZIP (includes all per-line clips and exports).
   - If concatenation succeeded, use **Concatenated Audio** to listen to a single file in one pass.

## Troubleshooting

### Error: "ffmpeg: command not found"

**Cause:** FFmpeg is not installed or not in PATH

**Solution:**
1. Install ffmpeg (see Prerequisites above)
2. Verify installation: `ffmpeg -version`
3. Restart your terminal/IDE after installation

## Architecture

```
User generates audio
    ↓
Python JobStore: Generate per-line clips via ElevenLabs API
    ↓
If concatenate = true:
    ↓
JobStore: Use ffmpeg to concatenate files (best-effort)
    ↓
Exports: ZIP + optional concatenated audio endpoint
```
