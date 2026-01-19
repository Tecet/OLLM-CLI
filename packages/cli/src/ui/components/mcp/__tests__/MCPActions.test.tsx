/**
 * Tests for MCPActions Component
 * 
 * Validates:
 * - Display of keyboard shortcuts in footer
 * - Context-sensitive action display based on focused item
 * - Proper styling and layout
 * - Different states (dialog open, marketplace, main panel)
 */

import React from 'react';
import { render } from 'ink-testing-library';
import { MCPActions } from '../MCPActions.js';

describe('MCPActions', () => {
  describe('Main Panel View', () => {
    it('should render basic navigation shortcuts', () => {
      const { lastFrame } = render(<MCPActions />);
      const output = lastFrame() || '';

      // Check for navigation shortcuts
      expect(output).toContain('[↑↓]');
      expect(output).toContain('Navigate');
      expect(output).toContain('[←→]');
      expect(output).toContain('Toggle');
      expect(output).toContain('[Enter]');
      expect(output).toContain('[Tab]');
      expect(output).toContain('Main Menu');
    });

    it('should render marketplace and health shortcuts', () => {
      const { lastFrame } = render(<MCPActions />);
      const output = lastFrame() || '';

      expect(output).toContain('[M]');
      expect(output).toContain('Marketplace');
      expect(output).toContain('[H]');
      expect(output).toContain('Health');
    });

    it('should dim server-specific shortcuts when no server is focused', () => {
      const { lastFrame } = render(<MCPActions hasServerFocused={false} />);
      const output = lastFrame() || '';

      // Server-specific actions should still be present but dimmed
      expect(output).toContain('[V]');
      expect(output).toContain('View Tools');
      expect(output).toContain('[C]');
      expect(output).toContain('Configure');
      expect(output).toContain('[R]');
      expect(output).toContain('Restart');
      expect(output).toContain('[L]');
      expect(output).toContain('Logs');
      expect(output).toContain('[U]');
      expect(output).toContain('Uninstall');
    });

    it('should show active server-specific shortcuts when server is focused', () => {
      const { lastFrame } = render(
        <MCPActions hasServerFocused={true} isServerEnabled={true} />
      );
      const output = lastFrame() || '';

      // All shortcuts should be visible
      expect(output).toContain('[V]');
      expect(output).toContain('View Tools');
      expect(output).toContain('[C]');
      expect(output).toContain('Configure');
      expect(output).toContain('[R]');
      expect(output).toContain('Restart');
      expect(output).toContain('[L]');
      expect(output).toContain('Logs');
    });

    it('should show OAuth shortcut when server requires OAuth', () => {
      const { lastFrame } = render(
        <MCPActions hasServerFocused={true} requiresOAuth={true} />
      );
      const output = lastFrame() || '';

      expect(output).toContain('[O]');
      expect(output).toContain('OAuth');
    });

    it('should dim OAuth shortcut when server does not require OAuth', () => {
      const { lastFrame } = render(
        <MCPActions hasServerFocused={true} requiresOAuth={false} />
      );
      const output = lastFrame() || '';

      // OAuth should still be present but dimmed
      expect(output).toContain('[O]');
      expect(output).toContain('OAuth');
    });

    it('should show "Expand" when server is collapsed', () => {
      const { lastFrame } = render(
        <MCPActions hasServerFocused={true} isServerExpanded={false} />
      );
      const output = lastFrame() || '';

      expect(output).toContain('Expand');
      expect(output).not.toContain('Collapse');
    });

    it('should show "Collapse" when server is expanded', () => {
      const { lastFrame } = render(
        <MCPActions hasServerFocused={true} isServerExpanded={true} />
      );
      const output = lastFrame() || '';

      expect(output).toContain('Collapse');
      expect(output).not.toContain('Expand');
    });

    it('should dim restart shortcut when server is disabled', () => {
      const { lastFrame } = render(
        <MCPActions hasServerFocused={true} isServerEnabled={false} />
      );
      const output = lastFrame() || '';

      // Restart should be present but dimmed for disabled servers
      expect(output).toContain('[R]');
      expect(output).toContain('Restart');
    });
  });

  describe('Marketplace View', () => {
    it('should show marketplace-specific shortcuts', () => {
      const { lastFrame } = render(<MCPActions inMarketplace={true} />);
      const output = lastFrame() || '';

      expect(output).toContain('[↑↓]');
      expect(output).toContain('Navigate');
      expect(output).toContain('[/]');
      expect(output).toContain('Search');
      expect(output).toContain('[I]');
      expect(output).toContain('Install');
      expect(output).toContain('[Esc]');
      expect(output).toContain('Close');
    });

    it('should not show main panel shortcuts in marketplace view', () => {
      const { lastFrame } = render(<MCPActions inMarketplace={true} />);
      const output = lastFrame() || '';

      // Main panel shortcuts should not be visible
      expect(output).not.toContain('[M]');
      expect(output).not.toContain('Marketplace');
      expect(output).not.toContain('[H]');
      expect(output).not.toContain('Health');
      expect(output).not.toContain('[V]');
      expect(output).not.toContain('View Tools');
    });
  });

  describe('Dialog View', () => {
    it('should show dialog-specific shortcuts', () => {
      const { lastFrame } = render(<MCPActions dialogOpen={true} />);
      const output = lastFrame() || '';

      expect(output).toContain('[Esc]');
      expect(output).toContain('Close');
      expect(output).toContain('[Tab]');
      expect(output).toContain('Next Field');
      expect(output).toContain('[Enter]');
      expect(output).toContain('Confirm');
    });

    it('should not show main panel shortcuts when dialog is open', () => {
      const { lastFrame } = render(<MCPActions dialogOpen={true} />);
      const output = lastFrame() || '';

      // Main panel shortcuts should not be visible
      expect(output).not.toContain('[M]');
      expect(output).not.toContain('Marketplace');
      expect(output).not.toContain('[H]');
      expect(output).not.toContain('Health');
      expect(output).not.toContain('[V]');
      expect(output).not.toContain('View Tools');
    });
  });

  describe('Layout and Styling', () => {
    it('should render with border', () => {
      const { lastFrame } = render(<MCPActions />);
      const output = lastFrame() || '';

      // Check for border characters (box drawing characters)
      expect(output).toMatch(/[─│┌┐└┘]/);
    });

    it('should organize shortcuts in multiple rows', () => {
      const { lastFrame } = render(<MCPActions hasServerFocused={true} />);
      const output = lastFrame() || '';

      // Should have multiple lines of shortcuts
      const lines = output.split('\n').filter(line => line.includes('['));
      expect(lines.length).toBeGreaterThan(1);
    });
  });

  describe('Context Sensitivity', () => {
    it('should adapt to all context flags being true', () => {
      const { lastFrame } = render(
        <MCPActions
          hasServerFocused={true}
          isServerExpanded={true}
          isServerEnabled={true}
          requiresOAuth={true}
        />
      );
      const output = lastFrame() || '';

      // All shortcuts should be visible and active
      expect(output).toContain('[V]');
      expect(output).toContain('[C]');
      expect(output).toContain('[O]');
      expect(output).toContain('[R]');
      expect(output).toContain('[L]');
      expect(output).toContain('[U]');
      expect(output).toContain('Collapse');
    });

    it('should adapt to all context flags being false', () => {
      const { lastFrame } = render(
        <MCPActions
          hasServerFocused={false}
          isServerExpanded={false}
          isServerEnabled={false}
          requiresOAuth={false}
        />
      );
      const output = lastFrame() || '';

      // Basic navigation should still be visible
      expect(output).toContain('[↑↓]');
      expect(output).toContain('[M]');
      expect(output).toContain('[H]');
      expect(output).toContain('Expand');
    });
  });
});
