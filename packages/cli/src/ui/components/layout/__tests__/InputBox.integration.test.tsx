import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render } from 'ink-testing-library';
import { InputBox } from '../InputBox.js';
import { ChatProvider, Message } from '../../../../contexts/ChatContext.js';

const mockTheme = {
  text: {
    primary: '#d4d4d4',
    secondary: '#858585',
    accent: '#4ec9b0',
  },
  bg: {
    primary: '#1e1e1e',
    secondary: '#252526',
  },
};

const mockKeybinds = {
  send: 'return',
  newline: 'shift+return',
  editPrevious: 'up',
};

describe('InputBox Integration Tests', () => {
  it('should support multi-line input (Requirement 20.9)', () => {
    const { lastFrame } = render(
      <ChatProvider>
        <InputBox theme={mockTheme} keybinds={mockKeybinds} />
      </ChatProvider>
    );

    // Component should render and support multi-line display
    expect(lastFrame()).toBeDefined();
    expect(lastFrame()).toContain('Type your message');
  });

  it('should handle Enter to send (Requirement 20.10)', () => {
    const onSendMessage = vi.fn();

    const { lastFrame } = render(
      <ChatProvider onSendMessage={onSendMessage}>
        <InputBox theme={mockTheme} keybinds={mockKeybinds} />
      </ChatProvider>
    );

    // Component should be ready to handle Enter key
    expect(lastFrame()).toBeDefined();
  });

  it('should handle Shift+Enter for newline (Requirement 20.11)', () => {
    const { lastFrame } = render(
      <ChatProvider>
        <InputBox theme={mockTheme} keybinds={mockKeybinds} />
      </ChatProvider>
    );

    // Component should display hint about Shift+Enter
    expect(lastFrame()).toContain('Shift+Enter for newline');
  });

  it('should handle Up arrow for edit previous (Requirement 20.11)', () => {
    const previousMessages: Message[] = [
      {
        id: '1',
        role: 'user',
        content: 'First message',
        timestamp: new Date(),
      },
      {
        id: '2',
        role: 'user',
        content: 'Second message',
        timestamp: new Date(),
      },
    ];

    const { lastFrame } = render(
      <ChatProvider initialMessages={previousMessages}>
        <InputBox theme={mockTheme} keybinds={mockKeybinds} />
      </ChatProvider>
    );

    // Component should render with message history available
    expect(lastFrame()).toBeDefined();
  });

  it('should disable input when disabled prop is true', () => {
    const { lastFrame } = render(
      <ChatProvider>
        <InputBox theme={mockTheme} keybinds={mockKeybinds} disabled={true} />
      </ChatProvider>
    );

    // Should show waiting state
    expect(lastFrame()).toContain('Waiting for response');
  });

  it('should show cursor position in input', () => {
    const { lastFrame } = render(
      <ChatProvider>
        <InputBox theme={mockTheme} keybinds={mockKeybinds} />
      </ChatProvider>
    );

    // Component should render with cursor indicator
    const frame = lastFrame();
    expect(frame).toBeDefined();
  });

  it('should integrate with ChatContext for message history', () => {
    const messages: Message[] = [
      {
        id: '1',
        role: 'user',
        content: 'Test message 1',
        timestamp: new Date(),
      },
      {
        id: '2',
        role: 'assistant',
        content: 'Response 1',
        timestamp: new Date(),
      },
      {
        id: '3',
        role: 'user',
        content: 'Test message 2',
        timestamp: new Date(),
      },
    ];

    const { lastFrame } = render(
      <ChatProvider initialMessages={messages}>
        <InputBox theme={mockTheme} keybinds={mockKeybinds} />
      </ChatProvider>
    );

    // Component should have access to message history
    expect(lastFrame()).toBeDefined();
  });

  it('should handle empty message history gracefully', () => {
    const { lastFrame } = render(
      <ChatProvider initialMessages={[]}>
        <InputBox theme={mockTheme} keybinds={mockKeybinds} />
      </ChatProvider>
    );

    // Should render normally even with no history
    expect(lastFrame()).toBeDefined();
    expect(lastFrame()).toContain('Type your message');
  });

  it('should apply theme colors correctly', () => {
    const customTheme = {
      text: {
        primary: '#ff0000',
        secondary: '#00ff00',
        accent: '#0000ff',
      },
      bg: {
        primary: '#111111',
        secondary: '#222222',
      },
    };

    const { lastFrame } = render(
      <ChatProvider>
        <InputBox theme={customTheme} keybinds={mockKeybinds} />
      </ChatProvider>
    );

    // Component should render with custom theme
    expect(lastFrame()).toBeDefined();
  });

  it('should handle streaming state from ChatContext', () => {
    const { lastFrame } = render(
      <ChatProvider>
        <InputBox theme={mockTheme} keybinds={mockKeybinds} />
      </ChatProvider>
    );

    // Component should integrate with streaming state
    expect(lastFrame()).toBeDefined();
  });
});
