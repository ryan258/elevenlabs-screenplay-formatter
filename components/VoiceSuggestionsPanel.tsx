import React, { useMemo, useState } from 'react';
import { LANGUAGE_OPTIONS, ROLE_SUGGESTIONS, RoleSuggestion, VoiceSuggestion } from '../config/voiceSuggestions';
import { ElevenLabsVoice } from '../types';

interface VoiceSuggestionsPanelProps {
  languageCode?: string;
  characters: string[];
  onApplySuggestion: (character: string, voice: VoiceSuggestion) => void;
  customVoices: ElevenLabsVoice[];
  voicesStatus: 'idle' | 'loading' | 'ready' | 'error';
  onApplyCustomVoice: (character: string, voice: { voiceId: string; name: string }) => void;
}

const VoiceSuggestionsPanel: React.FC<VoiceSuggestionsPanelProps> = ({
  languageCode = 'en',
  characters,
  onApplySuggestion,
  customVoices,
  voicesStatus,
  onApplyCustomVoice
}) => {
  const [selectedCharacter, setSelectedCharacter] = useState('');
  const [voiceFilter, setVoiceFilter] = useState('');
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

  const filteredCustomVoices = useMemo(() => {
    if (!voiceFilter.trim()) {
      return customVoices;
    }
    const lower = voiceFilter.toLowerCase();
    return customVoices.filter(voice => voice.name?.toLowerCase().includes(lower));
  }, [customVoices, voiceFilter]);

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
      <div className="space-y-3 mb-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-highlight">My ElevenLabs Voices</h3>
          <span className="text-xs text-text-secondary">
            {voicesStatus === 'loading' && 'Loading...'}
            {voicesStatus === 'error' && 'Error'}
            {voicesStatus === 'ready' && `${customVoices.length} voices`}
            {voicesStatus === 'idle' && 'Enter API key'}
          </span>
        </div>
        {voicesStatus === 'ready' && customVoices.length > 0 && (
          <>
            <input
              type="text"
              value={voiceFilter}
              onChange={(e) => setVoiceFilter(e.target.value)}
              placeholder="Search your custom voices..."
              className="w-full p-2 bg-primary border border-accent rounded-md focus:outline-none focus:ring-2 focus:ring-highlight text-sm"
            />
            <div className="max-h-40 overflow-y-auto custom-scrollbar space-y-2 pr-2">
              {filteredCustomVoices.length === 0 && (
                <p className="text-xs text-text-secondary">No voices match “{voiceFilter}”.</p>
              )}
              {filteredCustomVoices.slice(0, 15).map(voice => (
                <div key={voice.voice_id} className="flex items-center justify-between bg-primary border border-accent rounded-md px-2 py-1 text-sm">
                  <div className="mr-2">
                    <p className="font-semibold text-text-primary">{voice.name}</p>
                    {voice.category && <p className="text-xs text-text-secondary">{voice.category}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    {voice.preview_url && (
                      <audio src={voice.preview_url} controls className="h-8" />
                    )}
                    <button
                      onClick={() => safeCharacter && onApplyCustomVoice(safeCharacter, { voiceId: voice.voice_id, name: voice.name })}
                      className="text-xs px-2 py-1 bg-accent hover:bg-highlight rounded-md focus:outline-none focus:ring-2 focus:ring-highlight"
                    >
                      Apply
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
        {(voicesStatus === 'loading' || voicesStatus === 'idle') && (
          <p className="text-xs text-text-secondary">Enter your ElevenLabs API key to load your voice library automatically.</p>
        )}
        {voicesStatus === 'error' && (
          <p className="text-xs text-red-300">Unable to load voices. Check your API key or try again later.</p>
        )}
      </div>
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
