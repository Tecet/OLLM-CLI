/**
 * ChatInputArea - Isolated input component that only re-renders when input-related state changes
 *
 * This component subscribes directly to ChatContext and only extracts the state it needs,
 * preventing re-renders from other chat state changes (like messages during streaming).
 */
import React, { memo, useCallback, useEffect, useMemo } from 'react';
import { Box, Text, useInput, BoxProps } from 'ink';

import { InputBox } from './InputBox.js';
import { useChat, Message } from '../../../features/context/ChatContext.js';
import { useContextManager } from '../../../features/context/ContextManagerContext.js';
import { useFocusManager } from '../../../features/context/FocusContext.js';
import { useKeybinds } from '../../../features/context/KeybindsContext.js';
import { useUI } from '../../../features/context/UIContext.js';
import { useInputRouting } from '../../contexts/InputRoutingContext.js';
import { useWindow } from '../../contexts/WindowContext.js';
import { useTerminal } from '../../hooks/useTerminal.js';
import { useTerminal2 } from '../../hooks/useTerminal2.js';
import { isKey } from '../../utils/keyUtils.js';

export interface ChatInputAreaProps {
  /** Optional assigned height from layout */
  height: number;
  /** Whether to show debugging border */
  showBorder?: boolean;
}

export const ChatInputArea = memo(function ChatInputArea({
  height,
  showBorder = true,
}: ChatInputAreaProps) {
  const {
    state: chatState,
    setCurrentInput,
    sendMessage,
    cancelGeneration,
    executeMenuOption,
    navigateMenu,
    setInputMode,
    setMenuState,
  } = useChat();
  const { state: contextState } = useContextManager();
  const { state: uiState } = useUI();
  const { isFocused, setFocus } = useFocusManager();
  const { switchWindow } = useWindow();
  const { sendCommand, sendRawInput: sendRawInputT1 } = useTerminal();
  const { sendRawInput: sendRawInputT2 } = useTerminal2();
  const { activeDestination, cycleDestination, setActiveDestination, inputMode } =
    useInputRouting();
  const { activeKeybinds } = useKeybinds();

  const hasFocus = isFocused('chat-input');
  const isTerminalActive = activeDestination === 'terminal1' || activeDestination === 'terminal2';

  const { currentInput, streaming, waitingForResponse, messages, statusMessage } = chatState;
  const theme = uiState.theme;

  useEffect(() => {
    if (isTerminalActive) {
      setFocus('chat-input');
    }
  }, [isTerminalActive, setFocus]);

  // Render sticky status line
  const renderStatus = () => {
    if (statusMessage) {
      return (
        <Box height={1} paddingX={1}>
          <Text color={theme.text.accent} bold>
            {statusMessage}
          </Text>
        </Box>
      );
    }
    return null;
  };

  // Memoize user messages to prevent re-renders
  const userMessages = useMemo(
    () => messages.filter((m) => m.role === 'user').map((m: Message) => m.content),
    [messages]
  );

  // Memoize submit handler
  const handleSubmit = useCallback(
    async (value: string) => {
      if (value.trim()) {
        if (activeDestination === 'terminal1') {
          sendCommand(value);
          setCurrentInput('');
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
    },
    [
      sendMessage,
      activeDestination,
      sendCommand,
      setCurrentInput,
      streaming,
      waitingForResponse,
      cancelGeneration,
    ]
  );

  useInput(
    async (input, key) => {
      if (hasFocus) {
        if (key.ctrl && key.leftArrow) {
          cycleDestination('prev');
          return;
        }
        if (key.ctrl && key.rightArrow) {
          cycleDestination('next');
          return;
        }
        if (key.ctrl && input === '1') {
          setActiveDestination('llm');
          return;
        }
        if (key.ctrl && input === '2') {
          setActiveDestination('terminal1');
          return;
        }
        if (key.ctrl && input === '3') {
          setActiveDestination('terminal2');
          return;
        }
      }

      if (activeDestination === 'terminal1' || activeDestination === 'terminal2') {
        const sendRaw = activeDestination === 'terminal1' ? sendRawInputT1 : sendRawInputT2;

        if (key.escape && hasFocus) {
          setActiveDestination('llm');
          return;
        }
        if (
          isKey(input, key, activeKeybinds.terminal.scrollUp) ||
          isKey(input, key, activeKeybinds.terminal.scrollDown)
        ) {
          return;
        }
        if (isKey(input, key, activeKeybinds.terminal.historyUp)) {
          sendRaw('\x1b[A');
          return;
        }
        if (isKey(input, key, activeKeybinds.terminal.historyDown)) {
          sendRaw('\x1b[B');
          return;
        }
        if (key.tab) {
          return;
        }
        if (key.return) {
          sendRaw('\r');
        } else if (
          key.backspace ||
          key.delete ||
          input === '\b' ||
          input === '\x7f' ||
          (key.ctrl && input === 'h')
        ) {
          sendRaw('\x7f');
        } else if (key.ctrl && input === 'c') {
          sendRaw('\x03');
        } else if (key.ctrl && input === 'd') {
          sendRaw('\x04');
        } else if (input && !key.ctrl && !key.meta) {
          // Sanitize raw input before sending to PTY: strip SGR mouse sequences
          // and other stray control CSI sequences that may appear on stdin.
          const sanitize = (s: string) => {
            if (!s) return s;
            // Remove SGR mouse sequences like \x1B[<0;12;34M (also handle missing ESC)
            // eslint-disable-next-line no-control-regex
            let out = s.replace(/(?:\x1B)?\[<[0-9;]+[mM]/g, '');
            // Strip other CSI sequences that might leak through
            // eslint-disable-next-line no-control-regex
            out = out.replace(/\x1B\[[0-9;]*[A-Za-z]/g, '');
            return out;
          };

          const safe = sanitize(input);
          if (safe.length > 0) {
            sendRaw(safe);
          }
        }
        return;
      }

      // Allow Tab to bubble up to global handler for focus cycling
      if (key.tab) return;

      // Window switching logic - cycle through windows with specific ctrl keys
      // Note: We only reach here if activeDestination is 'llm' or 'editor'
      // because terminal modes return early above.
      if (isKey(input, key, activeKeybinds.layout.switchWindowLeft)) {
        switchWindow('prev');
        return;
      }
      if (isKey(input, key, activeKeybinds.layout.switchWindowRight)) {
        switchWindow('next');
        return;
      }

      if (chatState.inputMode !== 'menu') {
        // When not in menu mode, allow ESC to bubble to global handler
        if (key.escape) return;
        return;
      }

      // Menu mode handlers
      if (isKey(input, key, activeKeybinds.navigation.moveUp)) {
        navigateMenu('up');
      } else if (isKey(input, key, activeKeybinds.navigation.moveDown)) {
        navigateMenu('down');
      } else if (isKey(input, key, activeKeybinds.navigation.select)) {
        executeMenuOption();
      } else if (isKey(input, key, activeKeybinds.chat.cancel)) {
        // ESC in menu mode closes the menu
        setInputMode('text');
        setMenuState({ active: false });
      }
    },
    { isActive: hasFocus || chatState.inputMode === 'menu' || isTerminalActive }
  );

  // Border Color Logic
  let borderColor = theme.border.primary;
  if (hasFocus) borderColor = theme.border.active;
  if (isTerminalActive && hasFocus) borderColor = 'cyan';

  const totalMenuOptions = chatState.menuState.options.length;
  const menuPaddingTop = 0;
  const menuBorderRows = showBorder ? 2 : 0;
  const statusRows = statusMessage ? 1 : 0;
  const maxVisibleMenuOptions = Math.max(1, height - menuBorderRows - menuPaddingTop - statusRows);
  const menuWindowSize =
    totalMenuOptions === 0 ? 0 : Math.min(maxVisibleMenuOptions, totalMenuOptions);
  const menuStartIndex =
    totalMenuOptions === 0
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
  let placeholder = hasFocus
    ? 'Type a message... (Enter to send)'
    : 'Focus elsewhere... (Ctrl+Space to focus)';
  
  // Override placeholder if compressing
  if (contextState.compressing) {
    placeholder = 'Compressing context... Please wait.';
  } else if (activeDestination === 'terminal1') {
    placeholder = hasFocus ? 'Terminal 1 input (raw mode)' : 'Terminal 1 inactive...';
  } else if (activeDestination === 'terminal2') {
    placeholder = hasFocus ? 'Terminal 2 input (raw mode)' : 'Terminal 2 inactive...';
  } else if (activeDestination === 'editor') {
    placeholder = 'Editor input disabled...';
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
            disabled={inputMode !== 'line-buffered' || !hasFocus || contextState.compressing}
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
                <Text
                  key={option.id}
                  color={
                    option.disabled ? 'gray' : isSelected ? theme.text.accent : theme.text.secondary
                  }
                >
                  {prefix}
                  {numPrefix}
                  {option.label}
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
