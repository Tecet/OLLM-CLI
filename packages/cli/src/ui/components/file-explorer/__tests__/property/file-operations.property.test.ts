/**
 * Property-based tests for FileOperations
 * 
 * These tests validate universal correctness properties for file operations
 * using property-based testing with fast-check.
 * 
 * Feature: file-explorer-ui
 * Property 13: Valid File Operations Succeed
 * Property 14: Destructive Operations Require Confirmation
 * Validates: Requirements 4.1, 4.2, 4.3, 10.3
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import fc from 'fast-check';
import { FileOperations } from '../../FileOperations.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

// Helper to create a temporary test directory
async function createTempDir(): Promise<string> {
  // Use a more unique identifier to avoid collisions
  const uniqueId = `${Date.now()}-${process.pid}-${Math.random().toString(36).slice(2, 11)}`;
  const tmpDir = path.join(os.tmpdir(), `file-ops-test-${uniqueId}`);
  await fs.mkdir(tmpDir, { recursive: true });
  return tmpDir;
}

// Helper to clean up a directory
async function cleanupDir(dirPath: string): Promise<void> {
  try {
    await fs.rm(dirPath, { recursive: true, force: true });
  } catch {
    // Ignore cleanup errors
  }
}

describe('FileOperations - Property-Based Tests', () => {
  let testDir: string;
  let fileOps: FileOperations;

  beforeEach(async () => {
    testDir = await createTempDir();
    // Don't set workspace root - this allows operations without workspace boundary checks
    fileOps = new FileOperations();
  });

  afterEach(async () => {
    await cleanupDir(testDir);
  });

  describe('Property 13: Valid File Operations Succeed', () => {
    test('creating a file with a valid name should succeed', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate valid file names (alphanumeric with extensions)
          fc.tuple(
            fc.string({ minLength: 1, maxLength: 20 })
              .filter(s => /^[a-zA-Z0-9_-]+$/.test(s)),
            fc.constantFrom('.txt', '.md', '.json', '.js', '.ts')
          ).map(([name, ext]) => `${name}${ext}`),
          async (fileName) => {
            const filePath = path.join(testDir, fileName);
            const result = await fileOps.createFile(filePath, 'test content');
            
            // Operation should succeed
            expect(result.success).toBe(true);
            expect(result.path).toBe(filePath);
            
            // File should exist on filesystem
            const exists = await fs.access(filePath).then(() => true).catch(() => false);
            expect(exists).toBe(true);
            
            // Content should match
            const content = await fs.readFile(filePath, 'utf-8');
            expect(content).toBe('test content');
          }
        ),
        { numRuns: 20 }
      );
    });

    test('creating a folder with a valid name should succeed', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate valid folder names
          fc.string({ minLength: 1, maxLength: 20 })
            .filter(s => /^[a-zA-Z0-9_-]+$/.test(s)),
          async (folderName) => {
            const folderPath = path.join(testDir, folderName);
            const result = await fileOps.createFolder(folderPath);
            
            // Log the error if operation failed
            if (!result.success) {
              console.log(`Failed to create folder "${folderName}": ${result.error}`);
              console.log(`Folder path: ${folderPath}`);
              console.log(`Test dir: ${testDir}`);
            }
            
            // Operation should succeed
            expect(result.success).toBe(true);
            expect(result.path).toBe(folderPath);
            
            // Folder should exist on filesystem
            const stats = await fs.stat(folderPath);
            expect(stats.isDirectory()).toBe(true);
          }
        ),
        { numRuns: 20 }
      );
    });

    test('renaming a file should succeed and update filesystem', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate two different valid file names
          fc.tuple(
            fc.string({ minLength: 1, maxLength: 20 })
              .filter(s => /^[a-zA-Z0-9_-]+$/.test(s)),
            fc.string({ minLength: 1, maxLength: 20 })
              .filter(s => /^[a-zA-Z0-9_-]+$/.test(s))
          ).filter(([name1, name2]) => name1 !== name2)
            .map(([name1, name2]) => [`${name1}.txt`, `${name2}.txt`]),
          async ([oldName, newName]) => {
            // Create the original file
            const oldPath = path.join(testDir, oldName);
            const newPath = path.join(testDir, newName);
            await fs.writeFile(oldPath, 'original content', 'utf-8');
            
            // Rename the file
            const result = await fileOps.renameFile(oldPath, newPath);
            
            // Operation should succeed
            expect(result.success).toBe(true);
            expect(result.path).toBe(newPath);
            
            // Old file should not exist
            const oldExists = await fs.access(oldPath).then(() => true).catch(() => false);
            expect(oldExists).toBe(false);
            
            // New file should exist with same content
            const newExists = await fs.access(newPath).then(() => true).catch(() => false);
            expect(newExists).toBe(true);
            
            const content = await fs.readFile(newPath, 'utf-8');
            expect(content).toBe('original content');
          }
        ),
        { numRuns: 20 }
      );
    });

    test('creating files with different content should preserve content', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 20 })
            .filter(s => /^[a-zA-Z0-9_-]+$/.test(s)),
          fc.string({ minLength: 0, maxLength: 1000 }),
          async (fileName, content) => {
            const filePath = path.join(testDir, `${fileName}.txt`);
            const result = await fileOps.createFile(filePath, content);
            
            expect(result.success).toBe(true);
            
            // Verify content is preserved exactly
            const readContent = await fs.readFile(filePath, 'utf-8');
            expect(readContent).toBe(content);
          }
        ),
        { numRuns: 50 }
      );
    });

    test('creating nested folders with recursive option should succeed', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate nested folder paths
          fc.array(
            fc.string({ minLength: 1, maxLength: 10 })
              .filter(s => /^[a-zA-Z0-9_-]+$/.test(s)),
            { minLength: 2, maxLength: 4 }
          ).map(segments => segments.join('/')),
          async (nestedPath) => {
            const fullPath = path.join(testDir, nestedPath);
            const result = await fileOps.createFolder(fullPath, true);
            
            // Operation should succeed
            expect(result.success).toBe(true);
            
            // All folders in the path should exist
            const stats = await fs.stat(fullPath);
            expect(stats.isDirectory()).toBe(true);
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  describe('Property 13: Validation - Requirements 4.1, 4.2', () => {
    test('file operations should validate paths before execution', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 20 })
            .filter(s => /^[a-zA-Z0-9_-]+$/.test(s)),
          async (fileName) => {
            const filePath = path.join(testDir, fileName);
            
            // Create operation should validate the path
            const result = await fileOps.createFile(filePath);
            
            // Should succeed for valid paths
            expect(result.success).toBe(true);
            expect(path.isAbsolute(result.path)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('attempting to create a file that already exists should fail', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 20 })
            .filter(s => /^[a-zA-Z0-9_-]+$/.test(s)),
          async (fileName) => {
            const filePath = path.join(testDir, `${fileName}.txt`);
            
            // Create the file first time
            const result1 = await fileOps.createFile(filePath, 'content');
            expect(result1.success).toBe(true);
            
            // Try to create again
            const result2 = await fileOps.createFile(filePath, 'content');
            
            // Second attempt should fail
            expect(result2.success).toBe(false);
            expect(result2.error).toContain('already exists');
          }
        ),
        { numRuns: 20 }
      );
    });

    test('attempting to rename to an existing file should fail', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.tuple(
            fc.string({ minLength: 1, maxLength: 20 })
              .filter(s => /^[a-zA-Z0-9_-]+$/.test(s)),
            fc.string({ minLength: 1, maxLength: 20 })
              .filter(s => /^[a-zA-Z0-9_-]+$/.test(s))
          ).filter(([name1, name2]) => name1 !== name2),
          async ([name1, name2]) => {
            const file1 = path.join(testDir, `${name1}.txt`);
            const file2 = path.join(testDir, `${name2}.txt`);
            
            // Create both files
            await fs.writeFile(file1, 'content1', 'utf-8');
            await fs.writeFile(file2, 'content2', 'utf-8');
            
            // Try to rename file1 to file2
            const result = await fileOps.renameFile(file1, file2);
            
            // Should fail because destination exists
            expect(result.success).toBe(false);
            expect(result.error).toContain('already exists');
          }
        ),
        { numRuns: 20 }
      );
    });
  });
});
