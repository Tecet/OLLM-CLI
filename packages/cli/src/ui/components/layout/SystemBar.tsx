import { useEffect, useState } from 'react';
import { Box, Text, BoxProps } from 'ink';

import { useChat } from '../../../features/context/ChatContext.js';
import { useContextManager } from '../../../features/context/ContextManagerContext.js';
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
 * Displays "OLLM: Status", "Context Tokens", and "Input Routing" in 3 separate boxes.
 */
export function SystemBar({ height }: SystemBarProps) {
  const { state: chatState } = useChat();
  const { modelLoading, warmupStatus } = useModel();
  const { state: uiState } = useUI();
  const { theme } = uiState;
  const { activeDestination } = useInputRouting();
  const { state: contextState } = useContextManager();

  const { streaming, waitingForResponse } = chatState;

  const [spinnerIndex, setSpinnerIndex] = useState(0);
  const spinnerFrames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

  useEffect(() => {
    // Show spinner when model is loading OR when streaming (LLM is typing) OR waiting for response OR compressing
    if (!modelLoading && !streaming && !waitingForResponse && !contextState.compressing) return;
    const interval = setInterval(() => {
      setSpinnerIndex((prev) => (prev + 1) % spinnerFrames.length);
    }, 80);
    return () => clearInterval(interval);
  }, [modelLoading, streaming, waitingForResponse, contextState.compressing, spinnerFrames.length]);

  // Determine status text based only on input destination
  let displayStatus = ' ';
  const isTerminalMode = activeDestination === 'terminal1' || activeDestination === 'terminal2';

  if (contextState.compressing && contextState.compressionProgress) {
    // Show compression progress
    const { stage, progress } = contextState.compressionProgress;
    displayStatus = `Compressing (${stage} ${progress}%) ${spinnerFrames[spinnerIndex]}`;
  } else if (contextState.compressing) {
    // Show generic compression status
    displayStatus = `Compressing context ${spinnerFrames[spinnerIndex]}`;
  } else if (activeDestination === 'editor') {
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

  // Get context usage
  const contextUsed = contextState.usage.currentTokens || 0;
  const contextLimit = contextState.usage.maxTokens || 8192;

  return (
    <Box height={height} width="100%" flexDirection="row" gap={1}>
      {/* Left: OLLM Status */}
      <Box
        flexGrow={1}
        borderStyle={theme.border.style as BoxProps['borderStyle']}
        borderColor={theme.border.primary}
        paddingX={1}
        alignItems="center"
        justifyContent="flex-start"
      >
        <Text color={theme.text.accent} bold>
          OLLM:
        </Text>
        <Text> </Text>
        <Text color={isTerminalMode ? 'cyan' : theme.text.primary}>{displayStatus}</Text>
      </Box>

      {/* Middle: Context Usage */}
      <Box
        borderStyle={theme.border.style as BoxProps['borderStyle']}
        borderColor={theme.border.primary}
        paddingX={1}
        alignItems="center"
        justifyContent="center"
      >
        <Text color={theme.text.secondary}>Context: </Text>
        <Text color={theme.text.accent}>{contextUsed}</Text>
        <Text color={theme.text.secondary}>/</Text>
        <Text color={theme.text.primary}>{contextLimit}</Text>
      </Box>

      {/* Right: Input Routing */}
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
