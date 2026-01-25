import React from 'react';
import { Box, Text, BoxProps, useInput, useStdout } from 'ink';

import { ActivePromptInfo } from './ActivePromptInfo.js';
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
import { RightPanelLLMChat } from '../RightPanelLLMChat.js';
import { Terminal2 } from '../Terminal2.js';


export interface SidePanelProps {
  visible: boolean;
  connection: ConnectionStatus;
  model: string;
  gpu: GPUInfo | null;
  theme: Theme;
  row1Height?: number;
  width?: number;
}

export function SidePanel({ visible, connection, model, gpu, theme, row1Height, width }: SidePanelProps) {
  const { isFocused } = useFocusManager();
  const { contextUsage } = useChat();
  const { activeKeybinds } = useKeybinds();
  const { stdout } = useStdout();
  
  const contextFocused = isFocused('context-panel');
  const fileTreeFocused = isFocused('side-file-tree');
  const functionsFocused = isFocused('functions');

  const contextText = contextUsage
    ? `${contextUsage.currentTokens}/${contextUsage.maxTokens}`
    : '0/0';

  const { activeRightPanel, switchRightPanel } = useWindow();

  const headerLabel = activeRightPanel === 'tools'
    ? 'Tools'
    : activeRightPanel === 'workspace'
    ? 'Workspace'
    : activeRightPanel === 'llm-chat'
    ? 'LLM Chat'
    : 'Terminal 2';

  // Handle sub-window switching and activation within side panel
  useInput((input, key) => {
    if (!contextFocused) return;

    if (key.ctrl && key.leftArrow) {
      switchRightPanel('prev');
      return;
    }
    if (key.ctrl && key.rightArrow) {
      switchRightPanel('next');
      return;
    }

    if (isKey(input, key, activeKeybinds.layout.switchWindowLeft)) {
      switchRightPanel('prev');
    } else if (isKey(input, key, activeKeybinds.layout.switchWindowRight)) {
      switchRightPanel('next');
    }
  }, { isActive: contextFocused });

  if (!visible) {
    return null;
  }

  const totalHeight = (stdout?.rows || 24) - 1;
  const resolvedRow1Height = row1Height || 3;
  const rightPanelRow2Height = 10;
  const rightPanelRow4Height = 3;
  const rightPanelRow3Height = Math.max(6, totalHeight - resolvedRow1Height - rightPanelRow2Height - rightPanelRow4Height);

  const rightPanelWidth = Math.max(20, width || Math.floor((stdout?.columns || 80) * 0.3));

  const rightPanelIndex = activeRightPanel === 'tools'
    ? 0
    : activeRightPanel === 'workspace'
    ? 1
    : activeRightPanel === 'llm-chat'
    ? 2
    : 3;

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
          {/* Clock removed from side panel header - moved to left top header */}
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
              total={4} 
              active={rightPanelIndex} 
              theme={theme} 
            />
        </Box>

        {activeRightPanel === 'tools' && <ContextSection />}
        {activeRightPanel === 'workspace' && (
          <WorkspacePanel 
            theme={theme}
            height={0}
            width={0}
            hasFocus={contextFocused}
          />
        )}
        {activeRightPanel === 'llm-chat' && (
          <RightPanelLLMChat height={rightPanelRow3Height} width={rightPanelWidth} />
        )}
        {activeRightPanel === 'terminal2' && (
          <Terminal2 height={rightPanelRow3Height - 3} />
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
