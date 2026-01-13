/**
 * TrustedHooks manages hook trust verification and approval
 * 
 * Implements a security model where hooks from different sources have
 * different trust levels. Workspace and downloaded hooks require explicit
 * user approval before execution.
 */

import { createHash } from 'crypto';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { dirname, resolve } from 'path';
import type { Hook, HookApproval } from './types.js';

/**
 * Storage format for trusted hooks
 */
interface TrustedHooksStorage {
  version: number;
  approvals: HookApproval[];
}

/**
 * Configuration for TrustedHooks
 */
export interface TrustedHooksConfig {
  /** Path to trusted-hooks.json file */
  storagePath: string;
  /** Whether to auto-trust workspace hooks */
  trustWorkspace?: boolean;
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
    // For now, use command as the source path
    // In a real implementation, this would be the actual file path
    return hook.command;
  }

  /**
   * Request user approval for a hook
   * 
   * TODO: Integrate with UI for actual user prompting
   * 
   * @param hook - The hook to request approval for
   * @returns Promise that resolves to true if approved
   */
  async requestApproval(hook: Hook): Promise<boolean> {
    // TODO: Implement UI integration for approval prompting
    // For now, this is a stub that returns false
    // In a real implementation, this would:
    // 1. Display hook details to user
    // 2. Show hook source code
    // 3. Prompt for approval
    // 4. Return user's decision
    return false;
  }

  /**
   * Store approval for a hook
   * 
   * @param hook - The hook to approve
   * @param hash - The hash of the hook script
   */
  async storeApproval(hook: Hook, hash: string): Promise<void> {
    const sourcePath = this.getHookSourcePath(hook);
    
    const approval: HookApproval = {
      source: sourcePath,
      hash,
      approvedAt: new Date().toISOString(),
      approvedBy: 'user', // TODO: Get actual username
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
    // For now, hash the command and args
    // In a real implementation, this would read and hash the actual script file
    const content = JSON.stringify({
      command: hook.command,
      args: hook.args || [],
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
    await writeFile(
      this.config.storagePath,
      JSON.stringify(storage, null, 2),
      'utf-8'
    );
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
