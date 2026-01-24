import React, { useEffect } from 'react';
import { Box, Text } from 'ink';

import { useFocusManager } from '../../../features/context/FocusContext.js';
import { useUI } from '../../../features/context/UIContext.js';
import { ErrorBoundary } from '../ErrorBoundary.js';
import { 
  FileTreeView, 
  FileTreeService, 
  FocusSystem, 
  EditorIntegration, 
  FileOperations,
  useFileTree
} from '../file-explorer/index.js';

export interface FilesTabProps {
  /** Width of the tab container */
  width?: number;
  
  /** File Explorer Services */
  fileTreeService: FileTreeService;
  focusSystem: FocusSystem;
  editorIntegration: EditorIntegration;
  fileOperations: FileOperations;
}

/**
 * FilesTab component
 * 
 * Displays the File Explorer tree view.
 * 
 * Requirements: 10.1, 10.2, 10.3, 10.4, 10.5
 */
export function FilesTab({
  width,
  fileTreeService,
  focusSystem,
  editorIntegration,
  fileOperations,
}: FilesTabProps) {
  const { state: uiState } = useUI();
  const { isFocused } = useFocusManager();
  const { state: treeState, setRoot, expandDirectory, setCursorPosition, setScrollOffset } = useFileTree();

  const hasFocus = isFocused('file-tree'); // Use 'file-tree' focus ID

  // Initialize tree if not already loaded
  useEffect(() => {
    if (!treeState.root) {
      const initTree = async () => {
        try {
          // console.log('Initializing file tree with root:', process.cwd());
          const rootNode = await fileTreeService.buildTree({
            rootPath: process.cwd(),
            // excludePatterns: ['node_modules', '.git', 'dist', 'coverage']
          });
          // console.log('File tree built, setting root:', rootNode);
          setRoot(rootNode);
        } catch (error) {
          console.error('Failed to initialize file tree:', error);
        }
      };
      initTree();
    }
  }, [treeState.root, fileTreeService, setRoot]);

  // When the file-tree receives focus, ensure the root is expanded and
  // the first folder (if any) is selected so keyboard navigation works
  useEffect(() => {
    if (!hasFocus || !treeState.root) return;

    const ensureRootOpen = async () => {
      try {
        // Mark root as expanded in context (instant)
        expandDirectory(treeState.root.path);

        // Load children (lazy-load) so visible nodes are populated
        await fileTreeService.expandDirectory(treeState.root, ['node_modules', '.git', 'dist', 'coverage']);

        // Reset scroll and position to show top of tree
        setScrollOffset(0);

        // If root has children, select the first child (index 1 in flattened list),
        // otherwise select root (index 0)
        const firstIndex = (treeState.root.children && treeState.root.children.length > 0) ? 1 : 0;
        setCursorPosition(firstIndex);
      } catch (err) {
        // Fail silently but log for debugging
        console.error('Failed to open file tree on focus:', err);
      }
    };

    ensureRootOpen();
  }, [hasFocus, treeState.root, expandDirectory, fileTreeService, setCursorPosition, setScrollOffset]);

  return (
    <Box flexDirection="column" height="100%" width={width} padding={1}>
      <Box
        flexDirection="column"
        borderStyle="single"
        borderColor={hasFocus ? uiState.theme.border.active : uiState.theme.border.primary}
        paddingX={1}
        flexGrow={1}
      >
        <Box marginBottom={1}>
          <Text bold color={uiState.theme.text.accent}>
            File Explorer
          </Text>
        </Box>

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
  );
}
