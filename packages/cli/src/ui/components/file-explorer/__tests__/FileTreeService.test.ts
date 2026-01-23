/**
 * FileTreeService Tests
 * 
 * Tests for file tree building, directory expansion, and node management
 */

import { describe, it, expect, beforeEach } from 'vitest';

import { FileTreeService } from '../FileTreeService.js';

describe('FileTreeService', () => {
  let service: FileTreeService;

  beforeEach(() => {
    service = new FileTreeService();
  });

  describe('buildTree', () => {
    it('should build a tree from a directory path', async () => {
      const rootPath = process.cwd();
      const tree = await service.buildTree({ rootPath, maxDepth: 1 });

      expect(tree).toBeDefined();
      expect(tree.type).toBe('directory');
      expect(tree.path).toBe(rootPath);
      expect(tree.children).toBeDefined();
    });

    it('should respect maxDepth parameter', async () => {
      const rootPath = process.cwd();
      const tree = await service.buildTree({ rootPath, maxDepth: 0 });

      expect(tree.children).toHaveLength(0);
    });

    it('should exclude patterns', async () => {
      const rootPath = process.cwd();
      const tree = await service.buildTree({
        rootPath,
        excludePatterns: ['node_modules', '.git'],
        maxDepth: 2,
      });

      const hasNodeModules = tree.children?.some(
        (child) => child.name === 'node_modules'
      );
      expect(hasNodeModules).toBe(false);
    });
  });

  describe('expandDirectory', () => {
    it('should expand a directory node', async () => {
      const rootPath = process.cwd();
      const tree = await service.buildTree({ rootPath, maxDepth: 1 });
      
      const dirNode = tree.children?.find((child) => child.type === 'directory');
      if (dirNode) {
        await service.expandDirectory(dirNode, []);
        expect(dirNode.expanded).toBe(true);
        expect(dirNode.children).toBeDefined();
      }
    });
  });

  describe('collapseDirectory', () => {
    it('should collapse a directory node', async () => {
      const rootPath = process.cwd();
      const tree = await service.buildTree({ rootPath, maxDepth: 1 });
      
      const dirNode = tree.children?.find((child) => child.type === 'directory');
      if (dirNode) {
        await service.expandDirectory(dirNode, []);
        service.collapseDirectory(dirNode);
        expect(dirNode.expanded).toBe(false);
      }
    });
  });

  describe('flattenTree', () => {
    it('should flatten tree to array of nodes', async () => {
      const rootPath = process.cwd();
      const tree = await service.buildTree({ rootPath, maxDepth: 1 });
      
      const flattened = service.flattenTree(tree);
      expect(Array.isArray(flattened)).toBe(true);
      expect(flattened.length).toBeGreaterThan(0);
      expect(flattened[0]).toBe(tree);
    });

    it('should include expanded children', async () => {
      const rootPath = process.cwd();
      const tree = await service.buildTree({ rootPath, maxDepth: 1 });
      
      const dirNode = tree.children?.find((child) => child.type === 'directory');
      if (dirNode) {
        await service.expandDirectory(dirNode, []);
        const flattened = service.flattenTree(tree);
        
        const hasChildren = flattened.some(
          (node) => node.path.startsWith(dirNode.path) && node !== dirNode
        );
        expect(hasChildren).toBe(true);
      }
    });
  });

  describe('getVisibleNodes', () => {
    it('should return visible window of nodes', async () => {
      const rootPath = process.cwd();
      const tree = await service.buildTree({ rootPath, maxDepth: 2 });
      
      const visible = service.getVisibleNodes(tree, {
        scrollOffset: 0,
        windowSize: 10,
      });

      expect(visible.length).toBeLessThanOrEqual(10);
    });

    it('should respect scroll offset', async () => {
      const rootPath = process.cwd();
      const tree = await service.buildTree({ rootPath, maxDepth: 2 });
      
      const visible1 = service.getVisibleNodes(tree, {
        scrollOffset: 0,
        windowSize: 5,
      });

      const visible2 = service.getVisibleNodes(tree, {
        scrollOffset: 5,
        windowSize: 5,
      });

      expect(visible1[0]).not.toBe(visible2[0]);
    });
  });
});
