import { useState, useCallback, useRef } from 'react';

/**
 * Hook for managing undo/redo state
 * @param initialValue - The initial value
 * @param maxHistory - Maximum number of history items to keep (default: 50)
 */
export function useUndoRedo<T>(initialValue: T, maxHistory: number = 50) {
  const [state, setState] = useState<T>(initialValue);
  const [history, setHistory] = useState<T[]>([initialValue]);
  const [currentIndex, setCurrentIndex] = useState(0);

  // Track if we're in the middle of an undo/redo operation
  const isUndoingRef = useRef(false);

  /**
   * Set a new value and add it to history
   */
  const set = useCallback((newValue: T | ((prev: T) => T)) => {
    // Don't add to history if we're undoing/redoing
    if (isUndoingRef.current) {
      return;
    }

    setState((prevState) => {
      const value = typeof newValue === 'function'
        ? (newValue as (prev: T) => T)(prevState)
        : newValue;

      // Only add to history if the value actually changed
      if (JSON.stringify(value) === JSON.stringify(prevState)) {
        return prevState;
      }

      setHistory((prevHistory) => {
        // Slice history to current index + 1 (discard any redo history)
        const newHistory = prevHistory.slice(0, currentIndex + 1);

        // Add new value
        newHistory.push(value);

        // Trim history if it exceeds max
        if (newHistory.length > maxHistory) {
          return newHistory.slice(newHistory.length - maxHistory);
        }

        return newHistory;
      });

      setCurrentIndex((prevIndex) => {
        const newIndex = prevIndex + 1;
        // Adjust index if we've hit max history
        return Math.min(newIndex, maxHistory - 1);
      });

      return value;
    });
  }, [currentIndex, maxHistory]);

  /**
   * Undo to previous state
   */
  const undo = useCallback(() => {
    if (currentIndex > 0) {
      isUndoingRef.current = true;
      const newIndex = currentIndex - 1;
      setCurrentIndex(newIndex);
      setState(history[newIndex]);
      // Reset flag after state update
      setTimeout(() => {
        isUndoingRef.current = false;
      }, 0);
    }
  }, [currentIndex, history]);

  /**
   * Redo to next state
   */
  const redo = useCallback(() => {
    if (currentIndex < history.length - 1) {
      isUndoingRef.current = true;
      const newIndex = currentIndex + 1;
      setCurrentIndex(newIndex);
      setState(history[newIndex]);
      // Reset flag after state update
      setTimeout(() => {
        isUndoingRef.current = false;
      }, 0);
    }
  }, [currentIndex, history]);

  /**
   * Reset history and set new initial value
   */
  const reset = useCallback((newInitialValue: T) => {
    setState(newInitialValue);
    setHistory([newInitialValue]);
    setCurrentIndex(0);
  }, []);

  /**
   * Clear all history
   */
  const clear = useCallback(() => {
    setHistory([state]);
    setCurrentIndex(0);
  }, [state]);

  const canUndo = currentIndex > 0;
  const canRedo = currentIndex < history.length - 1;

  return {
    state,
    set,
    undo,
    redo,
    reset,
    clear,
    canUndo,
    canRedo,
    historyLength: history.length,
    currentIndex
  };
}
