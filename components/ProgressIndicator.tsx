import React, { useEffect, useState } from 'react';
import { GenerationProgressState, getProgressPercentage, estimateTimeRemaining } from '../utils/progressPersistence';

interface ProgressIndicatorProps {
  progress: GenerationProgressState | null;
  onResume?: () => void;
  onCancel?: () => void;
}

const ProgressIndicator: React.FC<ProgressIndicatorProps> = ({ progress, onResume, onCancel }) => {
  const [timeRemaining, setTimeRemaining] = useState<string>('');

  useEffect(() => {
    if (!progress || progress.status !== 'in_progress') {
      return;
    }

    // Update time remaining every second
    const interval = setInterval(() => {
      setTimeRemaining(estimateTimeRemaining(progress));
    }, 1000);

    return () => clearInterval(interval);
  }, [progress]);

  if (!progress) {
    return null;
  }

  const percentage = getProgressPercentage(progress);
  const isInProgress = progress.status === 'in_progress';
  const isPaused = progress.status === 'paused';

  return (
    <div
      className="bg-secondary p-4 rounded-lg shadow-lg border-2 border-highlight"
      role="status"
      aria-live="polite"
      aria-label="Generation progress indicator"
    >
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-lg font-bold text-highlight">
          {isInProgress && '⏳ Generation In Progress'}
          {isPaused && '⏸️ Generation Paused'}
          {progress.status === 'completed' && '✅ Generation Complete'}
          {progress.status === 'error' && '❌ Generation Error'}
        </h3>
        <span className="text-sm text-text-secondary">
          {progress.currentIndex} / {progress.totalChunks}
        </span>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-primary rounded-full h-4 mb-3 overflow-hidden">
        <div
          className="bg-highlight h-full transition-all duration-300 flex items-center justify-center text-xs font-bold text-white"
          style={{ width: `${percentage}%` }}
          role="progressbar"
          aria-valuenow={percentage}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          {percentage > 15 && `${percentage}%`}
        </div>
      </div>

      {/* Status Message */}
      <p className="text-sm text-text-secondary mb-3">
        {progress.lastMessage || 'Processing...'}
      </p>

      {/* Time Remaining */}
      {isInProgress && timeRemaining && (
        <p className="text-sm text-text-secondary mb-3">
          {timeRemaining}
        </p>
      )}

      {/* Generated Files Count */}
      {progress.generatedFiles.length > 0 && (
        <p className="text-sm text-text-secondary mb-3">
          Generated files: {progress.generatedFiles.length}
        </p>
      )}

      {/* Action Buttons */}
      <div className="flex space-x-2">
        {isPaused && onResume && (
          <button
            onClick={onResume}
            className="flex-1 px-4 py-2 bg-highlight text-white font-bold rounded-md hover:bg-highlight-dark transition-colors"
            aria-label="Resume generation from where it stopped"
          >
            Resume Generation
          </button>
        )}
        {(isInProgress || isPaused) && onCancel && (
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2 bg-gray-600 text-white font-bold rounded-md hover:bg-gray-700 transition-colors"
            aria-label="Cancel and clear current generation progress"
          >
            Cancel & Clear
          </button>
        )}
        {progress.status === 'error' && (
          <div className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md text-center">
            Error: {progress.lastMessage}
          </div>
        )}
        {progress.status === 'completed' && (
          <div className="flex-1 px-4 py-2 bg-green-600 text-white rounded-md text-center">
            All {progress.totalChunks} files generated successfully!
          </div>
        )}
      </div>

      {/* Session Info */}
      <div className="mt-3 pt-3 border-t border-accent">
        <p className="text-xs text-text-secondary">
          Session started: {new Date(progress.timestamp).toLocaleString()}
        </p>
      </div>
    </div>
  );
};

export default ProgressIndicator;
