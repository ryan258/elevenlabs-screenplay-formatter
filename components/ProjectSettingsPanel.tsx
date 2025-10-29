import React from 'react';
import { ProjectSettings } from '../types';

interface ProjectSettingsPanelProps {
  settings: ProjectSettings;
  setSettings: (settings: ProjectSettings) => void;
}

// Implemented ProjectSettingsPanel to provide UI for project-level configurations.
const ProjectSettingsPanel: React.FC<ProjectSettingsPanelProps> = ({ settings, setSettings }) => {
  const handleSettingChange = (field: keyof ProjectSettings, value: string | boolean) => {
    setSettings({ ...settings, [field]: value });
  };

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
            <option value="eleven_multilingual_v2">Eleven Multilingual v2</option>
            <option value="eleven_monolingual_v1">Eleven Monolingual v1</option>
          </select>
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
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-text-secondary">Concatenate Audio</span>
          <label htmlFor="concatenate" className="relative inline-flex items-center cursor-pointer">
            <input 
              type="checkbox" 
              id="concatenate"
              checked={settings.concatenate}
              onChange={(e) => handleSettingChange('concatenate', e.target.checked)}
              className="sr-only peer" 
            />
            <div className="w-11 h-6 bg-primary peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-highlight rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-highlight"></div>
          </label>
        </div>
      </div>
    </div>
  );
};

export default ProjectSettingsPanel;
