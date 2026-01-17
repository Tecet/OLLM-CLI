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

/**
 * Model context value
 */
export interface ModelContextValue {
  /** Current model name */
  currentModel: string;

  /** Switch to a different model */
  setCurrentModel: (model: string) => void;

  /** Model loading state after a swap */
  modelLoading: boolean;
  
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
  const abortControllerRef = useRef<AbortController | null>(null);
  const warmupAbortRef = useRef<AbortController | null>(null);
  const warmupModelRef = useRef<string | null>(null);

  const setModelAndLoading = useCallback((model: string) => {
    const changed = currentModel !== model;
    if (changed) {
      setCurrentModel(model);
      setModelLoading(true);
    }
  }, [currentModel]);

  useEffect(() => {
    if (!modelLoading || !currentModel) return;
    if (warmupModelRef.current === currentModel) return;

    if (warmupAbortRef.current) {
      warmupAbortRef.current.abort();
    }

    warmupModelRef.current = currentModel;
    const controller = new AbortController();
    warmupAbortRef.current = controller;

    const runWarmup = async () => {
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
            const isTimeout = /timed out|timeout/i.test(message);
            if (!isTimeout) {
              setModelLoading(false);
            }
            return;
          }

          setModelLoading(false);
          return;
        }
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') return;
        setModelLoading(false);
      }
    };

    void runWarmup();
    return () => {
      controller.abort();
    };
  }, [modelLoading, currentModel, provider]);

  const cancelRequest = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
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
        tools: tools,
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
            }
            onText(event.value);
            break;
          case 'tool_call':
            if (modelLoading) {
              setModelLoading(false);
            }
            onToolCall?.(event.value);
            break;
          case 'error': {
            const message = event.error.message || '';
            const isTimeout = /timed out|timeout/i.test(message);
            if (modelLoading && !isTimeout) {
              setModelLoading(false);
            }
            onError(message);
            return; // Break out of the entire sendToLLM function on error
          }
          case 'finish':
            if (modelLoading) {
              setModelLoading(false);
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
  }, [provider, currentModel, cancelRequest, modelLoading]);

  const value: ModelContextValue = {
    currentModel,
    setCurrentModel: setModelAndLoading,
    modelLoading,
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
