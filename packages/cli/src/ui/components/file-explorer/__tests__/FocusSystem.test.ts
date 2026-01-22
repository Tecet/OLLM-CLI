/**
 * FocusSystem Tests
 * 
 * Tests for file focusing, unfocusing, and focus management
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FocusSystem } from '../FocusSystem.js';
import { writeFileSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('FocusSystem', () => {
  let focusSystem: FocusSystem;
  let testDir: string;
  let testFile: string;

  beforeEach(() => {
    focusSystem = new FocusSystem();
    
    // Create temporary test directory and file
    testDir = join(tmpdir(), `focus-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
    testFile = join(testDir, 'test.txt');
    writeFileSync(testFile, 'Test content for focusing');
  });

  afterEach(() => {
    // Cleanup
    try {
      rmSync(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('focusFile', () => {
    it('should focus a file and return FocusedFile', async () => {
      const focused = await focusSystem.focusFile(testFile);

      expect(focused).toBeDefined();
      expect(focused.path).toBe(testFile);
      expect(focused.content).toBe('Test content for focusing');
      expect(focused.size).toBeGreaterThan(0);
      expect(focused.truncated).toBe(false);
    });

    it('should truncate large files', async () => {
      // Create a large file
      const largeContent = 'x'.repeat(200 * 1024); // 200KB
      const largeFile = join(testDir, 'large.txt');
      writeFileSync(largeFile, largeContent);

      const focused = await focusSystem.focusFile(largeFile);

      expect(focused.truncated).toBe(true);
      expect(focused.content.length).toBeLessThan(largeContent.length);
    });

    it('should throw error for non-existent file', async () => {
      const nonExistent = join(testDir, 'does-not-exist.txt');

      await expect(focusSystem.focusFile(nonExistent)).rejects.toThrow();
    });

    it('should add file to focused files map', async () => {
      await focusSystem.focusFile(testFile);

      const focused = focusSystem.getFocusedFilesMap();
      expect(focused.size).toBe(1);
      expect(focused.has(testFile)).toBe(true);
    });
  });

  describe('unfocusFile', () => {
    it('should remove file from focused files', async () => {
      await focusSystem.focusFile(testFile);
      expect(focusSystem.isFocused(testFile)).toBe(true);

      focusSystem.unfocusFile(testFile);
      expect(focusSystem.isFocused(testFile)).toBe(false);
    });

    it('should handle unfocusing non-focused file', () => {
      expect(() => focusSystem.unfocusFile(testFile)).not.toThrow();
    });
  });

  describe('isFocused', () => {
    it('should return true for focused file', async () => {
      await focusSystem.focusFile(testFile);
      expect(focusSystem.isFocused(testFile)).toBe(true);
    });

    it('should return false for non-focused file', () => {
      expect(focusSystem.isFocused(testFile)).toBe(false);
    });
  });

  describe('getFocusedFiles', () => {
    it('should return empty map initially', () => {
      const focused = focusSystem.getFocusedFilesMap();
      expect(focused.size).toBe(0);
    });

    it('should return all focused files', async () => {
      const file2 = join(testDir, 'test2.txt');
      writeFileSync(file2, 'Test content 2');

      await focusSystem.focusFile(testFile);
      await focusSystem.focusFile(file2);

      const focused = focusSystem.getFocusedFilesMap();
      expect(focused.size).toBe(2);
    });
  });

  describe('clearAllFocused', () => {
    it('should clear all focused files', async () => {
      await focusSystem.focusFile(testFile);
      expect(focusSystem.getFocusedFilesMap().size).toBe(1);

      focusSystem.clearAllFocused();
      expect(focusSystem.getFocusedFilesMap().size).toBe(0);
    });
  });

  describe('getTotalFocusedSize', () => {
    it('should return total size of focused files', async () => {
      const file2 = join(testDir, 'test2.txt');
      writeFileSync(file2, 'More content');

      await focusSystem.focusFile(testFile);
      await focusSystem.focusFile(file2);

      const totalSize = focusSystem.getTotalFocusedSize();
      expect(totalSize).toBeGreaterThan(0);
    });

    it('should return 0 when no files focused', () => {
      expect(focusSystem.getTotalFocusedSize()).toBe(0);
    });
  });
});
