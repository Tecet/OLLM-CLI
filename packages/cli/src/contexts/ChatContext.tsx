import React, { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode } from 'react';
import { useContextManager } from './ContextManagerContext.js';
import { commandRegistry } from '../commands/index.js';
import { useServices } from './ServiceContext.js';
import { useModel } from './ModelContext.js';
import { useUI } from './UIContext.js';

/**
 * Tool call information
 */
export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  result?: string;
  duration?: number;
  status: 'pending' | 'success' | 'error';
}

/**
 * Reasoning block from model thinking process
 */
export interface ReasoningBlock {
  content: string;
  tokenCount: number;
  duration: number;
  complete: boolean;
}

/**
 * Inference metrics for performance tracking
 */
export interface InferenceMetrics {
  // Raw values from provider
  promptTokens: number;
  completionTokens: number;
  totalDuration: number;       // Nanoseconds
  promptDuration: number;      // Nanoseconds
  evalDuration: number;        // Nanoseconds
  
  // Calculated values
  tokensPerSecond: number;
  timeToFirstToken: number;    // Seconds
  totalSeconds: number;
  
  // Optional
  loadDuration?: number;
}

/**
 * Chat message
 */
export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  timestamp: Date;
  
  // Optional fields
  toolCalls?: ToolCall[];
  reasoning?: ReasoningBlock;
  metrics?: InferenceMetrics;
  
  // UI state
  expanded?: boolean;
  editing?: boolean;
}

/**
 * Chat state
 */
export interface ChatState {
  messages: Message[];
  streaming: boolean;
  waitingForResponse: boolean;
  currentInput: string;
}

/**
 * Chat context value
 */
export interface ChatContextValue {
  state: ChatState;
  
  /** Send a message to the assistant */
  sendMessage: (content: string) => Promise<void>;
  
  /** Cancel the current generation */
  cancelGeneration: () => void;
  
  /** Clear all messages */
  clearChat: () => void;
  
  /** Edit a message */
  editMessage: (id: string, content: string) => void;
  
  /** Set the current input value */
  setCurrentInput: (input: string) => void;
  
  /** Add a message to the chat */
  addMessage: (message: Omit<Message, 'id' | 'timestamp'>) => void;
  
  /** Update a message */
  updateMessage: (id: string, updates: Partial<Message>) => void;
  
  /** Set streaming state */
  setStreaming: (streaming: boolean) => void;
  
  /** Set waiting for response state */
  setWaitingForResponse: (waiting: boolean) => void;
}

const ChatContext = createContext<ChatContextValue | undefined>(undefined);

export interface ChatProviderProps {
  children: ReactNode;
  
  /** Initial messages */
  initialMessages?: Message[];
  
  /** Callback when a message is sent */
  onSendMessage?: (content: string) => Promise<void>;
  
  /** Callback when generation is cancelled */
  onCancelGeneration?: () => void;
}

export function ChatProvider({
  children,
  initialMessages = [],
  onSendMessage, // Optional - kept for backwards compatibility
  onCancelGeneration, // Optional - kept for backwards compatibility
}: ChatProviderProps) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [streaming, setStreaming] = useState(false);
  const [waitingForResponse, setWaitingForResponse] = useState(false);
  const [currentInput, setCurrentInput] = useState('');
  
  // Get context manager if available (hook must always be called unconditionally)
  // We use a ref to track if the context is available
  const contextManagerRef = useRef<ReturnType<typeof useContextManager> | null>(null);
  
  // Try to use context manager - this will be null if not available
  // We wrap in try-catch during initialization only
  useEffect(() => {
    try {
      // This is a workaround - in production, ChatProvider would always be inside ContextManagerProvider
      // For backwards compatibility, we handle the case where it's not
    } catch {
      // ContextManager not available
    }
  }, []);

  // Get UI context to handle launch screen commands
  const { setLaunchScreenVisible, setTheme } = useUI();
  
  // Wire up the service container to the command registry
  // This enables service-dependent commands like /model list to work
  // Note: ChatProvider is always inside ServiceProvider in the component hierarchy
  const { container: serviceContainer } = useServices();
  
  // Get the model context for sending messages to the LLM
  const { sendToLLM, cancelRequest, setCurrentModel } = useModel();
  
  // Track the current assistant message ID for streaming updates
  const assistantMessageIdRef = useRef<string | null>(null);
  
  useEffect(() => {
    if (serviceContainer) {
      commandRegistry.setServiceContainer(serviceContainer);
      // Store the model switching callback globally so commands can access it
      (globalThis as any).__ollmModelSwitchCallback = setCurrentModel;
    }
  }, [serviceContainer, setCurrentModel]);

  // Wire up the theme callback to the command registry
  useEffect(() => {
    if (setTheme) {
      commandRegistry.setThemeCallback(setTheme);
    }
  }, [setTheme]);

  // Convert chat messages to core message format for context tracking
  const convertToContextMessage = useCallback((msg: Message) => ({
    role: msg.role as 'user' | 'assistant' | 'system',
    content: msg.content,
  }), []);

  const addMessage = useCallback((message: Omit<Message, 'id' | 'timestamp'>) => {
    const newMessage: Message = {
      ...message,
      id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, newMessage]);
    
    // Track message in context manager if available
    if (contextManagerRef.current && message.role !== 'tool') {
      contextManagerRef.current.actions.addMessage(convertToContextMessage(newMessage)).catch(console.error);
    }
  }, [convertToContextMessage]);

  const updateMessage = useCallback((id: string, updates: Partial<Message>) => {
    setMessages((prev) =>
      prev.map((msg) => (msg.id === id ? { ...msg, ...updates } : msg))
    );
  }, []);

  const sendMessage = useCallback(
    async (content: string) => {
      // Add user message
      addMessage({
        role: 'user',
        content,
      });

      // Clear input
      setCurrentInput('');

      // Check if this is a slash command
      if (commandRegistry.isCommand(content)) {
        try {
          const result = await commandRegistry.execute(content);
          
          // Handle navigation actions
          if (result.action === 'show-launch-screen') {
            setLaunchScreenVisible(true);
          }
          
          // Add command result as system message
          addMessage({
            role: 'system',
            content: result.message || (result.success ? 'Command executed successfully' : 'Command failed'),
          });
        } catch (error) {
          addMessage({
            role: 'system',
            content: `Command error: ${error instanceof Error ? error.message : String(error)}`,
          });
        }
        return;
      }

      // Set waiting state for regular chat messages
      setWaitingForResponse(true);
      setStreaming(true);

      // Create a placeholder assistant message for streaming
      const assistantMsgId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      assistantMessageIdRef.current = assistantMsgId;
      
      const assistantMessage: Message = {
        id: assistantMsgId,
        role: 'assistant',
        content: '',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMessage]);

      // Build conversation history for the LLM
      const conversationHistory = messages.map(msg => ({
        role: msg.role as 'user' | 'assistant' | 'system',
        content: msg.content,
      }));
      // Add the new user message
      conversationHistory.push({ role: 'user', content });

      try {
        await sendToLLM(
          conversationHistory,
          // onText - update the assistant message with streamed text
          (text: string) => {
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantMsgId
                  ? { ...msg, content: msg.content + text }
                  : msg
              )
            );
          },
          // onError - show error message
          (error: string) => {
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantMsgId
                  ? { ...msg, content: msg.content || `Error: ${error}` }
                  : msg
              )
            );
          },
          // onComplete - mark streaming as complete
          () => {
            setStreaming(false);
            setWaitingForResponse(false);
            assistantMessageIdRef.current = null;
          }
        );
      } catch (error) {
        console.error('Error sending message:', error);
        
        // Update the assistant message with error
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMsgId
              ? { ...msg, content: `Error: ${error instanceof Error ? error.message : String(error)}` }
              : msg
          )
        );
        setStreaming(false);
        setWaitingForResponse(false);
        assistantMessageIdRef.current = null;
      }
    },
    [addMessage, messages, sendToLLM, setLaunchScreenVisible]
  );

  const cancelGeneration = useCallback(() => {
    // Cancel the actual LLM request
    cancelRequest();
    
    setStreaming(false);
    setWaitingForResponse(false);
    assistantMessageIdRef.current = null;
    
    if (onCancelGeneration) {
      onCancelGeneration();
    }
  }, [onCancelGeneration, cancelRequest]);

  const clearChat = useCallback(() => {
    setMessages([]);
    setCurrentInput('');
    setStreaming(false);
    setWaitingForResponse(false);
    
    // Clear context manager messages if available
    if (contextManagerRef.current) {
      contextManagerRef.current.actions.clear().catch(console.error);
    }
  }, []);

  const editMessage = useCallback(
    (id: string, content: string) => {
      updateMessage(id, { content, editing: false });
    },
    [updateMessage]
  );

  const value: ChatContextValue = {
    state: {
      messages,
      streaming,
      waitingForResponse,
      currentInput,
    },
    sendMessage,
    cancelGeneration,
    clearChat,
    editMessage,
    setCurrentInput,
    addMessage,
    updateMessage,
    setStreaming,
    setWaitingForResponse,
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChat(): ChatContextValue {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
}
