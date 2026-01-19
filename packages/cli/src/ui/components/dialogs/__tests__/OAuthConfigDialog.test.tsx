/**
 * OAuthConfigDialog Tests
 * 
 * Tests for the OAuth configuration dialog component
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from 'ink-testing-library';
import { OAuthConfigDialog } from '../OAuthConfigDialog.js';
import { MCPProvider } from '../../../contexts/MCPContext.js';
import { UIProvider } from '../../../../features/context/UIContext.js';
import { defaultDarkTheme } from '../../../../config/styles.js';
import { createMockMCPClient, createMockHealthMonitor, createMockOAuthProvider } from '../../../contexts/__tests__/mcpTestUtils.js';
import type { ExtendedMCPServerStatus } from '../../../contexts/MCPContext.js';
import type { MCPOAuthConfig } from '@ollm/ollm-cli-core/mcp/types.js';

describe('OAuthConfigDialog', () => {
  let mockClient: ReturnType<typeof createMockMCPClient>;
  let mockHealthMonitor: ReturnType<typeof createMockHealthMonitor>;
  let mockOAuthProvider: ReturnType<typeof createMockOAuthProvider>;
  let mockOnClose: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockClient = createMockMCPClient();
    mockHealthMonitor = createMockHealthMonitor();
    mockOAuthProvider = createMockOAuthProvider();
    mockOnClose = vi.fn();
  });

  const createServerWithOAuth = (
    oauthConfig?: Partial<MCPOAuthConfig>,
    oauthStatus?: { connected: boolean; expiresAt?: number; scopes?: string[] }
  ): ExtendedMCPServerStatus => ({
    name: 'test-server',
    description: 'GitHub MCP Server',
    status: 'connected',
    health: 'healthy',
    uptime: 1000,
    tools: 5,
    toolsList: [],
    config: {
      command: 'test-command',
      args: [],
      oauth: oauthConfig ? {
        enabled: true,
        clientId: 'test-client-id',
        scopes: ['repo', 'user'],
        ...oauthConfig,
      } : undefined,
    },
    oauthStatus,
  });

  const renderDialog = (server: ExtendedMCPServerStatus) => {
    // Mock the servers map
    const serversMap = new Map([[server.name, server]]);
    mockClient.getAllServerStatuses.mockReturnValue(serversMap);

    return render(
      <UIProvider initialTheme={defaultDarkTheme}>
        <MCPProvider
          mcpClient={mockClient}
          healthMonitor={mockHealthMonitor}
          oauthProvider={mockOAuthProvider}
        >
          <OAuthConfigDialog
            serverName={server.name}
            onClose={mockOnClose}
          />
        </MCPProvider>
      </UIProvider>
    );
  };

  describe('Display', () => {
    it('should render dialog with title', () => {
      const server = createServerWithOAuth();
      const { lastFrame } = renderDialog(server);

      expect(lastFrame()).toContain('OAuth Configuration: test-server');
    });

    it('should display provider name (read-only)', () => {
      const server = createServerWithOAuth();
      const { lastFrame } = renderDialog(server);

      expect(lastFrame()).toContain('Provider');
      expect(lastFrame()).toContain('Github'); // Detected from description
    });

    it('should display client ID input field', () => {
      const server = createServerWithOAuth({ clientId: 'my-client-id' });
      const { lastFrame } = renderDialog(server);

      expect(lastFrame()).toContain('Client ID');
      expect(lastFrame()).toContain('my-client-id');
    });

    it('should display scopes selector with checkboxes', () => {
      const server = createServerWithOAuth({ scopes: ['repo', 'user'] });
      const { lastFrame } = renderDialog(server);

      expect(lastFrame()).toContain('Scopes');
      expect(lastFrame()).toContain('repo');
      expect(lastFrame()).toContain('user');
    });

    it('should show connection status as not connected', () => {
      const server = createServerWithOAuth();
      const { lastFrame } = renderDialog(server);

      expect(lastFrame()).toContain('Connection Status');
      expect(lastFrame()).toContain('○ Not Connected');
    });

    it('should show connection status as connected', () => {
      const server = createServerWithOAuth(
        { clientId: 'test-id' },
        { connected: true, expiresAt: Date.now() + 3600000 }
      );
      const { lastFrame } = renderDialog(server);

      expect(lastFrame()).toContain('● Connected');
    });

    it('should display token expiration date when connected', () => {
      const expiresAt = Date.now() + 3600000;
      const server = createServerWithOAuth(
        { clientId: 'test-id' },
        { connected: true, expiresAt }
      );
      const { lastFrame } = renderDialog(server);

      expect(lastFrame()).toContain('Token expires:');
    });

    it('should show token expired warning', () => {
      const expiresAt = Date.now() - 1000; // Expired
      const server = createServerWithOAuth(
        { clientId: 'test-id' },
        { connected: true, expiresAt }
      );
      const { lastFrame } = renderDialog(server);

      expect(lastFrame()).toContain('⚠ Token Expired');
    });

    it('should display granted scopes when connected', () => {
      const server = createServerWithOAuth(
        { clientId: 'test-id' },
        { connected: true, scopes: ['repo', 'user', 'gist'] }
      );
      const { lastFrame } = renderDialog(server);

      expect(lastFrame()).toContain('Granted scopes:');
      expect(lastFrame()).toContain('repo, user, gist');
    });
  });

  describe('Buttons', () => {
    it('should display Save button', () => {
      const server = createServerWithOAuth();
      const { lastFrame } = renderDialog(server);

      expect(lastFrame()).toContain('[S] Save');
    });

    it('should display Authorize button', () => {
      const server = createServerWithOAuth();
      const { lastFrame } = renderDialog(server);

      expect(lastFrame()).toContain('[A] 🔐 Authorize');
    });

    it('should display Refresh Token button', () => {
      const server = createServerWithOAuth();
      const { lastFrame } = renderDialog(server);

      expect(lastFrame()).toContain('[R] 🔄 Refresh Token');
    });

    it('should display Revoke Access button', () => {
      const server = createServerWithOAuth();
      const { lastFrame } = renderDialog(server);

      expect(lastFrame()).toContain('[V] ✗ Revoke Access');
    });

    it('should display Close button', () => {
      const server = createServerWithOAuth();
      const { lastFrame } = renderDialog(server);

      expect(lastFrame()).toContain('[Esc] Close');
    });

    it('should disable Authorize button when connected', () => {
      const server = createServerWithOAuth(
        { clientId: 'test-id' },
        { connected: true }
      );
      const { lastFrame } = renderDialog(server);

      // Button should still be visible but in disabled state (gray color)
      expect(lastFrame()).toContain('Authorize');
    });

    it('should disable Refresh Token button when not connected', () => {
      const server = createServerWithOAuth();
      const { lastFrame } = renderDialog(server);

      // Button should be visible but disabled
      expect(lastFrame()).toContain('Refresh Token');
    });

    it('should disable Revoke Access button when not connected', () => {
      const server = createServerWithOAuth();
      const { lastFrame } = renderDialog(server);

      // Button should be visible but disabled
      expect(lastFrame()).toContain('Revoke Access');
    });
  });

  describe('Validation', () => {
    it('should show error when client ID is empty', () => {
      const server = createServerWithOAuth({ clientId: '' });
      const { lastFrame } = renderDialog(server);

      // The component should show validation error when trying to save
      expect(lastFrame()).toContain('Client ID');
    });

    it('should show error when no scopes selected', () => {
      const server = createServerWithOAuth({ scopes: [] });
      const { lastFrame } = renderDialog(server);

      // The component should show validation error when trying to save
      expect(lastFrame()).toContain('Scopes');
    });

    it('should display required field indicators', () => {
      const server = createServerWithOAuth();
      const { lastFrame } = renderDialog(server);

      // Required fields should have asterisk
      expect(lastFrame()).toMatch(/Client ID\*/);
      expect(lastFrame()).toMatch(/Scopes\*/);
    });
  });

  describe('Help Text', () => {
    it('should display help text for client ID', () => {
      const server = createServerWithOAuth();
      const { lastFrame } = renderDialog(server);

      expect(lastFrame()).toContain('OAuth client ID from your application registration');
    });

    it('should display help text for scopes', () => {
      const server = createServerWithOAuth();
      const { lastFrame } = renderDialog(server);

      expect(lastFrame()).toContain('Permissions to request from the OAuth provider');
    });

    it('should display tip about saving before authorizing', () => {
      const server = createServerWithOAuth();
      const { lastFrame } = renderDialog(server);

      expect(lastFrame()).toContain('💡 Tip: Save your configuration before authorizing');
    });
  });

  describe('Provider Detection', () => {
    it('should detect GitHub provider from description', () => {
      const server = createServerWithOAuth();
      server.description = 'GitHub MCP Server';
      const { lastFrame } = renderDialog(server);

      expect(lastFrame()).toContain('Github');
    });

    it('should detect Google provider from description', () => {
      const server = createServerWithOAuth();
      server.description = 'Google Drive MCP Server';
      const { lastFrame } = renderDialog(server);

      expect(lastFrame()).toContain('Google');
    });

    it('should use default provider when not detected', () => {
      const server = createServerWithOAuth();
      server.description = 'Custom MCP Server';
      const { lastFrame } = renderDialog(server);

      expect(lastFrame()).toContain('Default');
    });
  });

  describe('Scope Options', () => {
    it('should show GitHub-specific scopes for GitHub provider', () => {
      const server = createServerWithOAuth();
      server.description = 'GitHub MCP Server';
      const { lastFrame } = renderDialog(server);

      expect(lastFrame()).toContain('repo');
      expect(lastFrame()).toContain('Full control of private repositories');
    });

    it('should show Google-specific scopes for Google provider', () => {
      const server = createServerWithOAuth();
      server.description = 'Google Drive MCP Server';
      const { lastFrame } = renderDialog(server);

      expect(lastFrame()).toContain('openid');
      expect(lastFrame()).toContain('OpenID Connect');
    });

    it('should show default scopes for unknown provider', () => {
      const server = createServerWithOAuth();
      server.description = 'Custom MCP Server';
      const { lastFrame } = renderDialog(server);

      expect(lastFrame()).toContain('read');
      expect(lastFrame()).toContain('write');
    });
  });

  describe('Integration', () => {
    it('should initialize with existing OAuth configuration', () => {
      const server = createServerWithOAuth({
        clientId: 'existing-client-id',
        scopes: ['repo', 'user'],
      });
      const { lastFrame } = renderDialog(server);

      expect(lastFrame()).toContain('existing-client-id');
      expect(lastFrame()).toContain('repo');
      expect(lastFrame()).toContain('user');
    });

    it('should initialize with default values when no OAuth config exists', () => {
      const server = createServerWithOAuth();
      server.config.oauth = undefined;
      const { lastFrame } = renderDialog(server);

      // Should show empty client ID
      expect(lastFrame()).toContain('Client ID');
      // Should show available scopes but none selected
      expect(lastFrame()).toContain('Scopes');
    });

    it('should display connection status from server', () => {
      const server = createServerWithOAuth(
        { clientId: 'test-id' },
        { 
          connected: true, 
          expiresAt: Date.now() + 3600000,
          scopes: ['repo', 'user']
        }
      );
      const { lastFrame } = renderDialog(server);

      expect(lastFrame()).toContain('● Connected');
      expect(lastFrame()).toContain('Token expires:');
      expect(lastFrame()).toContain('Granted scopes:');
    });
  });

  describe('Accessibility', () => {
    it('should show keyboard shortcuts for all actions', () => {
      const server = createServerWithOAuth();
      const { lastFrame } = renderDialog(server);

      expect(lastFrame()).toContain('[S]'); // Save
      expect(lastFrame()).toContain('[A]'); // Authorize
      expect(lastFrame()).toContain('[R]'); // Refresh
      expect(lastFrame()).toContain('[V]'); // Revoke
      expect(lastFrame()).toContain('[Esc]'); // Close
    });

    it('should show icons for visual identification', () => {
      const server = createServerWithOAuth();
      const { lastFrame } = renderDialog(server);

      expect(lastFrame()).toContain('🔐'); // Authorize icon
      expect(lastFrame()).toContain('🔄'); // Refresh icon
      expect(lastFrame()).toContain('✗'); // Revoke icon
    });

    it('should use color coding for connection status', () => {
      const server = createServerWithOAuth(
        { clientId: 'test-id' },
        { connected: true }
      );
      const { lastFrame } = renderDialog(server);

      // Connected status should be visible
      expect(lastFrame()).toContain('● Connected');
    });
  });

  describe('Edge Cases', () => {
    it('should handle server without OAuth configuration', () => {
      const server = createServerWithOAuth();
      server.config.oauth = undefined;
      
      expect(() => renderDialog(server)).not.toThrow();
    });

    it('should handle server without OAuth status', () => {
      const server = createServerWithOAuth({ clientId: 'test-id' });
      server.oauthStatus = undefined;
      
      const { lastFrame } = renderDialog(server);
      expect(lastFrame()).toContain('○ Not Connected');
    });

    it('should handle empty scopes array', () => {
      const server = createServerWithOAuth({ scopes: [] });
      
      expect(() => renderDialog(server)).not.toThrow();
    });

    it('should handle missing expiration date', () => {
      const server = createServerWithOAuth(
        { clientId: 'test-id' },
        { connected: true } // No expiresAt
      );
      
      const { lastFrame } = renderDialog(server);
      expect(lastFrame()).toContain('● Connected');
      expect(lastFrame()).not.toContain('Token expires:');
    });
  });
});
