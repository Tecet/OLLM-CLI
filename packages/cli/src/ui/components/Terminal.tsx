/**
 * Terminal Component
 * 
 * Displays terminal output with proper ANSI code rendering using xterm.js headless
 */

import React, { useMemo, useEffect } from 'react';
import { Box, Text, useStdout, useInput } from 'ink';

import { useFocusManager } from '../../features/context/FocusContext.js';
import { useUI } from '../../features/context/UIContext.js';
import { useWindow } from '../contexts/WindowContext.js';
import { useTerminal } from '../hooks/useTerminal.js';
import type { AnsiToken, AnsiLine } from '../../utils/terminalSerializer.js';

export interface TerminalProps {
  height: number;
}

export function Terminal({ height }: TerminalProps) {
  const { output, isRunning, resize } = useTerminal();
  const { stdout } = useStdout();
  const { state: uiState } = useUI();

  // Determine width based on available terminal width and sidepanel state
  const width = useMemo(() => {
    if (!stdout) return 80;
    const sidePanelVisible = uiState.sidePanelVisible;
    const effectiveColumns = stdout.columns - 6; // Accounts for paddingX={3} in App.tsx
    const widthFactor = sidePanelVisible ? 0.7 : 1.0;
    return Math.max(10, Math.floor(effectiveColumns * widthFactor));
  }, [stdout, uiState.sidePanelVisible]);

  // Sync PTY size with UI size
  useEffect(() => {
    const visibleHeight = Math.max(1, height - 3); // Account for borders and top padding
    resize(width, visibleHeight);
  }, [width, height, resize]);

  // Calculate available lines based on height
  const visibleHeight = Math.max(1, height - 3);

  // Scroll State
  const [scrollOffset, setScrollOffset] = React.useState(0);
  const { isFocused } = useFocusManager();
  const { activeWindow } = useWindow();
  const hasFocus = isFocused('chat-input') && activeWindow === 'terminal';

  // Output is already structured as AnsiLine[] (array of token arrays)
  const allLines = useMemo(() => {
    return output;
  }, [output]);

  // Max scroll is total lines minus what's visible
  const maxScroll = Math.max(0, allLines.length - visibleHeight);

  // Handle keys for scrolling - only when terminal is visible and NOT when typing in input
  useInput((input, key) => {
    // Only scroll if terminal is active and focused, OR if using global Alt+Scroll
    const isAltScroll = key.meta && (key.upArrow || key.downArrow);
    
    if (!hasFocus && !isAltScroll) return;

    if (key.upArrow) {
      setScrollOffset(prev => Math.min(prev + 1, maxScroll));
    } else if (key.downArrow) {
      setScrollOffset(prev => Math.max(prev - 1, 0));
    }
  }, { isActive: activeWindow === 'terminal' && !hasFocus }); // Only active when terminal window is shown but input doesn't have focus

  // Reset scroll when new output arrives if we were at the bottom (0)
  useEffect(() => {
      setScrollOffset(0);
  }, [allLines.length]);

  const visibleLines = useMemo(() => {
      const start = Math.max(0, allLines.length - visibleHeight - scrollOffset);
      const end = allLines.length - scrollOffset;
      return allLines.slice(start, end);
  }, [allLines, visibleHeight, scrollOffset]);

  // Render a single line with ANSI tokens
  const renderLine = (line: AnsiLine, index: number) => {
    // Safety check for empty or invalid lines
    if (!line || !Array.isArray(line) || line.length === 0) {
      return <Box key={index}><Text> </Text></Box>;
    }
    
    return (
      <Box key={index} flexShrink={1}>
        {line.map((token: AnsiToken, tokenIndex: number) => (
          <Text
            key={tokenIndex}
            color={token.fg || undefined}
            backgroundColor={token.bg || undefined}
            inverse={token.inverse}
            dimColor={token.dim}
            bold={token.bold}
            italic={token.italic}
            underline={token.underline}
          >
            {token.text}
          </Text>
        ))}
      </Box>
    );
  };

  return (
    <Box 
      flexDirection="column" 
      height="100%" 
      width="100%"
      paddingX={1} 
      paddingTop={1}
      paddingBottom={0}
      flexGrow={1}
      flexShrink={1}
      overflow="hidden"
      alignItems="flex-start"
    >
      {/* Container to isolate terminal rendering */}
      <Box 
        flexDirection="column" 
        width="100%"
        height="100%"
        overflow="hidden"
        flexShrink={1}
      >
        {visibleLines.length === 0 ? (
          <Box marginTop={1}>
            <Text dimColor>Terminal ready. Type commands and press Enter. {isRunning ? '●' : '○'}</Text>
          </Box>
        ) : (
          visibleLines.map((line, index) => renderLine(line, index))
        )}
      </Box>
    </Box>
  );
}
