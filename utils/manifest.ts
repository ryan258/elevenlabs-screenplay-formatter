import { DialogueChunk, ManifestEntry } from '../types';

const WORDS_PER_MINUTE = 150;

const estimateDurationMs = (text: string) => {
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  return Math.round((wordCount / WORDS_PER_MINUTE) * 60 * 1000);
};

export const buildManifestEntries = (
  chunks: DialogueChunk[],
  filenames: string[]
): ManifestEntry[] => {
  return chunks.map((chunk, index) => ({
    index,
    character: chunk.character,
    filename: filenames[index] || '',
    text: chunk.text,
    estimatedDurationMs: estimateDurationMs(chunk.text)
  }));
};

export const manifestToCsv = (entries: ManifestEntry[]) => {
  const header = 'index,character,filename,text,estimatedDurationMs';
  const rows = entries.map(entry => {
    const escapedText = `"${entry.text.replace(/"/g, '""')}`;
    return `${entry.index + 1},${entry.character},${entry.filename},${escapedText}",${entry.estimatedDurationMs}`;
  });
  return [header, ...rows].join('\n');
};
