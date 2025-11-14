import React, { useMemo } from 'react';
import { ProjectSettings, ElevenLabsModel } from '../types';
import { LANGUAGE_OPTIONS } from '../config/voiceSuggestions';
import { KNOWN_ELEVENLABS_MODELS } from '../config/modelOptions';

interface ProjectSettingsPanelProps {
  settings: ProjectSettings;
  setSettings: (settings: ProjectSettings) => void;
  modelOptions: ElevenLabsModel[];
  modelsStatus: 'idle' | 'loading' | 'ready' | 'error';
}

// Implemented ProjectSettingsPanel to provide UI for project-level configurations.
const ProjectSettingsPanel: React.FC<ProjectSettingsPanelProps> = ({ settings, setSettings, modelOptions, modelsStatus }) => {
  const handleSettingChange = (field: keyof ProjectSettings, value: string | boolean) => {
    setSettings({ ...settings, [field]: value });
  };

  const availableModels = useMemo(() => {
    const merged = [...KNOWN_ELEVENLABS_MODELS];
    modelOptions.forEach(option => {
      if (!merged.find(model => model.model_id === option.model_id)) {
        merged.push(option);
      }
    });
    return merged;
  }, [modelOptions]);

  const selectedModel = availableModels.find(model => model.model_id === settings.model);

  return (
    <div className="bg-secondary p-4 rounded-lg shadow-lg">
      <h2 className="text-xl font-bold text-highlight mb-4">Step 2: Project Settings</h2>
      <div className="space-y-4">
        <div>
          <label htmlFor="model" className="block text-sm font-medium text-text-secondary mb-1">
            Voice Model
          </label>
          <select
            id="model"
            value={settings.model}
            onChange={(e) => handleSettingChange('model', e.target.value)}
            className="w-full p-2 bg-primary border border-accent rounded-md focus:outline-none focus:ring-2 focus:ring-highlight"
          >
            {availableModels.map(model => (
              <option key={model.model_id} value={model.model_id}>
                {model.name || model.model_id}
              </option>
            ))}
          </select>
          <p className="text-xs text-text-secondary mt-1">
            {modelsStatus === 'loading' && 'Loading ElevenLabs models…'}
            {modelsStatus === 'error' && 'Failed to load live model list; showing defaults.'}
            {modelsStatus === 'ready' && selectedModel?.description}
            {modelsStatus === 'idle' && 'Enter your API key to load the latest models.'}
          </p>
        </div>
        <div>
          <label htmlFor="output-format" className="block text-sm font-medium text-text-secondary mb-1">
            Output Format
          </label>
          <select
            id="output-format"
            value={settings.outputFormat}
            onChange={(e) => handleSettingChange('outputFormat', e.target.value)}
            className="w-full p-2 bg-primary border border-accent rounded-md focus:outline-none focus:ring-2 focus:ring-highlight"
          >
            <option value="mp3_44100_128">MP3 128kbps</option>
            <option value="mp3_44100_192">MP3 192kbps</option>
            <option value="pcm_24000">PCM 24kHz</option>
          </select>
        </div>
        <div>
          <label htmlFor="language-select" className="block text-sm font-medium text-text-secondary mb-1">
            Dialogue Language
          </label>
          <select
            id="language-select"
            value={settings.languageCode || 'en'}
            onChange={(e) => handleSettingChange('languageCode', e.target.value)}
            className="w-full p-2 bg-primary border border-accent rounded-md focus:outline-none focus:ring-2 focus:ring-highlight"
          >
            {LANGUAGE_OPTIONS.map(option => (
              <option key={option.code} value={option.code}>{option.label}</option>
            ))}
          </select>
          {settings.languageCode && settings.languageCode !== 'en' && settings.model !== 'eleven_multilingual_v2' && (
            <p className="text-xs text-yellow-300 mt-1">Tip: Non-English voices require Eleven Multilingual v2.</p>
          )}
        </div>
        <label htmlFor="concatenate" className="flex items-center justify-between cursor-pointer">
          <span className="text-sm font-medium text-text-secondary">Concatenate Audio</span>
          <span className="relative inline-flex items-center">
            <input 
              type="checkbox" 
              id="concatenate"
              checked={settings.concatenate}
              onChange={(e) => handleSettingChange('concatenate', e.target.checked)}
              className="sr-only peer" 
              aria-checked={settings.concatenate}
            />
            <span className="w-11 h-6 bg-primary peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-highlight rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-highlight" aria-hidden="true"></span>
          </span>
        </label>
        <label htmlFor="speak-parentheticals" className="flex items-center justify-between cursor-pointer">
          <span className="text-sm font-medium text-text-secondary">Speak Parentheticals</span>
          <span className="relative inline-flex items-center">
            <input 
              type="checkbox" 
              id="speak-parentheticals"
              checked={settings.speakParentheticals}
              onChange={(e) => handleSettingChange('speakParentheticals', e.target.checked)}
              className="sr-only peer" 
              aria-checked={settings.speakParentheticals}
            />
            <span className="w-11 h-6 bg-primary peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-highlight rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-highlight" aria-hidden="true"></span>
          </span>
        </label>
        <div>
          <label htmlFor="version-label" className="block text-sm font-medium text-text-secondary mb-1">
            Version Label
          </label>
          <input
            id="version-label"
            type="text"
            value={settings.versionLabel || ''}
            onChange={(e) => handleSettingChange('versionLabel', e.target.value)}
            placeholder="e.g. script_v3"
            className="w-full p-2 bg-primary border border-accent rounded-md focus:outline-none focus:ring-2 focus:ring-highlight text-sm"
          />
        </div>
      </div>
    </div>
  );
};

export default ProjectSettingsPanel;
