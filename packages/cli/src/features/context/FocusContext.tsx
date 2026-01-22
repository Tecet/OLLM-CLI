import React, { createContext, useContext, useState, useCallback, useMemo, ReactNode } from 'react';
import { useUI } from './UIContext.js';

export type FocusableId = 
  | 'chat-input' 
  | 'chat-history' 
  | 'nav-bar' 
  | 'context-panel' 
  | 'system-bar'
  | 'file-tree' 
  | 'side-file-tree'
  | 'functions'
  | 'tools-panel'
  | 'hooks-panel'
  | 'mcp-panel'
  | 'docs-panel'
  | 'settings-panel'
  | 'search-panel'
  | 'github-tab';

export type NavigationMode = 'browse' | 'active';

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
  const { setActiveTab, state: uiState } = useUI();
  const { activeTab, sidePanelVisible } = uiState;

  const [activeId, setActiveId] = useState<FocusableId>('chat-input');
  const [mode, setModeState] = useState<NavigationMode>('browse');

  // Dynamically calculate the focus cycle based on what's visible
  const currentCycle = useMemo(() => {
    const list: FocusableId[] = ['chat-input'];

    // Add main content panel based on active tab
    const tabToFocusMap: Record<string, FocusableId> = {
      'chat': 'chat-history',
      'tools': 'tools-panel',
      'hooks': 'hooks-panel',
      'mcp': 'mcp-panel',
      'docs': 'docs-panel',
      'settings': 'settings-panel',
      'search': 'search-panel',
      'files': 'context-panel', // Maps to the Context Files list in FilesTab
      'github': 'github-tab',
    };

    const activeMainFocus = tabToFocusMap[activeTab];
    if (activeMainFocus) {
      list.push(activeMainFocus);
    }

    // Include nav-bar
    list.push('nav-bar');

    // Add side panel row 3 (context) if visible
    if (sidePanelVisible) {
      list.push('context-panel');
    }

    return list;
  }, [activeTab, sidePanelVisible]);

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
        'hooks': 'hooks-panel',
        'mcp': 'mcp-panel',
        'files': 'file-tree',
        'search': 'search-panel',
        'docs': 'docs-panel',
        'github': 'github-tab',
        'settings': 'settings-panel',
        'chat': 'chat-history',
      };
      
      const targetFocus = tabToFocusMap[activeTab] || 'chat-input';
      setActiveId(targetFocus);
    }
  }, [activeId]);

  const exitToNavBar = useCallback(() => {
    // When Esc is pressed from tab content, return to nav-bar in browse mode AND reset to chat
    setModeState('browse');
    setActiveTab('chat');
    setActiveId('nav-bar');
  }, [setActiveTab]);

  const cycleFocus = useCallback((direction: 'next' | 'previous') => {
    setActiveId((current) => {
      const currentIndex = currentCycle.indexOf(current);
      
      // If current item is not in the new filtered cycle, go to input
      if (currentIndex === -1) return 'chat-input';

      let nextIndex;
      if (direction === 'next') {
        nextIndex = (currentIndex + 1) % currentCycle.length;
      } else {
        nextIndex = (currentIndex - 1 + currentCycle.length) % currentCycle.length;
      }
      return currentCycle[nextIndex];
    });
  }, [currentCycle]);

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
