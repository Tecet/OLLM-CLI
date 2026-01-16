/**
 * Core types for the extension system
 */

import type { Hook, HookEvent } from '../hooks/types.js';
import type {
  MCPServerConfig,
  MCPServerStatus,
  MCPServerInfo,
  MCPTool,
  MCPRequest,
  MCPResponse,
  MCPError,
} from '../mcp/types.js';

// Re-export MCP types for convenience
export type {
  MCPServerConfig,
  MCPServerStatus,
  MCPServerInfo,
  MCPTool,
  MCPRequest,
  MCPResponse,
  MCPError,
};

/**
 * Extension manifest defines an extension's capabilities and requirements
 */
export interface ExtensionManifest {
  /** Extension name (unique identifier) */
  name: string;
  /** Semantic version */
  version: string;
  /** Human-readable description */
  description: string;
  /** MCP server configurations */
  mcpServers?: Record<string, MCPServerConfig>;
  /** Hook configurations mapped by event */
  hooks?: Partial<Record<HookEvent, HookConfig[]>>;
  /** Extension settings definitions */
  settings?: ExtensionSetting[];
  /** Skill definitions */
  skills?: Skill[];
  /** Permission requirements */
  permissions?: {
    /** Filesystem access paths */
    filesystem?: string[];
    /** Network access domains */
    network?: string[];
    /** Environment variable access */
    env?: string[];
    /** Shell command execution */
    shell?: boolean;
    /** MCP server management */
    mcp?: boolean;
  };
}

/**
 * Hook configuration in manifest
 */
export interface HookConfig {
  /** Hook name */
  name: string;
  /** Command to execute */
  command: string;
  /** Optional command arguments */
  args?: string[];
}

/**
 * Extension setting definition
 */
export interface ExtensionSetting {
  /** Setting name */
  name: string;
  /** Environment variable to read from */
  envVar?: string;
  /** Whether the setting contains sensitive data */
  sensitive?: boolean;
  /** Human-readable description */
  description: string;
  /** Default value if not provided */
  default?: unknown;
}

/**
 * Skill definition for pre-defined prompts
 */
export interface Skill {
  /** Skill name (unique within extension) */
  name: string;
  /** Human-readable description */
  description: string;
  /** Prompt template (may include placeholders) */
  prompt: string;
}

/**
 * Loaded extension with all components
 */
export interface Extension {
  /** Extension name */
  name: string;
  /** Extension version */
  version: string;
  /** Extension description */
  description: string;
  /** Path to extension directory */
  path: string;
  /** Parsed manifest */
  manifest: ExtensionManifest;
  /** Whether extension is currently enabled */
  enabled: boolean;
  /** Registered hooks */
  hooks: Hook[];
  /** MCP server configurations */
  mcpServers: MCPServerConfig[];
  /** Extension settings */
  settings: ExtensionSetting[];
  /** Extension skills */
  skills: Skill[];
}
