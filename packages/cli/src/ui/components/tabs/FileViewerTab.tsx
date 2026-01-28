/**
 * FileViewerTab Component
 *
 * Displays the syntax viewer for opened files in the main left panel.
 * This provides a larger viewing area compared to the right panel.
 *
 * Requirements: 5.4, 5.5
 */

import React, { useCallback } from 'react';
import { Box, Text, useInput } from 'ink';

import { SyntaxViewer } from '../file-explorer/SyntaxViewer.js';
import { useFocusManager } from '../../../features/context/FocusContext.js';
import { useKeybinds } from '../../../features/context/KeybindsContext.js';
import { useUI } from '../../../features/context/UIContext.js';
import { isKey } from '../../utils/keyUtils.js';

export interface FileViewerTabProps {
  /** Width of the tab container */
  width?: number;
  /** Height of the tab container */
  height?: number;
}

/**
 * FileViewerTab component
 *
 * Displays a file in the syntax viewer with scrolling support.
 * Provides a large viewing area in the main left panel.
 * 
 * Esc key behavior:
 * - Closes the file viewer
 * - Returns to chat tab
 * - Focuses the navbar
 */
export function FileViewerTab({ width, height }: FileViewerTabProps) {
  const { state: uiState, closeFileViewer, setActiveTab } = useUI();
  const { activeKeybinds } = useKeybinds();
  const focusManager = useFocusManager();

  const { fileViewer } = uiState;

  // Handle Esc key to close viewer and return to chat (like other tabs)
  const handleClose = useCallback(() => {
    // Close viewer and switch to chat
    closeFileViewer();
    setActiveTab('chat');
    focusManager.setFocus('nav-bar');
    focusManager.setMode('browse');
  }, [closeFileViewer, setActiveTab, focusManager]);

  useInput(
    (input, key) => {
      if (isKey(input, key, activeKeybinds.chat.cancel)) {
        handleClose();
      }
    },
    { isActive: fileViewer.isOpen }
  );

  if (!fileViewer.isOpen || !fileViewer.filePath || !fileViewer.content) {
    return (
      <Box flexDirection="column" width={width} height={height} padding={1}>
        <Text color="gray">No file open</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" width={width} height={height}>
      <SyntaxViewer
        filePath={fileViewer.filePath}
        content={fileViewer.content}
        hasFocus={true}
        windowHeight={height ? height - 4 : 25}
      />
    </Box>
  );
}
