import { ElevenLabsModel } from '../types';

export const KNOWN_ELEVENLABS_MODELS: ElevenLabsModel[] = [
  {
    model_id: 'eleven_multilingual_v2',
    name: 'Eleven Multilingual v2',
    description: 'Flagship high-quality model supporting 29 languages.'
  },
  {
    model_id: 'eleven_multilingual_v1',
    name: 'Eleven Multilingual v1',
    description: 'Legacy multilingual model, lighter than v2.'
  },
  {
    model_id: 'eleven_turbo_v2',
    name: 'Eleven Turbo v2',
    description: 'Low-latency multilingual model optimized for streaming.'
  },
  {
    model_id: 'eleven_turbo_v2_5',
    name: 'Eleven Turbo v2.5',
    description: 'Newest Turbo release (fast + expressive).'
  },
  {
    model_id: 'eleven_flash_v2',
    name: 'Eleven Flash v2',
    description: 'High-speed generation, great for drafts.'
  },
  {
    model_id: 'eleven_flash_v2_5',
    name: 'Eleven Flash v2.5',
    description: 'Updated Flash release with improved clarity.'
  },
  {
    model_id: 'eleven_monolingual_v1',
    name: 'Eleven Monolingual v1 (English)',
    description: 'Classic English-only model.'
  }
];

export const isMultilingualModelId = (modelId?: string) => {
  if (!modelId) {
    return true;
  }
  return !modelId.includes('monolingual');
};
