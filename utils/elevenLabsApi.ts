import { AudioProductionSettings, DialogueChunk, CharacterConfig, GeneratedBlob, WordTimestamp } from '../types';
import { logError, notifyError } from './errorHandling';

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const OUTPUT_FORMAT_DETAILS: Record<string, { extension: string; accept: string }> = {
  mp3_44100_128: { extension: 'mp3', accept: 'audio/mpeg' },
  mp3_44100_192: { extension: 'mp3', accept: 'audio/mpeg' },
  pcm_24000: { extension: 'wav', accept: 'audio/wav' }
};

const getFormatDetails = (format: string) => {
  return OUTPUT_FORMAT_DETAILS[format] || OUTPUT_FORMAT_DETAILS['mp3_44100_128'];
};

const WORDS_PER_MINUTE = 150;

const estimateDurationMs = (text: string) => {
  const words = text.split(/\s+/).filter(Boolean).length;
  return Math.round((words / WORDS_PER_MINUTE) * 60 * 1000);
};

const translateApiError = (status: number, rawMessage: string) => {
  if (status === 401) {
    return 'ElevenLabs rejected the API key (401). Double-check the key in Step 1.';
  }
  if (status === 429) {
    return 'ElevenLabs rate limit reached (429). Increase the request delay or pause briefly before retrying.';
  }
  if (rawMessage.toLowerCase().includes('insufficient_quota')) {
    return 'Your ElevenLabs character quota is exhausted. Upgrade your plan or wait for the monthly reset.';
  }
  if (status >= 500) {
    return 'ElevenLabs is experiencing issues (5xx). Try again in a few minutes.';
  }
  return `API Error ${status}: ${rawMessage || 'Unexpected response from ElevenLabs.'}`;
};

const parseRateLimitRemaining = (headers: Headers) => {
  const header = headers.get('x-rate-limit-remaining') ?? headers.get('x-ratelimit-remaining');
  if (!header) {
    return undefined;
  }
  const value = Number(header);
  return Number.isFinite(value) ? value : undefined;
};

const adjustDelayBasedOnRateLimit = (remaining: number | undefined, currentDelay: number, baseDelay: number) => {
  if (remaining === undefined) {
    return currentDelay;
  }
  if (remaining <= 2) {
    return Math.min(currentDelay + 250, 2000);
  }
  if (remaining > 5 && currentDelay > baseDelay) {
    return Math.max(baseDelay, currentDelay - 100);
  }
  return currentDelay;
};

export interface GenerationProgress {
  current: number;
  total: number;
  currentCharacter: string;
  status: 'generating' | 'downloading' | 'complete' | 'error';
  message: string;
  snippet?: string;
}

interface AudioGenerationResult {
  blob: Blob;
  rateLimitRemaining?: number;
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
): Promise<AudioGenerationResult> => {
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
            speed: config.voiceSettings.speed ?? 1,
            use_speaker_boost: true
          }
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(translateApiError(response.status, errorText));
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

      const rateLimitRemaining = parseRateLimitRemaining(response.headers);
      const blob = await response.blob();
      return { blob, rateLimitRemaining };
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



const fetchAlignmentData = async (
  chunk: DialogueChunk,
  config: CharacterConfig,
  apiKey: string,
  modelId: string
): Promise<WordTimestamp[] | null> => {
  const alignmentUrl = `https://api.elevenlabs.io/v1/text-to-speech/${config.voiceId}/alignment`;
  try {
    const response = await fetch(alignmentUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': apiKey
      },
      body: JSON.stringify({
        text: chunk.text,
        model_id: modelId
      })
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    const alignment = data?.alignment || data?.words || [];
    return alignment
      .map((entry: { word?: string; text?: string; start?: number; end?: number }) => ({
        word: (entry.word || entry.text || '').trim(),
        startMs: Math.round((entry.start ?? 0) * 1000),
        endMs: Math.round((entry.end ?? 0) * 1000)
      }))
      .filter((item: WordTimestamp) => item.word.length > 0);
  } catch (error) {
    logError('Alignment fetch failed', error);
    return null;
  }
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
  onProgress?: (progress: GenerationProgress, current: number, total: number) => void,
  audioProduction?: AudioProductionSettings
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
  if (audioProduction) {
    const mixPayload: {
      background?: { ref: string; volume: number };
      soundEffects: Array<{ ref: string; startTimeMs: number; volume: number; label: string }>;
    } = {
      soundEffects: []
    };
    if (audioProduction.backgroundTrack?.file) {
      const fieldName = 'backgroundTrack';
      formData.append(fieldName, audioProduction.backgroundTrack.file, audioProduction.backgroundTrack.file.name);
      mixPayload.background = {
        ref: fieldName,
        volume: audioProduction.backgroundTrack.volume ?? 0.35
      };
    }
    audioProduction.soundEffects.forEach(effect => {
      if (!effect.file) {
        return;
      }
      const fieldName = `soundEffect_${effect.id}`;
      formData.append(fieldName, effect.file, effect.file.name);
      mixPayload.soundEffects.push({
        ref: fieldName,
        startTimeMs: effect.startTimeMs,
        volume: effect.volume ?? 1,
        label: effect.label
      });
    });
    if (mixPayload.background || mixPayload.soundEffects.length) {
      formData.append('mixConfig', JSON.stringify(mixPayload));
    }
  }

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
    const message = notifyError('Concatenation failed', error, undefined, 'Failed to concatenate audio');
    throw new Error(message);
  }
};

interface GenerateAllAudioOptions {
  startIndex?: number;
  existingBlobs?: GeneratedBlob[];
  delayMs?: number;
  filenamePrefix?: string;
  audioProduction?: AudioProductionSettings;
}

export interface GenerateAllAudioResult {
  blobs: GeneratedBlob[];
  concatenationFailed: boolean;
  concatenatedBlob?: Blob;
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
): Promise<GenerateAllAudioResult> => {
  const total = dialogueChunks.length;
  const { extension } = getFormatDetails(outputFormat);
  const startIndex = options.startIndex ?? 0;
  const generatedBlobs: GeneratedBlob[] = [...(options.existingBlobs ?? [])];
  const baseDelay = options.delayMs ?? 500;
  let adaptiveDelay = baseDelay;
  let concatenationFailed = false;
  let concatenatedBlob: Blob | undefined;

  const computeInitialCursor = () => {
    if (!generatedBlobs.length) {
      return 0;
    }
    for (let i = generatedBlobs.length - 1; i >= 0; i--) {
      const blob = generatedBlobs[i];
      if (typeof blob.endTimeMs === 'number') {
        return blob.endTimeMs;
      }
    }
    let cursor = 0;
    for (let i = 0; i < generatedBlobs.length; i++) {
      const chunk = dialogueChunks[i];
      if (chunk?.startTimeMs !== undefined && chunk.endTimeMs !== undefined) {
        cursor = chunk.endTimeMs;
      } else {
        cursor += estimateDurationMs(chunk?.text ?? '');
      }
    }
    return cursor;
  };

  let timelineCursor = computeInitialCursor();

  // Generate all audio files
  for (let i = startIndex; i < dialogueChunks.length; i++) {
    const chunk = dialogueChunks[i];
    const config = characterConfigs[chunk.character];

    if (!config || !config.voiceId) {
      throw new Error(`No voice configuration found for character: ${chunk.character}`);
    }

    try {
      const result = await generateAudioFile(
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

      const alignment = await fetchAlignmentData(chunk, config, apiKey, modelId);
      const offsetAlignment: WordTimestamp[] | undefined = alignment
        ? alignment.map(word => ({
          word: word.word,
          startMs: word.startMs + timelineCursor,
          endMs: word.endMs + timelineCursor
        }))
        : undefined;
      const startTimeMs = offsetAlignment?.[0]?.startMs ?? timelineCursor;
      const estimatedDuration = offsetAlignment?.length
        ? (offsetAlignment[offsetAlignment.length - 1].endMs - (offsetAlignment[0]?.startMs ?? 0))
        : estimateDurationMs(chunk.text);
      const endTimeMs = offsetAlignment?.[offsetAlignment.length - 1]?.endMs ?? (startTimeMs + estimatedDuration);
      timelineCursor = endTimeMs;

      const baseFilename = `${String(i).padStart(4, '0')}_${chunk.character.replace(/\s+/g, '_')}.${extension}`;
      const filename = options.filenamePrefix ? `${options.filenamePrefix}_${baseFilename}` : baseFilename;

      generatedBlobs.push({
        blob: result.blob,
        filename,
        alignment: offsetAlignment,
        startTimeMs,
        endTimeMs
      });

      onProgress?.({
        current: i + 1,
        total,
        currentCharacter: chunk.character,
        status: 'complete',
        message: `✓ Completed ${chunk.character}`,
        snippet: chunk.text.slice(0, 80).trim()
      }, i + 1, total);

      adaptiveDelay = adjustDelayBasedOnRateLimit(result.rateLimitRemaining, adaptiveDelay, baseDelay);
      // Small delay between requests to avoid rate limiting
      if (i < dialogueChunks.length - 1 && adaptiveDelay > 0) {
        await wait(adaptiveDelay);
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
      concatenatedBlob = await concatenateAudioFiles(generatedBlobs, onProgress, options.audioProduction);
    } catch (error) {
      concatenationFailed = true;
      logError('Failed to concatenate audio files', error);
    }
  }

  return { blobs: generatedBlobs, concatenationFailed, concatenatedBlob };
};
