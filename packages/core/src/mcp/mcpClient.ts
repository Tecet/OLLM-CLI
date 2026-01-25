/**
 * MCP Client Implementation
 * 
 * This module provides the MCP client for managing server connections,
 * tool discovery, and tool invocations.
 */

import { DEFAULT_MCP_CONFIG } from './config.js';
import { substituteEnvObject } from './envSubstitution.js';
import { MCPOAuthProvider } from './mcpOAuth.js';
import { StdioTransport, SSETransport, HTTPTransport } from './mcpTransport.js';
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

import type { MCPConfig } from './config.js';

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
  private transportFactory?: (config: MCPServerConfig, accessToken?: string) => MCPTransport;
  private globalOAuthProvider?: MCPOAuthProvider;

  constructor(config?: Partial<MCPConfig>, oauthProvider?: MCPOAuthProvider, transportFactory?: (config: MCPServerConfig, accessToken?: string) => MCPTransport) {
    this.config = {
      enabled: config?.enabled ?? DEFAULT_MCP_CONFIG.enabled,
      connectionTimeout: config?.connectionTimeout ?? DEFAULT_MCP_CONFIG.connectionTimeout,
      servers: config?.servers ?? DEFAULT_MCP_CONFIG.servers,
    };
    this.globalOAuthProvider = oauthProvider;
    this.transportFactory = transportFactory;
  }

  /**
   * Start an MCP server
   * 
   * This method initializes and connects to an MCP server. The startup process:
   * 1. Validates MCP is enabled in configuration
   * 2. Checks server isn't already running
   * 3. Handles OAuth authentication if required
   * 4. Creates appropriate transport (stdio/SSE/HTTP)
   * 5. Establishes connection with timeout
   * 6. Initializes server state and log capture
   * 
   * Connection Timeout:
   * - Default: 30 seconds (configurable via config.connectionTimeout)
   * - Can be overridden per-server via config.timeout
   * - Increased from 10s to 30s to accommodate slow-starting Python servers
   * 
   * OAuth Flow:
   * - Uses global OAuth provider for token sharing across servers
   * - Only retrieves existing tokens (no interactive auth during startup)
   * - Throws error if OAuth is required but no token exists
   * - User must authenticate via MCP Panel UI before enabling server
   * 
   * Error Handling:
   * - Failed servers remain in registry with 'error' status
   * - Allows UI to display error and offer retry/troubleshooting
   * - Logs are captured even during failed startup attempts
   * 
   * @param name - Unique server identifier
   * @param config - Server configuration including command, args, transport type
   * @throws {Error} If MCP is disabled, server already exists, OAuth fails, or connection fails
   */
  async startServer(name: string, config: MCPServerConfig): Promise<void> {
    // Check if MCP is enabled globally
    if (!this.config.enabled) {
      throw new Error('MCP integration is disabled in configuration');
    }

    // Prevent duplicate server registration
    if (this.servers.has(name)) {
      throw new Error(`Server '${name}' is already registered`);
    }

    // Initialize OAuth provider if server requires authentication
    let oauthProvider: MCPOAuthProvider | undefined;
    let accessToken: string | undefined;

    if (config.oauth?.enabled) {
      // Use global OAuth provider for token sharing across servers
      // This allows multiple servers to use the same OAuth credentials
      oauthProvider = this.globalOAuthProvider;

      if (!oauthProvider) {
         // Fallback: Create isolated provider for this server
         // Note: This disables token persistence and sharing
         // In production, global provider should always be injected
         oauthProvider = new MCPOAuthProvider();
      }

      try {
        // Register OAuth configuration for validation
        oauthProvider.registerServerConfig(name, config.oauth);
        
        // Attempt to retrieve existing OAuth token
        // IMPORTANT: We do NOT call authenticate() here because it triggers
        // interactive browser flow, which is inappropriate during automated startup.
        // Users must authenticate via MCP Panel UI before enabling OAuth servers.
        accessToken = await oauthProvider.getAccessToken(name);
        
        if (!accessToken) {
            // No token available - provide helpful error message
            throw new Error(
              `OAuth authentication required for ${name}.\n` +
              `To authenticate:\n` +
              `1. Open MCP Panel (Ctrl+M)\n` +
              `2. Select "${name}" server\n` +
              `3. Press 'O' for OAuth configuration\n` +
              `4. Follow the browser authentication flow`
            );
        }
      } catch (error) {
        throw new Error(`OAuth authentication failed for server '${name}': ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    // Create transport based on configuration
    // Prefer injected factory for testing, otherwise use default factory
    const transport = this.transportFactory ? this.transportFactory(config, accessToken) : this.createTransport(config, accessToken);

    // Initialize server state with empty collections
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
      maxLogLines: 1000, // Circular buffer size for log retention
    };

    this.servers.set(name, state);

    // Log capture helper - adds timestamped entries to circular buffer
    const addLog = (message: string) => {
      const timestamp = new Date().toISOString();
      const logLine = `[${timestamp}] ${message}`;
      state.logs.push(logLine);
      
      // Maintain circular buffer - keep only last maxLogLines entries
      if (state.logs.length > state.maxLogLines) {
        state.logs = state.logs.slice(-state.maxLogLines);
      }
    };

    // Capture initial startup log
    if (transport instanceof StdioTransport) {
      addLog(`Starting MCP server: ${config.command} ${config.args.join(' ')}`);
    }

    try {
      addLog('Connecting to server...');
      
      // Connection timeout handling
      // Use server-specific timeout if provided, otherwise use global default
      // Default increased to 30s to accommodate slow-starting servers (e.g., Python)
      const timeout = config.timeout || this.config.connectionTimeout;
      const connectPromise = transport.connect();
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error(`Connection timeout after ${timeout}ms`)), timeout);
      });

      // Race between connection and timeout
      await Promise.race([connectPromise, timeoutPromise]);

      // Connection successful - update state
      state.status = 'connected';
      state.startTime = Date.now();
      addLog('Successfully connected to server');
    } catch (error) {
      // Connection failed - update state and preserve error
      state.status = 'error';
      const errorMessage = error instanceof Error ? error.message : String(error);
      state.error = errorMessage;
      addLog(`Connection failed: ${errorMessage}`);
      
      // Attempt graceful cleanup
      try {
        await transport.disconnect();
      } catch {
        // Ignore disconnect errors during error handling
      }
      
      // Keep server entry in 'error' state for UI visibility
      // This allows users to see the error and retry/troubleshoot
      // Tests expect enabled servers to remain in registry even on failure
      
      throw new Error(`Failed to start MCP server '${name}': ${state.error}`);
    }
  }

  /**
   * Stop an MCP server
   * 
   * Gracefully disconnects from an MCP server and removes it from the registry.
   * 
   * Process:
   * 1. Locate server in registry (no-op if not found)
   * 2. Disconnect transport (with error suppression)
   * 3. Update status to 'disconnected'
   * 4. Clear tool/resource cache
   * 5. Remove from registry
   * 
   * Error Handling:
   * - Disconnect errors are logged but not thrown
   * - Ensures cleanup happens even if disconnect fails
   * - Suppresses logs in test environments to reduce noise
   * 
   * @param name - Server identifier
   */
  async stopServer(name: string): Promise<void> {
    const state = this.servers.get(name);
    
    if (!state) {
      // Server doesn't exist - nothing to do
      return;
    }

    try {
      // Attempt graceful disconnect
      await state.transport.disconnect();
    } catch (error) {
      // Log error but don't throw - ensure cleanup continues
      // Suppress logs in test environments to avoid noise
      if (process.env.NODE_ENV !== 'test' && !process.env.VITEST) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`Error disconnecting MCP server '${name}': ${errorMessage}`);
      }
    } finally {
      // Always update status and clean up, even if disconnect failed
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

  /**
   * Restart an MCP server
   * 
   * Performs a full restart cycle: stop → wait → start
   * 
   * Process:
   * 1. Store server configuration
   * 2. Stop the server (disconnect and cleanup)
   * 3. Wait for clean shutdown (1s in production, 10ms in tests)
   * 4. Start server with original configuration
   * 
   * Wait Period:
   * - Production: 1 second to ensure clean process termination
   * - Test: 10ms to keep tests fast
   * - Prevents port conflicts and resource leaks
   * 
   * Use Cases:
   * - Recovering from error state
   * - Applying configuration changes
   * - Clearing server-side cache
   * - Troubleshooting connection issues
   * 
   * @param name - Server identifier
   * @throws {Error} If server not found or restart fails
   */
  async restartServer(name: string): Promise<void> {
    const state = this.servers.get(name);
    
    if (!state) {
      throw new Error(`Server '${name}' not found`);
    }

    // Store configuration before stopping
    const config = state.config;

    // Stop the server
    await this.stopServer(name);

    // Wait for clean shutdown
    // Shorter delay in test environments to keep tests fast
    if (process.env.NODE_ENV === 'test' || process.env.VITEST) {
      await new Promise(resolve => setTimeout(resolve, 10));
    } else {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Start server with original configuration
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

  /**
   * Call a tool on an MCP server
   * 
   * Invokes a tool and waits for the complete result.
   * 
   * Protocol Flow:
   * 1. Validate server exists and is connected
   * 2. Send JSON-RPC 'tools/call' request via transport
   * 3. Wait for response with 30s timeout
   * 4. Handle errors and update server status
   * 
   * Timeout Handling:
   * - Default: 30 seconds (configurable)
   * - Increased from previous 10s to accommodate long-running tools
   * - Consider using callToolStreaming() for operations > 30s
   * 
   * Error Handling:
   * - Connection errors mark server as 'error' status
   * - Timeout errors mark server as 'error' status
   * - Tool execution errors are returned in response
   * - Server remains in error state until restart
   * 
   * @param serverName - Server identifier
   * @param toolName - Tool to invoke
   * @param args - Tool arguments (validated by server)
   * @returns Tool execution result
   * @throws {Error} If server not found, not connected, or call fails
   */
  async callTool(serverName: string, toolName: string, args: unknown): Promise<unknown> {
    const state = this.servers.get(serverName);
    
    if (!state) {
      throw new Error(`Server '${serverName}' not found`);
    }

    if (state.status !== 'connected') {
      throw new Error(`Server '${serverName}' is not connected (status: ${state.status})`);
    }

    try {
      // Tool call timeout - increased to 60s for long-running operations
      // TODO: Make this configurable per-tool or per-server
      const timeout = 60000;
      
      // Send JSON-RPC tool call request
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

      // Check for protocol-level errors
      if (response.error) {
        throw new Error(`Tool call failed: ${response.error.message}`);
      }

      return response.result;
    } catch (error) {
      // Mark server as error if connection/timeout issue
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
