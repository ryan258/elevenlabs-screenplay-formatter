import { DialogueChunk, GeneratedBlob, ManifestEntry } from '../types';

const WORDS_PER_MINUTE = 150;

const estimateDurationMs = (text: string) => {
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  return Math.round((wordCount / WORDS_PER_MINUTE) * 60 * 1000);
};

const formatTimestamp = (ms: number, format: 'srt' | 'vtt') => {
  const clamped = Math.max(0, Math.round(ms));
  const hours = Math.floor(clamped / 3_600_000);
  const minutes = Math.floor((clamped % 3_600_000) / 60_000);
  const seconds = Math.floor((clamped % 60_000) / 1000);
  const milliseconds = clamped % 1000;
  const separator = format === 'srt' ? ',' : '.';
  const milliValue = milliseconds.toString().padStart(3, '0');
  return [
    hours.toString().padStart(2, '0'),
    minutes.toString().padStart(2, '0'),
    seconds.toString().padStart(2, '0')
  ].join(':') + `${separator}${milliValue}`;
};

const ensureTimingEntries = (entries: ManifestEntry[]) => {
  let cursor = 0;
  return entries.map(entry => {
    const start = entry.startTimeMs ?? cursor;
    const fallbackDuration = entry.estimatedDurationMs || estimateDurationMs(entry.text);
    const end = entry.endTimeMs ?? (start + fallbackDuration);
    cursor = end;
    return {
      ...entry,
      startTimeMs: start,
      endTimeMs: end
    };
  });
};

export const buildManifestEntries = (
  chunks: DialogueChunk[],
  blobs: GeneratedBlob[]
): ManifestEntry[] => {
  let runningStart = 0;
  return chunks.map((chunk, index) => {
    const blob = blobs[index];
    const start = blob?.startTimeMs ?? chunk.startTimeMs ?? runningStart;
    const fallbackDuration = blob?.endTimeMs && start !== undefined
      ? blob.endTimeMs - start
      : estimateDurationMs(chunk.text);
    const end = blob?.endTimeMs ?? chunk.endTimeMs ?? (start + fallbackDuration);
    runningStart = end;
    return {
      index,
      character: chunk.character,
      filename: blob?.filename || '',
      text: chunk.text,
      estimatedDurationMs: fallbackDuration,
      startTimeMs: start,
      endTimeMs: end,
      words: blob?.alignment ?? chunk.words
    };
  });
};

export const manifestToCsv = (entries: ManifestEntry[]) => {
  const header = 'index,character,filename,text,estimatedDurationMs,startTimeMs,endTimeMs';
  const rows = entries.map(entry => {
    const escapedText = `"${entry.text.replace(/"/g, '""')}`;
    const start = entry.startTimeMs ?? '';
    const end = entry.endTimeMs ?? '';
    return `${entry.index + 1},${entry.character},${entry.filename},${escapedText}",${entry.estimatedDurationMs},${start},${end}`;
  });
  return [header, ...rows].join('\n');
};

export const manifestToSrt = (entries: ManifestEntry[]) => {
  const timed = ensureTimingEntries(entries);
  return timed.map(entry => {
    const start = formatTimestamp(entry.startTimeMs ?? 0, 'srt');
    const end = formatTimestamp(entry.endTimeMs ?? 0, 'srt');
    return `${entry.index + 1}\n${start} --> ${end}\n${entry.text}\n`;
  }).join('\n').trim();
};

export const manifestToVtt = (entries: ManifestEntry[]) => {
  const timed = ensureTimingEntries(entries);
  const cues = timed.map(entry => {
    const start = formatTimestamp(entry.startTimeMs ?? 0, 'vtt');
    const end = formatTimestamp(entry.endTimeMs ?? 0, 'vtt');
    return `${start} --> ${end}\n${entry.text}\n`;
  }).join('\n');
  return `WEBVTT\n\n${cues}`.trim();
};
