/**
 * Property-Based Tests for MCPToolWrapper
 * 
 * Feature: stage-05-hooks-extensions-mcp
 * 
 * These tests verify universal properties of MCP tool wrapping,
 * error translation, and tool invocation.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';
import { DefaultMCPToolWrapper } from '../mcpToolWrapper.js';
import type { MCPClient, MCPTool } from '../types.js';
import type { ToolContext } from '../../tools/types.js';

/**
 * Mock MCP client for testing
 */
class MockMCPClient implements MCPClient {
  private mockTools: Map<string, MCPTool[]> = new Map();
  private mockResults: Map<string, unknown> = new Map();
  private mockErrors: Map<string, Error> = new Map();
  private streamingEnabled = false;

  async startServer(): Promise<void> {
    // Mock implementation
  }

  async stopServer(): Promise<void> {
    // Mock implementation
  }

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
    
    // Check if we should throw an error
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
    
    // Check if we should throw an error
    const error = this.mockErrors.get(key);
    if (error) {
      throw error;
    }

    // Get the result
    const result = this.mockResults.has(key) 
      ? this.mockResults.get(key) 
      : { success: true };

    // Simulate streaming by breaking result into chunks
    if (typeof result === 'string') {
      // Stream string in chunks
      const chunkSize = Math.max(1, Math.floor(result.length / 3));
      for (let i = 0; i < result.length; i += chunkSize) {
        const chunk = result.slice(i, i + chunkSize);
        onChunk({ data: chunk, done: false });
      }
      onChunk({ data: '', done: true });
    } else if (typeof result === 'object' && result !== null) {
      // For objects, emit the whole object as one chunk
      onChunk({ data: result, done: true });
    } else {
      // For other types, emit as single chunk
      onChunk({ data: result, done: true });
    }

    return result;
  }

  async getTools(serverName: string): Promise<MCPTool[]> {
    return this.mockTools.get(serverName) || [];
  }

  // Test helpers
  setMockResult(serverName: string, toolName: string, result: unknown): void {
    this.mockResults.set(`${serverName}:${toolName}`, result);
  }

  setMockError(serverName: string, toolName: string, error: Error): void {
    this.mockErrors.set(`${serverName}:${toolName}`, error);
  }

  enableStreaming(enabled: boolean): void {
    this.streamingEnabled = enabled;
  }

  clearMocks(): void {
    this.mockResults.clear();
    this.mockErrors.clear();
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

describe('MCPToolWrapper Property Tests', () => {
  let wrapper: DefaultMCPToolWrapper;
  let mockClient: MockMCPClient;

  beforeEach(() => {
    mockClient = new MockMCPClient();
    wrapper = new DefaultMCPToolWrapper(mockClient);
  });

  afterEach(() => {
    mockClient.clearMocks();
  });

  /**
   * Feature: stage-05-hooks-extensions-mcp, Property 26: MCP Error Translation
   * 
   * For any MCP tool that returns an error, the tool wrapper should translate
   * it to internal error format without crashing the CLI.
   * 
   * Validates: Requirements 8.7, 11.4
   */
  describe('Property 26: MCP Error Translation', () => {
    it('should translate any error to internal format without crashing', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1 }), // serverName
          fc.string({ minLength: 1 }), // toolName
          fc.oneof(
            // Error object
            fc.record({
              message: fc.string(),
              name: fc.string(),
            }),
            // Error-like object
            fc.record({
              error: fc.string(),
              code: fc.integer(),
            }),
            // String error
            fc.string(),
            // Number error
            fc.integer(),
            // Null/undefined
            fc.constantFrom(null, undefined)
          ),
          async (serverName, toolName, errorValue) => {
            // Set up mock to throw error
            const error = errorValue instanceof Object && 'message' in errorValue
              ? new Error(errorValue.message)
              : new Error(String(errorValue));
            
            mockClient.setMockError(serverName, toolName, error);

            // Execute tool
            const result = await wrapper.executeTool(serverName, toolName, {});

            // Verify error is translated
            expect(result).toBeDefined();
            expect(result.error).toBeDefined();
            expect(result.error?.message).toContain(serverName);
            expect(result.error?.message).toContain(toolName);
            expect(result.error?.type).toBeDefined();
            
            // Verify content includes error info
            expect(result.llmContent).toContain(serverName);
            expect(result.llmContent).toContain(toolName);
            expect(result.returnDisplay).toContain(serverName);
            expect(result.returnDisplay).toContain(toolName);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle Error instances correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1 }),
          fc.string({ minLength: 1 }),
          fc.string({ minLength: 1 }),
          fc.string({ minLength: 1 }),
          async (serverName, toolName, errorMessage, errorName) => {
            const error = new Error(errorMessage);
            error.name = errorName;
            
            mockClient.setMockError(serverName, toolName, error);

            const result = await wrapper.executeTool(serverName, toolName, {});

            expect(result.error).toBeDefined();
            expect(result.error?.message).toContain(errorMessage);
            expect(result.error?.type).toBe(errorName);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle MCP error objects correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1 }),
          fc.string({ minLength: 1 }),
          fc.string({ minLength: 1 }),
          fc.integer(),
          async (serverName, toolName, errorMessage, errorCode) => {
            const error = new Error(errorMessage);
            (error as any).code = errorCode;
            
            mockClient.setMockError(serverName, toolName, error);

            const result = await wrapper.executeTool(serverName, toolName, {});

            expect(result.error).toBeDefined();
            expect(result.error?.message).toContain(errorMessage);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Feature: stage-05-hooks-extensions-mcp, Property 37: MCP Tool Invocation
   * 
   * For any MCP tool selected by the agent, the tool wrapper should send the call
   * to the appropriate server, wait for response with timeout, and format the
   * result or error for display.
   * 
   * Validates: Requirements 17.1, 17.2, 17.3, 17.4, 17.5
   */
  describe('Property 37: MCP Tool Invocation', () => {
    it('should successfully invoke tools and format results', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1 }), // serverName
          fc.string({ minLength: 1 }), // toolName
          fc.oneof(
            fc.string(),
            fc.integer(),
            fc.boolean(),
            fc.record({
              content: fc.string(),
            }),
            fc.record({
              text: fc.string(),
            }),
            fc.object(),
            fc.constantFrom(null, undefined)
          ),
          async (serverName, toolName, mockResult) => {
            // Set up mock result
            mockClient.setMockResult(serverName, toolName, mockResult);

            // Execute tool
            const result = await wrapper.executeTool(serverName, toolName, {});

            // Verify result is formatted
            expect(result).toBeDefined();
            expect(result.llmContent).toBeDefined();
            expect(result.returnDisplay).toBeDefined();
            expect(typeof result.llmContent).toBe('string');
            expect(typeof result.returnDisplay).toBe('string');
            
            // Should not have error for successful calls
            expect(result.error).toBeUndefined();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should format string results correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1 }),
          fc.string({ minLength: 1 }),
          fc.string(),
          async (serverName, toolName, stringResult) => {
            // Clear any previous mocks to avoid interference
            mockClient.clearMocks();
            mockClient.setMockResult(serverName, toolName, stringResult);

            const result = await wrapper.executeTool(serverName, toolName, {});

            expect(result.llmContent).toBe(stringResult);
            expect(result.returnDisplay).toBe(stringResult);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should format object results as JSON', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1 }),
          fc.string({ minLength: 1 }),
          fc.object(),
          async (serverName, toolName, objectResult) => {
            mockClient.setMockResult(serverName, toolName, objectResult);

            const result = await wrapper.executeTool(serverName, toolName, {});

            // Should be valid JSON
            expect(() => JSON.parse(result.llmContent)).not.toThrow();
            expect(() => JSON.parse(result.returnDisplay)).not.toThrow();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle null/undefined results gracefully', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1 }),
          fc.string({ minLength: 1 }),
          fc.constantFrom(null, undefined),
          async (serverName, toolName, nullResult) => {
            // Clear any previous mocks to avoid interference
            mockClient.clearMocks();
            mockClient.setMockResult(serverName, toolName, nullResult);

            const result = await wrapper.executeTool(serverName, toolName, {});

            expect(result.llmContent).toBeDefined();
            expect(result.returnDisplay).toBeDefined();
            expect(result.llmContent).toContain('successfully');
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Additional property: Tool wrapping preserves tool identity
   */
  describe('Tool Wrapping Properties', () => {
    it('should create wrapped tools with correct naming', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1 }),
          fc.string({ minLength: 1 }),
          fc.string(),
          (serverName, toolName, description) => {
            const mcpTool: MCPTool = {
              name: toolName,
              description,
              inputSchema: {},
            };

            const wrapped = wrapper.wrapTool(serverName, mcpTool);

            expect(wrapped.name).toBe(`${serverName}:${toolName}`);
            expect(wrapped.displayName).toBe(toolName);
            expect(wrapped.schema.name).toBe(`${serverName}:${toolName}`);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should create invocations that can be executed', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1 }),
          fc.string({ minLength: 1 }),
          fc.object(),
          async (serverName, toolName, params) => {
            const mcpTool: MCPTool = {
              name: toolName,
              description: 'Test tool',
              inputSchema: {},
            };

            mockClient.setMockResult(serverName, toolName, { success: true });

            const wrapped = wrapper.wrapTool(serverName, mcpTool);
            const invocation = wrapped.createInvocation(params, mockContext);

            expect(invocation).toBeDefined();
            expect(invocation.getDescription()).toContain(toolName);
            expect(invocation.getDescription()).toContain(serverName);

            // Should be executable
            const result = await invocation.execute(new AbortController().signal);
            expect(result).toBeDefined();
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Feature: stage-05-hooks-extensions-mcp, Property 38: MCP Streaming and Structured Data
   * 
   * For any MCP tool that returns streaming responses or structured data,
   * the tool wrapper should handle them correctly and make them available to the agent.
   * 
   * Validates: Requirements 17.6, 17.7
   */
  describe('Property 38: MCP Streaming and Structured Data', () => {
    it('should handle streaming responses correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1 }), // serverName
          fc.string({ minLength: 1 }), // toolName
          fc.string({ minLength: 10 }), // streaming content
          async (serverName, toolName, content) => {
            mockClient.setMockResult(serverName, toolName, content);

            const mcpTool: MCPTool = {
              name: toolName,
              description: 'Streaming tool',
              inputSchema: {},
            };

            const wrapped = wrapper.wrapTool(serverName, mcpTool);
            const invocation = wrapped.createInvocation({}, mockContext);

            // Track streaming updates
            const updates: string[] = [];
            const updateOutput = (output: string) => {
              updates.push(output);
            };

            // Execute with streaming
            const result = await invocation.execute(
              new AbortController().signal,
              updateOutput
            );

            // Should have received streaming updates
            expect(updates.length).toBeGreaterThan(0);
            
            // Final result should be complete
            expect(result).toBeDefined();
            expect(result.llmContent).toBe(content);
            expect(result.returnDisplay).toBe(content);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle structured data with content field', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1 }),
          fc.string({ minLength: 1 }),
          fc.array(
            fc.oneof(
              fc.record({ type: fc.constant('text'), text: fc.string() }),
              fc.record({ type: fc.constant('image'), uri: fc.string() }),
              fc.string()
            ),
            { minLength: 1, maxLength: 5 }
          ),
          async (serverName, toolName, contentArray) => {
            const structuredResult = { content: contentArray };
            mockClient.setMockResult(serverName, toolName, structuredResult);

            const result = await wrapper.executeTool(serverName, toolName, {});

            // Should format structured content
            expect(result).toBeDefined();
            expect(result.llmContent).toBeDefined();
            expect(typeof result.llmContent).toBe('string');
            
            // Should contain text from text items
            const textItems = contentArray.filter(
              (item) => typeof item === 'object' && 'text' in item
            );
            textItems.forEach((item: any) => {
              if (item.text) {
                expect(result.llmContent).toContain(item.text);
              }
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle structured data with text field', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1 }),
          fc.string({ minLength: 1 }),
          fc.string(),
          async (serverName, toolName, textContent) => {
            const structuredResult = { text: textContent };
            mockClient.setMockResult(serverName, toolName, structuredResult);

            const result = await wrapper.executeTool(serverName, toolName, {});

            expect(result.llmContent).toBe(textContent);
            expect(result.returnDisplay).toBe(textContent);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle complex structured data as JSON', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1 }),
          fc.string({ minLength: 1 }),
          fc.record({
            data: fc.array(fc.integer()),
            metadata: fc.record({
              count: fc.integer(),
              source: fc.string(),
            }),
          }),
          async (serverName, toolName, complexData) => {
            mockClient.setMockResult(serverName, toolName, complexData);

            const result = await wrapper.executeTool(serverName, toolName, {});

            // Should format as JSON
            expect(result.llmContent).toBeDefined();
            expect(() => JSON.parse(result.llmContent)).not.toThrow();
            
            // Parsed JSON should match original data
            const parsed = JSON.parse(result.llmContent);
            expect(parsed).toEqual(complexData);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle arrays of structured data', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1 }),
          fc.string({ minLength: 1 }),
          fc.array(
            fc.oneof(
              fc.string(),
              fc.record({ text: fc.string() }),
              fc.record({ value: fc.integer() })
            ),
            { minLength: 1, maxLength: 10 }
          ),
          async (serverName, toolName, arrayData) => {
            mockClient.setMockResult(serverName, toolName, arrayData);

            const result = await wrapper.executeTool(serverName, toolName, {});

            // Should format array
            expect(result.llmContent).toBeDefined();
            expect(typeof result.llmContent).toBe('string');
            
            // Should contain string items
            arrayData.forEach((item) => {
              if (typeof item === 'string') {
                expect(result.llmContent).toContain(item);
              } else if (typeof item === 'object' && 'text' in item) {
                expect(result.llmContent).toContain(item.text);
              }
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle primitive types in structured data', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1 }),
          fc.string({ minLength: 1 }),
          fc.oneof(
            fc.integer(),
            fc.boolean(),
            fc.float()
          ),
          async (serverName, toolName, primitiveValue) => {
            mockClient.setMockResult(serverName, toolName, primitiveValue);

            const result = await wrapper.executeTool(serverName, toolName, {});

            // Should convert to string
            expect(result.llmContent).toBe(String(primitiveValue));
            expect(result.returnDisplay).toBe(String(primitiveValue));
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle streaming with structured chunks', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1 }),
          fc.string({ minLength: 1 }),
          fc.record({
            content: fc.array(
              fc.record({ type: fc.constant('text'), text: fc.string() }),
              { minLength: 1, maxLength: 3 }
            ),
          }),
          async (serverName, toolName, structuredData) => {
            mockClient.setMockResult(serverName, toolName, structuredData);

            const mcpTool: MCPTool = {
              name: toolName,
              description: 'Structured streaming tool',
              inputSchema: {},
            };

            const wrapped = wrapper.wrapTool(serverName, mcpTool);
            const invocation = wrapped.createInvocation({}, mockContext);

            // Track updates
            const updates: string[] = [];
            const updateOutput = (output: string) => {
              updates.push(output);
            };

            // Execute with streaming
            const result = await invocation.execute(
              new AbortController().signal,
              updateOutput
            );

            // Should handle structured data
            expect(result).toBeDefined();
            expect(result.llmContent).toBeDefined();
            
            // Should contain text from content array
            structuredData.content.forEach((item) => {
              expect(result.llmContent).toContain(item.text);
            });
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
