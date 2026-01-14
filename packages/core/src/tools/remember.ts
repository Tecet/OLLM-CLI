/**
 * Remember tool implementation for LLM-initiated memory storage
 * Feature: stage-07-model-management
 *
 * Provides LLMs with the ability to store important information as memories
 * that persist across sessions. Integrates with MemoryService.
 */

import type {
  DeclarativeTool,
  ToolInvocation,
  ToolResult,
  ToolContext,
  ToolSchema,
} from './types.js';
import type { MemoryService, MemoryCategory } from '../services/memoryService.js';

/**
 * Parameters for remember tool
 */
export interface RememberParams {
  /**
   * Key name for the memory
   */
  key: string;

  /**
   * Value to remember
   */
  value: string;

  /**
   * Category of memory (optional)
   */
  category?: MemoryCategory;
}

/**
 * Tool for LLM-initiated memory storage
 */
export class RememberTool implements DeclarativeTool<RememberParams, ToolResult> {
  name = 'remember';
  displayName = 'Remember Information';
  schema: ToolSchema = {
    name: 'remember',
    description:
      'Store important information as a memory that persists across sessions. Use this to remember facts, preferences, or context that should be available in future conversations.',
    parameters: {
      type: 'object',
      properties: {
        key: {
          type: 'string',
          description: 'A unique identifier for this memory (e.g., "user_name", "project_type")',
        },
        value: {
          type: 'string',
          description: 'The information to remember',
        },
        category: {
          type: 'string',
          enum: ['fact', 'preference', 'context'],
          description:
            'Category of memory: fact (objective information), preference (user preferences), context (situational information)',
        },
      },
      required: ['key', 'value'],
    },
  };

  constructor(private memoryService: MemoryService) {}

  createInvocation(
    params: RememberParams,
    context: ToolContext
  ): ToolInvocation<RememberParams, ToolResult> {
    return new RememberInvocation(params, this.memoryService);
  }
}

/**
 * Invocation instance for remember operations
 */
export class RememberInvocation implements ToolInvocation<RememberParams, ToolResult> {
  constructor(
    public params: RememberParams,
    private memoryService: MemoryService
  ) {}

  getDescription(): string {
    return `Remember "${this.params.key}": ${this.params.value}`;
  }

  toolLocations(): string[] {
    return [];
  }

  async shouldConfirmExecute(abortSignal: AbortSignal): Promise<false> {
    // Remember operations don't require confirmation
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

      // Store memory with 'llm' source
      this.memoryService.remember(this.params.key, this.params.value, {
        category: this.params.category || 'context',
        source: 'llm',
      });

      // Save to disk
      await this.memoryService.save();

      const categoryInfo = this.params.category ? ` (${this.params.category})` : '';
      return {
        llmContent: `Remembered "${this.params.key}"${categoryInfo}`,
        returnDisplay: `Remembered "${this.params.key}"${categoryInfo}`,
      };
    } catch (error) {
      return {
        llmContent: '',
        returnDisplay: '',
        error: {
          message: (error as Error).message,
          type: 'RememberError',
        },
      };
    }
  }
}
