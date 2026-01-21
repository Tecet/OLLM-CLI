/**
 * Property-based tests for FocusSystem
 * 
 * These tests validate universal properties that should hold for the focus
 * system using fast-check for property-based testing.
 * 
 * Feature: file-explorer-ui
 */

import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import React from 'react';
import { render } from 'ink-testing-library';
import { FocusSystem } from '../../FocusSystem.js';
import { FocusedFilesPanel } from '../../FocusedFilesPanel.js';
import { FileFocusProvider } from '../../FileFocusContext.js';
import type { FocusedFile } from '../../types.js';

/**
 * Maximum file size for focus (8KB)
 */
const MAX_FILE_SIZE = 8 * 1024;

/**
 * Helper function to create a temporary directory
 */
function createTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'focus-test-'));
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

/**
 * Arbitrary generator for file content (small files)
 */
const smallFileContentArbitrary = fc.string({ minLength: 0, maxLength: 1024 });

/**
 * Arbitrary generator for file content (large files > 8KB)
 */
const largeFileContentArbitrary = fc.string({ minLength: MAX_FILE_SIZE + 1, maxLength: MAX_FILE_SIZE + 5000 });

describe('FocusSystem - Property Tests', () => {
  let tempDirs: string[] = [];

  beforeEach(() => {
    tempDirs = [];
  });

  afterEach(() => {
    // Clean up all temporary directories
    tempDirs.forEach(dir => cleanupDir(dir));
  });

  /**
   * Property 8: Focusing a File Adds It to Focus List
   * 
   * For any file path, focusing it should add it to the focused files list
   * with a 📌 indicator visible in the UI.
   * 
   * Validates: Requirements 3.1
   */
  test('Property 8: Focusing a File Adds It to Focus List', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 5 }),
        smallFileContentArbitrary,
        async (numFiles, content) => {
          // Create temp directory
          const tempDir = createTempDir();
          tempDirs.push(tempDir);

          // Create test files
          const filePaths: string[] = [];
          for (let i = 0; i < numFiles; i++) {
            const filePath = createTestFile(tempDir, `test-${i}.txt`, content);
            filePaths.push(filePath);
          }

          // Create focus system
          const focusSystem = new FocusSystem();

          // Initially, no files should be focused
          expect(focusSystem.getFocusedFiles()).toHaveLength(0);
          expect(focusSystem.getCount()).toBe(0);

          // Focus each file
          for (const filePath of filePaths) {
            await focusSystem.focusFile(filePath);
            expect(focusSystem.isFocused(filePath)).toBe(true);
          }

          // Verify all files are in the focus list
          const focusedFiles = focusSystem.getFocusedFiles();
          expect(focusedFiles).toHaveLength(numFiles);
          expect(focusSystem.getCount()).toBe(numFiles);

          // Verify each file is present
          for (const filePath of filePaths) {
            const focused = focusedFiles.find(f => f.path === filePath);
            expect(focused).toBeDefined();
            expect(focused?.content).toBe(content);
            expect(focused?.truncated).toBe(false);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 9: Large Files Are Truncated at 8KB
   * 
   * For any file larger than 8KB, focusing it should result in the content
   * being truncated to 8KB and the truncated flag being set to true.
   * 
   * Validates: Requirements 3.2
   */
  test('Property 9: Large Files Are Truncated at 8KB', async () => {
    await fc.assert(
      fc.asyncProperty(
        largeFileContentArbitrary,
        async (content) => {
          // Create temp directory
          const tempDir = createTempDir();
          tempDirs.push(tempDir);

          // Create a large test file
          const filePath = createTestFile(tempDir, 'large-file.txt', content);
          const originalSize = Buffer.from(content, 'utf-8').length;

          // Create focus system
          const focusSystem = new FocusSystem();

          // Focus the large file
          const focusedFile = await focusSystem.focusFile(filePath);

          // Verify truncation
          expect(focusedFile.truncated).toBe(true);
          expect(focusedFile.size).toBe(originalSize);
          expect(Buffer.from(focusedFile.content, 'utf-8').length).toBeLessThanOrEqual(MAX_FILE_SIZE);

          // Verify the file is in the focus list
          expect(focusSystem.isFocused(filePath)).toBe(true);
          const focusedFiles = focusSystem.getFocusedFiles();
          expect(focusedFiles).toHaveLength(1);
          expect(focusedFiles[0].truncated).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 10: Focused File Content Is Injected Into Prompts
   * 
   * For any set of focused files, generating an LLM prompt should result in
   * the prompt containing the content of all focused files.
   * 
   * Validates: Requirements 3.3
   */
  test('Property 10: Focused File Content Is Injected Into Prompts', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 3 }),
        fc.string({ minLength: 10, maxLength: 100 }),
        fc.string({ minLength: 10, maxLength: 100 }),
        async (numFiles, fileContent, userPrompt) => {
          // Create temp directory
          const tempDir = createTempDir();
          tempDirs.push(tempDir);

          // Create test files
          const filePaths: string[] = [];
          for (let i = 0; i < numFiles; i++) {
            const filePath = createTestFile(tempDir, `test-${i}.txt`, `${fileContent}-${i}`);
            filePaths.push(filePath);
          }

          // Create focus system
          const focusSystem = new FocusSystem();

          // Focus all files
          for (const filePath of filePaths) {
            await focusSystem.focusFile(filePath);
          }

          // Inject into prompt
          const injectedPrompt = focusSystem.injectIntoPrompt(userPrompt);

          // Verify the prompt contains focused files section
          expect(injectedPrompt).toContain('## Focused Files');
          expect(injectedPrompt).toContain('## User Prompt');
          expect(injectedPrompt).toContain(userPrompt);

          // Verify each file's content is present
          for (let i = 0; i < numFiles; i++) {
            const filePath = filePaths[i];
            const content = `${fileContent}-${i}`;
            
            expect(injectedPrompt).toContain(`### File: ${filePath}`);
            expect(injectedPrompt).toContain(content);
          }

          // Verify structure: focused files come before user prompt
          const focusedIndex = injectedPrompt.indexOf('## Focused Files');
          const promptIndex = injectedPrompt.indexOf('## User Prompt');
          expect(focusedIndex).toBeLessThan(promptIndex);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 11: Focus Then Unfocus Removes File
   * 
   * For any file, focusing it and then immediately unfocusing it should result
   * in the file not being in the focused files list (round-trip property).
   * 
   * Validates: Requirements 3.4
   */
  test('Property 11: Focus Then Unfocus Removes File', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 5 }),
        smallFileContentArbitrary,
        async (numFiles, content) => {
          // Create temp directory
          const tempDir = createTempDir();
          tempDirs.push(tempDir);

          // Create test files
          const filePaths: string[] = [];
          for (let i = 0; i < numFiles; i++) {
            const filePath = createTestFile(tempDir, `test-${i}.txt`, content);
            filePaths.push(filePath);
          }

          // Create focus system
          const focusSystem = new FocusSystem();

          // Focus all files
          for (const filePath of filePaths) {
            await focusSystem.focusFile(filePath);
          }

          // Verify all files are focused
          expect(focusSystem.getCount()).toBe(numFiles);

          // Unfocus all files
          for (const filePath of filePaths) {
            focusSystem.unfocusFile(filePath);
          }

          // Verify no files are focused (round-trip)
          expect(focusSystem.getCount()).toBe(0);
          expect(focusSystem.getFocusedFiles()).toHaveLength(0);

          // Verify each file is not focused
          for (const filePath of filePaths) {
            expect(focusSystem.isFocused(filePath)).toBe(false);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 37: File Content Is Sanitized Before LLM Injection
   * 
   * For any file content being injected into an LLM prompt, the content should
   * be sanitized to prevent prompt injection attacks.
   * 
   * Validates: Requirements 10.5
   */
  test('Property 37: File Content Is Sanitized Before LLM Injection', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 10, maxLength: 500 }),
        async (baseContent) => {
          // Create temp directory
          const tempDir = createTempDir();
          tempDirs.push(tempDir);

          // Create content with potentially dangerous characters
          const dangerousContent = `${baseContent}\0null-byte\r\nwindows-line-ending\rmac-line-ending`;
          const filePath = createTestFile(tempDir, 'dangerous.txt', dangerousContent);

          // Create focus system
          const focusSystem = new FocusSystem();

          // Focus the file
          const focusedFile = await focusSystem.focusFile(filePath);

          // Verify null bytes are removed
          expect(focusedFile.content).not.toContain('\0');

          // Verify line endings are normalized to \n
          expect(focusedFile.content).not.toContain('\r\n');
          expect(focusedFile.content).not.toContain('\r');

          // Verify the content is still readable
          expect(focusedFile.content).toContain(baseContent);

          // Inject into prompt and verify sanitization persists
          const injectedPrompt = focusSystem.injectIntoPrompt('test prompt');
          expect(injectedPrompt).not.toContain('\0');
          expect(injectedPrompt).toContain(baseContent);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Additional test: Empty prompt with no focused files
   */
  test('Empty prompt with no focused files returns original prompt', () => {
    const focusSystem = new FocusSystem();
    const originalPrompt = 'test prompt';
    const result = focusSystem.injectIntoPrompt(originalPrompt);
    
    expect(result).toBe(originalPrompt);
    expect(result).not.toContain('## Focused Files');
  });

  /**
   * Additional test: Truncation warning appears for large files
   */
  test('Truncation warning appears in injected prompt for large files', async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);

    // Create a large file
    const largeContent = 'x'.repeat(MAX_FILE_SIZE + 1000);
    const filePath = createTestFile(tempDir, 'large.txt', largeContent);

    const focusSystem = new FocusSystem();
    await focusSystem.focusFile(filePath);

    const injectedPrompt = focusSystem.injectIntoPrompt('test');
    
    expect(injectedPrompt).toContain('*Note: File truncated at');
    expect(injectedPrompt).toContain('original size:');
  });

  /**
   * Property 12: All Focused Files Appear in Context Panel
   * 
   * For any set of focused files, the context panel should display all of them
   * with their paths and focus indicators.
   * 
   * Validates: Requirements 3.5
   */
  test('Property 12: All Focused Files Appear in Context Panel', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 10 }),
        fc.string({ minLength: 10, maxLength: 500 }),
        async (numFiles, content) => {
          // Create temp directory
          const tempDir = createTempDir();
          tempDirs.push(tempDir);

          // Create test files with unique names
          const filePaths: string[] = [];
          const focusedFilesMap = new Map<string, FocusedFile>();
          let totalSize = 0;

          for (let i = 0; i < numFiles; i++) {
            const filename = `test-file-${i}.txt`;
            const fileContent = `${content}-${i}`;
            const filePath = createTestFile(tempDir, filename, fileContent);
            filePaths.push(filePath);

            const focusedFile: FocusedFile = {
              path: filePath,
              content: fileContent,
              truncated: false,
              size: Buffer.from(fileContent, 'utf-8').length,
            };

            focusedFilesMap.set(filePath, focusedFile);
            totalSize += focusedFile.size;
          }

          // Render the FocusedFilesPanel with the focused files
          const { lastFrame } = render(
            React.createElement(
              FileFocusProvider,
              {
                initialState: {
                  focusedFiles: focusedFilesMap,
                  totalSize,
                },
              },
              React.createElement(FocusedFilesPanel)
            )
          );

          const output = lastFrame();

          // Verify the panel header shows correct count
          expect(output).toContain('Focused Files');
          expect(output).toContain(`(${numFiles} file${numFiles !== 1 ? 's' : ''})`);

          // Verify all files appear in the output
          for (let i = 0; i < numFiles; i++) {
            const filename = `test-file-${i}.txt`;
            
            // Each file should have a focus indicator
            expect(output).toContain('📌');
            
            // Each file should show its filename
            expect(output).toContain(filename);
          }

          // Verify the focus indicator count matches the number of files
          const pinCount = (output.match(/📌/g) || []).length;
          expect(pinCount).toBe(numFiles);

          // Verify total content size is displayed
          expect(output).toContain('Total content size:');
        }
      ),
      { numRuns: 100 }
    );
  });
});
