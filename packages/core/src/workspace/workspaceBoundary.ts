/**
 * Workspace Boundary Service
 * 
 * Restricts LLM file access to:
 * 1. User-defined workspace (project directory)
 * 2. OLLM data directories (sessions, snapshots, config, etc.)
 * 
 * Prevents access to system directories and sensitive files.
 */

import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
// Import centralized error class
import { WorkspaceBoundaryError } from '../errors/index.js';

/**
 * Workspace boundary configuration
 */
export interface WorkspaceBoundaryConfig {
  /** Absolute path to workspace directory */
  workspacePath: string;
  
  /** Allow access to subdirectories */
  allowSubdirectories: boolean;
  
  /** Allowed OLLM data paths (relative to ~/.ollm) */
  allowedOllmPaths: string[];
  
  /** Blocked path patterns (regex) */
  blockedPatterns: RegExp[];
  
  /** Enforce strict boundary checking */
  enforceStrict: boolean;
}

/**
 * Workspace information for LLM
 */
/**
 * Workspace information for LLM
 */
export interface WorkspaceInfo {
  workspacePath: string;
  ollmDataPath: string;
  allowedOllmPaths: string[];
  restrictions: string[];
}

/**
 * Default blocked path patterns
 */
const DEFAULT_BLOCKED_PATTERNS = [
  // Windows system directories
  /^[A-Z]:\\Windows\\/i,
  /^[A-Z]:\\Program Files/i,
  /^[A-Z]:\\Program Files \(x86\)/i,
  
  // Linux/Mac system directories
  /^\/etc\//,
  /^\/sys\//,
  /^\/proc\//,
  /^\/dev\//,
  /^\/boot\//,
  /^\/root\//,
  
  // Sensitive directories (any platform)
  /\.ssh[/\\]/,
  /\.aws[/\\]/,
  /\.kube[/\\]/,
  /\.docker[/\\]/,
  /\.gnupg[/\\]/,
];

/**
 * Default OLLM data paths
 */
const DEFAULT_OLLM_PATHS = [
  'sessions',
  'context-snapshots',
  'config',
  'cache',
  'templates',
  'memory',
  'settings',
];

/**
 * Workspace boundary service
 */
export class WorkspaceBoundary {
  private config: WorkspaceBoundaryConfig;
  private ollmDataPath: string;
  private normalizedWorkspace: string;
  private normalizedOllmPath: string;

  constructor(config: Partial<WorkspaceBoundaryConfig> = {}) {
    // Get OLLM data path
    this.ollmDataPath = path.join(os.homedir(), '.ollm');
    
    // Default configuration
    this.config = {
      workspacePath: config.workspacePath || process.cwd(),
      allowSubdirectories: config.allowSubdirectories ?? true,
      allowedOllmPaths: config.allowedOllmPaths || DEFAULT_OLLM_PATHS,
      blockedPatterns: config.blockedPatterns || DEFAULT_BLOCKED_PATTERNS,
      enforceStrict: config.enforceStrict ?? true,
    };
    
    // Normalize paths for comparison (handle case sensitivity on Windows)
    this.normalizedWorkspace = this.normalizePath(this.config.workspacePath);
    this.normalizedOllmPath = this.normalizePath(this.ollmDataPath);
  }

  /**
   * Normalize path for comparison
   * - Resolve to absolute path
   * - Normalize separators
   * - Lowercase on Windows for case-insensitive comparison
   */
  private normalizePath(inputPath: string): string {
    const resolved = path.resolve(inputPath);
    const normalized = path.normalize(resolved);
    
    // Lowercase on Windows for case-insensitive comparison
    return process.platform === 'win32' 
      ? normalized.toLowerCase() 
      : normalized;
  }

  /**
   * Check if path matches any blocked pattern
   */
  private isBlocked(normalizedPath: string): boolean {
    return this.config.blockedPatterns.some(pattern => pattern.test(normalizedPath));
  }

  /**
   * Check if path is within workspace
   */
  private isInWorkspace(normalizedPath: string): boolean {
    if (!this.config.allowSubdirectories) {
      // Only allow direct children of workspace
      const parent = path.dirname(normalizedPath);
      return this.normalizePath(parent) === this.normalizedWorkspace;
    }
    
    // Allow workspace and all subdirectories
    return normalizedPath === this.normalizedWorkspace || 
           normalizedPath.startsWith(this.normalizedWorkspace + path.sep);
  }

  /**
   * Check if path is within allowed OLLM data directories
   */
  private isInOllmData(normalizedPath: string): boolean {
    // Check if path is in .ollm directory
    if (normalizedPath !== this.normalizedOllmPath && 
        !normalizedPath.startsWith(this.normalizedOllmPath + path.sep)) {
      return false;
    }
    
    // Get relative path from .ollm
    const relativePath = path.relative(this.ollmDataPath, normalizedPath);
    const firstSegment = relativePath.split(path.sep)[0];
    
    // Check if first segment is in allowed paths
    return this.config.allowedOllmPaths.includes(firstSegment);
  }

  /**
   * Check if path is allowed
   */
  isPathAllowed(inputPath: string): boolean {
    try {
      const normalized = this.normalizePath(inputPath);
      
      // Check blocked patterns first
      if (this.isBlocked(normalized)) {
        return false;
      }
      
      // Check if in workspace or OLLM data
      return this.isInWorkspace(normalized) || this.isInOllmData(normalized);
    } catch (_error) {
      // If path resolution fails, deny access
      return false;
    }
  }

  /**
   * Resolve path to absolute path
   */
  resolvePath(inputPath: string): string {
    // If already absolute, use as-is
    if (path.isAbsolute(inputPath)) {
      return path.resolve(inputPath);
    }
    
    // Resolve relative to workspace
    return path.resolve(this.config.workspacePath, inputPath);
  }

  /**
   * Validate path and return resolved absolute path
   * Throws WorkspaceBoundaryError if path is not allowed
   */
  async validatePath(inputPath: string): Promise<string> {
    // Resolve to absolute path
    const resolved = this.resolvePath(inputPath);
    
    // Check if path is allowed
    if (!this.isPathAllowed(resolved)) {
      const allowedPaths = [
        `Workspace: ${this.config.workspacePath}`,
        `OLLM Data: ${this.ollmDataPath}`,
      ];
      
      throw new WorkspaceBoundaryError(
        `Access denied: Path outside workspace boundary`,
        resolved,
        this.config.workspacePath,
        allowedPaths
      );
    }
    
    // If enforcing strict mode, resolve symlinks and check again
    if (this.config.enforceStrict) {
      try {
        const realPath = await fs.realpath(resolved);
        
        if (!this.isPathAllowed(realPath)) {
          const allowedPaths = [
            `Workspace: ${this.config.workspacePath}`,
            `OLLM Data: ${this.ollmDataPath}`,
          ];
          
          throw new WorkspaceBoundaryError(
            `Access denied: Symlink target outside workspace boundary`,
            realPath,
            this.config.workspacePath,
            allowedPaths
          );
        }
        
        return realPath;
      } catch (error) {
        // If realpath fails (file doesn't exist), that's okay
        // We'll validate the path itself
        const nodeError = error as NodeJS.ErrnoException;
        if (nodeError.code !== 'ENOENT') {
          throw error;
        }
      }
    }
    
    return resolved;
  }

  /**
   * Get workspace information for LLM
   */
  getWorkspaceInfo(): WorkspaceInfo {
    return {
      workspacePath: this.config.workspacePath,
      ollmDataPath: this.ollmDataPath,
      allowedOllmPaths: this.config.allowedOllmPaths.map(p => 
        path.join(this.ollmDataPath, p)
      ),
      restrictions: [
        'Cannot access system directories (Windows, Program Files, /etc, etc.)',
        'Cannot access sensitive directories (.ssh, .aws, .kube, etc.)',
        'Cannot access files outside workspace and OLLM data directories',
      ],
    };
  }

  /**
   * Change workspace (requires validation)
   */
  async setWorkspace(newPath: string): Promise<void> {
    // Resolve and validate new workspace path
    const resolved = path.resolve(newPath);
    
    // Check if path exists and is a directory
    try {
      const stats = await fs.stat(resolved);
      if (!stats.isDirectory()) {
        throw new Error(`Path is not a directory: ${newPath}`);
      }
    } catch (error) {
      const nodeError = error as NodeJS.ErrnoException;
      if (nodeError.code === 'ENOENT') {
        throw new Error(`Directory does not exist: ${newPath}`);
      }
      throw error;
    }
    
    // Update workspace path
    this.config.workspacePath = resolved;
    this.normalizedWorkspace = this.normalizePath(resolved);
  }

  /**
   * Get current workspace path
   */
  getWorkspacePath(): string {
    return this.config.workspacePath;
  }

  /**
   * Get OLLM data path
   */
  getOllmDataPath(): string {
    return this.ollmDataPath;
  }
}

/**
 * Create a new workspace boundary instance
 */
export function createWorkspaceBoundary(config?: Partial<WorkspaceBoundaryConfig>): WorkspaceBoundary {
  return new WorkspaceBoundary(config);
}
