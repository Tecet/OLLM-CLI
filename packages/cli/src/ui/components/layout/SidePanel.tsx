import React from 'react';
import { Box, Text, BoxProps, useInput } from 'ink';

import { ActivePromptInfo } from './ActivePromptInfo.js';
import { ContextSection } from './ContextSection.js';
import { DotIndicator } from './DotIndicator.js';
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
  theme: Theme;
  height: number;
  width?: number;
}

export function SidePanel({ visible, theme, height, width }: SidePanelProps) {
  const { isFocused } = useFocusManager();
  const { contextUsage } = useChat();
  const { activeKeybinds } = useKeybinds();

  const contextFocused = isFocused('context-panel');
  const fileTreeFocused = isFocused('side-file-tree');
  const functionsFocused = isFocused('functions');

  const contextText = contextUsage
    ? `${contextUsage.currentTokens}/${contextUsage.maxTokens}`
    : '0/0';

  const { activeRightPanel, switchRightPanel } = useWindow();

  const headerLabel =
    activeRightPanel === 'tools'
      ? 'Tools'
      : activeRightPanel === 'workspace'
        ? 'Workspace'
        : activeRightPanel === 'llm-chat'
          ? 'LLM Chat'
          : 'Terminal 2';

  // Handle sub-window switching and activation within side panel
  useInput(
    (input, key) => {
      // Check if any element in the side panel has focus
      const hasSideFocus =
        contextFocused || fileTreeFocused || functionsFocused || isFocused('side-file-tree');
      if (!hasSideFocus) return;

      const isWindowSwitchLeft =
        (key.ctrl && key.leftArrow) || isKey(input, key, activeKeybinds.layout.switchWindowLeft);
      const isWindowSwitchRight =
        (key.ctrl && key.rightArrow) || isKey(input, key, activeKeybinds.layout.switchWindowRight);

      if (isWindowSwitchLeft) {
        switchRightPanel('prev');
      } else if (isWindowSwitchRight) {
        switchRightPanel('next');
      }
    },
    { isActive: true }
  );

  if (!visible) {
    return null;
  }

  const contextSectionHeight = 3;
  const activePromptHeight = 10;
  const contentHeight = height - contextSectionHeight - activePromptHeight;

  const rightPanelIndex =
    activeRightPanel === 'tools'
      ? 0
      : activeRightPanel === 'workspace'
        ? 1
        : activeRightPanel === 'llm-chat'
          ? 2
          : 3;

  return (
    <Box flexDirection="column" width="100%" height={height}>
      {/* Active Prompt Info - At the top */}
      <Box
        height={activePromptHeight}
        borderStyle={theme.border.style as BoxProps['borderStyle']}
        borderColor={fileTreeFocused ? theme.border.active : theme.border.primary}
        overflow="hidden"
        flexShrink={0}
        width="100%"
        flexDirection="column"
      >
        <ActivePromptInfo />
      </Box>

      {/* Main Content Area - Takes remaining space */}
      <Box
        flexGrow={1}
        borderStyle={theme.border.style as BoxProps['borderStyle']}
        borderColor={contextFocused ? theme.border.active : theme.border.primary}
        flexDirection="column"
        overflow="hidden"
        width="100%"
      >
        {/* Header with Dot Indicators & Label */}
        <Box flexDirection="row" alignItems="center" width="100%" paddingX={1} paddingTop={0}>
          <Box flexGrow={1} justifyContent="center">
            <Text color={theme.text.accent} bold>
              {headerLabel}
            </Text>
          </Box>
          <DotIndicator total={4} active={rightPanelIndex} theme={theme} />
        </Box>

        {/* Content based on active panel */}
        {activeRightPanel === 'tools' && <ContextSection />}
        {activeRightPanel === 'workspace' && (
          <WorkspacePanel theme={theme} height={0} width={0} hasFocus={contextFocused} />
        )}
        {activeRightPanel === 'llm-chat' && (
          <RightPanelLLMChat height={contentHeight - 3} width={width || 20} />
        )}
        {activeRightPanel === 'terminal2' && <Terminal2 height={contentHeight - 3} />}
      </Box>

      {/* Context Section - Sticky at bottom */}
      <Box
        height={contextSectionHeight}
        borderStyle={theme.border.style as BoxProps['borderStyle']}
        borderColor={functionsFocused ? theme.border.active : theme.border.primary}
        flexShrink={0}
        overflow="hidden"
        width="100%"
        alignItems="center"
        justifyContent="space-between"
        paddingX={1}
      >
        <Box flexDirection="row" alignItems="center">
          <Text color={theme.text.secondary}>Context: </Text>
          <Text color={theme.text.accent} bold>
            {contextText}
          </Text>
        </Box>
      </Box>
    </Box>
  );
}
