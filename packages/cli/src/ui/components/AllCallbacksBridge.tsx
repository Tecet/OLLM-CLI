/**
 * All Callbacks Bridge
 * 
 * This component registers ALL UI callbacks (both old global style and new context style).
 * It provides a transition path from global callbacks to React Context.
 * 
 * Phase 1 (Current): Registers both global callbacks AND provides UICallbacksContext
 * Phase 2 (Future): Remove global callback registration, keep only UICallbacksContext
 */

import React, { useEffect, useCallback, ReactNode } from 'react';

import { useChat } from '../../features/context/ChatContext.js';
import { useUserPrompt } from '../../features/context/UserPromptContext.js';
import { UICallbacksProvider, type UICallbacks } from '../contexts/UICallbacksContext.js';

// Global callback type declarations
declare global {
  var __ollmPromptUser: ((message: string, options: string[]) => Promise<string>) | undefined;
  var __ollmAddSystemMessage: ((message: string) => void) | undefined;
  var __ollmClearContext: (() => void) | undefined;
  var __ollmOpenModelMenu: (() => void) | undefined;
}

export interface AllCallbacksBridgeProps {
  children: ReactNode;
  /** Callback to open model menu */
  onOpenModelMenu: () => void;
}

/**
 * Bridge component that registers all UI callbacks
 * 
 * This component must be placed:
 * - AFTER UserPromptProvider (needs useUserPrompt)
 * - AFTER ChatProvider (needs useChat)
 * - BEFORE components that use callbacks
 */
export function AllCallbacksBridge({ children, onOpenModelMenu }: AllCallbacksBridgeProps) {
  const { promptUser: contextPromptUser } = useUserPrompt();
  const { addMessage, clearChat } = useChat();

  /**
   * Wire up promptUser from UserPromptContext
   */
  const promptUser = useCallback(
    async (message: string, options: string[]): Promise<string> => {
      return await contextPromptUser(message, options, 30000, options[options.length - 1]);
    },
    [contextPromptUser]
  );

  /**
   * Wire up addSystemMessage from ChatContext
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
   */
  const clearContext = useCallback(() => {
    clearChat();
  }, [clearChat]);

  /**
   * Wire up openModelMenu from props
   */
  const openModelMenu = useCallback(() => {
    onOpenModelMenu();
  }, [onOpenModelMenu]);

  // Register global callbacks (Phase 1 - for backward compatibility)
  useEffect(() => {
    globalThis.__ollmPromptUser = promptUser;
    globalThis.__ollmAddSystemMessage = addSystemMessage;
    globalThis.__ollmClearContext = clearContext;
    globalThis.__ollmOpenModelMenu = openModelMenu;

    return () => {
      globalThis.__ollmPromptUser = undefined;
      globalThis.__ollmAddSystemMessage = undefined;
      globalThis.__ollmClearContext = undefined;
      globalThis.__ollmOpenModelMenu = undefined;
    };
  }, [promptUser, addSystemMessage, clearContext, openModelMenu]);

  // Create callbacks object for UICallbacksContext (Phase 2 - new approach)
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
