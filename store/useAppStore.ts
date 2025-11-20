import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { AudioProductionSettings, CharacterConfigs, ElevenLabsModel, ElevenLabsVoice, ManifestEntry, ProjectSettings, ResumeInfo, VoicePresets } from '../types';
import { SerializedGeneratedBlob } from '../utils/blobSerialization';

const STORAGE_KEY = 'elevenlabs_formatter_state_v2';
const MAX_PROGRESS_MESSAGES = 200;
const defaultProjectSettings: ProjectSettings = {
  model: 'eleven_multilingual_v2',
  outputFormat: 'mp3_44100_128',
  concatenate: true,
  speakParentheticals: false,
  profileId: undefined,
  requestDelayMs: 500,
  versionLabel: '',
  languageCode: 'en'
};

const defaultProgress = { current: 0, total: 0, character: '', snippet: '' };
const generateId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2, 10);
};

interface AppStoreState {
  scriptText: string;
  setScriptText: (value: string) => void;
  apiKey: string;
  setApiKey: (value: string) => void;
  rememberApiKey: boolean;
  setRememberApiKey: (value: boolean) => void;
  projectSettings: ProjectSettings;
  setProjectSettings: (updater: ProjectSettings | ((prev: ProjectSettings) => ProjectSettings)) => void;
  characterConfigs: CharacterConfigs;
  setCharacterConfigs: (configs: CharacterConfigs | ((prev: CharacterConfigs) => CharacterConfigs)) => void;
  voicePresets: VoicePresets;
  setVoicePresets: (presets: VoicePresets | ((prev: VoicePresets) => VoicePresets)) => void;
  audioProduction: AudioProductionSettings;
  setAudioProduction: (updater: AudioProductionSettings | ((prev: AudioProductionSettings) => AudioProductionSettings)) => void;

  generatedOutput: string;
  setGeneratedOutput: (value: string) => void;
  isGenerating: boolean;
  setIsGenerating: (value: boolean) => void;

  progressMessages: string[];
  setProgressMessages: (messages: string[]) => void;
  appendProgressMessages: (messages: string | string[]) => void;

  resumeInfo: ResumeInfo | null;
  setResumeInfo: (info: ResumeInfo | null) => void;
  serializedPendingBlobs: SerializedGeneratedBlob[];
  setPendingBlobsSerialized: (blobs: SerializedGeneratedBlob[]) => void;
  serializedLastGeneratedBlobs: SerializedGeneratedBlob[];
  setLastGeneratedBlobsSerialized: (blobs: SerializedGeneratedBlob[]) => void;

  manifestEntries: ManifestEntry[];
  setManifestEntries: (entries: ManifestEntry[]) => void;

  currentProgress: { current: number; total: number; character: string; snippet: string };
  setCurrentProgress: (progress: { current: number; total: number; character: string; snippet: string }) => void;

  errorInfo: string | null;
  setErrorInfo: (value: string | null) => void;

  concatStatus: 'unknown' | 'checking' | 'online' | 'offline';
  setConcatStatus: (status: 'unknown' | 'checking' | 'online' | 'offline') => void;

  hasHydrated: boolean;
  setHasHydrated: (value: boolean) => void;

  clearGenerationState: () => void;

  toasts: Array<{ id: string; message: string; tone: 'info' | 'success' | 'error' }>;
  addToast: (message: string, tone?: 'info' | 'success' | 'error') => void;
  removeToast: (id: string) => void;
  availableVoices: ElevenLabsVoice[];
  setAvailableVoices: (voices: ElevenLabsVoice[]) => void;
  voicesStatus: 'idle' | 'loading' | 'ready' | 'error';
  setVoicesStatus: (status: 'idle' | 'loading' | 'ready' | 'error') => void;
  availableModels: ElevenLabsModel[];
  setAvailableModels: (models: ElevenLabsModel[]) => void;
  modelsStatus: 'idle' | 'loading' | 'ready' | 'error';
  setModelsStatus: (status: 'idle' | 'loading' | 'ready' | 'error') => void;
}

const limitMessages = (messages: string[]) => {
  return messages.length > MAX_PROGRESS_MESSAGES ? messages.slice(-MAX_PROGRESS_MESSAGES) : messages;
};

const storage = typeof window !== 'undefined'
  ? createJSONStorage(() => window.localStorage)
  : undefined;

export const useAppStore = create<AppStoreState>()(
  persist(
    (set) => ({
      scriptText: '',
      setScriptText: (value) => set({ scriptText: value }),
      apiKey: '',
      setApiKey: (value) => set({ apiKey: value }),
      rememberApiKey: true,
      setRememberApiKey: (value) => set({ rememberApiKey: value }),
      projectSettings: defaultProjectSettings,
      setProjectSettings: (updater) => set(state => ({
        projectSettings: typeof updater === 'function' ? (updater as (prev: ProjectSettings) => ProjectSettings)(state.projectSettings) : updater
      })),
      characterConfigs: {},
      setCharacterConfigs: (configs) => set(state => ({
        characterConfigs: typeof configs === 'function'
          ? (configs as (prev: CharacterConfigs) => CharacterConfigs)(state.characterConfigs)
          : configs
      })),
      voicePresets: {},
      setVoicePresets: (presets) => set(state => ({
        voicePresets: typeof presets === 'function'
          ? (presets as (prev: VoicePresets) => VoicePresets)(state.voicePresets)
          : presets
      })),
      audioProduction: { soundEffects: [] },
      setAudioProduction: (updater) => set(state => ({
        audioProduction: typeof updater === 'function'
          ? (updater as (prev: AudioProductionSettings) => AudioProductionSettings)(state.audioProduction)
          : updater
      })),

      generatedOutput: '',
      setGeneratedOutput: (value) => set({ generatedOutput: value }),
      isGenerating: false,
      setIsGenerating: (value) => set({ isGenerating: value }),

      progressMessages: [],
      setProgressMessages: (messages) => set({ progressMessages: limitMessages(messages) }),
      appendProgressMessages: (messages) => set(state => {
        const incoming = Array.isArray(messages) ? messages : [messages];
        return { progressMessages: limitMessages([...state.progressMessages, ...incoming]) };
      }),

      resumeInfo: null,
      setResumeInfo: (info) => set({ resumeInfo: info }),
      serializedPendingBlobs: [],
      setPendingBlobsSerialized: (blobs) => set({ serializedPendingBlobs: blobs }),
      serializedLastGeneratedBlobs: [],
      setLastGeneratedBlobsSerialized: (blobs) => set({ serializedLastGeneratedBlobs: blobs }),

      manifestEntries: [],
      setManifestEntries: (entries) => set({ manifestEntries: entries }),

      currentProgress: defaultProgress,
      setCurrentProgress: (progress) => set({ currentProgress: progress }),

      errorInfo: null,
      setErrorInfo: (value) => set({ errorInfo: value }),

      concatStatus: 'unknown',
      setConcatStatus: (status) => set({ concatStatus: status }),

      hasHydrated: false,
      setHasHydrated: (value) => set({ hasHydrated: value }),

      clearGenerationState: () => {
        set({
          progressMessages: [],
          generatedOutput: '',
          resumeInfo: null,
          serializedPendingBlobs: [],
          serializedLastGeneratedBlobs: [],
          manifestEntries: [],
          currentProgress: defaultProgress,
          errorInfo: null
        });
      },

      toasts: [],
      addToast: (message, tone = 'info') => {
        const id = generateId();
        set(state => ({ toasts: [...state.toasts, { id, message, tone }] }));
        setTimeout(() => {
          set(state => ({ toasts: state.toasts.filter(toast => toast.id !== id) }));
        }, 4000);
      },
      removeToast: (id) => set(state => ({ toasts: state.toasts.filter(toast => toast.id !== id) })),

      availableVoices: [],
      voicesStatus: 'idle',
      setAvailableVoices: (voices) => set({ availableVoices: voices }),
      setVoicesStatus: (status) => set({ voicesStatus: status }),

      availableModels: [],
      modelsStatus: 'idle',
      setAvailableModels: (models) => set({ availableModels: models }),
      setModelsStatus: (status) => set({ modelsStatus: status })
    }),
    {
      name: STORAGE_KEY,
      storage,
      version: 2,
      migrate: (persisted, version) => {
        if (!persisted) {
          return persisted;
        }
        if (version < 2) {
          delete (persisted as Partial<AppStoreState>).serializedPendingBlobs;
          delete (persisted as Partial<AppStoreState>).serializedLastGeneratedBlobs;
        }
        return persisted;
      },
      partialize: (state) => ({
        scriptText: state.scriptText,
        apiKey: state.rememberApiKey ? state.apiKey : '',
        rememberApiKey: state.rememberApiKey,
        projectSettings: state.projectSettings,
        characterConfigs: state.characterConfigs,
        voicePresets: state.voicePresets,
        audioProduction: {
          backgroundTrack: state.audioProduction.backgroundTrack
            ? { ...state.audioProduction.backgroundTrack, file: undefined }
            : undefined,
          soundEffects: state.audioProduction.soundEffects.map(effect => ({
            ...effect,
            file: undefined
          }))
        },
        generatedOutput: state.generatedOutput,
        progressMessages: state.progressMessages,
        resumeInfo: state.resumeInfo,
        manifestEntries: state.manifestEntries,
        currentProgress: state.currentProgress,
        errorInfo: state.errorInfo,
        concatStatus: state.concatStatus,
        availableModels: state.availableModels,
        availableVoices: state.availableVoices
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      }
    }
  )
);

export default useAppStore;
