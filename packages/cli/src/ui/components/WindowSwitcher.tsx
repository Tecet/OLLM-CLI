/**
 * Window Switcher Component
 * 
 * Visual indicator showing active window (Chat or Terminal)
 */

import React from 'react';
import { Box, BoxProps as _BoxProps } from 'ink';
import { DotIndicator } from './layout/DotIndicator.js';
import { useWindow } from '../contexts/WindowContext.js';
import { useUI } from '../../features/context/UIContext.js';
import { Theme as _Theme } from '../../config/types.js';

export function WindowSwitcher() {
  const { activeWindow } = useWindow();
  const { state: uiState } = useUI();
  const { theme } = uiState;

  const activeIndex = activeWindow === 'chat' ? 0 : activeWindow === 'terminal' ? 1 : 2;

  return (
    <Box>
      <DotIndicator total={3} active={activeIndex} theme={theme} />
    </Box>
  );
}
