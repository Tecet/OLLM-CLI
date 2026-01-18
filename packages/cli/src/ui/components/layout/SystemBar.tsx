import React, { useEffect, useState } from 'react';
import { Box, Text } from 'ink';
import { useChat } from '../../../features/context/ChatContext.js';
import { useUI } from '../../../features/context/UIContext.js';
import { useModel } from '../../../features/context/ModelContext.js';

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
  const { modelLoading, warmupStatus } = useModel();
  const { state: uiState } = useUI();
  const { theme } = uiState;

  const { streaming, waitingForResponse, inputMode } = chatState;

  const [spinnerIndex, setSpinnerIndex] = useState(0);
  const spinnerFrames = ['|', '/', '-', '\\'];

  useEffect(() => {
    if (!modelLoading) return;
    const interval = setInterval(() => {
      setSpinnerIndex((prev) => (prev + 1) % spinnerFrames.length);
    }, 200);
    return () => clearInterval(interval);
  }, [modelLoading, spinnerFrames.length]);

  // Determine status text
  let displayStatus = ' ';
  if (inputMode === 'menu') {
    displayStatus = 'Interactive Menu Active';
  } else if (warmupStatus?.active) {
    const elapsedSeconds = Math.max(0, Math.floor(warmupStatus.elapsedMs / 1000));
    displayStatus = `Warming model (try ${warmupStatus.attempt}, ${elapsedSeconds}s) ${spinnerFrames[spinnerIndex]}`;
  } else if (modelLoading) {
    displayStatus = `Model Loading ${spinnerFrames[spinnerIndex]}`;
  } else if (streaming) {
    displayStatus = 'Assistant is typing...';
  } else if (waitingForResponse) {
    displayStatus = 'Waiting for response...';
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
