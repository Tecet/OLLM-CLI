/**
 * Hook for managing core chat state (messages, streaming, input)
 */

import { useState, useCallback } from 'react';

import type { Message, MenuState } from '../types.js';

export interface UseChatStateReturn {
  // State
  messages: Message[];
  streaming: boolean;
  waitingForResponse: boolean;
  currentInput: string;
  inputMode: 'text' | 'menu';
  menuState: MenuState;
  statusMessage: string | undefined;
  selectedLineIndex: number;
  scrollOffset: number;

  // Setters
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  setStreaming: (streaming: boolean) => void;
  setWaitingForResponse: (waiting: boolean) => void;
  setCurrentInput: (input: string) => void;
  setInputMode: React.Dispatch<React.SetStateAction<'text' | 'menu'>>;
  setMenuState: React.Dispatch<React.SetStateAction<MenuState>>;
  setStatusMessage: (message: string | undefined) => void;
  setSelectedLineIndex: React.Dispatch<React.SetStateAction<number>>;
  setScrollOffset: React.Dispatch<React.SetStateAction<number>>;

  // Actions
  addMessage: (message: Omit<Message, 'id' | 'timestamp'>) => Message;
  updateMessage: (id: string, updates: Partial<Message>) => void;
  clearMessages: () => void;
}

/**
 * Manages core chat state including messages, streaming status, and input
 */
export function useChatState(initialMessages: Message[] = []): UseChatStateReturn {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [streaming, setStreaming] = useState(false);
  const [waitingForResponse, setWaitingForResponse] = useState(false);
  const [currentInput, setCurrentInput] = useState('');
  const [selectedLineIndex, setSelectedLineIndex] = useState(0);
  const [statusMessage, setStatusMessage] = useState<string | undefined>(undefined);
  const [scrollOffset, setScrollOffset] = useState(0);

  // Menu State
  const [inputMode, setInputMode] = useState<'text' | 'menu'>('text');
  const [menuState, setMenuState] = useState<MenuState>({
    active: false,
    options: [],
    selectedIndex: 0,
  });

  /**
   * Add a new message to the chat
   */
  const addMessage = useCallback((message: Omit<Message, 'id' | 'timestamp'>) => {
    const newMessage: Message = {
      ...message,
      id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, newMessage]);
    return newMessage;
  }, []);

  /**
   * Update an existing message
   */
  const updateMessage = useCallback((id: string, updates: Partial<Message>) => {
    setMessages((prev) => prev.map((msg) => (msg.id === id ? { ...msg, ...updates } : msg)));
  }, []);

  /**
   * Clear all messages
   */
  const clearMessages = useCallback(() => {
    setMessages([]);
    setCurrentInput('');
    setStreaming(false);
    setWaitingForResponse(false);
  }, []);

  return {
    // State
    messages,
    streaming,
    waitingForResponse,
    currentInput,
    inputMode,
    menuState,
    statusMessage,
    selectedLineIndex,
    scrollOffset,

    // Setters
    setMessages,
    setStreaming,
    setWaitingForResponse,
    setCurrentInput,
    setInputMode,
    setMenuState,
    setStatusMessage,
    setSelectedLineIndex,
    setScrollOffset,

    // Actions
    addMessage,
    updateMessage,
    clearMessages,
  };
}
