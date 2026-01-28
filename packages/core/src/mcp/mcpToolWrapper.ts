/**
 * MCP Tool Wrapper Implementation
 *
 * This module wraps MCP tools as internal tools, handling schema conversion,
 * invocation, error translation, and result formatting.
 */

import { DefaultMCPSchemaConverter } from './mcpSchemaConverter.js';

import type { MCPClient, MCPTool, MCPStreamChunk } from './types.js';
import type {
  DeclarativeTool,
  ToolInvocation,
  ToolResult,
  ToolContext,
  ToolCallConfirmationDetails,
} from '../tools/types.js';

export type { ToolResult };

/**
 * Tool interface (simplified from internal tool system)
 */
export type Tool = DeclarativeTool<Record<string, unknown>, ToolResult>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

/**
 * MCP tool wrapper interface
 */
export interface MCPToolWrapper {
  /**
   * Create a tool wrapper for an MCP tool
   * @param serverName - Name of the MCP server providing the tool
   * @param mcpTool - MCP tool definition
   * @returns Wrapped tool
   */
  wrapTool(serverName: string, mcpTool: MCPTool): Tool;

  /**
   * Execute an MCP tool
   * @param serverName - Name of the MCP server
   * @param toolName - Name of the tool to execute
   * @param args - Tool arguments
   * @returns Tool result
   */
  executeTool(serverName: string, toolName: string, args: unknown): Promise<ToolResult>;
}

/**
 * MCP tool invocation implementation
 */
class MCPToolInvocation implements ToolInvocation<Record<string, unknown>, ToolResult> {
  constructor(
    public params: Record<string, unknown>,
    private serverName: string,
    private toolName: string,
    private mcpClient: MCPClient,
    private context: ToolContext,
    private wrapper: DefaultMCPToolWrapper
  ) {}

  getDescription(): string {
    return `Call MCP tool '${this.toolName}' on server '${this.serverName}'`;
  }

  toolLocations(): string[] {
    // MCP tools don't have specific file locations
    return [];
  }

  async shouldConfirmExecute(
    _abortSignal: AbortSignal
  ): Promise<ToolCallConfirmationDetails | false> {
    // Check policy if available
    if (this.context.policyEngine) {
      const policy = this.context.policyEngine.evaluate(this.toolName, this.params);

      if (policy === 'allow') {
        return false;
      }

      if (policy === 'deny') {
        throw new Error(`Tool '${this.toolName}' is denied by policy`);
      }

      // policy === 'ask', return confirmation details
      const risk = this.context.policyEngine.getRiskLevel(this.toolName);

      return {
        toolName: this.toolName,
        description: this.getDescription(),
        risk,
        locations: this.toolLocations(),
      };
    }

    // No policy engine, don't require confirmation
    return false;
  }

  async execute(signal: AbortSignal, updateOutput?: (output: string) => void): Promise<ToolResult> {
    try {
      // Check if streaming is supported and updateOutput callback is provided
      if (updateOutput && this.mcpClient.callToolStreaming) {
        let accumulatedResult = '';

        // Call with streaming support
        const result = await this.mcpClient.callToolStreaming(
          this.serverName,
          this.toolName,
          this.params,
          (chunk) => {
            // Handle streaming chunk
            const chunkText = this.formatStreamChunk(chunk);
            if (chunkText) {
              accumulatedResult += chunkText;
              updateOutput(accumulatedResult);
            }
          }
        );

        // Format the final result using wrapper's shared method
        const formattedResult = this.wrapper['formatMCPResult'](result);

        return {
          llmContent: formattedResult,
          returnDisplay: formattedResult,
        };
      } else {
        // Non-streaming call
        const result = await this.mcpClient.callTool(this.serverName, this.toolName, this.params);

        // Format the result using wrapper's shared method
        const formattedResult = this.wrapper['formatMCPResult'](result);

        return {
          llmContent: formattedResult,
          returnDisplay: formattedResult,
        };
      }
    } catch (error) {
      // Translate error to internal format
      return this.translateError(error);
    }
  }

  /**
   * Format a streaming chunk for display
   * @param chunk - Streaming chunk
   * @returns Formatted text or empty string
   */
  private formatStreamChunk(chunk: MCPStreamChunk): string {
    if (!chunk || !chunk.data) {
      return '';
    }

    const data = chunk.data;

    // Handle string data
    if (typeof data === 'string') {
      return data;
    }

    // Handle structured data with text field
    if (isRecord(data) && typeof data.text === 'string') {
      return data.text;
    }

    // Handle structured data with content field
    if (isRecord(data) && data.content !== undefined) {
      const content = data.content;
      if (typeof content === 'string') {
        return content;
      }
      if (Array.isArray(content)) {
        return content
          .map((item) => {
            if (typeof item === 'string') return item;
            if (isRecord(item) && typeof item.text === 'string') return item.text;
            return '';
          })
          .filter((item) => item.length > 0)
          .join('');
      }
    }

    // For other structured data, don't include in streaming output
    // (will be included in final result)
    return '';
  }

  /**
   * Translate MCP error to internal format
   * @param error - Error from MCP call
   * @returns Tool result with error
   */
  private translateError(error: unknown): ToolResult {
    let message: string;
    let type: string;

    if (error instanceof Error) {
      message = error.message;
      type = error.name;
    } else if (isRecord(error)) {
      const errorObj = error as {
        message?: string;
        error?: string;
        code?: string;
        type?: string;
      };
      message = errorObj.message || errorObj.error || String(error);
      type = errorObj.code || errorObj.type || 'MCPError';
    } else {
      message = String(error);
      type = 'MCPError';
    }

    // Add context about the MCP server and tool
    const contextMessage = `MCP tool '${this.toolName}' on server '${this.serverName}' failed: ${message}`;

    return {
      llmContent: contextMessage,
      returnDisplay: contextMessage,
      error: {
        message: contextMessage,
        type,
      },
    };
  }
}

/**
 * Default MCP tool wrapper implementation
 */
export class DefaultMCPToolWrapper implements MCPToolWrapper {
  private schemaConverter = new DefaultMCPSchemaConverter();

  constructor(private mcpClient: MCPClient) {}

  wrapTool(serverName: string, mcpTool: MCPTool): Tool {
    // Convert MCP tool schema to internal format
    const internalSchema = this.schemaConverter.convertToolSchema(mcpTool);

    // Override the name to include server prefix
    const prefixedName = `${serverName}:${mcpTool.name}`;
    internalSchema.name = prefixedName;

    // Create the wrapped tool
    const wrappedTool: Tool = {
      name: prefixedName,
      displayName: mcpTool.name,
      schema: internalSchema,
      createInvocation: (params: Record<string, unknown>, context: ToolContext) => {
        // Convert params to MCP format
        const mcpArgs = this.schemaConverter.convertArgsToMCP(params) as Record<string, unknown>;

        // Create invocation
        return new MCPToolInvocation(
          mcpArgs,
          serverName,
          mcpTool.name,
          this.mcpClient,
          context,
          this
        );
      },
    };

    return wrappedTool;
  }

  async executeTool(serverName: string, toolName: string, args: unknown): Promise<ToolResult> {
    try {
      // Call the MCP tool
      const result = await this.mcpClient.callTool(serverName, toolName, args);

      // Format for display using shared method
      const formatted = this.formatMCPResult(result);

      return {
        llmContent: formatted,
        returnDisplay: formatted,
      };
    } catch (error) {
      // Translate error
      return this.translateError(serverName, toolName, error);
    }
  }

  /**
   * Format MCP result for display (shared method used by both invocation and wrapper)
   * @param result - MCP result
   * @returns Formatted string
   */
  private formatMCPResult(result: unknown): string {
    if (result === null || result === undefined) {
      return 'Tool executed successfully (no result)';
    }

    if (typeof result === 'string') {
      return result;
    }

    if (typeof result === 'number' || typeof result === 'boolean') {
      return String(result);
    }

    if (isRecord(result) || Array.isArray(result)) {
      // Check for common MCP result formats
      const resultObj = isRecord(result) ? result : {};

      // If it has a 'content' field, use that
      if (resultObj.content !== undefined) {
        const content = resultObj.content;
        if (Array.isArray(content)) {
          // Join content array
          return content
            .map((item) => {
              if (typeof item === 'string') return item;
              if (isRecord(item) && typeof item.text === 'string') return item.text;
              if (isRecord(item) && item.type === 'text' && typeof item.text === 'string')
                return item.text;
              if (isRecord(item) && item.type === 'image') return '[Image]';
              if (isRecord(item) && item.type === 'resource') {
                return `[Resource: ${typeof item.uri === 'string' ? item.uri : 'unknown'}]`;
              }
              return JSON.stringify(item);
            })
            .join('\n');
        }
        return String(content);
      }

      // If it has a 'text' field, use that
      if (typeof resultObj.text === 'string') {
        return resultObj.text;
      }

      // Handle arrays
      if (Array.isArray(result)) {
        return result
          .map((item) => {
            if (typeof item === 'string') return item;
            if (isRecord(item) && typeof item.text === 'string') return item.text;
            return JSON.stringify(item);
          })
          .join('\n');
      }

      // For structured data objects, format as JSON
      // This handles complex structured data that MCP tools might return
      return JSON.stringify(result, null, 2);
    }

    // For other types, convert to string
    return String(result);
  }

  /**
   * Translate error to internal format
   * @param serverName - Server name
   * @param toolName - Tool name
   * @param error - Error from MCP
   * @returns Tool result with error
   */
  private translateError(serverName: string, toolName: string, error: unknown): ToolResult {
    let message: string;
    let type: string;

    if (error instanceof Error) {
      message = error.message;
      type = error.name;
    } else if (isRecord(error)) {
      const errorObj = error as {
        message?: string;
        error?: string;
        code?: string;
        type?: string;
      };
      message = errorObj.message || errorObj.error || String(error);
      type = errorObj.code || errorObj.type || 'MCPError';
    } else {
      message = String(error);
      type = 'MCPError';
    }

    const contextMessage = `MCP tool '${toolName}' on server '${serverName}' failed: ${message}`;

    return {
      llmContent: contextMessage,
      returnDisplay: contextMessage,
      error: {
        message: contextMessage,
        type,
      },
    };
  }
}
