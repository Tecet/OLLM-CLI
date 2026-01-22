/**
 * FileFocusContext - React context for file focus management
 * 
 * Manages the list of focused files for LLM context injection. Focused files
 * are pinned to the context and their content is injected into prompts.
 * 
 * Requirements: 3.1 (Focus system for LLM context)
 */

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { FocusedFile } from './types.js';

/**
 * Focus state interface
 */
export interface FocusState {
  /** Map of file paths to focused file data */
  focusedFiles: Map<string, FocusedFile>;
  /** Total size of all focused file content in bytes */
  totalSize: number;
  /** Maximum size per file (8KB = 8192 bytes) */
  maxSize: number;
}

/**
 * Focus context value with state and actions
 */
export interface FileFocusContextValue {
  /** Current focus state */
  state: FocusState;
  /** Add a file to the focus list */
  addFocusedFile: (file: FocusedFile) => void;
  /** Remove a file from the focus list by path */
  removeFocusedFile: (path: string) => void;
  /** Check if a file is currently focused */
  isFocused: (path: string) => boolean;
  /** Get a focused file by path */
  getFocusedFile: (path: string) => FocusedFile | undefined;
  /** Get all focused files as an array */
  getAllFocusedFiles: () => FocusedFile[];
  /** Clear all focused files */
  clearAllFocusedFiles: () => void;
  /** Get the number of focused files */
  getFocusedFileCount: () => number;
}

/**
 * Default focus state
 */
const defaultState: FocusState = {
  focusedFiles: new Map(),
  totalSize: 0,
  maxSize: 8192, // 8KB per file
};

/**
 * Focus context
 */
export const FileFocusContext = createContext<FileFocusContextValue | undefined>(undefined);

/**
 * Props for FileFocusProvider
 */
export interface FileFocusProviderProps {
  children: ReactNode;
  initialState?: Partial<FocusState>;
}

/**
 * FileFocusProvider component
 * 
 * Provides focus state and actions to child components.
 */
export function FileFocusProvider({ children, initialState }: FileFocusProviderProps) {
  const [state, setState] = useState<FocusState>({
    ...defaultState,
    ...initialState,
    // Ensure focusedFiles is a Map even if initialState provides an object
    focusedFiles: initialState?.focusedFiles instanceof Map 
      ? initialState.focusedFiles 
      : new Map(),
  });

  const addFocusedFile = useCallback((file: FocusedFile) => {
    setState((prev) => {
      const newFocusedFiles = new Map(prev.focusedFiles);
      const existingFile = newFocusedFiles.get(file.path);
      
      // Calculate new total size
      let newTotalSize = prev.totalSize;
      if (existingFile) {
        // Replace existing file, adjust total size
        newTotalSize = newTotalSize - existingFile.content.length + file.content.length;
      } else {
        // Add new file
        newTotalSize = newTotalSize + file.content.length;
      }
      
      newFocusedFiles.set(file.path, file);
      
      return {
        ...prev,
        focusedFiles: newFocusedFiles,
        totalSize: newTotalSize,
      };
    });
  }, []);

  const removeFocusedFile = useCallback((path: string) => {
    setState((prev) => {
      const newFocusedFiles = new Map(prev.focusedFiles);
      const file = newFocusedFiles.get(path);
      
      if (!file) {
        return prev; // File not focused, no change
      }
      
      newFocusedFiles.delete(path);
      
      return {
        ...prev,
        focusedFiles: newFocusedFiles,
        totalSize: prev.totalSize - file.content.length,
      };
    });
  }, []);

  const isFocused = useCallback((path: string): boolean => {
    return state.focusedFiles.has(path);
  }, [state.focusedFiles]);

  const getFocusedFile = useCallback((path: string): FocusedFile | undefined => {
    return state.focusedFiles.get(path);
  }, [state.focusedFiles]);

  const getAllFocusedFiles = useCallback((): FocusedFile[] => {
    return Array.from(state.focusedFiles.values());
  }, [state.focusedFiles]);

  const clearAllFocusedFiles = useCallback(() => {
    setState({
      ...defaultState,
      focusedFiles: new Map(),
    });
  }, []);

  const getFocusedFileCount = useCallback((): number => {
    return state.focusedFiles.size;
  }, [state.focusedFiles]);

  const value: FileFocusContextValue = {
    state,
    addFocusedFile,
    removeFocusedFile,
    isFocused,
    getFocusedFile,
    getAllFocusedFiles,
    clearAllFocusedFiles,
    getFocusedFileCount,
  };

  return <FileFocusContext.Provider value={value}>{children}</FileFocusContext.Provider>;
}

/**
 * Hook to access file focus context
 * 
 * @throws Error if used outside FileFocusProvider
 */
export function useFileFocus(): FileFocusContextValue {
  const context = useContext(FileFocusContext);
  if (!context) {
    throw new Error('useFileFocus must be used within a FileFocusProvider');
  }
  return context;
}
