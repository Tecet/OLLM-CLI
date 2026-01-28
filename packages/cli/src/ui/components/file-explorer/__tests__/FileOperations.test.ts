/**
 * FileOperations Tests
 *
 * Tests for file CRUD operations with tool integration
 */

import { writeFileSync, mkdirSync, rmSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { FileOperations } from '../FileOperations.js';

describe('FileOperations', () => {
  let fileOps: FileOperations;
  let testDir: string;

  beforeEach(() => {
    testDir = join(tmpdir(), `fileops-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
    fileOps = new FileOperations(testDir);
  });

  afterEach(() => {
    try {
      rmSync(testDir, { recursive: true, force: true });
    } catch (_error) {
      // Ignore cleanup errors
    }
  });

  describe('createFile', () => {
    it('should create a new file', async () => {
      const fileName = 'newfile.txt';
      const content = 'Test content';
      const confirmFn = vi.fn().mockResolvedValue(true);

      const result = await fileOps.createFile(fileName, content, confirmFn);

      expect(result.success).toBe(true);
      expect(result.path).toBeDefined();
      if (result.path) {
        expect(existsSync(result.path)).toBe(true);
      }
    });

    it('should fail if file already exists', async () => {
      const fileName = 'existing.txt';
      const filePath = join(testDir, fileName);
      writeFileSync(filePath, 'Existing content');

      const confirmFn = vi.fn().mockResolvedValue(true);
      const result = await fileOps.createFile(fileName, 'New content', confirmFn);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should respect confirmation rejection', async () => {
      const confirmFn = vi.fn().mockResolvedValue(false);
      const result = await fileOps.createFile('test.txt', 'content', confirmFn);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('deleteFile', () => {
    it('should delete an existing file', async () => {
      const fileName = 'todelete.txt';
      const filePath = join(testDir, fileName);
      writeFileSync(filePath, 'Delete me');

      const confirmFn = vi.fn().mockResolvedValue(true);
      const result = await fileOps.deleteFile(fileName, confirmFn);

      expect(result.success).toBe(true);
      expect(existsSync(filePath)).toBe(false);
    });

    it('should fail for non-existent file', async () => {
      const confirmFn = vi.fn().mockResolvedValue(true);
      const result = await fileOps.deleteFile('nonexistent.txt', confirmFn);

      expect(result.success).toBe(false);
    });
  });

  describe('renameFile', () => {
    it('should rename a file', async () => {
      const oldName = 'old.txt';
      const oldPath = join(testDir, oldName);
      const newName = 'new.txt';
      writeFileSync(oldPath, 'Content');

      const result = await fileOps.renameFile(oldName, newName);

      expect(result.success).toBe(true);
      expect(existsSync(oldPath)).toBe(false);
      expect(existsSync(join(testDir, newName))).toBe(true);
    });

    it('should fail if new name already exists', async () => {
      const oldName = 'old.txt';
      const oldPath = join(testDir, oldName);
      const newPath = join(testDir, 'new.txt');
      writeFileSync(oldPath, 'Old content');
      writeFileSync(newPath, 'New content');

      const result = await fileOps.renameFile(oldName, 'new.txt');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('createFolder', () => {
    it('should create a new folder', async () => {
      const folderName = 'newfolder';
      const confirmFn = vi.fn().mockResolvedValue(true);

      const result = await fileOps.createFolder(folderName, confirmFn);

      expect(result.success).toBe(true);
      expect(result.path).toBeDefined();
      if (result.path) {
        expect(existsSync(result.path)).toBe(true);
      }
    });

    it('should fail if folder already exists', async () => {
      const folderName = 'existing';
      mkdirSync(join(testDir, folderName));

      const confirmFn = vi.fn().mockResolvedValue(true);
      const result = await fileOps.createFolder(folderName, confirmFn);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('deleteFolder', () => {
    it('should delete an empty folder', async () => {
      const folderName = 'todelete';
      const folderPath = join(testDir, folderName);
      mkdirSync(folderPath);

      const confirmFn = vi.fn().mockResolvedValue(true);
      const result = await fileOps.deleteFolder(folderName, confirmFn, false);

      expect(result.success).toBe(true);
      expect(existsSync(folderPath)).toBe(false);
    });

    it('should delete folder recursively', async () => {
      const folderName = 'parent';
      const folderPath = join(testDir, folderName);
      const childPath = join(folderPath, 'child');
      mkdirSync(childPath, { recursive: true });
      writeFileSync(join(childPath, 'file.txt'), 'content');

      const confirmFn = vi.fn().mockResolvedValue(true);
      const result = await fileOps.deleteFolder(folderName, confirmFn, true);

      expect(result.success).toBe(true);
      expect(existsSync(folderPath)).toBe(false);
    });
  });

  describe('copyPath', () => {
    it('should copy path to clipboard', async () => {
      const fileName = 'test.txt';
      const filePath = join(testDir, fileName);
      writeFileSync(filePath, 'content');

      const result = await fileOps.copyPath(fileName);

      expect(result).toContain(fileName);
    });
  });
});
