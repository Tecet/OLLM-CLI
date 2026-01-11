/**
 * Tests for File Editing Tool
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';
import { EditFileTool, EditFileInvocation } from '../edit-file.js';
import { MockMessageBus, createMockAbortSignal } from './test-helpers.js';

/**
 * Test fixture for file operations
 */
class FileTestFixture {
  private tempDir: string = '';
  private createdFiles: string[] = [];

  async setup(): Promise<void> {
    // Create a temporary directory for test files
    this.tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'edit-file-test-'));
  }

  async cleanup(): Promise<void> {
    // Clean up all created files and the temp directory
    try {
      await fs.rm(this.tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
    this.createdFiles = [];
  }

  async createFile(filename: string, content: string): Promise<string> {
    const filePath = path.join(this.tempDir, filename);
    await fs.writeFile(filePath, content, 'utf-8');
    this.createdFiles.push(filePath);
    return filePath;
  }

  getTempDir(): string {
    return this.tempDir;
  }
}

/**
 * Filter for valid filenames (cross-platform)
 */
function isValidFilename(s: string): boolean {
  // Filter out invalid filename characters for Windows/Unix
  const invalidChars = /[<>:"|?*\/\\]/;
  // Also filter out "." and ".." which are special directory references
  return !invalidChars.test(s) && s.trim().length > 0 && s !== '.' && s !== '..';
}

describe('Edit File Tool', () => {
  let fixture: FileTestFixture;
  let messageBus: MockMessageBus;
  let tool: EditFileTool;

  beforeEach(async () => {
    fixture = new FileTestFixture();
    await fixture.setup();
    messageBus = new MockMessageBus();
    tool = new EditFileTool();
  });

  afterEach(async () => {
    await fixture.cleanup();
  });

  describe('Property 13: File Edit Target Uniqueness', () => {
    it('should succeed when target appears exactly once and replace it', async () => {
      // Feature: stage-03-tools-policy, Property 13: File Edit Target Uniqueness
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 20 }).filter(isValidFilename),
          fc.array(fc.string({ minLength: 1, maxLength: 50 }), {
            minLength: 3,
            maxLength: 10,
          }),
          fc.integer({ min: 0, max: 9 }),
          fc.string({ minLength: 1, maxLength: 50 }),
          async (filename, lines, targetIndex, replacement) => {
            // Ensure we have a valid target index
            if (targetIndex >= lines.length) {
              targetIndex = lines.length - 1;
            }

            // Ensure the target line is unique in the entire content
            const target = lines[targetIndex];
            const content = lines.join('\n');
            
            // Count occurrences of target as a substring in the entire content
            const escapedTarget = target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(escapedTarget, 'g');
            const matches = content.match(regex);
            const occurrences = matches ? matches.length : 0;

            // Skip if target is not unique in the content
            if (occurrences !== 1) {
              return true;
            }

            // Create file with content
            const filePath = await fixture.createFile(filename, content);

            // Apply edit
            const invocation = tool.createInvocation(
              {
                path: filePath,
                edits: [{ target, replacement }],
              },
              messageBus
            );
            const result = await invocation.execute(createMockAbortSignal());

            // Should not have an error
            expect(result.error).toBeUndefined();

            // Read back the content
            const actualContent = await fs.readFile(filePath, 'utf-8');

            // The target should be replaced exactly once
            expect(actualContent).toBe(content.replace(target, replacement));

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should replace unique target text in middle of file', async () => {
      // Feature: stage-03-tools-policy, Property 13: File Edit Target Uniqueness
      const content = 'Line 1\nUNIQUE_TARGET\nLine 3\nLine 4';
      const filePath = await fixture.createFile('test.txt', content);

      const invocation = tool.createInvocation(
        {
          path: filePath,
          edits: [{ target: 'UNIQUE_TARGET', replacement: 'REPLACED' }],
        },
        messageBus
      );
      const result = await invocation.execute(createMockAbortSignal());

      expect(result.error).toBeUndefined();

      const actualContent = await fs.readFile(filePath, 'utf-8');
      expect(actualContent).toBe('Line 1\nREPLACED\nLine 3\nLine 4');
    });

    it('should handle multiple unique edits in sequence', async () => {
      // Feature: stage-03-tools-policy, Property 13: File Edit Target Uniqueness
      const content = 'AAA\nBBB\nCCC\nDDD';
      const filePath = await fixture.createFile('test.txt', content);

      const invocation = tool.createInvocation(
        {
          path: filePath,
          edits: [
            { target: 'AAA', replacement: 'A1' },
            { target: 'BBB', replacement: 'B2' },
            { target: 'CCC', replacement: 'C3' },
          ],
        },
        messageBus
      );
      const result = await invocation.execute(createMockAbortSignal());

      expect(result.error).toBeUndefined();

      const actualContent = await fs.readFile(filePath, 'utf-8');
      expect(actualContent).toBe('A1\nB2\nC3\nDDD');
    });
  });

  describe('Property 14: File Edit Target Not Found', () => {
    it('should return EditTargetNotFound error when target does not appear in file', async () => {
      // Feature: stage-03-tools-policy, Property 14: File Edit Target Not Found
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 20 }).filter(isValidFilename),
          fc.array(fc.string({ minLength: 1, maxLength: 50 }), {
            minLength: 1,
            maxLength: 10,
          }),
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.string({ minLength: 1, maxLength: 50 }),
          async (filename, lines, target, replacement) => {
            // Ensure target is not in the content
            if (lines.some((line) => line.includes(target))) {
              return true; // Skip this test case
            }

            const content = lines.join('\n');
            const filePath = await fixture.createFile(filename, content);

            // Try to apply edit with non-existent target
            const invocation = tool.createInvocation(
              {
                path: filePath,
                edits: [{ target, replacement }],
              },
              messageBus
            );
            const result = await invocation.execute(createMockAbortSignal());

            // Should have an error
            expect(result.error).toBeDefined();
            expect(result.error?.type).toBe('EditTargetNotFound');
            expect(result.error?.message).toContain('Target text not found');
            expect(result.error?.message).toContain(target);

            // File content should be unchanged
            const actualContent = await fs.readFile(filePath, 'utf-8');
            expect(actualContent).toBe(content);

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return error for non-existent target', async () => {
      // Feature: stage-03-tools-policy, Property 14: File Edit Target Not Found
      const content = 'Line 1\nLine 2\nLine 3';
      const filePath = await fixture.createFile('test.txt', content);

      const invocation = tool.createInvocation(
        {
          path: filePath,
          edits: [{ target: 'DOES_NOT_EXIST', replacement: 'NEW' }],
        },
        messageBus
      );
      const result = await invocation.execute(createMockAbortSignal());

      expect(result.error).toBeDefined();
      expect(result.error?.type).toBe('EditTargetNotFound');

      // Content should be unchanged
      const actualContent = await fs.readFile(filePath, 'utf-8');
      expect(actualContent).toBe(content);
    });

    it('should fail on first non-existent target in multi-edit', async () => {
      // Feature: stage-03-tools-policy, Property 14: File Edit Target Not Found
      const content = 'AAA\nBBB\nCCC';
      const filePath = await fixture.createFile('test.txt', content);

      const invocation = tool.createInvocation(
        {
          path: filePath,
          edits: [
            { target: 'AAA', replacement: 'A1' },
            { target: 'DOES_NOT_EXIST', replacement: 'X' },
            { target: 'CCC', replacement: 'C3' },
          ],
        },
        messageBus
      );
      const result = await invocation.execute(createMockAbortSignal());

      expect(result.error).toBeDefined();
      expect(result.error?.type).toBe('EditTargetNotFound');

      // File should be unchanged because the edit failed
      // (We don't want partial edits - it's all or nothing)
      const actualContent = await fs.readFile(filePath, 'utf-8');
      expect(actualContent).toBe('AAA\nBBB\nCCC');
    });
  });

  describe('Property 15: File Edit Target Ambiguity', () => {
    it('should return EditTargetAmbiguous error when target appears multiple times', async () => {
      // Feature: stage-03-tools-policy, Property 15: File Edit Target Ambiguity
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 20 }).filter(isValidFilename),
          fc.string({ minLength: 1, maxLength: 30 }),
          fc.integer({ min: 2, max: 5 }),
          fc.string({ minLength: 1, maxLength: 30 }),
          async (filename, target, count, replacement) => {
            // Create content with target appearing multiple times
            const lines: string[] = [];
            for (let i = 0; i < count; i++) {
              lines.push(target);
            }
            // Add some unique lines to ensure we have a valid file
            lines.push('unique1');
            lines.push('unique2');

            const content = lines.join('\n');
            const filePath = await fixture.createFile(filename, content);

            // Try to apply edit with ambiguous target
            const invocation = tool.createInvocation(
              {
                path: filePath,
                edits: [{ target, replacement }],
              },
              messageBus
            );
            const result = await invocation.execute(createMockAbortSignal());

            // Should have an error
            expect(result.error).toBeDefined();
            expect(result.error?.type).toBe('EditTargetAmbiguous');
            expect(result.error?.message).toContain('ambiguous');
            // The message should mention at least 2 matches (could be more if target appears in unique lines)
            expect(result.error?.message).toMatch(/\d+ matches/);
            expect(result.error?.message).toContain(target);

            // File content should be unchanged
            const actualContent = await fs.readFile(filePath, 'utf-8');
            expect(actualContent).toBe(content);

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return error for duplicate target', async () => {
      // Feature: stage-03-tools-policy, Property 15: File Edit Target Ambiguity
      const content = 'DUPLICATE\nLine 2\nDUPLICATE\nLine 4';
      const filePath = await fixture.createFile('test.txt', content);

      const invocation = tool.createInvocation(
        {
          path: filePath,
          edits: [{ target: 'DUPLICATE', replacement: 'NEW' }],
        },
        messageBus
      );
      const result = await invocation.execute(createMockAbortSignal());

      expect(result.error).toBeDefined();
      expect(result.error?.type).toBe('EditTargetAmbiguous');
      expect(result.error?.message).toContain('2 matches');

      // Content should be unchanged
      const actualContent = await fs.readFile(filePath, 'utf-8');
      expect(actualContent).toBe(content);
    });

    it('should detect ambiguity even with partial matches', async () => {
      // Feature: stage-03-tools-policy, Property 15: File Edit Target Ambiguity
      const content = 'function test() {\n  return 1;\n}\nfunction test() {\n  return 2;\n}';
      const filePath = await fixture.createFile('test.txt', content);

      const invocation = tool.createInvocation(
        {
          path: filePath,
          edits: [{ target: 'function test()', replacement: 'function newTest()' }],
        },
        messageBus
      );
      const result = await invocation.execute(createMockAbortSignal());

      expect(result.error).toBeDefined();
      expect(result.error?.type).toBe('EditTargetAmbiguous');
    });
  });

  describe('Basic Functionality', () => {
    it('should handle edits with special regex characters', async () => {
      const content = 'const x = 10;\nconst y = 20;';
      const filePath = await fixture.createFile('test.txt', content);

      // Target contains regex special characters
      const invocation = tool.createInvocation(
        {
          path: filePath,
          edits: [{ target: 'const x = 10;', replacement: 'const x = 100;' }],
        },
        messageBus
      );
      const result = await invocation.execute(createMockAbortSignal());

      expect(result.error).toBeUndefined();

      const actualContent = await fs.readFile(filePath, 'utf-8');
      expect(actualContent).toBe('const x = 100;\nconst y = 20;');
    });

    it('should handle multi-line targets', async () => {
      const content = 'Line 1\nLine 2\nLine 3\nLine 4';
      const filePath = await fixture.createFile('test.txt', content);

      const invocation = tool.createInvocation(
        {
          path: filePath,
          edits: [{ target: 'Line 2\nLine 3', replacement: 'New Line' }],
        },
        messageBus
      );
      const result = await invocation.execute(createMockAbortSignal());

      expect(result.error).toBeUndefined();

      const actualContent = await fs.readFile(filePath, 'utf-8');
      expect(actualContent).toBe('Line 1\nNew Line\nLine 4');
    });

    it('should handle empty replacement', async () => {
      const content = 'Line 1\nDELETE_ME\nLine 3';
      const filePath = await fixture.createFile('test.txt', content);

      const invocation = tool.createInvocation(
        {
          path: filePath,
          edits: [{ target: 'DELETE_ME', replacement: '' }],
        },
        messageBus
      );
      const result = await invocation.execute(createMockAbortSignal());

      expect(result.error).toBeUndefined();

      const actualContent = await fs.readFile(filePath, 'utf-8');
      expect(actualContent).toBe('Line 1\n\nLine 3');
    });

    it('should handle whitespace in targets', async () => {
      const content = '  indented line  \nLine 2';
      const filePath = await fixture.createFile('test.txt', content);

      const invocation = tool.createInvocation(
        {
          path: filePath,
          edits: [{ target: '  indented line  ', replacement: 'no indent' }],
        },
        messageBus
      );
      const result = await invocation.execute(createMockAbortSignal());

      expect(result.error).toBeUndefined();

      const actualContent = await fs.readFile(filePath, 'utf-8');
      expect(actualContent).toBe('no indent\nLine 2');
    });
  });

  describe('Error Handling', () => {
    it('should return FileNotFoundError for non-existent file', async () => {
      const nonExistentPath = path.join(fixture.getTempDir(), 'nonexistent.txt');

      const invocation = tool.createInvocation(
        {
          path: nonExistentPath,
          edits: [{ target: 'old', replacement: 'new' }],
        },
        messageBus
      );
      const result = await invocation.execute(createMockAbortSignal());

      expect(result.error).toBeDefined();
      expect(result.error?.type).toBe('FileNotFoundError');
    });

    it('should handle abort signal', async () => {
      const content = 'Line 1\nLine 2';
      const filePath = await fixture.createFile('test.txt', content);

      const controller = new AbortController();
      controller.abort();

      const invocation = tool.createInvocation(
        {
          path: filePath,
          edits: [{ target: 'Line 1', replacement: 'New Line' }],
        },
        messageBus
      );
      const result = await invocation.execute(controller.signal);

      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain('Operation cancelled');
    });

    it('should handle abort signal between edits', async () => {
      const content = 'AAA\nBBB\nCCC';
      const filePath = await fixture.createFile('test.txt', content);

      // This is tricky to test - we'd need to abort during execution
      // For now, just verify the abort check exists
      const controller = new AbortController();

      const invocation = tool.createInvocation(
        {
          path: filePath,
          edits: [
            { target: 'AAA', replacement: 'A1' },
            { target: 'BBB', replacement: 'B2' },
          ],
        },
        messageBus
      );

      // Abort immediately
      controller.abort();

      const result = await invocation.execute(controller.signal);

      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain('Operation cancelled');
    });
  });

  describe('Tool Interface', () => {
    it('should provide correct description for single edit', () => {
      const filePath = path.join(fixture.getTempDir(), 'test.txt');
      const invocation = tool.createInvocation(
        {
          path: filePath,
          edits: [{ target: 'old', replacement: 'new' }],
        },
        messageBus
      );

      const description = invocation.getDescription();
      expect(description).toContain('Edit');
      expect(description).toContain(filePath);
      expect(description).toContain('1 edit');
    });

    it('should provide correct description for multiple edits', () => {
      const filePath = path.join(fixture.getTempDir(), 'test.txt');
      const invocation = tool.createInvocation(
        {
          path: filePath,
          edits: [
            { target: 'old1', replacement: 'new1' },
            { target: 'old2', replacement: 'new2' },
            { target: 'old3', replacement: 'new3' },
          ],
        },
        messageBus
      );

      const description = invocation.getDescription();
      expect(description).toContain('Edit');
      expect(description).toContain(filePath);
      expect(description).toContain('3 edits');
    });

    it('should return correct tool locations', () => {
      const filePath = path.join(fixture.getTempDir(), 'test.txt');
      const invocation = tool.createInvocation(
        {
          path: filePath,
          edits: [{ target: 'old', replacement: 'new' }],
        },
        messageBus
      );

      const locations = invocation.toolLocations();
      expect(locations).toEqual([filePath]);
    });

    it('should not require confirmation by default', async () => {
      const filePath = path.join(fixture.getTempDir(), 'test.txt');
      const invocation = tool.createInvocation(
        {
          path: filePath,
          edits: [{ target: 'old', replacement: 'new' }],
        },
        messageBus
      );

      const confirmation = await invocation.shouldConfirmExecute(
        createMockAbortSignal()
      );
      expect(confirmation).toBe(false);
    });
  });

  describe('Tool Schema', () => {
    it('should have correct schema structure', () => {
      expect(tool.name).toBe('edit_file');
      expect(tool.displayName).toBe('Edit File');
      expect(tool.schema.name).toBe('edit_file');
      expect(tool.schema.description).toBeDefined();
      expect(tool.schema.parameters).toBeDefined();
    });

    it('should have required parameters', () => {
      const params = tool.schema.parameters as any;
      expect(params.properties.path).toBeDefined();
      expect(params.properties.edits).toBeDefined();
      expect(params.required).toContain('path');
      expect(params.required).toContain('edits');
    });

    it('should have correct edits array schema', () => {
      const params = tool.schema.parameters as any;
      expect(params.properties.edits.type).toBe('array');
      expect(params.properties.edits.items).toBeDefined();
      expect(params.properties.edits.items.properties.target).toBeDefined();
      expect(params.properties.edits.items.properties.replacement).toBeDefined();
      expect(params.properties.edits.items.required).toContain('target');
      expect(params.properties.edits.items.required).toContain('replacement');
    });
  });
});
