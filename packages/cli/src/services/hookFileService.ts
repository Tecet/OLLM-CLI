import fs from 'fs';
import path from 'path';
import os from 'os';
import type { UIHook } from '../features/hooks/types.js';

/**
 * Hook File Service
 * Handles reading and writing hook files from user and workspace directories
 */
export class HookFileService {
  private userHooksDir: string;
  private workspaceHooksDir: string;

  constructor() {
    this.userHooksDir = path.join(os.homedir(), '.ollm', 'hooks');
    this.workspaceHooksDir = path.join(process.cwd(), '.ollm', 'hooks');
  }

  /**
   * Load hooks from user directory (~/.ollm/hooks/)
   * @returns Array of hooks from user directory
   */
  async loadUserHooks(): Promise<UIHook[]> {
    return this.loadHooksFromDirectory(this.userHooksDir, 'user');
  }

  /**
   * Load hooks from workspace directory (.ollm/hooks/)
   * @returns Array of hooks from workspace directory
   */
  async loadWorkspaceHooks(): Promise<UIHook[]> {
    return this.loadHooksFromDirectory(this.workspaceHooksDir, 'workspace');
  }

  /**
   * Load hooks from a specific directory
   * @param directory - Directory path to load hooks from
   * @param source - Source type for the hooks
   * @returns Array of hooks from the directory
   */
  private async loadHooksFromDirectory(
    directory: string,
    source: 'user' | 'workspace'
  ): Promise<UIHook[]> {
    const hooks: UIHook[] = [];

    try {
      // Check if directory exists
      if (!fs.existsSync(directory)) {
        return hooks;
      }

      // Read all files in directory
      const files = await fs.promises.readdir(directory);

      // Load each JSON file
      for (const file of files) {
        if (file.endsWith('.json')) {
          const hookPath = path.join(directory, file);
          const hook = await this.loadHookFile(hookPath, source);
          if (hook) {
            hooks.push(hook);
          }
        }
      }

      return hooks;
    } catch (error) {
      console.error(`Error loading hooks from ${directory}:`, error);
      return hooks;
    }
  }

  /**
   * Load a single hook file
   * @param filePath - Path to the hook file
   * @param source - Source type for the hook
   * @returns Parsed hook or null if invalid
   */
  private async loadHookFile(
    filePath: string,
    source: 'user' | 'workspace'
  ): Promise<UIHook | null> {
    try {
      const content = await fs.promises.readFile(filePath, 'utf-8');
      const data = JSON.parse(content);

      // Validate hook structure
      const validation = this.validateHook(data);
      if (!validation.valid) {
        console.warn(`Invalid hook file ${filePath}:`, validation.errors);
        return null;
      }

      // Extract hook ID from filename
      const hookId = path.basename(filePath, '.json');

      // Build UIHook object
      const hook: UIHook = {
        id: hookId,
        name: data.name,
        version: data.version || '1.0.0',
        description: data.description,
        when: {
          type: data.when.type,
          patterns: data.when.patterns,
        },
        then: {
          type: data.then.type,
          prompt: data.then.prompt,
          command: data.then.command,
        },
        enabled: true, // Will be overridden by settings
        trusted: false, // Will be set by HookRegistry
        source,
      };

      return hook;
    } catch (error) {
      if (error instanceof SyntaxError) {
        console.error(`JSON parsing error in ${filePath}:`, error.message);
      } else {
        console.error(`Failed to load hook file ${filePath}:`, error);
      }
      return null;
    }
  }

  /**
   * Save a hook to the user hooks directory
   * @param hook - Hook to save
   */
  async saveHook(hook: UIHook): Promise<void> {
    const fileName = `${hook.id}.json`;
    const filePath = path.join(this.userHooksDir, fileName);

    // Ensure directory exists
    await this.ensureDirectoryExists(this.userHooksDir);

    // Prepare hook data (exclude runtime fields)
    const hookData = {
      name: hook.name,
      version: hook.version,
      description: hook.description,
      when: {
        type: hook.when.type,
        patterns: hook.when.patterns,
      },
      then: {
        type: hook.then.type,
        prompt: hook.then.prompt,
        command: hook.then.command,
      },
    };

    // Write to file
    try {
      await fs.promises.writeFile(
        filePath,
        JSON.stringify(hookData, null, 2),
        'utf-8'
      );
    } catch (error) {
      throw new Error(`Failed to save hook: ${error}`);
    }
  }

  /**
   * Update an existing hook
   * @param hookId - ID of the hook to update
   * @param updates - Partial hook data to update
   */
  async updateHook(hookId: string, updates: Partial<UIHook>): Promise<void> {
    const fileName = `${hookId}.json`;
    const filePath = path.join(this.userHooksDir, fileName);

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      throw new Error(`Hook file not found: ${hookId}`);
    }

    try {
      // Read existing hook
      const content = await fs.promises.readFile(filePath, 'utf-8');
      const data = JSON.parse(content);

      // Merge updates (exclude runtime fields)
      const updated = {
        name: updates.name ?? data.name,
        version: updates.version ?? data.version,
        description: updates.description ?? data.description,
        when: {
          type: updates.when?.type ?? data.when?.type,
          patterns: updates.when?.patterns ?? data.when?.patterns,
        },
        then: {
          type: updates.then?.type ?? data.then?.type,
          prompt: updates.then?.prompt ?? data.then?.prompt,
          command: updates.then?.command ?? data.then?.command,
        },
      };

      // Validate updated hook
      const validation = this.validateHook(updated);
      if (!validation.valid) {
        throw new Error(`Invalid hook data: ${validation.errors.join(', ')}`);
      }

      // Write updated hook
      await fs.promises.writeFile(
        filePath,
        JSON.stringify(updated, null, 2),
        'utf-8'
      );
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(`Failed to update hook: ${error}`);
    }
  }

  /**
   * Delete a hook file
   * @param hookId - ID of the hook to delete
   */
  async deleteHook(hookId: string): Promise<void> {
    const fileName = `${hookId}.json`;
    const filePath = path.join(this.userHooksDir, fileName);

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      throw new Error(`Hook file not found: ${hookId}`);
    }

    try {
      await fs.promises.unlink(filePath);
    } catch (error) {
      throw new Error(`Failed to delete hook: ${error}`);
    }
  }

  /**
   * Validate hook structure
   * @param data - Hook data to validate
   * @returns Validation result with errors
   */
  validateHook(data: unknown): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    const d = data as Record<string, unknown>;

    // Required fields
    if (!d.name || typeof d.name !== 'string' || d.name.trim() === '') {
      errors.push('Missing or invalid required field: name');
    }

    if (!d.when || typeof d.when !== 'object') {
      errors.push('Missing required field: when');
    } else {
      // Validate when.type
      if (!d.when.type) {
        errors.push('Missing required field: when.type');
      } else {
        const validEventTypes = [
          'fileEdited',
          'fileCreated',
          'fileDeleted',
          'userTriggered',
          'promptSubmit',
          'agentStop',
        ];
        if (!validEventTypes.includes(d.when.type)) {
          errors.push(`Invalid event type: ${d.when.type}`);
        }

        // File events require patterns
        const fileEventTypes = ['fileEdited', 'fileCreated', 'fileDeleted'];
        if (fileEventTypes.includes(d.when.type)) {
          if (!d.when.patterns || !Array.isArray(d.when.patterns) || d.when.patterns.length === 0) {
            errors.push('File event types require at least one pattern');
          }
        }
      }
    }

    if (!d.then || typeof d.then !== 'object') {
      errors.push('Missing required field: then');
    } else {
      // Validate then.type
      if (!d.then.type) {
        errors.push('Missing required field: then.type');
      } else {
        const validActionTypes = ['askAgent', 'runCommand'];
        if (!validActionTypes.includes(d.then.type)) {
          errors.push(`Invalid action type: ${d.then.type}`);
        }

        // askAgent requires prompt
        if (d.then.type === 'askAgent') {
          if (!d.then.prompt || typeof d.then.prompt !== 'string' || d.then.prompt.trim() === '') {
            errors.push('askAgent action requires a prompt');
          }
        }

        // runCommand requires command
        if (d.then.type === 'runCommand') {
          if (!d.then.command || typeof d.then.command !== 'string' || d.then.command.trim() === '') {
            errors.push('runCommand action requires a command');
          }
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
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
      throw new Error(`Failed to create directory ${directory}: ${error}`);
    }
  }

  /**
   * Get the user hooks directory path
   */
  getUserHooksDir(): string {
    return this.userHooksDir;
  }

  /**
   * Get the workspace hooks directory path
   */
  getWorkspaceHooksDir(): string {
    return this.workspaceHooksDir;
  }
}

// Singleton instance
export const hookFileService = new HookFileService();
