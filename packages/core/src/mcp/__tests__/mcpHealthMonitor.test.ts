/**
 * Tests for MCPHealthMonitor
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MCPHealthMonitor, type HealthMonitorEvent } from '../mcpHealthMonitor.js';
import type { MCPClient, MCPServerConfig, MCPServerStatus, MCPServerInfo } from '../types.js';

// Mock MCP Client
class MockMCPClient implements MCPClient {
  private servers: Map<string, { status: MCPServerStatus; config: MCPServerConfig }> = new Map();

  async startServer(name: string, config: MCPServerConfig): Promise<void> {
    const existing = this.servers.get(name);
    const nextStatus =
      existing && existing.status.status === 'error'
        ? existing.status
        : {
            name,
            status: 'connected',
            tools: 0,
          };

    this.servers.set(name, {
      status: nextStatus,
      config,
    });
  }

  async stopServer(name: string): Promise<void> {
    const server = this.servers.get(name);
    if (server) {
      if (server.status.status !== 'error') {
        server.status.status = 'disconnected';
      }
    }
  }

  getServerStatus(name: string): MCPServerStatus {
    const server = this.servers.get(name);
    return server?.status || {
      name,
      status: 'disconnected',
      tools: 0,
    };
  }

  listServers(): MCPServerInfo[] {
    const servers: MCPServerInfo[] = [];
    for (const [name, data] of this.servers.entries()) {
      servers.push({
        name,
        status: data.status,
        config: data.config,
      });
    }
    return servers;
  }

  async callTool(): Promise<unknown> {
    return {};
  }

  async getTools(): Promise<any[]> {
    return [];
  }

  // Helper methods for testing
  setServerStatus(name: string, status: MCPServerStatus): void {
    const server = this.servers.get(name);
    if (server) {
      server.status = status;
    }
  }

  simulateServerFailure(name: string, error: string): void {
    const server = this.servers.get(name);
    if (server) {
      server.status = {
        ...server.status,
        status: 'error',
        error,
      };
    }
  }

  simulateServerRecovery(name: string): void {
    const server = this.servers.get(name);
    if (server) {
      server.status = {
        ...server.status,
        status: 'connected',
        error: undefined,
      };
    }
  }
}

describe('MCPHealthMonitor', () => {
  let client: MockMCPClient;
  let monitor: MCPHealthMonitor;
  let events: HealthMonitorEvent[];

  beforeEach(() => {
    client = new MockMCPClient();
    events = [];
    
    // Use fake timers
    vi.useFakeTimers();
  });

  afterEach(() => {
    if (monitor) {
      monitor.stop();
    }
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('Initialization', () => {
    it('should create monitor with default config', () => {
      monitor = new MCPHealthMonitor(client);
      expect(monitor).toBeDefined();
    });

    it('should create monitor with custom config', () => {
      monitor = new MCPHealthMonitor(client, {
        checkInterval: 10000,
        maxRestartAttempts: 5,
        autoRestart: false,
      });
      expect(monitor).toBeDefined();
    });

    it('should not start monitoring automatically', () => {
      monitor = new MCPHealthMonitor(client);
      const health = monitor.getAllServerHealth();
      expect(health).toEqual([]);
    });
  });

  describe('Start and Stop', () => {
    it('should start monitoring', async () => {
      // Add a server
      await client.startServer('test-server', {
        command: 'test',
        args: [],
      });

      monitor = new MCPHealthMonitor(client, {
        checkInterval: 1000,
      });

      monitor.start();

      // Should initialize server states
      const health = monitor.getServerHealth('test-server');
      expect(health).toBeDefined();
      expect(health?.serverName).toBe('test-server');
    });

    it('should stop monitoring', async () => {
      await client.startServer('test-server', {
        command: 'test',
        args: [],
      });

      monitor = new MCPHealthMonitor(client, {
        checkInterval: 1000,
      });

      monitor.start();
      monitor.stop();

      // Should clear server states
      const health = monitor.getAllServerHealth();
      expect(health).toEqual([]);
    });

    it('should not start twice', async () => {
      await client.startServer('test-server', {
        command: 'test',
        args: [],
      });

      monitor = new MCPHealthMonitor(client, {
        checkInterval: 1000,
      });

      monitor.start();
      monitor.start(); // Second start should be ignored

      const health = monitor.getAllServerHealth();
      expect(health).toHaveLength(1);
    });
  });

  describe('Health Checks', () => {
    it('should perform periodic health checks', async () => {
      await client.startServer('test-server', {
        command: 'test',
        args: [],
      });

      monitor = new MCPHealthMonitor(client, {
        checkInterval: 1000,
      });

      monitor.addEventListener((event) => {
        events.push(event);
      });

      monitor.start();

      // Advance time to trigger health check
      await vi.advanceTimersByTimeAsync(1000);
      const state = (monitor as any).serverStates.get('test-server');
      expect(state).toBeDefined();
      if (state) {
        (monitor as any).checkServerHealth('test-server', state);
      }

      // Should have health check events
      const healthCheckEvents = events.filter(e => e.type === 'health-check');
      expect(healthCheckEvents.length).toBeGreaterThan(0);
    });

    it('should detect server becoming unhealthy', async () => {
      await client.startServer('test-server', {
        command: 'test',
        args: [],
      });

      monitor = new MCPHealthMonitor(client, {
        checkInterval: 1000,
        autoRestart: false, // Disable auto-restart for this test
      });

      monitor.addEventListener((event) => {
        events.push(event);
      });

      monitor.start();

      // Simulate server failure
      client.simulateServerFailure('test-server', 'Connection lost');
      expect(client.getServerStatus('test-server').status).toBe('error');

      // Advance time to trigger health check
      await vi.advanceTimersByTimeAsync(1000);

      // Should have unhealthy event
      const unhealthyEvents = events.filter(e => e.type === 'server-unhealthy');
      expect(unhealthyEvents).toHaveLength(1);
      expect(unhealthyEvents[0].serverName).toBe('test-server');
    });

    it('should detect server recovery', async () => {
      await client.startServer('test-server', {
        command: 'test',
        args: [],
      });

      monitor = new MCPHealthMonitor(client, {
        checkInterval: 1000,
        autoRestart: false,
      });

      monitor.addEventListener((event) => {
        events.push(event);
      });

      monitor.start();

      // Simulate server failure
      client.simulateServerFailure('test-server', 'Connection lost');
      await vi.advanceTimersByTimeAsync(1000);

      // Clear events
      events = [];

      // Simulate server recovery
      client.simulateServerRecovery('test-server');
      await vi.advanceTimersByTimeAsync(1000);

      // Should have recovery event
      const recoveryEvents = events.filter(e => e.type === 'server-recovered');
      expect(recoveryEvents).toHaveLength(1);
      expect(recoveryEvents[0].serverName).toBe('test-server');
    });
  });

  describe('Auto-Restart', () => {
    it('should attempt to restart failed server', async () => {
      await client.startServer('test-server', {
        command: 'test',
        args: [],
      });

      monitor = new MCPHealthMonitor(client, {
        checkInterval: 1000,
        maxRestartAttempts: 3,
        initialBackoffDelay: 100,
        autoRestart: true,
      });

      monitor.addEventListener((event) => {
        events.push(event);
      });

      monitor.start();

      // Simulate server failure
      client.simulateServerFailure('test-server', 'Connection lost');

      // Advance time to trigger health check and restart
      await vi.advanceTimersByTimeAsync(2000);

      // Should have restart attempt event
      const restartEvents = events.filter(e => e.type === 'restart-attempt');
      expect(restartEvents.length).toBeGreaterThan(0);
    });

    it('should respect max restart attempts', async () => {
      await client.startServer('test-server', {
        command: 'test',
        args: [],
      });

      monitor = new MCPHealthMonitor(client, {
        checkInterval: 1000,
        maxRestartAttempts: 2,
        initialBackoffDelay: 100,
        autoRestart: true,
      });

      monitor.addEventListener((event) => {
        events.push(event);
      });

      monitor.start();

      // Simulate persistent failure
      client.simulateServerFailure('test-server', 'Connection lost');
      expect(client.getServerStatus('test-server').status).toBe('error');

      // Trigger multiple health checks and wait for async operations
      for (let i = 0; i < 5; i++) {
        await vi.advanceTimersByTimeAsync(1000);
        const state = (monitor as any).serverStates.get('test-server');
        expect(state).toBeDefined();
        if (state) {
          (monitor as any).checkServerHealth('test-server', state);
        }
        // Flush pending timers scheduled by async operations
        await vi.runOnlyPendingTimersAsync();
      }

      // Should have max restarts exceeded event
      const maxRestartEvents = events.filter(e => e.type === 'max-restarts-exceeded');
      expect(maxRestartEvents.length).toBeGreaterThan(0);

      // Should not exceed max attempts
      const restartEvents = events.filter(e => e.type === 'restart-attempt');
      expect(restartEvents.length).toBeLessThanOrEqual(2);
    });

    it('should use exponential backoff', async () => {
      await client.startServer('test-server', {
        command: 'test',
        args: [],
      });

      monitor = new MCPHealthMonitor(client, {
        checkInterval: 500,
        maxRestartAttempts: 3,
        initialBackoffDelay: 1000,
        maxBackoffDelay: 10000,
        autoRestart: true,
      });

      monitor.addEventListener((event) => {
        events.push(event);
      });

      monitor.start();

      // Simulate server failure
      client.simulateServerFailure('test-server', 'Connection lost');
      expect(client.getServerStatus('test-server').status).toBe('error');

      // First restart should happen after initial backoff
      await vi.advanceTimersByTimeAsync(1500);
      const firstState = (monitor as any).serverStates.get('test-server');
      expect(firstState).toBeDefined();
      if (firstState) {
        (monitor as any).checkServerHealth('test-server', firstState);
      }
      await vi.runOnlyPendingTimersAsync();
      
      const firstRestart = events.filter(e => e.type === 'restart-attempt');
      expect(firstRestart).toHaveLength(1);

      // Clear events
      events = [];

      // Second restart should wait longer (exponential backoff)
      await vi.advanceTimersByTimeAsync(2500);
      const secondState = (monitor as any).serverStates.get('test-server');
      expect(secondState).toBeDefined();
      if (secondState) {
        (monitor as any).checkServerHealth('test-server', secondState);
      }
      await vi.runOnlyPendingTimersAsync();
      
      const secondRestart = events.filter(e => e.type === 'restart-attempt');
      expect(secondRestart.length).toBeGreaterThan(0);
    });

    it('should reset restart attempts on recovery', async () => {
      await client.startServer('test-server', {
        command: 'test',
        args: [],
      });

      monitor = new MCPHealthMonitor(client, {
        checkInterval: 1000,
        maxRestartAttempts: 3,
        initialBackoffDelay: 100,
        autoRestart: true,
      });

      monitor.addEventListener((event) => {
        events.push(event);
      });

      monitor.start();

      // Simulate failure and restart
      client.simulateServerFailure('test-server', 'Connection lost');
      await vi.advanceTimersByTimeAsync(1000);

      // Simulate recovery
      client.simulateServerRecovery('test-server');
      await vi.advanceTimersByTimeAsync(1000);

      // Clear events
      events = [];

      // Simulate another failure
      client.simulateServerFailure('test-server', 'Connection lost again');
      await vi.advanceTimersByTimeAsync(1000);

      // Should attempt restart again (attempts were reset)
      const restartEvents = events.filter(e => e.type === 'restart-attempt');
      expect(restartEvents.length).toBeGreaterThan(0);
    });
  });

  describe('Manual Restart', () => {
    it('should allow manual server restart', async () => {
      await client.startServer('test-server', {
        command: 'test',
        args: [],
      });

      monitor = new MCPHealthMonitor(client, {
        checkInterval: 1000,
      });

      monitor.addEventListener((event) => {
        events.push(event);
      });

      monitor.start();

      // Manually restart server
      await monitor.restartServer('test-server');

      // Give time for async operations
      await vi.runOnlyPendingTimersAsync();

      // Should have restart events
      const restartEvents = events.filter(e => e.type === 'restart-attempt');
      expect(restartEvents).toHaveLength(1);
    }, 5000); // 5 second timeout

    it('should throw error for unknown server', async () => {
      monitor = new MCPHealthMonitor(client, {
        checkInterval: 1000,
      });

      monitor.start();

      // Try to restart unknown server
      await expect(monitor.restartServer('unknown-server')).rejects.toThrow(
        'not being monitored'
      );
    });
  });

  describe('Event Listeners', () => {
    it('should add and remove event listeners', async () => {
      await client.startServer('test-server', {
        command: 'test',
        args: [],
      });

      monitor = new MCPHealthMonitor(client, {
        checkInterval: 1000,
      });

      const listener = vi.fn();
      monitor.addEventListener(listener);
      monitor.start();

      // Advance time to trigger health check
      await vi.advanceTimersByTimeAsync(1000);

      expect(listener).toHaveBeenCalled();

      // Remove listener
      listener.mockClear();
      monitor.removeEventListener(listener);

      // Advance time again
      await vi.advanceTimersByTimeAsync(1000);

      // Listener should not be called
      expect(listener).not.toHaveBeenCalled();
    });

    it('should handle listener errors gracefully', async () => {
      await client.startServer('test-server', {
        command: 'test',
        args: [],
      });

      monitor = new MCPHealthMonitor(client, {
        checkInterval: 1000,
      });

      // Add listener that throws error
      const errorListener = vi.fn(() => {
        throw new Error('Listener error');
      });

      // Add normal listener
      const normalListener = vi.fn();

      monitor.addEventListener(errorListener);
      monitor.addEventListener(normalListener);
      monitor.start();

      // Advance time to trigger health check
      await vi.advanceTimersByTimeAsync(1000);

      // Both listeners should be called despite error
      expect(errorListener).toHaveBeenCalled();
      expect(normalListener).toHaveBeenCalled();
    });
  });

  describe('Health Status', () => {
    it('should return health status for server', async () => {
      await client.startServer('test-server', {
        command: 'test',
        args: [],
      });

      monitor = new MCPHealthMonitor(client, {
        checkInterval: 1000,
      });

      monitor.start();

      const health = monitor.getServerHealth('test-server');
      expect(health).toBeDefined();
      expect(health?.serverName).toBe('test-server');
      expect(health?.healthy).toBe(true);
      expect(health?.status).toBe('connected');
    });

    it('should return undefined for unknown server', () => {
      monitor = new MCPHealthMonitor(client, {
        checkInterval: 1000,
      });

      monitor.start();

      const health = monitor.getServerHealth('unknown-server');
      expect(health).toBeUndefined();
    });

    it('should return health status for all servers', async () => {
      await client.startServer('server-1', {
        command: 'test',
        args: [],
      });

      await client.startServer('server-2', {
        command: 'test',
        args: [],
      });

      monitor = new MCPHealthMonitor(client, {
        checkInterval: 1000,
      });

      monitor.start();

      const health = monitor.getAllServerHealth();
      expect(health).toHaveLength(2);
      expect(health.map(h => h.serverName)).toContain('server-1');
      expect(health.map(h => h.serverName)).toContain('server-2');
    });
  });
});
