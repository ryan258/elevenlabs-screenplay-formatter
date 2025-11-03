import { describe, it, expect } from 'vitest';
import { generateSrtFile, generateVttFile } from './subtitleGenerator';
import { DialogueChunk } from '../types';

describe('subtitleGenerator', () => {
  const mockDialogueChunks: DialogueChunk[] = [
    { character: 'JOHN', text: 'Hello, world!', originalText: 'Hello, world!', startTime: 0.5, endTime: 2.123 },
    { character: 'JANE', text: 'How are you?', originalText: 'How are you?', startTime: 2.5, endTime: 3.876 },
    { character: 'JOHN', text: 'I am fine, thank you.', originalText: 'I am fine, thank you.', startTime: 4.0, endTime: 6.0 },
  ];

  const parseSrtTimestamp = (timestamp: string) => {
    const [h, m, s] = timestamp.split(':');
    const [sec, ms] = s.split(',');
    return parseInt(h) * 3600 + parseInt(m) * 60 + parseInt(sec) + parseInt(ms) / 1000;
  };

  const parseVttTimestamp = (timestamp: string) => {
    const [h, m, s] = timestamp.split(':');
    const [sec, ms] = s.split('.');
    return parseInt(h) * 3600 + parseInt(m) * 60 + parseInt(sec) + parseInt(ms) / 1000;
  };

  describe('generateSrtFile', () => {
    it('should generate a correct SRT file', () => {
      const srt = generateSrtFile(mockDialogueChunks);
      const lines = srt.split('\n');
      expect(lines[0]).toBe('1');
      const [start1, end1] = lines[1].split(' --> ');
      expect(parseSrtTimestamp(start1)).toBeCloseTo(0.5, 1);
      expect(parseSrtTimestamp(end1)).toBeCloseTo(2.123, 1);
      expect(lines[2]).toBe('JOHN: Hello, world!');
    });

    it('should handle chunks without timestamps', () => {
      const chunksWithoutTimestamps: DialogueChunk[] = [
        { character: 'JOHN', text: 'Hello, world!', originalText: 'Hello, world!' },
      ];
      const srt = generateSrtFile(chunksWithoutTimestamps);
      expect(srt).toEqual('');
    });
  });

  describe('generateVttFile', () => {
    it('should generate a correct VTT file', () => {
      const vtt = generateVttFile(mockDialogueChunks);
      const lines = vtt.split('\n');
      expect(lines[0]).toBe('WEBVTT');
      const [start1, end1] = lines[2].split(' --> ');
      expect(parseVttTimestamp(start1)).toBeCloseTo(0.5, 1);
      expect(parseVttTimestamp(end1)).toBeCloseTo(2.123, 1);
      expect(lines[3]).toBe('JOHN: Hello, world!');
    });

    it('should handle chunks without timestamps', () => {
      const chunksWithoutTimestamps: DialogueChunk[] = [
        { character: 'JOHN', text: 'Hello, world!', originalText: 'Hello, world!' },
      ];
      const vtt = generateVttFile(chunksWithoutTimestamps);
      expect(vtt).toEqual('WEBVTT\n\n');
    });
  });
});
