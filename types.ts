export interface DialogueChunk {
  character: string;
  text: string;
  originalText?: string;
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
}

export interface AppStateSnapshot {
  apiKey?: string;
  projectSettings: ProjectSettings;
  characterConfigs: CharacterConfigs;
  scriptText?: string;
  rememberApiKey?: boolean;
}

export interface GeneratedBlob {
  blob: Blob;
  filename: string;
}

export interface ResumeInfo {
  index: number;
  character: string;
}

export interface ParserDiagnostics {
  unmatchedLines: Array<{ lineNumber: number; content: string }>;
}
