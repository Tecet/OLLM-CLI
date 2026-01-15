import React from 'react';
import { Box, Text } from 'ink';
import { Message as MessageType } from '../../../contexts/ChatContext.js';
import { StreamingIndicator } from './StreamingIndicator.js';
import type { Theme } from '../../uiSettings.js';

export interface ChatHistoryProps {
  messages: MessageType[];
  streaming: boolean;
  waitingForResponse: boolean;
  scrollToBottom?: boolean;
  theme: Theme;
  scrollOffset?: number;
  maxVisibleLines?: number;
  paddingY?: number;
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
  scrollOffset = 0,
  maxVisibleLines,
  paddingY = 0,
  metricsConfig,
  reasoningConfig,
}: ChatHistoryProps) {
  const resolvedMax = Math.max(1, maxVisibleLines ?? 20);
  const lines = buildChatLines(messages, theme, metricsConfig, reasoningConfig, paddingY);
  const clampedOffset = Math.min(Math.max(scrollOffset, 0), Math.max(0, lines.length - resolvedMax));
  const endIndex = Math.max(0, lines.length - clampedOffset);
  const startIndex = Math.max(0, endIndex - resolvedMax);
  const visibleLines = lines.slice(startIndex, endIndex);
  const canScrollUp = startIndex > 0;
  const canScrollDown = endIndex < lines.length;

  return (
    <Box flexDirection="column" paddingX={1} paddingY={paddingY} width="100%">
      {/* Always reserve space for scroll indicator to prevent layout shift */}
      <Box height={1}>
        <Text color={canScrollUp ? theme.text.secondary : undefined}>
          {canScrollUp ? '↑ Older messages (Ctrl+PageUp)' : ' '}
        </Text>
      </Box>

      {/* Render visible lines */}
      {visibleLines.map((line) => renderLine(line))}


      {/* Fixed height area for status indicators to prevent layout shift */}
      <Box height={1} marginTop={1}>
        {waitingForResponse && !streaming ? (
          <Text color={theme.text.secondary}>Waiting for response...</Text>
        ) : streaming ? (
          <StreamingIndicator
            text="Assistant is typing..."
            spinnerType="dots"
            color={theme.text.secondary}
            intervalMs={250}
          />
        ) : (
          <Text> </Text>
        )}
      </Box>

      {/* Always reserve space for scroll-down indicator */}
      <Box height={1}>
        <Text color={canScrollDown ? theme.text.secondary : undefined}>
          {canScrollDown ? '↓ Newer messages (Ctrl+PageDown)' : ' '}
        </Text>
      </Box>
    </Box>
  );
}

type ChatLinePart = {
  text: string;
  color?: string;
  bold?: boolean;
  dim?: boolean;
};

type ChatLine = {
  key: string;
  parts: ChatLinePart[];
  indent?: number;
};

function renderLine(line: ChatLine) {
  const indentPrefix = line.indent ? ' '.repeat(line.indent) : '';
  const parts = line.parts.length
    ? [{ ...line.parts[0], text: indentPrefix + line.parts[0].text }, ...line.parts.slice(1)]
    : [{ text: indentPrefix }];

  return (
    <Box key={line.key}>
      {parts.map((part, index) => (
        <Text
          key={`${line.key}-${index}`}
          color={part.color}
          bold={part.bold}
          dimColor={part.dim}
        >
          {part.text}
        </Text>
      ))}
    </Box>
  );
}

function buildChatLines(
  messages: MessageType[],
  theme: Theme,
  metricsConfig?: { enabled: boolean; compactMode: boolean },
  reasoningConfig?: { enabled: boolean; maxVisibleLines: number },
  paddingY: number = 0
): ChatLine[] {
  const lines: ChatLine[] = [];
  const addLine = (parts: ChatLinePart[], indent = 0) => {
    lines.push({ key: `line-${lines.length}`, parts, indent });
  };

  for (let i = 0; i < paddingY; i += 1) {
    addLine([{ text: ' ' }]);
  }

  messages.forEach((message) => {
    const roleColor = theme.role[message.role];
    const timestamp = message.timestamp.toLocaleTimeString();
    const showMetrics = metricsConfig?.enabled !== false && message.metrics;
    const showReasoning = reasoningConfig?.enabled !== false && message.reasoning;

    addLine([
      { text: message.role.toUpperCase(), color: roleColor, bold: true },
      { text: ` • ${timestamp}`, color: theme.text.secondary, dim: true },
    ]);

    if (showReasoning && message.reasoning) {
      addLine([{ text: 'Reasoning:', color: theme.text.secondary, dim: true }], 2);
      const reasoningLines = message.reasoning.content.split('\n');
      reasoningLines.forEach((line) => {
        addLine([{ text: line || ' ', color: theme.text.primary }], 4);
      });
    }

    const contentLines = message.content.split('\n');
    contentLines.forEach((line) => {
      addLine([{ text: line || ' ', color: theme.text.primary }], 2);
    });

    if (message.toolCalls && message.toolCalls.length > 0) {
      message.toolCalls.forEach((toolCall) => {
        const statusColor =
          toolCall.status === 'success'
            ? theme.status.success
            : toolCall.status === 'error'
            ? theme.status.error
            : theme.status.info;
        const durationText = toolCall.duration
          ? ` (${(toolCall.duration / 1000).toFixed(2)}s)`
          : '';

        addLine(
          [
            { text: `🔧 ${toolCall.name}`, color: theme.text.accent, bold: true },
            { text: ` [${toolCall.status}]${durationText}`, color: statusColor },
          ],
          2
        );

        addLine([{ text: 'Arguments:', color: theme.text.secondary, dim: true }], 4);
        const argsString = JSON.stringify(toolCall.arguments, null, 2) || '{}';
        argsString.split('\n').forEach((line) => {
          addLine([{ text: line || ' ', color: theme.text.primary }], 6);
        });

        if (toolCall.result) {
          addLine([{ text: 'Result:', color: theme.text.secondary, dim: true }], 4);
          toolCall.result.split('\n').forEach((line) => {
            addLine([{ text: line || ' ', color: theme.text.primary }], 6);
          });
        }
      });
    }

    if (showMetrics && message.metrics) {
      addLine([
        { text: formatMetricsLine(message.metrics, metricsConfig?.compactMode || false), color: theme.text.secondary },
      ], 2);
    }

    addLine([{ text: ' ' }]);
  });

  for (let i = 0; i < paddingY; i += 1) {
    addLine([{ text: ' ' }]);
  }

  return lines;
}

function formatMetricsLine(metrics: {
  tokensPerSecond: number;
  promptTokens: number;
  completionTokens: number;
  totalSeconds: number;
  timeToFirstToken: number;
}, compact: boolean): string {
  const formatNumber = (num: number, decimals: number = 1): string => num.toFixed(decimals);

  if (compact) {
    return `⚡ ${formatNumber(metrics.tokensPerSecond)} t/s │ ${metrics.completionTokens} tokens │ ${formatNumber(metrics.totalSeconds)}s`;
  }

  const parts: string[] = [
    `⚡ ${formatNumber(metrics.tokensPerSecond)} t/s`,
    `📥 ${metrics.promptTokens} tokens`,
    `📤 ${metrics.completionTokens} tokens`,
    `⏱️ ${formatNumber(metrics.totalSeconds)}s`,
  ];

  if (metrics.timeToFirstToken > 0) {
    parts.push(`TTFT: ${formatNumber(metrics.timeToFirstToken)}s`);
  }

  return parts.join(' │ ');
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
