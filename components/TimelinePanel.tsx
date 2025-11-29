import React, { useMemo } from 'react';
import { FixedSizeList as List, ListChildComponentProps } from 'react-window';
import { DialogueChunk, ManifestEntry } from '../types';

const WORDS_PER_MINUTE = 150;
const estimateDurationMs = (text: string) => {
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  return Math.round((wordCount / WORDS_PER_MINUTE) * 60 * 1000);
};

const formatDuration = (ms: number) => {
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

interface TimelinePanelProps {
  chunks: DialogueChunk[];
  previewStates: Record<number, { loading?: boolean; url?: string; error?: string }>;
  onPreview: (index: number) => void;
  timings?: ManifestEntry[];
}

const TimelinePanel: React.FC<TimelinePanelProps> = ({ chunks, previewStates, onPreview, timings }) => {
  const entries = useMemo(() => {
    return chunks.map((chunk, index) => {
      const manifestEntry = timings?.[index];
      const durationMs = manifestEntry && manifestEntry.startTimeMs !== undefined && manifestEntry.endTimeMs !== undefined
        ? manifestEntry.endTimeMs - manifestEntry.startTimeMs
        : chunk.endTimeMs && chunk.startTimeMs
          ? chunk.endTimeMs - chunk.startTimeMs
          : estimateDurationMs(chunk.text);
      return {
        index,
        chunk,
        durationMs
      };
    });
  }, [chunks, timings]);

  const totalDuration = entries.reduce((sum, entry) => sum + entry.durationMs, 0);

  return (
    <div className="h-[500px] bg-secondary p-4 rounded-lg shadow-lg flex flex-col">
      <div className="flex items-center justify-between mb-2 flex-shrink-0">
        <h2 className="text-xl font-bold text-highlight">Timeline</h2>
        <span className="text-xs text-text-secondary">Estimated runtime: {formatDuration(totalDuration)}</span>
      </div>
      <div className="flex-grow overflow-hidden">
        {entries.length === 0 ? (
          <p className="text-xs text-text-secondary">Add screenplay text to populate the timeline.</p>
        ) : (
          <List
            height={430}
            itemCount={entries.length}
            itemSize={110}
            width="100%"
            className="custom-scrollbar pr-2 space-y-2"
          >
            {({ index, style }: ListChildComponentProps) => {
              const entry = entries[index];
              const preview = previewStates[entry.index];
              return (
                <div style={style} className="pr-2">
                  <div className="p-2 bg-primary border border-accent rounded-md text-sm h-full">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-text-primary truncate">[{entry.index + 1}] {entry.chunk.character}</span>
                      <span className="text-xs text-text-secondary">{formatDuration(entry.durationMs)}</span>
                    </div>
                    <p className="text-xs text-text-secondary mt-1 truncate">{entry.chunk.text}</p>
                    <div className="mt-2 flex items-center space-x-2">
                      <button
                        onClick={() => onPreview(entry.index)}
                        className="text-xs px-2 py-1 bg-accent hover:bg-highlight rounded focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-highlight disabled:opacity-60"
                        disabled={preview?.loading}
                      >
                        {preview?.loading ? 'Loading…' : preview?.url ? 'Replay' : 'Preview'}
                      </button>
                      {preview?.url && (
                        <audio controls className="w-full" src={preview.url} />
                      )}
                      {preview?.error && (
                        <span className="text-xs text-red-300">{preview.error}</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            }}
          </List>
        )}
      </div>
    </div>
  );
};

export default TimelinePanel;
