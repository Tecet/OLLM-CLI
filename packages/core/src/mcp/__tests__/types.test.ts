/**
 * Tests for MCP types
 */

import { describe, it, expect } from 'vitest';
import type {
  MCPServerConfig,
  MCPServerStatus,
  MCPTool,
  MCPRequest,
  MCPResponse,
  MCPError,
} from '../types.js';

describe('MCP Types', () => {
  describe('MCPServerConfig', () => {
    it('should define required fields', () => {
      const config: MCPServerConfig = {
        command: 'node',
        args: ['server.js'],
      };

      expect(config.command).toBe('node');
      expect(config.args).toEqual(['server.js']);
    });

    it('should support optional fields', () => {
      const config: MCPServerConfig = {
        command: 'node',
        args: ['server.js'],
        env: { TOKEN: 'secret' },
        transport: 'stdio',
        timeout: 5000,
      };

      expect(config.env).toEqual({ TOKEN: 'secret' });
      expect(config.transport).toBe('stdio');
      expect(config.timeout).toBe(5000);
    });
  });

  describe('MCPServerStatus', () => {
    it('should define status information', () => {
      const status: MCPServerStatus = {
        name: 'test-server',
        status: 'connected',
        tools: 5,
      };

      expect(status.name).toBe('test-server');
      expect(status.status).toBe('connected');
      expect(status.tools).toBe(5);
    });

    it('should support error status', () => {
      const status: MCPServerStatus = {
        name: 'test-server',
        status: 'error',
        error: 'Connection failed',
        tools: 0,
      };

      expect(status.status).toBe('error');
      expect(status.error).toBe('Connection failed');
    });
  });

  describe('MCPTool', () => {
    it('should define tool structure', () => {
      const tool: MCPTool = {
        name: 'test-tool',
        description: 'A test tool',
        inputSchema: {
          type: 'object',
          properties: {
            arg1: { type: 'string' },
          },
        },
      };

      expect(tool.name).toBe('test-tool');
      expect(tool.description).toBe('A test tool');
      expect(tool.inputSchema).toBeDefined();
    });
  });

  describe('MCPRequest', () => {
    it('should define request structure', () => {
      const request: MCPRequest = {
        method: 'tools/list',
      };

      expect(request.method).toBe('tools/list');
    });

    it('should support params', () => {
      const request: MCPRequest = {
        method: 'tools/call',
        params: { name: 'test', args: {} },
      };

      expect(request.params).toBeDefined();
    });
  });

  describe('MCPResponse', () => {
    it('should define success response', () => {
      const response: MCPResponse = {
        result: { data: 'success' },
      };

      expect(response.result).toEqual({ data: 'success' });
      expect(response.error).toBeUndefined();
    });

    it('should define error response', () => {
      const error: MCPError = {
        code: 500,
        message: 'Internal error',
      };

      const response: MCPResponse = {
        error,
      };

      expect(response.error).toBeDefined();
      expect(response.error?.code).toBe(500);
      expect(response.result).toBeUndefined();
    });
  });
});
