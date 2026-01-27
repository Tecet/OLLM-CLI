import React, { useEffect, useState } from 'react';
import { Box, Text, BoxProps } from 'ink';

import { useChat } from '../../../features/context/ChatContext.js';
import { useModel } from '../../../features/context/ModelContext.js';
import { useUI } from '../../../features/context/UIContext.js';
import { useInputRouting } from '../../contexts/InputRoutingContext.js';
import { InputRoutingIndicator } from '../InputRoutingIndicator.js';

export interface SystemBarProps {
  height: number;
  showBorder?: boolean;
}

/**
 * SystemBar (Row 3)
 * Displays "Agent Thinking" status and "Context Tokens" usage.
 */
export function SystemBar({ height }: SystemBarProps) {
  const { state: chatState } = useChat();
  const { modelLoading, warmupStatus } = useModel();
  const { state: uiState } = useUI();
  const { theme } = uiState;
  const { activeDestination } = useInputRouting();

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

  // Determine status text based only on input destination
  let displayStatus = ' ';
  const isTerminalMode = activeDestination === 'terminal1' || activeDestination === 'terminal2';

  if (activeDestination === 'editor') {
    displayStatus = 'Editor';
  } else if (activeDestination === 'terminal2') {
    displayStatus = 'Terminal 2';
  } else if (activeDestination === 'terminal1') {
    displayStatus = 'Terminal 1';
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
    displayStatus = 'LLM Chat';
  }

  return (
    <Box height={height} width="100%" flexDirection="row">
      <Box
        flexGrow={1}
        borderStyle={theme.border.style as BoxProps['borderStyle']}
        borderColor={theme.border.primary}
        paddingX={1}
        alignItems="center"
        justifyContent="flex-start"
      >
        <Text color={theme.text.accent} bold>OLLM:</Text>
        <Text> </Text>
        <Text color={isTerminalMode ? 'cyan' : theme.text.primary}>
          {displayStatus}
        </Text>
      </Box>
      <Box
        borderStyle={theme.border.style as BoxProps['borderStyle']}
        borderColor={theme.border.primary}
        paddingX={1}
        alignItems="center"
        justifyContent="center"
      >
        <InputRoutingIndicator activeDestination={activeDestination} theme={theme} compact />
      </Box>
    </Box>
  );
}
