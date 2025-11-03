export interface ProjectState {
  timestamp: number;
  scriptText: string;
  characterConfigs: CharacterConfigs;
  projectSettings: ProjectSettings;
  sfxConfigs: SFX[];
}

export interface GenerationStat {
  timestamp: number;
  scriptLength: number;
  characterCount: number;
  estimatedCost: number;
  duration: number;
  status: 'success' | 'error' | 'cancelled';
}

export interface Voice {
  voice_id: string;
  name: string;
  category: string;
}

export interface DialogueChunk {
  character: string;
  text: string;
  originalText: string;
  emotion?: string;
  startTime?: number;
  endTime?: number;
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

export interface SFX {
  keyword: string;
  url: string;
  volume: number;
}

export interface ProjectSettings {
  model: string;
  outputFormat: string;
  concatenate: boolean;
  backgroundMusicUrl?: string;
  pauseDuration?: number;
  generateSubtitles?: boolean;
  subtitleFormat?: 'srt' | 'vtt';
  masteringPreset?: string;
  multiTrackExport?: boolean;
}
