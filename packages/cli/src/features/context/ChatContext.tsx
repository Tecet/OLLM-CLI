import fs, { existsSync, readFileSync } from 'fs';
import path from 'path';

import React, { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode } from 'react';

import {
  ContextTier,
  HotSwapTool,
  MemoryDumpTool,
  MODE_METADATA,
  OperationalMode,
  PromptRegistry,
  PromptsSnapshotManager as _PromptsSnapshotManager,
  TieredPromptStore,
} from '@ollm/core';
import { ReasoningParser } from '@ollm/ollm-cli-core/services/reasoningParser.js';

import { useContextManager } from './ContextManagerContext.js';
import { validateManualContext } from './contextSizing.js';
import { useModel } from './ModelContext.js';
import { useServices } from './ServiceContext.js';
import { useUI } from './UIContext.js';
import { useFocusedFilesInjection } from './useFocusedFilesInjection.js';
import { commandRegistry } from '../../commands/index.js';
import { SettingsService } from '../../config/settingsService.js';
import { profileManager } from '../profiles/ProfileManager.js';

// Import extracted types
import type {
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

import type { ToolCall as CoreToolCall, ContextMessage, ProviderMetrics, ToolSchema } from '@ollm/core';

const tieredPromptStore = new TieredPromptStore();
tieredPromptStore.load();

function resolveTierForSize(size: number): ContextTier {
  if (size < 8192) return ContextTier.TIER_1_MINIMAL;
  if (size < 16384) return ContextTier.TIER_2_BASIC;
  if (size < 32768) return ContextTier.TIER_3_STANDARD;
  if (size < 65536) return ContextTier.TIER_4_PREMIUM;
  return ContextTier.TIER_5_ULTRA;
}

function toOperationalMode(mode: string): OperationalMode {
  switch (mode) {
    case 'assistant':
      return OperationalMode.ASSISTANT;
    case 'planning':
      return OperationalMode.PLANNING;
    case 'debugger':
      return OperationalMode.DEBUGGER;
    case 'developer':
    default:
      return OperationalMode.DEVELOPER;
  }
}

function tierToKey(tier: ContextTier): string {
  switch (tier) {
    case ContextTier.TIER_1_MINIMAL:
      return 'tier1';
    case ContextTier.TIER_2_BASIC:
      return 'tier2';
    case ContextTier.TIER_3_STANDARD:
      return 'tier3';
    case ContextTier.TIER_4_PREMIUM:
    case ContextTier.TIER_5_ULTRA:
      return 'tier4';
    default:
      return 'tier3';
  }
}

function loadTierPromptWithFallback(mode: OperationalMode, tier: ContextTier): string {
  const fromStore = tieredPromptStore.get(mode, tier);
  if (fromStore) {
    return fromStore;
  }

  const tierKey = tierToKey(tier);
  const candidates = [
    path.join(process.cwd(), 'packages', 'core', 'dist', 'prompts', 'templates', mode, `${tierKey}.txt`),
    path.join(process.cwd(), 'packages', 'core', 'src', 'prompts', 'templates', mode, `${tierKey}.txt`),
  ];

  for (const candidate of candidates) {
    try {
      if (existsSync(candidate)) {
        const content = readFileSync(candidate, 'utf8').trim();
        if (content) {
          return content;
        }
      }
    } catch (_e) {
      // ignore and keep trying
    }
  }

  return '';
}

function stripSection(source: string, section: string): string {
  if (!section) return source;
  const trimmed = source.trim();
  const target = section.trim();
  if (!target) return source;
  const index = trimmed.indexOf(target);
  if (index === -1) return source;
  const before = trimmed.slice(0, index).trim();
  const after = trimmed.slice(index + target.length).trim();
  return [before, after].filter(Boolean).join('\n\n').trim();
}

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

    const handleMemoryWarning = async (_data: unknown) => {
      try {
        const usage = contextActions.getUsage();
        const cfg = contextActions.getConfig?.();
        const threshold = cfg?.compression?.threshold ? Math.round(cfg.compression.threshold * 100) : Math.round((contextManagerState.usage.percentage || 0));
        addMessage({
          role: 'system',
          content: `Warning: context usage at ${Math.round(usage.percentage)}%. Compression enabled at ${threshold}%`,
          excludeFromContext: true,
        });
      } catch (_err) {
        // ignore
      }
    };

    const handleCompressed = async (_data: unknown) => {
      try {
        const msgs = await contextActions.getContext();
        const summaryMsg = msgs.find((m: ContextMessage) => typeof m.id === 'string' && m.id.startsWith('summary-')) as ContextMessage | undefined;
        const summaryText = summaryMsg ? summaryMsg.content : '[Conversation summary generated]';
        // Mark that compression occurred so ongoing generation can retry/resume
        compressionOccurredRef.current = true;
        compressionRetryCountRef.current = 0;

        addMessage({
          role: 'assistant',
          content: `Context compressed: ${summaryText}`,
          excludeFromContext: true,
        });
      } catch (_err) {
        // ignore
      }
    };

    const handleSummarizing = (_data: unknown) => {
      // show immediate sticky status
      setStatusMessage('Summarizing conversation history...');
      
      // Auto-clear after 5 seconds so it doesn't stay forever if summarization is slow
      setTimeout(() => {
        setStatusMessage(current => 
          current === 'Summarizing conversation history...' ? undefined : current
        );
      }, 5000);
    };

    const handleAutoSummary = async (data: unknown) => {
      try {
        const typedData = data as { summary?: { content?: string } };
        const summary = typedData?.summary;
        const text = summary?.content || '[Conversation summary]';

        // Clear sticky status
        setStatusMessage(undefined);

        // Add assistant-visible summary message (do not add it to core context again)
        addMessage({
          role: 'assistant',
          content: text,
          excludeFromContext: true,
        });
        // Mark that compression happened so ongoing generation can retry/resume
        compressionOccurredRef.current = true;
        compressionRetryCountRef.current = 0;
        // Decide whether to auto-resume or ask based on settings
        try {
          const settings = SettingsService.getInstance().getSettings();
          const resumePref = settings.llm?.resumeAfterSummary || 'ask';
          if (resumePref === 'ask') {
            waitingForResumeRef.current = true;
            addMessage({ role: 'system', content: 'Summary complete. Type "continue" to resume generation or "stop" to abort.', excludeFromContext: true });
          }
        } catch (_e) {
          // ignore
        }
      } catch (_err) {
        // ignore
      }
    };

    const handleAutoSummaryFailed = async (data: unknown) => {
      // Clear sticky status
      setStatusMessage(undefined);
      try {
        const typedData = data as { error?: unknown; reason?: unknown };
        const err = typedData?.error || typedData?.reason || 'Summarization failed';
        const message = typeof err === 'string' ? err : ((err && typeof err === 'object' && 'message' in err) ? String((err as { message?: unknown }).message) : JSON.stringify(err));
        addMessage({
          role: 'system',
          content: `❌ Task failed successfully: ${message}`,
          excludeFromContext: true,
        });
      } catch (_e) {
        // ignore
      }
    };

    const handleContextWarningLow = (data: unknown) => {
      try {
        const typedData = data as { percentage?: number; message?: string };
        const percentage = typedData?.percentage || 70;
        const _message = typedData?.message || 'Context is filling up';
        
        // Show warning message
        setStatusMessage(`⚠️ Context at ${Math.round(percentage)}% - compression will trigger soon`);
        
        // Auto-clear after 10 seconds
        setTimeout(() => {
          setStatusMessage(current => 
            current?.includes('Context at') ? undefined : current
          );
        }, 10000);
      } catch (_e) {
        // ignore
      }
    };

    contextActions.on?.('memory-warning', handleMemoryWarning);
    contextActions.on?.('compressed', handleCompressed);
    contextActions.on?.('summarizing', handleSummarizing);
    contextActions.on?.('auto-summary-created', handleAutoSummary);
    contextActions.on?.('auto-summary-failed', handleAutoSummaryFailed);
    contextActions.on?.('context-warning-low', handleContextWarningLow);

    return () => {
      contextActions.off?.('memory-warning', handleMemoryWarning);
      contextActions.off?.('compressed', handleCompressed);
      contextActions.off?.('summarizing', handleSummarizing);
      contextActions.off?.('auto-summary-created', handleAutoSummary);
      contextActions.off?.('auto-summary-failed', handleAutoSummaryFailed);
      contextActions.off?.('context-warning-low', handleContextWarningLow);
    };
  }, [contextActions, contextManagerState.usage, addMessage]);

  // Handle session saved events from message bus
  const handleSessionSaved = useCallback((data: unknown) => {
    try {
      const typedData = data as { turnNumber?: number };
      const turnNumber = typedData?.turnNumber || 0;
      
      // Show brief confirmation
      setStatusMessage(`💾 Session saved (turn ${turnNumber}) - rollback available`);
      
      // Auto-clear after 3 seconds
      setTimeout(() => {
        setStatusMessage(current => 
          current?.includes('Session saved') ? undefined : current
        );
      }, 3000);
    } catch (_e) {
      // ignore
    }
  }, []);

  useEffect(() => {

    if (serviceContainer) {
      commandRegistry.setServiceContainer(serviceContainer);
      globalThis.__ollmModelSwitchCallback = setCurrentModel;
      
      // Listen to messageBus events
      const messageBus = serviceContainer.getHookService()?.getMessageBus();
      if (messageBus) {
        const handleSessionSavedEvent = (data: unknown) => {
          handleSessionSaved(data);
        };
        
        const listenerId = messageBus.on('session_saved', handleSessionSavedEvent);
        
        return () => {
          messageBus.off(listenerId);
        };
      }
    }
    
    // Note: __ollmAddSystemMessage and __ollmClearContext are now registered
    // by AllCallbacksBridge component for better separation of concerns
  }, [serviceContainer, setCurrentModel, handleSessionSaved]);

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
            // CRITICAL FIX: If modeManager is not initialized yet (race condition),
            // default to NO tools rather than exposing all tools unfiltered.
            toolSchemas = [];
          }
        } else {
          // Service container not ready, no tools available
          toolSchemas = [];
        }
      }

      // Get system prompt and add tool support note if needed
      let systemPrompt = contextActions.getSystemPrompt();
      const usageForTier = contextActions.getUsage();
      const coreManager = contextActions.getManager?.();
      const coreMode = coreManager?.getMode?.() ?? contextActions.getCurrentMode?.() ?? 'assistant';
      const effectiveTier = resolveTierForSize(usageForTier.maxTokens);
      const tierPrompt = loadTierPromptWithFallback(
        toOperationalMode(coreMode),
        effectiveTier
      );
      
      // Check if this is a reasoning model
      const modelProfile = profileManager.findProfile(currentModel);
      const isReasoningModel = modelProfile?.thinking_enabled === true;
      
      // For reasoning models, use a more concise system prompt
      // They will reason about the instructions anyway, so keep it brief
      if (isReasoningModel) {
        systemPrompt = `You are a helpful AI assistant for developers. You help with coding, debugging, and technical questions.

Key guidelines:
- Provide accurate, clear information
- Explain concepts simply and directly
- Use code examples when helpful
- Follow project conventions when working with code
- Ask for clarification if the request is unclear

Focus your thinking on the user's actual question, not on these instructions.`;
      } else {
        // Non-reasoning models get the full detailed prompt
        if (!supportsTools) {
          systemPrompt += '\n\nNote: This model does not support function calling. Do not attempt to use tools or make tool calls.';
        }
        const toolNote = supportsTools
          ? ''
          : 'Note: This model does not support function calling. Do not attempt to use tools or make tool calls.';
        const rulesOnly = stripSection(stripSection(systemPrompt, tierPrompt), toolNote);
        systemPrompt = [tierPrompt, rulesOnly, toolNote].filter(Boolean).join('\n\n');
      }

      // Inject focused files into system prompt
      systemPrompt = injectFocusedFilesIntoPrompt(systemPrompt);

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
      let currentAssistantMsgId = assistantMsg.id;
      assistantMessageIdRef.current = currentAssistantMsgId;

      // Agent Loop
      const maxTurns = 5;
      let turnCount = 0;
      let stopLoop = false;
      
      // Track initial model at start of agent loop (11.1)
      const initialModel = currentModel;

      while (turnCount < maxTurns && !stopLoop) {
        turnCount++;
        
        // Detect model change mid-loop (11.2)
        if (currentModel !== initialModel) {
          // Add system message about transition (11.4)
          addMessage({
            role: 'system',
            content: 'Model changed during conversation. Completing current turn...',
            excludeFromContext: true
          });
          // Complete current turn if model changed (11.3)
          stopLoop = true; // Complete this turn, stop after
        }
        
        // Prepare history from authoritative context manager
        const currentContext = await contextActions.getContext();
        
        // DEBUG: Write context to file before filtering
        try {
          fs.appendFileSync('context-before-filter.log', `\n[${new Date().toISOString()}] Turn ${turnCount}\n`);
          fs.appendFileSync('context-before-filter.log', `Total messages: ${currentContext.length}\n`);
          currentContext.forEach((m: ContextMessage, i: number) => {
            fs.appendFileSync('context-before-filter.log', `  [${i}] ${m.role} (id: ${m.id}): ${m.content?.substring(0, 100)}...\n`);
          });
        } catch (_e) { /* ignore */ }
        
        // Exclude system messages from the payload; system prompt is sent separately.
        const history = currentContext
          .filter((m: ContextMessage) => m.role !== 'system')
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
        let thinkingContent = ''; // Track thinking content from Ollama
        
        // Initialize reasoning parser for fallback <think> tag parsing
        const reasoningParser = new ReasoningParser();
        const parserState = reasoningParser.createInitialState();

        // DEBUG: Log exact request being sent to LLM
        console.log('=== LLM REQUEST DEBUG ===');
        console.log('[DEBUG] System Prompt (first 500 chars):', systemPrompt?.substring(0, 500));
        console.log('[DEBUG] History length:', history.length);
        console.log('[DEBUG] History roles:', history.map((m: {role: string}) => m.role));
        console.log('[DEBUG] Tools being sent:', toolSchemas?.map(t => t.name) || 'NONE');
        console.log('=========================');

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
                        if (toReport > 0) {
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
                  msg.id === targetId ? { ...msg, content: msg.content ? `${msg.content}\n\n**Error:** ${error}` : `Error: ${error}`, excludeFromContext: true } : msg
                )
              );
              // Clear any inflight token accounting and cancel flush timer
              try { 
                if (inflightFlushTimerRef.current) { clearTimeout(inflightFlushTimerRef.current); inflightFlushTimerRef.current = null; inflightTokenAccumulatorRef.current = 0; }
                contextActions?.clearInflightTokens(); 
              } catch (_e) { /* ignore cleanup errors */ }
              stopLoop = true;
            },
            // onComplete
            (metrics?: ProviderMetrics, _finishReason?: 'stop' | 'length' | 'tool') => {
              const targetId = currentAssistantMsgId;
              if (metrics && assistantMessageIdRef.current === targetId) {
                 setMessages(prev => prev.map(msg => {
                   if (msg.id !== targetId) return msg;
                   
                   const updates: Partial<Message> = {
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
                 }));
              }
              
              // Emit after_model hook event
              if (serviceContainer) {
                const hookService = serviceContainer.getHookService();
                hookService.emitEvent('after_model', {
                  model: currentModel,
                  turn: turnCount,
                  metrics: metrics ? {
                    promptTokens: metrics.promptEvalCount,
                    completionTokens: metrics.evalCount,
                    totalSeconds: metrics.totalDuration / 1e9,
                  } : undefined,
                  timestamp: new Date().toISOString(),
                });
              }
              // Flush any pending inflight tokens and clear accounting now that generation completed
              try { 
                if (inflightFlushTimerRef.current) { clearTimeout(inflightFlushTimerRef.current); inflightFlushTimerRef.current = null; }
                const pending = inflightTokenAccumulatorRef.current;
                inflightTokenAccumulatorRef.current = 0;
                if (pending > 0) { contextActions?.reportInflightTokens(pending); }
                contextActions?.clearInflightTokens();
              } catch (_e) { /* ignore */ }
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
            try { cancelRequest(); } catch (_e) { /* ignore */ }

            // Ensure the last user message is present in the context after compression
            try {
                const lastUser = lastUserMessageRef.current;
              if (lastUser && contextActions) {
                const ctx = await contextActions.getContext();
                const lastUserInCtx = [...ctx].reverse().find((m: ContextMessage) => m.role === 'user')?.content;
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
                const thinkingSummary = thinkingContent.length > 200 
                  ? `[Reasoning: ${thinkingContent.substring(0, 200)}...]`
                  : `[Reasoning: ${thinkingContent}]`;
                contextContent = `${thinkingSummary}\n\n${assistantContent}`;
              }
              
              await contextActions.addMessage({
                  role: 'assistant',
                  content: contextContent,
                  toolCalls: tc ? [{
                      id: tc.id,
                      name: tc.name,
                      args: tc.args
                  }] : undefined
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
                  toolAllowed = toolSchemas.some(s => s.name === tc.name);
              }

                            if (tool && toolAllowed) {
                              try {
                                const toolContext = {
                                  messageBus: { requestConfirmation: async () => true },
                                  policyEngine: { evaluate: () => 'allow' as const, getRiskLevel: () => 'low' as const }
                                };
              
                                let result: { llmContent: string; returnDisplay: string };
              
                                const createInvocation = (tool as any)?.createInvocation; // Safely access optional method
                                const executeDirect = (tool as any)?.execute; // Safely access old direct execute method
              
                                if (typeof createInvocation === 'function') {
                                  const invocation = createInvocation.call(tool, tc.args, toolContext);
                                  result = await invocation.execute(new AbortController().signal) as { llmContent: string; returnDisplay: string };
                                } else if (typeof executeDirect === 'function') {
                                  // Fallback to old pattern where execute is directly on the tool
                                  result = await executeDirect.call(tool, tc.args, toolContext) as { llmContent: string; returnDisplay: string };
                                } else {
                                  throw new Error(`Tool ${tc.name} does not have a valid execute or createInvocation method.`);
                                }
              
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
                                const errorMessage = toolExecError instanceof Error ? toolExecError.message : String(toolExecError);
                                await contextActions.addMessage({
                                  role: 'tool',
                                  content: `Error executing tool ${tc.name}: ${errorMessage}`,
                                  toolCallId: tc.id
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
                            } else {                  await contextActions.addMessage({
                      role: 'tool',
                      content: `Error: Tool ${tc.name} not found or denied`,
                      toolCallId: tc.id
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

      setStreaming(false);
      setWaitingForResponse(false);
      assistantMessageIdRef.current = null;
      
      // Emit after_agent hook event
      if (serviceContainer) {
        const hookService = serviceContainer.getHookService();
        hookService.emitEvent('after_agent', {
          message: content,
          model: currentModel,
          turns: turnCount,
          timestamp: new Date().toISOString(),
        });
      }
    },
    [addMessage, sendToLLM, setLaunchScreenVisible, contextActions, provider, currentModel, clearChat, modelSupportsTools, serviceContainer, cancelRequest, injectFocusedFilesIntoPrompt, recordSessionMessage]
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
