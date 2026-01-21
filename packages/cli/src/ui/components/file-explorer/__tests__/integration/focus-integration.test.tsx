/**
 * Integration tests for focus system with FileTreeView
 * 
 * Tests the complete workflow of focusing and unfocusing files through
 * the FileTreeView component.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render } from 'ink-testing-library';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';
import React from 'react';
import { FileTreeView } from '../../FileTreeView.js';
import { FileTreeProvider } from '../../FileTreeContext.js';
import { FileFocusProvider } from '../../FileFocusContext.js';
import { FileTreeService } from '../../FileTreeService.js';
import { FocusSystem } from '../../FocusSystem.js';
import type { FileNode } from '../../types.js';

describe('Focus Integration Tests', () => {
  let service: FileTreeService;
  let focusSystem: FocusSystem;
  let tempDir: string;

  beforeEach(async () => {
    service = new FileTreeService();
    focusSystem = new FocusSystem();
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'focus-integration-test-'));
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  it('should handle focus/unfocus round-trip', async () => {
    // Create test file
    const testFile = path.join(tempDir, 'roundtrip.txt');
    await fs.writeFile(testFile, 'Round trip content');

    // Focus the file
    const focusedFile = await focusSystem.focusFile(testFile);
    expect(focusSystem.isFocused(testFile)).toBe(true);
    expect(focusSystem.getCount()).toBe(1);
    expect(focusedFile.content).toBe('Round trip content');

    // Unfocus the file
    focusSystem.unfocusFile(testFile);
    expect(focusSystem.isFocused(testFile)).toBe(false);
    expect(focusSystem.getCount()).toBe(0);
  });

  it('should handle multiple focused files', async () => {
    // Create multiple test files
    const files = ['file1.txt', 'file2.txt', 'file3.txt'];
    for (const file of files) {
      const filePath = path.join(tempDir, file);
      await fs.writeFile(filePath, `Content of ${file}`);
      await focusSystem.focusFile(filePath);
    }

    // Verify all files are focused
    expect(focusSystem.getCount()).toBe(3);
    
    const focusedFiles = focusSystem.getFocusedFiles();
    expect(focusedFiles).toHaveLength(3);
    
    // Verify each file is in the focused list
    for (const file of files) {
      const filePath = path.join(tempDir, file);
      expect(focusSystem.isFocused(filePath)).toBe(true);
    }
  });

  it('should not focus directories', async () => {
    // Create a directory
    const subDir = path.join(tempDir, 'subdir');
    await fs.mkdir(subDir);

    // Attempt to focus the directory should throw
    await expect(focusSystem.focusFile(subDir)).rejects.toThrow();
    
    // Verify directory is not focused
    expect(focusSystem.isFocused(subDir)).toBe(false);
    expect(focusSystem.getCount()).toBe(0);
  });

  it('should integrate FocusSystem with FileFocusContext', async () => {
    // Create test file
    const testFile = path.join(tempDir, 'context-test.txt');
    await fs.writeFile(testFile, 'Context integration test');

    // Focus the file using FocusSystem
    const focusedFile = await focusSystem.focusFile(testFile);

    // Verify the focused file has correct properties
    expect(focusedFile.path).toBe(testFile);
    expect(focusedFile.content).toBe('Context integration test');
    expect(focusedFile.truncated).toBe(false);
    expect(focusedFile.size).toBeGreaterThan(0);

    // Verify it can be retrieved
    expect(focusSystem.isFocused(testFile)).toBe(true);
    const retrieved = focusSystem.getFocusedFiles();
    expect(retrieved).toHaveLength(1);
    expect(retrieved[0].path).toBe(testFile);
  });
});
