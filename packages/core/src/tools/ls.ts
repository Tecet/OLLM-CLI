/**
 * Ls tool implementation
 * 
 * Provides a tool for listing directory contents with support for
 * recursive listing, hidden file filtering, and depth control.
 */

import { promises as fs } from 'fs';
import * as path from 'path';

import { loadGitignore } from './gitignore-utils.js';

import type {
  DeclarativeTool,
  ToolInvocation,
  ToolResult,
  ToolContext,
  ToolSchema,
} from './types.js';
import type { Ignore } from 'ignore';

/**
 * Parameters for directory listing
 */
export interface LsParams {
  /**
   * Directory path to list
   */
  path: string;

  /**
   * Whether to list recursively
   */
  recursive?: boolean;

  /**
   * Whether to include hidden files
   */
  includeHidden?: boolean;

  /**
   * Maximum recursion depth
   */
  maxDepth?: number;
}

/**
 * Tool for listing directory contents
 */
export class LsTool implements DeclarativeTool<LsParams, ToolResult> {
  name = 'ls';
  displayName = 'List Directory';
  schema: ToolSchema = {
    name: 'ls',
    description: 'List directory contents',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Directory path',
        },
        recursive: {
          type: 'boolean',
          description: 'List recursively',
        },
        includeHidden: {
          type: 'boolean',
          description: 'Include hidden files',
        },
        maxDepth: {
          type: 'number',
          description: 'Maximum recursion depth',
        },
      },
      required: ['path'],
    },
  };

  createInvocation(
    params: LsParams,
    _context: ToolContext
  ): ToolInvocation<LsParams, ToolResult> {
    return new LsInvocation(params);
  }
}

/**
 * Invocation instance for directory listing
 */
export class LsInvocation implements ToolInvocation<LsParams, ToolResult> {
  constructor(
    public params: LsParams
  ) {}

  getDescription(): string {
    return `List ${this.params.path}`;
  }

  toolLocations(): string[] {
    return [this.params.path];
  }

  async shouldConfirmExecute(_abortSignal: AbortSignal): Promise<false> {
    // Read-only operations don't require confirmation
    return false;
  }

  async execute(
    signal: AbortSignal,
    _updateOutput?: (output: string) => void
  ): Promise<ToolResult> {
    try {
      // Check if aborted
      if (signal.aborted) {
        return {
          llmContent: '',
          returnDisplay: '',
          error: {
            message: 'Directory listing cancelled',
            type: 'CancelledError',
          },
        };
      }

      // Load .gitignore patterns
      const ig = await loadGitignore(this.params.path);

      const maxDepth = this.params.maxDepth ?? (this.params.recursive ? 3 : 0);
      const entries = await this.listDirectory(
        this.params.path,
        0,
        maxDepth,
        signal,
        ig,
        this.params.path // Pass base directory for relative path calculation
      );

      const result = entries.join('\n');

      return {
        llmContent: result,
        returnDisplay: `Listed ${entries.length} entr${entries.length === 1 ? 'y' : 'ies'}`,
      };
    } catch (error) {
      const err = error as NodeJS.ErrnoException;
      let errorType = 'LsError';
      let errorMessage = err.message;

      // Provide specific error types for common cases
      if (err.code === 'ENOENT') {
        errorType = 'DirectoryNotFoundError';
        errorMessage = `Directory not found: ${this.params.path}`;
      } else if (err.code === 'EACCES' || err.code === 'EPERM') {
        errorType = 'PermissionError';
        errorMessage = `Permission denied: ${this.params.path}`;
      } else if (err.code === 'ENOTDIR') {
        errorType = 'NotADirectoryError';
        errorMessage = `Not a directory: ${this.params.path}`;
      } else if (errorMessage.includes('cancelled')) {
        errorType = 'CancelledError';
      }

      return {
        llmContent: '',
        returnDisplay: '',
        error: {
          message: errorMessage,
          type: errorType,
        },
      };
    }
  }

  private async listDirectory(
    dir: string,
    depth: number,
    maxDepth: number,
    signal: AbortSignal,
    ig: Ignore | null,
    baseDir: string
  ): Promise<string[]> {
    // Check if aborted
    if (signal.aborted) {
      throw new Error('Directory listing cancelled');
    }

    const entries: string[] = [];
    const items = await fs.readdir(dir, { withFileTypes: true });

    for (const item of items) {
      // Skip hidden files unless requested
      if (!this.params.includeHidden && item.name.startsWith('.')) {
        continue;
      }

      // Check if this item should be ignored by .gitignore
      if (ig) {
        const itemPath = path.join(dir, item.name);
        const relativePath = path.relative(baseDir, itemPath);
        // Normalize path separators to forward slashes
        const normalizedPath = relativePath.replace(/\\/g, '/');
        
        // For directories, check with trailing slash
        const pathToCheck = item.isDirectory() 
          ? normalizedPath + '/'
          : normalizedPath;
        
        if (ig.ignores(pathToCheck)) {
          continue;
        }
      }

      const indent = '  '.repeat(depth);
      const prefix = item.isDirectory() ? 'd' : '-';
      entries.push(`${indent}${prefix} ${item.name}`);

      // Recurse into directories
      if (item.isDirectory() && depth < maxDepth) {
        const subPath = path.join(dir, item.name);
        try {
          const subEntries = await this.listDirectory(
            subPath,
            depth + 1,
            maxDepth,
            signal,
            ig,
            baseDir
          );
          entries.push(...subEntries);
        } catch (_error) {
          // Skip directories that can't be read (permission errors, etc.)
          continue;
        }
      }
    }

    return entries;
  }
}
