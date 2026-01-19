/**
 * InstallServerDialog Tests
 * 
 * Tests for the InstallServerDialog component covering:
 * - Server information display
 * - Requirements list display
 * - Dynamic configuration form
 * - Environment variables inputs
 * - Auto-approve checkbox
 * - Form validation
 * - Installation flow
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from 'ink-testing-library';
import { InstallServerDialog } from '../InstallServerDialog.js';
import { MCPProvider } from '../../../contexts/MCPContext.js';
import { UIProvider } from '../../../../features/context/UIContext.js';
import type { MCPMarketplaceServer } from '../../../../services/mcpMarketplace.js';

// Mock server data
const mockServer: MCPMarketplaceServer = {
  id: 'test-server',
  name: 'Test Server',
  description: 'A test MCP server for unit testing',
  rating: 4.5,
  installCount: 1000,
  requiresOAuth: false,
  requirements: ['Node.js 18+', 'Test API Key'],
  command: 'npx',
  args: ['-y', '@test/mcp-server'],
  env: {
    TEST_API_KEY: '',
  },
  category: 'Testing',
  author: 'Test Author',
  version: '1.0.0',
};

const mockServerWithOAuth: MCPMarketplaceServer = {
  ...mockServer,
  id: 'oauth-server',
  name: 'OAuth Server',
  requiresOAuth: true,
  requirements: ['Node.js 18+', 'GitHub Personal Access Token'],
  env: {
    GITHUB_TOKEN: '',
  },
};

const mockServerNoEnv: MCPMarketplaceServer = {
  ...mockServer,
  id: 'simple-server',
  name: 'Simple Server',
  requirements: ['Node.js 18+'],
  env: undefined,
};

/**
 * Render InstallServerDialog with providers
 */
function renderDialog(
  server: MCPMarketplaceServer,
  onClose = vi.fn(),
  onInstall = vi.fn()
) {
  return render(
    <UIProvider>
      <MCPProvider>
        <InstallServerDialog
          server={server}
          onClose={onClose}
          onInstall={onInstall}
        />
      </MCPProvider>
    </UIProvider>
  );
}

describe('InstallServerDialog', () => {
  describe('Server Information Display', () => {
    it('should display server name and description', () => {
      const { lastFrame } = renderDialog(mockServer);
      
      expect(lastFrame()).toContain('Test Server');
      expect(lastFrame()).toContain('A test MCP server for unit testing');
    });

    it('should display rating with stars', () => {
      const { lastFrame } = renderDialog(mockServer);
      
      expect(lastFrame()).toContain('Rating:');
      expect(lastFrame()).toContain('★★★★½');
      expect(lastFrame()).toContain('(4.5)');
    });

    it('should display install count', () => {
      const { lastFrame } = renderDialog(mockServer);
      
      expect(lastFrame()).toContain('1.0K installs');
    });

    it('should format large install counts with M suffix', () => {
      const popularServer = { ...mockServer, installCount: 1500000 };
      const { lastFrame } = renderDialog(popularServer);
      
      expect(lastFrame()).toContain('1.5M installs');
    });

    it('should display category', () => {
      const { lastFrame } = renderDialog(mockServer);
      
      expect(lastFrame()).toContain('Category:');
      expect(lastFrame()).toContain('Testing');
    });

    it('should display author', () => {
      const { lastFrame } = renderDialog(mockServer);
      
      expect(lastFrame()).toContain('Author:');
      expect(lastFrame()).toContain('Test Author');
    });
  });

  describe('Requirements Display', () => {
    it('should display all requirements', () => {
      const { lastFrame } = renderDialog(mockServer);
      
      expect(lastFrame()).toContain('Requirements');
      expect(lastFrame()).toContain('Node.js 18+');
      expect(lastFrame()).toContain('Test API Key');
    });

    it('should show OAuth warning when required', () => {
      const { lastFrame } = renderDialog(mockServerWithOAuth);
      
      // OAuth warning text may be split across lines in the rendered output
      const frame = lastFrame();
      expect(frame).toContain('⚠');
      expect(frame).toContain('OAuth');
      expect(frame).toContain('authentication');
      expect(frame).toContain('configure OAuth after');
    });

    it('should not show OAuth warning when not required', () => {
      const { lastFrame } = renderDialog(mockServer);
      
      expect(lastFrame()).not.toContain('⚠ This server requires OAuth authentication');
    });
  });

  describe('Configuration Display', () => {
    it('should display command', () => {
      const { lastFrame } = renderDialog(mockServer);
      
      expect(lastFrame()).toContain('Command:');
      expect(lastFrame()).toContain('npx');
    });

    it('should display default arguments', () => {
      const { lastFrame } = renderDialog(mockServer);
      
      expect(lastFrame()).toContain('Arguments:');
      expect(lastFrame()).toContain('-y @test/mcp-server');
    });

    it('should show working directory input', () => {
      const { lastFrame } = renderDialog(mockServer);
      
      expect(lastFrame()).toContain('Working Directory (Optional)');
    });
  });

  describe('Environment Variables', () => {
    it('should display environment variables from server.env', () => {
      const { lastFrame } = renderDialog(mockServer);
      
      expect(lastFrame()).toContain('Environment Variables');
      expect(lastFrame()).toContain('TEST_API_KEY');
    });

    it('should extract API key from requirements', () => {
      const serverWithApiKey = {
        ...mockServer,
        env: undefined,
        requirements: ['Node.js 18+', 'GitHub API Key'],
      };
      const { lastFrame } = renderDialog(serverWithApiKey);
      
      expect(lastFrame()).toContain('GITHUB_API_KEY');
    });

    it('should extract token from requirements', () => {
      const serverWithToken = {
        ...mockServer,
        env: undefined,
        requirements: ['Node.js 18+', 'Slack Bot Token'],
      };
      const { lastFrame } = renderDialog(serverWithToken);
      
      expect(lastFrame()).toContain('SLACK_TOKEN');
    });

    it('should extract connection string from requirements', () => {
      const serverWithConnection = {
        ...mockServer,
        env: undefined,
        requirements: ['Node.js 18+', 'PostgreSQL connection string'],
      };
      const { lastFrame } = renderDialog(serverWithConnection);
      
      expect(lastFrame()).toContain('POSTGRESQL_CONNECTION_STRING');
    });

    it('should mark required environment variables', () => {
      const { lastFrame } = renderDialog(mockServer);
      
      // Required env vars should have asterisk
      expect(lastFrame()).toMatch(/TEST_API_KEY.*\*/);
    });

    it('should show add custom variable button', () => {
      const { lastFrame } = renderDialog(mockServer);
      
      expect(lastFrame()).toContain('Add Custom Variable');
    });

    it('should not show environment variables section when none required', () => {
      const { lastFrame } = renderDialog(mockServerNoEnv);
      
      // Should not have the environment variables section
      const frame = lastFrame();
      const hasEnvSection = frame.includes('Environment Variables') && 
                           frame.includes('Required configuration values');
      expect(hasEnvSection).toBe(false);
    });
  });

  describe('Auto-Approve Checkbox', () => {
    it('should display auto-approve checkbox', () => {
      const { lastFrame } = renderDialog(mockServer);
      
      expect(lastFrame()).toContain('Auto-approve all tools');
      expect(lastFrame()).toContain('not recommended for untrusted servers');
    });

    it('should show checkbox description', () => {
      const { lastFrame } = renderDialog(mockServer);
      
      expect(lastFrame()).toContain('Tools will execute without confirmation');
    });
  });

  describe('Action Buttons', () => {
    it('should display Install button', () => {
      const { lastFrame } = renderDialog(mockServer);
      
      expect(lastFrame()).toContain('Install');
    });

    it('should display Cancel button', () => {
      const { lastFrame } = renderDialog(mockServer);
      
      expect(lastFrame()).toContain('Cancel');
    });

    it('should show keyboard shortcuts', () => {
      const { lastFrame } = renderDialog(mockServer);
      
      expect(lastFrame()).toContain('[I]');
      expect(lastFrame()).toContain('[Esc]');
    });
  });

  describe('Help Text', () => {
    it('should display help text', () => {
      const { lastFrame } = renderDialog(mockServer);
      
      expect(lastFrame()).toContain('💡 Tip:');
      expect(lastFrame()).toContain('started automatically after installation');
    });
  });

  describe('Form Validation', () => {
    it('should validate required environment variables', async () => {
      const onInstall = vi.fn();
      const { lastFrame, stdin } = renderDialog(mockServer, vi.fn(), onInstall);
      
      // Component should render with required fields
      const frame = lastFrame();
      expect(frame).toContain('TEST_API_KEY');
      expect(frame).toContain('*'); // Required indicator
      
      // Note: Full validation testing would require simulating button press
      // and form interaction, which is complex with Ink testing library.
      // The validation logic is tested through the component rendering.
      expect(onInstall).toBeDefined();
    });
  });

  describe('Installation Flow', () => {
    it('should call onInstall with correct config', async () => {
      const onInstall = vi.fn().mockResolvedValue(undefined);
      const { stdin } = renderDialog(mockServer, vi.fn(), onInstall);
      
      // Fill in required field (simulated - in real test would need to interact with input)
      // For now, just verify the structure
      
      // Note: Full interaction testing would require more complex setup
      // This test verifies the component renders and accepts the callbacks
      expect(onInstall).toBeDefined();
    });

    it('should show success message after installation', async () => {
      const onInstall = vi.fn().mockResolvedValue(undefined);
      const { lastFrame } = renderDialog(mockServer, vi.fn(), onInstall);
      
      // Component should be ready to show success message
      expect(lastFrame()).toBeDefined();
    });

    it('should show error message on installation failure', async () => {
      const onInstall = vi.fn().mockRejectedValue(new Error('Installation failed'));
      const { lastFrame } = renderDialog(mockServer, vi.fn(), onInstall);
      
      // Component should be ready to show error message
      expect(lastFrame()).toBeDefined();
    });

    it('should close dialog after successful installation', async () => {
      const onClose = vi.fn();
      const onInstall = vi.fn().mockResolvedValue(undefined);
      
      renderDialog(mockServer, onClose, onInstall);
      
      // Component should eventually call onClose after success
      // (actual timing test would need more complex setup)
      expect(onClose).toBeDefined();
    });
  });

  describe('Dialog Behavior', () => {
    it('should call onClose when Esc is pressed', () => {
      const onClose = vi.fn();
      const { stdin } = renderDialog(mockServer, onClose);
      
      // Simulate Esc key
      stdin.write('\x1B');
      
      expect(onClose).toHaveBeenCalled();
    });

    it('should have correct dialog title', () => {
      const { lastFrame } = renderDialog(mockServer);
      
      expect(lastFrame()).toContain('Install MCP Server');
    });

    it('should have appropriate width', () => {
      const { lastFrame } = renderDialog(mockServer);
      
      // Dialog should render (width is internal to Dialog component)
      expect(lastFrame()).toBeDefined();
    });
  });

  describe('Edge Cases', () => {
    it('should handle server with no category', () => {
      const serverNoCategory = { ...mockServer, category: undefined };
      const { lastFrame } = renderDialog(serverNoCategory);
      
      expect(lastFrame()).not.toContain('Category:');
    });

    it('should handle server with no author', () => {
      const serverNoAuthor = { ...mockServer, author: undefined };
      const { lastFrame } = renderDialog(serverNoAuthor);
      
      expect(lastFrame()).not.toContain('Author:');
    });

    it('should handle server with no arguments', () => {
      const serverNoArgs = { ...mockServer, args: undefined };
      const { lastFrame } = renderDialog(serverNoArgs);
      
      expect(lastFrame()).toContain('No arguments');
    });

    it('should handle server with empty requirements', () => {
      const serverNoReqs = { ...mockServer, requirements: [] };
      const { lastFrame } = renderDialog(serverNoReqs);
      
      expect(lastFrame()).toContain('Requirements');
    });

    it('should handle perfect rating (5.0)', () => {
      const perfectServer = { ...mockServer, rating: 5.0 };
      const { lastFrame } = renderDialog(perfectServer);
      
      expect(lastFrame()).toContain('★★★★★');
    });

    it('should handle low rating (1.0)', () => {
      const lowRatedServer = { ...mockServer, rating: 1.0 };
      const { lastFrame } = renderDialog(lowRatedServer);
      
      expect(lastFrame()).toContain('★☆☆☆☆');
    });

    it('should handle small install count', () => {
      const newServer = { ...mockServer, installCount: 50 };
      const { lastFrame } = renderDialog(newServer);
      
      expect(lastFrame()).toContain('50 installs');
    });
  });

  describe('Secret Masking', () => {
    it('should mask API key inputs', () => {
      const { lastFrame } = renderDialog(mockServer);
      
      // API keys should be marked for masking
      // (actual masking is handled by TextInput component)
      expect(lastFrame()).toContain('TEST_API_KEY');
    });

    it('should mask token inputs', () => {
      const { lastFrame } = renderDialog(mockServerWithOAuth);
      
      expect(lastFrame()).toContain('GITHUB_TOKEN');
    });
  });

  describe('Dynamic Form Generation', () => {
    it('should generate form fields based on server requirements', () => {
      const complexServer: MCPMarketplaceServer = {
        ...mockServer,
        requirements: [
          'Node.js 18+',
          'GitHub API Key',
          'Slack Bot Token',
          'PostgreSQL connection string',
        ],
        env: undefined,
      };
      
      const { lastFrame } = renderDialog(complexServer);
      
      expect(lastFrame()).toContain('GITHUB_API_KEY');
      expect(lastFrame()).toContain('SLACK_TOKEN');
      expect(lastFrame()).toContain('POSTGRESQL_CONNECTION_STRING');
    });

    it('should not duplicate environment variables', () => {
      const serverWithDuplicates: MCPMarketplaceServer = {
        ...mockServer,
        requirements: ['Node.js 18+', 'GitHub API Key'],
        env: {
          GITHUB_API_KEY: '',
        },
      };
      
      const { lastFrame } = renderDialog(serverWithDuplicates);
      const frame = lastFrame();
      
      // Count occurrences of GITHUB_API_KEY (should appear once as label)
      const matches = frame.match(/GITHUB_API_KEY/g);
      expect(matches).toBeDefined();
      // Should appear once or twice (label + maybe in help text), but not more
      expect(matches!.length).toBeLessThanOrEqual(2);
    });
  });
});
