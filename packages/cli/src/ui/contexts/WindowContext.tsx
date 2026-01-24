/**
 * Window Context
 * 
 * Manages window switching between Chat, Terminal, and Editor windows.
 * 
 * Architecture:
 * - Provides a centralized state for the active window
 * - Supports three window types: 'chat', 'terminal', 'editor'
 * - Allows switching between windows via keyboard shortcuts (Ctrl+Left/Right)
 * - Integrates with focus management for proper keyboard navigation
 * 
 * Usage:
 * ```tsx
 * const { activeWindow, setActiveWindow, switchWindow } = useWindow();
 * 
 * // Check which window is active
 * if (isChatActive) { ... }
 * 
 * // Switch to a specific window
 * setActiveWindow('terminal');
 * 
 * // Cycle through windows
 * switchWindow(); // chat -> terminal -> editor -> chat
 * ```
 * 
 * Integration Points:
 * - ChatTab: Renders different content based on activeWindow
 * - App.tsx: Handles keyboard shortcuts for window switching
 * - FocusContext: Coordinates focus state with window state
 */

import React, { createContext, useContext, useState, useCallback } from 'react';

/**
 * Window type enumeration
 * - 'chat': Main chat interface with message history
 * - 'terminal': Interactive terminal for command execution
 * - 'editor': Code editor for file editing
 */
export type WindowType = 'chat' | 'terminal' | 'editor';
export type RightPanelType = 'tools' | 'workspace' | 'llm-chat' | 'terminal2';

/**
 * Window Context value interface
 * Provides state and methods for window management
 */
interface WindowContextValue {
  /** Currently active window */
  activeWindow: WindowType;

  /** Currently active right panel view */
  activeRightPanel: RightPanelType;
  
  /** Set the active window directly */
  setActiveWindow: (window: WindowType) => void;

  /** Set the active right panel view directly */
  setActiveRightPanel: (panel: RightPanelType) => void;
  
  /** Cycle to the next window (chat -> terminal -> editor -> chat) */
  switchWindow: () => void;

  /** Cycle to the next right panel view (tools -> workspace -> llm-chat -> terminal2) */
  switchRightPanel: () => void;
  
  /** Convenience flag: true if terminal is active */
  isTerminalActive: boolean;
  
  /** Convenience flag: true if chat is active */
  isChatActive: boolean;
  
  /** Convenience flag: true if editor is active */
  isEditorActive: boolean;
}

const WindowContext = createContext<WindowContextValue | undefined>(undefined);

/**
 * Window Provider Component
 * 
 * Wraps the application to provide window management state.
 * Should be placed high in the component tree, typically in App.tsx.
 * 
 * @param children - Child components that need access to window state
 */
export function WindowProvider({ children }: { children: React.ReactNode }) {
  // Default to chat window on startup
  const [activeWindow, setActiveWindow] = useState<WindowType>('chat');
  const [activeRightPanel, setActiveRightPanel] = useState<RightPanelType>('tools');

  /**
   * Cycles through windows in order: chat -> terminal -> editor -> chat
   * Used by keyboard shortcuts (Ctrl+Left/Right) for quick navigation
   */
  const switchWindow = useCallback(() => {
    setActiveWindow(prev => {
      if (prev === 'chat') return 'terminal';
      if (prev === 'terminal') return 'editor';
      return 'chat';
    });
  }, []);

  const switchRightPanel = useCallback(() => {
    setActiveRightPanel(prev => {
      if (prev === 'tools') return 'workspace';
      if (prev === 'workspace') return 'llm-chat';
      if (prev === 'llm-chat') return 'terminal2';
      return 'tools';
    });
  }, []);

  const value: WindowContextValue = {
    activeWindow,
    activeRightPanel,
    setActiveWindow,
    setActiveRightPanel,
    switchWindow,
    switchRightPanel,
    isTerminalActive: activeWindow === 'terminal',
    isChatActive: activeWindow === 'chat',
    isEditorActive: activeWindow === 'editor',
  };

  return (
    <WindowContext.Provider value={value}>
      {children}
    </WindowContext.Provider>
  );
}

/**
 * Hook to access window context
 * 
 * Must be used within a WindowProvider.
 * Throws an error if used outside the provider.
 * 
 * @returns Window context value with state and methods
 * @throws Error if used outside WindowProvider
 * 
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { activeWindow, switchWindow } = useWindow();
 *   
 *   return (
 *     <Box>
 *       <Text>Active: {activeWindow}</Text>
 *       <Button onClick={switchWindow}>Switch</Button>
 *     </Box>
 *   );
 * }
 * ```
 */
export function useWindow() {
  const context = useContext(WindowContext);
  if (!context) {
    throw new Error('useWindow must be used within WindowProvider');
  }
  return context;
}
