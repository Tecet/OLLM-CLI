import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Box, useStdout } from 'ink';
import { ChatHistory } from '../chat/ChatHistory.js';
import { InputBox } from '../layout/InputBox.js';
import { useChat } from '../../../contexts/ChatContext.js';
import { useUI } from '../../../contexts/UIContext.js';
import { useContextKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts.js';

export interface ChatTabProps {
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
 * Integrates ChatHistory and InputBox components.
 * Handles message sending and streaming state.
 * Integrates metrics collection and reasoning display.
 * 
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 15.1-15.7, 16.1-16.7
 */
export function ChatTab(props: ChatTabProps = {}) {
  const { metricsConfig, reasoningConfig, columnWidth } = props;
  const { state: chatState } = useChat();
  const { state: uiState } = useUI();
  const { stdout } = useStdout();
  const [scrollOffset, setScrollOffset] = useState(0);

  // Use provided config or defaults
  const finalMetricsConfig = metricsConfig || { enabled: true, compactMode: false };
  const finalReasoningConfig = reasoningConfig || { enabled: true, maxVisibleLines: 8 };

  // Calculate fixed chat area height: terminalHeight - header(3) - input(7) - margin(2)
  const terminalHeight = stdout?.rows || 24;
  const chatAreaHeight = Math.max(6, terminalHeight - 3 - 7 - 2); // header=3, input+status=7, margin=2
  const leftWidth = columnWidth ?? stdout?.columns ?? 80;
  const contentWidth = Math.max(20, Math.floor(leftWidth * 0.8));
  const maxVisibleLines = chatAreaHeight - 2; // leave some padding

  // Scroll logic
  const maxScrollOffset = Math.max(0, chatState.messages.length * 4);
  useEffect(() => { setScrollOffset(0); }, [chatState.messages.length]);

  const scrollUp = useCallback(() => setScrollOffset((prev) => Math.min(prev + 1, maxScrollOffset)), [maxScrollOffset]);
  const scrollDown = useCallback(() => setScrollOffset((prev) => Math.max(prev - 1, 0)), []);
  const chatShortcuts = useMemo(() => [
    { key: 'ctrl+pageup', handler: scrollUp, description: 'Scroll chat up' },
    { key: 'ctrl+pagedown', handler: scrollDown, description: 'Scroll chat down' },
  ], [scrollUp, scrollDown]);
  useContextKeyboardShortcuts('chat', chatShortcuts);

  return (
    <Box flexDirection="column" height={chatAreaHeight} overflow="hidden" width="100%">
      <Box flexGrow={1} flexShrink={1} minHeight={0} overflow="hidden" alignItems="center" width="100%">
        <Box width={contentWidth}>
          <ChatHistory
            messages={chatState.messages}
            streaming={chatState.streaming}
            waitingForResponse={chatState.waitingForResponse}
            scrollToBottom={true}
            theme={uiState.theme}
            scrollOffset={scrollOffset}
            maxVisibleLines={maxVisibleLines}
            paddingY={2}
            metricsConfig={finalMetricsConfig}
            reasoningConfig={finalReasoningConfig}
          />
        </Box>
      </Box>
    </Box>
  );
}
