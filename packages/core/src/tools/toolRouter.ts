import { EventEmitter } from 'events';

import { ToolCapability, detectServerCapabilities } from './tool-capabilities.js';
import { createLogger } from '../utils/logger.js';

import type { ToolRegistry } from './tool-registry.js';
import type { Tool } from './types.js';
import type { MCPClient } from '../mcp/types.js';

const logger = createLogger('toolRouter');

/**
 * Configuration for tool routing
 */
export interface ToolRoutingConfig {
  /** Enable tool routing system */
  enabled: boolean;
  /** Primary MCP server for each capability */
  bindings: {
    [key in string]?: string; // key is ToolCapability string
  };
  /** Enable automatic fallback */
  enableFallback: boolean;
}

export const DEFAULT_TOOL_ROUTING_CONFIG: ToolRoutingConfig = {
  enabled: true,
  bindings: {},
  enableFallback: true,
};

/**
 * Routes high-level tools to MCP servers
 */
export class ToolRouter extends EventEmitter {
  private mcpClient: MCPClient;
  private toolRegistry: ToolRegistry;
  private config: ToolRoutingConfig;
  private capabilityMap: Map<string, ToolCapability[]> = new Map();

  constructor(
    mcpClient: MCPClient,
    toolRegistry: ToolRegistry,
    config: ToolRoutingConfig = DEFAULT_TOOL_ROUTING_CONFIG
  ) {
    super();
    this.mcpClient = mcpClient;
    this.toolRegistry = toolRegistry;
    this.config = config;
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<ToolRoutingConfig>): void {
    this.config = { ...this.config, ...config };
    this.emit('configChanged', this.config);
  }

  getConfig(): ToolRoutingConfig {
    return { ...this.config };
  }

  /**
   * Discover capabilities from all running MCP servers
   */
  async discoverCapabilities(): Promise<void> {
    const servers = this.mcpClient.listServers();
    
    for (const server of servers) {
      if (server.status.status === 'connected') {
        try {
          const tools = await this.mcpClient.getTools(server.name);
          // Convert MCP tools to internal Tool format if needed, or pass compatible object
          // detectServerCapabilities expects Tool[] which usually match MCP tool structure roughly
          // We might need to cast or map if types mismatch strictly
          const capabilities = detectServerCapabilities(server.name, tools as unknown as Tool[]);
          this.capabilityMap.set(server.name, capabilities);
        } catch (error) {
          logger.error(`Failed to discover capabilities for ${server.name}:`, error);
        }
      }
    }
    
    this.emit('capabilitiesUpdated', this.getCapabilityMap());
  }

  /**
   * Find MCP server for a capability
   */
  findServerForCapability(capability: ToolCapability): string | null {
    if (!this.config.enabled) {
      return null;
    }

    // 1. Check configured binding
    const primaryServer = this.config.bindings[capability];
    if (primaryServer && this.isServerAvailable(primaryServer, capability)) {
      return primaryServer;
    }

    // 2. Fallback: Find any available server with this capability
    if (this.config.enableFallback) {
      // Prefer servers that are explicitly connected
      for (const [serverName, capabilities] of this.capabilityMap.entries()) {
        if (capabilities.includes(capability) && this.isServerConnected(serverName)) {
          return serverName;
        }
      }
    }

    return null;
  }

  /**
   * Check if server is available (connected and has capability)
   */
  private isServerAvailable(serverName: string, capability: ToolCapability): boolean {
    const capabilities = this.capabilityMap.get(serverName);
    
    // If we haven't discovered capabilities yet, generic check
    if (!capabilities && this.isServerConnected(serverName)) {
      // Optimistic check if we don't have capability map populated yet
      return true; 
    }

    if (!capabilities || !capabilities.includes(capability)) {
      return false;
    }
    
    return this.isServerConnected(serverName);
  }

  /**
   * Check if server is connected
   */
  private isServerConnected(serverName: string): boolean {
    const status = this.mcpClient.getServerStatus(serverName);
    return status.status === 'connected';
  }

  /**
   * Get current capability map
   */
  getCapabilityMap(): Map<string, ToolCapability[]> {
    return new Map(this.capabilityMap);
  }
}
