/**
 * Progress Persistence Utility
 * Saves and restores generation progress across page refreshes
 */

export interface GenerationProgressState {
  timestamp: number;
  dialogueChunks: any[];
  characterConfigs: any;
  projectSettings: any;
  sfxConfigs: any[];
  currentIndex: number;
  totalChunks: number;
  status: 'in_progress' | 'paused' | 'completed' | 'error';
  generatedFiles: string[]; // Array of generated file names
  lastMessage: string;
}

const PROGRESS_KEY = 'generation-progress';
const PROGRESS_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Save generation progress to localStorage
 */
export function saveProgress(progress: GenerationProgressState, userId: string = 'default'): void {
  try {
    const key = `${userId}-${PROGRESS_KEY}`;
    localStorage.setItem(key, JSON.stringify(progress));
  } catch (error) {
    console.error('Failed to save progress:', error);
  }
}

/**
 * Load generation progress from localStorage
 * Returns null if no valid progress is found
 */
export function loadProgress(userId: string = 'default'): GenerationProgressState | null {
  try {
    const key = `${userId}-${PROGRESS_KEY}`;
    const stored = localStorage.getItem(key);

    if (!stored) {
      return null;
    }

    const progress: GenerationProgressState = JSON.parse(stored);

    // Check if progress has expired
    const age = Date.now() - progress.timestamp;
    if (age > PROGRESS_EXPIRY_MS) {
      clearProgress(userId);
      return null;
    }

    return progress;
  } catch (error) {
    console.error('Failed to load progress:', error);
    return null;
  }
}

/**
 * Clear saved progress
 */
export function clearProgress(userId: string = 'default'): void {
  try {
    const key = `${userId}-${PROGRESS_KEY}`;
    localStorage.removeItem(key);
  } catch (error) {
    console.error('Failed to clear progress:', error);
  }
}

/**
 * Update progress with new values
 */
export function updateProgress(
  userId: string = 'default',
  updates: Partial<GenerationProgressState>
): void {
  const existing = loadProgress(userId);
  if (!existing) {
    console.warn('No existing progress to update');
    return;
  }

  const updated: GenerationProgressState = {
    ...existing,
    ...updates,
    timestamp: Date.now()
  };

  saveProgress(updated, userId);
}

/**
 * Check if there is resumable progress
 */
export function hasResumableProgress(userId: string = 'default'): boolean {
  const progress = loadProgress(userId);
  return progress !== null &&
         progress.status === 'in_progress' &&
         progress.currentIndex < progress.totalChunks;
}

/**
 * Get progress percentage
 */
export function getProgressPercentage(progress: GenerationProgressState): number {
  if (progress.totalChunks === 0) return 0;
  return Math.round((progress.currentIndex / progress.totalChunks) * 100);
}

/**
 * Format time remaining estimate
 */
export function estimateTimeRemaining(progress: GenerationProgressState): string {
  const elapsed = Date.now() - progress.timestamp;
  const remaining = progress.totalChunks - progress.currentIndex;

  if (progress.currentIndex === 0 || remaining === 0) {
    return 'Calculating...';
  }

  const avgTimePerChunk = elapsed / progress.currentIndex;
  const estimatedMs = avgTimePerChunk * remaining;

  const minutes = Math.floor(estimatedMs / 60000);
  const seconds = Math.floor((estimatedMs % 60000) / 1000);

  if (minutes > 0) {
    return `~${minutes}m ${seconds}s remaining`;
  }
  return `~${seconds}s remaining`;
}
