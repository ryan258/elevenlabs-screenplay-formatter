import React from 'react';

interface ApiKeyPanelProps {
  apiKey: string;
  setApiKey: (key: string) => void;
}

const ApiKeyPanel: React.FC<ApiKeyPanelProps> = ({ apiKey, setApiKey }) => {
  return (
    <div className="bg-secondary p-4 rounded-lg shadow-lg">
      <h2 className="text-xl font-bold text-highlight mb-2">Step 1: ElevenLabs API Key</h2>
      <input
        type="password"
        value={apiKey}
        onChange={(e) => setApiKey(e.target.value)}
        placeholder="Enter your ElevenLabs API key"
        className="w-full p-2 bg-primary border border-accent rounded-md focus:outline-none focus:ring-2 focus:ring-highlight"
      />
      <p className="text-xs text-text-secondary mt-2">
        Your key is required to generate the audio files. It is not stored or sent anywhere except in the generated script.
      </p>
    </div>
  );
};

export default ApiKeyPanel;