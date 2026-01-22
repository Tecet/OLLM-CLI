import React, { useState } from 'react';
import { Box, Text, BoxProps, useInput } from 'ink';
import { HeaderBar } from './HeaderBar.js';
import { ConnectionStatus, GPUInfo } from './StatusBar.js';
import { ContextSection } from './ContextSection.js';
import { ActivePromptInfo } from './ActivePromptInfo.js';
import { useFocusManager } from '../../../features/context/FocusContext.js';

import { useChat } from '../../../features/context/ChatContext.js';
import { useKeybinds } from '../../../features/context/KeybindsContext.js';
import { isKey } from '../../utils/keyUtils.js';
import { Theme } from '../../../config/types.js';
import { DotIndicator } from './DotIndicator.js';

export interface SidePanelProps {
  visible: boolean;
  connection: ConnectionStatus;
  model: string;
  gpu: GPUInfo | null;
  theme: Theme;
  row1Height?: number;
}

export function SidePanel({ visible, connection, model, gpu, theme, row1Height }: SidePanelProps) {
  const { isFocused } = useFocusManager();
  const { contextUsage } = useChat();
  const { activeKeybinds } = useKeybinds();
  
  const [activeSubWindow, setActiveSubWindow] = useState<'tools' | 'workspace'>('tools');
  
  const contextFocused = isFocused('context-panel');
  const fileTreeFocused = isFocused('side-file-tree');
  const functionsFocused = isFocused('functions');

  const contextText = contextUsage
    ? `${contextUsage.currentTokens}/${contextUsage.maxTokens}`
    : '0/0';

  const isToolsMode = activeSubWindow === 'tools';

  // Handle sub-window switching within Row 3 when focused
  useInput((input, key) => {
    if (!contextFocused) return;

    if (isKey(input, key, activeKeybinds.layout.switchWindowLeft) || isKey(input, key, activeKeybinds.layout.switchWindowRight)) {
      setActiveSubWindow(prev => prev === 'tools' ? 'workspace' : 'tools');
    }
  }, { isActive: contextFocused });

  if (!visible) {
    return null;
  }

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

      {/* Row 2: File Tree (Moved to top) + Active Prompt Info */}
      <Box 
        height={10}
        borderStyle={theme.border.style as BoxProps['borderStyle']} 
        borderColor={fileTreeFocused ? theme.text.secondary : theme.border.primary}
        overflow="hidden"
        flexShrink={0}
        width="100%"
        flexDirection="column"
      >
        <ActivePromptInfo />
      </Box>

      {/* Row 3: Context / Workspace Swappable Area */}
      <Box 
        flexGrow={1}
        borderStyle={theme.border.style as BoxProps['borderStyle']} 
        borderColor={contextFocused ? theme.text.secondary : theme.border.primary}
        flexDirection="column"
        overflow="hidden"
        width="100%"
      >
        {/* Visual Dot Indicators & Tools Label */}
        <Box flexDirection="row" alignItems="center" width="100%" paddingX={1} paddingTop={0}>
            <Box flexGrow={1} justifyContent="center">
                 <Text color={theme.text.accent} bold>Tools</Text>
            </Box>
            <DotIndicator 
              total={2} 
              active={isToolsMode ? 0 : 1} 
              theme={theme} 
            />
        </Box>

        {isToolsMode ? (
          <ContextSection />
        ) : (
          <Box flexDirection="column" paddingX={1} paddingY={1}>
            <Text color={theme.text.accent} bold>Workspace</Text>
            <Box marginTop={1}>
              <Text dimColor>No projects active in this workspace.</Text>
            </Box>
          </Box>
        )}
      </Box>

      {/* Row 4: Functions -> Context Usage Display */}
      <Box 
        height={4} 
        borderStyle={theme.border.style as BoxProps['borderStyle']} 
        borderColor={functionsFocused ? theme.text.secondary : theme.border.primary}
        flexShrink={0}
        overflow="hidden"
        width="100%"
        alignItems="center"
        justifyContent="center"
      >
        <Box flexDirection="row">
          <Text color={theme.text.secondary}>Context: </Text>
          <Text color={theme.text.accent} bold>{contextText}</Text>
        </Box>
      </Box>
    </Box>
  );
}
