import React, { useEffect } from 'react';
import { Box, Text, BoxProps } from 'ink';

import { useFocusManager } from '../../../features/context/FocusContext.js';
import { useUI } from '../../../features/context/UIContext.js';
import { ErrorBoundary } from '../ErrorBoundary.js';
import {
  FileTreeView,
  FileTreeService,
  FocusSystem,
  EditorIntegration,
  FileOperations,
  useFileTree,
} from '../file-explorer/index.js';

export interface FilesTabProps {
  /** Width of the tab container */
  width?: number;
  /** Height of the tab container */
  height?: number;

  /** File Explorer Services */
  fileTreeService: FileTreeService;
  focusSystem: FocusSystem;
  editorIntegration: EditorIntegration;
  fileOperations: FileOperations;
}

/**
 * FilesTab component
 *
 * Displays the File Explorer tree view with a clean layout similar to SettingsTab.
 *
 * Requirements: 10.1, 10.2, 10.3, 10.4, 10.5
 */
export function FilesTab({
  width,
  height,
  fileTreeService,
  focusSystem,
  editorIntegration,
  fileOperations,
}: FilesTabProps) {
  const { state: uiState } = useUI();
  const { isFocused } = useFocusManager();
  const {
    state: treeState,
    setRoot,
    expandDirectory,
  } = useFileTree();

  const hasFocus = isFocused('file-tree');

  // Initialize tree if not already loaded
  useEffect(() => {
    if (!treeState.root) {
      const initTree = async () => {
        try {
          const rootNode = await fileTreeService.buildTree({
            rootPath: process.cwd(),
          });
          
          // Immediately expand the root to show files and folders
          await fileTreeService.expandDirectory(rootNode, ['node_modules', '.git', 'dist', 'coverage']);
          expandDirectory(rootNode.path);
          
          setRoot(rootNode);
        } catch (error) {
          console.error('Failed to initialize file tree:', error);
        }
      };
      initTree();
    }
  }, [treeState.root, fileTreeService, setRoot, expandDirectory]);

  return (
    <Box flexDirection="column" height={height} width={width}>
      {/* Header */}
      <Box
        borderStyle={uiState.theme.border.style as BoxProps['borderStyle']}
        borderColor={hasFocus ? uiState.theme.text.accent : uiState.theme.text.secondary}
        paddingX={1}
        flexShrink={0}
      >
        <Box justifyContent="space-between" width="100%" overflow="hidden">
          <Box flexShrink={0}>
            <Text bold color={hasFocus ? uiState.theme.text.accent : uiState.theme.text.primary}>
              File Explorer
            </Text>
          </Box>
          <Box flexShrink={1} marginLeft={1}>
            <Text
              wrap="truncate-end"
              color={hasFocus ? uiState.theme.text.primary : uiState.theme.text.secondary}
            >
              ↑↓:Nav Enter:Open/Expand F:Focus V:View E:Edit A:Actions ?:Help
            </Text>
          </Box>
        </Box>
      </Box>

      {/* Content area - grows to fill remaining space */}
      <Box flexGrow={1} overflow="hidden" width="100%">
        {/* File tree content - takes 100% of parent height */}
        <Box
          flexDirection="column"
          height="100%"
          borderStyle={uiState.theme.border.style as BoxProps['borderStyle']}
          borderColor={hasFocus ? uiState.theme.border.active : uiState.theme.border.primary}
          paddingX={1}
          paddingY={1}
        >
          <ErrorBoundary>
            <FileTreeView
              fileTreeService={fileTreeService}
              focusSystem={focusSystem}
              editorIntegration={editorIntegration}
              fileOperations={fileOperations}
              excludePatterns={['node_modules', '.git', 'dist', 'coverage']}
              hasFocus={hasFocus}
            />
          </ErrorBoundary>
        </Box>
      </Box>
    </Box>
  );
}

