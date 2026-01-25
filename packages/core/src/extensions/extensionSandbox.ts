/**
 * Extension Sandbox for permission management
 * 
 * Provides runtime enforcement of extension permissions
 * to prevent unauthorized access to system resources.
 */

import { homedir } from 'os';
import { resolve, relative, sep } from 'path';

/**
 * Permission types
 */
export type PermissionType =
  | 'filesystem'
  | 'network'
  | 'env'
  | 'shell'
  | 'mcp';

/**
 * Permission definition
 */
export interface Permission {
  /** Permission type */
  type: PermissionType;
  /** Permission scope (paths, domains, env vars, etc.) */
  scope: string[];
  /** Whether permission is granted */
  granted: boolean;
}

/**
 * Extension permissions manifest
 */
export interface ExtensionPermissions {
  /** Extension name */
  extensionName: string;
  /** Filesystem access permissions */
  filesystem?: string[];
  /** Network access permissions (domains) */
  network?: string[];
  /** Environment variable access permissions */
  env?: string[];
  /** Shell command execution permission */
  shell?: boolean;
  /** MCP server management permission */
  mcp?: boolean;
}

/**
 * Permission check result
 */
export interface PermissionCheckResult {
  /** Whether permission is granted */
  granted: boolean;
  /** Reason for denial (if not granted) */
  reason?: string;
}

/**
 * Sandbox configuration
 */
export interface SandboxConfig {
  /** Whether to enforce permissions */
  enabled?: boolean;
  /** Whether to prompt for missing permissions */
  promptForPermissions?: boolean;
  /** Default permissions for new extensions */
  defaultPermissions?: Partial<ExtensionPermissions>;
}

/**
 * Extension sandbox for permission management
 */
export class ExtensionSandbox {
  private permissions: Map<string, Required<ExtensionPermissions>>;
  private config: Required<SandboxConfig>;
  private promptCallback?: (
    extensionName: string,
    permission: Permission
  ) => Promise<boolean>;

  constructor(config: SandboxConfig = {}) {
    this.permissions = new Map();
    this.config = {
      enabled: config.enabled ?? true,
      promptForPermissions: config.promptForPermissions ?? true,
      defaultPermissions: config.defaultPermissions ?? {
        filesystem: [],
        network: [],
        env: [],
        shell: false,
        mcp: false,
      },
    };
  }

  /**
   * Set permission prompt callback
   * 
   * @param callback - Callback function for permission prompts
   */
  setPromptCallback(
    callback: (
      extensionName: string,
      permission: Permission
    ) => Promise<boolean>
  ): void {
    this.promptCallback = callback;
  }

  /**
   * Register extension permissions
   * 
   * @param extensionName - Extension name
   * @param permissions - Extension permissions
   */
  registerPermissions(
    extensionName: string,
    permissions: Partial<ExtensionPermissions>
  ): void {
    const fullPermissions: Required<ExtensionPermissions> = {
      extensionName,
      filesystem: permissions.filesystem ?? this.config.defaultPermissions.filesystem ?? [],
      network: permissions.network ?? this.config.defaultPermissions.network ?? [],
      env: permissions.env ?? this.config.defaultPermissions.env ?? [],
      shell: permissions.shell ?? this.config.defaultPermissions.shell ?? false,
      mcp: permissions.mcp ?? this.config.defaultPermissions.mcp ?? false,
    };

    this.permissions.set(extensionName, fullPermissions);
    console.log(`Registered permissions for extension: ${extensionName}`);
  }

  /**
   * Unregister extension permissions
   * 
   * @param extensionName - Extension name
   */
  unregisterPermissions(extensionName: string): void {
    this.permissions.delete(extensionName);
    console.log(`Unregistered permissions for extension: ${extensionName}`);
  }

  /**
   * Check filesystem access permission
   * 
   * @param extensionName - Extension name
   * @param path - File path to access
   * @returns Permission check result
   */
  async checkFilesystemAccess(
    extensionName: string,
    path: string
  ): Promise<PermissionCheckResult> {
    if (!this.config.enabled) {
      return { granted: true };
    }

    const permissions = this.permissions.get(extensionName);
    if (!permissions) {
      return {
        granted: false,
        reason: `No permissions registered for extension '${extensionName}'`,
      };
    }

    // Resolve absolute path
    const absolutePath = resolve(path);

    // Check if path is within allowed scopes
    for (const allowedPath of permissions.filesystem) {
      const resolvedAllowed = this.resolvePath(allowedPath);
      
      // Check if path is within allowed directory
      if (this.isPathWithin(absolutePath, resolvedAllowed)) {
        return { granted: true };
      }
    }

    // Permission not granted, check if we should prompt
    if (this.config.promptForPermissions && this.promptCallback) {
      const permission: Permission = {
        type: 'filesystem',
        scope: [path],
        granted: false,
      };

      const granted = await this.promptCallback(extensionName, permission);
      
      if (granted) {
        // Add to permissions
        permissions.filesystem.push(path);
        return { granted: true };
      }
    }

    return {
      granted: false,
      reason: `Extension '${extensionName}' does not have permission to access '${path}'`,
    };
  }

  /**
   * Check network access permission
   * 
   * @param extensionName - Extension name
   * @param domain - Domain to access
   * @returns Permission check result
   */
  async checkNetworkAccess(
    extensionName: string,
    domain: string
  ): Promise<PermissionCheckResult> {
    if (!this.config.enabled) {
      return { granted: true };
    }

    const permissions = this.permissions.get(extensionName);
    if (!permissions) {
      return {
        granted: false,
        reason: `No permissions registered for extension '${extensionName}'`,
      };
    }

    // Check if domain is in allowed list
    for (const allowedDomain of permissions.network) {
      if (this.matchesDomain(domain, allowedDomain)) {
        return { granted: true };
      }
    }

    // Permission not granted, check if we should prompt
    if (this.config.promptForPermissions && this.promptCallback) {
      const permission: Permission = {
        type: 'network',
        scope: [domain],
        granted: false,
      };

      const granted = await this.promptCallback(extensionName, permission);
      
      if (granted) {
        // Add to permissions
        permissions.network.push(domain);
        return { granted: true };
      }
    }

    return {
      granted: false,
      reason: `Extension '${extensionName}' does not have permission to access domain '${domain}'`,
    };
  }

  /**
   * Check environment variable access permission
   * 
   * @param extensionName - Extension name
   * @param envVar - Environment variable name
   * @returns Permission check result
   */
  async checkEnvAccess(
    extensionName: string,
    envVar: string
  ): Promise<PermissionCheckResult> {
    if (!this.config.enabled) {
      return { granted: true };
    }

    const permissions = this.permissions.get(extensionName);
    if (!permissions) {
      return {
        granted: false,
        reason: `No permissions registered for extension '${extensionName}'`,
      };
    }

    // Check if env var is in allowed list
    if (permissions.env.includes(envVar) || permissions.env.includes('*')) {
      return { granted: true };
    }

    // Permission not granted, check if we should prompt
    if (this.config.promptForPermissions && this.promptCallback) {
      const permission: Permission = {
        type: 'env',
        scope: [envVar],
        granted: false,
      };

      const granted = await this.promptCallback(extensionName, permission);
      
      if (granted) {
        // Add to permissions
        permissions.env.push(envVar);
        return { granted: true };
      }
    }

    return {
      granted: false,
      reason: `Extension '${extensionName}' does not have permission to access environment variable '${envVar}'`,
    };
  }

  /**
   * Check shell execution permission
   * 
   * @param extensionName - Extension name
   * @returns Permission check result
   */
  async checkShellAccess(
    extensionName: string
  ): Promise<PermissionCheckResult> {
    if (!this.config.enabled) {
      return { granted: true };
    }

    const permissions = this.permissions.get(extensionName);
    if (!permissions) {
      return {
        granted: false,
        reason: `No permissions registered for extension '${extensionName}'`,
      };
    }

    if (permissions.shell) {
      return { granted: true };
    }

    // Permission not granted, check if we should prompt
    if (this.config.promptForPermissions && this.promptCallback) {
      const permission: Permission = {
        type: 'shell',
        scope: [],
        granted: false,
      };

      const granted = await this.promptCallback(extensionName, permission);
      
      if (granted) {
        // Grant permission
        permissions.shell = true;
        return { granted: true };
      }
    }

    return {
      granted: false,
      reason: `Extension '${extensionName}' does not have permission to execute shell commands`,
    };
  }

  /**
   * Check MCP server management permission
   * 
   * @param extensionName - Extension name
   * @returns Permission check result
   */
  async checkMCPAccess(
    extensionName: string
  ): Promise<PermissionCheckResult> {
    if (!this.config.enabled) {
      return { granted: true };
    }

    const permissions = this.permissions.get(extensionName);
    if (!permissions) {
      return {
        granted: false,
        reason: `No permissions registered for extension '${extensionName}'`,
      };
    }

    if (permissions.mcp) {
      return { granted: true };
    }

    // Permission not granted, check if we should prompt
    if (this.config.promptForPermissions && this.promptCallback) {
      const permission: Permission = {
        type: 'mcp',
        scope: [],
        granted: false,
      };

      const granted = await this.promptCallback(extensionName, permission);
      
      if (granted) {
        // Grant permission
        permissions.mcp = true;
        return { granted: true };
      }
    }

    return {
      granted: false,
      reason: `Extension '${extensionName}' does not have permission to manage MCP servers`,
    };
  }

  /**
   * Get permissions for an extension
   * 
   * @param extensionName - Extension name
   * @returns Extension permissions or undefined
   */
  getPermissions(extensionName: string): ExtensionPermissions | undefined {
    return this.permissions.get(extensionName);
  }

  /**
   * Grant permission to an extension
   * 
   * @param extensionName - Extension name
   * @param permission - Permission to grant
   */
  grantPermission(extensionName: string, permission: Permission): void {
    const permissions = this.permissions.get(extensionName);
    if (!permissions) {
      throw new Error(`No permissions registered for extension '${extensionName}'`);
    }

    switch (permission.type) {
      case 'filesystem':
        permissions.filesystem.push(...permission.scope);
        break;
      case 'network':
        permissions.network.push(...permission.scope);
        break;
      case 'env':
        permissions.env.push(...permission.scope);
        break;
      case 'shell':
        permissions.shell = true;
        break;
      case 'mcp':
        permissions.mcp = true;
        break;
    }

    console.log(`Granted ${permission.type} permission to extension: ${extensionName}`);
  }

  /**
   * Revoke permission from an extension
   * 
   * @param extensionName - Extension name
   * @param permission - Permission to revoke
   */
  revokePermission(extensionName: string, permission: Permission): void {
    const permissions = this.permissions.get(extensionName);
    if (!permissions) {
      throw new Error(`No permissions registered for extension '${extensionName}'`);
    }

    switch (permission.type) {
      case 'filesystem':
        permissions.filesystem = permissions.filesystem.filter(
          (p) => !permission.scope.includes(p)
        );
        break;
      case 'network':
        permissions.network = permissions.network.filter(
          (p) => !permission.scope.includes(p)
        );
        break;
      case 'env':
        permissions.env = permissions.env.filter(
          (p) => !permission.scope.includes(p)
        );
        break;
      case 'shell':
        permissions.shell = false;
        break;
      case 'mcp':
        permissions.mcp = false;
        break;
    }

    console.log(`Revoked ${permission.type} permission from extension: ${extensionName}`);
  }

  /**
   * Resolve path with tilde expansion
   * 
   * @param path - Path to resolve
   * @returns Resolved absolute path
   */
  private resolvePath(path: string): string {
    if (path.startsWith('~')) {
      return resolve(homedir(), path.slice(2));
    }
    return resolve(path);
  }

  /**
   * Check if path is within allowed directory
   * 
   * @param path - Path to check
   * @param allowedPath - Allowed directory path
   * @returns True if path is within allowed directory
   */
  private isPathWithin(path: string, allowedPath: string): boolean {
    const rel = relative(allowedPath, path);
    return !rel.startsWith('..') && !resolve(path).startsWith(sep);
  }

  /**
   * Check if domain matches allowed domain pattern
   * 
   * @param domain - Domain to check
   * @param pattern - Allowed domain pattern (supports wildcards)
   * @returns True if domain matches pattern
   */
  private matchesDomain(domain: string, pattern: string): boolean {
    // Exact match
    if (domain === pattern) {
      return true;
    }

    // Wildcard match (*.example.com)
    if (pattern.startsWith('*.')) {
      const baseDomain = pattern.slice(2);
      return domain.endsWith(baseDomain) || domain === baseDomain;
    }

    // Full wildcard
    if (pattern === '*') {
      return true;
    }

    return false;
  }

  /**
   * Enable or disable sandbox
   * 
   * @param enabled - Whether to enable sandbox
   */
  setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;
    console.log(`Extension sandbox ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Check if sandbox is enabled
   * 
   * @returns True if sandbox is enabled
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }
}
