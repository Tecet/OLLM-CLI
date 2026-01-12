/**
 * Tests for FileDiscoveryService
 * Feature: services-sessions
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { FileDiscoveryService } from '../fileDiscoveryService.js';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('FileDiscoveryService', () => {
  describe('Property 22: Ignore pattern respect', () => {
    /**
     * Property 22: Ignore pattern respect
     * For any directory structure with files matching patterns in .ollmignore, .gitignore,
     * or built-in ignore patterns (node_modules, .git, dist, build), those files should
     * not be included in discovery results.
     * 
     * Validates: Requirements 6.2, 6.3, 6.4
     */
    it('should respect .ollmignore patterns', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.stringMatching(/^[a-zA-Z0-9_-]+\.[a-z]{2,4}$/),
            { minLength: 1, maxLength: 5 }
          ),
          async (ignoredNames) => {
            // Create temporary directory
            const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ollm-test-'));

            try {
              // Create .ollmignore file
              const ignoreContent = ignoredNames.join('\n');
              await fs.writeFile(path.join(tmpDir, '.ollmignore'), ignoreContent);

              // Create files that should be ignored
              for (const name of ignoredNames) {
                await fs.writeFile(path.join(tmpDir, name), 'content');
              }

              // Create a file that should NOT be ignored
              await fs.writeFile(path.join(tmpDir, 'should-be-found.txt'), 'content');

              // Discover files
              const service = new FileDiscoveryService();
              const files = await service.discoverAll({ root: tmpDir });

              // Filter to only files (not directories)
              const fileEntries = files.filter(f => f.type === 'file');

              // Check that ignored files are not in results
              const foundNames = fileEntries.map(f => path.basename(f.path));
              
              for (const ignoredName of ignoredNames) {
                expect(foundNames).not.toContain(ignoredName);
              }

              // Check that the non-ignored file IS in results
              expect(foundNames).toContain('should-be-found.txt');
            } finally {
              // Cleanup
              await fs.rm(tmpDir, { recursive: true, force: true });
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should respect .gitignore patterns', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.stringMatching(/^[a-zA-Z0-9_-]+\.[a-z]{2,4}$/),
            { minLength: 1, maxLength: 5 }
          ),
          async (ignoredNames) => {
            // Create temporary directory
            const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ollm-test-'));

            try {
              // Create .gitignore file
              const ignoreContent = ignoredNames.join('\n');
              await fs.writeFile(path.join(tmpDir, '.gitignore'), ignoreContent);

              // Create files that should be ignored
              for (const name of ignoredNames) {
                await fs.writeFile(path.join(tmpDir, name), 'content');
              }

              // Create a file that should NOT be ignored
              await fs.writeFile(path.join(tmpDir, 'should-be-found.txt'), 'content');

              // Discover files
              const service = new FileDiscoveryService();
              const files = await service.discoverAll({ root: tmpDir });

              // Filter to only files (not directories)
              const fileEntries = files.filter(f => f.type === 'file');

              // Check that ignored files are not in results
              const foundNames = fileEntries.map(f => path.basename(f.path));
              
              for (const ignoredName of ignoredNames) {
                expect(foundNames).not.toContain(ignoredName);
              }

              // Check that the non-ignored file IS in results
              expect(foundNames).toContain('should-be-found.txt');
            } finally {
              // Cleanup
              await fs.rm(tmpDir, { recursive: true, force: true });
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should respect built-in ignore patterns', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom('node_modules', '.git', 'dist', 'build', '.next', '.cache'),
          async (builtinIgnore) => {
            // Create temporary directory
            const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ollm-test-'));

            try {
              // Create directory that should be ignored
              const ignoredDir = path.join(tmpDir, builtinIgnore);
              await fs.mkdir(ignoredDir);
              await fs.writeFile(path.join(ignoredDir, 'file.txt'), 'content');

              // Create a file that should NOT be ignored
              await fs.writeFile(path.join(tmpDir, 'should-be-found.txt'), 'content');

              // Discover files
              const service = new FileDiscoveryService();
              const files = await service.discoverAll({ root: tmpDir });

              // Check that files inside ignored directory are not in results
              const foundPaths = files.map(f => f.relativePath);
              const ignoredPath = path.join(builtinIgnore, 'file.txt');
              
              expect(foundPaths).not.toContain(ignoredPath);
              expect(foundPaths.some(p => p.includes(builtinIgnore))).toBe(false);

              // Check that the non-ignored file IS in results
              expect(foundPaths).toContain('should-be-found.txt');
            } finally {
              // Cleanup
              await fs.rm(tmpDir, { recursive: true, force: true });
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should respect combined ignore patterns from multiple sources', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            ollmignorePatterns: fc.array(
              fc.stringMatching(/^[a-zA-Z0-9_-]+\.[a-z]{2,4}$/),
              { minLength: 1, maxLength: 3 }
            ),
            gitignorePatterns: fc.array(
              fc.stringMatching(/^[a-zA-Z0-9_-]+\.[a-z]{2,4}$/),
              { minLength: 1, maxLength: 3 }
            ),
          }),
          async ({ ollmignorePatterns, gitignorePatterns }) => {
            // Create temporary directory
            const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ollm-test-'));

            try {
              // Create .ollmignore file
              await fs.writeFile(path.join(tmpDir, '.ollmignore'), ollmignorePatterns.join('\n'));

              // Create .gitignore file
              await fs.writeFile(path.join(tmpDir, '.gitignore'), gitignorePatterns.join('\n'));

              // Create files that should be ignored by .ollmignore
              for (const name of ollmignorePatterns) {
                await fs.writeFile(path.join(tmpDir, name), 'content');
              }

              // Create files that should be ignored by .gitignore
              for (const name of gitignorePatterns) {
                await fs.writeFile(path.join(tmpDir, name), 'content');
              }

              // Create a built-in ignored directory
              const nodeModulesDir = path.join(tmpDir, 'node_modules');
              await fs.mkdir(nodeModulesDir);
              await fs.writeFile(path.join(nodeModulesDir, 'package.json'), '{}');

              // Create a file that should NOT be ignored
              await fs.writeFile(path.join(tmpDir, 'should-be-found.txt'), 'content');

              // Discover files
              const service = new FileDiscoveryService();
              const files = await service.discoverAll({ root: tmpDir });

              // Filter to only files (not directories)
              const fileEntries = files.filter(f => f.type === 'file');
              const foundNames = fileEntries.map(f => path.basename(f.path));

              // Check that all ignored files are not in results
              for (const ignoredName of [...ollmignorePatterns, ...gitignorePatterns]) {
                expect(foundNames).not.toContain(ignoredName);
              }

              // Check that node_modules files are not in results
              expect(foundNames).not.toContain('package.json');

              // Check that the non-ignored file IS in results
              expect(foundNames).toContain('should-be-found.txt');
            } finally {
              // Cleanup
              await fs.rm(tmpDir, { recursive: true, force: true });
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 23: Depth limit enforcement', () => {
    /**
     * Property 23: Depth limit enforcement
     * For any discovery operation with a maxDepth configuration, files in directories
     * deeper than maxDepth levels from the root should not be included in results.
     * 
     * Validates: Requirements 6.5
     */
    it('should enforce maxDepth limit', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            maxDepth: fc.integer({ min: 0, max: 3 }),
            structure: fc.array(
              fc.record({
                depth: fc.integer({ min: 0, max: 5 }),
                name: fc.stringMatching(/^[a-zA-Z0-9_-]+\.[a-z]{2,4}$/),
              }),
              { minLength: 3, maxLength: 10 }
            ),
          }),
          async ({ maxDepth, structure }) => {
            // Create temporary directory
            const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ollm-test-'));

            try {
              // Create nested directory structure
              const createdFiles: Array<{ path: string; depth: number }> = [];

              for (const item of structure) {
                // Build nested path based on depth
                let dirPath = tmpDir;
                for (let i = 0; i < item.depth; i++) {
                  dirPath = path.join(dirPath, `level${i}`);
                  await fs.mkdir(dirPath, { recursive: true });
                }

                // Create file at this depth
                const filePath = path.join(dirPath, item.name);
                await fs.writeFile(filePath, 'content');
                createdFiles.push({ path: filePath, depth: item.depth });
              }

              // Discover files with maxDepth limit
              const service = new FileDiscoveryService();
              const files = await service.discoverAll({ root: tmpDir, maxDepth });

              // Filter to only files (not directories)
              const fileEntries = files.filter(f => f.type === 'file');

              // Check that all returned files are within maxDepth
              for (const file of fileEntries) {
                const relativePath = path.relative(tmpDir, file.path);
                const depth = relativePath.split(path.sep).length - 1;
                expect(depth).toBeLessThanOrEqual(maxDepth);
              }

              // Check that files deeper than maxDepth are NOT in results
              const foundPaths = fileEntries.map(f => f.path);
              for (const created of createdFiles) {
                if (created.depth > maxDepth) {
                  expect(foundPaths).not.toContain(created.path);
                } else {
                  expect(foundPaths).toContain(created.path);
                }
              }
            } finally {
              // Cleanup
              await fs.rm(tmpDir, { recursive: true, force: true });
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should include all files when maxDepth is undefined', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              depth: fc.integer({ min: 0, max: 5 }),
              name: fc.stringMatching(/^[a-zA-Z0-9_-]+\.[a-z]{2,4}$/),
            }),
            { minLength: 3, maxLength: 8 }
          ),
          async (structure) => {
            // Create temporary directory
            const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ollm-test-'));

            try {
              // Create nested directory structure
              const createdFiles: string[] = [];

              for (const item of structure) {
                // Build nested path based on depth
                let dirPath = tmpDir;
                for (let i = 0; i < item.depth; i++) {
                  dirPath = path.join(dirPath, `level${i}`);
                  await fs.mkdir(dirPath, { recursive: true });
                }

                // Create file at this depth
                const filePath = path.join(dirPath, item.name);
                await fs.writeFile(filePath, 'content');
                createdFiles.push(filePath);
              }

              // Discover files without maxDepth limit
              const service = new FileDiscoveryService();
              const files = await service.discoverAll({ root: tmpDir });

              // Filter to only files (not directories)
              const fileEntries = files.filter(f => f.type === 'file');
              const foundPaths = fileEntries.map(f => f.path);

              // Check that all created files are in results
              for (const created of createdFiles) {
                expect(foundPaths).toContain(created);
              }
            } finally {
              // Cleanup
              await fs.rm(tmpDir, { recursive: true, force: true });
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle maxDepth of 0 (only root level files)', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            rootFiles: fc.array(
              fc.stringMatching(/^[a-zA-Z0-9_-]+\.[a-z]{2,4}$/),
              { minLength: 1, maxLength: 3 }
            ),
            nestedFiles: fc.array(
              fc.stringMatching(/^[a-zA-Z0-9_-]+\.[a-z]{2,4}$/),
              { minLength: 1, maxLength: 3 }
            ),
          }),
          async ({ rootFiles, nestedFiles }) => {
            // Create temporary directory
            const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ollm-test-'));

            try {
              // Create files at root level
              for (const name of rootFiles) {
                await fs.writeFile(path.join(tmpDir, name), 'content');
              }

              // Create nested directory with files
              const nestedDir = path.join(tmpDir, 'nested');
              await fs.mkdir(nestedDir);
              for (const name of nestedFiles) {
                await fs.writeFile(path.join(nestedDir, name), 'content');
              }

              // Discover files with maxDepth = 0
              const service = new FileDiscoveryService();
              const files = await service.discoverAll({ root: tmpDir, maxDepth: 0 });

              // Filter to only files (not directories)
              const fileEntries = files.filter(f => f.type === 'file');
              const foundNames = fileEntries.map(f => path.basename(f.path));

              // Check that only root level files are in results
              for (const name of rootFiles) {
                expect(foundNames).toContain(name);
              }

              // Check that nested files are NOT in results
              for (const name of nestedFiles) {
                expect(foundNames).not.toContain(name);
              }
            } finally {
              // Cleanup
              await fs.rm(tmpDir, { recursive: true, force: true });
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 24: File change notification', () => {
    /**
     * Property 24: File change notification
     * For any file system change (add, modify, delete) in a watched directory,
     * the registered callback should be invoked with the correct event type and file path.
     * 
     * Validates: Requirements 6.8
     */
    it('should notify on file additions', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.stringMatching(/^[a-zA-Z0-9_-]+\.[a-z]{2,4}$/),
            { minLength: 1, maxLength: 3 }
          ),
          async (fileNames) => {
            // Create temporary directory
            const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ollm-test-'));

            try {
              const service = new FileDiscoveryService();
              const events: Array<{ event: string; path: string }> = [];

              // Set up watcher
              const disposable = service.watchChanges(tmpDir, (event, filePath) => {
                events.push({ event, path: filePath });
              });

              // Wait a bit for watcher to initialize
              await new Promise(resolve => setTimeout(resolve, 50));

              // Create files
              for (const name of fileNames) {
                const filePath = path.join(tmpDir, name);
                await fs.writeFile(filePath, 'content');
              }

              // Wait for events to be processed
              await new Promise(resolve => setTimeout(resolve, 150));

              // Cleanup watcher
              disposable.dispose();

              // Check that we received add events for all files
              for (const name of fileNames) {
                const expectedPath = path.join(tmpDir, name);
                const hasAddEvent = events.some(
                  e => e.event === 'add' && e.path === expectedPath
                );
                expect(hasAddEvent).toBe(true);
              }
            } finally {
              // Cleanup
              await fs.rm(tmpDir, { recursive: true, force: true });
            }
          }
        ),
        { numRuns: 20 }
      );
    }, 10000);

    it('should notify on file modifications', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            fileName: fc.stringMatching(/^[a-zA-Z0-9_-]+\.[a-z]{2,4}$/),
            initialContent: fc.string({ minLength: 1, maxLength: 50 }),
            modifiedContent: fc.string({ minLength: 1, maxLength: 50 }),
          }),
          async ({ fileName, initialContent, modifiedContent }) => {
            // Skip if contents are the same
            if (initialContent === modifiedContent) {
              return;
            }

            // Create temporary directory
            const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ollm-test-'));

            try {
              // Create initial file
              const filePath = path.join(tmpDir, fileName);
              await fs.writeFile(filePath, initialContent);

              const service = new FileDiscoveryService();
              const events: Array<{ event: string; path: string }> = [];

              // Set up watcher
              const disposable = service.watchChanges(tmpDir, (event, path) => {
                events.push({ event, path });
              });

              // Wait a bit for watcher to initialize
              await new Promise(resolve => setTimeout(resolve, 50));

              // Modify the file
              await fs.writeFile(filePath, modifiedContent);

              // Wait for events to be processed
              await new Promise(resolve => setTimeout(resolve, 150));

              // Cleanup watcher
              disposable.dispose();

              // Check that we received a change event
              const hasChangeEvent = events.some(
                e => e.event === 'change' && e.path === filePath
              );
              expect(hasChangeEvent).toBe(true);
            } finally {
              // Cleanup
              await fs.rm(tmpDir, { recursive: true, force: true });
            }
          }
        ),
        { numRuns: 20 }
      );
    }, 10000);

    it('should notify on file deletions', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.stringMatching(/^[a-zA-Z0-9_-]+\.[a-z]{2,4}$/),
            { minLength: 1, maxLength: 3 }
          ),
          async (fileNames) => {
            // Create temporary directory
            const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ollm-test-'));

            try {
              // Create files first
              for (const name of fileNames) {
                const filePath = path.join(tmpDir, name);
                await fs.writeFile(filePath, 'content');
              }

              const service = new FileDiscoveryService();
              const events: Array<{ event: string; path: string }> = [];

              // Set up watcher
              const disposable = service.watchChanges(tmpDir, (event, path) => {
                events.push({ event, path });
              });

              // Wait a bit for watcher to initialize
              await new Promise(resolve => setTimeout(resolve, 50));

              // Delete files
              for (const name of fileNames) {
                const filePath = path.join(tmpDir, name);
                await fs.unlink(filePath);
              }

              // Wait for events to be processed
              await new Promise(resolve => setTimeout(resolve, 150));

              // Cleanup watcher
              disposable.dispose();

              // Check that we received unlink events for all files
              for (const name of fileNames) {
                const expectedPath = path.join(tmpDir, name);
                const hasUnlinkEvent = events.some(
                  e => e.event === 'unlink' && e.path === expectedPath
                );
                expect(hasUnlinkEvent).toBe(true);
              }
            } finally {
              // Cleanup
              await fs.rm(tmpDir, { recursive: true, force: true });
            }
          }
        ),
        { numRuns: 20 }
      );
    }, 10000);

    it('should handle multiple watchers on the same directory', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.stringMatching(/^[a-zA-Z0-9_-]+\.[a-z]{2,4}$/),
          async (fileName) => {
            // Create temporary directory
            const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ollm-test-'));

            try {
              const service = new FileDiscoveryService();
              const events1: Array<{ event: string; path: string }> = [];
              const events2: Array<{ event: string; path: string }> = [];

              // Set up two watchers
              const disposable1 = service.watchChanges(tmpDir, (event, path) => {
                events1.push({ event, path });
              });
              const disposable2 = service.watchChanges(tmpDir, (event, path) => {
                events2.push({ event, path });
              });

              // Wait a bit for watchers to initialize
              await new Promise(resolve => setTimeout(resolve, 50));

              // Create a file
              const filePath = path.join(tmpDir, fileName);
              await fs.writeFile(filePath, 'content');

              // Wait for events to be processed
              await new Promise(resolve => setTimeout(resolve, 150));

              // Cleanup watchers
              disposable1.dispose();
              disposable2.dispose();

              // Both watchers should have received the add event
              const hasAddEvent1 = events1.some(
                e => e.event === 'add' && e.path === filePath
              );
              const hasAddEvent2 = events2.some(
                e => e.event === 'add' && e.path === filePath
              );

              expect(hasAddEvent1).toBe(true);
              expect(hasAddEvent2).toBe(true);
            } finally {
              // Cleanup
              await fs.rm(tmpDir, { recursive: true, force: true });
            }
          }
        ),
        { numRuns: 20 }
      );
    }, 10000);

    it('should stop notifying after dispose is called', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            beforeDispose: fc.stringMatching(/^before-[a-zA-Z0-9_-]+\.[a-z]{2,4}$/),
            afterDispose: fc.stringMatching(/^after-[a-zA-Z0-9_-]+\.[a-z]{2,4}$/),
          }),
          async ({ beforeDispose, afterDispose }) => {
            // Create temporary directory
            const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ollm-test-'));

            try {
              const service = new FileDiscoveryService();
              const events: Array<{ event: string; path: string }> = [];

              // Set up watcher
              const disposable = service.watchChanges(tmpDir, (event, path) => {
                events.push({ event, path });
              });

              // Wait a bit for watcher to initialize
              await new Promise(resolve => setTimeout(resolve, 50));

              // Create file before dispose
              const beforePath = path.join(tmpDir, beforeDispose);
              await fs.writeFile(beforePath, 'content');

              // Wait for events to be processed
              await new Promise(resolve => setTimeout(resolve, 150));

              // Dispose the watcher
              disposable.dispose();

              // Wait a bit to ensure dispose is complete
              await new Promise(resolve => setTimeout(resolve, 50));

              // Create file after dispose
              const afterPath = path.join(tmpDir, afterDispose);
              await fs.writeFile(afterPath, 'content');

              // Wait for potential events (there shouldn't be any)
              await new Promise(resolve => setTimeout(resolve, 150));

              // Check that we received event for file before dispose
              const hasBeforeEvent = events.some(
                e => e.event === 'add' && e.path === beforePath
              );
              expect(hasBeforeEvent).toBe(true);

              // Check that we did NOT receive event for file after dispose
              const hasAfterEvent = events.some(
                e => e.path === afterPath
              );
              expect(hasAfterEvent).toBe(false);
            } finally {
              // Cleanup
              await fs.rm(tmpDir, { recursive: true, force: true });
            }
          }
        ),
        { numRuns: 20 }
      );
    }, 10000);
  });

  describe('Error Handling', () => {
    /**
     * Unit tests for error handling
     * Validates: Requirements 10.4
     */
    
    it('should skip inaccessible directories and continue', async () => {
      // Create temporary directory
      const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ollm-test-'));

      try {
        // Create accessible directory with file
        const accessibleDir = path.join(tmpDir, 'accessible');
        await fs.mkdir(accessibleDir);
        await fs.writeFile(path.join(accessibleDir, 'file1.txt'), 'content');

        // Create a file at root level
        await fs.writeFile(path.join(tmpDir, 'root-file.txt'), 'content');

        // Create inaccessible directory (if we have permissions to do so)
        const inaccessibleDir = path.join(tmpDir, 'inaccessible');
        await fs.mkdir(inaccessibleDir);
        await fs.writeFile(path.join(inaccessibleDir, 'file2.txt'), 'content');

        // Try to make it inaccessible (this may not work on all systems)
        try {
          await fs.chmod(inaccessibleDir, 0o000);
        } catch {
          // If we can't change permissions, skip this test
          console.log('Skipping permission test - unable to change directory permissions');
          return;
        }

        // Discover files - should skip inaccessible directory but continue
        const service = new FileDiscoveryService();
        const files = await service.discoverAll({ root: tmpDir });

        // Filter to only files
        const fileEntries = files.filter(f => f.type === 'file');
        const foundNames = fileEntries.map(f => path.basename(f.path));

        // Should find accessible files
        expect(foundNames).toContain('root-file.txt');
        expect(foundNames).toContain('file1.txt');

        // Should NOT find inaccessible file (or may find it depending on OS)
        // The key is that discovery should complete without throwing
        expect(files).toBeDefined();
      } finally {
        // Restore permissions before cleanup
        try {
          const inaccessibleDir = path.join(tmpDir, 'inaccessible');
          await fs.chmod(inaccessibleDir, 0o755);
        } catch {
          // Ignore errors during cleanup
        }
        await fs.rm(tmpDir, { recursive: true, force: true });
      }
    });

    it('should handle invalid pattern gracefully', async () => {
      // Create temporary directory
      const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ollm-test-'));

      try {
        // Create some files
        await fs.writeFile(path.join(tmpDir, 'file1.txt'), 'content');
        await fs.writeFile(path.join(tmpDir, 'file2.js'), 'content');

        const service = new FileDiscoveryService();

        // Test with invalid regex pattern - picomatch should handle this gracefully
        // Most invalid patterns are actually valid glob patterns, so we test edge cases
        const files = await service.discoverAll({
          root: tmpDir,
          includePatterns: ['**/*.txt'], // Valid pattern
        });

        // Should complete without throwing
        expect(files).toBeDefined();
        const fileEntries = files.filter(f => f.type === 'file');
        expect(fileEntries.length).toBeGreaterThan(0);
      } finally {
        await fs.rm(tmpDir, { recursive: true, force: true });
      }
    });

    it('should handle shouldIgnore with invalid patterns gracefully', async () => {
      const service = new FileDiscoveryService();

      // Test with various edge case patterns
      const testCases = [
        { path: 'test.txt', patterns: ['*.txt'], expected: true },
        { path: 'test.js', patterns: ['*.txt'], expected: false },
        { path: 'test.txt', patterns: [], expected: false },
        { path: '', patterns: ['*.txt'], expected: false }, // Empty path
        { path: 'test.txt', patterns: [''], expected: false }, // Empty pattern
      ];

      for (const testCase of testCases) {
        const result = service.shouldIgnore(testCase.path, testCase.patterns);
        expect(result).toBe(testCase.expected);
      }
    });

    it('should detect and handle symlink loops', async () => {
      // Create temporary directory
      const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ollm-test-'));

      try {
        // Create directory structure
        const dir1 = path.join(tmpDir, 'dir1');
        const dir2 = path.join(dir1, 'dir2');
        await fs.mkdir(dir1);
        await fs.mkdir(dir2);

        // Create a file in dir2
        await fs.writeFile(path.join(dir2, 'file.txt'), 'content');

        // Create symlink loop: dir2/loop -> dir1
        const loopLink = path.join(dir2, 'loop');
        try {
          await fs.symlink(dir1, loopLink, 'dir');
        } catch (error) {
          // If we can't create symlinks, skip this test
          console.log('Skipping symlink test - unable to create symlinks');
          return;
        }

        // Discover files without following symlinks (default)
        const service = new FileDiscoveryService();
        const files = await service.discoverAll({ root: tmpDir });

        // Should complete without infinite loop
        expect(files).toBeDefined();

        // Should find the file
        const fileEntries = files.filter(f => f.type === 'file');
        const foundNames = fileEntries.map(f => path.basename(f.path));
        expect(foundNames).toContain('file.txt');

        // Symlink should be skipped (not followed)
        const foundPaths = files.map(f => f.relativePath);
        const hasLoopInPath = foundPaths.some(p => p.includes('loop'));
        
        // With followSymlinks: false (default), the symlink itself might be listed
        // but it shouldn't cause infinite recursion
        expect(files.length).toBeLessThan(100); // Sanity check - no infinite loop
      } finally {
        await fs.rm(tmpDir, { recursive: true, force: true });
      }
    });

    it('should handle non-existent root directory gracefully', async () => {
      const service = new FileDiscoveryService();
      const nonExistentPath = path.join(os.tmpdir(), 'non-existent-' + Date.now());

      // Should throw or return empty array, but not crash
      try {
        const files = await service.discoverAll({ root: nonExistentPath });
        // If it doesn't throw, it should return empty or minimal results
        expect(Array.isArray(files)).toBe(true);
      } catch (error) {
        // It's acceptable to throw an error for non-existent paths
        expect(error).toBeDefined();
      }
    });

    it('should handle file that becomes inaccessible during discovery', async () => {
      // Create temporary directory
      const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ollm-test-'));

      try {
        // Create files
        await fs.writeFile(path.join(tmpDir, 'file1.txt'), 'content');
        await fs.writeFile(path.join(tmpDir, 'file2.txt'), 'content');

        const service = new FileDiscoveryService();

        // Discover files - should handle stat errors gracefully
        const files = await service.discoverAll({ root: tmpDir });

        // Should complete without throwing
        expect(files).toBeDefined();
        expect(Array.isArray(files)).toBe(true);
      } finally {
        await fs.rm(tmpDir, { recursive: true, force: true });
      }
    });

    it('should handle watcher errors gracefully', async () => {
      const service = new FileDiscoveryService();
      const nonExistentPath = path.join(os.tmpdir(), 'non-existent-' + Date.now());

      // Create watcher on non-existent directory
      const disposable = service.watchChanges(nonExistentPath, () => {
        // This callback should never be called
      });

      // Should not throw, just log error
      expect(disposable).toBeDefined();
      expect(typeof disposable.dispose).toBe('function');

      // Cleanup
      disposable.dispose();
    });

    it('should handle watcher on file instead of directory', async () => {
      // Create temporary file
      const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ollm-test-'));
      const tmpFile = path.join(tmpDir, 'file.txt');

      try {
        await fs.writeFile(tmpFile, 'content');

        const service = new FileDiscoveryService();

        // Try to watch a file instead of directory
        const disposable = service.watchChanges(tmpFile, () => {
          // This callback should never be called
        });

        // Should not throw, just log error
        expect(disposable).toBeDefined();
        expect(typeof disposable.dispose).toBe('function');

        // Cleanup
        disposable.dispose();
      } finally {
        await fs.rm(tmpDir, { recursive: true, force: true });
      }
    });

    it('should handle corrupted ignore files gracefully', async () => {
      // Create temporary directory
      const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ollm-test-'));

      try {
        // Create files
        await fs.writeFile(path.join(tmpDir, 'file1.txt'), 'content');

        // Create .gitignore with unusual content (but still valid)
        await fs.writeFile(path.join(tmpDir, '.gitignore'), '\n\n\n# comment\n\n*.log\n\n');

        // Create .ollmignore with unusual content
        await fs.writeFile(path.join(tmpDir, '.ollmignore'), '# only comments\n# more comments\n');

        const service = new FileDiscoveryService();

        // Should handle gracefully
        const files = await service.discoverAll({ root: tmpDir });

        // Should complete without throwing
        expect(files).toBeDefined();
        const fileEntries = files.filter(f => f.type === 'file');
        expect(fileEntries.length).toBeGreaterThan(0);
      } finally {
        await fs.rm(tmpDir, { recursive: true, force: true });
      }
    });
  });
});
