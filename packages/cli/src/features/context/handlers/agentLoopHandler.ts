/**
 * Agent Loop Handler
 *
 * Handles the multi-turn agent loop with tool execution.
 * Extracted from ChatContext.tsx for better separation of concerns.
 *
 * The agent loop:
 * 1. Prepares conversation history
 * 2. Sends request to LLM with streaming
 * 3. Handles reasoning/thinking
 * 4. Executes tool calls
 * 5. Repeats until no more tool calls or max turns reached
 */

import { ReasoningParser } from '@ollm/ollm-cli-core/services/reasoningParser.js';

import { SettingsService } from '../../../config/settingsService.js';

import type { Message, ToolCall } from '../types/chatTypes.js';
import type {
  ContextMessage,
  ToolCall as CoreToolCall,
  ProviderMetrics,
  ToolSchema,
  ProviderAdapter,
} from '@ollm/core';

/**
 * Dependencies required by agent loop
 */
export interface AgentLoopDependencies {
  // UI State Management
  addMessage: (message: Omit<Message, 'id' | 'timestamp'>) => Message;
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;

  // Context Management
  contextActions: {
    getContext: () => Promise<ContextMessage[]>;
    addMessage: (message: Omit<ContextMessage, 'id' | 'timestamp'>) => Promise<void>;
    reportInflightTokens?: (tokens: number) => void;
    clearInflightTokens?: () => void;
  };

  // LLM Communication
  sendToLLM: (
    history: any[],
    onText: (text: string) => void,
    onError: (error: string) => void,
    onComplete: (metrics?: ProviderMetrics, finishReason?: 'stop' | 'length' | 'tool') => void,
    onToolCall: (toolCall: CoreToolCall) => void,
    onThinking: (thinking: string) => void,
    toolSchemas?: ToolSchema[],
    systemPrompt?: string,
    timeout?: number,
    temperature?: number
  ) => Promise<void>;
  cancelRequest: () => void;

  // Model & Provider
  currentModel: string;
  provider: ProviderAdapter | null;

  // Tool Registry
  serviceContainer: any;
  toolSchemas?: ToolSchema[];

  // System Prompt
  systemPrompt: string;

  // Session Recording
  recordSessionMessage: (role: 'user' | 'assistant', text: string) => Promise<void>;

  // Refs
  assistantMessageIdRef: React.MutableRefObject<string | null>;
  compressionOccurredRef: React.MutableRefObject<boolean>;
  compressionRetryCountRef: React.MutableRefObject<number>;
  lastUserMessageRef: React.MutableRefObject<string | null>;
  inflightTokenAccumulatorRef: React.MutableRefObject<number>;
  inflightFlushTimerRef: React.MutableRefObject<NodeJS.Timeout | null>;

  // Mode Manager
  modeManager?: any;
}

/**
 * Result of agent loop execution
 */
export interface AgentLoopResult {
  turns: number;
  success: boolean;
}

/**
 * Run the agent loop
 *
 * @param deps - Dependencies required by agent loop
 * @returns Promise that resolves with loop result
 */
export async function runAgentLoop(deps: AgentLoopDependencies): Promise<AgentLoopResult> {
  const {
    addMessage,
    setMessages,
    contextActions,
    sendToLLM,
    cancelRequest,
    currentModel,
    serviceContainer,
    toolSchemas,
    systemPrompt,
    recordSessionMessage,
    assistantMessageIdRef,
    compressionOccurredRef,
    compressionRetryCountRef,
    lastUserMessageRef,
    inflightTokenAccumulatorRef,
    inflightFlushTimerRef,
    modeManager,
  } = deps;

  const maxTurns = 5;
  let turnCount = 0;
  let stopLoop = false;

  // Track initial model at start of agent loop
  const initialModel = currentModel;

  // Get current assistant message ID
  let currentAssistantMsgId = assistantMessageIdRef.current;
  if (!currentAssistantMsgId) {
    throw new Error('No assistant message ID set');
  }

  while (turnCount < maxTurns && !stopLoop) {
    turnCount++;

    // Detect model change mid-loop
    if (currentModel !== initialModel) {
      addMessage({
        role: 'system',
        content: 'Model changed during conversation. Completing current turn...',
        excludeFromContext: true,
      });
      stopLoop = true; // Complete this turn, stop after
    }

    // Prepare history from authoritative context manager
    const currentContext = await contextActions.getContext();

    // Exclude system messages from the payload; system prompt is sent separately
    const history = currentContext
      .filter((m: ContextMessage) => m.role !== 'system')
      .map((m: ContextMessage) => ({
        role: m.role as 'user' | 'assistant' | 'system' | 'tool',
        content: m.content || '',
        toolCalls: m.toolCalls?.map((tc) => ({
          id: tc.id,
          name: tc.name,
          args: tc.args,
        })),
        toolCallId: m.toolCallId,
      }));

    let toolCallReceived: CoreToolCall | null = null;
    let assistantContent = '';
    let thinkingContent = ''; // Track thinking content from Ollama

    // Initialize reasoning parser for fallback <think> tag parsing
    const reasoningParser = new ReasoningParser();
    const parserState = reasoningParser.createInitialState();

    // Emit before_model hook event
    if (serviceContainer) {
      const hookService = serviceContainer.getHookService();
      hookService.emitEvent('before_model', {
        model: currentModel,
        turn: turnCount,
        historyLength: history.length,
        toolsAvailable: toolSchemas?.length || 0,
        timestamp: new Date().toISOString(),
      });
    }

    // Calculate mode-specific temperature
    const temperature = (() => {
      const settingsService = SettingsService.getInstance();
      const settings = settingsService.getSettings();
      if (settings.llm?.modeLinkedTemperature !== false && modeManager) {
        return modeManager.getPreferredTemperature(modeManager.getCurrentMode());
      }
      return undefined;
    })();

    try {
      await sendToLLM(
        history,
        // onText
        (text: string) => {
          const targetId = currentAssistantMsgId;

          // Only parse for <think> tags if we're NOT receiving native thinking events
          // Native thinking takes precedence
          if (!thinkingContent) {
            // Parse text for <think> tags as fallback when native thinking isn't available
            const newParserState = reasoningParser.parseStreaming(text, parserState);
            Object.assign(parserState, newParserState);

            // If we have thinking content from parsing, update reasoning
            if (parserState.thinkContent) {
              setMessages((prev) =>
                prev.map((msg) => {
                  if (msg.id !== targetId) return msg;

                  return {
                    ...msg,
                    reasoning: {
                      content: parserState.thinkContent,
                      tokenCount: Math.ceil(parserState.thinkContent.length / 4),
                      duration: 0,
                      complete: !parserState.inThinkBlock,
                    },
                    expanded: true, // Keep expanded while streaming
                  };
                })
              );
            }

            // Use response content (with <think> tags removed) instead of raw text
            assistantContent = parserState.responseContent;
          } else {
            // Native thinking is active, use raw text as-is
            assistantContent += text;
          }

          // Estimate tokens for this chunk and batch-report as in-flight
          try {
            if (contextActions && contextActions.reportInflightTokens) {
              const estimatedTokens = Math.max(1, Math.ceil(text.length / 4));
              inflightTokenAccumulatorRef.current += estimatedTokens;
              // schedule a flush if not already scheduled
              if (!inflightFlushTimerRef.current) {
                inflightFlushTimerRef.current = setTimeout(() => {
                  try {
                    const toReport = inflightTokenAccumulatorRef.current;
                    inflightTokenAccumulatorRef.current = 0;
                    inflightFlushTimerRef.current = null;
                    if (toReport > 0 && contextActions.reportInflightTokens) {
                      contextActions.reportInflightTokens(toReport);
                    }
                  } catch (_e) {
                    inflightTokenAccumulatorRef.current = 0;
                    inflightFlushTimerRef.current = null;
                  }
                }, 500);
              }
            }
          } catch (_e) {
            // ignore estimation/report errors
          }

          // Update message with content (reasoning already updated above if present)
          setMessages((prev) =>
            prev.map((msg) => {
              if (msg.id !== targetId) return msg;
              return { ...msg, content: assistantContent };
            })
          );
        },
        // onError
        (error: string) => {
          const targetId = currentAssistantMsgId;
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === targetId
                ? {
                    ...msg,
                    content: msg.content
                      ? `${msg.content}\n\n**Error:** ${error}`
                      : `Error: ${error}`,
                    excludeFromContext: true,
                  }
                : msg
            )
          );
          // Clear any inflight token accounting and cancel flush timer
          try {
            if (inflightFlushTimerRef.current) {
              clearTimeout(inflightFlushTimerRef.current);
              inflightFlushTimerRef.current = null;
              inflightTokenAccumulatorRef.current = 0;
            }
            if (contextActions?.clearInflightTokens) {
              contextActions.clearInflightTokens();
            }
          } catch (_e) {
            /* ignore cleanup errors */
          }
          stopLoop = true;
        },
        // onComplete
        (metrics?: ProviderMetrics, _finishReason?: 'stop' | 'length' | 'tool') => {
          const targetId = currentAssistantMsgId;
          if (metrics && assistantMessageIdRef.current === targetId) {
            setMessages((prev) =>
              prev.map((msg) => {
                if (msg.id !== targetId) return msg;

                const updates: Partial<Message> = {
                  metrics: {
                    promptTokens: metrics.promptEvalCount,
                    completionTokens: metrics.evalCount,
                    totalDuration: metrics.totalDuration,
                    promptDuration: metrics.promptEvalDuration,
                    evalDuration: metrics.evalDuration,
                    tokensPerSecond:
                      metrics.evalDuration > 0
                        ? Math.round((metrics.evalCount / (metrics.evalDuration / 1e9)) * 100) / 100
                        : 0,
                    timeToFirstToken: 0,
                    totalSeconds: Math.round((metrics.totalDuration / 1e9) * 100) / 100,
                    loadDuration: metrics.loadDuration,
                  },
                };

                // Mark reasoning as complete and calculate duration
                if (msg.reasoning) {
                  updates.reasoning = {
                    ...msg.reasoning,
                    complete: true,
                    duration: metrics.evalDuration > 0 ? metrics.evalDuration / 1e9 : 0,
                  };
                  // Auto-collapse reasoning when complete so response is visible
                  updates.expanded = false;
                }

                return { ...msg, ...updates };
              })
            );
          }

          // Emit after_model hook event
          if (serviceContainer) {
            const hookService = serviceContainer.getHookService();
            hookService.emitEvent('after_model', {
              model: currentModel,
              turn: turnCount,
              metrics: metrics
                ? {
                    promptTokens: metrics.promptEvalCount,
                    completionTokens: metrics.evalCount,
                    totalSeconds: metrics.totalDuration / 1e9,
                  }
                : undefined,
              timestamp: new Date().toISOString(),
            });
          }
          // Flush any pending inflight tokens and clear accounting now that generation completed
          try {
            if (inflightFlushTimerRef.current) {
              clearTimeout(inflightFlushTimerRef.current);
              inflightFlushTimerRef.current = null;
            }
            const pending = inflightTokenAccumulatorRef.current;
            inflightTokenAccumulatorRef.current = 0;
            if (pending > 0 && contextActions?.reportInflightTokens) {
              contextActions.reportInflightTokens(pending);
            }
            if (contextActions?.clearInflightTokens) {
              contextActions.clearInflightTokens();
            }
          } catch (_e) {
            /* ignore */
          }
        },
        (toolCall: CoreToolCall) => {
          toolCallReceived = toolCall;
        },
        // onThinking - Handle Ollama native thinking (primary method)
        (thinking: string) => {
          const targetId = currentAssistantMsgId;
          thinkingContent += thinking;

          // Update message with thinking content from native events
          // This takes precedence over parsed <think> tags
          setMessages((prev) =>
            prev.map((msg) => {
              if (msg.id !== targetId) return msg;

              return {
                ...msg,
                reasoning: {
                  content: thinkingContent,
                  tokenCount: Math.ceil(thinkingContent.length / 4),
                  duration: 0, // Will be updated on complete
                  complete: false,
                },
                expanded: true, // Keep expanded while streaming
              };
            })
          );
        },
        toolSchemas,
        systemPrompt,
        120000, // timeout (ms)
        temperature
      );

      // If compression occurred during generation, retry once using updated context
      if (compressionOccurredRef.current && compressionRetryCountRef.current < 1) {
        compressionRetryCountRef.current += 1;
        compressionOccurredRef.current = false;
        // Cancel any existing provider request and prepare to retry
        try {
          cancelRequest();
        } catch (_e) {
          /* ignore */
        }

        // Ensure the last user message is present in the context after compression
        try {
          const lastUser = lastUserMessageRef.current;
          if (lastUser && contextActions) {
            const ctx = await contextActions.getContext();
            const lastUserInCtx = [...ctx]
              .reverse()
              .find((m: ContextMessage) => m.role === 'user')?.content;
            if (lastUserInCtx !== lastUser) {
              await contextActions.addMessage({ role: 'user', content: lastUser });
            }
          }
        } catch (_e) {
          // ignore errors re-adding the user message
        }

        // Create a fresh assistant message for the retry
        const retryAssistant = addMessage({ role: 'assistant', content: '', expanded: true });
        currentAssistantMsgId = retryAssistant.id;
        assistantMessageIdRef.current = currentAssistantMsgId;
        assistantContent = '';
        thinkingContent = '';
        stopLoop = false; // continue loop to retry
        continue; // go to next iteration and re-run sendToLLM with updated history
      }

      // ALWAYS add assistant turn to context manager if it produced content OR tool calls
      if (assistantContent || toolCallReceived) {
        const tc = toolCallReceived as CoreToolCall | null;

        // Check if we should include thinking in context (experimental feature)
        const settingsService = SettingsService.getInstance();
        const settings = settingsService.getSettings();
        const includeThinkingInContext = settings.llm?.includeThinkingInContext ?? false;

        // Build content: response + optional thinking summary
        let contextContent = assistantContent;
        if (includeThinkingInContext && thinkingContent) {
          // Add a brief summary of the thinking process to context
          const thinkingSummary =
            thinkingContent.length > 200
              ? `[Reasoning: ${thinkingContent.substring(0, 200)}...]`
              : `[Reasoning: ${thinkingContent}]`;
          contextContent = `${thinkingSummary}\n\n${assistantContent}`;
        }

        await contextActions.addMessage({
          role: 'assistant',
          content: contextContent,
          toolCalls: tc
            ? [
                {
                  id: tc.id,
                  name: tc.name,
                  args: tc.args,
                },
              ]
            : undefined,
        });

        if (assistantContent) {
          await recordSessionMessage('assistant', assistantContent);
        }

        // If we only have tool calls and no content, we can optionally hide the empty bubble in UI
        // but for now we keep it for status visibility.
      } else if (turnCount === 1) {
        // If the very first turn produced nothing, something is wrong
        console.warn('LLM produced empty response on first turn');
      }

      if (toolCallReceived) {
        const tc = toolCallReceived as CoreToolCall;

        // Get tool registry from service container
        const toolRegistry = serviceContainer?.getToolRegistry();
        const tool = toolRegistry?.get(tc.name);

        // Update UI with tool call
        const targetId = currentAssistantMsgId;
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === targetId
              ? {
                  ...msg,
                  toolCalls: [
                    ...(msg.toolCalls || []),
                    {
                      id: tc.id,
                      name: tc.name,
                      arguments: tc.args,
                      status: 'pending',
                    } as ToolCall,
                  ],
                }
              : msg
          )
        );

        // Emit before_tool hook event
        if (serviceContainer) {
          const hookService = serviceContainer.getHookService();
          hookService.emitEvent('before_tool', {
            toolName: tc.name,
            toolArgs: tc.args,
            turn: turnCount,
            timestamp: new Date().toISOString(),
          });
        }

        // Verify tool permission before execution (prevents hallucinated calls)
        // Check if tool was in the schema we sent to LLM
        let toolAllowed = true;
        if (toolSchemas) {
          toolAllowed = toolSchemas.some((s) => s.name === tc.name);
        }

        if (tool && toolAllowed) {
          try {
            const toolContext = {
              messageBus: { requestConfirmation: async () => true },
              policyEngine: {
                evaluate: () => 'allow' as const,
                getRiskLevel: () => 'low' as const,
              },
            };

            let result: { llmContent: string; returnDisplay: string };

            const createInvocation = (tool as any)?.createInvocation; // Safely access optional method
            const executeDirect = (tool as any)?.execute; // Safely access old direct execute method

            if (typeof createInvocation === 'function') {
              const invocation = createInvocation.call(tool, tc.args, toolContext);
              result = (await invocation.execute(new AbortController().signal)) as {
                llmContent: string;
                returnDisplay: string;
              };
            } else if (typeof executeDirect === 'function') {
              // Fallback to old pattern where execute is directly on the tool
              result = (await executeDirect.call(tool, tc.args, toolContext)) as {
                llmContent: string;
                returnDisplay: string;
              };
            } else {
              throw new Error(
                `Tool ${tc.name} does not have a valid execute or createInvocation method.`
              );
            }

            // Add tool result to context manager
            await contextActions.addMessage({
              role: 'tool',
              content: result.llmContent,
              toolCallId: tc.id,
            });

            // Update UI with result
            const targetId = currentAssistantMsgId;
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === targetId
                  ? {
                      ...msg,
                      toolCalls: msg.toolCalls?.map((item) =>
                        item.id === tc.id
                          ? { ...item, status: 'success', result: result.returnDisplay }
                          : item
                      ),
                    }
                  : msg
              )
            );

            // Emit after_tool hook event
            if (serviceContainer) {
              const hookService = serviceContainer.getHookService();
              hookService.emitEvent('after_tool', {
                toolName: tc.name,
                toolArgs: tc.args,
                result: result.returnDisplay,
                success: true,
                turn: turnCount,
                timestamp: new Date().toISOString(),
              });
            }

            if (tc.name === 'trigger_hot_swap') {
              // Post-swap: start a fresh assistant message for the next turn
              const swapMsg = addMessage({ role: 'assistant', content: '', expanded: true });
              currentAssistantMsgId = swapMsg.id;
              assistantMessageIdRef.current = currentAssistantMsgId;
            }
          } catch (toolExecError) {
            const errorMessage =
              toolExecError instanceof Error ? toolExecError.message : String(toolExecError);
            await contextActions.addMessage({
              role: 'tool',
              content: `Error executing tool ${tc.name}: ${errorMessage}`,
              toolCallId: tc.id,
            });

            // Emit after_tool hook event for failed tool
            if (serviceContainer) {
              const hookService = serviceContainer.getHookService();
              hookService.emitEvent('after_tool', {
                toolName: tc.name,
                toolArgs: tc.args,
                error: errorMessage,
                success: false,
                turn: turnCount,
                timestamp: new Date().toISOString(),
              });
            }
            stopLoop = true;
          }
        } else {
          await contextActions.addMessage({
            role: 'tool',
            content: `Error: Tool ${tc.name} not found or denied`,
            toolCallId: tc.id,
          });

          // Emit after_tool hook event for failed tool
          if (serviceContainer) {
            const hookService = serviceContainer.getHookService();
            hookService.emitEvent('after_tool', {
              toolName: tc.name,
              toolArgs: tc.args,
              error: 'Tool not found or denied',
              success: false,
              turn: turnCount,
              timestamp: new Date().toISOString(),
            });
          }

          stopLoop = true;
        }
      } else {
        // No tool call received this turn, we are finished with the agent loop
        stopLoop = true;
      }
    } catch (turnErr) {
      console.error('Agent Turn Error:', turnErr);
      stopLoop = true;
    }
  }

  return {
    turns: turnCount,
    success: true,
  };
}
