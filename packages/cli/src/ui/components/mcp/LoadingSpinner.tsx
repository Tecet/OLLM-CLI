/**
 * LoadingSpinner Component
 * 
 * Reusable loading spinner for MCP panel operations.
 * Uses the StreamingIndicator component for consistent animations.
 * 
 * Validates: NFR-7
 */

import React from 'react';
import { Box } from 'ink';

import { StreamingIndicator, type SpinnerType } from '../chat/StreamingIndicator.js';

export interface LoadingSpinnerProps {
  /** Message to display next to spinner */
  message?: string;
  /** Type of spinner animation */
  spinnerType?: SpinnerType;
  /** Color of the spinner */
  color?: string;
  /** Whether to center the spinner */
  centered?: boolean;
  /** Whether to add padding */
  padded?: boolean;
}

/**
 * LoadingSpinner Component
 * 
 * Displays an animated spinner with an optional message.
 * Used for loading states throughout the MCP panel.
 */
export function LoadingSpinner({
  message = 'Loading...',
  spinnerType = 'dots',
  color = 'cyan',
  centered = true,
  padded = true,
}: LoadingSpinnerProps) {
  const content = (
    <StreamingIndicator
      text={message}
      spinnerType={spinnerType}
      color={color}
    />
  );

  if (centered) {
    return (
      <Box
        flexDirection="column"
        padding={padded ? 2 : 0}
        alignItems="center"
        justifyContent="center"
      >
        {content}
      </Box>
    );
  }

  return (
    <Box padding={padded ? 1 : 0}>
      {content}
    </Box>
  );
}
