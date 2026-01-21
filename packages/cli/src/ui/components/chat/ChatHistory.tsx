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
  selectedLineIndex?: number;
  lines?: ChatLine[];
  scrollHintTop?: string;
  scrollHintBottom?: string;
  toggleHint?: string;
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
  selectedLineIndex,
  lines: providedLines,
  scrollHintTop,
  scrollHintBottom,
  toggleHint,
}: ChatHistoryProps) {
  // Use _ to avoid unused var lint if they aren't used in this render cycle
  const _s = streaming;
  const _w = waitingForResponse;
  const _stb = scrollToBottom;
  const resolvedMax = Math.max(1, maxVisibleLines ?? 20);
  const showCursor = typeof selectedLineIndex === 'number';
  const lines = providedLines ?? buildChatLines(messages, theme, metricsConfig, reasoningConfig, paddingY, width, showCursor ? 2 : 0);
  const clampedSelectedIndex = typeof selectedLineIndex === 'number'
    ? Math.min(Math.max(selectedLineIndex, 0), Math.max(0, lines.length - 1))
    : null;
  const clampedOffset = Math.min(Math.max(scrollOffset, 0), Math.max(0, lines.length - resolvedMax));
  const endIndex = clampedSelectedIndex === null
    ? Math.max(0, lines.length - clampedOffset)
    : Math.min(lines.length, Math.max(clampedSelectedIndex + 1, resolvedMax));
  const startIndex = clampedSelectedIndex === null
    ? Math.max(0, endIndex - resolvedMax)
    : Math.max(0, Math.min(clampedSelectedIndex, endIndex - resolvedMax));
  const visibleLines = lines.slice(startIndex, endIndex);
  const canScrollUp = startIndex > 0;
  const canScrollDown = endIndex < lines.length;
  const topHint = toggleHint || (canScrollUp ? scrollHintTop : undefined);
  const bottomHint = canScrollDown ? scrollHintBottom : undefined;

  return (
    <Box flexDirection="column" paddingX={1} paddingY={paddingY} width={width}>
      {/* Always reserve space for scroll indicator to prevent layout shift */}
      <Box height={1} width="100%" justifyContent="flex-end">
        <Text color={canScrollUp ? theme.text.secondary : undefined}>
          {topHint ? topHint : ''}
        </Text>
      </Box>

      {/* Render visible lines */}
      {visibleLines.map((line, index) => {
        const absoluteIndex = startIndex + index;
        const isSelected = clampedSelectedIndex !== null && absoluteIndex === clampedSelectedIndex;
        return (
          <ChatLineItem key={line.key} line={line} theme={theme} isSelected={isSelected} showCursor={showCursor} />
        );
      })}


      {/* Status indicator removed - now shown in StaticInputArea above input box */}

      {/* Always reserve space for scroll-down indicator */}
      <Box height={1} width="100%" justifyContent="flex-end">
        <Text color={canScrollDown ? theme.text.secondary : undefined}>
          {bottomHint ? bottomHint : ''}
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

export type ChatLine = {
  key: string;
  parts: ChatLinePart[];
  indent?: number;
  isEphemeral?: boolean; // New flag for fading messages
  timestamp?: number;    // Creation time for ephemeral check
  messageId?: string;
  kind?: 'header' | 'reasoning' | 'tool' | 'content' | 'metrics' | 'spacer' | 'diff-summary';
};

// New component to handle individual line rendering and state
const ChatLineItem = ({ line, theme, isSelected, showCursor }: { line: ChatLine; theme: Theme; isSelected: boolean; showCursor: boolean }) => {
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
    <Box alignSelf="flex-start">
      {showCursor && (
        <Text color={isSelected ? theme.text.accent : theme.text.secondary}>{isSelected ? '> ' : '  '}</Text>
      )}
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
const DIFF_LINE_THRESHOLD = 5;

type DiffBlock = {
  start: number;
  end: number;
  changedLines: number;
};

function isDiffHeaderLine(line: string): boolean {
  return line.startsWith('diff --git ');
}

function isDiffChangeLine(line: string): boolean {
  if (line.startsWith('+++') || line.startsWith('---')) return false;
  return line.startsWith('+') || line.startsWith('-');
}

function getDiffBlocks(lines: string[]): DiffBlock[] {
  const blocks: DiffBlock[] = [];
  let blockStart = -1;
  let changedLines = 0;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (isDiffHeaderLine(line)) {
      if (blockStart !== -1) {
        blocks.push({ start: blockStart, end: i - 1, changedLines });
      }
      blockStart = i;
      changedLines = 0;
      continue;
    }
    if (blockStart !== -1 && isDiffChangeLine(line)) {
      changedLines += 1;
    }
  }

  if (blockStart !== -1) {
    blocks.push({ start: blockStart, end: lines.length - 1, changedLines });
  }

  return blocks;
}

export function messageHasLargeDiff(content: string, threshold = DIFF_LINE_THRESHOLD): boolean {
  const lines = content.split('\n');
  const blocks = getDiffBlocks(lines);
  return blocks.some((block) => block.changedLines > threshold);
}

export function buildChatLines(
  messages: MessageType[],
  theme: Theme,
  metricsConfig: { enabled: boolean; compactMode: boolean } | undefined,
  reasoningConfig: { enabled: boolean; maxVisibleLines: number } | undefined,
  paddingY: number,
  width: number,
  cursorWidth = 0
): ChatLine[] {
  const lines: ChatLine[] = [];
  
  // Account for ChatHistory paddingX={1} (2 cells) and cursor prefix
  const safeWidth = width - 2 - cursorWidth;

  const addLine = (parts: ChatLinePart[], indent = 0, isEphemeral = false, messageId?: string, kind?: ChatLine["kind"]) => {
    const availableWidth = Math.max(10, safeWidth - indent);
    
    // Helper to add a final virtual line
    const pushLine = (lineParts: ChatLinePart[]) => {
        lines.push({
            key: `line-${lines.length}`,
            parts: lineParts,
            indent,
            isEphemeral,
            timestamp: Date.now(),
            messageId,
            kind
        });
    };

    let currentLineParts: ChatLinePart[] = [];
    let currentLineWidth = 0;

    // Regex for common double-width emojis
    const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
    const segmenter = new Intl.Segmenter('en', { granularity: 'grapheme' });

    for (const part of parts) {
        // Use Intl.Segmenter to correctly iterate over grapheme clusters (surrogate pairs + ZWJ)
        const segments = Array.from(segmenter.segment(part.text));
        let i = 0;

        while (i < segments.length) {
            const spaceInLine = availableWidth - currentLineWidth;
            
            // Collect as many graphemes as fit in the current line
            let chunk = '';
            let chunkWidth = 0;
            let lastSpaceIndex = -1;
            let j = i;

            while (j < segments.length) {
                const char = segments[j].segment;
                // Emojis typically take 2 cells, others 1. 
                // Note: This is an approximation but covers most common cases in TUIs.
                const charWidth = emojiRegex.test(char) ? 2 : 1;

                if (chunkWidth + charWidth > spaceInLine) {
                    break;
                }

                if (char === ' ') {
                    lastSpaceIndex = j;
                }

                chunk += char;
                chunkWidth += charWidth;
                j++;
            }

            // Word wrap logic: if we didn't reach the end, try to break at the last space
            if (j < segments.length && lastSpaceIndex !== -1 && lastSpaceIndex >= i) {
                // Rewind to last space
                const dropCount = j - 1 - lastSpaceIndex;
                if (dropCount > 0) {
                    // Re-calculate chunk and width up to space
                    const newChunkSegments = segments.slice(i, lastSpaceIndex);
                    chunk = newChunkSegments.map(s => s.segment).join('');
                    // Recalculate width for safety
                    chunkWidth = newChunkSegments.reduce((acc, s) => acc + (emojiRegex.test(s.segment) ? 2 : 1), 0);
                    j = lastSpaceIndex + 1; // skip the space
                }
            }

            if (chunk.length > 0) {
                currentLineParts.push({ ...part, text: chunk.trimEnd() });
                currentLineWidth += chunkWidth;
            }

            // If we didn't finish the part, push line and continue
            if (j < segments.length || currentLineWidth >= availableWidth) {
                pushLine(currentLineParts);
                currentLineParts = [];
                currentLineWidth = 0;
            }
            
            i = j;
        }
    }

    if (currentLineParts.length > 0 || (parts.length === 0 && lines.length === paddingY)) {
        pushLine(currentLineParts.length > 0 ? currentLineParts : [{ text: '' }]);
    }
  };

  for (let i = 0; i < paddingY; i += 1) {
    addLine([{ text: '' }]);
  }

  for (let msgIndex = 0; msgIndex < messages.length; msgIndex += 1) {
    const message = messages[msgIndex];
    const prevMessage = msgIndex > 0 ? messages[msgIndex - 1] : undefined;
    // If a user message is immediately followed by an assistant reply, insert
    // an extra spacer line (single space) for visual separation.
    if (prevMessage && prevMessage.role === 'user' && message.role === 'assistant') {
      addLine([{ text: ' ' }], 0, false, undefined, 'spacer');
    }
    const isExpanded = message.expanded === true;
    const roleColor = theme.role[message.role];
    const timestamp = message.timestamp.toLocaleTimeString();
    const showMetrics = metricsConfig?.enabled !== false && message.metrics;
    const showReasoning = reasoningConfig?.enabled !== false && message.reasoning;

    // Special handling for Context Rollover system messages
    if (message.role.toLowerCase() === 'system' && message.content.includes('[Context Rollover]')) {
      addLine([
        { text: 'ℹ️ ', color: theme.text.accent },
        { text: message.content.split('\n')[0].substring(0, 100) + (message.content.length > 100 ? '...' : ''), color: theme.text.secondary, dim: true }
      ], 0, true, message.id, 'header');
      continue;
    }

    addLine([
      { text: message.role.toUpperCase(), color: roleColor, bold: true },
      { text: ` • ${timestamp}`, color: theme.text.secondary, dim: true },
    ], 0, false, message.id, 'header');

    if (showReasoning && message.reasoning) {
      if (isExpanded) {
        addLine([{ text: 'Reasoning:', color: theme.text.secondary, dim: true }], 2, false, message.id, 'reasoning');
        const reasoningLines = message.reasoning.content.split('\n');
        reasoningLines.forEach((line) => {
          addLine([{ text: line || ' ', color: theme.text.primary }], 4, false, message.id, 'reasoning');
        });
      } else {
        addLine([{ text: 'Reasoning: (collapsed)', color: theme.text.secondary, dim: true }], 2, false, message.id, 'reasoning');
      }
    }

    const contentLines = message.content.split('\n');
    const diffBlocks = getDiffBlocks(contentLines);
    const hasDiffBlocks = diffBlocks.length > 0;
    const diffExpanded = message.expanded === true;

    if (!hasDiffBlocks || diffExpanded) {
      contentLines.forEach((line) => {
        addLine([{ text: line || '', color: theme.text.primary }], 2, false, message.id, 'content');
      });
    } else {
      let cursor = 0;
      diffBlocks.forEach((block) => {
        for (let i = cursor; i < block.start; i += 1) {
          const line = contentLines[i];
          addLine([{ text: line || '', color: theme.text.primary }], 2, false, message.id, 'content');
        }

        if (block.changedLines > DIFF_LINE_THRESHOLD) {
          addLine(
            [{ text: `Large diff: ${block.changedLines} lines changed`, color: theme.text.secondary }],
            2,
            false,
            message.id,
            'diff-summary'
          );
          addLine(
            [{ text: 'See Tools tab for full diff', color: theme.text.secondary }],
            2,
            false,
            message.id,
            'diff-summary'
          );
        } else {
          for (let i = block.start; i <= block.end; i += 1) {
            const line = contentLines[i];
            addLine([{ text: line || '', color: theme.text.primary }], 2, false, message.id, 'content');
          }
        }

        cursor = block.end + 1;
      });

      for (let i = cursor; i < contentLines.length; i += 1) {
        const line = contentLines[i];
        addLine([{ text: line || '', color: theme.text.primary }], 2, false, message.id, 'content');
      }
    }

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

        const hasArgs = toolCall.arguments && Object.keys(toolCall.arguments).length > 0;
        const hasResult = Boolean(toolCall.result);
        const shouldShowDetails = isExpanded || !isHeavy || toolCall.status === 'error';
        const collapsedNote = !shouldShowDetails && (hasArgs || hasResult)
          ? ' (collapsed)'
          : '';

        addLine(
          [
            { text: `🔧 ${toolCall.name}`, color: theme.text.accent, bold: true },
            { text: ` [${toolCall.status}]${durationText}${collapsedNote}`, color: statusColor },
            { text: isHeavy ? ' (Action minimized, navigate to line and use right/left arrows to expand)' : '', color: theme.text.secondary, italic: true, dim: true }
          ],
          2,
          false,
          message.id,
          'tool'
        );

        if (shouldShowDetails) {
            if (hasArgs) {
                addLine([{ text: 'Arguments:', color: theme.text.secondary, dim: true }], 4, false, message.id, 'tool');
                const argsString = JSON.stringify(toolCall.arguments, null, 2) || '{}';
                argsString.split('\n').forEach((line) => {
                  addLine([{ text: line || '', color: theme.text.primary }], 6, false, message.id, 'tool');
                });
            }

            if (toolCall.result) {
              addLine([{ text: 'Result:', color: theme.text.secondary, dim: true }], 4, false, message.id, 'tool');
              toolCall.result.split('\n').forEach((line) => {
                  addLine([{ text: line || '', color: theme.text.primary }], 6, false, message.id, 'tool');
              });
            }
        }
      });
    }

    if (showMetrics && message.metrics) {
      addLine([
        { text: formatMetricsLine(message.metrics, metricsConfig?.compactMode || false), color: theme.text.secondary },
      ], 2, false, message.id, 'metrics');
    }

    addLine([{ text: ' ' }], 0, false, message.id, 'spacer');
  }

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
