/**
 * FadeTransition Component
 *
 * Provides fade in/out animations for state changes.
 * Simulates opacity transitions in terminal UI.
 *
 * Features:
 * - Fade in animation on mount
 * - Fade out animation on unmount
 * - Configurable duration
 * - Callback on animation complete
 *
 * Note: Terminal UI doesn't support true opacity, so this uses
 * dimColor and visibility to simulate fade effects.
 *
 * Validates: NFR-7
 */

import React, { useState, useEffect, ReactNode } from 'react';
import { Box, Text } from 'ink';

export interface FadeTransitionProps {
  /** Content to animate */
  children: ReactNode;
  /** Whether content should be visible */
  show: boolean;
  /** Fade duration in milliseconds */
  duration?: number;
  /** Callback when fade in completes */
  onFadeInComplete?: () => void;
  /** Callback when fade out completes */
  onFadeOutComplete?: () => void;
}

/**
 * FadeTransition Component
 *
 * Wraps content with fade in/out animations.
 * Uses dimColor to simulate opacity changes in terminal.
 */
export function FadeTransition({
  children,
  show,
  duration = 300,
  onFadeInComplete,
  onFadeOutComplete,
}: FadeTransitionProps) {
  const [isVisible, setIsVisible] = useState(show);
  const [isFading, setIsFading] = useState(false);

  useEffect(() => {
    if (show) {
      // Fade in
      setIsVisible(true);
      setIsFading(true);

      const timer = setTimeout(() => {
        setIsFading(false);
        onFadeInComplete?.();
      }, duration);

      return () => clearTimeout(timer);
    } else {
      // Fade out
      setIsFading(true);

      const timer = setTimeout(() => {
        setIsVisible(false);
        setIsFading(false);
        onFadeOutComplete?.();
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [show, duration, onFadeInComplete, onFadeOutComplete]);

  if (!isVisible) {
    return null;
  }

  // Use dimColor during fade to simulate opacity
  if (isFading && !show) {
    return (
      <Box>
        <Text dimColor>{children}</Text>
      </Box>
    );
  }

  return <>{children}</>;
}

/**
 * SlideIn Component
 *
 * Slides content in from the side with animation.
 * Simulates slide animation using spacing.
 */
export interface SlideInProps {
  children: ReactNode;
  show: boolean;
  direction?: 'left' | 'right' | 'top' | 'bottom';
  duration?: number;
}

export function SlideIn({ children, show, direction = 'right', duration = 300 }: SlideInProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [offset, setOffset] = useState(10);

  useEffect(() => {
    if (show) {
      setIsVisible(true);

      // Animate offset to 0
      const steps = 5;
      const stepDuration = duration / steps;
      let currentStep = 0;

      const interval = setInterval(() => {
        currentStep++;
        setOffset(10 - currentStep * 2);

        if (currentStep >= steps) {
          clearInterval(interval);
          setOffset(0);
        }
      }, stepDuration);

      return () => clearInterval(interval);
    } else {
      setIsVisible(false);
      setOffset(10);
    }
  }, [show, duration]);

  if (!isVisible) {
    return null;
  }

  // Apply offset based on direction
  const marginProps = {
    marginLeft: direction === 'right' ? offset : 0,
    marginRight: direction === 'left' ? offset : 0,
    marginTop: direction === 'bottom' ? Math.floor(offset / 2) : 0,
    marginBottom: direction === 'top' ? Math.floor(offset / 2) : 0,
  };

  return <Box {...marginProps}>{children}</Box>;
}

/**
 * Pulse Component
 *
 * Pulses content to draw attention.
 * Uses color alternation to simulate pulse effect.
 */
export interface PulseProps {
  children: ReactNode;
  active: boolean;
  color?: string;
  interval?: number;
}

export function Pulse({ children, active, color = 'cyan', interval = 500 }: PulseProps) {
  const [isPulsing, setIsPulsing] = useState(false);

  useEffect(() => {
    if (!active) {
      setIsPulsing(false);
      return;
    }

    const timer = setInterval(() => {
      setIsPulsing((prev) => !prev);
    }, interval);

    return () => clearInterval(timer);
  }, [active, interval]);

  if (!active) {
    return <>{children}</>;
  }

  return (
    <Text color={isPulsing ? color : undefined} bold={isPulsing}>
      {children}
    </Text>
  );
}

/**
 * Blink Component
 *
 * Blinks content on and off to draw attention.
 */
export interface BlinkProps {
  children: ReactNode;
  active: boolean;
  interval?: number;
}

export function Blink({ children, active, interval = 500 }: BlinkProps) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    if (!active) {
      setIsVisible(true);
      return;
    }

    const timer = setInterval(() => {
      setIsVisible((prev) => !prev);
    }, interval);

    return () => clearInterval(timer);
  }, [active, interval]);

  if (!isVisible) {
    return <Text> </Text>;
  }

  return <>{children}</>;
}
