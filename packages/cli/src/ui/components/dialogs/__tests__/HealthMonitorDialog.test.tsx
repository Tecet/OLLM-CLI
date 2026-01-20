/**
 * Tests for HealthMonitorDialog component
 * 
 * Validates:
 * - Overall status summary display
 * - Server health list rendering
 * - Error/warning message display
 * - Restart button functionality
 * - View Logs button functionality
 * - Enable button for stopped servers
 * - Auto-restart configuration
 * - Refresh functionality
 * - Close functionality
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from 'ink-testing-library';
import { HealthMonitorDialog } from '../HealthMonitorDialog.js';
import { MCPProvider } from '../../../contexts/MCPContext.js';
import { UIProvider } from '../../../../features/context/UIContext.js';
import { defaultDarkTheme } from '../../../../config/styles.js';
import type { ExtendedMCPServerStatus } from '../../../contexts/MCPContext.js';
import { createMockMCPClient, createMockHealthMonitor, createMockOAuthProvider } from '../../../contexts/__tests__/mcpTestUtils.js';

describe('HealthMonitorDialog', () => {
  let mockClient: ReturnType<typeof createMockMCPClient>;
  let mockHealthMonitor: ReturnType<typeof createMockHealthMonitor>;
  let mockOAuthProvider: ReturnType<typeof createMockOAuthProvider>;

  beforeEach(() => {
    mockClient = createMockMCPClient();
    mockHealthMonitor = createMockHealthMonitor();
    mockOAuthProvider = createMockOAuthProvider();
  });

  const createMockServer = (
    name: string,
    health: 'healthy' | 'degraded' | 'unhealthy',
    status: string = 'running',
    uptime: number = 3600000,
    lastError?: string
  ): ExtendedMCPServerStatus => ({
    name,
    description: `${name} server`,
    status,
    health,
    uptime,
    lastError,
    lastCheckTime: Date.now() - 30000, // 30 seconds ago
    responseTime: 150,
    toolsList: [],
    config: {
      command: 'test',
      args: [],
      disabled: status === 'stopped',
    },
  });

  const renderWithProvider = (ui: React.ReactElement) => {
    return render(
      <UIProvider initialTheme={defaultDarkTheme}>
        <MCPProvider
          mcpClient={mockClient as unknown as import('@ollm/ollm-cli-core/mcp/types.js').MCPClient}
          healthMonitor={mockHealthMonitor as unknown as import('@ollm/ollm-cli-core/mcp/mcpHealthMonitor.js').MCPHealthMonitor}
          oauthProvider={mockOAuthProvider as unknown as import('@ollm/ollm-cli-core/mcp/mcpOAuth.js').MCPOAuthProvider}
        >
          {ui}
        </MCPProvider>
      </UIProvider>
    );
  };

  describe('Overall Status Summary', () => {
    it('should display "All Healthy" when all servers are healthy', async () => {
      mockClient.getAllServerStatuses.mockResolvedValue(
        new Map([
          ['server1', createMockServer('server1', 'healthy')],
          ['server2', createMockServer('server2', 'healthy')],
        ])
      );

      const { lastFrame } = renderWithProvider(
        <HealthMonitorDialog onClose={vi.fn()} />
      );

      await vi.waitFor(() => {
        expect(lastFrame()).toContain('All Healthy');
        expect(lastFrame()).toContain('(2/2 servers healthy)');
      });
    });

    it('should display "Degraded" when some servers are unhealthy', async () => {
      mockClient.getAllServerStatuses.mockResolvedValue(
        new Map([
          ['server1', createMockServer('server1', 'healthy')],
          ['server2', createMockServer('server2', 'unhealthy', 'error')],
        ])
      );

      const { lastFrame } = renderWithProvider(
        <HealthMonitorDialog onClose={vi.fn()} />
      );

      await vi.waitFor(() => {
        expect(lastFrame()).toContain('Degraded');
        expect(lastFrame()).toContain('(1/2 servers healthy)');
      });
    });

    it('should display "All Unhealthy" when all servers are unhealthy', async () => {
      mockClient.getAllServerStatuses.mockResolvedValue(
        new Map([
          ['server1', createMockServer('server1', 'unhealthy', 'error')],
          ['server2', createMockServer('server2', 'unhealthy', 'error')],
        ])
      );

      const { lastFrame } = renderWithProvider(
        <HealthMonitorDialog onClose={vi.fn()} />
      );

      await vi.waitFor(() => {
        expect(lastFrame()).toContain('All Unhealthy');
        expect(lastFrame()).toContain('(0/2 servers healthy)');
      });
    });

    it('should display message when no servers are configured', async () => {
      mockClient.getAllServerStatuses.mockResolvedValue(new Map());

      const { lastFrame } = renderWithProvider(
        <HealthMonitorDialog onClose={vi.fn()} />
      );

      await vi.waitFor(() => {
        expect(lastFrame()).toContain('No MCP servers configured');
      });
    });
  });

  describe('Server Health Display', () => {
    it('should display server name and health status', async () => {
      mockClient.getAllServerStatuses.mockResolvedValue(
        new Map([
          ['test-server', createMockServer('test-server', 'healthy')],
        ])
      );

      const { lastFrame } = renderWithProvider(
        <HealthMonitorDialog onClose={vi.fn()} />
      );

      await vi.waitFor(() => {
        expect(lastFrame()).toContain('test-server');
        expect(lastFrame()).toContain('healthy');
        expect(lastFrame()).toContain('●'); // Health icon
      });
    });

    it('should display uptime for running servers', async () => {
      mockClient.getAllServerStatuses.mockResolvedValue(
        new Map([
          ['test-server', createMockServer('test-server', 'healthy', 'running', 3600000)],
        ])
      );

      const { lastFrame } = renderWithProvider(
        <HealthMonitorDialog onClose={vi.fn()} />
      );

      await vi.waitFor(() => {
        expect(lastFrame()).toContain('Uptime:');
        expect(lastFrame()).toMatch(/1h/); // 3600000ms = 1 hour
      });
    });

    it('should display last check time', async () => {
      mockClient.getAllServerStatuses.mockResolvedValue(
        new Map([
          ['test-server', createMockServer('test-server', 'healthy')],
        ])
      );

      const { lastFrame } = renderWithProvider(
        <HealthMonitorDialog onClose={vi.fn()} />
      );

      await vi.waitFor(() => {
        expect(lastFrame()).toContain('Last check:');
        expect(lastFrame()).toMatch(/\d+s ago/);
      });
    });

    it('should display response time', async () => {
      mockClient.getAllServerStatuses.mockResolvedValue(
        new Map([
          ['test-server', createMockServer('test-server', 'healthy')],
        ])
      );

      const { lastFrame } = renderWithProvider(
        <HealthMonitorDialog onClose={vi.fn()} />
      );

      await vi.waitFor(() => {
        expect(lastFrame()).toContain('Response:');
        expect(lastFrame()).toContain('150ms');
      });
    });
  });

  describe('Error and Warning Messages', () => {
    it('should display error message for unhealthy servers', async () => {
      mockClient.getAllServerStatuses.mockResolvedValue(
        new Map([
          ['test-server', createMockServer('test-server', 'unhealthy', 'error', 0, 'Connection failed')],
        ])
      );

      const { lastFrame } = renderWithProvider(
        <HealthMonitorDialog onClose={vi.fn()} />
      );

      await vi.waitFor(() => {
        expect(lastFrame()).toContain('Error: Connection failed');
      });
    });

    it('should display warning message for degraded servers', async () => {
      mockClient.getAllServerStatuses.mockResolvedValue(
        new Map([
          ['test-server', createMockServer('test-server', 'degraded', 'running', 3600000, 'Slow response')],
        ])
      );

      const { lastFrame } = renderWithProvider(
        <HealthMonitorDialog onClose={vi.fn()} />
      );

      await vi.waitFor(() => {
        expect(lastFrame()).toContain('Warning: Slow response');
      });
    });

    it('should not display error message for healthy servers', async () => {
      mockClient.getAllServerStatuses.mockResolvedValue(
        new Map([
          ['test-server', createMockServer('test-server', 'healthy')],
        ])
      );

      const { lastFrame } = renderWithProvider(
        <HealthMonitorDialog onClose={vi.fn()} />
      );

      await vi.waitFor(() => {
        expect(lastFrame()).not.toContain('Error:');
        expect(lastFrame()).not.toContain('Warning:');
      });
    });
  });

  describe('Action Buttons', () => {
    it('should display Restart button for running servers', async () => {
      mockClient.getAllServerStatuses.mockResolvedValue(
        new Map([
          ['test-server', createMockServer('test-server', 'healthy', 'running')],
        ])
      );

      const { lastFrame } = renderWithProvider(
        <HealthMonitorDialog onClose={vi.fn()} />
      );

      await vi.waitFor(() => {
        expect(lastFrame()).toContain('Restart');
      });
    });

    it('should display View Logs button for all servers', async () => {
      mockClient.getAllServerStatuses.mockResolvedValue(
        new Map([
          ['test-server', createMockServer('test-server', 'healthy')],
        ])
      );

      const { lastFrame } = renderWithProvider(
        <HealthMonitorDialog onClose={vi.fn()} />
      );

      await vi.waitFor(() => {
        expect(lastFrame()).toContain('View Logs');
      });
    });

    it('should display Enable button for stopped servers', async () => {
      mockClient.getAllServerStatuses.mockResolvedValue(
        new Map([
          ['test-server', createMockServer('test-server', 'unhealthy', 'stopped')],
        ])
      );

      const { lastFrame } = renderWithProvider(
        <HealthMonitorDialog onClose={vi.fn()} />
      );

      await vi.waitFor(() => {
        expect(lastFrame()).toContain('Enable');
      });
    });

    it('should not display Restart button for stopped servers', async () => {
      mockClient.getAllServerStatuses.mockResolvedValue(
        new Map([
          ['test-server', createMockServer('test-server', 'unhealthy', 'stopped')],
        ])
      );

      const { lastFrame } = renderWithProvider(
        <HealthMonitorDialog onClose={vi.fn()} />
      );

      await vi.waitFor(() => {
        const frame = lastFrame();
        expect(frame).toContain('Enable');
        // Restart should not be present for stopped servers
        const lines = frame?.split('\n') || [];
        const serverSection = lines.slice(
          lines.findIndex(l => l.includes('test-server')),
          lines.findIndex(l => l.includes('test-server')) + 10
        ).join('\n');
        expect(serverSection).not.toContain('Restart');
      });
    });
  });

  describe('Auto-Restart Configuration', () => {
    it('should display auto-restart checkbox', async () => {
      mockClient.getAllServerStatuses.mockResolvedValue(new Map());

      const { lastFrame } = renderWithProvider(
        <HealthMonitorDialog onClose={vi.fn()} />
      );

      await vi.waitFor(() => {
        expect(lastFrame()).toContain('Enable auto-restart for unhealthy servers');
      });
    });

    it('should display max restarts input when auto-restart is enabled', async () => {
      mockClient.getAllServerStatuses.mockResolvedValue(new Map());

      const { lastFrame } = renderWithProvider(
        <HealthMonitorDialog onClose={vi.fn()} />
      );

      await vi.waitFor(() => {
        expect(lastFrame()).toContain('Max restarts per hour');
      });
    });

    it('should have default max restarts value of 3', async () => {
      mockClient.getAllServerStatuses.mockResolvedValue(new Map());

      const { lastFrame } = renderWithProvider(
        <HealthMonitorDialog onClose={vi.fn()} />
      );

      await vi.waitFor(() => {
        expect(lastFrame()).toContain('3');
      });
    });
  });

  describe('Dialog Actions', () => {
    it('should display Refresh button', async () => {
      mockClient.getAllServerStatuses.mockResolvedValue(new Map());

      const { lastFrame } = renderWithProvider(
        <HealthMonitorDialog onClose={vi.fn()} />
      );

      await vi.waitFor(() => {
        expect(lastFrame()).toContain('[R] ⟳ Refresh');
      });
    });

    it('should display Close button', async () => {
      mockClient.getAllServerStatuses.mockResolvedValue(new Map());

      const { lastFrame } = renderWithProvider(
        <HealthMonitorDialog onClose={vi.fn()} />
      );

      await vi.waitFor(() => {
        expect(lastFrame()).toContain('[Esc]');
        expect(lastFrame()).toContain('Close');
      });
    });
  });

  describe('Health Status Icons', () => {
    it('should display correct icon for healthy servers', async () => {
      mockClient.getAllServerStatuses.mockResolvedValue(
        new Map([
          ['test-server', createMockServer('test-server', 'healthy')],
        ])
      );

      const { lastFrame } = renderWithProvider(
        <HealthMonitorDialog onClose={vi.fn()} />
      );

      await vi.waitFor(() => {
        expect(lastFrame()).toContain('●'); // Healthy icon
      });
    });

    it('should display correct icon for degraded servers', async () => {
      mockClient.getAllServerStatuses.mockResolvedValue(
        new Map([
          ['test-server', createMockServer('test-server', 'degraded')],
        ])
      );

      const { lastFrame } = renderWithProvider(
        <HealthMonitorDialog onClose={vi.fn()} />
      );

      await vi.waitFor(() => {
        expect(lastFrame()).toContain('⚠'); // Degraded icon
      });
    });

    it('should display correct icon for unhealthy servers', async () => {
      mockClient.getAllServerStatuses.mockResolvedValue(
        new Map([
          ['test-server', createMockServer('test-server', 'unhealthy', 'error')],
        ])
      );

      const { lastFrame } = renderWithProvider(
        <HealthMonitorDialog onClose={vi.fn()} />
      );

      await vi.waitFor(() => {
        expect(lastFrame()).toContain('✗'); // Unhealthy icon
      });
    });
  });

  describe('Multiple Servers', () => {
    it('should display all servers in the list', async () => {
      mockClient.getAllServerStatuses.mockResolvedValue(
        new Map([
          ['server1', createMockServer('server1', 'healthy')],
          ['server2', createMockServer('server2', 'degraded')],
          ['server3', createMockServer('server3', 'unhealthy', 'error')],
        ])
      );

      const { lastFrame } = renderWithProvider(
        <HealthMonitorDialog onClose={vi.fn()} />
      );

      await vi.waitFor(() => {
        expect(lastFrame()).toContain('server1');
        expect(lastFrame()).toContain('server2');
        expect(lastFrame()).toContain('server3');
      });
    });

    it('should calculate correct overall status with mixed health', async () => {
      mockClient.getAllServerStatuses.mockResolvedValue(
        new Map([
          ['server1', createMockServer('server1', 'healthy')],
          ['server2', createMockServer('server2', 'healthy')],
          ['server3', createMockServer('server3', 'unhealthy', 'error')],
        ])
      );

      const { lastFrame } = renderWithProvider(
        <HealthMonitorDialog onClose={vi.fn()} />
      );

      await vi.waitFor(() => {
        expect(lastFrame()).toContain('Degraded');
        expect(lastFrame()).toContain('(2/3 servers healthy)');
      });
    });
  });

  describe('Uptime Formatting', () => {
    it('should format uptime in seconds', async () => {
      mockClient.getAllServerStatuses.mockResolvedValue(
        new Map([
          ['test-server', createMockServer('test-server', 'healthy', 'running', 30000)],
        ])
      );

      const { lastFrame } = renderWithProvider(
        <HealthMonitorDialog onClose={vi.fn()} />
      );

      await vi.waitFor(() => {
        expect(lastFrame()).toMatch(/30s/);
      });
    });

    it('should format uptime in minutes', async () => {
      mockClient.getAllServerStatuses.mockResolvedValue(
        new Map([
          ['test-server', createMockServer('test-server', 'healthy', 'running', 300000)],
        ])
      );

      const { lastFrame } = renderWithProvider(
        <HealthMonitorDialog onClose={vi.fn()} />
      );

      await vi.waitFor(() => {
        expect(lastFrame()).toMatch(/5m/);
      });
    });

    it('should format uptime in hours', async () => {
      mockClient.getAllServerStatuses.mockResolvedValue(
        new Map([
          ['test-server', createMockServer('test-server', 'healthy', 'running', 7200000)],
        ])
      );

      const { lastFrame } = renderWithProvider(
        <HealthMonitorDialog onClose={vi.fn()} />
      );

      await vi.waitFor(() => {
        expect(lastFrame()).toMatch(/2h/);
      });
    });

    it('should format uptime in days', async () => {
      mockClient.getAllServerStatuses.mockResolvedValue(
        new Map([
          ['test-server', createMockServer('test-server', 'healthy', 'running', 172800000)],
        ])
      );

      const { lastFrame } = renderWithProvider(
        <HealthMonitorDialog onClose={vi.fn()} />
      );

      await vi.waitFor(() => {
        expect(lastFrame()).toMatch(/2d/);
      });
    });
  });
});
