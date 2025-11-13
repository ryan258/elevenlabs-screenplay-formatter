import React, { useEffect, useRef, useState } from 'react';

interface OutputDisplayProps {
  generatedOutput: string;
  isLoading: boolean;
  progressMessages?: string[];
}

// Implemented OutputDisplay component to show generation results and loading states.
const OutputDisplay: React.FC<OutputDisplayProps> = ({ generatedOutput, isLoading, progressMessages = [] }) => {
  const outputEndRef = useRef<HTMLDivElement>(null);
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'error'>('idle');

  // Auto-scroll to bottom when new progress messages arrive
  useEffect(() => {
    if (outputEndRef.current && isLoading) {
      outputEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [progressMessages, isLoading]);

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
    <div className="flex flex-col h-full bg-secondary p-4 rounded-lg shadow-lg">
      <div className="flex justify-between items-center mb-2">
        <h2 className="text-xl font-bold text-highlight">Audio Generation</h2>
        <button
          type="button"
          onClick={handleCopyLog}
          disabled={!progressMessages.length}
          aria-label="Copy progress log to clipboard"
          className="text-sm px-3 py-1 bg-accent hover:bg-highlight rounded-md transition-colors disabled:bg-gray-600 disabled:text-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-highlight"
        >
          {copyStatus === 'copied' ? 'Copied!' : copyStatus === 'error' ? 'Retry' : 'Copy Log'}
        </button>
      </div>
      <div className="flex-grow w-full p-3 bg-primary border border-accent rounded-md resize-none focus:outline-none text-text-primary custom-scrollbar overflow-auto">
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
              <div ref={outputEndRef} />
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
  );
};

export default OutputDisplay;
