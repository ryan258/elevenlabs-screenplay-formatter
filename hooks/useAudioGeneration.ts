import { useCallback } from 'react';
import { AudioProductionSettings, CharacterConfigs, DialogueChunk, GeneratedBlob, ProjectSettings } from '../types';
import useAppStore from '../store/useAppStore';
import { generateAllAudio, GenerationError, GenerationProgress } from '../utils/elevenLabsApi';
import { validateConfiguration } from '../utils/scriptGenerator';
import { buildManifestEntries } from '../utils/manifest';
import { serializeGeneratedBlobs } from '../utils/blobSerialization';
import { buildZipBundle, downloadFile } from '../utils/downloads';
import { slugify } from '../utils/stringUtils';

interface UseAudioGenerationParams {
  dialogueChunks: DialogueChunk[];
  characterConfigs: CharacterConfigs;
  projectSettings: ProjectSettings;
  apiKey: string;
  audioProduction: AudioProductionSettings;
  pendingBlobs: GeneratedBlob[];
  addToast: (message: string, tone?: 'info' | 'success' | 'error') => void;
}

export const useAudioGeneration = ({
  dialogueChunks,
  characterConfigs,
  projectSettings,
  apiKey,
  audioProduction,
  pendingBlobs,
  addToast
}: UseAudioGenerationParams) => {
  const {
    setIsGenerating,
    setProgressMessages,
    appendProgressMessages,
    setGeneratedOutput,
    setResumeInfo,
    setErrorInfo,
    setCurrentProgress,
    setManifestEntries,
    setPendingBlobsSerialized,
    setLastGeneratedBlobsSerialized,
    resumeInfo
  } = useAppStore(state => ({
    setIsGenerating: state.setIsGenerating,
    setProgressMessages: state.setProgressMessages,
    appendProgressMessages: state.appendProgressMessages,
    setGeneratedOutput: state.setGeneratedOutput,
    setResumeInfo: state.setResumeInfo,
    setErrorInfo: state.setErrorInfo,
    setCurrentProgress: state.setCurrentProgress,
    setManifestEntries: state.setManifestEntries,
    setPendingBlobsSerialized: state.setPendingBlobsSerialized,
    setLastGeneratedBlobsSerialized: state.setLastGeneratedBlobsSerialized,
    resumeInfo: state.resumeInfo
  }));
  const cachedBlobs = pendingBlobs;

  const runGeneration = useCallback(async (startIndex = 0, existingBlobs: GeneratedBlob[] = []) => {
    setIsGenerating(true);
    if (startIndex === 0) {
      setProgressMessages([]);
    }
    setGeneratedOutput('');
    setErrorInfo(null);
    setResumeInfo(null);

    try {
      const validation = validateConfiguration(dialogueChunks, characterConfigs, apiKey);
      if (!validation.valid) {
        const message = `❌ Configuration Errors:\n\n${validation.errors.join('\n')}\n\nPlease fix these issues and try again.`;
        setGeneratedOutput(message);
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
      const versionSlug = projectSettings.versionLabel ? slugify(projectSettings.versionLabel) : undefined;

      const { blobs, concatenationFailed } = await generateAllAudio(
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

      const successMessage = projectSettings.concatenate
        ? concatenationFailed
          ? `\n⚠ Generation finished, but concatenation failed.\n\nAll ${dialogueChunks.length} audio files were generated. The concatenation server returned an error, so a ZIP with individual clips was downloaded instead.`
          : `\n✅ Generation Complete!\n\nAll ${dialogueChunks.length} audio files have been generated and concatenated into a single file.\nCheck your Downloads folder for "concatenated_audio.mp3".`
        : `\n✅ Generation Complete!\n\nAll ${dialogueChunks.length} audio files have been generated and bundled into a ZIP archive.\nCheck your Downloads folder for the ZIP file.`;
      appendProgressMessages(successMessage);
      setGeneratedOutput(successMessage);
      setPendingBlobsSerialized([]);
      setResumeInfo(null);
      setErrorInfo(null);
      setCurrentProgress({ current: 0, total: 0, character: '', snippet: '' });

      if (!projectSettings.concatenate || concatenationFailed) {
        const zipBlob = await buildZipBundle(blobs, manifest);
        downloadFile(zipBlob, `elevenlabs_audio_${Date.now()}.zip`);
        if (projectSettings.concatenate && concatenationFailed) {
          addToast('Concatenation failed. Downloaded ZIP with individual files instead.', 'error');
        } else {
          addToast('Generation complete (ZIP downloaded)', 'success');
        }
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
        const serialized = await serializeGeneratedBlobs(error.completedBlobs);
        setPendingBlobsSerialized(serialized);
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
  }, [
    addToast,
    appendProgressMessages,
    audioProduction,
    characterConfigs,
    dialogueChunks,
    projectSettings,
    apiKey,
    setIsGenerating,
    setProgressMessages,
    setGeneratedOutput,
    setErrorInfo,
    setResumeInfo,
    setCurrentProgress,
    setManifestEntries,
    setPendingBlobsSerialized,
    setLastGeneratedBlobsSerialized
  ]);

  const handleGenerate = useCallback(() => {
    runGeneration(0, []);
  }, [runGeneration]);

  const handleResume = useCallback(() => {
    if (resumeInfo) {
      runGeneration(resumeInfo.index, cachedBlobs);
    }
  }, [cachedBlobs, resumeInfo, runGeneration]);

  return {
    handleGenerate,
    handleResume
  };
};
