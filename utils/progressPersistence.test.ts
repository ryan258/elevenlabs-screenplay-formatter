import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  saveProgress,
  loadProgress,
  clearProgress,
  updateProgress,
  hasResumableProgress,
  getProgressPercentage,
  estimateTimeRemaining,
  GenerationProgressState,
} from './progressPersistence';

const createMockStorage = () => {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => store.clear(),
  };
};

const getBaseProgress = (): GenerationProgressState => ({
  timestamp: Date.now(),
  dialogueChunks: [{ text: 'Hello world' }],
  characterConfigs: {},
  projectSettings: {},
  sfxConfigs: [],
  currentIndex: 1,
  totalChunks: 3,
  status: 'in_progress',
  generatedFiles: ['0000_TEST.mp3'],
  lastMessage: 'Generating',
});

describe('progressPersistence', () => {
  beforeEach(() => {
    (globalThis as any).localStorage = createMockStorage();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-01T00:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
    (globalThis as any).localStorage?.clear();
  });

  it('saves and loads progress for a user', () => {
    const progress = getBaseProgress();
    saveProgress(progress, 'user1');
    const loaded = loadProgress('user1');
    expect(loaded).toEqual(progress);
  });

  it('returns null for expired progress', () => {
    const expired = { ...getBaseProgress(), timestamp: Date.now() - (24 * 60 * 60 * 1000 + 1) };
    saveProgress(expired, 'user2');

    const result = loadProgress('user2');
    expect(result).toBeNull();
    expect(localStorage.getItem('user2-generation-progress')).toBeNull();
  });

  it('updates existing progress with new values', () => {
    const progress = getBaseProgress();
    saveProgress(progress, 'user3');
    vi.advanceTimersByTime(60_000);

    updateProgress('user3', { currentIndex: 2, lastMessage: 'Halfway there' });

    const updated = loadProgress('user3');
    expect(updated?.currentIndex).toBe(2);
    expect(updated?.lastMessage).toBe('Halfway there');
    expect(updated?.timestamp).toBe(Date.now());
  });

  it('identifies resumable progress correctly', () => {
    saveProgress({ ...getBaseProgress(), currentIndex: 0 }, 'user4');
    expect(hasResumableProgress('user4')).toBe(true);

    updateProgress('user4', { currentIndex: 3 });
    expect(hasResumableProgress('user4')).toBe(false);
  });

  it('computes progress percentage', () => {
    const progress = getBaseProgress();
    expect(getProgressPercentage(progress)).toBe(Math.round((1 / 3) * 100));
    expect(getProgressPercentage({ ...progress, totalChunks: 0 })).toBe(0);
  });

  it('estimates time remaining based on observed progress', () => {
    const progress = getBaseProgress();
    saveProgress({ ...progress, currentIndex: 1 }, 'user5');
    vi.advanceTimersByTime(30_000);
    const estimate = estimateTimeRemaining({ ...progress, currentIndex: 1 });
    expect(estimate).toMatch(/remaining/);

    const calculating = estimateTimeRemaining({ ...progress, currentIndex: 0 });
    expect(calculating).toBe('Calculating...');
  });
});
