import React, { createContext, useContext, ReactNode } from 'react';

import { createLogger } from '../../../../core/src/utils/logger.js';
/**
 * UI Callbacks Context
 *
 * Provides type-safe callbacks for components to interact with the UI layer.
 * Replaces the global callback pattern (globalThis.__ollm*) with proper
 * dependency injection using React Context.
 */

const logger = createLogger('UICallbacksContext');

/**
 * UI Callbacks interface
 * Provides methods for components to interact with the UI layer
 */
export interface UICallbacks {
  /**
   * Prompt the user for input
   * @param message The prompt message
   * @param options Available options
   * @returns The user's selection
   */
  promptUser: (message: string, options: string[]) => Promise<string>;

  /**
   * Add a system message to the chat
   * @param message The message to add
   */
  addSystemMessage: (message: string) => void;

  /**
   * Clear the conversation context
   */
  clearContext: () => void;

  /**
   * Open the model selection menu
   */
  openModelMenu: () => void;
}

/**
 * Default no-op implementations for callbacks
 * Used when context is not available (e.g., in tests without provider)
 *
 * These provide safe fallbacks that log warnings instead of crashing.
 */
const defaultCallbacks: UICallbacks = {
  promptUser: async (message: string, options: string[]) => {
    logger.warn('[UICallbacks] promptUser called but no callback registered:', message);
    // Default to last option (usually the safe/conservative choice)
    return options[options.length - 1];
  },

  addSystemMessage: (message: string) => {
    logger.warn('[UICallbacks] addSystemMessage called but no callback registered:', message);
  },

  clearContext: () => {
    logger.warn('[UICallbacks] clearContext called but no callback registered');
  },

  openModelMenu: () => {
    logger.warn('[UICallbacks] openModelMenu called but no callback registered');
  },
};

/**
 * UI Callbacks Context
 */
const UICallbacksContext = createContext<UICallbacks>(defaultCallbacks);

/**
 * Props for UICallbacksProvider
 */
export interface UICallbacksProviderProps {
  /** Child components */
  children: ReactNode;

  /** Callback implementations */
  callbacks: UICallbacks;
}

/**
 * Provider for UI callbacks
 *
 * Wrap your app with this provider to make callbacks available to all
 * child components via the useUICallbacks hook.
 *
 * @example
 * ```tsx
 * const callbacks: UICallbacks = {
 *   promptUser: async (msg, opts) => { ... },
 *   addSystemMessage: (msg) => { ... },
 *   clearContext: () => { ... },
 *   openModelMenu: () => { ... },
 * };
 *
 * <UICallbacksProvider callbacks={callbacks}>
 *   <App />
 * </UICallbacksProvider>
 * ```
 */
export function UICallbacksProvider({ children, callbacks }: UICallbacksProviderProps) {
  return <UICallbacksContext.Provider value={callbacks}>{children}</UICallbacksContext.Provider>;
}

/**
 * Hook to access UI callbacks
 *
 * Use this hook in any component that needs to interact with the UI layer.
 *
 * @returns UI callbacks object
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { promptUser, addSystemMessage } = useUICallbacks();
 *
 *   const handleClick = async () => {
 *     const response = await promptUser('Continue?', ['Yes', 'No']);
 *     addSystemMessage(`User selected: ${response}`);
 *   };
 *
 *   return <button onClick={handleClick}>Click me</button>;
 * }
 * ```
 */
export function useUICallbacks(): UICallbacks {
  return useContext(UICallbacksContext);
}
