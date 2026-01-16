import React from 'react';
import { Box, Text } from 'ink';
import { useChat } from '../../../features/context/ChatContext.js';
import { useUI } from '../../../features/context/UIContext.js';

export interface SystemBarProps {
  height: number;
  showBorder?: boolean;
}

/**
 * SystemBar (Row 3)
 * Displays "Agent Thinking" status and "Context Tokens" usage.
 */
export function SystemBar({ height, showBorder = true }: SystemBarProps) {
  const { state: chatState, contextUsage } = useChat();
  const { state: uiState } = useUI();
  const { theme } = uiState;

  const { streaming, waitingForResponse, inputMode } = chatState;

  // Determine status text
  let displayStatus = ' ';
  if (inputMode === 'menu') {
    displayStatus = 'Interactive Menu Active';
  } else if (streaming) {
    displayStatus = '● Assistant is typing...';
  } else if (waitingForResponse) {
    displayStatus = '○ Waiting for response...';
  } else {
    displayStatus = 'IDLE';
  }

  const contextText = contextUsage 
    ? `${contextUsage.currentTokens}/${contextUsage.maxTokens}` 
    : '0/0';

  return (
    <Box 
      height={height} 
      width="100%" 
      borderStyle={showBorder ? 'single' : undefined} 
      borderColor={theme.border.primary}
      paddingX={1}
      flexDirection="row"
      alignItems="center"
      justifyContent="space-between"
    >
      <Box>
        <Text color={theme.text.accent} bold>Thinking: </Text>
        <Text color={theme.text.primary}>{displayStatus}</Text>
      </Box>

      <Box>
        <Text color={theme.text.secondary}>Context: </Text>
        <Text color={theme.text.accent} bold>{contextText}</Text>
      </Box>
    </Box>
  );
}
