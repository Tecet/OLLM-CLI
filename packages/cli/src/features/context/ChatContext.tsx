import React, { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode } from 'react';
import { useContextManager } from './ContextManagerContext.js';
import { commandRegistry } from '../../commands/index.js';
import { useServices } from './ServiceContext.js';
import { useModel } from './ModelContext.js';
import { useUI } from './UIContext.js';
import { ToolRegistry, HotSwapTool, MemoryDumpTool, PromptRegistry } from '@ollm/core';
import type { ToolCall as CoreToolCall, ContextMessage, ProviderMetrics } from '@ollm/core';

declare global {
  var __ollmModelSwitchCallback: ((model: string) => void) | undefined;
  var __ollmOpenModelMenu: (() => void) | undefined;
}

/**
 * Tool call information for UI
 */
export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  result?: string;
  duration?: number;
  status: 'pending' | 'success' | 'error';
}

/**
 * Reasoning block from model thinking process
 */
export interface ReasoningBlock {
  content: string;
  tokenCount: number;
  duration: number;
  complete: boolean;
}

/**
 * Inference metrics for performance tracking
 */
export interface InferenceMetrics {
  // Raw values from provider
  promptTokens: number;
  completionTokens: number;
  totalDuration: number;       // Nanoseconds
  promptDuration: number;      // Nanoseconds
  evalDuration: number;        // Nanoseconds
  
  // Calculated values
  tokensPerSecond: number;
  timeToFirstToken: number;    // Seconds
  totalSeconds: number;
  
  // Optional
  loadDuration?: number;
}

/**
 * Chat message
 */
export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  timestamp: Date;
  
  // Optional fields
  toolCalls?: ToolCall[];
  reasoning?: ReasoningBlock;
  metrics?: InferenceMetrics;
  
  // UI state
  expanded?: boolean;
  editing?: boolean;
  
  // Context management
  excludeFromContext?: boolean;
  toolCallId?: string; // For tool role
}

/**
 * Chat state
 */
export interface ChatState {
  messages: Message[];
  streaming: boolean;
  waitingForResponse: boolean;
  currentInput: string;
  inputMode: 'text' | 'menu';
  menuState: MenuState;
}

export interface MenuOption {
  id: string;
  label: string;
  action: () => void | Promise<void>;
  value?: unknown;
  disabled?: boolean;
}

export interface MenuState {
  active: boolean;
  options: MenuOption[];
  selectedIndex: number;
  messageId?: string; // ID of the message this menu is attached to
}

/**
 * Chat context value
 */
export interface ChatContextValue {
  state: ChatState;
  
  /** Send a message to the assistant */
  sendMessage: (content: string) => Promise<void>;
  
  /** Cancel the current generation */
  cancelGeneration: () => void;
  
  /** Clear all messages */
  clearChat: () => void;
  
  /** Edit a message */
  editMessage: (id: string, content: string) => void;
  
  /** Set the current input value */
  setCurrentInput: (input: string) => void;
  
  /** Add a message to the chat */
  addMessage: (message: Omit<Message, 'id' | 'timestamp'>) => void;
  
  /** Update a message */
  updateMessage: (id: string, updates: Partial<Message>) => void;
  
  /** Set streaming state */
  setStreaming: (streaming: boolean) => void;
  
  /** Set waiting for response state */
  setWaitingForResponse: (waiting: boolean) => void;

  /** Current context usage stats */
  contextUsage: {
    currentTokens: number;
    maxTokens: number;
  };

  /** Set input mode */
  setInputMode: (mode: 'text' | 'menu') => void;

  /** Update menu state */
  setMenuState: (state: Partial<MenuState>) => void;

  /** Execute selected menu option */
  executeMenuOption: () => Promise<void>;

  /** Navigate menu */
  navigateMenu: (direction: 'up' | 'down') => void;
  
  /** Activate menu for a message */
  activateMenu: (options: MenuOption[], messageId?: string) => void;

  /** Request manual context input */
  requestManualContextInput: (modelId: string, onComplete: (value: number) => void | Promise<void>) => void;

  /** Scroll State */
  selectedLineIndex: number;
  setSelectedLineIndex: (index: number) => void;
  scrollOffset: number;
  scrollUp: () => void;
  scrollDown: () => void;
}

const ChatContext = createContext<ChatContextValue | undefined>(undefined);

export interface ChatProviderProps {
  children: ReactNode;
  
  /** Initial messages */
  initialMessages?: Message[];
  
  /** Callback when a message is sent */
  onSendMessage?: (content: string) => Promise<void>;
  
  /** Callback when generation is cancelled */
  onCancelGeneration?: () => void;
}

export function ChatProvider({
  children,
  initialMessages = [],
  onSendMessage: _onSendMessage, 
  onCancelGeneration: _onCancelGeneration,
}: ChatProviderProps) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [streaming, setStreaming] = useState(false);
  const [waitingForResponse, setWaitingForResponse] = useState(false);
  const [currentInput, setCurrentInput] = useState('');
  const [selectedLineIndex, setSelectedLineIndex] = useState(0);
  
  // Menu State
  const [inputMode, setInputMode] = useState<'text' | 'menu'>('text');
  const [menuState, setMenuState] = useState<MenuState>({
    active: false,
    options: [],
    selectedIndex: 0,
  });
  
  const { actions: contextActions, state: contextManagerState } = useContextManager();
  const contextUsage = contextManagerState.usage;

  const { setLaunchScreenVisible, setTheme } = useUI();
  const { container: serviceContainer } = useServices();
  const { sendToLLM, cancelRequest, setCurrentModel, provider, currentModel } = useModel();
  
  const assistantMessageIdRef = useRef<string | null>(null);
  const manualContextRequestRef = useRef<{ modelId: string; onComplete: (value: number) => void | Promise<void> } | null>(null);
  
  useEffect(() => {
    if (serviceContainer) {
      commandRegistry.setServiceContainer(serviceContainer);
      globalThis.__ollmModelSwitchCallback = setCurrentModel;
    }
  }, [serviceContainer, setCurrentModel]);

  useEffect(() => {
    if (setTheme) {
      commandRegistry.setThemeCallback(setTheme);
    }
  }, [setTheme]);

  const addMessage = useCallback((message: Omit<Message, 'id' | 'timestamp'>) => {
    const newMessage: Message = {
      ...message,
      id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, newMessage]);
    return newMessage;
    // Note: We don't automatically add to contextManager here anymore to avoid duplication
    // and to ensure better control over tool call/result sequencing.
  }, []);

  const updateMessage = useCallback((id: string, updates: Partial<Message>) => {
    setMessages((prev) =>
      prev.map((msg) => (msg.id === id ? { ...msg, ...updates } : msg))
    );
  }, []);

  const clearChat = useCallback(() => {
    setMessages([]);
    setCurrentInput('');
    setStreaming(false);
    setWaitingForResponse(false);
    if (contextActions) {
      contextActions.clear().catch(console.error);
    }
  }, [contextActions]);

  const sendMessage = useCallback(
    async (content: string) => {
      if (manualContextRequestRef.current) {
        const request = manualContextRequestRef.current;
        const trimmed = content.trim();
        const normalized = trimmed.toLowerCase();
        if (normalized === 'cancel' || normalized === 'back' || normalized === 'exit') {
          manualContextRequestRef.current = null;
          addMessage({
            role: 'system',
            content: 'Manual context entry cancelled.',
            excludeFromContext: true
          });
          return;
        }
        const value = Number.parseInt(trimmed, 10);
        if (!Number.isFinite(value) || value <= 0) {
          addMessage({
            role: 'system',
            content: 'Invalid context size. Enter a positive integer, or type "cancel" to abort.',
            excludeFromContext: true
          });
          return;
        }
        manualContextRequestRef.current = null;
        await request.onComplete(value);
        return;
      }
      // Add user message to UI
      addMessage({
        role: 'user',
        content,
      });

      // Clear input
      setCurrentInput('');

      // Check for commands
      if (commandRegistry.isCommand(content)) {
        try {
          const result = await commandRegistry.execute(content);
          if (result.action === 'show-launch-screen') setLaunchScreenVisible(true);
          if (result.action === 'clear-chat') {
              clearChat();
          }
          if (result.action === 'exit') {
            if (provider?.unloadModel && currentModel) {
              try {
                addMessage({
                  role: 'system',
                  content: `Unloading model "${currentModel}"...`,
                  excludeFromContext: true
                });
                await provider.unloadModel(currentModel);
                addMessage({
                  role: 'system',
                  content: `Model "${currentModel}" unloaded.`,
                  excludeFromContext: true
                });
                await new Promise(resolve => setTimeout(resolve, 250));
              } catch (error) {
                addMessage({
                  role: 'system',
                  content: `Failed to unload model "${currentModel}": ${error instanceof Error ? error.message : String(error)}`,
                  excludeFromContext: true
                });
              }
            }
            process.exit(0);
          }
          addMessage({
            role: 'system',
            content: result.message || (result.success ? 'Command executed successfully' : 'Command failed'),
            excludeFromContext: true
          });
        } catch (error) {
          addMessage({
            role: 'system',
            content: `Command error: ${error instanceof Error ? error.message : String(error)}`,
            excludeFromContext: true
          });
        }
        return;
      }

      setWaitingForResponse(true);
      setStreaming(true);

      const toolRegistry = new ToolRegistry();
      const promptRegistry = new PromptRegistry();
      
      const manager = contextActions.getManager();
      if (manager && provider) {
          toolRegistry.register(new HotSwapTool(manager, promptRegistry, provider, currentModel));
          toolRegistry.register(new MemoryDumpTool());
          const toolNames = toolRegistry.list().map(t => t.name);
          manager.emit('active-tools-updated', toolNames);
      }

      // 1. Initial user message addition to context manager
      if (contextActions) {
          await contextActions.addMessage({ role: 'user', content });
      }

      // Assistant message ID for this turn
      const assistantMsg = addMessage({
        role: 'assistant',
        content: '',
      });
      let currentAssistantMsgId = assistantMsg.id;
      assistantMessageIdRef.current = currentAssistantMsgId;

      // Agent Loop
      const maxTurns = 5;
      let turnCount = 0;
      let stopLoop = false;

      while (turnCount < maxTurns && !stopLoop) {
        turnCount++;
        
        // Prepare history from authoritative context manager
        const currentContext = await contextActions.getContext();
        const history = currentContext
          .filter((m: ContextMessage) => m.role !== 'system') // Filter out system messages
          .map((m: ContextMessage) => ({
            role: m.role as 'user' | 'assistant' | 'system' | 'tool',
            content: m.content || '',
            toolCalls: m.toolCalls?.map(tc => ({
                id: tc.id,
                name: tc.name,
                args: tc.args
            })),
            toolCallId: m.toolCallId
          }));

        let toolCallReceived: CoreToolCall | null = null;
        let assistantContent = '';

        try {
          await sendToLLM(
            history,
            // onText
            (text: string) => {
              const targetId = currentAssistantMsgId;
              assistantContent += text;
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === targetId ? { ...msg, content: msg.content + text } : msg
                )
              );
            },
            // onError
            (error: string) => {
              const targetId = currentAssistantMsgId;
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === targetId ? { ...msg, content: msg.content ? `${msg.content}\n\n**Error:** ${error}` : `Error: ${error}` } : msg
                )
              );
              stopLoop = true;
            },
            // onComplete
            (metrics?: ProviderMetrics) => {
              const targetId = currentAssistantMsgId;
              if (metrics && assistantMessageIdRef.current === targetId) {
                 setMessages(prev => prev.map(msg => msg.id === targetId ? {
                     ...msg,
                     metrics: {
                        promptTokens: metrics.promptEvalCount,
                        completionTokens: metrics.evalCount,
                        totalDuration: metrics.totalDuration,
                        promptDuration: metrics.promptEvalDuration,
                        evalDuration: metrics.evalDuration,
                        tokensPerSecond: metrics.evalDuration > 0 ? Math.round((metrics.evalCount / (metrics.evalDuration / 1e9)) * 100) / 100 : 0,
                        timeToFirstToken: 0,
                        totalSeconds: Math.round((metrics.totalDuration / 1e9) * 100) / 100,
                        loadDuration: metrics.loadDuration
                     }
                 } : msg));
              }
            },
            (toolCall: CoreToolCall) => {
               toolCallReceived = toolCall;
            },
            toolRegistry.list().map(t => t.schema),
            contextActions.getSystemPrompt()
          );

          // ALWAYS add assistant turn to context manager if it produced content OR tool calls
          if (assistantContent || toolCallReceived) {
              const tc = toolCallReceived as CoreToolCall | null;
              await contextActions.addMessage({
                  role: 'assistant',
                  content: assistantContent,
                  toolCalls: tc ? [{
                      id: tc.id,
                      name: tc.name,
                      args: tc.args
                  }] : undefined
              });
              
              // If we only have tool calls and no content, we can optionally hide the empty bubble in UI
              // but for now we keep it for status visibility.
          } else if (turnCount === 1) {
              // If the very first turn produced nothing, something is wrong
              console.warn('LLM produced empty response on first turn');
          }

          if (toolCallReceived) {
              const tc = toolCallReceived as CoreToolCall;
              const tool = toolRegistry.get(tc.name);
              
              // Update UI with tool call
              const targetId = currentAssistantMsgId;
              setMessages(prev => prev.map(msg => 
                  msg.id === targetId ? {
                      ...msg,
                      toolCalls: [...(msg.toolCalls || []), {
                          id: tc.id,
                          name: tc.name,
                          arguments: tc.args,
                          status: 'pending'
                      } as ToolCall]
                  } : msg
              ));

              if (tool) {
                  const toolContext = {
                      messageBus: { requestConfirmation: async () => true },
                      policyEngine: { evaluate: () => 'allow' as const, getRiskLevel: () => 'low' as const }
                  };
                  const invocation = tool.createInvocation(tc.args, toolContext);
                  const result = await invocation.execute(new AbortController().signal);
                  
                  // Add tool result to context manager
                  await contextActions.addMessage({
                      role: 'tool',
                      content: result.llmContent,
                      toolCallId: tc.id
                  });

                  // Update UI with result
                  const targetId = currentAssistantMsgId;
                  setMessages(prev => prev.map(msg => 
                      msg.id === targetId ? {
                          ...msg,
                          toolCalls: msg.toolCalls?.map(item => 
                              item.id === tc.id ? { ...item, status: 'success', result: result.returnDisplay } : item
                          )
                      } : msg
                  ));

                  if (tc.name === 'trigger_hot_swap') {
                      // Post-swap: start a fresh assistant message for the next turn
                      const swapMsg = addMessage({ role: 'assistant', content: '' });
                      currentAssistantMsgId = swapMsg.id;
                      assistantMessageIdRef.current = currentAssistantMsgId;
                  }
              } else {
                  await contextActions.addMessage({
                      role: 'tool',
                      content: `Error: Tool ${tc.name} not found`,
                      toolCallId: tc.id
                  });
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

      setStreaming(false);
      setWaitingForResponse(false);
      assistantMessageIdRef.current = null;
    },
    [addMessage, sendToLLM, setLaunchScreenVisible, contextActions, provider, currentModel, clearChat]
  );

  const cancelGeneration = useCallback(() => {
    cancelRequest();
    setStreaming(false);
    setWaitingForResponse(false);
    assistantMessageIdRef.current = null;
    if (_onCancelGeneration) {
      _onCancelGeneration();
    }
  }, [_onCancelGeneration, cancelRequest]);


  const editMessage = useCallback(
    (id: string, content: string) => {
      updateMessage(id, { content, editing: false });
    },
    [updateMessage]
  );

  const value: ChatContextValue = {
    state: {
      messages,
      streaming,
      waitingForResponse,
      currentInput,
      inputMode,
      menuState,
    },
    sendMessage,
    cancelGeneration,
    clearChat,
    editMessage,
    setCurrentInput,
    addMessage,
    updateMessage,
    setStreaming,
    setWaitingForResponse,
    contextUsage,
    setInputMode,
    setMenuState: (updates) => setMenuState(prev => ({ ...prev, ...updates })),
    executeMenuOption: async () => {
        if (!menuState.active || !menuState.options[menuState.selectedIndex]) return;
        const option = menuState.options[menuState.selectedIndex];
        setInputMode('text');
        setMenuState(prev => ({ ...prev, active: false }));
        await option.action();
    },
    navigateMenu: (direction) => {
        setMenuState(prev => {
            const count = prev.options.length;
            if (count === 0) return prev;
            let nextIndex = prev.selectedIndex;
            if (direction === 'up') {
                nextIndex = (prev.selectedIndex - 1 + count) % count;
            } else {
                nextIndex = (prev.selectedIndex + 1) % count;
            }
            return { ...prev, selectedIndex: nextIndex };
        });
    },
    activateMenu: (options, messageId) => {
        const orderedOptions = [
            ...options.filter(option => option.id === 'opt-back'),
            ...options.filter(option => option.id === 'opt-exit'),
            ...options.filter(option => option.id !== 'opt-back' && option.id !== 'opt-exit'),
        ];
        setMenuState({
            active: true,
            options: orderedOptions,
            selectedIndex: 0,
            messageId
        });
        setInputMode('menu');
    },
    requestManualContextInput: (modelId, onComplete) => {
        manualContextRequestRef.current = { modelId, onComplete };
        setMenuState(prev => ({ ...prev, active: false }));
        setInputMode('text');
    },
    // Scroll Logic
    selectedLineIndex,
    setSelectedLineIndex,
    scrollOffset: 0, // Placeholder, see below implementation
    scrollUp: () => {},
    scrollDown: () => {},
  };

  // State for Scroll
  const [scrollOffset, setScrollOffset] = useState(0);

  // Reset scroll when messages change (new message usually means scroll to bottom)
  // BUT: user might be reading old history. We only reset if we were at 0? 
  // Standard behavior: auto-scroll to bottom if at bottom.
  // For now to match previous behavior: reset to 0 on new message IF we are not in deep history?
  // Let's keep it simple: Reset to 0 (bottom) when new user message sent.
  useEffect(() => {
      // If we are streaming (assistant typing), we want to stay at 0.
      if (streaming) setScrollOffset(0);
  }, [messages.length, streaming]);

  const contextValue: ChatContextValue = {
      ...value,
      selectedLineIndex,
      setSelectedLineIndex,
      scrollOffset,
      scrollUp: useCallback(() => {
          setSelectedLineIndex(prev => Math.max(0, prev - 1));
      }, []),
      scrollDown: useCallback(() => {
          setSelectedLineIndex(prev => prev + 1);
      }, [])
  };

  return <ChatContext.Provider value={contextValue}>{children}</ChatContext.Provider>;
}

export function useChat(): ChatContextValue {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
}
