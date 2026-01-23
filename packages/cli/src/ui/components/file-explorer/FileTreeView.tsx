/**
 * FileTreeView - Terminal UI component for file tree rendering
 * 
 * Renders the file tree with virtual scrolling, Nerd Font icons, git status
 * colors, and focus indicators. Supports keyboard navigation and file focusing.
 * 
 * Requirements: 2.1, 2.6, 2.7, 3.1, 3.4
 */

import { readFile } from 'fs/promises';

import React, { useEffect, useRef, useCallback, useState } from 'react';
import { Box, Text, useInput, Key } from 'ink';

import { ConfirmationDialog } from './ConfirmationDialog.js';
import { EditorIntegration } from './EditorIntegration.js';
import { useFileFocus } from './FileFocusContext.js';
import { FileOperations } from './FileOperations.js';
import { FileSearchDialog, type SearchResult } from './FileSearchDialog.js';
import { useFileTree } from './FileTreeContext.js';
import { FileTreeService } from './FileTreeService.js';
import { FocusSystem } from './FocusSystem.js';
import { FollowModeService } from './FollowModeService.js';
import { HelpPanel } from './HelpPanel.js';
import { LoadingIndicator } from './LoadingIndicator.js';
import { QuickActionsMenu, type QuickAction } from './QuickActionsMenu.js';
import { QuickOpenDialog } from './QuickOpenDialog.js';
import { SyntaxViewer } from './SyntaxViewer.js';
import { useFocusManager } from '../../../features/context/FocusContext.js';
import { useKeybinds } from '../../../features/context/KeybindsContext.js';
import { isKey } from '../../utils/keyUtils.js';

import type { FileNode, GitStatus } from './types.js';

/**
 * Props for FileTreeView component
 */
export interface FileTreeViewProps {
  /** File tree service instance */
  fileTreeService: FileTreeService;
  /** Focus system instance for managing focused files */
  focusSystem: FocusSystem;
  /** Editor integration instance for opening files in external editor */
  editorIntegration: EditorIntegration;
  /** File operations instance for CRUD operations */
  fileOperations: FileOperations;
  /** Follow mode service instance for detecting LLM-referenced files */
  followModeService?: FollowModeService;
  /** Tool registry for search functionality */
  toolRegistry?: any; // Using any to avoid circular dependency
  /** Root path for search operations */
  rootPath?: string;
  /** Exclude patterns for filtering */
  excludePatterns?: string[];
  /** Whether the component has focus */
  hasFocus?: boolean;
}

/**
 * Nerd Font icons for file types
 */
const ICONS = {
  // Directory icons
  directoryExpanded: '📂',
  directoryCollapsed: '📁',
  
  // File type icons
  file: '📄',
  typescript: '📘',
  javascript: '📜',
  json: '⚙️',
  markdown: '📝',
  yaml: '🛠️',
  image: '🖼️',
  text: '📄',
  code: '💻',
  
  // Status icons
  focusIndicator: '📌',     // Pin emoji for focused files
} as const;

/**
 * Get icon for a file node based on its type and name
 */
function getNodeIcon(node: FileNode): string {
  if (node.type === 'directory') {
    return node.expanded ? ICONS.directoryExpanded : ICONS.directoryCollapsed;
  }
  
  // File type detection based on extension
  const ext = node.name.split('.').pop()?.toLowerCase();
  
  switch (ext) {
    case 'ts':
    case 'tsx':
      return ICONS.typescript;
    case 'js':
    case 'jsx':
      return ICONS.javascript;
    case 'json':
      return ICONS.json;
    case 'md':
    case 'markdown':
      return ICONS.markdown;
    case 'yml':
    case 'yaml':
      return ICONS.yaml;
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'gif':
    case 'webp':
    case 'svg':
      return ICONS.image;
    case 'txt':
    case 'log':
      return ICONS.text;
    case 'py':
    case 'java':
    case 'cpp':
    case 'c':
    case 'go':
    case 'rs':
    case 'rb':
    case 'php':
      return ICONS.code;
    default:
      return ICONS.file;
  }
}

/**
 * Get color for git status
 */
function getGitStatusColor(status?: GitStatus): string | undefined {
  switch (status) {
    case 'untracked':
      return 'green';
    case 'modified':
      return 'yellow';
    case 'ignored':
      return 'gray';
    case 'clean':
    default:
      return undefined; // Use default color
  }
}

/**
 * Calculate indentation level for a node
 */
function calculateIndentation(node: FileNode, rootPath: string): number {
  if (!rootPath || !node.path) return 0;
  const relativePath = node.path.replace(rootPath, '');
  // Split by forward or backward slash to handle both Unix and Windows paths
  const depth = relativePath.split(/[/\\]/).filter(p => p.length > 0).length;
  return Math.max(0, depth - 1); // Root is at depth 0
}

/**
 * FileTreeView component
 * 
 * Renders the file tree with virtual scrolling, showing only the visible
 * window of nodes. Displays icons, git status colors, and focus indicators.
 * Supports keyboard navigation with debouncing and file focusing.
 */
export function FileTreeView({ fileTreeService, focusSystem, editorIntegration, fileOperations, followModeService, toolRegistry, rootPath = process.cwd(), excludePatterns = [], hasFocus = true }: FileTreeViewProps) {
  const { 
    state: treeState, 
    setVisibleWindow, 
    moveCursorUp, 
    moveCursorDown,
    expandDirectory,
    collapseDirectory,
    getSelectedNode,
    toggleFollowMode,
    expandToPath,
  } = useFileTree();
  const { isFocused, addFocusedFile, removeFocusedFile } = useFileFocus();
  const { activeKeybinds } = useKeybinds();
  const focusManager = useFocusManager();

  // Status message state for user feedback
  const [statusMessage, setStatusMessage] = useState<string>('');
  const statusTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Help panel state
  const [helpPanelOpen, setHelpPanelOpen] = useState(false);

  // Loading state for long operations
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState<string>('Loading...');

  // Viewer modal state
  const [viewerState, setViewerState] = useState<{ 
    isOpen: boolean;
    filePath: string;
    content: string;
  } | null>(null);

  // Quick actions menu state
  const [menuOpen, setMenuOpen] = useState(false);

  // Quick Open dialog state
  const [quickOpenState, setQuickOpenState] = useState(false);
  const [quickOpenHistory, setQuickOpenHistory] = useState<string[]>([]);

  // Search dialog state
  const [searchDialogOpen, setSearchDialogOpen] = useState(false);

  // Confirmation dialog state
  const [confirmationState, setConfirmationState] = useState<{ 
    isOpen: boolean;
    message: string;
    onConfirm: () => void;
  } | null>(null);

  // Debouncing state
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const DEBOUNCE_DELAY = 50; // 50ms debounce delay

  /**
   * Show a temporary status message
   */
  const showStatus = useCallback((message: string) => {
    setStatusMessage(message);
    
    // Clear existing timer
    if (statusTimerRef.current) {
      clearTimeout(statusTimerRef.current);
    }
    
    // Set new timer to clear message after 2 seconds
    statusTimerRef.current = setTimeout(() => {
      setStatusMessage('');
      statusTimerRef.current = null;
    }, 2000);
  }, []);

  /**
   * Handle Quick Open file selection
   */
  const handleQuickOpenSelect = useCallback(async (node: FileNode) => {
    if (!treeState.root) {
      return;
    }
    showStatus(`Selected: ${node.name}`);
    setQuickOpenState(false);
  }, [treeState.root, showStatus]);

  /**
   * Handle search result selection
   */
  const handleSearchSelect = useCallback(async (result: SearchResult) => {
    try {
      // Expand to the file path
      await expandToPath(result.path);
      
      // Open the file in viewer
      const content = await readFile(result.path, 'utf-8');
      setViewerState({
        isOpen: true,
        filePath: result.path,
        content,
      });
      
      showStatus(`Opened: ${result.path}:${result.line}`);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      showStatus(`Error opening file: ${errorMsg}`);
    }
  }, [expandToPath, showStatus]);

  /**
   * Update Quick Open history
   */
  const updateQuickOpenHistory = useCallback((filePath: string) => {
    setQuickOpenHistory((prev) => {
      const filtered = prev.filter(p => p !== filePath);
      const updated = [filePath, ...filtered];
      return updated.slice(0, 20);
    });
  }, []);

  /**
   * Toggle focus on the selected file
   */
  const toggleFocus = useCallback(async () => {
    const selectedNode = getSelectedNode();
    
    if (!selectedNode) {
      showStatus('No file selected');
      return;
    }
    
    if (selectedNode.type === 'directory') {
      showStatus('Cannot focus directories');
      return;
    }
    
    const filePath = selectedNode.path;
    
    try {
      if (isFocused(filePath)) {
        focusSystem.unfocusFile(filePath);
        removeFocusedFile(filePath);
        showStatus(`Unfocused: ${selectedNode.name}`);
      } else {
        const focusedFile = await focusSystem.focusFile(filePath);
        addFocusedFile(focusedFile);
        
        const truncatedMsg = focusedFile.truncated ? ' (truncated)' : '';
        showStatus(`Focused: ${selectedNode.name}${truncatedMsg}`);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      showStatus(`Error: ${errorMsg}`);
    }
  }, [getSelectedNode, isFocused, focusSystem, addFocusedFile, removeFocusedFile, showStatus]);

  /**
   * Open the selected file in the syntax viewer
   */
  const openViewer = useCallback(async () => {
    const selectedNode = getSelectedNode();
    
    if (!selectedNode) {
      showStatus('No file selected');
      return;
    }
    
    if (selectedNode.type === 'directory') {
      showStatus('Cannot view directories');
      return;
    }
    
    const filePath = selectedNode.path;
    
    try {
      setIsLoading(true);
      setLoadingMessage('Loading file...');
      
      const content = await readFile(filePath, 'utf-8');
      
      setViewerState({
        isOpen: true,
        filePath,
        content,
      });
      
      // Register modal with focus manager
      focusManager.openModal('syntax-viewer');
      
      setStatusMessage(''); 
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      showStatus(`Error reading file: ${errorMsg}`);
    } finally {
      setIsLoading(false);
    }
  }, [getSelectedNode, showStatus, setIsLoading, focusManager]);

  /**
   * Close the syntax viewer modal
   */
  const closeViewer = useCallback(() => {
    setViewerState(null);
    // Return focus to parent (file-tree)
    focusManager.closeModal();
  }, [focusManager]);

  /**
   * Open file in external editor
   */
  const openInEditor = useCallback(async () => {
    const selectedNode = getSelectedNode();
    
    if (!selectedNode) {
      showStatus('No file selected');
      return;
    }
    
    if (selectedNode.type === 'directory') {
      showStatus('Cannot edit directories');
      return;
    }
    
    const filePath = selectedNode.path;
    const editorCommand = editorIntegration.getEditorCommand();
    
    try {
      setIsLoading(true);
      setLoadingMessage(`Opening in ${editorCommand}...`);
      
      const result = await editorIntegration.openInEditor(filePath);
      
      if (result.success) {
        showStatus(`Editor closed successfully`);
      } else {
        showStatus(`Editor exited with code ${result.exitCode}: ${result.error || 'Unknown error'}`);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      showStatus(`Error opening editor: ${errorMsg}`);
    } finally {
      setIsLoading(false);
    }
  }, [getSelectedNode, editorIntegration, showStatus, setIsLoading]);

  /**
   * Handle quick actions menu action selection
   */
  const handleQuickAction = useCallback(async (action: QuickAction) => {
    switch (action) {
      case 'open': {
        await openViewer();
        break;
      }
      case 'focus': {
        await toggleFocus();
        break;
      }
      case 'edit': {
        await openInEditor();
        break;
      }
      case 'rename': {
        showStatus('Rename functionality not yet implemented');
        break;
      }
      case 'delete': {
        const selectedNode = getSelectedNode();
        if (!selectedNode) {
          showStatus('No file or folder selected');
          return;
        }
        
        const isDirectory = selectedNode.type === 'directory';
        const message = isDirectory
          ? `Are you sure you want to delete the folder "${selectedNode.name}" and all its contents?`
          : `Are you sure you want to delete "${selectedNode.name}"?`;
        
        setConfirmationState({
          isOpen: true,
          message,
          onConfirm: async () => {
            try {
              setIsLoading(true);
              setLoadingMessage(`Deleting ${selectedNode.name}...`);
              
              const alwaysConfirm = async () => true;
              
              let result;
              if (isDirectory) {
                result = await fileOperations.deleteFolder(
                  selectedNode.path,
                  alwaysConfirm,
                  true // recursive
                );
              } else {
                result = await fileOperations.deleteFile(
                  selectedNode.path,
                  alwaysConfirm
                );
              }
              
              if (result.success) {
                showStatus(`Successfully deleted ${selectedNode.name}`);
              } else {
                showStatus(`Failed to delete: ${result.error}`);
              }
            } catch (error) {
              const errorMsg = error instanceof Error ? error.message : 'Unknown error';
              showStatus(`Error deleting: ${errorMsg}`);
            } finally {
              setIsLoading(false);
              setConfirmationState(null);
            }
          },
        });
        break;
      }
      case 'copyPath': {
        const node = getSelectedNode();
        if (node) {
          try {
            const absolutePath = await fileOperations.copyPath(node.path);
            showStatus(`Copied to clipboard: ${absolutePath}`);
          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            showStatus(`Error copying path: ${errorMsg}`);
          }
        }
        break;
      }
    }
  }, [openViewer, toggleFocus, openInEditor, getSelectedNode, fileOperations, showStatus, setIsLoading]);

  /**
   * Debounced action executor
   */
  const debouncedAction = useCallback((action: () => void) => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      action();
      debounceTimerRef.current = null;
    }, DEBOUNCE_DELAY);
  }, []);

  /**
   * Handle LLM message for Follow Mode
   */
  const _handleLLMMessage = useCallback(async (message: string) => {
    if (!treeState.followModeEnabled || !followModeService || !treeState.root) {
      return;
    }

    const rootPath = treeState.root.path;
    const detectedPaths = followModeService.extractFromLLMResponse(message, {
      rootPath,
      filterByRoot: true,
    });

    for (const filePath of detectedPaths) {
      if (followModeService.shouldExpandToPath(filePath, rootPath)) {
        await expandToPath(filePath);
        showStatus(`Follow Mode: Expanded to ${filePath}`);
      }
    }
  }, [treeState.followModeEnabled, treeState.root, followModeService, expandToPath, showStatus]);

  /**
   * Handle keyboard input
   */
  /**
   * Handle keyboard input
   */
  const handleInput = useCallback((input: string, key: Key) => {
    if (helpPanelOpen) {
      if (isKey(input, key, activeKeybinds.chat.cancel) || input === '?') {
        setHelpPanelOpen(false);
        focusManager.closeModal();
      }
      return;
    }

    if (viewerState?.isOpen) {
      if (isKey(input, key, activeKeybinds.chat.cancel)) {
        closeViewer();  // Will call focusManager.closeModal()
      }
      return;
    }

    if (quickOpenState) {
      // Quick open dialog handles its own input
      return;
    }

    if (searchDialogOpen) {
      // Search dialog handles its own input
      return;
    }

    if (menuOpen) {
      if (isKey(input, key, activeKeybinds.chat.cancel)) {
        setMenuOpen(false);
        focusManager.closeModal();
      }
      return;
    }

    if (input === '?') {
      setHelpPanelOpen(true);
      focusManager.openModal('help-panel');
      return;
    }

    if (isKey(input, key, activeKeybinds.fileExplorer.quickOpen)) {
      setQuickOpenState(true);
      focusManager.openModal('quick-open-dialog');
      return;
    }

    // Ctrl+F to open search dialog
    if (input === 'f' && key.ctrl) {
      setSearchDialogOpen(true);
      focusManager.openModal('search-dialog');
      return;
    }

    // Arrow key navigation (direct support)
    if (key.downArrow) {
      debouncedAction(() => moveCursorDown());
      return;
    } else if (key.upArrow) {
      debouncedAction(() => moveCursorUp());
      return;
    } else if (key.leftArrow) {
      const selectedNode = getSelectedNode();
      if (selectedNode && selectedNode.type === 'directory' && selectedNode.expanded) {
        debouncedAction(() => {
          collapseDirectory(selectedNode.path);
          fileTreeService.collapseDirectory(selectedNode);
        });
      }
      return;
    } else if (key.rightArrow) {
      const selectedNode = getSelectedNode();
      if (selectedNode && selectedNode.type === 'directory' && !selectedNode.expanded) {
        (async () => {
          try {
            await fileTreeService.expandDirectory(selectedNode, excludePatterns);
            expandDirectory(selectedNode.path);
          } catch (_err) {
            showStatus('Error expanding directory');
          }
        })();
      }
      return;
    }

    // Keybind-based navigation (fallback)
    if (isKey(input, key, activeKeybinds.fileExplorer.moveDown)) {
      debouncedAction(() => moveCursorDown());
    } else if (isKey(input, key, activeKeybinds.fileExplorer.moveUp)) {
      debouncedAction(() => moveCursorUp());
    } else if (isKey(input, key, activeKeybinds.fileExplorer.collapse)) {
      const selectedNode = getSelectedNode();
      if (selectedNode && selectedNode.type === 'directory' && selectedNode.expanded) {
        debouncedAction(() => {
          collapseDirectory(selectedNode.path);
          fileTreeService.collapseDirectory(selectedNode);
        });
      }
    } else if (isKey(input, key, activeKeybinds.fileExplorer.expand)) {
      const selectedNode = getSelectedNode();
      if (selectedNode && selectedNode.type === 'directory' && !selectedNode.expanded) {
        (async () => {
          try {
            await fileTreeService.expandDirectory(selectedNode, excludePatterns);
            expandDirectory(selectedNode.path);
          } catch (_err) {
            showStatus('Error expanding directory');
          }
        })();
      }
    } else if (isKey(input, key, activeKeybinds.fileExplorer.select)) {
      const selectedNode = getSelectedNode();
      if (!selectedNode) return;
      
      if (selectedNode.type === 'directory') {
        if (selectedNode.expanded) {
          collapseDirectory(selectedNode.path);
          fileTreeService.collapseDirectory(selectedNode);
        } else {
          (async () => {
            try {
              await fileTreeService.expandDirectory(selectedNode, excludePatterns);
              expandDirectory(selectedNode.path);
            } catch (_err) {
              showStatus('Error expanding directory');
            }
          })();
        }
      } else {
        openViewer();
      }
    } else if (isKey(input, key, activeKeybinds.fileExplorer.focus)) {
      toggleFocus();
    } else if (isKey(input, key, activeKeybinds.fileExplorer.open)) {
      openViewer();
    } else if (isKey(input, key, activeKeybinds.fileExplorer.edit)) {
      openInEditor();
    } else if (isKey(input, key, activeKeybinds.fileExplorer.actions)) {
      setMenuOpen(true);
      focusManager.openModal('quick-actions-menu');
    } else if (isKey(input, key, activeKeybinds.fileExplorer.toggleFollow)) {
      toggleFollowMode();
      const newState = !treeState.followModeEnabled;
      showStatus(`Follow Mode: ${newState ? 'Enabled' : 'Disabled'}`);
    }
  }, [
    helpPanelOpen,
    viewerState,
    quickOpenState,
    searchDialogOpen,
    menuOpen,
    closeViewer,
    debouncedAction,
    moveCursorDown,
    moveCursorUp,
    getSelectedNode,
    collapseDirectory,
    fileTreeService,
    expandDirectory,
    excludePatterns,
    toggleFocus,
    openViewer,
    openInEditor,
    toggleFollowMode,
    treeState.followModeEnabled,
    showStatus,
    activeKeybinds,
    focusManager,
  ]);

  useInput(handleInput, { 
    isActive: hasFocus && (
      focusManager.isFocused('file-tree') || 
      focusManager.isFocused('syntax-viewer') ||
      focusManager.isFocused('help-panel') ||
      focusManager.isFocused('search-dialog') ||
      focusManager.isFocused('quick-open-dialog') ||
      focusManager.isFocused('quick-actions-menu')
    )
  });

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      if (statusTimerRef.current) {
        clearTimeout(statusTimerRef.current);
      }
    };
  }, []);

  // Performance optimization: Memoize visible window calculation
  // This prevents unnecessary recalculations when unrelated state changes
  const visibleNodes = React.useMemo(() => {
    if (!treeState.root) {
      return [];
    }

    return fileTreeService.getVisibleNodes(treeState.root, {
      scrollOffset: treeState.scrollOffset,
      windowSize: treeState.windowSize,
    });
  }, [
    treeState.root,
    treeState.scrollOffset,
    treeState.windowSize,
    fileTreeService,
  ]);

  // Update visible window in state when it changes
  useEffect(() => {
    setVisibleWindow(visibleNodes);
  }, [visibleNodes, setVisibleWindow]);

  if (!treeState.root) {
    return (
      <Box flexDirection="column">
        <Text dimColor>No directory loaded</Text>
      </Box>
    );
  }

  const treeRootPath = treeState.root.path;

  return (
    <Box flexDirection="column" height="100%">
      {helpPanelOpen && (
        <HelpPanel
          isOpen={helpPanelOpen}
          onClose={() => setHelpPanelOpen(false)}
        />
      )}

      {quickOpenState && (
        <QuickOpenDialog
          isOpen={quickOpenState}
          allFiles={treeState.root ? fileTreeService.flattenTree(treeState.root).filter(n => n.type === 'file') : []}
          onSelect={handleQuickOpenSelect}
          onClose={() => setQuickOpenState(false)}
          history={quickOpenHistory}
          onHistoryUpdate={updateQuickOpenHistory}
        />
      )}

      {searchDialogOpen && (
        <FileSearchDialog
          visible={searchDialogOpen}
          onClose={() => setSearchDialogOpen(false)}
          onSelect={handleSearchSelect}
          toolRegistry={toolRegistry}
          rootPath={treeState.root?.path || rootPath}
        />
      )}

      {confirmationState?.isOpen && (
        <ConfirmationDialog
          isOpen={confirmationState.isOpen}
          message={confirmationState.message}
          title="Confirm Delete"
          level="danger"
          onConfirm={confirmationState.onConfirm}
          onCancel={() => setConfirmationState(null)}
        />
      )}

      {menuOpen && (
        <QuickActionsMenu
          selectedNode={getSelectedNode()}
          isOpen={menuOpen}
          onAction={handleQuickAction}
          onClose={() => setMenuOpen(false)}
        />
      )}

      {viewerState?.isOpen && (
        <Box
          flexDirection="column"
          borderStyle="double"
          borderColor="cyan"
          padding={1}
          flexGrow={1}
        >
          <Box marginBottom={1}>
            <Text color="cyan" bold>
              Syntax Viewer
            </Text>
            <Text color="gray"> (Press Esc to close)</Text>
          </Box>
          
          <SyntaxViewer
            filePath={viewerState.filePath}
            content={viewerState.content}
          />
        </Box>
      )}

      {!viewerState?.isOpen && !helpPanelOpen && (
        <>
          <LoadingIndicator isLoading={isLoading} message={loadingMessage} />

          <Box flexDirection="column" flexGrow={1} overflow="hidden">
            {Array.isArray(treeState.visibleWindow) && treeState.visibleWindow.map((node, index) => {
              if (!node || !node.path || !node.name) return null;
              
              const isSelected = index === treeState.cursorPosition;
              const isFocusedFile = isFocused(node.path);
              const indentation = calculateIndentation(node, treeRootPath);
              const icon = getNodeIcon(node);
              const gitColor = getGitStatusColor(node.gitStatus);

              return (
                <Box key={node.path} flexDirection="row">
                  <Text>{' '.repeat(indentation * 2)}</Text>
                  
                  <Text bold={isSelected} color={isSelected ? 'cyan' : undefined}>
                    {isSelected ? '> ' : '  '}
                  </Text>
                  
                  <Text> {icon} </Text>
                  
                  <Text
                    bold={isSelected}
                    color={gitColor || (isSelected ? 'cyan' : undefined)}
                  >
                    {node.name}
                  </Text>
                  
                  {isFocusedFile && (
                    <Text> {ICONS.focusIndicator}</Text>
                  )}
                </Box>
              );
            })}
            
            {treeState.visibleWindow.length === 0 && (
              <Text dimColor>No items found</Text>
            )}
          </Box>
          
          {statusMessage && (
            <Box marginTop={1}>
              <Text dimColor>{statusMessage}</Text>
            </Box>
          )}
          
          {treeState.followModeEnabled && (
            <Box marginTop={statusMessage ? 0 : 1}>
              <Text color="cyan">Follow Mode: ON</Text>
              <Text dimColor> (Press F to toggle)</Text>
            </Box>
          )}
        </>
      )}
    </Box>
  );
}