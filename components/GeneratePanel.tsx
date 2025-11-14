import React from 'react';
import { ResumeInfo } from '../types';

interface GeneratePanelProps {
  onGenerate: () => void;
  isGenerating: boolean;
  canGenerate: boolean;
  onResume?: () => void;
  resumeInfo?: ResumeInfo | null;
}

// Implemented GeneratePanel to provide the final action button for the user.
const GeneratePanel: React.FC<GeneratePanelProps> = ({ onGenerate, isGenerating, canGenerate, onResume, resumeInfo }) => {
  return (
    <div className="bg-secondary p-4 rounded-lg shadow-lg">
      <h2 className="text-xl font-bold text-highlight mb-4">Step 4: Generate</h2>
      <button
        onClick={onGenerate}
        disabled={!canGenerate || isGenerating}
        className="w-full py-3 px-4 bg-highlight text-white font-bold rounded-lg shadow-md hover:bg-red-700 disabled:bg-gray-500 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-secondary focus:ring-highlight"
      >
        {isGenerating ? 'Generating...' : 'Generate Audio'}
      </button>
      {!canGenerate && (
        <p className="text-xs text-text-secondary mt-2 text-center">
            Please provide a script, API key, and ensure characters are detected to enable generation.
        </p>
      )}
      {resumeInfo && onResume && !isGenerating && (
        <button
          onClick={onResume}
          className="w-full mt-3 py-2 px-4 bg-accent text-white font-semibold rounded-lg hover:bg-highlight focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-highlight"
        >
          Resume from chunk {resumeInfo.index + 1} ({resumeInfo.character})
        </button>
      )}
    </div>
  );
};

export default GeneratePanel;
