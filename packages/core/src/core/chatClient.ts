/**
 * Chat Client
 * Main entry point for chat interactions. Manages conversation state and coordinates turns.
 */

import type { Message, ToolCall, ProviderAdapter } from '../provider/types.js';
import type { ProviderRegistry } from '../provider/registry.js';
import { Turn, type TurnEvent, type ToolRegistry, type ChatOptions } from './turn.js';

/**
 * Configuration for the chat client.
 */
export interface ChatConfig {
  defaultModel?: string;
  defaultMaxTurns?: number;
}

/**
 * Events emitted during chat execution.
 */
export type ChatEvent =
  | { type: 'text'; value: string }
  | { type: 'tool_call_start'; toolCall: ToolCall }
  | { type: 'tool_call_result'; toolCall: ToolCall; result: unknown }
  | { type: 'turn_complete'; turnNumber: number }
  | { type: 'finish'; reason: string }
  | { type: 'error'; error: Error };

/**
 * Main chat client for managing conversations.
 * Coordinates turns, tool execution, and event streaming.
 */
export class ChatClient {
  constructor(
    private providerRegistry: ProviderRegistry,
    private toolRegistry: ToolRegistry,
    private config: ChatConfig = {}
  ) {}

  /**
   * Start a chat conversation with the given prompt.
   * @param prompt The user's initial message
   * @param options Chat options (model, provider, tools, etc.)
   * @yields ChatEvent objects for text, tool calls, turn completion, and finish
   */
  async *chat(prompt: string, options?: ChatOptions): AsyncIterable<ChatEvent> {
    // Resolve provider (Requirement 10.1: Handle provider errors gracefully)
    let provider: ProviderAdapter | undefined;
    
    try {
      provider = options?.provider
        ? this.providerRegistry.get(options.provider)
        : this.providerRegistry.getDefault();
    } catch (error) {
      // Emit error event with clear message (Requirement 10.5)
      const err = error as Error;
      yield { 
        type: 'error', 
        error: new Error(`Provider resolution failed: ${err.message}`)
      };
      return;
    }

    if (!provider) {
      const errorMsg = options?.provider
        ? `Provider "${options.provider}" not found`
        : 'No provider available';
      yield { type: 'error', error: new Error(errorMsg) };
      return;
    }

    // Initialize conversation with user message
    const messages: Message[] = [
      { role: 'user', parts: [{ type: 'text', text: prompt }] },
    ];

    let turnNumber = 0;
    const maxTurns = options?.maxTurns ?? this.config.defaultMaxTurns ?? 10;

    // Turn loop
    while (turnNumber < maxTurns) {
      turnNumber++;

      // Check abort signal before starting turn (Requirement 10.4)
      if (options?.abortSignal?.aborted) {
        yield { type: 'finish', reason: 'cancelled' };
        break;
      }

      // Create and execute turn
      const turn = new Turn(provider, this.toolRegistry, messages, options);

      let hasToolCalls = false;
      let hasError = false;

      try {
        for await (const event of turn.execute()) {
          // Check abort signal during streaming (Requirement 10.4)
          if (options?.abortSignal?.aborted) {
            yield { type: 'finish', reason: 'cancelled' };
            return;
          }

          // Map turn events to chat events
          const chatEvent = this.mapTurnEventToChatEvent(event);
          yield chatEvent;

          // Track if we have tool calls or errors
          if (event.type === 'tool_call') {
            hasToolCalls = true;
          } else if (event.type === 'error') {
            hasError = true;
            // Requirement 10.2: Tool execution errors are emitted but don't terminate
            // Continue processing to allow conversation to continue
          }
        }
      } catch (error) {
        // Requirement 10.5: Emit error event without crashing
        const err = error as Error;
        yield { 
          type: 'error', 
          error: new Error(`Turn execution failed: ${err.message}`)
        };
        hasError = true;
      }

      // Emit turn complete event
      yield { type: 'turn_complete', turnNumber };

      // Stop if there was an error
      if (hasError) {
        yield { type: 'finish', reason: 'error' };
        break;
      }

      // Stop if no tool calls (conversation complete)
      if (!hasToolCalls) {
        yield { type: 'finish', reason: 'complete' };
        break;
      }

      // Check abort signal after turn (Requirement 10.4)
      if (options?.abortSignal?.aborted) {
        yield { type: 'finish', reason: 'cancelled' };
        break;
      }

      // Tool results are already added to messages by Turn
      // Continue to next turn
    }

    // Max turns exceeded
    if (turnNumber >= maxTurns) {
      yield { type: 'finish', reason: 'max_turns' };
    }
  }

  /**
   * Map Turn events to Chat events.
   * @param event The turn event to map
   * @returns The corresponding chat event
   */
  private mapTurnEventToChatEvent(event: TurnEvent): ChatEvent {
    switch (event.type) {
      case 'text':
        return { type: 'text', value: event.value };
      case 'tool_call':
        return { type: 'tool_call_start', toolCall: event.toolCall };
      case 'tool_result':
        return {
          type: 'tool_call_result',
          toolCall: event.toolCall,
          result: event.result,
        };
      case 'error':
        return { type: 'error', error: event.error };
    }
  }
}
