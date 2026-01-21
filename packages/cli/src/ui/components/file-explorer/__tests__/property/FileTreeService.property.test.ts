/**
 * Property-Based Tests for FileTreeService
 * 
 * These tests validate universal properties that should hold for all inputs
 * using fast-check for property-based testing.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';
import { FileTreeService } from '../../FileTreeService.js';

describe('FileTreeService - Property-Based Tests', () => {
  let service: FileTreeService;
  let tempDir: string;

  beforeEach(async () => {
    service = new FileTreeService();
    // Create a temporary directory for testing
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'file-tree-test-'));
  });

  afterEach(async () => {
    // Clean up temporary directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (_error) {
      // Ignore cleanup errors
    }
  });

  describe('Property 4: Virtual Scrolling Renders Only Visible Window', () => {
    /**
     * Feature: file-explorer-ui, Property 4: Virtual Scrolling Renders Only Visible Window
     * **Validates: Requirements 2.1, 9.1**
     * 
     * For any file tree with more than 15 nodes, the rendered output should contain
     * exactly 15 visible items (or fewer if the tree has fewer items), regardless
     * of total tree size.
     */
    it('should return at most windowSize items regardless of tree size', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate a number of files between 20 and 100
          fc.integer({ min: 20, max: 100 }),
          // Generate a window size between 5 and 20
          fc.integer({ min: 5, max: 20 }),
          // Generate a scroll offset
          fc.integer({ min: 0, max: 50 }),
          async (fileCount, windowSize, scrollOffset) => {
            // Create a directory with fileCount files
            const testDir = path.join(tempDir, `test-${Date.now()}-${Math.random()}`);
            await fs.mkdir(testDir, { recursive: true });

            // Create files
            for (let i = 0; i < fileCount; i++) {
              await fs.writeFile(path.join(testDir, `file${i}.txt`), 'content');
            }

            // Build tree
            const tree = await service.buildTree({ rootPath: testDir });

            // Expand the root directory to load children
            await service.expandDirectory(tree);

            // Get visible nodes
            const visibleNodes = service.getVisibleNodes(tree, {
              scrollOffset,
              windowSize,
            });

            // Calculate expected count
            const totalNodes = service.getTotalVisibleCount(tree);
            const expectedCount = Math.min(
              windowSize,
              Math.max(0, totalNodes - scrollOffset)
            );

            // Verify the visible nodes count matches expected
            expect(visibleNodes.length).toBeLessThanOrEqual(windowSize);
            expect(visibleNodes.length).toBe(expectedCount);

            // Clean up test directory
            await fs.rm(testDir, { recursive: true, force: true });
          }
        ),
        { numRuns: 20 } // Run 20 iterations
      );
    });

    it('should return fewer items when near the end of the tree', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate a small number of files
          fc.integer({ min: 5, max: 15 }),
          async (fileCount) => {
            // Create a directory with fileCount files
            const testDir = path.join(tempDir, `test-${Date.now()}-${Math.random()}`);
            await fs.mkdir(testDir, { recursive: true });

            // Create files
            for (let i = 0; i < fileCount; i++) {
              await fs.writeFile(path.join(testDir, `file${i}.txt`), 'content');
            }

            // Build tree
            const tree = await service.buildTree({ rootPath: testDir });

            // Expand the root directory to load children
            await service.expandDirectory(tree);

            // Get total count
            const totalNodes = service.getTotalVisibleCount(tree);

            // Get visible nodes with window size larger than total
            const visibleNodes = service.getVisibleNodes(tree, {
              scrollOffset: 0,
              windowSize: 100, // Much larger than tree
            });

            // Should return all nodes, not more
            expect(visibleNodes.length).toBe(totalNodes);
            expect(visibleNodes.length).toBeLessThanOrEqual(100);

            // Clean up test directory
            await fs.rm(testDir, { recursive: true, force: true });
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should handle scroll offset beyond tree size gracefully', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 5, max: 20 }),
          fc.integer({ min: 100, max: 200 }), // Offset beyond tree size
          async (fileCount, scrollOffset) => {
            // Create a directory with fileCount files
            const testDir = path.join(tempDir, `test-${Date.now()}-${Math.random()}`);
            await fs.mkdir(testDir, { recursive: true });

            // Create files
            for (let i = 0; i < fileCount; i++) {
              await fs.writeFile(path.join(testDir, `file${i}.txt`), 'content');
            }

            // Build tree
            const tree = await service.buildTree({ rootPath: testDir });

            // Expand the root directory to load children
            await service.expandDirectory(tree);

            // Get visible nodes with offset beyond tree size
            const visibleNodes = service.getVisibleNodes(tree, {
              scrollOffset,
              windowSize: 15,
            });

            // Should return empty array when offset is beyond tree
            expect(visibleNodes.length).toBe(0);

            // Clean up test directory
            await fs.rm(testDir, { recursive: true, force: true });
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should maintain consistent window size across different scroll positions', async () => {
      // Create a fixed test directory with known structure
      const testDir = path.join(tempDir, `test-consistent-${Date.now()}`);
      await fs.mkdir(testDir, { recursive: true });

      // Create 50 files
      for (let i = 0; i < 50; i++) {
        await fs.writeFile(path.join(testDir, `file${i}.txt`), 'content');
      }

      // Build and expand tree
      const tree = await service.buildTree({ rootPath: testDir });
      await service.expandDirectory(tree);

      const windowSize = 15;
      const totalNodes = service.getTotalVisibleCount(tree);

      // Test multiple scroll positions
      for (let offset = 0; offset < totalNodes - windowSize; offset += 5) {
        const visibleNodes = service.getVisibleNodes(tree, {
          scrollOffset: offset,
          windowSize,
        });

        // Should always return windowSize items when not at the end
        expect(visibleNodes.length).toBe(windowSize);
      }

      // Clean up
      await fs.rm(testDir, { recursive: true, force: true });
    });
  });

  describe('Property 34: Collapsed Directories Are Not Loaded', () => {
    /**
     * Feature: file-explorer-ui, Property 34: Collapsed Directories Are Not Loaded
     * **Validates: Requirements 9.4**
     * 
     * For any collapsed directory in the tree, its contents should not be loaded
     * into memory until it is expanded (lazy loading).
     */
    it('should not load directory contents until expanded', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate number of subdirectories
          fc.integer({ min: 3, max: 10 }),
          async (subdirCount) => {
            // Create a directory structure with subdirectories
            const testDir = path.join(tempDir, `test-lazy-${Date.now()}-${Math.random()}`);
            await fs.mkdir(testDir, { recursive: true });

            // Create subdirectories with files
            for (let i = 0; i < subdirCount; i++) {
              const subdir = path.join(testDir, `subdir${i}`);
              await fs.mkdir(subdir);
              // Add files to subdirectory
              for (let j = 0; j < 5; j++) {
                await fs.writeFile(path.join(subdir, `file${j}.txt`), 'content');
              }
            }

            // Build tree (should not load subdirectory contents)
            const tree = await service.buildTree({ rootPath: testDir });

            // Verify root is collapsed
            expect(tree.expanded).toBe(false);
            expect(tree.children).toEqual([]);

            // Expand root directory
            await service.expandDirectory(tree);

            // Verify subdirectories exist but are collapsed
            expect(tree.children).toBeDefined();
            expect(tree.children!.length).toBe(subdirCount);

            // Check each subdirectory is collapsed and has no loaded children
            for (const child of tree.children!) {
              if (child.type === 'directory') {
                expect(child.expanded).toBe(false);
                expect(child.children).toEqual([]);
              }
            }

            // Clean up test directory
            await fs.rm(testDir, { recursive: true, force: true });
          }
        ),
        { numRuns: 30 }
      );
    });

    it('should only load children when explicitly expanded', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 5, max: 15 }),
          async (fileCount) => {
            // Create a directory with a subdirectory
            const testDir = path.join(tempDir, `test-explicit-${Date.now()}-${Math.random()}`);
            await fs.mkdir(testDir, { recursive: true });

            const subdir = path.join(testDir, 'subdir');
            await fs.mkdir(subdir);

            // Add files to subdirectory
            for (let i = 0; i < fileCount; i++) {
              await fs.writeFile(path.join(subdir, `file${i}.txt`), 'content');
            }

            // Build and expand root
            const tree = await service.buildTree({ rootPath: testDir });
            await service.expandDirectory(tree);

            // Find the subdirectory node
            const subdirNode = tree.children!.find(
              (child) => child.name === 'subdir' && child.type === 'directory'
            );

            expect(subdirNode).toBeDefined();
            expect(subdirNode!.expanded).toBe(false);
            expect(subdirNode!.children).toEqual([]);

            // Now expand the subdirectory
            await service.expandDirectory(subdirNode!);

            // Verify children are now loaded
            expect(subdirNode!.expanded).toBe(true);
            expect(subdirNode!.children).toBeDefined();
            expect(subdirNode!.children!.length).toBe(fileCount);

            // Clean up test directory
            await fs.rm(testDir, { recursive: true, force: true });
          }
        ),
        { numRuns: 30 }
      );
    });

    it('should maintain collapsed state after collapse operation', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 3, max: 10 }),
          async (fileCount) => {
            // Create a directory with files
            const testDir = path.join(tempDir, `test-collapse-${Date.now()}-${Math.random()}`);
            await fs.mkdir(testDir, { recursive: true });

            for (let i = 0; i < fileCount; i++) {
              await fs.writeFile(path.join(testDir, `file${i}.txt`), 'content');
            }

            // Build tree
            const tree = await service.buildTree({ rootPath: testDir });

            // Initially collapsed
            expect(tree.expanded).toBe(false);

            // Expand
            await service.expandDirectory(tree);
            expect(tree.expanded).toBe(true);
            expect(tree.children!.length).toBe(fileCount);

            // Collapse
            service.collapseDirectory(tree);
            expect(tree.expanded).toBe(false);

            // Children should still exist (not unloaded) but marked as collapsed
            expect(tree.children!.length).toBe(fileCount);

            // Clean up test directory
            await fs.rm(testDir, { recursive: true, force: true });
          }
        ),
        { numRuns: 30 }
      );
    });

    it('should not traverse into collapsed directories when flattening', async () => {
      // Create a fixed directory structure
      const testDir = path.join(tempDir, `test-flatten-${Date.now()}`);
      await fs.mkdir(testDir, { recursive: true });

      // Create subdirectory with files
      const subdir = path.join(testDir, 'subdir');
      await fs.mkdir(subdir);
      for (let i = 0; i < 10; i++) {
        await fs.writeFile(path.join(subdir, `file${i}.txt`), 'content');
      }

      // Build and expand root
      const tree = await service.buildTree({ rootPath: testDir });
      await service.expandDirectory(tree);

      // Get visible nodes (subdirectory is collapsed)
      const visibleNodesCollapsed = service.getVisibleNodes(tree, {
        scrollOffset: 0,
        windowSize: 100,
      });

      // Should only see root and subdirectory (not files inside)
      expect(visibleNodesCollapsed.length).toBe(2); // root + subdir

      // Now expand subdirectory
      const subdirNode = tree.children!.find((c) => c.name === 'subdir');
      await service.expandDirectory(subdirNode!);

      // Get visible nodes again
      const visibleNodesExpanded = service.getVisibleNodes(tree, {
        scrollOffset: 0,
        windowSize: 100,
      });

      // Should now see root + subdir + 10 files
      expect(visibleNodesExpanded.length).toBe(12);

      // Clean up
      await fs.rm(testDir, { recursive: true, force: true });
    });
  });
});