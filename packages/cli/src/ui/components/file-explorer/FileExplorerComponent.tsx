/**
 * FileExplorerComponent - Main container for File Explorer UI
 * 
 * This is the top-level component that composes all file explorer sub-components
 * and manages their lifecycle. It handles:
 * - Context provider composition (Workspace, FileTree)
 * - Service instantiation and initialization
 * - Workspace loading on mount
 * - State persistence restoration
 * - Component lifecycle management
 * 
 * Requirements: 1.1 (Workspace loading), 12.2 (State restoration)
 */

import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { Box, Text } from 'ink';

import { EditorIntegration } from './EditorIntegration.js';
import { ExplorerPersistence } from './ExplorerPersistence.js';
import { useFileFocus } from './FileFocusContext.js';
import { FileOperations } from './FileOperations.js';
import { FileTreeProvider, useFileTree } from './FileTreeContext.js';
import { FileTreeService } from './FileTreeService.js';
import { FileTreeView } from './FileTreeView.js';
import { FocusSystem } from './FocusSystem.js';
import { FollowModeService } from './FollowModeService.js';
import { GitStatusService } from './GitStatusService.js';
import { PathSanitizer } from './PathSanitizer.js';
import { WorkspaceProvider } from './WorkspaceContext.js';
import { WorkspaceManager } from './WorkspaceManager.js';
import { createLogger } from '../../../../../core/src/utils/logger.js';

import type { WorkspaceConfig, FileNode } from './types.js';
import type { MessageBus } from '@ollm/ollm-cli-core/hooks/messageBus.js';
import type { PolicyEngine } from '@ollm/ollm-cli-core/policy/policyEngine.js';
import type { ToolRegistry } from '@ollm/ollm-cli-core/tools/tool-registry.js';

const logger = createLogger('FileExplorerComponent');

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
  /** Visible window size for virtual scrolling */
  windowSize?: number;
  
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
 * 1. **Context Providers**: Wraps the component tree with WorkspaceProvider
 *    and FileTreeProvider to provide shared state.
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
  windowSize,
  toolRegistry,
  policyEngine,
  messageBus,
  onWorkspaceLoaded,
  onStateRestored,
  onError,
}: FileExplorerComponentProps) {
  const stableExcludePatterns = useMemo(() => excludePatterns, [excludePatterns]);
  const fileFocusContext = useFileFocus();

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
    let restoredExpandedPaths = new Set<string>();
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
          logger.warn('Failed to load workspace:', error);
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
            restoredExpandedPaths = new Set(persistedState.expandedDirectories);
            setTreeState(prev => ({
              ...prev,
              expandedPaths: new Set(persistedState.expandedDirectories),
            }));
          }

          // Restore focused files
          if (persistedState.focusedFiles.length > 0) {
            for (const filePath of persistedState.focusedFiles) {
              try {
                const focusedFile = await services.focusSystem.focusFile(filePath);
                fileFocusContext.addFocusedFile(focusedFile);
              } catch (error) {
                // Skip files that can't be focused (e.g., deleted files)
                logger.warn(`Failed to restore focused file: ${filePath}`, error);
              }
            }
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
          logger.warn('Failed to restore state:', error);
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
        excludePatterns: stableExcludePatterns,
      });
      
      // If we've loaded a workspace, auto-expand directories so the
      // tree shows the full workspace structure by default. This will
      // recursively expand directories using the FileTreeService's
      // lazy-loading expansion. For very large workspaces this can be
      // I/O intensive; consider limiting depth if needed.
      if (loadedWorkspace) {
        const expandAll = async (node: any) => {
          if (!node || node.type !== 'directory') return;
          try {
            await services.fileTreeService.expandDirectory(node, stableExcludePatterns);
          } catch (_err) {
            // Ignore expansion errors for individual nodes
          }

          const children = node.children || [];
          for (const child of children) {
            if (child.type === 'directory') {
              await expandAll(child);
            }
          }
        };

        // Expand entire tree starting at root
        try {
          await expandAll(rootNode);
        } catch (_err) {
          // If full expansion fails, we fall back to showing the root only
        }

        // Collect all directory paths that are now expanded
        const allDirs: string[] = [];
        const collectDirs = (n: any) => {
          if (!n) return;
          if (n.type === 'directory') {
            allDirs.push(n.path);
            const ch = n.children || [];
            for (const c of ch) collectDirs(c);
          }
        };
        collectDirs(rootNode);

        setTreeState(prev => ({
          ...prev,
          root: rootNode,
          expandedPaths: new Set(allDirs),
        }));
      } else {
        // Always expand the root directory so the tree is visible
        try {
          await services.fileTreeService.expandDirectory(rootNode, stableExcludePatterns);
        } catch (_err) {
          // Ignore expansion errors for initial root
        }

        const nextExpanded = new Set(restoredExpandedPaths);
        nextExpanded.add(rootNode.path);

        setTreeState(prev => ({
          ...prev,
          root: rootNode,
          expandedPaths: nextExpanded,
        }));
      }
      
      // Note: The FileTreeContext will be updated via initialState prop
      // when the provider mounts with the updated treeState
      
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
    fileFocusContext,
    stableExcludePatterns,
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
        const currentFocusedFiles = Array.from(fileFocusContext.state.focusedFiles.keys());

        // Save state
        services.explorerPersistence.saveState({
          expandedDirectories: currentExpandedPaths,
          focusedFiles: currentFocusedFiles,
          quickOpenHistory: [], // TODO: Get from QuickOpen component
          lastActiveProject: workspaceState.activeProject,
        });
      } catch (error) {
        logger.warn('Failed to save state on unmount:', error);
      }
    };
  }, [services, treeState, workspaceState, fileFocusContext.state.focusedFiles]);

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
      <FileTreeProvider
        initialState={{ root: treeState.root, expandedPaths: treeState.expandedPaths }}
        windowSize={windowSize}
      >
        <FileExplorerContent
          services={services}
          treeState={treeState}
          rootPath={rootPath}
          excludePatterns={stableExcludePatterns}
          hasFocus={hasFocus}
          toolRegistry={toolRegistry}
        />
      </FileTreeProvider>
    </WorkspaceProvider>
  );
}

/**
 * Inner component that has access to FileTreeContext
 */
function FileExplorerContent({
  services,
  treeState,
  rootPath,
  excludePatterns,
  hasFocus,
  toolRegistry,
}: {
  services: any;
  treeState: { root: FileNode | null; expandedPaths: Set<string> };
  rootPath: string;
  excludePatterns: string[];
  hasFocus: boolean;
  toolRegistry?: any;
}) {
  const { setRoot } = useFileTree();
  const hasInitializedRef = useRef(false);
  const lastRootPathRef = useRef<string | null>(null);
  
  // Initialize context with tree root once per root path
  useEffect(() => {
    const currentRootPath = treeState.root?.path || null;
    
    // Only initialize if:
    // 1. We have a root
    // 2. Either we haven't initialized yet, OR the root path changed
    if (treeState.root && (!hasInitializedRef.current || currentRootPath !== lastRootPathRef.current)) {
      hasInitializedRef.current = true;
      lastRootPathRef.current = currentRootPath;
      setRoot(treeState.root);
    }
  }, [treeState.root, setRoot]);
  
  return (
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
  );
}
