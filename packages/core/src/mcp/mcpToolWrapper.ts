/**
 * MCP Tool Wrapper Implementation
 * 
 * This module wraps MCP tools as internal tools, handling schema conversion,
 * invocation, error translation, and result formatting.
 */

import type {
  MCPClient,
  MCPTool,
} from './types.js';
import type {
  DeclarativeTool,
  ToolInvocation,
  ToolResult,
  ToolSchema,
  ToolContext,
  ToolCallConfirmationDetails,
} from '../tools/types.js';
import { DefaultMCPSchemaConverter, type MCPSchemaConverter } from './mcpSchemaConverter.js';

/**
 * Tool interface (simplified from internal tool system)
 */
export interface Tool extends DeclarativeTool<any, ToolResult> {}

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
class MCPToolInvocation implements ToolInvocation<any, ToolResult> {
  constructor(
    public params: any,
    private serverName: string,
    private toolName: string,
    private mcpClient: MCPClient,
    private context: ToolContext
  ) {}

  getDescription(): string {
    return `Call MCP tool '${this.toolName}' on server '${this.serverName}'`;
  }

  toolLocations(): string[] {
    // MCP tools don't have specific file locations
    return [];
  }

  async shouldConfirmExecute(
    abortSignal: AbortSignal
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

  async execute(
    signal: AbortSignal,
    updateOutput?: (output: string) => void
  ): Promise<ToolResult> {
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

        // Format the final result
        const formattedResult = this.formatResult(result);
        
        return {
          llmContent: formattedResult,
          returnDisplay: formattedResult,
        };
      } else {
        // Non-streaming call
        const result = await this.mcpClient.callTool(
          this.serverName,
          this.toolName,
          this.params
        );

        // Format the result
        const formattedResult = this.formatResult(result);
        
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
  private formatStreamChunk(chunk: any): string {
    if (!chunk || !chunk.data) {
      return '';
    }

    const data = chunk.data;

    // Handle string data
    if (typeof data === 'string') {
      return data;
    }

    // Handle structured data with text field
    if (typeof data === 'object' && data.text) {
      return String(data.text);
    }

    // Handle structured data with content field
    if (typeof data === 'object' && data.content) {
      if (typeof data.content === 'string') {
        return data.content;
      }
      if (Array.isArray(data.content)) {
        return data.content
          .map((item: any) => {
            if (typeof item === 'string') return item;
            if (item.text) return item.text;
            return '';
          })
          .filter(Boolean)
          .join('');
      }
    }

    // For other structured data, don't include in streaming output
    // (will be included in final result)
    return '';
  }

  /**
   * Format MCP tool result for display
   * @param result - Raw MCP result
   * @returns Formatted string
   */
  private formatResult(result: unknown): string {
    if (result === null || result === undefined) {
      return 'Tool executed successfully (no result)';
    }

    if (typeof result === 'string') {
      return result;
    }

    if (typeof result === 'number' || typeof result === 'boolean') {
      return String(result);
    }

    if (typeof result === 'object') {
      // Check for common MCP result formats
      const resultObj = result as any;
      
      // If it has a 'content' field, use that
      if (resultObj.content !== undefined) {
        if (Array.isArray(resultObj.content)) {
          // Join content array
          return resultObj.content
            .map((item: any) => {
              if (typeof item === 'string') return item;
              if (item.text) return item.text;
              if (item.type === 'text' && item.text) return item.text;
              if (item.type === 'image') return '[Image]';
              if (item.type === 'resource') return `[Resource: ${item.uri || 'unknown'}]`;
              return JSON.stringify(item);
            })
            .join('\n');
        }
        return String(resultObj.content);
      }

      // If it has a 'text' field, use that
      if (resultObj.text !== undefined) {
        return String(resultObj.text);
      }

      // Handle arrays
      if (Array.isArray(result)) {
        return result
          .map((item) => {
            if (typeof item === 'string') return item;
            if (typeof item === 'object' && item.text) return item.text;
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
    } else if (typeof error === 'object' && error !== null) {
      const errorObj = error as any;
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
      createInvocation: (params: any, context: ToolContext) => {
        // Convert params to MCP format
        const mcpArgs = this.schemaConverter.convertArgsToMCP(params);
        
        // Create invocation
        return new MCPToolInvocation(
          mcpArgs,
          serverName,
          mcpTool.name,
          this.mcpClient,
          context
        );
      },
    };

    return wrappedTool;
  }

  async executeTool(serverName: string, toolName: string, args: unknown): Promise<ToolResult> {
    try {
      // Call the MCP tool
      const result = await this.mcpClient.callTool(serverName, toolName, args);

      // Format for display (use the same logic as MCPToolInvocation)
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
   * Format MCP result for display (matches MCPToolInvocation logic)
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

    if (typeof result === 'object') {
      // Check for common MCP result formats
      const resultObj = result as any;
      
      // If it has a 'content' field, use that
      if (resultObj.content !== undefined) {
        if (Array.isArray(resultObj.content)) {
          // Join content array
          return resultObj.content
            .map((item: any) => {
              if (typeof item === 'string') return item;
              if (item.text) return item.text;
              if (item.type === 'text' && item.text) return item.text;
              if (item.type === 'image') return '[Image]';
              if (item.type === 'resource') return `[Resource: ${item.uri || 'unknown'}]`;
              return JSON.stringify(item);
            })
            .join('\n');
        }
        return String(resultObj.content);
      }

      // If it has a 'text' field, use that
      if (resultObj.text !== undefined) {
        return String(resultObj.text);
      }

      // Handle arrays
      if (Array.isArray(result)) {
        return result
          .map((item) => {
            if (typeof item === 'string') return item;
            if (typeof item === 'object' && item.text) return item.text;
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
    } else if (typeof error === 'object' && error !== null) {
      const errorObj = error as any;
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
