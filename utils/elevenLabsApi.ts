import { DialogueChunk, CharacterConfig, VoiceSettings, ProjectSettings, SFX } from '../types';

export interface GenerationProgress {
  current: number;
  total: number;
  currentCharacter: string;
  status: 'generating' | 'downloading' | 'complete' | 'error';
  message: string;
}

/**
 * Enhanced fetch with exponential backoff retry logic
 * Retries on network errors, timeouts, and 5xx server errors
 */
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);

      // Don't retry on client errors (4xx) except 429 (rate limit)
      if (response.status >= 400 && response.status < 500 && response.status !== 429) {
        return response;
      }

      // Retry on 5xx server errors or 429 rate limit
      if (response.status >= 500 || response.status === 429) {
        if (attempt < maxRetries) {
          const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 1000;
          console.warn(`Server error ${response.status}, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
      }

      return response;
    } catch (error) {
      lastError = error as Error;

      // Don't retry on abort
      if (error instanceof Error && error.name === 'AbortError') {
        throw error;
      }

      // Retry on network errors
      if (attempt < maxRetries) {
        const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 1000;
        console.warn(`Network error: ${error}, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
    }
  }

  throw new Error(`Failed after ${maxRetries} retries: ${lastError?.message || 'Unknown error'}`);
}

/**
 * Generates an audio file for a given dialogue chunk using the ElevenLabs API, including character-level timestamps.
 * Implements retry logic with exponential backoff for API calls.
 * @param chunk The dialogue chunk to generate audio for.
 * @param config The character configuration for the voice.
 * @param apiKey The ElevenLabs API key.
 * @param modelId The ID of the voice model to use.
 * @param outputFormat The desired output audio format.
 * @param onProgress Callback function for progress updates.
 * @param index The current index of the chunk in the generation queue.
 * @param total The total number of chunks in the generation queue.
 * @param signal AbortSignal to cancel the API request.
 * @returns A Promise that resolves to an object containing the audio blob, response headers, and alignment data.
 */
export const generateAudioFile = async (
  chunk: DialogueChunk,
  config: CharacterConfig,
  apiKey: string,
  modelId: string,
  outputFormat: string,
  onProgress?: (progress: GenerationProgress, current: number, total: number) => void,
  index: number = 0,
  total: number = 1,
  signal?: AbortSignal
): Promise<{blob: Blob, headers: Headers, alignment?: any}> => {
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${config.voiceId}/with-timestamps`;

  if (onProgress) {
    onProgress({
      current: index + 1,
      total,
      currentCharacter: chunk.character,
      status: 'generating',
      message: `Generating audio for ${chunk.character}...`
    }, index + 1, total);
  }

  const response = await fetchWithRetry(url, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'xi-api-key': apiKey
    },
    body: JSON.stringify({
      text: chunk.emotion ? `[${chunk.emotion}] ${chunk.text}` : chunk.text,
      model_id: modelId,
      voice_settings: {
        stability: config.voiceSettings.stability,
        similarity_boost: config.voiceSettings.similarity_boost,
        style: config.voiceSettings.style || 0,
        use_speaker_boost: true
      },
      output_format: outputFormat
    }),
    signal
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API Error for ${chunk.character}: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const audioBlob = await (await fetch(`data:audio/mpeg;base64,${data.audio_base64}`)).blob(); // Decode base64 audio to blob

  if (onProgress) {
    onProgress({
      current: index + 1,
      total,
      currentCharacter: chunk.character,
      status: 'downloading',
      message: `Downloading audio for ${chunk.character}...`
    }, index + 1, total);
  }

  return { blob: audioBlob, headers: response.headers, alignment: data.alignment };
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

export const addVoice = async (
  name: string,
  description: string,
  labels: { [key: string]: string },
  files: File[],
  apiKey: string
): Promise<any> => {
  const url = 'https://api.elevenlabs.io/v1/voices/add';
  const formData = new FormData();
  formData.append('name', name);
  formData.append('description', description);
  formData.append('labels', JSON.stringify(labels));
  files.forEach((file, index) => {
    formData.append(`files`, file);
  });

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey
    },
    body: formData
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API Error adding voice: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return data;
};

export const getAvailableVoices = async (apiKey: string): Promise<any> => {
  const url = 'https://api.elevenlabs.io/v1/voices';
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'xi-api-key': apiKey
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API Error fetching voices: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return data.voices;
};

/**
 * Validates the API key by making a test request
 */
export interface ApiKeyValidationResult {
  valid: boolean;
  status?: number | null;
  error?: string;
}

export const validateApiKey = async (apiKey: string): Promise<ApiKeyValidationResult> => {
  try {
    const url = 'https://api.elevenlabs.io/v1/user/subscription';
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'xi-api-key': apiKey
      }
    });

    if (response.ok) {
      return { valid: true, status: response.status };
    }

    let errorMessage: string | undefined;
    try {
      const data = await response.clone().json();
      if (typeof data === 'string') {
        errorMessage = data;
      } else if (data && typeof data === 'object') {
        if ('detail' in data && typeof data.detail === 'string') {
          errorMessage = data.detail;
        } else {
          errorMessage = JSON.stringify(data);
        }
      }
    } catch {
      try {
        errorMessage = await response.text();
      } catch {
        errorMessage = undefined;
      }
    }

    return {
      valid: false,
      status: response.status,
      error: errorMessage,
    };
  } catch (error) {
    console.error('API key validation failed:', error);
    const message = error instanceof Error ? error.message : String(error);
    return {
      valid: false,
      status: null,
      error: message,
    };
  }
};

/**
 * Enhanced rate limit handling with user-friendly warnings
 */
async function handleRateLimiting(headers: Headers): Promise<void> {
  const remaining = headers.get('ratelimit-remaining');
  const reset = headers.get('ratelimit-reset');
  const limit = headers.get('ratelimit-limit');

  if (remaining && reset) {
    const remainingCount = parseInt(remaining);
    const resetTime = new Date(parseInt(reset) * 1000);
    const now = new Date();
    const waitTime = resetTime.getTime() - now.getTime();

    // Warn when approaching rate limit
    if (remainingCount < 10 && remainingCount > 0) {
      console.warn(`Approaching rate limit: ${remainingCount} requests remaining. Limit resets at ${resetTime.toLocaleTimeString()}`);
    }

    // Wait if we've hit the rate limit
    if (remainingCount < 5 && waitTime > 0) {
      console.warn(`Rate limit nearly exhausted. Waiting ${Math.round(waitTime / 1000)}s until reset...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }

  // Add standard delay to avoid hitting rate limits
  await new Promise(resolve => setTimeout(resolve, 500));
}
export const generateAudioPreview = async (
  voiceId: string,
  voiceSettings: VoiceSettings,
  apiKey: string,
  modelId: string
): Promise<Blob> => {
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Accept': 'audio/mpeg',
      'Content-Type': 'application/json',
      'xi-api-key': apiKey
    },
    body: JSON.stringify({
      text: "Hello, I am a preview voice.",
      model_id: modelId,
      voice_settings: {
        stability: voiceSettings.stability,
        similarity_boost: voiceSettings.similarity_boost,
        style: voiceSettings.style || 0,
        use_speaker_boost: true
      }
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API Error for preview: ${response.status} - ${errorText}`);
  }

  const blob = await response.blob();
  return blob;
};

const concatenateAudioFiles = async (
  blobs: { blob: Blob; filename: string }[],
  dialogueChunks: DialogueChunk[],
  projectSettings: ProjectSettings,
  backgroundMusicUrl?: string,
  sfxConfigs?: SFX[],
  onProgress?: (progress: GenerationProgress, current: number, total: number) => void
): Promise<Blob> => {
  const serverUrl = 'http://localhost:3001/concatenate';

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
  if (backgroundMusicUrl) {
    formData.append('backgroundMusicUrl', backgroundMusicUrl);
  }
  if (sfxConfigs && sfxConfigs.length > 0) {
    formData.append('sfxConfigs', JSON.stringify(sfxConfigs));
  }
  formData.append('dialogueChunks', JSON.stringify(dialogueChunks));
  formData.append('outputFormat', projectSettings.outputFormat);

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
    const message = error instanceof Error ? error.message : String(error);
    if (onProgress) {
      onProgress({
        current: blobs.length,
        total: blobs.length,
        currentCharacter: 'All',
        status: 'error',
        message: `✗ Concatenation failed: ${message}`
      }, blobs.length, blobs.length);
    }
    throw new Error(`Failed to concatenate audio: ${message}`);
  }
};

export const generateAllAudio = async (
  dialogueChunks: DialogueChunk[],
  characterConfigs: { [key: string]: CharacterConfig },
  apiKey: string,
  projectSettings: ProjectSettings,
  sfxConfigs: SFX[],
  signal: AbortSignal,
  onProgress?: (progress: GenerationProgress, current: number, total: number) => void,
  resumeIndex: number = 0
): Promise<void> => {
  const total = dialogueChunks.length;
  let generatedBlobs: { blob: Blob; filename: string }[] = [];

  if (resumeIndex > 0) {
    const savedBlobs = localStorage.getItem('generatedBlobs');
    if (savedBlobs) {
      generatedBlobs = JSON.parse(savedBlobs);
    }
  }

  // Generate all audio files
  for (let i = resumeIndex; i < dialogueChunks.length; i++) {
    const chunk = dialogueChunks[i];
    const config = characterConfigs[chunk.character];

    if (!config || !config.voiceId) {
      throw new Error(`No voice configuration found for character: ${chunk.character}`);
    }

    try {
      const { blob, headers, alignment } = await generateAudioFile(
        chunk,
        config,
        apiKey,
        projectSettings.model,
        projectSettings.outputFormat,
        onProgress,
        i,
        total,
        signal
      );

      // Store timestamp information
      if (alignment && alignment.normalized_alignment && alignment.normalized_alignment.word_start_times_seconds && alignment.normalized_alignment.word_end_times_seconds) {
        chunk.startTime = alignment.normalized_alignment.word_start_times_seconds[0];
        chunk.endTime = alignment.normalized_alignment.word_end_times_seconds[alignment.normalized_alignment.word_end_times_seconds.length - 1];
      }

      await handleRateLimiting(headers);

      const filename = `${String(i).padStart(4, '0')}_${chunk.character.replace(/\s+/g, '_')}.mp3`;

      if (projectSettings.concatenate) {
        // Store blob for later concatenation
        generatedBlobs.push({ blob, filename });
        localStorage.setItem('generatedBlobs', JSON.stringify(generatedBlobs));
      } else {
        // Download immediately if not concatenating
        downloadBlob(blob, filename);
      }

      if (onProgress) {
        onProgress({
          current: i + 1,
          total,
          currentCharacter: chunk.character,
          status: 'complete',
          message: `✓ Completed ${chunk.character}`
        }, i + 1, total);
      }

      
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (onProgress) {
        onProgress({
          current: i + 1,
          total,
          currentCharacter: chunk.character,
          status: 'error',
          message: `✗ Failed: ${message}`
        }, i + 1, total);
      }
      localStorage.setItem('generationState', JSON.stringify({ dialogueChunks, characterConfigs, modelId: projectSettings.model, outputFormat: projectSettings.outputFormat, concatenate: projectSettings.concatenate, backgroundMusicUrl: projectSettings.backgroundMusicUrl, pauseDuration: projectSettings.pauseDuration, resumeIndex: 0 }));
      throw error;
    }
  }

  // If concatenation is enabled, send all files to the server
  if (projectSettings.concatenate && generatedBlobs.length > 0) {
    try {
      const concatenatedBlob = await concatenateAudioFiles(generatedBlobs, dialogueChunks, projectSettings, projectSettings.backgroundMusicUrl, sfxConfigs, onProgress);
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
  }
  localStorage.removeItem('generationState');
  localStorage.removeItem('generatedBlobs');
};
