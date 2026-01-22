import React, { createContext, useContext, useState, useCallback, useMemo, ReactNode } from 'react';
import { useUI } from './UIContext.js';

export type FocusableId = 
  // Level 1: Tab Cycle (Main UI Areas - can reach with Tab key)
  | 'chat-input'      // User input area
  | 'chat-history'    // Chat window/history
  | 'nav-bar'         // Navigation bar (tab selector)
  | 'context-panel'   // Side panel (right side)
  | 'system-bar'      // System status bar
  // Level 2: Tab Content (Deeper than Tab cycle)
  | 'file-tree'       // Files tab content
  | 'side-file-tree'  // Workspace panel in side panel
  | 'functions'       // Functions panel
  | 'tools-panel'     // Tools tab content
  | 'hooks-panel'     // Hooks tab content
  | 'mcp-panel'       // MCP tab content
  | 'docs-panel'      // Docs tab content
  | 'settings-panel'  // Settings tab content
  | 'search-panel'    // Search tab content
  | 'github-tab'      // GitHub tab content
  // Level 3+: Modals & Viewers (Deepest)
  | 'syntax-viewer'
  | 'search-dialog'
  | 'quick-open-dialog'
  | 'confirmation-dialog'
  | 'help-panel'
  | 'quick-actions-menu';

export type NavigationMode = 'browse' | 'active';

export interface FocusContextValue {
  activeId: FocusableId;
  mode: NavigationMode;
  setFocus: (id: FocusableId) => void;
  setMode: (mode: NavigationMode) => void;
  activateContent: (activeTab: string) => void;
  exitToNavBar: () => void;
  exitOneLevel: () => void;
  openModal: (modalId: FocusableId) => void;
  closeModal: () => void;
  cycleFocus: (direction: 'next' | 'previous') => void;
  isFocused: (id: FocusableId) => boolean;
  isActive: () => boolean;
  getFocusLevel: (id: FocusableId) => number;
}

const FocusContext = createContext<FocusContextValue | undefined>(undefined);

export function FocusProvider({ children }: { children: ReactNode }) {
  const { setActiveTab, state: uiState } = useUI();
  const { activeTab, sidePanelVisible } = uiState;

  const [activeId, setActiveId] = useState<FocusableId>('chat-input');
  const [mode, setModeState] = useState<NavigationMode>('browse');
  const [modalParent, setModalParent] = useState<FocusableId | null>(null);

  // Tab cycle for Level 1 (Main UI Areas)
  // Fixed cycle: User Input → Chat Window → Nav Bar → Side Panel → (repeat)
  const currentCycle = useMemo(() => {
    const cycle: FocusableId[] = [
      'chat-input',    // User Input
      'chat-history',  // Chat Window
      'nav-bar',       // Nav Bar
    ];
    
    // Add side panel if visible
    if (sidePanelVisible) {
      cycle.push('context-panel');
    }
    
    return cycle;
  }, [sidePanelVisible]);

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

  // Get focus level for hierarchical navigation
  const getFocusLevel = useCallback((id: FocusableId): number => {
    // Level 1: Tab Cycle - Main UI areas reachable with Tab key
    const level1: FocusableId[] = [
      'chat-input',
      'chat-history',
      'nav-bar',
      'context-panel',
      'system-bar',
    ];
    
    // Level 2: Tab Content - Deeper navigation within tabs
    const level2: FocusableId[] = [
      'file-tree',
      'side-file-tree',
      'functions',
      'tools-panel',
      'hooks-panel',
      'mcp-panel',
      'docs-panel',
      'settings-panel',
      'search-panel',
      'github-tab',
    ];
    
    // Level 3+: Modals & Viewers - Deepest level
    const level3: FocusableId[] = [
      'syntax-viewer',
      'search-dialog',
      'quick-open-dialog',
      'confirmation-dialog',
      'help-panel',
      'quick-actions-menu',
    ];

    if (level3.includes(id)) return 3;
    if (level2.includes(id)) return 2;
    if (level1.includes(id)) return 1;
    return 1; // Default to Level 1
  }, []);

  // Hierarchical ESC navigation - moves up one level
  const exitOneLevel = useCallback(() => {
    const currentLevel = getFocusLevel(activeId);

    if (currentLevel === 3) {
      // Level 3 (Modals/Viewers) → Return to parent (Level 2)
      if (modalParent) {
        setActiveId(modalParent);
        setModalParent(null);
      } else {
        // Fallback: go to nav-bar on chat tab
        setActiveTab('chat');
        setActiveId('nav-bar');
        setModeState('browse');
      }
    } else if (currentLevel === 2) {
      // Level 2 (Tab Content) → Go to nav-bar (Level 1)
      setActiveId('nav-bar');
      setModeState('browse');
    } else if (currentLevel === 1) {
      // Level 1 (Tab Cycle) → Two-step process
      if (activeId === 'nav-bar' && activeTab === 'chat') {
        // Already on Chat tab in navbar → Go to user input
        setActiveId('chat-input');
      } else {
        // Not on Chat tab in navbar → Switch to Chat tab (stay in navbar)
        setActiveTab('chat');
        setActiveId('nav-bar');
        setModeState('browse');
      }
    }
  }, [activeId, modalParent, getFocusLevel, activeTab, setActiveTab]);

  // Open a modal and track its parent
  const openModal = useCallback((modalId: FocusableId) => {
    setModalParent(activeId);
    setActiveId(modalId);
  }, [activeId]);

  // Close modal and return to parent
  const closeModal = useCallback(() => {
    if (modalParent) {
      setActiveId(modalParent);
      setModalParent(null);
    } else {
      // Fallback: exit one level
      exitOneLevel();
    }
  }, [modalParent, exitOneLevel]);

  return (
    <FocusContext.Provider value={{ 
      activeId, 
      mode, 
      setFocus, 
      setMode, 
      activateContent, 
      exitToNavBar, 
      exitOneLevel,
      openModal,
      closeModal,
      cycleFocus, 
      isFocused, 
      isActive,
      getFocusLevel,
    }}>
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
