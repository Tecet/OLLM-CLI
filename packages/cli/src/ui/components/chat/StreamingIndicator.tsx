import React, { useState, useEffect } from 'react';
import { Text } from 'ink';

export type SpinnerType = 'dots' | 'line' | 'arc' | 'bounce';

export interface StreamingIndicatorProps {
  text?: string;
  spinnerType?: SpinnerType;
  color?: string;
  intervalMs?: number;
}

/**
 * Spinner frame definitions
 */
export const spinnerFrames: Record<SpinnerType, string[]> = {
  dots: ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'],
  line: ['|', '/', '-', '\\'],
  arc: ['◜', '◠', '◝', '◞', '◡', '◟'],
  bounce: ['⠁', '⠂', '⠄', '⠂'],
};

/**
 * StreamingIndicator component displays an animated spinner
 * to indicate ongoing streaming or processing
 */
export function StreamingIndicator({
  text = 'Streaming...',
  spinnerType = 'dots',
  color = '#888888',
  intervalMs = 250,
}: StreamingIndicatorProps) {
  const [frameIndex, setFrameIndex] = useState(0);
  const frames = spinnerFrames[spinnerType];

  useEffect(() => {
    const interval = setInterval(() => {
      setFrameIndex((prev) => (prev + 1) % frames.length);
    }, intervalMs);

    return () => clearInterval(interval);
  }, [frames.length, intervalMs]);

  return (
    <Text color={color}>
      {frames[frameIndex]} {text}
    </Text>
  );
}
