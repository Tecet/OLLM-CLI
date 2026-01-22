/**
 * PathSanitizer - Security component for path validation and sanitization
 * 
 * This service provides path validation to prevent directory traversal attacks
 * and enforce workspace boundaries. It ensures all file operations are safe
 * and contained within allowed directories.
 * 
 * Key responsibilities:
 * - Normalize and sanitize file paths
 * - Reject path traversal sequences (../)
 * - Enforce workspace boundary restrictions
 * - Validate path safety before operations
 */

import * as path from 'path';

/**
 * Error thrown when a path traversal attempt is detected
 */
export class PathTraversalError extends Error {
  constructor(attemptedPath: string) {
    super(`Path traversal detected: ${attemptedPath}`);
    this.name = 'PathTraversalError';
  }
}

/**
 * Error thrown when a path is outside workspace boundaries
 */
export class WorkspaceBoundaryError extends Error {
  constructor(attemptedPath: string, workspaceRoot: string) {
    super(`Path outside workspace: ${attemptedPath} (workspace: ${workspaceRoot})`);
    this.name = 'WorkspaceBoundaryError';
  }
}

/**
 * PathSanitizer service for secure path validation
 */
export class PathSanitizer {
  /**
   * Sanitize and normalize a file path
   * 
   * This method:
   * 1. Checks for path traversal sequences
   * 2. Normalizes the path (resolves . and .. segments)
   * 3. Converts to absolute path
   * 
   * @param inputPath - The path to sanitize
   * @returns The sanitized absolute path
   * @throws {PathTraversalError} If path contains traversal sequences
   */
  sanitize(inputPath: string): string {
    // Handle empty string
    if (!inputPath || inputPath.trim() === '') {
      return '';
    }
    
    // First check for traversal sequences before any normalization
    this.rejectTraversal(inputPath);
    
    // Normalize the path (resolve . and .. segments, handle separators)
    const normalized = path.normalize(inputPath);
    
    // Convert to absolute path
    const absolute = path.resolve(normalized);
    
    return absolute;
  }

  /**
   * Check if a path is absolute
   * 
   * @param inputPath - The path to check
   * @returns true if the path is absolute, false otherwise
   */
  isAbsolute(inputPath: string): boolean {
    return path.isAbsolute(inputPath);
  }

  /**
   * Normalize a path (resolve . and .. segments, handle separators)
   * 
   * @param inputPath - The path to normalize
   * @returns The normalized path
   */
  normalize(inputPath: string): string {
    return path.normalize(inputPath);
  }

  /**
   * Check if a path is safe (no traversal sequences)
   * 
   * @param inputPath - The path to check
   * @returns true if the path is safe, false otherwise
   */
  isPathSafe(inputPath: string): boolean {
    // Check for explicit traversal sequences
    if (inputPath.includes('../') || inputPath.includes('..\\')) {
      return false;
    }
    
    // Check for encoded traversal attempts
    if (inputPath.includes('%2e%2e') || inputPath.includes('%2E%2E')) {
      return false;
    }
    
    // Check for path segments that are exactly '..'
    const segments = inputPath.split(/[/\\]/);
    if (segments.some(segment => segment === '..')) {
      return false;
    }
    
    return true;
  }

  /**
   * Check if a path is within workspace boundaries
   * 
   * @param inputPath - The path to check
   * @param workspaceRoot - The workspace root directory
   * @returns true if the path is within workspace, false otherwise
   */
  isWithinWorkspace(inputPath: string, workspaceRoot: string): boolean {
    try {
      // Sanitize both paths to get absolute normalized paths
      const sanitizedPath = this.sanitize(inputPath);
      const sanitizedRoot = path.resolve(workspaceRoot);
      
      // Check if the path starts with the workspace root
      // Use path.relative to check if the path is within the workspace
      const relativePath = path.relative(sanitizedRoot, sanitizedPath);
      
      // If relative path starts with '..' or is absolute, it's outside workspace
      if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
        return false;
      }
      
      return true;
    } catch {
      // If sanitize throws (e.g., due to traversal), it's not within workspace
      return false;
    }
  }

  /**
   * Reject a path if it contains traversal sequences
   * 
   * @param inputPath - The path to check
   * @throws {PathTraversalError} If path contains traversal sequences
   */
  rejectTraversal(inputPath: string): void {
    if (!this.isPathSafe(inputPath)) {
      throw new PathTraversalError(inputPath);
    }
  }

  /**
   * Validate a path for workspace mode operations
   * 
   * This combines both traversal rejection and workspace boundary checks.
   * 
   * @param inputPath - The path to validate
   * @param workspaceRoot - The workspace root directory
   * @returns The sanitized path if valid
   * @throws {PathTraversalError} If path contains traversal sequences
   * @throws {WorkspaceBoundaryError} If path is outside workspace
   */
  validateWorkspacePath(inputPath: string, workspaceRoot: string): string {
    // First sanitize the path (this will reject traversal)
    const sanitized = this.sanitize(inputPath);
    
    // Then check workspace boundaries
    try {
      if (!this.isWithinWorkspace(inputPath, workspaceRoot)) {
        throw new WorkspaceBoundaryError(sanitized, workspaceRoot);
      }
    } catch (error) {
      if (error instanceof WorkspaceBoundaryError) {
        throw error;
      }
      // If isWithinWorkspace threw for another reason, treat as boundary error
      throw new WorkspaceBoundaryError(sanitized, workspaceRoot);
    }
    
    return sanitized;
  }
}
