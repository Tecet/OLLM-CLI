/**
 * FileTreeService
 * 
 * Service for building and managing the file tree structure.
 * Handles directory traversal, tree building, expansion/collapse,
 * virtual scrolling, and exclude pattern filtering.
 * 
 * Requirements: 2.1, 9.1, 9.4
 */

import { promises as fs } from 'fs';
import * as path from 'path';
// @ts-expect-error - picomatch doesn't have type definitions
import picomatch from 'picomatch';
import type { FileNode } from './types.js';
import { handleError } from './ErrorHandler.js';

/**
 * Options for building the file tree
 */
export interface BuildTreeOptions {
  /** Root path to build tree from */
  rootPath: string;
  /** Glob patterns to exclude from the tree */
  excludePatterns?: string[];
  /** Maximum depth to traverse (default: 10) */
  maxDepth?: number;
}

/**
 * Options for getting visible nodes
 */
export interface GetVisibleNodesOptions {
  /** Starting offset for the visible window */
  scrollOffset: number;
  /** Number of items to display in the window (default: 15) */
  windowSize?: number;
}

/**
 * Service for managing file tree operations
 */
export class FileTreeService {
  private readonly DEFAULT_MAX_DEPTH = 10;
  private readonly DEFAULT_WINDOW_SIZE = 15;

  /**
   * Build a file tree from the filesystem
   * 
   * Recursively traverses the directory structure and builds a tree
   * of FileNode objects. Applies exclude patterns during traversal.
   * 
   * @param options - Build options including root path and exclude patterns
   * @returns Promise resolving to the root FileNode
   */
  async buildTree(options: BuildTreeOptions): Promise<FileNode> {
    const { rootPath, excludePatterns = [], maxDepth = this.DEFAULT_MAX_DEPTH } = options;

    // Create matcher for exclude patterns
    const isExcluded = excludePatterns.length > 0
      ? picomatch(excludePatterns)
      : () => false;

    return this.buildTreeRecursive(rootPath, isExcluded, 0, maxDepth);
  }

  /**
   * Recursive helper for building the tree
   */
  private async buildTreeRecursive(
    nodePath: string,
    isExcluded: (path: string) => boolean,
    currentDepth: number,
    maxDepth: number
  ): Promise<FileNode> {
    const stats = await fs.stat(nodePath);
    const name = path.basename(nodePath);

    // Create base node
    const node: FileNode = {
      name,
      path: nodePath,
      type: stats.isDirectory() ? 'directory' : 'file',
    };

    // If it's a directory and we haven't exceeded max depth, load children
    if (stats.isDirectory() && currentDepth < maxDepth) {
      node.expanded = false; // Directories start collapsed (lazy loading)
      node.children = []; // Empty children array, will be loaded on expand
    }

    return node;
  }

  /**
   * Expand a directory node by loading its contents
   * 
   * Loads the directory contents from the filesystem and populates
   * the children array. Applies exclude patterns during loading.
   * 
   * @param node - Directory node to expand
   * @param excludePatterns - Glob patterns to exclude
   * @param maxDepth - Maximum depth to traverse
   * @returns Promise resolving when expansion is complete
   */
  async expandDirectory(
    node: FileNode,
    excludePatterns: string[] = [],
    maxDepth: number = this.DEFAULT_MAX_DEPTH
  ): Promise<void> {
    if (node.type !== 'directory') {
      throw new Error('Cannot expand non-directory node');
    }

    if (node.expanded) {
      return; // Already expanded
    }

    // Create matcher for exclude patterns
    const isExcluded = excludePatterns.length > 0
      ? picomatch(excludePatterns)
      : () => false;

    try {
      // Read directory contents
      const entries = await fs.readdir(node.path, { withFileTypes: true });

      // Calculate current depth
      const currentDepth = this.calculateDepth(node.path);

      // Build child nodes
      const children: FileNode[] = [];
      for (const entry of entries) {
        const childPath = path.join(node.path, entry.name);

        // Skip excluded paths
        if (isExcluded(childPath) || isExcluded(entry.name)) {
          continue;
        }

        const childNode: FileNode = {
          name: entry.name,
          path: childPath,
          type: entry.isDirectory() ? 'directory' : 'file',
        };

        // If it's a directory, prepare for lazy loading
        if (entry.isDirectory() && currentDepth < maxDepth) {
          childNode.expanded = false;
          childNode.children = [];
        }

        children.push(childNode);
      }

      // Sort: directories first, then files, both alphabetically
      children.sort((a, b) => {
        if (a.type === b.type) {
          return a.name.localeCompare(b.name);
        }
        return a.type === 'directory' ? -1 : 1;
      });

      node.children = children;
      node.expanded = true;
    } catch (error) {
      // Handle permission errors or other filesystem errors
      const errorInfo = handleError(error, {
        operation: 'expandDirectory',
        nodePath: node.path,
      });
      
      console.error(`Failed to expand directory ${node.path}:`, errorInfo.message);
      
      node.children = [];
      node.expanded = false;
    }
  }

  /**
   * Collapse a directory node
   * 
   * Marks the directory as collapsed. Note: This does NOT unload
   * the children to preserve state, but the UI should not render them.
   * 
   * @param node - Directory node to collapse
   */
  collapseDirectory(node: FileNode): void {
    if (node.type !== 'directory') {
      throw new Error('Cannot collapse non-directory node');
    }

    node.expanded = false;
  }

  /**
   * Get visible nodes for virtual scrolling
   * 
   * Flattens the tree into a list of visible nodes (respecting expanded state)
   * and returns a window of nodes based on scroll offset and window size.
   * 
   * @param tree - Root node of the tree
   * @param options - Options for visible window
   * @returns Array of visible FileNode objects
   */
  getVisibleNodes(tree: FileNode, options: GetVisibleNodesOptions): FileNode[] {
    const { scrollOffset, windowSize = this.DEFAULT_WINDOW_SIZE } = options;

    // Flatten the tree to get all visible nodes
    const flatNodes = this.flattenTree(tree);

    // Return the window of visible nodes
    const start = Math.max(0, scrollOffset);
    const end = Math.min(flatNodes.length, start + windowSize);

    return flatNodes.slice(start, end);
  }

  /**
   * Get visible directories for virtual scrolling (Folders Column)
   * 
   * Flattens the tree into a list of visible directories only.
   * 
   * @param tree - Root node of the tree
   * @param options - Options for visible window
   * @returns Array of visible directory FileNode objects
   */
  getVisibleDirectories(tree: FileNode, options: GetVisibleNodesOptions): FileNode[] {
    const { scrollOffset, windowSize = this.DEFAULT_WINDOW_SIZE } = options;

    // Flatten the tree to get all visible directories
    const flatNodes = this.flattenDirectories(tree);

    // Return the window of visible nodes
    const start = Math.max(0, scrollOffset);
    const end = Math.min(flatNodes.length, start + windowSize);

    return flatNodes.slice(start, end);
  }

  /**
   * Flatten the tree into a list of visible nodes
   * 
   * Recursively traverses the tree and collects all nodes that should
   * be visible (i.e., nodes whose parents are expanded).
   * 
   * @param node - Current node
   * @param result - Accumulator for visible nodes
   * @returns Array of visible nodes
   */
  flattenTree(node: FileNode, result: FileNode[] = []): FileNode[] {
    result.push(node);

    // If the node is an expanded directory, add its children
    if (node.type === 'directory' && node.expanded && node.children) {
      for (const child of node.children) {
        this.flattenTree(child, result);
      }
    }

    return result;
  }

  /**
   * Flatten the tree into a list of visible directories only
   * 
   * @param node - Current node
   * @param result - Accumulator for visible directory nodes
   * @returns Array of visible directory nodes
   */
  flattenDirectories(node: FileNode, result: FileNode[] = []): FileNode[] {
    // Only add directories
    if (node.type === 'directory') {
      result.push(node);

      // If the node is an expanded directory, add its directory children
      if (node.expanded && node.children) {
        for (const child of node.children) {
          if (child.type === 'directory') {
            this.flattenDirectories(child, result);
          }
        }
      }
    }

    return result;
  }

  /**
   * Find a node by its path
   * 
   * Searches the tree for a node with the given path.
   * 
   * @param tree - Root node of the tree
   * @param targetPath - Path to search for
   * @returns The found node or null if not found
   */
  findNodeByPath(tree: FileNode, targetPath: string): FileNode | null {
    // Normalize paths for comparison
    const normalizedTarget = path.normalize(targetPath);
    const normalizedTreePath = path.normalize(tree.path);

    if (normalizedTreePath === normalizedTarget) {
      return tree;
    }

    // If this is a directory with children, search recursively
    if (tree.type === 'directory' && tree.children) {
      for (const child of tree.children) {
        const found = this.findNodeByPath(child, targetPath);
        if (found) {
          return found;
        }
      }
    }

    return null;
  }

  /**
   * Calculate the depth of a path
   * 
   * Helper method to determine how deep a path is in the tree.
   * 
   * @param nodePath - Path to calculate depth for
   * @returns Depth level
   */
  private calculateDepth(nodePath: string): number {
    const normalized = path.normalize(nodePath);
    const parts = normalized.split(path.sep).filter(p => p.length > 0);
    return parts.length;
  }

  /**
   * Get total count of visible nodes
   * 
   * Returns the total number of nodes that would be visible
   * if the entire tree were rendered (respecting expanded state).
   * 
   * @param tree - Root node of the tree
   * @returns Total count of visible nodes
   */
  getTotalVisibleCount(tree: FileNode): number {
    return this.flattenTree(tree).length;
  }
}
