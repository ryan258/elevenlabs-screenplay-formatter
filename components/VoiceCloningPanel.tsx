import React, { useState } from 'react';
import { addVoice } from '../utils/elevenLabsApi';

interface VoiceCloningPanelProps {
  apiKey: string;
  onVoiceAdded: () => void;
}

const VoiceCloningPanel: React.FC<VoiceCloningPanelProps> = ({ apiKey, onVoiceAdded }) => {
  const [voiceName, setVoiceName] = useState('');
  const [voiceDescription, setVoiceDescription] = useState('');
  const [audioFiles, setAudioFiles] = useState<FileList | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setAudioFiles(event.target.files);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (!apiKey) {
      setError('API Key is required.');
      return;
    }
    if (!voiceName.trim()) {
      setError('Voice Name is required.');
      return;
    }
    if (!audioFiles || audioFiles.length === 0) {
      setError('Please upload at least one audio file.');
      return;
    }

    setIsLoading(true);
    try {
      const filesArray = Array.from(audioFiles);
      await addVoice(voiceName, voiceDescription, {}, filesArray, apiKey);
      setSuccess('Voice cloned successfully!');
      setVoiceName('');
      setVoiceDescription('');
      setAudioFiles(null);
      onVoiceAdded(); // Notify parent to refresh voice list
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-secondary p-4 rounded-lg shadow-lg">
      <h2 className="text-xl font-bold text-highlight mb-4">Custom Voice Cloning</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="voice-name" className="block text-sm font-medium text-text-secondary mb-1">
            Voice Name
          </label>
          <input
            id="voice-name"
            type="text"
            value={voiceName}
            onChange={(e) => setVoiceName(e.target.value)}
            placeholder="Enter a name for your cloned voice"
            className="w-full p-2 bg-primary border border-accent rounded-md focus:outline-none focus:ring-2 focus:ring-highlight"
            disabled={isLoading}
          />
        </div>
        <div>
          <label htmlFor="voice-description" className="block text-sm font-medium text-text-secondary mb-1">
            Description (Optional)
          </label>
          <textarea
            id="voice-description"
            value={voiceDescription}
            onChange={(e) => setVoiceDescription(e.target.value)}
            placeholder="Describe your voice (e.g., 'My own voice, deep and clear')"
            className="w-full p-2 bg-primary border border-accent rounded-md focus:outline-none focus:ring-2 focus:ring-highlight"
            rows={2}
            disabled={isLoading}
          />
        </div>
        <div>
          <label htmlFor="audio-files" className="block text-sm font-medium text-text-secondary mb-1">
            Upload Audio Samples (.mp3, .wav)
          </label>
          <input
            id="audio-files"
            type="file"
            accept=".mp3,.wav"
            multiple
            onChange={handleFileChange}
            className="w-full p-2 bg-primary border border-accent rounded-md focus:outline-none focus:ring-2 focus:ring-highlight file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-highlight file:text-white hover:file:bg-highlight-dark"
            disabled={isLoading}
          />
          {audioFiles && audioFiles.length > 0 && (
            <p className="text-sm text-text-secondary mt-2">Selected: {audioFiles.length} file(s)</p>
          )}
        </div>
        {error && <p className="text-red-500 text-sm">Error: {error}</p>}
        {success && <p className="text-green-500 text-sm">Success: {success}</p>}
        <button
          type="submit"
          className="w-full py-3 px-4 bg-highlight text-white font-bold rounded-lg shadow-md hover:bg-highlight-dark disabled:bg-gray-500 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-highlight"
          disabled={isLoading || !apiKey || !voiceName.trim() || !audioFiles || audioFiles.length === 0}
        >
          {isLoading ? 'Creating Voice...' : 'Create Custom Voice'}
        </button>
      </form>
    </div>
  );
};

export default VoiceCloningPanel;
