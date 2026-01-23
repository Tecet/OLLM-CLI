/**
 * File editing tool implementation
 * 
 * Provides a tool for applying targeted edits to files with validation
 * for target uniqueness and existence.
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
 * A single edit operation
 */
export interface EditOperation {
  /**
   * Text to find in the file
   */
  target: string;

  /**
   * Text to replace the target with
   */
  replacement: string;

  /**
   * Optional line number hint for disambiguation
   */
  lineHint?: number;
}

/**
 * Parameters for editing a file
 */
export interface EditFileParams {
  /**
   * Path to the file to edit
   */
  path: string;

  /**
   * Array of edit operations to apply
   */
  edits: EditOperation[];
}

/**
 * Tool for applying targeted edits to files
 */
export class EditFileTool implements DeclarativeTool<EditFileParams, ToolResult> {
  name = 'edit_file';
  displayName = 'Edit File';
  schema: ToolSchema = {
    name: 'edit_file',
    description: 'Apply targeted edits to a file',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'File path to edit',
        },
        edits: {
          type: 'array',
          description: 'Array of edit operations',
          items: {
            type: 'object',
            properties: {
              target: {
                type: 'string',
                description: 'Text to find',
              },
              replacement: {
                type: 'string',
                description: 'Text to replace with',
              },
              lineHint: {
                type: 'number',
                description: 'Optional line number hint',
              },
            },
            required: ['target', 'replacement'],
          },
        },
      },
      required: ['path', 'edits'],
    },
  };

  createInvocation(
    params: EditFileParams,
    context: ToolContext
  ): ToolInvocation<EditFileParams, ToolResult> {
    return new EditFileInvocation(params, context.messageBus, context.policyEngine);
  }
}

/**
 * Invocation instance for editing a file
 */
export class EditFileInvocation implements ToolInvocation<EditFileParams, ToolResult> {
  constructor(
    public params: EditFileParams,
    private messageBus: MessageBus,
    private policyEngine?: PolicyEngineInterface
  ) {}

  getDescription(): string {
    return `Edit ${this.params.path} (${this.params.edits.length} edit${this.params.edits.length === 1 ? '' : 's'})`;
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

    const decision = this.policyEngine.evaluate('edit_file', this.params as unknown as Record<string, unknown>);

    if (decision === 'allow') {
      return false;
    }

    if (decision === 'deny') {
      throw new Error('Edit operation denied by policy');
    }

    // Ask for confirmation
    const risk = this.policyEngine.getRiskLevel('edit_file');
    return {
      toolName: 'edit_file',
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

      // Read the file
      let content: string;
      try {
        content = await fs.readFile(resolvedPath, 'utf-8');
      } catch (error) {
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
        throw error;
      }

      // Check if aborted after reading
      if (signal.aborted) {
        throw new Error('Operation cancelled');
      }

      // Validate all edits before applying any
      for (let i = 0; i < this.params.edits.length; i++) {
        const edit = this.params.edits[i];

        // Count occurrences using simple string search (not regex)
        const occurrences = this.countOccurrences(content, edit.target);

        if (occurrences === 0) {
          return {
            llmContent: '',
            returnDisplay: '',
            error: {
              message: `Target text not found: "${edit.target}"`,
              type: 'EditTargetNotFound',
            },
          };
        }

        if (occurrences > 1) {
          return {
            llmContent: '',
            returnDisplay: '',
            error: {
              message: `Target text is ambiguous (${occurrences} matches): "${edit.target}"`,
              type: 'EditTargetAmbiguous',
            },
          };
        }
      }

      // Apply all edits (we've validated they all exist and are unique)
      for (let i = 0; i < this.params.edits.length; i++) {
        const edit = this.params.edits[i];
        content = content.replace(edit.target, edit.replacement);

        // Check if aborted between edits
        if (signal.aborted) {
          throw new Error('Operation cancelled');
        }
      }

      // Write to temp file first for atomic operation
      const tempPath = `${resolvedPath}.tmp.${Date.now()}`;
      try {
        await fs.writeFile(tempPath, content, 'utf-8');
        await fs.rename(tempPath, resolvedPath);
      } catch (error) {
        // Clean up temp file if rename failed
        try {
          await fs.unlink(tempPath);
        } catch {
          // Ignore cleanup errors
        }
        throw error;
      }

      const message = `Successfully applied ${this.params.edits.length} edit${this.params.edits.length === 1 ? '' : 's'} to ${this.params.path}`;

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

      // Generic error
      return {
        llmContent: '',
        returnDisplay: '',
        error: {
          message: (error as Error).message,
          type: 'FileEditError',
        },
      };
    }
  }

  /**
   * Count occurrences of a substring in a string
   */
  private countOccurrences(content: string, target: string): number {
    let count = 0;
    let pos = 0;
    while ((pos = content.indexOf(target, pos)) !== -1) {
      count++;
      pos += target.length;
    }
    return count;
  }
}
