/**
 * Model Context for managing the current model and LLM communication
 * 
 * This context:
 * - Tracks the currently selected model
 * - Provides methods to switch models
 * - Sends messages to the LLM and handles streaming responses
 */

import React, { createContext, useContext, useState, useCallback, useRef, ReactNode } from 'react';
import type { ProviderAdapter, ProviderEvent, Message as ProviderMessage } from '@ollm/core';

/**
 * Model context value
 */
export interface ModelContextValue {
  /** Current model name */
  currentModel: string;
  
  /** Switch to a different model */
  setCurrentModel: (model: string) => void;
  
  /** Send a message to the LLM and stream the response */
  sendToLLM: (
    messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>,
    onText: (text: string) => void,
    onError: (error: string) => void,
    onComplete: () => void
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
  const abortControllerRef = useRef<AbortController | null>(null);

  const cancelRequest = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  const sendToLLM = useCallback(async (
    messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>,
    onText: (text: string) => void,
    onError: (error: string) => void,
    onComplete: () => void
  ) => {
    // Cancel any existing request
    cancelRequest();

    // Create new abort controller
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      // Convert messages to provider format
      const providerMessages: ProviderMessage[] = messages.map(msg => ({
        role: msg.role,
        parts: [{ type: 'text' as const, text: msg.content }],
      }));

      // Stream the response
      const stream = provider.chatStream({
        model: currentModel,
        messages: providerMessages,
        abortSignal: abortController.signal,
      });

      for await (const event of stream) {
        if (abortController.signal.aborted) {
          break;
        }

        switch (event.type) {
          case 'text':
            onText(event.value);
            break;
          case 'error':
            onError(event.error.message);
            break;
          case 'finish':
            onComplete();
            break;
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
  }, [provider, currentModel, cancelRequest]);

  const value: ModelContextValue = {
    currentModel,
    setCurrentModel,
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
