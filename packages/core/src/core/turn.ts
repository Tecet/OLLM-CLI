/**
 * Turn management for conversation cycles.
 * A turn represents a single conversation cycle including model response and tool executions.
 */

import type {
  Message,
  ProviderAdapter,
  ProviderRequest,
  ToolCall,
  GenerationOptions,
} from '../provider/types.js';
import type { PromptModeManager } from '../prompts/PromptModeManager.js';
import type { SnapshotManager } from '../prompts/SnapshotManager.js';
import type { ModeType } from '../prompts/ContextAnalyzer.js';
import type { DeclarativeTool } from '../tools/types.js';

const isTestEnv = process.env.NODE_ENV === 'test' || !!process.env.VITEST;

/**
 * Minimal ToolRegistry interface for tool execution.
 */
export interface ToolRegistry {
  get(name: string): DeclarativeTool<unknown, unknown> | undefined;
}

/**
 * Minimal Tool interface for execution.
 */
export interface Tool {
  execute(args: Record<string, unknown>): Promise<unknown>;
}

/**
 * Options for a chat turn.
 */
export interface ChatOptions {
  model?: string;
  provider?: string;
  systemPrompt?: string;
  tools?: Array<{ name: string; description?: string; parameters?: Record<string, unknown> }>;
  temperature?: number;
  maxTokens?: number;
  maxTurns?: number;
  contextSize?: number; // User's selected context size (for UI display)
  ollamaContextSize?: number; // Actual size to send to Ollama (85% of contextSize)
  abortSignal?: AbortSignal;
  modeManager?: PromptModeManager;
  snapshotManager?: SnapshotManager;
  useModeLinkedTemperature?: boolean;
}

/**
 * Events emitted during a turn.
 */
export type TurnEvent =
  | { type: 'text'; value: string }
  | { type: 'tool_call'; toolCall: ToolCall }
  | { type: 'tool_result'; toolCall: ToolCall; result: unknown }
  | { type: 'error'; error: Error };

/**
 * Manages a single conversation turn.
 * Handles streaming from provider, tool call queuing, and parallel tool execution.
 */
export class Turn {
  private toolCallQueue: ToolCall[] = [];
  private accumulatedText: string = '';
  private modeManager?: PromptModeManager;
  private snapshotManager?: SnapshotManager;
  private modeBeforeToolExecution?: ModeType;

  constructor(
    private provider: ProviderAdapter,
    private toolRegistry: ToolRegistry,
    private messages: Message[],
    private options?: ChatOptions
  ) {
    this.modeManager = options?.modeManager;
    this.snapshotManager = options?.snapshotManager;
  }

  /**
   * Execute the turn by streaming from provider and executing tool calls.
   * @yields TurnEvent objects for text, tool calls, tool results, and errors
   */
  async *execute(): AsyncIterable<TurnEvent> {
    // Inject system prompt if provided (Requirement 5.7)
    const messagesWithSystemPrompt = this.injectSystemPrompt();

    const request: ProviderRequest = {
      model: this.options?.model ?? 'default',
      messages: messagesWithSystemPrompt,
      tools: this.options?.tools,
      options: this.buildGenerationOptions(),
      abortSignal: this.options?.abortSignal,
    };

    // Stream from provider (Requirement 10.1, 10.4, 10.5)
    try {
      for await (const event of this.provider.chatStream(request)) {
        // Check abort signal during streaming (Requirement 10.4)
        if (this.options?.abortSignal?.aborted) {
          // Clean up and return
          return;
        }

        if (event.type === 'text') {
          this.accumulatedText += event.value;
          yield { type: 'text', value: event.value };
        } else if (event.type === 'tool_call') {
          this.toolCallQueue.push(event.value);
          yield { type: 'tool_call', toolCall: event.value };
        } else if (event.type === 'finish') {
          // Stream complete, execute tools if any
          break;
        } else if (event.type === 'error') {
          // Requirement 10.1: Emit provider errors with details
          yield { 
            type: 'error', 
            error: new Error(`Provider error: ${event.error.message}${event.error.code ? ` (${event.error.code})` : ''}`)
          };
          return;
        }
      }
    } catch (error) {
      // Requirement 10.5: Catch and emit unexpected errors without crashing
      const err = error as Error;
      
      // Check if this is an abort error (Requirement 10.4)
      if (err.name === 'AbortError') {
        // Clean up on abort - don't emit error, just return
        return;
      }
      
      yield { 
        type: 'error', 
        error: new Error(`Stream error: ${err.message}`)
      };
      return;
    }

    // Check abort signal before adding message (Requirement 10.4)
    if (this.options?.abortSignal?.aborted) {
      return;
    }

    // Add assistant message to history
    if (this.accumulatedText) {
      this.messages.push({
        role: 'assistant',
        parts: [{ type: 'text', text: this.accumulatedText }],
      });
    }

    // Execute tool calls if any
    if (this.toolCallQueue.length > 0) {
      // Check abort signal before tool execution (Requirement 10.4)
      if (this.options?.abortSignal?.aborted) {
        return;
      }
      
      yield* this.executeToolCalls();
    }
  }

  /**
   * Execute all queued tool calls in parallel.
   * @yields TurnEvent objects for tool results
   */
  private async *executeToolCalls(): AsyncIterable<TurnEvent> {
    // Task 8.2: Get current mode from ModeManager (for tool permission checking)
    const currentMode = this.modeManager?.getCurrentMode() ?? 'developer';
    this.modeBeforeToolExecution = currentMode;
    
    // Execute tool calls in parallel (Requirement 10.2: Handle errors without terminating)
    const results = await Promise.allSettled(
      this.toolCallQueue.map(async (toolCall) => {
        // Task 8.3: Check if tool is allowed in current mode
        if (this.modeManager && this.modeBeforeToolExecution) {
          const isAllowed = this.modeManager.isToolAllowed(toolCall.name, this.modeBeforeToolExecution);
          
          // Task 8.4: Return error if tool not allowed with helpful message
          if (!isAllowed) {
            const deniedTools = this.modeManager.getDeniedTools(this.modeBeforeToolExecution);
            const isDenied = deniedTools.some(pattern => {
              if (pattern === '*') return true;
              if (pattern.endsWith('*')) {
                const prefix = pattern.slice(0, -1);
                return toolCall.name.startsWith(prefix);
              }
              return pattern === toolCall.name;
            });
            
            if (isDenied) {
              return {
                toolCall,
                result: { 
                  error: `Tool "${toolCall.name}" is not allowed in ${this.modeBeforeToolExecution} mode.\n` +
                         `Current mode: ${this.modeBeforeToolExecution}\n` +
                         `This tool requires developer mode or a specialized mode.\n` +
                         `Suggestion: Switch to developer mode to use this tool.`
                },
              };
            }
          }
        }
        
        const tool = this.toolRegistry.get(toolCall.name);
        if (!tool) {
          return {
            toolCall,
            result: { error: `Tool "${toolCall.name}" not found` },
          };
        }

        // Check for parsing errors propagated from provider (Output Healing)
        // This allows the LLM to self-correct malformed JSON
        if (toolCall.args && typeof toolCall.args === 'object' && '__parsing_error__' in toolCall.args) {
           const errDetails = toolCall.args as { message?: string; raw?: string };
           return {
             toolCall,
             result: { 
               error: `System Error: Invalid JSON in tool arguments. ${errDetails.message}\n` +
                      `Please retry calling "${toolCall.name}" with valid JSON.\n` +
                      `Received raw arguments: ${errDetails.raw}`
             },
           };
        }

        try {
          // Task 8.6: Execute tool
          const result = await tool.execute(toolCall.args);
          return { toolCall, result };
        } catch (error) {
          // Requirement 10.2: Include error in tool result and continue
          const err = error as Error;
          return {
            toolCall,
            result: { error: `Tool execution failed: ${err.message}` },
          };
        }
      })
    );

    // Emit results and add to message history
    for (const result of results) {
      // Check abort signal between tool results (Requirement 10.4)
      if (this.options?.abortSignal?.aborted) {
        return;
      }

      if (result.status === 'fulfilled') {
        const { toolCall, result: toolResult } = result.value;
        yield { type: 'tool_result', toolCall, result: toolResult };

        // Add tool result to conversation history
        // Only stringify if result is not already a string
        const resultText = typeof toolResult === 'string' 
          ? toolResult 
          : JSON.stringify(toolResult);
        
        this.messages.push({
          role: 'tool',
          parts: [{ type: 'text', text: resultText }],
          name: toolCall.name,
        });
      } else {
        // Requirement 10.5: Handle unexpected errors in Promise.allSettled
        // This should rarely happen since we catch errors in the map function
        // But if it does, we still want to continue
        const err = result.reason as Error;
        yield { 
          type: 'error', 
          error: new Error(`Unexpected tool execution error: ${err.message}`)
        };
      }
    }
    
    // Tool execution complete - mode remains unchanged
  }



  /**
   * Build generation options from chat options.
   */
  private buildGenerationOptions(): GenerationOptions | undefined {
    if (!this.options) {
      return undefined;
    }

    const opts: GenerationOptions = {};
    
    // Determine temperature: options.temperature or mode-linked temperature
    if (this.options.temperature !== undefined) {
      opts.temperature = this.options.temperature;
    } else if (this.options.useModeLinkedTemperature && this.options.modeManager) {
      const currentMode = this.options.modeManager.getCurrentMode();
      opts.temperature = this.options.modeManager.getPreferredTemperature(currentMode);
      if (!isTestEnv) console.log(`[Turn] Using mode-linked temperature: ${opts.temperature} for mode: ${currentMode}`);
    }

    if (this.options.maxTokens !== undefined) {
      opts.maxTokens = this.options.maxTokens;
    }

    // Add num_ctx for Ollama (85% cap strategy)
    // Use ollamaContextSize if provided, otherwise fall back to contextSize
    if (this.options.ollamaContextSize !== undefined) {
      opts.num_ctx = this.options.ollamaContextSize;
      if (!isTestEnv) console.log(`[Turn] Setting num_ctx from ollamaContextSize: ${opts.num_ctx}`);
    } else if (this.options.contextSize !== undefined) {
      // Fallback: calculate 85% if only contextSize is provided
      opts.num_ctx = Math.floor(this.options.contextSize * 0.85);
      if (!isTestEnv) console.log(`[Turn] Setting num_ctx from contextSize (85%): ${opts.num_ctx}`);
    } else {
      if (!isTestEnv) console.warn('[Turn] No context size provided, num_ctx will not be set!');
    }

    return Object.keys(opts).length > 0 ? opts : undefined;
  }

  /**
   * Inject system prompt into messages if provided.
   * If a system prompt is provided in options and there's no system message,
   * prepend it to the messages array.
   * @returns Messages array with system prompt injected if needed
   */
  private injectSystemPrompt(): Message[] {
    if (!this.options?.systemPrompt) {
      return this.messages;
    }

    // Check if there's already a system message
    const hasSystemMessage = this.messages.some(msg => msg.role === 'system');
    
    if (hasSystemMessage) {
      // If there's already a system message, append context to it
      return this.messages.map(msg => {
        if (msg.role === 'system') {
          return {
            ...msg,
            parts: [
              ...msg.parts,
              { type: 'text', text: this.options!.systemPrompt! }
            ]
          };
        }
        return msg;
      });
    } else {
      // No system message exists, prepend one
      return [
        {
          role: 'system',
          parts: [{ type: 'text', text: this.options.systemPrompt }]
        },
        ...this.messages
      ];
    }
  }
}
