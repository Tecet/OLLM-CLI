/**
 * FileTreeContext - React context for file tree state management
 * 
 * Manages the file tree structure, cursor position, scroll offset, and expanded
 * directories for virtual scrolling navigation.
 * 
 * Requirements: 2.1 (File tree navigation with virtual scrolling)
 */

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { FileNode } from './types.js';

/**
 * File tree state interface
 */
export interface FileTreeState {
  /** Root node of the file tree */
  root: FileNode | null;
  /** Current cursor position (index in visible nodes) */
  cursorPosition: number;
  /** Scroll offset for virtual scrolling (index of first visible item) */
  scrollOffset: number;
  /** Set of expanded directory paths */
  expandedPaths: Set<string>;
  /** Visible window of nodes (for virtual scrolling) */
  visibleWindow: FileNode[];
  /** Size of the visible window (default: 15 items) */
  windowSize: number;
  /** Follow Mode enabled state - automatically expands to LLM-referenced files */
  followModeEnabled: boolean;
}

/**
 * File tree context value with state and actions
 */
export interface FileTreeContextValue {
  /** Current file tree state */
  state: FileTreeState;
  /** Set the root node of the tree */
  setRoot: (root: FileNode | null) => void;
  /** Move cursor to a specific position */
  setCursorPosition: (position: number) => void;
  /** Move cursor up by one position */
  moveCursorUp: () => void;
  /** Move cursor down by one position */
  moveCursorDown: () => void;
  /** Set scroll offset for virtual scrolling */
  setScrollOffset: (offset: number) => void;
  /** Expand a directory by path */
  expandDirectory: (path: string) => void;
  /** Collapse a directory by path */
  collapseDirectory: (path: string) => void;
  /** Toggle directory expansion state */
  toggleDirectory: (path: string) => void;
  /** Check if a directory is expanded */
  isExpanded: (path: string) => boolean;
  /** Set the visible window of nodes */
  setVisibleWindow: (nodes: FileNode[]) => void;
  /** Get the currently selected node (at cursor position) */
  getSelectedNode: () => FileNode | null;
  /** Reset tree state to initial values */
  resetTree: () => void;
  /** Toggle Follow Mode on/off */
  toggleFollowMode: () => void;
  /** Expand tree to show a specific file path */
  expandToPath: (filePath: string) => Promise<void>;
}

/**
 * Default file tree state
 */
const defaultState: FileTreeState = {
  root: null,
  cursorPosition: 0,
  scrollOffset: 0,
  expandedPaths: new Set(),
  visibleWindow: [],
  windowSize: 15, // Virtual scrolling window size
  followModeEnabled: false, // Follow Mode disabled by default
};

/**
 * File tree context
 */
const FileTreeContext = createContext<FileTreeContextValue | undefined>(undefined);

/**
 * Props for FileTreeProvider
 */
export interface FileTreeProviderProps {
  children: ReactNode;
  initialState?: Partial<FileTreeState>;
  windowSize?: number;
}

/**
 * FileTreeProvider component
 * 
 * Provides file tree state and actions to child components.
 */
export function FileTreeProvider({ 
  children, 
  initialState,
  windowSize = 15,
}: FileTreeProviderProps) {
  const [state, setState] = useState<FileTreeState>({
    ...defaultState,
    windowSize,
    ...initialState,
    // Ensure expandedPaths is a Set even if initialState provides an array
    expandedPaths: initialState?.expandedPaths instanceof Set
      ? initialState.expandedPaths
      : new Set(initialState?.expandedPaths || []),
  });

  const setRoot = useCallback((root: FileNode | null) => {
    setState((prev) => ({
      ...prev,
      root,
      cursorPosition: 0,
      scrollOffset: 0,
    }));
  }, []);

  const setCursorPosition = useCallback((position: number) => {
    setState((prev) => {
      const maxPosition = Math.max(0, prev.visibleWindow.length - 1);
      const clampedPosition = Math.max(0, Math.min(position, maxPosition));
      
      // Adjust scroll offset if cursor moves outside visible window
      let newScrollOffset = prev.scrollOffset;
      if (clampedPosition < prev.scrollOffset) {
        newScrollOffset = clampedPosition;
      } else if (clampedPosition >= prev.scrollOffset + prev.windowSize) {
        newScrollOffset = clampedPosition - prev.windowSize + 1;
      }
      
      return {
        ...prev,
        cursorPosition: clampedPosition,
        scrollOffset: newScrollOffset,
      };
    });
  }, []);

  const moveCursorUp = useCallback(() => {
    setState((prev) => {
      if (prev.cursorPosition <= 0) {
        return prev; // Already at top
      }
      
      const newPosition = prev.cursorPosition - 1;
      let newScrollOffset = prev.scrollOffset;
      
      // Scroll up if cursor moves above visible window
      if (newPosition < prev.scrollOffset) {
        newScrollOffset = newPosition;
      }
      
      return {
        ...prev,
        cursorPosition: newPosition,
        scrollOffset: newScrollOffset,
      };
    });
  }, []);

  const moveCursorDown = useCallback(() => {
    setState((prev) => {
      const maxPosition = Math.max(0, prev.visibleWindow.length - 1);
      if (prev.cursorPosition >= maxPosition) {
        return prev; // Already at bottom
      }
      
      const newPosition = prev.cursorPosition + 1;
      let newScrollOffset = prev.scrollOffset;
      
      // Scroll down if cursor moves below visible window
      if (newPosition >= prev.scrollOffset + prev.windowSize) {
        newScrollOffset = newPosition - prev.windowSize + 1;
      }
      
      return {
        ...prev,
        cursorPosition: newPosition,
        scrollOffset: newScrollOffset,
      };
    });
  }, []);

  const setScrollOffset = useCallback((offset: number) => {
    setState((prev) => ({
      ...prev,
      scrollOffset: Math.max(0, offset),
    }));
  }, []);

  const expandDirectory = useCallback((path: string) => {
    setState((prev) => {
      const newExpandedPaths = new Set(prev.expandedPaths);
      newExpandedPaths.add(path);
      return {
        ...prev,
        expandedPaths: newExpandedPaths,
      };
    });
  }, []);

  const collapseDirectory = useCallback((path: string) => {
    setState((prev) => {
      const newExpandedPaths = new Set(prev.expandedPaths);
      newExpandedPaths.delete(path);
      return {
        ...prev,
        expandedPaths: newExpandedPaths,
      };
    });
  }, []);

  const toggleDirectory = useCallback((path: string) => {
    setState((prev) => {
      const newExpandedPaths = new Set(prev.expandedPaths);
      if (newExpandedPaths.has(path)) {
        newExpandedPaths.delete(path);
      } else {
        newExpandedPaths.add(path);
      }
      return {
        ...prev,
        expandedPaths: newExpandedPaths,
      };
    });
  }, []);

  const isExpanded = useCallback((path: string): boolean => {
    return state.expandedPaths.has(path);
  }, [state.expandedPaths]);

  const setVisibleWindow = useCallback((nodes: FileNode[]) => {
    setState((prev) => ({
      ...prev,
      visibleWindow: nodes,
    }));
  }, []);

  const getSelectedNode = useCallback((): FileNode | null => {
    if (state.cursorPosition >= 0 && state.cursorPosition < state.visibleWindow.length) {
      return state.visibleWindow[state.cursorPosition];
    }
    return null;
  }, [state.cursorPosition, state.visibleWindow]);

  const resetTree = useCallback(() => {
    setState({
      ...defaultState,
      windowSize: state.windowSize,
    });
  }, [state.windowSize]);

  const toggleFollowMode = useCallback(() => {
    setState((prev) => ({
      ...prev,
      followModeEnabled: !prev.followModeEnabled,
    }));
  }, []);

  const expandToPath = useCallback(async (filePath: string) => {
    // This method expands all parent directories to show the specified file
    // It's used by Follow Mode to automatically expand to LLM-referenced files
    
    if (!state.root) {
      return;
    }

    // Normalize the file path
    const normalizedPath = filePath.replace(/\\/g, '/');
    const rootPath = state.root.path.replace(/\\/g, '/');

    // Check if the file is within the root
    if (!normalizedPath.startsWith(rootPath)) {
      return;
    }

    // Get the relative path from root
    const relativePath = normalizedPath.substring(rootPath.length).replace(/^\//, '');
    const pathParts = relativePath.split('/');

    // Expand each parent directory
    let currentPath = rootPath;
    const newExpandedPaths = new Set(state.expandedPaths);

    for (let i = 0; i < pathParts.length - 1; i++) {
      currentPath = `${currentPath}/${pathParts[i]}`;
      newExpandedPaths.add(currentPath);
    }

    setState((prev) => ({
      ...prev,
      expandedPaths: newExpandedPaths,
    }));
  }, [state.root, state.expandedPaths]);

  const value: FileTreeContextValue = {
    state,
    setRoot,
    setCursorPosition,
    moveCursorUp,
    moveCursorDown,
    setScrollOffset,
    expandDirectory,
    collapseDirectory,
    toggleDirectory,
    isExpanded,
    setVisibleWindow,
    getSelectedNode,
    resetTree,
    toggleFollowMode,
    expandToPath,
  };

  return <FileTreeContext.Provider value={value}>{children}</FileTreeContext.Provider>;
}

/**
 * Hook to access file tree context
 * 
 * @throws Error if used outside FileTreeProvider
 */
export function useFileTree(): FileTreeContextValue {
  const context = useContext(FileTreeContext);
  if (!context) {
    throw new Error('useFileTree must be used within a FileTreeProvider');
  }
  return context;
}
