import { ElevenLabsModel, ElevenLabsVoice } from '../types';

interface VoicesResponse {
  voices?: ElevenLabsVoice[];
}

interface ModelsResponse {
  models?: ElevenLabsModel[];
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

export const fetchElevenLabsModels = async (apiKey: string, signal?: AbortSignal): Promise<ElevenLabsModel[]> => {
  if (!apiKey) {
    return [];
  }

  const response = await fetch('https://api.elevenlabs.io/v1/models', {
    method: 'GET',
    headers: {
      'xi-api-key': apiKey
    },
    signal
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || 'Unable to load models from ElevenLabs');
  }

  const data = await response.json() as ModelsResponse;
  return data.models ?? [];
};
