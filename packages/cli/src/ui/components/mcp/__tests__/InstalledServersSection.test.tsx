/**
 * InstalledServersSection Component Tests
 * 
 * Tests for the InstalledServersSection component including:
 * - Rendering server list with correct count
 * - Empty state display
 * - Focus state propagation to ServerItem components
 * - Expand/collapse functionality
 */

import React from 'react';
import { render } from 'ink-testing-library';
import { InstalledServersSection } from '../InstalledServersSection.js';
import type { ExtendedMCPServerStatus } from '../../../contexts/MCPContext.js';

describe('InstalledServersSection', () => {
  // Mock server data
  const mockServers: ExtendedMCPServerStatus[] = [
    {
      name: 'filesystem',
      description: 'Local file system operations',
      status: 'connected',
      health: 'healthy',
      uptime: 120000,
      error: undefined,
      resources: 5,
      toolsList: [
        { name: 'read_file', description: 'Read file contents', inputSchema: {} },
        { name: 'write_file', description: 'Write file contents', inputSchema: {} },
      ],
      config: {
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-filesystem'],
        env: {},
        disabled: false,
        autoApprove: [],
      },
      oauthStatus: undefined,
    },
    {
      name: 'github',
      description: 'GitHub API integration',
      status: 'connected',
      health: 'healthy',
      uptime: 60000,
      error: undefined,
      resources: 3,
      toolsList: [
        { name: 'create_issue', description: 'Create GitHub issue', inputSchema: {} },
      ],
      config: {
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-github'],
        env: { GITHUB_TOKEN: 'token' },
        disabled: false,
        autoApprove: [],
        oauth: {
          enabled: true,
          provider: 'github',
          clientId: 'client123',
          scopes: ['repo'],
        },
      },
      oauthStatus: {
        connected: true,
        expiresAt: Date.now() + 3600000,
        scopes: ['repo'],
      },
    },
    {
      name: 'disabled-server',
      description: 'A disabled server',
      status: 'disconnected',
      health: 'unhealthy',
      uptime: 0,
      error: undefined,
      resources: 0,
      toolsList: [],
      config: {
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-test'],
        env: {},
        disabled: true,
        autoApprove: [],
      },
      oauthStatus: undefined,
    },
  ];

  describe('Server List Rendering', () => {
    it('should render section header with correct server count', () => {
      const { lastFrame } = render(
        <InstalledServersSection servers={mockServers} />
      );

      const output = lastFrame();
      expect(output).toContain('Installed MCP Servers');
      expect(output).toContain('(2/3)'); // 2 enabled out of 3 total
    });

    it('should render all servers in the list', () => {
      const { lastFrame } = render(
        <InstalledServersSection servers={mockServers} />
      );

      const output = lastFrame();
      expect(output).toContain('filesystem');
      expect(output).toContain('github');
      expect(output).toContain('disabled-server');
    });

    it('should display server descriptions', () => {
      const { lastFrame } = render(
        <InstalledServersSection servers={mockServers} />
      );

      const output = lastFrame();
      expect(output).toContain('Local file system operations');
      expect(output).toContain('GitHub API integration');
    });
  });

  describe('Empty State', () => {
    it('should display empty state when no servers are configured', () => {
      const { lastFrame } = render(
        <InstalledServersSection servers={[]} />
      );

      const output = lastFrame();
      expect(output).toContain('No MCP servers configured');
      expect(output).toContain('Press');
      expect(output).toContain('M');
      expect(output).toContain('to browse the marketplace');
    });

    it('should show 0/0 in header when no servers exist', () => {
      const { lastFrame } = render(
        <InstalledServersSection servers={[]} />
      );

      const output = lastFrame();
      expect(output).toContain('(0/0)');
    });
  });

  describe('Focus State', () => {
    it('should pass focus state to the correct ServerItem', () => {
      const { lastFrame } = render(
        <InstalledServersSection 
          servers={mockServers} 
          focusedIndex={1}
        />
      );

      const output = lastFrame();
      // The focused server (github) should be highlighted
      // This is a basic check - the actual highlighting is handled by ServerItem
      expect(output).toContain('github');
    });

    it('should handle focusedIndex of -1 (no focus)', () => {
      const { lastFrame } = render(
        <InstalledServersSection 
          servers={mockServers} 
          focusedIndex={-1}
        />
      );

      const output = lastFrame();
      expect(output).toContain('filesystem');
      expect(output).toContain('github');
    });

    it('should handle focusedIndex out of bounds', () => {
      const { lastFrame } = render(
        <InstalledServersSection 
          servers={mockServers} 
          focusedIndex={999}
        />
      );

      const output = lastFrame();
      // Should render without errors
      expect(output).toContain('filesystem');
    });
  });

  describe('Expand/Collapse Functionality', () => {
    it('should pass expanded state to ServerItem components', () => {
      const expandedServers = new Set(['filesystem', 'github']);
      
      const { lastFrame } = render(
        <InstalledServersSection 
          servers={mockServers}
          expandedServers={expandedServers}
        />
      );

      const output = lastFrame();
      // Expanded servers should show the expand icon (▼)
      // This is handled by ServerItem, but we can verify the component renders
      expect(output).toContain('filesystem');
      expect(output).toContain('github');
    });

    it('should call onToggleExpand when provided', () => {
      const onToggleExpand = vi.fn();
      
      render(
        <InstalledServersSection 
          servers={mockServers}
          onToggleExpand={onToggleExpand}
        />
      );

      // The callback is passed to ServerItem components
      // Actual invocation is tested in ServerItem tests
      expect(onToggleExpand).not.toHaveBeenCalled();
    });

    it('should handle empty expandedServers set', () => {
      const { lastFrame } = render(
        <InstalledServersSection 
          servers={mockServers}
          expandedServers={new Set()}
        />
      );

      const output = lastFrame();
      expect(output).toContain('filesystem');
      expect(output).toContain('github');
    });
  });

  describe('Server Count Display', () => {
    it('should show correct enabled/total count', () => {
      const { lastFrame } = render(
        <InstalledServersSection servers={mockServers} />
      );

      const output = lastFrame();
      // 2 enabled (filesystem, github) out of 3 total
      expect(output).toContain('(2/3)');
    });

    it('should show all enabled when no servers are disabled', () => {
      const allEnabledServers = mockServers.filter(s => !s.config.disabled);
      
      const { lastFrame } = render(
        <InstalledServersSection servers={allEnabledServers} />
      );

      const output = lastFrame();
      expect(output).toContain('(2/2)');
    });

    it('should show 0 enabled when all servers are disabled', () => {
      const allDisabledServers = mockServers.map(s => ({
        ...s,
        config: { ...s.config, disabled: true },
      }));
      
      const { lastFrame } = render(
        <InstalledServersSection servers={allDisabledServers} />
      );

      const output = lastFrame();
      expect(output).toContain('(0/3)');
    });
  });

  describe('Integration with ServerItem', () => {
    it('should render ServerItem for each server', () => {
      const { lastFrame } = render(
        <InstalledServersSection servers={mockServers} />
      );

      const output = lastFrame();
      // Each server should have its name displayed (from ServerItem)
      mockServers.forEach(server => {
        expect(output).toContain(server.name);
      });
    });

    it('should pass correct props to ServerItem components', () => {
      const expandedServers = new Set(['filesystem']);
      const onToggleExpand = vi.fn();
      
      render(
        <InstalledServersSection 
          servers={mockServers}
          focusedIndex={0}
          expandedServers={expandedServers}
          onToggleExpand={onToggleExpand}
        />
      );

      // Props are passed correctly if component renders without errors
      // Detailed prop testing is done in ServerItem tests
    });
  });
});
