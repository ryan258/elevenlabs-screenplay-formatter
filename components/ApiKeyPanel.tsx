import React from 'react';

interface ApiKeyPanelProps {
  apiKey: string;
  setApiKey: (key: string) => void;
}

const ApiKeyPanel: React.FC<ApiKeyPanelProps> = ({ apiKey, setApiKey }) => {
  return (
    <div className="bg-secondary p-4 rounded-lg shadow-lg">
      <h2 className="text-xl font-bold text-highlight mb-2">Step 1: ElevenLabs API Key</h2>
      <label htmlFor="api-key" className="block text-sm font-medium text-text-secondary mb-1">
        API Key
      </label>
      <input
        id="api-key"
        type="password"
        value={apiKey}
        onChange={(e) => setApiKey(e.target.value)}
        placeholder="Enter your ElevenLabs API key"
        aria-describedby="api-key-help"
        className="w-full p-2 bg-primary border border-accent rounded-md focus:outline-none focus:ring-2 focus:ring-highlight"
      />
      <p id="api-key-help" className="text-xs text-text-secondary mt-2">
        Stored securely in your browser’s local storage and sent only to ElevenLabs when generating audio.
      </p>
    </div>
  );
};

export default ApiKeyPanel;
