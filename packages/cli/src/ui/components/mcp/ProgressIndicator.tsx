/**
 * ProgressIndicator Component
 * 
 * Progress indicator for long-running operations like install and restart.
 * Shows operation status with spinner and optional progress percentage.
 * 
 * Validates: NFR-7
 */

import React from 'react';
import { Box, Text } from 'ink';
import { StreamingIndicator } from '../chat/StreamingIndicator.js';
import { FadeTransition, Pulse } from './FadeTransition.js';

export interface ProgressIndicatorProps {
  /** Operation being performed */
  operation: 'install' | 'restart' | 'configure' | 'uninstall' | 'loading';
  /** Server name (optional) */
  serverName?: string;
  /** Progress percentage (0-100, optional) */
  progress?: number;
  /** Current step description (optional) */
  step?: string;
  /** Whether operation is complete */
  complete?: boolean;
  /** Whether operation failed */
  error?: string;
}

/**
 * Get operation display text
 */
function getOperationText(operation: ProgressIndicatorProps['operation']): string {
  switch (operation) {
    case 'install':
      return 'Installing';
    case 'restart':
      return 'Restarting';
    case 'configure':
      return 'Configuring';
    case 'uninstall':
      return 'Uninstalling';
    case 'loading':
      return 'Loading';
    default:
      return 'Processing';
  }
}

/**
 * Get operation icon
 */
function getOperationIcon(operation: ProgressIndicatorProps['operation']): string {
  switch (operation) {
    case 'install':
      return '⬇';
    case 'restart':
      return '↻';
    case 'configure':
      return '⚙';
    case 'uninstall':
      return '🗑';
    case 'loading':
      return '⏳';
    default:
      return '⚡';
  }
}

/**
 * ProgressIndicator Component
 * 
 * Displays progress for long-running operations with:
 * - Animated spinner
 * - Operation type and server name
 * - Optional progress percentage
 * - Current step description
 * - Success/error states
 */
export function ProgressIndicator({
  operation,
  serverName,
  progress,
  step,
  complete = false,
  error,
}: ProgressIndicatorProps) {
  const operationText = getOperationText(operation);
  const icon = getOperationIcon(operation);

  // Error state
  if (error) {
    return (
      <FadeTransition show={true} duration={300}>
        <Box flexDirection="column" borderStyle="round" borderColor="red" paddingX={2} paddingY={1}>
          <Box>
            <Text color="red" bold>
              ✗ {operationText} Failed
            </Text>
            {serverName && (
              <Text color="red"> - {serverName}</Text>
            )}
          </Box>
          <Box marginTop={1}>
            <Text dimColor>{error}</Text>
          </Box>
        </Box>
      </FadeTransition>
    );
  }

  // Complete state
  if (complete) {
    return (
      <FadeTransition show={true} duration={300}>
        <Box flexDirection="column" borderStyle="round" borderColor="green" paddingX={2} paddingY={1}>
          <Box>
            <Text color="green" bold>
              ✓ {operationText} Complete
            </Text>
            {serverName && (
              <Text color="green"> - {serverName}</Text>
            )}
          </Box>
        </Box>
      </FadeTransition>
    );
  }

  // In-progress state
  return (
    <FadeTransition show={true} duration={300}>
      <Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={2} paddingY={1}>
        {/* Operation header */}
        <Box>
          <Pulse active={true} color="cyan" interval={500}>
            <Text color="cyan" bold>
              {icon} {operationText}
            </Text>
          </Pulse>
          {serverName && (
            <Text color="cyan"> - {serverName}</Text>
          )}
        </Box>

        {/* Progress bar (if progress provided) */}
        {progress !== undefined && (
          <Box marginTop={1}>
            <Text color="cyan">
              [{createProgressBar(progress, 30)}] {progress}%
            </Text>
          </Box>
        )}

        {/* Current step */}
        {step && (
          <Box marginTop={1}>
            <StreamingIndicator
              text={step}
              spinnerType="dots"
              color="cyan"
            />
          </Box>
        )}

        {/* Generic spinner if no step */}
        {!step && (
          <Box marginTop={1}>
            <StreamingIndicator
              text="Please wait..."
              spinnerType="dots"
              color="cyan"
            />
          </Box>
        )}
      </Box>
    </FadeTransition>
  );
}

/**
 * Create a text-based progress bar
 */
function createProgressBar(progress: number, width: number): string {
  const filled = Math.round((progress / 100) * width);
  const empty = width - filled;
  return '█'.repeat(filled) + '░'.repeat(empty);
}
