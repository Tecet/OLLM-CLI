/**
 * Chat Client
 * Main entry point for chat interactions. Manages conversation state and coordinates turns.
 */

import type { Message, ToolCall, ProviderAdapter } from '../provider/types.js';
import type { ProviderRegistry } from '../provider/registry.js';
import { Turn, type TurnEvent, type ToolRegistry, type ChatOptions } from './turn.js';
import type { ChatRecordingService } from '../services/chatRecordingService.js';
import type { ChatCompressionService } from '../services/chatCompressionService.js';
import { LoopDetectionService } from '../services/loopDetectionService.js';
import type { ContextManager as ServicesContextManager } from '../services/contextManager.js';
import type { ContextManager as ContextMgmtManager } from '../context/types.js';
import type { SessionMessage, SessionToolCall, ServicesConfig } from '../services/types.js';
import { mergeServicesConfig } from '../services/config.js';
import { ModelDatabase, modelDatabase } from '../routing/modelDatabase.js';
import { getMessageBus } from '../hooks/messageBus.js';

/**
 * Configuration for the chat client.
 */
export interface ChatConfig {
  defaultModel?: string;
  defaultMaxTurns?: number;
  recordingService?: ChatRecordingService;
  compressionService?: ChatCompressionService;
  loopDetectionService?: LoopDetectionService;
  contextManager?: ServicesContextManager;
  contextMgmtManager?: ContextMgmtManager;
  servicesConfig?: Partial<ServicesConfig>;
  tokenLimit?: number; // Token limit override (if not specified, uses Model Database)
  modelDatabase?: ModelDatabase; // Model Database instance (optional, uses singleton by default)
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
  | { type: 'error'; error: Error }
  | { type: 'loop_detected'; pattern: { type: string; details: string; count: number } };

/**
 * Main chat client for managing conversations.
 * Coordinates turns, tool execution, and event streaming.
 */
export class ChatClient {
  private recordingService?: ChatRecordingService;
  private compressionService?: ChatCompressionService;
  private loopDetectionService?: LoopDetectionService;
  private contextManager?: ServicesContextManager;
  private contextMgmtManager?: ContextMgmtManager;
  private servicesConfig: Required<ServicesConfig>;
  private modelDatabase: ModelDatabase;

  private messageBus = getMessageBus();

  constructor(
    private providerRegistry: ProviderRegistry,
    private toolRegistry: ToolRegistry,
    private config: ChatConfig = {}
  ) {
    this.recordingService = config.recordingService;
    this.compressionService = config.compressionService;
    this.contextManager = config.contextManager;
    this.contextMgmtManager = config.contextMgmtManager;
    this.servicesConfig = mergeServicesConfig(config.servicesConfig);
    this.modelDatabase = config.modelDatabase ?? modelDatabase;
    
    // Initialize loop detection service only if explicitly provided
    // (not auto-created from config to avoid interfering with existing tests)
    this.loopDetectionService = config.loopDetectionService;
  }
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

    // Ensure context size is set (CRITICAL: prevents context overflow)
    if (!options?.contextSize && !options?.ollamaContextSize) {
      // Try to get from context manager
      if (this.contextMgmtManager) {
        const usage = this.contextMgmtManager.getUsage();
        options = {
          ...options,
          contextSize: usage.maxTokens,
          ollamaContextSize: Math.floor(usage.maxTokens * 0.85),
        };
        console.log(`[ChatClient] Context size from manager: ${usage.maxTokens}, Ollama: ${Math.floor(usage.maxTokens * 0.85)}`);
      } else {
        // Fallback to default
        const defaultContextSize = 8192;
        const defaultOllamaSize = 6963; // 85% of 8192
        options = {
          ...options,
          contextSize: defaultContextSize,
          ollamaContextSize: defaultOllamaSize,
        };
        console.warn(`[ChatClient] No context size specified, using default ${defaultContextSize} (Ollama: ${defaultOllamaSize})`);
      }
    } else {
      console.log(`[ChatClient] Context size: ${options.contextSize}, Ollama: ${options.ollamaContextSize}`);
    }

    // Initialize session recording (Requirements 1.1, 9.1)
    let sessionId: string | undefined;
    if (this.recordingService) {
      try {
        const model = options?.model ?? this.config.defaultModel ?? 'unknown';
        const providerName = options?.provider ?? 'default';
        sessionId = await this.recordingService.createSession(model, providerName);
        
        // Emit session_start event
        this.messageBus.emit('session_start', {
          sessionId,
          model,
          provider: providerName,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        // Log error but continue without recording (Requirement 10.1)
        console.error('Failed to create session:', error);
      }
    }

    // Initialize conversation with user message
    const messages: Message[] = [
      { role: 'user', parts: [{ type: 'text', text: prompt }] },
    ];

    // Add user message to context management system if available
    if (this.contextMgmtManager) {
      try {
        await this.contextMgmtManager.addMessage({
          id: `user-${Date.now()}`,
          role: 'user',
          content: prompt,
          timestamp: new Date()
        });
      } catch (error) {
        // If context manager rejects the message (e.g., memory limit), emit error
        const err = error as Error;
        yield { 
          type: 'error', 
          error: new Error(`Context management error: ${err.message}`)
        };
        return;
      }
    }

    // Record initial user message (Requirement 1.1)
    if (sessionId && this.recordingService) {
      try {
        await this.recordingService.recordMessage(sessionId, {
          role: 'user',
          parts: [{ type: 'text', text: prompt }],
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        // Log error but continue (Requirement 10.1)
        console.error('Failed to record user message:', error);
      }
    }

    let turnNumber = 0;
    const maxTurns = options?.maxTurns ?? this.config.defaultMaxTurns ?? 10;

    // Reset loop detection for new conversation (Requirement 4.8)
    if (this.loopDetectionService) {
      this.loopDetectionService.reset();
    }

    // Turn loop
    while (turnNumber < maxTurns) {
      turnNumber++;

      // Record turn for loop detection (Requirement 4.3)
      if (this.loopDetectionService) {
        this.loopDetectionService.recordTurn();
      }

      // Check for loops before each turn (Requirements 4.1, 4.2, 4.3, 4.7)
      if (this.loopDetectionService) {
        const loopPattern = this.loopDetectionService.checkForLoop();
        if (loopPattern) {
          // Emit loop detection event (Requirement 4.8)
          yield {
            type: 'loop_detected',
            pattern: loopPattern,
          };
          // Stop execution (Requirement 4.7)
          yield { type: 'finish', reason: 'loop_detected' };
          break;
        }
      }

      // Check compression threshold before each turn (Requirement 3.1, 8.1, 8.2, 8.3)
      if (this.compressionService && this.servicesConfig.compression.enabled) {
        try {
          // Get model name for token limit lookup
          const model = options?.model ?? this.config.defaultModel ?? 'unknown';
          
          // Query Model Database for context window limit (Requirement 8.1, 8.2)
          // Config override takes precedence if specified
          const tokenLimit = this.config.tokenLimit ?? this.modelDatabase.getContextWindow(model);
          const threshold = this.servicesConfig.compression.threshold ?? 0.8;
          
          // Convert messages to SessionMessage format for compression check
          const sessionMessages = messages.map(msg => this.messageToSessionMessage(msg));
          
          if (await this.compressionService.shouldCompress(sessionMessages, tokenLimit, threshold)) {
            // Emit pre_compress event
            this.messageBus.emit('pre_compress', {
              contextSize: sessionMessages.length,
              tokenCount: sessionMessages.reduce((sum, msg) => 
                sum + msg.parts.reduce((s, p) => s + p.text.length, 0), 0
              ),
              maxSize: tokenLimit,
              sessionId,
            });
            
            // Trigger compression (Requirement 8.3)
            const compressionResult = await this.compressionService.compress(
              sessionMessages,
              {
                strategy: this.servicesConfig.compression.strategy ?? 'hybrid',
                preserveRecentTokens: this.servicesConfig.compression.preserveRecent ?? 1000,
                targetTokens: Math.floor(tokenLimit * 0.7), // Target 70% of limit after compression
              }
            );

            const compressionRatio = compressionResult.originalTokenCount > 0 
              ? compressionResult.compressedTokenCount / compressionResult.originalTokenCount 
              : 1.0;

            // Emit post_compress event
            this.messageBus.emit('post_compress', {
              originalSize: sessionMessages.length,
              compressedSize: compressionResult.compressedMessages.length,
              originalTokenCount: sessionMessages.reduce((sum, msg) => 
                sum + msg.parts.reduce((s, p) => s + p.text.length, 0), 0
              ),
              compressedTokenCount: compressionResult.compressedTokenCount,
              compressionRatio,
              sessionId,
            });

            // Update message history with compressed messages
            messages.length = 0; // Clear existing messages
            messages.push(...compressionResult.compressedMessages.map(msg => 
              this.sessionMessageToMessage(msg)
            ));

            // Update session metadata if recording is enabled
            if (sessionId && this.recordingService) {
              try {
                // Get current session to update metadata
                const session = await this.recordingService.getSession(sessionId);
                if (session) {
                  session.metadata.compressionCount++;
                  session.metadata.tokenCount = compressionResult.compressedTokenCount;
                  // Save updated session
                  await this.recordingService.saveSession(sessionId);
                }
              } catch (error) {
                // Log error but continue (Requirement 10.3)
                console.error('Failed to update session metadata after compression:', error);
              }
            }
          }
        } catch (error) {
          // Log error but continue without compression (Requirement 10.3)
          console.error('Compression check failed:', error);
        }
      }

      // Check context management system for automatic actions
      if (this.contextMgmtManager) {
        try {
          const usage = this.contextMgmtManager.getUsage();
          
          // Context management system handles automatic compression and snapshots
          // based on configured thresholds, so we just need to check if we can proceed
          if (usage.percentage >= 95) {
            // Near overflow - emit warning
            yield {
              type: 'error',
              error: new Error(
                `Context usage at ${usage.percentage.toFixed(1)}%. ` +
                'Consider creating a snapshot or clearing context.'
              )
            };
          }
        } catch (error) {
          // Log error but continue
          console.error('Context management check failed:', error);
        }
      }

      // Check abort signal before starting turn (Requirement 10.4)
      if (options?.abortSignal?.aborted) {
        yield { type: 'finish', reason: 'cancelled' };
        break;
      }

      // Get context additions from ContextManager (Requirement 5.7)
      let systemPromptWithContext = options?.systemPrompt;
      if (this.contextManager) {
        const contextAdditions = this.contextManager.getSystemPromptAdditions();
        if (contextAdditions) {
          // Append context additions to system prompt
          systemPromptWithContext = (systemPromptWithContext || '') + contextAdditions;
        }
      }

      // Create turn options with context-enhanced system prompt
      const turnOptions: ChatOptions = {
        ...options,
        systemPrompt: systemPromptWithContext,
      };

      // Emit before_agent event
      this.messageBus.emit('before_agent', {
        prompt: turnNumber === 1 ? prompt : messages[messages.length - 1],
        context: messages.slice(0, -1),
        sessionId,
        turnNumber,
        model: options?.model ?? this.config.defaultModel,
      });

      // Create and execute turn
      const turn = new Turn(provider, this.toolRegistry, messages, turnOptions);

      let hasToolCalls = false;
      let hasError = false;
      let assistantMessage: Message | undefined;
      const turnToolCalls: Array<{ toolCall: ToolCall; result: unknown }> = [];
      let assistantOutput = ''; // Track output for loop detection

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

          // Track assistant message and tool calls for recording
          if (event.type === 'text') {
            // Accumulate assistant message
            if (!assistantMessage) {
              assistantMessage = { role: 'assistant', parts: [] };
            }
            assistantMessage.parts.push({ type: 'text', text: event.value });
            // Accumulate output for loop detection (Requirement 4.2)
            assistantOutput += event.value;
          } else if (event.type === 'tool_call') {
            hasToolCalls = true;
            
            // Emit before_tool event
            this.messageBus.emit('before_tool', {
              toolName: event.toolCall.name,
              args: event.toolCall.args,
              sessionId,
              turnNumber,
            });
            
            // Record tool call for loop detection (Requirement 4.1, 4.4)
            if (this.loopDetectionService) {
              this.loopDetectionService.recordToolCall(event.toolCall.name, event.toolCall.args);
            }
          } else if (event.type === 'tool_result') {
            // Emit after_tool event
            this.messageBus.emit('after_tool', {
              toolName: event.toolCall.name,
              args: event.toolCall.args,
              result: event.result,
              sessionId,
              turnNumber,
            });
            
            // Store tool call and result for recording
            turnToolCalls.push({ toolCall: event.toolCall, result: event.result });
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

      // Record output for loop detection (Requirement 4.2, 4.5)
      if (this.loopDetectionService && assistantOutput) {
        this.loopDetectionService.recordOutput(assistantOutput);
      }

      // Emit after_agent event
      this.messageBus.emit('after_agent', {
        prompt: turnNumber === 1 ? prompt : messages[messages.length - 1],
        response: assistantOutput,
        toolCalls: turnToolCalls.map(tc => tc.toolCall),
        sessionId,
        turnNumber,
      });

      // Record assistant message (Requirement 1.2)
      if (sessionId && this.recordingService && assistantMessage && assistantMessage.parts.length > 0) {
        try {
          await this.recordingService.recordMessage(sessionId, {
            role: 'assistant',
            parts: assistantMessage.parts.map(part => ({
              type: 'text',
              text: part.type === 'text' ? part.text : '',
            })),
            timestamp: new Date().toISOString(),
          });
        } catch (error) {
          // Log error but continue (Requirement 10.1)
          console.error('Failed to record assistant message:', error);
        }
      }

      // Add assistant message to context management system
      if (this.contextMgmtManager && assistantMessage && assistantMessage.parts.length > 0) {
        try {
          const content = assistantMessage.parts
            .filter(part => part.type === 'text')
            .map(part => part.type === 'text' ? part.text : '')
            .join('');
          
          await this.contextMgmtManager.addMessage({
            id: `assistant-${Date.now()}`,
            role: 'assistant',
            content,
            timestamp: new Date()
          });
          
          // Parse goal management markers for non-tool models (Phase 3C)
          try {
            const { GoalManagementParser } = await import('../prompts/goalManagementPrompt.js');
            const markers = GoalManagementParser.parse(content);
            
            // Get goal manager from context manager
            const goalManager = this.contextMgmtManager.getGoalManager();
            
            if (goalManager) {
              // Process new goals
              for (const newGoal of markers.newGoals) {
                try {
                  goalManager.createGoal(newGoal.description, newGoal.priority);
                  console.log(`[Marker] Created goal: ${newGoal.description}`);
                } catch (err) {
                  console.error('[Marker] Failed to create goal:', err);
                }
              }
              
              // Process checkpoints
              const activeGoal = goalManager.getActiveGoal();
              if (activeGoal) {
                for (const checkpoint of markers.checkpoints) {
                  try {
                    goalManager.createCheckpoint(
                      activeGoal.id,
                      checkpoint.description,
                      {},
                      checkpoint.description
                    );
                    console.log(`[Marker] Created checkpoint: ${checkpoint.description}`);
                  } catch (err) {
                    console.error('[Marker] Failed to create checkpoint:', err);
                  }
                }
                
                // Process decisions
                for (const decision of markers.decisions) {
                  try {
                    const decisionObj = goalManager.recordDecision(
                      activeGoal.id,
                      decision.description,
                      decision.rationale
                    );
                    if (decision.locked) {
                      goalManager.lockDecision(activeGoal.id, decisionObj.id);
                    }
                    console.log(`[Marker] Recorded decision: ${decision.description}`);
                  } catch (err) {
                    console.error('[Marker] Failed to record decision:', err);
                  }
                }
                
                // Process artifacts
                for (const artifact of markers.artifacts) {
                  try {
                    const artifactType = artifact.path.endsWith('.test.ts') || artifact.path.endsWith('.test.js')
                      ? 'test'
                      : artifact.path.endsWith('.md')
                      ? 'documentation'
                      : 'file';
                    
                    goalManager.recordArtifact(
                      activeGoal.id,
                      artifactType,
                      artifact.path,
                      artifact.action
                    );
                    console.log(`[Marker] Recorded artifact: ${artifact.path} (${artifact.action})`);
                  } catch (err) {
                    console.error('[Marker] Failed to record artifact:', err);
                  }
                }
                
                // Process goal completion
                if (markers.goalComplete) {
                  try {
                    goalManager.completeGoal(activeGoal.id, markers.goalComplete);
                    console.log(`[Marker] Completed goal: ${markers.goalComplete}`);
                  } catch (err) {
                    console.error('[Marker] Failed to complete goal:', err);
                  }
                }
                
                // Process goal pause
                if (markers.goalPause) {
                  try {
                    goalManager.pauseGoal(activeGoal.id);
                    console.log(`[Marker] Paused goal: ${activeGoal.description}`);
                  } catch (err) {
                    console.error('[Marker] Failed to pause goal:', err);
                  }
                }
              } else if (markers.checkpoints.length > 0 || markers.decisions.length > 0 || 
                         markers.artifacts.length > 0 || markers.goalComplete || markers.goalPause) {
                console.warn('[Marker] No active goal - checkpoint/decision/artifact/complete/pause markers ignored');
              }
            }
          } catch (err) {
            // Log error but continue - marker parsing is optional
            console.error('[Marker] Failed to parse goal management markers:', err);
          }
        } catch (error) {
          // Log error but continue
          console.error('Failed to add assistant message to context manager:', error);
        }
      }

      // Record tool calls (Requirement 1.3)
      if (sessionId && this.recordingService && turnToolCalls.length > 0) {
        for (const { toolCall, result } of turnToolCalls) {
          try {
            const sessionToolCall: SessionToolCall = {
              id: toolCall.id,
              name: toolCall.name,
              args: toolCall.args,
              result: {
                llmContent: typeof result === 'string' ? result : JSON.stringify(result),
                returnDisplay: typeof result === 'string' ? result : undefined,
              },
              timestamp: new Date().toISOString(),
            };
            await this.recordingService.recordToolCall(sessionId, sessionToolCall);
          } catch (error) {
            // Log error but continue (Requirement 10.1)
            console.error('Failed to record tool call:', error);
          }
        }
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

    // Save session on exit (Requirement 9.2)
    if (sessionId && this.recordingService) {
      try {
        await this.recordingService.saveSession(sessionId);
        
        // Emit session_end event
        this.messageBus.emit('session_end', {
          sessionId,
          duration: Date.now() - (new Date().getTime()), // Approximate
          turnCount: turnNumber,
          messageCount: messages.length,
        });
      } catch (error) {
        // Log error but don't fail (Requirement 10.1)
        console.error('Failed to save session on exit:', error);
      }
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

  /**
   * Convert Message to SessionMessage format
   * @param message The message to convert
   * @returns SessionMessage
   */
  private messageToSessionMessage(message: Message): SessionMessage {
    return {
      role: message.role,
      parts: message.parts.map(part => ({
        type: 'text',
        text: part.type === 'text' ? part.text : '',
      })),
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Convert SessionMessage to Message format
   * @param sessionMessage The session message to convert
   * @returns Message
   */
  private sessionMessageToMessage(sessionMessage: SessionMessage): Message {
    return {
      role: sessionMessage.role,
      parts: sessionMessage.parts.map(part => ({
        type: 'text',
        text: part.text,
      })),
    };
  }
}
