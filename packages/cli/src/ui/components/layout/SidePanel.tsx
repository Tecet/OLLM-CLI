import React from 'react';
import { Box, Text } from 'ink';
import { HeaderBar } from './HeaderBar.js';
import { ConnectionStatus, GPUInfo } from './StatusBar.js';
import { Theme } from '../../../config/types.js';
import { ContextSection } from './ContextSection.js'; // Import directly

export interface SidePanelProps {
  visible: boolean;
  connection: ConnectionStatus;
  model: string;
  gpu: GPUInfo | null;
  theme: Theme;
}

import { useFocusManager } from '../../../features/context/FocusContext.js';

export function SidePanel({ visible, connection, model, gpu, theme }: SidePanelProps) {
  const { isFocused } = useFocusManager();
  
  if (!visible) {
    return null;
  }

  const contextFocused = isFocused('context-panel');
  const fileTreeFocused = isFocused('file-tree');
  const functionsFocused = isFocused('functions');

  return (
    <Box
      flexDirection="column"
      flexGrow={1}
    >
      {/* Row 1: Status Info (Not focusable, mostly static) */}
      <Box 
        borderStyle="single" 
        borderColor={theme.border.primary} 
        marginY={0} // Tight fit
        paddingX={0}
        flexShrink={0}
      >
        <HeaderBar
          connection={connection}
          model={model}
          gpu={gpu}
          theme={theme}
        />
      </Box>

      {/* Row 2: Active Context */}
      <Box 
        flexGrow={1} 
        borderStyle="single" 
        borderColor={contextFocused ? theme.border.active : theme.border.primary}
        marginBottom={0}
        flexShrink={0}
        flexDirection="column"
      >
        <ContextSection />
      </Box>

      {/* Row 3: File Tree (Reduced height) */}
      <Box 
        height={10}
        borderStyle="single" 
        borderColor={fileTreeFocused ? theme.border.active : theme.border.primary}
        marginBottom={0}
        padding={1}
      >
        <Text color="yellow">File Tree (Coming Soon)</Text>
      </Box>

      {/* Row 4: Functions / Info */}
      <Box 
        height={5} 
        borderStyle="single" 
        borderColor={functionsFocused ? theme.border.active : theme.border.primary}
        flexShrink={0}
        paddingX={1}
      >
         <Text>Functions / Info</Text>
      </Box>
    </Box>
  );
}
