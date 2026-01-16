/**
 * Tests for MCPStatus component
 */

import { describe, it, expect } from 'vitest';
import { render } from 'ink-testing-library';
import React from 'react';
import { MCPStatus } from '../MCPStatus.js';
// Local definition to bypass import issues
type HealthCheckResult = {
  serverName: string;
  healthy: boolean;
  status: 'connected' | 'starting' | 'disconnected' | 'error';
  error?: string;
  timestamp: number;
};

// Default theme for testing
const defaultTheme = {
  text: {
    primary: '#d4d4d4',
    secondary: '#858585',
    accent: '#4ec9b0',
  },
  status: {
    success: '#4ec9b0',
    warning: '#ce9178',
    error: '#f48771',
    info: '#569cd6',
  },
};

describe('MCPStatus', () => {
  describe('Rendering', () => {
    it('should not render when no servers', () => {
      const { lastFrame } = render(
        <MCPStatus servers={[]} theme={defaultTheme} />
      );

      expect(lastFrame()).toBe('');
    });

    it('should render healthy server', () => {
      const servers: HealthCheckResult[] = [
        {
          serverName: 'test-server',
          healthy: true,
          status: 'connected',
          timestamp: Date.now(),
        },
      ];

      const { lastFrame } = render(
        <MCPStatus servers={servers} theme={defaultTheme} />
      );

      const output = lastFrame();
      expect(output).toContain('test-server');
      expect(output).toContain('OK');
      expect(output).toContain('🟢');
    });

    it('should render unhealthy server', () => {
      const servers: HealthCheckResult[] = [
        {
          serverName: 'test-server',
          healthy: false,
          status: 'error',
          error: 'Connection failed',
          timestamp: Date.now(),
        },
      ];

      const { lastFrame } = render(
        <MCPStatus servers={servers} theme={defaultTheme} />
      );

      const output = lastFrame();
      expect(output).toContain('test-server');
      expect(output).toContain('Error');
      expect(output).toContain('Connection failed');
      expect(output).toContain('🔴');
    });

    it('should render multiple servers', () => {
      const servers: HealthCheckResult[] = [
        {
          serverName: 'server-1',
          healthy: true,
          status: 'connected',
          timestamp: Date.now(),
        },
        {
          serverName: 'server-2',
          healthy: false,
          status: 'error',
          error: 'Failed',
          timestamp: Date.now(),
        },
      ];

      const { lastFrame } = render(
        <MCPStatus servers={servers} theme={defaultTheme} />
      );

      const output = lastFrame();
      expect(output).toContain('server-1');
      expect(output).toContain('server-2');
      expect(output).toContain('1/2 healthy');
    });
  });

  describe('Compact Mode', () => {
    it('should render compact mode with healthy servers', () => {
      const servers: HealthCheckResult[] = [
        {
          serverName: 'server-1',
          healthy: true,
          status: 'connected',
          timestamp: Date.now(),
        },
        {
          serverName: 'server-2',
          healthy: true,
          status: 'connected',
          timestamp: Date.now(),
        },
      ];

      const { lastFrame } = render(
        <MCPStatus servers={servers} theme={defaultTheme} compact />
      );

      const output = lastFrame();
      expect(output).toContain('MCP:');
      expect(output).toContain('2✓');
    });

    it('should render compact mode with unhealthy servers', () => {
      const servers: HealthCheckResult[] = [
        {
          serverName: 'server-1',
          healthy: true,
          status: 'connected',
          timestamp: Date.now(),
        },
        {
          serverName: 'server-2',
          healthy: false,
          status: 'error',
          timestamp: Date.now(),
        },
      ];

      const { lastFrame } = render(
        <MCPStatus servers={servers} theme={defaultTheme} compact />
      );

      const output = lastFrame();
      expect(output).toContain('MCP:');
      expect(output).toContain('1✓');
      expect(output).toContain('1✗');
    });

    it('should render compact mode with only unhealthy servers', () => {
      const servers: HealthCheckResult[] = [
        {
          serverName: 'server-1',
          healthy: false,
          status: 'error',
          timestamp: Date.now(),
        },
      ];

      const { lastFrame } = render(
        <MCPStatus servers={servers} theme={defaultTheme} compact />
      );

      const output = lastFrame();
      expect(output).toContain('MCP:');
      expect(output).toContain('1✗');
      expect(output).not.toContain('✓');
    });
  });

  describe('Status Text', () => {
    it('should show "OK" for connected status', () => {
      const servers: HealthCheckResult[] = [
        {
          serverName: 'test-server',
          healthy: true,
          status: 'connected',
          timestamp: Date.now(),
        },
      ];

      const { lastFrame } = render(
        <MCPStatus servers={servers} theme={defaultTheme} />
      );

      expect(lastFrame()).toContain('OK');
    });

    it('should show "Starting" for starting status', () => {
      const servers: HealthCheckResult[] = [
        {
          serverName: 'test-server',
          healthy: false,
          status: 'starting',
          timestamp: Date.now(),
        },
      ];

      const { lastFrame } = render(
        <MCPStatus servers={servers} theme={defaultTheme} />
      );

      expect(lastFrame()).toContain('Starting');
    });

    it('should show "Offline" for disconnected status', () => {
      const servers: HealthCheckResult[] = [
        {
          serverName: 'test-server',
          healthy: false,
          status: 'disconnected',
          timestamp: Date.now(),
        },
      ];

      const { lastFrame } = render(
        <MCPStatus servers={servers} theme={defaultTheme} />
      );

      expect(lastFrame()).toContain('Offline');
    });

    it('should show "Error" for error status', () => {
      const servers: HealthCheckResult[] = [
        {
          serverName: 'test-server',
          healthy: false,
          status: 'error',
          error: 'Failed',
          timestamp: Date.now(),
        },
      ];

      const { lastFrame } = render(
        <MCPStatus servers={servers} theme={defaultTheme} />
      );

      expect(lastFrame()).toContain('Error');
    });
  });

  describe('Error Display', () => {
    it('should show error message when present', () => {
      const servers: HealthCheckResult[] = [
        {
          serverName: 'test-server',
          healthy: false,
          status: 'error',
          error: 'Connection timeout',
          timestamp: Date.now(),
        },
      ];

      const { lastFrame } = render(
        <MCPStatus servers={servers} theme={defaultTheme} />
      );

      expect(lastFrame()).toContain('Connection timeout');
    });

    it('should not show error section when no error', () => {
      const servers: HealthCheckResult[] = [
        {
          serverName: 'test-server',
          healthy: true,
          status: 'connected',
          timestamp: Date.now(),
        },
      ];

      const { lastFrame } = render(
        <MCPStatus servers={servers} theme={defaultTheme} />
      );

      const output = lastFrame();
      // Should not have extra " - " separator for error
      const parts = output.split(' - ');
      expect(parts.length).toBe(2); // Only "server - status"
    });
  });
});
