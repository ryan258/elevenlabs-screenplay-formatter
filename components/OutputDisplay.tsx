import React, { useEffect, useRef, useState } from 'react';
import { ResumeInfo } from '../types';

interface OutputDisplayProps {
  generatedOutput: string;
  isLoading: boolean;
  progressMessages?: string[];
  progressPercent?: number;
  currentCharacter?: string;
  currentSnippet?: string;
  errorMessage?: string | null;
  onResume?: () => void;
  resumeInfo?: ResumeInfo | null;
}

// Implemented OutputDisplay component to show generation results and loading states.
const OutputDisplay: React.FC<OutputDisplayProps> = ({
  generatedOutput,
  isLoading,
  progressMessages = [],
  progressPercent = 0,
  currentCharacter,
  currentSnippet,
  errorMessage,
  onResume,
  resumeInfo
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'error'>('idle');
  const [isOpen, setIsOpen] = useState(false);

  // Auto-scroll to bottom when new progress messages arrive
  useEffect(() => {
    if (containerRef.current && isLoading) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [progressMessages, isLoading]);

  // Auto-expand when generation starts
  useEffect(() => {
    if (isLoading) {
      setIsOpen(true);
    }
  }, [isLoading]);

  const handleCopyLog = async () => {
    if (!progressMessages.length || !navigator?.clipboard) {
      return;
    }
    try {
      await navigator.clipboard.writeText(progressMessages.join('\n'));
      setCopyStatus('copied');
    } catch {
      setCopyStatus('error');
    } finally {
      setTimeout(() => setCopyStatus('idle'), 2000);
    }
  };

  return (
    <div className={`flex flex-col bg-secondary rounded-lg shadow-lg transition-all duration-300 ${isOpen ? 'h-[500px]' : 'h-auto'}`}>
      <div
        className="flex justify-between items-center p-4 cursor-pointer hover:bg-secondary/80 transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center space-x-2">
          <span className="text-highlight text-xl transform transition-transform duration-300" style={{ transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}>
            ▶
          </span>
          <h2 className="text-xl font-bold text-highlight">Audio Generation</h2>
        </div>
        {isOpen && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleCopyLog();
            }}
            disabled={!progressMessages.length}
            aria-label="Copy progress log to clipboard"
            className="text-sm px-3 py-1 bg-accent hover:bg-highlight rounded-md transition-colors disabled:bg-gray-600 disabled:text-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-highlight"
          >
            {copyStatus === 'copied' ? 'Copied!' : copyStatus === 'error' ? 'Retry' : 'Copy Log'}
          </button>
        )}
      </div>

      {isOpen && (
        <div className="flex flex-col flex-grow px-4 pb-4 overflow-hidden">
          {(isLoading || progressPercent > 0) && (
            <div className="mb-3">
              <div className="flex justify-between text-xs text-text-secondary mb-1">
                <span>{currentCharacter ? `Processing ${currentCharacter}` : 'Preparing...'}</span>
                <span>{progressPercent}%</span>
              </div>
              <div className="w-full h-2 bg-accent/30 rounded-full overflow-hidden">
                <div
                  className="h-full bg-highlight transition-all"
                  style={{ width: `${progressPercent}%` }}
                  aria-valuenow={progressPercent}
                  aria-valuemin={0}
                  aria-valuemax={100}
                />
              </div>
              {currentSnippet && (
                <p className="text-xs text-text-secondary mt-1 italic truncate">“{currentSnippet}”</p>
              )}
            </div>
          )}
          {errorMessage && (
            <div className="bg-red-900/40 border border-red-500 rounded-md p-3 mb-3">
              <p className="text-sm mb-2">{errorMessage}</p>
              {resumeInfo && onResume && (
                <button
                  onClick={onResume}
                  className="text-sm px-3 py-1 bg-red-700 hover:bg-red-600 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-400"
                >
                  Resume from chunk {resumeInfo.index + 1}
                </button>
              )}
            </div>
          )}
          <div
            ref={containerRef}
            className="flex-grow w-full p-3 bg-primary border border-accent rounded-md resize-none focus:outline-none text-text-primary custom-scrollbar overflow-auto"
          >
            {isLoading ? (
              <div className="space-y-2">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-highlight"></div>
                  <p className="text-highlight font-semibold">Generating audio files...</p>
                </div>
                <div className="space-y-1" aria-live="polite">
                  {progressMessages.map((msg, index) => (
                    <div key={index} className="text-sm text-text-primary font-mono">
                      {msg}
                    </div>
                  ))}
                </div>
              </div>
            ) : generatedOutput ? (
              <pre className="whitespace-pre-wrap text-sm">{generatedOutput}</pre>
            ) : (
              <div className="flex items-center justify-center h-full">
                <p className="text-text-secondary text-center">Your generated audio files will be downloaded here when you click Generate Audio.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default OutputDisplay;
