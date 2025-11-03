import React from 'react';

interface GeneratePanelProps {
  onGenerate: () => void;
  onCancel: () => void;
  onShare: () => void;
  isGenerating: boolean;
  canGenerate: boolean;
  estimatedCost: number;
}

// Implemented GeneratePanel to provide the final action button for the user.
const GeneratePanel: React.FC<GeneratePanelProps> = ({ onGenerate, onCancel, onShare, isGenerating, canGenerate, estimatedCost }) => {
  return (
    <div className="bg-secondary p-4 rounded-lg shadow-lg">
      <h2 className="text-xl font-bold text-highlight mb-4">Step 4: Generate</h2>
      {canGenerate && estimatedCost > 0 && (
        <p className="text-sm text-text-secondary mb-2 text-center">
          Estimated cost: ~${estimatedCost.toFixed(2)}
        </p>
      )}
      <button
        onClick={onGenerate}
        disabled={!canGenerate || isGenerating}
        className="w-full py-3 px-4 bg-highlight text-white font-bold rounded-lg shadow-md hover:bg-red-700 disabled:bg-gray-500 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-secondary focus:ring-highlight"
      >
        {isGenerating ? 'Generating...' : 'Generate Audio'}
      </button>
      {isGenerating && (
        <button
          onClick={onCancel}
          className="w-full py-3 px-4 mt-2 bg-gray-600 text-white font-bold rounded-lg shadow-md hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-600"
        >
          Cancel Generation
        </button>
      )}
      <button
        onClick={onShare}
        disabled={isGenerating || !canGenerate}
        className="w-full py-3 px-4 mt-2 bg-blue-600 text-white font-bold rounded-lg shadow-md hover:bg-blue-700 disabled:bg-gray-500 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-600"
      >
        Share Configuration
      </button>
      {!canGenerate && (
        <p className="text-xs text-text-secondary mt-2 text-center">
            Please provide a script, API key, and ensure characters are detected to enable generation.
        </p>
      )}
    </div>
  );
};

export default GeneratePanel;
