import { describe, it, expect } from 'vitest';
import { generateElevenLabsScript, validateConfiguration } from './scriptGenerator';
import { CharacterConfigs, DialogueChunk, ProjectSettings } from '../types';

describe('scriptGenerator', () => {
  const chunks: DialogueChunk[] = [
    {
      character: 'JOHN',
      text: 'Hello there.',
      originalText: 'Hello there.',
    },
    {
      character: 'JANE',
      text: 'Welcome back!',
      originalText: 'Welcome back!',
    },
  ];

  const configs: CharacterConfigs = {
    JOHN: {
      voiceId: 'voice_john',
      voiceSettings: { stability: 0.4, similarity_boost: 0.7, style: 0.1, speed: 1.0 },
    },
    JANE: {
      voiceId: 'voice_jane',
      voiceSettings: { stability: 0.6, similarity_boost: 0.8, style: 0.2, speed: 1.1 },
    },
  };

  const projectSettings: ProjectSettings = {
    model: 'eleven_multilingual_v2',
    outputFormat: 'mp3_44100_128',
    concatenate: true,
    backgroundMusicUrl: undefined,
    pauseDuration: 0.5,
    generateSubtitles: true,
    subtitleFormat: 'srt',
    masteringPreset: 'none',
    multiTrackExport: false,
  };

  it('builds payloads and a bash script for configured characters', () => {
    const { jsonPayload, bashScript } = generateElevenLabsScript(chunks, configs, projectSettings, 'api-key');

    expect(jsonPayload).toHaveLength(2);
    expect(jsonPayload[0]).toMatchObject({
      character: 'JOHN',
      voice_id: 'voice_john',
      output_format: 'mp3_44100_128',
    });
    expect(bashScript).toContain('curl -X POST');
    expect(bashScript).toContain('Concatenating audio files');
  });

  it('filters out dialogue chunks without configured voices', () => {
    const partialConfigs: CharacterConfigs = {
      JOHN: configs.JOHN,
    };

    const { jsonPayload } = generateElevenLabsScript(chunks, partialConfigs, projectSettings, 'api-key');
    expect(jsonPayload).toHaveLength(1);
    expect(jsonPayload[0].character).toBe('JOHN');
  });

  it('validates configuration state and collects errors', () => {
    const missingConfig: CharacterConfigs = {};

    const resultEmpty = validateConfiguration([], missingConfig, '');
    expect(resultEmpty.valid).toBe(false);
    expect(resultEmpty.errors).toContain('API key is required');
    expect(resultEmpty.errors).toContain('No dialogue chunks found in script');

    const resultMissingVoices = validateConfiguration(chunks, missingConfig, 'api-key');
    expect(resultMissingVoices.valid).toBe(false);
    expect(resultMissingVoices.errors[0]).toMatch(/Missing voice IDs/);

    const resultValid = validateConfiguration(chunks, configs, 'api-key');
    expect(resultValid.valid).toBe(true);
    expect(resultValid.errors).toHaveLength(0);
  });
});
