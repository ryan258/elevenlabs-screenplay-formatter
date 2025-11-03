# ElevenLabs Screenplay Formatter

A production-ready React application that converts screenplay dialogue into AI-generated audio files using the ElevenLabs text-to-speech API. Perfect for screenwriters, voice actors, and content creators who want to rapidly prototype screenplay audio with professional-quality AI voices.

## ✨ Key Features

### 🎬 **Script Processing**
- **Intelligent Screenplay Parsing** - Automatically detects characters and extracts dialogue
- **Fountain Format Support** - Full support for Fountain screenplay format (.fountain)
- **Dynamic Character Detection** - Handles both predefined and inline character names
- **Emotion Tags** - Apply emotional inflection with `[HAPPY]`, `[SAD]`, etc.

### 🎙️ **Voice Management**
- **Advanced Voice Search** - Filter voices by gender, accent, age, and use case
- **Live Audio Preview** - Preview any voice before assigning it to a character
- **Custom Voice Settings** - Fine-tune stability, similarity boost, style, and speed per character
- **Voice Cloning Support** - Upload custom voice samples via ElevenLabs API

### 🎵 **Audio Generation**
- **Batch Processing** - Process entire screenplays automatically with intelligent rate limiting
- **Resume Capability** - Automatic retry logic with exponential backoff for failed requests
- **Progress Persistence** - Resume generation after page refresh or browser crash
- **Audio Concatenation** - Merge all dialogue into a single file with background music and SFX
- **Subtitle Generation** - Automatic SRT/VTT subtitle generation with timestamps

### ✏️ **Editing & Workflow**
- **Undo/Redo** - Full undo/redo support with keyboard shortcuts (Ctrl+Z, Ctrl+Y)
- **Auto-Save** - Script and configuration automatically saved to localStorage
- **Project History** - Version history with ability to revert to previous states
- **Comments System** - Add notes to specific dialogue chunks
- **Drag & Drop** - Drag screenplay files directly into the app

### 🚀 **Quality of Life**
- **Keyboard Shortcuts** - Ctrl+Enter to generate, Ctrl+Z to undo, Ctrl+Y to redo
- **Cost Estimator** - See estimated ElevenLabs API cost before generating
- **Script Templates** - Pre-built templates for different genres
- **Project Sharing** - Generate shareable links for configurations
- **Export to ZIP** - Bundle screenplay, config, and audio files together

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
   git clone <repository-url>
   cd elevenlabs-screenplay-formatter
   ```

2. **Install frontend dependencies:**

   ```bash
   npm install
   ```

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

   - Navigate to `http://localhost:5173`

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
   - Open `http://localhost:5173`
   - Enter your ElevenLabs API key
   - Paste your screenplay
   - Configure character voices
   - Enable "Concatenate Audio" toggle
   - Click "Generate Audio"
   - A single `concatenated_audio.mp3` file will download

## Project Structure

```
elevenlabs-screenplay-formatter/
├── components/                      # React UI components
│   ├── ApiKeyPanel.tsx             # API key input
│   ├── CharacterConfigPanel.tsx    # Voice configuration per character
│   ├── CommentsPanel.tsx           # Comments for dialogue chunks
│   ├── ErrorBoundary.tsx           # Error boundary with Sentry
│   ├── GeneratePanel.tsx           # Generation controls with accessibility
│   ├── HistoryPanel.tsx            # Project version history
│   ├── Modal.tsx                   # Full-screen editor modal
│   ├── ProgressIndicator.tsx       # Progress bar with resume capability
│   ├── ProjectSettingsPanel.tsx    # Model, format, settings
│   ├── ScriptInput.tsx             # Screenplay input with undo/redo
│   ├── ScriptTemplateSelector.tsx  # Pre-built script templates
│   ├── SfxPanel.tsx                # Sound effects configuration
│   ├── Slider.tsx                  # Voice settings sliders
│   ├── StatisticsPanel.tsx         # Generation statistics
│   ├── VoiceCompareModal.tsx       # Side-by-side voice comparison
│   ├── VoiceCloningPanel.tsx       # Custom voice upload
│   ├── VoiceSelectorModal.tsx      # Advanced voice search & preview
│   └── icons.tsx                   # SVG icons
│
├── hooks/
│   ├── useScriptParser.ts          # Intelligent screenplay parser
│   └── useUndoRedo.ts              # Undo/redo state management
│
├── utils/
│   ├── elevenLabsApi.ts            # ElevenLabs API with retry logic
│   ├── errorMessages.ts            # User-friendly error messages
│   ├── progressPersistence.ts      # Progress save/restore
│   ├── scriptGenerator.ts          # Configuration validation
│   ├── shareUtils.ts               # Project sharing utilities
│   └── subtitleGenerator.ts        # SRT/VTT subtitle generation
│
├── server/                         # Backend concatenation server
│   ├── index.js                    # Express server with ffmpeg
│   ├── package.json                # Server dependencies
│   └── README.md                   # Server documentation
│
├── e2e/                            # End-to-end tests
│   └── generation.spec.ts          # Playwright tests
│
├── App.tsx                         # Main application with state management
├── types.ts                        # TypeScript type definitions
├── index.tsx                       # React entry point with Sentry
├── index.html                      # HTML template
├── package.json                    # Frontend dependencies
├── vite.config.ts                  # Vite build configuration
├── vitest.config.ts                # Vitest test configuration
└── playwright.config.ts            # Playwright E2E configuration
```

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

The app includes comprehensive error handling with user-friendly messages and troubleshooting steps. Here are common issues and solutions:

### "No dialogue chunks found in script"

**Cause**: The screenplay parser couldn't detect any dialogue

**Solutions**:
1. Add a `Characters:` section at the top with character names using dashes
2. Use ALL CAPS for character names in both the list and dialogue
3. Test with the example from [example.txt](example.txt)
4. See [EXAMPLE_SCREENPLAY.md](EXAMPLE_SCREENPLAY.md) for detailed formatting

**App shows**: Detailed error message with formatting tips and links to examples

### "Failed to concatenate audio" or "Backend Server Not Running"

**Cause**: The concatenation server isn't running

**Solutions**:
1. Start the backend: `cd server && npm start`
2. Or disable "Concatenate Audio" to download individual files
3. Make sure port 3001 is available
4. See [CONCATENATION_SETUP.md](CONCATENATION_SETUP.md) for setup guide

**App shows**: Clear instructions on starting the server or disabling concatenation

### "Invalid API Key" or "401 Unauthorized"

**Cause**: Invalid or expired ElevenLabs API key

**Solutions**:
1. Verify your API key at https://elevenlabs.io/app/settings/api-keys
2. Make sure you copied the entire key without extra spaces
3. Check if your API key has been revoked or expired
4. Try generating a new API key

**App shows**: Detailed troubleshooting steps and link to API key management

### "Rate Limit Exceeded" or "429 Too Many Requests"

**Cause**: Hit the ElevenLabs API rate limit

**Solutions**:
1. Wait a few minutes - the app automatically retries with delays
2. Consider upgrading your ElevenLabs plan for higher rate limits
3. Process smaller batches of dialogue
4. Check your usage at https://elevenlabs.io/app/usage

**App shows**: Rate limit warning with automatic backoff and wait times

### "Quota Exceeded" or "Insufficient Credits"

**Cause**: Used up your ElevenLabs character quota

**Solutions**:
1. Check remaining quota at https://elevenlabs.io/app/usage
2. Wait until your quota resets (monthly)
3. Upgrade your plan for more characters per month
4. Use shorter dialogue for testing

**App shows**: Quota information and links to usage dashboard

### "No voice configuration found for character: X"

**Cause**: Character doesn't have a voice assigned

**Solutions**:
1. Scroll to Character Config panel
2. Click "Browse Voices" to search and preview voices
3. Select a voice from the dropdown
4. Make sure all characters have voices assigned

**App shows**: Which specific character needs a voice with instructions

### Network or Connection Errors

**Cause**: Unable to connect to ElevenLabs servers

**Solutions**:
1. Check your internet connection
2. Try again in a few moments
3. Check if ElevenLabs is down at https://status.elevenlabs.io
4. Disable VPN or proxy if you're using one

**App shows**: Network error details with troubleshooting steps

### Generation Interrupted or Page Refreshed

**Solution**: The app automatically saves progress! Just refresh and click "Resume Generation" to continue where you left off.

**Note**: Progress is saved for 24 hours and includes:
- Which files were generated
- Current position in the screenplay
- Estimated time remaining

## Tech Stack

**Frontend:**
- React 19.2.0 with TypeScript 5.8
- Vite 6.2.0 for blazing-fast builds
- React Toastify for notifications
- JSZip & File-saver for project export

**State Management:**
- Custom hooks (useUndoRedo, useScriptParser)
- LocalStorage for persistence
- Progress tracking utilities

**Backend:**
- Node.js with Express 4.18.2
- Multer 1.4.5 for file uploads
- Fluent-FFmpeg 2.1.2 for audio processing
- CORS for cross-origin requests

**Testing:**
- Vitest for unit tests
- Playwright for E2E tests
- GitHub Actions CI/CD pipeline

**Monitoring:**
- Sentry for error tracking
- Error boundaries for graceful failures

**APIs:**
- ElevenLabs Text-to-Speech API v1 with retry logic

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

### Run tests:

```bash
# Unit tests
npm test

# Unit tests in watch mode
npm run test:watch

# Unit tests with UI
npm run test:ui

# E2E tests
npm run test:e2e
```

### Project Scripts:

- `npm run dev` - Start development server (localhost:5173)
- `npm run build` - Build for production (outputs to `/dist`)
- `npm run preview` - Preview production build
- `npm test` - Run unit tests once
- `npm run test:watch` - Run tests in watch mode
- `npm run test:ui` - Run tests with Vitest UI
- `npm run test:e2e` - Run Playwright E2E tests

## API Rate Limits

ElevenLabs API has rate limits based on your subscription tier:

- **Free**: 10,000 characters/month
- **Starter**: 30,000 characters/month
- **Creator**: 100,000 characters/month
- **Pro**: 500,000 characters/month

The app includes automatic rate limiting (500ms delay between requests) to avoid hitting API limits.

## Current Limitations

1. **Browser-based Generation**: Audio generation happens client-side, which consumes bandwidth for large scripts
2. **Backend Required for Concatenation**: Merging audio files requires the backend server with FFmpeg
3. **ElevenLabs API Only**: Currently only supports ElevenLabs (no other TTS providers)
4. **Sequential Processing**: Files generated one at a time to respect API rate limits (parallel generation would hit rate limits)
5. **LocalStorage Only**: Multi-user support is basic and doesn't sync across devices
6. **Test Coverage**: Currently ~30%, target is 70%+

## Completed Features ✅

These features have been fully implemented:

- ✅ **Save/Load Projects** - Auto-save with localStorage persistence
- ✅ **Preview Audio** - Live voice preview before assignment
- ✅ **Character Voice Presets** - Import/export voice configurations as JSON
- ✅ **Progress Persistence** - Resume after browser crash or refresh
- ✅ **Undo/Redo** - Full history with keyboard shortcuts
- ✅ **Voice Search & Filter** - Advanced filtering by gender, accent, age
- ✅ **Batch Processing** - Drag & drop multiple screenplay files
- ✅ **Subtitle Generation** - Automatic SRT/VTT with timestamps
- ✅ **Error Recovery** - Automatic retry with exponential backoff
- ✅ **Voice Cloning** - Upload custom voice samples

## Planned Enhancements

**Phase 1.3 - Quality Assurance** (In Progress):
- [ ] Increase test coverage to 70%+
- [ ] Fix failing unit and E2E tests
- [ ] Security audit (API key handling, input sanitization)
- [ ] Browser compatibility testing (Safari, Firefox, Edge)
- [ ] Performance monitoring and analytics

**Phase 2 - Professional Features** (Future):
- [ ] Multi-track export (separate audio per character for DAW import)
- [ ] Advanced audio effects (EQ, compression, reverb)
- [ ] Waveform visualization with timeline
- [ ] Real-time audio preview as you adjust settings
- [ ] PDF screenplay import
- [ ] Final Draft (.fdx) native parsing
- [ ] Cloud storage integration (save projects to cloud)

**Phase 3 - Scale & Ecosystem** (Long-term):
- [ ] Docker containerization
- [ ] CLI tool for automation
- [ ] VS Code extension
- [ ] Desktop app (Electron)
- [ ] Mobile PWA
- [ ] Support for other TTS providers
- [ ] Server-side generation option

## License

MIT License - Feel free to use this project for personal or commercial purposes.

## Credits

- **ElevenLabs** - AI text-to-speech API
- **FFmpeg** - Audio processing
- Built with React + Vite

## Keyboard Shortcuts

Make your workflow faster with these keyboard shortcuts:

- **Ctrl+Enter** (Cmd+Enter on Mac) - Start audio generation
- **Ctrl+Z** (Cmd+Z on Mac) - Undo last edit
- **Ctrl+Y** (Cmd+Y on Mac) - Redo last undone edit
- **Ctrl+Shift+Z** (Cmd+Shift+Z on Mac) - Redo (alternative)

## Version History

### v0.4.0 - December 2024 (Current)
**Major UX Improvements**
- ✨ Full undo/redo support with 50-level history
- ✨ Progress persistence across page refreshes
- ✨ Resume capability for interrupted generation
- ✨ Advanced voice search with filters (already existed, now documented)
- ✨ Live audio preview (already existed, now documented)
- 🐛 Bug fixes and performance improvements
- 📦 Bundle size: 472.60 KB (147.57 KB gzipped)

### v0.3.0 - December 2024
**Core Stability & Performance**
- ✨ Enhanced error recovery with exponential backoff
- ✨ User-friendly error messages with troubleshooting
- ✨ Performance optimizations (React.memo, useMemo, useCallback)
- ✨ Better rate limit handling with automatic backoff
- ✨ Accessibility improvements (ARIA labels, screen reader support)
- ✨ Error boundaries with Sentry integration

### v0.2.0 - Initial Release
**Feature-Complete Prototype**
- 🎬 Screenplay parsing with Fountain support
- 🎙️ ElevenLabs API integration
- 🎵 Audio concatenation with FFmpeg backend
- 📝 Subtitle generation (SRT/VTT)
- 🔊 Voice cloning support
- 📊 Statistics and history tracking

## Contributing

Contributions are welcome! Please see [ROADMAP.md](ROADMAP.md) for planned features and current progress.

**Phase 1 Progress**: 61% complete (11/18 items)

Areas where contributions would be especially helpful:
1. Increasing test coverage (currently ~30%, target 70%+)
2. Browser compatibility testing
3. Security review and input sanitization
4. Documentation improvements
5. Bug fixes and performance optimizations

## Support

For issues, questions, or feature requests, please open an issue on GitHub.

For more information:
- **Roadmap**: See [ROADMAP.md](ROADMAP.md) for development plans
- **Examples**: Check [EXAMPLE_SCREENPLAY.md](EXAMPLE_SCREENPLAY.md) for formatting guide
- **Backend Setup**: See [CONCATENATION_SETUP.md](server/README.md) for server setup

---

## 🎉 What's New in v0.4.0

This release focuses on **professional-grade editing features** and **reliability**:

### ↶ Undo/Redo
Never lose your work! Full undo/redo support with:
- 50-level history
- Keyboard shortcuts (Ctrl+Z, Ctrl+Y)
- Smart duplicate prevention

### 💾 Progress Persistence
Interrupted generation? No problem!
- Automatic progress saving
- Resume from any point
- 24-hour retention
- Time estimates

### 🔍 Advanced Voice Search
Already implemented, now better documented:
- Filter by gender, accent, age
- Live preview before selection
- Compare voices side-by-side

### 🛡️ Enhanced Reliability
Production-ready error handling:
- User-friendly error messages
- Automatic retry with backoff
- Helpful troubleshooting steps
- Sentry error tracking

---

**Happy voice acting!** 🎙️✨
