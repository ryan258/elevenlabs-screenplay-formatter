import React from 'react';
import { SFX } from '../types';

interface SfxPanelProps {
  sfxConfigs: SFX[];
  setSfxConfigs: (sfx: SFX[]) => void;
}

const SfxPanel: React.FC<SfxPanelProps> = ({ sfxConfigs, setSfxConfigs }) => {
  const handleAddSfx = () => {
    setSfxConfigs([...sfxConfigs, { keyword: '', url: '', volume: 1.0 }]);
  };

  const handleRemoveSfx = (index: number) => {
    setSfxConfigs(sfxConfigs.filter((_, i) => i !== index));
  };

  const handleSfxChange = (index: number, field: keyof SFX, value: string | number) => {
    const newSfxConfigs = [...sfxConfigs];
    (newSfxConfigs[index] as any)[field] = value;
    setSfxConfigs(newSfxConfigs);
  };

  return (
    <div className="bg-secondary p-4 rounded-lg shadow-lg">
      <h2 className="text-xl font-bold text-highlight mb-4">Sound Effects</h2>
      <div className="space-y-4">
        {sfxConfigs.map((sfx, index) => (
          <div key={index} className="p-3 border bg-primary border-accent rounded-md space-y-2">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold text-text-primary">SFX #{index + 1}</h3>
              <button
                onClick={() => handleRemoveSfx(index)}
                className="text-red-500 hover:text-red-700 transition-colors"
              >
                Remove
              </button>
            </div>
            <div>
              <label htmlFor={`sfx-keyword-${index}`} className="block text-sm font-medium text-text-secondary mb-1">
                Keyword (e.g., DOOR SLAMS)
              </label>
              <input
                id={`sfx-keyword-${index}`}
                type="text"
                value={sfx.keyword}
                onChange={(e) => handleSfxChange(index, 'keyword', e.target.value)}
                placeholder="Enter keyword"
                className="w-full p-2 bg-secondary border border-accent rounded-md focus:outline-none focus:ring-2 focus:ring-highlight"
              />
            </div>
            <div>
              <label htmlFor={`sfx-url-${index}`} className="block text-sm font-medium text-text-secondary mb-1">
                Audio URL (e.g., https://example.com/door_slam.mp3)
              </label>
              <input
                id={`sfx-url-${index}`}
                type="text"
                value={sfx.url}
                onChange={(e) => handleSfxChange(index, 'url', e.target.value)}
                placeholder="Enter audio URL"
                className="w-full p-2 bg-secondary border border-accent rounded-md focus:outline-none focus:ring-2 focus:ring-highlight"
              />
            </div>
            <div>
              <label htmlFor={`sfx-volume-${index}`} className="block text-sm font-medium text-text-secondary mb-1">
                Volume (0.0 - 2.0)
              </label>
              <input
                id={`sfx-volume-${index}`}
                type="number"
                min="0.0"
                max="2.0"
                step="0.1"
                value={sfx.volume}
                onChange={(e) => handleSfxChange(index, 'volume', parseFloat(e.target.value))}
                className="w-full p-2 bg-secondary border border-accent rounded-md focus:outline-none focus:ring-2 focus:ring-highlight"
              />
            </div>
          </div>
        ))}
        <button
          onClick={handleAddSfx}
          className="w-full py-2 px-4 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
        >
          Add SFX
        </button>
      </div>
    </div>
  );
};

export default SfxPanel;
