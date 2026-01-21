/**
 * FileTreeView - Terminal UI component for file tree rendering
 * 
 * Renders the file tree with virtual scrolling, Nerd Font icons, git status
 * colors, and focus indicators. Supports keyboard navigation and file focusing.
 * 
 * Requirements: 2.1, 2.6, 2.7, 3.1, 3.4
 */

import React, { useEffect, useRef, useCallback, useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { readFile } from 'fs/promises';
import { useFileTree } from './FileTreeContext.js';
import { useFileFocus } from './FileFocusContext.js';
import { FileTreeService } from './FileTreeService.js';
import { FocusSystem } from './FocusSystem.js';
import { EditorIntegration } from './EditorIntegration.js';
import { SyntaxViewer } from './SyntaxViewer.js';
import { QuickActionsMenu, type QuickAction } from './QuickActionsMenu.js';
import { ConfirmationDialog } from './ConfirmationDialog.js';
import { QuickOpenDialog } from './QuickOpenDialog.js';
import { FileOperations } from './FileOperations.js';
import { FollowModeService } from './FollowModeService.js';
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
  /** Exclude patterns for filtering */
  excludePatterns?: string[];
}

/**
 * Nerd Font icons for file types
 * 
 * Using common Nerd Font icons that should be available in most
 * terminal fonts with Nerd Font support.
 */
const ICONS = {
  // Directory icons
  directoryExpanded: ' ',   // nf-fa-folder_open
  directoryCollapsed: ' ',  // nf-fa-folder
  
  // File type icons
  file: ' ',                // nf-fa-file_o (default file)
  typescript: ' ',          // nf-seti-typescript
  javascript: ' ',          // nf-seti-javascript
  json: ' ',                // nf-seti-json
  markdown: ' ',            // nf-dev-markdown
  yaml: ' ',                // nf-seti-yml
  image: ' ',               // nf-fa-file_image_o
  text: ' ',                // nf-fa-file_text_o
  code: ' ',                // nf-fa-file_code_o
  
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
 * 
 * Maps git status to terminal colors:
 * - untracked: green
 * - modified: yellow
 * - ignored: grey
 * - clean: default (no color)
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
 * 
 * Determines how many levels deep the node is in the tree
 * by counting path separators relative to the root.
 */
function calculateIndentation(node: FileNode, rootPath: string): number {
  const relativePath = node.path.replace(rootPath, '');
  const depth = relativePath.split('/').filter(p => p.length > 0).length;
  return Math.max(0, depth - 1); // Root is at depth 0
}

/**
 * FileTreeView component
 * 
 * Renders the file tree with virtual scrolling, showing only the visible
 * window of nodes. Displays icons, git status colors, and focus indicators.
 * Supports keyboard navigation with debouncing and file focusing.
 * 
 * Keyboard shortcuts:
 * - j/Down: Move cursor down
 * - k/Up: Move cursor up
 * - h/Left: Collapse directory
 * - l/Right: Expand directory
 * - f: Toggle focus on selected file
 * - v: View file with syntax highlighting
 * - e: Edit file in external editor
 * - a: Open quick actions menu
 * - F: Toggle Follow Mode
 * - Esc: Close viewer modal
 */
export function FileTreeView({ fileTreeService, focusSystem, editorIntegration, fileOperations, followModeService, excludePatterns = [] }: FileTreeViewProps) {
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

  // Status message state for user feedback
  const [statusMessage, setStatusMessage] = useState<string>('');
  const statusTimerRef = useRef<NodeJS.Timeout | null>(null);

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
   * 
   * Displays a message for 2 seconds then clears it.
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
   * 
   * Navigates to the selected file in the tree and highlights it.
   */
  const handleQuickOpenSelect = useCallback(async (node: FileNode) => {
    // Find the node in the tree and expand parent directories
    if (!treeState.root) {
      return;
    }

    // For now, just show a status message
    // TODO: Implement tree navigation to the selected file
    showStatus(`Selected: ${node.name}`);
    
    // Close the dialog
    setQuickOpenState(false);
  }, [treeState.root, showStatus]);

  /**
   * Update Quick Open history
   * 
   * Adds a file path to the history, keeping the most recent 20 entries.
   */
  const updateQuickOpenHistory = useCallback((filePath: string) => {
    setQuickOpenHistory((prev) => {
      // Remove the path if it already exists
      const filtered = prev.filter(p => p !== filePath);
      
      // Add to the front
      const updated = [filePath, ...filtered];
      
      // Keep only the most recent 20 entries
      return updated.slice(0, 20);
    });
  }, []);

  /**
   * Toggle focus on the selected file
   * 
   * If the file is currently focused, unfocus it.
   * If the file is not focused, focus it and add to the focus list.
   */
  const toggleFocus = useCallback(async () => {
    const selectedNode = getSelectedNode();
    
    if (!selectedNode) {
      showStatus('No file selected');
      return;
    }
    
    // Can only focus files, not directories
    if (selectedNode.type === 'directory') {
      showStatus('Cannot focus directories');
      return;
    }
    
    const filePath = selectedNode.path;
    
    try {
      if (isFocused(filePath)) {
        // Unfocus the file
        focusSystem.unfocusFile(filePath);
        removeFocusedFile(filePath);
        showStatus(`Unfocused: ${selectedNode.name}`);
      } else {
        // Focus the file
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
   * 
   * Reads the file content and displays it in a modal with syntax highlighting.
   */
  const openViewer = useCallback(async () => {
    const selectedNode = getSelectedNode();
    
    if (!selectedNode) {
      showStatus('No file selected');
      return;
    }
    
    // Can only view files, not directories
    if (selectedNode.type === 'directory') {
      showStatus('Cannot view directories');
      return;
    }
    
    const filePath = selectedNode.path;
    
    try {
      showStatus('Loading file...');
      const content = await readFile(filePath, 'utf-8');
      
      setViewerState({
        isOpen: true,
        filePath,
        content,
      });
      
      setStatusMessage(''); // Clear status message when viewer opens
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      showStatus(`Error reading file: ${errorMsg}`);
    }
  }, [getSelectedNode, showStatus]);

  /**
   * Close the syntax viewer modal
   */
  const closeViewer = useCallback(() => {
    setViewerState(null);
  }, []);

  /**
   * Open file in external editor
   * 
   * Spawns the editor process and waits for it to exit.
   * Handles errors gracefully and displays status messages.
   */
  const openInEditor = useCallback(async () => {
    const selectedNode = getSelectedNode();
    
    if (!selectedNode) {
      showStatus('No file selected');
      return;
    }
    
    // Can only edit files, not directories
    if (selectedNode.type === 'directory') {
      showStatus('Cannot edit directories');
      return;
    }
    
    const filePath = selectedNode.path;
    const editorCommand = editorIntegration.getEditorCommand();
    
    try {
      showStatus(`Opening in ${editorCommand}...`);
      
      const result = await editorIntegration.openInEditor(filePath);
      
      if (result.success) {
        showStatus(`Editor closed successfully`);
      } else {
        showStatus(`Editor exited with code ${result.exitCode}: ${result.error || 'Unknown error'}`);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      showStatus(`Error opening editor: ${errorMsg}`);
    }
  }, [getSelectedNode, editorIntegration, showStatus]);

  /**
   * Handle quick actions menu action selection
   */
  const handleQuickAction = useCallback(async (action: QuickAction) => {
    switch (action) {
      case 'open':
        await openViewer();
        break;
      case 'focus':
        await toggleFocus();
        break;
      case 'edit':
        await openInEditor();
        break;
      case 'rename':
        showStatus('Rename functionality not yet implemented');
        break;
      case 'delete':
        const selectedNode = getSelectedNode();
        if (!selectedNode) {
          showStatus('No file or folder selected');
          return;
        }
        
        // Show confirmation dialog
        const isDirectory = selectedNode.type === 'directory';
        const message = isDirectory
          ? `Are you sure you want to delete the folder "${selectedNode.name}" and all its contents?`
          : `Are you sure you want to delete "${selectedNode.name}"?`;
        
        setConfirmationState({
          isOpen: true,
          message,
          onConfirm: async () => {
            try {
              showStatus(`Deleting ${selectedNode.name}...`);
              
              // Create a confirmation callback that always returns true
              // since we've already confirmed via the dialog
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
                // TODO: Refresh the tree to reflect the deletion
              } else {
                showStatus(`Failed to delete: ${result.error}`);
              }
            } catch (error) {
              const errorMsg = error instanceof Error ? error.message : 'Unknown error';
              showStatus(`Error deleting: ${errorMsg}`);
            } finally {
              setConfirmationState(null);
            }
          },
        });
        break;
      case 'copyPath':
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
  }, [openViewer, toggleFocus, openInEditor, getSelectedNode, fileOperations, showStatus]);

  /**
   * Debounced action executor
   * 
   * Wraps an action in a debounce timer to prevent excessive re-renders
   * from rapid keyboard input.
   */
  const debouncedAction = useCallback((action: () => void) => {
    // Clear existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Set new timer
    debounceTimerRef.current = setTimeout(() => {
      action();
      debounceTimerRef.current = null;
    }, DEBOUNCE_DELAY);
  }, []);

  /**
   * Handle LLM message for Follow Mode
   * 
   * Detects file paths in LLM messages and automatically expands
   * the tree to show those files when Follow Mode is enabled.
   */
  const handleLLMMessage = useCallback(async (message: string) => {
    if (!treeState.followModeEnabled || !followModeService || !treeState.root) {
      return;
    }

    const rootPath = treeState.root.path;
    const detectedPaths = followModeService.extractFromLLMResponse(message, {
      rootPath,
      filterByRoot: true,
    });

    // Expand to each detected path
    for (const filePath of detectedPaths) {
      if (followModeService.shouldExpandToPath(filePath, rootPath)) {
        await expandToPath(filePath);
        showStatus(`Follow Mode: Expanded to ${filePath}`);
      }
    }
  }, [treeState.followModeEnabled, treeState.root, followModeService, expandToPath, showStatus]);

  /**
   * Handle keyboard input
   * 
   * Processes keyboard events for navigation and focus:
   * - j/Down: Move cursor down
   * - k/Up: Move cursor up
   * - h/Left: Collapse directory
   * - l/Right: Expand directory
   * - f: Toggle focus on selected file
   * - v: View file with syntax highlighting
   * - e: Edit file in external editor
   * - a: Open quick actions menu
   * - F: Toggle Follow Mode
   * - Ctrl+O: Open Quick Open dialog
   * - Esc: Close viewer modal or menu
   */
  useInput((input, key) => {
    // If viewer is open, handle Esc to close it
    if (viewerState?.isOpen) {
      if (key.escape) {
        closeViewer();
      }
      // Ignore other inputs when viewer is open
      return;
    }

    // If Quick Open is open, let it handle input
    if (quickOpenState) {
      // Quick Open handles its own input
      return;
    }

    // If menu is open, let the menu handle input
    if (menuOpen) {
      if (key.escape) {
        setMenuOpen(false);
      }
      // Menu component handles its own input
      return;
    }

    // Handle Ctrl+O for Quick Open
    if (key.ctrl && input === 'o') {
      setQuickOpenState(true);
      return;
    }

    // Handle arrow keys and vim-style navigation
    if (input === 'j' || key.downArrow) {
      debouncedAction(() => moveCursorDown());
    } else if (input === 'k' || key.upArrow) {
      debouncedAction(() => moveCursorUp());
    } else if (input === 'h' || key.leftArrow) {
      // Collapse directory at cursor
      const selectedNode = getSelectedNode();
      if (selectedNode && selectedNode.type === 'directory' && selectedNode.expanded) {
        debouncedAction(() => {
          collapseDirectory(selectedNode.path);
          // Also collapse in the node itself for immediate UI feedback
          fileTreeService.collapseDirectory(selectedNode);
        });
      }
    } else if (input === 'l' || key.rightArrow) {
      // Expand directory at cursor
      const selectedNode = getSelectedNode();
      if (selectedNode && selectedNode.type === 'directory' && !selectedNode.expanded) {
        debouncedAction(async () => {
          // Expand in the service (loads children from filesystem)
          await fileTreeService.expandDirectory(selectedNode, excludePatterns);
          // Update context state
          expandDirectory(selectedNode.path);
        });
      }
    } else if (input === 'f') {
      // Toggle focus on selected file
      toggleFocus();
    } else if (input === 'v') {
      // Open file in syntax viewer
      openViewer();
    } else if (input === 'e') {
      // Open file in external editor
      openInEditor();
    } else if (input === 'a') {
      // Open quick actions menu
      setMenuOpen(true);
    } else if (input === 'F') {
      // Toggle Follow Mode
      toggleFollowMode();
      const newState = !treeState.followModeEnabled;
      showStatus(`Follow Mode: ${newState ? 'Enabled' : 'Disabled'}`);
    }
  }, [
    viewerState,
    quickOpenState,
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
  ]);

  // Cleanup debounce timer on unmount
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

  // Update visible window when tree state changes
  useEffect(() => {
    if (!treeState.root) {
      setVisibleWindow([]);
      return;
    }

    // Get visible nodes for the current scroll position
    const visibleNodes = fileTreeService.getVisibleNodes(treeState.root, {
      scrollOffset: treeState.scrollOffset,
      windowSize: treeState.windowSize,
    });

    setVisibleWindow(visibleNodes);
  }, [
    treeState.root,
    treeState.scrollOffset,
    treeState.windowSize,
    treeState.expandedPaths,
    fileTreeService,
    setVisibleWindow,
  ]);

  // If no root, show empty state
  if (!treeState.root) {
    return (
      <Box flexDirection="column">
        <Text dimColor>No directory loaded</Text>
      </Box>
    );
  }

  // If no visible nodes, show empty state
  if (treeState.visibleWindow.length === 0) {
    return (
      <Box flexDirection="column">
        <Text dimColor>Empty directory</Text>
      </Box>
    );
  }

  const rootPath = treeState.root.path;

  return (
    <Box flexDirection="column">
      {/* Quick Open Dialog - displayed on top when open */}
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

      {/* Confirmation Dialog - displayed on top when open */}
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

      {/* Quick Actions Menu - displayed on top when open */}
      {menuOpen && (
        <QuickActionsMenu
          selectedNode={getSelectedNode()}
          isOpen={menuOpen}
          onAction={handleQuickAction}
          onClose={() => setMenuOpen(false)}
        />
      )}

      {/* Viewer modal - displayed on top when open */}
      {viewerState?.isOpen && (
        <Box
          flexDirection="column"
          borderStyle="double"
          borderColor="cyan"
          padding={1}
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

      {/* File tree - hidden when viewer is open */}
      {!viewerState?.isOpen && (
        <>
          {/* File tree */}
          <Box flexDirection="column">
            {treeState.visibleWindow.map((node, index) => {
              const isSelected = index === treeState.cursorPosition;
              const isFocusedFile = isFocused(node.path);
              const indentation = calculateIndentation(node, rootPath);
              const icon = getNodeIcon(node);
              const gitColor = getGitStatusColor(node.gitStatus);

              return (
                <Box key={node.path} flexDirection="row">
                  {/* Indentation */}
                  <Text>{' '.repeat(indentation * 2)}</Text>
                  
                  {/* Selection indicator */}
                  <Text bold={isSelected} inverse={isSelected}>
                    {isSelected ? '>' : ' '}
                  </Text>
                  
                  {/* Icon */}
                  <Text> {icon} </Text>
                  
                  {/* File/directory name with git status color */}
                  <Text
                    bold={isSelected}
                    color={gitColor}
                  >
                    {node.name}
                  </Text>
                  
                  {/* Focus indicator */}
                  {isFocusedFile && (
                    <Text> {ICONS.focusIndicator}</Text>
                  )}
                </Box>
              );
            })}
          </Box>
          
          {/* Status message */}
          {statusMessage && (
            <Box marginTop={1}>
              <Text dimColor>{statusMessage}</Text>
            </Box>
          )}
          
          {/* Follow Mode indicator */}
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
