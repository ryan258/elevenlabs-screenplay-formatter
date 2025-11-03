import { DialogueChunk } from '../types';

const formatTimeComponents = (seconds: number) => {
  const totalMilliseconds = Math.round(seconds * 1000);
  const hrs = Math.floor(totalMilliseconds / 3_600_000);
  const mins = Math.floor((totalMilliseconds % 3_600_000) / 60_000);
  const secs = Math.floor((totalMilliseconds % 60_000) / 1000);
  const ms = totalMilliseconds % 1000;
  return {
    hrs: hrs.toString().padStart(2, '0'),
    mins: mins.toString().padStart(2, '0'),
    secs: secs.toString().padStart(2, '0'),
    ms: ms.toString().padStart(3, '0'),
  };
};

const formatTime = (seconds: number): string => {
  const { hrs, mins, secs, ms } = formatTimeComponents(seconds);
  return `${hrs}:${mins}:${secs},${ms}`; // SRT uses comma for milliseconds
};

const formatVttTime = (seconds: number): string => {
  const { hrs, mins, secs, ms } = formatTimeComponents(seconds);
  return `${hrs}:${mins}:${secs}.${ms}`; // VTT uses period for milliseconds
};

export const generateSrtFile = (dialogueChunks: DialogueChunk[]): string => {
  let srtContent = '';
  let sequence = 1;

  dialogueChunks.forEach(chunk => {
    if (chunk.startTime !== undefined && chunk.endTime !== undefined) {
      srtContent += `${sequence}\n`;
      srtContent += `${formatTime(chunk.startTime)} --> ${formatTime(chunk.endTime)}\n`;
      srtContent += `${chunk.character}: ${chunk.text}\n\n`;
      sequence++;
    }
  });

  return srtContent;
};

export const generateVttFile = (dialogueChunks: DialogueChunk[]): string => {
  let vttContent = 'WEBVTT\n\n';
  let sequence = 1;

  dialogueChunks.forEach(chunk => {
    if (chunk.startTime !== undefined && chunk.endTime !== undefined) {
      vttContent += `${formatVttTime(chunk.startTime)} --> ${formatVttTime(chunk.endTime)}\n`;
      vttContent += `${chunk.character}: ${chunk.text}\n\n`;
      sequence++;
    }
  });

  return vttContent;
};
