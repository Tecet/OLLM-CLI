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
  const { isFocused } = useFocusManager();
  
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
          setInputMode('text');
          setMenuState({ active: false });
      } else {
          // Key Handling for 0-9
          let targetOption = null;
          
          if (input === '0') {
              // 0 -> Exit (look for opt-exit or hard exit)
              targetOption = chatState.menuState.options.find(o => o.id === 'opt-exit');
              if (!targetOption) {
                  // Fallback: Hard exit
                  setInputMode('text');
                  setMenuState({ active: false });
                  return;
              }
          } else if (input === '9') {
              // 9 -> Back (look for opt-back)
              targetOption = chatState.menuState.options.find(o => o.id === 'opt-back');
              
              if (!targetOption && chatState.menuState.options.length >= 9) {
                  targetOption = chatState.menuState.options[8];
              }
          } else if (input.match(/^[1-8]$/)) {
              // 1-8 -> Index 0-7
              const index = parseInt(input) - 1;
              targetOption = chatState.menuState.options[index];
          }

          if (targetOption) {
              setInputMode('text');
              setMenuState({ active: false });
              await targetOption.action();
          }
      }
  }, { isActive: chatState.inputMode === 'menu' || hasFocus }); // Allow hook to run to check hasFocus condition

  // Border Color Logic
  let borderColor = theme.border.primary;
  if (hasFocus) borderColor = theme.border.active;
  else if (chatState.inputMode === 'menu') borderColor = theme.text.accent;

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
        <Box flexDirection="column" paddingX={1} paddingTop={1}>
          {chatState.menuState.options.map((option, index) => {
            const isSelected = chatState.menuState.selectedIndex === index;
            const prefix = isSelected ? '> ' : '  ';
            
            let numPrefix = '';
            if (option.id === 'opt-exit') {
              numPrefix = '0. ';
            } else if (option.id === 'opt-back') {
              numPrefix = '9. ';
            } else if (index < 8) {
              numPrefix = `${index + 1}. `;
            }

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
