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
import { SnapshotManager } from '../prompts/modeSnapshotManager.js';

export interface HotSwapParams {
  skills?: string[];
  [key: string]: unknown;
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
    description: 'Triggers a context hot swap to switch specialties or add skills. By default, this preserves your conversation history. Set preserveHistory=false only if you explicitly want to clear memory for a fresh start. CRITICAL: ONLY use this tool if the user EXPLICITLY asks to switch modes (e.g. "switch to developer mode") or add/change skills.',
    parameters: {
      type: 'object',
      properties: {
        skills: {
          type: 'array',
          items: {
            type: 'string'
          },
          description: 'The IDs of the skills to activate in the new context.',
        },
        preserveHistory: {
          type: 'boolean',
          description: 'Whether to preserve the current conversation history. Defaults to true. Set to false for a clean slate.',
          default: true
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
    const preserve = this.params.preserveHistory !== false;
    return {
      toolName: 'trigger_hot_swap',
      description: `Switching to skills: ${this.params.skills?.join(', ') || 'Standard'}${preserve ? ' (Preserving history)' : ' (Clearing history!)'}. This moves you to developer mode.`,
      risk: preserve ? 'low' : 'medium'
    };
  }

  async execute(
    _signal: AbortSignal,
    _updateOutput?: (output: string) => void
  ): Promise<ToolResult> {
    try {
      const currentMode = this.modeManager?.getCurrentMode();
      
      // Heuristic Safety Guard for Assistant Context
      if (currentMode === 'assistant') {
          const history = await this.manager.getMessages();
          const lastUserMsg = [...history].reverse().find(m => m.role === 'user');
          const content = lastUserMsg?.content?.trim().toLowerCase() || '';
          
          const commonGreetings = ['hi', 'hello', 'hey', 'yo', 'good morning', 'good afternoon', 'good evening'];
          const isGreeting = commonGreetings.includes(content) || (content.length < 10 && !content.includes('mode') && !content.includes('switch'));
          
          if (isGreeting) {
              return {
                 llmContent: `Hot swap ignored. I detected a simple greeting or very short message. I should only trigger a hot swap when the user explicitly asks to switch specialties or modes.`,
                 returnDisplay: `Refused: Hot swap ignored for simple greeting to prevent loop.`,
                 error: {
                     message: `Hot swap heuristic guard triggered.`,
                     type: "GuardRefusal"
                 }
              };
          }
      }

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

      const preserveHistory = this.params.preserveHistory !== false;

      const hotSwapService = new HotSwapService(
        this.manager,
        this.promptRegistry,
        this.provider,
        this.currentModel,
        this.modeManager,
        this.snapshotManager
      );

      // This tool explicitly switches to developer mode when invoked by the LLM
      await hotSwapService.swap(skills, preserveHistory, 'developer');

      // Build success message with mode and snapshot info
      let msg = `Hot swap completed successfully. `;
      if (this.modeManager && this.snapshotManager) {
        msg += `Mode transition snapshot created and stored. `;
      }
      msg += `Current active skills: ${skills.join(', ') || 'Standard'}. `;
      if (preserveHistory) {
        msg += `Conversation history has been preserved. `;
      } else {
        msg += `Context has been cleared and reseeded from snapshot. `;
      }
      msg += `Mode switched to developer for implementation.`;

      return {
        llmContent: msg,
        returnDisplay: msg
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
