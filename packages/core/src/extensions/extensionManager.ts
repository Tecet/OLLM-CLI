/**
 * ExtensionManager handles extension lifecycle
 *
 * Discovers, loads, enables, and disables extensions from configured directories.
 * Manages extension state persistence and integrates with hook registry.
 */

import { randomUUID } from 'crypto';
import { readdir, stat } from 'fs/promises';
import { join, resolve, sep } from 'path';

import { ManifestParser } from './manifestParser.js';
import { ExtensionSettingsManager, type ResolvedExtensionSetting } from './settingsIntegration.js';
import { SkillRegistry } from './skillRegistry.js';

import type { Extension, ExtensionManifest, MCPServerConfig } from './types.js';
import type { HookRegistry } from '../hooks/hookRegistry.js';
import type { Hook, HookEvent } from '../hooks/types.js';
import type { MCPToolWrapper } from '../mcp/mcpToolWrapper.js';
import type { MCPClient } from '../mcp/types.js';
import type { ToolRegistry } from '../tools/tool-registry.js';

const isTestEnv = process.env.NODE_ENV === 'test' || !!process.env.VITEST;

/**
 * Configuration for extension directories
 */
export interface ExtensionManagerConfig {
  /** Directories to scan for extensions */
  directories: string[];
  /** Whether to auto-enable new extensions */
  autoEnable?: boolean;
  /** Whether extensions are enabled globally */
  enabled?: boolean;
  /** Hook registry for registering hooks */
  hookRegistry?: HookRegistry;
  /** MCP client for managing MCP servers */
  mcpClient?: MCPClient;
  /** MCP tool wrapper for wrapping MCP tools */
  mcpToolWrapper?: MCPToolWrapper;
  /** Tool registry for registering MCP tools */
  toolRegistry?: ToolRegistry;
  /** Skill registry for registering skills */
  skillRegistry?: SkillRegistry;
}

/**
 * Extension state for persistence
 */
export interface ExtensionState {
  /** Extension name */
  name: string;
  /** Whether extension is enabled */
  enabled: boolean;
}

/**
 * Manager for extension lifecycle
 */
export class ExtensionManager {
  private extensions: Map<string, Extension>;
  private manifestParser: ManifestParser;
  private config: ExtensionManagerConfig;
  private hookRegistry?: HookRegistry;
  private mcpClient?: MCPClient;
  private mcpToolWrapper?: MCPToolWrapper;
  private toolRegistry?: ToolRegistry;
  private skillRegistry?: SkillRegistry;
  private settingsManager: ExtensionSettingsManager;
  private resolvedSettings: Map<string, ResolvedExtensionSetting[]>;
  // Track which MCP servers belong to which extension
  private extensionMCPServers: Map<string, string[]>; // extensionName -> serverNames[]

  constructor(config: ExtensionManagerConfig) {
    this.extensions = new Map();
    this.manifestParser = new ManifestParser();
    this.config = config;
    this.hookRegistry = config.hookRegistry;
    this.mcpClient = config.mcpClient;
    this.mcpToolWrapper = config.mcpToolWrapper;
    this.toolRegistry = config.toolRegistry;
    this.skillRegistry = config.skillRegistry;
    this.settingsManager = new ExtensionSettingsManager();
    this.resolvedSettings = new Map();
    this.extensionMCPServers = new Map();
  }

  /**
   * Load all extensions from configured directories
   *
   * Scans user and workspace extension directories, parses manifests,
   * and creates Extension objects. Invalid extensions are logged and skipped.
   *
   * @returns Array of loaded extensions
   */
  async loadExtensions(): Promise<Extension[]> {
    // Check if extensions are enabled
    if (this.config.enabled === false) {
      if (process.env.NODE_ENV !== 'test' && !process.env.VITEST) {
        console.log('Extensions are disabled in configuration');
      }
      return [];
    }

    const loadedExtensions: Extension[] = [];

    for (const directory of this.config.directories) {
      try {
        const extensions = await this.loadExtensionsFromDirectory(directory);
        loadedExtensions.push(...extensions);
      } catch (error) {
        // Log error but continue with other directories
        // Only log error if not in a test environment
        if (process.env.NODE_ENV !== 'test' && !process.env.VITEST) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          console.error(`Failed to load extensions from directory '${directory}': ${errorMessage}`);
        }
      }
    }

    return loadedExtensions;
  }

  /**
   * Load extensions from a specific directory
   *
   * @param directory - Directory path to scan
   * @returns Array of loaded extensions from this directory
   */
  private async loadExtensionsFromDirectory(directory: string): Promise<Extension[]> {
    const extensions: Extension[] = [];

    try {
      // Check if directory exists
      const dirStat = await stat(directory);
      if (!dirStat.isDirectory()) {
        return extensions;
      }

      // Read directory contents
      const entries = await readdir(directory);

      // Check each entry for manifest.json
      for (const entry of entries) {
        const extensionPath = join(directory, entry);

        try {
          // Check if entry is a directory
          const entryStat = await stat(extensionPath);
          if (!entryStat.isDirectory()) {
            continue;
          }

          // Look for manifest.json
          const manifestPath = join(extensionPath, 'manifest.json');

          try {
            // Parse manifest
            const manifest = await this.manifestParser.parseManifest(manifestPath);

            // Create extension object
            const extension = this.createExtension(manifest, extensionPath);

            // Store extension
            this.extensions.set(extension.name, extension);
            extensions.push(extension);

            if (process.env.NODE_ENV !== 'test' && !process.env.VITEST) {
              console.log(`Loaded extension: ${extension.name} v${extension.version}`);
            }
          } catch (error) {
            // Log error for this extension but continue with others
            // Only log error if not in a test environment
            if (process.env.NODE_ENV !== 'test' && !process.env.VITEST) {
              const errorMessage = error instanceof Error ? error.message : String(error);
              console.error(`Failed to load extension from '${extensionPath}': ${errorMessage}`);
            }
          }
        } catch (_error) {
          // Skip entries that can't be accessed
          continue;
        }
      }
    } catch (error) {
      // Directory doesn't exist or can't be read
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }

    return extensions;
  }

  /**
   * Create an Extension object from a manifest
   *
   * @param manifest - Parsed extension manifest
   * @param path - Path to extension directory
   * @returns Extension object
   */
  private createExtension(manifest: ExtensionManifest, path: string): Extension {
    // Convert hook configs to Hook objects
    const hooks: Hook[] = [];
    if (manifest.hooks) {
      for (const [_event, hookConfigs] of Object.entries(manifest.hooks)) {
        for (const hookConfig of hookConfigs) {
          const hook: Hook = {
            id: randomUUID(),
            name: hookConfig.name,
            command: hookConfig.command,
            args: hookConfig.args,
            source: this.determineHookSource(path),
            extensionName: manifest.name,
          };
          hooks.push(hook);
        }
      }
    }

    // Extract MCP server configs
    const mcpServers: MCPServerConfig[] = manifest.mcpServers
      ? Object.values(manifest.mcpServers)
      : [];

    // Resolve extension settings
    const resolvedSettings = this.settingsManager.resolveSettings(
      manifest.settings || [],
      manifest.name
    );
    this.resolvedSettings.set(manifest.name, resolvedSettings);

    // Create extension object
    const extension: Extension = {
      name: manifest.name,
      version: manifest.version,
      description: manifest.description,
      path: resolve(path),
      manifest,
      enabled: this.config.autoEnable ?? true,
      hooks,
      mcpServers,
      settings: manifest.settings || [],
      skills: manifest.skills || [],
    };

    return extension;
  }

  /**
   * Determine hook source based on extension path
   *
   * @param path - Extension directory path
   * @returns Hook source type
   */
  private determineHookSource(path: string): 'user' | 'workspace' | 'downloaded' {
    const normalizedPath = resolve(path);

    // Check if in user directory (~/.ollm/extensions)
    // Use path.sep for platform-agnostic path separator
    const extensionsDir = `.ollm${sep}extensions`;
    if (normalizedPath.includes(extensionsDir)) {
      // Check if it's in home directory
      const homeDir = process.env.HOME || process.env.USERPROFILE || '';
      if (normalizedPath.startsWith(homeDir)) {
        return 'user';
      }
      return 'workspace';
    }

    // Default to downloaded for other locations
    return 'downloaded';
  }

  /**
   * Get a specific extension by name
   *
   * @param name - Extension name
   * @returns Extension if found, undefined otherwise
   */
  getExtension(name: string): Extension | undefined {
    return this.extensions.get(name);
  }

  /**
   * Get all loaded extensions
   *
   * @returns Array of all extensions
   */
  getAllExtensions(): Extension[] {
    return Array.from(this.extensions.values());
  }

  /**
   * Enable an extension
   *
   * Registers hooks with hook registry, starts MCP servers,
   * registers MCP tools with tool registry, and marks extension as enabled.
   *
   * @param name - Extension name
   */
  async enableExtension(name: string): Promise<void> {
    const extension = this.extensions.get(name);
    if (!extension) {
      throw new Error(`Extension not found: ${name}`);
    }

    if (extension.enabled) {
      return; // Already enabled
    }

    // Register hooks with hook registry
    if (this.hookRegistry && extension.manifest.hooks) {
      for (const [event, hookConfigs] of Object.entries(extension.manifest.hooks)) {
        for (const hookConfig of hookConfigs) {
          // Find the corresponding Hook object
          const hook = extension.hooks.find((h) => h.name === hookConfig.name);
          if (hook) {
            this.hookRegistry.registerHook(event as HookEvent, hook);
          }
        }
      }
    }

    // Start MCP servers and register tools
    if (
      this.mcpClient &&
      this.mcpToolWrapper &&
      this.toolRegistry &&
      extension.manifest.mcpServers
    ) {
      const serverNames: string[] = [];

      for (const [serverName, serverConfig] of Object.entries(extension.manifest.mcpServers)) {
        try {
          // Create a unique server name with extension prefix
          const fullServerName = `${name}:${serverName}`;
          serverNames.push(fullServerName);

          // Get extension environment variables for MCP server
          const extensionEnv = this.getExtensionEnvironment(name);

          // Merge extension environment with server config env
          const mergedEnv = {
            ...extensionEnv,
            ...serverConfig.env,
          };

          // Create server config with merged environment
          const configWithEnv: MCPServerConfig = {
            ...serverConfig,
            env: mergedEnv,
          };

          // Check if server is already running
          const serverStatus = this.mcpClient.getServerStatus(fullServerName);

          if (serverStatus.status === 'connected' || serverStatus.status === 'starting') {
            if (!isTestEnv)
              console.log(`MCP server '${fullServerName}' is already running, skipping start`);

            // Get tools from the already-running server
            const tools = await this.mcpClient.getTools(fullServerName);

            // Wrap and register tools
            for (const mcpTool of tools) {
              const wrappedTool = this.mcpToolWrapper.wrapTool(fullServerName, mcpTool);
              this.toolRegistry.register(wrappedTool);
            }

            if (!isTestEnv)
              console.log(`MCP server '${fullServerName}' reused with ${tools.length} tools`);
          } else if (serverStatus.status === 'error') {
            if (!isTestEnv)
              console.log(`MCP server '${fullServerName}' is in error state, restarting...`);

            // Stop the errored server
            await this.mcpClient.stopServer(fullServerName);

            // Wait a moment for clean shutdown
            await new Promise((resolve) => setTimeout(resolve, 500));

            // Start fresh
            await this.mcpClient.startServer(fullServerName, configWithEnv);

            // Get tools from the server
            const tools = await this.mcpClient.getTools(fullServerName);

            // Wrap and register tools
            for (const mcpTool of tools) {
              const wrappedTool = this.mcpToolWrapper.wrapTool(fullServerName, mcpTool);
              this.toolRegistry.register(wrappedTool);
            }
            if (!isTestEnv)
              console.log(`MCP server '${fullServerName}' restarted with ${tools.length} tools`);
          } else {
            // Server not running, start it
            await this.mcpClient.startServer(fullServerName, configWithEnv);

            // Get tools from the server
            const tools = await this.mcpClient.getTools(fullServerName);

            // Wrap and register each tool
            for (const mcpTool of tools) {
              const wrappedTool = this.mcpToolWrapper.wrapTool(fullServerName, mcpTool);
              this.toolRegistry.register(wrappedTool);
            }

            if (!isTestEnv)
              console.log(`Started MCP server '${fullServerName}' with ${tools.length} tools`);
          }
        } catch (error) {
          // Log error but don't fail the entire enable operation
          // Only log error if not in a test environment
          if (process.env.NODE_ENV !== 'test' && !process.env.VITEST) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error(
              `Failed to start MCP server '${serverName}' for extension '${name}': ${errorMessage}`
            );
          }
        }
      }

      // Track which servers belong to this extension
      this.extensionMCPServers.set(name, serverNames);
    }

    // Register skills with skill registry
    if (this.skillRegistry && extension.skills.length > 0) {
      this.skillRegistry.registerSkills(name, extension.skills);
      if (!isTestEnv) {
        console.log(`Registered ${extension.skills.length} skills for extension '${name}'`);
      }
    }

    // Mark as enabled
    extension.enabled = true;

    if (!isTestEnv) console.log(`Enabled extension: ${name}`);
  }

  /**
   * Disable an extension
   *
   * Unregisters hooks, stops MCP servers, removes MCP tools,
   * and marks extension as disabled.
   *
   * @param name - Extension name
   */
  async disableExtension(name: string): Promise<void> {
    const extension = this.extensions.get(name);
    if (!extension) {
      throw new Error(`Extension not found: ${name}`);
    }

    if (!extension.enabled) {
      return; // Already disabled
    }

    // Unregister hooks from hook registry
    if (this.hookRegistry && extension.hooks.length > 0) {
      for (const hook of extension.hooks) {
        this.hookRegistry.unregisterHook(hook.id);
      }
    }

    // Stop MCP servers and remove tools
    if (this.mcpClient && this.toolRegistry) {
      const serverNames = this.extensionMCPServers.get(name) || [];

      for (const serverName of serverNames) {
        try {
          // Check server status before stopping
          const status = this.mcpClient.getServerStatus(serverName);

          if (status.status !== 'disconnected') {
            // Stop the MCP server
            await this.mcpClient.stopServer(serverName);
            if (!isTestEnv) console.log(`Stopped MCP server '${serverName}'`);
          }

          // Remove tools from registry (always clean up, even if server was stopped)
          // Tools are named with server prefix, so we need to find and remove them
          const allTools = this.toolRegistry.list();
          for (const tool of allTools) {
            if (tool.name.startsWith(`${serverName}:`)) {
              this.toolRegistry.unregister(tool.name);
            }
          }
        } catch (error) {
          // Log error but continue with other servers
          // Only log error if not in a test environment
          if (process.env.NODE_ENV !== 'test' && !process.env.VITEST) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error(
              `Failed to stop MCP server '${serverName}' for extension '${name}': ${errorMessage}`
            );
          }
        }
      }

      // Clear server tracking for this extension
      this.extensionMCPServers.delete(name);
    }

    // Unregister skills from skill registry
    if (this.skillRegistry) {
      this.skillRegistry.unregisterExtensionSkills(name);
      if (!isTestEnv) console.log(`Unregistered skills for extension '${name}'`);
    }

    // Mark as disabled
    extension.enabled = false;

    if (!isTestEnv) console.log(`Disabled extension: ${name}`);
  }

  /**
   * Reload an extension
   *
   * Disables, reloads from disk, and re-enables the extension.
   *
   * @param name - Extension name
   */
  async reloadExtension(name: string): Promise<void> {
    const extension = this.extensions.get(name);
    if (!extension) {
      throw new Error(`Extension not found: ${name}`);
    }

    const wasEnabled = extension.enabled;

    // Disable if enabled
    if (wasEnabled) {
      await this.disableExtension(name);
    }

    // Reload manifest
    const manifestPath = join(extension.path, 'manifest.json');
    const manifest = await this.manifestParser.parseManifest(manifestPath);

    // Create new extension object
    const newExtension = this.createExtension(manifest, extension.path);
    newExtension.enabled = false; // Start disabled

    // Replace in map
    this.extensions.set(name, newExtension);

    // Re-enable if it was enabled before
    if (wasEnabled) {
      await this.enableExtension(name);
    }

    if (!isTestEnv) console.log(`Reloaded extension: ${name}`);
  }

  /**
   * Get resolved settings for an extension
   *
   * @param name - Extension name
   * @returns Resolved settings or undefined if extension not found
   */
  getExtensionSettings(name: string): ResolvedExtensionSetting[] | undefined {
    return this.resolvedSettings.get(name);
  }

  /**
   * Get environment variables for an extension's hooks/MCP servers
   *
   * @param name - Extension name
   * @returns Environment variables object
   */
  getExtensionEnvironment(name: string): Record<string, string> {
    const settings = this.resolvedSettings.get(name);
    if (!settings) {
      return {};
    }

    return this.settingsManager.toEnvironmentVariables(settings, name);
  }

  /**
   * Get configuration schema for all extensions
   *
   * @returns Configuration schema object
   */
  getExtensionsConfigSchema(): Record<string, unknown> {
    const schema: Record<string, unknown> = {};

    for (const extension of this.extensions.values()) {
      if (extension.settings.length > 0) {
        const extensionSchema = this.settingsManager.createConfigSchema(
          extension.name,
          extension.settings
        );
        Object.assign(schema, extensionSchema);
      }
    }

    return schema;
  }

  /**
   * Get extension settings with sensitive values redacted (for logging)
   *
   * @param name - Extension name
   * @returns Settings object with sensitive values redacted
   */
  getRedactedSettings(name: string): Record<string, unknown> {
    const settings = this.resolvedSettings.get(name);
    if (!settings) {
      return {};
    }

    // Build settings object
    const settingsObj: Record<string, unknown> = {};
    const sensitiveNames = new Set<string>();

    for (const setting of settings) {
      settingsObj[setting.name] = setting.value;
      if (setting.sensitive) {
        sensitiveNames.add(setting.name);
      }
    }

    // Redact sensitive settings
    return this.settingsManager.redactSensitiveSettings(settingsObj, sensitiveNames);
  }

  /**
   * Get extension environment variables with sensitive values redacted (for logging)
   *
   * @param name - Extension name
   * @returns Environment variables with sensitive values redacted
   */
  getRedactedEnvironment(name: string): Record<string, string> {
    const settings = this.resolvedSettings.get(name);
    if (!settings) {
      return {};
    }

    const env = this.getExtensionEnvironment(name);
    return this.settingsManager.redactSensitiveEnv(env, settings);
  }

  /**
   * Get the skill registry
   *
   * @returns Skill registry instance
   */
  getSkillRegistry(): SkillRegistry | undefined {
    return this.skillRegistry;
  }

  /**
   * Set MCP client (for CLI layer injection)
   *
   * @param mcpClient - MCP client instance
   */
  setMCPClient(mcpClient: MCPClient): void {
    this.mcpClient = mcpClient;
  }

  /**
   * Get MCP client
   *
   * @returns MCP client instance or undefined if not set
   */
  getMCPClient(): MCPClient | undefined {
    return this.mcpClient;
  }

  /**
   * Set MCP tool wrapper (for CLI layer injection)
   *
   * @param mcpToolWrapper - MCP tool wrapper instance
   */
  setMCPToolWrapper(mcpToolWrapper: MCPToolWrapper): void {
    this.mcpToolWrapper = mcpToolWrapper;
  }

  /**
   * Get extension state for persistence
   *
   * @returns Array of extension states
   */
  getExtensionStates(): ExtensionState[] {
    return Array.from(this.extensions.values()).map((ext) => ({
      name: ext.name,
      enabled: ext.enabled,
    }));
  }

  /**
   * Restore extension states from persistence
   *
   * @param states - Array of extension states to restore
   */
  async restoreExtensionStates(states: ExtensionState[]): Promise<void> {
    for (const state of states) {
      const extension = this.extensions.get(state.name);
      if (!extension) {
        continue; // Extension not loaded
      }

      if (state.enabled && !extension.enabled) {
        await this.enableExtension(state.name);
      } else if (!state.enabled && extension.enabled) {
        await this.disableExtension(state.name);
      }
    }
  }
}
