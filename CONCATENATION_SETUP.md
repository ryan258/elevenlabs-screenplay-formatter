# Audio Concatenation Setup Guide

The concatenate audio toggle now works! This guide will help you set up the backend server required for audio concatenation.

## What Changed

Previously, the "Concatenate Audio" toggle in the UI was not connected to any functionality. Now:

- ✅ Toggle is fully functional
- ✅ When enabled, all audio files are sent to a local server
- ✅ Server uses ffmpeg to concatenate files into a single MP3
- ✅ You get one `concatenated_audio.mp3` file instead of individual files
- ✅ Fallback to individual files if server is unavailable

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

### 2. Install Node.js Dependencies

Navigate to the server directory and install dependencies:

```bash
cd server
npm install
```

## Running the Application

You need to run **both** the frontend and backend:

### Terminal 1 - Backend Server (Port 3001)
```bash
cd server
npm start
```

You should see:
```
🎵 Audio concatenation server running on http://localhost:3001
📋 Health check: http://localhost:3001/health
```

### Terminal 2 - Frontend (Port 5173)
```bash
npm run dev
```

## Usage

1. Start both servers (backend and frontend)
2. Open the app in your browser (usually http://localhost:5173)
3. Configure your screenplay and voice settings
4. **Enable or disable** the "Concatenate Audio" toggle in Project Settings
   - **Enabled**: Generates one `concatenated_audio.mp3` file
   - **Disabled**: Generates individual files (e.g., `0000_CHARACTER.mp3`)
5. Click "Generate Audio"

## Troubleshooting

### Error: "Failed to concatenate audio"

**Cause:** Backend server is not running

**Solution:** Make sure the backend server is running on port 3001:
```bash
cd server
npm start
```

### Error: "ffmpeg: command not found"

**Cause:** FFmpeg is not installed or not in PATH

**Solution:**
1. Install ffmpeg (see Prerequisites above)
2. Verify installation: `ffmpeg -version`
3. Restart your terminal/IDE after installation

### Port 3001 already in use

**Solution:** Stop any process using port 3001, or modify the port in:
- `server/index.js` (line 11): Change `PORT = 3001`
- `utils/elevenLabsApi.ts` (line 86): Update `serverUrl`

### Server crashes during concatenation

**Check logs** in the server terminal. Common issues:
- Audio format incompatibility: Ensure all files are the same format
- Insufficient disk space: Check available space in `server/uploads/`
- FFmpeg errors: Check that ffmpeg is properly installed

## Architecture

```
User generates audio
    ↓
Frontend: Generate individual audio files via ElevenLabs API
    ↓
If concatenate = true:
    ↓
Frontend: Send all audio blobs to backend server
    ↓
Backend: Save files temporarily to disk
    ↓
Backend: Use ffmpeg to concatenate files
    ↓
Backend: Return concatenated file
    ↓
Frontend: Download concatenated_audio.mp3
    ↓
Backend: Clean up temporary files
```

## Development

Run the backend in watch mode (auto-restart on changes):
```bash
cd server
npm run dev
```

## Files Modified

- `App.tsx:48-69` - Added concatenate parameter to generation flow
- `utils/elevenLabsApi.ts:82-237` - Added concatenation logic
- `server/index.js` - New backend server with concatenation endpoint
- `server/package.json` - Server dependencies

## Notes

- The backend server uses a temporary `uploads/` directory (auto-cleaned after each request)
- Files are sent from browser memory to the server (no disk writes on frontend)
- If the server is unavailable, the app gracefully falls back to individual downloads
- Maximum file size: 50MB per audio file (configurable in `server/index.js:16`)
