import React from 'react';

interface ApiKeyPanelProps {
  apiKey: string;
  setApiKey: (key: string) => void;
  rememberApiKey: boolean;
  onRememberChange: (remember: boolean) => void;
}

const ApiKeyPanel: React.FC<ApiKeyPanelProps> = ({ apiKey, setApiKey, rememberApiKey, onRememberChange }) => {
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
        Keys stay in your browser and are sent only to ElevenLabs when generating audio. They are never shared with the concatenation server.
      </p>
      <div className="flex items-center justify-between mt-3">
        <label htmlFor="remember-key" className="text-xs text-text-secondary flex items-center space-x-2 cursor-pointer">
          <input
            id="remember-key"
            type="checkbox"
            checked={rememberApiKey}
            onChange={(e) => onRememberChange(e.target.checked)}
            className="accent-highlight mr-2"
          />
          <span>Remember this key on this device</span>
        </label>
        <a
          href="https://elevenlabs.io/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-highlight hover:underline"
        >
          Get an ElevenLabs key
        </a>
      </div>
    </div>
  );
};

export default ApiKeyPanel;
