/**
 * Unit Tests for MCP Client
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DefaultMCPClient } from '../mcpClient.js';
import { MCPServerConfig } from '../types.js';
import { spawn } from 'child_process';
import { EventEmitter } from 'events';

// Mock child_process
vi.mock('child_process', () => ({
  spawn: vi.fn(),
}));

describe('DefaultMCPClient', () => {
  let mockProcess: any;
  let mockSpawn: any;

  beforeEach(() => {
    // Create mock process
    mockProcess = new EventEmitter();
    mockProcess.stdin = {
      write: vi.fn((data: string, callback?: (error?: Error) => void) => {
        if (callback) callback();
        return true;
      }),
    };
    mockProcess.stdout = new EventEmitter();
    mockProcess.stderr = new EventEmitter();
    mockProcess.kill = vi.fn();
    mockProcess.killed = false;

    mockSpawn = vi.mocked(spawn);
    mockSpawn.mockReturnValue(mockProcess);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('startServer', () => {
    it('should start a server and mark it as connected', async () => {
      const client = new DefaultMCPClient();
      const config: MCPServerConfig = {
        command: 'node',
        args: ['server.js'],
        timeout: 1000,
      };

      await client.startServer('test-server', config);

      const status = client.getServerStatus('test-server');
      expect(status.status).toBe('connected');
      expect(status.name).toBe('test-server');
      expect(status.error).toBeUndefined();
    });

    it('should pass environment variables to server process', async () => {
      const client = new DefaultMCPClient();
      const config: MCPServerConfig = {
        command: 'node',
        args: ['server.js'],
        env: { API_KEY: 'secret', DEBUG: 'true' },
        timeout: 1000,
      };

      await client.startServer('test-server', config);

      expect(mockSpawn).toHaveBeenCalledWith('node', ['server.js'], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: expect.objectContaining({
          API_KEY: 'secret',
          DEBUG: 'true',
        }),
      });
    });

    it('should reject if server already exists', async () => {
      const client = new DefaultMCPClient();
      const config: MCPServerConfig = {
        command: 'node',
        args: ['server.js'],
        timeout: 1000,
      };

      await client.startServer('test-server', config);

      await expect(client.startServer('test-server', config)).rejects.toThrow(
        "Server 'test-server' is already registered"
      );
    });

    it.skip('should handle connection timeout', async () => {
      // This test is skipped because mocking timeout behavior with fake timers
      // is complex and the timeout logic is already tested in mcpTransport.test.ts
    });

    it('should handle spawn errors', async () => {
      const error = new Error('Command not found');
      mockSpawn.mockImplementation(() => {
        throw error;
      });

      const client = new DefaultMCPClient();
      const config: MCPServerConfig = {
        command: 'invalid-command',
        args: [],
        timeout: 1000,
      };

      await expect(client.startServer('test-server', config)).rejects.toThrow(
        "Failed to start MCP server 'test-server'"
      );
    });
  });

  describe('stopServer', () => {
    it('should stop a running server', async () => {
      const client = new DefaultMCPClient();
      const config: MCPServerConfig = {
        command: 'node',
        args: ['server.js'],
        timeout: 1000,
      };

      await client.startServer('test-server', config);

      const stopPromise = client.stopServer('test-server');
      mockProcess.emit('exit', 0, null);
      await stopPromise;

      const status = client.getServerStatus('test-server');
      expect(status.status).toBe('disconnected');
      expect(mockProcess.kill).toHaveBeenCalled();
    });

    it('should do nothing if server does not exist', async () => {
      const client = new DefaultMCPClient();

      await expect(client.stopServer('nonexistent')).resolves.toBeUndefined();
    });

    it('should handle disconnect errors gracefully', async () => {
      const client = new DefaultMCPClient();
      const config: MCPServerConfig = {
        command: 'node',
        args: ['server.js'],
        timeout: 1000,
      };

      await client.startServer('test-server', config);

      // Make kill throw an error
      mockProcess.kill.mockImplementation(() => {
        throw new Error('Kill failed');
      });

      // Should not throw
      await expect(client.stopServer('test-server')).resolves.toBeUndefined();
    });
  });

  describe('getServerStatus', () => {
    it('should return status for existing server', async () => {
      const client = new DefaultMCPClient();
      const config: MCPServerConfig = {
        command: 'node',
        args: ['server.js'],
        timeout: 1000,
      };

      await client.startServer('test-server', config);

      const status = client.getServerStatus('test-server');
      expect(status.name).toBe('test-server');
      expect(status.status).toBe('connected');
      expect(status.error).toBeUndefined();
      expect(status.tools).toBe(0);
      expect(status.uptime).toBeGreaterThanOrEqual(0);
      expect(status.resources).toBe(0);
      expect(status.description).toBe('node');
    });

    it('should return disconnected status for unknown server', () => {
      const client = new DefaultMCPClient();

      const status = client.getServerStatus('unknown');
      expect(status).toEqual({
        name: 'unknown',
        status: 'disconnected',
        error: undefined,
        tools: 0,
        uptime: 0,
        resources: 0,
      });
    });
  });

  describe('listServers', () => {
    it('should return empty array when no servers', () => {
      const client = new DefaultMCPClient();

      const servers = client.listServers();
      expect(servers).toEqual([]);
    });

    it('should list all registered servers', async () => {
      const client = new DefaultMCPClient();

      await client.startServer('server1', {
        command: 'node',
        args: ['s1.js'],
        timeout: 1000,
      });

      await client.startServer('server2', {
        command: 'node',
        args: ['s2.js'],
        timeout: 1000,
      });

      const servers = client.listServers();
      expect(servers).toHaveLength(2);
      expect(servers.map(s => s.name)).toContain('server1');
      expect(servers.map(s => s.name)).toContain('server2');
    });
  });

  describe('getTools', () => {
    it('should request and store tools from server', async () => {
      const client = new DefaultMCPClient();
      const config: MCPServerConfig = {
        command: 'node',
        args: ['server.js'],
        timeout: 1000,
      };

      await client.startServer('test-server', config);

      const tools = [
        { name: 'tool1', description: 'Tool 1', inputSchema: {} },
        { name: 'tool2', description: 'Tool 2', inputSchema: {} },
      ];

      const getToolsPromise = client.getTools('test-server');

      // Simulate server response
      const request = JSON.parse(mockProcess.stdin.write.mock.calls[0][0]);
      mockProcess.stdout.emit('data', Buffer.from(JSON.stringify({
        jsonrpc: '2.0',
        id: request.id,
        result: { tools },
      }) + '\n'));

      const result = await getToolsPromise;
      expect(result).toEqual(tools);

      // Verify tools are stored
      const status = client.getServerStatus('test-server');
      expect(status.tools).toBe(2);
    });

    it('should throw if server not found', async () => {
      const client = new DefaultMCPClient();

      await expect(client.getTools('nonexistent')).rejects.toThrow(
        "Server 'nonexistent' not found"
      );
    });

    it('should throw if server not connected', async () => {
      const client = new DefaultMCPClient();
      const config: MCPServerConfig = {
        command: 'node',
        args: ['server.js'],
        timeout: 1000,
      };

      await client.startServer('test-server', config);
      
      // Stop the server
      const stopPromise = client.stopServer('test-server');
      mockProcess.emit('exit', 0, null);
      await stopPromise;

      await expect(client.getTools('test-server')).rejects.toThrow(
        "Server 'test-server' not found"
      );
    });

    it('should handle server errors', async () => {
      const client = new DefaultMCPClient();
      const config: MCPServerConfig = {
        command: 'node',
        args: ['server.js'],
        timeout: 1000,
      };

      await client.startServer('test-server', config);

      const getToolsPromise = client.getTools('test-server');

      // Simulate error response
      const request = JSON.parse(mockProcess.stdin.write.mock.calls[0][0]);
      mockProcess.stdout.emit('data', Buffer.from(JSON.stringify({
        jsonrpc: '2.0',
        id: request.id,
        error: {
          code: -32603,
          message: 'Internal error',
        },
      }) + '\n'));

      await expect(getToolsPromise).rejects.toThrow('Failed to get tools');

      // Server should be marked as error
      const status = client.getServerStatus('test-server');
      expect(status.status).toBe('error');
    });
  });

  describe('callTool', () => {
    it('should invoke tool on server', async () => {
      const client = new DefaultMCPClient();
      const config: MCPServerConfig = {
        command: 'node',
        args: ['server.js'],
        timeout: 1000,
      };

      await client.startServer('test-server', config);

      const callPromise = client.callTool('test-server', 'myTool', { arg1: 'value1' });

      // Simulate server response
      const request = JSON.parse(mockProcess.stdin.write.mock.calls[0][0]);
      expect(request.method).toBe('tools/call');
      expect(request.params).toEqual({
        name: 'myTool',
        arguments: { arg1: 'value1' },
      });

      mockProcess.stdout.emit('data', Buffer.from(JSON.stringify({
        jsonrpc: '2.0',
        id: request.id,
        result: { output: 'success' },
      }) + '\n'));

      const result = await callPromise;
      expect(result).toEqual({ output: 'success' });
    });

    it('should throw if server not found', async () => {
      const client = new DefaultMCPClient();

      await expect(client.callTool('nonexistent', 'tool', {})).rejects.toThrow(
        "Server 'nonexistent' not found"
      );
    });

    it('should throw if server not connected', async () => {
      const client = new DefaultMCPClient();
      const config: MCPServerConfig = {
        command: 'node',
        args: ['server.js'],
        timeout: 1000,
      };

      await client.startServer('test-server', config);
      
      // Stop the server
      const stopPromise = client.stopServer('test-server');
      mockProcess.emit('exit', 0, null);
      await stopPromise;

      await expect(client.callTool('test-server', 'tool', {})).rejects.toThrow(
        "Server 'test-server' not found"
      );
    });

    it('should handle tool call errors', async () => {
      const client = new DefaultMCPClient();
      const config: MCPServerConfig = {
        command: 'node',
        args: ['server.js'],
        timeout: 1000,
      };

      await client.startServer('test-server', config);

      const callPromise = client.callTool('test-server', 'myTool', {});

      // Simulate error response
      const request = JSON.parse(mockProcess.stdin.write.mock.calls[0][0]);
      mockProcess.stdout.emit('data', Buffer.from(JSON.stringify({
        jsonrpc: '2.0',
        id: request.id,
        error: {
          code: -32601,
          message: 'Tool not found',
        },
      }) + '\n'));

      await expect(callPromise).rejects.toThrow('Tool call failed: Tool not found');
    });

    it('should handle tool call timeout', async () => {
      vi.useFakeTimers();

      const client = new DefaultMCPClient();
      const config: MCPServerConfig = {
        command: 'node',
        args: ['server.js'],
        timeout: 1000,
      };

      await client.startServer('test-server', config);

      const callPromise = client.callTool('test-server', 'slowTool', {});

      // Advance time past tool timeout (30 seconds)
      vi.advanceTimersByTime(31000);

      await expect(callPromise).rejects.toThrow('Tool call timeout');

      // Server should be marked as error
      const status = client.getServerStatus('test-server');
      expect(status.status).toBe('error');

      vi.useRealTimers();
    });
  });

  describe('multi-server management', () => {
    it('should manage multiple servers independently', async () => {
      const client = new DefaultMCPClient();

      // Start multiple servers
      await client.startServer('server1', {
        command: 'node',
        args: ['s1.js'],
        timeout: 1000,
      });

      await client.startServer('server2', {
        command: 'node',
        args: ['s2.js'],
        timeout: 1000,
      });

      // Both should be connected
      expect(client.getServerStatus('server1').status).toBe('connected');
      expect(client.getServerStatus('server2').status).toBe('connected');

      // Stop one server
      const stopPromise = client.stopServer('server1');
      mockProcess.emit('exit', 0, null);
      await stopPromise;

      // First should be disconnected, second still connected
      expect(client.getServerStatus('server1').status).toBe('disconnected');
      expect(client.getServerStatus('server2').status).toBe('connected');
    });

    it('should route tool calls to correct server', async () => {
      const client = new DefaultMCPClient();

      await client.startServer('server1', {
        command: 'node',
        args: ['s1.js'],
        timeout: 1000,
      });

      await client.startServer('server2', {
        command: 'node',
        args: ['s2.js'],
        timeout: 1000,
      });

      // Call tool on server1
      const call1Promise = client.callTool('server1', 'tool1', {});
      
      // Verify request was sent
      const request1 = JSON.parse(mockProcess.stdin.write.mock.calls[0][0]);
      expect(request1.params.name).toBe('tool1');

      // Respond
      mockProcess.stdout.emit('data', Buffer.from(JSON.stringify({
        jsonrpc: '2.0',
        id: request1.id,
        result: { from: 'server1' },
      }) + '\n'));

      const result1 = await call1Promise;
      expect(result1).toEqual({ from: 'server1' });

      // Call tool on server2
      const call2Promise = client.callTool('server2', 'tool2', {});
      
      const request2 = JSON.parse(mockProcess.stdin.write.mock.calls[1][0]);
      expect(request2.params.name).toBe('tool2');

      mockProcess.stdout.emit('data', Buffer.from(JSON.stringify({
        jsonrpc: '2.0',
        id: request2.id,
        result: { from: 'server2' },
      }) + '\n'));

      const result2 = await call2Promise;
      expect(result2).toEqual({ from: 'server2' });
    });
  });

  describe('getAllServerStatuses', () => {
    it('should return empty map when no servers', () => {
      const client = new DefaultMCPClient();

      const statuses = client.getAllServerStatuses();
      expect(statuses.size).toBe(0);
    });

    it('should return status map for all servers', async () => {
      const client = new DefaultMCPClient();

      await client.startServer('server1', {
        command: 'node',
        args: ['s1.js'],
        timeout: 1000,
      });

      await client.startServer('server2', {
        command: 'node',
        args: ['s2.js'],
        timeout: 1000,
      });

      const statuses = client.getAllServerStatuses();
      expect(statuses.size).toBe(2);
      expect(statuses.has('server1')).toBe(true);
      expect(statuses.has('server2')).toBe(true);
      expect(statuses.get('server1')?.status).toBe('connected');
      expect(statuses.get('server2')?.status).toBe('connected');
    });
  });

  describe('restartServer', () => {
    it('should restart a running server', async () => {
      const client = new DefaultMCPClient();
      const config: MCPServerConfig = {
        command: 'node',
        args: ['server.js'],
        timeout: 1000,
      };

      await client.startServer('test-server', config);

      // Verify server is connected
      const initialStatus = client.getServerStatus('test-server');
      expect(initialStatus.status).toBe('connected');
      const initialUptime = initialStatus.uptime || 0;

      // Restart the server (this will stop and start it)
      const restartPromise = client.restartServer('test-server');
      
      // Simulate server exit for stop
      mockProcess.emit('exit', 0, null);
      
      await restartPromise;

      // Verify server is connected again
      const newStatus = client.getServerStatus('test-server');
      expect(newStatus.status).toBe('connected');
      // Uptime should be reset (less than initial uptime + 1 second)
      expect(newStatus.uptime).toBeLessThan(initialUptime + 1000);
    });

    it('should throw if server not found', async () => {
      const client = new DefaultMCPClient();

      await expect(client.restartServer('nonexistent')).rejects.toThrow(
        "Server 'nonexistent' not found"
      );
    });
  });

  describe('getServerLogs', () => {
    it('should return empty array (not yet implemented)', async () => {
      const client = new DefaultMCPClient();

      const logs = await client.getServerLogs('test-server');
      expect(logs).toEqual([]);
    });

    it('should accept lines parameter', async () => {
      const client = new DefaultMCPClient();

      const logs = await client.getServerLogs('test-server', 50);
      expect(logs).toEqual([]);
    });
  });
});
