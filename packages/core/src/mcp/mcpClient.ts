/**
 * MCP Client Implementation
 * 
 * This module provides the MCP client for managing server connections,
 * tool discovery, and tool invocations.
 */

import {
  MCPClient,
  MCPServerConfig,
  MCPServerStatus,
  MCPServerInfo,
  MCPTool,
  MCPServerStatusType,
  MCPStreamChunk,
} from './types.js';
import { MCPTransport, StdioTransport, SSETransport, HTTPTransport } from './mcpTransport.js';
import { substituteEnvObject } from './envSubstitution.js';
import type { MCPConfig } from './config.js';
import { DEFAULT_MCP_CONFIG } from './config.js';

/**
 * Internal server state
 */
interface ServerState {
  config: MCPServerConfig;
  transport: MCPTransport;
  status: MCPServerStatusType;
  error?: string;
  tools: MCPTool[];
}

/**
 * Default MCP client implementation
 * 
 * Manages multiple MCP servers, their lifecycle, and tool invocations.
 */
export class DefaultMCPClient implements MCPClient {
  private servers: Map<string, ServerState> = new Map();
  private config: Required<Omit<MCPConfig, 'servers'>> & { servers: Record<string, MCPServerConfig> };

  constructor(config?: Partial<MCPConfig>) {
    this.config = {
      enabled: config?.enabled ?? DEFAULT_MCP_CONFIG.enabled,
      connectionTimeout: config?.connectionTimeout ?? DEFAULT_MCP_CONFIG.connectionTimeout,
      servers: config?.servers ?? DEFAULT_MCP_CONFIG.servers,
    };
  }

  async startServer(name: string, config: MCPServerConfig): Promise<void> {
    // Check if MCP is enabled
    if (!this.config.enabled) {
      throw new Error('MCP integration is disabled in configuration');
    }

    // Check if server already exists
    if (this.servers.has(name)) {
      throw new Error(`Server '${name}' is already registered`);
    }

    // Create transport
    const transport = this.createTransport(config);

    // Initialize server state
    const state: ServerState = {
      config,
      transport,
      status: 'starting',
      error: undefined,
      tools: [],
    };

    this.servers.set(name, state);

    try {
      // Connect with timeout (use config timeout or server-specific timeout)
      const timeout = config.timeout || this.config.connectionTimeout;
      const connectPromise = transport.connect();
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error(`Connection timeout after ${timeout}ms`)), timeout);
      });

      await Promise.race([connectPromise, timeoutPromise]);

      // Update status to connected
      state.status = 'connected';
    } catch (error) {
      // Update status to error
      state.status = 'error';
      const errorMessage = error instanceof Error ? error.message : String(error);
      state.error = errorMessage;
      
      // Clean up
      try {
        await transport.disconnect();
      } catch {
        // Ignore disconnect errors
      }
      
      throw new Error(`Failed to start MCP server '${name}': ${state.error}`);
    }
  }

  async stopServer(name: string): Promise<void> {
    const state = this.servers.get(name);
    
    if (!state) {
      // Server doesn't exist, nothing to do
      return;
    }

    try {
      // Disconnect transport
      await state.transport.disconnect();
    } catch (error) {
      // Log error but don't throw
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`Error disconnecting MCP server '${name}': ${errorMessage}`);
    } finally {
      // Update status and remove from registry
      state.status = 'disconnected';
      state.tools = [];
      this.servers.delete(name);
    }
  }

  getServerStatus(name: string): MCPServerStatus {
    const state = this.servers.get(name);
    
    if (!state) {
      // Return disconnected status for unknown servers
      return {
        name,
        status: 'disconnected',
        error: undefined,
        tools: 0,
      };
    }

    return {
      name,
      status: state.status,
      error: state.error,
      tools: state.tools.length,
    };
  }

  listServers(): MCPServerInfo[] {
    const servers: MCPServerInfo[] = [];
    
    for (const [name, state] of this.servers.entries()) {
      servers.push({
        name,
        status: {
          name,
          status: state.status,
          error: state.error,
          tools: state.tools.length,
        },
        config: state.config,
      });
    }

    return servers;
  }

  async callTool(serverName: string, toolName: string, args: unknown): Promise<unknown> {
    const state = this.servers.get(serverName);
    
    if (!state) {
      throw new Error(`Server '${serverName}' not found`);
    }

    if (state.status !== 'connected') {
      throw new Error(`Server '${serverName}' is not connected (status: ${state.status})`);
    }

    try {
      // Default timeout for tool calls: 30 seconds
      const timeout = 30000;
      
      // Send tool call request
      const requestPromise = state.transport.sendRequest({
        method: 'tools/call',
        params: {
          name: toolName,
          arguments: args,
        },
      });

      // Create timeout promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error(`Tool call timeout after ${timeout}ms`)), timeout);
      });

      // Race between request and timeout
      const response = await Promise.race([requestPromise, timeoutPromise]);

      if (response.error) {
        throw new Error(`Tool call failed: ${response.error.message}`);
      }

      return response.result;
    } catch (error) {
      // If it's a timeout or connection error, mark server as error
      if (error instanceof Error && 
          (error.message.includes('timeout') || error.message.includes('not connected'))) {
        state.status = 'error';
        state.error = error.message;
      }
      
      throw error;
    }
  }

  async callToolStreaming(
    serverName: string,
    toolName: string,
    args: unknown,
    onChunk: (chunk: MCPStreamChunk) => void
  ): Promise<unknown> {
    const state = this.servers.get(serverName);
    
    if (!state) {
      throw new Error(`Server '${serverName}' not found`);
    }

    if (state.status !== 'connected') {
      throw new Error(`Server '${serverName}' is not connected (status: ${state.status})`);
    }

    // Check if transport supports streaming
    if (!state.transport.sendStreamingRequest) {
      // Fall back to non-streaming call
      const result = await this.callTool(serverName, toolName, args);
      // Emit a single chunk with the full result
      onChunk({ data: result, done: true });
      return result;
    }

    try {
      // Default timeout for tool calls: 30 seconds
      const timeout = 30000;
      
      // Send streaming tool call request
      const requestPromise = state.transport.sendStreamingRequest(
        {
          method: 'tools/call',
          params: {
            name: toolName,
            arguments: args,
          },
        },
        onChunk
      );

      // Create timeout promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error(`Tool call timeout after ${timeout}ms`)), timeout);
      });

      // Race between request and timeout
      const response = await Promise.race([requestPromise, timeoutPromise]);

      if (response.error) {
        throw new Error(`Tool call failed: ${response.error.message}`);
      }

      return response.result;
    } catch (error) {
      // If it's a timeout or connection error, mark server as error
      if (error instanceof Error && 
          (error.message.includes('timeout') || error.message.includes('not connected'))) {
        state.status = 'error';
        state.error = error.message;
      }
      
      throw error;
    }
  }

  async getTools(serverName: string): Promise<MCPTool[]> {
    const state = this.servers.get(serverName);
    
    if (!state) {
      throw new Error(`Server '${serverName}' not found`);
    }

    if (state.status !== 'connected') {
      throw new Error(`Server '${serverName}' is not connected (status: ${state.status})`);
    }

    try {
      // Request tools list from server
      const response = await state.transport.sendRequest({
        method: 'tools/list',
      });

      if (response.error) {
        throw new Error(`Failed to get tools: ${response.error.message}`);
      }

      // Extract tools from response
      const tools = (response.result as any)?.tools || [];
      
      // Store tools in state
      state.tools = tools;

      return tools;
    } catch (error) {
      // Update server status to error
      state.status = 'error';
      state.error = error instanceof Error ? error.message : String(error);
      
      throw error;
    }
  }

  /**
   * Create a transport for the given configuration
   * @param config - Server configuration
   * @returns Transport instance
   */
  private createTransport(config: MCPServerConfig): MCPTransport {
    const transport = config.transport || 'stdio';

    // Substitute environment variables in env config
    const processedEnv = substituteEnvObject(config.env);

    switch (transport) {
      case 'stdio':
        return new StdioTransport(config.command, config.args, processedEnv);
      case 'sse':
        // SSE transport requires a URL in the command field
        return new SSETransport(config.command);
      case 'http':
        // HTTP transport requires a URL in the command field
        return new HTTPTransport(config.command);
      default:
        throw new Error(`Unsupported transport type: ${transport}`);
    }
  }
}
