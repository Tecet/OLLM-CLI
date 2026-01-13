/**
 * Unit Tests for MCPToolWrapper
 * 
 * Tests tool wrapping, execution, error handling, and result formatting.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DefaultMCPToolWrapper } from '../mcpToolWrapper.js';
import type { MCPClient, MCPTool } from '../types.js';
import type { ToolContext } from '../../tools/types.js';

/**
 * Mock MCP client for testing
 */
class MockMCPClient implements MCPClient {
  private mockResults: Map<string, unknown> = new Map();
  private mockErrors: Map<string, Error> = new Map();

  async startServer(): Promise<void> {}
  async stopServer(): Promise<void> {}
  
  getServerStatus() {
    return {
      name: 'test-server',
      status: 'connected' as const,
      tools: 0,
    };
  }

  listServers() {
    return [];
  }

  async callTool(serverName: string, toolName: string, args: unknown): Promise<unknown> {
    const key = `${serverName}:${toolName}`;
    
    const error = this.mockErrors.get(key);
    if (error) {
      throw error;
    }

    // Check if we have a result set (even if it's null/undefined)
    if (this.mockResults.has(key)) {
      return this.mockResults.get(key);
    }

    // Default fallback
    return { success: true };
  }

  async callToolStreaming(
    serverName: string,
    toolName: string,
    args: unknown,
    onChunk: (chunk: any) => void
  ): Promise<unknown> {
    const key = `${serverName}:${toolName}`;
    
    const error = this.mockErrors.get(key);
    if (error) {
      throw error;
    }

    const result = this.mockResults.has(key) 
      ? this.mockResults.get(key) 
      : { success: true };

    // Simulate streaming
    if (typeof result === 'string') {
      const chunkSize = Math.max(1, Math.floor(result.length / 3));
      for (let i = 0; i < result.length; i += chunkSize) {
        const chunk = result.slice(i, i + chunkSize);
        onChunk({ data: chunk, done: false });
      }
      onChunk({ data: '', done: true });
    } else {
      onChunk({ data: result, done: true });
    }

    return result;
  }

  async getTools(): Promise<MCPTool[]> {
    return [];
  }

  setMockResult(serverName: string, toolName: string, result: unknown): void {
    this.mockResults.set(`${serverName}:${toolName}`, result);
  }

  setMockError(serverName: string, toolName: string, error: Error): void {
    this.mockErrors.set(`${serverName}:${toolName}`, error);
  }
}

/**
 * Mock tool context
 */
const mockContext: ToolContext = {
  messageBus: {
    requestConfirmation: async () => true,
  },
};

describe('MCPToolWrapper', () => {
  let wrapper: DefaultMCPToolWrapper;
  let mockClient: MockMCPClient;

  beforeEach(() => {
    mockClient = new MockMCPClient();
    wrapper = new DefaultMCPToolWrapper(mockClient);
  });

  describe('wrapTool', () => {
    it('should wrap an MCP tool with correct naming', () => {
      const mcpTool: MCPTool = {
        name: 'test-tool',
        description: 'A test tool',
        inputSchema: {},
      };

      const wrapped = wrapper.wrapTool('test-server', mcpTool);

      expect(wrapped.name).toBe('test-server:test-tool');
      expect(wrapped.displayName).toBe('test-tool');
      expect(wrapped.schema.name).toBe('test-server:test-tool');
      expect(wrapped.schema.description).toBe('A test tool');
    });

    it('should create invocations that can be executed', async () => {
      const mcpTool: MCPTool = {
        name: 'test-tool',
        description: 'A test tool',
        inputSchema: {},
      };

      mockClient.setMockResult('test-server', 'test-tool', 'success');

      const wrapped = wrapper.wrapTool('test-server', mcpTool);
      const invocation = wrapped.createInvocation({ arg: 'value' }, mockContext);

      expect(invocation).toBeDefined();
      expect(invocation.getDescription()).toContain('test-tool');
      expect(invocation.getDescription()).toContain('test-server');

      const result = await invocation.execute(new AbortController().signal);
      expect(result).toBeDefined();
      expect(result.llmContent).toBe('success');
    });

    it('should handle tools with complex schemas', () => {
      const mcpTool: MCPTool = {
        name: 'complex-tool',
        description: 'A complex tool',
        inputSchema: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            age: { type: 'number' },
          },
          required: ['name'],
        },
      };

      const wrapped = wrapper.wrapTool('test-server', mcpTool);

      expect(wrapped.schema.parameters).toBeDefined();
    });
  });

  describe('executeTool', () => {
    it('should execute a tool and return formatted result', async () => {
      mockClient.setMockResult('test-server', 'test-tool', 'Hello, World!');

      const result = await wrapper.executeTool('test-server', 'test-tool', {});

      expect(result.llmContent).toBe('Hello, World!');
      expect(result.returnDisplay).toBe('Hello, World!');
      expect(result.error).toBeUndefined();
    });

    it('should format string results correctly', async () => {
      mockClient.setMockResult('test-server', 'test-tool', 'test result');

      const result = await wrapper.executeTool('test-server', 'test-tool', {});

      expect(result.llmContent).toBe('test result');
      expect(result.returnDisplay).toBe('test result');
    });

    it('should format object results as JSON', async () => {
      const objectResult = { status: 'success', data: { id: 123 } };
      mockClient.setMockResult('test-server', 'test-tool', objectResult);

      const result = await wrapper.executeTool('test-server', 'test-tool', {});

      expect(result.llmContent).toContain('status');
      expect(result.llmContent).toContain('success');
      expect(() => JSON.parse(result.llmContent)).not.toThrow();
    });

    it('should handle null results gracefully', async () => {
      // Don't set a mock result - the client will return { success: true }
      // Instead, we need to actually set null
      mockClient.setMockResult('test-server', 'test-tool', null);

      const result = await wrapper.executeTool('test-server', 'test-tool', {});

      expect(result.llmContent).toContain('successfully');
      expect(result.error).toBeUndefined();
    });

    it('should handle undefined results gracefully', async () => {
      // Set undefined explicitly
      mockClient.setMockResult('test-server', 'test-tool', undefined);

      const result = await wrapper.executeTool('test-server', 'test-tool', {});

      expect(result.llmContent).toContain('successfully');
      expect(result.error).toBeUndefined();
    });

    it('should handle results with content field', async () => {
      mockClient.setMockResult('test-server', 'test-tool', {
        content: 'This is the content',
      });

      const result = await wrapper.executeTool('test-server', 'test-tool', {});

      expect(result.llmContent).toBe('This is the content');
    });

    it('should handle results with text field', async () => {
      mockClient.setMockResult('test-server', 'test-tool', {
        text: 'This is the text',
      });

      const result = await wrapper.executeTool('test-server', 'test-tool', {});

      expect(result.llmContent).toBe('This is the text');
    });

    it('should handle results with content array', async () => {
      mockClient.setMockResult('test-server', 'test-tool', {
        content: ['Line 1', 'Line 2', 'Line 3'],
      });

      const result = await wrapper.executeTool('test-server', 'test-tool', {});

      expect(result.llmContent).toContain('Line 1');
      expect(result.llmContent).toContain('Line 2');
      expect(result.llmContent).toContain('Line 3');
    });
  });

  describe('error handling', () => {
    it('should translate Error instances correctly', async () => {
      const error = new Error('Test error message');
      mockClient.setMockError('test-server', 'test-tool', error);

      const result = await wrapper.executeTool('test-server', 'test-tool', {});

      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain('Test error message');
      expect(result.error?.message).toContain('test-server');
      expect(result.error?.message).toContain('test-tool');
      expect(result.error?.type).toBe('Error');
    });

    it('should translate MCP error objects correctly', async () => {
      const error = new Error('MCP error');
      (error as any).code = 500;
      mockClient.setMockError('test-server', 'test-tool', error);

      const result = await wrapper.executeTool('test-server', 'test-tool', {});

      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain('MCP error');
    });

    it('should handle errors without crashing', async () => {
      mockClient.setMockError('test-server', 'test-tool', new Error('Fatal error'));

      const result = await wrapper.executeTool('test-server', 'test-tool', {});

      expect(result).toBeDefined();
      expect(result.error).toBeDefined();
      expect(result.llmContent).toBeDefined();
      expect(result.returnDisplay).toBeDefined();
    });

    it('should include server and tool name in error messages', async () => {
      mockClient.setMockError('my-server', 'my-tool', new Error('Something went wrong'));

      const result = await wrapper.executeTool('my-server', 'my-tool', {});

      expect(result.error?.message).toContain('my-server');
      expect(result.error?.message).toContain('my-tool');
      expect(result.llmContent).toContain('my-server');
      expect(result.llmContent).toContain('my-tool');
    });

    it('should handle timeout errors', async () => {
      const error = new Error('Tool call timeout after 30000ms');
      mockClient.setMockError('test-server', 'test-tool', error);

      const result = await wrapper.executeTool('test-server', 'test-tool', {});

      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain('timeout');
    });

    it('should handle connection errors', async () => {
      const error = new Error('Server not connected');
      mockClient.setMockError('test-server', 'test-tool', error);

      const result = await wrapper.executeTool('test-server', 'test-tool', {});

      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain('not connected');
    });
  });

  describe('result formatting', () => {
    it('should format boolean results', async () => {
      mockClient.setMockResult('test-server', 'test-tool', true);

      const result = await wrapper.executeTool('test-server', 'test-tool', {});

      expect(result.llmContent).toBe('true');
    });

    it('should format number results', async () => {
      mockClient.setMockResult('test-server', 'test-tool', 42);

      const result = await wrapper.executeTool('test-server', 'test-tool', {});

      expect(result.llmContent).toBe('42');
    });

    it('should format array results', async () => {
      mockClient.setMockResult('test-server', 'test-tool', [1, 2, 3]);

      const result = await wrapper.executeTool('test-server', 'test-tool', {});

      expect(result.llmContent).toContain('1');
      expect(result.llmContent).toContain('2');
      expect(result.llmContent).toContain('3');
    });

    it('should format nested object results', async () => {
      mockClient.setMockResult('test-server', 'test-tool', {
        user: {
          name: 'John',
          age: 30,
        },
      });

      const result = await wrapper.executeTool('test-server', 'test-tool', {});

      expect(result.llmContent).toContain('John');
      expect(result.llmContent).toContain('30');
    });
  });

  describe('invocation behavior', () => {
    it('should return empty locations for MCP tools', async () => {
      const mcpTool: MCPTool = {
        name: 'test-tool',
        description: 'A test tool',
        inputSchema: {},
      };

      const wrapped = wrapper.wrapTool('test-server', mcpTool);
      const invocation = wrapped.createInvocation({}, mockContext);

      expect(invocation.toolLocations()).toEqual([]);
    });

    it('should not require confirmation by default', async () => {
      const mcpTool: MCPTool = {
        name: 'test-tool',
        description: 'A test tool',
        inputSchema: {},
      };

      const wrapped = wrapper.wrapTool('test-server', mcpTool);
      const invocation = wrapped.createInvocation({}, mockContext);

      const confirmation = await invocation.shouldConfirmExecute(
        new AbortController().signal
      );

      expect(confirmation).toBe(false);
    });

    it('should respect policy engine if provided', async () => {
      const contextWithPolicy: ToolContext = {
        messageBus: mockContext.messageBus,
        policyEngine: {
          evaluate: () => 'allow',
          getRiskLevel: () => 'low',
        },
      };

      const mcpTool: MCPTool = {
        name: 'test-tool',
        description: 'A test tool',
        inputSchema: {},
      };

      const wrapped = wrapper.wrapTool('test-server', mcpTool);
      const invocation = wrapped.createInvocation({}, contextWithPolicy);

      const confirmation = await invocation.shouldConfirmExecute(
        new AbortController().signal
      );

      expect(confirmation).toBe(false);
    });

    it('should request confirmation when policy says ask', async () => {
      const contextWithPolicy: ToolContext = {
        messageBus: mockContext.messageBus,
        policyEngine: {
          evaluate: () => 'ask',
          getRiskLevel: () => 'medium',
        },
      };

      const mcpTool: MCPTool = {
        name: 'test-tool',
        description: 'A test tool',
        inputSchema: {},
      };

      const wrapped = wrapper.wrapTool('test-server', mcpTool);
      const invocation = wrapped.createInvocation({}, contextWithPolicy);

      const confirmation = await invocation.shouldConfirmExecute(
        new AbortController().signal
      );

      expect(confirmation).not.toBe(false);
      if (confirmation) {
        expect(confirmation.toolName).toBe('test-tool');
        expect(confirmation.risk).toBe('medium');
      }
    });

    it('should throw when policy denies', async () => {
      const contextWithPolicy: ToolContext = {
        messageBus: mockContext.messageBus,
        policyEngine: {
          evaluate: () => 'deny',
          getRiskLevel: () => 'high',
        },
      };

      const mcpTool: MCPTool = {
        name: 'test-tool',
        description: 'A test tool',
        inputSchema: {},
      };

      const wrapped = wrapper.wrapTool('test-server', mcpTool);
      const invocation = wrapped.createInvocation({}, contextWithPolicy);

      await expect(
        invocation.shouldConfirmExecute(new AbortController().signal)
      ).rejects.toThrow('denied by policy');
    });
  });

  describe('streaming support', () => {
    it('should handle streaming responses', async () => {
      const mcpTool: MCPTool = {
        name: 'streaming-tool',
        description: 'A streaming tool',
        inputSchema: {},
      };

      mockClient.setMockResult('test-server', 'streaming-tool', 'Hello, streaming world!');

      const wrapped = wrapper.wrapTool('test-server', mcpTool);
      const invocation = wrapped.createInvocation({}, mockContext);

      const updates: string[] = [];
      const updateOutput = (output: string) => {
        updates.push(output);
      };

      const result = await invocation.execute(
        new AbortController().signal,
        updateOutput
      );

      // Should have received streaming updates
      expect(updates.length).toBeGreaterThan(0);
      
      // Final result should be complete
      expect(result.llmContent).toBe('Hello, streaming world!');
      expect(result.returnDisplay).toBe('Hello, streaming world!');
    });

    it('should work without streaming callback', async () => {
      const mcpTool: MCPTool = {
        name: 'test-tool',
        description: 'A test tool',
        inputSchema: {},
      };

      mockClient.setMockResult('test-server', 'test-tool', 'Non-streaming result');

      const wrapped = wrapper.wrapTool('test-server', mcpTool);
      const invocation = wrapped.createInvocation({}, mockContext);

      const result = await invocation.execute(new AbortController().signal);

      expect(result.llmContent).toBe('Non-streaming result');
    });

    it('should handle streaming with structured data', async () => {
      const mcpTool: MCPTool = {
        name: 'structured-tool',
        description: 'A structured tool',
        inputSchema: {},
      };

      const structuredData = {
        content: [
          { type: 'text', text: 'Part 1' },
          { type: 'text', text: 'Part 2' },
        ],
      };

      mockClient.setMockResult('test-server', 'structured-tool', structuredData);

      const wrapped = wrapper.wrapTool('test-server', mcpTool);
      const invocation = wrapped.createInvocation({}, mockContext);

      const updates: string[] = [];
      const updateOutput = (output: string) => {
        updates.push(output);
      };

      const result = await invocation.execute(
        new AbortController().signal,
        updateOutput
      );

      expect(result).toBeDefined();
      expect(result.llmContent).toContain('Part 1');
      expect(result.llmContent).toContain('Part 2');
    });
  });

  describe('structured data handling', () => {
    it('should handle content array with text items', async () => {
      const structuredData = {
        content: [
          { type: 'text', text: 'First text' },
          { type: 'text', text: 'Second text' },
        ],
      };

      mockClient.setMockResult('test-server', 'test-tool', structuredData);

      const result = await wrapper.executeTool('test-server', 'test-tool', {});

      expect(result.llmContent).toContain('First text');
      expect(result.llmContent).toContain('Second text');
    });

    it('should handle content array with image items', async () => {
      const structuredData = {
        content: [
          { type: 'text', text: 'Description' },
          { type: 'image', uri: 'https://example.com/image.png' },
        ],
      };

      mockClient.setMockResult('test-server', 'test-tool', structuredData);

      const result = await wrapper.executeTool('test-server', 'test-tool', {});

      expect(result.llmContent).toContain('Description');
      expect(result.llmContent).toContain('[Image]');
    });

    it('should handle content array with resource items', async () => {
      const structuredData = {
        content: [
          { type: 'resource', uri: 'file:///path/to/file.txt' },
        ],
      };

      mockClient.setMockResult('test-server', 'test-tool', structuredData);

      const result = await wrapper.executeTool('test-server', 'test-tool', {});

      expect(result.llmContent).toContain('[Resource:');
      expect(result.llmContent).toContain('file:///path/to/file.txt');
    });

    it('should handle mixed content types', async () => {
      const structuredData = {
        content: [
          'Plain string',
          { type: 'text', text: 'Structured text' },
          { type: 'image', uri: 'https://example.com/img.png' },
        ],
      };

      mockClient.setMockResult('test-server', 'test-tool', structuredData);

      const result = await wrapper.executeTool('test-server', 'test-tool', {});

      expect(result.llmContent).toContain('Plain string');
      expect(result.llmContent).toContain('Structured text');
      expect(result.llmContent).toContain('[Image]');
    });

    it('should handle arrays of objects with text field', async () => {
      const arrayData = [
        { text: 'Item 1' },
        { text: 'Item 2' },
        { text: 'Item 3' },
      ];

      mockClient.setMockResult('test-server', 'test-tool', arrayData);

      const result = await wrapper.executeTool('test-server', 'test-tool', {});

      expect(result.llmContent).toContain('Item 1');
      expect(result.llmContent).toContain('Item 2');
      expect(result.llmContent).toContain('Item 3');
    });

    it('should handle complex nested structures as JSON', async () => {
      const complexData = {
        metadata: {
          version: '1.0',
          timestamp: '2024-01-01T00:00:00Z',
        },
        data: [
          { id: 1, value: 'A' },
          { id: 2, value: 'B' },
        ],
      };

      mockClient.setMockResult('test-server', 'test-tool', complexData);

      const result = await wrapper.executeTool('test-server', 'test-tool', {});

      // Should be formatted as JSON
      expect(() => JSON.parse(result.llmContent)).not.toThrow();
      const parsed = JSON.parse(result.llmContent);
      expect(parsed.metadata.version).toBe('1.0');
      expect(parsed.data).toHaveLength(2);
    });

    it('should handle primitive types', async () => {
      // Test number
      mockClient.setMockResult('test-server', 'test-tool', 42);
      let result = await wrapper.executeTool('test-server', 'test-tool', {});
      expect(result.llmContent).toBe('42');

      // Test boolean
      mockClient.setMockResult('test-server', 'test-tool', true);
      result = await wrapper.executeTool('test-server', 'test-tool', {});
      expect(result.llmContent).toBe('true');

      // Test float
      mockClient.setMockResult('test-server', 'test-tool', 3.14);
      result = await wrapper.executeTool('test-server', 'test-tool', {});
      expect(result.llmContent).toBe('3.14');
    });
  });
});
