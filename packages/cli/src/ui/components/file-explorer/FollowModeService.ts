/**
 * FollowModeService
 *
 * Service for detecting LLM-referenced file paths in chat messages
 * and automatically expanding the file tree to show those files.
 *
 * Requirements: 7.5 (Follow Mode automatic expansion)
 */

import * as path from 'path';

/**
 * Pattern to match file paths in text
 *
 * Matches:
 * - Absolute paths: /path/to/file.ts, C:\path\to\file.ts
 * - Relative paths: ./path/to/file.ts, ../path/to/file.ts, src/file.ts
 * - Paths with spaces: /path/to/my file.ts
 * - Common file extensions
 *
 * The pattern looks for:
 * 1. Positive lookbehind for start of string or whitespace (including after punctuation)
 * 2. Optional leading ./ or ../ or drive letter or absolute path
 * 3. Path segments separated by / or \
 * 4. File name with extension
 * 5. Positive lookahead for whitespace, punctuation, or end of string
 */
const FILE_PATH_PATTERN =
  /(?<=^|\s)((\.\.?\/|[a-zA-Z]:[\\/]|\/)?[^\s:*?"<>|`]+\.[a-zA-Z0-9]+)(?=\s|,|;|:|\.(?=\s|$)|$)/g;

/**
 * Common file extensions to validate detected paths
 */
const COMMON_EXTENSIONS = new Set([
  // Programming languages
  'ts',
  'tsx',
  'js',
  'jsx',
  'py',
  'java',
  'cpp',
  'c',
  'h',
  'hpp',
  'go',
  'rs',
  'rb',
  'php',
  'swift',
  'kt',
  'cs',
  'scala',
  'sh',

  // Web
  'html',
  'css',
  'scss',
  'sass',
  'less',
  'vue',
  'svelte',

  // Config
  'json',
  'yaml',
  'yml',
  'toml',
  'xml',
  'ini',
  'conf',
  'config',

  // Documentation
  'md',
  'markdown',
  'txt',
  'rst',
  'adoc',

  // Data
  'csv',
  'sql',
  'graphql',
  'proto',

  // Images
  'png',
  'jpg',
  'jpeg',
  'gif',
  'svg',
  'webp',
  'ico',

  // Other
  'lock',
  'log',
  'env',
  'gitignore',
  'dockerignore',
]);

/**
 * Options for detecting file paths
 */
export interface DetectFilePathsOptions {
  /** Root path to resolve relative paths against */
  rootPath?: string;
  /** Only return paths that exist within this root */
  filterByRoot?: boolean;
}

/**
 * Service for Follow Mode functionality
 */
export class FollowModeService {
  /**
   * Detect file paths referenced in text
   *
   * Scans text for file path patterns and returns a list of
   * normalized absolute paths.
   *
   * @param text - Text to scan for file paths
   * @param options - Detection options
   * @returns Array of detected file paths
   */
  detectFilePaths(text: string, options: DetectFilePathsOptions = {}): string[] {
    const { rootPath, filterByRoot = false } = options;
    const detectedPaths = new Set<string>();

    // Reset regex state
    FILE_PATH_PATTERN.lastIndex = 0;

    let match;
    while ((match = FILE_PATH_PATTERN.exec(text)) !== null) {
      // Group 1 contains the full path (without leading/trailing whitespace)
      const rawPath = match[1].trim();

      // Validate the extension
      const ext = path.extname(rawPath).substring(1).toLowerCase();
      if (!COMMON_EXTENSIONS.has(ext)) {
        continue;
      }

      // Normalize the path
      let normalizedPath: string;

      if (path.isAbsolute(rawPath)) {
        normalizedPath = path.normalize(rawPath);
      } else if (rootPath) {
        // Resolve relative paths against root
        normalizedPath = path.normalize(path.resolve(rootPath, rawPath));
      } else {
        // Skip relative paths if no root is provided
        continue;
      }

      // Filter by root if requested
      if (filterByRoot && rootPath) {
        // Normalize root path for comparison
        const normalizedRoot = path.normalize(path.resolve(rootPath));

        // Check if the normalized path starts with the normalized root
        // Use case-insensitive comparison on Windows
        const pathLower = normalizedPath.toLowerCase();
        const rootLower = normalizedRoot.toLowerCase();

        if (!pathLower.startsWith(rootLower)) {
          continue;
        }
      }

      detectedPaths.add(normalizedPath);
    }

    return Array.from(detectedPaths);
  }

  /**
   * Extract file paths from LLM response
   *
   * Specialized method for extracting file paths from LLM responses,
   * which may include code blocks, markdown formatting, etc.
   *
   * @param llmResponse - LLM response text
   * @param options - Detection options
   * @returns Array of detected file paths
   */
  extractFromLLMResponse(llmResponse: string, options: DetectFilePathsOptions = {}): string[] {
    // Remove code blocks to avoid false positives
    const withoutCodeBlocks = llmResponse.replace(/```[\s\S]*?```/g, ' ');

    // Remove inline code to avoid false positives
    // Use a more careful regex that doesn't remove surrounding text
    const withoutInlineCode = withoutCodeBlocks.replace(/`[^`\n]+`/g, ' ');

    return this.detectFilePaths(withoutInlineCode, options);
  }

  /**
   * Check if a path should trigger Follow Mode expansion
   *
   * Validates that a path is suitable for Follow Mode expansion.
   *
   * @param filePath - Path to validate
   * @param rootPath - Root path to check against
   * @returns True if the path should trigger expansion
   */
  shouldExpandToPath(filePath: string, rootPath: string): boolean {
    const normalizedPath = path.normalize(path.resolve(filePath));
    const normalizedRoot = path.normalize(path.resolve(rootPath));

    // Path must be within the root (case-insensitive on Windows)
    const pathLower = normalizedPath.toLowerCase();
    const rootLower = normalizedRoot.toLowerCase();

    if (!pathLower.startsWith(rootLower)) {
      return false;
    }

    // Path must have a valid extension
    const ext = path.extname(normalizedPath).substring(1).toLowerCase();
    if (!COMMON_EXTENSIONS.has(ext)) {
      return false;
    }

    return true;
  }
}
