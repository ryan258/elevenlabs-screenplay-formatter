import React from 'react';
import { CharacterConfigs, CharacterConfig, VoiceSettings } from '../types';
import Slider from './Slider';

interface CharacterConfigPanelProps {
  characters: string[];
  configs: CharacterConfigs;
  setConfigs: (configs: CharacterConfigs) => void;
}

const makeId = (character: string, prefix: string) =>
  `${prefix}-${character.replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase()}`;

const CharacterConfigPanel: React.FC<CharacterConfigPanelProps> = ({ characters, configs, setConfigs }) => {

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
      <h2 className="text-xl font-bold text-highlight mb-4">Step 3: Character Voices</h2>
      <div className="flex-grow overflow-y-auto custom-scrollbar pr-2">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-1 gap-4">
          {characters.map((char) => {
            const config = configs[char] || { voiceId: '', voiceSettings: { stability: 0.5, similarity_boost: 0.75, style: 0.1, speed: 1.0 } };
            const voiceId = makeId(char, 'voice-id');
            const stabilityId = makeId(char, 'stability');
            const similarityId = makeId(char, 'similarity');
            const styleId = makeId(char, 'style');
            const speedId = makeId(char, 'speed');
            return (
              <div key={char} className="p-3 border bg-primary border-accent rounded-md flex flex-col space-y-3">
                <h3 className="font-semibold text-text-primary text-center truncate">{char}</h3>
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
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default CharacterConfigPanel;
