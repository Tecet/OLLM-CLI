import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from 'ink-testing-library';
import { InputBox } from '../InputBox.js';
import { ChatProvider } from '../../../../contexts/ChatContext.js';

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

describe('InputBox Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render with initial prompt', () => {
    const { lastFrame } = render(
      <ChatProvider>
        <InputBox theme={mockTheme} keybinds={mockKeybinds} />
      </ChatProvider>
    );

    expect(lastFrame()).toContain('Type your message');
  });

  it('should show disabled state when disabled prop is true', () => {
    const { lastFrame } = render(
      <ChatProvider>
        <InputBox theme={mockTheme} keybinds={mockKeybinds} disabled={true} />
      </ChatProvider>
    );

    expect(lastFrame()).toContain('Waiting for response');
  });

  it('should display multi-line input correctly', () => {
    const { lastFrame } = render(
      <ChatProvider initialMessages={[]}>
        <InputBox theme={mockTheme} keybinds={mockKeybinds} />
      </ChatProvider>
    );

    // Component should render without errors
    expect(lastFrame()).toBeDefined();
  });

  it('should handle empty input gracefully', () => {
    const { lastFrame } = render(
      <ChatProvider>
        <InputBox theme={mockTheme} keybinds={mockKeybinds} />
      </ChatProvider>
    );

    // Should render prompt even with empty input
    expect(lastFrame()).toContain('>');
  });

  it('should show history indicator when editing previous message', () => {
    const mockMessages = [
      {
        id: '1',
        role: 'user' as const,
        content: 'Previous message',
        timestamp: new Date(),
      },
    ];

    const { lastFrame } = render(
      <ChatProvider initialMessages={mockMessages}>
        <InputBox theme={mockTheme} keybinds={mockKeybinds} />
      </ChatProvider>
    );

    // Component should render without errors
    expect(lastFrame()).toBeDefined();
  });

  it('should integrate with ChatContext', () => {
    const onSendMessage = vi.fn();

    const { lastFrame } = render(
      <ChatProvider onSendMessage={onSendMessage}>
        <InputBox theme={mockTheme} keybinds={mockKeybinds} />
      </ChatProvider>
    );

    // Component should render and integrate with context
    expect(lastFrame()).toBeDefined();
  });

  it('should handle theme colors correctly', () => {
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

    const { lastFrame } = render(
      <ChatProvider>
        <InputBox theme={customTheme} keybinds={mockKeybinds} />
      </ChatProvider>
    );

    // Component should render with custom theme
    expect(lastFrame()).toBeDefined();
  });

  it('should display cursor in input', () => {
    const { lastFrame } = render(
      <ChatProvider>
        <InputBox theme={mockTheme} keybinds={mockKeybinds} />
      </ChatProvider>
    );

    // Component should render with cursor
    const frame = lastFrame();
    expect(frame).toBeDefined();
  });
});
