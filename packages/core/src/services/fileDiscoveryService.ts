/**
 * FileDiscoveryService - Fast project file scanning with ignore pattern support
 * 
 * Responsibilities:
 * - Traverse directories asynchronously with depth limits
 * - Respect .ollmignore and .gitignore patterns
 * - Apply built-in ignore patterns (node_modules, .git, etc.)
 * - Cache discovery results for performance
 * - Watch for file system changes
 */

import { promises as fs } from 'fs';
import * as fsSync from 'fs';
import * as path from 'path';

import { fdir } from 'fdir';
import ignoreFactory from 'ignore';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - picomatch doesn't have types
import picomatch from 'picomatch';

import { sanitizeErrorMessage } from './errorSanitization.js';

import type {
  FileEntry,
  DiscoveryOptions,
  Disposable,
  FileChangeEvent,
} from './types.js';
import type { Ignore } from 'ignore';

/**
 * Configuration options for FileDiscoveryService
 */
export interface FileDiscoveryServiceConfig {
  maxDepth?: number;
  followSymlinks?: boolean;
  builtinIgnores?: string[];
}

/**
 * Default configuration values
 */
const DEFAULT_CONFIG: Required<FileDiscoveryServiceConfig> = {
  maxDepth: 10,
  followSymlinks: false,
  builtinIgnores: ['node_modules', '.git', 'dist', 'build', '.next', '.cache'],
};

/**
 * Create ignore instance - handle ESM default export
 */
function createIgnore(): Ignore {
  return (ignoreFactory as unknown as () => Ignore)();
}

/**
 * FileDiscoveryService implementation
 */
export class FileDiscoveryService {
  private config: Required<FileDiscoveryServiceConfig>;
  private ignoreCache: Map<string, Ignore>;

  constructor(config: FileDiscoveryServiceConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.ignoreCache = new Map();
  }

  /**
   * Discover files asynchronously (async iterable)
   */
  async *discover(options: DiscoveryOptions): AsyncIterable<FileEntry> {
    const files = await this.discoverAll(options);
    for (const file of files) {
      yield file;
    }
  }

  /**
   * Discover all files at once
   */
  async discoverAll(options: DiscoveryOptions): Promise<FileEntry[]> {
    const {
      root,
      maxDepth = this.config.maxDepth,
      includePatterns,
      excludePatterns,
      followSymlinks = this.config.followSymlinks,
    } = options;

    // Load ignore patterns and get the ignore instance
    await this.loadIgnorePatterns(root);
    const ig = this.ignoreCache.get(root);

    // Build fdir crawler with basic configuration
    const crawler = new fdir()
      .withFullPaths()
      .withDirs()
      .crawl(root);

    // Get all paths
    const paths = (await crawler.withPromise()) as string[];

    // Filter and convert to FileEntry
    const entries: FileEntry[] = [];

    for (const fullPath of paths) {
      const relativePath = path.relative(root, fullPath);

      // Calculate depth
      const depth = relativePath.split(path.sep).length - 1;
      if (maxDepth !== undefined && maxDepth >= 0 && depth > maxDepth) {
        continue;
      }

      // Check if should be ignored using the ignore instance
      if (ig) {
        const normalizedPath = relativePath.replace(/\\/g, '/');
        if (normalizedPath && normalizedPath.trim() !== '' && ig.ignores(normalizedPath)) {
          continue;
        }
      }

      // Apply include patterns if specified
      if (includePatterns && includePatterns.length > 0) {
        const matcher = picomatch(includePatterns);
        if (!matcher(relativePath)) {
          continue;
        }
      }

      // Apply exclude patterns if specified
      if (excludePatterns && excludePatterns.length > 0) {
        const matcher = picomatch(excludePatterns);
        if (matcher(relativePath)) {
          continue;
        }
      }

      // Get file stats
      try {
        const stats = await fs.lstat(fullPath); // Use lstat to detect symlinks

        // Skip symlinks if not following them
        if (!followSymlinks && stats.isSymbolicLink()) {
          continue;
        }

        entries.push({
          path: fullPath,
          relativePath,
          type: stats.isDirectory() ? 'directory' : 'file',
          size: stats.size,
          modified: stats.mtime,
        });
      } catch (_error) {
        // Skip files we can't stat (permission errors, etc.)
        continue;
      }
    }

    return entries;
  }

  /**
   * Watch for file system changes
   * 
   * Uses Node.js fs.watch to monitor file system changes in the specified directory.
   * The callback is invoked with the event type and file path when changes are detected.
   */
  watchChanges(
    root: string,
    callback: (event: FileChangeEvent, filePath: string) => void
  ): Disposable {
    let watcher: fsSync.FSWatcher | null = null;
    let isDisposed = false;

    // Start watching asynchronously
    (async () => {
      try {
        // Verify the root directory exists
        const stats = await fs.stat(root);
        if (!stats.isDirectory()) {
          // Only log error if not in a test environment
          if (process.env.NODE_ENV !== 'test' && !process.env.VITEST) {
            console.error(`Cannot watch ${sanitizeErrorMessage(root)}: not a directory`);
          }
          return;
        }

        // Create the watcher
        watcher = fsSync.watch(
          root,
          { recursive: true },
          (eventType, filename) => {
            if (isDisposed || !filename) {
              return;
            }

            // Convert Node.js event types to our FileChangeEvent types
            let event: FileChangeEvent;
            if (eventType === 'rename') {
              // 'rename' can mean add or delete - we'll check if file exists
              const fullPath = path.join(root, filename);
              fs.access(fullPath)
                .then(() => {
                  // File exists, so it was added
                  callback('add', fullPath);
                })
                .catch(() => {
                  // File doesn't exist, so it was deleted
                  callback('unlink', fullPath);
                });
              return;
            } else if (eventType === 'change') {
              event = 'change';
            } else {
              // Unknown event type, default to 'change'
              event = 'change';
            }

            const fullPath = path.join(root, filename);
            callback(event, fullPath);
          }
        );

        // Handle watcher errors
        watcher.on('error', (error) => {
          const errorMessage = error instanceof Error ? error.message : String(error);
          console.error(`File watcher error for ${sanitizeErrorMessage(root)}:`, sanitizeErrorMessage(errorMessage));
        });
      } catch (error) {
        // Only log error if not in a test environment
        if (process.env.NODE_ENV !== 'test' && !process.env.VITEST) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          console.error(`Failed to start file watcher for ${sanitizeErrorMessage(root)}:`, sanitizeErrorMessage(errorMessage));
        }
      }
    })();

    return {
      dispose: () => {
        isDisposed = true;
        if (watcher) {
          watcher.close();
          watcher = null;
        }
      },
    };
  }

  /**
   * Load ignore patterns from .ollmignore and .gitignore files
   */
  async loadIgnorePatterns(root: string): Promise<void> {
    // Check cache first
    const cached = this.ignoreCache.get(root);
    if (cached) {
      return;
    }

    // Create new ignore instance
    const ig = createIgnore();

    // Add built-in ignores
    ig.add(this.config.builtinIgnores);

    // Load .ollmignore
    const ollmignorePath = path.join(root, '.ollmignore');
    try {
      const content = await fs.readFile(ollmignorePath, 'utf-8');
      ig.add(content);
    } catch {
      // File doesn't exist or can't be read, continue
    }

    // Load .gitignore
    const gitignorePath = path.join(root, '.gitignore');
    try {
      const content = await fs.readFile(gitignorePath, 'utf-8');
      ig.add(content);
    } catch {
      // File doesn't exist or can't be read, continue
    }

    // Cache the ignore instance
    this.ignoreCache.set(root, ig);
  }

  /**
   * Check if a path should be ignored
   */
  shouldIgnore(relativePath: string, patterns: string[]): boolean {
    // Get ignore instance from cache or create new one
    const ig = createIgnore();
    ig.add(patterns);

    // Normalize path separators to forward slashes
    const normalizedPath = relativePath.replace(/\\/g, '/');

    // The ignore library doesn't accept empty paths, so return false for empty paths
    if (!normalizedPath || normalizedPath.trim() === '') {
      return false;
    }

    return ig.ignores(normalizedPath);
  }
}
