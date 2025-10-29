import React, { useState } from 'react';

interface OutputDisplayProps {
  generatedOutput: string;
  isLoading: boolean;
}

// Implemented OutputDisplay component to show generation results and loading states.
const OutputDisplay: React.FC<OutputDisplayProps> = ({ generatedOutput, isLoading }) => {
  const [copySuccess, setCopySuccess] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(generatedOutput);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleDownload = () => {
    // Extract the bash script from the output
    const scriptMatch = generatedOutput.match(/🚀 BASH SCRIPT[\s\S]*?━{60,}\n\n([\s\S]*?)\n\n━{60,}/);
    const scriptContent = scriptMatch ? scriptMatch[1] : generatedOutput;

    const blob = new Blob([scriptContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'generate_audio.sh';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col h-full bg-secondary p-4 rounded-lg shadow-lg">
      <div className="flex justify-between items-center mb-2">
        <h2 className="text-xl font-bold text-highlight">Generated Output</h2>
        {generatedOutput && !isLoading && (
          <div className="flex space-x-2">
            <button
              onClick={handleCopy}
              className="text-sm px-3 py-1 bg-accent hover:bg-highlight rounded-md transition-colors"
            >
              {copySuccess ? '✓ Copied!' : 'Copy All'}
            </button>
            <button
              onClick={handleDownload}
              className="text-sm px-3 py-1 bg-accent hover:bg-highlight rounded-md transition-colors"
            >
              Download Script
            </button>
          </div>
        )}
      </div>
      <div className="flex-grow w-full p-3 bg-primary border border-accent rounded-md resize-none focus:outline-none text-text-primary custom-scrollbar overflow-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-highlight"></div>
            <p className="ml-4 text-text-secondary">Generating audio...</p>
          </div>
        ) : generatedOutput ? (
          <pre className="whitespace-pre-wrap text-sm">{generatedOutput}</pre>
        ) : (
          <div className="flex items-center justify-center h-full">
            <p className="text-text-secondary text-center">Your generated script or audio links will appear here.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default OutputDisplay;
