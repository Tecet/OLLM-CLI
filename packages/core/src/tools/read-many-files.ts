/**
 * Multiple file reading tool implementation
 * 
 * Provides a tool for reading multiple files at once with formatted output.
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
 * Parameters for reading multiple files
 */
export interface ReadManyFilesParams {
  /**
   * Array of file paths to read
   */
  paths: string[];

  /**
   * Starting line number for all files (1-indexed, inclusive)
   */
  startLine?: number;

  /**
   * Ending line number for all files (1-indexed, inclusive)
   */
  endLine?: number;
}

/**
 * Maximum file size in bytes (10 MB)
 */
const MAX_FILE_SIZE = 10 * 1024 * 1024;

/**
 * Tool for reading multiple files at once
 */
export class ReadManyFilesTool implements DeclarativeTool<ReadManyFilesParams, ToolResult> {
  name = 'read_many_files';
  displayName = 'Read Multiple Files';
  schema: ToolSchema = {
    name: 'read_many_files',
    description: 'Read multiple files at once',
    parameters: {
      type: 'object',
      properties: {
        paths: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of file paths to read',
        },
        startLine: {
          type: 'number',
          description: 'Starting line number for all files (1-indexed, inclusive)',
        },
        endLine: {
          type: 'number',
          description: 'Ending line number for all files (1-indexed, inclusive)',
        },
      },
      required: ['paths'],
    },
  };

  createInvocation(
    params: ReadManyFilesParams,
    context: ToolContext
  ): ToolInvocation<ReadManyFilesParams, ToolResult> {
    return new ReadManyFilesInvocation(params);
  }
}

/**
 * Invocation instance for reading multiple files
 */
export class ReadManyFilesInvocation implements ToolInvocation<ReadManyFilesParams, ToolResult> {
  constructor(
    public params: ReadManyFilesParams
  ) {}

  getDescription(): string {
    return `Read ${this.params.paths.length} files`;
  }

  toolLocations(): string[] {
    return this.params.paths;
  }

  async shouldConfirmExecute(abortSignal: AbortSignal): Promise<false> {
    // Read operations typically don't require confirmation
    return false;
  }

  async execute(
    signal: AbortSignal,
    updateOutput?: (output: string) => void
  ): Promise<ToolResult> {
    const results: string[] = [];
    let successCount = 0;
    let errorCount = 0;

    for (const filePath of this.params.paths) {
      // Check if aborted
      if (signal.aborted) {
        throw new Error('Operation cancelled');
      }

      try {
        // Resolve the path
        const resolvedPath = path.resolve(filePath);

        // Check file size
        const stats = await fs.stat(resolvedPath);
        if (stats.size > MAX_FILE_SIZE) {
          results.push(
            `=== ${filePath} ===\nError: File too large (${stats.size} bytes, max ${MAX_FILE_SIZE} bytes)\n`
          );
          errorCount++;
          continue;
        }

        // Check if it's a directory
        if (stats.isDirectory()) {
          results.push(`=== ${filePath} ===\nError: Path is a directory\n`);
          errorCount++;
          continue;
        }

        // Read file content
        const content = await fs.readFile(resolvedPath, 'utf-8');

        // Apply line range if specified
        let result = content;
        if (this.params.startLine !== undefined || this.params.endLine !== undefined) {
          const lines = content.split('\n');
          const start = (this.params.startLine ?? 1) - 1; // Convert to 0-indexed
          const end = this.params.endLine ?? lines.length;

          // Validate line range
          if (start < 0 || start >= lines.length) {
            results.push(
              `=== ${filePath} ===\nError: Invalid startLine: ${this.params.startLine} (file has ${lines.length} lines)\n`
            );
            errorCount++;
            continue;
          }

          if (end < start + 1) {
            results.push(
              `=== ${filePath} ===\nError: Invalid line range: endLine (${this.params.endLine}) must be >= startLine (${this.params.startLine})\n`
            );
            errorCount++;
            continue;
          }

          const selectedLines = lines.slice(start, end);
          result = selectedLines.join('\n');
        }

        results.push(`=== ${filePath} ===\n${result}\n`);
        successCount++;

        // Stream output if callback provided
        if (updateOutput) {
          updateOutput(results[results.length - 1]);
        }
      } catch (error) {
        // Handle specific error types
        let errorMessage: string;

        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
          errorMessage = 'File not found';
        } else if ((error as NodeJS.ErrnoException).code === 'EACCES') {
          errorMessage = 'Permission denied';
        } else if (
          (error as Error).message.includes('invalid') ||
          (error as Error).message.includes('decode')
        ) {
          errorMessage = 'File appears to be binary';
        } else {
          errorMessage = (error as Error).message;
        }

        results.push(`=== ${filePath} ===\nError: ${errorMessage}\n`);
        errorCount++;
      }
    }

    const combined = results.join('\n');

    return {
      llmContent: combined,
      returnDisplay: `Read ${successCount} files successfully${errorCount > 0 ? `, ${errorCount} errors` : ''}`,
    };
  }
}
