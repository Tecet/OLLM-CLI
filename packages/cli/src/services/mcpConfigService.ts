/**
 * MCP Configuration Service
 * 
 * Handles loading, saving, and watching MCP configuration files.
 * Supports both user-level (~/.ollm/settings/mcp.json) and 
 * workspace-level (.ollm/settings/mcp.json) configurations.
 */

import fs from 'fs';
import { watch, type FSWatcher } from 'fs';
import os from 'os';
import path from 'path';

import { mcpConfigBackup } from './mcpConfigBackup.js';
import { createLogger } from '../../../core/src/utils/logger.js';

import type { MCPServerConfig } from '@ollm/ollm-cli-core/mcp/types.js';

const logger = createLogger('mcpConfigService');

/**
 * MCP configuration with server definitions
 */
export interface MCPConfigFile {
  mcpServers: Record<string, MCPServerConfig>;
}

/**
 * Configuration change event
 */
export interface ConfigChangeEvent {
  /** Type of change */
  type: 'user' | 'workspace';
  /** Path to the changed file */
  path: string;
  /** Timestamp of the change */
  timestamp: number;
}

/**
 * Configuration change listener
 */
export type ConfigChangeListener = (event: ConfigChangeEvent) => void;

/**
 * MCP Configuration Service
 * 
 * Manages MCP configuration files with atomic writes, validation,
 * and file watching for external changes.
 */
export class MCPConfigService {
  private userConfigPath: string;
  private workspaceConfigPath: string;
  private watchers: Map<string, FSWatcher> = new Map();
  private listeners: ConfigChangeListener[] = [];
  private isWatching = false;

  /**
   * Create a new MCP Configuration Service
   * @param basePath - Optional base path for config files (for testing)
   */
  constructor(basePath?: string) {
    // Use basePath if provided (for tests), otherwise use os.homedir()
    const homeDir = basePath || os.homedir();
    
    // User-level config: ~/.ollm/settings/mcp.json (or basePath/.ollm/settings/mcp.json in tests)
    this.userConfigPath = path.join(
      homeDir,
      '.ollm',
      'settings',
      'mcp.json'
    );

    // Workspace-level config: .ollm/settings/mcp.json
    this.workspaceConfigPath = path.join(
      process.cwd(),
      '.ollm',
      'settings',
      'mcp.json'
    );
  }

  /**
   * Load MCP configuration from both user and workspace levels
   * Workspace configuration takes precedence over user configuration
   * @returns Merged MCP configuration
   */
  async loadMCPConfig(): Promise<MCPConfigFile> {
    const userConfig = await this.loadConfigFile(this.userConfigPath);
    const workspaceConfig = await this.loadConfigFile(this.workspaceConfigPath);

    // Merge configurations (workspace overrides user)
    const merged: MCPConfigFile = {
      mcpServers: {
        ...userConfig.mcpServers,
        ...workspaceConfig.mcpServers,
      },
    };

    return merged;
  }

  /**
   * Save MCP configuration to user-level config file
   * Uses atomic write to prevent corruption
   * @param config - Configuration to save
   */
  async saveMCPConfig(config: MCPConfigFile): Promise<void> {
    // Validate configuration before saving
    this.validateConfig(config);

    // Create backup before saving
    try {
      if (fs.existsSync(this.userConfigPath)) {
        await mcpConfigBackup.createBackup(this.userConfigPath, 'Before save');
      }
    } catch (error) {
      logger.warn('Failed to create backup before save:', error);
      // Continue with save even if backup fails
    }

    // Save to user-level config
    await this.saveConfigFile(this.userConfigPath, config);
  }

  /**
   * Update a specific server configuration
   * Performs partial update without affecting other servers
   * @param serverName - Name of the server to update
   * @param config - Server configuration to update
   */
  async updateServerConfig(
    serverName: string,
    config: MCPServerConfig
  ): Promise<void> {
    // Create backup before updating
    try {
      if (fs.existsSync(this.userConfigPath)) {
        await mcpConfigBackup.createBackup(
          this.userConfigPath,
          `Before updating ${serverName}`
        );
      }
    } catch (error) {
      logger.warn('Failed to create backup before update:', error);
      // Continue with update even if backup fails
    }

    // Load current configuration
    const currentConfig = await this.loadConfigFile(this.userConfigPath);

    // Update the specific server
    currentConfig.mcpServers[serverName] = config;

    // Validate updated configuration
    this.validateConfig(currentConfig);

    // Save with atomic write
    await this.saveConfigFile(this.userConfigPath, currentConfig);
  }

  /**
   * Remove a server from configuration
   * @param serverName - Name of the server to remove
   */
  async removeServerConfig(serverName: string): Promise<void> {
    // Load current configuration
    const currentConfig = await this.loadConfigFile(this.userConfigPath);

    // Remove the server
    delete currentConfig.mcpServers[serverName];

    // Save with atomic write
    await this.saveConfigFile(this.userConfigPath, currentConfig);
  }

  /**
   * Start watching configuration files for external changes
   */
  startWatching(): void {
    if (this.isWatching) {
      return;
    }

    this.isWatching = true;

    // Watch user config
    this.watchConfigFile(this.userConfigPath, 'user');

    // Watch workspace config
    this.watchConfigFile(this.workspaceConfigPath, 'workspace');
  }

  /**
   * Stop watching configuration files
   */
  stopWatching(): void {
    if (!this.isWatching) {
      return;
    }

    this.isWatching = false;

    // Close all watchers
    for (const watcher of this.watchers.values()) {
      watcher.close();
    }

    this.watchers.clear();
  }

  /**
   * Add a configuration change listener
   * @param listener - Listener function
   */
  addChangeListener(listener: ConfigChangeListener): void {
    this.listeners.push(listener);
  }

  /**
   * Remove a configuration change listener
   * @param listener - Listener function
   */
  removeChangeListener(listener: ConfigChangeListener): void {
    const index = this.listeners.indexOf(listener);
    if (index !== -1) {
      this.listeners.splice(index, 1);
    }
  }

  /**
   * Get the user config file path
   */
  getUserConfigPath(): string {
    return this.userConfigPath;
  }

  /**
   * Get the workspace config file path
   */
  getWorkspaceConfigPath(): string {
    return this.workspaceConfigPath;
  }

  /**
   * Load configuration from a specific file
   * @param filePath - Path to the configuration file
   * @returns Configuration object or empty config if file doesn't exist
   */
  private async loadConfigFile(filePath: string): Promise<MCPConfigFile> {
    try {
      // Check if file exists
      if (!fs.existsSync(filePath)) {
        return { mcpServers: {} };
      }

      // Read file content
      const content = await fs.promises.readFile(filePath, 'utf-8');

      // Parse JSON
      const data = JSON.parse(content);

      // Validate structure
      if (!data.mcpServers || typeof data.mcpServers !== 'object') {
        logger.warn(`Invalid MCP config structure in ${filePath}, using empty config`);
        return { mcpServers: {} };
      }

      return data as MCPConfigFile;
    } catch (error) {
      if (error instanceof SyntaxError) {
        logger.error(`JSON parsing error in ${filePath}:`, error.message);
        
        // Attempt to recover from corruption
        logger.info('Attempting to recover from corrupted configuration...');
        const recovered = await mcpConfigBackup.recoverFromCorruption(filePath);
        
        if (recovered) {
          // Try loading again after recovery
          try {
            const content = await fs.promises.readFile(filePath, 'utf-8');
            const data = JSON.parse(content);
            return data as MCPConfigFile;
          } catch (retryError) {
            logger.error('Failed to load recovered configuration:', retryError);
          }
        }
      } else {
        logger.error(`Failed to load MCP config from ${filePath}:`, error);
      }
      return { mcpServers: {} };
    }
  }

  /**
   * Save configuration to a specific file with atomic write
   * @param filePath - Path to the configuration file
   * @param config - Configuration to save
   */
  private async saveConfigFile(
    filePath: string,
    config: MCPConfigFile
  ): Promise<void> {
    try {
      // Ensure directory exists
      const dir = path.dirname(filePath);
      await this.ensureDirectoryExists(dir);

      // Create temporary file path
      const tempPath = `${filePath}.tmp`;

      // Write to temporary file
      await fs.promises.writeFile(
        tempPath,
        JSON.stringify(config, null, 2),
        'utf-8'
      );

      // Atomic rename (replaces original file)
      await fs.promises.rename(tempPath, filePath);
    } catch (error) {
      // Clean up temporary file if it exists
      const tempPath = `${filePath}.tmp`;
      if (fs.existsSync(tempPath)) {
        try {
          await fs.promises.unlink(tempPath);
        } catch {
          // Ignore cleanup errors
        }
      }

      throw new Error(
        `Failed to save MCP config to ${filePath}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Watch a configuration file for changes
   * @param filePath - Path to the configuration file
   * @param type - Type of configuration (user or workspace)
   */
  private watchConfigFile(filePath: string, type: 'user' | 'workspace'): void {
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      // Watch the directory instead to detect file creation
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        return;
      }

      const dirWatcher = watch(dir, (eventType, filename) => {
        if (filename === path.basename(filePath)) {
          // File was created, start watching it
          this.watchConfigFile(filePath, type);
          dirWatcher.close();
        }
      });

      this.watchers.set(`${type}-dir`, dirWatcher);
      return;
    }

    // Watch the file for changes
    const watcher = watch(filePath, (eventType) => {
      if (eventType === 'change') {
        // Debounce rapid changes (wait 100ms)
        setTimeout(() => {
          this.notifyListeners({
            type,
            path: filePath,
            timestamp: Date.now(),
          });
        }, 100);
      }
    });

    this.watchers.set(type, watcher);
  }

  /**
   * Notify all listeners of a configuration change
   * @param event - Configuration change event
   */
  private notifyListeners(event: ConfigChangeEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (error) {
        logger.error('Error in config change listener:', error);
      }
    }
  }

  /**
   * Validate MCP configuration
   * @param config - Configuration to validate
   * @throws Error if configuration is invalid
   */
  private validateConfig(config: MCPConfigFile): void {
    // Validate overall structure
    if (!config.mcpServers || typeof config.mcpServers !== 'object') {
      throw new Error('Invalid MCP config: mcpServers must be an object');
    }

    // Validate each server configuration
    for (const [serverName, serverConfig] of Object.entries(config.mcpServers)) {
      // Basic validation
      if (!serverConfig.command || typeof serverConfig.command !== 'string') {
        throw new Error(
          `Invalid configuration for server '${serverName}': command is required and must be a string`
        );
      }

      if (!Array.isArray(serverConfig.args)) {
        throw new Error(
          `Invalid configuration for server '${serverName}': args must be an array`
        );
      }

      // Validate transport type if specified
      if (serverConfig.transport && !['stdio', 'sse', 'http'].includes(serverConfig.transport)) {
        throw new Error(
          `Invalid configuration for server '${serverName}': transport must be 'stdio', 'sse', or 'http'`
        );
      }

      // Validate timeout if specified
      if (serverConfig.timeout !== undefined && (typeof serverConfig.timeout !== 'number' || serverConfig.timeout <= 0)) {
        throw new Error(
          `Invalid configuration for server '${serverName}': timeout must be a positive number`
        );
      }

      // Validate env if specified
      if (serverConfig.env !== undefined && typeof serverConfig.env !== 'object') {
        throw new Error(
          `Invalid configuration for server '${serverName}': env must be an object`
        );
      }
    }
  }

  /**
   * Ensure a directory exists, creating it if necessary
   * @param directory - Directory path to ensure exists
   */
  private async ensureDirectoryExists(directory: string): Promise<void> {
    try {
      if (!fs.existsSync(directory)) {
        await fs.promises.mkdir(directory, { recursive: true });
      }
    } catch (error) {
      throw new Error(
        `Failed to create directory ${directory}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}

// Singleton instance
export const mcpConfigService = new MCPConfigService();
