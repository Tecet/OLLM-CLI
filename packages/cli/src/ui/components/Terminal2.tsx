/**
 * Terminal2 Component
 *
 * Displays the second terminal output with ANSI rendering.
 */

import React, { useMemo, useEffect } from 'react';
import { Box, Text, useStdout, useInput } from 'ink';

import { useFocusManager } from '../../features/context/FocusContext.js';
import { useKeybinds } from '../../features/context/KeybindsContext.js';
import { useUI } from '../../features/context/UIContext.js';
import { useInputRouting } from '../contexts/InputRoutingContext.js';
import { useWindow } from '../contexts/WindowContext.js';
import { useTerminal2 } from '../hooks/useTerminal2.js';
import { isKey } from '../utils/keyUtils.js';

import type { AnsiLine, AnsiToken } from '../../utils/terminalSerializer.js';

export interface Terminal2Props {
  height: number;
}

export function Terminal2({ height }: Terminal2Props) {
  const { output, resize } = useTerminal2();
  const { stdout } = useStdout();
  const { state: uiState } = useUI();
  const { isFocused } = useFocusManager();
  const { activeRightPanel } = useWindow();
  const { activeDestination } = useInputRouting();
  const { activeKeybinds } = useKeybinds();

  const hasFocus = isFocused('context-panel') && activeRightPanel === 'terminal2';
  const isTerminalInput = activeDestination === 'terminal2';

  // Conservative width calculation for side panel
  const width = useMemo(() => {
    if (!stdout) return 40;
    
    // Total column space available for the app
    const terminalWidth = Math.max(40, stdout.columns);
    
    // Side panel width is 30% of total
    const rightPanelWidth = Math.floor(terminalWidth * 0.3);
    
    // Subtract UI overhead:
    // Terminal border (2) + Padding (4) + SidePanel border (inherited)
    // Plus 6 char safety buffer
    return Math.max(10, rightPanelWidth - 14);
  }, [stdout]);

  const visibleHeight = Math.max(2, height - 2);

  useEffect(() => {
    resize(width, visibleHeight);
  }, [width, visibleHeight, resize]);

  const [scrollOffset, setScrollOffset] = React.useState(0);
  const allLines = useMemo(() => output, [output]);
  const maxScroll = Math.max(0, allLines.length - visibleHeight);

  useInput((input, key) => {
    if (!hasFocus && !isTerminalInput) return;

    if (isKey(input, key, activeKeybinds.terminal.scrollUp)) {
      setScrollOffset(prev => Math.min(prev + 1, maxScroll));
    } else if (isKey(input, key, activeKeybinds.terminal.scrollDown)) {
      setScrollOffset(prev => Math.max(prev - 1, 0));
    }
  }, { isActive: activeRightPanel === 'terminal2' || isTerminalInput });

  useEffect(() => {
    setScrollOffset(0);
  }, [output]);

  const visibleLines = useMemo(() => {
    const start = Math.max(0, allLines.length - visibleHeight - scrollOffset);
    const end = allLines.length - scrollOffset;
    return allLines.slice(start, end);
  }, [allLines, visibleHeight, scrollOffset]);

  const renderLine = (line: AnsiLine, index: number) => {
    if (!line || line.length === 0) {
      return <Box key={index} height={1}><Text> </Text></Box>;
    }

    return (
      <Box key={index} height={1} flexShrink={0} overflow="hidden">
        <Text wrap="wrap">
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
      borderStyle="single"
      borderColor={uiState.theme.border.primary}
      overflow="hidden"
    >
      <Box flexDirection="column" width="100%" height="100%" overflow="hidden">
        {visibleLines.map((line, index) => renderLine(line, index))}
      </Box>
    </Box>
  );
}
