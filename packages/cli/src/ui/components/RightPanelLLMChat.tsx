import React, { useMemo } from 'react';
import { Box } from 'ink';

import { buildChatLines, ChatHistory } from './chat/ChatHistory.js';
import { useChat } from '../../features/context/ChatContext.js';
import { useUI } from '../../features/context/UIContext.js';

interface RightPanelLLMChatProps {
  height: number;
  width: number;
}

export function RightPanelLLMChat({ height, width }: RightPanelLLMChatProps) {
  const { state: chatState } = useChat();
  const { state: uiState } = useUI();

  const maxVisibleLines = Math.max(1, height - 2);
  const contentWidth = Math.max(20, width - 2);

  const lines = useMemo(() => buildChatLines(
    chatState.messages,
    uiState.theme,
    { enabled: true, compactMode: false },
    { enabled: true, maxVisibleLines: 8 },
    0,
    contentWidth,
    0
  ), [chatState.messages, uiState.theme, contentWidth]);

  return (
    <Box flexDirection="column" height="100%" width="100%" overflow="hidden">
      <ChatHistory
        messages={chatState.messages}
        streaming={chatState.streaming}
        waitingForResponse={chatState.waitingForResponse}
        scrollToBottom={true}
        theme={uiState.theme}
        scrollOffset={0}
        maxVisibleLines={maxVisibleLines}
        paddingY={0}
        width={contentWidth}
        lines={lines}
      />
    </Box>
  );
}
