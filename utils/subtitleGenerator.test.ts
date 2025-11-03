import { describe, it, expect } from 'vitest';
import { generateSrtFile, generateVttFile } from './subtitleGenerator';
import { DialogueChunk } from '../types';

describe('subtitleGenerator', () => {
  const mockDialogueChunks: DialogueChunk[] = [
    { character: 'JOHN', text: 'Hello, world!', startTime: 0.5, endTime: 2.123 },
    { character: 'JANE', text: 'How are you?', startTime: 2.5, endTime: 3.876 },
    { character: 'JOHN', text: 'I am fine, thank you.', startTime: 4.0, endTime: 6.0 },
  ];

  describe('generateSrtFile', () => {
    it('should generate a correct SRT file', () => {
      const expectedSrt = `1
00:00:00,500 --> 00:00:02,123
JOHN: Hello, world!

2
00:00:02,500 --> 00:00:03,876
JANE: How are you?

3
00:00:04,000 --> 00:00:06,000
JOHN: I am fine, thank you.

`;
      const srt = generateSrtFile(mockDialogueChunks);
      expect(srt).toEqual(expectedSrt);
    });

    it('should handle chunks without timestamps', () => {
      const chunksWithoutTimestamps: DialogueChunk[] = [
        { character: 'JOHN', text: 'Hello, world!' },
      ];
      const srt = generateSrtFile(chunksWithoutTimestamps);
      expect(srt).toEqual('');
    });
  });

  describe('generateVttFile', () => {
    it('should generate a correct VTT file', () => {
      const expectedVtt = `WEBVTT\n\n00:00:00.500 --> 00:00:02.123\nJOHN: Hello, world!\n\n00:00:02.500 --> 00:00:03.876\nJANE: How are you?\n\n00:00:04.000 --> 00:00:06.000\nJOHN: I am fine, thank you.\n\n`;
      const vtt = generateVttFile(mockDialogueChunks);
      expect(vtt).toEqual(expectedVtt);
    });

    it('should handle chunks without timestamps', () => {
      const chunksWithoutTimestamps: DialogueChunk[] = [
        { character: 'JOHN', text: 'Hello, world!' },
      ];
      const vtt = generateVttFile(chunksWithoutTimestamps);
      expect(vtt).toEqual('WEBVTT\n\n');
    });
  });
});
