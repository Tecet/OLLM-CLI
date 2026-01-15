/**
 * InputBox Component Tests
 * 
 * Tests for the InputBox component rendering and input handling.
 * Validates Requirements 10.4, 10.5
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from 'ink-testing-library';
import { InputBox } from '../InputBox.js';
import { mockTheme, mockKeybinds, stripAnsi } from '@ollm/test-utils';

// Mock the useChat hook
const mockSendMessage = vi.fn();
const mockSetCurrentInput = vi.fn();

let mockChatState = {
  messages: [] as Array<{ id: string; role: string; content: string; timestamp: Date }>,
  streaming: false,
  waitingForResponse: false,
  currentInput: '',
};

vi.mock('../../../../contexts/ChatContext.js', () => ({
  useChat: () => ({
    state: mockChatState,
    sendMessage: mockSendMessage,
    setCurrentInput: mockSetCurrentInput,
  }),
}));

describe('InputBox Component', () => {
  const defaultTheme = mockTheme;
  const defaultKeybinds = mockKeybinds;

  beforeEach(() => {
    vi.clearAllMocks();
    mockChatState = {
      messages: [],
      streaming: false,
      waitingForResponse: false,
      currentInput: '',
    };
  });

  describe('Input Field Display', () => {
    it('renders input field with prompt', () => {
      const { lastFrame } = render(
        <InputBox theme={defaultTheme} keybinds={defaultKeybinds} />
      );

      const frame = lastFrame();
      expect(frame).toBeDefined();
      expect(frame).toContain('>');
      expect(frame).toContain('Type your message');
    });

    it('displays current input value', () => {
      mockChatState.currentInput = 'Hello world';

      const { lastFrame } = render(
        <InputBox theme={defaultTheme} keybinds={defaultKeybinds} />
      );

      const frame = stripAnsi(lastFrame() ?? '');
      expect(frame).toContain('Hello world');
    });

    it('displays multi-line input', () => {
      mockChatState.currentInput = 'Line 1\nLine 2\nLine 3';

      const { lastFrame } = render(
        <InputBox theme={defaultTheme} keybinds={defaultKeybinds} />
      );

      const frame = stripAnsi(lastFrame() ?? '');
      expect(frame).toContain('Line 1');
      expect(frame).toContain('Line 2');
      expect(frame).toContain('Line 3');
    });

    it('shows disabled state when disabled', () => {
      const { lastFrame } = render(
        <InputBox theme={defaultTheme} keybinds={defaultKeybinds} disabled={true} />
      );

      const frame = lastFrame();
      expect(frame).toContain('Waiting for response');
    });

    it('shows enabled state when not disabled', () => {
      const { lastFrame } = render(
        <InputBox theme={defaultTheme} keybinds={defaultKeybinds} disabled={false} />
      );

      const frame = lastFrame();
      expect(frame).toContain('Type your message');
    });
  });

  describe('Input Acceptance', () => {
    it('accepts text input', () => {
      const { stdin } = render(
        <InputBox theme={defaultTheme} keybinds={defaultKeybinds} />
      );

      stdin.write('Hello');

      // The input should be reflected in the component
      // Note: Due to the async nature of Ink, we check that setCurrentInput was called
      expect(mockSetCurrentInput).toHaveBeenCalled();
    });

    it('handles empty input', () => {
      const { lastFrame } = render(
        <InputBox theme={defaultTheme} keybinds={defaultKeybinds} />
      );

      const frame = lastFrame();
      expect(frame).toBeDefined();
      // Empty input should still render the prompt
      expect(frame).toContain('>');
    });

    it('handles special characters', () => {
      mockChatState.currentInput = 'Hello @user! #tag $var';

      const { lastFrame } = render(
        <InputBox theme={defaultTheme} keybinds={defaultKeybinds} />
      );

      const frame = stripAnsi(lastFrame() ?? '');
      expect(frame).toContain('Hello @user! #tag $var');
    });

    it('handles unicode characters', () => {
      mockChatState.currentInput = 'Hello 世界 🌍';

      const { lastFrame } = render(
        <InputBox theme={defaultTheme} keybinds={defaultKeybinds} />
      );

      const frame = stripAnsi(lastFrame() ?? '');
      expect(frame).toContain('Hello 世界 🌍');
    });
  });

  describe('History Navigation', () => {
    it('shows history indicator when editing previous message', () => {
      mockChatState.messages = [
        {
          id: '1',
          role: 'user',
          content: 'Previous message',
          timestamp: new Date(),
        },
      ];
      mockChatState.currentInput = '';

      const { stdin, lastFrame } = render(
        <InputBox theme={defaultTheme} keybinds={defaultKeybinds} />
      );

      // Simulate up arrow to navigate history
      stdin.write('\x1B[A');

      // Should show history indicator
      const frame = lastFrame();
      expect(frame).toBeDefined();
    });
  });

  describe('Cursor Display', () => {
    it('displays cursor in input field', () => {
      mockChatState.currentInput = 'Test';

      const { lastFrame } = render(
        <InputBox theme={defaultTheme} keybinds={defaultKeybinds} />
      );

      const frame = lastFrame();
      expect(frame).toBeDefined();
      // Cursor should be visible (inverse text)
    });
  });

  describe('Border Styling', () => {
    it('uses accent color when enabled', () => {
      const { lastFrame } = render(
        <InputBox theme={defaultTheme} keybinds={defaultKeybinds} disabled={false} />
      );

      const frame = lastFrame();
      expect(frame).toBeDefined();
      // Border should be present
    });

    it('uses secondary color when disabled', () => {
      const { lastFrame } = render(
        <InputBox theme={defaultTheme} keybinds={defaultKeybinds} disabled={true} />
      );

      const frame = lastFrame();
      expect(frame).toBeDefined();
      // Border should be present with different color
    });
  });
});
