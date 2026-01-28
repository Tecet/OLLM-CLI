/**
 * Model Context for managing the current model and LLM communication
 *
 * This context:
 * - Tracks the currently selected model
 * - Provides methods to switch models
 * - Sends messages to the LLM and handles streaming responses
 */

import { createContext, useContext, useState, useCallback, useRef, useEffect, type ReactNode } from 'react';

import { useContextManager } from './ContextManagerContext.js';
import { useOptionalGPU } from './GPUContext.js';
import { deriveGPUPlacementHints } from './gpuHints.js';
import { setLastGPUPlacementHints } from './gpuHintStore.js';
import { getSessionManager } from './SessionManager.js';
import { SettingsService } from '../../config/settingsService.js';
import { useUICallbacks } from '../../ui/contexts/UICallbacksContext.js';
import { profileManager } from '../profiles/ProfileManager.js';
import { useModelWarmup } from './hooks/useModelWarmup.js';
import { useToolSupport } from './hooks/useToolSupport.js';

import type {
  ProviderAdapter,
  Message as ProviderMessage,
  ToolCall,
  ToolSchema,
  ProviderMetrics,
} from '@ollm/core';

/**
 * Model context value
 */
export interface ModelContextValue {
  /** Current model name */
  currentModel: string;

  /** Switch to a different model */
  setCurrentModel: (model: string) => void | Promise<void>;

  /** Model loading state after a swap */
  modelLoading: boolean;

  /** Warmup status details for UI display */
  warmupStatus: {
    active: boolean;
    attempt: number;
    elapsedMs: number;
  } | null;

  /** Skip the current warmup process */
  skipWarmup: () => void;

  /** Check if a model supports tools */
  modelSupportsTools: (model: string) => boolean;

  /** Send a message to the LLM and stream the response */
  sendToLLM: (
    messages: Array<{
      role: 'user' | 'assistant' | 'system' | 'tool';
      content: string;
      toolCalls?: ToolCall[];
      toolCallId?: string;
    }>,
    onText: (text: string) => void,
    onError: (error: string) => void,
    onComplete: (metrics?: ProviderMetrics, finishReason?: 'stop' | 'length' | 'tool') => void,
    onToolCall?: (toolCall: ToolCall) => void,
    onThinking?: (thinking: string) => void,
    tools?: ToolSchema[],
    systemPrompt?: string,
    timeout?: number,
    temperature?: number
  ) => Promise<void>;

  /** Cancel the current LLM request */
  cancelRequest: () => void;

  /** Provider adapter reference */
  provider: ProviderAdapter;
}

const ModelContext = createContext<ModelContextValue | undefined>(undefined);

export interface ModelProviderProps {
  children: ReactNode;
  provider: ProviderAdapter;
  initialModel: string;
}

/**
 * Model Provider component
 */
export function ModelProvider({ children, provider, initialModel }: ModelProviderProps) {
  // Get UI callbacks from context
  const { promptUser, addSystemMessage } = useUICallbacks();

  const [currentModel, setCurrentModel] = useState(initialModel);
  const [modelLoading, setModelLoading] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const { actions: _contextActions } = useContextManager();
  const { state: contextManagerState } = useContextManager();
  const gpuContext = useOptionalGPU();

  /**
   * Check if an error message indicates a timeout
   * @param message - The error message to check
   * @returns True if the message indicates a timeout
   */
  const isTimeoutError = useCallback((message: string): boolean => {
    return /timed out|timeout/i.test(message);
  }, []);

  // Use extracted hooks
  const {
    modelSupportsTools,
    handleToolError,
    handleUnknownModel,
    saveToolSupport,
    isToolUnsupportedError,
  } = useToolSupport(provider, promptUser, addSystemMessage);

  const { warmupStatus, skipWarmup, clearWarmupStatus } = useModelWarmup(
    provider,
    currentModel,
    modelLoading,
    setModelLoading,
    addSystemMessage,
    isTimeoutError
  );

  const setModelAndLoading = useCallback(
    async (model: string) => {
      const changed = currentModel !== model;
      if (changed) {
        const previousModel = currentModel;

        // Check ProfileManager for tool support metadata
        const userModels = profileManager.getUserModels();
        const userModel = userModels.find((m) => m.id === model);
        const profile = profileManager.findProfile(model);

        // Handle unknown models
        if (!userModel && !profile) {
          const toolSupport = await handleUnknownModel(model);

          // Set current model FIRST
          setCurrentModel(model);
          setModelLoading(true);

          if (previousModel && provider.unloadModel) {
            provider.unloadModel(previousModel).catch((error: unknown) => {
              const message = error instanceof Error ? error.message : String(error);
              console.warn(`Failed to unload model "${previousModel}": ${message}`);
            });
          }

          // Create new session using SessionManager
          const sessionManager = getSessionManager();
          const newSessionId = sessionManager.createNewSession(model);
          console.log(`[ModelContext] New session created: ${newSessionId}`);

          // Add system message showing model swap and tool support
          const toolStatus = toolSupport ? 'Enabled' : 'Disabled';
          const contextSize = contextManagerState.usage.maxTokens;
          const contextSizeK = contextSize >= 1024 ? `${contextSize / 1024}k` : `${contextSize}`;
          addSystemMessage(
            `Switched to **${model}** with **${contextSizeK}** context (${contextSize} tokens). Tools: ${toolStatus}`
          );

          return;
        }

        // Determine tool support from metadata
        const toolSupport = userModel?.tool_support ?? profile?.tool_support ?? true;

        // Set session override for known non-tool models (expires in 1 hour)
        if (!toolSupport) {
          await saveToolSupport(model, false, false);
        }

        // Set current model FIRST
        setCurrentModel(model);
        setModelLoading(true);

        if (previousModel && provider.unloadModel) {
          provider.unloadModel(previousModel).catch((error: unknown) => {
            const message = error instanceof Error ? error.message : String(error);
            console.warn(`Failed to unload model "${previousModel}": ${message}`);
          });
        }

        // Create new session using SessionManager
        const sessionManager = getSessionManager();
        const newSessionId = sessionManager.createNewSession(model);
        console.log(`[ModelContext] New session created: ${newSessionId}`);

        // Add system message showing model swap and tool support
        const toolStatus = toolSupport ? 'Enabled' : 'Disabled';
        const contextSize = contextManagerState.usage.maxTokens;
        const contextSizeK = contextSize >= 1024 ? `${contextSize / 1024}k` : `${contextSize}`;
        addSystemMessage(
          `Switched to **${model}** with **${contextSizeK}** context (${contextSize} tokens). Tools: ${toolStatus}`
        );
      }
    },
    [currentModel, provider, handleUnknownModel, saveToolSupport, addSystemMessage, contextManagerState.usage.maxTokens]
  );

  const cancelRequest = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  const sendToLLM = useCallback(
    async (
      messages: Array<{
        role: 'user' | 'assistant' | 'system' | 'tool';
        content: string;
        toolCalls?: ToolCall[];
        toolCallId?: string;
      }>,
      onText: (text: string) => void,
      onError: (error: string) => void,
      onComplete: (metrics?: ProviderMetrics, finishReason?: 'stop' | 'length' | 'tool') => void,
      onToolCall?: (toolCall: ToolCall) => void,
      onThinking?: (thinking: string) => void,
      tools?: ToolSchema[],
      systemPrompt?: string,
      timeout?: number,
      temperatureOverride?: number
    ) => {
      // Cancel any existing request
      cancelRequest();

      // Create new abort controller
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      try {
        // Convert messages to provider format
        const providerMessages: ProviderMessage[] = messages.map((msg) => ({
          role: msg.role === 'tool' ? 'tool' : msg.role,
          parts: [{ type: 'text' as const, text: msg.content }],
          toolCalls: msg.toolCalls,
          toolCallId: msg.toolCallId,
        }));

        // Get model-specific timeout from profile if not provided
        const profile = profileManager.findProfile(currentModel);
        const modelEntry = profileManager.getModelEntry(currentModel);
        const requestTimeout = timeout ?? profile?.warmup_timeout ?? 30000;

        // Check if model supports thinking
        const thinkingEnabled = profile?.thinking_enabled ?? false;

        // Get user settings for context size and temperature
        const settingsService = SettingsService.getInstance();
        const settings = settingsService.getSettings();
        const temperature = settings.llm?.temperature ?? 0.1;
        const forcedNumGpu = settings.llm?.forceNumGpu;

        // Get current tier from context manager state
        const currentTier = contextManagerState.currentTier;

        // Find the matching profile for the current tier
        // Tiers are: TIER_1_MINIMAL = 0, TIER_2_COMPACT = 1, TIER_3_STANDARD = 2, TIER_4_EXTENDED = 3, TIER_5_MAXIMUM = 4
        const profiles = modelEntry.context_profiles ?? [];
        const tierIndex = Number(currentTier); // Tier enum values are 0-4
        const matchingProfile = profiles[tierIndex]; // Profiles are ordered by tier

        // Get the context size and ollama_context_size from the matching profile
        const userContextSize = matchingProfile?.size ?? modelEntry.default_context ?? 4096;
        const ollamaContextSize =
          matchingProfile?.ollama_context_size ?? Math.floor(userContextSize * 0.85);

        const gpuHints = deriveGPUPlacementHints(gpuContext?.info ?? null, ollamaContextSize);
        setLastGPUPlacementHints(gpuHints);
        const effectiveNumGpu = Number.isFinite(forcedNumGpu) ? forcedNumGpu : gpuHints?.num_gpu;

        console.log(
          `[Context] Tier: ${currentTier}, User size: ${userContextSize}, Ollama size: ${ollamaContextSize}`
        );

        if (gpuHints) {
          console.debug('[ModelContext] Derived GPU placement hints:', gpuHints);
        }

        // Stream the response
        const stream = provider.chatStream({
          model: currentModel,
          messages: providerMessages,
          tools: tools && tools.length > 0 && modelSupportsTools(currentModel) ? tools : undefined,
          systemPrompt: systemPrompt,
          abortSignal: abortController.signal,
          timeout: requestTimeout,
          think: thinkingEnabled, // Enable thinking for supported models
          options: {
            num_ctx: ollamaContextSize, // Use tier-specific ollama_context_size
            temperature: temperatureOverride ?? temperature,
            ...(gpuHints ?? {}),
            num_gpu: effectiveNumGpu,
          },
        });

        console.log(
          `[ModelContext] Sending to Ollama - tier: ${currentTier}, num_ctx: ${ollamaContextSize}, temperature: ${temperatureOverride ?? temperature}`
        );

        for await (const event of stream) {
          if (abortController.signal.aborted) {
            break;
          }

          switch (event.type) {
            case 'text':
              if (modelLoading) {
                setModelLoading(false);
                clearWarmupStatus();
              }
              onText(event.value);
              break;
            case 'thinking':
              if (modelLoading) {
                setModelLoading(false);
                clearWarmupStatus();
              }
              onThinking?.(event.value);
              break;
            case 'tool_call':
              if (modelLoading) {
                setModelLoading(false);
                clearWarmupStatus();
              }
              onToolCall?.(event.value);
              break;
            case 'error': {
              const message = event.error.message || '';
              const errorCode = event.error.code;
              const isTimeout = isTimeoutError(message);
              const isToolError =
                errorCode === 'TOOL_UNSUPPORTED' || isToolUnsupportedError(message, errorCode);

              if (isToolError) {
                // Set session override (expires in 1 hour)
                await saveToolSupport(currentModel, false, false);

                // Trigger runtime learning with user confirmation
                // Pass model name, error message, and error code to handleToolError
                // Don't await - let it run in background to avoid blocking
                void handleToolError(currentModel, message, errorCode);
              }

              if (modelLoading && !isTimeout) {
                setModelLoading(false);
                clearWarmupStatus();
              }
              onError(message);
              return; // Break out of the entire sendToLLM function on error
            }
            case 'finish':
              if (modelLoading) {
                setModelLoading(false);
                clearWarmupStatus();
              }
              onComplete(event.metrics, event.reason);
              return;
          }
        }
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          // Request was cancelled, not an error
          onComplete(undefined, 'stop');
        } else {
          onError(error instanceof Error ? error.message : String(error));
        }
      } finally {
        abortControllerRef.current = null;
      }
    },
    [
      provider,
      currentModel,
      cancelRequest,
      modelLoading,
      modelSupportsTools,
      isTimeoutError,
      isToolUnsupportedError,
      clearWarmupStatus,
      handleToolError,
      saveToolSupport,
      gpuContext?.info,
      contextManagerState,
    ]
  );

  const value: ModelContextValue = {
    currentModel,
    setCurrentModel: setModelAndLoading,
    modelLoading,
    warmupStatus,
    skipWarmup,
    modelSupportsTools,
    sendToLLM,
    cancelRequest,
    provider,
  };

  return <ModelContext.Provider value={value}>{children}</ModelContext.Provider>;
}

/**
 * Hook to access the model context
 */
export function useModel(): ModelContextValue {
  const context = useContext(ModelContext);
  if (!context) {
    throw new Error('useModel must be used within a ModelProvider');
  }
  return context;
}
