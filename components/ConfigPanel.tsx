import React from 'react';
import ApiKeyPanel from './ApiKeyPanel';
import ProjectSettingsPanel from './ProjectSettingsPanel';
import CharacterConfigPanel from './CharacterConfigPanel';
import { CharacterConfigs, ProjectSettings } from '../types';

interface ConfigPanelProps {
  apiKey: string;
  setApiKey: (key: string) => void;
  rememberApiKey: boolean;
  onRememberChange: (remember: boolean) => void;
  projectSettings: ProjectSettings;
  setProjectSettings: (settings: ProjectSettings) => void;
  characters: string[];
  characterConfigs: CharacterConfigs;
  setCharacterConfigs: (configs: CharacterConfigs) => void;
}

// Implemented ConfigPanel to group related settings panels together.
const ConfigPanel: React.FC<ConfigPanelProps> = ({
  apiKey,
  setApiKey,
  rememberApiKey,
  onRememberChange,
  projectSettings,
  setProjectSettings,
  characters,
  characterConfigs,
  setCharacterConfigs,
}) => {
  return (
    <>
      <ApiKeyPanel
        apiKey={apiKey}
        setApiKey={setApiKey}
        rememberApiKey={rememberApiKey}
        onRememberChange={onRememberChange}
      />
      <ProjectSettingsPanel settings={projectSettings} setSettings={setProjectSettings} />
      <CharacterConfigPanel characters={characters} configs={characterConfigs} setConfigs={setCharacterConfigs} />
    </>
  );
};

export default ConfigPanel;
