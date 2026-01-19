/**
 * Window Switcher Component
 * 
 * Visual indicator showing active window (Chat or Terminal)
 */

import React from 'react';
import { Box, Text, BoxProps } from 'ink';
import { useWindow } from '../contexts/WindowContext.js';
import { useUI } from '../../features/context/UIContext.js';

export function WindowSwitcher() {
  const { activeWindow } = useWindow();
  const { state: uiState } = useUI();
  const { theme } = uiState;

  const chatActive = activeWindow === 'chat';
  const termActive = activeWindow === 'terminal';

  return (
    <Box 
      borderStyle={theme.border.style as BoxProps['borderStyle']} 
      borderColor={theme.border.primary}
      paddingX={1}
    >
      <Text color={chatActive ? theme.text.accent : theme.text.secondary} bold={chatActive}>
        {chatActive ? '● ' : '○ '}LLM Chat
      </Text>
      <Text color={theme.text.secondary} dimColor> | </Text>
      <Text color={termActive ? theme.text.accent : theme.text.secondary} bold={termActive}>
        {termActive ? '● ' : '○ '}Terminal
      </Text>
    </Box>
  );
}
