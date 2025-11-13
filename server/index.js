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

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Audio concatenation server is running' });
});

// Audio concatenation endpoint
app.post('/concatenate', upload.array('audioFiles'), async (req, res) => {
  const uploadedFiles = req.files;

  if (!uploadedFiles || uploadedFiles.length === 0) {
    return res.status(400).json({ error: 'No audio files provided' });
  }

  if (uploadedFiles.length === 1) {
    // If only one file, just return it
    const file = uploadedFiles[0];
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

  try {
    // Create file list for ffmpeg concat
    const fileListContent = uploadedFiles
      .map(file => `file '${path.resolve(file.path)}'`)
      .join('\n');

    await fs.writeFile(fileListPath, fileListContent);

    // Use ffmpeg to concatenate audio files
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

    // Send concatenated file
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Disposition', 'attachment; filename="concatenated_audio.mp3"');
    await pipeline(createReadStream(outputPath), res);

    // Cleanup files
    await Promise.all([
      fs.unlink(outputPath),
      fs.unlink(fileListPath),
      ...uploadedFiles.map(file => fs.unlink(file.path))
    ]).catch(console.error);

  } catch (error) {
    console.error('Concatenation error:', error);

    // Cleanup on error
    await Promise.all([
      fs.unlink(outputPath).catch(() => {}),
      fs.unlink(fileListPath).catch(() => {}),
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
