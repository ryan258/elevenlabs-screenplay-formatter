import React from 'react';
import { ProjectState } from '../types';

interface HistoryPanelProps {
  projectHistory: ProjectState[];
  onRevert: (state: ProjectState) => void;
}

const HistoryPanel: React.FC<HistoryPanelProps> = ({ projectHistory, onRevert }) => {
  return (
    <div className="bg-secondary p-4 rounded-lg shadow-lg">
      <h2 className="text-xl font-bold text-highlight mb-4">Version History</h2>
      {projectHistory.length === 0 ? (
        <p className="text-text-secondary">No history available yet.</p>
      ) : (
        <div className="overflow-y-auto max-h-60 custom-scrollbar">
          {projectHistory.map((state, index) => (
            <div key={index} className="flex justify-between items-center p-2 border-b border-accent last:border-b-0">
              <span className="text-text-primary text-sm">{new Date(state.timestamp).toLocaleString()}</span>
              <button
                onClick={() => onRevert(state)}
                className="px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm"
              >
                Revert
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default HistoryPanel;
