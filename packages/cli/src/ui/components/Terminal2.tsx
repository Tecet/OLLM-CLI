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

import type { AnsiLine, AnsiToken } from '../utils/terminalSerializer.js';

export interface Terminal2Props {
  height: number;
}

export function Terminal2({ height }: Terminal2Props) {
  const { output, isRunning, resize } = useTerminal2();
  const { stdout } = useStdout();
  const { state: uiState } = useUI();
  const { isFocused } = useFocusManager();
  const { activeRightPanel } = useWindow();
  const { activeDestination } = useInputRouting();
  const { activeKeybinds } = useKeybinds();

  const hasFocus = isFocused('context-panel') && activeRightPanel === 'terminal2';
  const isTerminalInput = activeDestination === 'terminal2';

  const width = useMemo(() => {
    if (!stdout) return 40;
    const effectiveColumns = stdout.columns - 6;
    const widthFactor = uiState.sidePanelVisible ? 0.3 : 1.0;
    return Math.max(10, Math.floor(effectiveColumns * widthFactor));
  }, [stdout, uiState.sidePanelVisible]);

  const chromeRows = 1;
  const visibleHeight = Math.max(1, height - chromeRows);

  useEffect(() => {
    resize(width, visibleHeight);
  }, [width, visibleHeight, resize]);
  const [scrollOffset, setScrollOffset] = React.useState(0);
  const allLines = useMemo(() => output, [output]);
  const maxScroll = Math.max(0, allLines.length - visibleHeight);

  useInput(
    (input, key) => {
      if (!hasFocus && !isTerminalInput) return;

      if (isKey(input, key, activeKeybinds.terminal.scrollUp)) {
        setScrollOffset((prev) => Math.min(prev + 1, maxScroll));
      } else if (isKey(input, key, activeKeybinds.terminal.scrollDown)) {
        setScrollOffset((prev) => Math.max(prev - 1, 0));
      }
    },
    { isActive: activeRightPanel === 'terminal2' || isTerminalInput }
  );

  useEffect(() => {
    setScrollOffset(0);
  }, [output]);

  const visibleLines = useMemo(() => {
    const start = Math.max(0, allLines.length - visibleHeight - scrollOffset);
    const end = allLines.length - scrollOffset;
    return allLines.slice(start, end);
  }, [allLines, visibleHeight, scrollOffset]);

  const renderLine = (line: AnsiLine, index: number) => {
    if (!line || !Array.isArray(line) || line.length === 0) {
      return (
        <Box key={index}>
          <Text> </Text>
        </Box>
      );
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
      <Box flexDirection="column" width="100%" height="100%" overflow="hidden" flexShrink={1}>
        {visibleLines.length === 0 ? (
          <Box marginTop={1}>
            <Text dimColor>
              Terminal 2 ready. Type commands and press Enter. {isRunning ? '●' : '○'}
            </Text>
          </Box>
        ) : (
          visibleLines.map((line, index) => renderLine(line, index))
        )}
      </Box>
    </Box>
  );
}
