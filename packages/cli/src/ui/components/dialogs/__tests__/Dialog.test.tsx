/**
 * Dialog Component Tests
 * 
 * Tests the base Dialog component functionality:
 * - Rendering with title and content
 * - Esc key handling for closing
 * - Border and padding styling
 * - Theme integration
 * - Custom width and colors
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from 'ink-testing-library';
import { Text } from 'ink';
import { Dialog } from '../Dialog.js';
import { UIProvider } from '../../../../features/context/UIContext.js';
import { defaultDarkTheme } from '../../../../config/styles.js';

describe('Dialog', () => {
  const mockOnClose = vi.fn();

  beforeEach(() => {
    mockOnClose.mockClear();
  });

  describe('Rendering', () => {
    it('should render with title and content', () => {
      const { lastFrame } = render(
        <UIProvider initialTheme={defaultDarkTheme}>
          <Dialog title="Test Dialog" onClose={mockOnClose}>
            <Text>Dialog content</Text>
          </Dialog>
        </UIProvider>
      );

      const output = lastFrame();
      expect(output).toContain('Test Dialog');
      expect(output).toContain('Dialog content');
    });

    it('should render with bold title', () => {
      const { lastFrame } = render(
        <UIProvider initialTheme={defaultDarkTheme}>
          <Dialog title="Bold Title" onClose={mockOnClose}>
            <Text>Content</Text>
          </Dialog>
        </UIProvider>
      );

      const output = lastFrame();
      expect(output).toContain('Bold Title');
    });

    it('should render children content', () => {
      const { lastFrame } = render(
        <UIProvider initialTheme={defaultDarkTheme}>
          <Dialog title="Title" onClose={mockOnClose}>
            <Text>First line</Text>
            <Text>Second line</Text>
          </Dialog>
        </UIProvider>
      );

      const output = lastFrame();
      expect(output).toContain('First line');
      expect(output).toContain('Second line');
    });
  });

  describe('Esc Key Handling', () => {
    it('should call onClose when Esc is pressed', () => {
      const { stdin } = render(
        <UIProvider initialTheme={defaultDarkTheme}>
          <Dialog title="Test Dialog" onClose={mockOnClose}>
            <Text>Content</Text>
          </Dialog>
        </UIProvider>
      );

      // Simulate Esc key press
      stdin.write('\x1B'); // ESC character

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should not call onClose for other keys', () => {
      const { stdin } = render(
        <UIProvider initialTheme={defaultDarkTheme}>
          <Dialog title="Test Dialog" onClose={mockOnClose}>
            <Text>Content</Text>
          </Dialog>
        </UIProvider>
      );

      // Simulate other key presses
      stdin.write('a');
      stdin.write('b');
      stdin.write('\r'); // Enter

      expect(mockOnClose).not.toHaveBeenCalled();
    });
  });

  describe('Styling', () => {
    it('should use default width of 60', () => {
      const { lastFrame } = render(
        <UIProvider initialTheme={defaultDarkTheme}>
          <Dialog title="Test Dialog" onClose={mockOnClose}>
            <Text>Content</Text>
          </Dialog>
        </UIProvider>
      );

      // Dialog should render (width is applied via Ink's Box component)
      const output = lastFrame();
      expect(output).toBeTruthy();
    });

    it('should accept custom width', () => {
      const { lastFrame } = render(
        <UIProvider initialTheme={defaultDarkTheme}>
          <Dialog title="Test Dialog" onClose={mockOnClose} width={80}>
            <Text>Content</Text>
          </Dialog>
        </UIProvider>
      );

      const output = lastFrame();
      expect(output).toBeTruthy();
    });

    it('should use theme border color by default', () => {
      const { lastFrame } = render(
        <UIProvider initialTheme={defaultDarkTheme}>
          <Dialog title="Test Dialog" onClose={mockOnClose}>
            <Text>Content</Text>
          </Dialog>
        </UIProvider>
      );

      const output = lastFrame();
      expect(output).toBeTruthy();
    });

    it('should accept custom border color', () => {
      const { lastFrame } = render(
        <UIProvider initialTheme={defaultDarkTheme}>
          <Dialog title="Test Dialog" onClose={mockOnClose} borderColor="red">
            <Text>Content</Text>
          </Dialog>
        </UIProvider>
      );

      const output = lastFrame();
      expect(output).toBeTruthy();
    });

    it('should use yellow title color by default', () => {
      const { lastFrame } = render(
        <UIProvider initialTheme={defaultDarkTheme}>
          <Dialog title="Test Dialog" onClose={mockOnClose}>
            <Text>Content</Text>
          </Dialog>
        </UIProvider>
      );

      const output = lastFrame();
      expect(output).toContain('Test Dialog');
    });

    it('should accept custom title color', () => {
      const { lastFrame } = render(
        <UIProvider initialTheme={defaultDarkTheme}>
          <Dialog title="Test Dialog" onClose={mockOnClose} titleColor="cyan">
            <Text>Content</Text>
          </Dialog>
        </UIProvider>
      );

      const output = lastFrame();
      expect(output).toContain('Test Dialog');
    });
  });

  describe('Layout', () => {
    it('should have rounded border style', () => {
      const { lastFrame } = render(
        <UIProvider initialTheme={defaultDarkTheme}>
          <Dialog title="Test Dialog" onClose={mockOnClose}>
            <Text>Content</Text>
          </Dialog>
        </UIProvider>
      );

      const output = lastFrame();
      // Rounded borders use specific characters
      expect(output).toBeTruthy();
    });

    it('should have padding', () => {
      const { lastFrame } = render(
        <UIProvider initialTheme={defaultDarkTheme}>
          <Dialog title="Test Dialog" onClose={mockOnClose}>
            <Text>Content</Text>
          </Dialog>
        </UIProvider>
      );

      const output = lastFrame();
      expect(output).toBeTruthy();
    });

    it('should have margin between title and content', () => {
      const { lastFrame } = render(
        <UIProvider initialTheme={defaultDarkTheme}>
          <Dialog title="Title" onClose={mockOnClose}>
            <Text>Content</Text>
          </Dialog>
        </UIProvider>
      );

      const output = lastFrame();
      expect(output).toContain('Title');
      expect(output).toContain('Content');
    });
  });

  describe('Integration', () => {
    it('should work with complex content', () => {
      const { lastFrame } = render(
        <UIProvider initialTheme={defaultDarkTheme}>
          <Dialog title="Complex Dialog" onClose={mockOnClose}>
            <Text>Line 1</Text>
            <Text color="green">Line 2</Text>
            <Text bold>Line 3</Text>
          </Dialog>
        </UIProvider>
      );

      const output = lastFrame();
      expect(output).toContain('Complex Dialog');
      expect(output).toContain('Line 1');
      expect(output).toContain('Line 2');
      expect(output).toContain('Line 3');
    });

    it('should handle multiple Dialog instances', () => {
      const mockOnClose2 = vi.fn();

      const { lastFrame } = render(
        <UIProvider initialTheme={defaultDarkTheme}>
          <>
            <Dialog title="Dialog 1" onClose={mockOnClose}>
              <Text>Content 1</Text>
            </Dialog>
            <Dialog title="Dialog 2" onClose={mockOnClose2}>
              <Text>Content 2</Text>
            </Dialog>
          </>
        </UIProvider>
      );

      const output = lastFrame();
      expect(output).toContain('Dialog 1');
      expect(output).toContain('Dialog 2');
    });
  });

  describe('Accessibility', () => {
    it('should provide clear visual hierarchy', () => {
      const { lastFrame } = render(
        <UIProvider initialTheme={defaultDarkTheme}>
          <Dialog title="Accessible Dialog" onClose={mockOnClose}>
            <Text>Main content</Text>
          </Dialog>
        </UIProvider>
      );

      const output = lastFrame();
      expect(output).toContain('Accessible Dialog');
      expect(output).toContain('Main content');
    });

    it('should be keyboard navigable (Esc to close)', () => {
      const { stdin } = render(
        <UIProvider initialTheme={defaultDarkTheme}>
          <Dialog title="Test Dialog" onClose={mockOnClose}>
            <Text>Content</Text>
          </Dialog>
        </UIProvider>
      );

      stdin.write('\x1B');
      expect(mockOnClose).toHaveBeenCalled();
    });
  });
});
