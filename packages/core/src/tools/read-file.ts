/**
 * File reading tool implementation
 * 
 * Provides tools for reading file contents with optional line range support.
 * Handles encoding detection, size limits, and binary file detection.
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
 * Parameters for reading a single file
 */
export interface ReadFileParams {
  /**
   * Path to the file to read
   */
  path: string;

  /**
   * Starting line number (1-indexed, inclusive)
   */
  startLine?: number;

  /**
   * Ending line number (1-indexed, inclusive)
   */
  endLine?: number;
}

/**
 * Maximum file size in bytes (10 MB)
 */
const MAX_FILE_SIZE = 10 * 1024 * 1024;

/**
 * Tool for reading file contents with optional line range
 */
export class ReadFileTool implements DeclarativeTool<ReadFileParams, ToolResult> {
  name = 'read_file';
  displayName = 'Read File';
  schema: ToolSchema = {
    name: 'read_file',
    description: 'Read file content with optional line range',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'File path to read',
        },
        startLine: {
          type: 'number',
          description: 'Starting line number (1-indexed, inclusive)',
        },
        endLine: {
          type: 'number',
          description: 'Ending line number (1-indexed, inclusive)',
        },
      },
      required: ['path'],
    },
  };

  createInvocation(
    params: ReadFileParams,
    context: ToolContext
  ): ToolInvocation<ReadFileParams, ToolResult> {
    return new ReadFileInvocation(params);
  }
}

/**
 * Invocation instance for reading a file
 */
export class ReadFileInvocation implements ToolInvocation<ReadFileParams, ToolResult> {
  constructor(
    public params: ReadFileParams
  ) {}

  getDescription(): string {
    const range =
      this.params.startLine || this.params.endLine
        ? ` (lines ${this.params.startLine ?? 1}-${this.params.endLine ?? 'end'})`
        : '';
    return `Read ${this.params.path}${range}`;
  }

  toolLocations(): string[] {
    return [this.params.path];
  }

  async shouldConfirmExecute(abortSignal: AbortSignal): Promise<false> {
    // Read operations typically don't require confirmation
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

      // Resolve the path
      const resolvedPath = path.resolve(this.params.path);

      // Check file size
      const stats = await fs.stat(resolvedPath);
      if (stats.size > MAX_FILE_SIZE) {
        return {
          llmContent: '',
          returnDisplay: '',
          error: {
            message: `File too large: ${stats.size} bytes (max ${MAX_FILE_SIZE} bytes)`,
            type: 'FileTooLargeError',
          },
        };
      }

      // Check if it's a directory
      if (stats.isDirectory()) {
        return {
          llmContent: '',
          returnDisplay: '',
          error: {
            message: `Path is a directory: ${this.params.path}`,
            type: 'IsDirectoryError',
          },
        };
      }

      // Read file content
      const content = await fs.readFile(resolvedPath, 'utf-8');

      // Check if aborted after reading
      if (signal.aborted) {
        throw new Error('Operation cancelled');
      }

      // Apply line range if specified
      let result = content;
      if (this.params.startLine !== undefined || this.params.endLine !== undefined) {
        const lines = content.split('\n');
        const start = (this.params.startLine ?? 1) - 1; // Convert to 0-indexed
        const end = this.params.endLine ?? lines.length;

        // Validate line range
        if (start < 0 || start >= lines.length) {
          return {
            llmContent: '',
            returnDisplay: '',
            error: {
              message: `Invalid startLine: ${this.params.startLine} (file has ${lines.length} lines)`,
              type: 'InvalidLineRangeError',
            },
          };
        }

        if (end < start + 1) {
          return {
            llmContent: '',
            returnDisplay: '',
            error: {
              message: `Invalid line range: endLine (${this.params.endLine}) must be >= startLine (${this.params.startLine})`,
              type: 'InvalidLineRangeError',
            },
          };
        }

        const selectedLines = lines.slice(start, end);
        result = selectedLines.join('\n');
      }

      return {
        llmContent: result,
        returnDisplay: result,
      };
    } catch (error) {
      // Handle specific error types
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return {
          llmContent: '',
          returnDisplay: '',
          error: {
            message: `File not found: ${this.params.path}`,
            type: 'FileNotFoundError',
          },
        };
      }

      if ((error as NodeJS.ErrnoException).code === 'EACCES') {
        return {
          llmContent: '',
          returnDisplay: '',
          error: {
            message: `Permission denied: ${this.params.path}`,
            type: 'PermissionError',
          },
        };
      }

      // Check for binary file error (invalid UTF-8)
      if ((error as Error).message.includes('invalid') || 
          (error as Error).message.includes('decode')) {
        return {
          llmContent: '',
          returnDisplay: '',
          error: {
            message: `File appears to be binary: ${this.params.path}`,
            type: 'BinaryFileError',
          },
        };
      }

      // Generic error
      return {
        llmContent: '',
        returnDisplay: '',
        error: {
          message: (error as Error).message,
          type: 'FileReadError',
        },
      };
    }
  }
}
