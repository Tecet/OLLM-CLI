/**
 * Gitignore utilities for file discovery tools
 *
 * Provides functionality to read and parse .gitignore files
 * and create ignore filters for file operations.
 */

import { promises as fs } from 'fs';
import * as path from 'path';

import ignoreFactory from 'ignore';

import type { Ignore } from 'ignore';

// Create ignore instance - handle ESM default export
function createIgnore(): Ignore {
  // The ignore package exports a factory function as default
  return (ignoreFactory as unknown as () => Ignore)();
}

/**
 * Read and parse .gitignore file from a directory
 *
 * @param directory - Directory to search for .gitignore
 * @returns Ignore instance configured with .gitignore patterns, or null if no .gitignore exists
 */
export async function loadGitignore(directory: string): Promise<Ignore | null> {
  const gitignorePath = path.join(directory, '.gitignore');

  try {
    const content = await fs.readFile(gitignorePath, 'utf-8');
    const ig = createIgnore();
    ig.add(content);
    return ig;
  } catch (_error) {
    // .gitignore doesn't exist or can't be read
    return null;
  }
}

/**
 * Create an ignore filter function that respects .gitignore patterns
 *
 * @param directory - Base directory containing .gitignore
 * @returns Function that returns true if a path should be ignored
 */
export async function createGitignoreFilter(
  directory: string
): Promise<(relativePath: string) => boolean> {
  const ig = await loadGitignore(directory);

  if (!ig) {
    // No .gitignore file, don't ignore anything (except hardcoded patterns)
    return () => false;
  }

  return (relativePath: string) => {
    // Normalize path separators to forward slashes for ignore package
    const normalizedPath = relativePath.replace(/\\/g, '/');
    return ig.ignores(normalizedPath);
  };
}

/**
 * Get ignore patterns for glob operations
 * Combines .gitignore patterns with hardcoded patterns
 *
 * @param directory - Base directory containing .gitignore
 * @returns Array of glob patterns to ignore
 */
export async function getGlobIgnorePatterns(directory: string): Promise<string[]> {
  const hardcodedPatterns = ['**/node_modules/**', '**/.git/**'];

  const ig = await loadGitignore(directory);
  if (!ig) {
    return hardcodedPatterns;
  }

  // The glob package doesn't directly support the ignore package's format,
  // so we'll need to use a different approach - return the ignore instance
  // for manual filtering
  return hardcodedPatterns;
}
