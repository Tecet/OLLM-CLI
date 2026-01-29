/**
 * File Explorer UI Component
 *
 * Barrel export file for the File Explorer component and its types.
 * This provides a clean public API for importing file explorer functionality.
 */

// Export all core types
export type {
  WorkspaceConfig,
  ProjectConfig,
  FileNode,
  GitStatus,
  FocusedFile,
  ImageMetadata,
} from './types.js';

// Export services
export { WorkspaceManager } from './WorkspaceManager.js';
export { PathSanitizer, PathTraversalError, WorkspaceBoundaryError } from './PathSanitizer.js';
export {
  FileTreeService,
  type BuildTreeOptions,
  type GetVisibleNodesOptions,
} from './FileTreeService.js';
export { GitStatusService } from './GitStatusService.js';
export { FocusSystem } from './FocusSystem.js';
export { EditorIntegration, type EditorResult } from './EditorIntegration.js';
export {
  FileOperations,
  FileOperationError,
  PermissionError,
  type FileOperationResult,
  type ConfirmationCallback,
} from './FileOperations.js';
export { FollowModeService, type DetectFilePathsOptions } from './FollowModeService.js';
export {
  ExplorerPersistence,
  type ExplorerState,
  type ExplorerPersistenceOptions,
} from './ExplorerPersistence.js';
export { handleError, type ErrorInfo } from './ErrorHandler.js';

// Export contexts and hooks
export {
  WorkspaceProvider,
  useWorkspace,
  type WorkspaceMode,
  type WorkspaceState,
  type WorkspaceContextValue,
  type WorkspaceProviderProps,
} from './WorkspaceContext.js';

export {
  FileFocusProvider,
  useFileFocus,
  type FocusState,
  type FileFocusContextValue,
  type FileFocusProviderProps,
} from './FileFocusContext.js';

export {
  FileTreeProvider,
  useFileTree,
  type FileTreeState,
  type FileTreeContextValue,
  type FileTreeProviderProps,
} from './FileTreeContext.js';

// Export components
export { FileExplorerComponent, type FileExplorerComponentProps } from './FileExplorerComponent.js';
export { EnhancedFileExplorer } from './EnhancedFileExplorer.js';
export { FileTreeView, type FileTreeViewProps } from './FileTreeView.js';
export { FocusedFilesPanel, type FocusedFilesPanelProps } from './FocusedFilesPanel.js';

// Export utilities
export {
  injectFocusedFiles,
  getFocusedFilesSummary,
  exceedsSizeThreshold,
} from './FocusedFilesInjector.js';
export {
  SyntaxViewer,
  type SyntaxViewerProps,
} from './SyntaxViewer.js';
export {
  QuickActionsMenu,
  type QuickActionsMenuProps,
  type QuickAction,
  type MenuOption,
} from './QuickActionsMenu.js';
export { ConfirmationDialog, type ConfirmationDialogProps } from './ConfirmationDialog.js';
export { QuickOpenDialog, type QuickOpenDialogProps } from './QuickOpenDialog.js';
export { Header, type HeaderProps } from './Header.js';
export { HelpPanel, type HelpPanelProps } from './HelpPanel.js';
export {
  LoadingIndicator,
  type LoadingIndicatorProps,
  useLoadingState,
} from './LoadingIndicator.js';
