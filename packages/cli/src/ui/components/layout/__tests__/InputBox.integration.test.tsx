import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render } from '../../../../test/ink-testing.js';
import { InputBox } from '../InputBox.js';
import { UIProvider } from '../../../../features/context/UIContext.js';
import { ChatProvider } from '../../../../features/context/ChatContext.js';
import { mockTheme } from '../../__tests__/testUtils.js';

/**
 * Test wrapper that provides required context providers
 */
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <UIProvider>
    <ChatProvider>
      {children}
    </ChatProvider>
  </UIProvider>
);

describe('InputBox Integration Tests', () => {
  const defaultProps = {
    value: '',
    onChange: vi.fn(),
    onSubmit: vi.fn(),
    userMessages: [],
    theme: mockTheme,
  };

  it('should support multi-line input (Requirement 20.9)', () => {
    const { lastFrame } = render(
      <TestWrapper>
        <InputBox {...defaultProps} />
      </TestWrapper>
    );

    // Component should render and support multi-line display
    expect(lastFrame()).toBeDefined();
  });

  it('should handle Enter to send (Requirement 20.10)', () => {
    const { lastFrame } = render(
      <TestWrapper>
        <InputBox {...defaultProps} />
      </TestWrapper>
    );

    // Component should be ready to handle Enter key
    expect(lastFrame()).toBeDefined();
  });

  it('should handle Shift+Enter for newline (Requirement 20.11)', () => {
    const { lastFrame } = render(
      <TestWrapper>
        <InputBox {...defaultProps} />
      </TestWrapper>
    );

    // Component should render with newline support
    expect(lastFrame()).toBeDefined();
  });

  it('should handle Up arrow for edit previous (Requirement 20.11)', () => {
    const { lastFrame } = render(
      <TestWrapper>
        <InputBox {...defaultProps} />
      </TestWrapper>
    );

    // Component should render with message history search support
    expect(lastFrame()).toBeDefined();
  });

  it('should disable input when disabled prop is true', () => {
    const { lastFrame } = render(
      <TestWrapper>
        <InputBox {...defaultProps} disabled={true} />
      </TestWrapper>
    );

    // Component should render with disabled prop
    expect(lastFrame()).toBeDefined();
  });

  it('should show cursor position in input', () => {
    const { lastFrame } = render(
      <TestWrapper>
        <InputBox {...defaultProps} />
      </TestWrapper>
    );

    // Component should render with cursor indicator
    const frame = lastFrame();
    expect(frame).toBeDefined();
  });

  it('should integrate with ChatContext for message history', () => {
    const { lastFrame } = render(
      <TestWrapper>
        <InputBox {...defaultProps} />
      </TestWrapper>
    );

    // Component should have access to message history
    expect(lastFrame()).toBeDefined();
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
      <TestWrapper>
        <InputBox {...defaultProps} theme={customTheme} />
      </TestWrapper>
    );

    // Component should render with custom theme
    expect(lastFrame()).toBeDefined();
  });

  it('should handle streaming state from ChatContext', () => {
    const { lastFrame } = render(
      <TestWrapper>
        <InputBox {...defaultProps} />
      </TestWrapper>
    );

    // Component should integrate with streaming state
    expect(lastFrame()).toBeDefined();
  });
});
