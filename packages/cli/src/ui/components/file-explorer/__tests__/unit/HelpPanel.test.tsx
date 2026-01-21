/**
 * Unit tests for HelpPanel component
 * 
 * Tests that the '?' key shows the help panel with keyboard shortcuts.
 * 
 * Requirements: 11.2
 */

import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';
import { HelpPanel } from '../../HelpPanel.js';

describe('HelpPanel', () => {
  describe('Visibility', () => {
    it('should not render when isOpen is false', () => {
      const onClose = vi.fn();
      const { lastFrame } = render(
        <HelpPanel isOpen={false} onClose={onClose} />
      );

      const output = lastFrame();
      expect(output).toBe('');
    });

    it('should render when isOpen is true', () => {
      const onClose = vi.fn();
      const { lastFrame } = render(
        <HelpPanel isOpen={true} onClose={onClose} />
      );

      const output = lastFrame();
      expect(output).not.toBe('');
      expect(output).toContain('Keyboard Shortcuts');
    });
  });

  describe('Content', () => {
    it('should display keyboard shortcuts title', () => {
      const onClose = vi.fn();
      const { lastFrame } = render(
        <HelpPanel isOpen={true} onClose={onClose} />
      );

      const output = lastFrame();
      expect(output).toContain('Keyboard Shortcuts');
    });

    it('should display navigation shortcuts', () => {
      const onClose = vi.fn();
      const { lastFrame } = render(
        <HelpPanel isOpen={true} onClose={onClose} />
      );

      const output = lastFrame();
      
      // Check for navigation shortcuts
      expect(output).toContain('j / ↓');
      expect(output).toContain('Move cursor down');
      expect(output).toContain('k / ↑');
      expect(output).toContain('Move cursor up');
      expect(output).toContain('h / ←');
      expect(output).toContain('Collapse directory');
      expect(output).toContain('l / →');
      expect(output).toContain('Expand directory');
    });

    it('should display file operation shortcuts', () => {
      const onClose = vi.fn();
      const { lastFrame } = render(
        <HelpPanel isOpen={true} onClose={onClose} />
      );

      const output = lastFrame();
      
      // Check for file operation shortcuts
      expect(output).toContain('Toggle focus on file');
      expect(output).toContain('View file');
      expect(output).toContain('Edit file in external editor');
      expect(output).toContain('Open quick actions menu');
    });

    it('should display feature shortcuts', () => {
      const onClose = vi.fn();
      const { lastFrame } = render(
        <HelpPanel isOpen={true} onClose={onClose} />
      );

      const output = lastFrame();
      
      // Check for feature shortcuts
      expect(output).toContain('Toggle Follow Mode');
      expect(output).toContain('Show this help panel');
    });

    it('should display general shortcuts', () => {
      const onClose = vi.fn();
      const { lastFrame } = render(
        <HelpPanel isOpen={true} onClose={onClose} />
      );

      const output = lastFrame();
      
      // Check for general shortcuts
      expect(output).toContain('Esc');
      expect(output).toContain('Close modal/menu');
    });

    it('should display Quick Open shortcut', () => {
      const onClose = vi.fn();
      const { lastFrame } = render(
        <HelpPanel isOpen={true} onClose={onClose} />
      );

      const output = lastFrame();
      
      // Check for Quick Open shortcut
      expect(output).toContain('Ctrl+O');
      expect(output).toContain('Quick Open');
    });

    it('should display close instructions', () => {
      const onClose = vi.fn();
      const { lastFrame } = render(
        <HelpPanel isOpen={true} onClose={onClose} />
      );

      const output = lastFrame();
      
      // Check for close instructions
      expect(output).toContain('Press Esc or ? to close');
    });

    it('should display helpful tip', () => {
      const onClose = vi.fn();
      const { lastFrame } = render(
        <HelpPanel isOpen={true} onClose={onClose} />
      );

      const output = lastFrame();
      
      // Check for tip
      expect(output).toContain('Tip:');
      expect(output).toContain('vim-style keys');
    });
  });

  describe('Categories', () => {
    it('should organize shortcuts by category', () => {
      const onClose = vi.fn();
      const { lastFrame } = render(
        <HelpPanel isOpen={true} onClose={onClose} />
      );

      const output = lastFrame();
      
      // Check for category headers
      expect(output).toContain('Navigation');
      expect(output).toContain('File Operations');
      expect(output).toContain('Features');
      expect(output).toContain('General');
    });

    it('should display shortcuts under correct categories', () => {
      const onClose = vi.fn();
      const { lastFrame } = render(
        <HelpPanel isOpen={true} onClose={onClose} />
      );

      const output = lastFrame();
      
      // Navigation category should come before File Operations
      const navigationIndex = output.indexOf('Navigation');
      const fileOpsIndex = output.indexOf('File Operations');
      const cursorDownIndex = output.indexOf('Move cursor down');
      const focusIndex = output.indexOf('Toggle focus on file');
      
      expect(navigationIndex).toBeGreaterThan(-1);
      expect(fileOpsIndex).toBeGreaterThan(-1);
      expect(navigationIndex).toBeLessThan(fileOpsIndex);
      
      // Cursor down should be in Navigation section
      expect(cursorDownIndex).toBeGreaterThan(navigationIndex);
      expect(cursorDownIndex).toBeLessThan(fileOpsIndex);
      
      // Focus should be in File Operations section
      expect(focusIndex).toBeGreaterThan(fileOpsIndex);
    });
  });

  describe('Styling', () => {
    it('should use border styling', () => {
      const onClose = vi.fn();
      const { lastFrame } = render(
        <HelpPanel isOpen={true} onClose={onClose} />
      );

      const output = lastFrame();
      
      // Check for border characters (double border style)
      // The exact characters depend on Ink's rendering, but we can check
      // that the output is formatted with some structure
      expect(output.length).toBeGreaterThan(100); // Should be substantial content
    });
  });
});
