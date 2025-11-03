import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getUserFriendlyError, formatErrorForToast, logErrorWithContext } from './errorMessages';

describe('errorMessages utilities', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('maps invalid API key errors', () => {
    const details = getUserFriendlyError(new Error('401 Unauthorized'));
    expect(details.title).toBe('Invalid API Key');
    expect(details.actions).toContain('Verify your API key at https://elevenlabs.io/app/settings/api-keys');
  });

  it('maps rate limit errors', () => {
    const details = getUserFriendlyError('429: rate limit exceeded');
    expect(details.title).toBe('Rate Limit Exceeded');
  });

  it('extracts missing voice configuration character names', () => {
    const details = getUserFriendlyError('No voice configuration found for character: Alice');
    expect(details.title).toBe('Missing Voice Configuration');
    expect(details.message).toContain('"Alice"');
  });

  it('falls back to context for unknown errors', () => {
    const details = getUserFriendlyError('something unexpected', 'Custom Context');
    expect(details.title).toBe('Custom Context');
  });

  it('formats error details for toast rendering', () => {
    const text = formatErrorForToast(new Error('ffmpeg failed'));
    expect(text).toMatch(/FFmpeg Error/);
    expect(text).toMatch(/Troubleshooting:/);
  });

  it('logs error context with original error objects', () => {
    const error = new Error('network timeout');
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

    logErrorWithContext(error, 'Test Context');

    expect(errorSpy).toHaveBeenCalledWith('[Network Error]', expect.stringContaining('Unable to connect'));
    expect(infoSpy).toHaveBeenCalled();
  });
});
