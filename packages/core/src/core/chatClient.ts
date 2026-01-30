/**
 * Chat Client
 *
 * @status REWORK - Complete rewrite (2026-01-29)
 * @date 2026-01-29
 * @changes Removed 500+ lines of legacy code, now properly delegates to ContextOrchestrator
 *
 * Simplified chat client that delegates context management to ContextOrchestrator.
 *
 * Responsibilities:
 * - Coordinate chat turns with provider
 * - Delegate message management to ContextManager
 * - Handle tool execution via Turn
 * - Emit events for UI/hooks
 * - Record sessions (optional)
 *
 * NOT responsible for:
 * - Context compression (handled by ContextOrchestrator)
 * - Snapshot management (handled by ContextOrchestrator)
 * - Checkpoint creation (handled by ContextOrchestrator)
 * - Context validation (handled by ContextOrchestrator)
 */

import { Turn, type TurnEvent, type ToolRegistry, type ChatOptions } from './turn.js';
import { getMessageBus } from '../hooks/messageBus.js';
import { LoopDetectionService } from '../services/loopDetectionService.js';
import { debugLog } from '../utils/debugLogger.js';

import type { ContextManager as ContextMgmtManager } from '../context/types.js';
import type { ProviderRegistry } from '../provider/registry.js';
import type { Message, ToolCall, ProviderAdapter } from '../provider/types.js';
import type { ChatRecordingService } from '../services/chatRecordingService.js';
import type { DynamicContextInjector as ServicesContextManager } from '../services/dynamicContextInjector.js';

const isTestEnv = process.env.NODE_ENV === 'test' || !!process.env.VITEST;

/**
 * Configuration for the chat client
 */
export interface ChatConfig {
  defaultModel?: string;
  defaultMaxTurns?: number;
  recordingService?: ChatRecordingService;
  loopDetectionService?: LoopDetectionService;
  contextManager?: ServicesContextManager; // For dynamic context injection (separate from context management)
  contextMgmtManager?: ContextMgmtManager; // The ContextOrchestrator (via adapter)
}

/**
 * Events emitted during chat execution
 */
export type ChatEvent =
  | { type: 'text'; value: string }
  | { type: 'tool_call_start'; toolCall: ToolCall }
  | { type: 'tool_call_result'; toolCall: ToolCall; result: unknown }
  | { type: 'turn_complete'; turnNumber: number }
  | { type: 'finish'; reason: string }
  | { type: 'error'; error: Error }
  | { type: 'loop_detected'; pattern: { type: string; details: string; count: number } };

/**
 * Main chat client for managing conversations
 */
export class ChatClient {
  private recordingService?: ChatRecordingService;
  private loopDetectionService?: LoopDetectionService;
  private contextManager?: ServicesContextManager;
  private contextMgmtManager?: ContextMgmtManager;
  private messageBus = getMessageBus();

  constructor(
    private providerRegistry: ProviderRegistry,
    private toolRegistry: ToolRegistry,
    private config: ChatConfig = {}
  ) {
    this.recordingService = config.recordingService;
    this.loopDetectionService = config.loopDetectionService;
    this.contextManager = config.contextManager;
    this.contextMgmtManager = config.contextMgmtManager;
  }

  /**
   * Start a chat conversation with the given prompt
   */
  async *chat(prompt: string, options?: ChatOptions): AsyncIterable<ChatEvent> {
    // Resolve provider
    let provider: ProviderAdapter | undefined;
    try {
      provider = options?.provider
        ? this.providerRegistry.get(options.provider)
        : this.providerRegistry.getDefault();
    } catch (error) {
      const err = error as Error;
      yield { type: 'error', error: new Error(`Provider resolution failed: ${err.message}`) };
      return;
    }

    if (!provider) {
      const errorMsg = options?.provider
        ? `Provider "${options.provider}" not found`
        : 'No provider available';
      yield { type: 'error', error: new Error(errorMsg) };
      return;
    }

    // Get context size and Ollama limit from context manager
    if (!options?.contextSize || !options?.ollamaContextSize) {
      if (!this.contextMgmtManager) {
        throw new Error('[ChatClient] Context manager not initialized');
      }

      const usage = this.contextMgmtManager.getUsage();
      const ollamaLimit = this.contextMgmtManager.getOllamaContextLimit?.();

      if (!ollamaLimit) {
        throw new Error('[ChatClient] Context manager does not provide Ollama context limit');
      }

      options = {
        ...options,
        contextSize: usage.maxTokens,
        ollamaContextSize: ollamaLimit,
      };

      debugLog('ChatClient', 'Context size configuration', {
        contextSize: usage.maxTokens,
        ollamaContextSize: ollamaLimit,
        currentTokens: usage.currentTokens,
        percentage: usage.percentage,
      });

      if (!isTestEnv) {
        console.log(
          `[ChatClient] Context: ${usage.maxTokens} tokens, Ollama limit: ${ollamaLimit}`
        );
      }
    }

    // Initialize session recording
    let sessionId: string | undefined;
    if (this.recordingService) {
      try {
        const model = options?.model ?? this.config.defaultModel ?? 'unknown';
        const providerName = options?.provider ?? 'default';
        sessionId = await this.recordingService.createSession(model, providerName);

        this.messageBus.emit('session_start', {
          sessionId,
          model,
          provider: providerName,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        if (!isTestEnv) console.error('Failed to create session:', error);
      }
    }

    // Add user message to context manager
    if (this.contextMgmtManager) {
      try {
        // Wait for any in-progress summarization
        if (this.contextMgmtManager.isSummarizationInProgress()) {
          if (!isTestEnv) console.log('[ChatClient] Waiting for checkpoint creation...');

          yield { type: 'text', value: '\n[System: Creating checkpoint, please wait...]\n\n' };

          await this.contextMgmtManager.waitForSummarization();

          yield { type: 'text', value: '[System: Checkpoint complete, continuing...]\n\n' };
        }

        // Add user message (context manager handles validation and compression)
        await this.contextMgmtManager.addMessage({
          id: `user-${Date.now()}`,
          role: 'user',
          content: prompt,
          timestamp: new Date(),
        });
      } catch (error) {
        const err = error as Error;
        yield { type: 'error', error: new Error(`Context management error: ${err.message}`) };
        return;
      }
    }

    // Record user message
    if (sessionId && this.recordingService) {
      try {
        await this.recordingService.recordMessage(sessionId, {
          role: 'user',
          parts: [{ type: 'text', text: prompt }],
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        if (!isTestEnv) console.error('Failed to record user message:', error);
      }
    }

    // Reset loop detection
    if (this.loopDetectionService) {
      this.loopDetectionService.reset();
    }

    let turnNumber = 0;
    const maxTurns = options?.maxTurns ?? this.config.defaultMaxTurns ?? 10;

    // Turn loop
    while (turnNumber < maxTurns) {
      turnNumber++;

      // Record turn for loop detection
      if (this.loopDetectionService) {
        this.loopDetectionService.recordTurn();
      }

      // Check for loops
      if (this.loopDetectionService) {
        const loopPattern = this.loopDetectionService.checkForLoop();
        if (loopPattern) {
          yield { type: 'loop_detected', pattern: loopPattern };
          yield { type: 'finish', reason: 'loop_detected' };
          break;
        }
      }

      // Check abort signal
      if (options?.abortSignal?.aborted) {
        yield { type: 'finish', reason: 'cancelled' };
        break;
      }

      // Get messages from context manager
      const messages = this.contextMgmtManager ? await this.contextMgmtManager.getMessages() : [];

      // Convert to Turn-compatible format
      const turnMessages: Message[] = messages.map((msg) => ({
        role: msg.role as 'user' | 'assistant' | 'system',
        parts: [{ type: 'text' as const, text: msg.content }],
      }));

      // Get context additions from dynamic context manager (if available)
      let systemPromptWithContext = options?.systemPrompt;
      if (this.contextManager) {
        const contextAdditions = this.contextManager.getSystemPromptAdditions();
        if (contextAdditions) {
          systemPromptWithContext = (systemPromptWithContext || '') + contextAdditions;
        }
      }

      // Get available tools for current mode
      let availableTools: ChatOptions['tools'];
      if (
        this.toolRegistry &&
        typeof (this.toolRegistry as any).getFunctionSchemas === 'function'
      ) {
        availableTools = options?.modeManager
          ? (this.toolRegistry as any).getFunctionSchemasForMode(
              options.modeManager.getCurrentMode(),
              options.modeManager
            )
          : (this.toolRegistry as any).getFunctionSchemas();
      }

      // Ensure provider cannot stream more tokens than remaining Ollama budget.
      // Compute a safe `maxTokens` if not provided by caller.
      try {
        const usage = this.contextMgmtManager?.getUsage();
        const ollamaLimit =
          this.contextMgmtManager?.getOllamaContextLimit?.() ?? options?.ollamaContextSize;

        if (usage && ollamaLimit && options) {
          const remaining = Math.max(0, ollamaLimit - usage.currentTokens);
          // Reserve small safety buffer to avoid edge overruns
          const safeMax = Math.max(1, remaining - 100);
          if (options.maxTokens === undefined) {
            options.maxTokens = safeMax;
            debugLog('ChatClient', `Auto-setting maxTokens=${safeMax} (remaining=${remaining})`);
          } else {
            // Never allow configured maxTokens to exceed remaining budget
            options.maxTokens = Math.min(options.maxTokens, Math.max(1, remaining));
          }
          // Compute effective num_ctx to send to Ollama. We want Ollama's
          // `num_ctx` to reflect the actual total tokens that will be in
          // play (current prompt + expected response) so the model doesn't
          // assume a larger window than we can actually provide.
          // effectiveNumCtx = min(profile ollama limit, currentTokens + maxTokens)
          try {
            const effectiveNumCtx = Math.min(
              ollamaLimit,
              usage.currentTokens + (options.maxTokens ?? 1)
            );
            options.ollamaContextSize = Math.max(effectiveNumCtx, usage.currentTokens + 1);
            debugLog(
              'ChatClient',
              `Setting effective ollamaContextSize=${options.ollamaContextSize} (usage=${usage.currentTokens}, maxTokens=${options.maxTokens}, profileLimit=${ollamaLimit})`
            );
          } catch (err) {
            debugLog('ChatClient', 'Failed to compute effective ollamaContextSize', {
              error: String(err),
            });
          }
          // Prevent starting a provider request that would overflow the Ollama limit.
          try {
            const requested = options.maxTokens ?? 0;
            if (usage.currentTokens + requested > ollamaLimit) {
              debugLog('ChatClient', 'Potential overflow detected before request start', {
                currentTokens: usage.currentTokens,
                requested,
                ollamaLimit,
              });

              // If summarization is in progress, wait for it to finish (short timeout)
              if (this.contextMgmtManager?.isSummarizationInProgress()) {
                const waitMs = 5000;
                debugLog('ChatClient', `Waiting up to ${waitMs}ms for summarization to free space`);
                const waitPromise = this.contextMgmtManager.waitForSummarization(waitMs);
                // Respect abort signal while waiting
                if (options.abortSignal) {
                  const abortPromise = new Promise<void>((resolve, reject) => {
                    options.abortSignal!.addEventListener('abort', () =>
                      reject(new Error('aborted'))
                    );
                  });
                  try {
                    await Promise.race([waitPromise, abortPromise]);
                  } catch (_e) {
                    yield { type: 'finish', reason: 'cancelled' };
                    return;
                  }
                } else {
                  try {
                    await waitPromise;
                  } catch (_e) {
                    // ignore timeout errors from waitForSummarization
                  }
                }
              }

              // Recompute usage after waiting
              const latestUsage = this.contextMgmtManager?.getUsage();
              const remainingAfter = Math.max(
                0,
                (ollamaLimit || 0) - (latestUsage?.currentTokens ?? usage.currentTokens)
              );
              if (remainingAfter < (options.maxTokens ?? 0)) {
                yield {
                  type: 'error',
                  error: new Error(
                    'Insufficient context capacity: request would exceed Ollama context limit. Try reducing maxTokens or enable compression.'
                  ),
                };
                return;
              }
            }
          } catch (err) {
            debugLog('ChatClient', 'Overflow guard check failed', { error: String(err) });
          }
        }
      } catch (err) {
        // Don't block chat if usage info unavailable; proceed without altering maxTokens
        debugLog('ChatClient', 'Failed to compute safe maxTokens', { error: String(err) });
      }

      const turnOptions: ChatOptions = {
        ...options,
        systemPrompt: systemPromptWithContext,
        tools: availableTools,
      };

      // Emit before_agent event
      this.messageBus.emit('before_agent', {
        prompt,
        context: turnMessages.slice(0, -1),
        sessionId,
        turnNumber,
        model: options?.model ?? this.config.defaultModel,
      });

      // Execute turn
      const turn = new Turn(provider, this.toolRegistry, turnMessages, turnOptions);

      let hasToolCalls = false;
      let assistantMessage: Message | undefined;
      const turnToolCalls: Array<{ toolCall: ToolCall; result: unknown }> = [];
      let assistantOutput = '';

      try {
        for await (const event of turn.execute()) {
          // Check abort signal during streaming
          if (options?.abortSignal?.aborted) {
            yield { type: 'finish', reason: 'cancelled' };
            return;
          }

          // Map turn events to chat events
          const chatEvent = this.mapTurnEventToChatEvent(event);
          yield chatEvent;

          // Track assistant message and tool calls
          if (event.type === 'text') {
            if (!assistantMessage) {
              assistantMessage = { role: 'assistant', parts: [] };
            }
            assistantMessage.parts.push({ type: 'text', text: event.value });
            assistantOutput += event.value;
          } else if (event.type === 'tool_call') {
            hasToolCalls = true;

            this.messageBus.emit('before_tool', {
              toolName: event.toolCall.name,
              args: event.toolCall.args,
              sessionId,
              turnNumber,
            });

            if (this.loopDetectionService) {
              this.loopDetectionService.recordToolCall(event.toolCall.name, event.toolCall.args);
            }
          } else if (event.type === 'tool_result') {
            this.messageBus.emit('after_tool', {
              toolName: event.toolCall.name,
              args: event.toolCall.args,
              result: event.result,
              sessionId,
              turnNumber,
            });

            turnToolCalls.push({ toolCall: event.toolCall, result: event.result });
          }
        }
      } catch (error) {
        const err = error as Error;
        yield { type: 'error', error: new Error(`Turn execution failed: ${err.message}`) };
      }

      // Record output for loop detection
      if (this.loopDetectionService && assistantOutput) {
        this.loopDetectionService.recordOutput(assistantOutput);
      }

      // Emit after_agent event
      this.messageBus.emit('after_agent', {
        prompt,
        response: assistantOutput,
        toolCalls: turnToolCalls.map((tc) => tc.toolCall),
        sessionId,
        turnNumber,
      });

      // Record assistant message
      if (
        sessionId &&
        this.recordingService &&
        assistantMessage &&
        assistantMessage.parts.length > 0
      ) {
        try {
          await this.recordingService.recordMessage(sessionId, {
            role: 'assistant',
            parts: assistantMessage.parts.map((part) => ({
              type: 'text',
              text: part.type === 'text' ? part.text : '',
            })),
            timestamp: new Date().toISOString(),
          });

          this.messageBus.emit('session_saved', {
            sessionId,
            turnNumber,
            timestamp: new Date().toISOString(),
          });
        } catch (error) {
          if (!isTestEnv) console.error('Failed to record assistant message:', error);
        }
      }

      // Add assistant message to context manager
      if (this.contextMgmtManager && assistantMessage && assistantMessage.parts.length > 0) {
        try {
          const content = assistantMessage.parts
            .filter((part) => part.type === 'text')
            .map((part) => (part.type === 'text' ? part.text : ''))
            .join('');

          await this.contextMgmtManager.addMessage({
            id: `assistant-${Date.now()}`,
            role: 'assistant',
            content,
            timestamp: new Date(),
          });
        } catch (error) {
          const err = error as Error;
          yield {
            type: 'error',
            error: new Error(`Failed to add assistant message: ${err.message}`),
          };
        }
      }

      // Emit turn complete
      yield { type: 'turn_complete', turnNumber };

      // If no tool calls, conversation is complete
      if (!hasToolCalls) {
        yield { type: 'finish', reason: 'complete' };
        break;
      }
    }

    // Max turns reached
    if (turnNumber >= maxTurns) {
      yield { type: 'finish', reason: 'max_turns' };
    }

    // Emit session end
    if (sessionId) {
      this.messageBus.emit('session_end', {
        sessionId,
        turnCount: turnNumber,
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Map turn event to chat event
   */
  private mapTurnEventToChatEvent(event: TurnEvent): ChatEvent {
    switch (event.type) {
      case 'text':
        return { type: 'text', value: event.value };
      case 'tool_call':
        return { type: 'tool_call_start', toolCall: event.toolCall };
      case 'tool_result':
        return { type: 'tool_call_result', toolCall: event.toolCall, result: event.result };
      case 'error':
        return { type: 'error', error: event.error };
      default:
        return { type: 'error', error: new Error('Unknown event type') };
    }
  }
}
