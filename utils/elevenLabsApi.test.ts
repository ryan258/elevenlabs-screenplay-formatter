import { vi, describe, it, expect, beforeEach } from 'vitest';
import { generateAudioFile, validateApiKey, getAvailableVoices, addVoice } from './elevenLabsApi';

// Mock fetch API
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock URL.createObjectURL and URL.revokeObjectURL
global.URL.createObjectURL = vi.fn(() => 'blob:http://localhost/mock-blob-url');
global.URL.revokeObjectURL = vi.fn();

describe('elevenLabsApi', () => {
  beforeEach(() => {
    mockFetch.mockClear();
    vi.clearAllMocks();
  });

  describe('generateAudioFile', () => {
    it('should generate audio file with timestamps and return blob and alignment', async () => {
      const mockAudioBase64 = 'data:audio/mpeg;base64,MOCK_AUDIO_BASE64';
      const mockAlignment = { normalized_alignment: { word_start_times_seconds: [0.1], word_end_times_seconds: [0.5] } };
      const mockResponseJson = {
        audio_base64: mockAudioBase64,
        alignment: mockAlignment,
      };
      const mockAudioBlob = new Blob(['mock audio data'], { type: 'audio/mpeg' });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponseJson),
        headers: new Headers({'ratelimit-remaining': '4', 'ratelimit-reset': '1000'}),
      }).mockResolvedValueOnce({
        ok: true,
        blob: () => Promise.resolve(mockAudioBlob),
      });

      const chunk = { character: 'TEST', text: 'Hello world.' };
      const config = { voiceId: 'voice123', voiceSettings: { stability: 0.5, similarity_boost: 0.75, style: 0.1, speed: 1.0 } };
      const apiKey = 'test-api-key';
      const modelId = 'eleven_multilingual_v2';
      const outputFormat = 'mp3_44100_128';
      const onProgress = vi.fn();
      const signal = new AbortController().signal;

      const result = await generateAudioFile(chunk, config, apiKey, modelId, outputFormat, onProgress, 0, 1, signal);

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(mockFetch).toHaveBeenCalledWith(
        `https://api.elevenlabs.io/v1/text-to-speech/${config.voiceId}/with-timestamps`,
        expect.any(Object)
      );
      expect(result.blob).toEqual(mockAudioBlob);
      expect(result.alignment).toEqual(mockAlignment);
      expect(onProgress).toHaveBeenCalledTimes(2);
      expect(onProgress).toHaveBeenCalledWith(expect.objectContaining({ status: 'generating' }), 1, 1);
      expect(onProgress).toHaveBeenCalledWith(expect.objectContaining({ status: 'downloading' }), 1, 1);
    });

    it('should throw an error if API call fails', async () => {
      vi.useFakeTimers();
      mockFetch.mockRejectedValue(new Error('Network error'));

      const chunk = { character: 'TEST', text: 'Hello world.' };
      const config = { voiceId: 'voice123', voiceSettings: { stability: 0.5, similarity_boost: 0.75, style: 0.1, speed: 1.0 } };
      const apiKey = 'test-api-key';
      const modelId = 'eleven_multilingual_v2';
      const outputFormat = 'mp3_44100_128';
      const signal = new AbortController().signal;

      const promise = generateAudioFile(chunk, config, apiKey, modelId, outputFormat, undefined, 0, 1, signal);

      await vi.runAllTimersAsync();

      await expect(promise).rejects.toThrow(
        'Failed after 3 retries: Network error'
      );

      vi.useRealTimers();
    });
  });

  describe('validateApiKey', () => {
    it('should return true for a valid API key', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
      });
      const isValid = await validateApiKey('valid-key');
      expect(isValid).toBe(true);
    });

    it('should return false for an invalid API key', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
      });
      const isValid = await validateApiKey('invalid-key');
      expect(isValid).toBe(false);
    });
  });

  describe('getAvailableVoices', () => {
    it('should return a list of voices', async () => {
      const mockVoices = [{ voice_id: 'v1', name: 'Voice 1' }];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ voices: mockVoices }),
      });
      const voices = await getAvailableVoices('test-api-key');
      expect(voices).toEqual(mockVoices);
    });

    it('should throw an error if fetching voices fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        text: () => Promise.resolve('Forbidden'),
      });
      await expect(getAvailableVoices('test-api-key')).rejects.toThrow(
        'API Error fetching voices: 403 - Forbidden'
      );
    });
  });

  describe('addVoice', () => {
    it('should add a voice successfully', async () => {
      const mockResponse = { voice_id: 'new-voice-id' };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const mockFile = new File(['audio data'], 'test.mp3', { type: 'audio/mpeg' });
      const result = await addVoice('New Voice', 'A test voice', { gender: 'male' }, [mockFile], 'test-api-key');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.elevenlabs.io/v1/voices/add',
        expect.objectContaining({
          method: 'POST',
          body: expect.any(FormData),
        })
      );
      expect(result).toEqual(mockResponse);
    });

    it('should throw an error if adding voice fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: () => Promise.resolve('Bad Request'),
      });

      const mockFile = new File(['audio data'], 'test.mp3', { type: 'audio/mpeg' });
      await expect(addVoice('New Voice', 'A test voice', { gender: 'male' }, [mockFile], 'test-api-key')).rejects.toThrow(
        'API Error adding voice: 400 - Bad Request'
      );
    });
  });
});
