/**
 * Tests for HookApprovalDialog component
 */

import { describe, it, expect, vi } from 'vitest';
import { render } from 'ink-testing-library';
import React from 'react';
import { HookApprovalDialog } from '../HookApprovalDialog.js';
import type { Hook } from '@ollm/ollm-cli-core/hooks/types.js';
import type { Theme } from '../../../features/context/UIContext.js';

// Default theme for testing
const defaultTheme: Theme = {
  name: 'default-dark',
  bg: {
    primary: '#1e1e1e',
    secondary: '#252526',
    tertiary: '#2d2d30',
  },
  text: {
    primary: '#d4d4d4',
    secondary: '#858585',
    accent: '#4ec9b0',
  },
  border: {
    primary: '#858585',
    secondary: '#555555',
  },
  role: {
    user: '#569cd6',
    assistant: '#4ec9b0',
    system: '#858585',
    tool: '#dcdcaa',
  },
  status: {
    success: '#4ec9b0',
    warning: '#ce9178',
    error: '#f48771',
    info: '#569cd6',
  },
  diff: {
    added: '#4ec9b0',
    removed: '#f48771',
  },
};

describe('HookApprovalDialog', () => {
  const mockHook: Hook = {
    id: 'test-hook-1',
    name: 'test-hook',
    command: 'node',
    args: ['script.js'],
    source: 'workspace',
    extensionName: 'test-extension',
  };

  const mockHash = 'sha256:abc123def456';

  it('should render hook approval dialog', () => {
    const onApprove = vi.fn();
    const onDeny = vi.fn();

    const { lastFrame } = render(
      <HookApprovalDialog
        hook={mockHook}
        hash={mockHash}
        theme={defaultTheme}
        onApprove={onApprove}
        onDeny={onDeny}
        visible={true}
      />
    );

    const output = lastFrame();

    // Check for title
    expect(output).toContain('Hook Approval Required');

    // Check for hook details
    expect(output).toContain('test-hook');
    expect(output).toContain('Workspace Hook');
    expect(output).toContain('test-extension');
    expect(output).toContain('node');
    expect(output).toContain('script.js');

    // Check for security notice
    expect(output).toContain('Security Notice');

    // Check for options
    expect(output).toContain('[A] Approve');
    expect(output).toContain('[D] Deny');
  });

  it('should not render when not visible', () => {
    const onApprove = vi.fn();
    const onDeny = vi.fn();

    const { lastFrame } = render(
      <HookApprovalDialog
        hook={mockHook}
        hash={mockHash}
        theme={defaultTheme}
        onApprove={onApprove}
        onDeny={onDeny}
        visible={false}
      />
    );

    const output = lastFrame();
    expect(output).toBe('');
  });

  it('should show HIGH risk for downloaded hooks', () => {
    const downloadedHook: Hook = {
      ...mockHook,
      source: 'downloaded',
    };

    const onApprove = vi.fn();
    const onDeny = vi.fn();

    const { lastFrame } = render(
      <HookApprovalDialog
        hook={downloadedHook}
        hash={mockHash}
        theme={defaultTheme}
        onApprove={onApprove}
        onDeny={onDeny}
        visible={true}
      />
    );

    const output = lastFrame();
    expect(output).toContain('HIGH');
  });

  it('should show MEDIUM risk for workspace hooks', () => {
    const onApprove = vi.fn();
    const onDeny = vi.fn();

    const { lastFrame } = render(
      <HookApprovalDialog
        hook={mockHook}
        hash={mockHash}
        theme={defaultTheme}
        onApprove={onApprove}
        onDeny={onDeny}
        visible={true}
      />
    );

    const output = lastFrame();
    expect(output).toContain('MEDIUM');
  });

  it('should display truncated hash', () => {
    const onApprove = vi.fn();
    const onDeny = vi.fn();

    const { lastFrame } = render(
      <HookApprovalDialog
        hook={mockHook}
        hash={mockHash}
        theme={defaultTheme}
        onApprove={onApprove}
        onDeny={onDeny}
        visible={true}
      />
    );

    const output = lastFrame();
    // Hash should be truncated to first 16 characters
    expect(output).toContain('sha256:abc123de');
  });

  it('should handle hooks without extension name', () => {
    const hookWithoutExtension: Hook = {
      ...mockHook,
      extensionName: undefined,
    };

    const onApprove = vi.fn();
    const onDeny = vi.fn();

    const { lastFrame } = render(
      <HookApprovalDialog
        hook={hookWithoutExtension}
        hash={mockHash}
        theme={defaultTheme}
        onApprove={onApprove}
        onDeny={onDeny}
        visible={true}
      />
    );

    const output = lastFrame();
    // Should not show extension line
    expect(output).not.toContain('Extension:');
  });

  it('should handle hooks without args', () => {
    const hookWithoutArgs: Hook = {
      ...mockHook,
      args: undefined,
    };

    const onApprove = vi.fn();
    const onDeny = vi.fn();

    const { lastFrame } = render(
      <HookApprovalDialog
        hook={hookWithoutArgs}
        hash={mockHash}
        theme={defaultTheme}
        onApprove={onApprove}
        onDeny={onDeny}
        visible={true}
      />
    );

    const output = lastFrame();
    // Should not show arguments line
    expect(output).not.toContain('Arguments:');
  });
});
