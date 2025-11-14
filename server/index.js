import express from 'express';
import cors from 'cors';
import multer from 'multer';
import ffmpeg from 'fluent-ffmpeg';
import { promises as fs, createReadStream } from 'fs';
import path from 'path';
import { pipeline } from 'stream/promises';

const app = express();
const PORT = process.env.PORT ? Number(process.env.PORT) : 3001;
const allowedOrigins = process.env.ALLOWED_ORIGIN
  ? process.env.ALLOWED_ORIGIN.split(',').map(origin => origin.trim()).filter(Boolean)
  : null;

// Enable CORS for frontend communication, allowing overrides in production
if (allowedOrigins && allowedOrigins.length > 0 && !allowedOrigins.includes('*')) {
  app.use(cors({ origin: allowedOrigins }));
} else {
  app.use(cors());
}
app.use(express.json());

// Configure multer for file uploads
const upload = multer({
  dest: 'uploads/',
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit per file
});

// Ensure upload directory exists with error visibility
const ensureUploadsDir = async () => {
  try {
    await fs.mkdir('uploads', { recursive: true });
  } catch (error) {
    console.error('Failed to initialize uploads directory:', error);
    throw error;
  }
};

try {
  await ensureUploadsDir();
} catch {
  process.exit(1);
}

const mixBackgroundTrack = (basePath, backgroundPath, volume, suffix) => {
  const safeVolume = Number.isFinite(volume) ? volume : 0.35;
  const nextPath = path.join('uploads', `mix_bg_${suffix}_${Date.now()}.mp3`);
  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(basePath)
      .input(backgroundPath)
      .complexFilter([
        { filter: 'volume', options: `volume=${safeVolume}`, inputs: '1:a', outputs: 'bgvol' },
        { filter: 'amix', options: { inputs: 2, dropout_transition: 0 }, inputs: ['0:a', 'bgvol'], outputs: 'mix' }
      ])
      .outputOptions(['-map [mix]', '-shortest'])
      .output(nextPath)
      .on('end', () => resolve(nextPath))
      .on('error', (err) => reject(err))
      .run();
  });
};

const overlaySoundEffect = (basePath, effectPath, startMs, volume, suffix, index) => {
  const safeVolume = Number.isFinite(volume) ? volume : 1;
  const delay = Math.max(0, startMs || 0);
  const nextPath = path.join('uploads', `mix_sfx_${index}_${suffix}_${Date.now()}.mp3`);
  const delayString = `${delay}|${delay}`;
  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(basePath)
      .input(effectPath)
      .complexFilter([
        { filter: 'adelay', options: delayString, inputs: '1:a', outputs: 'delayed' },
        { filter: 'volume', options: `volume=${safeVolume}`, inputs: 'delayed', outputs: 'sfxvol' },
        { filter: 'amix', options: { inputs: 2, dropout_transition: 0 }, inputs: ['0:a', 'sfxvol'], outputs: 'mix' }
      ])
      .outputOptions(['-map [mix]', '-shortest'])
      .output(nextPath)
      .on('end', () => resolve(nextPath))
      .on('error', (err) => reject(err))
      .run();
  });
};

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Audio concatenation server is running' });
});

// Audio concatenation endpoint
app.post('/concatenate', upload.any(), async (req, res) => {
  const uploadedFiles = Array.isArray(req.files) ? req.files : [];
  const fileMap = new Map(uploadedFiles.map(file => [file.fieldname, file]));
  const audioFiles = uploadedFiles.filter(file => file.fieldname === 'audioFiles');
  if (!audioFiles.length) {
    return res.status(400).json({ error: 'No audio files provided' });
  }

  let mixConfig = null;
  if (req.body.mixConfig) {
    try {
      mixConfig = JSON.parse(req.body.mixConfig);
    } catch (error) {
      console.warn('Failed to parse mix config:', error);
    }
  }
  const backgroundRef = mixConfig?.background?.ref;
  const backgroundFile = backgroundRef ? fileMap.get(backgroundRef) : null;
  const soundEffects = Array.isArray(mixConfig?.soundEffects) ? mixConfig.soundEffects : [];
  const resolvedSoundEffects = soundEffects
    .map(effect => ({
      ...effect,
      file: effect.ref ? fileMap.get(effect.ref) : null
    }))
    .filter(effect => effect.file);
  const requiresMixing = Boolean(backgroundFile || resolvedSoundEffects.length > 0);

  if (audioFiles.length === 1 && !requiresMixing) {
    // If only one file, just return it
    const file = audioFiles[0];
    res.setHeader('Content-Type', file.mimetype);
    res.setHeader('Content-Disposition', `attachment; filename="concatenated_audio${path.extname(file.originalname)}"`);

    const fileStream = await fs.readFile(file.path);
    res.send(fileStream);

    // Cleanup
    await fs.unlink(file.path).catch(console.error);
    return;
  }

  const uniqueSuffix = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const outputPath = path.join('uploads', `output_${uniqueSuffix}.mp3`);
  const fileListPath = path.join('uploads', `filelist_${uniqueSuffix}.txt`);
  const tempArtifacts = [];

  try {
    if (audioFiles.length > 1) {
      const fileListContent = audioFiles
        .map(file => `file '${path.resolve(file.path)}'`)
        .join('\n');
      await fs.writeFile(fileListPath, fileListContent);

      await new Promise((resolve, reject) => {
        ffmpeg()
          .input(fileListPath)
          .inputOptions(['-f', 'concat', '-safe', '0'])
          .outputOptions(['-c', 'copy'])
          .output(outputPath)
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
    } else {
      await fs.copyFile(audioFiles[0].path, outputPath);
    }

    let finalOutputPath = outputPath;
    if (backgroundFile) {
      const nextPath = await mixBackgroundTrack(finalOutputPath, backgroundFile.path, mixConfig?.background?.volume, uniqueSuffix);
      tempArtifacts.push(finalOutputPath);
      finalOutputPath = nextPath;
    }

    for (let index = 0; index < resolvedSoundEffects.length; index++) {
      const effect = resolvedSoundEffects[index];
      const nextPath = await overlaySoundEffect(
        finalOutputPath,
        effect.file.path,
        effect.startTimeMs,
        effect.volume,
        uniqueSuffix,
        index
      );
      tempArtifacts.push(finalOutputPath);
      finalOutputPath = nextPath;
    }

    // Send concatenated file
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Disposition', 'attachment; filename="concatenated_audio.mp3"');
    await pipeline(createReadStream(finalOutputPath), res);

    // Cleanup files
    await Promise.all([
      fs.unlink(finalOutputPath).catch(() => {}),
      fs.unlink(fileListPath).catch(() => {}),
      ...tempArtifacts.map(file => fs.unlink(file).catch(() => {})),
      ...uploadedFiles.map(file => fs.unlink(file.path).catch(() => {}))
    ]).catch(console.error);

  } catch (error) {
    console.error('Concatenation error:', error);

    // Cleanup on error
    await Promise.all([
      fs.unlink(outputPath).catch(() => {}),
      fs.unlink(fileListPath).catch(() => {}),
      ...tempArtifacts.map(file => fs.unlink(file).catch(() => {})),
      ...uploadedFiles.map(file => fs.unlink(file.path).catch(() => {}))
    ]);

    res.status(500).json({
      error: 'Failed to concatenate audio files',
      details: error.message
    });
  }
});

app.listen(PORT, () => {
  console.log(`🎵 Audio concatenation server running on http://localhost:${PORT}`);
  console.log(`📋 Health check: http://localhost:${PORT}/health`);
});
