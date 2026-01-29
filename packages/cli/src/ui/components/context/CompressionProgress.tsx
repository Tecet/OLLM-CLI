/**
 * CompressionProgress Component
 *
 * Displays progress during context compression operations.
 * Blocks user input and shows clear status updates.
 *
 * Validates: NFR-3 (User Experience)
 */

import React from 'react';
import { Box, Text } from 'ink';

import { StreamingIndicator } from '../chat/StreamingIndicator.js';
import { FadeTransition, Pulse } from '../mcp/FadeTransition.js';

export interface CompressionProgressProps {
  /** Whether compression is in progress */
  active: boolean;
  /** Current compression stage */
  stage?:
    | 'identifying'
    | 'preparing'
    | 'summarizing'
    | 'creating-checkpoint'
    | 'updating-context'
    | 'validating';
  /** Optional progress percentage (0-100) */
  progress?: number;
  /** Whether compression completed successfully */
  complete?: boolean;
  /** Error message if compression failed */
  error?: string;
  /** Number of messages being compressed */
  messageCount?: number;
  /** Tokens freed by compression */
  tokensFreed?: number;
}

/**
 * Get stage display text
 */
function getStageText(stage: CompressionProgressProps['stage']): string {
  switch (stage) {
    case 'identifying':
      return 'Identifying messages to compress';
    case 'preparing':
      return 'Preparing for summarization';
    case 'summarizing':
      return 'Creating semantic summary';
    case 'creating-checkpoint':
      return 'Creating checkpoint';
    case 'updating-context':
      return 'Updating active context';
    case 'validating':
      return 'Validating result';
    default:
      return 'Compressing context';
  }
}

/**
 * Get stage icon
 */
function getStageIcon(stage: CompressionProgressProps['stage']): string {
  switch (stage) {
    case 'identifying':
      return '🔍';
    case 'preparing':
      return '📋';
    case 'summarizing':
      return '🧠';
    case 'creating-checkpoint':
      return '💾';
    case 'updating-context':
      return '🔄';
    case 'validating':
      return '✓';
    default:
      return '📦';
  }
}

/**
 * Create a text-based progress bar
 */
function createProgressBar(progress: number, width: number): string {
  const filled = Math.round((progress / 100) * width);
  const empty = width - filled;
  return '█'.repeat(filled) + '░'.repeat(empty);
}

/**
 * CompressionProgress Component
 *
 * Displays compression progress with:
 * - Animated spinner
 * - Current stage description
 * - Optional progress bar
 * - Success/error states
 * - Tokens freed information
 *
 * Blocks user input during compression to prevent interference.
 */
export function CompressionProgress({
  active,
  stage,
  progress,
  complete = false,
  error,
  messageCount,
  tokensFreed,
}: CompressionProgressProps) {
  // Don't render if not active and not complete/error
  if (!active && !complete && !error) {
    return null;
  }

  const stageText = getStageText(stage);
  const icon = getStageIcon(stage);

  // Error state
  if (error) {
    return (
      <FadeTransition show={true} duration={300}>
        <Box flexDirection="column" borderStyle="round" borderColor="red" paddingX={2} paddingY={1}>
          <Box>
            <Text color="red" bold>
              ✗ Compression Failed
            </Text>
          </Box>
          <Box marginTop={1}>
            <Text dimColor>{error}</Text>
          </Box>
          <Box marginTop={1}>
            <Text dimColor italic>
              Context remains unchanged. You can continue the conversation.
            </Text>
          </Box>
        </Box>
      </FadeTransition>
    );
  }

  // Complete state
  if (complete) {
    return (
      <FadeTransition show={true} duration={300}>
        <Box
          flexDirection="column"
          borderStyle="round"
          borderColor="green"
          paddingX={2}
          paddingY={1}
        >
          <Box>
            <Text color="green" bold>
              ✓ Compression Complete
            </Text>
          </Box>
          {messageCount !== undefined && (
            <Box marginTop={1}>
              <Text dimColor>Compressed </Text>
              <Text color="green" bold>
                {messageCount}
              </Text>
              <Text dimColor> messages</Text>
            </Box>
          )}
          {tokensFreed !== undefined && (
            <Box>
              <Text dimColor>Freed </Text>
              <Text color="green" bold>
                {tokensFreed.toLocaleString()}
              </Text>
              <Text dimColor> tokens</Text>
            </Box>
          )}
          <Box marginTop={1}>
            <Text dimColor italic>
              You can now continue the conversation.
            </Text>
          </Box>
        </Box>
      </FadeTransition>
    );
  }

  // In-progress state
  return (
    <FadeTransition show={true} duration={300}>
      <Box flexDirection="column" borderStyle="round" borderColor="yellow" paddingX={2} paddingY={1}>
        {/* Header */}
        <Box>
          <Pulse active={true} color="yellow" interval={500}>
            <Text color="yellow" bold>
              📦 Compressing Context
            </Text>
          </Pulse>
        </Box>

        {/* Current stage */}
        <Box marginTop={1}>
          <StreamingIndicator
            text={`${icon} ${stageText}...`}
            spinnerType="dots"
            color="yellow"
          />
        </Box>

        {/* Progress bar (if progress provided) */}
        {progress !== undefined && (
          <Box marginTop={1}>
            <Text color="yellow">
              [{createProgressBar(progress, 30)}] {progress}%
            </Text>
          </Box>
        )}

        {/* Message count */}
        {messageCount !== undefined && (
          <Box marginTop={1}>
            <Text dimColor>
              Processing {messageCount} message{messageCount !== 1 ? 's' : ''}
            </Text>
          </Box>
        )}

        {/* Input blocking notice */}
        <Box marginTop={1}>
          <Text dimColor italic>
            Please wait... Input is temporarily blocked.
          </Text>
        </Box>
      </Box>
    </FadeTransition>
  );
}
