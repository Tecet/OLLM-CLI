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
