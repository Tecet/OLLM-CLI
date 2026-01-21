/**
 * Property-based tests for EditorIntegration
 * 
 * These tests validate universal properties that should hold for the editor
 * integration system using fast-check for property-based testing.
 * 
 * Feature: file-explorer-ui
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import fc from 'fast-check';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { EditorIntegration } from '../../EditorIntegration.js';
import { PathSanitizer } from '../../PathSanitizer.js';

/**
 * Helper function to create a temporary directory
 */
function createTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'editor-test-'));
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
  // Sanitize filename for Windows tests: strip directory parts and
  // replace characters invalid in NTFS filenames so fast-check generated
  // random strings don't cause ENOENT when used as filenames.
  let base = path.basename(filename);
  if (!base || base === '.' || base === '..') base = 'file';
  // Replace invalid characters conservatively: allow only alphanumerics, dot, underscore, and dash.
  // Trim trailing dots/spaces (Windows forbids them) and truncate to keep names reasonable.
  let cleaned = base.replace(/[^a-zA-Z0-9._-]/g, '_');
  cleaned = cleaned.replace(/[\. ]+$/g, '');
  if (!cleaned) cleaned = 'file';
  const truncated = cleaned.slice(0, 60);
  const uniqueSuffix = Math.random().toString(36).slice(2, 8);
  const safeName = `file-${uniqueSuffix}-${truncated}`;
  const filePath = path.join(dir, safeName);

  // Ensure directory exists
  fs.mkdirSync(dir, { recursive: true });

  // Write the file and verify it exists; retry a few times in case of transient FS issues
  let lastErr: any = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      // Use open/close to ensure file is created atomically, then write
      const fd = fs.openSync(filePath, 'w');
      fs.closeSync(fd);
      fs.writeFileSync(filePath, content, 'utf-8');
      if (fs.existsSync(filePath)) return filePath;
    } catch (err) {
      lastErr = err;
    }
  }

  // If still failing, surface the last error to help debugging
  if (lastErr) throw lastErr;
  return filePath;
}

/**
 * Safe write helper: attempts to write, recreates parent dir if missing,
 * and retries to mitigate transient ENOENTs seen on Windows in CI.
 */
function safeWriteFileSync(filePath: string, data: string) {
  try {
    fs.writeFileSync(filePath, data, 'utf-8');
    return;
  } catch (err: any) {
    if (err && err.code === 'ENOENT') {
      // Ensure parent dir exists and retry
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, data, 'utf-8');
      return;
    }
    throw err;
  }
}

describe('EditorIntegration - Property Tests', () => {
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

  /**
   * Property 18: Editor Integration Spawns Correct Editor
   * 
   * For any file and $EDITOR environment variable value, opening the file for
   * editing should spawn the editor specified in $EDITOR.
   * 
   * Validates: Requirements 5.1
   */
  test('Property 18: Editor Integration Spawns Correct Editor', () => {
    fc.assert(
      fc.property(
        // Generate valid editor commands (simple command names)
        fc.constantFrom('nano', 'vim', 'vi', 'emacs', 'code', 'notepad'),
        (editorCommand) => {
          // Set $EDITOR environment variable
          process.env.EDITOR = editorCommand;

          // Get the editor command
          const command = editorIntegration.getEditorCommand();

          // The command should match the $EDITOR value
          expect(command).toBe(editorCommand);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 18b: Editor Command Respects $EDITOR Environment Variable
   * 
   * When $EDITOR is set, getEditorCommand should return that value.
   * When $EDITOR is not set, it should return platform default.
   */
  test('Property 18b: Editor Command Respects $EDITOR Environment Variable', () => {
    fc.assert(
      fc.property(
        fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }),
        (editorValue) => {
          if (editorValue !== undefined && editorValue.trim()) {
            // Set $EDITOR
            process.env.EDITOR = editorValue;
            const command = editorIntegration.getEditorCommand();
            expect(command).toBe(editorValue.trim());
          } else {
            // Unset $EDITOR
            delete process.env.EDITOR;
            const command = editorIntegration.getEditorCommand();
            
            // Should return platform default
            const currentPlatform = os.platform();
            if (currentPlatform === 'win32') {
              expect(command).toBe('notepad');
            } else {
              expect(command).toBe('nano');
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 18c: Editor Integration Validates Path Safety
   * 
   * For any unsafe path (containing traversal sequences), openInEditor
   * should reject the path and throw an error.
   */
  test('Property 18c: Editor Integration Validates Path Safety', () => {
    fc.assert(
      fc.property(
        // Generate paths with traversal sequences
        fc.string().filter(s => s.includes('../')),
        async (unsafePath) => {
          // Attempting to open an unsafe path should throw
          await expect(editorIntegration.openInEditor(unsafePath)).rejects.toThrow(/Unsafe file path/);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 18d: Editor Integration Handles Valid File Paths
   * 
   * For any valid file path within the temp directory, the editor integration
   * should accept it without throwing path validation errors.
   */
  test('Property 18d: Editor Integration Handles Valid File Paths', () => {
    fc.assert(
      fc.property(
        fc.hexaString({ minLength: 1, maxLength: 20 }),
        fc.string({ minLength: 1, maxLength: 100 }),
        async (filename, content) => {
          // Create a test file
          const filePath = createTestFile(tempDir, filename, content);

          // Mock the editor to exit immediately
          process.env.EDITOR = process.platform === 'win32' ? 'cmd /c exit 0' : 'true';

          // Opening the file should not throw path validation errors
          const result = await editorIntegration.openInEditor(filePath);
          
          // The operation should complete (success or failure depends on editor)
          expect(result).toBeDefined();
          expect(result.exitCode).toBeDefined();
        }
      ),
      { numRuns: 50 } // Reduced runs since we're spawning processes
    );
  });

  /**
   * Property 19: File Content Is Reloaded After Editing
   * 
   * For any file edited externally, the file content should be reloaded after
   * the editor exits, reflecting any changes made.
   * 
   * Validates: Requirements 5.3
   */
  test('Property 19: File Content Is Reloaded After Editing', () => {
    fc.assert(
      fc.property(
        fc.hexaString({ minLength: 1, maxLength: 20 }),
        fc.string({ minLength: 0, maxLength: 1000 }),
        fc.string({ minLength: 0, maxLength: 1000 }),
        async (filename, originalContent, modifiedContent) => {
          // Create a test file with original content
          const filePath = createTestFile(tempDir, filename, originalContent);

          // Reload the file - should get original content
          const reloadedOriginal = await editorIntegration.reloadFile(filePath);
          expect(reloadedOriginal).toBe(originalContent);

          // Simulate editing by modifying the file
          safeWriteFileSync(filePath, modifiedContent);

          // Reload the file again - should get modified content
          const reloadedModified = await editorIntegration.reloadFile(filePath);
          expect(reloadedModified).toBe(modifiedContent);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 19b: File Reload Preserves Content Exactly
   * 
   * For any file content, reloading the file should return exactly the same
   * content that was written to disk (round-trip property).
   */
  test('Property 19b: File Reload Preserves Content Exactly', () => {
    fc.assert(
      fc.property(
        fc.hexaString({ minLength: 1, maxLength: 20 }),
        fc.string({ minLength: 0, maxLength: 5000 }),
        async (filename, content) => {
          // Create a test file
          const filePath = createTestFile(tempDir, filename, content);

          // Reload the file
          const reloadedContent = await editorIntegration.reloadFile(filePath);

          // Content should match exactly (round-trip)
          expect(reloadedContent).toBe(content);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 19c: File Reload Handles Multiple Edits
   * 
   * For any sequence of file edits, reloading should always return the
   * most recent content.
   */
  test('Property 19c: File Reload Handles Multiple Edits', () => {
    fc.assert(
      fc.property(
        fc.hexaString({ minLength: 1, maxLength: 20 }),
        fc.array(fc.string({ minLength: 0, maxLength: 500 }), { minLength: 1, maxLength: 10 }),
        async (filename, contentSequence) => {
          // Create initial file
          const filePath = createTestFile(tempDir, filename, '');

          // Apply each edit and verify reload
          for (const content of contentSequence) {
            safeWriteFileSync(filePath, content);
            const reloaded = await editorIntegration.reloadFile(filePath);
            expect(reloaded).toBe(content);
          }
        }
      ),
      { numRuns: 50 } // Reduced runs since we're doing multiple operations
    );
  });
});
