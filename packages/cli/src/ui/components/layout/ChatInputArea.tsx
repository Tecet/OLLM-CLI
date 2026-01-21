/**
 * ChatInputArea - Isolated input component that only re-renders when input-related state changes
 * 
 * This component subscribes directly to ChatContext and only extracts the state it needs,
 * preventing re-renders from other chat state changes (like messages during streaming).
 */
import React, { memo, useCallback, useMemo } from 'react';
import { Box, Text, useInput, BoxProps } from 'ink';
import { InputBox } from './InputBox.js';
import { useChat, Message } from '../../../features/context/ChatContext.js';
import { useUI } from '../../../features/context/UIContext.js';
import { useFocusManager } from '../../../features/context/FocusContext.js';
import { useWindow } from '../../contexts/WindowContext.js';
import { useTerminal } from '../../hooks/useTerminal.js';

export interface ChatInputAreaProps {
  /** Optional assigned height from layout */
  height: number;
  /** Whether to show debugging border */
  showBorder?: boolean;
}

export const ChatInputArea = memo(function ChatInputArea({ height, showBorder = true }: ChatInputAreaProps) {
  const { state: chatState, setCurrentInput, sendMessage, cancelGeneration, executeMenuOption, navigateMenu, setInputMode, setMenuState } = useChat();
  const { state: uiState } = useUI();
  const { isFocused, exitToNavBar } = useFocusManager();
  const { activeWindow, switchWindow } = useWindow();
  const { sendCommand } = useTerminal();
  
  const hasFocus = isFocused('chat-input');
  const isTerminalActive = activeWindow === 'terminal';
  
  const { currentInput, streaming, waitingForResponse, messages, statusMessage } = chatState;
  const theme = uiState.theme;

  // Render sticky status line
  const renderStatus = () => {
    if (statusMessage) {
      return (
        <Box height={1} paddingX={1}>
          <Text color={theme.text.accent} bold>{statusMessage}</Text>
        </Box>
      );
    }
    if (streaming) {
      return (
        <Box height={1} paddingX={1}>
          <Text color={theme.text.secondary} dimColor italic>Assistant is typing... (Type 'stop' to cancel)</Text>
        </Box>
      );
    }
    if (waitingForResponse) {
      return (
        <Box height={1} paddingX={1}>
          <Text color={theme.text.secondary} dimColor italic>Waiting for response... (Type 'stop' to cancel)</Text>
        </Box>
      );
    }
    return null;
  };

  // Memoize user messages to prevent re-renders
  const userMessages = useMemo(() => 
    messages.filter(m => m.role === 'user').map((m: Message) => m.content),
    [messages]
  );

  // Memoize submit handler
  const handleSubmit = useCallback(async (value: string) => {
    if (value.trim()) {
      if (isTerminalActive) {
        sendCommand(value);
        setCurrentInput(''); // Clear input after sending to terminal
      } else {
        // Handle input during streaming/waiting
        if (streaming || waitingForResponse) {
          const normalized = value.trim().toLowerCase();
          // Check for stop commands
          if (['stop', 'cancel', '/stop', '/cancel'].includes(normalized)) {
            cancelGeneration();
            setCurrentInput('');
          }
          // Ignore other inputs during streaming
          return;
        }
        await sendMessage(value);
      }
    }
  }, [sendMessage, isTerminalActive, sendCommand, setCurrentInput, streaming, waitingForResponse, cancelGeneration]);

  useInput(async (input, key) => {
      // Input Logic only works if we have focus!
      if (!hasFocus) return;

      // Window switching logic - cycle through windows with arrows
      if (key.leftArrow || key.rightArrow) {
          switchWindow();
          return;
      }

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
  if (isTerminalActive && hasFocus) borderColor = 'cyan';

  const totalMenuOptions = chatState.menuState.options.length;
  const menuPaddingTop = 1;
  const menuBorderRows = showBorder ? 2 : 0;
  const statusRows = (statusMessage || streaming || waitingForResponse) ? 1 : 0;
  const maxVisibleMenuOptions = Math.max(1, height - menuBorderRows - menuPaddingTop - statusRows);
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

  // Determine placeholder based on mode
  let placeholder = hasFocus ? 'Type a message... (Enter to send)' : 'Focus elsewhere... (Ctrl+Space to focus)';
  if (isTerminalActive) {
    placeholder = hasFocus ? 'Enter terminal command... (Enter to execute)' : 'Terminal inactive...';
  }

  return (
    <Box 
      height={height} 
      width="100%"
      flexDirection="column"
      borderStyle={showBorder ? (theme.border.style as BoxProps['borderStyle']) : undefined} 
      borderColor={borderColor}
    >
      {renderStatus()}
      <Box flexGrow={1}>
        {chatState.inputMode === 'text' ? (
          <InputBox
            value={currentInput}
            onChange={setCurrentInput}
            onSubmit={handleSubmit}
            userMessages={userMessages}
            placeholder={placeholder}
            disabled={!isTerminalActive && !hasFocus} 
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
    </Box>
  );
});

ChatInputArea.displayName = 'ChatInputArea';
