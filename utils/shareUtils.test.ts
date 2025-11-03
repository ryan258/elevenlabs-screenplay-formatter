import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { serializeConfig, deserializeConfig } from './shareUtils';
import { CharacterConfigs, ProjectSettings, SFX } from '../types';

describe('shareUtils', () => {
  const baseProjectSettings: ProjectSettings = {
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

  const baseCharacterConfigs: CharacterConfigs = {
    JOHN: {
      voiceId: 'voice_john',
      voiceSettings: { stability: 0.5, similarity_boost: 0.75, style: 0.1, speed: 1.0 },
    },
  };

  const baseSfxConfigs: SFX[] = [
    { keyword: 'THUNDER', url: 'https://example.com/thunder.mp3', volume: 0.8 },
  ];

  const sampleConfig = {
    scriptText: 'INT. ROOM - DAY',
    characterConfigs: baseCharacterConfigs,
    projectSettings: baseProjectSettings,
    sfxConfigs: baseSfxConfigs,
  };

  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('serializes and deserializes a project config', () => {
    const encoded = serializeConfig(sampleConfig);
    const decoded = deserializeConfig(encoded);

    expect(decoded).toEqual(sampleConfig);
  });

  it('returns null when decoding invalid payloads', () => {
    const decoded = deserializeConfig('not-base64!');
    expect(decoded).toBeNull();
  });

  it('handles corrupted encoded strings gracefully', () => {
    const encoded = serializeConfig(sampleConfig);
    const corrupted = `${encoded.slice(0, -2)}==`;
    const decoded = deserializeConfig(corrupted);
    expect(decoded).toBeNull();
  });
});
