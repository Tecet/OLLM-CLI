/**
 * Window Context
 * 
 * Manages window switching between LLM Chat and Terminal
 */

import React, { createContext, useContext, useState, useCallback } from 'react';

export type WindowType = 'chat' | 'terminal';

interface WindowContextValue {
  activeWindow: WindowType;
  setActiveWindow: (window: WindowType) => void;
  switchWindow: () => void;
  isTerminalActive: boolean;
  isChatActive: boolean;
}

const WindowContext = createContext<WindowContextValue | undefined>(undefined);

export function WindowProvider({ children }: { children: React.ReactNode }) {
  const [activeWindow, setActiveWindow] = useState<WindowType>('chat');

  const switchWindow = useCallback(() => {
    setActiveWindow(prev => prev === 'chat' ? 'terminal' : 'chat');
  }, []);

  const value: WindowContextValue = {
    activeWindow,
    setActiveWindow,
    switchWindow,
    isTerminalActive: activeWindow === 'terminal',
    isChatActive: activeWindow === 'chat',
  };

  return (
    <WindowContext.Provider value={value}>
      {children}
    </WindowContext.Provider>
  );
}

export function useWindow() {
  const context = useContext(WindowContext);
  if (!context) {
    throw new Error('useWindow must be used within WindowProvider');
  }
  return context;
}
