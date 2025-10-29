import React, { useState } from 'react';
import ScriptInput from './components/ScriptInput';
import ApiKeyPanel from './components/ApiKeyPanel';
import CharacterConfigPanel from './components/CharacterConfigPanel';
import ProjectSettingsPanel from './components/ProjectSettingsPanel';
import GeneratePanel from './components/GeneratePanel';
import OutputDisplay from './components/OutputDisplay';
import Modal from './components/Modal';
import { useScriptParser } from './hooks/useScriptParser';
import { CharacterConfigs, ProjectSettings } from './types';
import { validateConfiguration } from './utils/scriptGenerator';
import { generateAllAudio, GenerationProgress } from './utils/elevenLabsApi';

// Implemented the main App component to structure the application and manage state.
function App() {
  const [scriptText, setScriptText] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { characters, dialogueChunks } = useScriptParser(scriptText);
  const [apiKey, setApiKey] = useState(process.env.ELEVENLABS_API_KEY || '');
  const [characterConfigs, setCharacterConfigs] = useState<CharacterConfigs>({});
  const [projectSettings, setProjectSettings] = useState<ProjectSettings>({
    model: 'eleven_multilingual_v2',
    outputFormat: 'mp3_44100_128',
    concatenate: true,
  });
  const [generatedOutput, setGeneratedOutput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [progressMessages, setProgressMessages] = useState<string[]>([]);

  const handleExpand = () => setIsModalOpen(true);
  const handleCloseModal = () => setIsModalOpen(false);

  const handleGenerate = async () => {
    setIsLoading(true);
    setGeneratedOutput('');
    setProgressMessages([]);

    try {
      // Validate configuration
      const validation = validateConfiguration(dialogueChunks, characterConfigs, apiKey);

      if (!validation.valid) {
        setGeneratedOutput(`❌ Configuration Errors:\n\n${validation.errors.join('\n')}\n\nPlease fix these issues and try again.`);
        setIsLoading(false);
        return;
      }

      const startMessage = `🚀 Starting audio generation...\n\nTotal dialogue chunks: ${dialogueChunks.length}\nCharacters: ${Object.keys(characterConfigs).join(', ')}\nModel: ${projectSettings.model}\nConcatenate: ${projectSettings.concatenate ? 'Yes' : 'No'}\n\n`;
      setProgressMessages([startMessage]);

      // Generate all audio files
      await generateAllAudio(
        dialogueChunks,
        characterConfigs,
        apiKey,
        projectSettings.model,
        projectSettings.outputFormat,
        projectSettings.concatenate,
        (progress: GenerationProgress, current: number, total: number) => {
          setProgressMessages(prev => [...prev, `[${current}/${total}] ${progress.message}`]);
        }
      );

      // Success message
      const successMessage = projectSettings.concatenate
        ? `\n✅ Generation Complete!\n\nAll ${dialogueChunks.length} audio files have been generated and concatenated into a single file.\nCheck your Downloads folder for "concatenated_audio.mp3".`
        : `\n✅ Generation Complete!\n\nAll ${dialogueChunks.length} audio files have been generated and downloaded.\nCheck your Downloads folder for the audio files.`;
      setProgressMessages(prev => [...prev, successMessage]);
      setGeneratedOutput(successMessage);
      setIsLoading(false);

    } catch (error) {
      console.error('Generation error:', error);
      const errorMessage = `❌ Error during generation:\n\n${error instanceof Error ? error.message : 'Unknown error occurred'}`;
      setProgressMessages(prev => [...prev, errorMessage]);
      setGeneratedOutput(errorMessage);
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-primary text-text-primary min-h-screen font-sans">
      <header className="bg-secondary p-4 shadow-md">
        <h1 className="text-2xl font-bold text-highlight text-center">Script-to-Audio</h1>
        <p className="text-center text-text-secondary">Bring your screenplay to life with AI-powered voice generation.</p>
      </header>
      
      <main className="p-4 md:p-8 grid grid-cols-1 xl:grid-cols-3 gap-8">
        <div className="xl:col-span-2 flex flex-col gap-8">
          <ScriptInput 
            scriptText={scriptText} 
            setScriptText={setScriptText}
            onExpand={handleExpand}
          />
          <OutputDisplay generatedOutput={generatedOutput} isLoading={isLoading} progressMessages={progressMessages} />
        </div>

        <aside className="xl:col-span-1 flex flex-col gap-8">
            <ApiKeyPanel apiKey={apiKey} setApiKey={setApiKey} />
            <ProjectSettingsPanel settings={projectSettings} setSettings={setProjectSettings} />
            <CharacterConfigPanel characters={characters} configs={characterConfigs} setConfigs={setCharacterConfigs} />
            <GeneratePanel 
              onGenerate={handleGenerate}
              isGenerating={isLoading}
              canGenerate={scriptText.length > 0 && apiKey.length > 0 && characters.length > 0}
            />
        </aside>
      </main>

      <Modal isOpen={isModalOpen} onClose={handleCloseModal} title="Screenplay Editor">
        <textarea
          value={scriptText}
          onChange={(e) => setScriptText(e.target.value)}
          placeholder="Paste your screenplay here..."
          className="w-full h-full p-3 bg-primary border border-accent rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-highlight text-text-primary custom-scrollbar"
          style={{ scrollbarWidth: 'thin', scrollbarColor: '#e94560 #1a1a2e' }}
        />
      </Modal>

      <footer className="text-center p-4 text-text-secondary text-sm">
        <p>Powered by ElevenLabs. Created for demonstration purposes.</p>
      </footer>
    </div>
  );
}

export default App;
