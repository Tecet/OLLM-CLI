import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';

import {
  HotSwapTool,
  MemoryDumpTool,
  MODE_METADATA,
  PromptRegistry,
  PromptsSnapshotManager as _PromptsSnapshotManager,
} from '@ollm/core';

import { useContextManager } from './ContextManagerContext.js';
import { validateManualContext } from './contextSizing.js';
import { runAgentLoop } from './handlers/agentLoopHandler.js';
import { handleCommand } from './handlers/commandHandler.js';
import {
  createContextEventHandlers,
  registerContextEventHandlers,
} from './handlers/contextEventHandlers.js';
import { useModel } from './ModelContext.js';
import { useServices } from './ServiceContext.js';
import { useUI } from './UIContext.js';
import { useFocusedFilesInjection } from './useFocusedFilesInjection.js';
import {
  resolveTierForSize,
  toOperationalMode,
  loadTierPromptWithFallback,
} from './utils/promptUtils.js';
import { buildSystemPrompt } from './utils/systemPromptBuilder.js';
import { commandRegistry } from '../../commands/index.js';
import { profileManager } from '../profiles/ProfileManager.js';

import type {
  Message,
  MenuState,
  ChatContextValue,
  ChatProviderProps,
} from './types/chatTypes.js';
import type { ToolSchema } from '@ollm/core';

declare global {
  var __ollmModelSwitchCallback: ((model: string) => void) | undefined;
}

const ChatContext = createContext<ChatContextValue | undefined>(undefined);

// Re-export types for backward compatibility
export type {
  ToolCall,
  ReasoningBlock,
  InferenceMetrics,
  Message,
  ChatState,
  MenuOption,
  MenuState,
  ChatContextValue,
  ChatProviderProps,
} from './types/chatTypes.js';

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
  const [statusMessage, setStatusMessage] = useState<string | undefined>(undefined);
  
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
  const { sendToLLM, cancelRequest, setCurrentModel, provider, currentModel, modelSupportsTools } = useModel();
  const injectFocusedFilesIntoPrompt = useFocusedFilesInjection();
  
  const assistantMessageIdRef = useRef<string | null>(null);
  const recordingSessionIdRef = useRef<string | null>(null);
  const manualContextRequestRef = useRef<{ modelId: string; onComplete: (value: number) => void | Promise<void> } | null>(null);
  const compressionOccurredRef = useRef(false);
  const compressionRetryCountRef = useRef(0);
  const lastUserMessageRef = useRef<string | null>(null);
  const waitingForResumeRef = useRef(false);
  const inflightTokenAccumulatorRef = useRef(0);
  const inflightFlushTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Define addMessage before it's used in useEffect
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

  const recordSessionMessage = useCallback(async (role: 'user' | 'assistant', text: string) => {
    if (!serviceContainer) {
      return;
    }
    const recordingService = serviceContainer.getChatRecordingService?.();
    if (!recordingService) {
      return;
    }
    if (!recordingSessionIdRef.current) {
      try {
        recordingSessionIdRef.current = await recordingService.createSession(
          currentModel,
          provider?.name ?? 'unknown'
        );
      } catch (error) {
        console.error('[ChatRecording] Failed to create session:', error);
        return;
      }
    }
    try {
      await recordingService.recordMessage(recordingSessionIdRef.current, {
        role,
        parts: [{ type: 'text', text }],
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('[ChatRecording] Failed to record message:', error);
    }
  }, [serviceContainer, currentModel, provider]);
  
  const clearChat = useCallback(() => {
    setMessages([]);
    setCurrentInput('');
    setStreaming(false);
    setWaitingForResponse(false);
    if (contextActions) {
      contextActions.clear().catch(console.error);
      // System prompt will be rebuilt by ContextManager on next message
    }
  }, [contextActions]);
  
  useEffect(() => {
    if (!contextActions) return;

    // Create event handlers with dependencies
    const handlers = createContextEventHandlers({
      addMessage,
      setStatusMessage,
      contextActions,
      contextManagerState,
      compressionOccurredRef,
      compressionRetryCountRef,
      waitingForResumeRef,
    });

    // Register handlers and get cleanup function
    const cleanup = registerContextEventHandlers(contextActions, handlers);

    return cleanup;
  }, [contextActions, contextManagerState.usage, addMessage]);

  useEffect(() => {
    if (serviceContainer) {
      commandRegistry.setServiceContainer(serviceContainer);
      globalThis.__ollmModelSwitchCallback = setCurrentModel;
      
      // Listen to messageBus events
      const messageBus = serviceContainer.getHookService()?.getMessageBus();
      if (messageBus) {
        // Create session saved handler
        const handlers = createContextEventHandlers({
          addMessage,
          setStatusMessage,
          contextActions,
          contextManagerState,
          compressionOccurredRef,
          compressionRetryCountRef,
          waitingForResumeRef,
        });
        
        const listenerId = messageBus.on('session_saved', handlers.handleSessionSaved);
        
        return () => {
          messageBus.off(listenerId);
        };
      }
    }
    
    // Note: __ollmAddSystemMessage and __ollmClearContext are now registered
    // by AllCallbacksBridge component for better separation of concerns
  }, [serviceContainer, setCurrentModel, addMessage, setStatusMessage, contextActions, contextManagerState]);

  useEffect(() => {
    if (setTheme) {
      commandRegistry.setThemeCallback(setTheme);
    }
  }, [setTheme]);

  const updateMessage = useCallback((id: string, updates: Partial<Message>) => {
    setMessages((prev) =>
      prev.map((msg) => (msg.id === id ? { ...msg, ...updates } : msg))
    );
  }, []);

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
        const modelEntry = profileManager.getModelEntry(request.modelId);
        const validation = validateManualContext(modelEntry, value);
        if (!validation.valid) {
          addMessage({
            role: 'system',
            content: validation.message ?? 'Context size exceeds the allowable maximum.',
            excludeFromContext: true
          });
          return;
        }
        manualContextRequestRef.current = null;
        await request.onComplete(value);
        return;
      }
      // Handle resume command when waiting for user approval after summarization
      if (content.trim().toLowerCase() === 'continue' && waitingForResumeRef.current) {
        waitingForResumeRef.current = false;
        addMessage({ role: 'system', content: 'Resuming generation...', excludeFromContext: true });
        const last = lastUserMessageRef.current;
        if (last) {
          // Re-dispatch the last user message asynchronously to avoid recursion
          setTimeout(() => { void sendMessage(last); }, 0);
        }
        return;
      }
      
      // TASK 7.2: Analyze message with ContextAnalyzer before sending
      // Get the mode manager and context analyzer
      const modeManager = contextActions.getModeManager();
      
      // Add user message to UI
      addMessage({
        role: 'user',
        content,
      });
      // Store last user message so we can retry generation after compression
      lastUserMessageRef.current = content;

      // Clear input
      setCurrentInput('');

      // Check for commands
      if (commandRegistry.isCommand(content)) {
        await handleCommand(content, {
          addMessage,
          setLaunchScreenVisible,
          clearChat,
          provider,
          currentModel,
        });
        return;
      }
      
      // TASK 7.2-7.7: Mode switching logic
      if (modeManager) {
        try {
          // Get current context for analysis
          const currentContext = await contextActions.getContext();
          
          // Convert context messages to format expected by ContextAnalyzer
          const messagesForAnalysis = currentContext.map(msg => ({
            role: msg.role as 'user' | 'assistant' | 'system' | 'tool',
            parts: [{ type: 'text' as const, text: msg.content || '' }],
            toolCalls: msg.toolCalls
          }));
          
          // Analyze conversation context
          const analysis = modeManager['contextAnalyzer'].analyzeConversation(messagesForAnalysis);
          
          // TASK 7.3: Check if mode should switch based on analysis
          const currentMode = modeManager.getCurrentMode();
          const shouldSwitch = modeManager.shouldSwitchMode(currentMode, analysis);
          
          if (shouldSwitch) {
            // TASK 7.4: Create transition snapshot if switching to specialized mode
            const specializedModes = ['debugger'];
            if (specializedModes.includes(analysis.mode)) {
              // Create snapshot before switching
              try {
                await contextActions.createSnapshot();
              } catch (snapshotError) {
                console.warn('Failed to create transition snapshot:', snapshotError);
                // Continue with mode switch even if snapshot fails
              }
            }
            
            // TASK 7.5: Switch mode if confidence threshold met
            modeManager.switchMode(analysis.mode, 'auto', analysis.confidence);
            
            // TASK 7.6-7.7: Prompt rebuilding is now unified below to ensure consistency
            addMessage({
              role: 'system',
              content: `Switched to ${analysis.mode in MODE_METADATA ? (MODE_METADATA as Record<string, { icon: string }>)[analysis.mode].icon : '🔄'} ${analysis.mode} (${(analysis.confidence * 100).toFixed(0)}%)`,
              excludeFromContext: true
            });
          }
        } catch (modeError) {
          console.error('Mode switching error:', modeError);
          // Continue with normal flow even if mode switching fails
        }
      }

      // TASK 7.8: Continue with normal message flow
      setWaitingForResponse(true);
      setStreaming(true);

      // Emit before_agent hook event
      if (serviceContainer) {
        const hookService = serviceContainer.getHookService();
        hookService.emitEvent('before_agent', {
          message: content,
          model: currentModel,
          timestamp: new Date().toISOString(),
        });
      }

      // Stage 1: Check tool support (model capability check)
      const supportsTools = modelSupportsTools(currentModel);
      
      let toolSchemas: ToolSchema[] | undefined;
      
      if (supportsTools) {
        // Stage 2: Get central tool registry from service container
        const toolRegistry = serviceContainer?.getToolRegistry();
        
        if (toolRegistry) {
          const promptRegistry = new PromptRegistry();
          
          const manager = contextActions.getManager();
          if (manager && provider) {
              const modeManager = contextActions.getModeManager();
              const promptsSnapshotManager = contextActions.getPromptsSnapshotManager();
              
              // Register dynamic tools only if not already registered
              // These tools require runtime dependencies that aren't available at startup
              if (!toolRegistry.get('trigger_hot_swap')) {
                toolRegistry.register(new HotSwapTool(manager, promptRegistry, provider, currentModel, modeManager || undefined, promptsSnapshotManager || undefined));
              }
              if (!toolRegistry.get('memory_dump')) {
                toolRegistry.register(new MemoryDumpTool(modeManager || undefined));
              }
              
              const toolNames = toolRegistry.list().map(t => t.name);
              manager.emit('active-tools-updated', toolNames);
          }
          
          // Get modeManager for combined filtering
          const modeManager = contextActions.getModeManager();
          
          if (modeManager) {
            const currentMode = modeManager.getCurrentMode();
            
            // Use combined filtering method (user prefs + mode permissions in single pass)
            toolSchemas = toolRegistry.getFunctionSchemasForMode(currentMode, modeManager);
          } else {
            // FALLBACK: If modeManager is not initialized yet, use all tools without mode filtering
            // This ensures tools are available even if mode manager isn't ready
            console.warn('[ChatContext] modeManager not initialized, using all tools without mode filtering');
            toolSchemas = toolRegistry.getFunctionSchemas();
          }
        } else {
          // Service container not ready, no tools available
          toolSchemas = [];
        }
      }

      // Build system prompt using utility function
      const basePrompt = contextActions.getSystemPrompt();
      const usageForTier = contextActions.getUsage();
      const coreManager = contextActions.getManager?.();
      const coreMode = coreManager?.getMode?.() ?? contextActions.getCurrentMode?.() ?? 'assistant';
      const effectiveTier = resolveTierForSize(usageForTier.maxTokens);
      const tierPrompt = loadTierPromptWithFallback(
        toOperationalMode(coreMode),
        effectiveTier
      );
      
      const modelProfile = profileManager.findProfile(currentModel);
      
      const systemPrompt = buildSystemPrompt({
        basePrompt,
        tierPrompt,
        modelProfile,
        supportsTools,
        injectFocusedFiles: injectFocusedFilesIntoPrompt,
      });

      // 1. Initial user message addition to context manager
      if (contextActions) {
          await contextActions.addMessage({ role: 'user', content });
      }
      await recordSessionMessage('user', content);

      // Assistant message ID for this turn
      const assistantMsg = addMessage({
        role: 'assistant',
        content: '',
        expanded: true, // Start expanded to show reasoning as it streams
      });
      const currentAssistantMsgId = assistantMsg.id;
      assistantMessageIdRef.current = currentAssistantMsgId;

      // Run agent loop
      const loopResult = await runAgentLoop({
        addMessage,
        setMessages,
        contextActions,
        sendToLLM,
        cancelRequest,
        currentModel,
        provider,
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
      });

      setStreaming(false);
      setWaitingForResponse(false);
      assistantMessageIdRef.current = null;
      
      // Emit after_agent hook event
      if (serviceContainer) {
        const hookService = serviceContainer.getHookService();
        hookService.emitEvent('after_agent', {
          message: content,
          model: currentModel,
          turns: loopResult.turns,
          timestamp: new Date().toISOString(),
        });
      }
    },
    [addMessage, setMessages, sendToLLM, setLaunchScreenVisible, contextActions, provider, currentModel, clearChat, modelSupportsTools, serviceContainer, cancelRequest, injectFocusedFilesIntoPrompt, recordSessionMessage]
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
      statusMessage,
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
    setStatusMessage,
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
    // Standard behavior: auto-scroll to bottom if at bottom.
 
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
