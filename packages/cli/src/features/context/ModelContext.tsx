/**
 * Model Context for managing the current model and LLM communication
 * 
 * This context:
 * - Tracks the currently selected model
 * - Provides methods to switch models
 * - Sends messages to the LLM and handles streaming responses
 */

import React, { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode } from 'react';
import type { ProviderAdapter, Message as ProviderMessage, ToolCall, ToolSchema, ProviderMetrics } from '@ollm/core';
import { profileManager } from '../profiles/ProfileManager.js';

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
    onComplete: (metrics?: ProviderMetrics) => void,
    onToolCall?: (toolCall: ToolCall) => void,
    tools?: ToolSchema[],
    systemPrompt?: string
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
export function ModelProvider({
  children,
  provider,
  initialModel,
}: ModelProviderProps) {
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
  
  // Enhanced tool support override tracking with source and timestamp
  const toolSupportOverridesRef = useRef<Map<string, {
    supported: boolean;
    source: 'profile' | 'runtime_error' | 'user_confirmed' | 'auto_detected';
    timestamp: number;
  }>>(new Map());

  // Track recent error prompts to debounce repeated errors
  const recentErrorPromptsRef = useRef<Map<string, number>>(new Map());
  const ERROR_PROMPT_DEBOUNCE_MS = 60000; // Don't prompt again within 60 seconds

  // Unknown model prompt state
  const [unknownModelPrompt, setUnknownModelPrompt] = useState<{
    modelId: string;
    timeoutHandle: NodeJS.Timeout | null;
  } | null>(null);

  /**
   * Save tool support metadata to user_models.json
   * Updates both the runtime override and persists to the user models file
   * @param model - The model ID
   * @param supported - Whether the model supports tools
   * @param source - The source of this information (user_confirmed or auto_detected)
   */
  const saveToolSupport = useCallback(async (
    model: string,
    supported: boolean,
    source: 'user_confirmed' | 'auto_detected' = 'user_confirmed'
  ) => {
    // Update runtime override
    toolSupportOverridesRef.current.set(model, {
      supported,
      source,
      timestamp: Date.now(),
    });

    // Update user_models.json
    const userModels = profileManager.getUserModels();
    const existing = userModels.find(m => m.id === model);

    if (existing) {
      existing.tool_support = supported;
      existing.tool_support_source = source;
      existing.tool_support_confirmed_at = new Date().toISOString();
    } else {
      // Create new entry for unknown model
      userModels.push({
        id: model,
        name: model,
        source: 'ollama',
        last_seen: new Date().toISOString(),
        tool_support: supported,
        tool_support_source: source,
        tool_support_confirmed_at: new Date().toISOString(),
        description: 'Custom model',
        abilities: [],
        context_profiles: [],
        default_context: 4096,
      });
    }

    profileManager.setUserModels(userModels);
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
   * @param message - The error message to check
   * @returns True if the message indicates tools are not supported
   */
  const isToolUnsupportedError = useCallback((message: string): boolean => {
    return /tools?|tool_calls?|unknown field/i.test(message);
  }, []);

  /**
   * Handle tool errors detected at runtime
   * Prompts user for confirmation before persisting metadata
   * Debounces repeated errors to avoid multiple prompts
   */
  const handleToolError = useCallback(async (model: string, errorMessage: string) => {
    // Check if this is actually a tool unsupported error
    if (!isToolUnsupportedError(errorMessage)) {
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

    // Get prompt and system message callbacks
    const promptUser = globalThis.__ollmPromptUser;
    const addSystemMessage = globalThis.__ollmAddSystemMessage;

    if (!promptUser) {
      // No prompt available, set session-only override
      toolSupportOverridesRef.current.set(model, {
        supported: false,
        source: 'runtime_error',
        timestamp: Date.now(),
      });
      
      if (addSystemMessage) {
        addSystemMessage(`Tool error detected for model "${model}". Tools disabled for this session.`);
      }
      return;
    }

    // Record that we're prompting now
    recentErrorPromptsRef.current.set(model, now);

    // Prompt user for confirmation with model name in context
    if (addSystemMessage) {
      addSystemMessage(`Tool error detected for model "${model}": ${errorMessage}`);
    }

    const response = await promptUser(
      `Model "${model}" appears to not support tools. Update metadata?`,
      ['Yes', 'No']
    );

    if (response === 'Yes') {
      // Save to user_models.json with user_confirmed source
      await saveToolSupport(model, false, 'user_confirmed');
      
      if (addSystemMessage) {
        addSystemMessage(`Tool support disabled for "${model}" and saved to user_models.json.`);
      }
    } else {
      // Set session-only override
      toolSupportOverridesRef.current.set(model, {
        supported: false,
        source: 'runtime_error',
        timestamp: Date.now(),
      });
      
      if (addSystemMessage) {
        addSystemMessage(`Tool support disabled for "${model}" for this session only.`);
      }
    }
  }, [isToolUnsupportedError, saveToolSupport]);

  /**
   * Check if a new override source should take precedence over an existing one
   * Priority: user_confirmed > auto_detected > runtime_error > profile
   * @param existing - The existing override entry
   * @param newSource - The new source to check
   * @returns True if the new source should override the existing one
   */
  const checkOverridePrecedence = useCallback((
    existing: { source: string; timestamp: number } | undefined,
    newSource: 'profile' | 'runtime_error' | 'user_confirmed' | 'auto_detected'
  ): boolean => {
    if (!existing) return true;
    
    const precedence = {
      'user_confirmed': 4,
      'auto_detected': 3,
      'runtime_error': 2,
      'profile': 1,
    };
    
    return precedence[newSource] >= precedence[existing.source as keyof typeof precedence];
  }, []);

  /**
   * Auto-detect tool support by sending a test request with minimal tool schema
   * Sends a test message with a minimal tool to check if the model supports function calling
   * @param model - The model ID to test
   * @returns Promise resolving to true if tools are supported, false otherwise
   */
  const autoDetectToolSupport = useCallback(async (model: string): Promise<boolean> => {
    const addSystemMessage = globalThis.__ollmAddSystemMessage;
    
    if (addSystemMessage) {
      addSystemMessage(`Auto-detecting tool support for ${model}...`);
    }

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
      
      // Save result to user_models.json
      await saveToolSupport(model, supported, 'auto_detected');
      
      if (addSystemMessage) {
        const status = supported ? 'Enabled' : 'Disabled';
        addSystemMessage(`Tool support detected: ${status}`);
      }
      
      return supported;
    } catch (error) {
      // Handle timeout or other errors
      if (error instanceof Error && error.name === 'AbortError') {
        if (addSystemMessage) {
          addSystemMessage('Auto-detect timed out. Defaulting to tools disabled.');
        }
      } else {
        if (addSystemMessage) {
          addSystemMessage('Auto-detect failed. Defaulting to tools disabled.');
        }
      }
      
      // Default to safe setting on error
      await saveToolSupport(model, false, 'auto_detected');
      return false;
    }
  }, [provider, saveToolSupport, isToolUnsupportedError]);

  /**
   * Handle unknown model by prompting user for tool support information
   * Prompts the user to specify if the model supports tools, with options for manual
   * confirmation or auto-detection. Includes a 30-second timeout with safe default.
   * @param model - The unknown model ID
   * @returns Promise resolving to true if tools are supported, false otherwise
   */
  const handleUnknownModel = useCallback(async (model: string): Promise<boolean> => {
    const promptUser = globalThis.__ollmPromptUser;
    const addSystemMessage = globalThis.__ollmAddSystemMessage;
    
    if (!promptUser) {
      // No prompt callback available, default to safe setting
      if (addSystemMessage) {
        addSystemMessage(`Unknown model "${model}". Defaulting to tools disabled for safety.`);
      }
      await saveToolSupport(model, false, 'auto_detected');
      return false;
    }

    if (addSystemMessage) {
      addSystemMessage(`Unknown model detected: ${model}`);
    }

    // Set up 30-second timeout with safe default
    const timeoutPromise = new Promise<string>((resolve) => {
      const handle = setTimeout(() => {
        if (addSystemMessage) {
          addSystemMessage('No response received. Defaulting to tools disabled for safety.');
        }
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
      await saveToolSupport(model, true, 'user_confirmed');
      if (addSystemMessage) {
        addSystemMessage('Tool support enabled and saved.');
      }
      return true;
    } else if (response === 'No') {
      await saveToolSupport(model, false, 'user_confirmed');
      if (addSystemMessage) {
        addSystemMessage('Tool support disabled and saved.');
      }
      return false;
    } else if (response === 'Auto-detect') {
      // Run auto-detection
      return await autoDetectToolSupport(model);
    } else {
      // Fallback for any other response
      if (addSystemMessage) {
        addSystemMessage('Invalid response. Defaulting to tools disabled.');
      }
      await saveToolSupport(model, false, 'auto_detected');
      return false;
    }
  }, [saveToolSupport, autoDetectToolSupport]);

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
        
        // Set override based on user response
        toolSupportOverridesRef.current.set(model, {
          supported: toolSupport,
          source: 'user_confirmed',
          timestamp: Date.now(),
        });
        
        // Add system message showing tool support status
        const addSystemMessage = globalThis.__ollmAddSystemMessage;
        if (addSystemMessage) {
          const toolStatus = toolSupport ? 'Enabled' : 'Disabled';
          addSystemMessage(`Switched to ${model}. Tools: ${toolStatus}`);
        }
        
        setCurrentModel(model);
        setModelLoading(true);
        
        if (previousModel && provider.unloadModel) {
          provider.unloadModel(previousModel).catch((error: unknown) => {
            const message = error instanceof Error ? error.message : String(error);
            console.warn(`Failed to unload model "${previousModel}": ${message}`);
          });
        }
        return;
      }
      
      // Determine tool support from metadata
      const toolSupport = userModel?.tool_support ?? profile?.tool_support ?? true;
      
      // Set proactive override for known non-tool models
      if (!toolSupport) {
        const existing = toolSupportOverridesRef.current.get(model);
        if (checkOverridePrecedence(existing, 'profile')) {
          toolSupportOverridesRef.current.set(model, {
            supported: false,
            source: 'profile',
            timestamp: Date.now(),
          });
        }
      }
      
      // Add system message showing tool support status
      const addSystemMessage = globalThis.__ollmAddSystemMessage;
      if (addSystemMessage) {
        const toolStatus = toolSupport ? 'Enabled' : 'Disabled';
        addSystemMessage(`Switched to ${model}. Tools: ${toolStatus}`);
      }
      
      setCurrentModel(model);
      setModelLoading(true);
      
      if (previousModel && provider.unloadModel) {
        provider.unloadModel(previousModel).catch((error: unknown) => {
          const message = error instanceof Error ? error.message : String(error);
          console.warn(`Failed to unload model "${previousModel}": ${message}`);
        });
      }
    }
  }, [currentModel, provider, checkOverridePrecedence, handleUnknownModel]);

  /**
   * Check if a model supports tools based on overrides and profile metadata
   * Checks runtime overrides first, then falls back to profile data
   * @param model - The model ID to check
   * @returns True if the model supports tools, false otherwise
   */
  const modelSupportsTools = useCallback((model: string): boolean => {
    const override = toolSupportOverridesRef.current.get(model);
    if (override !== undefined) {
      return override.supported;
    }

    const profile = profileManager.findProfile(model);
    if (profile && profile.tool_support === false) return false;

    return true;
  }, []);

  useEffect(() => {
    if (!modelLoading || !currentModel) return;
    if (warmupModelRef.current === currentModel) return;

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
    const retryDelaysMs = [1000, 2000, 4000];

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
        const stream = provider.chatStream({
          model: currentModel,
          messages: [
            { role: 'user', parts: [{ type: 'text' as const, text: 'warmup' }] },
          ],
          abortSignal: controller.signal,
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

  const sendToLLM = useCallback(async (
    messages: Array<{ 
      role: 'user' | 'assistant' | 'system' | 'tool'; 
      content: string; 
      toolCalls?: ToolCall[];
      toolCallId?: string; 
    }>,
    onText: (text: string) => void,
    onError: (error: string) => void,
    onComplete: (metrics?: ProviderMetrics) => void,
    onToolCall?: (toolCall: ToolCall) => void,
    tools?: ToolSchema[],
    systemPrompt?: string
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

      // Stream the response
      const stream = provider.chatStream({
        model: currentModel,
        messages: providerMessages,
        tools: tools && tools.length > 0 && modelSupportsTools(currentModel) ? tools : undefined,
        systemPrompt: systemPrompt,
        abortSignal: abortController.signal,
      });

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
            const isToolError = errorCode === 'TOOL_UNSUPPORTED' || isToolUnsupportedError(message);
            
            if (isToolError) {
              // Set runtime error override with enhanced tracking
              const existing = toolSupportOverridesRef.current.get(currentModel);
              if (checkOverridePrecedence(existing, 'runtime_error')) {
                toolSupportOverridesRef.current.set(currentModel, {
                  supported: false,
                  source: 'runtime_error',
                  timestamp: Date.now(),
                });
              }
              
              // Trigger runtime learning with user confirmation
              // Pass model name and error message to handleToolError
              // Don't await - let it run in background to avoid blocking
              void handleToolError(currentModel, message);
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
            onComplete(event.metrics);
            return;
        }
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        // Request was cancelled, not an error
        onComplete();
      } else {
        onError(error instanceof Error ? error.message : String(error));
      }
    } finally {
      abortControllerRef.current = null;
    }
  }, [provider, currentModel, cancelRequest, modelLoading, modelSupportsTools, isTimeoutError, isToolUnsupportedError, clearWarmupStatus, checkOverridePrecedence, handleToolError]);

  const value: ModelContextValue = {
    currentModel,
    setCurrentModel: setModelAndLoading,
    modelLoading,
    warmupStatus,
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
