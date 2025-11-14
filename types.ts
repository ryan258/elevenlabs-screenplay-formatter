export interface WordTimestamp {
  word: string;
  startMs: number;
  endMs: number;
}

export interface DialogueChunk {
  character: string;
  text: string;
  originalText?: string;
  startTimeMs?: number;
  endTimeMs?: number;
  words?: WordTimestamp[];
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
  speakParentheticals: boolean;
  profileId?: string;
  requestDelayMs?: number;
  versionLabel?: string;
  languageCode?: string;
}

export interface AppStateSnapshot {
  apiKey?: string;
  projectSettings: ProjectSettings;
  characterConfigs: CharacterConfigs;
  scriptText?: string;
  rememberApiKey?: boolean;
  voicePresets?: VoicePresets;
}

export interface GeneratedBlob {
  blob: Blob;
  filename: string;
  startTimeMs?: number;
  endTimeMs?: number;
  alignment?: WordTimestamp[];
}

export interface ResumeInfo {
  index: number;
  character: string;
}

export interface ParserDiagnostics {
  unmatchedLines: Array<{ lineNumber: number; content: string }>;
}

export interface ProjectConfig {
  version: string;
  scriptText: string;
  characterConfigs: CharacterConfigs;
  projectSettings: ProjectSettings;
  voicePresets?: VoicePresets;
  audioProduction?: PersistedAudioProductionSettings;
  metadata?: {
    name?: string;
    description?: string;
  };
}

export type VoicePresets = Record<string, CharacterConfig>;

export interface BackgroundTrackSettings {
  volume: number;
  file?: File | null;
  filename?: string;
}

export interface SoundEffectSettings {
  id: string;
  label: string;
  startTimeMs: number;
  volume: number;
  file?: File | null;
  filename?: string;
}

export interface AudioProductionSettings {
  backgroundTrack?: BackgroundTrackSettings;
  soundEffects: SoundEffectSettings[];
}

export interface PersistedAudioProductionSettings {
  backgroundTrack?: Omit<BackgroundTrackSettings, 'file'>;
  soundEffects: Array<Omit<SoundEffectSettings, 'file'>>;
}

export interface ManifestEntry {
  index: number;
  character: string;
  filename: string;
  text: string;
  estimatedDurationMs: number;
  startTimeMs?: number;
  endTimeMs?: number;
  words?: WordTimestamp[];
}
