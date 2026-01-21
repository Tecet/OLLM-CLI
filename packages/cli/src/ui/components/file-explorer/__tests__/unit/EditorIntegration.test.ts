/**
 * Unit tests for EditorIntegration
 * 
 * These tests validate specific examples and edge cases for external editor
 * integration, including fallback behavior and file reloading.
 */

import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { EditorIntegration } from '../../EditorIntegration.js';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

/**
 * Helper function to create a temporary directory
 */
function createTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'editor-unit-test-'));
}

/**
 * Helper function to clean up a directory recursively
 */
function cleanupDir(dirPath: string): void {
  if (fs.existsSync(dirPath)) {
    fs.rmSync(dirPath, { recursive: true, force: true });
  }
}

/**
 * Helper function to create a test file with specific content
 */
function createTestFile(dir: string, filename: string, content: string): string {
  const filePath = path.join(dir, filename);
  fs.writeFileSync(filePath, content, 'utf-8');
  return filePath;
}

describe('EditorIntegration - Unit Tests', () => {
  let tempDir: string;
  let editorIntegration: EditorIntegration;
  let originalEditor: string | undefined;

  beforeEach(() => {
    tempDir = createTempDir();
    editorIntegration = new EditorIntegration();
    originalEditor = process.env.EDITOR;
  });

  afterEach(() => {
    cleanupDir(tempDir);
    // Restore original $EDITOR
    if (originalEditor !== undefined) {
      process.env.EDITOR = originalEditor;
    } else {
      delete process.env.EDITOR;
    }
  });

  describe('getEditorCommand()', () => {
    /**
     * Test that nano is used when $EDITOR is not set on Unix
     * Requirements: 5.2
     */
    test('should fall back to nano on Unix when $EDITOR is not set', () => {
      // Skip on Windows
      if (os.platform() === 'win32') {
        return;
      }

      delete process.env.EDITOR;
      const command = editorIntegration.getEditorCommand();
      expect(command).toBe('nano');
    });

    /**
     * Test that notepad is used when $EDITOR is not set on Windows
     * Requirements: 5.2
     */
    test('should fall back to notepad on Windows when $EDITOR is not set', () => {
      // Skip on non-Windows
      if (os.platform() !== 'win32') {
        return;
      }

      delete process.env.EDITOR;
      const command = editorIntegration.getEditorCommand();
      expect(command).toBe('notepad');
    });

    /**
     * Test that $EDITOR is respected when set
     * Requirements: 5.1
     */
    test('should use $EDITOR when set', () => {
      process.env.EDITOR = 'vim';
      const command = editorIntegration.getEditorCommand();
      expect(command).toBe('vim');
    });

    /**
     * Test that whitespace is trimmed from $EDITOR
     */
    test('should trim whitespace from $EDITOR', () => {
      process.env.EDITOR = '  emacs  ';
      const command = editorIntegration.getEditorCommand();
      expect(command).toBe('emacs');
    });

    /**
     * Test that empty $EDITOR falls back to platform default
     */
    test('should fall back to platform default when $EDITOR is empty', () => {
      process.env.EDITOR = '';
      const command = editorIntegration.getEditorCommand();
      
      const currentPlatform = os.platform();
      if (currentPlatform === 'win32') {
        expect(command).toBe('notepad');
      } else {
        expect(command).toBe('nano');
      }
    });

    /**
     * Test that whitespace-only $EDITOR falls back to platform default
     */
    test('should fall back to platform default when $EDITOR is whitespace only', () => {
      process.env.EDITOR = '   ';
      const command = editorIntegration.getEditorCommand();
      
      const currentPlatform = os.platform();
      if (currentPlatform === 'win32') {
        expect(command).toBe('notepad');
      } else {
        expect(command).toBe('nano');
      }
    });
  });

  describe('reloadFile()', () => {
    /**
     * Test that file content is reloaded correctly
     * Requirements: 5.3
     */
    test('should reload file content after editing', async () => {
      const originalContent = 'Original content';
      const filePath = createTestFile(tempDir, 'test.txt', originalContent);

      // Reload the file
      const content = await editorIntegration.reloadFile(filePath);
      expect(content).toBe(originalContent);

      // Modify the file
      const newContent = 'Modified content';
      fs.writeFileSync(filePath, newContent, 'utf-8');

      // Reload again
      const reloadedContent = await editorIntegration.reloadFile(filePath);
      expect(reloadedContent).toBe(newContent);
    });

    /**
     * Test that reloadFile throws on non-existent file
     */
    test('should throw error when file does not exist', async () => {
      const nonExistentPath = path.join(tempDir, 'nonexistent.txt');
      
      await expect(editorIntegration.reloadFile(nonExistentPath)).rejects.toThrow(/Failed to reload file/);
    });

    /**
     * Test that reloadFile validates path safety
     */
    test('should reject unsafe paths', async () => {
      const unsafePath = '../../../etc/passwd';
      
      await expect(editorIntegration.reloadFile(unsafePath)).rejects.toThrow(/Unsafe file path/);
    });

    /**
     * Test that reloadFile handles empty files
     */
    test('should handle empty files', async () => {
      const filePath = createTestFile(tempDir, 'empty.txt', '');
      
      const content = await editorIntegration.reloadFile(filePath);
      expect(content).toBe('');
    });

    /**
     * Test that reloadFile handles large files
     */
    test('should handle large files', async () => {
      const largeContent = 'x'.repeat(10000);
      const filePath = createTestFile(tempDir, 'large.txt', largeContent);
      
      const content = await editorIntegration.reloadFile(filePath);
      expect(content).toBe(largeContent);
      expect(content.length).toBe(10000);
    });

    /**
     * Test that reloadFile handles files with special characters
     */
    test('should handle files with special characters', async () => {
      const specialContent = 'Hello\nWorld\r\n\tTab\0Null';
      const filePath = createTestFile(tempDir, 'special.txt', specialContent);
      
      const content = await editorIntegration.reloadFile(filePath);
      expect(content).toBe(specialContent);
    });
  });

  describe('openInEditor()', () => {
    /**
     * Test that openInEditor validates path safety
     */
    test('should reject unsafe paths', async () => {
      const unsafePath = '../../../etc/passwd';
      
      await expect(editorIntegration.openInEditor(unsafePath)).rejects.toThrow(/Unsafe file path/);
    });

    /**
     * Test that openInEditor accepts valid paths
     */
    test('should accept valid file paths', async () => {
      const filePath = createTestFile(tempDir, 'test.txt', 'content');
      
      // Mock the editor to exit immediately
      process.env.EDITOR = process.platform === 'win32' ? 'cmd /c exit 0' : 'true';
      
      const result = await editorIntegration.openInEditor(filePath);
      expect(result).toBeDefined();
      expect(result.success).toBeDefined();
      expect(result.exitCode).toBeDefined();
    });
  });
});
