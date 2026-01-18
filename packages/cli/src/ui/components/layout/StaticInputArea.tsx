import React from 'react';
import { Box, Text } from 'ink';
import { InputBox } from './InputBox.js';
import { StreamingIndicator } from '../chat/StreamingIndicator.js';
import type { Theme } from '../../../config/types.js';

export interface StaticInputAreaProps {
  inputValue: string;
  onInputChange: (value: string) => void;
  onInputSubmit: (value: string) => void | Promise<void>;
  userMessages: string[];
  statusText?: string;
  streaming?: boolean;
  waitingForResponse?: boolean;
  theme: Theme;
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
  // Determine content for status area
  const renderStatus = () => {
    if (statusText) {
      return <Text color={theme.text.secondary}>{statusText}</Text>;
    }
    if (streaming) {
      return (
        <StreamingIndicator 
          text="Assistant is typing..." 
          spinnerType="dots"
          color={theme.text.secondary}
        />
      );
    }
    if (waitingForResponse) {
      return (
        <StreamingIndicator 
          text="Waiting for response..." 
          spinnerType="dots"
          color={theme.text.secondary}
        />
      );
    }
    return <Text>{' '}</Text>;
  };

  return (
    <Box flexDirection="column" width="100%">
      {/* Fixed height status area */}
      <Box height={1} paddingX={1}>
        {renderStatus()}
      </Box>
      {/* Input box with border - static container */}
      <Box height={6} borderStyle="single" borderColor={theme.text.secondary}>
        <InputBox
          value={inputValue}
          onChange={onInputChange}
          onSubmit={onInputSubmit}
          userMessages={userMessages}
          placeholder={'Type a message... (Enter to send, Shift+Enter for newline)'}
          disabled={streaming || waitingForResponse}
          theme={theme}
        />
      </Box>
    </Box>
  );
}
