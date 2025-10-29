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
import { generateElevenLabsScript, validateConfiguration } from './utils/scriptGenerator';

// Implemented the main App component to structure the application and manage state.
function App() {
  const [scriptText, setScriptText] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { characters, dialogueChunks } = useScriptParser(scriptText);
  const [apiKey, setApiKey] = useState('');
  const [characterConfigs, setCharacterConfigs] = useState<CharacterConfigs>({});
  const [projectSettings, setProjectSettings] = useState<ProjectSettings>({
    model: 'eleven_multilingual_v2',
    outputFormat: 'mp3_44100_128',
    concatenate: true,
  });
  const [generatedOutput, setGeneratedOutput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleExpand = () => setIsModalOpen(true);
  const handleCloseModal = () => setIsModalOpen(false);

  const handleGenerate = () => {
    setIsLoading(true);
    setGeneratedOutput('');

    // Small delay to show loading state
    setTimeout(() => {
      try {
        // Validate configuration
        const validation = validateConfiguration(dialogueChunks, characterConfigs, apiKey);

        if (!validation.valid) {
          setGeneratedOutput(`❌ Configuration Errors:\n\n${validation.errors.join('\n')}\n\nPlease fix these issues and try again.`);
          setIsLoading(false);
          return;
        }

        // Generate the script
        const { jsonPayload, bashScript } = generateElevenLabsScript(
          dialogueChunks,
          characterConfigs,
          projectSettings,
          apiKey
        );

        // Format output
        const output = `✅ Generation Complete!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 SUMMARY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Total Dialogue Chunks: ${jsonPayload.length}
Characters: ${Object.keys(characterConfigs).join(', ')}
Model: ${projectSettings.model}
Output Format: ${projectSettings.outputFormat}
Concatenate: ${projectSettings.concatenate ? 'Yes' : 'No'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📝 JSON PAYLOAD
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${JSON.stringify(jsonPayload, null, 2)}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚀 BASH SCRIPT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${bashScript}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📦 USAGE INSTRUCTIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Copy the bash script above
2. Save it to a file (e.g., generate_audio.sh)
3. Make it executable: chmod +x generate_audio.sh
4. Run it: ./generate_audio.sh

The script will create an 'audio_output' directory with all generated audio files.
${projectSettings.concatenate ? 'A final concatenated file (final_output.mp3) will also be created if ffmpeg is installed.' : ''}
`;

        setGeneratedOutput(output);
        setIsLoading(false);
      } catch (error) {
        console.error('Generation error:', error);
        setGeneratedOutput(`❌ Error during generation:\n\n${error.message || 'Unknown error occurred'}`);
        setIsLoading(false);
      }
    }, 500);
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
          <OutputDisplay generatedOutput={generatedOutput} isLoading={isLoading} />
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
