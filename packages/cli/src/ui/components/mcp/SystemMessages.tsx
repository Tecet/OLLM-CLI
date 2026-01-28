/**
 * SystemMessages Component
 *
 * Displays system-wide messages (errors, warnings, info, success) in a fixed area
 * at the bottom of the left column. Non-invasive and dismissible.
 */

import React from 'react';
import { Box, Text, useInput } from 'ink';

import { useUI } from '../../../features/context/UIContext.js';

export interface SystemMessage {
  /** Unique message ID */
  id: string;
  /** Message type */
  type: 'error' | 'warning' | 'info' | 'success';
  /** Message text */
  message: string;
  /** Timestamp when message was created */
  timestamp: number;
  /** Whether the message can be dismissed */
  dismissible: boolean;
}

export interface SystemMessagesProps {
  /** List of messages to display */
  messages: SystemMessage[];
  /** Callback when a message is dismissed */
  onDismiss: (id: string) => void;
  /** Whether this component is active (can handle input) */
  isActive: boolean;
}

/**
 * SystemMessages Component
 *
 * Displays system messages in a fixed area at the bottom of the left column.
 * Messages can be dismissed with X or ESC key.
 */
export const SystemMessages: React.FC<SystemMessagesProps> = ({
  messages,
  onDismiss,
  isActive,
}) => {
  const { state: uiState } = useUI();

  // Handle dismiss on X or ESC
  useInput(
    (input, key) => {
      if (!isActive || messages.length === 0) return;

      if (input === 'x' || input === 'X' || key.escape) {
        // Dismiss first dismissible message
        const dismissible = messages.find((m) => m.dismissible);
        if (dismissible) {
          onDismiss(dismissible.id);
        }
      }
    },
    { isActive }
  );

  if (messages.length === 0) return null;

  return (
    <Box flexDirection="column" borderStyle="single" borderColor="gray" flexShrink={0}>
      {/* Header - Center aligned */}
      <Box
        paddingX={1}
        borderStyle="single"
        borderColor="gray"
        flexShrink={0}
        justifyContent="center"
      >
        <Text bold>📢 System Messages</Text>
      </Box>

      {/* Messages - Center aligned */}
      <Box flexDirection="column" flexShrink={0} width="100%">
        {messages.map((msg) => {
          const icon =
            msg.type === 'error'
              ? '❌'
              : msg.type === 'warning'
                ? '⚠️'
                : msg.type === 'info'
                  ? 'ℹ️'
                  : '✓';
          const color =
            msg.type === 'error'
              ? uiState.theme.status.error
              : msg.type === 'warning'
                ? uiState.theme.status.warning
                : msg.type === 'info'
                  ? uiState.theme.status.info
                  : uiState.theme.status.success;

          return (
            <Box
              key={msg.id}
              flexDirection="column"
              paddingX={1}
              paddingY={1}
              flexShrink={0}
              width="100%"
              alignItems="center"
            >
              <Text color={color}>
                {icon} {msg.message}
              </Text>
              {msg.dismissible && <Text dimColor>Press X or ESC to dismiss</Text>}
            </Box>
          );
        })}
      </Box>
    </Box>
  );
};
