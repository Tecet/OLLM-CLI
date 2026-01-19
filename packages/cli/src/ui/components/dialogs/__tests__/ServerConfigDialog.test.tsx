/**
 * ServerConfigDialog Tests
 * 
 * Tests for the server configuration dialog component
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from 'ink-testing-library';
import { ServerConfigDialog } from '../ServerConfigDialog.js';
import { MCPProvider } from '../../../contexts/MCPContext.js';
import { UIProvider } from '../../../../features/context/UIContext.js';
import { defaultDarkTheme } from '../../../../config/styles.js';
import type { MCPClient } from '@ollm/ollm-cli-core/mcp/types.js';
import type { MCPHealthMonitor } from '@ollm/ollm-cli-core/mcp/mcpHealthMonitor.js';
import type { MCPOAuthProvider } from '@ollm/ollm-cli-core/mcp/mcpOAuth.js';
import { createMockMCPClient, createMockHealthMonitor, createMockOAuthProvider } from '../../../contexts/__tests__/mcpTestUtils.js';

describe('ServerConfigDialog', () => {
  let mockClient: MCPClient;
  let mockHealthMonitor: MCPHealthMonitor;
  let mockOAuthProvider: MCPOAuthProvider;
  let mockOnClose: ReturnType<typeof vi.fn>;
  let mockOnSave: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockClient = createMockMCPClient();
    mockHealthMonitor = createMockHealthMonitor();
    mockOAuthProvider = createMockOAuthProvider();
    mockOnClose = vi.fn();
    mockOnSave = vi.fn().mockResolvedValue(undefined);
  });

  const renderDialog = (serverName: string = 'test-server') => {
    return render(
      <UIProvider initialTheme={defaultDarkTheme}>
        <MCPProvider
          mcpClient={mockClient}
          healthMonitor={mockHealthMonitor}
          oauthProvider={mockOAuthProvider}
        >
          <ServerConfigDialog
            serverName={serverName}
            onClose={mockOnClose}
            onSave={mockOnSave}
          />
        </MCPProvider>
      </UIProvider>
    );
  };

  describe('Rendering', () => {
    it('should render dialog with title', () => {
      const { lastFrame } = renderDialog('my-server');
      expect(lastFrame()).toContain('Configure Server: my-server');
    });

    it('should render command field', () => {
      const { lastFrame } = renderDialog();
      expect(lastFrame()).toContain('Command');
    });

    it('should render arguments field', () => {
      const { lastFrame } = renderDialog();
      expect(lastFrame()).toContain('Arguments');
    });

    it('should render working directory field', () => {
      const { lastFrame } = renderDialog();
      expect(lastFrame()).toContain('Working Directory');
    });

    it('should render environment variables section', () => {
      const { lastFrame } = renderDialog();
      expect(lastFrame()).toContain('Environment Variables');
    });

    it('should render action buttons', () => {
      const { lastFrame } = renderDialog();
      const frame = lastFrame();
      expect(frame).toContain('Save');
      expect(frame).toContain('Test Connection');
      expect(frame).toContain('Cancel');
    });
  });

  describe('Initial State', () => {
    it('should load existing server configuration', () => {
      // Mock server with existing config
      const mockGetAllServerStatuses = vi.fn().mockReturnValue(
        new Map([
          [
            'test-server',
            {
              name: 'test-server',
              status: 'connected',
              tools: 5,
              uptime: 1000,
              config: {
                command: 'uvx',
                args: ['mcp-server-git'],
                env: { API_KEY: 'secret123' },
                cwd: '/home/user/project',
              },
              health: 'healthy',
              toolsList: [
                { name: 'git-status', description: 'Get git status' },
                { name: 'git-commit', description: 'Commit changes' },
              ],
            },
          ],
        ])
      );
      mockClient.getAllServerStatuses = mockGetAllServerStatuses;

      const { lastFrame } = renderDialog('test-server');
      const frame = lastFrame();

      // Should show existing command
      expect(frame).toContain('uvx');
      // Should show existing args
      expect(frame).toContain('mcp-server-git');
    });

    it('should show empty form for new server', () => {
      const { lastFrame } = renderDialog('new-server');
      const frame = lastFrame();

      // Should have placeholder text
      expect(frame).toContain('e.g., uvx, node, python');
    });
  });

  describe('Environment Variables', () => {
    it('should display existing environment variables', () => {
      const mockGetAllServerStatuses = vi.fn().mockReturnValue(
        new Map([
          [
            'test-server',
            {
              name: 'test-server',
              status: 'connected',
              tools: 0,
              config: {
                command: 'node',
                args: [],
                env: {
                  NODE_ENV: 'production',
                  PORT: '3000',
                },
              },
              health: 'healthy',
              toolsList: [],
            },
          ],
        ])
      );
      mockClient.getAllServerStatuses = mockGetAllServerStatuses;

      const { lastFrame } = renderDialog('test-server');
      const frame = lastFrame();

      expect(frame).toContain('NODE_ENV');
      expect(frame).toContain('production');
      expect(frame).toContain('PORT');
      expect(frame).toContain('3000');
    });

    it('should mask secret environment variables', () => {
      const mockGetAllServerStatuses = vi.fn().mockReturnValue(
        new Map([
          [
            'test-server',
            {
              name: 'test-server',
              status: 'connected',
              tools: 0,
              config: {
                command: 'node',
                args: [],
                env: {
                  API_KEY: 'secret123',
                  DATABASE_PASSWORD: 'pass456',
                  GITHUB_TOKEN: 'ghp_token789',
                },
              },
              health: 'healthy',
              toolsList: [],
            },
          ],
        ])
      );
      mockClient.getAllServerStatuses = mockGetAllServerStatuses;

      const { lastFrame } = renderDialog('test-server');
      const frame = lastFrame();

      // Should show keys but mask values
      expect(frame).toContain('API_KEY');
      expect(frame).toContain('DATABASE_PASSWORD');
      expect(frame).toContain('GITHUB_TOKEN');

      // Should not show actual secret values
      expect(frame).not.toContain('secret123');
      expect(frame).not.toContain('pass456');
      expect(frame).not.toContain('ghp_token789');

      // Should show masked characters
      expect(frame).toContain('•');
    });

    it('should show Add Variable button', () => {
      const { lastFrame } = renderDialog();
      expect(lastFrame()).toContain('Add Variable');
    });

    it('should show Remove button for each variable', () => {
      const mockGetAllServerStatuses = vi.fn().mockReturnValue(
        new Map([
          [
            'test-server',
            {
              name: 'test-server',
              status: 'connected',
              tools: 0,
              config: {
                command: 'node',
                args: [],
                env: {
                  VAR1: 'value1',
                },
              },
              health: 'healthy',
              toolsList: [],
            },
          ],
        ])
      );
      mockClient.getAllServerStatuses = mockGetAllServerStatuses;

      const { lastFrame } = renderDialog('test-server');
      expect(lastFrame()).toContain('Remove');
    });
  });

  describe('Auto-Approve Tools', () => {
    it('should display available tools when server has tools', () => {
      const mockGetAllServerStatuses = vi.fn().mockReturnValue(
        new Map([
          [
            'test-server',
            {
              name: 'test-server',
              status: 'connected',
              tools: 2,
              config: {
                command: 'node',
                args: [],
              },
              health: 'healthy',
              toolsList: [
                { name: 'read-file', description: 'Read a file' },
                { name: 'write-file', description: 'Write to a file' },
              ],
            },
          ],
        ])
      );
      mockClient.getAllServerStatuses = mockGetAllServerStatuses;

      const { lastFrame } = renderDialog('test-server');
      const frame = lastFrame();

      expect(frame).toContain('Auto-Approve Tools');
      expect(frame).toContain('read-file');
      expect(frame).toContain('write-file');
    });

    it('should not display auto-approve section when no tools available', () => {
      const mockGetAllServerStatuses = vi.fn().mockReturnValue(
        new Map([
          [
            'test-server',
            {
              name: 'test-server',
              status: 'connected',
              tools: 0,
              config: {
                command: 'node',
                args: [],
              },
              health: 'healthy',
              toolsList: [],
            },
          ],
        ])
      );
      mockClient.getAllServerStatuses = mockGetAllServerStatuses;

      const { lastFrame } = renderDialog('test-server');
      const frame = lastFrame();

      // Should not show auto-approve section
      expect(frame).not.toContain('Auto-Approve Tools');
    });
  });

  describe('Validation', () => {
    it('should show required indicator for command field', () => {
      const { lastFrame } = renderDialog();
      const frame = lastFrame();

      // Should have asterisk for required field
      expect(frame).toContain('Command');
      expect(frame).toMatch(/Command.*\*/);
    });

    it('should show help text for fields', () => {
      const { lastFrame } = renderDialog();
      const frame = lastFrame();

      expect(frame).toContain('Executable command to start the MCP server');
      expect(frame).toContain('Space-separated command-line arguments');
      expect(frame).toContain('Key-value pairs for environment configuration');
    });
  });

  describe('Test Connection', () => {
    it('should show Test Connection button', () => {
      const { lastFrame } = renderDialog();
      expect(lastFrame()).toContain('Test Connection');
    });

    it('should show loading state when testing', async () => {
      const { lastFrame } = renderDialog();
      
      // Initial state should not show loading
      expect(lastFrame()).not.toContain('Loading...');
    });
  });

  describe('Actions', () => {
    it('should show Save button with shortcut', () => {
      const { lastFrame } = renderDialog();
      const frame = lastFrame();
      expect(frame).toContain('Save');
      expect(frame).toContain('[S]');
    });

    it('should show Cancel button with shortcut', () => {
      const { lastFrame } = renderDialog();
      const frame = lastFrame();
      expect(frame).toContain('Cancel');
      expect(frame).toContain('[Esc]');
    });

    it('should show Test Connection button with shortcut', () => {
      const { lastFrame } = renderDialog();
      const frame = lastFrame();
      expect(frame).toContain('Test Connection');
      expect(frame).toContain('[T]');
    });
  });

  describe('Secret Detection', () => {
    it('should detect API_KEY as secret', () => {
      const mockGetAllServerStatuses = vi.fn().mockReturnValue(
        new Map([
          [
            'test-server',
            {
              name: 'test-server',
              status: 'connected',
              tools: 0,
              config: {
                command: 'node',
                args: [],
                env: {
                  MY_API_KEY: 'secret',
                },
              },
              health: 'healthy',
              toolsList: [],
            },
          ],
        ])
      );
      mockClient.getAllServerStatuses = mockGetAllServerStatuses;

      const { lastFrame } = renderDialog('test-server');
      const frame = lastFrame();

      // Should mask the value
      expect(frame).toContain('•');
      expect(frame).not.toContain('secret');
    });

    it('should detect TOKEN as secret', () => {
      const mockGetAllServerStatuses = vi.fn().mockReturnValue(
        new Map([
          [
            'test-server',
            {
              name: 'test-server',
              status: 'connected',
              tools: 0,
              config: {
                command: 'node',
                args: [],
                env: {
                  GITHUB_TOKEN: 'ghp_123',
                },
              },
              health: 'healthy',
              toolsList: [],
            },
          ],
        ])
      );
      mockClient.getAllServerStatuses = mockGetAllServerStatuses;

      const { lastFrame } = renderDialog('test-server');
      const frame = lastFrame();

      expect(frame).toContain('•');
      expect(frame).not.toContain('ghp_123');
    });

    it('should detect PASSWORD as secret', () => {
      const mockGetAllServerStatuses = vi.fn().mockReturnValue(
        new Map([
          [
            'test-server',
            {
              name: 'test-server',
              status: 'connected',
              tools: 0,
              config: {
                command: 'node',
                args: [],
                env: {
                  DB_PASSWORD: 'pass123',
                },
              },
              health: 'healthy',
              toolsList: [],
            },
          ],
        ])
      );
      mockClient.getAllServerStatuses = mockGetAllServerStatuses;

      const { lastFrame } = renderDialog('test-server');
      const frame = lastFrame();

      expect(frame).toContain('•');
      expect(frame).not.toContain('pass123');
    });

    it('should detect SECRET as secret', () => {
      const mockGetAllServerStatuses = vi.fn().mockReturnValue(
        new Map([
          [
            'test-server',
            {
              name: 'test-server',
              status: 'connected',
              tools: 0,
              config: {
                command: 'node',
                args: [],
                env: {
                  APP_SECRET: 'secret123',
                },
              },
              health: 'healthy',
              toolsList: [],
            },
          ],
        ])
      );
      mockClient.getAllServerStatuses = mockGetAllServerStatuses;

      const { lastFrame } = renderDialog('test-server');
      const frame = lastFrame();

      expect(frame).toContain('•');
      expect(frame).not.toContain('secret123');
    });

    it('should not mask non-secret variables', () => {
      const mockGetAllServerStatuses = vi.fn().mockReturnValue(
        new Map([
          [
            'test-server',
            {
              name: 'test-server',
              status: 'connected',
              tools: 0,
              config: {
                command: 'node',
                args: [],
                env: {
                  NODE_ENV: 'production',
                  PORT: '3000',
                },
              },
              health: 'healthy',
              toolsList: [],
            },
          ],
        ])
      );
      mockClient.getAllServerStatuses = mockGetAllServerStatuses;

      const { lastFrame } = renderDialog('test-server');
      const frame = lastFrame();

      // Should show actual values for non-secrets
      expect(frame).toContain('production');
      expect(frame).toContain('3000');
    });
  });

  describe('Layout', () => {
    it('should have proper dialog width', () => {
      const { lastFrame } = renderDialog();
      // Dialog should be rendered (basic smoke test)
      expect(lastFrame()).toBeTruthy();
    });

    it('should have rounded border', () => {
      const { lastFrame } = renderDialog();
      const frame = lastFrame();
      // Check for rounded border characters
      expect(frame).toMatch(/[╭╮╯╰]/);
    });
  });
});
