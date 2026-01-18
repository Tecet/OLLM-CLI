/**
 * ChatInputArea - Isolated input component that only re-renders when input-related state changes
 * 
 * This component subscribes directly to ChatContext and only extracts the state it needs,
 * preventing re-renders from other chat state changes (like messages during streaming).
 */
import React, { memo, useCallback, useMemo } from 'react';
import { Box, Text, useInput } from 'ink';
import { InputBox } from './InputBox.js';
import { useChat } from '../../../features/context/ChatContext.js';
import { useUI } from '../../../features/context/UIContext.js';
import { useFocusManager } from '../../../features/context/FocusContext.js';

export interface ChatInputAreaProps {
  /** Optional assigned height from layout */
  height: number;
  /** Whether to show debugging border */
  showBorder?: boolean;
}

export const ChatInputArea = memo(function ChatInputArea({ height, showBorder = true }: ChatInputAreaProps) {
  const { state: chatState, setCurrentInput, sendMessage, executeMenuOption, navigateMenu, setInputMode, setMenuState } = useChat();
  const { state: uiState } = useUI();
  const { isFocused, exitToNavBar } = useFocusManager();
  
  const hasFocus = isFocused('chat-input');
  
  const { currentInput, streaming, waitingForResponse, messages } = chatState;
  const theme = uiState.theme;

  // Memoize user messages to prevent re-renders
  const userMessages = useMemo(() => 
    messages.filter(m => m.role === 'user').map(m => m.content),
    [messages]
  );

  // Memoize submit handler
  const handleSubmit = useCallback(async (value: string) => {
    if (value.trim()) {
      await sendMessage(value);
    }
  }, [sendMessage]);

  useInput(async (input, key) => {
      // Input Logic only works if we have focus!
      if (!hasFocus) return;

      if (chatState.inputMode !== 'menu') return;

      if (key.upArrow) {
          navigateMenu('up');
      } else if (key.downArrow) {
          navigateMenu('down');
      } else if (key.return) {
          executeMenuOption();
      } else if (key.escape) {
          if (chatState.inputMode === 'menu') {
              setInputMode('text');
              setMenuState({ active: false });
          } else {
              exitToNavBar();
          }
      }
  }, { isActive: chatState.inputMode === 'menu' || hasFocus }); // Allow hook to run to check hasFocus condition

  // Border Color Logic
  let borderColor = theme.border.primary;
  if (hasFocus) borderColor = theme.border.active;

  const totalMenuOptions = chatState.menuState.options.length;
  const menuPaddingTop = 1;
  const menuBorderRows = showBorder ? 2 : 0;
  const maxVisibleMenuOptions = Math.max(1, height - menuBorderRows - menuPaddingTop);
  const menuWindowSize = totalMenuOptions === 0 ? 0 : Math.min(maxVisibleMenuOptions, totalMenuOptions);
  const menuStartIndex = totalMenuOptions === 0
    ? 0
    : Math.max(
        0,
        Math.min(
          chatState.menuState.selectedIndex - menuWindowSize + 1,
          totalMenuOptions - menuWindowSize
        )
      );
  const visibleMenuOptions = chatState.menuState.options.slice(
    menuStartIndex,
    menuStartIndex + menuWindowSize
  );

  return (
    <Box 
      height={height} 
      width="100%" 
      borderStyle={showBorder ? 'single' : undefined} 
      borderColor={borderColor}
    >
      {chatState.inputMode === 'text' ? (
        <InputBox
          value={currentInput}
          onChange={setCurrentInput}
          onSubmit={handleSubmit}
          userMessages={userMessages}
          placeholder={hasFocus ? 'Type a message... (Enter to send)' : 'Focus elsewhere... (Ctrl+Space to focus)'}
          disabled={streaming || waitingForResponse || !hasFocus} 
          theme={theme}
        />
      ) : (
        <Box flexDirection="column" paddingX={1} paddingTop={menuPaddingTop}>
          {visibleMenuOptions.map((option, index) => {
            const absoluteIndex = menuStartIndex + index;
            const isSelected = chatState.menuState.selectedIndex === absoluteIndex;
            const prefix = isSelected ? '> ' : '  ';
            const numPrefix = `${absoluteIndex + 1}. `;

            return (
              <Text key={option.id} color={option.disabled ? 'gray' : (isSelected ? theme.text.accent : theme.text.secondary)}>
                {prefix}{numPrefix}{option.label}
              </Text>
            );
          })}
        </Box>
      )}
    </Box>
  );
});

ChatInputArea.displayName = 'ChatInputArea';
