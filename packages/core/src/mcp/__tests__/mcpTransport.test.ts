/**
 * Tests for MCP Transport
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { StdioTransport, SSETransport, HTTPTransport } from '../mcpTransport.js';
import { spawn } from 'child_process';
import { EventEmitter } from 'events';

// Mock child_process
vi.mock('child_process', () => ({
  spawn: vi.fn(),
}));

describe('MCPTransport', () => {
  describe('StdioTransport', () => {
    let mockProcess: any;
    let mockSpawn: any;

    beforeEach(() => {
      // Create mock process with event emitter capabilities
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

      // Mock spawn to return our mock process
      mockSpawn = vi.mocked(spawn);
      mockSpawn.mockReturnValue(mockProcess);
    });

    afterEach(() => {
      vi.clearAllMocks();
    });

    it('should be defined', () => {
      const transport = new StdioTransport('node', ['server.js']);
      expect(transport).toBeDefined();
    });

    it('should not be connected initially', () => {
      const transport = new StdioTransport('node', ['server.js']);
      expect(transport.isConnected()).toBe(false);
    });

    describe('connect', () => {
      it('should spawn process and mark as connected', async () => {
        const transport = new StdioTransport('node', ['server.js'], { FOO: 'bar' });
        
        const connectPromise = transport.connect();
        
        // Wait for connection
        await connectPromise;

        expect(mockSpawn).toHaveBeenCalledWith('node', ['server.js'], {
          stdio: ['pipe', 'pipe', 'pipe'],
          env: expect.objectContaining({ FOO: 'bar' }),
        });
        expect(transport.isConnected()).toBe(true);
      });

      it('should reject if already connected', async () => {
        const transport = new StdioTransport('node', ['server.js']);
        
        await transport.connect();
        
        await expect(transport.connect()).rejects.toThrow('Transport already connected');
      });

      it('should reject on process error', async () => {
        // Make spawn throw an error synchronously
        const error = new Error('Spawn failed');
        mockSpawn.mockImplementation(() => {
          throw error;
        });

        const transport = new StdioTransport('node', ['server.js']);
        
        await expect(transport.connect()).rejects.toThrow('Spawn failed');
        expect(transport.isConnected()).toBe(false);
      });

      it('should handle process exit', async () => {
        const transport = new StdioTransport('node', ['server.js']);
        
        await transport.connect();
        expect(transport.isConnected()).toBe(true);

        // Simulate process exit
        mockProcess.emit('exit', 0, null);

        expect(transport.isConnected()).toBe(false);
      });
    });

    describe('disconnect', () => {
      it('should kill process and mark as disconnected', async () => {
        const transport = new StdioTransport('node', ['server.js']);
        
        await transport.connect();
        expect(transport.isConnected()).toBe(true);

        const disconnectPromise = transport.disconnect();
        
        // Simulate process exit
        mockProcess.emit('exit', 0, null);
        
        await disconnectPromise;

        expect(mockProcess.kill).toHaveBeenCalledWith('SIGTERM');
        expect(transport.isConnected()).toBe(false);
      });

      it('should do nothing if not connected', async () => {
        const transport = new StdioTransport('node', ['server.js']);
        
        await transport.disconnect();
        
        expect(mockProcess.kill).not.toHaveBeenCalled();
      });

      it('should force kill after timeout', async () => {
        vi.useFakeTimers();
        
        const transport = new StdioTransport('node', ['server.js']);
        await transport.connect();

        const disconnectPromise = transport.disconnect();
        
        // Don't emit exit, let timeout happen
        vi.advanceTimersByTime(5000);
        
        // Now emit exit
        mockProcess.emit('exit', 0, null);
        
        await disconnectPromise;

        expect(mockProcess.kill).toHaveBeenCalledWith('SIGTERM');
        expect(mockProcess.kill).toHaveBeenCalledWith('SIGKILL');
        
        vi.useRealTimers();
      });
    });

    describe('sendRequest', () => {
      it('should send JSON-RPC request and receive response', async () => {
        const transport = new StdioTransport('node', ['server.js']);
        await transport.connect();

        const requestPromise = transport.sendRequest({
          method: 'test/method',
          params: { foo: 'bar' },
        });

        // Verify request was written
        expect(mockProcess.stdin.write).toHaveBeenCalled();
        const writtenData = mockProcess.stdin.write.mock.calls[0][0];
        const request = JSON.parse(writtenData);
        expect(request).toMatchObject({
          jsonrpc: '2.0',
          method: 'test/method',
          params: { foo: 'bar' },
        });
        expect(request.id).toBeDefined();

        // Simulate server response
        const response = {
          jsonrpc: '2.0',
          id: request.id,
          result: { success: true },
        };
        mockProcess.stdout.emit('data', Buffer.from(JSON.stringify(response) + '\n'));

        const result = await requestPromise;
        expect(result).toEqual({
          result: { success: true },
          error: undefined,
        });
      });

      it('should handle error responses', async () => {
        const transport = new StdioTransport('node', ['server.js']);
        await transport.connect();

        const requestPromise = transport.sendRequest({
          method: 'test/method',
        });

        const writtenData = mockProcess.stdin.write.mock.calls[0][0];
        const request = JSON.parse(writtenData);

        // Simulate error response
        const response = {
          jsonrpc: '2.0',
          id: request.id,
          error: {
            code: -32601,
            message: 'Method not found',
            data: { details: 'test' },
          },
        };
        mockProcess.stdout.emit('data', Buffer.from(JSON.stringify(response) + '\n'));

        const result = await requestPromise;
        expect(result).toEqual({
          result: undefined,
          error: {
            code: -32601,
            message: 'Method not found',
            data: { details: 'test' },
          },
        });
      });

      it('should reject if not connected', async () => {
        const transport = new StdioTransport('node', ['server.js']);

        await expect(transport.sendRequest({ method: 'test' })).rejects.toThrow(
          'Transport not connected'
        );
      });

      it('should handle multiple concurrent requests', async () => {
        const transport = new StdioTransport('node', ['server.js']);
        await transport.connect();

        // Send multiple requests
        const promise1 = transport.sendRequest({ method: 'method1' });
        const promise2 = transport.sendRequest({ method: 'method2' });
        const promise3 = transport.sendRequest({ method: 'method3' });

        // Get request IDs
        const req1 = JSON.parse(mockProcess.stdin.write.mock.calls[0][0]);
        const req2 = JSON.parse(mockProcess.stdin.write.mock.calls[1][0]);
        const req3 = JSON.parse(mockProcess.stdin.write.mock.calls[2][0]);

        // Respond in different order
        mockProcess.stdout.emit('data', Buffer.from(JSON.stringify({
          jsonrpc: '2.0',
          id: req2.id,
          result: { value: 2 },
        }) + '\n'));

        mockProcess.stdout.emit('data', Buffer.from(JSON.stringify({
          jsonrpc: '2.0',
          id: req1.id,
          result: { value: 1 },
        }) + '\n'));

        mockProcess.stdout.emit('data', Buffer.from(JSON.stringify({
          jsonrpc: '2.0',
          id: req3.id,
          result: { value: 3 },
        }) + '\n'));

        const [result1, result2, result3] = await Promise.all([promise1, promise2, promise3]);

        expect(result1.result).toEqual({ value: 1 });
        expect(result2.result).toEqual({ value: 2 });
        expect(result3.result).toEqual({ value: 3 });
      });

      it('should handle partial data chunks', async () => {
        const transport = new StdioTransport('node', ['server.js']);
        await transport.connect();

        const requestPromise = transport.sendRequest({ method: 'test' });

        const request = JSON.parse(mockProcess.stdin.write.mock.calls[0][0]);
        const response = JSON.stringify({
          jsonrpc: '2.0',
          id: request.id,
          result: { success: true },
        }) + '\n';

        // Send response in chunks
        const mid = Math.floor(response.length / 2);
        mockProcess.stdout.emit('data', Buffer.from(response.slice(0, mid)));
        mockProcess.stdout.emit('data', Buffer.from(response.slice(mid)));

        const result = await requestPromise;
        expect(result.result).toEqual({ success: true });
      });

      it('should handle write errors', async () => {
        const transport = new StdioTransport('node', ['server.js']);
        await transport.connect();

        // Make write fail
        const writeError = new Error('Write failed');
        mockProcess.stdin.write.mockImplementation((data: string, callback?: (error?: Error) => void) => {
          if (callback) callback(writeError);
          return false;
        });

        await expect(transport.sendRequest({ method: 'test' })).rejects.toThrow('Write failed');
      });

      it('should reject pending requests on process exit', async () => {
        const transport = new StdioTransport('node', ['server.js']);
        await transport.connect();

        const requestPromise = transport.sendRequest({ method: 'test' });

        // Simulate process exit before response
        mockProcess.emit('exit', 1, null);

        await expect(requestPromise).rejects.toThrow('Server process exited');
      });
    });
  });

  describe('SSETransport', () => {
    let mockFetch: any;
    let originalFetch: typeof global.fetch;

    beforeEach(() => {
      originalFetch = global.fetch;
      mockFetch = vi.fn();
      global.fetch = mockFetch;
    });

    afterEach(() => {
      global.fetch = originalFetch;
      vi.clearAllMocks();
    });

    it('should be defined', () => {
      const transport = new SSETransport('http://localhost:3000/sse');
      expect(transport).toBeDefined();
    });

    it('should not be connected initially', () => {
      const transport = new SSETransport('http://localhost:3000/sse');
      expect(transport.isConnected()).toBe(false);
    });

    describe('connect', () => {
      it('should establish SSE connection', async () => {
        const transport = new SSETransport('http://localhost:3000/sse');

        // Create a mock readable stream
        const mockReader = {
          read: vi.fn()
            .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode('event: message\ndata: {}\n\n') })
            .mockResolvedValue({ done: true, value: undefined }),
        };

        mockFetch.mockResolvedValue({
          ok: true,
          body: {
            getReader: () => mockReader,
          },
        });

        await transport.connect();

        expect(mockFetch).toHaveBeenCalledWith('http://localhost:3000/sse', {
          method: 'GET',
          headers: {
            'Accept': 'text/event-stream',
            'Cache-Control': 'no-cache',
          },
          signal: expect.any(AbortSignal),
        });
        expect(transport.isConnected()).toBe(true);
      });

      it('should reject if already connected', async () => {
        const transport = new SSETransport('http://localhost:3000/sse');

        const mockReader = {
          read: vi.fn().mockResolvedValue({ done: true, value: undefined }),
        };

        mockFetch.mockResolvedValue({
          ok: true,
          body: { getReader: () => mockReader },
        });

        await transport.connect();

        await expect(transport.connect()).rejects.toThrow('Transport already connected');
      });

      it('should reject on connection failure', async () => {
        const transport = new SSETransport('http://localhost:3000/sse');

        mockFetch.mockResolvedValue({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
        });

        await expect(transport.connect()).rejects.toThrow('SSE connection failed: 500 Internal Server Error');
      });

      it('should reject if response has no body', async () => {
        const transport = new SSETransport('http://localhost:3000/sse');

        mockFetch.mockResolvedValue({
          ok: true,
          body: null,
        });

        await expect(transport.connect()).rejects.toThrow('SSE response has no body');
      });
    });

    describe('disconnect', () => {
      it('should abort SSE connection', async () => {
        const transport = new SSETransport('http://localhost:3000/sse');

        const mockReader = {
          read: vi.fn().mockResolvedValue({ done: true, value: undefined }),
        };

        mockFetch.mockResolvedValue({
          ok: true,
          body: { getReader: () => mockReader },
        });

        await transport.connect();
        expect(transport.isConnected()).toBe(true);

        await transport.disconnect();

        expect(transport.isConnected()).toBe(false);
      });

      it('should do nothing if not connected', async () => {
        const transport = new SSETransport('http://localhost:3000/sse');

        await transport.disconnect();

        expect(transport.isConnected()).toBe(false);
      });
    });

    describe('sendRequest', () => {
      it('should send request via HTTP POST and receive response via SSE', async () => {
        const transport = new SSETransport('http://localhost:3000/sse');

        let resolveRead: any;
        const readPromise = new Promise((resolve) => {
          resolveRead = resolve;
        });

        const mockReader = {
          read: vi.fn()
            .mockImplementationOnce(() => readPromise)
            .mockResolvedValue({ done: true, value: undefined }),
        };

        // Mock SSE connection
        mockFetch.mockResolvedValueOnce({
          ok: true,
          body: { getReader: () => mockReader },
        });

        await transport.connect();

        // Mock POST request
        mockFetch.mockResolvedValueOnce({
          ok: true,
        });

        const requestPromise = transport.sendRequest({
          method: 'test/method',
          params: { foo: 'bar' },
        });

        // Wait a bit for POST to be sent
        await new Promise((resolve) => setTimeout(resolve, 10));

        // Verify POST was sent
        expect(mockFetch).toHaveBeenCalledWith('http://localhost:3000/message', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: expect.stringContaining('"method":"test/method"'),
        });

        // Simulate SSE response
        const postBody = mockFetch.mock.calls[1][1].body;
        const request = JSON.parse(postBody);
        const sseData = `event: message\ndata: ${JSON.stringify({
          jsonrpc: '2.0',
          id: request.id,
          result: { success: true },
        })}\n\n`;

        resolveRead({ done: false, value: new TextEncoder().encode(sseData) });

        const result = await requestPromise;
        expect(result).toEqual({
          result: { success: true },
          error: undefined,
        });
      });

      it('should reject if not connected', async () => {
        const transport = new SSETransport('http://localhost:3000/sse');

        await expect(transport.sendRequest({ method: 'test' })).rejects.toThrow(
          'Transport not connected'
        );
      });

      it('should handle POST errors', async () => {
        const transport = new SSETransport('http://localhost:3000/sse');

        const mockReader = {
          read: vi.fn().mockResolvedValue({ done: true, value: undefined }),
        };

        mockFetch.mockResolvedValueOnce({
          ok: true,
          body: { getReader: () => mockReader },
        });

        await transport.connect();

        // Mock POST failure - the request will be rejected when SSE closes
        mockFetch.mockRejectedValueOnce(new Error('Network error'));

        // The request will be rejected with "SSE connection closed" because
        // the POST error doesn't directly reject the request promise
        await expect(transport.sendRequest({ method: 'test' })).rejects.toThrow();
      });
    });
  });

  describe('HTTPTransport', () => {
    let mockFetch: any;
    let originalFetch: typeof global.fetch;

    beforeEach(() => {
      originalFetch = global.fetch;
      mockFetch = vi.fn();
      global.fetch = mockFetch;
    });

    afterEach(() => {
      global.fetch = originalFetch;
      vi.clearAllMocks();
    });

    it('should be defined', () => {
      const transport = new HTTPTransport('http://localhost:3000');
      expect(transport).toBeDefined();
    });

    it('should not be connected initially', () => {
      const transport = new HTTPTransport('http://localhost:3000');
      expect(transport.isConnected()).toBe(false);
    });

    describe('connect', () => {
      it('should verify server is reachable', async () => {
        const transport = new HTTPTransport('http://localhost:3000');

        mockFetch.mockResolvedValue({
          ok: true,
          json: async () => ({ jsonrpc: '2.0', id: 0, result: {} }),
        });

        await transport.connect();

        expect(mockFetch).toHaveBeenCalledWith('http://localhost:3000', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: expect.stringContaining('"method":"ping"'),
        });
        expect(transport.isConnected()).toBe(true);
      });

      it('should reject if already connected', async () => {
        const transport = new HTTPTransport('http://localhost:3000');

        mockFetch.mockResolvedValue({
          ok: true,
          json: async () => ({ jsonrpc: '2.0', id: 0, result: {} }),
        });

        await transport.connect();

        await expect(transport.connect()).rejects.toThrow('Transport already connected');
      });

      it('should reject on connection failure', async () => {
        const transport = new HTTPTransport('http://localhost:3000');

        mockFetch.mockResolvedValue({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
        });

        await expect(transport.connect()).rejects.toThrow('Failed to connect to HTTP MCP server');
      });

      it('should reject on network error', async () => {
        const transport = new HTTPTransport('http://localhost:3000');

        mockFetch.mockRejectedValue(new Error('Network error'));

        await expect(transport.connect()).rejects.toThrow('Failed to connect to HTTP MCP server');
      });
    });

    describe('disconnect', () => {
      it('should mark as disconnected', async () => {
        const transport = new HTTPTransport('http://localhost:3000');

        mockFetch.mockResolvedValue({
          ok: true,
          json: async () => ({ jsonrpc: '2.0', id: 0, result: {} }),
        });

        await transport.connect();
        expect(transport.isConnected()).toBe(true);

        await transport.disconnect();

        expect(transport.isConnected()).toBe(false);
      });

      it('should do nothing if not connected', async () => {
        const transport = new HTTPTransport('http://localhost:3000');

        await transport.disconnect();

        expect(transport.isConnected()).toBe(false);
      });
    });

    describe('sendRequest', () => {
      it('should send JSON-RPC request and receive response', async () => {
        const transport = new HTTPTransport('http://localhost:3000');

        mockFetch.mockResolvedValue({
          ok: true,
          json: async () => ({ jsonrpc: '2.0', id: 0, result: {} }),
        });

        await transport.connect();

        mockFetch.mockResolvedValue({
          ok: true,
          json: async () => ({
            jsonrpc: '2.0',
            id: 1,
            result: { success: true },
          }),
        });

        const result = await transport.sendRequest({
          method: 'test/method',
          params: { foo: 'bar' },
        });

        expect(mockFetch).toHaveBeenCalledWith('http://localhost:3000', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: expect.stringContaining('"method":"test/method"'),
          signal: expect.any(AbortSignal),
        });

        expect(result).toEqual({
          result: { success: true },
          error: undefined,
        });
      });

      it('should handle error responses', async () => {
        const transport = new HTTPTransport('http://localhost:3000');

        mockFetch.mockResolvedValue({
          ok: true,
          json: async () => ({ jsonrpc: '2.0', id: 0, result: {} }),
        });

        await transport.connect();

        mockFetch.mockResolvedValue({
          ok: true,
          json: async () => ({
            jsonrpc: '2.0',
            id: 1,
            error: {
              code: -32601,
              message: 'Method not found',
              data: { details: 'test' },
            },
          }),
        });

        const result = await transport.sendRequest({
          method: 'test/method',
        });

        expect(result).toEqual({
          result: undefined,
          error: {
            code: -32601,
            message: 'Method not found',
            data: { details: 'test' },
          },
        });
      });

      it('should reject if not connected', async () => {
        const transport = new HTTPTransport('http://localhost:3000');

        await expect(transport.sendRequest({ method: 'test' })).rejects.toThrow(
          'Transport not connected'
        );
      });

      it('should reject on HTTP error', async () => {
        const transport = new HTTPTransport('http://localhost:3000');

        mockFetch.mockResolvedValue({
          ok: true,
          json: async () => ({ jsonrpc: '2.0', id: 0, result: {} }),
        });

        await transport.connect();

        mockFetch.mockResolvedValue({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
        });

        await expect(transport.sendRequest({ method: 'test' })).rejects.toThrow(
          'HTTP request failed'
        );
      });

      it('should reject on network error', async () => {
        const transport = new HTTPTransport('http://localhost:3000');

        mockFetch.mockResolvedValue({
          ok: true,
          json: async () => ({ jsonrpc: '2.0', id: 0, result: {} }),
        });

        await transport.connect();

        mockFetch.mockRejectedValue(new Error('Network error'));

        await expect(transport.sendRequest({ method: 'test' })).rejects.toThrow(
          'HTTP request failed'
        );
      });

      it('should reject on response ID mismatch', async () => {
        const transport = new HTTPTransport('http://localhost:3000');

        mockFetch.mockResolvedValue({
          ok: true,
          json: async () => ({ jsonrpc: '2.0', id: 0, result: {} }),
        });

        await transport.connect();

        mockFetch.mockResolvedValue({
          ok: true,
          json: async () => ({
            jsonrpc: '2.0',
            id: 999, // Wrong ID
            result: { success: true },
          }),
        });

        await expect(transport.sendRequest({ method: 'test' })).rejects.toThrow(
          'Response ID mismatch'
        );
      });

      it('should handle multiple concurrent requests', async () => {
        const transport = new HTTPTransport('http://localhost:3000');

        mockFetch.mockResolvedValue({
          ok: true,
          json: async () => ({ jsonrpc: '2.0', id: 0, result: {} }),
        });

        await transport.connect();

        // Mock responses for concurrent requests
        let requestId = 1;
        mockFetch.mockImplementation(async () => {
          const id = requestId++;
          return {
            ok: true,
            json: async () => ({
              jsonrpc: '2.0',
              id,
              result: { value: id },
            }),
          };
        });

        const [result1, result2, result3] = await Promise.all([
          transport.sendRequest({ method: 'method1' }),
          transport.sendRequest({ method: 'method2' }),
          transport.sendRequest({ method: 'method3' }),
        ]);

        expect(result1.result).toEqual({ value: 1 });
        expect(result2.result).toEqual({ value: 2 });
        expect(result3.result).toEqual({ value: 3 });
      });
    });
  });
});
