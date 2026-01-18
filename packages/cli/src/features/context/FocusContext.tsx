import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

export type FocusableId = 
  | 'chat-input' 
  | 'chat-history' 
  | 'nav-bar' 
  | 'context-panel' 
  | 'file-tree' 
  | 'functions'
  | 'tools-panel';

export type NavigationMode = 'browse' | 'active';

// Order of cycling
const CYCLE_ORDER: FocusableId[] = [
  'chat-input',
  'chat-history',
  'nav-bar',
  'context-panel',
  'file-tree',
  'functions',
  'tools-panel'
];

export interface FocusContextValue {
  activeId: FocusableId;
  mode: NavigationMode;
  setFocus: (id: FocusableId) => void;
  setMode: (mode: NavigationMode) => void;
  activateContent: (activeTab: string) => void;
  exitToNavBar: () => void;
  cycleFocus: (direction: 'next' | 'previous') => void;
  isFocused: (id: FocusableId) => boolean;
  isActive: () => boolean;
}

const FocusContext = createContext<FocusContextValue | undefined>(undefined);

export function FocusProvider({ children }: { children: ReactNode }) {
  const [activeId, setActiveId] = useState<FocusableId>('chat-input');
  const [mode, setModeState] = useState<NavigationMode>('browse');

  const setFocus = useCallback((id: FocusableId) => {
    setActiveId(id);
  }, []);

  const setMode = useCallback((newMode: NavigationMode) => {
    setModeState(newMode);
  }, []);

  const activateContent = useCallback((activeTab: string) => {
    // When Enter is pressed on nav-bar, activate the current tab content
    if (activeId === 'nav-bar') {
      setModeState('active');
      
      // Map tab to focusable ID and set focus
      const tabToFocusMap: Record<string, FocusableId> = {
        'tools': 'tools-panel',
        'files': 'file-tree',
        'search': 'context-panel', // Temporary mapping
        'docs': 'context-panel',   // Temporary mapping
        'github': 'context-panel',  // Temporary mapping
        'settings': 'context-panel', // Temporary mapping
        'chat': 'chat-history',
      };
      
      const targetFocus = tabToFocusMap[activeTab] || 'chat-input';
      setActiveId(targetFocus);
    }
  }, [activeId]);

  const exitToNavBar = useCallback(() => {
    // When Esc is pressed from tab content, return to nav-bar in browse mode
    setModeState('browse');
    setActiveId('nav-bar');
  }, []);

  const cycleFocus = useCallback((direction: 'next' | 'previous') => {
    setActiveId((current) => {
      const currentIndex = CYCLE_ORDER.indexOf(current);
      if (currentIndex === -1) return 'chat-input';

      let nextIndex;
      if (direction === 'next') {
        nextIndex = (currentIndex + 1) % CYCLE_ORDER.length;
      } else {
        nextIndex = (currentIndex - 1 + CYCLE_ORDER.length) % CYCLE_ORDER.length;
      }
      return CYCLE_ORDER[nextIndex];
    });
  }, []);

  const isFocused = useCallback((id: FocusableId) => activeId === id, [activeId]);

  const isActive = useCallback(() => mode === 'active', [mode]);

  return (
    <FocusContext.Provider value={{ activeId, mode, setFocus, setMode, activateContent, exitToNavBar, cycleFocus, isFocused, isActive }}>
      {children}
    </FocusContext.Provider>
  );
}

export function useFocusManager() {
  const context = useContext(FocusContext);
  if (!context) {
    throw new Error('useFocusManager must be used within a FocusProvider');
  }
  return context;
}
