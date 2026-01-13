/**
 * Property-Based Tests for MCP Client
 * 
 * Feature: stage-05-hooks-extensions-mcp
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fc from 'fast-check';
import { DefaultMCPClient } from '../mcpClient.js';
import { MCPServerConfig } from '../types.js';
import { spawn } from 'child_process';
import { EventEmitter } from 'events';

// Mock child_process
vi.mock('child_process', () => ({
  spawn: vi.fn(),
}));

describe('MCPClient Property Tests', () => {
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

  // Feature: stage-05-hooks-extensions-mcp, Property 20: MCP Server Startup
  describe('Property 20: MCP Server Startup', () => {
    it('for any configured MCP server, starting it should spawn a process and establish connection within timeout', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 20 }).filter(s => /^[a-zA-Z0-9-]+$/.test(s)), // server name
          fc.string({ minLength: 1, maxLength: 50 }), // command
          fc.array(fc.string({ maxLength: 20 }), { maxLength: 5 }), // args
          fc.option(fc.record({
            VAR1: fc.string({ maxLength: 20 }),
            VAR2: fc.string({ maxLength: 20 }),
          }), { nil: undefined }), // env
          async (serverName, command, args, env) => {
            // Reset mock for each iteration
            mockSpawn.mockReturnValue(mockProcess);
            
            const client = new DefaultMCPClient();
            const config: MCPServerConfig = {
              command,
              args,
              env: env || undefined,
              timeout: 1000,
            };

            // Start server - connection happens synchronously in mock
            await client.startServer(serverName, config);

            // Verify server is registered and connected
            const status = client.getServerStatus(serverName);
            expect(status.name).toBe(serverName);
            expect(status.status).toBe('connected');
            expect(status.error).toBeUndefined();

            // Verify spawn was called with correct parameters
            expect(mockSpawn).toHaveBeenCalledWith(command, args, expect.objectContaining({
              stdio: ['pipe', 'pipe', 'pipe'],
            }));

            // Cleanup
            const stopPromise = client.stopServer(serverName);
            mockProcess.emit('exit', 0, null);
            await stopPromise;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // Feature: stage-05-hooks-extensions-mcp, Property 21: MCP Server Failure Handling
  describe('Property 21: MCP Server Failure Handling', () => {
    it('for any MCP server that fails to start, the client should log error and mark as unavailable', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 20 }).filter(s => /^[a-zA-Z0-9-]+$/.test(s)),
          fc.string({ minLength: 1, maxLength: 50 }),
          async (serverName, command) => {
            // Make spawn throw an error
            const error = new Error('Spawn failed');
            mockSpawn.mockImplementationOnce(() => {
              throw error;
            });

            const client = new DefaultMCPClient();
            const config: MCPServerConfig = {
              command,
              args: [],
              timeout: 1000,
            };

            // Starting should fail
            await expect(client.startServer(serverName, config)).rejects.toThrow();

            // Server should not be in connected state
            const status = client.getServerStatus(serverName);
            expect(status.status).not.toBe('connected');
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // Feature: stage-05-hooks-extensions-mcp, Property 22: MCP Tool Discovery
  describe('Property 22: MCP Tool Discovery', () => {
    it('for any connected MCP server, requesting tools should return the tool list', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 20 }).filter(s => /^[a-zA-Z0-9-]+$/.test(s)),
          fc.array(
            fc.record({
              name: fc.string({ minLength: 1, maxLength: 30 }),
              description: fc.string({ maxLength: 100 }),
              inputSchema: fc.constant({}),
            }),
            { maxLength: 10 }
          ),
          async (serverName, tools) => {
            // Reset mock for each iteration
            mockSpawn.mockReturnValue(mockProcess);
            mockProcess.stdin.write.mockClear();
            
            const client = new DefaultMCPClient();
            const config: MCPServerConfig = {
              command: 'node',
              args: ['server.js'],
              timeout: 1000,
            };

            // Start server
            await client.startServer(serverName, config);

            // Request tools
            const getToolsPromise = client.getTools(serverName);

            // Wait a tick for the request to be sent
            await new Promise(resolve => setImmediate(resolve));

            // Simulate server response
            if (mockProcess.stdin.write.mock.calls.length > 0) {
              const request = JSON.parse(mockProcess.stdin.write.mock.calls[0][0]);
              const response = {
                jsonrpc: '2.0',
                id: request.id,
                result: { tools },
              };
              mockProcess.stdout.emit('data', Buffer.from(JSON.stringify(response) + '\n'));
            }

            const retrievedTools = await getToolsPromise;

            // Verify tools match
            expect(retrievedTools).toEqual(tools);

            // Verify server status reflects tool count
            const status = client.getServerStatus(serverName);
            expect(status.tools).toBe(tools.length);

            // Cleanup
            const stopPromise = client.stopServer(serverName);
            mockProcess.emit('exit', 0, null);
            await stopPromise;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // Feature: stage-05-hooks-extensions-mcp, Property 23: MCP Server Cleanup
  describe('Property 23: MCP Server Cleanup', () => {
    it('for any connected MCP server, disconnecting should remove tools and terminate process', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 20 }).filter(s => /^[a-zA-Z0-9-]+$/.test(s)),
          async (serverName) => {
            const client = new DefaultMCPClient();
            const config: MCPServerConfig = {
              command: 'node',
              args: ['server.js'],
              timeout: 1000,
            };

            // Start server
            await client.startServer(serverName, config);

            // Add some tools
            const getToolsPromise = client.getTools(serverName);
            const request = JSON.parse(mockProcess.stdin.write.mock.calls[0][0]);
            mockProcess.stdout.emit('data', Buffer.from(JSON.stringify({
              jsonrpc: '2.0',
              id: request.id,
              result: { tools: [{ name: 'test', description: 'test', inputSchema: {} }] },
            }) + '\n'));
            await getToolsPromise;

            // Verify tools exist
            let status = client.getServerStatus(serverName);
            expect(status.tools).toBe(1);

            // Stop server
            const stopPromise = client.stopServer(serverName);
            mockProcess.emit('exit', 0, null);
            await stopPromise;

            // Verify server is removed
            status = client.getServerStatus(serverName);
            expect(status.status).toBe('disconnected');
            expect(status.tools).toBe(0);

            // Verify process was killed
            expect(mockProcess.kill).toHaveBeenCalled();
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // Feature: stage-05-hooks-extensions-mcp, Property 24: Multiple MCP Servers
  describe('Property 24: Multiple MCP Servers', () => {
    it('for any set of MCP servers, the client should manage them simultaneously', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              name: fc.string({ minLength: 1, maxLength: 20 }).filter(s => /^[a-zA-Z0-9-]+$/.test(s)),
              command: fc.string({ minLength: 1, maxLength: 50 }),
              args: fc.array(fc.string({ maxLength: 20 }), { maxLength: 3 }),
            }),
            { minLength: 1, maxLength: 5 }
          ).map(servers => {
            // Ensure unique names
            const uniqueNames = new Set<string>();
            return servers.filter(s => {
              if (uniqueNames.has(s.name)) return false;
              uniqueNames.add(s.name);
              return true;
            });
          }),
          async (servers) => {
            if (servers.length === 0) return; // Skip empty arrays

            const client = new DefaultMCPClient();

            // Start all servers
            for (const server of servers) {
              await client.startServer(server.name, {
                command: server.command,
                args: server.args,
                timeout: 1000,
              });
            }

            // Verify all servers are listed
            const serverList = client.listServers();
            expect(serverList).toHaveLength(servers.length);

            // Verify each server is connected
            for (const server of servers) {
              const status = client.getServerStatus(server.name);
              expect(status.status).toBe('connected');
            }

            // Stop all servers
            for (const server of servers) {
              const stopPromise = client.stopServer(server.name);
              mockProcess.emit('exit', 0, null);
              await stopPromise;
            }

            // Verify all servers are removed
            const finalList = client.listServers();
            expect(finalList).toHaveLength(0);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
