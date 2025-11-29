import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ScriptInput from './components/ScriptInput';
import ApiKeyPanel from './components/ApiKeyPanel';
import CharacterConfigPanel from './components/CharacterConfigPanel';
import ProjectSettingsPanel from './components/ProjectSettingsPanel';
import GeneratePanel from './components/GeneratePanel';
import OutputDisplay from './components/OutputDisplay';
import ParserDiagnosticsPanel from './components/ParserDiagnosticsPanel';
import TimelinePanel from './components/TimelinePanel';
import GenerationProfilesPanel from './components/GenerationProfilesPanel';
import ExportPanel from './components/ExportPanel';
import Modal from './components/Modal';
import { useScriptParser } from './hooks/useScriptParser';
import { useAudioGeneration } from './hooks/useAudioGeneration';
import { CharacterConfigs, ProjectConfig, VoiceSettings } from './types';
import { generateAudioFile, getConcatenationHealthUrl } from './utils/elevenLabsApi';
import { manifestToCsv, manifestToSrt, manifestToVtt } from './utils/manifest';
import { buildReaperProject } from './utils/reaperExport';
import { fetchElevenLabsModels, fetchElevenLabsVoices } from './utils/elevenLabsClient';
import { GENERATION_PROFILES } from './config/generationProfiles';
import { isMultilingualModelId } from './config/modelOptions';
import ConcatenationStatus from './components/ConcatenationStatus';
import { demoProject } from './samples/demoProject';
import ProjectManagerPanel from './components/ProjectManagerPanel';
import VoicePresetsPanel from './components/VoicePresetsPanel';
import AudioProductionPanel from './components/AudioProductionPanel';
import VoiceSuggestionsPanel from './components/VoiceSuggestionsPanel';
import ToastContainer from './components/ToastContainer';
import useAppStore from './store/useAppStore';
import { useShallow } from 'zustand/react/shallow';
import { deserializeGeneratedBlobs } from './utils/blobSerialization';
import { buildZipBundle, downloadFile } from './utils/downloads';
import { slugify } from './utils/stringUtils';
import { notifyError } from './utils/errorHandling';
import { extractVoiceIdsFromScript } from './utils/voiceExtraction';

const CONCATENATION_ENDPOINT = import.meta.env?.VITE_CONCAT_SERVER_URL || 'http://localhost:3001/concatenate';
const DEFAULT_VOICE_SETTINGS = {
  stability: 0.5,
  similarity_boost: 0.75,
  style: 0.1,
  speed: 1
};

const encodeSharePayload = (value: string) => {
  return typeof window !== 'undefined' && window.btoa
    ? window.btoa(unescape(encodeURIComponent(value)))
    : '';
};

const decodeSharePayload = (value: string) => {
  return typeof window !== 'undefined' && window.atob
    ? decodeURIComponent(escape(window.atob(value)))
    : '';
};

// Implemented the main App component to structure the application and manage state.
function App() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { scriptText, setScriptText } = useAppStore(useShallow(state => ({
    scriptText: state.scriptText,
    setScriptText: state.setScriptText
  })));
  const { characterConfigs, setCharacterConfigs, voicePresets, setVoicePresets } = useAppStore(useShallow(state => ({
    characterConfigs: state.characterConfigs,
    setCharacterConfigs: state.setCharacterConfigs,
    voicePresets: state.voicePresets,
    setVoicePresets: state.setVoicePresets
  })));
  const { apiKey, setApiKey, rememberApiKey, setRememberApiKey, projectSettings, setProjectSettings } = useAppStore(useShallow(state => ({
    apiKey: state.apiKey,
    setApiKey: state.setApiKey,
    rememberApiKey: state.rememberApiKey,
    setRememberApiKey: state.setRememberApiKey,
    projectSettings: state.projectSettings,
    setProjectSettings: state.setProjectSettings
  })));
  const { audioProduction, setAudioProduction } = useAppStore(useShallow(state => ({
    audioProduction: state.audioProduction,
    setAudioProduction: state.setAudioProduction
  })));
  const { generatedOutput, isGenerating, progressMessages, currentProgress, errorInfo, resumeInfo, appendProgressMessages } = useAppStore(useShallow(state => ({
    generatedOutput: state.generatedOutput,
    isGenerating: state.isGenerating,
    progressMessages: state.progressMessages,
    currentProgress: state.currentProgress,
    errorInfo: state.errorInfo,
    resumeInfo: state.resumeInfo,
    appendProgressMessages: state.appendProgressMessages
  })));
  const { serializedPendingBlobs, manifestEntries, setManifestEntries, serializedLastGeneratedBlobs, setLastGeneratedBlobsSerialized } = useAppStore(useShallow(state => ({
    serializedPendingBlobs: state.serializedPendingBlobs,
    manifestEntries: state.manifestEntries,
    setManifestEntries: state.setManifestEntries,
    serializedLastGeneratedBlobs: state.serializedLastGeneratedBlobs,
    setLastGeneratedBlobsSerialized: state.setLastGeneratedBlobsSerialized
  })));
  const { concatStatus, setConcatStatus, hasHydrated, setHasHydrated, addToast } = useAppStore(useShallow(state => ({
    concatStatus: state.concatStatus,
    setConcatStatus: state.setConcatStatus,
    hasHydrated: state.hasHydrated,
    setHasHydrated: state.setHasHydrated,
    addToast: state.addToast
  })));
  const { availableVoices, setAvailableVoices, voicesStatus, setVoicesStatus, availableModels, setAvailableModels, modelsStatus, setModelsStatus } = useAppStore(useShallow(state => ({
    availableVoices: state.availableVoices,
    setAvailableVoices: state.setAvailableVoices,
    voicesStatus: state.voicesStatus,
    setVoicesStatus: state.setVoicesStatus,
    availableModels: state.availableModels,
    setAvailableModels: state.setAvailableModels,
    modelsStatus: state.modelsStatus,
    setModelsStatus: state.setModelsStatus
  })));
  const { characters, dialogueChunks, diagnostics } = useScriptParser(scriptText);
  const [timelinePreviews, setTimelinePreviews] = useState<Record<number, { loading?: boolean; url?: string; error?: string }>>({});
  const previewUrlsRef = useRef<string[]>([]);
  const cleanupPreviewUrls = useCallback(() => {
    previewUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
    previewUrlsRef.current = [];
  }, []);
  const releasePreviewUrl = useCallback((url?: string) => {
    if (!url) {
      return;
    }
    URL.revokeObjectURL(url);
    previewUrlsRef.current = previewUrlsRef.current.filter(existing => existing !== url);
  }, []);
  const pendingBlobs = useMemo(() => deserializeGeneratedBlobs(serializedPendingBlobs), [serializedPendingBlobs]);
  const lastGeneratedBlobs = useMemo(() => deserializeGeneratedBlobs(serializedLastGeneratedBlobs), [serializedLastGeneratedBlobs]);
  const { handleGenerate, handleResume } = useAudioGeneration({
    dialogueChunks,
    characterConfigs,
    projectSettings,
    apiKey,
    audioProduction,
    pendingBlobs,
    addToast
  });
  const handleLoadProjectConfig = useCallback((config: ProjectConfig) => {
    if (config.scriptText !== undefined) {
      setScriptText(config.scriptText);
    }
    if (config.characterConfigs) {
      setCharacterConfigs(config.characterConfigs);
    }
    if (config.projectSettings) {
      setProjectSettings(prev => ({ ...prev, ...config.projectSettings }));
    }
    if (config.voicePresets) {
      setVoicePresets(config.voicePresets);
    }
    if (config.audioProduction) {
      setAudioProduction({
        backgroundTrack: config.audioProduction.backgroundTrack
          ? {
            volume: config.audioProduction.backgroundTrack.volume,
            filename: config.audioProduction.backgroundTrack.filename,
            file: undefined
          }
          : undefined,
        soundEffects: config.audioProduction.soundEffects?.map(effect => ({
          ...effect,
          file: undefined
        })) ?? []
      });
    } else {
      setAudioProduction({ soundEffects: [] });
    }
  }, [setAudioProduction, setCharacterConfigs, setProjectSettings, setScriptText, setVoicePresets]);
  useEffect(() => {
    const persist = (useAppStore as typeof useAppStore & { persist?: { hasHydrated?: () => boolean } }).persist;
    if (persist?.hasHydrated?.()) {
      setHasHydrated(true);
    }
  }, [setHasHydrated]);
  useEffect(() => {
    if (!hasHydrated) {
      return;
    }
    if (!apiKey && process.env.ELEVENLABS_API_KEY) {
      setApiKey(process.env.ELEVENLABS_API_KEY);
    }
  }, [hasHydrated, apiKey, setApiKey]);

  useEffect(() => {
    if (projectSettings.languageCode && projectSettings.languageCode !== 'en' && !isMultilingualModelId(projectSettings.model)) {
      setProjectSettings(prev => ({ ...prev, model: 'eleven_multilingual_v2' }));
    }
  }, [projectSettings.languageCode, projectSettings.model, setProjectSettings]);

  useEffect(() => {
    if (!hasHydrated || typeof window === 'undefined') {
      return;
    }
    const params = new URLSearchParams(window.location.search);
    const sharedProject = params.get('project');
    if (!sharedProject) {
      return;
    }
    try {
      const decoded = decodeSharePayload(decodeURIComponent(sharedProject));
      if (!decoded) {
        throw new Error('Invalid payload');
      }
      const parsed = JSON.parse(decoded) as ProjectConfig;
      handleLoadProjectConfig(parsed);
      addToast('Shared project loaded', 'success');
    } catch (error) {
      notifyError('Load shared project', error, addToast, 'Failed to load shared project');
    } finally {
      params.delete('project');
      const nextQuery = params.toString();
      const newUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ''}`;
      window.history.replaceState({}, document.title, newUrl);
    }
  }, [hasHydrated, handleLoadProjectConfig, addToast]);

  useEffect(() => {
    if (!apiKey) {
      setAvailableVoices([]);
      setVoicesStatus('idle');
      return;
    }
    const controller = new AbortController();
    setVoicesStatus('loading');
    fetchElevenLabsVoices(apiKey, controller.signal)
      .then(voices => {
        setAvailableVoices(voices);
        setVoicesStatus('ready');
      })
      .catch(error => {
        if (controller.signal.aborted) {
          return;
        }
        setVoicesStatus('error');
        notifyError('Fetch voices', error, addToast, 'Unable to load ElevenLabs voices.');
      });
    return () => {
      controller.abort();
    };
  }, [apiKey, setAvailableVoices, setVoicesStatus, addToast]);

  useEffect(() => {
    if (!apiKey) {
      setAvailableModels([]);
      setModelsStatus('idle');
      return;
    }
    const controller = new AbortController();
    setModelsStatus('loading');
    fetchElevenLabsModels(apiKey, controller.signal)
      .then(models => {
        setAvailableModels(models);
        setModelsStatus('ready');
      })
      .catch(error => {
        if (controller.signal.aborted) {
          return;
        }
        setModelsStatus('error');
        notifyError('Fetch models', error, undefined, 'Unable to load ElevenLabs models.');
      });
    return () => {
      controller.abort();
    };
  }, [apiKey, setAvailableModels, setModelsStatus]);

  const handleExpand = () => setIsModalOpen(true);
  const handleCloseModal = () => setIsModalOpen(false);
  const handleModalKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault();
      handleCloseModal();
    }
  };
  const healthUrl = useMemo(() => getConcatenationHealthUrl(), []);

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
      notifyError('Concatenation health', error);
      setConcatStatus('offline');
    }
  }, [healthUrl, setConcatStatus]);

  useEffect(() => {
    checkConcatenationHealth().catch(() => {
      setConcatStatus('offline');
    });
  }, [checkConcatenationHealth, setConcatStatus]);

  useEffect(() => {
    return () => {
      cleanupPreviewUrls();
    };
  }, [cleanupPreviewUrls]);

  useEffect(() => {
    cleanupPreviewUrls();
    setTimelinePreviews({});
    setManifestEntries([]);
    setLastGeneratedBlobsSerialized([]);
  }, [scriptText, cleanupPreviewUrls, setManifestEntries, setLastGeneratedBlobsSerialized]);

  const buildProjectConfig = (): ProjectConfig => ({
    version: '0.3.0',
    scriptText,
    characterConfigs,
    projectSettings,
    voicePresets,
    audioProduction: {
      backgroundTrack: audioProduction.backgroundTrack
        ? {
          volume: audioProduction.backgroundTrack.volume,
          filename: audioProduction.backgroundTrack.filename
        }
        : undefined,
      soundEffects: audioProduction.soundEffects.map(effect => ({
        id: effect.id,
        label: effect.label,
        startTimeMs: effect.startTimeMs,
        volume: effect.volume,
        filename: effect.filename
      }))
    }
  });

  const downloadJson = (data: unknown, filename: string) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadProject = () => {
    downloadJson(buildProjectConfig(), 'elevenlabs_project.json');
    addToast('Project file downloaded', 'success');
  };

  const handleCopyShareLink = async () => {
    if (typeof window === 'undefined' || !navigator?.clipboard) {
      addToast('Clipboard is unavailable in this environment', 'error');
      return;
    }
    try {
      const encoded = encodeSharePayload(JSON.stringify(buildProjectConfig()));
      if (!encoded) {
        throw new Error('Encoding failed');
      }
      const shareUrl = `${window.location.origin}${window.location.pathname}?project=${encodeURIComponent(encoded)}`;
      await navigator.clipboard.writeText(shareUrl);
      addToast('Shareable link copied to clipboard', 'success');
    } catch (error) {
      notifyError('Copy share link', error, addToast, 'Failed to copy share link');
    }
  };

  const handleLoadDemoProject = () => {
    handleLoadProjectConfig(demoProject);
    addToast('Demo project loaded', 'success');
  };

  const handleLoadProjectFromFile = async (file: File) => {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as ProjectConfig;
      handleLoadProjectConfig(parsed);
      appendProgressMessages('📁 Project loaded from file.');
      addToast('Project loaded from file', 'success');
    } catch (error) {
      const message = notifyError('Load project file', error, addToast, 'Failed to load project file');
      appendProgressMessages(`❌ Failed to load project: ${message}`);
    }
  };

  const handleSaveVoicePreset = (presetName: string, sourceCharacter: string) => {
    const trimmedName = presetName.trim();
    if (!trimmedName) {
      return;
    }
    const source = characterConfigs[sourceCharacter];
    if (!source) {
      return;
    }
    setVoicePresets(prev => ({
      ...prev,
      [trimmedName]: {
        voiceId: source.voiceId,
        voiceSettings: { ...source.voiceSettings }
      }
    }));
  };

  const handleDeletePreset = (presetName: string) => {
    setVoicePresets(prev => {
      const next = { ...prev };
      delete next[presetName];
      return next;
    });
  };

  const handleApplyPresetToCharacter = (presetName: string, character: string) => {
    const preset = voicePresets[presetName];
    if (!preset) {
      return;
    }
    setCharacterConfigs(prev => ({
      ...prev,
      [character]: {
        voiceId: preset.voiceId,
        voiceSettings: { ...preset.voiceSettings }
      }
    }));
  };

  const handleApplyPresetToAll = (presetName: string) => {
    const preset = voicePresets[presetName];
    if (!preset) {
      return;
    }
    const nextConfigs: CharacterConfigs = {};
    characters.forEach(char => {
      nextConfigs[char] = {
        voiceId: preset.voiceId,
        voiceSettings: { ...preset.voiceSettings }
      };
    });
    setCharacterConfigs(nextConfigs);
  };

  const handleSelectProfile = (profileId: string) => {
    const profile = GENERATION_PROFILES.find(p => p.id === profileId);
    if (!profile) {
      return;
    }
    setProjectSettings(prev => ({
      ...prev,
      ...profile.settings,
      profileId,
      requestDelayMs: profile.requestDelayMs
    }));
  };

  const handleApplyVoiceSuggestion = (character: string, suggestion: { voiceId: string; voiceSettings?: VoiceSettings; name?: string }) => {
    if (!character) {
      return;
    }
    const desiredSettings = suggestion.voiceSettings || DEFAULT_VOICE_SETTINGS;
    setCharacterConfigs(prev => ({
      ...prev,
      [character]: {
        voiceId: suggestion.voiceId,
        voiceSettings: { ...(prev[character]?.voiceSettings || DEFAULT_VOICE_SETTINGS), ...desiredSettings }
      }
    }));
    addToast(`Applied ${suggestion.name || 'voice'} to ${character}`, 'success');
  };

  const handleApplyCustomVoice = (character: string, voice: { voiceId: string; name?: string }) => {
    if (!character || !voice.voiceId) {
      return;
    }
    setCharacterConfigs(prev => ({
      ...prev,
      [character]: {
        voiceId: voice.voiceId,
        voiceSettings: prev[character]?.voiceSettings || { ...DEFAULT_VOICE_SETTINGS }
      }
    }));
    addToast(`Applied ${voice.name || 'custom voice'} to ${character}`, 'success');
  };

  const handleAutoFillVoiceIds = () => {
    const extracted = extractVoiceIdsFromScript(scriptText);
    const count = Object.keys(extracted).length;

    if (count === 0) {
      addToast('No Voice IDs found in script', 'error');
      return;
    }

    setCharacterConfigs(prev => {
      const next = { ...prev };
      Object.entries(extracted).forEach(([char, voiceId]) => {
        // Normalize character name to match keys in characterConfigs (uppercase)
        const normalizedChar = char.toUpperCase();

        // Only update if we have a valid voice ID and it's different
        if (voiceId) {
          next[normalizedChar] = {
            ...(next[normalizedChar] || { voiceSettings: { ...DEFAULT_VOICE_SETTINGS } }),
            voiceId: voiceId
          };
        }
      });
      return next;
    });

    addToast(`Found and applied ${count} Voice IDs`, 'success');
  };

  const handlePreviewLine = async (index: number) => {
    const chunk = dialogueChunks[index];
    if (!chunk || !apiKey) {
      return;
    }
    const config = characterConfigs[chunk.character];
    if (!config || !config.voiceId) {
      setTimelinePreviews(prev => ({
        ...prev,
        [index]: { loading: false, url: prev[index]?.url, error: 'Missing voice ID' }
      }));
      return;
    }

    setTimelinePreviews(prev => ({
      ...prev,
      [index]: { ...prev[index], loading: true, error: undefined }
    }));

    try {
      const text = projectSettings.speakParentheticals && chunk.originalText ? chunk.originalText : chunk.text;
      const { blob } = await generateAudioFile(
        { ...chunk, text },
        config,
        apiKey,
        projectSettings.model,
        projectSettings.outputFormat
      );
      const url = URL.createObjectURL(blob);
      previewUrlsRef.current.push(url);
      setTimelinePreviews(prev => {
        const previousUrl = prev[index]?.url;
        if (previousUrl) {
          releasePreviewUrl(previousUrl);
        }
        return {
          ...prev,
          [index]: { loading: false, url }
        };
      });
    } catch (error) {
      setTimelinePreviews(prev => ({
        ...prev,
        [index]: {
          loading: false,
          url: prev[index]?.url,
          error: error instanceof Error ? error.message : 'Preview failed'
        }
      }));
    }
  };

  const handleDownloadManifestJson = () => {
    if (!manifestEntries.length) return;
    const blob = new Blob([JSON.stringify(manifestEntries, null, 2)], { type: 'application/json' });
    downloadFile(blob, 'manifest.json');
  };

  const handleDownloadManifestCsv = () => {
    if (!manifestEntries.length) return;
    const csv = manifestToCsv(manifestEntries);
    const blob = new Blob([csv], { type: 'text/csv' });
    downloadFile(blob, 'manifest.csv');
  };

  const handleDownloadSrt = () => {
    if (!manifestEntries.length) return;
    const srt = manifestToSrt(manifestEntries);
    const blob = new Blob([srt], { type: 'text/plain' });
    downloadFile(blob, 'subtitles.srt');
  };

  const handleDownloadVtt = () => {
    if (!manifestEntries.length) return;
    const vtt = manifestToVtt(manifestEntries);
    const blob = new Blob([vtt], { type: 'text/vtt' });
    downloadFile(blob, 'subtitles.vtt');
  };

  const handleDownloadZip = async () => {
    if (!manifestEntries.length || !lastGeneratedBlobs.length) return;
    const zippedBlob = await buildZipBundle(lastGeneratedBlobs, manifestEntries);
    downloadFile(zippedBlob, `elevenlabs_export_${Date.now()}.zip`);
  };

  const handleDownloadReaperTemplate = () => {
    if (!manifestEntries.length) return;
    const projectLabel = projectSettings.versionLabel?.trim() || 'elevenlabs_session';
    const rpp = buildReaperProject(manifestEntries, projectLabel);
    const blob = new Blob([rpp], { type: 'text/plain' });
    downloadFile(blob, `${slugify(projectLabel)}.rpp`);
  };

  // audio generation handled by useAudioGeneration hook

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
          <TimelinePanel
            chunks={dialogueChunks}
            previewStates={timelinePreviews}
            onPreview={handlePreviewLine}
            timings={manifestEntries}
          />
          <OutputDisplay
            generatedOutput={generatedOutput}
            isLoading={isGenerating}
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
          <CharacterConfigPanel
            characters={characters}
            configs={characterConfigs}
            setConfigs={setCharacterConfigs}
            voicePresets={voicePresets}
            onApplyPresetToCharacter={handleApplyPresetToCharacter}
            onApplyPresetToAll={handleApplyPresetToAll}
            onAutoFill={handleAutoFillVoiceIds}
          />
          <ApiKeyPanel
            apiKey={apiKey}
            setApiKey={setApiKey}
            rememberApiKey={rememberApiKey}
            onRememberChange={handleRememberToggle}
          />
          <ProjectSettingsPanel
            settings={projectSettings}
            setSettings={setProjectSettings}
            modelOptions={availableModels}
            modelsStatus={modelsStatus}
          />
          <AudioProductionPanel
            audioProduction={audioProduction}
            onChange={(updater) => setAudioProduction(updater)}
          />
          <GenerationProfilesPanel
            selectedProfileId={projectSettings.profileId}
            onSelectProfile={handleSelectProfile}
          />
          <ProjectManagerPanel
            onDownloadProject={() => handleDownloadProject()}
            onLoadProjectFile={(file) => handleLoadProjectFromFile(file)}
            onLoadDemo={handleLoadDemoProject}
            onCopyShareLink={handleCopyShareLink}
            metadata={{
              characters: characters.length,
              dialogueChunks: dialogueChunks.length,
              unmatched: diagnostics.unmatchedLines.length,
              versionLabel: projectSettings.versionLabel
            }}
          />
          <VoicePresetsPanel
            characters={characters}
            characterConfigs={characterConfigs}
            voicePresets={voicePresets}
            onSavePreset={handleSaveVoicePreset}
            onDeletePreset={handleDeletePreset}
          />
          <VoiceSuggestionsPanel
            languageCode={projectSettings.languageCode}
            characters={characters}
            onApplySuggestion={handleApplyVoiceSuggestion}
            customVoices={availableVoices}
            voicesStatus={voicesStatus}
            onApplyCustomVoice={handleApplyCustomVoice}
          />
          <ExportPanel
            manifestEntries={manifestEntries}
            onDownloadJson={handleDownloadManifestJson}
            onDownloadCsv={handleDownloadManifestCsv}
            onDownloadZip={handleDownloadZip}
            onDownloadSrt={handleDownloadSrt}
            onDownloadVtt={handleDownloadVtt}
            onDownloadReaper={handleDownloadReaperTemplate}
          />
          <ConcatenationStatus
            status={concatStatus}
            onCheck={checkConcatenationHealth}
            endpoint={CONCATENATION_ENDPOINT}
            healthUrl={healthUrl}
          />

          <GeneratePanel
            onGenerate={handleGenerate}
            isGenerating={isGenerating}
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
      <ToastContainer />
    </div>
  );
}

export default App;
