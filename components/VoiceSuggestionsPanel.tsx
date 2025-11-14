import React, { useMemo, useState } from 'react';
import { LANGUAGE_OPTIONS, ROLE_SUGGESTIONS, RoleSuggestion, VoiceSuggestion } from '../config/voiceSuggestions';

interface VoiceSuggestionsPanelProps {
  languageCode?: string;
  characters: string[];
  onApplySuggestion: (character: string, voice: VoiceSuggestion) => void;
}

const VoiceSuggestionsPanel: React.FC<VoiceSuggestionsPanelProps> = ({ languageCode = 'en', characters, onApplySuggestion }) => {
  const [selectedCharacter, setSelectedCharacter] = useState('');
  const availableLanguage = ROLE_SUGGESTIONS[languageCode] ? languageCode : 'en';
  const roleSuggestions = ROLE_SUGGESTIONS[availableLanguage] ?? [];
  const languageLabel = LANGUAGE_OPTIONS.find(option => option.code === availableLanguage)?.label ?? 'English';

  const safeCharacter = useMemo(() => {
    if (!selectedCharacter && characters.length) {
      setSelectedCharacter(characters[0]);
      return characters[0];
    }
    if (selectedCharacter && !characters.includes(selectedCharacter)) {
      const fallback = characters[0] || '';
      setSelectedCharacter(fallback);
      return fallback;
    }
    return selectedCharacter;
  }, [characters, selectedCharacter]);

  if (!characters.length) {
    return (
      <div className="bg-secondary p-4 rounded-lg shadow-lg">
        <h2 className="text-xl font-bold text-highlight mb-3">Voice Suggestions</h2>
        <p className="text-xs text-text-secondary">Add screenplay text to populate characters before using suggestions.</p>
      </div>
    );
  }

  return (
    <div className="bg-secondary p-4 rounded-lg shadow-lg">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xl font-bold text-highlight">Voice Suggestions</h2>
        <span className="text-xs text-text-secondary">{languageLabel}</span>
      </div>
      <p className="text-xs text-text-secondary mb-3">
        These curated voices match common roles in {languageLabel}. Select a character, then apply any suggestion with one click.
      </p>
      <label className="block text-xs text-text-secondary mb-2">
        Target Character
        <select
          value={safeCharacter}
          onChange={(e) => setSelectedCharacter(e.target.value)}
          className="mt-1 w-full p-2 bg-primary border border-accent rounded-md focus:outline-none focus:ring-2 focus:ring-highlight text-sm"
        >
          {characters.map(character => (
            <option key={character} value={character}>{character}</option>
          ))}
        </select>
      </label>
      <div className="space-y-3 max-h-64 overflow-y-auto custom-scrollbar pr-2">
        {roleSuggestions.length === 0 && (
          <p className="text-xs text-text-secondary">No curated voices for this language yet—fallback to English recommendations.</p>
        )}
        {roleSuggestions.map((roleGroup: RoleSuggestion) => (
          <div key={roleGroup.role} className="p-3 bg-primary border border-accent rounded-md space-y-2">
            <div>
              <p className="font-semibold text-text-primary">{roleGroup.role}</p>
              <p className="text-xs text-text-secondary">{roleGroup.description}</p>
            </div>
            <div className="space-y-2">
              {roleGroup.voices.map(voice => (
                <div key={voice.voiceId} className="flex items-center justify-between text-sm bg-secondary rounded-md px-2 py-1">
                  <div>
                    <p className="font-semibold text-text-primary">{voice.name}</p>
                    <p className="text-xs text-text-secondary">{voice.description}</p>
                  </div>
                  <button
                    onClick={() => safeCharacter && onApplySuggestion(safeCharacter, voice)}
                    className="text-xs px-2 py-1 bg-accent hover:bg-highlight rounded-md focus:outline-none focus:ring-2 focus:ring-highlight"
                  >
                    Apply
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default VoiceSuggestionsPanel;
