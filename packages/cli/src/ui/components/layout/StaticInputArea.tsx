import React from 'react';
import { Box, Text } from 'ink';
import { InputBox } from './InputBox.js';

export interface StaticInputAreaProps {
  inputValue: string;
  onInputChange: (value: string) => void;
  onInputSubmit: (value: string) => void | Promise<void>;
  userMessages: string[];
  statusText?: string;
  streaming?: boolean;
  waitingForResponse?: boolean;
  theme: any;
}

export function StaticInputArea({
  inputValue,
  onInputChange,
  onInputSubmit,
  userMessages,
  statusText,
  streaming,
  waitingForResponse,
  theme,
}: StaticInputAreaProps) {
  return (
    <Box flexDirection="column" width="100%" borderStyle="single" borderColor={theme.text.secondary}>
      {/* Status line (always 1 row, static) */}
      <Box height={1}>
        <Text color={theme.text.secondary}>
          {statusText || (streaming ? '⠋ Assistant is typing...' : waitingForResponse ? 'Waiting for response...' : ' ')}
        </Text>
      </Box>
      {/* Input box (always static, never moves) */}
      <Box height={6}>
        <InputBox
          value={inputValue}
          onChange={onInputChange}
          onSubmit={onInputSubmit}
          userMessages={userMessages}
          placeholder={'> Type a message... (Enter to send, Shift+Enter for newline)'}
          disabled={streaming || waitingForResponse}
          theme={theme}
        />
      </Box>
    </Box>
  );
}
