/**
 * File writing tool implementation
 * 
 * Provides a tool for writing content to files with overwrite protection
 * and automatic parent directory creation.
 */

import { promises as fs } from 'fs';
import * as path from 'path';

import type {
  DeclarativeTool,
  ToolInvocation,
  ToolResult,
  ToolContext,
  ToolSchema,
  ToolCallConfirmationDetails,
  PolicyEngineInterface,
  MessageBus,
} from './types.js';

/**
 * Parameters for writing a file
 */
export interface WriteFileParams {
  /**
   * Path to the file to write
   */
  path: string;

  /**
   * Content to write to the file
   */
  content: string;

  /**
   * Whether to overwrite an existing file
   */
  overwrite?: boolean;
}

/**
 * Tool for writing content to files
 */
export class WriteFileTool implements DeclarativeTool<WriteFileParams, ToolResult> {
  name = 'write_file';
  displayName = 'Write File';
  schema: ToolSchema = {
    name: 'write_file',
    description: 'Write content to a file',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'File path to write',
        },
        content: {
          type: 'string',
          description: 'Content to write to the file',
        },
        overwrite: {
          type: 'boolean',
          description: 'Allow overwriting existing file (default: false)',
        },
      },
      required: ['path', 'content'],
    },
  };

  createInvocation(
    params: WriteFileParams,
    context: ToolContext
  ): ToolInvocation<WriteFileParams, ToolResult> {
    return new WriteFileInvocation(params, context.messageBus, context.policyEngine);
  }
}

/**
 * Invocation instance for writing a file
 */
export class WriteFileInvocation implements ToolInvocation<WriteFileParams, ToolResult> {
  constructor(
    public params: WriteFileParams,
    private messageBus: MessageBus,
    private policyEngine?: PolicyEngineInterface
  ) {}

  getDescription(): string {
    return `Write to ${this.params.path}`;
  }

  toolLocations(): string[] {
    return [this.params.path];
  }

  async shouldConfirmExecute(
    _abortSignal: AbortSignal
  ): Promise<ToolCallConfirmationDetails | false> {
    // If no policy engine, don't require confirmation
    if (!this.policyEngine) {
      return false;
    }

    const decision = this.policyEngine.evaluate('write_file', this.params as unknown as Record<string, unknown>);

    if (decision === 'allow') {
      return false;
    }

    if (decision === 'deny') {
      // Return confirmation details that will be used to show denial
      // The caller should check the decision and handle denial appropriately
      throw new Error('Write operation denied by policy');
    }

    // Ask for confirmation
    const risk = this.policyEngine.getRiskLevel('write_file');
    return {
      toolName: 'write_file',
      description: this.getDescription(),
      risk,
      locations: this.toolLocations(),
    };
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

      // Resolve the path
      const resolvedPath = path.resolve(this.params.path);

      // Validate content size (10MB limit)
      const MAX_WRITE_SIZE = 10 * 1024 * 1024;
      if (this.params.content.length > MAX_WRITE_SIZE) {
        return {
          llmContent: '',
          returnDisplay: '',
          error: {
            message: `Content too large: ${this.params.content.length} bytes (max ${MAX_WRITE_SIZE} bytes)`,
            type: 'ContentTooLargeError',
          },
        };
      }

      // Check if path is a directory
      try {
        const stats = await fs.stat(resolvedPath);
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
      } catch (error) {
        // File doesn't exist, which is fine for new files
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
          throw error;
        }
      }

      // Create parent directories if they don't exist
      const dir = path.dirname(resolvedPath);
      await fs.mkdir(dir, { recursive: true });

      // Check if aborted before writing
      if (signal.aborted) {
        throw new Error('Operation cancelled');
      }

      // Use atomic write operation
      let exists = false;
      try {
        if (!this.params.overwrite) {
          // Use 'wx' flag for atomic create-only operation
          await fs.writeFile(resolvedPath, this.params.content, { 
            encoding: 'utf-8',
            flag: 'wx' // Fail if file exists
          });
        } else {
          // Check if file exists for message
          try {
            await fs.access(resolvedPath);
            exists = true;
          } catch {
            exists = false;
          }
          // Overwrite mode - write normally
          await fs.writeFile(resolvedPath, this.params.content, 'utf-8');
        }
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
          return {
            llmContent: '',
            returnDisplay: '',
            error: {
              message: `File ${this.params.path} already exists. Set overwrite=true to replace it.`,
              type: 'FileExistsError',
            },
          };
        }
        throw error;
      }

      const action = exists ? 'Updated' : 'Created';
      const message = `${action} ${this.params.path} (${this.params.content.length} characters)`;

      return {
        llmContent: message,
        returnDisplay: message,
      };
    } catch (error) {
      // Handle specific error types
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

      if ((error as NodeJS.ErrnoException).code === 'EISDIR') {
        return {
          llmContent: '',
          returnDisplay: '',
          error: {
            message: `Path is a directory: ${this.params.path}`,
            type: 'IsDirectoryError',
          },
        };
      }

      // Generic error
      return {
        llmContent: '',
        returnDisplay: '',
        error: {
          message: (error as Error).message,
          type: 'FileWriteError',
        },
      };
    }
  }
}
