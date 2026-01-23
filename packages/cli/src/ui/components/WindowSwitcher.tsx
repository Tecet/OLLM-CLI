/**
 * Window Switcher Component
 * 
 * Visual indicator showing active window (Chat, Terminal, or Editor).
 * Displays dots to indicate which window is currently active.
 * 
 * Architecture:
 * - Uses DotIndicator component for visual representation
 * - Integrates with WindowContext to get active window state
 * - Applies theme colors for consistent styling
 * 
 * Usage:
 * This component is primarily used within ChatTab to show which window
 * is active when multiple windows are available (Chat/Terminal/Editor).
 * 
 * Window Mapping:
 * - Dot 0: Chat window
 * - Dot 1: Terminal window
 * - Dot 2: Editor window
 * 
 * @example
 * ```tsx
 * <Box>
 *   <WindowSwitcher />
 * </Box>
 * ```
 */

import React from 'react';
import { Box, BoxProps as _BoxProps } from 'ink';

import { DotIndicator } from './layout/DotIndicator.js';
import { Theme as _Theme } from '../../config/types.js';
import { useUI } from '../../features/context/UIContext.js';
import { useWindow } from '../contexts/WindowContext.js';

/**
 * WindowSwitcher Component
 * 
 * Renders a visual indicator (dots) showing which window is currently active.
 * The active window is highlighted using the theme's active color.
 */
export function WindowSwitcher() {
  const { activeWindow } = useWindow();
  const { state: uiState } = useUI();
  const { theme } = uiState;

  // Map window type to dot index
  const activeIndex = activeWindow === 'chat' ? 0 : activeWindow === 'terminal' ? 1 : 2;

  return (
    <Box>
      <DotIndicator total={3} active={activeIndex} theme={theme} />
    </Box>
  );
}
