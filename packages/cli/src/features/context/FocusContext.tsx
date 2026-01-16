import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

export type FocusableId = 
  | 'chat-input' 
  | 'chat-history' 
  | 'nav-bar' 
  | 'context-panel' 
  | 'file-tree' 
  | 'functions';

// Order of cycling
const CYCLE_ORDER: FocusableId[] = [
  'chat-input',
  'chat-history',
  'nav-bar',
  'context-panel',
  'file-tree',
  'functions'
];

export interface FocusContextValue {
  activeId: FocusableId;
  setFocus: (id: FocusableId) => void;
  cycleFocus: (direction: 'next' | 'previous') => void;
  isFocused: (id: FocusableId) => boolean;
}

const FocusContext = createContext<FocusContextValue | undefined>(undefined);

export function FocusProvider({ children }: { children: ReactNode }) {
  const [activeId, setActiveId] = useState<FocusableId>('chat-input');

  const setFocus = useCallback((id: FocusableId) => {
    setActiveId(id);
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

  return (
    <FocusContext.Provider value={{ activeId, setFocus, cycleFocus, isFocused }}>
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
