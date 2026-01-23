import React, { useState } from 'react';
import { Box, Text, BoxProps, useInput } from 'ink';

import { ActivePromptInfo } from './ActivePromptInfo.js';
import { Clock } from './Clock.js';
import { ContextSection } from './ContextSection.js';
import { DotIndicator } from './DotIndicator.js';
import { HeaderBar } from './HeaderBar.js';
import { ConnectionStatus, GPUInfo } from './StatusBar.js';
import { WorkspacePanel } from './WorkspacePanel.js';
import { Theme } from '../../../config/types.js';
import { useChat } from '../../../features/context/ChatContext.js';
import { useFocusManager } from '../../../features/context/FocusContext.js';
import { useKeybinds } from '../../../features/context/KeybindsContext.js';
import { useWindow } from '../../contexts/WindowContext.js';
import { isKey } from '../../utils/keyUtils.js';
import { rightPanelHeaderLabel as _rightPanelHeaderLabel } from '../../utils/windowDisplayLabels.js';


export interface SidePanelProps {
  visible: boolean;
  connection: ConnectionStatus;
  model: string;
  gpu: GPUInfo | null;
  theme: Theme;
  row1Height?: number;
}

export function SidePanel({ visible, connection, model, gpu, theme, row1Height }: SidePanelProps) {
  const { isFocused, setFocus: _focusManagerSetFocus } = useFocusManager();
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

  const { activeWindow: _activeWindow } = useWindow();
  // Use the side-panel's subwindow state for the header so switching to Workspace shows 'Workspace'
  const headerLabel = isToolsMode ? 'Tools' : 'Workspace';

  // Handle sub-window switching and activation within side panel
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
        <Box width="100%" flexDirection="row" alignItems="center" justifyContent="space-between">
          <Box flexGrow={1}>
            <HeaderBar
              connection={connection}
              model={model}
              gpu={gpu}
              theme={theme}
            />
          </Box>
          <Box flexShrink={0} marginLeft={1}>
            <Clock borderColor={theme.border.primary} />
          </Box>
        </Box>
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
           <Box flexDirection="row" alignItems="center" width="100%" paddingX={0} paddingTop={0}>
            <Box flexGrow={1} justifyContent="center">
              <Text color={theme.text.accent} bold>{headerLabel}</Text>
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
          <WorkspacePanel 
            theme={theme}
            height={0} // Will be calculated by flex
            width={0} // Will be calculated by flex
            hasFocus={contextFocused}
          />
        )}
      </Box>

      {/* Row 4: Functions -> Context Usage Display (3 lines) */}
      <Box 
        height={3} 
        borderStyle={theme.border.style as BoxProps['borderStyle']} 
        borderColor={functionsFocused ? theme.text.secondary : theme.border.primary}
        flexShrink={0}
        overflow="hidden"
        width="100%"
        alignItems="center"
        justifyContent="space-between"
        paddingX={1}
      >
        <Box flexDirection="row" alignItems="center">
          <Text color={theme.text.secondary}>Context: </Text>
          <Text color={theme.text.accent} bold>{contextText}</Text>
        </Box>

        <Box flexDirection="row" alignItems="center">
          {/* Right column intentionally left empty (confidence removed) */}
        </Box>
      </Box>
    </Box>
  );
}
