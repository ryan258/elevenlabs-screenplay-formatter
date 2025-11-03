import React from 'react';
import ApiKeyPanel from './ApiKeyPanel';
import ProjectSettingsPanel from './ProjectSettingsPanel';
import CharacterConfigPanel from './CharacterConfigPanel';
import { CharacterConfigs, ProjectSettings } from '../types';

interface ConfigPanelProps {
  apiKey: string;
  setApiKey: (key: string) => void;
  projectSettings: ProjectSettings;
  setProjectSettings: (settings: ProjectSettings) => void;
  characters: string[];
  characterConfigs: CharacterConfigs;
  setCharacterConfigs: (configs: CharacterConfigs) => void;
  refreshVoiceListToggle?: boolean;
}

// Implemented ConfigPanel to group related settings panels together.
const ConfigPanel: React.FC<ConfigPanelProps> = ({
  apiKey,
  setApiKey,
  projectSettings,
  setProjectSettings,
  characters,
  characterConfigs,
  setCharacterConfigs,
  refreshVoiceListToggle,
}) => {
  return (
    <>
      <ApiKeyPanel apiKey={apiKey} setApiKey={setApiKey} />
      <ProjectSettingsPanel settings={projectSettings} setSettings={setProjectSettings} />
      <CharacterConfigPanel
        characters={characters}
        configs={characterConfigs}
        setConfigs={setCharacterConfigs}
        apiKey={apiKey}
        modelId={projectSettings.model}
        refreshVoiceListToggle={refreshVoiceListToggle ?? false}
      />
    </>
  );
};

export default ConfigPanel;
