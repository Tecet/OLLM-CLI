import React from 'react';
import { Box, useStdout } from 'ink';
import { useFocusManager } from '../../../features/context/FocusContext.js';
import { useChat } from '../../../features/context/ChatContext.js';
import { useUI } from '../../../features/context/UIContext.js';
import { ChatHistory } from '../chat/ChatHistory.js';

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
  const { state: chatState, scrollOffset } = useChat(); 
  const { state: uiState } = useUI();
  const { stdout } = useStdout();
  const { isFocused } = useFocusManager();
  
  const hasFocus = isFocused('chat-history');

  // Use provided config or defaults
  const finalMetricsConfig = metricsConfig || { enabled: true, compactMode: false };
  const finalReasoningConfig = reasoningConfig || { enabled: true, maxVisibleLines: 8 };

  const leftWidth = columnWidth ?? stdout?.columns ?? 80;
  const contentWidth = Math.min(100, Math.max(20, Math.floor(leftWidth * 0.8)));
  const maxVisibleLines = height - 4; // account for border and scroll indicators

  // Note: Scroll logic is now handled in ChatContext + App.tsx global shortcuts
  // This ensures scrolling works even when InputBox is focused.

  return (
    <Box 
      flexDirection="column" 
      height={height} 
      overflow="hidden" 
      width="100%" 
      alignItems="center"
      borderStyle={showBorder ? 'round' : undefined}
      borderColor={hasFocus ? uiState.theme.border.active : uiState.theme.border.primary}
    >
        <Box 
          width={contentWidth} 
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
            width={contentWidth - 2} // Account for padding
          />
        </Box>
    </Box>
  );
}
