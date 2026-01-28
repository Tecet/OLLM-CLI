/**
 * TrustedHooks manages hook trust verification and approval
 *
 * Implements a security model where hooks from different sources have
 * different trust levels. Workspace and downloaded hooks require explicit
 * user approval before execution.
 */

import { createHash } from 'crypto';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { dirname } from 'path';

import type { Hook, HookApproval } from './types.js';

/**
 * Storage format for trusted hooks
 */
interface TrustedHooksStorage {
  version: number;
  approvals: HookApproval[];
}

/**
 * Callback for requesting user approval
 */
export type ApprovalCallback = (hook: Hook, hash: string) => Promise<boolean>;

/**
 * Configuration for TrustedHooks
 */
export interface TrustedHooksConfig {
  /** Path to trusted-hooks.json file */
  storagePath: string;
  /** Whether to auto-trust workspace hooks */
  trustWorkspace?: boolean;
  /** Callback for requesting user approval (optional) */
  approvalCallback?: ApprovalCallback;
}

/**
 * Manages hook trust verification and approval storage
 */
export class TrustedHooks {
  private approvals: Map<string, HookApproval>;
  private config: TrustedHooksConfig;
  private loaded: boolean;

  constructor(config: TrustedHooksConfig) {
    this.config = config;
    this.approvals = new Map();
    this.loaded = false;
  }

  /**
   * Check if a hook is trusted
   *
   * Trust rules:
   * - builtin: Always trusted
   * - user: Always trusted (from ~/.ollm/)
   * - workspace: Requires approval (unless trustWorkspace is enabled)
   * - downloaded: Requires approval
   *
   * @param hook - The hook to check
   * @returns true if the hook is trusted
   */
  async isTrusted(hook: Hook): Promise<boolean> {
    // Ensure approvals are loaded
    if (!this.loaded) {
      await this.load();
    }

    // Apply trust rules based on source
    switch (hook.source) {
      case 'builtin':
        // Built-in hooks are always trusted
        return true;

      case 'user':
        // User hooks (from ~/.ollm/) are always trusted
        return true;

      case 'workspace':
        // Workspace hooks require approval unless trustWorkspace is enabled
        if (this.config.trustWorkspace) {
          return true;
        }
        return this.isApproved(hook);

      case 'downloaded':
        // Downloaded hooks always require approval
        return this.isApproved(hook);

      default:
        // Unknown source, require approval
        return false;
    }
  }

  /**
   * Check if a hook has been approved and hash matches
   *
   * @param hook - The hook to check
   * @returns true if hook is approved and hash matches
   */
  private async isApproved(hook: Hook): Promise<boolean> {
    // Get the source path for this hook
    const sourcePath = this.getHookSourcePath(hook);

    // Check if we have an approval for this source
    const approval = this.approvals.get(sourcePath);
    if (!approval) {
      return false;
    }

    // Compute current hash and compare with stored hash
    const currentHash = await this.computeHash(hook);
    return currentHash === approval.hash;
  }

  /**
   * Get the source path for a hook
   *
   * @param hook - The hook to get source path for
   * @returns Source path string
   */
  private getHookSourcePath(hook: Hook): string {
    // Use sourcePath if available, otherwise fall back to a unique identifier
    if (hook.sourcePath) {
      return hook.sourcePath;
    }

    // Create a unique identifier from hook properties
    // This ensures different hooks are tracked separately
    const identifier = `${hook.source}:${hook.extensionName || 'none'}:${hook.id}`;
    return identifier;
  }

  /**
   * Request user approval for a hook
   *
   * Uses the approval callback if provided, otherwise returns false.
   *
   * @param hook - The hook to request approval for
   * @returns Promise that resolves to true if approved
   */
  async requestApproval(hook: Hook): Promise<boolean> {
    // If no approval callback is configured, deny by default
    if (!this.config.approvalCallback) {
      if (process.env.NODE_ENV !== 'test' && !process.env.VITEST) {
        console.warn(
          `Hook '${hook.name}' requires approval but no approval callback is configured. Denying by default.`
        );
      }
      return false;
    }

    // Compute hash for the hook
    const hash = await this.computeHash(hook);

    // Call the approval callback
    try {
      const approved = await this.config.approvalCallback(hook, hash);
      return approved;
    } catch (error) {
      // If approval callback throws, deny by default
      if (process.env.NODE_ENV !== 'test' && !process.env.VITEST) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`Error requesting approval for hook '${hook.name}': ${errorMessage}`);
      }
      return false;
    }
  }

  /**
   * Store approval for a hook
   *
   * @param hook - The hook to approve
   * @param hash - The hash of the hook script
   */
  async storeApproval(hook: Hook, hash: string): Promise<void> {
    const sourcePath = this.getHookSourcePath(hook);

    // Get username from environment or use 'user' as default
    const username = process.env.USER || process.env.USERNAME || 'user';

    const approval: HookApproval = {
      source: sourcePath,
      hash,
      approvedAt: new Date().toISOString(),
      approvedBy: username,
    };

    // Store in memory
    this.approvals.set(sourcePath, approval);

    // Persist to disk
    await this.save();
  }

  /**
   * Compute SHA-256 hash of hook script
   *
   * @param hook - The hook to compute hash for
   * @returns Promise that resolves to the hash string
   */
  async computeHash(hook: Hook): Promise<string> {
    try {
      // If sourcePath is available and is a file, read and hash the actual file
      if (hook.sourcePath && (hook.sourcePath.includes('/') || hook.sourcePath.includes('\\'))) {
        try {
          const scriptContent = await readFile(hook.sourcePath, 'utf-8');
          const hash = createHash('sha256');
          hash.update(scriptContent);
          return `sha256:${hash.digest('hex')}`;
        } catch (_error) {
          // If file read fails, fall back to hashing command and args
          if (process.env.NODE_ENV !== 'test' && !process.env.VITEST) {
            console.warn(
              `Failed to read hook script at ${hook.sourcePath}, using command hash instead`
            );
          }
        }
      }
    } catch (_error) {
      // Fall through to command-based hash
    }

    // Fall back to hashing command and args
    const content = JSON.stringify({
      command: hook.command,
      args: hook.args || [],
      source: hook.source,
      extensionName: hook.extensionName,
    });

    const hash = createHash('sha256');
    hash.update(content);
    return `sha256:${hash.digest('hex')}`;
  }

  /**
   * Load trusted hooks from storage
   */
  async load(): Promise<void> {
    try {
      const data = await readFile(this.config.storagePath, 'utf-8');
      const storage: TrustedHooksStorage = JSON.parse(data);

      // Load approvals into map
      this.approvals.clear();
      for (const approval of storage.approvals) {
        this.approvals.set(approval.source, approval);
      }

      this.loaded = true;
    } catch (error) {
      // If file doesn't exist or is invalid, start with empty approvals
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        this.approvals.clear();
        this.loaded = true;
      } else {
        throw error;
      }
    }
  }

  /**
   * Save trusted hooks to storage
   */
  async save(): Promise<void> {
    const storage: TrustedHooksStorage = {
      version: 1,
      approvals: Array.from(this.approvals.values()),
    };

    // Ensure directory exists
    const dir = dirname(this.config.storagePath);
    await mkdir(dir, { recursive: true });

    // Write to file
    await writeFile(this.config.storagePath, JSON.stringify(storage, null, 2), 'utf-8');
  }

  /**
   * Get all approvals
   *
   * @returns Array of all hook approvals
   */
  getApprovals(): HookApproval[] {
    return Array.from(this.approvals.values());
  }

  /**
   * Remove approval for a hook
   *
   * @param sourcePath - The source path of the hook
   * @returns true if approval was removed
   */
  async removeApproval(sourcePath: string): Promise<boolean> {
    const removed = this.approvals.delete(sourcePath);
    if (removed) {
      await this.save();
    }
    return removed;
  }

  /**
   * Clear all approvals
   */
  async clearApprovals(): Promise<void> {
    this.approvals.clear();
    await this.save();
  }
}
