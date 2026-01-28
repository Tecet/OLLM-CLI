/**
 * MCP Client Tests
 *
 * Comprehensive tests for the MCP client including:
 * - Unit tests for MCPClient
 * - Integration tests for MCP connection
 * - Tests for tool execution
 * - Tests for error handling
 *
 * Validates: Requirements US-6, TR-6
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { DefaultMCPClient } from '../mcpClient.js';

import type { MCPServerConfig, MCPTransport, MCPRequest, MCPResponse, MCPTool } from '../types.js';

describe('MCPClient - Unit Tests', () => {
  let client: DefaultMCPClient;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Suppress console output during tests
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    client = new DefaultMCPClient({ enabled: true });
  });

  afterEach(async () => {
    // Clean up any running servers
    const servers = client.listServers();
    for (const server of servers) {
      await client.stopServer(server.name);
    }

    // Restore console methods
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    consoleLogSpy.mockRestore();
  });

  // ============================================================================
  // Initialization Tests
  // ============================================================================

  describe('initialization', () => {
    it('should initialize with default config', () => {
      expect(client).toBeDefined();
    });

    it('should initialize with custom config', () => {
      const customClient = new DefaultMCPClient({
        enabled: true,
        connectionTimeout: 60000,
        servers: {},
      });
      expect(customClient).toBeDefined();
    });

    it('should initialize with disabled MCP', () => {
      const disabledClient = new DefaultMCPClient({ enabled: false });
      expect(disabledClient).toBeDefined();
    });
  });

  // ============================================================================
  // Server Lifecycle Tests
  // ============================================================================

  describe('startServer', () => {
    it('should throw error when MCP is disabled', async () => {
      const disabledClient = new DefaultMCPClient({ enabled: false });

      const config: MCPServerConfig = {
        command: 'echo',
        args: ['test'],
      };

      await expect(disabledClient.startServer('test-server', config)).rejects.toThrow(
        'MCP integration is disabled'
      );
    });

    it('should throw error when server already exists', async () => {
      const mockTransport = createMockTransport();
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

      await expect(clientWithFactory.startServer('test-server', config)).rejects.toThrow(
        "Server 'test-server' is already registered"
      );
    });

    it('should start server successfully', async () => {
      const mockTransport = createMockTransport();
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

      const status = clientWithFactory.getServerStatus('test-server');
      expect(status.status).toBe('connected');
    });

    it('should handle connection timeout', async () => {
      const slowTransport = createMockTransport();
      // Simulate a slow connection that will timeout
      slowTransport.connect = vi.fn(
        (): Promise<void> =>
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Connection timeout after 100ms')), 150)
          )
      );

      const clientWithFactory = new DefaultMCPClient(
        { enabled: true, connectionTimeout: 100 },
        undefined,
        () => slowTransport
      );

      const config: MCPServerConfig = {
        command: 'test',
        args: [],
        timeout: 100,
      };

      await expect(clientWithFactory.startServer('test-server', config)).rejects.toThrow(
        'Connection timeout'
      );
    });

    it('should handle connection failure', async () => {
      const failingTransport = createMockTransport();
      failingTransport.connect = vi.fn(() => Promise.reject(new Error('Connection failed')));

      const clientWithFactory = new DefaultMCPClient(
        { enabled: true },
        undefined,
        () => failingTransport
      );

      const config: MCPServerConfig = {
        command: 'test',
        args: [],
      };

      await expect(clientWithFactory.startServer('test-server', config)).rejects.toThrow(
        'Failed to start MCP server'
      );
    });

    it('should keep server in error state after failed start', async () => {
      const failingTransport = createMockTransport();
      failingTransport.connect = vi.fn(() => Promise.reject(new Error('Connection failed')));

      const clientWithFactory = new DefaultMCPClient(
        { enabled: true },
        undefined,
        () => failingTransport
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

      const status = clientWithFactory.getServerStatus('test-server');
      expect(status.status).toBe('error');
      expect(status.error).toBeDefined();
    });
  });

  describe('stopServer', () => {
    it('should stop running server', async () => {
      const mockTransport = createMockTransport();
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
      await clientWithFactory.stopServer('test-server');

      const status = clientWithFactory.getServerStatus('test-server');
      expect(status.status).toBe('disconnected');
    });

    it('should handle stopping non-existent server', async () => {
      await expect(client.stopServer('non-existent')).resolves.not.toThrow();
    });

    it('should handle disconnect errors gracefully', async () => {
      const mockTransport = createMockTransport();
      mockTransport.disconnect = vi.fn(() => Promise.reject(new Error('Disconnect failed')));

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

      // Should not throw even if disconnect fails
      await expect(clientWithFactory.stopServer('test-server')).resolves.not.toThrow();
    });
  });

  describe('restartServer', () => {
    it('should restart server successfully', async () => {
      const mockTransport = createMockTransport();
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

      await clientWithFactory.startServer('test-server', config);
      expect(connectCount).toBe(1);

      await clientWithFactory.restartServer('test-server');
      expect(connectCount).toBe(2);

      const status = clientWithFactory.getServerStatus('test-server');
      expect(status.status).toBe('connected');
    });

    it('should throw error for non-existent server', async () => {
      await expect(client.restartServer('non-existent')).rejects.toThrow(
        "Server 'non-existent' not found"
      );
    });
  });

  // ============================================================================
  // Server Status Tests
  // ============================================================================

  describe('getServerStatus', () => {
    it('should return disconnected status for non-existent server', () => {
      const status = client.getServerStatus('non-existent');
      expect(status.status).toBe('disconnected');
      expect(status.name).toBe('non-existent');
    });

    it('should return correct status for connected server', async () => {
      const mockTransport = createMockTransport();
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

      const status = clientWithFactory.getServerStatus('test-server');
      expect(status.status).toBe('connected');
      expect(status.name).toBe('test-server');
      expect(status.tools).toBe(0);
      expect(status.uptime).toBeGreaterThanOrEqual(0);
    });

    it('should calculate uptime correctly', async () => {
      const mockTransport = createMockTransport();
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

      // Wait a bit
      await new Promise((resolve) => setTimeout(resolve, 50));

      const status = clientWithFactory.getServerStatus('test-server');
      expect(status.uptime).toBeGreaterThan(0);
    });
  });

  describe('getAllServerStatuses', () => {
    it('should return empty map when no servers', () => {
      const statuses = client.getAllServerStatuses();
      expect(statuses.size).toBe(0);
    });

    it('should return all server statuses', async () => {
      const mockTransport = createMockTransport();
      const clientWithFactory = new DefaultMCPClient(
        { enabled: true },
        undefined,
        () => mockTransport
      );

      const config: MCPServerConfig = {
        command: 'test',
        args: [],
      };

      await clientWithFactory.startServer('server1', config);
      await clientWithFactory.startServer('server2', config);

      const statuses = clientWithFactory.getAllServerStatuses();
      expect(statuses.size).toBe(2);
      expect(statuses.has('server1')).toBe(true);
      expect(statuses.has('server2')).toBe(true);
    });
  });

  describe('listServers', () => {
    it('should return empty array when no servers', () => {
      const servers = client.listServers();
      expect(servers).toEqual([]);
    });

    it('should return all servers with config', async () => {
      const mockTransport = createMockTransport();
      const clientWithFactory = new DefaultMCPClient(
        { enabled: true },
        undefined,
        () => mockTransport
      );

      const config: MCPServerConfig = {
        command: 'test',
        args: ['arg1'],
      };

      await clientWithFactory.startServer('test-server', config);

      const servers = clientWithFactory.listServers();
      expect(servers.length).toBe(1);
      expect(servers[0].name).toBe('test-server');
      expect(servers[0].config.command).toBe('test');
      expect(servers[0].config.args).toEqual(['arg1']);
    });
  });

  // ============================================================================
  // Server Logs Tests
  // ============================================================================

  describe('getServerLogs', () => {
    it('should return empty array for non-existent server', async () => {
      const logs = await client.getServerLogs('non-existent');
      expect(logs).toEqual([]);
    });

    it('should return logs for existing server', async () => {
      const mockTransport = createMockTransport();
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

    it('should limit logs to requested number of lines', async () => {
      const mockTransport = createMockTransport();
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

      const logs = await clientWithFactory.getServerLogs('test-server', 1);
      expect(logs.length).toBeLessThanOrEqual(1);
    });
  });

  // ============================================================================
  // Tool Execution Tests
  // ============================================================================

  describe('callTool', () => {
    it('should throw error for non-existent server', async () => {
      await expect(client.callTool('non-existent', 'tool', {})).rejects.toThrow(
        "Server 'non-existent' not found"
      );
    });

    it('should throw error for disconnected server', async () => {
      const mockTransport = createMockTransport();
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
      await clientWithFactory.stopServer('test-server');

      // After stopping, server is removed from registry
      await expect(clientWithFactory.callTool('test-server', 'tool', {})).rejects.toThrow(
        "Server 'test-server' not found"
      );
    });

    it('should call tool successfully', async () => {
      const mockTransport = createMockTransport();
      mockTransport.sendRequest = vi.fn((request: MCPRequest) => {
        if (request.method === 'tools/call') {
          return Promise.resolve({
            result: { success: true, data: 'test result' },
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

      const result = await clientWithFactory.callTool('test-server', 'test-tool', { arg: 'value' });
      expect(result).toEqual({ success: true, data: 'test result' });
    });

    it('should handle tool execution errors', async () => {
      const mockTransport = createMockTransport();
      mockTransport.sendRequest = vi.fn((request: MCPRequest) => {
        if (request.method === 'tools/call') {
          return Promise.resolve({
            error: {
              code: -1,
              message: 'Tool execution failed',
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

      await expect(clientWithFactory.callTool('test-server', 'test-tool', {})).rejects.toThrow(
        'Tool call failed'
      );
    });

    it('should handle timeout errors', async () => {
      const mockTransport = createMockTransport();
      mockTransport.sendRequest = vi.fn(
        (): Promise<MCPResponse> =>
          new Promise((_, reject) => setTimeout(() => reject(new Error('Tool call timeout')), 100))
      );

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

      await expect(clientWithFactory.callTool('test-server', 'test-tool', {})).rejects.toThrow(
        'timeout'
      );

      // Server should be marked as error
      const status = clientWithFactory.getServerStatus('test-server');
      expect(status.status).toBe('error');
    });
  });

  describe('getTools', () => {
    it('should throw error for non-existent server', async () => {
      await expect(client.getTools('non-existent')).rejects.toThrow(
        "Server 'non-existent' not found"
      );
    });

    it('should throw error for disconnected server', async () => {
      const mockTransport = createMockTransport();
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
      await clientWithFactory.stopServer('test-server');

      // After stopping, server is removed from registry
      await expect(clientWithFactory.getTools('test-server')).rejects.toThrow(
        "Server 'test-server' not found"
      );
    });

    it('should retrieve tools successfully', async () => {
      const mockTools: MCPTool[] = [
        {
          name: 'tool1',
          description: 'Test tool 1',
          inputSchema: { type: 'object' },
        },
        {
          name: 'tool2',
          description: 'Test tool 2',
          inputSchema: { type: 'object' },
        },
      ];

      const mockTransport = createMockTransport();
      mockTransport.sendRequest = vi.fn((request: MCPRequest) => {
        if (request.method === 'tools/list') {
          return Promise.resolve({
            result: { tools: mockTools },
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

      const tools = await clientWithFactory.getTools('test-server');
      expect(tools).toEqual(mockTools);
    });

    it('should handle empty tools list', async () => {
      const mockTransport = createMockTransport();
      mockTransport.sendRequest = vi.fn((request: MCPRequest) => {
        if (request.method === 'tools/list') {
          return Promise.resolve({
            result: { tools: [] },
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

      const tools = await clientWithFactory.getTools('test-server');
      expect(tools).toEqual([]);
    });

    it('should handle errors and mark server as error', async () => {
      const mockTransport = createMockTransport();
      mockTransport.sendRequest = vi.fn((request: MCPRequest) => {
        if (request.method === 'tools/list') {
          return Promise.resolve({
            error: {
              code: -1,
              message: 'Failed to list tools',
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

      await expect(clientWithFactory.getTools('test-server')).rejects.toThrow(
        'Failed to get tools'
      );

      const status = clientWithFactory.getServerStatus('test-server');
      expect(status.status).toBe('error');
    });
  });

  describe('getResources', () => {
    it('should throw error for non-existent server', async () => {
      await expect(client.getResources('non-existent')).rejects.toThrow(
        "Server 'non-existent' not found"
      );
    });

    it('should retrieve resources successfully', async () => {
      const mockResources = [
        {
          uri: 'file:///test.txt',
          name: 'test.txt',
          description: 'Test file',
        },
      ];

      const mockTransport = createMockTransport();
      mockTransport.sendRequest = vi.fn((request: MCPRequest) => {
        if (request.method === 'resources/list') {
          return Promise.resolve({
            result: { resources: mockResources },
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

      const resources = await clientWithFactory.getResources('test-server');
      expect(resources).toEqual(mockResources);
    });
  });

  describe('readResource', () => {
    it('should throw error for non-existent server', async () => {
      await expect(client.readResource('non-existent', 'file:///test.txt')).rejects.toThrow(
        "Server 'non-existent' not found"
      );
    });

    it('should read resource successfully', async () => {
      const mockContent = { content: 'test content' };

      const mockTransport = createMockTransport();
      mockTransport.sendRequest = vi.fn((request: MCPRequest) => {
        if (request.method === 'resources/read') {
          return Promise.resolve({
            result: mockContent,
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

      const content = await clientWithFactory.readResource('test-server', 'file:///test.txt');
      expect(content).toEqual(mockContent);
    });
  });

  describe('getPrompts', () => {
    it('should throw error for non-existent server', async () => {
      await expect(client.getPrompts('non-existent')).rejects.toThrow(
        "Server 'non-existent' not found"
      );
    });

    it('should retrieve prompts successfully', async () => {
      const mockPrompts = [
        {
          name: 'prompt1',
          description: 'Test prompt',
        },
      ];

      const mockTransport = createMockTransport();
      mockTransport.sendRequest = vi.fn((request: MCPRequest) => {
        if (request.method === 'prompts/list') {
          return Promise.resolve({
            result: { prompts: mockPrompts },
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

      const prompts = await clientWithFactory.getPrompts('test-server');
      expect(prompts).toEqual(mockPrompts);
    });
  });

  describe('getPrompt', () => {
    it('should throw error for non-existent server', async () => {
      await expect(client.getPrompt('non-existent', 'prompt1')).rejects.toThrow(
        "Server 'non-existent' not found"
      );
    });

    it('should retrieve prompt successfully', async () => {
      const mockPromptData = { messages: ['test message'] };

      const mockTransport = createMockTransport();
      mockTransport.sendRequest = vi.fn((request: MCPRequest) => {
        if (request.method === 'prompts/get') {
          return Promise.resolve({
            result: mockPromptData,
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

      const prompt = await clientWithFactory.getPrompt('test-server', 'prompt1', { arg: 'value' });
      expect(prompt).toEqual(mockPromptData);
    });
  });
});

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create a mock transport for testing
 */
function createMockTransport(): MCPTransport {
  return {
    connect: vi.fn(() => Promise.resolve()),
    disconnect: vi.fn(() => Promise.resolve()),
    sendRequest: vi.fn(() => Promise.resolve({ result: {} })),
    isConnected: vi.fn(() => true),
  };
}
