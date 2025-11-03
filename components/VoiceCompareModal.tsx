import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import { getAvailableVoices, generateAudioPreview } from '../utils/elevenLabsApi';
import { VoiceSettings } from '../types';

interface VoiceCompareModalProps {
  isOpen: boolean;
  onClose: () => void;
  apiKey: string;
  modelId: string;
  currentVoiceSettings: VoiceSettings;
}

const VoiceCompareModal: React.FC<VoiceCompareModalProps> = ({
  isOpen,
  onClose,
  apiKey,
  modelId,
  currentVoiceSettings
}) => {
  const [voices, setVoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedVoices, setSelectedVoices] = useState<string[]>([]);
  const [previewLoading, setPreviewLoading] = useState<string | null>(null);
  const sampleText = "The quick brown fox jumps over the lazy dog.";

  useEffect(() => {
    if (isOpen && apiKey) {
      const fetchVoices = async () => {
        setLoading(true);
        setError(null);
        try {
          const fetchedVoices = await getAvailableVoices(apiKey);
          setVoices(fetchedVoices);
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Unknown error occurred';
          setError(message);
        } finally {
          setLoading(false);
        }
      };
      fetchVoices();
    }
  }, [isOpen, apiKey]);

  const handleVoiceSelect = (voiceId: string) => {
    setSelectedVoices(prev => 
      prev.includes(voiceId) 
        ? prev.filter(id => id !== voiceId) 
        : [...prev, voiceId]
    );
  };

  const handlePreview = async (voiceId: string) => {
    if (!apiKey || !voiceId) return;
    setPreviewLoading(voiceId);
    try {
      const audioBlob = await generateAudioPreview(voiceId, currentVoiceSettings, apiKey, modelId);
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      audio.play();
      audio.onended = () => {
        URL.revokeObjectURL(audioUrl);
      };
    } catch (err) {
      console.error('Error playing preview:', err);
      const message = err instanceof Error ? err.message : 'Unknown error occurred';
      alert(`Failed to play preview: ${message}`);
    } finally {
      setPreviewLoading(null);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Compare Voices">
      <div className="p-4">
        {loading && <p className="text-center text-text-secondary">Loading voices...</p>}
        {error && <p className="text-center text-red-500">Error: {error}</p>}
        {!loading && voices.length === 0 && <p className="text-center text-text-secondary">No voices found.</p>}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-60 overflow-y-auto custom-scrollbar mb-4">
          {voices.map(voice => (
            <div key={voice.voice_id} className="bg-secondary p-3 rounded-md flex items-center justify-between">
              <div>
                <p className="font-semibold text-text-primary">{voice.name}</p>
                <p className="text-sm text-text-secondary">
                  {voice.labels?.gender && `Gender: ${voice.labels.gender}, `}
                  {voice.labels?.accent && `Accent: ${voice.labels.accent}, `}
                  {voice.labels?.age && `Age: ${voice.labels.age}`}
                </p>
              </div>
              <input
                type="checkbox"
                checked={selectedVoices.includes(voice.voice_id)}
                onChange={() => handleVoiceSelect(voice.voice_id)}
                className="form-checkbox h-5 w-5 text-highlight rounded focus:ring-highlight"
              />
            </div>
          ))}
        </div>

        <h3 className="text-lg font-bold text-highlight mb-2">Selected Voices for Comparison:</h3>
        <div className="space-y-3 max-h-60 overflow-y-auto custom-scrollbar">
          {selectedVoices.length === 0 && <p className="text-text-secondary">Select voices above to compare.</p>}
          {selectedVoices.map(voiceId => {
            const voice = voices.find(v => v.voice_id === voiceId);
            if (!voice) return null;
            return (
              <div key={voice.voice_id} className="bg-primary p-3 rounded-md flex items-center justify-between">
                <p className="font-semibold text-text-primary">{voice.name}</p>
                <button
                  onClick={() => handlePreview(voice.voice_id)}
                  disabled={previewLoading === voice.voice_id || !apiKey}
                  className="px-3 py-1 bg-highlight text-white rounded-md hover:bg-highlight-dark disabled:bg-gray-500 disabled:cursor-not-allowed transition-colors"
                >
                  {previewLoading === voice.voice_id ? 'Playing...' : 'Play Sample'}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </Modal>
  );
};

export default VoiceCompareModal;
