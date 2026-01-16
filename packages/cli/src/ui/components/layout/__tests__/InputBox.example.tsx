/**
 * InputBox Component Example
 * 
 * This file demonstrates how to use the InputBox component in a real application.
 */

import React, { useState } from 'react';
import { Box, Text } from 'ink';
import { InputBox } from '../InputBox.js';
import { mockTheme } from '../../__tests__/testUtils.js';

/**
 * Example 1: Basic Usage
 */
export function BasicInputBoxExample() {
  const [value, setValue] = useState('');
  const handleSubmit = (val: string) => {
    console.log('Submitted:', val);
    setValue('');
  };

  return (
    <Box flexDirection="column" height={10}>
      <Text>Basic InputBox Example</Text>
      <InputBox
        value={value}
        onChange={setValue}
        onSubmit={handleSubmit}
        userMessages={[]}
        theme={mockTheme}
      />
    </Box>
  );
}

/**
 * Example 2: With Message History
 */
export function InputBoxWithHistoryExample() {
  const [value, setValue] = useState('');
  const userMessages = ['Hello, how are you?', 'Can you help me with a task?'];
  
  const handleSubmit = (val: string) => {
    console.log('Submitted:', val);
    setValue('');
  };

  return (
    <Box flexDirection="column" height={10}>
      <Text>InputBox with History Example</Text>
      <Text dimColor>Press Up arrow to edit previous messages</Text>
      <InputBox
        value={value}
        onChange={setValue}
        onSubmit={handleSubmit}
        userMessages={userMessages}
        theme={mockTheme}
      />
    </Box>
  );
}

/**
 * Example 3: Disabled State
 */
export function DisabledInputBoxExample() {
  return (
    <Box flexDirection="column" height={10}>
      <Text>Disabled InputBox Example</Text>
      <Text dimColor>Input is disabled while waiting for response</Text>
      <InputBox
        value=""
        onChange={() => {}}
        onSubmit={() => {}}
        userMessages={[]}
        theme={mockTheme}
        disabled={true}
      />
    </Box>
  );
}
