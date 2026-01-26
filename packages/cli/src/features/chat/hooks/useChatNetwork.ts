/**
 * Hook for managing LLM network communication and agent loop
 * This is the core logic for sending messages and handling tool calls
 */

import { useCallback, useRef } from 'react';

// Import types and dependencies

import {
  HotSwapTool,
  MemoryDumpTool,
  MODE_METADATA,
  PromptRegistry,
} from '@ollm/core';

import { commandRegistry } from '../../../commands/index.js';
import { validateManualContext } from '../../context/contextSizing.js';
import { profileManager } from '../../profiles/ProfileManager.js';
import { 
  resolveTierForSize, 
  toOperationalMode, 
  loadTierPromptWithFallback, 
  stripSection 
} from '../utils/promptUtils.js';

import type { Message, MenuState } from '../types.js';
import type { 
  ToolSchema,
} from '@ollm/core';
import type { ServiceContainer } from '@ollm/core/services/serviceContainer.js';

export interface UseChatNetworkProps {
  // Dependencies
  contextActions: any;
  _sendToLLM: any;
  _cancelRequest: () => void;
  provider: any;
  currentModel: string;
  modelSupportsTools: (model: string) => boolean;
  serviceContainer: ServiceContainer | null;
  injectFocusedFilesIntoPrompt: (prompt: string) => string;
  
  // State management
  addMessage: (message: Omit<Message, 'id' | 'timestamp'>) => Message;
  _updateMessage: (id: string, updates: Partial<Message>) => void;
  setStreaming: (streaming: boolean) => void;
  setWaitingForResponse: (waiting: boolean) => void;
  setInputMode: React.Dispatch<React.SetStateAction<'text' | 'menu'>>;
  setMenuState: React.Dispatch<React.SetStateAction<any>>;
  clearChat: () => void;
  setLaunchScreenVisible: (visible: boolean) => void;
  
  // Session recording
  recordSessionMessage: (role: 'user' | 'assistant', text: string) => Promise<void>;
  
  // Context events
  _compressionOccurred: boolean;
  _compressionRetryCount: number;
  waitingForResume: boolean;
  _resetCompressionFlags: () => void;
  setWaitingForResume: (waiting: boolean) => void;
}

export interface UseChatNetworkReturn {
  sendMessage: (content: string) => Promise<void>;
  requestManualContextInput: (modelId: string, onComplete: (value: number) => void | Promise<void>) => void;
}

/**
 * Manages LLM network communication, agent loop, and tool execution
 */
export function useChatNetwork(props: UseChatNetworkProps): UseChatNetworkReturn {
  const {
    contextActions,
    _sendToLLM,
    _cancelRequest,
    provider,
    currentModel,
    modelSupportsTools,
    serviceContainer,
    injectFocusedFilesIntoPrompt,
    addMessage,
    _updateMessage,
    setStreaming,
    setWaitingForResponse,
    setInputMode,
    setMenuState,
    clearChat,
    setLaunchScreenVisible,
    recordSessionMessage,
    _compressionOccurred,
    _compressionRetryCount,
    waitingForResume,
    _resetCompressionFlags,
    setWaitingForResume,
  } = props;

  // Refs for tracking state across async operations
  const _assistantMessageIdRef = useRef<string | null>(null);
  const manualContextRequestRef = useRef<{ 
    modelId: string; 
    onComplete: (value: number) => void | Promise<void> 
  } | null>(null);
  const lastUserMessageRef = useRef<string | null>(null);
  const _inflightTokenAccumulatorRef = useRef(0);
  const _inflightFlushTimerRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Request manual context size input from user
   */
  const requestManualContextInput = useCallback((
    modelId: string, 
    onComplete: (value: number) => void | Promise<void>
  ) => {
    manualContextRequestRef.current = { modelId, onComplete };
    setMenuState((prev: MenuState) => ({ ...prev, active: false }));
    setInputMode('text');
  }, [setMenuState, setInputMode]);

  /**
   * Main message sending logic with agent loop
   */
  const sendMessage = useCallback(
    async (content: string) => {
      // Handle manual context input if active
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
      if (content.trim().toLowerCase() === 'continue' && waitingForResume) {
        setWaitingForResume(false);
        addMessage({ role: 'system', content: 'Resuming generation...', excludeFromContext: true });
        const last = lastUserMessageRef.current;
        if (last) {
          // Re-dispatch the last user message asynchronously to avoid recursion
          setTimeout(() => { void sendMessage(last); }, 0);
        }
        return;
      }
      
      // Get the mode manager and context analyzer
      const modeManager = contextActions.getModeManager();
      
      // Add user message to UI
      addMessage({
        role: 'user',
        content,
      });
      
      // Store last user message so we can retry generation after compression
      lastUserMessageRef.current = content;

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
      
      // Mode switching logic
      if (modeManager) {
        try {
          // Get current context for analysis
          const currentContext = await contextActions.getContext();
          
          // Convert context messages to format expected by ContextAnalyzer
          const messagesForAnalysis = currentContext.map((msg: any) => ({
            role: msg.role as 'user' | 'assistant' | 'system' | 'tool',
            parts: [{ type: 'text' as const, text: msg.content || '' }],
            toolCalls: msg.toolCalls
          }));
          
          // Analyze conversation context
          const analysis = modeManager['contextAnalyzer'].analyzeConversation(messagesForAnalysis);
          
          // Check if mode should switch based on analysis
          const currentMode = modeManager.getCurrentMode();
          const shouldSwitch = modeManager.shouldSwitchMode(currentMode, analysis);
          
          if (shouldSwitch) {
            // Create transition snapshot if switching to specialized mode
            const specializedModes = ['debugger'];
            if (specializedModes.includes(analysis.mode)) {
              try {
                await contextActions.createSnapshot();
              } catch (snapshotError) {
                console.warn('Failed to create transition snapshot:', snapshotError);
              }
            }
            
            // Switch mode if confidence threshold met
            modeManager.switchMode(analysis.mode, 'auto', analysis.confidence);
            
            addMessage({
              role: 'system',
              content: `Switched to ${analysis.mode in MODE_METADATA ? (MODE_METADATA as Record<string, { icon: string }>)[analysis.mode].icon : '🔄'} ${analysis.mode} (${(analysis.confidence * 100).toFixed(0)}%)`,
              excludeFromContext: true
            });
          }
        } catch (modeError) {
          console.error('Mode switching error:', modeError);
        }
      }

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

      // Check tool support (model capability check)
      const supportsTools = modelSupportsTools(currentModel);
      
      let _toolSchemas: ToolSchema[] | undefined;
      
      if (supportsTools) {
        // Get central tool registry from service container
        const toolRegistry = serviceContainer?.getToolRegistry();
        
        if (toolRegistry) {
          const promptRegistry = new PromptRegistry();
          
          const manager = contextActions.getManager();
          if (manager && provider) {
              const modeManager = contextActions.getModeManager();
              const promptsSnapshotManager = contextActions.getPromptsSnapshotManager();
              
              // Register dynamic tools only if not already registered
              if (!toolRegistry.get('trigger_hot_swap')) {
                toolRegistry.register(new HotSwapTool(manager, promptRegistry, provider, currentModel, modeManager || undefined, promptsSnapshotManager || undefined));
              }
              if (!toolRegistry.get('memory_dump')) {
                toolRegistry.register(new MemoryDumpTool(modeManager || undefined));
              }
              
              const toolNames = toolRegistry.list().map((t: any) => t.name);
              manager.emit('active-tools-updated', toolNames);
          }
          
          // Get modeManager for combined filtering
          const modeManager = contextActions.getModeManager();
          
          if (modeManager) {
            const currentMode = modeManager.getCurrentMode();
            _toolSchemas = toolRegistry.getFunctionSchemasForMode(currentMode, modeManager);
          } else {
            // If modeManager is not initialized yet, default to NO tools
            _toolSchemas = [];
          }
        } else {
          _toolSchemas = [];
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
      
      if (!supportsTools) {
        systemPrompt += '\n\nNote: This model does not support function calling. Do not attempt to use tools or make tool calls.';
      }
      
      const toolNote = supportsTools
        ? ''
        : 'Note: This model does not support function calling. Do not attempt to use tools or make tool calls.';
      const rulesOnly = stripSection(stripSection(systemPrompt, tierPrompt), toolNote);
      systemPrompt = [tierPrompt, rulesOnly, toolNote].filter(Boolean).join('\n\n');

      // Inject focused files into system prompt
      systemPrompt = injectFocusedFilesIntoPrompt(systemPrompt);

      // Add initial user message to context manager
      if (contextActions) {
          await contextActions.addMessage({ role: 'user', content });
      }
      await recordSessionMessage('user', content);

      // Create assistant message for this turn
      const assistantMsg = addMessage({
        role: 'assistant',
        content: '',
        expanded: true,
      });
      const currentAssistantMsgId = assistantMsg.id;
      _assistantMessageIdRef.current = currentAssistantMsgId;

      // Continue in next part...
      // (Agent loop implementation continues in the actual file)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [/* dependencies */]
  );

  return {
    sendMessage,
    requestManualContextInput,
  };
}
