/**
 * MCP system configuration management
 * Provides default values and validation for MCP configurations
 */

import { z } from 'zod';
import type { MCPServerConfig } from './types.js';

/**
 * MCP configuration interface
 */
export interface MCPConfig {
  /** Enable or disable MCP integration */
  enabled?: boolean;
  /** Connection timeout in milliseconds */
  connectionTimeout?: number;
  /** Direct MCP server configurations */
  servers?: Record<string, MCPServerConfig>;
}

/**
 * Zod schema for OAuth configuration
 */
export const mcpOAuthConfigSchema = z.object({
  enabled: z.boolean(),
  authorizationUrl: z.string().url().optional(),
  tokenUrl: z.string().url().optional(),
  clientId: z.string(),
  clientSecret: z.string().optional(),
  scopes: z.array(z.string()).optional(),
  redirectPort: z.number().int().positive().optional(),
  usePKCE: z.boolean().optional(),
});

/**
 * Zod schema for MCP server configuration
 */
export const mcpServerConfigSchema = z.object({
  command: z.string(),
  args: z.array(z.string()),
  env: z.record(z.string(), z.string()).optional(),
  transport: z.enum(['stdio', 'sse', 'http']).optional(),
  timeout: z.number().int().positive().optional(),
  oauth: mcpOAuthConfigSchema.optional(),
  url: z.string().url().optional(),
  cwd: z.string().optional(),
});

/**
 * Zod schema for MCP configuration validation
 */
export const mcpConfigSchema = z.object({
  enabled: z.boolean().optional(),
  connectionTimeout: z.number().int().positive().optional(),
  servers: z.record(z.string(), mcpServerConfigSchema).optional(),
});

/**
 * Default MCP configuration values
 */
export const DEFAULT_MCP_CONFIG: Required<Omit<MCPConfig, 'servers'>> & {
  servers: Record<string, MCPServerConfig>;
} = {
  enabled: true,
  connectionTimeout: 10000, // 10 seconds
  servers: {},
};

/**
 * Merge user configuration with defaults
 */
export function mergeMCPConfig(
  userConfig: Partial<MCPConfig> = {}
): Required<Omit<MCPConfig, 'servers'>> & { servers: Record<string, MCPServerConfig> } {
  return {
    enabled: userConfig.enabled ?? DEFAULT_MCP_CONFIG.enabled,
    connectionTimeout: userConfig.connectionTimeout ?? DEFAULT_MCP_CONFIG.connectionTimeout,
    servers: userConfig.servers ?? DEFAULT_MCP_CONFIG.servers,
  };
}

/**
 * Validate MCP configuration
 * @throws {z.ZodError} if configuration is invalid
 */
export function validateMCPConfig(config: unknown): MCPConfig {
  return mcpConfigSchema.parse(config);
}
