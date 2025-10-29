export interface DialogueChunk {
  character: string;
  text: string;
}

export interface VoiceSettings {
  stability: number;
  similarity_boost: number;
  style: number;
  speed: number;
}

export interface CharacterConfig {
  voiceId: string;
  voiceSettings: VoiceSettings;
}

export interface CharacterConfigs {
  [character: string]: CharacterConfig;
}

export interface ProjectSettings {
  model: string;
  outputFormat: string;
  concatenate: boolean;
}
