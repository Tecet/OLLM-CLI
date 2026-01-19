/**
 * HelpOverlay Component Tests
 * 
 * Tests the help overlay component that displays comprehensive help information.
 */

import { describe, it, expect, vi } from 'vitest';
import { render } from 'ink-testing-library';
import React from 'react';
import { HelpOverlay } from '../HelpOverlay.js';
import { UIProvider } from '../../../../features/context/UIContext.js';

// Wrapper component with UIProvider
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <UIProvider>{children}</UIProvider>
);

describe('HelpOverlay', () => {
  describe('Main Context Help', () => {
    it('should render main panel help', () => {
      const onClose = vi.fn();
      const { lastFrame } = render(
        <TestWrapper>
          <HelpOverlay onClose={onClose} context="main" />
        </TestWrapper>
      );

      const output = lastFrame();
      expect(output).toContain('MCP Panel Help');
      expect(output).toContain('Navigation');
      expect(output).toContain('Server Management');
      expect(output).toContain('OAuth & Authentication');
      expect(output).toContain('Monitoring & Troubleshooting');
      expect(output).toContain('Marketplace');
    });

    it('should show keyboard shortcuts', () => {
      const onClose = vi.fn();
      const { lastFrame } = render(
        <TestWrapper>
          <HelpOverlay onClose={onClose} context="main" />
        </TestWrapper>
      );

      const output = lastFrame();
      expect(output).toContain('↑ / ↓');
      expect(output).toContain('Navigate between servers');
      expect(output).toContain('← / →');
      expect(output).toContain('Toggle server enabled/disabled');
      expect(output).toContain('Enter');
      expect(output).toContain('Expand/collapse server details');
    });

    it('should show server status indicators', () => {
      const onClose = vi.fn();
      const { lastFrame } = render(
        <TestWrapper>
          <HelpOverlay onClose={onClose} context="main" />
        </TestWrapper>
      );

      const output = lastFrame();
      expect(output).toContain('● Healthy');
      expect(output).toContain('⚠ Degraded');
      expect(output).toContain('✗ Unhealthy');
      expect(output).toContain('○ Stopped');
      expect(output).toContain('⟳ Connecting');
    });

    it('should show tips section', () => {
      const onClose = vi.fn();
      const { lastFrame } = render(
        <TestWrapper>
          <HelpOverlay onClose={onClose} context="main" />
        </TestWrapper>
      );

      const output = lastFrame();
      expect(output).toContain('Tips');
      expect(output).toContain('Changes to server settings are saved immediately');
      expect(output).toContain('OAuth tokens are encrypted and stored securely');
      expect(output).toContain('Press ? anytime to show this help');
    });
  });

  describe('Marketplace Context Help', () => {
    it('should render marketplace help', () => {
      const onClose = vi.fn();
      const { lastFrame } = render(
        <TestWrapper>
          <HelpOverlay onClose={onClose} context="marketplace" />
        </TestWrapper>
      );

      const output = lastFrame();
      expect(output).toContain('MCP Panel Help');
      expect(output).toContain('Marketplace Navigation');
      expect(output).toContain('Server Information');
      expect(output).toContain('Installation');
    });

    it('should show marketplace shortcuts', () => {
      const onClose = vi.fn();
      const { lastFrame } = render(
        <TestWrapper>
          <HelpOverlay onClose={onClose} context="marketplace" />
        </TestWrapper>
      );

      const output = lastFrame();
      expect(output).toContain('↑ / ↓');
      expect(output).toContain('Navigate server list');
      expect(output).toContain('/');
      expect(output).toContain('Focus search box');
      expect(output).toContain('I');
      expect(output).toContain('Install selected server');
    });

    it('should show installation steps', () => {
      const onClose = vi.fn();
      const { lastFrame } = render(
        <TestWrapper>
          <HelpOverlay onClose={onClose} context="marketplace" />
        </TestWrapper>
      );

      const output = lastFrame();
      expect(output).toContain('1. Select a server from the list');
      expect(output).toContain('2. Press \'I\' to open installation dialog');
      expect(output).toContain('3. Configure required settings');
      expect(output).toContain('4. Choose auto-approve options');
      expect(output).toContain('5. Confirm installation');
    });
  });

  describe('Dialog Context Help', () => {
    it('should render dialog help', () => {
      const onClose = vi.fn();
      const { lastFrame } = render(
        <TestWrapper>
          <HelpOverlay onClose={onClose} context="dialog" />
        </TestWrapper>
      );

      const output = lastFrame();
      expect(output).toContain('MCP Panel Help');
      expect(output).toContain('Dialog Navigation');
      expect(output).toContain('Form Fields');
    });

    it('should show dialog shortcuts', () => {
      const onClose = vi.fn();
      const { lastFrame } = render(
        <TestWrapper>
          <HelpOverlay onClose={onClose} context="dialog" />
        </TestWrapper>
      );

      const output = lastFrame();
      expect(output).toContain('Tab');
      expect(output).toContain('Move to next field');
      expect(output).toContain('Shift+Tab');
      expect(output).toContain('Move to previous field');
      expect(output).toContain('Enter');
      expect(output).toContain('Confirm/Submit');
    });

    it('should show form field information', () => {
      const onClose = vi.fn();
      const { lastFrame } = render(
        <TestWrapper>
          <HelpOverlay onClose={onClose} context="dialog" />
        </TestWrapper>
      );

      const output = lastFrame();
      expect(output).toContain('Required fields are marked with *');
      expect(output).toContain('Help text appears below each field');
      expect(output).toContain('Validation errors shown in red');
      expect(output).toContain('Secret fields (API keys) are masked');
    });
  });

  describe('Close Instructions', () => {
    it('should show close instructions', () => {
      const onClose = vi.fn();
      const { lastFrame } = render(
        <TestWrapper>
          <HelpOverlay onClose={onClose} context="main" />
        </TestWrapper>
      );

      const output = lastFrame();
      expect(output).toContain('Press Esc or ? to close this help');
    });
  });

  describe('Default Context', () => {
    it('should default to main context', () => {
      const onClose = vi.fn();
      const { lastFrame } = render(
        <TestWrapper>
          <HelpOverlay onClose={onClose} />
        </TestWrapper>
      );

      const output = lastFrame();
      expect(output).toContain('Navigation');
      expect(output).toContain('Server Management');
    });
  });
});
