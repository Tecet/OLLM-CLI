/**
 * Unit tests for ConfirmationDialog component
 * 
 * Tests the confirmation dialog UI component for destructive operations.
 */

import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';
import { ConfirmationDialog } from '../../ConfirmationDialog.js';

describe('ConfirmationDialog', () => {
  it('should not render when isOpen is false', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    
    const { lastFrame } = render(
      <ConfirmationDialog
        isOpen={false}
        message="Test message"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );
    
    expect(lastFrame()).toBe('');
  });

  it('should render with default props when open', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    
    const { lastFrame } = render(
      <ConfirmationDialog
        isOpen={true}
        message="Are you sure?"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );
    
    const output = lastFrame();
    expect(output).toContain('Confirm');
    expect(output).toContain('Are you sure?');
    expect(output).toContain('Yes');
    expect(output).toContain('No');
  });

  it('should render with custom title and labels', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    
    const { lastFrame } = render(
      <ConfirmationDialog
        isOpen={true}
        message="Delete this file?"
        title="Delete File"
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );
    
    const output = lastFrame();
    expect(output).toContain('Delete File');
    expect(output).toContain('Delete this file?');
    expect(output).toContain('Delete');
    expect(output).toContain('Cancel');
  });

  it('should render with danger level styling', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    
    const { lastFrame } = render(
      <ConfirmationDialog
        isOpen={true}
        message="This action cannot be undone"
        level="danger"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );
    
    const output = lastFrame();
    expect(output).toContain('This action cannot be undone');
    // Danger level should show warning icon
    expect(output).toContain('⚠️');
  });

  it('should render with warning level styling', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    
    const { lastFrame } = render(
      <ConfirmationDialog
        isOpen={true}
        message="Are you sure?"
        level="warning"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );
    
    const output = lastFrame();
    expect(output).toContain('Are you sure?');
    // Warning level should show warning icon
    expect(output).toContain('⚠');
  });

  it('should render with info level styling', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    
    const { lastFrame } = render(
      <ConfirmationDialog
        isOpen={true}
        message="Proceed with this action?"
        level="info"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );
    
    const output = lastFrame();
    expect(output).toContain('Proceed with this action?');
    // Info level should show info icon
    expect(output).toContain('ℹ');
  });

  it('should show keyboard hints', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    
    const { lastFrame } = render(
      <ConfirmationDialog
        isOpen={true}
        message="Test"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );
    
    const output = lastFrame();
    expect(output).toContain('arrow keys');
    expect(output).toContain('Tab');
    expect(output).toContain('Enter');
    expect(output).toContain('Esc');
  });
});
