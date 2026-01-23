/**
 * WorkspacePanel - 3-panel workspace view for the side panel
 * 
 * Layout:
 * - Top (Blue): Focused files panel - shows files focused for LLM context
 * - Middle (Yellow): File tree explorer - navigate and focus files
 * - Bottom (Red): Keybinds legend - keyboard shortcuts
 */

import { readFile } from 'fs/promises';

import { useState, useEffect, useMemo } from 'react';
import { Box, Text, useInput, measureElement } from 'ink';

import { Theme } from '../../../config/types.js';
import { useFocusManager } from '../../../features/context/FocusContext.js';
import { useServices } from '../../../features/context/ServiceContext.js';
import { useFileFocus, FileTreeService, FocusSystem, SyntaxViewer } from '../file-explorer/index.js';

import type { FileNode } from '../file-explorer/types.js';

export interface WorkspacePanelProps {
  theme: Theme;
  height: number;
  width: number;
  hasFocus: boolean;
}

export function WorkspacePanel({ theme, hasFocus }: WorkspacePanelProps) {
  const fileFocusContext = useFileFocus();
  const { container } = useServices();
  const focusManager = useFocusManager();
  const [fileTree, setFileTree] = useState<FileNode | null>(null);
  const [flattenedFiles, setFlattenedFiles] = useState<FileNode[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [scrollOffset, setScrollOffset] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [containerHeight, setContainerHeight] = useState(30); // Default height
  
  // Syntax viewer state
  const [viewerState, setViewerState] = useState<{
    isOpen: boolean;
    filePath: string;
    content: string;
  } | null>(null);
  
  // Initialize file explorer services
  const [fileTreeService] = useState(() => new FileTreeService());
  const [focusSystem] = useState(() => new FocusSystem(container?.getHookService()?.getMessageBus()));
  
  // Calculate panel heights based on container height
  const panelHeights = useMemo(() => {
    const topHeight = Math.max(3, Math.floor(containerHeight * 0.15)); // 15% for focused files
    const bottomHeight = 3; // Fixed 3 lines for keybinds
    const middleHeight = Math.max(10, containerHeight - topHeight - bottomHeight - 6); // Subtract borders
    
    return {
      top: topHeight,
      middle: middleHeight,
      bottom: bottomHeight,
    };
  }, [containerHeight]);
  
  // Rebuild flattened list whenever tree changes
  const rebuildFlattenedList = (tree: FileNode | null) => {
    if (!tree || !tree.children) {
      setFlattenedFiles([]);
      return;
    }
    
    const flattened: FileNode[] = [];
    const flatten = (node: FileNode, depth: number = 0) => {
      const nodeWithDepth = Object.assign({}, node, { depth });
      flattened.push(nodeWithDepth as FileNode & { depth: number });
      
      // If it's an expanded directory with children, add them
      if (node.type === 'directory' && node.expanded && node.children && node.children.length > 0) {
        node.children.forEach(child => flatten(child, depth + 1));
      }
    };
    
    // Start with root's children, not the root itself
    tree.children.forEach(child => flatten(child, 0));
    setFlattenedFiles(flattened);
  };
  
  // Build the file tree on mount
  useEffect(() => {
    const buildTree = async () => {
      try {
        setIsLoading(true);
        const rootPath = process.cwd();
        
        const tree = await fileTreeService.buildTree({
          rootPath,
          maxDepth: 5,
          excludePatterns: ['node_modules', '.git', 'dist', 'coverage', '.test-snapshots']
        });
        
        // Expand the root directory to load its children
        if (tree && tree.type === 'directory') {
          await fileTreeService.expandDirectory(tree, ['node_modules', '.git', 'dist', 'coverage', '.test-snapshots']);
        }
        
        setFileTree(tree);
        rebuildFlattenedList(tree);
        setIsLoading(false);
      } catch (error) {
        console.error('Failed to build file tree:', error);
        setIsLoading(false);
      }
    };
    
    buildTree();
  }, [fileTreeService]);
  
  // Handle keyboard input
  useInput((input, key) => {
    if (!hasFocus) return;
    
    // ESC closes viewer if open
    if (viewerState?.isOpen && key.escape) {
      setViewerState(null);
      focusManager.closeModal();  // Return focus to parent
      return;
    }
    
    const visibleHeight = panelHeights.middle - 1; // Subtract header line
    
    // Allow navigation even when viewer is open
    if (key.upArrow) {
      // Move selection up
      setSelectedIndex(prev => {
        const newIndex = Math.max(0, prev - 1);
        // Auto-scroll if needed
        if (newIndex < scrollOffset) {
          setScrollOffset(newIndex);
        }
        return newIndex;
      });
    } else if (key.downArrow) {
      // Move selection down
      setSelectedIndex(prev => {
        const newIndex = Math.min(flattenedFiles.length - 1, prev + 1);
        // Auto-scroll if needed
        if (newIndex >= scrollOffset + visibleHeight) {
          setScrollOffset(newIndex - visibleHeight + 1);
        }
        return newIndex;
      });
    } else if (key.return) {
      const selectedFile = flattenedFiles[selectedIndex];
      if (!selectedFile) return;
      
      if (selectedFile.type === 'directory') {
        // Toggle directory expansion on Enter
        const actualNode = fileTree ? fileTreeService.findNodeByPath(fileTree, selectedFile.path) : null;
        if (actualNode && actualNode.type === 'directory') {
          if (actualNode.expanded) {
            // Collapse if already expanded
            actualNode.expanded = false;
            fileTreeService.collapseDirectory(actualNode);
            rebuildFlattenedList(fileTree);
          } else {
            // Expand if collapsed
            fileTreeService.expandDirectory(actualNode, ['node_modules', '.git', 'dist', 'coverage', '.test-snapshots']).then(() => {
              actualNode.expanded = true;
              rebuildFlattenedList(fileTree);
            }).catch(err => {
              console.error('Failed to expand directory:', err);
            });
          }
        }
      } else if (selectedFile.type === 'file') {
        // Open file in syntax viewer
        readFile(selectedFile.path, 'utf-8').then(content => {
          setViewerState({
            isOpen: true,
            filePath: selectedFile.path,
            content,
          });
          focusManager.openModal('syntax-viewer');  // Register with focus manager
        }).catch(err => {
          console.error('Failed to read file:', err);
        });
      }
    } else if (key.rightArrow) {
      // Expand directory on right arrow (only expand, don't collapse)
      const selectedFile = flattenedFiles[selectedIndex];
      if (selectedFile && selectedFile.type === 'directory' && !selectedFile.expanded) {
        // Find the actual node in the tree
        const actualNode = fileTree ? fileTreeService.findNodeByPath(fileTree, selectedFile.path) : null;
        if (actualNode && actualNode.type === 'directory') {
          // Expand the directory
          fileTreeService.expandDirectory(actualNode, ['node_modules', '.git', 'dist', 'coverage', '.test-snapshots']).then(() => {
            actualNode.expanded = true;
            // Rebuild the flattened list to show the expanded children
            rebuildFlattenedList(fileTree);
          }).catch(err => {
            console.error('Failed to expand directory:', err);
          });
        }
      }
    } else if (key.leftArrow) {
      // Collapse directory on left arrow
      const selectedFile = flattenedFiles[selectedIndex];
      if (selectedFile && selectedFile.type === 'directory' && selectedFile.expanded) {
        // Find the actual node in the tree
        const actualNode = fileTree ? fileTreeService.findNodeByPath(fileTree, selectedFile.path) : null;
        if (actualNode && actualNode.type === 'directory') {
          actualNode.expanded = false;
          fileTreeService.collapseDirectory(actualNode);
          // Rebuild the flattened list to hide the collapsed children
          rebuildFlattenedList(fileTree);
        }
      }
    } else if (input === 'f' || input === 'F') {
      // Toggle focus/unfocus for the selected file
      const selectedFile = flattenedFiles[selectedIndex];
      if (selectedFile && selectedFile.type === 'file') {
        // Check if file is already focused
        const isAlreadyFocused = fileFocusContext.isFocused(selectedFile.path);
        
        if (isAlreadyFocused) {
          // Unfocus the file
          fileFocusContext.removeFocusedFile(selectedFile.path);
        } else {
          // Focus the file
          focusSystem.focusFile(selectedFile.path).then((focusedFile) => {
            // Add to the global FileFocusContext
            fileFocusContext.addFocusedFile(focusedFile);
          }).catch(err => {
            console.error('Failed to focus file:', err);
          });
        }
      }
    }
  }, { isActive: hasFocus && (
    focusManager.isFocused('side-file-tree') || 
    focusManager.isFocused('syntax-viewer')
  ) });

  // Get focused files array - access from state property
  const focusedFiles = fileFocusContext.state.focusedFiles;
  const focusedFilesArray = Array.from(focusedFiles.values());
  
  // Calculate visible files for the middle panel
  const visibleFiles = useMemo(() => {
    const visibleHeight = panelHeights.middle - 1; // Subtract header
    return flattenedFiles.slice(scrollOffset, scrollOffset + visibleHeight);
  }, [flattenedFiles, scrollOffset, panelHeights.middle]);

  return (
    <Box 
      flexDirection="column" 
      width="100%" 
      flexGrow={1}
      ref={(ref) => {
        if (ref) {
          const measured = measureElement(ref);
          if (measured.height && measured.height !== containerHeight) {
            setContainerHeight(measured.height);
          }
        }
      }}
    >
      {/* Top Panel (Blue): Focused Files */}
      <Box
        height={panelHeights.top}
        flexShrink={0}
        borderStyle="round"
        borderColor="blue"
        flexDirection="column"
        paddingX={1}
      >
        <Text color="blue" bold>📌 Focused Files ({focusedFilesArray.length})</Text>
        {focusedFilesArray.length === 0 ? (
          <Text dimColor>No files focused</Text>
        ) : (
          focusedFilesArray.slice(0, panelHeights.top - 2).map((file, index) => (
            <Text key={index} color={theme.text.primary}>
              {file.path.split('/').pop() || file.path}
            </Text>
          ))
        )}
      </Box>

      {/* Middle Panel (Yellow): File Tree Explorer or Syntax Viewer */}
      <Box
        flexGrow={1}
        borderStyle="round"
        borderColor={viewerState?.isOpen ? 'cyan' : 'yellow'}
        flexDirection="column"
        paddingX={1}
      >
        {viewerState?.isOpen ? (
          <Box flexDirection="column" height="100%">
            <Text color="cyan" bold>📄 Syntax Viewer</Text>
            <Box marginTop={1} flexDirection="column" overflow="hidden">
              <SyntaxViewer
                filePath={viewerState.filePath}
                content={viewerState.content}
              />
            </Box>
          </Box>
        ) : (
          <>
            <Text color="yellow" bold>📂 Workspace Files ({flattenedFiles.length} items)</Text>
            {isLoading ? (
              <Text color="yellow">Loading file tree...</Text>
            ) : flattenedFiles.length === 0 ? (
              <Text dimColor>No files found</Text>
            ) : (
              <Box flexDirection="column">
                {visibleFiles.map((file, index) => {
                  const actualIndex = scrollOffset + index;
                  const isSelected = actualIndex === selectedIndex;
                  const indent = '  '.repeat((file as any).depth || 0);
                  const isDir = file.type === 'directory';
                  const icon = isDir ? (file.expanded ? '📂' : '📁') : '📄';
                  const focusIndicator = hasFocus && isSelected ? '→ ' : '  ';
                  const isFocusedFile = fileFocusContext.isFocused(file.path);
                  
                  return (
                    <Text
                      key={actualIndex}
                      color={isSelected ? 'cyan' : theme.text.primary}
                      backgroundColor={isSelected ? 'blue' : undefined}
                    >
                      {focusIndicator}{indent}{icon} {file.name}{isFocusedFile ? ' 📌' : ''}
                    </Text>
                  );
                })}
              </Box>
            )}
          </>
        )}
      </Box>

      {/* Bottom Panel (Red): Keybinds Legend */}
      <Box
        height={panelHeights.bottom}
        flexShrink={0}
        borderStyle="round"
        borderColor="red"
        flexDirection="column"
        paddingX={1}
      >
        <Text color="red" bold>⌨️  Keybinds</Text>
        {viewerState?.isOpen ? (
          <Text dimColor>
            <Text color="cyan">↑↓</Text> Navigate <Text color="cyan">ESC</Text> Close Viewer
          </Text>
        ) : (
          <Text dimColor>
            <Text color="cyan">↑↓</Text> Navigate <Text color="cyan">←→</Text> Collapse/Expand <Text color="cyan">Enter</Text> View <Text color="cyan">F</Text> Focus
          </Text>
        )}
      </Box>
    </Box>
  );
}
