import React from 'react';
import { Box, Text } from 'ink';
import { Message as MessageType } from '../../../features/context/ChatContext.js';
import type { Theme } from '../../../config/types.js';

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
  width: number;
}

/**
 * ChatHistory component displays the list of messages
 * Status indicators are shown in StaticInputArea above the input box
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
  width,
}: ChatHistoryProps) {
  // Use _ to avoid unused var lint if they aren't used in this render cycle
  const _s = streaming;
  const _w = waitingForResponse;
  const _stb = scrollToBottom;
  const resolvedMax = Math.max(1, maxVisibleLines ?? 20);
  const lines = buildChatLines(messages, theme, metricsConfig, reasoningConfig, paddingY, width);
  const clampedOffset = Math.min(Math.max(scrollOffset, 0), Math.max(0, lines.length - resolvedMax));
  const endIndex = Math.max(0, lines.length - clampedOffset);
  const startIndex = Math.max(0, endIndex - resolvedMax);
  const visibleLines = lines.slice(startIndex, endIndex);
  const canScrollUp = startIndex > 0;
  const canScrollDown = endIndex < lines.length;

  return (
    <Box flexDirection="column" paddingX={1} paddingY={paddingY} width="100%">
      {/* Always reserve space for scroll indicator to prevent layout shift */}
      <Box height={1} width="100%" justifyContent="flex-end">
        <Text color={canScrollUp ? theme.text.secondary : undefined}>
          {canScrollUp ? '↑ Older messages (Ctrl+PageUp)' : ' '}
        </Text>
      </Box>

      {/* Render visible lines */}
      {visibleLines.map((line) => (
        <ChatLineItem key={line.key} line={line} theme={theme} />
      ))}


      {/* Status indicator removed - now shown in StaticInputArea above input box */}

      {/* Always reserve space for scroll-down indicator */}
      <Box height={1} width="100%" justifyContent="flex-end">
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
  italic?: boolean;
  dim?: boolean;
};

type ChatLine = {
  key: string;
  parts: ChatLinePart[];
  indent?: number;
  isEphemeral?: boolean; // New flag for fading messages
  timestamp?: number;    // Creation time for ephemeral check
};

// New component to handle individual line rendering and state
const ChatLineItem = ({ line, theme }: { line: ChatLine; theme: Theme }) => {
  const [visible, setVisible] = React.useState(true);
  const [opacity, setOpacity] = React.useState<'normal' | 'dim' | 'hidden'>('normal');

  React.useEffect(() => {
    if (line.isEphemeral) {
      // Step 1: Dim after 2 seconds
      const dimTimer = setTimeout(() => {
        setOpacity('dim');
      }, 2000);

      // Step 2: Hide after 3 seconds (+1s dim phase)
      const hideTimer = setTimeout(() => {
        setOpacity('hidden');
        setVisible(false);
      }, 3000);

      return () => {
        clearTimeout(dimTimer);
        clearTimeout(hideTimer);
      };
    }
  }, [line.isEphemeral]);

  if (!visible) return <Box height={0} />;

  const indentPrefix = line.indent ? ' '.repeat(line.indent) : '';
  const parts = line.parts.length
    ? [{ ...line.parts[0], text: indentPrefix + line.parts[0].text }, ...line.parts.slice(1)]
    : [{ text: indentPrefix }];

  // Apply fading effect overrides
  const getPartColor = (part: ChatLinePart) => {
    if (opacity === 'dim') return theme.text.secondary; // Fallback to secondary for dim phase
    return part.color;
  };
  
  const isDimmed = opacity === 'dim' || parts.some(p => p.dim);

  return (
    <Box>
      {parts.map((part, index) => (
        <Text
          key={`${line.key}-${index}`}
          color={getPartColor(part)}
          bold={part.bold}
          italic={part.italic}
          dimColor={isDimmed}
        >
          {part.text}
        </Text>
      ))}
    </Box>
  );
};

const HEAVY_TOOLS = ['trigger_hot_swap', 'write_memory_dump', 'context_rollover', 'memory_guard_action'];

function buildChatLines(
  messages: MessageType[],
  theme: Theme,
  metricsConfig: { enabled: boolean; compactMode: boolean } | undefined,
  reasoningConfig: { enabled: boolean; maxVisibleLines: number } | undefined,
  paddingY: number,
  width: number
): ChatLine[] {
  const lines: ChatLine[] = [];
  
  // Account for ChatHistory paddingX={1} (2 cells)
  const safeWidth = width - 2;

  const addLine = (parts: ChatLinePart[], indent = 0, isEphemeral = false) => {
    const availableWidth = Math.max(10, safeWidth - indent);
    
    // Helper to add a final virtual line
    const pushLine = (lineParts: ChatLinePart[]) => {
        lines.push({
            key: `line-${lines.length}`,
            parts: lineParts,
            indent,
            isEphemeral,
            timestamp: Date.now()
        });
    };

    let currentLineParts: ChatLinePart[] = [];
    let currentLineWidth = 0;

    for (const part of parts) {
        let remainingText = part.text;

        while (remainingText.length > 0) {
            const spaceInLine = availableWidth - currentLineWidth;
            
            if (remainingText.length <= spaceInLine) {
                currentLineParts.push({ ...part, text: remainingText });
                currentLineWidth += remainingText.length;
                break;
            }

            // Word wrap logic
            let breakIndex = remainingText.lastIndexOf(' ', spaceInLine);
            if (breakIndex <= 0) { // No space found or at start
                breakIndex = spaceInLine;
            }

            const chunk = remainingText.substring(0, breakIndex);
            currentLineParts.push({ ...part, text: chunk.trimEnd() });
            
            // Push current line and reset
            pushLine(currentLineParts);
            currentLineParts = [];
            currentLineWidth = 0;
            remainingText = remainingText.substring(breakIndex).trimStart();
        }
    }

    if (currentLineParts.length > 0 || parts.length === 0) {
        pushLine(currentLineParts.length > 0 ? currentLineParts : [{ text: ' ' }]);
    }
  };

  for (let i = 0; i < paddingY; i += 1) {
    addLine([{ text: ' ' }]);
  }

  messages.forEach((message) => {
    const roleColor = theme.role[message.role];
    const timestamp = message.timestamp.toLocaleTimeString();
    const showMetrics = metricsConfig?.enabled !== false && message.metrics;
    const showReasoning = reasoningConfig?.enabled !== false && message.reasoning;

    // Special handling for Context Rollover system messages
    if (message.role.toLowerCase() === 'system' && message.content.includes('[Context Rollover]')) {
      addLine([
        { text: 'ℹ️ ', color: theme.text.accent },
        { text: message.content.split('\n')[0].substring(0, 100) + (message.content.length > 100 ? '...' : ''), color: theme.text.secondary, dim: true }
      ], 0, true);
      return; 
    }

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
        const isHeavy = HEAVY_TOOLS.includes(toolCall.name);
        const statusColor =
          toolCall.status === 'success'
            ? theme.status.success
            : toolCall.status === 'error'
            ? theme.status.error
            : theme.status.warning;

        const durationText = toolCall.duration
          ? ` (${(toolCall.duration / 1000).toFixed(2)}s)`
          : '';

        addLine(
          [
            { text: `🔧 ${toolCall.name}`, color: theme.text.accent, bold: true },
            { text: ` [${toolCall.status}]${durationText}`, color: statusColor },
            { text: isHeavy ? ' (Action minimized)' : '', color: theme.text.secondary, italic: true, dim: true }
          ],
          2
        );

        if (!isHeavy || toolCall.status === 'error') {
            if (toolCall.arguments && Object.keys(toolCall.arguments).length > 0) {
                addLine([{ text: 'Arguments:', color: theme.text.secondary, dim: true }], 4);
                const argsString = JSON.stringify(toolCall.arguments, null, 2) || '{}';
                argsString.split('\n').forEach((line) => {
                  addLine([{ text: line || ' ', color: theme.text.primary }], 6);
                });
            }

            if (toolCall.result) {
              addLine([{ text: 'Result:', color: theme.text.secondary, dim: true }], 4);
              toolCall.result.split('\n').forEach((line) => {
                addLine([{ text: line || ' ', color: theme.text.primary }], 6);
              });
            }
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
    `📥 In: ${metrics.promptTokens}`,
    `📤 Out: ${metrics.completionTokens}`,
    `⏱️ ${formatNumber(metrics.totalSeconds)}s`,
  ];

  if (metrics.timeToFirstToken > 0) {
    parts.push(`TTFT: ${formatNumber(metrics.timeToFirstToken)}s`);
  }

  return parts.join(' │ ');
}
