/**
 * Grep tool implementation
 * 
 * Provides a tool for searching file contents with pattern matching,
 * case sensitivity control, and file pattern filtering.
 */

import { promises as fs } from 'fs';
import * as path from 'path';
import { glob as globSearch } from 'glob';
import { loadGitignore } from './gitignore-utils.js';
import type {
  DeclarativeTool,
  ToolInvocation,
  ToolResult,
  ToolContext,
  ToolSchema,
} from './types.js';

/**
 * Parameters for grep search
 */
export interface GrepParams {
  /**
   * Search pattern (regex)
   */
  pattern: string;

  /**
   * Directory to search (defaults to current directory)
   */
  directory?: string;

  /**
   * File pattern to search in (glob pattern)
   */
  filePattern?: string;

  /**
   * Whether to perform case-sensitive matching
   */
  caseSensitive?: boolean;

  /**
   * Maximum number of results to return
   */
  maxResults?: number;
}

/**
 * Tool for searching file contents
 */
export class GrepTool implements DeclarativeTool<GrepParams, ToolResult> {
  name = 'grep';
  displayName = 'Search File Contents';
  schema: ToolSchema = {
    name: 'grep',
    description: 'Search for pattern in file contents',
    parameters: {
      type: 'object',
      properties: {
        pattern: {
          type: 'string',
          description: 'Search pattern (regex)',
        },
        directory: {
          type: 'string',
          description: 'Directory to search',
        },
        filePattern: {
          type: 'string',
          description: 'File pattern to search in',
        },
        caseSensitive: {
          type: 'boolean',
          description: 'Case sensitive search',
        },
        maxResults: {
          type: 'number',
          description: 'Maximum results',
        },
      },
      required: ['pattern'],
    },
  };

  createInvocation(
    params: GrepParams,
    context: ToolContext
  ): ToolInvocation<GrepParams, ToolResult> {
    return new GrepInvocation(params);
  }
}

/**
 * Invocation instance for grep search
 */
export class GrepInvocation implements ToolInvocation<GrepParams, ToolResult> {
  constructor(
    public params: GrepParams
  ) {}

  getDescription(): string {
    return `Search for "${this.params.pattern}"`;
  }

  toolLocations(): string[] {
    return [this.params.directory ?? '.'];
  }

  async shouldConfirmExecute(abortSignal: AbortSignal): Promise<false> {
    // Read-only operations don't require confirmation
    return false;
  }

  async execute(
    signal: AbortSignal,
    updateOutput?: (output: string) => void
  ): Promise<ToolResult> {
    try {
      // Check if aborted
      if (signal.aborted) {
        throw new Error('Operation cancelled');
      }

      const cwd = this.params.directory ?? process.cwd();
      const flags = this.params.caseSensitive ? 'g' : 'gi';

      // Load .gitignore patterns
      const ig = await loadGitignore(cwd);

      // Find files to search
      const filePattern = this.params.filePattern ?? '**/*';
      const files = await globSearch(filePattern, {
        cwd,
        ignore: ['**/node_modules/**', '**/.git/**'],
        nodir: true,
      });

      // Check if aborted after finding files
      if (signal.aborted) {
        throw new Error('Operation cancelled');
      }

      // Filter out gitignored files
      let filesToSearch = files;
      if (ig) {
        filesToSearch = files.filter((file) => {
          // Normalize path separators to forward slashes
          const normalizedPath = file.replace(/\\/g, '/');
          return !ig.ignores(normalizedPath);
        });
      }

      const results: string[] = [];
      let count = 0;

      for (const file of filesToSearch) {
        if (this.params.maxResults && count >= this.params.maxResults) {
          break;
        }

        // Check if aborted during search
        if (signal.aborted) {
          throw new Error('Operation cancelled');
        }

        const filePath = path.join(cwd, file);
        
        try {
          const content = await fs.readFile(filePath, 'utf-8');
          const lines = content.split('\n');

          for (let i = 0; i < lines.length; i++) {
            // Create a new regex for each line to avoid state issues with global flag
            const regex = new RegExp(this.params.pattern, flags);
            if (regex.test(lines[i])) {
              results.push(`${file}:${i + 1}: ${lines[i]}`);
              count++;

              if (this.params.maxResults && count >= this.params.maxResults) {
                break;
              }
            }
          }
        } catch (error) {
          // Skip files that can't be read (binary files, permission errors, etc.)
          continue;
        }
      }

      const result = results.join('\n');

      return {
        llmContent: result,
        returnDisplay: `Found ${count} match${count === 1 ? '' : 'es'}`,
      };
    } catch (error) {
      return {
        llmContent: '',
        returnDisplay: '',
        error: {
          message: (error as Error).message,
          type: 'GrepError',
        },
      };
    }
  }
}
