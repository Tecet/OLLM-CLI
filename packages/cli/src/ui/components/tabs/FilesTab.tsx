import React, { useEffect } from 'react';
import { Box, Text } from 'ink';
import { useUI } from '../../../features/context/UIContext.js';
import { useFocusManager } from '../../../features/context/FocusContext.js';
import { 
  FileTreeView, 
  FileTreeService, 
  FocusSystem, 
  EditorIntegration, 
  FileOperations,
  useFileTree
} from '../file-explorer/index.js';
import { ErrorBoundary } from '../ErrorBoundary.js';

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
  const { state: treeState, setRoot } = useFileTree();

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