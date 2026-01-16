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

export interface ChatInputAreaProps {
  /** Optional status text override */
  statusText?: string;
}

/**
 * Memoized input area that only re-renders when necessary
 */
export const ChatInputArea = memo(function ChatInputArea({ statusText }: ChatInputAreaProps) {
  const { state: chatState, setCurrentInput, sendMessage, executeMenuOption, navigateMenu, setInputMode, setMenuState } = useChat();
  const { state: uiState } = useUI();
  
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

  // Determine status text - static, no animations
  let displayStatus = ' ';
  if (chatState.inputMode === 'menu') {
      displayStatus = 'Interactive Menu Active - Use Arrow Keys or Numbers';
  } else if (statusText) {
    displayStatus = statusText;
  } else if (streaming) {
    displayStatus = '● Assistant is typing...';
  } else if (waitingForResponse) {
    displayStatus = '○ Waiting for response...';
  }

  useInput(async (input, key) => {
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
              // If no opt-back, maybe fall back to 9th item? 
              // But user explicitly requested "9 back", so let's stick to searching for the specific ID or label logic
              targetOption = chatState.menuState.options.find(o => o.id === 'opt-back');
              
              // If no specific 'back' option found, check if there is actually a 9th item (index 8)
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
  }, { isActive: chatState.inputMode === 'menu' });

  return (
    <Box flexDirection="column" width="100%">
      {/* Fixed height status area - static text only */}
      <Box height={1} paddingX={1}>
        <Text color={theme.text.secondary}>{displayStatus}</Text>
      </Box>
      {/* Input box with border - static container */}
      <Box height={9} borderStyle="single" borderColor={chatState.inputMode === 'menu' ? theme.text.accent : theme.text.secondary}>
        {chatState.inputMode === 'text' ? (
        <InputBox
          value={currentInput}
          onChange={setCurrentInput}
          onSubmit={handleSubmit}
          userMessages={userMessages}
          placeholder={'Type a message... (Enter to send, Shift+Enter for newline)'}
          disabled={streaming || waitingForResponse}
          theme={theme}
        />
        ) : (
            <Box flexDirection="column" paddingX={1}>
                {chatState.menuState.options.map((option, index) => {
                    const isSelected = chatState.menuState.selectedIndex === index;
                    const prefix = isSelected ? '> ' : '  ';
                    
                    // Determine display number
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
    </Box>
  );
});

ChatInputArea.displayName = 'ChatInputArea';
