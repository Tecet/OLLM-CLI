import React from 'react';
import { Box, Text, BoxProps } from 'ink';
import { HeaderBar } from './HeaderBar.js';
import { ConnectionStatus, GPUInfo } from './StatusBar.js';
import { Theme } from '../../../config/types.js';
import { ContextSection } from './ContextSection.js';

export interface SidePanelProps {
  visible: boolean;
  connection: ConnectionStatus;
  model: string;
  gpu: GPUInfo | null;
  theme: Theme;
  row1Height?: number;
}

import { useFocusManager } from '../../../features/context/FocusContext.js';

export function SidePanel({ visible, connection, model, gpu, theme, row1Height }: SidePanelProps) {
  const { isFocused } = useFocusManager();
  
  if (!visible) {
    return null;
  }

  const contextFocused = isFocused('context-panel');
  const fileTreeFocused = isFocused('file-tree');
  const functionsFocused = isFocused('functions');

  return (
    <Box flexDirection="column" flexGrow={1} width="100%">
      {/* Row 1: HeaderBar - matching left side Row 1 height */}
      <Box flexShrink={0} height={row1Height} alignItems="center" width="100%">
        <HeaderBar
          connection={connection}
          model={model}
          gpu={gpu}
          theme={theme}
        />
      </Box>

      {/* Row 2: Context */}
      <Box 
        flexGrow={1}
        borderStyle={theme.border.style as BoxProps['borderStyle']} 
        borderColor={contextFocused ? theme.border.active : theme.border.primary}
        flexDirection="column"
        overflow="hidden"
        width="100%"
      >
        <ContextSection />
      </Box>

      {/* Row 3: File Tree */}
      <Box 
        height={8}
        borderStyle={theme.border.style as BoxProps['borderStyle']} 
        borderColor={fileTreeFocused ? theme.border.active : theme.border.primary}
        overflow="hidden"
        flexShrink={0}
        width="100%"
      >
        <Box paddingX={1}>
          <Text color={theme.status.warning}>File Tree (Coming Soon)</Text>
        </Box>
      </Box>

      {/* Row 4: Functions */}
      <Box 
        height={4} 
        borderStyle={theme.border.style as BoxProps['borderStyle']} 
        borderColor={functionsFocused ? theme.border.active : theme.border.primary}
        flexShrink={0}
        overflow="hidden"
        width="100%"
      >
        <Box paddingX={1}>
          <Text>Functions / Info</Text>
        </Box>
      </Box>
    </Box>
  );
}
