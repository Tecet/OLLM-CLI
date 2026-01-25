/**
 * Terminal Component
 * 
 * Displays terminal output with proper ANSI code rendering.
 * Centers the terminal content within the available column width.
 * Borders are disabled as per user request to use container boundaries.
 */

import React, { useMemo, useEffect } from 'react';
import { Box, Text, useStdout, useInput } from 'ink';

import { useFocusManager } from '../../features/context/FocusContext.js';
import { useKeybinds } from '../../features/context/KeybindsContext.js';
import { useUI } from '../../features/context/UIContext.js';
import { useInputRouting } from '../contexts/InputRoutingContext.js';
import { useWindow } from '../contexts/WindowContext.js';
import { useTerminal } from '../hooks/useTerminal.js';
import { isKey } from '../utils/keyUtils.js';

import type { AnsiToken, AnsiLine } from '../../utils/terminalSerializer.js';

export interface TerminalProps {
  height: number;
}

export function Terminal({ height }: TerminalProps) {
  const { output, resize } = useTerminal();
  const { stdout } = useStdout();
  const { state: uiState } = useUI();

  // Determine width based on available terminal width and sidepanel state
  const width = useMemo(() => {
    if (!stdout) return 80;
    
    // Total column space available for the app
    const stdoutCols = stdout.columns;
    const appTerminalWidth = Math.max(40, stdoutCols);
    const leftColumnWidth = Math.max(20, Math.floor(appTerminalWidth * 0.7));
    
    // Width of the column containing the tab content
    const baseWidth = uiState.sidePanelVisible ? leftColumnWidth - 1 : appTerminalWidth - 1;
    
    // Spacer logic from App.tsx (Line 1001-1002)
    const spacerWidth = Math.floor(baseWidth * 0.1);
    const mainContentWidth = baseWidth - (2 * spacerWidth);
    
    // Subtract internal UI overhead:
    // ChatTab border (2) + Terminal padding (4) [Border removed]
    // Plus a small safety buffer for word-wrap and font variations
    // We reduced subtraction from 14 to 10 because internal borders are gone (+2 width x2 sides = 4)
    const ptyCols = Math.max(10, mainContentWidth - 10);
    
    return ptyCols;
  }, [stdout, uiState.sidePanelVisible]);

  // Terminal height calculation (account for top bar and borders)
  // [Border removed, so we gain 2 lines of vertical space]
  const visibleHeight = Math.max(2, height);

  // Sync PTY size with UI size
  useEffect(() => {
    resize(width, visibleHeight);
  }, [width, visibleHeight, resize]);

  // Scroll State
  const [scrollOffset, setScrollOffset] = React.useState(0);
  const { isFocused } = useFocusManager();
  const { activeWindow } = useWindow();
  const { activeDestination } = useInputRouting();
  const { activeKeybinds } = useKeybinds();
  const hasFocus = isFocused('chat-input') && activeWindow === 'terminal';
  const isTerminalInput = activeDestination === 'terminal1';

  // Output 
  const allLines = useMemo(() => output, [output]);
  const maxScroll = Math.max(0, allLines.length - visibleHeight);

  // Handle keys for scrolling
  useInput((input, key) => {
    if (!hasFocus && !isTerminalInput) return;

    if (isKey(input, key, activeKeybinds.terminal.scrollUp)) {
      setScrollOffset(prev => Math.min(prev + 1, maxScroll));
    } else if (isKey(input, key, activeKeybinds.terminal.scrollDown)) {
      setScrollOffset(prev => Math.max(prev - 1, 0));
    }
  }, { isActive: activeWindow === 'terminal' || isTerminalInput });

  // Reset scroll when new output arrives
  useEffect(() => {
    setScrollOffset(0);
  }, [output]);

  const visibleLines = useMemo(() => {
      const start = Math.max(0, allLines.length - visibleHeight - scrollOffset);
      const end = allLines.length - scrollOffset;
      return allLines.slice(start, end);
  }, [allLines, visibleHeight, scrollOffset]);

  // Render a single line
  const renderLine = (line: AnsiLine, index: number) => {
    if (!line || line.length === 0) {
      return <Box key={index} height={1}><Text> </Text></Box>;
    }
    
    return (
      <Box key={index} height={1} flexShrink={0} width="100%" overflow="hidden">
        <Text wrap="wrap">
          {line.map((token: AnsiToken, tokenIndex: number) => (
            <Text
              key={tokenIndex}
              color={token.fg}
              backgroundColor={token.bg}
              inverse={token.inverse}
              dimColor={token.dim}
              bold={token.bold}
              italic={token.italic}
              underline={token.underline}
            >
              {(token.text || '').replace(/ /g, '\u00A0')}
            </Text>
          ))}
        </Text>
      </Box>
    );
  };

  return (
    <Box 
      flexDirection="column" 
      flexGrow={1}
      width="100%"
      paddingX={2}
      overflow="hidden"
      alignItems="center" // Centering the content column
    >
      <Box flexDirection="column" width={width} height="100%" overflow="hidden">
        {visibleLines.map((line, index) => renderLine(line, index))}
      </Box>
    </Box>
  );
}
