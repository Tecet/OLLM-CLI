/**
 * WorkspaceContext - React context for workspace state management
 *
 * Provides workspace configuration, active project selection, and navigation mode
 * (browse vs workspace) to all file explorer components.
 *
 * Requirements: 1.4 (Active project selection and LLM context)
 */

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

import { WorkspaceConfig, ProjectConfig } from './types.js';

/**
 * Workspace navigation mode
 * - browse: Full filesystem access
 * - workspace: Restricted to workspace projects
 */
export type WorkspaceMode = 'browse' | 'workspace';

/**
 * Workspace state interface
 */
export interface WorkspaceState {
  /** Current workspace configuration (null if no workspace loaded) */
  config: WorkspaceConfig | null;
  /** Name of the currently active project (null if none selected) */
  activeProject: string | null;
  /** Current navigation mode */
  mode: WorkspaceMode;
  /** Root path for file browsing */
  rootPath: string;
}

/**
 * Workspace context value with state and actions
 */
export interface WorkspaceContextValue {
  /** Current workspace state */
  state: WorkspaceState;
  /** Load a workspace configuration */
  loadWorkspace: (config: WorkspaceConfig) => void;
  /** Set the active project by name */
  setActiveProject: (projectName: string | null) => void;
  /** Get the active project configuration */
  getActiveProject: () => ProjectConfig | null;
  /** Set the navigation mode */
  setMode: (mode: WorkspaceMode) => void;
  /** Set the root path for browsing */
  setRootPath: (path: string) => void;
  /** Clear workspace and return to browse mode */
  clearWorkspace: () => void;
}

/**
 * Default workspace state
 */
const defaultState: WorkspaceState = {
  config: null,
  activeProject: null,
  mode: 'browse',
  rootPath: process.cwd(),
};

/**
 * Workspace context
 */
const WorkspaceContext = createContext<WorkspaceContextValue | undefined>(undefined);

/**
 * Props for WorkspaceProvider
 */
export interface WorkspaceProviderProps {
  children: ReactNode;
  initialState?: Partial<WorkspaceState>;
}

/**
 * WorkspaceProvider component
 *
 * Provides workspace state and actions to child components.
 */
export function WorkspaceProvider({ children, initialState }: WorkspaceProviderProps) {
  const [state, setState] = useState<WorkspaceState>({
    ...defaultState,
    ...initialState,
  });

  const loadWorkspace = useCallback((config: WorkspaceConfig) => {
    setState((prev) => ({
      ...prev,
      config,
      mode: 'workspace',
      // Set active project to first project with llmAccess if available
      activeProject:
        config.projects.find((p) => p.llmAccess)?.name || config.projects[0]?.name || null,
    }));
  }, []);

  const setActiveProject = useCallback((projectName: string | null) => {
    setState((prev) => ({
      ...prev,
      activeProject: projectName,
    }));
  }, []);

  const getActiveProject = useCallback((): ProjectConfig | null => {
    if (!state.config || !state.activeProject) {
      return null;
    }
    return state.config.projects.find((p) => p.name === state.activeProject) || null;
  }, [state.config, state.activeProject]);

  const setMode = useCallback((mode: WorkspaceMode) => {
    setState((prev) => ({
      ...prev,
      mode,
    }));
  }, []);

  const setRootPath = useCallback((path: string) => {
    setState((prev) => ({
      ...prev,
      rootPath: path,
    }));
  }, []);

  const clearWorkspace = useCallback(() => {
    setState({
      config: null,
      activeProject: null,
      mode: 'browse',
      rootPath: process.cwd(),
    });
  }, []);

  const value: WorkspaceContextValue = {
    state,
    loadWorkspace,
    setActiveProject,
    getActiveProject,
    setMode,
    setRootPath,
    clearWorkspace,
  };

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

/**
 * Hook to access workspace context
 *
 * @throws Error if used outside WorkspaceProvider
 */
export function useWorkspace(): WorkspaceContextValue {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider');
  }
  return context;
}
