import type {
  DeclarativeTool,
  ToolInvocation,
  ToolResult,
  ToolContext,
  ToolSchema,
  ToolCallConfirmationDetails,
} from './types.js';
import { ContextManager } from '../context/types.js';
import { HotSwapService } from '../context/HotSwapService.js';
import { PromptRegistry } from '../prompts/PromptRegistry.js';
import { ProviderAdapter } from '../provider/types.js';
import { PromptModeManager } from '../prompts/PromptModeManager.js';
import { SnapshotManager } from '../prompts/SnapshotManager.js';

export interface HotSwapParams {
  skills?: string[];
}

/**
 * Tool that allows the LLM to trigger a context hot swap.
 * This is useful for pivoting to a new specialty or clearing context while preserving state.
 * Automatically switches to developer mode when skills are provided.
 */
export class HotSwapTool implements DeclarativeTool<HotSwapParams, ToolResult> {
  name = 'trigger_hot_swap';
  displayName = 'Trigger Hot Swap';
  schema: ToolSchema = {
    name: 'trigger_hot_swap',
    description: 'Triggers a context hot swap to switch specialties or clear memory while preserving state. This will create a mode transition snapshot, summarize the current conversation, clear history to free context window, and switch to developer mode for implementation. The snapshot preserves recent context and findings for seamless mode restoration.',
    parameters: {
      type: 'object',
      properties: {
        skills: {
          type: 'array',
          items: {
            type: 'string'
          },
          description: 'The IDs of the skills to activate in the new context.',
        }
      }
    },
  };

  constructor(
    private manager: ContextManager,
    private promptRegistry: PromptRegistry,
    private provider: ProviderAdapter,
    private currentModel: string,
    private modeManager?: PromptModeManager,
    private snapshotManager?: SnapshotManager
  ) {}

  createInvocation(
    params: HotSwapParams,
    _context: ToolContext
  ): ToolInvocation<HotSwapParams, ToolResult> {
    return new HotSwapInvocation(
      params,
      this.manager,
      this.promptRegistry,
      this.provider,
      this.currentModel,
      this.modeManager,
      this.snapshotManager
    );
  }
}

export class HotSwapInvocation implements ToolInvocation<HotSwapParams, ToolResult> {
  constructor(
    public params: HotSwapParams,
    private manager: ContextManager,
    private promptRegistry: PromptRegistry,
    private provider: ProviderAdapter,
    private currentModel: string,
    private modeManager?: PromptModeManager,
    private snapshotManager?: SnapshotManager
  ) {}

  getDescription(): string {
    return `Triggering hot swap to skills: ${this.params.skills?.join(', ') || 'None'} (will switch to developer mode)`;
  }

  toolLocations(): string[] {
    return [];
  }

  async shouldConfirmExecute(
    _abortSignal: AbortSignal
  ): Promise<ToolCallConfirmationDetails | false> {
    return {
      toolName: 'trigger_hot_swap',
      description: `Trigger a context hot swap to skills: ${this.params.skills?.join(', ') || 'Standard'}. This will create a mode transition snapshot, clear your current conversation history, and switch to developer mode.`,
      risk: 'medium'
    };
  }

  async execute(
    _signal: AbortSignal,
    _updateOutput?: (output: string) => void
  ): Promise<ToolResult> {
    try {
      // Simplified parameter extraction
      let skills: string[] = [];
      
      if (Array.isArray(this.params.skills)) {
        skills = this.params.skills.map(String);
      } else if (typeof this.params.skills === 'string') {
        skills = [this.params.skills];
      } else if (this.params.skills !== undefined && this.params.skills !== null) {
        return {
          llmContent: '',
          returnDisplay: '',
          error: {
            message: 'skills parameter must be an array of strings or a single string',
            type: 'ValidationError',
          },
        };
      }

      const hotSwapService = new HotSwapService(
        this.manager,
        this.promptRegistry,
        this.provider,
        this.currentModel,
        this.modeManager,
        this.snapshotManager
      );

      await hotSwapService.swap(skills);

      // Build success message with mode and snapshot info
      let msg = `Hot swap completed successfully. `;
      
      if (this.modeManager && this.snapshotManager) {
        msg += `Mode transition snapshot created and stored. `;
      }
      
      msg += `Current active skills: ${skills.join(', ') || 'Standard'}. `;
      msg += `Context has been cleared and reseeded. `;
      msg += `Mode switched to developer for implementation.`;
      
      if (this.snapshotManager) {
        msg += ` Previous context can be restored when switching back from specialized modes.`;
      }
      
      return {
        llmContent: msg,
        returnDisplay: msg,
      };
    } catch (error) {
       const err = error as Error;
       return {
         llmContent: `Failed to hot swap: ${err.message}`,
         returnDisplay: `Error: ${err.message}`,
         error: {
           message: err.message,
           type: 'HotSwapError'
         }
       };
    }
  }
}
