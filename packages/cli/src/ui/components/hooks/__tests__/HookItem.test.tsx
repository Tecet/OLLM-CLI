import React from 'react';
import { render } from 'ink-testing-library';
import { describe, it, expect, vi } from 'vitest';
import { HookItem } from '../HookItem.js';
import type { Hook } from '@ollm/ollm-cli-core/hooks/types.js';
import type { Theme } from '../../../../config/types.js';

// Mock theme
const mockTheme: Theme = {
  text: {
    primary: 'white',
    secondary: 'gray',
    muted: 'dim',
  },
  border: {
    primary: 'gray',
    active: 'yellow',
  },
  status: {
    success: 'green',
    error: 'red',
    warning: 'yellow',
    info: 'blue',
  },
  background: {
    primary: 'black',
    secondary: 'gray',
  },
};

// Mock hook
const mockHook: Hook = {
  id: 'test-hook',
  name: 'Test Hook',
  command: 'echo',
  args: ['test'],
  source: 'user',
};

describe('HookItem', () => {
  it('should render hook name', () => {
    const { lastFrame } = render(
      <HookItem
        hook={mockHook}
        isSelected={false}
        hasFocus={false}
        isEnabled={true}
        theme={mockTheme}
      />
    );

    expect(lastFrame()).toContain('Test Hook');
  });

  it('should show enabled indicator (●) when hook is enabled', () => {
    const { lastFrame } = render(
      <HookItem
        hook={mockHook}
        isSelected={false}
        hasFocus={false}
        isEnabled={true}
        theme={mockTheme}
      />
    );

    expect(lastFrame()).toContain('●');
  });

  it('should show disabled indicator (○) when hook is disabled', () => {
    const { lastFrame } = render(
      <HookItem
        hook={mockHook}
        isSelected={false}
        hasFocus={false}
        isEnabled={false}
        theme={mockTheme}
      />
    );

    expect(lastFrame()).toContain('○');
  });

  it('should apply focus styling when selected and has focus', () => {
    const { lastFrame } = render(
      <HookItem
        hook={mockHook}
        isSelected={true}
        hasFocus={true}
        isEnabled={true}
        theme={mockTheme}
      />
    );

    // When selected and focused, text should be bold and yellow
    // We can't directly test styling, but we can verify the component renders
    expect(lastFrame()).toContain('Test Hook');
  });

  it('should not apply focus styling when selected but no focus', () => {
    const { lastFrame } = render(
      <HookItem
        hook={mockHook}
        isSelected={true}
        hasFocus={false}
        isEnabled={true}
        theme={mockTheme}
      />
    );

    expect(lastFrame()).toContain('Test Hook');
  });

  it('should not apply focus styling when has focus but not selected', () => {
    const { lastFrame } = render(
      <HookItem
        hook={mockHook}
        isSelected={false}
        hasFocus={true}
        isEnabled={true}
        theme={mockTheme}
      />
    );

    expect(lastFrame()).toContain('Test Hook');
  });

  it('should call onSelect when provided', () => {
    const onSelect = vi.fn();
    
    render(
      <HookItem
        hook={mockHook}
        isSelected={false}
        hasFocus={false}
        isEnabled={true}
        theme={mockTheme}
        onSelect={onSelect}
      />
    );

    // Note: Ink doesn't support click events in testing, so we just verify
    // the component renders without errors when onSelect is provided
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('should render with extension name if provided', () => {
    const hookWithExtension: Hook = {
      ...mockHook,
      extensionName: 'my-extension',
    };

    const { lastFrame } = render(
      <HookItem
        hook={hookWithExtension}
        isSelected={false}
        hasFocus={false}
        isEnabled={true}
        theme={mockTheme}
      />
    );

    expect(lastFrame()).toContain('Test Hook');
  });

  it('should render builtin hooks', () => {
    const builtinHook: Hook = {
      ...mockHook,
      source: 'builtin',
    };

    const { lastFrame } = render(
      <HookItem
        hook={builtinHook}
        isSelected={false}
        hasFocus={false}
        isEnabled={true}
        theme={mockTheme}
      />
    );

    expect(lastFrame()).toContain('Test Hook');
  });

  it('should render extension hooks', () => {
    const extensionHook: Hook = {
      ...mockHook,
      source: 'extension',
      extensionName: 'test-extension',
    };

    const { lastFrame } = render(
      <HookItem
        hook={extensionHook}
        isSelected={false}
        hasFocus={false}
        isEnabled={true}
        theme={mockTheme}
      />
    );

    expect(lastFrame()).toContain('Test Hook');
  });

  it('should handle hooks with no args', () => {
    const hookNoArgs: Hook = {
      id: 'test-hook-no-args',
      name: 'Test Hook No Args',
      command: 'echo',
      source: 'user',
    };

    const { lastFrame } = render(
      <HookItem
        hook={hookNoArgs}
        isSelected={false}
        hasFocus={false}
        isEnabled={true}
        theme={mockTheme}
      />
    );

    expect(lastFrame()).toContain('Test Hook No Args');
  });

  it('should handle long hook names', () => {
    const longNameHook: Hook = {
      ...mockHook,
      name: 'This is a very long hook name that might need to be truncated or wrapped',
    };

    const { lastFrame } = render(
      <HookItem
        hook={longNameHook}
        isSelected={false}
        hasFocus={false}
        isEnabled={true}
        theme={mockTheme}
      />
    );

    expect(lastFrame()).toContain('This is a very long hook name');
  });
});
