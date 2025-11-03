import { DialogueChunk } from '../types';

const formatTime = (seconds: number): string => {
  const date = new Date(0);
  date.setSeconds(seconds);
  const time = date.toISOString().substr(11, 12);
  return time.replace('.', ','); // SRT uses comma for milliseconds
};

const formatVttTime = (seconds: number): string => {
  const date = new Date(0);
  date.setSeconds(seconds);
  const time = date.toISOString().substr(11, 12);
  return time; // VTT uses period for milliseconds
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
