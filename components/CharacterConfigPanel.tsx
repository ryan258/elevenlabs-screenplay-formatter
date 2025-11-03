import React, { useCallback, useState } from 'react';
import { CharacterConfigs, CharacterConfig, VoiceSettings } from '../types';
import Slider from './Slider';
import { generateAudioPreview } from '../utils/elevenLabsApi';
import VoiceSelectorModal from './VoiceSelectorModal';
import VoiceCompareModal from './VoiceCompareModal';

interface CharacterConfigPanelProps {
  characters: string[];
  configs: CharacterConfigs;
  setConfigs: (configs: CharacterConfigs) => void;
  apiKey: string;
  modelId: string;
  refreshVoiceListToggle: boolean;
}

const CharacterConfigPanel: React.FC<CharacterConfigPanelProps> = ({ characters, configs, setConfigs, apiKey, modelId, refreshVoiceListToggle }) => {
  const [previewLoading, setPreviewLoading] = useState<{[key: string]: boolean}>({});
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);
  const [isCompareModalOpen, setIsCompareModalOpen] = useState(false);
  const [currentEditingChar, setCurrentEditingChar] = useState<string | null>(null);
  
  const handleExportConfig = useCallback(() => {
    const data = JSON.stringify(configs, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'character-configs.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [configs]);

  const handleImportConfig = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const result = e.target?.result;
        if (typeof result !== 'string') {
          throw new Error('Unsupported file content');
        }
        const parsed = JSON.parse(result) as CharacterConfigs;
        setConfigs(parsed);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        console.error('Error importing character configs:', err);
        alert(`Failed to import config: ${message}`);
      } finally {
        event.target.value = '';
      }
    };
    reader.onerror = () => {
      alert('Failed to read configuration file.');
      event.target.value = '';
    };
    reader.readAsText(file);
  }, [setConfigs]);

  const handleConfigChange = (character: string, field: keyof CharacterConfig, value: any) => {
    const newConfig: CharacterConfig = {
      ...(configs[character] || { 
          voiceId: '', 
          voiceSettings: { stability: 0.5, similarity_boost: 0.75, style: 0.1, speed: 1.0 } 
      }),
      [field]: value,
    };
    
    setConfigs({
      ...configs,
      [character]: newConfig,
    });
  };

  const handleSliderChange = (character: string, field: keyof VoiceSettings, value: string) => {
    const voiceSettings = configs[character]?.voiceSettings || { stability: 0.5, similarity_boost: 0.75, style: 0.1, speed: 1.0 };
    const newVoiceSettings: VoiceSettings = {
      ...voiceSettings,
      [field]: parseFloat(value),
    };
    handleConfigChange(character, 'voiceSettings', newVoiceSettings);
  };

  const handlePreview = async (character: string) => {
    const config = configs[character];
    if (!config || !config.voiceId || !apiKey) {
      alert('Please provide a Voice ID and API Key to preview.');
      return;
    }

    setPreviewLoading(prev => ({ ...prev, [character]: true }));
    try {
      const audioBlob = await generateAudioPreview(config.voiceId, config.voiceSettings, apiKey, modelId);
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      audio.play();
      audio.onended = () => {
        URL.revokeObjectURL(audioUrl);
      };
    } catch (error) {
      console.error('Error generating audio preview:', error);
      const message = error instanceof Error ? error.message : 'Unknown error occurred';
      alert(`Failed to generate preview for ${character}: ${message}`);
    } finally {
      setPreviewLoading(prev => ({ ...prev, [character]: false }));
    }
  };

  const openVoiceModal = (character: string) => {
    setCurrentEditingChar(character);
    setIsVoiceModalOpen(true);
  };

  const handleVoiceSelect = (voiceId: string) => {
    if (currentEditingChar) {
      handleConfigChange(currentEditingChar, 'voiceId', voiceId);
    }
    setIsVoiceModalOpen(false);
    setCurrentEditingChar(null);
  };
  
  if (characters.length === 0) {
    return (
      <div className="bg-secondary p-4 rounded-lg shadow-lg h-full flex items-center justify-center">
        <p className="text-text-secondary text-center">Characters from your script will appear here once you start typing.</p>
      </div>
    );
  }

  return (
    <div className="bg-secondary p-4 rounded-lg shadow-lg h-full flex flex-col">
      <h2 className="text-xl font-bold text-highlight mb-4">Step 3: Character Voices</h2>
      <div className="flex justify-end space-x-2 mb-4">
        <button
          onClick={handleExportConfig}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
        >
          Export Config
        </button>
        <input
          type="file"
          accept=".json"
          onChange={handleImportConfig}
          className="hidden"
          id="import-config-file"
        />
        <label
          htmlFor="import-config-file"
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors cursor-pointer"
        >
          Import Config
        </label>
      </div>
      <div className="flex-grow overflow-y-auto custom-scrollbar pr-2">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-1 gap-4">
          {characters.map((char) => {
            const config = configs[char] || { voiceId: '', voiceSettings: { stability: 0.5, similarity_boost: 0.75, style: 0.1, speed: 1.0 } };
            return (
              <div key={char} className="p-3 border bg-primary border-accent rounded-md flex flex-col space-y-3">
                <h3 className="font-semibold text-text-primary text-center truncate">{char}</h3>
                <div className="flex items-end space-x-2">
                  <div className="flex-grow">
                    <label htmlFor={`voice-id-${char}`} className="block text-sm font-medium text-text-secondary mb-1">
                      Voice ID
                    </label>
                    <input
                      id={`voice-id-${char}`}
                      type="text"
                      value={config.voiceId}
                      onChange={(e) => handleConfigChange(char, 'voiceId', e.target.value)}
                      onBlur={(e) => handleConfigChange(char, 'voiceId', e.target.value.trim())}
                      placeholder="Enter Voice ID"
                      className="w-full p-2 bg-secondary border border-accent rounded-md focus:outline-none focus:ring-2 focus:ring-highlight"
                    />
                  </div>
                  <button
                    onClick={() => openVoiceModal(char)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-500 transition-colors"
                    disabled={!apiKey}
                  >
                    Browse Voices
                  </button>
                  <button
                    onClick={() => setIsCompareModalOpen(true)}
                    className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors"
                    disabled={!apiKey}
                  >
                    Compare Voices
                  </button>
                  <button
                    onClick={() => handlePreview(char)}
                    disabled={!config.voiceId || !apiKey || previewLoading[char]}
                    className="px-4 py-2 bg-highlight text-white rounded-md hover:bg-highlight-dark disabled:bg-gray-500 disabled:cursor-not-allowed transition-colors"
                  >
                    {previewLoading[char] ? 'Playing...' : 'Preview'}
                  </button>
                </div>
                <div className="space-y-2">
                    <Slider id={`stability-${char}`} label="Stability" value={config.voiceSettings.stability} min={0} max={1} step={0.01} onChange={(e) => handleSliderChange(char, 'stability', e.target.value)} />
                    <Slider id={`similarity-${char}`} label="Similarity Boost" value={config.voiceSettings.similarity_boost} min={0} max={1} step={0.01} onChange={(e) => handleSliderChange(char, 'similarity_boost', e.target.value)} />
                    <Slider id={`style-${char}`} label="Style Exaggeration" value={config.voiceSettings.style} min={0} max={1} step={0.01} onChange={(e) => handleSliderChange(char, 'style', e.target.value)} />
                    <Slider id={`speed-${char}`} label="Speed" value={config.voiceSettings.speed} min={0.5} max={2} step={0.05} onChange={(e) => handleSliderChange(char, 'speed', e.target.value)} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {isVoiceModalOpen && currentEditingChar && (
        <VoiceSelectorModal
          isOpen={isVoiceModalOpen}
          onClose={() => setIsVoiceModalOpen(false)}
          onSelectVoice={handleVoiceSelect}
          apiKey={apiKey}
          modelId={modelId}
          currentVoiceSettings={configs[currentEditingChar]?.voiceSettings || { stability: 0.5, similarity_boost: 0.75, style: 0.1, speed: 1.0 }}
          refreshTrigger={refreshVoiceListToggle}
        />
      )}
      {isCompareModalOpen && (
        <VoiceCompareModal
          isOpen={isCompareModalOpen}
          onClose={() => setIsCompareModalOpen(false)}
          apiKey={apiKey}
          modelId={modelId}
          currentVoiceSettings={configs[characters[0]]?.voiceSettings || { stability: 0.5, similarity_boost: 0.75, style: 0.1, speed: 1.0 }} // Use settings of first character for comparison
        />
      )}
    </div>
  );
};

export default CharacterConfigPanel;
