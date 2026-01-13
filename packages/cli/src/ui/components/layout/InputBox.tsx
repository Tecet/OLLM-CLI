import React, { useState, useCallback, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import { useChat } from '../../../contexts/ChatContext.js';

export interface InputBoxProps {
  theme: {
    text: {
      primary: string;
      secondary: string;
      accent: string;
    };
    bg: {
      primary: string;
      secondary: string;
    };
  };
  keybinds: {
    send: string;
    newline: string;
    editPrevious: string;
  };
  disabled?: boolean;
}

export function InputBox({ theme, keybinds, disabled = false }: InputBoxProps) {
  const { state, sendMessage, setCurrentInput } = useChat();
  const [localInput, setLocalInput] = useState(state.currentInput);
  const [cursorPosition, setCursorPosition] = useState(0);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // Sync local input with context
  useEffect(() => {
    setLocalInput(state.currentInput);
    setCursorPosition(state.currentInput.length);
  }, [state.currentInput]);

  // Get user messages for history navigation
  const userMessages = state.messages.filter((msg) => msg.role === 'user');

  const handleSubmit = useCallback(async () => {
    if (localInput.trim() && !disabled) {
      await sendMessage(localInput);
      setLocalInput('');
      setCursorPosition(0);
      setHistoryIndex(-1);
    }
  }, [localInput, disabled, sendMessage]);

  const handleNewline = useCallback(() => {
    if (!disabled) {
      const newInput = localInput.slice(0, cursorPosition) + '\n' + localInput.slice(cursorPosition);
      setLocalInput(newInput);
      setCurrentInput(newInput);
      setCursorPosition(cursorPosition + 1);
    }
  }, [localInput, cursorPosition, disabled, setCurrentInput]);

  const handleEditPrevious = useCallback(() => {
    if (disabled || userMessages.length === 0) return;

    // If we're at the start of history or not in history mode, start from the most recent
    if (historyIndex === -1) {
      const lastMessage = userMessages[userMessages.length - 1];
      setLocalInput(lastMessage.content);
      setCurrentInput(lastMessage.content);
      setCursorPosition(lastMessage.content.length);
      setHistoryIndex(userMessages.length - 1);
    } else if (historyIndex > 0) {
      // Move to previous message
      const prevMessage = userMessages[historyIndex - 1];
      setLocalInput(prevMessage.content);
      setCurrentInput(prevMessage.content);
      setCursorPosition(prevMessage.content.length);
      setHistoryIndex(historyIndex - 1);
    }
  }, [disabled, userMessages, historyIndex, setCurrentInput]);

  useInput((input, key) => {
    if (disabled) return;

    // Handle Enter (send)
    if (key.return && !key.shift) {
      handleSubmit();
      return;
    }

    // Handle Shift+Enter (newline)
    if (key.return && key.shift) {
      handleNewline();
      return;
    }

    // Handle Up arrow (edit previous)
    if (key.upArrow && localInput === '' && cursorPosition === 0) {
      handleEditPrevious();
      return;
    }

    // Handle backspace
    if (key.backspace || key.delete) {
      if (cursorPosition > 0) {
        const newInput = localInput.slice(0, cursorPosition - 1) + localInput.slice(cursorPosition);
        setLocalInput(newInput);
        setCurrentInput(newInput);
        setCursorPosition(cursorPosition - 1);
        setHistoryIndex(-1); // Exit history mode
      }
      return;
    }

    // Handle left arrow
    if (key.leftArrow) {
      if (cursorPosition > 0) {
        setCursorPosition(cursorPosition - 1);
      }
      return;
    }

    // Handle right arrow
    if (key.rightArrow) {
      if (cursorPosition < localInput.length) {
        setCursorPosition(cursorPosition + 1);
      }
      return;
    }

    // Handle regular character input
    if (input && !key.ctrl && !key.meta) {
      const newInput = localInput.slice(0, cursorPosition) + input + localInput.slice(cursorPosition);
      setLocalInput(newInput);
      setCurrentInput(newInput);
      setCursorPosition(cursorPosition + input.length);
      setHistoryIndex(-1); // Exit history mode
    }
  });

  // Split input into lines for multi-line display
  const lines = localInput.split('\n');
  const currentLineIndex = localInput.slice(0, cursorPosition).split('\n').length - 1;
  const currentLineStart = localInput.slice(0, cursorPosition).lastIndexOf('\n') + 1;
  const cursorInLine = cursorPosition - currentLineStart;

  return (
    <Box
      flexDirection="column"
      borderStyle="single"
      borderColor={disabled ? theme.text.secondary : theme.text.accent}
      paddingX={1}
      paddingY={0}
    >
      {/* Input prompt */}
      <Box>
        <Text color={theme.text.accent} bold>
          {disabled ? '⏸ ' : '> '}
        </Text>
        <Text color={theme.text.secondary} dimColor={disabled}>
          {disabled ? 'Waiting for response...' : 'Type your message (Enter to send, Shift+Enter for newline)'}
        </Text>
      </Box>

      {/* Multi-line input display */}
      {lines.length > 0 && (
        <Box flexDirection="column" marginTop={0}>
          {lines.map((line, index) => {
            const isCurrentLine = index === currentLineIndex;
            const displayLine = line || ' '; // Show space for empty lines

            return (
              <Box key={index}>
                <Text color={theme.text.primary}>
                  {isCurrentLine && cursorInLine <= line.length ? (
                    <>
                      {displayLine.slice(0, cursorInLine)}
                      <Text inverse>{displayLine[cursorInLine] || ' '}</Text>
                      {displayLine.slice(cursorInLine + 1)}
                    </>
                  ) : (
                    displayLine
                  )}
                </Text>
              </Box>
            );
          })}
        </Box>
      )}

      {/* History indicator */}
      {historyIndex >= 0 && (
        <Box marginTop={0}>
          <Text color={theme.text.secondary} dimColor>
            [Editing message {userMessages.length - historyIndex} of {userMessages.length}]
          </Text>
        </Box>
      )}
    </Box>
  );
}
