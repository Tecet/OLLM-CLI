/**
 * GitStatusService - Git integration for file status tracking
 *
 * This service provides git status information for files in the file explorer,
 * with caching to avoid excessive git calls. It handles non-git directories
 * gracefully and maps git status to color codes for the UI.
 *
 * Requirements: 8.1, 8.2, 8.3, 8.4, 8.5
 */

import * as fs from 'fs';
import * as path from 'path';

import { simpleGit, SimpleGit, StatusResult } from 'simple-git';

import { handleError } from './ErrorHandler.js';
import { GitStatus } from './types.js';

/**
 * Cache entry for git status results
 */
interface CacheEntry {
  /** Status map for files in the repository */
  statusMap: Map<string, GitStatus>;
  /** Timestamp when the cache entry was created */
  timestamp: number;
}

/**
 * GitStatusService provides git status information with caching
 */
export class GitStatusService {
  /** Cache of git status results by repository path */
  private cache: Map<string, CacheEntry> = new Map();

  /** Cache TTL in milliseconds (5 seconds) */
  private readonly CACHE_TTL = 5000;

  /** Simple-git instance cache by repository path */
  private gitInstances: Map<string, SimpleGit> = new Map();

  /** Silent mode for suppressing error logs */
  private silent: boolean = false;

  constructor(options?: { silent?: boolean }) {
    this.silent = options?.silent ?? false;
  }

  /**
   * Get git status for all files in a repository
   *
   * @param repoPath - Path to the git repository root
   * @returns Map of file paths to their git status
   *
   * Requirements: 8.1, 8.5
   */
  async getStatus(repoPath: string): Promise<Map<string, GitStatus>> {
    // Check if repository is valid
    if (!this.isGitRepository(repoPath)) {
      return new Map();
    }

    // Check cache first
    const cached = this.cache.get(repoPath);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.statusMap;
    }

    // Query git status
    try {
      const git = this.getGitInstance(repoPath);
      const status: StatusResult = await git.status();

      const statusMap = new Map<string, GitStatus>();

      // Map untracked files (new files)
      for (const file of status.not_added) {
        const fullPath = path.resolve(repoPath, file);
        statusMap.set(fullPath, 'untracked');
      }

      // Map modified files
      for (const file of status.modified) {
        const fullPath = path.resolve(repoPath, file);
        statusMap.set(fullPath, 'modified');
      }

      // Map created files (staged new files)
      for (const file of status.created) {
        const fullPath = path.resolve(repoPath, file);
        statusMap.set(fullPath, 'untracked');
      }

      // Map renamed files as modified
      for (const file of status.renamed) {
        const fullPath = path.resolve(repoPath, file.to);
        statusMap.set(fullPath, 'modified');
      }

      // Map deleted files as modified
      for (const file of status.deleted) {
        const fullPath = path.resolve(repoPath, file);
        statusMap.set(fullPath, 'modified');
      }

      // Files not in any status list are considered clean
      // We don't explicitly add them to save memory

      // Cache the result
      this.cache.set(repoPath, {
        statusMap,
        timestamp: Date.now(),
      });

      return statusMap;
    } catch (error) {
      // Handle git errors gracefully
      const errorInfo = handleError(error, {
        operation: 'getGitStatus',
        repoPath,
      });

      if (!this.silent) {
        console.error(`Failed to get git status for ${repoPath}:`, errorInfo.message);
      }

      return new Map();
    }
  }

  /**
   * Get git status for a specific file
   *
   * @param filePath - Absolute path to the file
   * @returns Git status of the file, or null if not in a git repository
   *
   * Requirements: 8.2, 8.3, 8.4
   */
  async getFileStatus(filePath: string): Promise<GitStatus | null> {
    // Find the repository root for this file
    const repoPath = await this.findGitRoot(filePath);
    if (!repoPath) {
      return null;
    }

    // Get status for the entire repository
    const statusMap = await this.getStatus(repoPath);

    // Check if file has a status
    const status = statusMap.get(filePath);
    if (status) {
      return status;
    }

    // Check if file is ignored
    if (await this.isIgnored(repoPath, filePath)) {
      return 'ignored';
    }

    // File is tracked and clean
    return 'clean';
  }

  /**
   * Clear the status cache
   *
   * This can be called after file operations to ensure fresh status
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Check if a directory is a git repository
   *
   * @param dirPath - Path to check
   * @returns True if the directory is a git repository
   *
   * Requirements: 8.1
   */
  isGitRepository(dirPath: string): boolean {
    try {
      const gitDir = path.join(dirPath, '.git');
      return fs.existsSync(gitDir);
    } catch {
      return false;
    }
  }

  /**
   * Find the git repository root for a given path
   *
   * @param filePath - Path to start searching from
   * @returns Path to the git repository root, or null if not in a repository
   */
  private async findGitRoot(filePath: string): Promise<string | null> {
    let currentPath = path.dirname(filePath);
    const root = path.parse(currentPath).root;

    while (currentPath !== root) {
      if (this.isGitRepository(currentPath)) {
        return currentPath;
      }
      currentPath = path.dirname(currentPath);
    }

    return null;
  }

  /**
   * Get or create a simple-git instance for a repository
   *
   * @param repoPath - Path to the repository
   * @returns Simple-git instance
   */
  private getGitInstance(repoPath: string): SimpleGit {
    const git = this.gitInstances.get(repoPath);
    if (git) {
      return git;
    }
    const newGit = simpleGit(repoPath);
    this.gitInstances.set(repoPath, newGit);
    return newGit;
  }

  /**
   * Check if a file is ignored by git
   *
   * @param repoPath - Path to the repository root
   * @param filePath - Absolute path to the file
   * @returns True if the file is ignored
   */
  private async isIgnored(repoPath: string, filePath: string): Promise<boolean> {
    try {
      const git = this.getGitInstance(repoPath);
      const relativePath = path.relative(repoPath, filePath);
      const result = await git.raw(['check-ignore', relativePath]);
      return result.trim().length > 0;
    } catch {
      // If check-ignore fails, assume not ignored
      return false;
    }
  }
}
