/**
 * Model Context for managing the current model and LLM communication
 * 
 * This context:
 * - Tracks the currently selected model
 * - Provides methods to switch models
 * - Sends messages to the LLM and handles streaming responses
 */

import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from 'react';
import type { ProviderAdapter, Message as ProviderMessage, ToolCall, ToolSchema, ProviderMetrics } from '@ollm/core';
import { profileManager } from '../profiles/ProfileManager.js';
import { SettingsService } from '../../config/settingsService.js';
import { useUICallbacks } from '../../ui/contexts/UICallbacksContext.js';

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

// Session overrides expire after 1 hour
const SESSION_OVERRIDE_TTL = 60 * 60 * 1000;

export interface ModelProviderProps {
  children: ReactNode;
  provider: ProviderAdapter;
  initialModel: string;
}

/**
 * Model Provider component
 */
export function ModelProvider({
  children,
  provider,
  initialModel,
}: ModelProviderProps) {
  // Get UI callbacks from context
  const { promptUser, addSystemMessage, clearContext } = useUICallbacks();
  
  const [currentModel, setCurrentModel] = useState(initialModel);
  const [modelLoading, setModelLoading] = useState(false);
  const [warmupStatus, setWarmupStatus] = useState<{
    active: boolean;
    attempt: number;
    elapsedMs: number;
  } | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const warmupAbortRef = useRef<AbortController | null>(null);
  const warmupModelRef = useRef<string | null>(null);
  const warmupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warmupAttemptsRef = useRef<Map<string, number>>(new Map());
  const warmupStartRef = useRef<number | null>(null);
  
  // Simplified tool support override tracking (2 levels: user_confirmed vs session)
  interface ToolSupportOverride {
    supported: boolean;
    source: 'user_confirmed' | 'session';
    timestamp: number;
    expiresAt?: number; // For session overrides only
  }
  
  const toolSupportOverridesRef = useRef<Map<string, ToolSupportOverride>>(new Map());
  
  // Track recent error prompts to debounce repeated errors
  const recentErrorPromptsRef = useRef<Map<string, number>>(new Map());
  const ERROR_PROMPT_DEBOUNCE_MS = 60000; // Don't prompt again within 60 seconds

  // Unknown model prompt state
  const [_unknownModelPrompt, setUnknownModelPrompt] = useState<{
    modelId: string;
    timeoutHandle: NodeJS.Timeout | null;
  } | null>(null);

  /**
   * Save tool support metadata to user_models.json
   * Updates both the runtime override and persists to the user models file
   * @param model - The model ID
   * @param supported - Whether the model supports tools
   * @param permanent - Whether to save permanently (user_confirmed) or session-only
   */
  const saveToolSupport = useCallback(async (
    model: string,
    supported: boolean,
    permanent: boolean = false
  ) => {
    // Update runtime override
    const override: ToolSupportOverride = {
      supported,
      source: permanent ? 'user_confirmed' : 'session',
      timestamp: Date.now(),
      expiresAt: permanent ? undefined : Date.now() + SESSION_OVERRIDE_TTL,
    };
    
    toolSupportOverridesRef.current.set(model, override);

    // Only persist to user_models.json if permanent
    if (permanent) {
      const userModels = profileManager.getUserModels();
      const existing = userModels.find(m => m.id === model);

      if (existing) {
        existing.tool_support = supported;
        existing.tool_support_source = 'user_confirmed';
        existing.tool_support_confirmed_at = new Date().toISOString();
      } else {
        // Create new entry for unknown model
        userModels.push({
          id: model,
          name: model,
          source: 'ollama',
          last_seen: new Date().toISOString(),
          tool_support: supported,
          tool_support_source: 'user_confirmed',
          tool_support_confirmed_at: new Date().toISOString(),
          description: 'Custom model',
          abilities: [],
          context_profiles: [],
          default_context: 4096,
        });
      }

      profileManager.setUserModels(userModels);
    }
  }, []);

  /**
   * Get tool support override for a model, checking for expiration
   * @param model - The model ID
   * @returns Tool support status, or undefined if no override exists
   */
  const getToolSupportOverride = useCallback((model: string): boolean | undefined => {
    const override = toolSupportOverridesRef.current.get(model);
    
    if (!override) {
      return undefined;
    }
    
    // Check expiration for session overrides
    if (override.source === 'session' && override.expiresAt) {
      if (Date.now() > override.expiresAt) {
        // Expired, remove it
        toolSupportOverridesRef.current.delete(model);
        return undefined;
      }
    }
    
    return override.supported;
  }, []);
  
  /**
   * Check if an error message indicates a timeout
   * @param message - The error message to check
   * @returns True if the message indicates a timeout
   */
  const isTimeoutError = useCallback((message: string): boolean => {
    return /timed out|timeout/i.test(message);
  }, []);

  /**
   * Check if an error message indicates tool unsupported error
   * Checks structured error code first, then falls back to pattern matching
   * @param message - The error message to check
   * @param code - Optional structured error code
   * @returns True if the message indicates tools are not supported
   */
  const isToolUnsupportedError = useCallback((message: string, code?: string): boolean => {
    // Check structured code first (most reliable)
    if (code === 'TOOL_UNSUPPORTED') {
      return true;
    }
    
    // Fall back to pattern matching for compatibility
    const patterns = [
      /tools?.*not supported/i,
      /tool_calls?.*not supported/i,
      /unknown field.*tools?/i,
      /function calling.*not supported/i,
      /model does not support.*tools?/i,
      /tools?.*not available/i,
      /tools?.*disabled/i,
    ];
    
    return patterns.some(pattern => pattern.test(message));
  }, []);

  /**
   * Handle tool errors detected at runtime
   * Prompts user for confirmation before persisting metadata
   * Debounces repeated errors to avoid multiple prompts
   */
  const handleToolError = useCallback(async (model: string, errorMessage: string, errorCode?: string) => {
    // Check if this is actually a tool unsupported error
    if (!isToolUnsupportedError(errorMessage, errorCode)) {
      return;
    }

    // Check if we already have a user_confirmed override - don't override user choice
    const existing = toolSupportOverridesRef.current.get(model);
    if (existing?.source === 'user_confirmed') {
      return;
    }

    // Debounce: Check if we've recently prompted for this model
    const lastPromptTime = recentErrorPromptsRef.current.get(model);
    const now = Date.now();
    if (lastPromptTime && (now - lastPromptTime) < ERROR_PROMPT_DEBOUNCE_MS) {
      // Too soon since last prompt, skip
      return;
    }

    // Record that we're prompting now
    recentErrorPromptsRef.current.set(model, now);

    // Prompt user for confirmation with model name in context
    addSystemMessage(`Tool error detected for model "${model}": ${errorMessage}`);

    const response = await promptUser(
      `Model "${model}" appears to not support tools. Save this permanently?`,
      ['Yes (Permanent)', 'No (Session Only)', 'Cancel']
    );

    if (response === 'Yes (Permanent)') {
      // Save permanently to user_models.json
      await saveToolSupport(model, false, true);
      addSystemMessage(`Tool support disabled for "${model}" and saved permanently.`);
    } else if (response === 'No (Session Only)') {
      // Set session-only override (expires in 1 hour)
      await saveToolSupport(model, false, false);
      addSystemMessage(`Tool support disabled for "${model}" for this session only (expires in 1 hour).`);
    } else {
      // Cancel - don't set any override
      addSystemMessage(`Tool support setting not changed for "${model}".`);
    }
  }, [isToolUnsupportedError, saveToolSupport, promptUser, addSystemMessage]);

  /**
   * Auto-detect tool support by sending a test request with minimal tool schema
   * Sends a test message with a minimal tool to check if the model supports function calling
   * @param model - The model ID to test
   * @returns Promise resolving to true if tools are supported, false otherwise
   */
  const autoDetectToolSupport = useCallback(async (model: string): Promise<boolean> => {
    addSystemMessage(`Auto-detecting tool support for ${model}...`);

    // Create minimal test tool schema
    const testTools: ToolSchema[] = [{
      name: 'test_tool',
      description: 'Test tool for capability detection',
      parameters: {
        type: 'object',
        properties: {},
        required: []
      }
    }];

    try {
      // Create abort controller with 5-second timeout
      const abortController = new AbortController();
      const timeoutId = setTimeout(() => abortController.abort(), 5000);

      // Send test request with tools
      const stream = provider.chatStream({
        model,
        messages: [
          { role: 'user', parts: [{ type: 'text' as const, text: 'test' }] }
        ],
        tools: testTools,
        abortSignal: abortController.signal,
      });

      let hasToolError = false;
      let hasSuccess = false;

      // Check for tool errors in the response
      for await (const event of stream) {
        if (event.type === 'error') {
          const message = event.error.message || '';
          hasToolError = isToolUnsupportedError(message);
          break;
        }
        if (event.type === 'text' || event.type === 'tool_call' || event.type === 'finish') {
          hasSuccess = true;
          break;
        }
      }

      clearTimeout(timeoutId);

      // Determine tool support based on response
      const supported = hasSuccess && !hasToolError;
      
      // Save result permanently
      await saveToolSupport(model, supported, true);
      
      const status = supported ? 'Enabled' : 'Disabled';
      addSystemMessage(`Tool support detected: ${status} (saved permanently)`);
      
      return supported;
    } catch (error) {
      // Handle timeout or other errors
      if (error instanceof Error && error.name === 'AbortError') {
        addSystemMessage('Auto-detect timed out. Defaulting to tools disabled.');
      } else {
        addSystemMessage('Auto-detect failed. Defaulting to tools disabled.');
      }
      
      // Default to safe setting on error (session only)
      await saveToolSupport(model, false, false);
      return false;
    }
  }, [provider, saveToolSupport, isToolUnsupportedError, addSystemMessage]);

  /**
   * Handle unknown model by prompting user for tool support information
   * Prompts the user to specify if the model supports tools, with options for manual
   * confirmation or auto-detection. Includes a 30-second timeout with safe default.
   * @param model - The unknown model ID
   * @returns Promise resolving to true if tools are supported, false otherwise
   */
  const handleUnknownModel = useCallback(async (model: string): Promise<boolean> => {
    addSystemMessage(`Unknown model detected: ${model}`);

    // Set up 30-second timeout with safe default
    const timeoutPromise = new Promise<string>((resolve) => {
      const handle = setTimeout(() => {
        addSystemMessage('No response received. Defaulting to tools disabled for safety.');
        resolve('No'); // Safe default
      }, 30000);
      
      // Store timeout handle for cleanup
      setUnknownModelPrompt({ modelId: model, timeoutHandle: handle });
    });

    // Race between user response and timeout
    const responsePromise = promptUser(
      `Does "${model}" support function calling/tools?`,
      ['Yes', 'No', 'Auto-detect']
    );

    const response = await Promise.race([responsePromise, timeoutPromise]);

    // Clear timeout state
    setUnknownModelPrompt((prev) => {
      if (prev?.timeoutHandle) {
        clearTimeout(prev.timeoutHandle);
      }
      return null;
    });

    if (response === 'Yes') {
      await saveToolSupport(model, true, true);
      addSystemMessage('Tool support enabled and saved permanently.');
      return true;
    } else if (response === 'No') {
      await saveToolSupport(model, false, true);
      addSystemMessage('Tool support disabled and saved permanently.');
      return false;
    } else if (response === 'Auto-detect') {
      // Run auto-detection
      return await autoDetectToolSupport(model);
    } else {
      // Fallback for any other response (including timeout)
      addSystemMessage('Invalid response. Defaulting to tools disabled (session only).');
      await saveToolSupport(model, false, false);
      return false;
    }
  }, [saveToolSupport, autoDetectToolSupport, promptUser, addSystemMessage]);

  const setModelAndLoading = useCallback(async (model: string) => {
    const changed = currentModel !== model;
    if (changed) {
      const previousModel = currentModel;
      warmupAttemptsRef.current.delete(model);
      
      // Check ProfileManager for tool support metadata
      const userModels = profileManager.getUserModels();
      const userModel = userModels.find(m => m.id === model);
      const profile = profileManager.findProfile(model);
      
      // Handle unknown models
      if (!userModel && !profile) {
        const toolSupport = await handleUnknownModel(model);
        
        // Set override based on user response (already saved by handleUnknownModel)
        
        // Add system message showing tool support status
        const addSystemMessage = globalThis.__ollmAddSystemMessage;
        if (addSystemMessage) {
          const toolStatus = toolSupport ? 'Enabled' : 'Disabled';
          const override = toolSupportOverridesRef.current.get(model);
          const persistence = override?.source === 'user_confirmed' ? 'Permanent' : 'Session';
          addSystemMessage(`Switched to ${model}. Tools: ${toolStatus} (${persistence})`);
        }
        
        setCurrentModel(model);
        setModelLoading(true);
        
        if (previousModel && provider.unloadModel) {
          provider.unloadModel(previousModel).catch((error: unknown) => {
            const message = error instanceof Error ? error.message : String(error);
            console.warn(`Failed to unload model "${previousModel}": ${message}`);
          });
        }
        
        // Clear context on model switch (optional, configurable)
        const settingsService = SettingsService.getInstance();
        const settings = settingsService.getSettings();
        const shouldClearContext = settings.llm?.clearContextOnModelSwitch ?? true; // Default: true (backward compatible)
        
        if (shouldClearContext) {
          clearContext();
        }
        
        return;
      }
      
      // Determine tool support from metadata
      const toolSupport = userModel?.tool_support ?? profile?.tool_support ?? true;
      
      // Set session override for known non-tool models (expires in 1 hour)
      if (!toolSupport) {
        await saveToolSupport(model, false, false);
      }
      
      // Add system message showing tool support status
      const toolStatus = toolSupport ? 'Enabled' : 'Disabled';
      addSystemMessage(`Switched to ${model}. Tools: ${toolStatus}`);
      
      setCurrentModel(model);
      setModelLoading(true);
      
      if (previousModel && provider.unloadModel) {
        provider.unloadModel(previousModel).catch((error: unknown) => {
          const message = error instanceof Error ? error.message : String(error);
          console.warn(`Failed to unload model "${previousModel}": ${message}`);
        });
      }
      
      // Clear context on model switch (optional, configurable)
      const settingsService = SettingsService.getInstance();
      const settings = settingsService.getSettings();
      const shouldClearContext2 = settings.llm?.clearContextOnModelSwitch ?? true; // Default: true (backward compatible)
      
      if (shouldClearContext2) {
        clearContext();
      }
    }
  }, [currentModel, provider, handleUnknownModel, saveToolSupport, addSystemMessage, clearContext]);

  /**
   * Check if a model supports tools based on overrides and profile metadata
   * Checks runtime overrides first (with expiration), then falls back to profile data
   * @param model - The model ID to check
   * @returns True if the model supports tools, false otherwise
   */
  const modelSupportsTools = useCallback((model: string): boolean => {
    // Check for override (handles expiration automatically)
    const override = getToolSupportOverride(model);
    if (override !== undefined) {
      return override;
    }

    // Fall back to profile data
    const profile = profileManager.findProfile(model);
    if (profile && profile.tool_support === false) return false;

    // Default to true (assume tools supported)
    return true;
  }, [getToolSupportOverride]);

  useEffect(() => {
    if (!modelLoading || !currentModel) return;
    if (warmupModelRef.current === currentModel) return;

    // Check if warmup is enabled in settings
    const settingsService = SettingsService.getInstance();
    const settings = settingsService.getSettings();
    const warmupEnabled = settings.llm?.warmup?.enabled ?? true;
    
    if (!warmupEnabled) {
      // Warmup disabled, skip it
      setModelLoading(false);
      return;
    }

    if (warmupAbortRef.current) {
      warmupAbortRef.current.abort();
    }
    if (warmupTimerRef.current) {
      clearTimeout(warmupTimerRef.current);
      warmupTimerRef.current = null;
    }

    warmupModelRef.current = currentModel;
    warmupStartRef.current = Date.now();
    setWarmupStatus({
      active: true,
      attempt: 1,
      elapsedMs: 0,
    });
    const controller = new AbortController();
    warmupAbortRef.current = controller;
    const modelName = currentModel;
    
    // Get configuration
    const maxAttempts = settings.llm?.warmup?.maxAttempts ?? 3;
    const retryDelaysMs = [1000, 2000, 4000].slice(0, maxAttempts - 1);

    const scheduleRetry = () => {
      const previousAttempts = warmupAttemptsRef.current.get(modelName) ?? 0;
      const nextAttempts = previousAttempts + 1;
      warmupAttemptsRef.current.set(modelName, nextAttempts);
      const delay = retryDelaysMs[nextAttempts - 1];
      if (!delay) {
        setModelLoading(false);
        setWarmupStatus(null);
        warmupStartRef.current = null;
        return;
      }
      setWarmupStatus((current) => ({
        active: true,
        attempt: nextAttempts + 1,
        elapsedMs: current?.elapsedMs ?? 0,
      }));
      warmupTimerRef.current = setTimeout(() => {
        if (controller.signal.aborted) return;
        if (warmupModelRef.current !== modelName) return;
        void runWarmup();
      }, delay);
    };

    const runWarmup = async (): Promise<void> => {
      try {
        // Get model-specific timeout from profile or settings
        const profile = profileManager.findProfile(currentModel);
        const configTimeout = settings.llm?.warmup?.timeout ?? 30000;
        const warmupTimeout = profile?.warmup_timeout ?? configTimeout;

        const stream = provider.chatStream({
          model: currentModel,
          messages: [
            { role: 'user', parts: [{ type: 'text' as const, text: 'warmup' }] },
          ],
          abortSignal: controller.signal,
          timeout: warmupTimeout,
        });

        for await (const event of stream) {
          if (controller.signal.aborted) return;
          if (event.type === 'error') {
            const message = event.error.message || '';
            const isTimeout = isTimeoutError(message);
            if (isTimeout) {
              scheduleRetry();
              return;
            }
            setModelLoading(false);
            return;
          }

          setModelLoading(false);
          setWarmupStatus(null);
          warmupStartRef.current = null;
          warmupAttemptsRef.current.delete(modelName);
          return;
        }
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') return;
        scheduleRetry();
      }
    };

    void runWarmup();
    return () => {
      if (warmupTimerRef.current) {
        clearTimeout(warmupTimerRef.current);
        warmupTimerRef.current = null;
      }
      setWarmupStatus(null);
      warmupStartRef.current = null;
      controller.abort();
    };
  }, [modelLoading, currentModel, provider, isTimeoutError]);

  useEffect(() => {
    if (!warmupStatus?.active) return;
    const interval = setInterval(() => {
      const startedAt = warmupStartRef.current;
      if (!startedAt) return;
      setWarmupStatus((current) => {
        if (!current?.active) return current;
        return {
          ...current,
          elapsedMs: Date.now() - startedAt,
        };
      });
    }, 250);
    return () => clearInterval(interval);
  }, [warmupStatus?.active]);

  const cancelRequest = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  const clearWarmupStatus = useCallback(() => {
    setWarmupStatus(null);
    warmupStartRef.current = null;
  }, []);
  
  const skipWarmup = useCallback(() => {
    if (warmupAbortRef.current) {
      warmupAbortRef.current.abort();
    }
    if (warmupTimerRef.current) {
      clearTimeout(warmupTimerRef.current);
      warmupTimerRef.current = null;
    }
    setModelLoading(false);
    setWarmupStatus(null);
    warmupStartRef.current = null;
    
    // Add system message
    addSystemMessage('Warmup skipped by user.');
  }, [addSystemMessage]);

  const sendToLLM = useCallback(async (
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
      const providerMessages: ProviderMessage[] = messages.map(msg => ({
        role: msg.role === 'tool' ? 'tool' : msg.role,
        parts: [{ type: 'text' as const, text: msg.content }],
        toolCalls: msg.toolCalls,
        toolCallId: msg.toolCallId,
      }));

      // Get model-specific timeout from profile if not provided
      const profile = profileManager.findProfile(currentModel);
      const requestTimeout = timeout ?? profile?.warmup_timeout ?? 30000;
      
      // Check if model supports thinking
      const thinkingEnabled = profile?.thinking_enabled ?? false;
      
      // Get user settings for context size and temperature
      const settingsService = SettingsService.getInstance();
      const settings = settingsService.getSettings();
      const userContextSize = settings.llm?.contextSize ?? 4096;
      const temperature = settings.llm?.temperature ?? 0.1;

      // Get ollama_context_size from profile (85% cap strategy)
      // This is the actual size we send to Ollama to trigger natural stops
      let ollamaContextSize = userContextSize; // Default to user's selection
      
      if (profile?.context_profiles) {
        // Find the matching context profile for user's selected size
        const matchingProfile = profile.context_profiles.find(p => p.size === userContextSize);
        if (matchingProfile && matchingProfile.ollama_context_size) {
          ollamaContextSize = matchingProfile.ollama_context_size;
          console.log(`[Context Cap] User selected: ${userContextSize}, Sending to Ollama: ${ollamaContextSize} (${Math.round((ollamaContextSize / userContextSize) * 100)}%)`);
        } else {
          // Fallback: calculate 85% if profile doesn't have ollama_context_size
          ollamaContextSize = Math.floor(userContextSize * 0.85);
          console.log(`[Context Cap] No profile found, calculated 85%: ${ollamaContextSize}`);
        }
      }

      // DEBUG removed - was causing ESM require error

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
          num_ctx: ollamaContextSize, // Use 85% capped size for natural stops
          temperature: temperatureOverride ?? temperature,
        },
      });

      console.log(`[ModelContext] Sending to Ollama - num_ctx: ${ollamaContextSize}, temperature: ${temperatureOverride ?? temperature}`);

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
            const isToolError = errorCode === 'TOOL_UNSUPPORTED' || isToolUnsupportedError(message, errorCode);
            
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
  }, [provider, currentModel, cancelRequest, modelLoading, modelSupportsTools, isTimeoutError, isToolUnsupportedError, clearWarmupStatus, handleToolError, saveToolSupport]);

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

  return (
    <ModelContext.Provider value={value}>
      {children}
    </ModelContext.Provider>
  );
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
