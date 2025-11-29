import React, { useMemo, useState } from 'react';
import { FixedSizeList as List, ListChildComponentProps } from 'react-window';
import { CharacterConfigs, CharacterConfig, VoicePresets, VoiceSettings } from '../types';
import Slider from './Slider';

interface CharacterConfigPanelProps {
  characters: string[];
  configs: CharacterConfigs;
  setConfigs: (configs: CharacterConfigs) => void;
  voicePresets: VoicePresets;
  onApplyPresetToCharacter: (presetName: string, character: string) => void;
  onApplyPresetToAll: (presetName: string) => void;
  onAutoFill: () => void;
}

const makeId = (character: string, prefix: string) =>
  `${prefix}-${character.replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase()}`;

const CharacterConfigPanel: React.FC<CharacterConfigPanelProps> = ({
  characters,
  configs,
  setConfigs,
  voicePresets,
  onApplyPresetToCharacter,
  onApplyPresetToAll,
  onAutoFill
}) => {
  const [search, setSearch] = useState('');
  const [presetCharacter, setPresetCharacter] = useState('');
  const [applyPresetName, setApplyPresetName] = useState('');

  const filteredCharacters = useMemo(() => {
    if (!search.trim()) {
      return characters;
    }
    return characters.filter(char => char.toLowerCase().includes(search.trim().toLowerCase()));
  }, [characters, search]);

  const presetNames = useMemo(() => Object.keys(voicePresets), [voicePresets]);

  const handleConfigChange = <K extends keyof CharacterConfig>(character: string, field: K, value: CharacterConfig[K]) => {
    const newConfig: CharacterConfig = {
      ...(configs[character] || {
        voiceId: '',
        voiceSettings: { stability: 0.5, similarity_boost: 0.75, style: 0.1, speed: 1.0 }
      }),
      [field]: value,
    };

    setConfigs({
      ...configs,
      [character]: newConfig,
    });
  };

  const handleSliderChange = (character: string, field: keyof VoiceSettings, value: string) => {
    const voiceSettings = configs[character]?.voiceSettings || { stability: 0.5, similarity_boost: 0.75, style: 0.1, speed: 1.0 };
    const newVoiceSettings: VoiceSettings = {
      ...voiceSettings,
      [field]: parseFloat(value),
    };
    handleConfigChange(character, 'voiceSettings', newVoiceSettings);
  };

  if (characters.length === 0) {
    return (
      <div className="bg-secondary p-4 rounded-lg shadow-lg h-full flex items-center justify-center">
        <p className="text-text-secondary text-center">Characters from your script will appear here once you start typing.</p>
      </div>
    );
  }

  return (
    <div className="bg-secondary p-4 rounded-lg shadow-lg h-full flex flex-col">
      <h2 className="text-xl font-bold text-highlight mb-4">Step 0: Character Voices</h2>
      <div className="flex flex-col gap-2 mb-4">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search characters..."
          className="w-full p-2 bg-primary border border-accent rounded-md focus:outline-none focus:ring-2 focus:ring-highlight text-sm"
        />
        <div className="flex flex-col md:flex-row md:items-center md:space-x-3 text-xs text-text-secondary">
          <div className="flex-1 flex items-center space-x-2">
            <label htmlFor="preset-character" className="whitespace-nowrap">Copy from character:</label>
            <select
              id="preset-character"
              value={presetCharacter}
              onChange={(e) => setPresetCharacter(e.target.value)}
              className="flex-1 p-2 bg-primary border border-accent rounded-md focus:outline-none focus:ring-2 focus:ring-highlight text-sm"
            >
              <option value="">Select character</option>
              {characters.filter(char => configs[char]?.voiceId).map(char => (
                <option key={char} value={char}>{char}</option>
              ))}
            </select>
          </div>
          <button
            onClick={() => {
              const source = presetCharacter && configs[presetCharacter];
              if (!source) {
                return;
              }
              const nextConfigs: CharacterConfigs = {};
              characters.forEach(char => {
                nextConfigs[char] = {
                  voiceId: source.voiceId,
                  voiceSettings: { ...source.voiceSettings }
                };
              });
              setConfigs(nextConfigs);
            }}
            disabled={!presetCharacter || !configs[presetCharacter]}
            className="mt-2 md:mt-0 px-3 py-1.5 bg-accent hover:bg-highlight rounded-md font-semibold text-white disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-highlight"
          >
            Apply to all
          </button>
        </div>
        <div className="flex flex-col md:flex-row md:items-center md:space-x-3 text-xs text-text-secondary mt-2">
          <div className="flex-1 flex items-center space-x-2">
            <label htmlFor="preset-name" className="whitespace-nowrap">Apply saved preset:</label>
            <select
              id="preset-name"
              value={applyPresetName}
              onChange={(e) => setApplyPresetName(e.target.value)}
              className="flex-1 p-2 bg-primary border border-accent rounded-md focus:outline-none focus:ring-2 focus:ring-highlight text-sm"
            >
              <option value="">Select preset</option>
              {presetNames.map(name => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </div>
          <button
            onClick={() => applyPresetName && onApplyPresetToAll(applyPresetName)}
            disabled={!applyPresetName || !voicePresets[applyPresetName]}
            className="mt-2 md:mt-0 px-3 py-1.5 bg-accent hover:bg-highlight rounded-md font-semibold text-white disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-highlight"
          >
            Apply preset to all
          </button>
        </div>
        <div className="flex justify-end mt-2">
          <button
            onClick={onAutoFill}
            className="px-3 py-1.5 bg-accent hover:bg-highlight rounded-md font-semibold text-white text-xs focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-highlight"
            title="Extract Voice IDs from character list in script"
          >
            Auto-fill Voice IDs
          </button>
        </div>
      </div>
      <div className="flex-grow overflow-hidden">
        {filteredCharacters.length === 0 ? (
          <div className="p-3 border bg-primary border-accent rounded-md text-center text-text-secondary">
            No characters match “{search}”.
          </div>
        ) : (
          <List
            height={Math.min(520, filteredCharacters.length * 260)}
            itemCount={filteredCharacters.length}
            itemSize={260}
            width="100%"
            className="custom-scrollbar pr-2"
          >
            {({ index, style }: ListChildComponentProps) => {
              const char = filteredCharacters[index];
              const config = configs[char] || { voiceId: '', voiceSettings: { stability: 0.5, similarity_boost: 0.75, style: 0.1, speed: 1.0 } };
              const voiceId = makeId(char, 'voice-id');
              const stabilityId = makeId(char, 'stability');
              const similarityId = makeId(char, 'similarity');
              const styleId = makeId(char, 'style');
              const speedId = makeId(char, 'speed');
              return (
                <div style={style} className="pr-3">
                  <div className="p-3 border bg-primary border-accent rounded-md flex flex-col space-y-3 h-full">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-text-primary truncate">{char}</h3>
                      {!config.voiceId && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-red-600 text-white">No Voice ID</span>
                      )}
                    </div>
                    {presetNames.length > 0 && (
                      <div className="flex items-center space-x-2">
                        <select
                          value=""
                          onChange={(e) => {
                            const preset = e.target.value;
                            if (preset) {
                              onApplyPresetToCharacter(preset, char);
                            }
                          }}
                          className="flex-1 p-2 bg-secondary border border-accent rounded-md focus:outline-none focus:ring-2 focus:ring-highlight text-xs"
                        >
                          <option value="">Apply preset…</option>
                          {presetNames.map(name => (
                            <option key={name} value={name}>{name}</option>
                          ))}
                        </select>
                      </div>
                    )}
                    <div>
                      <label htmlFor={voiceId} className="block text-sm font-medium text-text-secondary mb-1">
                        Voice ID
                      </label>
                      <input
                        id={voiceId}
                        type="text"
                        value={config.voiceId}
                        onChange={(e) => handleConfigChange(char, 'voiceId', e.target.value)}
                        placeholder="Enter Voice ID"
                        className="w-full p-2 bg-secondary border border-accent rounded-md focus:outline-none focus:ring-2 focus:ring-highlight"
                      />
                    </div>
                    <div className="space-y-2">
                      <Slider id={stabilityId} label="Stability" value={config.voiceSettings.stability} min={0} max={1} step={0.01} onChange={(e) => handleSliderChange(char, 'stability', e.target.value)} />
                      <Slider id={similarityId} label="Similarity Boost" value={config.voiceSettings.similarity_boost} min={0} max={1} step={0.01} onChange={(e) => handleSliderChange(char, 'similarity_boost', e.target.value)} />
                      <Slider id={styleId} label="Style Exaggeration" value={config.voiceSettings.style} min={0} max={1} step={0.01} onChange={(e) => handleSliderChange(char, 'style', e.target.value)} />
                      <Slider id={speedId} label="Speed" value={config.voiceSettings.speed} min={0.5} max={2} step={0.05} onChange={(e) => handleSliderChange(char, 'speed', e.target.value)} />
                    </div>
                  </div>
                </div>
              );
            }}
          </List>
        )}
      </div>
    </div>
  );
};

export default CharacterConfigPanel;
