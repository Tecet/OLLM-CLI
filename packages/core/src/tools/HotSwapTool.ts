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

export interface HotSwapParams {
  skills?: string[];
}

/**
 * Tool that allows the LLM to trigger a context hot swap.
 * This is useful for pivoting to a new specialty or clearing context while preserving state.
 */
export class HotSwapTool implements DeclarativeTool<HotSwapParams, ToolResult> {
  name = 'trigger_hot_swap';
  displayName = 'Trigger Hot Swap';
  schema: ToolSchema = {
    name: 'trigger_hot_swap',
    description: 'Triggers a context hot swap to switch specialties or clear memory while preserving state. This will summarize the current conversation and clear history to free context window.',
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
    private currentModel: string
  ) {}

  createInvocation(
    params: HotSwapParams,
    _context: ToolContext
  ): ToolInvocation<HotSwapParams, ToolResult> {
    return new HotSwapInvocation(params, this.manager, this.promptRegistry, this.provider, this.currentModel);
  }
}

export class HotSwapInvocation implements ToolInvocation<HotSwapParams, ToolResult> {
  constructor(
    public params: HotSwapParams,
    private manager: ContextManager,
    private promptRegistry: PromptRegistry,
    private provider: ProviderAdapter,
    private currentModel: string
  ) {}

  getDescription(): string {
    return `Triggering hot swap to skills: ${this.params.skills?.join(', ') || 'None'}`;
  }

  toolLocations(): string[] {
    return [];
  }

  async shouldConfirmExecute(
    _abortSignal: AbortSignal
  ): Promise<ToolCallConfirmationDetails | false> {
    return {
      toolName: 'trigger_hot_swap',
      description: `Trigger a context hot swap to skills: ${this.params.skills?.join(', ') || 'Standard'}. This will clear your current conversation history.`,
      risk: 'medium'
    };
  }

  async execute(
    _signal: AbortSignal,
    _updateOutput?: (output: string) => void
  ): Promise<ToolResult> {
    try {
      const rawSkills = this.params.skills;
      let skills: string[] = [];

      // Robust extraction helper
      const extractArray = (input: unknown): string[] => {
          if (Array.isArray(input)) return input.map(String);
          if (typeof input === 'object' && input !== null) {
              // Handle {"type": ["skill"]} or similar nested structures
              const values = Object.values(input as Record<string, unknown>);
              const firstArray = values.find(v => Array.isArray(v)) as string[] | undefined;
              if (firstArray) return firstArray.map(String);
          }
          return input ? [String(input)] : [];
      };

      if (typeof rawSkills === 'string') {
          try {
              const parsed = JSON.parse(rawSkills);
              skills = extractArray(parsed);
          } catch {
              skills = [rawSkills];
          }
      } else {
          skills = extractArray(rawSkills);
      }

      const hotSwapService = new HotSwapService(
        this.manager,
        this.promptRegistry,
        this.provider,
        this.currentModel
      );

      await hotSwapService.swap(skills);

      const msg = `Hot swap completed successfully. Current active skills: ${skills.join(', ') || 'Standard'}. Context has been cleared and reseeded.`;
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
