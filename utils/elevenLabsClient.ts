import { ElevenLabsVoice } from '../types';

interface VoicesResponse {
  voices?: ElevenLabsVoice[];
}

export const fetchElevenLabsVoices = async (apiKey: string, signal?: AbortSignal): Promise<ElevenLabsVoice[]> => {
  if (!apiKey) {
    return [];
  }

  const response = await fetch('https://api.elevenlabs.io/v1/voices', {
    method: 'GET',
    headers: {
      'xi-api-key': apiKey
    },
    signal
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || 'Unable to load voices from ElevenLabs');
  }

  const data = await response.json() as VoicesResponse;
  return data.voices ?? [];
};
