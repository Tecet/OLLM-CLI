import React, { useEffect, useState } from 'react';
import { Box, Text, BoxProps } from 'ink';
import { useChat } from '../../../features/context/ChatContext.js';
import { useUI } from '../../../features/context/UIContext.js';
import { useModel } from '../../../features/context/ModelContext.js';
import { useWindow } from '../../contexts/WindowContext.js';
import { useFocusManager } from '../../../features/context/FocusContext.js';

export interface SystemBarProps {
  height: number;
  showBorder?: boolean;
}

/**
 * SystemBar (Row 3)
 * Displays "Agent Thinking" status and "Context Tokens" usage.
 */
export function SystemBar({ height, showBorder = true }: SystemBarProps) {
  const { state: chatState } = useChat();
  const { modelLoading, warmupStatus } = useModel();
  const { state: uiState } = useUI();
  const { theme } = uiState;
  const { isTerminalActive, activeWindow } = useWindow();
  const { isFocused } = useFocusManager();

  const hasFocus = isFocused('system-bar'); 

  const { streaming, waitingForResponse } = chatState;

  const [spinnerIndex, setSpinnerIndex] = useState(0);
  const spinnerFrames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

  useEffect(() => {
    // Show spinner when model is loading OR when streaming (LLM is typing) OR waiting for response
    if (!modelLoading && !streaming && !waitingForResponse) return;
    const interval = setInterval(() => {
      setSpinnerIndex((prev) => (prev + 1) % spinnerFrames.length);
    }, 80);
    return () => clearInterval(interval);
  }, [modelLoading, streaming, waitingForResponse, spinnerFrames.length]);

  // Determine status text
  let displayStatus = ' ';
  if (activeWindow === 'editor') {
    displayStatus = 'Editor Mode';
  } else if (isTerminalActive) {
    displayStatus = 'Terminal Mode';
  } else if (warmupStatus?.active) {
    const elapsedSeconds = Math.max(0, Math.floor(warmupStatus.elapsedMs / 1000));
    displayStatus = `Warming model (try ${warmupStatus.attempt}, ${elapsedSeconds}s) ${spinnerFrames[spinnerIndex]}`;
  } else if (modelLoading) {
    displayStatus = `Loading Model ${spinnerFrames[spinnerIndex]}`;
  } else if (streaming) {
    displayStatus = `Typing ${spinnerFrames[spinnerIndex]}`;
  } else if (waitingForResponse) {
    displayStatus = `Thinking ${spinnerFrames[spinnerIndex]}`;
  } else {
    displayStatus = 'IDLE';
  }
  // Hide border when status is idle per user request
  const effectiveBorderStyle = showBorder && displayStatus !== 'IDLE' ? (theme.border.style as BoxProps['borderStyle']) : undefined;

  return (
    <Box
      height={height}
      borderStyle={effectiveBorderStyle}
      borderColor={hasFocus ? theme.text.secondary : theme.border.primary}
      paddingX={1}
      flexDirection="row"
      alignItems="center"
      justifyContent="space-between"
    >
      <Box>
        <Text color={theme.text.accent} bold>OLLM:</Text>
        <Text> </Text>
        <Text color={isTerminalActive ? 'cyan' : theme.text.primary}>
          {displayStatus}
        </Text>
      </Box>
    </Box>
  );
}
