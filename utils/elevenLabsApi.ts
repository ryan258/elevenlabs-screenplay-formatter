import { DialogueChunk, CharacterConfig } from '../types';

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
}

export const generateAudioFile = async (
  chunk: DialogueChunk,
  config: CharacterConfig,
  apiKey: string,
  modelId: string,
  outputFormat: string,
  onProgress?: (progress: GenerationProgress, current: number, total: number) => void,
  index: number = 0,
  total: number = 1
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

export const generateAllAudio = async (
  dialogueChunks: DialogueChunk[],
  characterConfigs: { [key: string]: CharacterConfig },
  apiKey: string,
  modelId: string,
  outputFormat: string,
  concatenate: boolean,
  onProgress?: (progress: GenerationProgress, current: number, total: number) => void
): Promise<void> => {
  const total = dialogueChunks.length;
  const { extension } = getFormatDetails(outputFormat);
  const generatedBlobs: { blob: Blob; filename: string }[] = [];

  // Generate all audio files
  for (let i = 0; i < dialogueChunks.length; i++) {
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
        onProgress,
        i,
        total
      );

      const filename = `${String(i).padStart(4, '0')}_${chunk.character.replace(/\s+/g, '_')}.${extension}`;

      if (concatenate) {
        // Store blob for later concatenation
        generatedBlobs.push({ blob, filename });
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

      // Small delay between requests to avoid rate limiting
      if (i < dialogueChunks.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    } catch (error) {
      if (onProgress) {
        onProgress({
          current: i + 1,
          total,
          currentCharacter: chunk.character,
          status: 'error',
          message: `✗ Failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        }, i + 1, total);
      }
      throw error;
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
  }
};
