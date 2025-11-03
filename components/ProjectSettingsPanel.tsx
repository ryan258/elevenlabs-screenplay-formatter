import React, { useMemo } from 'react';
import { ProjectSettings } from '../types';

interface ProjectSettingsPanelProps {
  settings: ProjectSettings;
  setSettings: (settings: ProjectSettings) => void;
}

const MODEL_OPTIONS = [
  { value: 'eleven_multilingual_v2', label: 'Eleven Multilingual v2 (High quality, multilingual)' },
  { value: 'eleven_monolingual_v1', label: 'Eleven Monolingual v1 (High quality, English only)' },
  { value: 'eleven_multilingual_v1', label: 'Eleven Multilingual v1 (Legacy multilingual)' },
  { value: 'eleven_turbo_v2', label: 'Eleven Turbo v2 (Faster responses, multilingual)' },
];

// Implemented ProjectSettingsPanel to provide UI for project-level configurations.
const ProjectSettingsPanel: React.FC<ProjectSettingsPanelProps> = ({ settings, setSettings }) => {
  const handleSettingChange = (field: keyof ProjectSettings, value: string | boolean | number | undefined) => {
    setSettings({ ...settings, [field]: value });
  };

  const isCustomModel = useMemo(
    () => !MODEL_OPTIONS.some(option => option.value === settings.model),
    [settings.model]
  );

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
            value={isCustomModel ? 'custom' : settings.model}
            onChange={(e) => {
              const next = e.target.value;
              if (next !== 'custom') {
                handleSettingChange('model', next);
              }
            }}
            className="w-full p-2 bg-primary border border-accent rounded-md focus:outline-none focus:ring-2 focus:ring-highlight mb-2"
          >
            {MODEL_OPTIONS.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
            <option value="custom">Custom model ID…</option>
          </select>
          {isCustomModel && (
            <input
              type="text"
              value={settings.model}
              onChange={(e) => handleSettingChange('model', e.target.value)}
              placeholder="Enter ElevenLabs model id (e.g., eleven_flash_v2_5)"
              className="w-full p-2 bg-primary border border-accent rounded-md focus:outline-none focus:ring-2 focus:ring-highlight"
            />
          )}
          <p className="text-xs text-text-secondary mt-1">
            Don’t see your model? Choose “Custom” and paste the model id from the ElevenLabs docs or API.
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
            onChange={(e) => {
              const nextValue = e.target.value;
              handleSettingChange('pauseDuration', nextValue === '' ? undefined : parseFloat(nextValue));
            }}
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
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-text-secondary">Multi-Track Export</span>
          <label htmlFor="multi-track-export" className="relative inline-flex items-center cursor-pointer">
            <input 
              type="checkbox" 
              id="multi-track-export"
              checked={settings.multiTrackExport || false}
              onChange={(e) => handleSettingChange('multiTrackExport', e.target.checked)}
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
