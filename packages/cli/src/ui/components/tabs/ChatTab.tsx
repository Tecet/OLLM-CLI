import React from 'react';
import { Box } from 'ink';
import { ChatHistory } from '../chat/ChatHistory.js';
import { InputBox } from '../layout/InputBox.js';
import { useChat } from '../../../contexts/ChatContext.js';
import { useUI } from '../../../contexts/UIContext.js';

export interface ChatTabProps {
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
  const { metricsConfig, reasoningConfig } = props;
  const { state: chatState, sendMessage, setCurrentInput } = useChat();
  const { state: uiState } = useUI();

  // Use provided config or defaults
  const finalMetricsConfig = metricsConfig || {
    enabled: true,
    compactMode: false,
  };

  const finalReasoningConfig = reasoningConfig || {
    enabled: true,
    maxVisibleLines: 8,
  };

  const handleSubmit = async (value: string) => {
    if (!value.trim()) {
      return;
    }

    try {
      await sendMessage(value);
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const handleChange = (value: string) => {
    setCurrentInput(value);
  };

  return (
    <Box flexDirection="column" height="100%">
      {/* Chat history - takes up remaining space */}
      <Box flexGrow={1} flexShrink={1} minHeight={0}>
        <ChatHistory
          messages={chatState.messages}
          streaming={chatState.streaming}
          waitingForResponse={chatState.waitingForResponse}
          scrollToBottom={true}
          theme={uiState.theme}
          metricsConfig={finalMetricsConfig}
          reasoningConfig={finalReasoningConfig}
        />
      </Box>

      {/* Input box - fixed at bottom */}
      <Box flexShrink={0}>
        <InputBox
          value={chatState.currentInput}
          onChange={handleChange}
          onSubmit={handleSubmit}
          placeholder="Type a message... (Enter to send, Shift+Enter for newline)"
          disabled={chatState.streaming || chatState.waitingForResponse}
          theme={uiState.theme}
        />
      </Box>
    </Box>
  );
}
