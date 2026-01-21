/**
 * Integration tests for ConfirmationDialog with FileOperations
 * 
 * Tests that the confirmation dialog correctly integrates with file operations,
 * particularly for destructive operations like delete.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import { FileOperations } from '../../FileOperations.js';

describe('ConfirmationDialog Integration with FileOperations', () => {
  let tempDir: string;
  let fileOps: FileOperations;

  beforeEach(async () => {
    // Create a temporary directory for testing
    tempDir = path.join(process.cwd(), 'test-temp-' + Date.now());
    await fs.mkdir(tempDir, { recursive: true });
    fileOps = new FileOperations(tempDir);
  });

  afterEach(async () => {
    // Clean up temporary directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Delete File with Confirmation', () => {
    it('should delete file when user confirms', async () => {
      // Create a test file
      const testFile = path.join(tempDir, 'test.txt');
      await fs.writeFile(testFile, 'test content');

      // Verify file exists
      await expect(fs.access(testFile)).resolves.toBeUndefined();

      // Mock confirmation callback that returns true (user confirms)
      const confirmCallback = vi.fn().mockResolvedValue(true);

      // Delete the file
      const result = await fileOps.deleteFile(testFile, confirmCallback);

      // Verify confirmation was requested
      expect(confirmCallback).toHaveBeenCalledWith(
        expect.stringContaining('test.txt')
      );

      // Verify deletion succeeded
      expect(result.success).toBe(true);

      // Verify file no longer exists
      await expect(fs.access(testFile)).rejects.toThrow();
    });

    it('should not delete file when user cancels', async () => {
      // Create a test file
      const testFile = path.join(tempDir, 'test.txt');
      await fs.writeFile(testFile, 'test content');

      // Verify file exists
      await expect(fs.access(testFile)).resolves.toBeUndefined();

      // Mock confirmation callback that returns false (user cancels)
      const confirmCallback = vi.fn().mockResolvedValue(false);

      // Attempt to delete the file
      const result = await fileOps.deleteFile(testFile, confirmCallback);

      // Verify confirmation was requested
      expect(confirmCallback).toHaveBeenCalledWith(
        expect.stringContaining('test.txt')
      );

      // Verify deletion was cancelled
      expect(result.success).toBe(false);
      expect(result.error).toContain('cancelled');

      // Verify file still exists
      await expect(fs.access(testFile)).resolves.toBeUndefined();
    });
  });

  describe('Delete Folder with Confirmation', () => {
    it('should delete empty folder when user confirms', async () => {
      // Create a test folder
      const testFolder = path.join(tempDir, 'test-folder');
      await fs.mkdir(testFolder);

      // Verify folder exists
      await expect(fs.access(testFolder)).resolves.toBeUndefined();

      // Mock confirmation callback that returns true (user confirms)
      const confirmCallback = vi.fn().mockResolvedValue(true);

      // Delete the folder
      const result = await fileOps.deleteFolder(testFolder, confirmCallback, false);

      // Log the result for debugging
      if (!result.success) {
        console.log('Delete failed:', result.error);
      }

      // Verify confirmation was requested
      expect(confirmCallback).toHaveBeenCalledWith(
        expect.stringContaining('test-folder')
      );

      // Verify deletion succeeded
      expect(result.success).toBe(true);

      // Verify folder no longer exists
      await expect(fs.access(testFolder)).rejects.toThrow();
    });

    it('should delete folder with contents when user confirms recursive delete', async () => {
      // Create a test folder with files
      const testFolder = path.join(tempDir, 'test-folder');
      await fs.mkdir(testFolder);
      await fs.writeFile(path.join(testFolder, 'file1.txt'), 'content1');
      await fs.writeFile(path.join(testFolder, 'file2.txt'), 'content2');

      // Verify folder exists
      await expect(fs.access(testFolder)).resolves.toBeUndefined();

      // Mock confirmation callback that returns true (user confirms)
      const confirmCallback = vi.fn().mockResolvedValue(true);

      // Delete the folder recursively
      const result = await fileOps.deleteFolder(testFolder, confirmCallback, true);

      // Verify confirmation was requested with warning about contents
      expect(confirmCallback).toHaveBeenCalledWith(
        expect.stringContaining('all its contents')
      );

      // Verify deletion succeeded
      expect(result.success).toBe(true);

      // Verify folder no longer exists
      await expect(fs.access(testFolder)).rejects.toThrow();
    });

    it('should not delete folder when user cancels', async () => {
      // Create a test folder
      const testFolder = path.join(tempDir, 'test-folder');
      await fs.mkdir(testFolder);

      // Verify folder exists
      await expect(fs.access(testFolder)).resolves.toBeUndefined();

      // Mock confirmation callback that returns false (user cancels)
      const confirmCallback = vi.fn().mockResolvedValue(false);

      // Attempt to delete the folder
      const result = await fileOps.deleteFolder(testFolder, confirmCallback, false);

      // Verify confirmation was requested
      expect(confirmCallback).toHaveBeenCalledWith(
        expect.stringContaining('test-folder')
      );

      // Verify deletion was cancelled
      expect(result.success).toBe(false);
      expect(result.error).toContain('cancelled');

      // Verify folder still exists
      await expect(fs.access(testFolder)).resolves.toBeUndefined();
    });

    it('should show appropriate message for recursive delete', async () => {
      // Create a test folder with contents
      const testFolder = path.join(tempDir, 'test-folder');
      await fs.mkdir(testFolder);
      await fs.writeFile(path.join(testFolder, 'file.txt'), 'content');

      // Mock confirmation callback
      const confirmCallback = vi.fn().mockResolvedValue(true);

      // Delete the folder recursively
      await fileOps.deleteFolder(testFolder, confirmCallback, true);

      // Verify the confirmation message mentions "all its contents"
      expect(confirmCallback).toHaveBeenCalledWith(
        expect.stringMatching(/all its contents/i)
      );
    });
  });

  describe('Confirmation Message Format', () => {
    it('should include filename in confirmation message for files', async () => {
      const testFile = path.join(tempDir, 'important-file.txt');
      await fs.writeFile(testFile, 'content');

      const confirmCallback = vi.fn().mockResolvedValue(false);
      await fileOps.deleteFile(testFile, confirmCallback);

      expect(confirmCallback).toHaveBeenCalledWith(
        expect.stringContaining('important-file.txt')
      );
    });

    it('should include folder name in confirmation message for folders', async () => {
      const testFolder = path.join(tempDir, 'important-folder');
      await fs.mkdir(testFolder);

      const confirmCallback = vi.fn().mockResolvedValue(false);
      await fileOps.deleteFolder(testFolder, confirmCallback, false);

      expect(confirmCallback).toHaveBeenCalledWith(
        expect.stringContaining('important-folder')
      );
    });
  });
});
