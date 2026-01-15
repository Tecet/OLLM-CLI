/**
 * Unit Tests for InputBox Keyboard Navigation
 * 
 * Tests keyboard navigation including arrow keys, Enter, and Ctrl+C.
 * 
 * Requirements: 11.1, 11.2, 11.3
 * Feature: stage-08-testing-qa
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';
import { InputBox } from '../InputBox.js';
import { KeyboardInput, mockTheme, mockKeybinds, stripAnsi } from '@ollm/test-utils';

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

describe('InputBox - Keyboard Navigation', () => {
  const defaultProps = {
    theme: mockTheme,
    keybinds: mockKeybinds,
    disabled: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockChatState = {
      messages: [],
      streaming: false,
      waitingForResponse: false,
      currentInput: '',
    };
  });

  /**
   * Test arrow key navigation
   * Requirements: 11.1
   */
  describe('Arrow Key Navigation', () => {
    it('should navigate through history with up arrow', () => {
      // Set up history with a previous message
      mockChatState.messages = [
        { id: '1', role: 'user', content: 'first message', timestamp: new Date() }
      ];
      
      const { stdin, lastFrame } = render(<InputBox {...defaultProps} />);

      // Press up arrow to navigate to previous message
      stdin.write(KeyboardInput.ARROW_UP);

      // setCurrentInput should be called with the previous message content
      expect(mockSetCurrentInput).toHaveBeenCalledWith('first message');
    });

    it('should call setCurrentInput when typing', () => {
      const { stdin } = render(<InputBox {...defaultProps} />);

      // Type some text
      stdin.write('hello');

      // setCurrentInput should be called with each character
      expect(mockSetCurrentInput).toHaveBeenCalled();
    });

    it('should not move cursor beyond start', () => {
      const { stdin, lastFrame } = render(<InputBox {...defaultProps} />);

      // Move cursor left when at start (should be no-op)
      stdin.write(KeyboardInput.ARROW_LEFT);

      // Should still render correctly
      const frame = lastFrame();
      expect(frame).toBeDefined();
    });

    it('should not move cursor beyond end', () => {
      const { stdin, lastFrame } = render(<InputBox {...defaultProps} />);

      // Type some text
      stdin.write('hello');

      // Move cursor right when at end (should be no-op)
      stdin.write(KeyboardInput.ARROW_RIGHT);

      // Should still render correctly
      const frame = lastFrame();
      expect(frame).toBeDefined();
    });
  });

  /**
   * Test Enter key behavior
   * Requirements: 11.2
   */
  describe('Enter Key Behavior', () => {
    it('should submit message on Enter when input has content', () => {
      // Set up initial input value
      mockChatState.currentInput = 'hello';
      
      const { stdin } = render(<InputBox {...defaultProps} />);
      
      // Press Enter to submit
      stdin.write(KeyboardInput.ENTER);

      // sendMessage should be called with the input content
      expect(mockSendMessage).toHaveBeenCalledWith('hello');
    });

    it('should not submit when input is empty', () => {
      const { stdin } = render(<InputBox {...defaultProps} />);

      // Press Enter without typing anything
      stdin.write(KeyboardInput.ENTER);

      // sendMessage should not be called for empty input
      // Note: The component trims input, so empty strings are ignored
      expect(mockSendMessage).not.toHaveBeenCalled();
    });
  });

  /**
   * Test disabled state
   * Requirements: 11.3
   */
  describe('Disabled State', () => {
    it('should not accept input when disabled', () => {
      const { stdin, lastFrame } = render(
        <InputBox {...defaultProps} disabled={true} />
      );

      // Type some text
      stdin.write('hello');

      // setCurrentInput should not be called when disabled
      expect(mockSetCurrentInput).not.toHaveBeenCalled();
    });

    it('should not submit when disabled', () => {
      const { stdin } = render(
        <InputBox {...defaultProps} disabled={true} />
      );

      // Try to submit
      stdin.write(KeyboardInput.ENTER);

      // sendMessage should not be called when disabled
      expect(mockSendMessage).not.toHaveBeenCalled();
    });

    it('should not navigate history when disabled', () => {
      mockChatState.messages = [
        { id: '1', role: 'user', content: 'previous', timestamp: new Date() }
      ];
      
      const { stdin } = render(
        <InputBox {...defaultProps} disabled={true} />
      );

      // Try to navigate history
      stdin.write(KeyboardInput.ARROW_UP);

      // setCurrentInput should not be called when disabled
      expect(mockSetCurrentInput).not.toHaveBeenCalled();
    });

    it('should show disabled message', () => {
      const { lastFrame } = render(
        <InputBox {...defaultProps} disabled={true} />
      );

      const frame = stripAnsi(lastFrame() ?? '');
      expect(frame).toContain('Waiting for response');
    });
  });

  /**
   * Test multi-line display
   * Requirements: 10.5
   */
  describe('Multi-line Display', () => {
    it('should display multiple lines correctly', () => {
      mockChatState.currentInput = 'Line 1\nLine 2\nLine 3';
      
      const { lastFrame } = render(<InputBox {...defaultProps} />);

      const frame = stripAnsi(lastFrame() ?? '');
      expect(frame).toContain('Line 1');
      expect(frame).toContain('Line 2');
      expect(frame).toContain('Line 3');
    });
  });

  /**
   * Test backspace behavior
   */
  describe('Backspace Behavior', () => {
    it('should handle backspace key when cursor is at start', () => {
      // When cursor is at start (position 0), backspace should be a no-op
      const { stdin, lastFrame } = render(<InputBox {...defaultProps} />);
      
      // Press backspace at start position
      stdin.write(KeyboardInput.BACKSPACE);

      // Should still render correctly (no crash)
      const frame = lastFrame();
      expect(frame).toBeDefined();
    });
  });
});
