import { DialogueChunk, CharacterConfig, GeneratedBlob } from '../types';

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const OUTPUT_FORMAT_DETAILS: Record<string, { extension: string; accept: string }> = {
  mp3_44100_128: { extension: 'mp3', accept: 'audio/mpeg' },
  mp3_44100_192: { extension: 'mp3', accept: 'audio/mpeg' },
  pcm_24000: { extension: 'wav', accept: 'audio/wav' }
};

const getFormatDetails = (format: string) => {
  return OUTPUT_FORMAT_DETAILS[format] || OUTPUT_FORMAT_DETAILS['mp3_44100_128'];
};

export interface GenerationProgress {
  current: number;
  total: number;
  currentCharacter: string;
  status: 'generating' | 'downloading' | 'complete' | 'error';
  message: string;
  snippet?: string;
}

export class GenerationError extends Error {
  constructor(
    message: string,
    public failedIndex: number,
    public failedCharacter: string,
    public completedBlobs: GeneratedBlob[] = []
  ) {
    super(message);
  }
}

export const generateAudioFile = async (
  chunk: DialogueChunk,
  config: CharacterConfig,
  apiKey: string,
  modelId: string,
  outputFormat: string,
  onProgress?: (progress: GenerationProgress, current: number, total: number) => void,
  index: number = 0,
  total: number = 1,
  maxRetries = 2
): Promise<Blob> => {
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${config.voiceId}`;

  const { accept } = getFormatDetails(outputFormat);

  if (onProgress) {
    onProgress({
      current: index + 1,
      total,
      currentCharacter: chunk.character,
      status: 'generating',
      message: `Generating audio for ${chunk.character}...`
    }, index + 1, total);
  }

  let attempt = 0;
  let lastError: unknown = null;

  while (attempt <= maxRetries) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Accept': accept,
          'Content-Type': 'application/json',
          'xi-api-key': apiKey
        },
        body: JSON.stringify({
          text: chunk.text,
          model_id: modelId,
          output_format: outputFormat,
          voice_settings: {
            stability: config.voiceSettings.stability,
            similarity_boost: config.voiceSettings.similarity_boost,
            style: config.voiceSettings.style || 0,
            use_speaker_boost: true
          }
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API Error for ${chunk.character}: ${response.status} - ${errorText}`);
      }

      if (onProgress) {
        onProgress({
          current: index + 1,
          total,
          currentCharacter: chunk.character,
          status: 'downloading',
          message: `Downloading audio for ${chunk.character}...`
        }, index + 1, total);
      }

      const blob = await response.blob();
      return blob;
    } catch (error) {
      lastError = error;
      if (attempt >= maxRetries) {
        break;
      }
      await wait(Math.min(1000 * (attempt + 1), 5000));
      attempt += 1;
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Unknown error generating audio');
};

export const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

const CONCAT_SERVER_URL = import.meta.env?.VITE_CONCAT_SERVER_URL || 'http://localhost:3001/concatenate';

const getConcatenateServerBase = () => {
  try {
    const url = new URL(CONCAT_SERVER_URL);
    url.pathname = '/';
    return url.toString().replace(/\/$/, '');
  } catch {
    return 'http://localhost:3001';
  }
};

export const getConcatenationHealthUrl = () => `${getConcatenateServerBase()}/health`;

const concatenateAudioFiles = async (
  blobs: { blob: Blob; filename: string }[],
  onProgress?: (progress: GenerationProgress, current: number, total: number) => void
): Promise<Blob> => {
  const serverUrl = CONCAT_SERVER_URL;

  if (onProgress) {
    onProgress({
      current: blobs.length,
      total: blobs.length,
      currentCharacter: 'All',
      status: 'generating',
      message: 'Concatenating audio files on server...'
    }, blobs.length, blobs.length);
  }

  // Create FormData with all audio files
  const formData = new FormData();
  blobs.forEach(({ blob, filename }) => {
    formData.append('audioFiles', blob, filename);
  });

  try {
    const response = await fetch(serverUrl, {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Concatenation server error: ${response.status} - ${errorText}`);
    }

    const concatenatedBlob = await response.blob();

    if (onProgress) {
      onProgress({
        current: blobs.length,
        total: blobs.length,
        currentCharacter: 'All',
        status: 'complete',
        message: '✓ Audio files concatenated successfully'
      }, blobs.length, blobs.length);
    }

    return concatenatedBlob;
  } catch (error) {
    if (onProgress) {
      onProgress({
        current: blobs.length,
        total: blobs.length,
        currentCharacter: 'All',
        status: 'error',
        message: `✗ Concatenation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      }, blobs.length, blobs.length);
    }
    const message = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to concatenate audio: ${message}`);
  }
};

interface GenerateAllAudioOptions {
  startIndex?: number;
  existingBlobs?: GeneratedBlob[];
  delayMs?: number;
  filenamePrefix?: string;
}

export const generateAllAudio = async (
  dialogueChunks: DialogueChunk[],
  characterConfigs: { [key: string]: CharacterConfig },
  apiKey: string,
  modelId: string,
  outputFormat: string,
  concatenate: boolean,
  onProgress?: (progress: GenerationProgress, current: number, total: number) => void,
  options: GenerateAllAudioOptions = {}
): Promise<GeneratedBlob[]> => {
  const total = dialogueChunks.length;
  const { extension } = getFormatDetails(outputFormat);
  const startIndex = options.startIndex ?? 0;
  const generatedBlobs: GeneratedBlob[] = [...(options.existingBlobs ?? [])];
  const delayMs = options.delayMs ?? 500;

  // Generate all audio files
  for (let i = startIndex; i < dialogueChunks.length; i++) {
    const chunk = dialogueChunks[i];
    const config = characterConfigs[chunk.character];

    if (!config || !config.voiceId) {
      throw new Error(`No voice configuration found for character: ${chunk.character}`);
    }

    try {
      const blob = await generateAudioFile(
        chunk,
        config,
        apiKey,
        modelId,
        outputFormat,
        (progress, current, totalCount) => {
          onProgress?.(
            { ...progress, snippet: chunk.text.slice(0, 80).trim() },
            current,
            totalCount
          );
        },
        i,
        total
      );

      const baseFilename = `${String(i).padStart(4, '0')}_${chunk.character.replace(/\s+/g, '_')}.${extension}`;
      const filename = options.filenamePrefix ? `${options.filenamePrefix}_${baseFilename}` : baseFilename;

      generatedBlobs.push({ blob, filename });

      onProgress?.({
        current: i + 1,
        total,
        currentCharacter: chunk.character,
        status: 'complete',
        message: `✓ Completed ${chunk.character}`,
        snippet: chunk.text.slice(0, 80).trim()
      }, i + 1, total);

      // Small delay between requests to avoid rate limiting
      if (i < dialogueChunks.length - 1 && delayMs > 0) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    } catch (error) {
      onProgress?.({
        current: i + 1,
        total,
        currentCharacter: chunk.character,
        status: 'error',
        message: `✗ Failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        snippet: chunk.text.slice(0, 80).trim()
      }, i + 1, total);
      throw error instanceof GenerationError
        ? error
        : new GenerationError(
            error instanceof Error ? error.message : 'Unknown error',
            i,
            chunk.character,
            generatedBlobs
          );
    }
  }

  // If concatenation is enabled, send all files to the server
  if (concatenate && generatedBlobs.length > 0) {
    try {
      const concatenatedBlob = await concatenateAudioFiles(generatedBlobs, onProgress);
      downloadBlob(concatenatedBlob, 'concatenated_audio.mp3');
    } catch (error) {
      // If concatenation fails, fallback to individual downloads
      if (onProgress) {
        onProgress({
          current: total,
          total,
          currentCharacter: 'All',
          status: 'error',
          message: `⚠ Concatenation failed, downloading individual files instead...`
        }, total, total);
      }

      generatedBlobs.forEach(({ blob, filename }) => {
        downloadBlob(blob, filename);
      });

      throw error;
    }
  } else {
    generatedBlobs.forEach(({ blob, filename }) => {
      downloadBlob(blob, filename);
    });
  }

  return generatedBlobs;
};
