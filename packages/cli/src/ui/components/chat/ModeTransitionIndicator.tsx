/**
 * Mode Transition Indicator
 * 
 * Displays animated transition messages when switching between modes.
 * Shows loading spinner during transition and completion message when done.
 */

import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';

import type { TransitionAnimation } from '@ollm/ollm-cli-core';

export interface ModeTransitionIndicatorProps {
  /** The transition animation to display */
  animation: TransitionAnimation;
  /** Theme color for the indicator */
  color?: string;
}

/**
 * Spinner frames for transition animation
 */
const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

/**
 * Mode Transition Indicator Component
 * 
 * Displays an animated indicator during mode transitions with:
 * - Animated spinner during transition
 * - Mode-specific icon and message
 * - Completion checkmark when done
 */
export function ModeTransitionIndicator({
  animation,
  color = '#888888',
}: ModeTransitionIndicatorProps) {
  const [frameIndex, setFrameIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(true);

  // Animate spinner during active state
  useEffect(() => {
    if (animation.state !== 'active') {
      return;
    }

    const interval = setInterval(() => {
      setFrameIndex((prev) => (prev + 1) % SPINNER_FRAMES.length);
    }, 80);

    return () => clearInterval(interval);
  }, [animation.state]);

  // Auto-hide after completion
  useEffect(() => {
    if (animation.state === 'complete') {
      const timer = setTimeout(() => {
        setIsVisible(false);
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, [animation.state]);

  if (!isVisible) {
    return null;
  }

  // Render based on animation state
  if (animation.state === 'pending') {
    return null; // Don't show until active
  }

  if (animation.state === 'complete') {
    return (
      <Box marginY={0}>
        <Text color="green" dimColor={false}>
          {animation.completionMessage}
        </Text>
      </Box>
    );
  }

  // Active state - show spinner and loading message
  return (
    <Box marginY={0}>
      <Text color={color}>
        {SPINNER_FRAMES[frameIndex]} {animation.loadingMessage}
      </Text>
    </Box>
  );
}
