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
  MCPResource,
  MCPPrompt,
  MCPServerStatusType,
  MCPStreamChunk,
  MCPTransport,
} from './types.js';
import { StdioTransport, SSETransport, HTTPTransport } from './mcpTransport.js';
import { substituteEnvObject } from './envSubstitution.js';
import type { MCPConfig } from './config.js';
import { DEFAULT_MCP_CONFIG } from './config.js';
import { MCPOAuthProvider } from './mcpOAuth.js';

/**
 * Internal server state
 */
interface ServerState {
  config: MCPServerConfig;
  transport: MCPTransport;
  status: MCPServerStatusType;
  error?: string;
  tools: MCPTool[];
  resources: MCPResource[];
  prompts: MCPPrompt[];
  oauthProvider?: MCPOAuthProvider;
  startTime?: number; // Timestamp when server was started
  logs: string[]; // Circular buffer of log lines (max 1000 lines)
  maxLogLines: number; // Maximum number of log lines to keep in memory
}

/**
 * Default MCP client implementation
 * 
 * Manages multiple MCP servers, their lifecycle, and tool invocations.
 */
export class DefaultMCPClient implements MCPClient {
  private servers: Map<string, ServerState> = new Map();
  private config: Required<Omit<MCPConfig, 'servers'>> & { servers: Record<string, MCPServerConfig> };
  private globalOAuthProvider?: MCPOAuthProvider;

  constructor(config?: Partial<MCPConfig>, oauthProvider?: MCPOAuthProvider) {
    this.config = {
      enabled: config?.enabled ?? DEFAULT_MCP_CONFIG.enabled,
      connectionTimeout: config?.connectionTimeout ?? DEFAULT_MCP_CONFIG.connectionTimeout,
      servers: config?.servers ?? DEFAULT_MCP_CONFIG.servers,
    };
    this.globalOAuthProvider = oauthProvider;
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

    // Initialize OAuth provider if configured
    let oauthProvider: MCPOAuthProvider | undefined;
    let accessToken: string | undefined;

    if (config.oauth?.enabled) {
      // Use global provider if available, otherwise we can't share tokens easily
      // In a real CLI/Headless scenario, we'd need to init storage here.
      // For now, rely on injection for shared state.
      oauthProvider = this.globalOAuthProvider;

      if (!oauthProvider) {
         // Fallback: This isolates the server, which might be intentional in some cases,
         // but for the main app, we expect injection. 
         // We instantiate a memory-only provider here if none provided, 
         // effectively disabling persistence unless startServer caller provided one.
         // Note: Interactive Auth requires a browser/UI handler usually.
         oauthProvider = new MCPOAuthProvider();
      }

      try {
        // Register config validation
        oauthProvider.registerServerConfig(name, config.oauth);
        
        // Try to get existing token
        // We do NOT call authenticate() here because it starts interactive flow (opens browser)
        // which is bad for automated startups. We only want silent token retrieval.
        accessToken = await oauthProvider.getAccessToken(name);
        
        if (!accessToken) {
            // No token available.
            // We should NOT block startup? Or should we?
            // If we proceed without token, server might reject us.
            // If strict, throw.
            throw new Error(`No OAuth token available for ${name}. Please authenticate via settings.`);
        }
      } catch (error) {
        throw new Error(`OAuth authentication failed for server '${name}': ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    // Create transport with OAuth token if available
    const transport = this.createTransport(config, accessToken);

    // Initialize server state
    const state: ServerState = {
      config,
      transport,
      status: 'starting',
      error: undefined,
      tools: [],
      resources: [],
      prompts: [],
      oauthProvider,
      logs: [],
      maxLogLines: 1000,
    };

    this.servers.set(name, state);

    // Add log capture method
    const addLog = (message: string) => {
      const timestamp = new Date().toISOString();
      const logLine = `[${timestamp}] ${message}`;
      state.logs.push(logLine);
      
      // Keep only the last maxLogLines
      if (state.logs.length > state.maxLogLines) {
        state.logs = state.logs.slice(-state.maxLogLines);
      }
    };

    // Capture transport logs if it's a StdioTransport
    if (transport instanceof StdioTransport) {
      // Hook into stderr/stdout to capture logs
      // This is done by the transport itself, but we can add a listener
      addLog(`Starting MCP server: ${config.command} ${config.args.join(' ')}`);
    }

    try {
      addLog('Connecting to server...');
      
      // Connect with timeout (use config timeout or server-specific timeout)
      const timeout = config.timeout || this.config.connectionTimeout;
      const connectPromise = transport.connect();
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error(`Connection timeout after ${timeout}ms`)), timeout);
      });

      await Promise.race([connectPromise, timeoutPromise]);

      // Update status to connected and record start time
      state.status = 'connected';
      state.startTime = Date.now();
      addLog('Successfully connected to server');
    } catch (error) {
      // Update status to error
      state.status = 'error';
      const errorMessage = error instanceof Error ? error.message : String(error);
      state.error = errorMessage;
      addLog(`Connection failed: ${errorMessage}`);
      
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
      // Only log error if not in a test environment
      if (process.env.NODE_ENV !== 'test' && !process.env.VITEST) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`Error disconnecting MCP server '${name}': ${errorMessage}`);
      }
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
        uptime: 0,
        resources: 0,
      };
    }

    // Calculate uptime if server is connected
    const uptime = state.status === 'connected' && state.startTime 
      ? Date.now() - state.startTime 
      : 0;

    return {
      name,
      status: state.status,
      error: state.error,
      tools: state.tools.length,
      uptime,
      resources: state.resources.length,
      description: state.config.command, // Use command as description for now
    };
  }

  getAllServerStatuses(): Map<string, MCPServerStatus> {
    const statuses = new Map<string, MCPServerStatus>();
    
    for (const [name] of this.servers.entries()) {
      statuses.set(name, this.getServerStatus(name));
    }

    return statuses;
  }

  async restartServer(name: string): Promise<void> {
    const state = this.servers.get(name);
    
    if (!state) {
      throw new Error(`Server '${name}' not found`);
    }

    // Store the config before stopping
    const config = state.config;

    // Stop the server
    await this.stopServer(name);

    // Wait for 1 second to ensure clean shutdown
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Start the server again with the same config
    await this.startServer(name, config);
  }

  async getServerLogs(name: string, lines: number = 100): Promise<string[]> {
    const state = this.servers.get(name);
    
    if (!state) {
      return [];
    }
    
    // Return the last N lines from the log buffer
    const logCount = state.logs.length;
    const startIndex = Math.max(0, logCount - lines);
    return state.logs.slice(startIndex);
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
      const tools = (response.result as { tools?: MCPTool[] } | undefined)?.tools || [];
      
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

  async getResources(serverName: string): Promise<MCPResource[]> {
    const state = this.servers.get(serverName);
    
    if (!state) {
      throw new Error(`Server '${serverName}' not found`);
    }

    if (state.status !== 'connected') {
      throw new Error(`Server '${serverName}' is not connected (status: ${state.status})`);
    }

    try {
      // Request resources list from server
      const response = await state.transport.sendRequest({
        method: 'resources/list',
      });

      if (response.error) {
        throw new Error(`Failed to get resources: ${response.error.message}`);
      }

      // Extract resources from response
      const resources = (response.result as { resources?: MCPResource[] } | undefined)?.resources || [];
      
      // Store resources in state
      state.resources = resources;

      return resources;
    } catch (error) {
      // Update server status to error
      state.status = 'error';
      state.error = error instanceof Error ? error.message : String(error);
      
      throw error;
    }
  }

  async readResource(serverName: string, uri: string): Promise<unknown> {
    const state = this.servers.get(serverName);
    
    if (!state) {
      throw new Error(`Server '${serverName}' not found`);
    }

    if (state.status !== 'connected') {
      throw new Error(`Server '${serverName}' is not connected (status: ${state.status})`);
    }

    try {
      // Request resource content from server
      const response = await state.transport.sendRequest({
        method: 'resources/read',
        params: { uri },
      });

      if (response.error) {
        throw new Error(`Failed to read resource: ${response.error.message}`);
      }

      return response.result;
    } catch (error) {
      // Update server status to error
      state.status = 'error';
      state.error = error instanceof Error ? error.message : String(error);
      
      throw error;
    }
  }

  async getPrompts(serverName: string): Promise<MCPPrompt[]> {
    const state = this.servers.get(serverName);
    
    if (!state) {
      throw new Error(`Server '${serverName}' not found`);
    }

    if (state.status !== 'connected') {
      throw new Error(`Server '${serverName}' is not connected (status: ${state.status})`);
    }

    try {
      // Request prompts list from server
      const response = await state.transport.sendRequest({
        method: 'prompts/list',
      });

      if (response.error) {
        throw new Error(`Failed to get prompts: ${response.error.message}`);
      }

      // Extract prompts from response
      const prompts = (response.result as { prompts?: MCPPrompt[] } | undefined)?.prompts || [];
      
      // Store prompts in state
      state.prompts = prompts;

      return prompts;
    } catch (error) {
      // Update server status to error
      state.status = 'error';
      state.error = error instanceof Error ? error.message : String(error);
      
      throw error;
    }
  }

  async getPrompt(
    serverName: string,
    promptName: string,
    args?: Record<string, unknown>
  ): Promise<unknown> {
    const state = this.servers.get(serverName);
    
    if (!state) {
      throw new Error(`Server '${serverName}' not found`);
    }

    if (state.status !== 'connected') {
      throw new Error(`Server '${serverName}' is not connected (status: ${state.status})`);
    }

    try {
      // Request prompt from server
      const response = await state.transport.sendRequest({
        method: 'prompts/get',
        params: {
          name: promptName,
          arguments: args || {},
        },
      });

      if (response.error) {
        throw new Error(`Failed to get prompt: ${response.error.message}`);
      }

      return response.result;
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
   * @param accessToken - Optional OAuth access token
   * @returns Transport instance
   */
  private createTransport(config: MCPServerConfig, accessToken?: string): MCPTransport {
    const transport = config.transport || 'stdio';

    // Substitute environment variables in env config
    const processedEnv = substituteEnvObject(config.env);

    switch (transport) {
      case 'stdio':
        return new StdioTransport(config.command, config.args, processedEnv);
      case 'sse':
        // SSE transport requires a URL
        if (!config.url) {
          throw new Error('SSE transport requires a URL in the configuration');
        }
        return new SSETransport(config.url, accessToken);
      case 'http':
        // HTTP transport requires a URL
        if (!config.url) {
          throw new Error('HTTP transport requires a URL in the configuration');
        }
        return new HTTPTransport(config.url, accessToken);
      default:
        throw new Error(`Unsupported transport type: ${transport}`);
    }
  }
}
