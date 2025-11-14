import { ProjectSettings } from '../types';

export interface GenerationProfileDefinition {
  id: string;
  name: string;
  description: string;
  settings: Partial<ProjectSettings>;
  requestDelayMs?: number;
}

export const GENERATION_PROFILES: GenerationProfileDefinition[] = [
  {
    id: 'fast-draft',
    name: 'Fast Draft',
    description: 'Lower quality, quick iteration without concatenation.',
    settings: {
      model: 'eleven_monolingual_v1',
      outputFormat: 'mp3_44100_128',
      concatenate: false,
      speakParentheticals: false
    },
    requestDelayMs: 250
  },
  {
    id: 'high-quality',
    name: 'High Quality',
    description: 'Higher bitrate export suitable for demos.',
    settings: {
      model: 'eleven_multilingual_v2',
      outputFormat: 'mp3_44100_192',
      concatenate: false,
      speakParentheticals: true
    },
    requestDelayMs: 600
  },
  {
    id: 'concat-episode',
    name: 'Concatenated Episode',
    description: 'Optimized for long-form scripts with concatenated outputs.',
    settings: {
      concatenate: true,
      outputFormat: 'mp3_44100_192',
      speakParentheticals: false
    },
    requestDelayMs: 800
  }
];
