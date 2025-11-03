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
            <option value="ulaw_8000">Mulaw 8kHz</option>
            <option value="pcm_16000">PCM 16kHz</option>
            <option value="pcm_8000">PCM 8kHz</option>
            <option value="wav_44100">WAV 44.1kHz</option>
            <option value="ogg_44100">OGG 44.1kHz</option>
            <option value="flac_44100">FLAC 44.1kHz</option>
          </select>
        </div>
        <div>
          <label htmlFor="background-music-url" className="block text-sm font-medium text-text-secondary mb-1">
            Background Music URL (Optional)
          </label>
          <input
            id="background-music-url"
            type="text"
            value={settings.backgroundMusicUrl || ''}
            onChange={(e) => handleSettingChange('backgroundMusicUrl', e.target.value)}
            placeholder="e.g., https://example.com/music.mp3"
            className="w-full p-2 bg-primary border border-accent rounded-md focus:outline-none focus:ring-2 focus:ring-highlight"
          />
        </div>
        <div>
          <label htmlFor="pause-duration" className="block text-sm font-medium text-text-secondary mb-1">
            Pause Duration between lines (seconds)
          </label>
          <input
            id="pause-duration"
            type="number"
            min="0"
            step="0.1"
            value={settings.pauseDuration || 0}
            onChange={(e) => handleSettingChange('pauseDuration', parseFloat(e.target.value))}
            placeholder="e.g., 0.5"
            className="w-full p-2 bg-primary border border-accent rounded-md focus:outline-none focus:ring-2 focus:ring-highlight"
          />
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
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-text-secondary">Generate Subtitles</span>
          <label htmlFor="generate-subtitles" className="relative inline-flex items-center cursor-pointer">
            <input 
              type="checkbox" 
              id="generate-subtitles"
              checked={settings.generateSubtitles || false}
              onChange={(e) => handleSettingChange('generateSubtitles', e.target.checked)}
              className="sr-only peer" 
            />
            <div className="w-11 h-6 bg-primary peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-highlight rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-highlight"></div>
          </label>
        </div>
        {settings.generateSubtitles && (
          <div>
            <label htmlFor="subtitle-format" className="block text-sm font-medium text-text-secondary mb-1">
              Subtitle Format
            </label>
            <select
              id="subtitle-format"
              value={settings.subtitleFormat || 'srt'}
              onChange={(e) => handleSettingChange('subtitleFormat', e.target.value as 'srt' | 'vtt')}
              className="w-full p-2 bg-primary border border-accent rounded-md focus:outline-none focus:ring-2 focus:ring-highlight"
            >
              <option value="srt">SRT</option>
              <option value="vtt">VTT</option>
            </select>
          </div>
        )}
        <div>
          <label htmlFor="mastering-preset" className="block text-sm font-medium text-text-secondary mb-1">
            Mastering Preset (Optional)
          </label>
          <select
            id="mastering-preset"
            value={settings.masteringPreset || 'none'}
            onChange={(e) => handleSettingChange('masteringPreset', e.target.value)}
            className="w-full p-2 bg-primary border border-accent rounded-md focus:outline-none focus:ring-2 focus:ring-highlight"
          >
            <option value="none">None</option>
            <option value="podcast">Podcast</option>
            <option value="film_dialogue">Film Dialogue</option>
            <option value="broadcast">Broadcast</option>
          </select>
        </div>
      </div>
    </div>
  );
};

export default ProjectSettingsPanel;
