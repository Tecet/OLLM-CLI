/**
 * MCP (Model Context Protocol) Integration
 *
 * This module provides MCP client functionality for integrating external
 * tools via the Model Context Protocol.
 *
 * @module mcp
 */

// Core types
export type {
  MCPServerConfig,
  MCPServerStatus,
  MCPServerStatusType,
  MCPServerInfo,
  MCPTool,
  MCPResource,
  MCPPrompt,
  MCPOAuthConfig,
  MCPRequest,
  MCPResponse,
  MCPError,
  MCPTransport,
  MCPClient,
} from './types.js';

// Transport implementations
export { BaseMCPTransport, StdioTransport, SSETransport, HTTPTransport } from './mcpTransport.js';

// Client implementation
export { DefaultMCPClient } from './mcpClient.js';

// Schema converter
export type { MCPSchemaConverter, ToolSchema } from './mcpSchemaConverter.js';
export { DefaultMCPSchemaConverter } from './mcpSchemaConverter.js';

// Tool wrapper
export type { MCPToolWrapper, Tool, ToolResult } from './mcpToolWrapper.js';
export { DefaultMCPToolWrapper } from './mcpToolWrapper.js';

// Environment variable substitution
export { substituteEnvVars, substituteEnvObject, settingsToEnv } from './envSubstitution.js';

// Configuration
export * from './config.js';

// Health monitoring
export type {
  HealthCheckResult,
  HealthMonitorConfig,
  HealthMonitorEvent,
  HealthMonitorEventType,
  HealthMonitorEventListener,
} from './mcpHealthMonitor.js';
export { MCPHealthMonitor } from './mcpHealthMonitor.js';

// OAuth provider
export type { OAuthTokens, TokenStorage, OAuthConfig } from './mcpOAuth.js';
export { MCPOAuthProvider } from './mcpOAuth.js';
