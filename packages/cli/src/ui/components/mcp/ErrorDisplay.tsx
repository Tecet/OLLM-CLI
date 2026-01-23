/**
 * Error Display Component for MCP Panel
 * 
 * Displays user-friendly error messages with recovery suggestions
 * and retry options for failed operations.
 */

import React from 'react';
import { Box, Text, useInput } from 'ink';

import { useUI } from '../../../features/context/UIContext.js';

export interface ErrorDisplayProps {
  /** Error message to display */
  message: string;
  /** Whether the error is retryable */
  canRetry?: boolean;
  /** Callback for retry action */
  onRetry?: () => void;
  /** Callback for dismiss action */
  onDismiss?: () => void;
}

/**
 * Error display component with suggestions and actions
 */
export const ErrorDisplay: React.FC<ErrorDisplayProps> = ({
  message,
  canRetry = false,
  onRetry,
  onDismiss,
}) => {
  const { state: { theme } } = useUI();

  return (
    <Box
      flexDirection="column"
      padding={1}
      borderStyle="round"
      borderColor={theme.status.error}
    >
      <Box marginBottom={1}>
        <Text color={theme.status.error} bold>
          ❌ Error
        </Text>
      </Box>

      <Box flexDirection="column">
        {message.split('\n').map((line, index) => (
          <Text key={index} color={theme.text.primary}>
            {line}
          </Text>
        ))}
      </Box>

      {(canRetry || onDismiss) && (
        <Box marginTop={1} gap={2}>
          {canRetry && onRetry && (
            <Text color={theme.text.secondary}>
              Press R to retry
            </Text>
          )}
          {onDismiss && (
            <Text color={theme.text.secondary}>
              Press D to dismiss
            </Text>
          )}
        </Box>
      )}
    </Box>
  );
};

/**
 * Compact error display for inline errors
 */
export const CompactErrorDisplay: React.FC<{ message: string }> = ({ message }) => {
  const { state: { theme } } = useUI();

  return (
    <Box>
      <Text color={theme.status.error}>❌ {message}</Text>
    </Box>
  );
};

/**
 * Error banner for top-level errors
 */
export const ErrorBanner: React.FC<ErrorDisplayProps> = ({
  message,
  canRetry = false,
  onRetry,
  onDismiss,
}) => {
  const { state: { theme } } = useUI();

  // Extract first line for banner
  const firstLine = message.split('\n')[0];

  return (
    <Box
      paddingX={1}
      borderStyle="single"
      borderColor={theme.status.error}
    >
      <Text color={theme.status.error} bold>
        ❌
      </Text>
      <Box marginLeft={1} flexGrow={1}>
        <Text color={theme.text.primary}>{firstLine}</Text>
      </Box>
    </Box>
  );
};
