/**
 * MCP (Model Context Protocol) Integration Types
 * 
 * This module defines the core types and interfaces for MCP integration,
 * including client, transport, server configuration, and tool definitions.
 */

/**
 * MCP server configuration
 */
export interface MCPServerConfig {
  /** Command to execute the MCP server */
  command: string;
  /** Command-line arguments */
  args: string[];
  /** Environment variables for the server process */
  env?: Record<string, string>;
  /** Communication transport type */
  transport?: 'stdio' | 'sse' | 'http';
  /** Connection timeout in milliseconds */
  timeout?: number;
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
}
