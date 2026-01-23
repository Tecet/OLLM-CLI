/**
 * Performance tests for FileTreeService optimizations
 * 
 * These tests verify that caching optimizations work correctly
 * and provide the expected performance improvements.
 */

import { describe, it, expect, beforeEach } from 'vitest';

import { FileTreeService } from '../FileTreeService.js';

import type { FileNode } from '../types.js';

describe('FileTreeService Performance Optimizations', () => {
  let service: FileTreeService;

  beforeEach(() => {
    service = new FileTreeService();
  });

  describe('Flattened Tree Caching', () => {
    it('should cache flattened tree on first call', () => {
      // Create a simple tree
      const tree: FileNode = {
        name: 'root',
        path: '/root',
        type: 'directory',
        expanded: true,
        children: [
          { name: 'file1.txt', path: '/root/file1.txt', type: 'file' },
          { name: 'file2.txt', path: '/root/file2.txt', type: 'file' },
        ],
      };

      // First call should flatten and cache
      const result1 = service.getFlattenedTree(tree);
      expect(result1).toHaveLength(3); // root + 2 files

      // Second call should return cached result (same reference)
      const result2 = service.getFlattenedTree(tree);
      expect(result2).toBe(result1); // Same reference = cached
    });

    it('should invalidate cache on expand/collapse', () => {
      const tree: FileNode = {
        name: 'root',
        path: '/root',
        type: 'directory',
        expanded: true,
        children: [
          {
            name: 'folder',
            path: '/root/folder',
            type: 'directory',
            expanded: false,
            children: [
              { name: 'file.txt', path: '/root/folder/file.txt', type: 'file' },
            ],
          },
        ],
      };

      // Get initial flattened tree
      const result1 = service.getFlattenedTree(tree);
      expect(result1).toHaveLength(2); // root + folder (collapsed)

      // Expand the folder
      tree.children![0].expanded = true;
      service.invalidateCache();

      // Get flattened tree again - should be different reference
      const result2 = service.getFlattenedTree(tree);
      expect(result2).not.toBe(result1); // Different reference = cache invalidated
      expect(result2).toHaveLength(3); // root + folder + file
    });

    it('should track cache version', () => {
      const _tree: FileNode = {
        name: 'root',
        path: '/root',
        type: 'directory',
        expanded: true,
        children: [],
      };

      const stats1 = service.getCacheStats();
      const initialVersion = stats1.cacheVersion;

      // Invalidate cache
      service.invalidateCache();

      const stats2 = service.getCacheStats();
      expect(stats2.cacheVersion).toBe(initialVersion + 1);
    });
  });

  describe('Directory Content Caching', () => {
    it('should report cache statistics', () => {
      const tree: FileNode = {
        name: 'root',
        path: '/root',
        type: 'directory',
        expanded: true,
        children: [
          { name: 'file1.txt', path: '/root/file1.txt', type: 'file' },
          { name: 'file2.txt', path: '/root/file2.txt', type: 'file' },
        ],
      };

      // Get flattened tree to populate cache
      service.getFlattenedTree(tree);

      const stats = service.getCacheStats();
      expect(stats.flattenedCacheSize).toBe(3); // root + 2 files
      expect(stats.directoryCacheSize).toBeGreaterThanOrEqual(0);
      expect(stats.cacheVersion).toBeGreaterThanOrEqual(0);
    });

    it('should clear all caches', () => {
      const tree: FileNode = {
        name: 'root',
        path: '/root',
        type: 'directory',
        expanded: true,
        children: [
          { name: 'file.txt', path: '/root/file.txt', type: 'file' },
        ],
      };

      // Populate caches
      service.getFlattenedTree(tree);

      // Clear all caches
      service.clearAllCaches();

      const stats = service.getCacheStats();
      expect(stats.flattenedCacheSize).toBe(0);
      expect(stats.directoryCacheSize).toBe(0);
    });
  });

  describe('Virtual Scrolling with Cache', () => {
    it('should use cached flattened tree for visible nodes', () => {
      const tree: FileNode = {
        name: 'root',
        path: '/root',
        type: 'directory',
        expanded: true,
        children: Array.from({ length: 100 }, (_, i) => ({
          name: `file${i}.txt`,
          path: `/root/file${i}.txt`,
          type: 'file' as const,
        })),
      };

      // First call - should flatten and cache
      const visible1 = service.getVisibleNodes(tree, {
        scrollOffset: 0,
        windowSize: 15,
      });
      expect(visible1).toHaveLength(15);

      // Second call with different offset - should use cache
      const visible2 = service.getVisibleNodes(tree, {
        scrollOffset: 10,
        windowSize: 15,
      });
      expect(visible2).toHaveLength(15);
      expect(visible2[0].name).toBe('file9.txt'); // Offset by 10 (root is index 0)

      // Verify cache was used (same flattened tree reference)
      const stats = service.getCacheStats();
      expect(stats.flattenedCacheSize).toBe(101); // root + 100 files
    });

    it('should handle scroll offset at boundaries', () => {
      const tree: FileNode = {
        name: 'root',
        path: '/root',
        type: 'directory',
        expanded: true,
        children: Array.from({ length: 10 }, (_, i) => ({
          name: `file${i}.txt`,
          path: `/root/file${i}.txt`,
          type: 'file' as const,
        })),
      };

      // Scroll past end
      const visible1 = service.getVisibleNodes(tree, {
        scrollOffset: 100,
        windowSize: 15,
      });
      expect(visible1).toHaveLength(0); // No nodes beyond end

      // Negative scroll offset (should clamp to 0)
      const visible2 = service.getVisibleNodes(tree, {
        scrollOffset: -10,
        windowSize: 15,
      });
      expect(visible2.length).toBeGreaterThan(0); // Should show nodes from start
    });
  });

  describe('Performance Characteristics', () => {
    it('should handle large trees efficiently', () => {
      // Create a large tree (1000 nodes)
      const tree: FileNode = {
        name: 'root',
        path: '/root',
        type: 'directory',
        expanded: true,
        children: Array.from({ length: 999 }, (_, i) => ({
          name: `file${i}.txt`,
          path: `/root/file${i}.txt`,
          type: 'file' as const,
        })),
      };

      // First call - flatten and cache
      const start1 = performance.now();
      const result1 = service.getFlattenedTree(tree);
      const time1 = performance.now() - start1;

      expect(result1).toHaveLength(1000);

      // Second call - should be much faster (cached)
      const start2 = performance.now();
      const result2 = service.getFlattenedTree(tree);
      const time2 = performance.now() - start2;

      expect(result2).toBe(result1); // Same reference
      expect(time2).toBeLessThan(time1 / 10); // At least 10x faster

      console.log(`Large tree performance:
        First call (flatten): ${time1.toFixed(2)}ms
        Second call (cached): ${time2.toFixed(2)}ms
        Speedup: ${(time1 / time2).toFixed(0)}x`);
    });

    it('should handle deep nesting efficiently', () => {
      // Create a deeply nested tree (10 levels)
      let current: FileNode = {
        name: 'file.txt',
        path: '/root/a/b/c/d/e/f/g/h/i/file.txt',
        type: 'file',
      };

      for (let i = 9; i >= 0; i--) {
        const level = String.fromCharCode(97 + i); // 'a' to 'j'
        current = {
          name: i === 0 ? 'root' : level,
          path: i === 0 ? '/root' : `/root/${level}`,
          type: 'directory',
          expanded: true,
          children: [current],
        };
      }

      // Flatten the deep tree
      const result = service.getFlattenedTree(current);
      expect(result).toHaveLength(11); // 10 directories + 1 file

      // Verify cache works for deep trees
      const result2 = service.getFlattenedTree(current);
      expect(result2).toBe(result); // Same reference = cached
    });
  });

  describe('Cache Invalidation', () => {
    it('should invalidate on collapseDirectory', () => {
      const folder: FileNode = {
        name: 'folder',
        path: '/root/folder',
        type: 'directory',
        expanded: true,
        children: [
          { name: 'file.txt', path: '/root/folder/file.txt', type: 'file' },
        ],
      };

      const tree: FileNode = {
        name: 'root',
        path: '/root',
        type: 'directory',
        expanded: true,
        children: [folder],
      };

      // Get initial flattened tree
      const result1 = service.getFlattenedTree(tree);
      expect(result1).toHaveLength(3); // root + folder + file

      // Collapse the folder
      service.collapseDirectory(folder);

      // Get flattened tree again - should be different
      const result2 = service.getFlattenedTree(tree);
      expect(result2).not.toBe(result1); // Cache invalidated
      expect(result2).toHaveLength(2); // root + folder (collapsed)
    });
  });
});
