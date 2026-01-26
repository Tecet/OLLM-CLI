/**
 * ChatProvider - Composes all chat-related hooks into a unified context
 * This replaces the monolithic ChatContext.tsx with a clean composition pattern
 */

import { createContext, useContext, useEffect, ReactNode } from 'react';

import { commandRegistry } from '../../commands/index.js';
// Import context dependencies
import { useContextManager } from '../context/ContextManagerContext.js';
import { useModel } from '../context/ModelContext.js';
import { useServices } from '../context/ServiceContext.js';
import { useUI } from '../context/UIContext.js';
import { useFocusedFilesInjection } from '../context/useFocusedFilesInjection.js';
// Import all the focused hooks
import { useChatNetwork } from './hooks/useChatNetwork.js';
import { useChatState } from './hooks/useChatState.js';
import { useContextEvents } from './hooks/useContextEvents.js';
import { useMenuSystem } from './hooks/useMenuSystem.js';
import { useScrollManager } from './hooks/useScrollManager.js';
import { useSessionRecording } from './hooks/useSessionRecording.js';

// Import types
import type { ChatContextValue, Message } from './types.js';

// Declare global callback for model switching
declare global {
  var __ollmModelSwitchCallback: ((model: string) => void) | undefined;
}

const ChatContext = createContext<ChatContextValue | undefined>(undefined);

export interface ChatProviderProps {
  children: ReactNode;
  initialMessages?: Message[];
  onSendMessage?: (content: string) => Promise<void>;
  onCancelGeneration?: () => void;
}

/**
 * ChatProvider - Main provider that composes all chat functionality
 */
export function ChatProvider({
  children,
  initialMessages = [],
  onSendMessage: _onSendMessage,
  onCancelGeneration: _onCancelGeneration,
}: ChatProviderProps) {
  // Get dependencies from other contexts
  const { actions: contextActions, state: contextManagerState } = useContextManager();
  const contextUsage = contextManagerState.usage;
  const { setLaunchScreenVisible, setTheme } = useUI();
  const { container: serviceContainer } = useServices();
  const { 
    sendToLLM, 
    cancelRequest, 
    setCurrentModel, 
    provider, 
    currentModel, 
    modelSupportsTools 
  } = useModel();
  const injectFocusedFilesIntoPrompt = useFocusedFilesInjection();

  // Initialize core chat state
  const chatState = useChatState(initialMessages);
  
  // Initialize menu system
  const menuSystem = useMenuSystem({
    menuState: chatState.menuState,
    setMenuState: chatState.setMenuState,
    setInputMode: chatState.setInputMode,
  });

  // Initialize scroll manager
  const scrollManager = useScrollManager({
    selectedLineIndex: chatState.selectedLineIndex,
    setSelectedLineIndex: chatState.setSelectedLineIndex,
    scrollOffset: chatState.scrollOffset,
    setScrollOffset: chatState.setScrollOffset,
    streaming: chatState.streaming,
    messagesLength: chatState.messages.length,
  });

  // Initialize session recording
  const sessionRecording = useSessionRecording({
    serviceContainer,
    currentModel,
    providerName: provider?.name ?? 'unknown',
  });

  // Initialize context events handler
  const contextEvents = useContextEvents({
    contextActions,
    contextUsagePercentage: contextUsage.percentage || 0,
    addMessage: chatState.addMessage,
    setStatusMessage: chatState.setStatusMessage,
  });

  // Clear chat function
  const clearChat = () => {
    chatState.clearMessages();
    if (contextActions) {
      contextActions.clear().catch(console.error);
    }
  };

  // Initialize network/LLM communication
  const chatNetwork = useChatNetwork({
    contextActions,
    _sendToLLM: sendToLLM,
    _cancelRequest: cancelRequest,
    provider,
    currentModel,
    modelSupportsTools,
    serviceContainer,
    injectFocusedFilesIntoPrompt,
    addMessage: chatState.addMessage,
    _updateMessage: chatState.updateMessage,
    setStreaming: chatState.setStreaming,
    setWaitingForResponse: chatState.setWaitingForResponse,
    setInputMode: chatState.setInputMode,
    setMenuState: chatState.setMenuState,
    clearChat,
    setLaunchScreenVisible,
    recordSessionMessage: sessionRecording.recordSessionMessage,
    _compressionOccurred: contextEvents.compressionOccurred,
    _compressionRetryCount: contextEvents.compressionRetryCount,
    waitingForResume: contextEvents.waitingForResume,
    _resetCompressionFlags: contextEvents.resetCompressionFlags,
    setWaitingForResume: contextEvents.setWaitingForResume,
  });

  // Register global callbacks
  useEffect(() => {
    if (serviceContainer) {
      commandRegistry.setServiceContainer(serviceContainer);
      globalThis.__ollmModelSwitchCallback = setCurrentModel;
    }
  }, [serviceContainer, setCurrentModel]);

  useEffect(() => {
    if (setTheme) {
      commandRegistry.setThemeCallback(setTheme);
    }
  }, [setTheme]);

  // Cancel generation handler
  const cancelGeneration = () => {
    cancelRequest();
    chatState.setStreaming(false);
    chatState.setWaitingForResponse(false);
    if (_onCancelGeneration) {
      _onCancelGeneration();
    }
  };

  // Edit message handler
  const editMessage = (id: string, content: string) => {
    chatState.updateMessage(id, { content, editing: false });
  };

  // Compose the context value
  const value: ChatContextValue = {
    state: {
      messages: chatState.messages,
      streaming: chatState.streaming,
      waitingForResponse: chatState.waitingForResponse,
      currentInput: chatState.currentInput,
      inputMode: chatState.inputMode,
      menuState: chatState.menuState,
      statusMessage: chatState.statusMessage,
    },
    sendMessage: chatNetwork.sendMessage,
    cancelGeneration,
    clearChat,
    editMessage,
    setCurrentInput: chatState.setCurrentInput,
    addMessage: chatState.addMessage,
    updateMessage: chatState.updateMessage,
    setStreaming: chatState.setStreaming,
    setWaitingForResponse: chatState.setWaitingForResponse,
    setStatusMessage: chatState.setStatusMessage,
    contextUsage,
    setInputMode: chatState.setInputMode,
    setMenuState: menuSystem.updateMenuState,
    executeMenuOption: menuSystem.executeMenuOption,
    navigateMenu: menuSystem.navigateMenu,
    activateMenu: menuSystem.activateMenu,
    requestManualContextInput: chatNetwork.requestManualContextInput,
    selectedLineIndex: scrollManager.selectedLineIndex,
    setSelectedLineIndex: scrollManager.setSelectedLineIndex,
    scrollOffset: scrollManager.scrollOffset,
    scrollUp: scrollManager.scrollUp,
    scrollDown: scrollManager.scrollDown,
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

/**
 * Hook to access chat context
 */
export function useChat(): ChatContextValue {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
}
