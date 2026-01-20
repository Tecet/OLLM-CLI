/**
 * Tests for File Writing Tool
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';
import { WriteFileTool } from '../write-file.js';
import { MockMessageBus, createMockAbortSignal, createToolContext } from './test-helpers.js';

/**
 * Test fixture for file operations
 */
class FileTestFixture {
  private tempDir: string = '';
  private createdFiles: string[] = [];

  async setup(): Promise<void> {
    // Create a temporary directory for test files
    this.tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'write-file-test-'));
  }

  async cleanup(): Promise<void> {
    // Clean up all created files and the temp directory
        try {
          await fs.rm(this.tempDir, { recursive: true, force: true });
        } catch (_error) {
          // Ignore
        }    this.createdFiles = [];
  }

  async createFile(filename: string, content: string): Promise<string> {
    const filePath = path.join(this.tempDir, filename);
    await fs.writeFile(filePath, content, 'utf-8');
    this.createdFiles.push(filePath);
    return filePath;
  }

  getFilePath(filename: string): string {
    return path.join(this.tempDir, filename);
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
  const invalidChars = /[<>:"|?*/\\]/;
  // Also filter out "." and ".." which are special directory references
  return !invalidChars.test(s) && s.trim().length > 0 && s !== '.' && s !== '..';
}

describe('Write File Tool', () => {
  let fixture: FileTestFixture;
  let messageBus: MockMessageBus;
  let tool: WriteFileTool;

  beforeEach(async () => {
    fixture = new FileTestFixture();
    await fixture.setup();
    messageBus = new MockMessageBus();
    tool = new WriteFileTool();
  });

  afterEach(async () => {
    await fixture.cleanup();
  });

  describe('Property 10: File Write Overwrite Protection', () => {
    it('should return FileExistsError when writing to existing file without overwrite flag', async () => {
      // Feature: stage-03-tools-policy, Property 10: File Write Overwrite Protection
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 20 }).filter(isValidFilename),
          fc.string({ minLength: 0, maxLength: 500 }),
          fc.string({ minLength: 0, maxLength: 500 }),
          async (filename, originalContent, newContent) => {
            // Create a file with original content
            const filePath = await fixture.createFile(filename, originalContent);

            // Try to write to it without overwrite flag
            const invocation = tool.createInvocation(
              { path: filePath, content: newContent },
              createToolContext(messageBus)
            );
            const result = await invocation.execute(createMockAbortSignal());

            // Should have an error
            expect(result.error).toBeDefined();
            expect(result.error?.type).toBe('FileExistsError');
            expect(result.error?.message).toContain('already exists');
            expect(result.error?.message).toContain('overwrite=true');

            // Original content should be unchanged
            const actualContent = await fs.readFile(filePath, 'utf-8');
            expect(actualContent).toBe(originalContent);

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should protect existing files by default', async () => {
      // Feature: stage-03-tools-policy, Property 10: File Write Overwrite Protection
      const filePath = await fixture.createFile('existing.txt', 'original content');

      const invocation = tool.createInvocation(
        { path: filePath, content: 'new content' },
        createToolContext(messageBus)
      );
      const result = await invocation.execute(createMockAbortSignal());

      expect(result.error).toBeDefined();
      expect(result.error?.type).toBe('FileExistsError');

      // Verify original content is preserved
      const content = await fs.readFile(filePath, 'utf-8');
      expect(content).toBe('original content');
    });
  });

  describe('Property 11: File Write Overwrite Behavior', () => {
    it('should replace file content when overwrite=true and reading back should return new content', async () => {
      // Feature: stage-03-tools-policy, Property 11: File Write Overwrite Behavior
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 20 }).filter(isValidFilename),
          fc.string({ minLength: 0, maxLength: 500 }),
          fc.string({ minLength: 0, maxLength: 500 }),
          async (filename, originalContent, newContent) => {
            // Create a file with original content
            const filePath = await fixture.createFile(filename, originalContent);

            // Write to it with overwrite=true
            const invocation = tool.createInvocation(
              { path: filePath, content: newContent, overwrite: true },
              createToolContext(messageBus)
            );
            const result = await invocation.execute(createMockAbortSignal());

            // Should not have an error
            expect(result.error).toBeUndefined();

            // Read back the content
            const actualContent = await fs.readFile(filePath, 'utf-8');

            // Content should match the new content exactly
            expect(actualContent).toBe(newContent);

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle overwriting with empty content', async () => {
      // Feature: stage-03-tools-policy, Property 11: File Write Overwrite Behavior
      const filePath = await fixture.createFile('test.txt', 'original content');

      const invocation = tool.createInvocation(
        { path: filePath, content: '', overwrite: true },
        createToolContext(messageBus)
      );
      const result = await invocation.execute(createMockAbortSignal());

      expect(result.error).toBeUndefined();

      const content = await fs.readFile(filePath, 'utf-8');
      expect(content).toBe('');
    });

    it('should preserve special characters and line endings when overwriting', async () => {
      // Feature: stage-03-tools-policy, Property 11: File Write Overwrite Behavior
      const filePath = await fixture.createFile('test.txt', 'old');
      const newContent = 'Line 1\nLine 2\r\nLine 3\n\tTabbed\n"Quoted"';

      const invocation = tool.createInvocation(
        { path: filePath, content: newContent, overwrite: true },
        createToolContext(messageBus)
      );
      const result = await invocation.execute(createMockAbortSignal());

      expect(result.error).toBeUndefined();

      const content = await fs.readFile(filePath, 'utf-8');
      expect(content).toBe(newContent);
    });
  });

  describe('Property 12: Parent Directory Creation', () => {
    it('should create all parent directories when writing to nested path', async () => {
      // Feature: stage-03-tools-policy, Property 12: Parent Directory Creation
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.string({ minLength: 1, maxLength: 10 }).filter(isValidFilename),
            { minLength: 1, maxLength: 4 }
          ),
          fc.string({ minLength: 1, maxLength: 10 }).filter(isValidFilename),
          fc.string({ minLength: 0, maxLength: 200 }),
          async (dirParts, filename, content) => {
            // Create a nested path that doesn't exist
            const nestedPath = path.join(fixture.getTempDir(), ...dirParts, filename);

            // Write to the nested path
            const invocation = tool.createInvocation(
              { path: nestedPath, content },
              createToolContext(messageBus)
            );
            const result = await invocation.execute(createMockAbortSignal());

            // Should not have an error
            expect(result.error).toBeUndefined();

            // File should exist
            const fileExists = await fs
              .access(nestedPath)
              .then(() => true)
              .catch(() => false);
            expect(fileExists).toBe(true);

            // Content should match
            const actualContent = await fs.readFile(nestedPath, 'utf-8');
            expect(actualContent).toBe(content);

            // All parent directories should exist
            const parentDir = path.dirname(nestedPath);
            const parentExists = await fs
              .access(parentDir)
              .then(() => true)
              .catch(() => false);
            expect(parentExists).toBe(true);

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should create deeply nested directories', async () => {
      // Feature: stage-03-tools-policy, Property 12: Parent Directory Creation
      const deepPath = path.join(
        fixture.getTempDir(),
        'a',
        'b',
        'c',
        'd',
        'e',
        'test.txt'
      );

      const invocation = tool.createInvocation(
        { path: deepPath, content: 'deep content' },
        createToolContext(messageBus)
      );
      const result = await invocation.execute(createMockAbortSignal());

      expect(result.error).toBeUndefined();

      const content = await fs.readFile(deepPath, 'utf-8');
      expect(content).toBe('deep content');
    });

    it('should handle existing parent directories gracefully', async () => {
      // Feature: stage-03-tools-policy, Property 12: Parent Directory Creation
      const subDir = path.join(fixture.getTempDir(), 'existing');
      await fs.mkdir(subDir);

      const filePath = path.join(subDir, 'test.txt');

      const invocation = tool.createInvocation(
        { path: filePath, content: 'content' },
        createToolContext(messageBus)
      );
      const result = await invocation.execute(createMockAbortSignal());

      expect(result.error).toBeUndefined();

      const content = await fs.readFile(filePath, 'utf-8');
      expect(content).toBe('content');
    });
  });

  describe('Basic Functionality', () => {
    it('should create new files successfully', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 20 }).filter(isValidFilename),
          fc.string({ minLength: 0, maxLength: 500 }),
          async (filename, content) => {
            const filePath = fixture.getFilePath(filename);

            // Ensure file doesn't exist before test
            try {
              await fs.unlink(filePath);
            } catch {
              // File doesn't exist, which is what we want
            }

            const invocation = tool.createInvocation(
              { path: filePath, content },
              createToolContext(messageBus)
            );
            const result = await invocation.execute(createMockAbortSignal());

            expect(result.error).toBeUndefined();
            expect(result.llmContent).toContain('Created');
            expect(result.llmContent).toContain(filename);

            const actualContent = await fs.readFile(filePath, 'utf-8');
            expect(actualContent).toBe(content);

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle empty content', async () => {
      const filePath = fixture.getFilePath('empty.txt');

      const invocation = tool.createInvocation(
        { path: filePath, content: '' },
        createToolContext(messageBus)
      );
      const result = await invocation.execute(createMockAbortSignal());

      expect(result.error).toBeUndefined();

      const content = await fs.readFile(filePath, 'utf-8');
      expect(content).toBe('');
    });

    it('should handle large content', async () => {
      const largeContent = 'x'.repeat(1024 * 1024); // 1 MB
      const filePath = fixture.getFilePath('large.txt');

      const invocation = tool.createInvocation(
        { path: filePath, content: largeContent },
        createToolContext(messageBus)
      );
      const result = await invocation.execute(createMockAbortSignal());

      expect(result.error).toBeUndefined();

      const content = await fs.readFile(filePath, 'utf-8');
      expect(content).toBe(largeContent);
    });
  });

  describe('Error Handling', () => {
    it('should handle abort signal', async () => {
      const filePath = fixture.getFilePath('test.txt');

      const controller = new AbortController();
      controller.abort();

      const invocation = tool.createInvocation(
        { path: filePath, content: 'content' },
        createToolContext(messageBus)
      );
      const result = await invocation.execute(controller.signal);

      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain('Operation cancelled');
    });

    it('should return IsDirectoryError when trying to write to a directory', async () => {
      const dirPath = path.join(fixture.getTempDir(), 'testdir');
      await fs.mkdir(dirPath);

      const invocation = tool.createInvocation(
        { path: dirPath, content: 'content' },
        createToolContext(messageBus)
      );
      const result = await invocation.execute(createMockAbortSignal());

      expect(result.error).toBeDefined();
      expect(result.error?.type).toBe('IsDirectoryError');
    });
  });

  describe('Tool Interface', () => {
    it('should provide correct description', () => {
      const filePath = fixture.getFilePath('test.txt');
      const invocation = tool.createInvocation(
        { path: filePath, content: 'content' },
        createToolContext(messageBus)
      );

      const description = invocation.getDescription();
      expect(description).toContain('Write to');
      expect(description).toContain(filePath);
    });

    it('should return correct tool locations', () => {
      const filePath = fixture.getFilePath('test.txt');
      const invocation = tool.createInvocation(
        { path: filePath, content: 'content' },
        createToolContext(messageBus)
      );

      const locations = invocation.toolLocations();
      expect(locations).toEqual([filePath]);
    });

    it('should not require confirmation by default', async () => {
      const filePath = fixture.getFilePath('test.txt');
      const invocation = tool.createInvocation(
        { path: filePath, content: 'content' },
        createToolContext(messageBus)
      );

      const confirmation = await invocation.shouldConfirmExecute(
        createMockAbortSignal()
      );
      expect(confirmation).toBe(false);
    });
  });

  describe('Tool Schema', () => {
    it('should have correct schema structure', () => {
      expect(tool.name).toBe('write_file');
      expect(tool.displayName).toBe('Write File');
      expect(tool.schema.name).toBe('write_file');
      expect(tool.schema.description).toBeDefined();
      expect(tool.schema.parameters).toBeDefined();
    });

    it('should have required parameters', () => {
      const params = tool.schema.parameters as any;
      expect(params.properties.path).toBeDefined();
      expect(params.properties.content).toBeDefined();
      expect(params.required).toContain('path');
      expect(params.required).toContain('content');
    });

    it('should have optional overwrite parameter', () => {
      const params = tool.schema.parameters as any;
      expect(params.properties.overwrite).toBeDefined();
      expect(params.required).not.toContain('overwrite');
    });
  });
});
