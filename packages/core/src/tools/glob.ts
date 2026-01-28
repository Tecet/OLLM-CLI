/**
 * Glob tool implementation
 *
 * Provides a tool for finding files matching glob patterns with support for
 * hidden file filtering, result limits, and .gitignore respect.
 */

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
 * Parameters for glob search
 */
export interface GlobParams {
  /**
   * Glob pattern to match (e.g., star-star-slash-star.ts)
   */
  pattern: string;

  /**
   * Base directory for search (defaults to current directory)
   */
  directory?: string;

  /**
   * Maximum number of results to return
   */
  maxResults?: number;

  /**
   * Whether to include hidden files and directories
   */
  includeHidden?: boolean;
}

/**
 * Tool for finding files by glob pattern
 */
export class GlobTool implements DeclarativeTool<GlobParams, ToolResult> {
  name = 'glob';
  displayName = 'Find Files by Pattern';
  schema: ToolSchema = {
    name: 'glob',
    description: 'Find files matching a glob pattern',
    parameters: {
      type: 'object',
      properties: {
        pattern: {
          type: 'string',
          description: 'Glob pattern (e.g., star-star-slash-star.ts)',
        },
        directory: {
          type: 'string',
          description: 'Base directory for search',
        },
        maxResults: {
          type: 'number',
          description: 'Maximum number of results',
        },
        includeHidden: {
          type: 'boolean',
          description: 'Include hidden files and directories',
        },
      },
      required: ['pattern'],
    },
  };

  createInvocation(
    params: GlobParams,
    _context: ToolContext
  ): ToolInvocation<GlobParams, ToolResult> {
    return new GlobInvocation(params);
  }
}

/**
 * Invocation instance for glob search
 */
export class GlobInvocation implements ToolInvocation<GlobParams, ToolResult> {
  constructor(public params: GlobParams) {}

  getDescription(): string {
    return `Find files matching ${this.params.pattern}`;
  }

  toolLocations(): string[] {
    return [this.params.directory ?? '.'];
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
            message: 'Glob search cancelled',
            type: 'CancelledError',
          },
        };
      }

      const cwd = this.params.directory ?? process.cwd();

      // Load .gitignore patterns
      const ig = await loadGitignore(cwd);

      // Perform glob search
      const matches = await globSearch(this.params.pattern, {
        cwd,
        dot: this.params.includeHidden ?? false,
        ignore: ['**/node_modules/**', '**/.git/**'],
        nodir: true, // Only return files, not directories
      });

      // Check if aborted after search
      if (signal.aborted) {
        return {
          llmContent: '',
          returnDisplay: '',
          error: {
            message: 'Glob search cancelled',
            type: 'CancelledError',
          },
        };
      }

      // Filter out gitignored files
      let filteredMatches = matches;
      if (ig) {
        filteredMatches = matches.filter((file) => {
          // Normalize path separators to forward slashes
          const normalizedPath = file.replace(/\\/g, '/');
          return !ig.ignores(normalizedPath);
        });
      }

      // Apply maxResults limit if specified
      const limited =
        this.params.maxResults !== undefined && this.params.maxResults >= 0
          ? filteredMatches.slice(0, this.params.maxResults)
          : filteredMatches;

      // Format results
      const result = limited.join('\n');

      const displayMessage =
        limited.length === 0
          ? 'No files found'
          : filteredMatches.length > limited.length
            ? `Found ${limited.length} files (showing first ${limited.length} of ${filteredMatches.length})`
            : `Found ${limited.length} file${limited.length === 1 ? '' : 's'}`;

      return {
        llmContent: result,
        returnDisplay: displayMessage,
      };
    } catch (error) {
      const errorMessage = (error as Error).message;
      return {
        llmContent: '',
        returnDisplay: '',
        error: {
          message: errorMessage,
          type: errorMessage.includes('cancelled') ? 'CancelledError' : 'GlobError',
        },
      };
    }
  }
}
