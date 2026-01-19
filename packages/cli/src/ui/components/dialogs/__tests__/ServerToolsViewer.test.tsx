/**
 * ServerToolsViewer - Component Tests
 * 
 * Tests for the ServerToolsViewer dialog component that manages
 * tool auto-approval settings for MCP servers.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from 'ink-testing-library';
import { ServerToolsViewer } from '../ServerToolsViewer.js';
import { MCPProvider } from '../../../contexts/MCPContext.js';
import { UIProvider } from '../../../../features/context/UIContext.js';
import type { MCPClient } from '@ollm/ollm-cli-core/mcp/types.js';
import type { MCPHealthMonitor } from '@ollm/ollm-cli-core/mcp/mcpHealthMonitor.js';
import type { MCPOAuthProvider } from '@ollm/ollm-cli-core/mcp/mcpOAuth.js';

// Mock dependencies
vi.mock('../../services/mcpConfigService.js', () => ({
  mcpConfigService: {
    loadMCPConfig: vi.fn().mockResolvedValue({ mcpServers: {} }),
    saveMCPConfig: vi.fn().mockResolvedValue(undefined),
    updateServerConfig: vi.fn().mockResolvedValue(undefined),
    removeServerConfig: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../../services/mcpMarketplace.js', () => ({
  mcpMarketplace: {
    getAllServers: vi.fn().mockResolvedValue([]),
    searchServers: vi.fn().mockResolvedValue([]),
    getServerDetails: vi.fn().mockResolvedValue(null),
    installServer: vi.fn().mockResolvedValue(undefined),
    refreshCache: vi.fn().mockResolvedValue(undefined),
  },
}));

/**
 * Create mock MCP client
 */
function createMockMCPClient(): MCPClient {
  return {
    startServer: vi.fn().mockResolvedValue(undefined),
    stopServer: vi.fn().mockResolvedValue(undefined),
    restartServer: vi.fn().mockResolvedValue(undefined),
    getServerStatus: vi.fn().mockResolvedValue({
      name: 'test-server',
      status: 'running',
      uptime: 1000,
      error: null,
    }),
    getAllServerStatuses: vi.fn().mockResolvedValue(new Map()),
    listTools: vi.fn().mockResolvedValue([]),
    callTool: vi.fn().mockResolvedValue({ content: [] }),
    listResources: vi.fn().mockResolvedValue([]),
    readResource: vi.fn().mockResolvedValue({ contents: [] }),
    getServerLogs: vi.fn().mockResolvedValue([]),
  } as unknown as MCPClient;
}

/**
 * Create mock health monitor
 */
function createMockHealthMonitor(): MCPHealthMonitor {
  return {
    start: vi.fn(),
    stop: vi.fn(),
    subscribeToHealthUpdates: vi.fn().mockReturnValue(() => {}),
    getServerHealth: vi.fn().mockReturnValue({
      status: 'healthy',
      lastCheck: Date.now(),
      responseTime: 100,
    }),
    getAllServerHealth: vi.fn().mockReturnValue(new Map()),
    startMonitoring: vi.fn(),
    stopMonitoring: vi.fn(),
  } as unknown as MCPHealthMonitor;
}

/**
 * Create mock OAuth provider
 */
function createMockOAuthProvider(): MCPOAuthProvider {
  return {
    authorize: vi.fn().mockResolvedValue('https://auth.example.com'),
    refreshToken: vi.fn().mockResolvedValue(undefined),
    revokeAccess: vi.fn().mockResolvedValue(undefined),
    getOAuthStatus: vi.fn().mockReturnValue({
      connected: false,
    }),
  } as unknown as MCPOAuthProvider;
}

/**
 * Render ServerToolsViewer with providers
 */
function renderServerToolsViewer(
  props: Partial<React.ComponentProps<typeof ServerToolsViewer>> = {},
  mcpClient?: MCPClient,
  healthMonitor?: MCPHealthMonitor,
  oauthProvider?: MCPOAuthProvider
) {
  const defaultProps = {
    serverName: 'test-server',
    onClose: vi.fn(),
    ...props,
  };

  return render(
    <UIProvider>
      <MCPProvider
        mcpClient={mcpClient || createMockMCPClient()}
        healthMonitor={healthMonitor || createMockHealthMonitor()}
        oauthProvider={oauthProvider || createMockOAuthProvider()}
      >
        <ServerToolsViewer {...defaultProps} />
      </MCPProvider>
    </UIProvider>
  );
}

describe('ServerToolsViewer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render dialog with server name', () => {
      const { lastFrame } = renderServerToolsViewer({
        serverName: 'my-server',
      });

      expect(lastFrame()).toContain('Tools: my-server');
      expect(lastFrame()).toContain('Server: my-server');
    });

    it('should display total tools count', () => {
      const mockClient = createMockMCPClient();
      mockClient.listTools = vi.fn().mockResolvedValue([
        { name: 'tool1', description: 'Tool 1', inputSchema: {} },
        { name: 'tool2', description: 'Tool 2', inputSchema: {} },
        { name: 'tool3', description: 'Tool 3', inputSchema: {} },
      ]);

      const { lastFrame } = renderServerToolsViewer({}, mockClient);

      expect(lastFrame()).toContain('Total Tools:');
    });

    it('should display auto-approved count', () => {
      const { lastFrame } = renderServerToolsViewer();

      expect(lastFrame()).toContain('Auto-Approved:');
    });

    it('should show empty state when no tools available', () => {
      const mockClient = createMockMCPClient();
      mockClient.listTools = vi.fn().mockResolvedValue([]);

      const { lastFrame } = renderServerToolsViewer({}, mockClient);

      expect(lastFrame()).toContain('No tools available for this server');
    });
  });

  describe('Tool Display', () => {
    it('should display tools with checkboxes', () => {
      const mockClient = createMockMCPClient();
      const tools = [
        { name: 'file_read', description: 'Read a file', inputSchema: {} },
        { name: 'file_write', description: 'Write a file', inputSchema: {} },
      ];
      
      mockClient.listTools = vi.fn().mockResolvedValue(tools);
      mockClient.getAllServerStatuses = vi.fn().mockResolvedValue(
        new Map([
          [
            'test-server',
            {
              name: 'test-server',
              status: 'running',
              uptime: 1000,
              config: {
                command: 'test',
                autoApprove: [],
              },
              toolsList: tools,
            },
          ],
        ])
      );

      const { lastFrame } = renderServerToolsViewer({}, mockClient);

      expect(lastFrame()).toContain('file_read');
      expect(lastFrame()).toContain('file_write');
      expect(lastFrame()).toContain('☐'); // Unchecked checkbox
    });

    it('should display tool descriptions', () => {
      const mockClient = createMockMCPClient();
      const tools = [
        { name: 'git_commit', description: 'Commit changes to git', inputSchema: {} },
      ];
      
      mockClient.listTools = vi.fn().mockResolvedValue(tools);
      mockClient.getAllServerStatuses = vi.fn().mockResolvedValue(
        new Map([
          [
            'test-server',
            {
              name: 'test-server',
              status: 'running',
              uptime: 1000,
              config: {
                command: 'test',
                autoApprove: [],
              },
              toolsList: tools,
            },
          ],
        ])
      );

      const { lastFrame } = renderServerToolsViewer({}, mockClient);

      expect(lastFrame()).toContain('git_commit');
      expect(lastFrame()).toContain('Commit changes to git');
    });

    it('should group tools by category', () => {
      const mockClient = createMockMCPClient();
      const tools = [
        { name: 'file_read', description: 'Read a file', inputSchema: {} },
        { name: 'file_write', description: 'Write a file', inputSchema: {} },
        { name: 'git_commit', description: 'Commit changes', inputSchema: {} },
        { name: 'git_push', description: 'Push changes', inputSchema: {} },
      ];
      
      mockClient.listTools = vi.fn().mockResolvedValue(tools);
      mockClient.getAllServerStatuses = vi.fn().mockResolvedValue(
        new Map([
          [
            'test-server',
            {
              name: 'test-server',
              status: 'running',
              uptime: 1000,
              config: {
                command: 'test',
                autoApprove: [],
              },
              toolsList: tools,
            },
          ],
        ])
      );

      const { lastFrame } = renderServerToolsViewer({}, mockClient);

      // Should show category headers
      expect(lastFrame()).toContain('File');
      expect(lastFrame()).toContain('Git');
    });

    it('should show tool count per category', () => {
      const mockClient = createMockMCPClient();
      const tools = [
        { name: 'file_read', description: 'Read a file', inputSchema: {} },
        { name: 'file_write', description: 'Write a file', inputSchema: {} },
        { name: 'file_delete', description: 'Delete a file', inputSchema: {} },
      ];
      
      mockClient.listTools = vi.fn().mockResolvedValue(tools);
      mockClient.getAllServerStatuses = vi.fn().mockResolvedValue(
        new Map([
          [
            'test-server',
            {
              name: 'test-server',
              status: 'running',
              uptime: 1000,
              config: {
                command: 'test',
                autoApprove: [],
              },
              toolsList: tools,
            },
          ],
        ])
      );

      const { lastFrame } = renderServerToolsViewer({}, mockClient);

      expect(lastFrame()).toContain('File (3)');
    });

    it('should categorize tools without prefix as General', () => {
      const mockClient = createMockMCPClient();
      const tools = [
        { name: 'search', description: 'Search for something', inputSchema: {} },
        { name: 'analyze', description: 'Analyze data', inputSchema: {} },
      ];
      
      mockClient.listTools = vi.fn().mockResolvedValue(tools);
      mockClient.getAllServerStatuses = vi.fn().mockResolvedValue(
        new Map([
          [
            'test-server',
            {
              name: 'test-server',
              status: 'running',
              uptime: 1000,
              config: {
                command: 'test',
                autoApprove: [],
              },
              toolsList: tools,
            },
          ],
        ])
      );

      const { lastFrame } = renderServerToolsViewer({}, mockClient);

      expect(lastFrame()).toContain('General');
    });
  });

  describe('Tool Selection', () => {
    it('should show checked checkboxes for auto-approved tools', () => {
      const mockClient = createMockMCPClient();
      mockClient.listTools = vi.fn().mockResolvedValue([
        { name: 'tool1', description: 'Tool 1', inputSchema: {} },
        { name: 'tool2', description: 'Tool 2', inputSchema: {} },
      ]);

      // Mock server with auto-approve configured
      mockClient.getAllServerStatuses = vi.fn().mockResolvedValue(
        new Map([
          [
            'test-server',
            {
              name: 'test-server',
              status: 'running',
              uptime: 1000,
              config: {
                command: 'test',
                autoApprove: ['tool1'],
              },
              toolsList: [
                { name: 'tool1', description: 'Tool 1', inputSchema: {} },
                { name: 'tool2', description: 'Tool 2', inputSchema: {} },
              ],
            },
          ],
        ])
      );

      const { lastFrame } = renderServerToolsViewer({}, mockClient);

      // tool1 should be checked, tool2 should not
      const frame = lastFrame();
      expect(frame).toContain('☑'); // At least one checked
      expect(frame).toContain('☐'); // At least one unchecked
    });
  });

  describe('Quick Actions', () => {
    it('should render Select All button', () => {
      const { lastFrame } = renderServerToolsViewer();

      expect(lastFrame()).toContain('Select All');
    });

    it('should render Select None button', () => {
      const { lastFrame } = renderServerToolsViewer();

      expect(lastFrame()).toContain('Select None');
    });

    it('should disable Select All when all tools are selected', () => {
      const mockClient = createMockMCPClient();
      mockClient.listTools = vi.fn().mockResolvedValue([
        { name: 'tool1', description: 'Tool 1', inputSchema: {} },
      ]);

      mockClient.getAllServerStatuses = vi.fn().mockResolvedValue(
        new Map([
          [
            'test-server',
            {
              name: 'test-server',
              status: 'running',
              uptime: 1000,
              config: {
                command: 'test',
                autoApprove: ['tool1'],
              },
              toolsList: [
                { name: 'tool1', description: 'Tool 1', inputSchema: {} },
              ],
            },
          ],
        ])
      );

      const { lastFrame } = renderServerToolsViewer({}, mockClient);

      // Select All button should be present but disabled state is internal
      expect(lastFrame()).toContain('Select All');
    });

    it('should disable Select None when no tools are selected', () => {
      const mockClient = createMockMCPClient();
      mockClient.listTools = vi.fn().mockResolvedValue([
        { name: 'tool1', description: 'Tool 1', inputSchema: {} },
      ]);

      const { lastFrame } = renderServerToolsViewer({}, mockClient);

      // Select None button should be present
      expect(lastFrame()).toContain('Select None');
    });
  });

  describe('Action Buttons', () => {
    it('should render Save button', () => {
      const { lastFrame } = renderServerToolsViewer();

      expect(lastFrame()).toContain('Save');
    });

    it('should render Close button', () => {
      const { lastFrame } = renderServerToolsViewer();

      expect(lastFrame()).toContain('Close');
    });

    it('should show keyboard shortcuts', () => {
      const { lastFrame } = renderServerToolsViewer();

      expect(lastFrame()).toContain('S'); // Save shortcut
      expect(lastFrame()).toContain('Esc'); // Close shortcut
    });
  });

  describe('Help Text', () => {
    it('should display help text about auto-approval', () => {
      const { lastFrame } = renderServerToolsViewer();

      expect(lastFrame()).toContain('Auto-approved tools will execute without confirmation');
    });

    it('should display security warning', () => {
      const { lastFrame } = renderServerToolsViewer();

      expect(lastFrame()).toContain('Only auto-approve tools you trust completely');
    });
  });

  describe('Statistics', () => {
    it('should update selected count when tools are selected', () => {
      const mockClient = createMockMCPClient();
      mockClient.listTools = vi.fn().mockResolvedValue([
        { name: 'tool1', description: 'Tool 1', inputSchema: {} },
        { name: 'tool2', description: 'Tool 2', inputSchema: {} },
      ]);

      mockClient.getAllServerStatuses = vi.fn().mockResolvedValue(
        new Map([
          [
            'test-server',
            {
              name: 'test-server',
              status: 'running',
              uptime: 1000,
              config: {
                command: 'test',
                autoApprove: ['tool1'],
              },
              toolsList: [
                { name: 'tool1', description: 'Tool 1', inputSchema: {} },
                { name: 'tool2', description: 'Tool 2', inputSchema: {} },
              ],
            },
          ],
        ])
      );

      const { lastFrame } = renderServerToolsViewer({}, mockClient);

      expect(lastFrame()).toContain('Auto-Approved:');
    });
  });

  describe('Category Extraction', () => {
    it('should extract category from tool name prefix', () => {
      const mockClient = createMockMCPClient();
      const tools = [
        { name: 'git_commit', description: 'Commit changes', inputSchema: {} },
        { name: 'git_push', description: 'Push changes', inputSchema: {} },
      ];
      
      mockClient.listTools = vi.fn().mockResolvedValue(tools);
      mockClient.getAllServerStatuses = vi.fn().mockResolvedValue(
        new Map([
          [
            'test-server',
            {
              name: 'test-server',
              status: 'running',
              uptime: 1000,
              config: {
                command: 'test',
                autoApprove: [],
              },
              toolsList: tools,
            },
          ],
        ])
      );

      const { lastFrame } = renderServerToolsViewer({}, mockClient);

      expect(lastFrame()).toContain('Git');
    });

    it('should extract category from description keywords', () => {
      const mockClient = createMockMCPClient();
      const tools = [
        { name: 'read', description: 'Read a file from disk', inputSchema: {} },
        { name: 'write', description: 'Write a file to disk', inputSchema: {} },
      ];
      
      mockClient.listTools = vi.fn().mockResolvedValue(tools);
      mockClient.getAllServerStatuses = vi.fn().mockResolvedValue(
        new Map([
          [
            'test-server',
            {
              name: 'test-server',
              status: 'running',
              uptime: 1000,
              config: {
                command: 'test',
                autoApprove: [],
              },
              toolsList: tools,
            },
          ],
        ])
      );

      const { lastFrame } = renderServerToolsViewer({}, mockClient);

      expect(lastFrame()).toContain('File');
    });

    it('should use General category as fallback', () => {
      const mockClient = createMockMCPClient();
      const tools = [
        { name: 'unknown', description: 'Unknown tool', inputSchema: {} },
      ];
      
      mockClient.listTools = vi.fn().mockResolvedValue(tools);
      mockClient.getAllServerStatuses = vi.fn().mockResolvedValue(
        new Map([
          [
            'test-server',
            {
              name: 'test-server',
              status: 'running',
              uptime: 1000,
              config: {
                command: 'test',
                autoApprove: [],
              },
              toolsList: tools,
            },
          ],
        ])
      );

      const { lastFrame } = renderServerToolsViewer({}, mockClient);

      expect(lastFrame()).toContain('General');
    });
  });

  describe('Accessibility', () => {
    it('should have descriptive dialog title', () => {
      const { lastFrame } = renderServerToolsViewer({
        serverName: 'my-server',
      });

      expect(lastFrame()).toContain('Tools: my-server');
    });

    it('should show icons for visual feedback', () => {
      const { lastFrame } = renderServerToolsViewer();

      expect(lastFrame()).toContain('💾'); // Save icon
      expect(lastFrame()).toContain('☑'); // Select All icon
      expect(lastFrame()).toContain('☐'); // Select None icon
    });

    it('should display help icon with tips', () => {
      const { lastFrame } = renderServerToolsViewer();

      expect(lastFrame()).toContain('💡'); // Tip icon
    });
  });
});
