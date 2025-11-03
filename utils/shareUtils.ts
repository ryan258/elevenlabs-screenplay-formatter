import { CharacterConfigs, ProjectSettings, SFX } from '../types';

interface ProjectConfig {
  scriptText: string;
  characterConfigs: CharacterConfigs;
  projectSettings: ProjectSettings;
  sfxConfigs: SFX[];
}

export const serializeConfig = (config: ProjectConfig): string => {
  const jsonString = JSON.stringify(config);
  return btoa(encodeURIComponent(jsonString));
};

export const deserializeConfig = (encodedString: string): ProjectConfig | null => {
  try {
    const jsonString = decodeURIComponent(atob(encodedString));
    return JSON.parse(jsonString);
  } catch (error) {
    console.error('Error deserializing config:', error);
    return null;
  }
};
