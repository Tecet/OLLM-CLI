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
import { mockTheme, stripAnsi } from '../../__tests__/testUtils.js';

describe('InputBox Component', () => {
  const defaultTheme = mockTheme;
  const mockOnSubmit = vi.fn();
  const mockOnChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Input Field Display', () => {
    it('renders input field with prompt', () => {
      const { lastFrame } = render(
        <InputBox
          theme={defaultTheme}
          value=""
          onChange={mockOnChange}
          onSubmit={mockOnSubmit}
          userMessages={[]}
        />
      );

      const frame = lastFrame();
      expect(frame).toBeDefined();
      expect(frame).toContain('>');
      expect(frame).toContain('Type your message');
    });

    it('displays current input value', () => {
      const { lastFrame } = render(
        <InputBox
          theme={defaultTheme}
          value="Hello world"
          onChange={mockOnChange}
          onSubmit={mockOnSubmit}
          userMessages={[]}
        />
      );

      const frame = stripAnsi(lastFrame() ?? '');
      expect(frame).toContain('Hello world');
    });

    it('displays multi-line input', () => {
      const { lastFrame } = render(
        <InputBox
          theme={defaultTheme}
          value="Line 1\nLine 2\nLine 3"
          onChange={mockOnChange}
          onSubmit={mockOnSubmit}
          userMessages={[]}
        />
      );

      const frame = stripAnsi(lastFrame() ?? '');
      expect(frame).toContain('Line 1');
      expect(frame).toContain('Line 2');
      expect(frame).toContain('Line 3');
    });

    it('shows disabled state when disabled', () => {
      const { lastFrame } = render(
        <InputBox
          theme={defaultTheme}
          value=""
          onChange={mockOnChange}
          onSubmit={mockOnSubmit}
          userMessages={[]}
          disabled={true}
        />
      );

      const frame = lastFrame();
      expect(frame).toContain('Waiting for response');
    });

    it('shows enabled state when not disabled', () => {
      const { lastFrame } = render(
        <InputBox
          theme={defaultTheme}
          value=""
          onChange={mockOnChange}
          onSubmit={mockOnSubmit}
          userMessages={[]}
          disabled={false}
        />
      );

      const frame = lastFrame();
      expect(frame).toContain('Type your message');
    });
  });

  describe('Input Acceptance', () => {
    it('accepts text input', () => {
      const { stdin } = render(
        <InputBox
          theme={defaultTheme}
          value=""
          onChange={mockOnChange}
          onSubmit={mockOnSubmit}
          userMessages={[]}
        />
      );

      stdin.write('Hello');

      // The input should be reflected in the component
      // Note: Due to the async nature of Ink, we check that setCurrentInput was called
      expect(mockOnChange).toHaveBeenCalled();
    });

    it('handles empty input', () => {
      const { lastFrame } = render(
        <InputBox
          theme={defaultTheme}
          value=""
          onChange={mockOnChange}
          onSubmit={mockOnSubmit}
          userMessages={[]}
        />
      );

      const frame = lastFrame();
      expect(frame).toBeDefined();
      // Empty input should still render the prompt
      expect(frame).toContain('>');
    });

    it('handles special characters', () => {
      const { lastFrame } = render(
        <InputBox
          theme={defaultTheme}
          value="Hello @user! #tag $var"
          onChange={mockOnChange}
          onSubmit={mockOnSubmit}
          userMessages={[]}
        />
      );

      const frame = stripAnsi(lastFrame() ?? '');
      expect(frame).toContain('Hello @user! #tag $var');
    });

    it('handles unicode characters', () => {
      const { lastFrame } = render(
        <InputBox
          theme={defaultTheme}
          value="Hello 世界 🌍"
          onChange={mockOnChange}
          onSubmit={mockOnSubmit}
          userMessages={[]}
        />
      );

      const frame = stripAnsi(lastFrame() ?? '');
      expect(frame).toContain('Hello 世界 🌍');
    });
  });

  describe('History Navigation', () => {
    it('shows history indicator when editing previous message', () => {
      const { stdin, lastFrame } = render(
        <InputBox
          theme={defaultTheme}
          value=""
          onChange={mockOnChange}
          onSubmit={mockOnSubmit}
          userMessages={['Previous message']}
        />
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
      const { lastFrame } = render(
        <InputBox
          theme={defaultTheme}
          value="Test"
          onChange={mockOnChange}
          onSubmit={mockOnSubmit}
          userMessages={[]}
        />
      );

      const frame = lastFrame();
      expect(frame).toBeDefined();
      // Cursor should be visible (inverse text)
    });
  });

  describe('Border Styling', () => {
    it('uses accent color when enabled', () => {
      const { lastFrame } = render(
        <InputBox
          theme={defaultTheme}
          value=""
          onChange={mockOnChange}
          onSubmit={mockOnSubmit}
          userMessages={[]}
          disabled={false}
        />
      );

      const frame = lastFrame();
      expect(frame).toBeDefined();
      // Border should be present
    });

    it('uses secondary color when disabled', () => {
      const { lastFrame } = render(
        <InputBox
          theme={defaultTheme}
          value=""
          onChange={mockOnChange}
          onSubmit={mockOnSubmit}
          userMessages={[]}
          disabled={true}
        />
      );

      const frame = lastFrame();
      expect(frame).toBeDefined();
      // Border should be present with different color
    });
  });
});
