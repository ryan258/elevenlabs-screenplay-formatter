import React, { useState, useEffect } from 'react';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import ScriptInput from './components/ScriptInput';
import ApiKeyPanel from './components/ApiKeyPanel';
import CharacterConfigPanel from './components/CharacterConfigPanel';
import ProjectSettingsPanel from './components/ProjectSettingsPanel';
import GeneratePanel from './components/GeneratePanel';
import Modal from './components/Modal';
import { useScriptParser } from './hooks/useScriptParser';
import { CharacterConfigs, ProjectSettings, SFX, GenerationStat } from './types';
import { validateConfiguration } from './utils/scriptGenerator';
import { generateAllAudio, GenerationProgress, validateApiKey } from './utils/elevenLabsApi';
import SfxPanel from './components/SfxPanel';
import { generateSrtFile, generateVttFile } from './utils/subtitleGenerator';
import VoiceCloningPanel from './components/VoiceCloningPanel';
import { serializeConfig, deserializeConfig } from './utils/shareUtils';
import StatisticsPanel from './components/StatisticsPanel';

// Implemented the main App component to structure the application and manage state.
function App() {
  const [scriptText, setScriptText] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { characters, dialogueChunks } = useScriptParser(scriptText);
  const [apiKey, setApiKey] = useState(process.env.ELEVENLABS_API_KEY || '');
  const [currentUser, setCurrentUser] = useState('default'); // New state for current user
  const [characterConfigs, setCharacterConfigs] = useState<CharacterConfigs>({});
  const [projectSettings, setProjectSettings] = useState<ProjectSettings>({
    model: 'eleven_multilingual_v2',
    outputFormat: 'mp3_44100_128',
    concatenate: true,
    generateSubtitles: false,
    subtitleFormat: 'srt',
    masteringPreset: 'none',
  });
  const [sfxConfigs, setSfxConfigs] = useState<SFX[]>([]);
  const [generationStats, setGenerationStats] = useState<GenerationStat[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [resumeState, setResumeState] = useState<any>(null);
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  const [refreshVoiceListToggle, setRefreshVoiceListToggle] = useState(false);

  const handleVoiceAdded = () => {
    setRefreshVoiceListToggle(prev => !prev);
  };

  const totalCharacters = dialogueChunks.reduce((sum, chunk) => sum + chunk.text.length, 0);
  const estimatedCost = (totalCharacters / 1000) * 0.15; // Assuming $0.15 per 1000 characters

  const handleShare = () => {
    const configToShare = {
      scriptText,
      characterConfigs,
      projectSettings,
      sfxConfigs,
    };
    const encodedConfig = serializeConfig(configToShare);
    const shareableLink = `${window.location.origin}?config=${encodedConfig}`;
    navigator.clipboard.writeText(shareableLink);
    toast.success('Shareable link copied to clipboard!', { autoClose: 3000 });
  };

  const [scriptFiles, setScriptFiles] = useState<File[]>([]);

  const handleFilesDrop = (files: File[]) => {
    setScriptFiles(files);
    if (files.length > 0) {
      processScriptQueue(files);
    }
  };

  const processScriptQueue = async (files: File[]) => {
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const reader = new FileReader();
      const scriptName = file.name;

      toast.info(`Processing script: ${scriptName} (${i + 1}/${files.length})`, { autoClose: false, toastId: `batch-progress-${scriptName}` });

      try {
        const scriptContent = await new Promise<string>((resolve, reject) => {
          reader.onload = (e) => {
            if (e.target && typeof e.target.result === 'string') {
              resolve(e.target.result);
            } else {
              reject(new Error('Failed to read file content.'));
            }
          };
          reader.onerror = reject;
          reader.readAsText(file);
        });

        setScriptText(scriptContent);
        // Wait for scriptText to update and parser to run
        await new Promise(resolve => setTimeout(resolve, 100)); 

        // Trigger generation for the current script
        await handleGenerate();
        toast.update(`batch-progress-${scriptName}`, { render: `✅ Completed script: ${scriptName}`, type: 'success', autoClose: 3000 });

      } catch (error) {
        console.error(`Error processing ${scriptName}:`, error);
        toast.update(`batch-progress-${scriptName}`, { render: `❌ Failed script: ${scriptName} - ${error.message}`, type: 'error', autoClose: 5000 });
      }
    }
    setScriptFiles([]); // Clear queue after processing
    toast.success('Batch processing complete!', { autoClose: 3000 });
  };

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const encodedConfig = urlParams.get('config');
    if (encodedConfig) {
      const decodedConfig = deserializeConfig(encodedConfig);
      if (decodedConfig) {
        setScriptText(decodedConfig.scriptText);
        setCharacterConfigs(decodedConfig.characterConfigs);
        setProjectSettings(decodedConfig.projectSettings);
        setSfxConfigs(decodedConfig.sfxConfigs);
        toast.success('Project configuration loaded from URL!', { autoClose: 3000 });
      } else {
        toast.error('Failed to load project configuration from URL.', { autoClose: 3000 });
      }
    }

    const savedScript = localStorage.getItem(`${currentUser}-scriptText`);
    if (savedScript) {
      setScriptText(savedScript);
    }

    const savedState = localStorage.getItem(`${currentUser}-generationState`);
    if (savedState) {
      setResumeState(JSON.parse(savedState));
    }

    const savedStats = localStorage.getItem(`${currentUser}-generationStats`);
    if (savedStats) {
      setGenerationStats(JSON.parse(savedStats));
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
        if (scriptText.length > 0 && apiKey.length > 0 && characters.length > 0 && !isLoading) {
          handleGenerate();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [apiKey, characters.length, dialogueChunks, isLoading, scriptText, currentUser]);

  useEffect(() => {
    localStorage.setItem(`${currentUser}-scriptText`, scriptText);
  }, [scriptText, currentUser]);

  useEffect(() => {
    localStorage.setItem(`${currentUser}-generationStats`, JSON.stringify(generationStats));
  }, [generationStats, currentUser]);

  const handleExpand = () => setIsModalOpen(true);
  const handleCloseModal = () => setIsModalOpen(false);

  const handleGenerate = async () => {
    setIsLoading(true);
    const generationToastId = toast.info('Starting audio generation...', { autoClose: false, closeButton: false });

    localStorage.removeItem(`${currentUser}-generationState`);
    localStorage.removeItem(`${currentUser}-generatedBlobs`);

    const controller = new AbortController();
    setAbortController(controller);

    try {
      // Validate API Key
      const isApiKeyValid = await validateApiKey(apiKey);
      if (!isApiKeyValid) {
        toast.update(generationToastId, { render: '❌ Invalid API Key. Please check your API key and try again.', type: 'error', autoClose: 5000, closeButton: true });
        setIsLoading(false);
        setAbortController(null);
        return;
      }

      // Validate configuration
      const validation = validateConfiguration(dialogueChunks, characterConfigs, apiKey);

      if (!validation.valid) {
        toast.update(generationToastId, { render: `❌ Configuration Errors:\n\n${validation.errors.join('\n')}\n\nPlease fix these issues and try again.`, type: 'error', autoClose: 5000, closeButton: true });
        setIsLoading(false);
        setAbortController(null);
        return;
      }

      toast.update(generationToastId, { render: `🚀 Starting audio generation...\nTotal chunks: ${dialogueChunks.length}` });

      localStorage.setItem(`${currentUser}-generationState`, JSON.stringify({ dialogueChunks, characterConfigs, modelId: projectSettings.model, outputFormat: projectSettings.outputFormat, concatenate: projectSettings.concatenate, backgroundMusicUrl: projectSettings.backgroundMusicUrl, pauseDuration: projectSettings.pauseDuration, generateSubtitles: projectSettings.generateSubtitles, subtitleFormat: projectSettings.subtitleFormat, masteringPreset: projectSettings.masteringPreset, resumeIndex: 0 }));

      const startTime = Date.now();

      // Generate all audio files
      await generateAllAudio(
        dialogueChunks,
        characterConfigs,
        apiKey,
        projectSettings,
        sfxConfigs,
        controller.signal,
        (progress: GenerationProgress, current: number, total: number) => {
          toast.update(generationToastId, { render: `[${current}/${total}] ${progress.message}` });
        }
      );

      const endTime = Date.now();
      const duration = (endTime - startTime) / 1000;

      // Success message
      const successMessage = projectSettings.concatenate
        ? `✅ Generation Complete! All ${dialogueChunks.length} audio files have been generated and concatenated into a single file. Check your Downloads folder for "concatenated_audio.mp3".`
        : `✅ Generation Complete! All ${dialogueChunks.length} audio files have been generated and downloaded. Check your Downloads folder for the audio files.`;
      toast.update(generationToastId, { render: successMessage, type: 'success', autoClose: 5000, closeButton: true });

      setGenerationStats(prev => [...prev, {
        timestamp: Date.now(),
        scriptLength: scriptText.length,
        characterCount: totalCharacters,
        estimatedCost: estimatedCost,
        duration: duration,
        status: 'success',
      }]);

      if (projectSettings.generateSubtitles) {
        const subtitleContent = projectSettings.subtitleFormat === 'srt' 
          ? generateSrtFile(dialogueChunks) 
          : generateVttFile(dialogueChunks);
        const subtitleBlob = new Blob([subtitleContent], { type: `text/${projectSettings.subtitleFormat}` });
        const subtitleFilename = `subtitles.${projectSettings.subtitleFormat}`;
        const url = URL.createObjectURL(subtitleBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = subtitleFilename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success(`Subtitle file (${projectSettings.subtitleFormat.toUpperCase()}) generated and downloaded!`, { autoClose: 3000 });
      }

      setIsLoading(false);
      localStorage.removeItem(`${currentUser}-generationState`);
      localStorage.removeItem(`${currentUser}-generatedBlobs`);
      setAbortController(null);

    } catch (error) {
      const endTime = Date.now();
      const duration = (endTime - startTime) / 1000;
      if (error.name === 'AbortError') {
        toast.update(generationToastId, { render: 'Generation cancelled by user.', type: 'warn', autoClose: 5000, closeButton: true });
        setGenerationStats(prev => [...prev, {
          timestamp: Date.now(),
          scriptLength: scriptText.length,
          characterCount: totalCharacters,
          estimatedCost: estimatedCost,
          duration: duration,
          status: 'cancelled',
        }]);
      } else {
        console.error('Generation error:', error);
        const errorMessage = `❌ Error during generation: ${error instanceof Error ? error.message : 'Unknown error occurred'}`;
        toast.update(generationToastId, { render: errorMessage, type: 'error', autoClose: 5000, closeButton: true });
        setGenerationStats(prev => [...prev, {
          timestamp: Date.now(),
          scriptLength: scriptText.length,
          characterCount: totalCharacters,
          estimatedCost: estimatedCost,
          duration: duration,
          status: 'error',
        }]);
      }
      setIsLoading(false);
      setAbortController(null);
    }
  };

  const handleResume = async () => {
    if (!resumeState) return;

    setIsLoading(true);
    const generationToastId = toast.info('Resuming audio generation...', { autoClose: false, closeButton: false });

    const controller = new AbortController();
    setAbortController(controller);

    const startTime = Date.now();

    try {
      toast.update(generationToastId, { render: `🚀 Resuming audio generation from index ${resumeState.resumeIndex}...\nTotal chunks: ${resumeState.dialogueChunks.length}` });

      // Generate all audio files
      await generateAllAudio(
        resumeState.dialogueChunks,
        resumeState.characterConfigs,
        apiKey,
        { model: resumeState.modelId, outputFormat: resumeState.outputFormat, concatenate: resumeState.concatenate, backgroundMusicUrl: resumeState.backgroundMusicUrl, pauseDuration: resumeState.pauseDuration, generateSubtitles: resumeState.generateSubtitles, subtitleFormat: resumeState.subtitleFormat, masteringPreset: resumeState.masteringPreset },
        sfxConfigs,
        controller.signal,
        (progress: GenerationProgress, current: number, total: number) => {
          toast.update(generationToastId, { render: `[${current}/${total}] ${progress.message}` });
        },
        resumeState.resumeIndex
      );

      const endTime = Date.now();
      const duration = (endTime - startTime) / 1000;

      // Success message
      const successMessage = resumeState.concatenate
        ? `✅ Generation Complete! All ${resumeState.dialogueChunks.length} audio files have been generated and concatenated into a single file. Check your Downloads folder for "concatenated_audio.mp3".`
        : `✅ Generation Complete! All ${resumeState.dialogueChunks.length} audio files have been generated and downloaded. Check your Downloads folder for the audio files.`;
      toast.update(generationToastId, { render: successMessage, type: 'success', autoClose: 5000, closeButton: true });

      setGenerationStats(prev => [...prev, {
        timestamp: Date.now(),
        scriptLength: resumeState.dialogueChunks.reduce((sum, chunk) => sum + chunk.text.length, 0),
        characterCount: resumeState.dialogueChunks.length,
        estimatedCost: (resumeState.dialogueChunks.reduce((sum, chunk) => sum + chunk.text.length, 0) / 1000) * 0.15,
        duration: duration,
        status: 'success',
      }]);

      if (resumeState.generateSubtitles) {
        const subtitleContent = resumeState.subtitleFormat === 'srt' 
          ? generateSrtFile(resumeState.dialogueChunks) 
          : generateVttFile(resumeState.dialogueChunks);
        const subtitleBlob = new Blob([subtitleContent], { type: `text/${resumeState.subtitleFormat}` });
        const subtitleFilename = `subtitles.${resumeState.subtitleFormat}`;
        const url = URL.createObjectURL(subtitleBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = subtitleFilename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success(`Subtitle file (${resumeState.subtitleFormat.toUpperCase()}) generated and downloaded!`, { autoClose: 3000 });
      }

      setIsLoading(false);
      localStorage.removeItem(`${currentUser}-generationState`);
      localStorage.removeItem(`${currentUser}-generatedBlobs`);
      setAbortController(null);

    } catch (error) {
      const endTime = Date.now();
      const duration = (endTime - startTime) / 1000;
      if (error.name === 'AbortError') {
        toast.update(generationToastId, { render: 'Generation cancelled by user.', type: 'warn', autoClose: 5000, closeButton: true });
        setGenerationStats(prev => [...prev, {
          timestamp: Date.now(),
          scriptLength: resumeState.dialogueChunks.reduce((sum, chunk) => sum + chunk.text.length, 0),
          characterCount: resumeState.dialogueChunks.length,
          estimatedCost: (resumeState.dialogueChunks.reduce((sum, chunk) => sum + chunk.text.length, 0) / 1000) * 0.15,
          duration: duration,
          status: 'cancelled',
        }]);
      } else {
        console.error('Generation error:', error);
        const errorMessage = `❌ Error during generation: ${error instanceof Error ? error.message : 'Unknown error occurred'}`;
        toast.update(generationToastId, { render: errorMessage, type: 'error', autoClose: 5000, closeButton: true });
        setGenerationStats(prev => [...prev, {
          timestamp: Date.now(),
          scriptLength: resumeState.dialogueChunks.reduce((sum, chunk) => sum + chunk.text.length, 0),
          characterCount: resumeState.dialogueChunks.length,
          estimatedCost: (resumeState.dialogueChunks.reduce((sum, chunk) => sum + chunk.text.length, 0) / 1000) * 0.15,
          duration: duration,
          status: 'error',
        }]);
      }
      setIsLoading(false);
      setAbortController(null);
    }
  };

  const handleShare = () => {
    const configToShare = {
      scriptText,
      characterConfigs,
      projectSettings,
      sfxConfigs,
    };
    const encodedConfig = serializeConfig(configToShare);
    const shareableLink = `${window.location.origin}?config=${encodedConfig}`;
    navigator.clipboard.writeText(shareableLink);
    toast.success('Shareable link copied to clipboard!', { autoClose: 3000 });
  };

  return (
    <div className="bg-primary text-text-primary min-h-screen font-sans">
      <ToastContainer position="bottom-right" />
      <header className="bg-secondary p-4 shadow-md flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-highlight">Script-to-Audio</h1>
          <p className="text-text-secondary">Bring your screenplay to life with AI-powered voice generation.</p>
        </div>
        <div className="flex items-center space-x-2">
          <label htmlFor="user-select" className="text-text-secondary">User:</label>
          <select
            id="user-select"
            value={currentUser}
            onChange={(e) => setCurrentUser(e.target.value)}
            className="p-2 bg-primary border border-accent rounded-md focus:outline-none focus:ring-2 focus:ring-highlight"
          >
            <option value="default">Default User</option>
            <option value="user1">User 1</option>
            <option value="user2">User 2</option>
            {/* Add more user options as needed */}
          </select>
        </div>
      </header>
      
      <main className="p-4 md:p-8 grid grid-cols-1 xl:grid-cols-3 gap-8">
        <div className="xl:col-span-2 flex flex-col gap-8">
          <ScriptInput 
            scriptText={scriptText} 
            setScriptText={setScriptText}
            onExpand={handleExpand}
          />
          <StatisticsPanel generationStats={generationStats} />
        </div>

        <aside className="xl:col-span-1 flex flex-col gap-8">
            <ApiKeyPanel apiKey={apiKey} setApiKey={setApiKey} />
            <ProjectSettingsPanel settings={projectSettings} setSettings={setProjectSettings} />
            <SfxPanel sfxConfigs={sfxConfigs} setSfxConfigs={setSfxConfigs} />
            <CharacterConfigPanel characters={characters} configs={characterConfigs} setConfigs={setCharacterConfigs} apiKey={apiKey} modelId={projectSettings.model} refreshVoiceListToggle={refreshVoiceListToggle} />
            <VoiceCloningPanel apiKey={apiKey} onVoiceAdded={handleVoiceAdded} />
            <GeneratePanel 
              onGenerate={handleGenerate}
              onCancel={handleCancel}
              onShare={handleShare}
              isGenerating={isLoading}
              canGenerate={scriptText.length > 0 && apiKey.length > 0 && characters.length > 0}
              estimatedCost={estimatedCost}
            />
            {resumeState && (
              <button
                onClick={handleResume}
                className="w-full bg-highlight text-white font-bold py-3 px-4 rounded-md hover:bg-highlight-dark focus:outline-none focus:ring-2 focus:ring-highlight-dark focus:ring-opacity-50 transition-colors disabled:opacity-50"
                disabled={isLoading}
              >
                Resume Generation
              </button>
            )}
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
