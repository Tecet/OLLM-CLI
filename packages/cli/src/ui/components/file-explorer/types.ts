/**
 * Core type definitions for File Explorer UI
 *
 * These interfaces define the data structures used throughout the file explorer
 * component for workspace management, file tree navigation, focus system, and
 * vision support.
 */

/**
 * Workspace configuration loaded from .ollm-workspace file
 */
export interface WorkspaceConfig {
  /** Workspace configuration version */
  version: string;
  /** List of projects in the workspace */
  projects: ProjectConfig[];
}

/**
 * Individual project configuration within a workspace
 */
export interface ProjectConfig {
  /** Display name of the project */
  name: string;
  /** Absolute or relative path to the project directory */
  path: string;
  /** Whether the LLM has access to this project's files */
  llmAccess: boolean;
  /** Glob patterns for files/directories to exclude from the tree */
  excludePatterns: string[];
}

/**
 * Git status indicator for files
 */
export type GitStatus = 'untracked' | 'modified' | 'ignored' | 'clean';

/**
 * File tree node representing a file or directory
 */
export interface FileNode {
  /** File or directory name */
  name: string;
  /** Absolute path to the file or directory */
  path: string;
  /** Node type */
  type: 'file' | 'directory';
  /** Child nodes (only for directories) */
  children?: FileNode[];
  /** Whether the directory is expanded (only for directories) */
  expanded?: boolean;
  /** Git status of the file */
  gitStatus?: GitStatus;
  /** Whether the file is currently focused for LLM context */
  isFocused?: boolean;
}

/**
 * Focused file with content for LLM context injection
 */
export interface FocusedFile {
  /** Absolute path to the focused file */
  path: string;
  /** File content (truncated if exceeds 8KB) */
  content: string;
  /** Whether the content was truncated */
  truncated: boolean;
  /** File size in bytes */
  size: number;
}

/**
 * Image metadata for vision support
 */
export interface ImageMetadata {
  /** Image width in pixels */
  width: number;
  /** Image height in pixels */
  height: number;
  /** Image format (e.g., 'jpeg', 'png', 'gif', 'webp') */
  format: string;
  /** Base64-encoded image data for vision model consumption */
  base64: string;
  /** Whether the image was resized to fit constraints */
  resized: boolean;
}
