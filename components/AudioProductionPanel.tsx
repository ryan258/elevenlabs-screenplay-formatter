import React from 'react';
import { AudioProductionSettings, SoundEffectSettings } from '../types';

interface AudioProductionPanelProps {
  audioProduction: AudioProductionSettings;
  onChange: (updater: (prev: AudioProductionSettings) => AudioProductionSettings) => void;
}

const formatTime = (ms: number) => {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const parts = [
    hours > 0 ? hours.toString().padStart(2, '0') : null,
    minutes.toString().padStart(2, '0'),
    seconds.toString().padStart(2, '0')
  ].filter(Boolean);
  return parts.join(':');
};

const parseTime = (value: string) => {
  const segments = value.split(':').map(part => Number(part.trim()));
  if (segments.some(segment => Number.isNaN(segment))) {
    return 0;
  }
  let seconds = 0;
  if (segments.length === 3) {
    seconds = segments[0] * 3600 + segments[1] * 60 + segments[2];
  } else if (segments.length === 2) {
    seconds = segments[0] * 60 + segments[1];
  } else {
    seconds = segments[0];
  }
  return Math.max(0, seconds * 1000);
};

const createSoundEffect = (): SoundEffectSettings => ({
  id: crypto.randomUUID ? crypto.randomUUID() : `sfx-${Date.now()}`,
  label: 'New SFX',
  startTimeMs: 0,
  volume: 1,
  file: undefined,
  filename: undefined
});

const AudioProductionPanel: React.FC<AudioProductionPanelProps> = ({ audioProduction, onChange }) => {
  const handleBackgroundFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    onChange(prev => ({
      ...prev,
      backgroundTrack: file
        ? {
            volume: prev.backgroundTrack?.volume ?? 0.35,
            file,
            filename: file.name
          }
        : prev.backgroundTrack
          ? { ...prev.backgroundTrack, file: undefined, filename: undefined }
          : undefined
    }));
  };

  const handleBackgroundVolume = (value: number) => {
    onChange(prev => ({
      ...prev,
      backgroundTrack: {
        volume: value,
        file: prev.backgroundTrack?.file,
        filename: prev.backgroundTrack?.filename
      }
    }));
  };

  const addSoundEffect = () => {
    onChange(prev => ({
      ...prev,
      soundEffects: [...prev.soundEffects, createSoundEffect()]
    }));
  };

  const updateSoundEffect = (id: string, updates: Partial<SoundEffectSettings>) => {
    onChange(prev => ({
      ...prev,
      soundEffects: prev.soundEffects.map(effect =>
        effect.id === id ? { ...effect, ...updates } : effect
      )
    }));
  };

  const removeSoundEffect = (id: string) => {
    onChange(prev => ({
      ...prev,
      soundEffects: prev.soundEffects.filter(effect => effect.id !== id)
    }));
  };

  return (
    <div className="bg-secondary p-4 rounded-lg shadow-lg">
      <h2 className="text-xl font-bold text-highlight mb-3">Audio Production</h2>
      <p className="text-xs text-text-secondary mb-4">
        Optional: upload a background music track and timed sound effects. Files are kept locally and sent with concatenation requests—they won&#39;t persist after refresh.
      </p>
      <div className="space-y-3 mb-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-text-secondary">Background Music</span>
          {audioProduction.backgroundTrack?.filename && (
            <span className="text-xs text-text-secondary">{audioProduction.backgroundTrack.filename}</span>
          )}
        </div>
        <input
          type="file"
          accept="audio/*"
          onChange={handleBackgroundFile}
          className="w-full text-xs text-text-secondary"
        />
        <label className="text-xs text-text-secondary flex items-center justify-between">
          Volume
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={audioProduction.backgroundTrack?.volume ?? 0.35}
            onChange={(e) => handleBackgroundVolume(parseFloat(e.target.value))}
            className="w-2/3 accent-highlight"
          />
        </label>
      </div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-lg font-semibold text-highlight">Sound Effects</h3>
        <button
          onClick={addSoundEffect}
          className="text-xs px-3 py-1 bg-accent hover:bg-highlight rounded-md focus:outline-none focus:ring-2 focus:ring-highlight"
        >
          Add SFX
        </button>
      </div>
      {audioProduction.soundEffects.length === 0 && (
        <p className="text-xs text-text-secondary mb-3">No sound effects yet.</p>
      )}
      <div className="space-y-3 max-h-60 overflow-y-auto custom-scrollbar pr-2">
        {audioProduction.soundEffects.map(effect => (
          <div key={effect.id} className="p-3 bg-primary border border-accent rounded-md space-y-2">
            <div className="flex items-center justify-between">
              <input
                type="text"
                value={effect.label}
                onChange={(e) => updateSoundEffect(effect.id, { label: e.target.value })}
                className="flex-1 mr-2 p-2 bg-secondary border border-accent rounded-md text-sm"
                placeholder="Label"
              />
              <button
                onClick={() => removeSoundEffect(effect.id)}
                className="text-xs text-red-300 hover:text-red-100"
              >
                Remove
              </button>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-text-secondary flex-1">
                Start Time (mm:ss)
                <input
                  type="text"
                  value={formatTime(effect.startTimeMs)}
                  onChange={(e) => updateSoundEffect(effect.id, { startTimeMs: parseTime(e.target.value) })}
                  className="mt-1 w-full p-2 bg-secondary border border-accent rounded-md text-sm"
                />
              </label>
              <label className="text-xs text-text-secondary flex-1">
                Volume
                <input
                  type="range"
                  min={0}
                  max={1.5}
                  step={0.05}
                  value={effect.volume}
                  onChange={(e) => updateSoundEffect(effect.id, { volume: parseFloat(e.target.value) })}
                  className="w-full mt-2 accent-highlight"
                />
              </label>
            </div>
            <div className="text-xs text-text-secondary">
              <input
                type="file"
                accept="audio/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  updateSoundEffect(effect.id, {
                    file,
                    filename: file?.name
                  });
                }}
              />
              {effect.filename && (
                <p className="mt-1 text-text-secondary">Attached: {effect.filename}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AudioProductionPanel;
