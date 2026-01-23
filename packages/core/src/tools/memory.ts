/**
 * Memory tool implementation
 *
 * Provides persistent key-value storage for LLMs to maintain state
 * across conversations. Data is stored in a JSON file with concurrent
 * access safety through atomic writes.
 */

import { promises as fs } from 'fs';
import * as path from 'path';

import type {
  DeclarativeTool,
  ToolInvocation,
  ToolResult,
  ToolContext,
  ToolSchema,
} from './types.js';

/**
 * Parameters for memory operations
 */
export interface MemoryParams {
  /**
   * Action to perform
   */
  action: 'get' | 'set' | 'delete' | 'list';

  /**
   * Key name (required for get, set, delete)
   */
  key?: string;

  /**
   * Value to store (required for set)
   */
  value?: string;
}

/**
 * Tool for persistent key-value storage
 */
export class MemoryTool implements DeclarativeTool<MemoryParams, ToolResult> {
  name = 'memory';
  displayName = 'Persistent Memory';
  schema: ToolSchema = {
    name: 'memory',
    description: 'Store and retrieve persistent key-value data',
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['get', 'set', 'delete', 'list'],
          description: 'Action to perform',
        },
        key: {
          type: 'string',
          description: 'Key name (required for get, set, delete)',
        },
        value: {
          type: 'string',
          description: 'Value to store (required for set)',
        },
      },
      required: ['action'],
    },
  };

  constructor(private storePath: string) {}

  createInvocation(
    params: MemoryParams,
    _context: ToolContext
  ): ToolInvocation<MemoryParams, ToolResult> {
    return new MemoryInvocation(params, this.storePath);
  }
}


/**
 * Invocation instance for memory operations
 */
export class MemoryInvocation implements ToolInvocation<MemoryParams, ToolResult> {
  constructor(
    public params: MemoryParams,
    private storePath: string
  ) {}

  getDescription(): string {
    const keyPart = this.params.key ? ` "${this.params.key}"` : '';
    return `Memory ${this.params.action}${keyPart}`;
  }

  toolLocations(): string[] {
    return [this.storePath];
  }

  async shouldConfirmExecute(
    _abortSignal: AbortSignal
  ): Promise<false> {
    // Memory operations don't require confirmation
    return false;
  }

  async execute(
    signal: AbortSignal,
    _updateOutput?: (output: string) => void
  ): Promise<ToolResult> {
    try {
      // Check if aborted
      if (signal.aborted) {
        throw new Error('Operation cancelled');
      }

      const store = await this.loadStore();

      switch (this.params.action) {
        case 'get':
          return this.handleGet(store);

        case 'set':
          return await this.handleSet(store, signal);

        case 'delete':
          return await this.handleDelete(store, signal);

        case 'list':
          return this.handleList(store);

        default:
          return {
            llmContent: '',
            returnDisplay: '',
            error: {
              message: `Unknown action: ${this.params.action}`,
              type: 'InvalidActionError',
            },
          };
      }
    } catch (error) {
      return {
        llmContent: '',
        returnDisplay: '',
        error: {
          message: (error as Error).message,
          type: 'MemoryError',
        },
      };
    }
  }

  private handleGet(store: Record<string, string>): ToolResult {
    if (!this.params.key) {
      return {
        llmContent: '',
        returnDisplay: '',
        error: {
          message: 'Key required for get action',
          type: 'ValidationError',
        },
      };
    }

    // Use Object.hasOwn to avoid prototype pollution issues with keys like __proto__
    if (!Object.hasOwn(store, this.params.key)) {
      return {
        llmContent: `Key not found: ${this.params.key}`,
        returnDisplay: `Key not found: ${this.params.key}`,
      };
    }

    const value = store[this.params.key];
    return {
      llmContent: value,
      returnDisplay: `Retrieved "${this.params.key}"`,
    };
  }

  private async handleSet(
    store: Record<string, string>,
    signal: AbortSignal
  ): Promise<ToolResult> {
    if (!this.params.key) {
      return {
        llmContent: '',
        returnDisplay: '',
        error: {
          message: 'Key required for set action',
          type: 'ValidationError',
        },
      };
    }

    if (this.params.value === undefined) {
      return {
        llmContent: '',
        returnDisplay: '',
        error: {
          message: 'Value required for set action',
          type: 'ValidationError',
        },
      };
    }

    // Check if aborted before writing
    if (signal.aborted) {
      throw new Error('Operation cancelled');
    }

    store[this.params.key] = this.params.value;
    await this.saveStore(store);

    return {
      llmContent: `Stored "${this.params.key}"`,
      returnDisplay: `Stored "${this.params.key}"`,
    };
  }

  private async handleDelete(
    store: Record<string, string>,
    signal: AbortSignal
  ): Promise<ToolResult> {
    if (!this.params.key) {
      return {
        llmContent: '',
        returnDisplay: '',
        error: {
          message: 'Key required for delete action',
          type: 'ValidationError',
        },
      };
    }

    // Use Object.hasOwn to avoid prototype pollution issues with keys like __proto__
    if (!Object.hasOwn(store, this.params.key)) {
      return {
        llmContent: `Key not found: ${this.params.key}`,
        returnDisplay: `Key not found: ${this.params.key}`,
      };
    }

    // Check if aborted before writing
    if (signal.aborted) {
      throw new Error('Operation cancelled');
    }

    delete store[this.params.key];
    await this.saveStore(store);

    return {
      llmContent: `Deleted "${this.params.key}"`,
      returnDisplay: `Deleted "${this.params.key}"`,
    };
  }

  private handleList(store: Record<string, string>): ToolResult {
    const keys = Object.keys(store).sort();
    if (keys.length === 0) {
      return {
        llmContent: 'No keys stored',
        returnDisplay: '0 keys',
      };
    }

    return {
      llmContent: keys.join('\n'),
      returnDisplay: `${keys.length} key${keys.length === 1 ? '' : 's'}`,
    };
  }

  /**
   * Load the store from disk with concurrent access safety
   * Returns a null-prototype object to avoid prototype pollution
   */
  private async loadStore(): Promise<Record<string, string>> {
    try {
      const content = await fs.readFile(this.storePath, 'utf-8');
      const parsed = JSON.parse(content);
      // Create a null-prototype object to avoid prototype pollution
      const store: Record<string, string> = Object.create(null);
      for (const key of Object.keys(parsed)) {
        store[key] = parsed[key];
      }
      return store;
    } catch (error) {
      // If file doesn't exist or is invalid, return empty null-prototype store
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return Object.create(null);
      }
      // For JSON parse errors, return empty null-prototype store
      if (error instanceof SyntaxError) {
        return Object.create(null);
      }
      throw error;
    }
  }

  /**
   * Save the store to disk with atomic write for concurrent access safety
   */
  private async saveStore(store: Record<string, string>): Promise<void> {
    // Ensure parent directory exists
    const dir = path.dirname(this.storePath);
    await fs.mkdir(dir, { recursive: true });

    // Write to a temp file first, then rename for atomic operation
    const tempPath = `${this.storePath}.tmp.${Date.now()}`;
    try {
      await fs.writeFile(tempPath, JSON.stringify(store, null, 2), 'utf-8');
      await fs.rename(tempPath, this.storePath);
    } catch (error) {
      // Clean up temp file if rename failed
      try {
        await fs.unlink(tempPath);
      } catch {
        // Ignore cleanup errors
      }
      throw error;
    }
  }
}
