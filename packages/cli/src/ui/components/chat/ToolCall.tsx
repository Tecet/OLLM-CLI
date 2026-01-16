import React, { useState } from 'react';
import { Box, Text } from 'ink';
import { ToolCall as ToolCallType } from '../../../features/context/ChatContext.js';

export interface ToolCallProps {
  toolCall: ToolCallType;
  expanded?: boolean;
  onToggle?: () => void;
  theme: {
    text: {
      primary: string;
      secondary: string;
      accent: string;
    };
    status: {
      success: string;
      warning: string;
      error: string;
      info: string;
    };
  };
}

/**
 * ToolCall component displays tool execution information
 * with expand/collapse for long arguments
 */
export function ToolCall({ toolCall, expanded: controlledExpanded, onToggle, theme }: ToolCallProps) {
  const [internalExpanded, setInternalExpanded] = useState(false);
  
  // Use controlled expanded state if provided, otherwise use internal state
  const expanded = controlledExpanded !== undefined ? controlledExpanded : internalExpanded;
  
  const handleToggle = () => {
    if (onToggle) {
      onToggle();
    } else {
      setInternalExpanded(!internalExpanded);
    }
  };

  // Format arguments as JSON string
  const argsString = JSON.stringify(toolCall.arguments, null, 2);
  const argsLength = argsString.length;
  const needsWrapping = argsLength > 80;

  // Get status color
  const statusColor =
    toolCall.status === 'success'
      ? theme.status.success
      : toolCall.status === 'error'
      ? theme.status.error
      : theme.status.info;

  // Format duration if available
  const durationText = toolCall.duration ? ` (${(toolCall.duration / 1000).toFixed(2)}s)` : '';

  return (
    <Box flexDirection="column" marginY={1} paddingLeft={2} borderStyle="single" borderColor={theme.text.secondary}>
      {/* Tool name and status */}
      <Box marginBottom={1}>
        <Text color={theme.text.accent} bold>
          🔧 {toolCall.name}
        </Text>
        <Text color={statusColor}> [{toolCall.status}]</Text>
        {durationText && <Text color={theme.text.secondary}>{durationText}</Text>}
      </Box>

      {/* Arguments */}
      <Box flexDirection="column" marginBottom={1}>
        <Text color={theme.text.secondary} dimColor>
          Arguments:
        </Text>
        {needsWrapping && !expanded ? (
          <Box>
            <Text color={theme.text.primary}>
              {argsString.substring(0, 80)}...
            </Text>
            <Text color={theme.text.accent} dimColor>
              {' '}
              [Click to expand]
            </Text>
          </Box>
        ) : (
          <Text color={theme.text.primary}>{argsString}</Text>
        )}
        {needsWrapping && expanded && (
          <Text color={theme.text.accent} dimColor>
            [Click to collapse]
          </Text>
        )}
      </Box>

      {/* Result */}
      {toolCall.result && (
        <Box flexDirection="column">
          <Text color={theme.text.secondary} dimColor>
            Result:
          </Text>
          <Text color={theme.text.primary}>{toolCall.result}</Text>
        </Box>
      )}
    </Box>
  );
}
