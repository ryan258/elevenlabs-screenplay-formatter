import React from 'react';
import { GENERATION_PROFILES } from '../config/generationProfiles';

interface GenerationProfilesPanelProps {
  selectedProfileId?: string;
  onSelectProfile: (profileId: string) => void;
}

const GenerationProfilesPanel: React.FC<GenerationProfilesPanelProps> = ({ selectedProfileId, onSelectProfile }) => {
  return (
    <div className="bg-secondary p-4 rounded-lg shadow-lg">
      <h2 className="text-xl font-bold text-highlight mb-3">Generation Profiles</h2>
      <div className="space-y-3">
        {GENERATION_PROFILES.map(profile => (
          <button
            key={profile.id}
            onClick={() => onSelectProfile(profile.id)}
            className={`w-full text-left p-3 border rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-highlight ${selectedProfileId === profile.id ? 'border-highlight bg-highlight/20' : 'border-accent bg-primary'}`}
          >
            <div className="flex items-center justify-between">
              <span className="font-semibold text-text-primary">{profile.name}</span>
              {selectedProfileId === profile.id && <span className="text-xs text-highlight">Selected</span>}
            </div>
            <p className="text-xs text-text-secondary mt-1">{profile.description}</p>
          </button>
        ))}
      </div>
    </div>
  );
};

export default GenerationProfilesPanel;
