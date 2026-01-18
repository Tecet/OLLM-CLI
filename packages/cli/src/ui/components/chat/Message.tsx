import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import { Message as MessageType } from '../../../features/context/ChatContext.js';
import { MetricsDisplay } from './MetricsDisplay.js';
import { ReasoningBox } from './ReasoningBox.js';
import type { Theme } from '../../../config/types.js';

export interface MessageProps {
  message: MessageType;
  theme: Theme;
  metricsConfig?: {
    enabled: boolean;
    compactMode: boolean;
  };
  reasoningConfig?: {
    enabled: boolean;
    maxVisibleLines: number;
  };
}

/**
 * Message component displays a single chat message with role-based colors,
 * optional metrics, and optional reasoning blocks
 */
export function Message({ message, theme, metricsConfig, reasoningConfig }: MessageProps) {
  const roleColor = theme.role[message.role];
  const timestamp = message.timestamp.toLocaleTimeString();
  
  // Initialize reasoning box as open if reasoning is incomplete, closed if complete
  const [reasoningExpanded, setReasoningExpanded] = useState(() => {
    return message.reasoning ? !message.reasoning.complete : true;
  });

  // Auto-collapse when reasoning completes
  useEffect(() => {
    if (message.reasoning?.complete) {
      setReasoningExpanded(false);
    }
  }, [message.reasoning?.complete]);

  const showMetrics = metricsConfig?.enabled !== false && message.metrics;
  const showReasoning = reasoningConfig?.enabled !== false && message.reasoning;

  return (
    <Box flexDirection="column" marginY={1}>
      {/* Message header with role and timestamp */}
      <Box marginBottom={1}>
        <Text color={roleColor} bold>
          {message.role.toUpperCase()}
        </Text>
        <Text color={theme.text.secondary} dimColor>
          {' '}
          • {timestamp}
        </Text>
      </Box>

      {/* Reasoning box (if present) */}
      {showReasoning && message.reasoning && (
        <Box paddingLeft={2} marginBottom={1}>
          <ReasoningBox
            reasoning={message.reasoning}
            expanded={reasoningExpanded}
            onToggle={() => setReasoningExpanded(!reasoningExpanded)}
            maxVisibleLines={reasoningConfig?.maxVisibleLines || 8}
            autoScroll={false}
            autoCollapseOnComplete={true}
            theme={theme}
          />
        </Box>
      )}

      {/* Message content */}
      <Box paddingLeft={2}>
        <Text color={theme.text.primary} wrap="wrap">{message.content}</Text>
      </Box>

      {/* Metrics display (if present) */}
      {showMetrics && message.metrics && (
        <Box paddingLeft={2} marginTop={1}>
          <MetricsDisplay
            metrics={message.metrics}
            compact={metricsConfig?.compactMode || false}
            theme={theme}
            visible={true}
          />
        </Box>
      )}
    </Box>
  );
}
