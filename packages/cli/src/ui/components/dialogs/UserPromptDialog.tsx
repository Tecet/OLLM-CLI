/**
 * UserPromptDialog - Interactive user prompt component
 * 
 * Displays a question with multiple choice options for user selection.
 * Used for tool support detection, model configuration, and other
 * interactive workflows.
 */

import React from 'react';
import { Box, Text } from 'ink';
import type { Theme } from '../../../config/types.js';

export interface UserPromptDialogProps {
  /** The question/message to display */
  message: string;
  /** Available options for selection */
  options: string[];
  /** Currently selected option index */
  selectedIndex: number;
  /** Theme for styling */
  theme: Theme;
  /** Whether dialog is visible */
  visible: boolean;
  /** Optional timeout information */
  timeout?: {
    /** Total timeout in milliseconds */
    duration: number;
    /** Elapsed time in milliseconds */
    elapsed: number;
    /** Default option if timeout expires */
    defaultOption?: string;
  };
}

/**
 * Dialog for prompting user with multiple choice options
 */
export function UserPromptDialog({
  message,
  options,
  selectedIndex,
  theme,
  visible,
  timeout,
}: UserPromptDialogProps) {
  if (!visible) {
    return null;
  }

  // Calculate timeout progress if applicable
  const timeoutProgress = timeout
    ? Math.min(100, (timeout.elapsed / timeout.duration) * 100)
    : 0;

  const remainingSeconds = timeout
    ? Math.ceil((timeout.duration - timeout.elapsed) / 1000)
    : 0;

  return (
    <Box
      flexDirection="column"
      borderStyle="double"
      borderColor={theme.text.accent}
      padding={1}
      width="70%"
    >
      {/* Title */}
      <Box marginBottom={1}>
        <Text bold color={theme.text.accent}>
          ❓ User Input Required
        </Text>
      </Box>

      {/* Message */}
      <Box marginBottom={1} paddingX={1}>
        <Text color={theme.text.primary}>{message}</Text>
      </Box>

      {/* Timeout indicator */}
      {timeout && (
        <Box
          flexDirection="column"
          marginBottom={1}
          paddingX={1}
          borderStyle="single"
          borderColor={theme.border.secondary}
        >
          <Box>
            <Text color={theme.text.secondary}>
              Auto-selecting in {remainingSeconds}s
              {timeout.defaultOption && ` (default: ${timeout.defaultOption})`}
            </Text>
          </Box>
          <Box marginTop={0}>
            <Text color={theme.text.secondary} dimColor>
              {'█'.repeat(Math.floor(timeoutProgress / 5))}
              {'░'.repeat(20 - Math.floor(timeoutProgress / 5))}
            </Text>
          </Box>
        </Box>
      )}

      {/* Options */}
      <Box flexDirection="column" marginBottom={1} paddingX={1}>
        <Box marginBottom={1}>
          <Text color={theme.text.secondary}>Select an option:</Text>
        </Box>

        {options.map((option, index) => {
          const isSelected = index === selectedIndex;
          return (
            <Box key={index} marginLeft={2}>
              <Text
                color={isSelected ? theme.text.accent : theme.text.primary}
                bold={isSelected}
              >
                {isSelected ? '▶ ' : '  '}
                {option}
              </Text>
            </Box>
          );
        })}
      </Box>

      {/* Instructions */}
      <Box paddingX={1}>
        <Text color={theme.text.secondary} dimColor>
          Use ↑/↓ to navigate, Enter to select, Esc to cancel
        </Text>
      </Box>
    </Box>
  );
}
