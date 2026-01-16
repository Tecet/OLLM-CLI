/**
 * MCP (Model Context Protocol) Integration Types
 * 
 * This module defines the core types and interfaces for MCP integration,
 * including client, transport, server configuration, and tool definitions.
 */

/**
 * OAuth 2.0 configuration for MCP servers
 */
export interface MCPOAuthConfig {
  /** Enable OAuth authentication */
  enabled: boolean;
  /** OAuth authorization endpoint URL (auto-discovered if omitted) */
  authorizationUrl?: string;
  /** OAuth token endpoint URL (auto-discovered if omitted) */
  tokenUrl?: string;
  /** OAuth client ID */
  clientId: string;
  /** OAuth client secret (optional for PKCE flow) */
  clientSecret?: string;
  /** OAuth scopes to request */
  scopes?: string[];
  /** Local redirect port for OAuth callback (default: 3000) */
  redirectPort?: number;
  /** Use PKCE (Proof Key for Code Exchange) flow (default: true) */
  usePKCE?: boolean;
}

/**
 * MCP server configuration
 */
export interface MCPServerConfig {
  /** Command to execute the MCP server (for stdio transport) */
  command: string;
  /** Command-line arguments (for stdio transport) */
  args: string[];
  /** Environment variables for the server process */
  env?: Record<string, string>;
  /** Communication transport type */
  transport?: 'stdio' | 'sse' | 'http';
  /** Connection timeout in milliseconds */
  timeout?: number;
  /** OAuth configuration for authenticated servers */
  oauth?: MCPOAuthConfig;
  /** Server URL (for SSE and HTTP transports) */
  url?: string;
  /** Working directory for stdio transport */
  cwd?: string;
}

/**
 * MCP server status
 */
export type MCPServerStatusType = 'starting' | 'connected' | 'disconnected' | 'error';

/**
 * MCP server status information
 */
export interface MCPServerStatus {
  /** Server name */
  name: string;
  /** Current status */
  status: MCPServerStatusType;
  /** Error message if status is 'error' */
  error?: string;
  /** Number of tools provided by this server */
  tools: number;
}

/**
 * MCP server information
 */
export interface MCPServerInfo {
  /** Server name */
  name: string;
  /** Server status */
  status: MCPServerStatus;
  /** Server configuration */
  config: MCPServerConfig;
}

/**
 * MCP tool definition
 */
export interface MCPTool {
  /** Tool name */
  name: string;
  /** Tool description */
  description: string;
  /** JSON schema for tool input parameters */
  inputSchema: unknown;
}

/**
 * MCP resource definition
 */
export interface MCPResource {
  /** Resource URI */
  uri: string;
  /** Resource name */
  name: string;
  /** Resource description */
  description?: string;
  /** Resource MIME type */
  mimeType?: string;
}

/**
 * MCP prompt definition
 */
export interface MCPPrompt {
  /** Prompt name */
  name: string;
  /** Prompt description */
  description?: string;
  /** Prompt arguments schema */
  arguments?: Array<{
    name: string;
    description?: string;
    required?: boolean;
  }>;
}

/**
 * MCP request message
 */
export interface MCPRequest {
  /** Request method name */
  method: string;
  /** Request parameters */
  params?: unknown;
}

/**
 * MCP error
 */
export interface MCPError {
  /** Error code */
  code: number;
  /** Error message */
  message: string;
  /** Additional error data */
  data?: unknown;
}

/**
 * MCP response message
 */
export interface MCPResponse {
  /** Response result (if successful) */
  result?: unknown;
  /** Error information (if failed) */
  error?: MCPError;
  /** Whether this is a streaming response */
  isStreaming?: boolean;
}

/**
 * MCP streaming chunk
 */
export interface MCPStreamChunk {
  /** Chunk data */
  data: unknown;
  /** Whether this is the final chunk */
  done: boolean;
}

/**
 * MCP transport interface
 * 
 * Handles communication with MCP servers using different transport protocols.
 */
export interface MCPTransport {
  /**
   * Connect to the MCP server
   */
  connect(): Promise<void>;

  /**
   * Disconnect from the MCP server
   */
  disconnect(): Promise<void>;

  /**
   * Send a request to the server
   * @param request - The request to send
   * @returns The server's response
   */
  sendRequest(request: MCPRequest): Promise<MCPResponse>;

  /**
   * Send a streaming request to the server
   * @param request - The request to send
   * @param onChunk - Callback for each streaming chunk
   * @returns The final response
   */
  sendStreamingRequest?(
    request: MCPRequest,
    onChunk: (chunk: MCPStreamChunk) => void
  ): Promise<MCPResponse>;

  /**
   * Check if the transport is connected
   * @returns True if connected, false otherwise
   */
  isConnected(): boolean;
}

/**
 * MCP client interface
 * 
 * Manages MCP server connections and tool invocations.
 */
export interface MCPClient {
  /**
   * Start an MCP server
   * @param name - Server name
   * @param config - Server configuration
   */
  startServer(name: string, config: MCPServerConfig): Promise<void>;

  /**
   * Stop an MCP server
   * @param name - Server name
   */
  stopServer(name: string): Promise<void>;

  /**
   * Get the status of an MCP server
   * @param name - Server name
   * @returns Server status information
   */
  getServerStatus(name: string): MCPServerStatus;

  /**
   * List all MCP servers
   * @returns Array of server information
   */
  listServers(): MCPServerInfo[];

  /**
   * Call a tool on an MCP server
   * @param serverName - Server name
   * @param toolName - Tool name
   * @param args - Tool arguments
   * @returns Tool result
   */
  callTool(serverName: string, toolName: string, args: unknown): Promise<unknown>;

  /**
   * Call a tool on an MCP server with streaming support
   * @param serverName - Server name
   * @param toolName - Tool name
   * @param args - Tool arguments
   * @param onChunk - Callback for each streaming chunk
   * @returns Tool result
   */
  callToolStreaming?(
    serverName: string,
    toolName: string,
    args: unknown,
    onChunk: (chunk: MCPStreamChunk) => void
  ): Promise<unknown>;

  /**
   * Get tools from an MCP server
   * @param serverName - Server name
   * @returns Array of tools provided by the server
   */
  getTools(serverName: string): Promise<MCPTool[]>;

  /**
   * Get resources from an MCP server
   * @param serverName - Server name
   * @returns Array of resources provided by the server
   */
  getResources?(serverName: string): Promise<MCPResource[]>;

  /**
   * Read a resource from an MCP server
   * @param serverName - Server name
   * @param uri - Resource URI
   * @returns Resource content
   */
  readResource?(serverName: string, uri: string): Promise<unknown>;

  /**
   * Get prompts from an MCP server
   * @param serverName - Server name
   * @returns Array of prompts provided by the server
   */
  getPrompts?(serverName: string): Promise<MCPPrompt[]>;

  /**
   * Get a prompt from an MCP server
   * @param serverName - Server name
   * @param promptName - Prompt name
   * @param args - Prompt arguments
   * @returns Prompt messages
   */
  getPrompt?(
    serverName: string,
    promptName: string,
    args?: Record<string, unknown>
  ): Promise<unknown>;
}
