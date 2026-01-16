import React, { useState, useCallback, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';

export interface InputBoxProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void | Promise<void>;
  userMessages: string[];
  placeholder?: string;
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
  disabled?: boolean;
}

export const InputBox = React.memo(function InputBox({
  value,
  onChange,
  onSubmit,
  userMessages,
  placeholder,
  theme,
  disabled = false,
}: InputBoxProps) {
  const [localInput, setLocalInput] = useState(value);
  const [cursorPosition, setCursorPosition] = useState(0);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // Sync local input with context
  useEffect(() => {
    setLocalInput(value);
    setCursorPosition(value.length);
  }, [value]);

  const handleSubmit = useCallback(async () => {
    if (localInput.trim() && !disabled) {
      await onSubmit(localInput);
      setLocalInput('');
      onChange('');
      setCursorPosition(0);
      setHistoryIndex(-1);
    }
  }, [localInput, disabled, onSubmit, onChange]);

  const handleNewline = useCallback(() => {
    if (!disabled) {
      const newInput = localInput.slice(0, cursorPosition) + '\n' + localInput.slice(cursorPosition);
      setLocalInput(newInput);
      onChange(newInput);
      setCursorPosition(cursorPosition + 1);
    }
  }, [localInput, cursorPosition, disabled, onChange]);

  const handleEditPrevious = useCallback(() => {
    if (disabled || userMessages.length === 0) return;

    // If we're at the start of history or not in history mode, start from the most recent
    if (historyIndex === -1) {
      const lastMessage = userMessages[userMessages.length - 1];
      setLocalInput(lastMessage);
      onChange(lastMessage);
      setCursorPosition(lastMessage.length);
      setHistoryIndex(userMessages.length - 1);
    } else if (historyIndex > 0) {
      // Move to previous message
      const prevMessage = userMessages[historyIndex - 1];
      setLocalInput(prevMessage);
      onChange(prevMessage);
      setCursorPosition(prevMessage.length);
      setHistoryIndex(historyIndex - 1);
    }
  }, [disabled, userMessages, historyIndex, onChange]);

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
        onChange(newInput);
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
      onChange(newInput);
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
      paddingX={1}
      paddingY={0}
      width="100%"
      overflow="hidden"
    >
      {/* History indicator - always reserve space to prevent layout shift */}
      <Box height={1}>
        <Text color={theme.text.secondary} dimColor>
          {historyIndex >= 0 
            ? `[Editing message ${userMessages.length - historyIndex} of ${userMessages.length}]`
            : ' '}
        </Text>
      </Box>

      {/* Input prompt - static, no animations */}
      <Box height={1}>
        <Text color={theme.text.accent} bold>{'> '}</Text>
        <Text color={theme.text.secondary} dimColor={disabled}>
          {disabled 
            ? 'Waiting for response'
            : (placeholder || 'Type your message (Enter to send, Shift+Enter for newline)')
          }
        </Text>
      </Box>

      {/* Multi-line input display */}
      <Box flexDirection="column" flexGrow={1}>
        {lines.map((line, index) => {
          const isCurrentLine = index === currentLineIndex;
          const displayLine = line || ' '; // Show space for empty lines

          return (
            <Box key={index} height={1}>
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
    </Box>
  );
});

InputBox.displayName = 'InputBox';
