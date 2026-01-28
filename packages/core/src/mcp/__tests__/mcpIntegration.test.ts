/**
 * MCP Integration Tests
 *
 * End-to-end integration tests for MCP functionality including:
 * - Full server lifecycle
 * - Tool discovery and execution
 * - Error recovery
 * - Multiple server management
 *
 * Validates: Requirements US-6, TR-6
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { DefaultMCPClient } from '../mcpClient.js';

import type { MCPServerConfig, MCPTransport, MCPRequest, MCPResponse, MCPTool } from '../types.js';

describe('MCP Integration Tests', () => {
  let client: DefaultMCPClient;

  beforeEach(() => {
    client = new DefaultMCPClient({ enabled: true });
  });

  afterEach(async () => {
    // Clean up all servers
    const servers = client.listServers();
    for (const server of servers) {
      await client.stopServer(server.name);
    }
  });

  // ============================================================================
  // Full Server Lifecycle Tests
  // ============================================================================

  describe('full server lifecycle', () => {
    it('should complete full lifecycle: start -> use -> stop', async () => {
      const mockTransport = createMockTransportWithTools();
      const clientWithFactory = new DefaultMCPClient(
        { enabled: true },
        undefined,
        () => mockTransport
      );

      const config: MCPServerConfig = {
        command: 'test',
        args: [],
      };

      // Start server
      await clientWithFactory.startServer('test-server', config);
      expect(clientWithFactory.getServerStatus('test-server').status).toBe('connected');

      // Get tools
      const tools = await clientWithFactory.getTools('test-server');
      expect(tools.length).toBeGreaterThan(0);

      // Call tool
      const result = await clientWithFactory.callTool('test-server', 'test-tool', { arg: 'value' });
      expect(result).toBeDefined();

      // Stop server
      await clientWithFactory.stopServer('test-server');
      expect(clientWithFactory.getServerStatus('test-server').status).toBe('disconnected');
    });

    it('should handle restart during active use', async () => {
      const mockTransport = createMockTransportWithTools();
      let connectCount = 0;
      mockTransport.connect = vi.fn(() => {
        connectCount++;
        return Promise.resolve();
      });

      const clientWithFactory = new DefaultMCPClient(
        { enabled: true },
        undefined,
        () => mockTransport
      );

      const config: MCPServerConfig = {
        command: 'test',
        args: [],
      };

      // Start server
      await clientWithFactory.startServer('test-server', config);
      expect(connectCount).toBe(1);

      // Use server
      await clientWithFactory.getTools('test-server');

      // Restart server
      await clientWithFactory.restartServer('test-server');
      expect(connectCount).toBe(2);

      // Server should still be usable
      const tools = await clientWithFactory.getTools('test-server');
      expect(tools).toBeDefined();
    });
  });

  // ============================================================================
  // Multiple Server Management Tests
  // ============================================================================

  describe('multiple server management', () => {
    it('should manage multiple servers independently', async () => {
      const mockTransport1 = createMockTransportWithTools();
      const mockTransport2 = createMockTransportWithTools();

      let callCount = 0;
      const clientWithFactory = new DefaultMCPClient({ enabled: true }, undefined, (_config) => {
        callCount++;
        return callCount === 1 ? mockTransport1 : mockTransport2;
      });

      const config: MCPServerConfig = {
        command: 'test',
        args: [],
      };

      // Start multiple servers
      await clientWithFactory.startServer('server1', config);
      await clientWithFactory.startServer('server2', config);

      // Both should be connected
      expect(clientWithFactory.getServerStatus('server1').status).toBe('connected');
      expect(clientWithFactory.getServerStatus('server2').status).toBe('connected');

      // Should list both servers
      const servers = clientWithFactory.listServers();
      expect(servers.length).toBe(2);

      // Stop one server
      await clientWithFactory.stopServer('server1');

      // Only one should remain
      expect(clientWithFactory.getServerStatus('server1').status).toBe('disconnected');
      expect(clientWithFactory.getServerStatus('server2').status).toBe('connected');
    });

    it('should handle mixed server states', async () => {
      const workingTransport = createMockTransportWithTools();
      const failingTransport = createMockTransportWithTools();
      failingTransport.connect = vi.fn(() => Promise.reject(new Error('Connection failed')));

      let callCount = 0;
      const clientWithFactory = new DefaultMCPClient({ enabled: true }, undefined, (_config) => {
        callCount++;
        return callCount === 1 ? workingTransport : failingTransport;
      });

      const config: MCPServerConfig = {
        command: 'test',
        args: [],
      };

      // Start working server
      await clientWithFactory.startServer('working-server', config);

      // Try to start failing server
      try {
        await clientWithFactory.startServer('failing-server', config);
      } catch {
        // Expected to fail
      }

      // Working server should still be usable
      const tools = await clientWithFactory.getTools('working-server');
      expect(tools).toBeDefined();

      // Failing server should be in error state
      expect(clientWithFactory.getServerStatus('failing-server').status).toBe('error');
    });
  });

  // ============================================================================
  // Tool Discovery and Execution Tests
  // ============================================================================

  describe('tool discovery and execution', () => {
    it('should discover tools after server start', async () => {
      const mockTools: MCPTool[] = [
        {
          name: 'read-file',
          description: 'Read a file',
          inputSchema: {
            type: 'object',
            properties: {
              path: { type: 'string' },
            },
            required: ['path'],
          },
        },
        {
          name: 'write-file',
          description: 'Write a file',
          inputSchema: {
            type: 'object',
            properties: {
              path: { type: 'string' },
              content: { type: 'string' },
            },
            required: ['path', 'content'],
          },
        },
      ];

      const mockTransport = createMockTransportWithTools(mockTools);
      const clientWithFactory = new DefaultMCPClient(
        { enabled: true },
        undefined,
        () => mockTransport
      );

      const config: MCPServerConfig = {
        command: 'test',
        args: [],
      };

      await clientWithFactory.startServer('test-server', config);

      const tools = await clientWithFactory.getTools('test-server');
      expect(tools).toEqual(mockTools);
    });

    it('should execute tools with correct parameters', async () => {
      let capturedToolName: string | undefined;
      let capturedArgs: unknown;

      const mockTransport = createMockTransportWithTools();
      mockTransport.sendRequest = vi.fn((request: MCPRequest) => {
        if (request.method === 'tools/call') {
          const params = request.params as any;
          capturedToolName = params.name;
          capturedArgs = params.arguments;
          return Promise.resolve({
            result: { success: true, data: 'executed' },
          });
        }
        if (request.method === 'tools/list') {
          return Promise.resolve({
            result: {
              tools: [
                {
                  name: 'test-tool',
                  description: 'Test tool',
                  inputSchema: { type: 'object' },
                },
              ],
            },
          });
        }
        return Promise.resolve({ result: {} });
      });

      const clientWithFactory = new DefaultMCPClient(
        { enabled: true },
        undefined,
        () => mockTransport
      );

      const config: MCPServerConfig = {
        command: 'test',
        args: [],
      };

      await clientWithFactory.startServer('test-server', config);

      const args = { path: '/test/file.txt', content: 'test content' };
      await clientWithFactory.callTool('test-server', 'write-file', args);

      expect(capturedToolName).toBe('write-file');
      expect(capturedArgs).toEqual(args);
    });

    it('should handle tool execution errors gracefully', async () => {
      const mockTransport = createMockTransportWithTools();
      mockTransport.sendRequest = vi.fn((request: MCPRequest) => {
        if (request.method === 'tools/call') {
          return Promise.resolve({
            error: {
              code: -32000,
              message: 'File not found',
              data: { path: '/nonexistent.txt' },
            },
          });
        }
        return Promise.resolve({ result: {} });
      });

      const clientWithFactory = new DefaultMCPClient(
        { enabled: true },
        undefined,
        () => mockTransport
      );

      const config: MCPServerConfig = {
        command: 'test',
        args: [],
      };

      await clientWithFactory.startServer('test-server', config);

      await expect(
        clientWithFactory.callTool('test-server', 'read-file', { path: '/nonexistent.txt' })
      ).rejects.toThrow('File not found');
    });
  });

  // ============================================================================
  // Error Recovery Tests
  // ============================================================================

  describe('error recovery', () => {
    it('should recover from connection timeout via restart', async () => {
      const mockTransport = createMockTransportWithTools();
      let connectAttempts = 0;
      mockTransport.connect = vi.fn((): Promise<void> => {
        connectAttempts++;
        if (connectAttempts === 1) {
          return new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Connection timeout')), 100)
          );
        }
        return Promise.resolve();
      });

      const clientWithFactory = new DefaultMCPClient(
        { enabled: true, connectionTimeout: 100 },
        undefined,
        () => mockTransport
      );

      const config: MCPServerConfig = {
        command: 'test',
        args: [],
        timeout: 100,
      };

      // First attempt should fail
      try {
        await clientWithFactory.startServer('test-server', config);
      } catch {
        // Expected to fail
      }

      expect(clientWithFactory.getServerStatus('test-server').status).toBe('error');

      // Restart should succeed
      await clientWithFactory.restartServer('test-server');
      expect(clientWithFactory.getServerStatus('test-server').status).toBe('connected');
    });

    it('should mark server as error after tool timeout', async () => {
      const mockTransport = createMockTransportWithTools();
      mockTransport.sendRequest = vi.fn((request: MCPRequest): Promise<MCPResponse> => {
        if (request.method === 'tools/call') {
          return new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Tool call timeout')), 100)
          );
        }
        return Promise.resolve({ result: {} });
      });

      const clientWithFactory = new DefaultMCPClient(
        { enabled: true },
        undefined,
        () => mockTransport
      );

      const config: MCPServerConfig = {
        command: 'test',
        args: [],
      };

      await clientWithFactory.startServer('test-server', config);

      // Tool call should timeout
      try {
        await clientWithFactory.callTool('test-server', 'slow-tool', {});
      } catch {
        // Expected to fail
      }

      // Server should be marked as error
      const status = clientWithFactory.getServerStatus('test-server');
      expect(status.status).toBe('error');
      expect(status.error).toContain('timeout');
    });

    it('should allow restart after error state', async () => {
      const mockTransport = createMockTransportWithTools();
      let connectAttempts = 0;
      mockTransport.connect = vi.fn(() => {
        connectAttempts++;
        if (connectAttempts === 1) {
          return Promise.reject(new Error('Connection failed'));
        }
        return Promise.resolve();
      });

      const clientWithFactory = new DefaultMCPClient(
        { enabled: true },
        undefined,
        () => mockTransport
      );

      const config: MCPServerConfig = {
        command: 'test',
        args: [],
      };

      // First attempt should fail
      try {
        await clientWithFactory.startServer('test-server', config);
      } catch {
        // Expected to fail
      }

      expect(clientWithFactory.getServerStatus('test-server').status).toBe('error');

      // Restart should succeed
      await clientWithFactory.restartServer('test-server');
      expect(clientWithFactory.getServerStatus('test-server').status).toBe('connected');

      // Server should be usable
      const tools = await clientWithFactory.getTools('test-server');
      expect(tools).toBeDefined();
    });
  });

  // ============================================================================
  // Resource Management Tests
  // ============================================================================

  describe('resource management', () => {
    it('should list and read resources', async () => {
      const mockResources = [
        {
          uri: 'file:///test.txt',
          name: 'test.txt',
          description: 'Test file',
        },
      ];

      const mockTransport = createMockTransportWithTools();
      mockTransport.sendRequest = vi.fn((request: MCPRequest) => {
        if (request.method === 'resources/list') {
          return Promise.resolve({
            result: { resources: mockResources },
          });
        }
        if (request.method === 'resources/read') {
          return Promise.resolve({
            result: { content: 'test content' },
          });
        }
        return Promise.resolve({ result: {} });
      });

      const clientWithFactory = new DefaultMCPClient(
        { enabled: true },
        undefined,
        () => mockTransport
      );

      const config: MCPServerConfig = {
        command: 'test',
        args: [],
      };

      await clientWithFactory.startServer('test-server', config);

      // List resources
      const resources = await clientWithFactory.getResources('test-server');
      expect(resources).toEqual(mockResources);

      // Read resource
      const content = await clientWithFactory.readResource('test-server', 'file:///test.txt');
      expect(content).toEqual({ content: 'test content' });
    });
  });

  // ============================================================================
  // Prompt Management Tests
  // ============================================================================

  describe('prompt management', () => {
    it('should list and get prompts', async () => {
      const mockPrompts = [
        {
          name: 'code-review',
          description: 'Review code',
          arguments: [{ name: 'code', required: true }],
        },
      ];

      const mockTransport = createMockTransportWithTools();
      mockTransport.sendRequest = vi.fn((request: MCPRequest) => {
        if (request.method === 'prompts/list') {
          return Promise.resolve({
            result: { prompts: mockPrompts },
          });
        }
        if (request.method === 'prompts/get') {
          return Promise.resolve({
            result: { messages: ['Review this code...'] },
          });
        }
        return Promise.resolve({ result: {} });
      });

      const clientWithFactory = new DefaultMCPClient(
        { enabled: true },
        undefined,
        () => mockTransport
      );

      const config: MCPServerConfig = {
        command: 'test',
        args: [],
      };

      await clientWithFactory.startServer('test-server', config);

      // List prompts
      const prompts = await clientWithFactory.getPrompts('test-server');
      expect(prompts).toEqual(mockPrompts);

      // Get prompt
      const prompt = await clientWithFactory.getPrompt('test-server', 'code-review', {
        code: 'test',
      });
      expect(prompt).toEqual({ messages: ['Review this code...'] });
    });
  });

  // ============================================================================
  // Server Logs Tests
  // ============================================================================

  describe('server logs', () => {
    it('should capture logs during server lifecycle', async () => {
      const mockTransport = createMockTransportWithTools();
      const clientWithFactory = new DefaultMCPClient(
        { enabled: true },
        undefined,
        () => mockTransport
      );

      const config: MCPServerConfig = {
        command: 'test',
        args: [],
      };

      await clientWithFactory.startServer('test-server', config);

      const logs = await clientWithFactory.getServerLogs('test-server');
      expect(logs.length).toBeGreaterThan(0);
      // Logs should contain connection-related messages
      expect(logs.some((log) => log.includes('Connecting') || log.includes('connected'))).toBe(
        true
      );
    });

    it('should capture error logs', async () => {
      const mockTransport = createMockTransportWithTools();
      mockTransport.connect = vi.fn(() => Promise.reject(new Error('Connection failed')));

      const clientWithFactory = new DefaultMCPClient(
        { enabled: true },
        undefined,
        () => mockTransport
      );

      const config: MCPServerConfig = {
        command: 'test',
        args: [],
      };

      try {
        await clientWithFactory.startServer('test-server', config);
      } catch {
        // Expected to fail
      }

      const logs = await clientWithFactory.getServerLogs('test-server');
      expect(logs.some((log) => log.includes('Connection failed'))).toBe(true);
    });
  });
});

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create a mock transport with tool support
 */
function createMockTransportWithTools(tools?: MCPTool[]): MCPTransport {
  const defaultTools: MCPTool[] = tools || [
    {
      name: 'test-tool',
      description: 'Test tool',
      inputSchema: {
        type: 'object',
        properties: {
          arg: { type: 'string' },
        },
      },
    },
  ];

  return {
    connect: vi.fn(() => Promise.resolve()),
    disconnect: vi.fn(() => Promise.resolve()),
    sendRequest: vi.fn((request: MCPRequest) => {
      if (request.method === 'tools/list') {
        return Promise.resolve({
          result: { tools: defaultTools },
        });
      }
      if (request.method === 'tools/call') {
        return Promise.resolve({
          result: { success: true },
        });
      }
      return Promise.resolve({ result: {} });
    }),
    isConnected: vi.fn(() => true),
  };
}
