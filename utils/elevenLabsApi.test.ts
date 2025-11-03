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

      const chunk = { character: 'TEST', text: 'Hello world.', originalText: 'Hello world.' };
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

      const chunk = { character: 'TEST', text: 'Hello world.', originalText: 'Hello world.' };
      const config = { voiceId: 'voice123', voiceSettings: { stability: 0.5, similarity_boost: 0.75, style: 0.1, speed: 1.0 } };
      const apiKey = 'test-api-key';
      const modelId = 'eleven_multilingual_v2';
      const outputFormat = 'mp3_44100_128';
      const signal = new AbortController().signal;

      const promise = generateAudioFile(chunk, config, apiKey, modelId, outputFormat, undefined, 0, 1, signal);
      const rejection = expect(promise).rejects.toThrow('Failed after 3 retries: Network error');

      await vi.runAllTimersAsync();
      await rejection;

      vi.useRealTimers();
    });
  });

  describe('validateApiKey', () => {
    it('should report valid for a working API key', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
      });
      const result = await validateApiKey('valid-key');
      expect(result.valid).toBe(true);
      expect(result.status).toBe(200);
      expect(result.error).toBeUndefined();
    });

    it('should return status and message for an invalid API key', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: () => Promise.resolve('Unauthorized'),
        clone: () => ({
          json: () => Promise.reject(new Error('no json')),
        }),
      });
      const result = await validateApiKey('invalid-key');
      expect(result.valid).toBe(false);
      expect(result.status).toBe(401);
      expect(result.error).toBe('Unauthorized');
    });

    it('should surface network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network down'));
      const result = await validateApiKey('any-key');
      expect(result.valid).toBe(false);
      expect(result.status).toBeNull();
      expect(result.error).toBe('Network down');
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
