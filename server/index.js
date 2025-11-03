import express from 'express';
import cors from 'cors';
import multer from 'multer';
import ffmpeg from 'fluent-ffmpeg';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3001;

// Enable CORS for frontend communication
app.use(cors());
app.use(express.json());

// Configure multer for file uploads
const upload = multer({
  dest: 'uploads/',
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit per file
});

// Ensure upload directory exists
await fs.mkdir('uploads', { recursive: true });

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Audio concatenation server is running' });
});

// Helper to download a file
const downloadFile = async (url, outputPath) => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download ${url}: ${response.statusText}`);
  }
  const buffer = await response.buffer();
  await fs.writeFile(outputPath, buffer);
};

// Audio concatenation endpoint
app.post('/concatenate', upload.array('audioFiles'), async (req, res) => {
  const uploadedFiles = req.files;
  const backgroundMusicUrl = req.body.backgroundMusicUrl;
  const sfxConfigs = req.body.sfxConfigs ? JSON.parse(req.body.sfxConfigs) : [];
  const dialogueChunks = req.body.dialogueChunks ? JSON.parse(req.body.dialogueChunks) : [];
  const pauseDuration = parseFloat(req.body.pauseDuration) || 0;
  const outputFormat = req.body.outputFormat || 'mp3_44100_128'; // Default to mp3
  const masteringPreset = req.body.masteringPreset || 'none'; // Default to none

  if (!uploadedFiles || uploadedFiles.length === 0) {
    return res.status(400).json({ error: 'No audio files provided' });
  }

  const tempFilesToClean = [];
  let backgroundMusicPath = null;
  const sfxFilePaths = [];

  try {
    // Download background music if URL is provided
    if (backgroundMusicUrl) {
      const bgMusicFilename = `bg_music_${Date.now()}${path.extname(backgroundMusicUrl)}`;
      backgroundMusicPath = path.join('uploads', bgMusicFilename);
      await downloadFile(backgroundMusicUrl, backgroundMusicPath);
      tempFilesToClean.push(backgroundMusicPath);
    }

    // Download SFX files if provided
    for (const sfx of sfxConfigs) {
      if (sfx.url) {
        const sfxFilename = `sfx_${sfx.keyword}_${Date.now()}${path.extname(sfx.url)}`;
        const sfxPath = path.join('uploads', sfxFilename);
        await downloadFile(sfx.url, sfxPath);
        sfxFilePaths.push({ ...sfx, path: sfxPath });
        tempFilesToClean.push(sfxPath);
      }
    }

    // If only one speech file and no background music or SFX, just return it
    if (uploadedFiles.length === 1 && !backgroundMusicUrl && sfxConfigs.length === 0) {
      const file = uploadedFiles[0];
      res.setHeader('Content-Type', file.mimetype);
      res.setHeader('Content-Disposition', `attachment; filename="concatenated_audio${path.extname(file.originalname)}"`);

      const fileStream = await fs.readFile(file.path);
      res.send(fileStream);

      // Cleanup
      await fs.unlink(file.path).catch(console.error);
      return;
    }

    const getOutputDetails = (format) => {
      switch (format) {
        case 'mp3_44100_128': return { ext: '.mp3', codec: 'libmp3lame', bitrate: '128k' };
        case 'mp3_44100_192': return { ext: '.mp3', codec: 'libmp3lame', bitrate: '192k' };
        case 'pcm_24000': return { ext: '.wav', codec: 'pcm_s16le', rate: '24000' };
        case 'ulaw_8000': return { ext: '.wav', codec: 'pcm_mulaw', rate: '8000' };
        case 'pcm_16000': return { ext: '.wav', codec: 'pcm_s16le', rate: '16000' };
        case 'pcm_8000': return { ext: '.wav', codec: 'pcm_s16le', rate: '8000' };
        case 'wav_44100': return { ext: '.wav', codec: 'pcm_s16le', rate: '44100' };
        case 'ogg_44100': return { ext: '.ogg', codec: 'libvorbis', rate: '44100' };
        case 'flac_44100': return { ext: '.flac', codec: 'flac', rate: '44100' };
        default: return { ext: '.mp3', codec: 'libmp3lame', bitrate: '128k' };
      }
    };

    const outputDetails = getOutputDetails(outputFormat);
    const outputPath = path.join('uploads', `output_${Date.now()}${outputDetails.ext}`);
    const fileListPath = path.join('uploads', `filelist_${Date.now()}.txt`);
    
    const filesToConcatenate = [];
    for (let i = 0; i < uploadedFiles.length; i++) {
      filesToConcatenate.push(uploadedFiles[i].path);
      if (pauseDuration > 0 && i < uploadedFiles.length - 1) {
        const silencePath = path.join('uploads', `silence_${Date.now()}_${i}.mp3`);
        await new Promise((resolve, reject) => {
          ffmpeg()
            .input('anullsrc=r=44100:cl=stereo')
            .inputOptions([`-t ${pauseDuration}`])
            .output(silencePath)
            .on('end', resolve)
            .on('error', reject)
            .run();
        });
        filesToConcatenate.push(silencePath);
        tempFilesToClean.push(silencePath);
      }
    }

    tempFilesToClean.push(outputPath, fileListPath, ...uploadedFiles.map(file => file.path));

    // Create file list for ffmpeg concat
    const fileListContent = filesToConcatenate
      .map(file => `file '${path.resolve(file)}'`)
      .join('\n');

    await fs.writeFile(fileListPath, fileListContent);

    await new Promise((resolve, reject) => {
      let command = ffmpeg();
      let filterComplex = [];
      let inputIndex = 0;

      // Input for concatenated speech
      command = command.input(fileListPath).inputOptions(['-f', 'concat', '-safe', '0']);
      const concatOutputLabel = `concat_speech`;
      filterComplex.push(`[0:a]concat=n=${filesToConcatenate.length}:v=0:a=1[${concatOutputLabel}]`);
      
      // Apply loudnorm to the concatenated speech stream
      filterComplex.push(`[${concatOutputLabel}]loudnorm[speech_normalized]`);
      
      // Apply fade in/out to the normalized speech stream
      filterComplex.push(`[speech_normalized]afade=t=in:st=0:d=0.5,afade=t=out:st=duration-0.5:d=0.5[speech_faded]`);
      let currentAudioStream = `[speech_faded]`;
      if (backgroundMusicPath) {
        command = command.input(backgroundMusicPath);
        bgMusicStream = `[${inputIndex}:a]`;
        inputIndex++;
        filterComplex.push(`${bgMusicStream}aloop=loop=-1:size=2e+09[bg_loop]`);
      }

      // Add SFX inputs if present
      const sfxStreams = [];
      for (const sfx of sfxFilePaths) {
        command = command.input(sfx.path);
        sfxStreams.push(`[${inputIndex}:a]`);
        inputIndex++;
      }

      // Calculate SFX timings and add to filter complex
      let cumulativeDuration = 0;
      const sfxOverlays = [];
      for (let i = 0; i < dialogueChunks.length; i++) {
        const chunk = dialogueChunks[i];
        // Estimate duration (very rough, ideally would use ElevenLabs response for actual duration)
        const estimatedDuration = chunk.text.length * 0.07; // ~70ms per character

        for (const sfx of sfxFilePaths) {
          const sfxKeywordRegex = new RegExp(`\\[${sfx.keyword}\\]`, 'i');
          if (sfxKeywordRegex.test(chunk.text)) {
            sfxOverlays.push({
              stream: sfxStreams[sfxFilePaths.indexOf(sfx)],
              startTime: cumulativeDuration,
              volume: sfx.volume
            });
          }
        }
        cumulativeDuration += estimatedDuration + 0.5; // Add a small buffer between chunks
      }

      let currentAudioStream = speechStream;

      // Mix background music
      if (bgMusicStream) {
        filterComplex.push(`[${currentAudioStream}][bg_loop]amix=inputs=2:duration=first:dropout_transition=2,volume=0.5[mixed_bg]`);
        currentAudioStream = '[mixed_bg]';
      }

      // Overlay SFX
      sfxOverlays.forEach((sfx, idx) => {
        filterComplex.push(`[${currentAudioStream}][${sfx.stream}]amerge=inputs=2[sfx_mix_${idx}]`);
        currentAudioStream = `[sfx_mix_${idx}]`;
      });

      // Apply mastering preset
      if (masteringPreset !== 'none') {
        let masteringFilters = '';
        switch (masteringPreset) {
          case 'podcast':
            masteringFilters = 'compand=attacks=0:decays=0:points=-80/-105|-40/-40|-20/-20|0/-5:gain=5,loudnorm';
            break;
          case 'film_dialogue':
            masteringFilters = 'equalizer=f=300:width_type=h:width=100:g=-3,equalizer=f=3000:width_type=h:width=1000:g=2,compand=attacks=0:decays=0:points=-80/-105|-40/-40|-20/-20|0/-5:gain=3,loudnorm';
            break;
          case 'broadcast':
            masteringFilters = 'compand=attacks=0:decays=0:points=-80/-105|-40/-40|-20/-20|0/-5:gain=6,loudnorm=I=-23:LRA=7:TP=-2';
            break;
        }
        if (masteringFilters) {
          filterComplex.push(`${currentAudioStream}${masteringFilters}[mastered_audio]`);
          currentAudioStream = '[mastered_audio]';
        }
      }

      command
        .complexFilter(filterComplex)
        .map(currentAudioStream)
        .output(outputPath)
        .audioCodec(outputDetails.codec)
        .audioBitrate(outputDetails.bitrate)
        .audioFrequency(outputDetails.rate)
        .on('start', (commandLine) => {
          console.log('FFmpeg command:', commandLine);
        })
        .on('progress', (progress) => {
          console.log('Processing: ' + progress.percent + '% done');
        })
        .on('end', () => {
          console.log('Concatenation finished successfully');
          resolve();
        })
        .on('error', (err, stdout, stderr) => {
          console.error('FFmpeg error:', err.message);
          console.error('FFmpeg stderr:', stderr);
          reject(err);
        })
        .run();
    });

    // Send concatenated file
    const concatenatedFile = await fs.readFile(outputPath);
    res.setHeader('Content-Type', `audio/${outputDetails.ext.substring(1)}`);
    res.setHeader('Content-Disposition', `attachment; filename="concatenated_audio${outputDetails.ext}"`);
    res.send(concatenatedFile);

  } catch (error) {
    console.error('Concatenation error:', error);
    res.status(500).json({
      error: 'Failed to concatenate audio files',
      details: error.message
    });
  } finally {
    // Cleanup files
    await Promise.all(tempFilesToClean.map(file => fs.unlink(file).catch(() => {})));
  }
});

app.listen(PORT, () => {
  console.log(`🎵 Audio concatenation server running on http://localhost:${PORT}`);
  console.log(`📋 Health check: http://localhost:${PORT}/health`);
});
