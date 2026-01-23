/**
 * UI Callbacks Bridge
 * 
 * This component sits between the context providers (UserPromptProvider, ChatProvider)
 * and the ModelProvider, wiring up the UICallbacks from existing contexts.
 * 
 * It accesses the UserPrompt and Chat contexts and provides their functions
 * via the UICallbacksProvider.
 */

import React, { ReactNode, useCallback } from 'react';

import { useChat } from '../../features/context/ChatContext.js';
import { useUserPrompt } from '../../features/context/UserPromptContext.js';
import { UICallbacksProvider, type UICallbacks } from '../contexts/UICallbacksContext.js';

export interface UICallbacksBridgeProps {
  children: ReactNode;
  /** Callback to open model menu */
  onOpenModelMenu: () => void;
}

/**
 * Bridge component that wires up UI callbacks from existing contexts
 * 
 * This component must be placed:
 * - AFTER UserPromptProvider (needs useUserPrompt)
 * - AFTER ChatProvider (needs useChat)
 * - BEFORE ModelProvider (ModelProvider needs useUICallbacks)
 */
export function UICallbacksBridge({ children, onOpenModelMenu }: UICallbacksBridgeProps) {
  const { promptUser: contextPromptUser } = useUserPrompt();
  const { addMessage, clearChat } = useChat();

  /**
   * Wire up promptUser from UserPromptContext
   * Adds default timeout and default option
   */
  const promptUser = useCallback(
    async (message: string, options: string[]): Promise<string> => {
      // Default timeout: 30 seconds
      // Default option: last option (usually the safe/conservative choice)
      return await contextPromptUser(message, options, 30000, options[options.length - 1]);
    },
    [contextPromptUser]
  );

  /**
   * Wire up addSystemMessage from ChatContext
   * Converts to addMessage with role: 'system'
   */
  const addSystemMessage = useCallback(
    (message: string) => {
      addMessage({
        role: 'system',
        content: message,
      });
    },
    [addMessage]
  );

  /**
   * Wire up clearContext from ChatContext
   * Uses clearChat to clear conversation
   */
  const clearContext = useCallback(() => {
    clearChat();
  }, [clearChat]);

  /**
   * Wire up openModelMenu from props
   * Passed down from App.tsx
   */
  const openModelMenu = useCallback(() => {
    onOpenModelMenu();
  }, [onOpenModelMenu]);

  // Create callbacks object
  const uiCallbacks: UICallbacks = {
    promptUser,
    addSystemMessage,
    clearContext,
    openModelMenu,
  };

  return (
    <UICallbacksProvider callbacks={uiCallbacks}>
      {children}
    </UICallbacksProvider>
  );
}
