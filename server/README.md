# Audio Concatenation Server

This backend server handles audio file concatenation using ffmpeg.

## Prerequisites

1. **Node.js** (v18 or higher)
2. **FFmpeg** installed on your system
   - Windows: Download from https://ffmpeg.org/download.html or use `winget install ffmpeg`
   - Mac: `brew install ffmpeg`
   - Linux: `sudo apt install ffmpeg` or `sudo yum install ffmpeg`

## Setup

1. Install dependencies:
   ```bash
   cd server
   npm install
   ```

2. Verify FFmpeg is installed:
   ```bash
   ffmpeg -version
   ```

## Running the Server

Development mode (auto-restart on changes):
```bash
npm run dev
```

Production mode:
```bash
npm start
```

The server will start on `http://localhost:3001`

## API Endpoints

### `GET /health`
Health check endpoint to verify the server is running.

**Response:**
```json
{
  "status": "ok",
  "message": "Audio concatenation server is running"
}
```

### `POST /concatenate`
Concatenates multiple audio files into a single file.

**Request:**
- Content-Type: `multipart/form-data`
- Body: Array of audio files (field name: `audioFiles`)

**Response:**
- Content-Type: `audio/mpeg`
- Body: Concatenated audio file (binary)

## How It Works

1. Frontend generates individual audio files via ElevenLabs API
2. If concatenate is enabled, files are sent to this server
3. Server uses ffmpeg to concatenate files with the concat demuxer
4. Concatenated file is returned to the frontend
5. Temporary files are automatically cleaned up
