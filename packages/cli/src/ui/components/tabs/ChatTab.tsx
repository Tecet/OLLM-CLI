import React, { useEffect, useMemo, useRef } from 'react';
import { Box, useInput, useStdout, BoxProps } from 'ink';
import { useFocusManager } from '../../../features/context/FocusContext.js';
import { useChat } from '../../../features/context/ChatContext.js';
import { useUI } from '../../../features/context/UIContext.js';
import { buildChatLines, ChatHistory, messageHasLargeDiff } from '../chat/ChatHistory.js';

export interface ChatTabProps {
  /** Assigned height from layout */
  height: number;
  /** Whether to show debugging border */
  showBorder?: boolean;
  columnWidth?: number;
  metricsConfig?: {
    enabled: boolean;
    compactMode: boolean;
    showPromptTokens?: boolean;
    showTTFT?: boolean;
    showInStatusBar?: boolean;
  };
  reasoningConfig?: {
    enabled: boolean;
    maxVisibleLines: number;
    autoCollapseOnComplete?: boolean;
  };
}

/**
 * ChatTab component
 * 
 * Main chat interface with message history and input box.
 */
export function ChatTab(props: ChatTabProps) {
  const { metricsConfig, reasoningConfig, columnWidth, height, showBorder = true } = props;
  const { state: chatState, scrollOffset, selectedLineIndex, setSelectedLineIndex, updateMessage } = useChat(); 
  const { state: uiState } = useUI();
  const { stdout } = useStdout();
  const { isFocused, exitToNavBar } = useFocusManager();
  
  const hasFocus = isFocused('chat-history');

  // Use provided config or defaults
  const finalMetricsConfig = useMemo(
    () => metricsConfig || { enabled: true, compactMode: false },
    [metricsConfig]
  );
  const finalReasoningConfig = useMemo(
    () => reasoningConfig || { enabled: true, maxVisibleLines: 8 },
    [reasoningConfig]
  );

  const leftWidth = columnWidth ?? stdout?.columns ?? 80;
  const contentWidth = Math.min(100, Math.max(20, Math.floor(leftWidth * 0.8)));
  const maxVisibleLines = height - 4; // account for border and scroll indicators
  const lines = useMemo(() => buildChatLines(
    chatState.messages,
    uiState.theme,
    finalMetricsConfig,
    finalReasoningConfig,
    0,
    contentWidth - 2,
    2
  ), [chatState.messages, uiState.theme, finalMetricsConfig, finalReasoningConfig, contentWidth]);
  const lastLineCountRef = useRef(0);
  const selectedLine = lines[Math.min(Math.max(selectedLineIndex, 0), Math.max(0, lines.length - 1))];
  const selectedMessage = selectedLine?.messageId
    ? chatState.messages.find(item => item.id === selectedLine.messageId)
    : undefined;
  const selectedHasToggle = Boolean(
    (selectedLine?.kind === 'header' &&
      selectedMessage &&
      (selectedMessage.reasoning || selectedMessage.toolCalls?.some(tc => {
        const hasArgs = tc.arguments && Object.keys(tc.arguments).length > 0;
        return hasArgs || Boolean(tc.result);
      }))) ||
    (selectedLine?.kind === 'diff-summary' &&
      selectedMessage &&
      messageHasLargeDiff(selectedMessage.content))
  );
  const toggleHint = selectedHasToggle ? 'Left/Right to toggle details' : undefined;

  useEffect(() => {
    const total = lines.length;
    const lastLineIndex = Math.max(0, total - 1);
    const previousTotal = lastLineCountRef.current;
    const wasAtBottom = selectedLineIndex >= Math.max(0, previousTotal - 1);

    if (total === 0) {
      setSelectedLineIndex(0);
    } else if (selectedLineIndex > lastLineIndex) {
      setSelectedLineIndex(lastLineIndex);
    } else if (total !== previousTotal && wasAtBottom) {
      setSelectedLineIndex(lastLineIndex);
    }

    lastLineCountRef.current = total;
  }, [lines.length, selectedLineIndex, setSelectedLineIndex]);

  // Note: Scroll logic is now handled in ChatContext + App.tsx global shortcuts
  // This ensures scrolling works even when InputBox is focused.
  useInput((input, key) => {
    if (!hasFocus) return;

    if (key.upArrow) {
      setSelectedLineIndex((prev: number) => Math.max(0, prev - 1));
      return;
    }
    if (key.downArrow) {
      setSelectedLineIndex((prev: number) => Math.min(Math.max(0, lines.length - 1), prev + 1));
      return;
    }
    if (key.rightArrow || key.leftArrow) {
      const clampedIndex = Math.min(Math.max(selectedLineIndex, 0), Math.max(0, lines.length - 1));
      const line = lines[clampedIndex];
      if (!line?.messageId) return;
      const message = chatState.messages.find(item => item.id === line.messageId);
      if (!message) return;
      const isDiffSummaryLine = line.kind === 'diff-summary';
      const hasExpandableDiff = isDiffSummaryLine && messageHasLargeDiff(message.content);
      const hasExpandableReasoning = !isDiffSummaryLine && Boolean(message.reasoning);
      const hasExpandableTools = !isDiffSummaryLine && Boolean(message.toolCalls?.some(tc => {
        const hasArgs = tc.arguments && Object.keys(tc.arguments).length > 0;
        return hasArgs || Boolean(tc.result);
      }));
      if (!hasExpandableDiff && !hasExpandableReasoning && !hasExpandableTools) return;
      updateMessage(message.id, { expanded: key.rightArrow ? true : false });
      return;
    }

    if (key.escape || input === '0') {
      exitToNavBar();
      return;
    }
  }, { isActive: hasFocus });

  return (
    <Box 
      flexDirection="column" 
      height={height} 
      overflow="hidden" 
      width="100%" 
      borderStyle={showBorder ? (uiState.theme.border.style as BoxProps['borderStyle']) : undefined}
      borderColor={hasFocus ? uiState.theme.border.active : uiState.theme.border.primary}
    >
        <Box 
          flexDirection="column"
          paddingX={1}
          flexGrow={1}
          flexShrink={1}
        >
          <ChatHistory
            messages={chatState.messages}
            streaming={chatState.streaming}
            waitingForResponse={chatState.waitingForResponse}
            scrollToBottom={true}
            theme={uiState.theme}
            scrollOffset={scrollOffset}
            maxVisibleLines={maxVisibleLines}
            paddingY={0}
            metricsConfig={finalMetricsConfig}
            reasoningConfig={finalReasoningConfig}
            width={columnWidth ? columnWidth - 2 : 78} 
            selectedLineIndex={selectedLineIndex}
            lines={lines}
            scrollHintTop={hasFocus ? "Keyboard Up to scroll" : undefined}
            scrollHintBottom={hasFocus ? "Keyboard Down to scroll" : undefined}
            toggleHint={toggleHint}
          />
        </Box>
    </Box>
  );
}
