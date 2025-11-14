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
import { CharacterConfigs, GeneratedBlob, ManifestEntry, ProjectConfig, ProjectSettings, ResumeInfo, VoicePresets, VoiceSettings } from './types';
import { validateConfiguration } from './utils/scriptGenerator';
import { generateAllAudio, generateAudioFile, GenerationError, GenerationProgress, getConcatenationHealthUrl } from './utils/elevenLabsApi';
import { buildManifestEntries, manifestToCsv, manifestToSrt, manifestToVtt } from './utils/manifest';
import { fetchElevenLabsVoices } from './utils/elevenLabsClient';
import { GENERATION_PROFILES } from './config/generationProfiles';
import JSZip from 'jszip';
import ConcatenationStatus from './components/ConcatenationStatus';
import { demoProject } from './samples/demoProject';
import ProjectManagerPanel from './components/ProjectManagerPanel';
import VoicePresetsPanel from './components/VoicePresetsPanel';
import AudioProductionPanel from './components/AudioProductionPanel';
import VoiceSuggestionsPanel from './components/VoiceSuggestionsPanel';
import ToastContainer from './components/ToastContainer';
import useAppStore from './store/useAppStore';
import { useShallow } from 'zustand/react/shallow';
import { deserializeGeneratedBlobs, serializeGeneratedBlobs } from './utils/blobSerialization';

const CONCATENATION_ENDPOINT = import.meta.env?.VITE_CONCAT_SERVER_URL || 'http://localhost:3001/concatenate';
const DEFAULT_VOICE_SETTINGS = {
  stability: 0.5,
  similarity_boost: 0.75,
  style: 0.1,
  speed: 1
};
const slugify = (value: string) => value.replace(/[^\w]+/g, '_').replace(/^_+|_+$/g, '').toLowerCase();
const downloadFile = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
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

const buildZipBundle = async (blobs: GeneratedBlob[], manifestEntries: ManifestEntry[]) => {
  const zip = new JSZip();
  blobs.forEach(({ blob, filename }) => {
    const safeName = filename || `clip_${Date.now()}.mp3`;
    zip.file(safeName, blob);
  });
  if (manifestEntries.length) {
    zip.file('manifest.json', JSON.stringify(manifestEntries, null, 2));
    const csv = manifestToCsv(manifestEntries);
    zip.file('manifest.csv', csv);
  }
  return zip.generateAsync({ type: 'blob' });
};

// Implemented the main App component to structure the application and manage state.
function App() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const {
    scriptText,
    setScriptText,
    apiKey,
    setApiKey,
    rememberApiKey,
    setRememberApiKey,
    projectSettings,
    setProjectSettings,
    characterConfigs,
    setCharacterConfigs,
    voicePresets,
    setVoicePresets,
    audioProduction,
    setAudioProduction,
    generatedOutput,
    setGeneratedOutput,
    isGenerating,
    setIsGenerating,
    progressMessages,
    setProgressMessages,
    appendProgressMessages,
    resumeInfo,
    setResumeInfo,
    serializedPendingBlobs,
    setPendingBlobsSerialized,
    manifestEntries,
    setManifestEntries,
    serializedLastGeneratedBlobs,
    setLastGeneratedBlobsSerialized,
    currentProgress,
    setCurrentProgress,
    errorInfo,
    setErrorInfo,
    concatStatus,
    setConcatStatus,
    hasHydrated,
    setHasHydrated,
    addToast,
    availableVoices,
    setAvailableVoices,
    voicesStatus,
    setVoicesStatus
  } = useAppStore(useShallow(state => ({
    scriptText: state.scriptText,
    setScriptText: state.setScriptText,
    apiKey: state.apiKey,
    setApiKey: state.setApiKey,
    rememberApiKey: state.rememberApiKey,
    setRememberApiKey: state.setRememberApiKey,
    projectSettings: state.projectSettings,
    setProjectSettings: state.setProjectSettings,
    characterConfigs: state.characterConfigs,
    setCharacterConfigs: state.setCharacterConfigs,
    voicePresets: state.voicePresets,
    setVoicePresets: state.setVoicePresets,
    audioProduction: state.audioProduction,
    setAudioProduction: state.setAudioProduction,
    generatedOutput: state.generatedOutput,
    setGeneratedOutput: state.setGeneratedOutput,
    isGenerating: state.isGenerating,
    setIsGenerating: state.setIsGenerating,
    progressMessages: state.progressMessages,
    setProgressMessages: state.setProgressMessages,
    appendProgressMessages: state.appendProgressMessages,
    resumeInfo: state.resumeInfo,
    setResumeInfo: state.setResumeInfo,
    serializedPendingBlobs: state.serializedPendingBlobs,
    setPendingBlobsSerialized: state.setPendingBlobsSerialized,
    manifestEntries: state.manifestEntries,
    setManifestEntries: state.setManifestEntries,
    serializedLastGeneratedBlobs: state.serializedLastGeneratedBlobs,
    setLastGeneratedBlobsSerialized: state.setLastGeneratedBlobsSerialized,
    currentProgress: state.currentProgress,
    setCurrentProgress: state.setCurrentProgress,
    errorInfo: state.errorInfo,
    setErrorInfo: state.setErrorInfo,
    concatStatus: state.concatStatus,
    setConcatStatus: state.setConcatStatus,
    hasHydrated: state.hasHydrated,
    setHasHydrated: state.setHasHydrated,
    addToast: state.addToast,
    availableVoices: state.availableVoices,
    setAvailableVoices: state.setAvailableVoices,
    voicesStatus: state.voicesStatus,
    setVoicesStatus: state.setVoicesStatus
  })));
  const { characters, dialogueChunks, diagnostics } = useScriptParser(scriptText);
  const [timelinePreviews, setTimelinePreviews] = useState<Record<number, { loading?: boolean; url?: string; error?: string }>>({});
  const previewUrlsRef = useRef<string[]>([]);
  const pendingBlobs = useMemo(() => deserializeGeneratedBlobs(serializedPendingBlobs), [serializedPendingBlobs]);
  const lastGeneratedBlobs = useMemo(() => deserializeGeneratedBlobs(serializedLastGeneratedBlobs), [serializedLastGeneratedBlobs]);
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
    if (projectSettings.languageCode && projectSettings.languageCode !== 'en' && projectSettings.model !== 'eleven_multilingual_v2') {
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
      console.error('Failed to load shared project:', error);
      addToast('Failed to load shared project', 'error');
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
        console.warn('Failed to fetch ElevenLabs voices:', error);
        setVoicesStatus('error');
        addToast('Unable to load ElevenLabs voices.', 'error');
      });
    return () => {
      controller.abort();
    };
  }, [apiKey, setAvailableVoices, setVoicesStatus, addToast]);

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
      console.warn('Concatenation health check failed:', error);
      setConcatStatus('offline');
    }
  }, [healthUrl]);

  useEffect(() => {
    checkConcatenationHealth().catch(() => {
      setConcatStatus('offline');
    });
  }, [checkConcatenationHealth]);

  useEffect(() => {
    const urlsRef = previewUrlsRef.current;
    return () => {
      urlsRef.forEach(url => URL.revokeObjectURL(url));
    };
  }, []);

  useEffect(() => {
    setTimelinePreviews({});
    setManifestEntries([]);
    setLastGeneratedBlobsSerialized([]);
  }, [scriptText, setManifestEntries, setLastGeneratedBlobsSerialized]);

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
      console.error('Failed to copy share link:', error);
      addToast('Failed to copy share link', 'error');
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
      const message = error instanceof Error ? error.message : 'Invalid project file';
      appendProgressMessages(`❌ Failed to load project: ${message}`);
      addToast('Failed to load project file', 'error');
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
          URL.revokeObjectURL(previousUrl);
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

  const runGeneration = async (startIndex = 0, existingBlobs: GeneratedBlob[] = []) => {
    setIsGenerating(true);
    if (startIndex === 0) {
      setProgressMessages([]);
    }
    setGeneratedOutput('');
    setErrorInfo(null);
    setResumeInfo(null);

    try {
      // Validate configuration
      const validation = validateConfiguration(dialogueChunks, characterConfigs, apiKey);

      if (!validation.valid) {
        setGeneratedOutput(`❌ Configuration Errors:\n\n${validation.errors.join('\n')}\n\nPlease fix these issues and try again.`);
        setIsGenerating(false);
        return;
      }

      const modeMessage = startIndex === 0
        ? `🚀 Starting audio generation...\n\nTotal dialogue chunks: ${dialogueChunks.length}\nCharacters: ${Object.keys(characterConfigs).join(', ')}\nModel: ${projectSettings.model}\nConcatenate: ${projectSettings.concatenate ? 'Yes' : 'No'}\n\n`
        : `🔁 Resuming generation from chunk ${startIndex + 1} (${dialogueChunks[startIndex]?.character || 'Unknown'})`;
      if (startIndex === 0) {
        setProgressMessages([modeMessage]);
      } else {
        appendProgressMessages(modeMessage);
      }

      const preparedChunks = dialogueChunks.map(chunk => ({
        ...chunk,
        text: projectSettings.speakParentheticals && chunk.originalText ? chunk.originalText : chunk.text
      }));

      // Generate all audio files
      const versionSlug = projectSettings.versionLabel ? slugify(projectSettings.versionLabel) : undefined;
      const blobs = await generateAllAudio(
        preparedChunks,
        characterConfigs,
        apiKey,
        projectSettings.model,
        projectSettings.outputFormat,
        projectSettings.concatenate,
        (progress: GenerationProgress, current: number, total: number) => {
          appendProgressMessages(`[${current}/${total}] ${progress.message}`);
          setCurrentProgress({
            current,
            total,
            character: progress.currentCharacter,
            snippet: progress.snippet || ''
          });
        },
        {
          startIndex,
          existingBlobs,
          delayMs: projectSettings.requestDelayMs,
          filenamePrefix: versionSlug,
          audioProduction
        }
      );
      const manifest = buildManifestEntries(preparedChunks, blobs);
      setManifestEntries(manifest);
      const serialized = await serializeGeneratedBlobs(blobs);
      setLastGeneratedBlobsSerialized(serialized);

      // Success message
      const successMessage = projectSettings.concatenate
        ? `\n✅ Generation Complete!\n\nAll ${dialogueChunks.length} audio files have been generated and concatenated into a single file.\nCheck your Downloads folder for "concatenated_audio.mp3".`
        : `\n✅ Generation Complete!\n\nAll ${dialogueChunks.length} audio files have been generated and bundled into a ZIP archive.\nCheck your Downloads folder for the ZIP file.`;
      appendProgressMessages(successMessage);
      setGeneratedOutput(successMessage);
      setPendingBlobsSerialized([]);
      setResumeInfo(null);
      setErrorInfo(null);
      setCurrentProgress({ current: 0, total: 0, character: '', snippet: '' });
      if (!projectSettings.concatenate) {
        const zipBlob = await buildZipBundle(blobs, manifest);
        downloadFile(zipBlob, `elevenlabs_audio_${Date.now()}.zip`);
        addToast('Generation complete (ZIP downloaded)', 'success');
      } else {
        addToast('Generation complete', 'success');
      }
      setIsGenerating(false);

    } catch (error) {
      console.error('Generation error:', error);
      setManifestEntries([]);
      if (error instanceof GenerationError) {
        const resumeMessage = `❌ Error on chunk ${error.failedIndex + 1} (${error.failedCharacter}). Fix the issue and press Resume to continue from this point.`;
        appendProgressMessages(resumeMessage);
        setGeneratedOutput(resumeMessage);
        setResumeInfo({ index: error.failedIndex, character: error.failedCharacter });
        if (projectSettings.concatenate) {
          const serialized = await serializeGeneratedBlobs(error.completedBlobs);
          setPendingBlobsSerialized(serialized);
        }
        setErrorInfo(resumeMessage);
      } else {
        const errorMessage = `❌ Error during generation:\n\n${error instanceof Error ? error.message : 'Unknown error occurred'}`;
        appendProgressMessages(errorMessage);
        setGeneratedOutput(errorMessage);
        setErrorInfo(errorMessage);
      }
      setIsGenerating(false);
      addToast('Generation failed', 'error');
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
          <TimelinePanel
            chunks={dialogueChunks}
            previewStates={timelinePreviews}
            onPreview={handlePreviewLine}
            timings={manifestEntries}
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
            />
            <ConcatenationStatus
              status={concatStatus}
              onCheck={checkConcatenationHealth}
              endpoint={CONCATENATION_ENDPOINT}
              healthUrl={healthUrl}
            />
            <CharacterConfigPanel
              characters={characters}
              configs={characterConfigs}
              setConfigs={setCharacterConfigs}
              voicePresets={voicePresets}
              onApplyPresetToCharacter={handleApplyPresetToCharacter}
              onApplyPresetToAll={handleApplyPresetToAll}
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
