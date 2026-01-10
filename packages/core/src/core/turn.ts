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

/**
 * Minimal ToolRegistry interface for tool execution.
 * Full implementation will be in stage-03-tools-policy.
 */
export interface ToolRegistry {
  get(name: string): Tool | undefined;
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
  abortSignal?: AbortSignal;
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

  constructor(
    private provider: ProviderAdapter,
    private toolRegistry: ToolRegistry,
    private messages: Message[],
    private options?: ChatOptions
  ) {}

  /**
   * Execute the turn by streaming from provider and executing tool calls.
   * @yields TurnEvent objects for text, tool calls, tool results, and errors
   */
  async *execute(): AsyncIterable<TurnEvent> {
    const request: ProviderRequest = {
      model: this.options?.model ?? 'default',
      messages: this.messages,
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
    // Execute tool calls in parallel (Requirement 10.2: Handle errors without terminating)
    const results = await Promise.allSettled(
      this.toolCallQueue.map(async (toolCall) => {
        const tool = this.toolRegistry.get(toolCall.name);
        if (!tool) {
          return {
            toolCall,
            result: { error: `Tool "${toolCall.name}" not found` },
          };
        }

        try {
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
        this.messages.push({
          role: 'tool',
          parts: [{ type: 'text', text: JSON.stringify(toolResult) }],
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
  }

  /**
   * Build generation options from chat options.
   */
  private buildGenerationOptions(): GenerationOptions | undefined {
    if (!this.options) {
      return undefined;
    }

    const opts: GenerationOptions = {};
    if (this.options.temperature !== undefined) {
      opts.temperature = this.options.temperature;
    }
    if (this.options.maxTokens !== undefined) {
      opts.maxTokens = this.options.maxTokens;
    }

    return Object.keys(opts).length > 0 ? opts : undefined;
  }
}
