/**
 * FileExplorerComponent - Main container for File Explorer UI
 * 
 * This is the top-level component that composes all file explorer sub-components
 * and manages their lifecycle. It handles:
 * - Context provider composition (Workspace, FileFocus, FileTree)
 * - Service instantiation and initialization
 * - Workspace loading on mount
 * - State persistence restoration
 * - Component lifecycle management
 * 
 * Requirements: 1.1 (Workspace loading), 12.2 (State restoration)
 */

import React, { useEffect, useState, useCallback } from 'react';
import { Box, Text } from 'ink';

import { EditorIntegration } from './EditorIntegration.js';
import { ExplorerPersistence } from './ExplorerPersistence.js';
import { FileFocusProvider } from './FileFocusContext.js';
import { FileOperations } from './FileOperations.js';
import { FileTreeProvider } from './FileTreeContext.js';
import { FileTreeService } from './FileTreeService.js';
import { FileTreeView } from './FileTreeView.js';
import { FocusSystem } from './FocusSystem.js';
import { FollowModeService } from './FollowModeService.js';
import { GitStatusService } from './GitStatusService.js';
import { PathSanitizer } from './PathSanitizer.js';
import { WorkspaceProvider } from './WorkspaceContext.js';
import { WorkspaceManager } from './WorkspaceManager.js';

import type { WorkspaceConfig, FocusedFile, FileNode } from './types.js';
import type { MessageBus } from '@ollm/ollm-cli-core/hooks/messageBus.js';
import type { PolicyEngine } from '@ollm/ollm-cli-core/policy/policyEngine.js';
import type { ToolRegistry } from '@ollm/ollm-cli-core/tools/tool-registry.js';

/**
 * Props for FileExplorerComponent
 */
export interface FileExplorerComponentProps {
  /** Root directory to browse (defaults to current working directory) */
  rootPath?: string;
  /** Path to workspace file (.ollm-workspace) to load on mount */
  workspacePath?: string;
  /** Whether to automatically load workspace if found */
  autoLoadWorkspace?: boolean;
  /** Whether to restore persisted state on mount */
  restoreState?: boolean;
  /** Exclude patterns for file tree filtering */
  excludePatterns?: string[];
  /** Whether the component has focus for keyboard input */
  hasFocus?: boolean;
  
  /** Tool system integration (optional) */
  toolRegistry?: ToolRegistry;
  policyEngine?: PolicyEngine;
  messageBus?: MessageBus;
  
  /** Callback when workspace is loaded */
  onWorkspaceLoaded?: (config: WorkspaceConfig) => void;
  /** Callback when state is restored */
  onStateRestored?: () => void;
  /** Callback when an error occurs */
  onError?: (error: Error) => void;
}

/**
 * Initialization state for the component
 */
interface InitializationState {
  /** Whether initialization is in progress */
  isInitializing: boolean;
  /** Whether initialization is complete */
  isInitialized: boolean;
  /** Initialization error if any */
  error: Error | null;
  /** Status message during initialization */
  statusMessage: string;
}

/**
 * FileExplorerComponent - Main container component
 * 
 * This component serves as the entry point for the File Explorer UI.
 * It composes all sub-components and manages their lifecycle:
 * 
 * 1. **Context Providers**: Wraps the component tree with WorkspaceProvider,
 *    FileFocusProvider, and FileTreeProvider to provide shared state.
 * 
 * 2. **Service Instantiation**: Creates instances of all required services
 *    (WorkspaceManager, FileTreeService, FocusSystem, etc.) and passes them
 *    to child components.
 * 
 * 3. **Initialization**: On mount, loads workspace configuration (if provided)
 *    and restores persisted state from .ollm/explorer-state.json.
 * 
 * 4. **Layout**: Renders the file tree view and focused files panel in a
 *    side-by-side layout.
 * 
 * Usage:
 * ```tsx
 * <FileExplorerComponent
 *   rootPath="/path/to/project"
 *   workspacePath="/path/to/.ollm-workspace"
 *   autoLoadWorkspace={true}
 *   restoreState={true}
 * />
 * ```
 */
export function FileExplorerComponent({
  rootPath = process.cwd(),
  workspacePath,
  autoLoadWorkspace = true,
  restoreState = true,
  excludePatterns = [],
  hasFocus = true,
  toolRegistry,
  policyEngine,
  messageBus,
  onWorkspaceLoaded,
  onStateRestored,
  onError,
}: FileExplorerComponentProps) {
  // Initialization state
  const [initState, setInitState] = useState<InitializationState>({
    isInitializing: true,
    isInitialized: false,
    error: null,
    statusMessage: 'Initializing File Explorer...',
  });

  // Service instances (created once on mount)
  const [services] = useState(() => {
    const pathSanitizer = new PathSanitizer();
    const gitStatusService = new GitStatusService();
    const fileTreeService = new FileTreeService();
    const focusSystem = new FocusSystem(messageBus);  // Pass messageBus
    const editorIntegration = new EditorIntegration();
    const fileOperations = new FileOperations(
      rootPath,
      toolRegistry,   // Pass toolRegistry
      policyEngine,   // Pass policyEngine
      messageBus      // Pass messageBus
    );
    const followModeService = new FollowModeService();
    const workspaceManager = new WorkspaceManager();
    const explorerPersistence = new ExplorerPersistence(rootPath);

    return {
      pathSanitizer,
      gitStatusService,
      fileTreeService,
      focusSystem,
      editorIntegration,
      fileOperations,
      followModeService,
      workspaceManager,
      explorerPersistence,
    };
  });

  // Initial workspace state
  const [workspaceState, setWorkspaceState] = useState<{
    config: WorkspaceConfig | null;
    activeProject: string | null;
    mode: 'browse' | 'workspace';
    rootPath: string;
  }>({
    config: null,
    activeProject: null,
    mode: 'browse',
    rootPath,
  });

  // Initial focus state
  const [focusState, setFocusState] = useState<{
    focusedFiles: Map<string, FocusedFile>;
  }>({
    focusedFiles: new Map(),
  });

  // Initial tree state
  const [treeState, setTreeState] = useState<{
    root: FileNode | null;
    expandedPaths: Set<string>;
  }>({
    root: null,
    expandedPaths: new Set(),
  });

  /**
   * Initialize the component
   * 
   * Performs the following initialization steps:
   * 1. Load workspace configuration if provided
   * 2. Restore persisted state if enabled
   * 3. Build initial file tree
   * 4. Restore focused files
   */
  const initialize = useCallback(async () => {
    try {
      setInitState({
        isInitializing: true,
        isInitialized: false,
        error: null,
        statusMessage: 'Loading workspace...',
      });

      // Step 1: Load workspace if provided
      let loadedWorkspace: WorkspaceConfig | null = null;
      if (workspacePath && autoLoadWorkspace) {
        try {
          loadedWorkspace = services.workspaceManager.loadWorkspace(workspacePath);
          
          // Set active project to first project with llmAccess
          const activeProject = loadedWorkspace.projects.find(p => p.llmAccess)?.name 
            || loadedWorkspace.projects[0]?.name 
            || null;

          setWorkspaceState({
            config: loadedWorkspace,
            activeProject,
            mode: 'workspace',
            rootPath,
          });

          if (onWorkspaceLoaded) {
            onWorkspaceLoaded(loadedWorkspace);
          }
        } catch (error) {
          // Workspace loading failed, continue in browse mode
          console.warn('Failed to load workspace:', error);
        }
      }

      // Step 2: Restore persisted state if enabled
      if (restoreState) {
        setInitState(prev => ({
          ...prev,
          statusMessage: 'Restoring previous state...',
        }));

        try {
          const persistedState = services.explorerPersistence.loadState();

          // Restore expanded directories
          if (persistedState.expandedDirectories.length > 0) {
            setTreeState(prev => ({
              ...prev,
              expandedPaths: new Set(persistedState.expandedDirectories),
            }));
          }

          // Restore focused files
          if (persistedState.focusedFiles.length > 0) {
            const focusedFilesMap = new Map<string, FocusedFile>();
            
            for (const filePath of persistedState.focusedFiles) {
              try {
                const focusedFile = await services.focusSystem.focusFile(filePath);
                focusedFilesMap.set(filePath, focusedFile);
              } catch (error) {
                // Skip files that can't be focused (e.g., deleted files)
                console.warn(`Failed to restore focused file: ${filePath}`, error);
              }
            }

            setFocusState({
              focusedFiles: focusedFilesMap,
            });
          }

          // Restore active project if in workspace mode
          if (loadedWorkspace && persistedState.lastActiveProject) {
            const projectExists = loadedWorkspace.projects.some(
              p => p.name === persistedState.lastActiveProject
            );
            
            if (projectExists) {
              setWorkspaceState(prev => ({
                ...prev,
                activeProject: persistedState.lastActiveProject,
              }));
            }
          }

          if (onStateRestored) {
            onStateRestored();
          }
        } catch (error) {
          // State restoration failed, continue with default state
          console.warn('Failed to restore state:', error);
        }
      }

      // Step 3: Build initial file tree
      setInitState(prev => ({
        ...prev,
        statusMessage: 'Building file tree...',
      }));

      // Build the file tree from rootPath
      const rootNode = await services.fileTreeService.buildTree({
        rootPath,
        excludePatterns,
      });
      
      // Set the root node in tree state
      setTreeState(prev => ({
        ...prev,
        root: rootNode,
      }));
      
      // Initialization complete
      setInitState({
        isInitializing: false,
        isInitialized: true,
        error: null,
        statusMessage: '',
      });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      
      setInitState({
        isInitializing: false,
        isInitialized: false,
        error: err,
        statusMessage: `Initialization failed: ${err.message}`,
      });

      if (onError) {
        onError(err);
      }
    }
  }, [
    workspacePath,
    autoLoadWorkspace,
    restoreState,
    rootPath,
    services,
    onWorkspaceLoaded,
    onStateRestored,
    onError,
    excludePatterns,
  ]);

  // Initialize on mount
  useEffect(() => {
    initialize();
  }, [initialize]);

  // Save state on unmount
  useEffect(() => {
    return () => {
      try {
        // Get current state from contexts
        const currentExpandedPaths = Array.from(treeState.expandedPaths);
        const currentFocusedFiles = Array.from(focusState.focusedFiles.keys());

        // Save state
        services.explorerPersistence.saveState({
          expandedDirectories: currentExpandedPaths,
          focusedFiles: currentFocusedFiles,
          quickOpenHistory: [], // TODO: Get from QuickOpen component
          lastActiveProject: workspaceState.activeProject,
        });
      } catch (error) {
        console.warn('Failed to save state on unmount:', error);
      }
    };
  }, [services, treeState, focusState, workspaceState]);

  // Show loading state during initialization
  if (initState.isInitializing) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text color="cyan">File Explorer</Text>
        <Text dimColor>{initState.statusMessage}</Text>
      </Box>
    );
  }

  // Show error state if initialization failed
  if (initState.error) {
    return (
      <Box flexDirection="column" padding={1} borderStyle="round" borderColor="red">
        <Text color="red" bold>
          Initialization Error
        </Text>
        <Text>{initState.error.message}</Text>
        <Box marginTop={1}>
          <Text dimColor>Press Ctrl+C to exit</Text>
        </Box>
      </Box>
    );
  }

  // Render the file explorer with all contexts
  return (
    <WorkspaceProvider initialState={workspaceState}>
      <FileFocusProvider initialState={focusState}>
        <FileTreeProvider initialState={treeState}>
          <Box flexDirection="column" height="100%">
            {/* Main content area with file tree */}
            <Box flexDirection="row" flexGrow={1}>
              {/* File tree view (full width) */}
              <Box flexDirection="column" flexGrow={1}>
                <FileTreeView
                  fileTreeService={services.fileTreeService}
                  focusSystem={services.focusSystem}
                  editorIntegration={services.editorIntegration}
                  fileOperations={services.fileOperations}
                  followModeService={services.followModeService}
                  toolRegistry={toolRegistry}
                  rootPath={rootPath}
                  excludePatterns={excludePatterns}
                  hasFocus={hasFocus}
                />
              </Box>
            </Box>
          </Box>
        </FileTreeProvider>
      </FileFocusProvider>
    </WorkspaceProvider>
  );
}
