/**
 * InputBox Component Example
 * 
 * This file demonstrates how to use the InputBox component in a real application.
 * It shows all the key features:
 * - Multi-line input support
 * - Enter to send messages
 * - Shift+Enter for newlines
 * - Up arrow to edit previous messages
 * - Integration with ChatContext
 * - Theme customization
 */

import React from 'react';
import { Box, Text } from 'ink';
import { InputBox } from '../InputBox.js';
import { ChatProvider } from '../../../../contexts/ChatContext.js';
import { defaultDarkTheme, defaultKeybinds } from '../../../uiSettings.js';

/**
 * Example 1: Basic Usage
 * 
 * The simplest way to use InputBox with default settings.
 */
export function BasicInputBoxExample() {
  return (
    <ChatProvider>
      <Box flexDirection="column" height={10}>
        <Text>Basic InputBox Example</Text>
        <InputBox
          theme={{
            text: defaultDarkTheme.text,
            bg: defaultDarkTheme.bg,
          }}
          keybinds={{
            send: defaultKeybinds.send,
            newline: defaultKeybinds.newline,
            editPrevious: defaultKeybinds.editPrevious,
          }}
        />
      </Box>
    </ChatProvider>
  );
}

/**
 * Example 2: With Message History
 * 
 * Shows how InputBox works with existing chat history.
 * Users can press Up arrow to edit previous messages.
 */
export function InputBoxWithHistoryExample() {
  const initialMessages = [
    {
      id: '1',
      role: 'user' as const,
      content: 'Hello, how are you?',
      timestamp: new Date(),
    },
    {
      id: '2',
      role: 'assistant' as const,
      content: 'I am doing well, thank you!',
      timestamp: new Date(),
    },
    {
      id: '3',
      role: 'user' as const,
      content: 'Can you help me with a task?',
      timestamp: new Date(),
    },
  ];

  return (
    <ChatProvider initialMessages={initialMessages}>
      <Box flexDirection="column" height={10}>
        <Text>InputBox with History Example</Text>
        <Text dimColor>Press Up arrow to edit previous messages</Text>
        <InputBox
          theme={{
            text: defaultDarkTheme.text,
            bg: defaultDarkTheme.bg,
          }}
          keybinds={{
            send: defaultKeybinds.send,
            newline: defaultKeybinds.newline,
            editPrevious: defaultKeybinds.editPrevious,
          }}
        />
      </Box>
    </ChatProvider>
  );
}

/**
 * Example 3: Disabled State
 * 
 * Shows how InputBox appears when waiting for a response.
 */
export function DisabledInputBoxExample() {
  return (
    <ChatProvider>
      <Box flexDirection="column" height={10}>
        <Text>Disabled InputBox Example</Text>
        <Text dimColor>Input is disabled while waiting for response</Text>
        <InputBox
          theme={{
            text: defaultDarkTheme.text,
            bg: defaultDarkTheme.bg,
          }}
          keybinds={{
            send: defaultKeybinds.send,
            newline: defaultKeybinds.newline,
            editPrevious: defaultKeybinds.editPrevious,
          }}
          disabled={true}
        />
      </Box>
    </ChatProvider>
  );
}

/**
 * Example 4: Custom Theme
 * 
 * Shows how to customize the InputBox appearance with a custom theme.
 */
export function CustomThemeInputBoxExample() {
  const customTheme = {
    text: {
      primary: '#ffffff',
      secondary: '#888888',
      accent: '#00ff00',
    },
    bg: {
      primary: '#000000',
      secondary: '#111111',
    },
  };

  return (
    <ChatProvider>
      <Box flexDirection="column" height={10}>
        <Text>Custom Theme InputBox Example</Text>
        <InputBox
          theme={customTheme}
          keybinds={{
            send: defaultKeybinds.send,
            newline: defaultKeybinds.newline,
            editPrevious: defaultKeybinds.editPrevious,
          }}
        />
      </Box>
    </ChatProvider>
  );
}

/**
 * Example 5: With Message Handler
 * 
 * Shows how to handle messages sent from InputBox.
 */
export function InputBoxWithHandlerExample() {
  const handleSendMessage = async (content: string) => {
    console.log('Message sent:', content);
    // In a real app, this would send the message to the LLM
    // and handle the response
  };

  return (
    <ChatProvider onSendMessage={handleSendMessage}>
      <Box flexDirection="column" height={10}>
        <Text>InputBox with Handler Example</Text>
        <Text dimColor>Messages will be logged to console</Text>
        <InputBox
          theme={{
            text: defaultDarkTheme.text,
            bg: defaultDarkTheme.bg,
          }}
          keybinds={{
            send: defaultKeybinds.send,
            newline: defaultKeybinds.newline,
            editPrevious: defaultKeybinds.editPrevious,
          }}
        />
      </Box>
    </ChatProvider>
  );
}

/**
 * Key Features Demonstrated:
 * 
 * 1. Multi-line Input Support (Requirement 20.9)
 *    - Input automatically displays multiple lines
 *    - Cursor position is tracked across lines
 *    - Each line is rendered separately
 * 
 * 2. Enter to Send (Requirement 20.10)
 *    - Pressing Enter sends the message
 *    - Input is cleared after sending
 *    - Message is added to chat history
 * 
 * 3. Shift+Enter for Newline (Requirement 20.11)
 *    - Pressing Shift+Enter inserts a newline
 *    - Cursor moves to the next line
 *    - Message is not sent
 * 
 * 4. Up Arrow for Edit Previous (Requirement 20.11)
 *    - Pressing Up arrow loads the previous user message
 *    - Can navigate through message history
 *    - Shows history indicator
 * 
 * 5. Integration with ChatContext
 *    - Reads current input from context
 *    - Updates context when input changes
 *    - Accesses message history for editing
 *    - Calls sendMessage when Enter is pressed
 * 
 * 6. Theme Support
 *    - Accepts theme prop for colors
 *    - Applies colors to all UI elements
 *    - Supports custom themes
 * 
 * 7. Disabled State
 *    - Shows waiting message when disabled
 *    - Prevents input when disabled
 *    - Changes border color to indicate state
 */
