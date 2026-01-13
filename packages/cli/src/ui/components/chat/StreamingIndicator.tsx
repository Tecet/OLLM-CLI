import React, { useState, useEffect } from 'react';
import { Text } from 'ink';

export type SpinnerType = 'dots' | 'line' | 'arc' | 'bounce';

export interface StreamingIndicatorProps {
  text?: string;
  spinnerType?: SpinnerType;
  color?: string;
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
}: StreamingIndicatorProps) {
  const [frameIndex, setFrameIndex] = useState(0);
  const frames = spinnerFrames[spinnerType];

  useEffect(() => {
    const interval = setInterval(() => {
      setFrameIndex((prev) => (prev + 1) % frames.length);
    }, 80); // Update every 80ms for smooth animation

    return () => clearInterval(interval);
  }, [frames.length]);

  return (
    <Text color={color}>
      {frames[frameIndex]} {text}
    </Text>
  );
}
