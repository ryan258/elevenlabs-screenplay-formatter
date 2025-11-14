import React, { useCallback, useEffect, useMemo, useState } from 'react';
import ScriptInput from './components/ScriptInput';
import ApiKeyPanel from './components/ApiKeyPanel';
import CharacterConfigPanel from './components/CharacterConfigPanel';
import ProjectSettingsPanel from './components/ProjectSettingsPanel';
import GeneratePanel from './components/GeneratePanel';
import OutputDisplay from './components/OutputDisplay';
import ParserDiagnosticsPanel from './components/ParserDiagnosticsPanel';
import Modal from './components/Modal';
import { useScriptParser } from './hooks/useScriptParser';
import { AppStateSnapshot, CharacterConfigs, GeneratedBlob, ProjectSettings, ResumeInfo } from './types';
import { validateConfiguration } from './utils/scriptGenerator';
import { generateAllAudio, GenerationError, GenerationProgress, getConcatenationHealthUrl } from './utils/elevenLabsApi';
import ConcatenationStatus from './components/ConcatenationStatus';

const STORAGE_KEY = 'elevenlabs_formatter_state';
const MAX_PROGRESS_MESSAGES = 200;
const CONCATENATION_ENDPOINT = import.meta.env?.VITE_CONCAT_SERVER_URL || 'http://localhost:3001/concatenate';

// Implemented the main App component to structure the application and manage state.
function App() {
  const [scriptText, setScriptText] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { characters, dialogueChunks, diagnostics } = useScriptParser(scriptText);
  const [apiKey, setApiKey] = useState(process.env.ELEVENLABS_API_KEY || '');
  const [characterConfigs, setCharacterConfigs] = useState<CharacterConfigs>({});
  const [projectSettings, setProjectSettings] = useState<ProjectSettings>({
    model: 'eleven_multilingual_v2',
    outputFormat: 'mp3_44100_128',
    concatenate: true,
    speakParentheticals: false
  });
  const [generatedOutput, setGeneratedOutput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [progressMessages, setProgressMessages] = useState<string[]>([]);
  const [isStateHydrated, setIsStateHydrated] = useState(false);
  const [rememberApiKey, setRememberApiKey] = useState(true);
  const [resumeInfo, setResumeInfo] = useState<ResumeInfo | null>(null);
  const [pendingBlobs, setPendingBlobs] = useState<GeneratedBlob[]>([]);
  const [currentProgress, setCurrentProgress] = useState<{ current: number; total: number; character: string; snippet: string }>({
    current: 0,
    total: 0,
    character: '',
    snippet: ''
  });
  const [errorInfo, setErrorInfo] = useState<string | null>(null);
  const [concatStatus, setConcatStatus] = useState<'unknown' | 'checking' | 'online' | 'offline'>('unknown');

  const setProgressMessagesLimited = (updater: string[] | ((prev: string[]) => string[])) => {
    setProgressMessages(prev => {
      const next = typeof updater === 'function' ? (updater as (prev: string[]) => string[])(prev) : updater;
      return next.length > MAX_PROGRESS_MESSAGES ? next.slice(-MAX_PROGRESS_MESSAGES) : next;
    });
  };

  const handleExpand = () => setIsModalOpen(true);
  const handleCloseModal = () => setIsModalOpen(false);
  const handleModalKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault();
      handleCloseModal();
    }
  };
  const healthUrl = useMemo(() => getConcatenationHealthUrl(), []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      setIsStateHydrated(true);
      return;
    }

    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed: AppStateSnapshot = JSON.parse(stored);

        if (parsed.scriptText) {
          setScriptText(parsed.scriptText);
        }
        if (typeof parsed.rememberApiKey === 'boolean') {
          setRememberApiKey(parsed.rememberApiKey);
        }
        if (parsed.apiKey) {
          setApiKey(parsed.apiKey);
        }
        if (parsed.projectSettings) {
          setProjectSettings(prev => ({ ...prev, ...parsed.projectSettings }));
        }
        if (parsed.characterConfigs) {
          setCharacterConfigs(parsed.characterConfigs);
        }
      }
    } catch (error) {
      console.warn('Failed to hydrate saved state:', error);
    } finally {
      setIsStateHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!isStateHydrated || typeof window === 'undefined') {
      return;
    }

    const snapshot: AppStateSnapshot = {
      projectSettings,
      characterConfigs,
      scriptText,
      rememberApiKey,
    };

    if (rememberApiKey) {
      snapshot.apiKey = apiKey;
    }

    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
    } catch (error) {
      console.warn('Failed to persist state:', error);
    }
  }, [apiKey, projectSettings, characterConfigs, scriptText, rememberApiKey, isStateHydrated]);

  const handleRememberToggle = (remember: boolean) => {
    setRememberApiKey(remember);
  };

  const checkConcatenationHealth = useCallback(async () => {
    setConcatStatus('checking');
    try {
      const response = await fetch(healthUrl);
      if (!response.ok) {
        throw new Error('Server returned error status');
      }
      setConcatStatus('online');
    } catch (error) {
      console.warn('Concatenation health check failed:', error);
      setConcatStatus('offline');
    }
  }, [healthUrl]);

  useEffect(() => {
    checkConcatenationHealth().catch(() => {
      setConcatStatus('offline');
    });
  }, [checkConcatenationHealth]);

  const runGeneration = async (startIndex = 0, existingBlobs: GeneratedBlob[] = []) => {
    setIsLoading(true);
    if (startIndex === 0) {
      setProgressMessagesLimited([]);
    }
    setGeneratedOutput('');
    setErrorInfo(null);
    setResumeInfo(null);

    try {
      // Validate configuration
      const validation = validateConfiguration(dialogueChunks, characterConfigs, apiKey);

      if (!validation.valid) {
        setGeneratedOutput(`❌ Configuration Errors:\n\n${validation.errors.join('\n')}\n\nPlease fix these issues and try again.`);
        setIsLoading(false);
        return;
      }

      const modeMessage = startIndex === 0
        ? `🚀 Starting audio generation...\n\nTotal dialogue chunks: ${dialogueChunks.length}\nCharacters: ${Object.keys(characterConfigs).join(', ')}\nModel: ${projectSettings.model}\nConcatenate: ${projectSettings.concatenate ? 'Yes' : 'No'}\n\n`
        : `🔁 Resuming generation from chunk ${startIndex + 1} (${dialogueChunks[startIndex]?.character || 'Unknown'})`;
      setProgressMessagesLimited(prev => startIndex === 0 ? [modeMessage] : [...prev, modeMessage]);

      const preparedChunks = dialogueChunks.map(chunk => ({
        ...chunk,
        text: projectSettings.speakParentheticals && chunk.originalText ? chunk.originalText : chunk.text
      }));

      // Generate all audio files
      await generateAllAudio(
        preparedChunks,
        characterConfigs,
        apiKey,
        projectSettings.model,
        projectSettings.outputFormat,
        projectSettings.concatenate,
        (progress: GenerationProgress, current: number, total: number) => {
          setProgressMessagesLimited(prev => [...prev, `[${current}/${total}] ${progress.message}`]);
          setCurrentProgress({
            current,
            total,
            character: progress.currentCharacter,
            snippet: progress.snippet || ''
          });
        },
        {
          startIndex,
          existingBlobs
        }
      );

      // Success message
      const successMessage = projectSettings.concatenate
        ? `\n✅ Generation Complete!\n\nAll ${dialogueChunks.length} audio files have been generated and concatenated into a single file.\nCheck your Downloads folder for "concatenated_audio.mp3".`
        : `\n✅ Generation Complete!\n\nAll ${dialogueChunks.length} audio files have been generated and downloaded.\nCheck your Downloads folder for the audio files.`;
      setProgressMessagesLimited(prev => [...prev, successMessage]);
      setGeneratedOutput(successMessage);
      setPendingBlobs([]);
      setResumeInfo(null);
      setErrorInfo(null);
      setCurrentProgress({ current: 0, total: 0, character: '', snippet: '' });
      setIsLoading(false);

    } catch (error) {
      console.error('Generation error:', error);
      if (error instanceof GenerationError) {
        const resumeMessage = `❌ Error on chunk ${error.failedIndex + 1} (${error.failedCharacter}). Fix the issue and press Resume to continue from this point.`;
        setProgressMessagesLimited(prev => [...prev, resumeMessage]);
        setGeneratedOutput(resumeMessage);
        setResumeInfo({ index: error.failedIndex, character: error.failedCharacter });
        if (projectSettings.concatenate) {
          setPendingBlobs(error.completedBlobs);
        }
        setErrorInfo(resumeMessage);
      } else {
        const errorMessage = `❌ Error during generation:\n\n${error instanceof Error ? error.message : 'Unknown error occurred'}`;
        setProgressMessagesLimited(prev => [...prev, errorMessage]);
        setGeneratedOutput(errorMessage);
        setErrorInfo(errorMessage);
      }
      setIsLoading(false);
    }
  };

  const handleGenerate = () => runGeneration(0, []);
  const handleResume = () => {
    if (resumeInfo) {
      runGeneration(resumeInfo.index, pendingBlobs);
    }
  };

  const progressPercent = currentProgress.total > 0
    ? Math.min(100, Math.round((currentProgress.current / currentProgress.total) * 100))
    : 0;
  const canGenerate = scriptText.length > 0 && apiKey.length > 0 && characters.length > 0;

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
          <OutputDisplay
            generatedOutput={generatedOutput}
            isLoading={isLoading}
            progressMessages={progressMessages}
            progressPercent={progressPercent}
            currentCharacter={currentProgress.character}
            currentSnippet={currentProgress.snippet}
            errorMessage={errorInfo}
            onResume={resumeInfo ? handleResume : undefined}
            resumeInfo={resumeInfo}
          />
          <ParserDiagnosticsPanel
            chunks={dialogueChunks}
            unmatchedLines={diagnostics.unmatchedLines}
          />
        </div>

        <aside className="xl:col-span-1 flex flex-col gap-8">
            <ApiKeyPanel
              apiKey={apiKey}
              setApiKey={setApiKey}
              rememberApiKey={rememberApiKey}
              onRememberChange={handleRememberToggle}
            />
            <ProjectSettingsPanel
              settings={projectSettings}
              setSettings={setProjectSettings}
            />
            <ConcatenationStatus
              status={concatStatus}
              onCheck={checkConcatenationHealth}
              endpoint={CONCATENATION_ENDPOINT}
              healthUrl={healthUrl}
            />
            <CharacterConfigPanel characters={characters} configs={characterConfigs} setConfigs={setCharacterConfigs} />
            <GeneratePanel 
              onGenerate={handleGenerate}
              isGenerating={isLoading}
              canGenerate={canGenerate}
              onResume={resumeInfo ? handleResume : undefined}
              resumeInfo={resumeInfo}
            />
        </aside>
      </main>

      <Modal isOpen={isModalOpen} onClose={handleCloseModal} title="Screenplay Editor">
        <textarea
          value={scriptText}
          onChange={(e) => setScriptText(e.target.value)}
          placeholder="Paste your screenplay here..."
          onKeyDown={handleModalKeyDown}
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
