# ElevenLabs Screenplay Formatter

A React-based web application that converts screenplay dialogue into AI-generated audio files using the ElevenLabs text-to-speech API. Perfect for creating audio drafts, voice demos, or bringing your scripts to life.

## Features

- **Intelligent Script Parsing** - Automatically detects characters and extracts dialogue from screenplay format
- **Character Voice Mapping** - Assign unique ElevenLabs voice IDs to each character
- **Fine-Tuned Voice Control** - Adjust stability, similarity boost, style, and speed per character
- **Audio Concatenation** - Option to merge all dialogue into a single audio file (requires backend server)
- **Real-Time Progress Tracking** - Live progress bar, character previews, and copyable logs
- **Resumable Generation** - Inline error surfaces, automatic retries, and a one-click “Resume from failed chunk” flow
- **Batch Generation** - Processes entire screenplays automatically with rate limiting
- **Concatenation Health Check** - Built-in status card to ping the backend server and show connectivity
- **Multiple Model Support** - Choose between multilingual and monolingual ElevenLabs models
- **Format Options** - Select output format (MP3 128kbps, 192kbps, or PCM 24kHz)

## Prerequisites

### Required

- **Node.js** (v18 or higher) - [Download here](https://nodejs.org/)
- **ElevenLabs API Key** - [Get your key here](https://elevenlabs.io/)

### Optional (for audio concatenation)

- **FFmpeg** - Required only if you want to use the "Concatenate Audio" feature
  - **Windows**: `winget install ffmpeg` or [download manually](https://ffmpeg.org/download.html)
  - **Mac**: `brew install ffmpeg`
  - **Linux**: `sudo apt install ffmpeg` (Ubuntu/Debian) or `sudo yum install ffmpeg` (RHEL/Fedora)

## Installation

1. **Clone the repository:**

   ```bash
   git clone https://github.com/ryan258/elevenlabs-screenplay-formatter.git
   cd elevenlabs-screenplay-formatter
   ```

2. **Install frontend dependencies:**

   ```bash
   npm install
   ```

3. **Configure environment variables (optional):**

   ```bash
   cp .env.example .env
   ```

   Populate `ELEVENLABS_API_KEY` if you want the React app to prefill the key field, and set `VITE_CONCAT_SERVER_URL` if your concatenation server isn’t running at the default `http://localhost:3001/concatenate`.

3. **(Optional) Install backend dependencies for concatenation:**
   ```bash
   cd server
   npm install
   cd ..
   ```

## Quick Start

### Basic Usage (Individual Audio Files)

1. **Start the frontend:**

   ```bash
   npm run dev
   ```

2. **Open your browser:**

   - Navigate to `http://localhost:3000`

3. **Configure and generate:**
   - Enter your ElevenLabs API key
   - Paste your screenplay into the text area
   - Configure voice IDs for each detected character
   - Disable "Concatenate Audio" toggle
   - Click "Generate Audio"
   - Individual audio files will download to your Downloads folder

### Advanced Usage (Concatenated Audio)

1. **Start the backend server (Terminal 1):**

   ```bash
   cd server
   npm start
   ```

   You should see:

   ```
   🎵 Audio concatenation server running on http://localhost:3001
   📋 Health check: http://localhost:3001/health
   ```

2. **Start the frontend (Terminal 2):**

   ```bash
   npm run dev
   ```

3. **Generate concatenated audio:**
   - Open `http://localhost:3000`
   - Enter your ElevenLabs API key
   - Paste your screenplay
   - Configure character voices
   - Enable "Concatenate Audio" toggle
   - Use the **Concatenation Status** card to confirm the backend is reachable (click “Run Health Check” if unsure)
   - Click "Generate Audio"
   - A single `concatenated_audio.mp3` file will download

## Error Handling & Resume Flow

- The progress panel now includes a percentage bar, the currently processed character, and a snippet of dialogue.
- If a chunk fails (bad API key, rate limit, network blip), the UI surfaces the exact line and enables a **Resume** button that continues from that chunk without reprocessing earlier ones.
- ElevenLabs calls auto-retry up to three times with exponential backoff before surfacing an error.
- Logs remain copyable for debugging, and the status banner reminds you that keys never leave the browser except for ElevenLabs requests.

## Project Structure

```
elevenlabs-screenplay-formatter/
├── components/               # React UI components
│   ├── ApiKeyPanel.tsx      # API key input
│   ├── CharacterConfigPanel.tsx  # Voice configuration per character
│   ├── GeneratePanel.tsx    # Generation button
│   ├── OutputDisplay.tsx    # Progress and results display
│   ├── ProjectSettingsPanel.tsx  # Model, format, concatenate settings
│   ├── ScriptInput.tsx      # Screenplay text input
│   ├── Modal.tsx            # Full-screen editor modal
│   ├── Slider.tsx           # Voice settings sliders
│   └── icons.tsx            # SVG icons
│
├── hooks/
│   └── useScriptParser.ts   # Screenplay parsing logic
│
├── utils/
│   ├── elevenLabsApi.ts     # ElevenLabs API integration
│   └── scriptGenerator.ts   # Legacy bash script generation
│
├── server/                  # Backend concatenation server
│   ├── index.js            # Express server with ffmpeg
│   ├── package.json        # Server dependencies
│   └── README.md           # Server documentation
│
├── App.tsx                 # Main application component
├── types.ts                # TypeScript type definitions
├── index.tsx               # React entry point
├── index.html              # HTML template
├── package.json            # Frontend dependencies
└── vite.config.ts          # Vite build configuration
```

## Contributor Guide

For coding standards, testing expectations, and pull request conventions, see [AGENTS.md](./AGENTS.md).

## How It Works

### 1. Script Parsing

The application uses a custom screenplay parser (`useScriptParser.ts`) that:

- Detects character names (all caps followed by dialogue)
- Extracts dialogue text
- Splits screenplay into processable chunks
- Maintains scene and character context

### 2. Audio Generation Flow

**Without Concatenation:**

```
Parse screenplay → Detect characters → Configure voices → Generate each chunk via ElevenLabs API → Download individual files
```

**With Concatenation:**

```
Parse screenplay → Detect characters → Configure voices → Generate each chunk via ElevenLabs API → Store in memory → Send to backend server → FFmpeg concatenates files → Download single file
```

### 3. Backend Concatenation (Optional)

The backend server (`server/index.js`) provides a REST API endpoint:

- **Endpoint**: `POST /concatenate`
- **Input**: Multipart form data with audio files
- **Process**: Uses ffmpeg's concat demuxer to merge files
- **Output**: Single concatenated MP3 file
- **Cleanup**: Automatically removes temporary files

## Configuration

### Environment Variables

- `ELEVENLABS_API_KEY` – optional convenience to prefill the API key input in the frontend.
- `VITE_CONCAT_SERVER_URL` – override the default `http://localhost:3001/concatenate` endpoint if your backend runs elsewhere.
- `server/.env` (copy from `server/.env.example`):
  - `PORT` – change the concatenation server port (defaults to `3001`).
  - `ALLOWED_ORIGIN` – comma-separated list of allowed origins; leave unset locally.
- Local storage: the browser caches your script, voice settings, and API key for convenience; clear site data to reset.
- API key handling: your key stays in the browser and is only sent to ElevenLabs (or written to the offline bash script you export); it never goes through the optional concatenation server. Use the “Remember this key on this device” toggle in the UI to control whether it persists across reloads.

### Project Settings

- **Model**:

  - `eleven_multilingual_v2` - Supports 29+ languages (default)
  - `eleven_monolingual_v1` - English-only, faster

- **Output Format**:

  - `mp3_44100_128` - MP3 at 44.1kHz, 128kbps (default)
  - `mp3_44100_192` - MP3 at 44.1kHz, 192kbps (higher quality)
  - `pcm_24000` - PCM at 24kHz (uncompressed)

- **Concatenate Audio**:
  - `Enabled` - Combines all audio into one file (requires backend server)
  - `Disabled` - Downloads individual files (e.g., `0000_CHARACTER.mp3`)

### Character Voice Settings

Each character can have custom voice settings:

- **Voice ID**: ElevenLabs voice identifier (get from [ElevenLabs Voice Library](https://elevenlabs.io/voices))
- **Stability** (0.0-1.0): Controls voice consistency
- **Similarity Boost** (0.0-1.0): Enhances similarity to original voice
- **Style** (0.0-1.0): Adds expressiveness
- **Speed** (0.25-4.0): Playback speed multiplier

## Advanced Usage & Limitations

- **Rate limiting**: ElevenLabs enforces request quotas, so the app inserts a 500ms delay between chunks. Increase the delay in `utils/elevenLabsApi.ts` if you see throttling.
- **Browser vs. bash workflows**: The browser path streams audio directly to Downloads, while the generated bash script saves files locally and is better for CI/offline workflows. Use the bash script for extremely long screenplays or when you need resumable retries.
- **Parsing scope**: The parser matches the documented formats (character list, inline dialogue, alias handling). Scripts that omit the `Characters:` section or mix lowercase names are intentionally ignored to prevent misattribution.

## Screenplay Format

**IMPORTANT**: The parser requires a specific format to work correctly.

### Required Format

```
Characters:
- CHARACTER ONE
- CHARACTER TWO
- CHARACTER THREE

INT. LOCATION - DAY

CHARACTER ONE
First line of dialogue here.

CHARACTER TWO
Response dialogue here.
This can span multiple lines.

CHARACTER ONE
(whispering)
More dialogue with stage direction.
```

### Quick Rules

**Required:**

1. **Start with `Characters:`** - List all characters at the top
2. **Use dashes** - Each character name must start with `-`
3. **ALL CAPS** - Character names must be in ALL CAPS
4. **Match names** - Names in dialogue must match the Characters list

**Optional:**

- Scene headings: `INT.`, `EXT.`, or `I/E.`
- Parentheticals: `(whispering)` - automatically removed from audio
- Inline format: `CHARACTER: dialogue here`

### Working Example

Copy this into the app to test:

```
Characters:
- ALICE
- BOB

ALICE
Hello Bob, how are you?

BOB
I'm great, thanks!

ALICE
That's wonderful to hear.
```

**Need more help?** See [EXAMPLE_SCREENPLAY.md](EXAMPLE_SCREENPLAY.md) for detailed formatting guide and examples, or check [example.txt](example.txt) for a ready-to-use template.

## Troubleshooting

### "No dialogue chunks found in script"

**Cause**: The screenplay parser couldn't detect any dialogue in your script

**Solutions**:

1. **Add a Characters section** at the top of your script:
   ```
   Characters:
   - CHARACTER ONE
   - CHARACTER TWO
   ```
2. **Use ALL CAPS** for character names in both the list and dialogue
3. **Use dashes** (`-`) before each character name in the Characters section
4. **Test with the example**: Copy the example from [example.txt](example.txt) to verify the app is working
5. **See the guide**: Check [EXAMPLE_SCREENPLAY.md](EXAMPLE_SCREENPLAY.md) for detailed formatting help

### "Failed to concatenate audio"

**Cause**: Backend server is not running

**Solution**:

```bash
cd server
npm start
```

### "No voice configuration found for character: X"

**Cause**: You haven't assigned a voice ID to one or more characters

**Solution**: In the Character Config panel, assign a voice ID to each character using the dropdown or custom input

### "API Error: 401 - Unauthorized"

**Cause**: Invalid or missing ElevenLabs API key

**Solution**: Verify your API key at https://elevenlabs.io/app/settings/api-keys

### "FFmpeg: command not found"

**Cause**: FFmpeg is not installed

**Solution**:

1. Install ffmpeg (see Prerequisites)
2. Verify: `ffmpeg -version`
3. Restart terminal/IDE

### High Memory Usage

**Cause**: Large screenplays with concatenation enabled store all audio in browser memory

**Solution**:

- Disable concatenation for very large scripts
- Process in smaller sections
- Increase available RAM

### Rate Limiting Errors

**Cause**: Too many API requests in quick succession

**Solution**: The app includes automatic 500ms delays between requests. If you still see rate limits, you may need to upgrade your ElevenLabs plan.

## Tech Stack

**Frontend:**

- React 19.2.0
- TypeScript 5.8.2
- Vite 6.2.0

**Backend:**

- Node.js (ESM)
- Express 4.18.2
- Multer 1.4.5 (file uploads)
- Fluent-FFmpeg 2.1.2 (audio processing)

**APIs:**

- ElevenLabs Text-to-Speech API v1

## Environment Variables

Create a `.env.local` file in the root directory (optional):

```bash
ELEVENLABS_API_KEY=your_api_key_here
```

If not set, you'll be prompted to enter it in the UI.

## Development

### Run in development mode:

```bash
npm run dev
```

### Build for production:

```bash
npm run build
```

### Preview production build:

```bash
npm run preview
```

## API Rate Limits

ElevenLabs API has rate limits based on your subscription tier:

- **Free**: 10,000 characters/month
- **Starter**: 30,000 characters/month
- **Creator**: 100,000 characters/month
- **Pro**: 500,000 characters/month

The app includes automatic rate limiting (500ms delay between requests) to avoid hitting API limits.

## Known Limitations

1. **Browser-based**: Audio generation happens client-side, so large scripts may consume significant bandwidth
2. **Concatenation requires backend**: Cannot concatenate audio files purely in the browser without significant performance impact
3. **ElevenLabs only**: Currently only supports ElevenLabs API (no other TTS providers)
4. **No persistence**: Settings and configurations are lost on page refresh
5. **Sequential generation**: Audio files are generated one at a time to respect rate limits

## Future Enhancements

- [ ] Save/load project configurations
- [ ] Bulk voice assignment (all characters → same voice)
- [ ] Preview audio before downloading
- [ ] Support for other TTS providers
- [ ] Server-side generation option
- [ ] Audio waveform visualization
- [ ] Character voice presets

## License

MIT License - Feel free to use this project for personal or commercial purposes.

## Credits

- **ElevenLabs** - AI text-to-speech API
- **FFmpeg** - Audio processing
- Built with React + Vite

## Support

For issues, questions, or feature requests, please open an issue on GitHub.

---

**Happy voice acting!** 🎙️
