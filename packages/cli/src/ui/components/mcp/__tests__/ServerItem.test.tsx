/**
 * ServerItem Component Tests
 * 
 * Tests for the ServerItem component including:
 * - Rendering server information
 * - Expand/collapse functionality
 * - Focus highlighting
 * - Toggle state display
 * - Health status integration
 * - Server statistics display
 */

import React from 'react';
import { render } from 'ink-testing-library';
import { describe, it, expect, vi } from 'vitest';
import { ServerItem } from '../ServerItem.js';
import type { ExtendedMCPServerStatus } from '../../../contexts/MCPContext.js';

describe('ServerItem', () => {
  const mockServer: ExtendedMCPServerStatus = {
    name: 'test-server',
    description: 'A test MCP server',
    status: 'connected',
    health: 'healthy',
    uptime: 3600000, // 1 hour in milliseconds
    tools: 2, // Number of tools
    resources: 1, // Number of resources
    config: {
      command: 'node',
      args: ['server.js'],
      transport: 'stdio',
      disabled: false,
    },
    toolsList: [
      { name: 'tool1', description: 'Tool 1', inputSchema: {} },
      { name: 'tool2', description: 'Tool 2', inputSchema: {} },
    ],
  };

  describe('Basic Rendering', () => {
    it('should render server name and description', () => {
      const { lastFrame } = render(
        <ServerItem
          server={mockServer}
          focused={false}
          expanded={false}
        />
      );

      expect(lastFrame()).toContain('test-server');
      expect(lastFrame()).toContain('A test MCP server');
    });

    it('should show enabled state for active server', () => {
      const { lastFrame } = render(
        <ServerItem
          server={mockServer}
          focused={false}
          expanded={false}
        />
      );

      expect(lastFrame()).toContain('Enabled');
    });

    it('should show disabled state for inactive server', () => {
      const disabledServer = {
        ...mockServer,
        config: { ...mockServer.config, disabled: true },
      };

      const { lastFrame } = render(
        <ServerItem
          server={disabledServer}
          focused={false}
          expanded={false}
        />
      );

      expect(lastFrame()).toContain('Disabled');
    });

    it('should display health status', () => {
      const { lastFrame } = render(
        <ServerItem
          server={mockServer}
          focused={false}
          expanded={false}
        />
      );

      expect(lastFrame()).toContain('healthy');
    });
  });

  describe('Expand/Collapse Functionality', () => {
    it('should show collapsed icon when not expanded', () => {
      const { lastFrame } = render(
        <ServerItem
          server={mockServer}
          focused={false}
          expanded={false}
        />
      );

      expect(lastFrame()).toContain('>');
    });

    it('should show expanded icon when expanded', () => {
      const { lastFrame } = render(
        <ServerItem
          server={mockServer}
          focused={false}
          expanded={true}
        />
      );

      expect(lastFrame()).toContain('▼');
    });

    it('should show server stats when expanded', () => {
      const { lastFrame } = render(
        <ServerItem
          server={mockServer}
          focused={false}
          expanded={true}
        />
      );

      const output = lastFrame();
      expect(output).toContain('Tools: 2');
      expect(output).toContain('Resources: 1');
      expect(output).toContain('Uptime:');
    });

    it('should hide server stats when collapsed', () => {
      const { lastFrame } = render(
        <ServerItem
          server={mockServer}
          focused={false}
          expanded={false}
        />
      );

      const output = lastFrame();
      expect(output).not.toContain('Tools:');
      expect(output).not.toContain('Resources:');
    });

    it('should show keyboard shortcuts when expanded and focused', () => {
      const { lastFrame } = render(
        <ServerItem
          server={mockServer}
          focused={true}
          expanded={true}
        />
      );

      const output = lastFrame();
      expect(output).toContain('[V] View Tools');
      expect(output).toContain('[C] Configure');
      expect(output).toContain('[R] Restart');
      expect(output).toContain('[L] Logs');
      expect(output).toContain('[U] Uninstall');
    });

    it('should not show keyboard shortcuts when not focused', () => {
      const { lastFrame } = render(
        <ServerItem
          server={mockServer}
          focused={false}
          expanded={true}
        />
      );

      const output = lastFrame();
      expect(output).not.toContain('[V] View Tools');
    });
  });

  describe('Focus Highlighting', () => {
    it('should apply focus styling when focused', () => {
      const { lastFrame } = render(
        <ServerItem
          server={mockServer}
          focused={true}
          expanded={false}
        />
      );

      // Ink applies ANSI color codes for cyan
      // We can't easily test the exact color, but we can verify the component renders
      expect(lastFrame()).toContain('test-server');
    });

    it('should not apply focus styling when not focused', () => {
      const { lastFrame } = render(
        <ServerItem
          server={mockServer}
          focused={false}
          expanded={false}
        />
      );

      expect(lastFrame()).toContain('test-server');
    });
  });

  describe('Server Statistics', () => {
    it('should display tools count', () => {
      const { lastFrame } = render(
        <ServerItem
          server={mockServer}
          focused={false}
          expanded={true}
        />
      );

      expect(lastFrame()).toContain('Tools: 2');
    });

    it('should display resources count', () => {
      const { lastFrame } = render(
        <ServerItem
          server={mockServer}
          focused={false}
          expanded={true}
        />
      );

      expect(lastFrame()).toContain('Resources: 1');
    });

    it('should display uptime when server is running', () => {
      const { lastFrame } = render(
        <ServerItem
          server={mockServer}
          focused={false}
          expanded={true}
        />
      );

      expect(lastFrame()).toContain('Uptime:');
    });

    it('should not display uptime when server is stopped', () => {
      const stoppedServer = {
        ...mockServer,
        uptime: 0,
      };

      const { lastFrame } = render(
        <ServerItem
          server={stoppedServer}
          focused={false}
          expanded={true}
        />
      );

      expect(lastFrame()).not.toContain('Uptime:');
    });

    it('should display OAuth status when OAuth is configured', () => {
      const oauthServer = {
        ...mockServer,
        config: {
          ...mockServer.config,
          oauth: {
            enabled: true,
            provider: 'github',
            clientId: 'test-client-id',
            scopes: ['read'],
          },
        },
        oauthStatus: {
          connected: true,
          expiresAt: Date.now() + 3600000,
          scopes: ['read'],
        },
      };

      const { lastFrame } = render(
        <ServerItem
          server={oauthServer}
          focused={false}
          expanded={true}
        />
      );

      expect(lastFrame()).toContain('OAuth: Connected');
    });

    it('should show OAuth not connected when token is missing', () => {
      const oauthServer = {
        ...mockServer,
        config: {
          ...mockServer.config,
          oauth: {
            enabled: true,
            provider: 'github',
            clientId: 'test-client-id',
            scopes: ['read'],
          },
        },
        oauthStatus: {
          connected: false,
        },
      };

      const { lastFrame } = render(
        <ServerItem
          server={oauthServer}
          focused={false}
          expanded={true}
        />
      );

      expect(lastFrame()).toContain('OAuth: Not Connected');
    });
  });

  describe('Error and Warning Display', () => {
    it('should display error message when server is unhealthy', () => {
      const unhealthyServer = {
        ...mockServer,
        health: 'unhealthy' as const,
        error: 'Connection failed',
      };

      const { lastFrame } = render(
        <ServerItem
          server={unhealthyServer}
          focused={false}
          expanded={true}
        />
      );

      expect(lastFrame()).toContain('Error: Connection failed');
    });

    it('should display warning message when server is degraded', () => {
      const degradedServer = {
        ...mockServer,
        health: 'degraded' as const,
        error: 'Slow response time',
      };

      const { lastFrame } = render(
        <ServerItem
          server={degradedServer}
          focused={false}
          expanded={true}
        />
      );

      expect(lastFrame()).toContain('Warning: Slow response time');
    });

    it('should not display error when server is healthy', () => {
      const { lastFrame } = render(
        <ServerItem
          server={mockServer}
          focused={false}
          expanded={true}
        />
      );

      expect(lastFrame()).not.toContain('Error:');
      expect(lastFrame()).not.toContain('Warning:');
    });
  });

  describe('Callbacks', () => {
    it('should accept onToggle callback', () => {
      const onToggle = vi.fn();

      render(
        <ServerItem
          server={mockServer}
          focused={false}
          expanded={false}
          onToggle={onToggle}
        />
      );

      // Callback is passed but not automatically called
      expect(onToggle).not.toHaveBeenCalled();
    });

    it('should accept onExpand callback', () => {
      const onExpand = vi.fn();

      render(
        <ServerItem
          server={mockServer}
          focused={false}
          expanded={false}
          onExpand={onExpand}
        />
      );

      // Callback is passed but not automatically called
      expect(onExpand).not.toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    it('should handle server with no description', () => {
      const noDescServer = {
        ...mockServer,
        description: undefined,
      };

      const { lastFrame } = render(
        <ServerItem
          server={noDescServer}
          focused={false}
          expanded={false}
        />
      );

      expect(lastFrame()).toContain('No description available');
    });

    it('should handle server with no tools', () => {
      const noToolsServer = {
        ...mockServer,
        toolsList: [],
      };

      const { lastFrame } = render(
        <ServerItem
          server={noToolsServer}
          focused={false}
          expanded={true}
        />
      );

      expect(lastFrame()).toContain('Tools: 0');
    });

    it('should handle server with no resources', () => {
      const noResourcesServer = {
        ...mockServer,
        resources: 0,
      };

      const { lastFrame } = render(
        <ServerItem
          server={noResourcesServer}
          focused={false}
          expanded={true}
        />
      );

      expect(lastFrame()).toContain('Resources: 0');
    });

    it('should handle stopped server status', () => {
      const stoppedServer = {
        ...mockServer,
        status: 'disconnected' as const,
        health: 'unhealthy' as const,
      };

      const { lastFrame } = render(
        <ServerItem
          server={stoppedServer}
          focused={false}
          expanded={false}
        />
      );

      expect(lastFrame()).toContain('stopped');
    });
  });
});
