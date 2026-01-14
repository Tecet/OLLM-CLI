import React from 'react';
import { Box, Text } from 'ink';
import { Message as MessageType } from '../../../contexts/ChatContext.js';
import { Message } from './Message.js';
import { ToolCall } from './ToolCall.js';
import { StreamingIndicator } from './StreamingIndicator.js';
import { LlamaAnimation } from '../../../components/lama/LlamaAnimation.js';
import type { Theme } from '../../uiSettings.js';

export interface ChatHistoryProps {
  messages: MessageType[];
  streaming: boolean;
  waitingForResponse: boolean;
  scrollToBottom?: boolean;
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
 * ChatHistory component displays the list of messages
 * with streaming indicators and Llama animation during waiting
 */
export function ChatHistory({
  messages,
  streaming,
  waitingForResponse,
  scrollToBottom = true,
  theme,
  metricsConfig,
  reasoningConfig,
}: ChatHistoryProps) {
  return (
    <Box flexDirection="column" paddingX={1}>
      {/* Render all messages */}
      {messages.map((message) => (
        <Box key={message.id} flexDirection="column">
          {/* Main message */}
          <Message 
            message={message} 
            theme={theme}
            metricsConfig={metricsConfig}
            reasoningConfig={reasoningConfig}
          />

          {/* Tool calls if present */}
          {message.toolCalls && message.toolCalls.length > 0 && (
            <Box flexDirection="column" paddingLeft={2}>
              {message.toolCalls.map((toolCall) => (
                <ToolCall
                  key={toolCall.id}
                  toolCall={toolCall}
                  theme={theme}
                />
              ))}
            </Box>
          )}

          {/* Inline diff display for small diffs */}
          {message.content.includes('diff --git') && (
            <Box flexDirection="column" paddingLeft={2} marginTop={1}>
              {renderInlineDiff(message.content, theme)}
            </Box>
          )}
        </Box>
      ))}


      {/* Llama animation while waiting for first token */}
      {waitingForResponse && !streaming && (
        <Box marginTop={1} marginBottom={1}>
          <LlamaAnimation size="small" />
        </Box>
      )}

      {/* Streaming indicator */}
      {streaming && (
        <Box marginTop={1}>
          <StreamingIndicator
            text="Assistant is typing..."
            spinnerType="dots"
            color={theme.text.secondary}
          />
        </Box>
      )}
    </Box>
  );
}

/**
 * Render inline diff with syntax highlighting
 * Only shows diffs with 5 or fewer lines inline
 */
function renderInlineDiff(
  content: string,
  theme: {
    diff: {
      added: string;
      removed: string;
    };
    text: {
      primary: string;
      secondary: string;
    };
  }
) {
  const lines = content.split('\n');
  const diffLines = lines.filter(
    (line) => line.startsWith('+') || line.startsWith('-')
  );

  // Only show inline if 5 or fewer changed lines
  if (diffLines.length > 5) {
    return (
      <Box flexDirection="column">
        <Text color={theme.text.secondary}>
          Large diff ({diffLines.length} lines changed)
        </Text>
        <Text color={theme.text.secondary}>
          → See Tools tab for full diff
        </Text>
      </Box>
    );
  }

  // Show inline diff
  return (
    <Box flexDirection="column" borderStyle="single" borderColor={theme.text.secondary}>
      {diffLines.map((line, index) => {
        const color = line.startsWith('+')
          ? theme.diff.added
          : line.startsWith('-')
          ? theme.diff.removed
          : theme.text.primary;

        return (
          <Text key={index} color={color}>
            {line}
          </Text>
        );
      })}
    </Box>
  );
}
