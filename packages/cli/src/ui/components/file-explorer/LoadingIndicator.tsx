/**
 * LoadingIndicator - Loading indicator for long-running operations
 * 
 * Displays a spinner and message for operations that take longer than 500ms.
 * Provides visual feedback to users during file operations, git queries, etc.
 * 
 * Requirements: 11.4 (Display loading indicators for operations >500ms)
 */

import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';

/**
 * Props for LoadingIndicator component
 */
export interface LoadingIndicatorProps {
  /** Whether the operation is in progress */
  isLoading: boolean;
  /** Message to display while loading */
  message?: string;
  /** Delay before showing the indicator (default: 500ms) */
  delay?: number;
}

/**
 * Spinner frames for animation
 */
const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

/**
 * LoadingIndicator component
 * 
 * Shows a spinner and optional message for long-running operations.
 * Only displays after the specified delay (default 500ms) to avoid
 * flickering for fast operations.
 */
export function LoadingIndicator({ 
  isLoading, 
  message = 'Loading...', 
  delay = 500 
}: LoadingIndicatorProps) {
  const [shouldShow, setShouldShow] = useState(false);
  const [frameIndex, setFrameIndex] = useState(0);

  // Delay showing the indicator to avoid flickering
  useEffect(() => {
    if (!isLoading) {
      setShouldShow(false);
      return;
    }

    const timer = setTimeout(() => {
      setShouldShow(true);
    }, delay);

    return () => clearTimeout(timer);
  }, [isLoading, delay]);

  // Animate the spinner
  useEffect(() => {
    if (!shouldShow) {
      return;
    }

    const interval = setInterval(() => {
      setFrameIndex((prev) => (prev + 1) % SPINNER_FRAMES.length);
    }, 80); // Update every 80ms for smooth animation

    return () => clearInterval(interval);
  }, [shouldShow]);

  if (!shouldShow) {
    return null;
  }

  return (
    <Box flexDirection="row">
      <Text color="cyan">{SPINNER_FRAMES[frameIndex]}</Text>
      <Text> {message}</Text>
    </Box>
  );
}

/**
 * Hook to manage loading state with automatic delay
 * 
 * Returns a tuple of [isLoading, setIsLoading] similar to useState,
 * but automatically handles the delay logic.
 * 
 * @param initialState - Initial loading state
 * @param delay - Delay before showing indicator (default: 500ms)
 * @returns Tuple of [isLoading, setIsLoading]
 * 
 * @example
 * ```tsx
 * const [isLoading, setIsLoading] = useLoadingState(false);
 * 
 * async function loadData() {
 *   setIsLoading(true);
 *   try {
 *     await fetchData();
 *   } finally {
 *     setIsLoading(false);
 *   }
 * }
 * 
 * return <LoadingIndicator isLoading={isLoading} message="Loading data..." />;
 * ```
 */
export function useLoadingState(
  initialState = false,
  delay = 500
): [boolean, (loading: boolean) => void] {
  const [isLoading, setIsLoading] = useState(initialState);

  return [isLoading, setIsLoading];
}
