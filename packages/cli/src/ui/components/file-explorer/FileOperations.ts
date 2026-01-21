/**
 * FileOperations - Service for file and folder CRUD operations
 * 
 * This service provides safe file system operations with validation,
 * permission checks, and error handling. All operations are validated
 * through PathSanitizer to prevent security issues.
 * 
 * Key responsibilities:
 * - Create files and folders with path validation
 * - Rename files and folders with validation
 * - Delete files and folders with confirmation
 * - Copy file paths to clipboard
 * - Validate permissions before operations
 * - Display error messages on failure
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { PathSanitizer, PathTraversalError, WorkspaceBoundaryError } from './PathSanitizer.js';

/**
 * Error thrown when a file operation fails
 */
export class FileOperationError extends Error {
  constructor(
    operation: string,
    filePath: string,
    reason: string,
    public readonly code?: string
  ) {
    super(`${operation} failed for ${filePath}: ${reason}`);
    this.name = 'FileOperationError';
  }
}

/**
 * Error thrown when permission validation fails
 */
export class PermissionError extends Error {
  constructor(filePath: string, operation: string) {
    super(`Permission denied for ${operation} on ${filePath}`);
    this.name = 'PermissionError';
  }
}

/**
 * Result of a file operation
 */
export interface FileOperationResult {
  /** Whether the operation succeeded */
  success: boolean;
  /** Error message if operation failed */
  error?: string;
  /** The path that was operated on */
  path: string;
}

/**
 * Confirmation callback for destructive operations
 */
export type ConfirmationCallback = (message: string) => Promise<boolean>;

/**
 * FileOperations service for safe file system operations
 */
export class FileOperations {
  private pathSanitizer: PathSanitizer;
  private workspaceRoot?: string;

  constructor(workspaceRoot?: string) {
    this.pathSanitizer = new PathSanitizer();
    this.workspaceRoot = workspaceRoot;
  }

  /**
   * Set the workspace root for boundary validation
   */
  setWorkspaceRoot(root: string): void {
    this.workspaceRoot = root;
  }

  /**
   * Validate a path before performing operations
   * 
   * @param inputPath - The path to validate
   * @returns The sanitized absolute path
   * @throws {PathTraversalError} If path contains traversal sequences
   * @throws {WorkspaceBoundaryError} If path is outside workspace (when workspace is set)
   */
  private validatePath(inputPath: string): string {
    if (this.workspaceRoot) {
      return this.pathSanitizer.validateWorkspacePath(inputPath, this.workspaceRoot);
    }
    return this.pathSanitizer.sanitize(inputPath);
  }

  /**
   * Check if the current process has permission to perform an operation
   * 
   * @param filePath - The file path to check
   * @param operation - The operation to perform ('read', 'write', 'execute')
   * @returns true if permission is granted
   */
  private async checkPermission(filePath: string, operation: 'read' | 'write' | 'execute'): Promise<boolean> {
    try {
      // Check if file exists first
      await fs.access(filePath, fs.constants.F_OK);
      
      // Check specific permission
      const mode = operation === 'read' 
        ? fs.constants.R_OK 
        : operation === 'write'
        ? fs.constants.W_OK
        : fs.constants.X_OK;
      
      await fs.access(filePath, mode);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if parent directory has write permission
   * 
   * @param filePath - The file path whose parent to check
   * @returns true if parent directory is writable
   */
  private async checkParentWritePermission(filePath: string): Promise<boolean> {
    const parentDir = path.dirname(filePath);
    return this.checkPermission(parentDir, 'write');
  }

  /**
   * Create a new file
   * 
   * @param filePath - Path where the file should be created
   * @param content - Initial content for the file (default: empty string)
   * @returns Result of the operation
   */
  async createFile(filePath: string, content: string = ''): Promise<FileOperationResult> {
    try {
      // Validate path
      const sanitizedPath = this.validatePath(filePath);
      
      // Check if file already exists
      try {
        await fs.access(sanitizedPath);
        return {
          success: false,
          error: 'File already exists',
          path: sanitizedPath
        };
      } catch {
        // File doesn't exist, which is what we want
      }
      
      // Check parent directory write permission
      if (!await this.checkParentWritePermission(sanitizedPath)) {
        throw new PermissionError(sanitizedPath, 'create file');
      }
      
      // Create the file
      await fs.writeFile(sanitizedPath, content, 'utf-8');
      
      return {
        success: true,
        path: sanitizedPath
      };
    } catch (error) {
      if (error instanceof PathTraversalError || error instanceof WorkspaceBoundaryError) {
        return {
          success: false,
          error: error.message,
          path: filePath
        };
      }
      if (error instanceof PermissionError) {
        return {
          success: false,
          error: error.message,
          path: filePath
        };
      }
      
      const err = error as NodeJS.ErrnoException;
      return {
        success: false,
        error: err.message || 'Unknown error',
        path: filePath
      };
    }
  }

  /**
   * Create a new folder
   * 
   * @param folderPath - Path where the folder should be created
   * @param recursive - Whether to create parent directories (default: false)
   * @returns Result of the operation
   */
  async createFolder(folderPath: string, recursive: boolean = false): Promise<FileOperationResult> {
    try {
      // Validate path
      const sanitizedPath = this.validatePath(folderPath);
      
      // Check if folder already exists
      try {
        const stats = await fs.stat(sanitizedPath);
        if (stats.isDirectory()) {
          return {
            success: false,
            error: 'Folder already exists',
            path: sanitizedPath
          };
        } else {
          return {
            success: false,
            error: 'A file with this name already exists',
            path: sanitizedPath
          };
        }
      } catch {
        // Folder doesn't exist, which is what we want
      }
      
      // Check parent directory write permission
      if (!await this.checkParentWritePermission(sanitizedPath)) {
        throw new PermissionError(sanitizedPath, 'create folder');
      }
      
      // Create the folder
      await fs.mkdir(sanitizedPath, { recursive });
      
      return {
        success: true,
        path: sanitizedPath
      };
    } catch (error) {
      if (error instanceof PathTraversalError || error instanceof WorkspaceBoundaryError) {
        return {
          success: false,
          error: error.message,
          path: folderPath
        };
      }
      if (error instanceof PermissionError) {
        return {
          success: false,
          error: error.message,
          path: folderPath
        };
      }
      
      const err = error as NodeJS.ErrnoException;
      return {
        success: false,
        error: err.message || 'Unknown error',
        path: folderPath
      };
    }
  }

  /**
   * Rename a file or folder
   * 
   * @param oldPath - Current path of the file/folder
   * @param newPath - New path for the file/folder
   * @returns Result of the operation
   */
  async renameFile(oldPath: string, newPath: string): Promise<FileOperationResult> {
    try {
      // Validate both paths
      const sanitizedOldPath = this.validatePath(oldPath);
      const sanitizedNewPath = this.validatePath(newPath);
      
      // Check if source exists
      try {
        await fs.access(sanitizedOldPath);
      } catch {
        return {
          success: false,
          error: 'Source file/folder does not exist',
          path: sanitizedOldPath
        };
      }
      
      // Check if destination already exists
      try {
        await fs.access(sanitizedNewPath);
        return {
          success: false,
          error: 'Destination already exists',
          path: sanitizedNewPath
        };
      } catch {
        // Destination doesn't exist, which is what we want
      }
      
      // Check write permission on source
      if (!await this.checkPermission(sanitizedOldPath, 'write')) {
        throw new PermissionError(sanitizedOldPath, 'rename');
      }
      
      // Check write permission on destination parent
      if (!await this.checkParentWritePermission(sanitizedNewPath)) {
        throw new PermissionError(sanitizedNewPath, 'rename to');
      }
      
      // Perform the rename
      await fs.rename(sanitizedOldPath, sanitizedNewPath);
      
      return {
        success: true,
        path: sanitizedNewPath
      };
    } catch (error) {
      if (error instanceof PathTraversalError || error instanceof WorkspaceBoundaryError) {
        return {
          success: false,
          error: error.message,
          path: oldPath
        };
      }
      if (error instanceof PermissionError) {
        return {
          success: false,
          error: error.message,
          path: oldPath
        };
      }
      
      const err = error as NodeJS.ErrnoException;
      return {
        success: false,
        error: err.message || 'Unknown error',
        path: oldPath
      };
    }
  }

  /**
   * Delete a file with confirmation
   * 
   * @param filePath - Path to the file to delete
   * @param confirm - Confirmation callback
   * @returns Result of the operation
   */
  async deleteFile(filePath: string, confirm: ConfirmationCallback): Promise<FileOperationResult> {
    try {
      // Validate path
      const sanitizedPath = this.validatePath(filePath);
      
      // Check if file exists
      try {
        const stats = await fs.stat(sanitizedPath);
        if (stats.isDirectory()) {
          return {
            success: false,
            error: 'Path is a directory, use deleteFolder instead',
            path: sanitizedPath
          };
        }
      } catch {
        return {
          success: false,
          error: 'File does not exist',
          path: sanitizedPath
        };
      }
      
      // Check write permission
      if (!await this.checkPermission(sanitizedPath, 'write')) {
        throw new PermissionError(sanitizedPath, 'delete');
      }
      
      // Request confirmation
      const confirmed = await confirm(`Are you sure you want to delete ${path.basename(sanitizedPath)}?`);
      if (!confirmed) {
        return {
          success: false,
          error: 'Operation cancelled by user',
          path: sanitizedPath
        };
      }
      
      // Delete the file
      await fs.unlink(sanitizedPath);
      
      return {
        success: true,
        path: sanitizedPath
      };
    } catch (error) {
      if (error instanceof PathTraversalError || error instanceof WorkspaceBoundaryError) {
        return {
          success: false,
          error: error.message,
          path: filePath
        };
      }
      if (error instanceof PermissionError) {
        return {
          success: false,
          error: error.message,
          path: filePath
        };
      }
      
      const err = error as NodeJS.ErrnoException;
      return {
        success: false,
        error: err.message || 'Unknown error',
        path: filePath
      };
    }
  }

  /**
   * Delete a folder with confirmation
   * 
   * @param folderPath - Path to the folder to delete
   * @param confirm - Confirmation callback
   * @param recursive - Whether to delete contents recursively (default: false)
   * @returns Result of the operation
   */
  async deleteFolder(folderPath: string, confirm: ConfirmationCallback, recursive: boolean = false): Promise<FileOperationResult> {
    try {
      // Validate path
      const sanitizedPath = this.validatePath(folderPath);
      
      // Check if folder exists
      try {
        const stats = await fs.stat(sanitizedPath);
        if (!stats.isDirectory()) {
          return {
            success: false,
            error: 'Path is not a directory',
            path: sanitizedPath
          };
        }
      } catch {
        return {
          success: false,
          error: 'Folder does not exist',
          path: sanitizedPath
        };
      }
      
      // Check write permission
      if (!await this.checkPermission(sanitizedPath, 'write')) {
        throw new PermissionError(sanitizedPath, 'delete');
      }
      
      // Check if folder is empty (if not recursive)
      if (!recursive) {
        const contents = await fs.readdir(sanitizedPath);
        if (contents.length > 0) {
          return {
            success: false,
            error: 'Folder is not empty. Use recursive option to delete non-empty folders.',
            path: sanitizedPath
          };
        }
      }
      
      // Request confirmation
      const message = recursive
        ? `Are you sure you want to delete ${path.basename(sanitizedPath)} and all its contents?`
        : `Are you sure you want to delete ${path.basename(sanitizedPath)}?`;
      
      const confirmed = await confirm(message);
      if (!confirmed) {
        return {
          success: false,
          error: 'Operation cancelled by user',
          path: sanitizedPath
        };
      }
      
      // Delete the folder
      if (recursive) {
        await fs.rm(sanitizedPath, { recursive: true, force: false });
      } else {
        // For non-recursive deletion, use rmdir which works for empty directories
        await fs.rmdir(sanitizedPath);
      }
      
      return {
        success: true,
        path: sanitizedPath
      };
    } catch (error) {
      if (error instanceof PathTraversalError || error instanceof WorkspaceBoundaryError) {
        return {
          success: false,
          error: error.message,
          path: folderPath
        };
      }
      if (error instanceof PermissionError) {
        return {
          success: false,
          error: error.message,
          path: folderPath
        };
      }
      
      const err = error as NodeJS.ErrnoException;
      return {
        success: false,
        error: err.message || 'Unknown error',
        path: folderPath
      };
    }
  }

  /**
   * Copy a file path to the clipboard
   * 
   * Note: This method returns the absolute path as a string.
   * The actual clipboard writing should be handled by the UI layer
   * using a clipboard library like clipboardy.
   * 
   * @param filePath - Path to copy
   * @returns The absolute path to be copied to clipboard
   */
  async copyPath(filePath: string): Promise<string> {
    // Validate and get absolute path
    const sanitizedPath = this.validatePath(filePath);
    return sanitizedPath;
  }
}
