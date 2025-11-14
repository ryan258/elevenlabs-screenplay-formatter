import React from 'react';
import { ManifestEntry } from '../types';

interface ExportPanelProps {
  manifestEntries: ManifestEntry[];
  onDownloadJson: () => void;
  onDownloadCsv: () => void;
  onDownloadZip: () => void;
}

const ExportPanel: React.FC<ExportPanelProps> = ({ manifestEntries, onDownloadJson, onDownloadCsv, onDownloadZip }) => {
  const hasData = manifestEntries.length > 0;
  return (
    <div className="bg-secondary p-4 rounded-lg shadow-lg">
      <h2 className="text-xl font-bold text-highlight mb-3">Exports</h2>
      <div className="space-y-2">
        <button
          onClick={onDownloadJson}
          disabled={!hasData}
          className="w-full py-2 bg-accent hover:bg-highlight rounded-md text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-highlight disabled:opacity-60"
        >
          Download Manifest (JSON)
        </button>
        <button
          onClick={onDownloadCsv}
          disabled={!hasData}
          className="w-full py-2 bg-accent hover:bg-highlight rounded-md text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-highlight disabled:opacity-60"
        >
          Download Manifest (CSV)
        </button>
        <button
          onClick={onDownloadZip}
          disabled={!hasData}
          className="w-full py-2 bg-accent hover:bg-highlight rounded-md text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-highlight disabled:opacity-60"
        >
          Download Zip (Audio + Manifest)
        </button>
      </div>
      {!hasData && (
        <p className="text-xs text-text-secondary mt-2">Generate audio to enable exports.</p>
      )}
    </div>
  );
};

export default ExportPanel;
