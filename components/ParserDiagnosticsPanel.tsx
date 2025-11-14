import React, { useMemo, useState } from 'react';
import { DialogueChunk } from '../types';

interface ParserDiagnosticsPanelProps {
  chunks: DialogueChunk[];
  unmatchedLines: Array<{ lineNumber: number; content: string }>;
}

const ParserDiagnosticsPanel: React.FC<ParserDiagnosticsPanelProps> = ({ chunks, unmatchedLines }) => {
  const [isOpen, setIsOpen] = useState(false);

  const characterStats = useMemo(() => {
    const counts = new Map<string, number>();
    chunks.forEach(chunk => {
      counts.set(chunk.character, (counts.get(chunk.character) || 0) + 1);
    });
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  }, [chunks]);

  const unmatchedPreview = unmatchedLines.slice(0, 10);

  return (
    <div className="bg-secondary p-4 rounded-lg shadow-lg">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-highlight">Parser Diagnostics</h2>
        <button
          onClick={() => setIsOpen(prev => !prev)}
          className="text-sm px-3 py-1 bg-accent hover:bg-highlight rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-highlight"
        >
          {isOpen ? 'Hide' : 'Show'}
        </button>
      </div>
      {isOpen && (
        <div className="mt-4 space-y-4 text-sm">
          <div>
            <p className="text-text-secondary mb-1">Detected Characters</p>
            <ul className="space-y-1 max-h-40 overflow-y-auto custom-scrollbar pr-2">
              {characterStats.length === 0 && (
                <li className="text-text-secondary italic">No characters detected yet.</li>
              )}
              {characterStats.map(([name, count]) => (
                <li key={name} className="flex justify-between text-text-primary">
                  <span className="font-mono truncate">{name}</span>
                  <span>{count} line{count === 1 ? '' : 's'}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-text-secondary mb-1">
              Unparsed Lines ({unmatchedLines.length})
            </p>
            {unmatchedLines.length === 0 ? (
              <p className="text-text-secondary italic">Every line matched a character.</p>
            ) : (
              <ul className="space-y-1 max-h-40 overflow-y-auto custom-scrollbar pr-2">
                {unmatchedPreview.map(item => (
                  <li key={item.lineNumber} className="font-mono text-xs text-red-300">
                    {item.lineNumber}: {item.content}
                  </li>
                ))}
              </ul>
            )}
            {unmatchedLines.length > unmatchedPreview.length && (
              <p className="text-xs text-text-secondary mt-1">
                +{unmatchedLines.length - unmatchedPreview.length} more lines.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ParserDiagnosticsPanel;
