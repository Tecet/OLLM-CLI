/**
 * Terminal Component
 * 
 * Displays terminal output and handles terminal sessions
 */

import React, { useMemo, useEffect } from 'react';
import { Box, Text, useStdout } from 'ink';
import stripAnsi from 'strip-ansi';
import { useTerminal } from '../hooks/useTerminal.js';
import { useUI } from '../../features/context/UIContext.js';
import { useFocusManager } from '../../features/context/FocusContext.js';
import { useInput } from 'ink';
import { useWindow } from '../contexts/WindowContext.js';

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

  // Combine and split output to handle newlines correctly and manage scrollback
  const allLines = useMemo(() => {
    const combined = output.map(o => o.text).join('');
    // Split and filter out empty lines at the very end to keep prompt visible
    const split = stripAnsi(combined).split(/\r?\n/);
    return split;
  }, [output]);

  // Max scroll is total lines minus what's visible
  const maxScroll = Math.max(0, allLines.length - visibleHeight);

  // Handle keys for scrolling
  useInput((input, key) => {
    // Only scroll if terminal is active and focused, OR if using global Alt+Scroll
    const isAltScroll = key.meta && (key.upArrow || key.downArrow);
    
    if (!hasFocus && !isAltScroll) return;

    if (key.upArrow) {
      setScrollOffset(prev => Math.min(prev + 1, maxScroll));
    } else if (key.downArrow) {
      setScrollOffset(prev => Math.max(prev - 1, 0));
    }
  }, { isActive: true });

  // Reset scroll when new output arrives if we were at the bottom (0)
  useEffect(() => {
      setScrollOffset(0);
  }, [allLines.length]);

  const visibleLines = useMemo(() => {
      const start = Math.max(0, allLines.length - visibleHeight - scrollOffset);
      const end = allLines.length - scrollOffset;
      const slice = allLines.slice(start, end);

      // Collapse adjacent identical lines to reduce UI spam (e.g., repeated status messages)
      const collapsed: string[] = [];
      let lastLine: string | null = null;
      let count = 0;
      for (const l of slice) {
        if (l === lastLine) {
          count += 1;
        } else {
          if (lastLine !== null) {
            collapsed.push(count > 1 ? `${lastLine}  (x${count})` : lastLine);
          }
          lastLine = l;
          count = 1;
        }
      }
      if (lastLine !== null) {
        collapsed.push(count > 1 ? `${lastLine}  (x${count})` : lastLine);
      }
      return collapsed;
  }, [allLines, visibleHeight, scrollOffset]);

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
      {visibleLines.length === 0 ? (
        <Box marginTop={1} alignSelf="flex-start">
          <Text dimColor>Terminal ready. Type commands and press Enter. {isRunning ? '●' : '○'}</Text>
        </Box>
      ) : (
        visibleLines.map((line, index) => (
          <Box key={index} alignSelf="flex-start">
            <Text wrap="wrap">
              {line}
            </Text>
          </Box>
        ))
      )}
    </Box>
  );
}
