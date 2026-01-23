/**
 * FileSearchDialog Tests
 * 
 * Tests for file content search dialog
 */

import React from 'react';
import { render } from 'ink-testing-library';
import { describe, it, expect, vi } from 'vitest';

import { FileSearchDialog } from '../FileSearchDialog.js';

describe('FileSearchDialog', () => {
  const mockOnClose = vi.fn();
  const mockOnSelect = vi.fn();
  const mockToolRegistry = {
    get: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('should render when visible', () => {
      const { lastFrame } = render(
        <FileSearchDialog
          visible={true}
          onClose={mockOnClose}
          onSelect={mockOnSelect}
          toolRegistry={mockToolRegistry as any}
          rootPath="/test/path"
        />
      );

      expect(lastFrame()).toContain('Search Files');
    });

    it('should not render when not visible', () => {
      const { lastFrame } = render(
        <FileSearchDialog
          visible={false}
          onClose={mockOnClose}
          onSelect={mockOnSelect}
          toolRegistry={mockToolRegistry as any}
          rootPath="/test/path"
        />
      );

      expect(lastFrame()).toBe('');
    });

    it('should show search query input', () => {
      const { lastFrame } = render(
        <FileSearchDialog
          visible={true}
          onClose={mockOnClose}
          onSelect={mockOnSelect}
          toolRegistry={mockToolRegistry as any}
          rootPath="/test/path"
        />
      );

      expect(lastFrame()).toContain('Search:');
    });

    it('should show file pattern input', () => {
      const { lastFrame } = render(
        <FileSearchDialog
          visible={true}
          onClose={mockOnClose}
          onSelect={mockOnSelect}
          toolRegistry={mockToolRegistry as any}
          rootPath="/test/path"
        />
      );

      expect(lastFrame()).toContain('Files:');
    });

    it('should show case sensitivity option', () => {
      const { lastFrame } = render(
        <FileSearchDialog
          visible={true}
          onClose={mockOnClose}
          onSelect={mockOnSelect}
          toolRegistry={mockToolRegistry as any}
          rootPath="/test/path"
        />
      );

      expect(lastFrame()).toContain('Case Sensitive');
    });
  });

  describe('keyboard shortcuts', () => {
    it('should show help text', () => {
      const { lastFrame } = render(
        <FileSearchDialog
          visible={true}
          onClose={mockOnClose}
          onSelect={mockOnSelect}
          toolRegistry={mockToolRegistry as any}
          rootPath="/test/path"
        />
      );

      expect(lastFrame()).toContain('Tab:');
      expect(lastFrame()).toContain('Enter:');
      expect(lastFrame()).toContain('ESC:');
    });
  });
});
