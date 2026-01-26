/**
 * Hook for managing scroll state and navigation
 */

import { useCallback, useEffect } from 'react';

export interface UseScrollManagerProps {
  selectedLineIndex: number;
  setSelectedLineIndex: React.Dispatch<React.SetStateAction<number>>;
  scrollOffset: number;
  setScrollOffset: React.Dispatch<React.SetStateAction<number>>;
  streaming: boolean;
  messagesLength: number;
}

export interface UseScrollManagerReturn {
  selectedLineIndex: number;
  setSelectedLineIndex: React.Dispatch<React.SetStateAction<number>>;
  scrollOffset: number;
  scrollUp: () => void;
  scrollDown: () => void;
}

/**
 * Manages scroll position and navigation in chat
 */
export function useScrollManager({
  selectedLineIndex,
  setSelectedLineIndex,
  scrollOffset,
  setScrollOffset,
  streaming,
  messagesLength,
}: UseScrollManagerProps): UseScrollManagerReturn {
  
  /**
   * Scroll up one line
   */
  const scrollUp = useCallback(() => {
    setSelectedLineIndex(prev => Math.max(0, prev - 1));
  }, [setSelectedLineIndex]);

  /**
   * Scroll down one line
   */
  const scrollDown = useCallback(() => {
    setSelectedLineIndex(prev => prev + 1);
  }, [setSelectedLineIndex]);

  /**
   * Auto-scroll to bottom when streaming or new messages arrive
   */
  useEffect(() => {
    // If we are streaming (assistant typing), stay at bottom (offset 0)
    if (streaming) {
      setScrollOffset(0);
    }
  }, [messagesLength, streaming, setScrollOffset]);

  return {
    selectedLineIndex,
    setSelectedLineIndex,
    scrollOffset,
    scrollUp,
    scrollDown,
  };
}
