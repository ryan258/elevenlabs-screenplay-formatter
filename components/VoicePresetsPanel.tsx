import React, { useState } from 'react';
import { CharacterConfigs, VoicePresets } from '../types';

interface VoicePresetsPanelProps {
  characters: string[];
  characterConfigs: CharacterConfigs;
  voicePresets: VoicePresets;
  onSavePreset: (presetName: string, character: string) => void;
  onDeletePreset: (presetName: string) => void;
}

const VoicePresetsPanel: React.FC<VoicePresetsPanelProps> = ({
  characters,
  characterConfigs,
  voicePresets,
  onSavePreset,
  onDeletePreset
}) => {
  const [presetName, setPresetName] = useState('');
  const [sourceCharacter, setSourceCharacter] = useState('');

  const handleSave = () => {
    if (!presetName.trim() || !sourceCharacter || !characterConfigs[sourceCharacter]) {
      return;
    }
    onSavePreset(presetName.trim(), sourceCharacter);
    setPresetName('');
  };

  return (
    <div className="bg-secondary p-4 rounded-lg shadow-lg">
      <h2 className="text-xl font-bold text-highlight mb-3">Voice Presets</h2>
      <div className="space-y-2 mb-3">
        <input
          type="text"
          value={presetName}
          onChange={(e) => setPresetName(e.target.value)}
          placeholder="Preset name (e.g. Narrator)"
          className="w-full p-2 bg-primary border border-accent rounded-md focus:outline-none focus:ring-2 focus:ring-highlight text-sm"
        />
        <select
          value={sourceCharacter}
          onChange={(e) => setSourceCharacter(e.target.value)}
          className="w-full p-2 bg-primary border border-accent rounded-md focus:outline-none focus:ring-2 focus:ring-highlight text-sm"
        >
          <option value="">Select source character</option>
          {characters.map(char => (
            <option key={char} value={char}>{char}</option>
          ))}
        </select>
        <button
          onClick={handleSave}
          disabled={!presetName.trim() || !sourceCharacter}
          className="w-full py-2 bg-accent hover:bg-highlight rounded-md text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-highlight disabled:opacity-60"
        >
          Save Preset
        </button>
      </div>
      <div className="max-h-40 overflow-y-auto custom-scrollbar">
        {Object.keys(voicePresets).length === 0 ? (
          <p className="text-xs text-text-secondary">No presets saved yet.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {Object.entries(voicePresets).map(([name]) => (
              <li key={name} className="flex items-center justify-between">
                <span>{name}</span>
                <button
                  onClick={() => onDeletePreset(name)}
                  className="text-xs text-red-300 hover:text-red-200"
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default VoicePresetsPanel;
