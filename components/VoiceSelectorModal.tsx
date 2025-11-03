import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import { getAvailableVoices, generateAudioPreview } from '../utils/elevenLabsApi';
import { VoiceSettings } from '../types';

interface VoiceSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectVoice: (voiceId: string) => void;
  apiKey: string;
  modelId: string;
  currentVoiceSettings: VoiceSettings;
  refreshTrigger: boolean;
}

const VoiceSelectorModal: React.FC<VoiceSelectorModalProps> = ({
  isOpen,
  onClose,
  onSelectVoice,
  apiKey,
  modelId,
  currentVoiceSettings,
  refreshTrigger
}) => {
  const [voices, setVoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterGender, setFilterGender] = useState('');
  const [filterAccent, setFilterAccent] = useState('');
  const [filterAge, setFilterAge] = useState('');
  const [previewLoading, setPreviewLoading] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && apiKey) {
      const fetchVoices = async () => {
        setLoading(true);
        setError(null);
        try {
          const fetchedVoices = await getAvailableVoices(apiKey);
          setVoices(fetchedVoices);
        } catch (err) {
          setError(err.message);
        } finally {
          setLoading(false);
        }
      };
      fetchVoices();
    }
  }, [isOpen, apiKey, refreshTrigger]);

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
      alert(`Failed to play preview: ${err.message}`);
    } finally {
      setPreviewLoading(null);
    }
  };

  const filteredVoices = voices.filter(voice => {
    const searchMatch = searchTerm === '' || 
      voice.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      voice.labels?.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const genderMatch = filterGender === '' || voice.labels?.gender?.toLowerCase() === filterGender.toLowerCase();
    const accentMatch = filterAccent === '' || voice.labels?.accent?.toLowerCase() === filterAccent.toLowerCase();
    const ageMatch = filterAge === '' || voice.labels?.age?.toLowerCase() === filterAge.toLowerCase();
    return searchMatch && genderMatch && accentMatch && ageMatch;
  });

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Select a Voice">
      <div className="p-4">
        <div className="mb-4 flex space-x-2">
          <input
            type="text"
            placeholder="Search voices..."
            className="flex-grow p-2 bg-primary border border-accent rounded-md focus:outline-none focus:ring-2 focus:ring-highlight"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <select
            className="p-2 bg-primary border border-accent rounded-md focus:outline-none focus:ring-2 focus:ring-highlight"
            value={filterGender}
            onChange={(e) => setFilterGender(e.target.value)}
          >
            <option value="">All Genders</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
          </select>
          <select
            className="p-2 bg-primary border border-accent rounded-md focus:outline-none focus:ring-2 focus:ring-highlight"
            value={filterAccent}
            onChange={(e) => setFilterAccent(e.target.value)}
          >
            <option value="">All Accents</option>
            <option value="american">American</option>
            <option value="british">British</option>
            <option value="african">African</option>
            <option value="australian">Australian</option>
            <option value="indian">Indian</option>
          </select>
          <select
            className="p-2 bg-primary border border-accent rounded-md focus:outline-none focus:ring-2 focus:ring-highlight"
            value={filterAge}
            onChange={(e) => setFilterAge(e.target.value)}
          >
            <option value="">All Ages</option>
            <option value="young">Young</option>
            <option value="middle aged">Middle Aged</option>
            <option value="old">Old</option>
          </select>
        </div>

        {loading && <p className="text-center text-text-secondary">Loading voices...</p>}
        {error && <p className="text-center text-red-500">Error: {error}</p>}
        {!loading && filteredVoices.length === 0 && <p className="text-center text-text-secondary">No voices found matching your criteria.</p>}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-96 overflow-y-auto custom-scrollbar">
          {filteredVoices.map(voice => (
            <div key={voice.voice_id} className="bg-secondary p-3 rounded-md flex items-center justify-between">
              <div>
                <p className="font-semibold text-text-primary">{voice.name}</p>
                <p className="text-sm text-text-secondary">
                  {voice.labels?.gender && `Gender: ${voice.labels.gender}, `}
                  {voice.labels?.accent && `Accent: ${voice.labels.accent}, `}
                  {voice.labels?.age && `Age: ${voice.labels.age}`}
                </p>
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => handlePreview(voice.voice_id)}
                  disabled={previewLoading === voice.voice_id || !apiKey}
                  className="px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-500 transition-colors"
                >
                  {previewLoading === voice.voice_id ? 'Playing...' : 'Preview'}
                </button>
                <button
                  onClick={() => {
                    onSelectVoice(voice.voice_id);
                    onClose();
                  }}
                  className="px-3 py-1 bg-highlight text-white rounded-md hover:bg-highlight-dark transition-colors"
                >
                  Select
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
};

export default VoiceSelectorModal;
