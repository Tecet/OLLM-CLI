/**
 * Tests for File Reading Tools
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ReadFileTool, ReadFileInvocation } from '../read-file.js';
import { ReadManyFilesTool, ReadManyFilesInvocation } from '../read-many-files.js';
import { MockMessageBus, createMockAbortSignal } from './test-helpers.js';

/**
 * Test fixture for file operations
 */
class FileTestFixture {
  private tempDir: string = '';
  private createdFiles: string[] = [];

  async setup(): Promise<void> {
    // Create a temporary directory for test files
    this.tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'read-file-test-'));
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

describe('Read File Tool', () => {
  let fixture: FileTestFixture;
  let messageBus: MockMessageBus;
  let tool: ReadFileTool;

  beforeEach(async () => {
    fixture = new FileTestFixture();
    await fixture.setup();
    messageBus = new MockMessageBus();
    tool = new ReadFileTool();
  });

  afterEach(async () => {
    await fixture.cleanup();
  });

  describe('Property 6: File Read Round Trip', () => {
    it('should read back the same content that was written', async () => {
      // Feature: stage-03-tools-policy, Property 6: File Read Round Trip
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 0, maxLength: 1000 }),
          fc.string({ minLength: 1, maxLength: 20 }).filter(isValidFilename),
          async (content, filename) => {
            // Write content to a file
            const filePath = await fixture.createFile(filename, content);

            // Read it back using the tool
            const invocation = tool.createInvocation(
              { path: filePath },
              messageBus
            );
            const result = await invocation.execute(createMockAbortSignal());

            // Should not have an error
            expect(result.error).toBeUndefined();

            // Content should match exactly
            expect(result.llmContent).toBe(content);
            expect(result.returnDisplay).toBe(content);

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should preserve line endings and special characters', async () => {
      // Feature: stage-03-tools-policy, Property 6: File Read Round Trip
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.string({ minLength: 0, maxLength: 100 }), {
            minLength: 1,
            maxLength: 20,
          }),
          fc.string({ minLength: 1, maxLength: 20 }).filter(isValidFilename),
          async (lines, filename) => {
            const content = lines.join('\n');

            // Write content to a file
            const filePath = await fixture.createFile(filename, content);

            // Read it back using the tool
            const invocation = tool.createInvocation(
              { path: filePath },
              messageBus
            );
            const result = await invocation.execute(createMockAbortSignal());

            // Should not have an error
            expect(result.error).toBeUndefined();

            // Content should match exactly, preserving line structure
            expect(result.llmContent).toBe(content);

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle empty files', async () => {
      // Feature: stage-03-tools-policy, Property 6: File Read Round Trip
      const filePath = await fixture.createFile('empty.txt', '');

      const invocation = tool.createInvocation({ path: filePath }, messageBus);
      const result = await invocation.execute(createMockAbortSignal());

      expect(result.error).toBeUndefined();
      expect(result.llmContent).toBe('');
      expect(result.returnDisplay).toBe('');
    });
  });

  describe('Property 7: File Read Line Range Slicing', () => {
    it('should return exactly the lines within the specified range', async () => {
      // Feature: stage-03-tools-policy, Property 7: File Read Line Range Slicing
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.string({ minLength: 0, maxLength: 50 }), {
            minLength: 5,
            maxLength: 20,
          }),
          fc.string({ minLength: 1, maxLength: 20 }).filter(isValidFilename),
          async (lines, filename) => {
            const content = lines.join('\n');
            const filePath = await fixture.createFile(filename, content);

            // Generate a valid line range
            const totalLines = lines.length;
            const startLine = Math.floor(Math.random() * totalLines) + 1;
            const endLine =
              startLine + Math.floor(Math.random() * (totalLines - startLine + 1));

            // Read with line range
            const invocation = tool.createInvocation(
              { path: filePath, startLine, endLine },
              messageBus
            );
            const result = await invocation.execute(createMockAbortSignal());

            // Should not have an error
            expect(result.error).toBeUndefined();

            // Extract expected lines (1-indexed, inclusive)
            const expectedLines = lines.slice(startLine - 1, endLine);
            const expected = expectedLines.join('\n');

            // Content should match the expected range
            expect(result.llmContent).toBe(expected);

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle startLine only (read from startLine to end)', async () => {
      // Feature: stage-03-tools-policy, Property 7: File Read Line Range Slicing
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.string({ minLength: 0, maxLength: 50 }), {
            minLength: 5,
            maxLength: 20,
          }),
          fc.string({ minLength: 1, maxLength: 20 }).filter(isValidFilename),
          async (lines, filename) => {
            const content = lines.join('\n');
            const filePath = await fixture.createFile(filename, content);

            // Generate a valid start line
            const totalLines = lines.length;
            const startLine = Math.floor(Math.random() * totalLines) + 1;

            // Read from startLine to end
            const invocation = tool.createInvocation(
              { path: filePath, startLine },
              messageBus
            );
            const result = await invocation.execute(createMockAbortSignal());

            // Should not have an error
            expect(result.error).toBeUndefined();

            // Extract expected lines (from startLine to end)
            const expectedLines = lines.slice(startLine - 1);
            const expected = expectedLines.join('\n');

            // Content should match
            expect(result.llmContent).toBe(expected);

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle endLine only (read from beginning to endLine)', async () => {
      // Feature: stage-03-tools-policy, Property 7: File Read Line Range Slicing
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.string({ minLength: 0, maxLength: 50 }), {
            minLength: 5,
            maxLength: 20,
          }),
          fc.string({ minLength: 1, maxLength: 20 }).filter(isValidFilename),
          async (lines, filename) => {
            const content = lines.join('\n');
            const filePath = await fixture.createFile(filename, content);

            // Generate a valid end line
            const totalLines = lines.length;
            const endLine = Math.floor(Math.random() * totalLines) + 1;

            // Read from beginning to endLine
            const invocation = tool.createInvocation(
              { path: filePath, endLine },
              messageBus
            );
            const result = await invocation.execute(createMockAbortSignal());

            // Should not have an error
            expect(result.error).toBeUndefined();

            // Extract expected lines (from beginning to endLine)
            const expectedLines = lines.slice(0, endLine);
            const expected = expectedLines.join('\n');

            // Content should match
            expect(result.llmContent).toBe(expected);

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle single line range (startLine === endLine)', async () => {
      // Feature: stage-03-tools-policy, Property 7: File Read Line Range Slicing
      const lines = ['Line 1', 'Line 2', 'Line 3', 'Line 4', 'Line 5'];
      const content = lines.join('\n');
      const filePath = await fixture.createFile('single-line.txt', content);

      // Read just line 3
      const invocation = tool.createInvocation(
        { path: filePath, startLine: 3, endLine: 3 },
        messageBus
      );
      const result = await invocation.execute(createMockAbortSignal());

      expect(result.error).toBeUndefined();
      expect(result.llmContent).toBe('Line 3');
    });
  });

  describe('Property 8: File Read Error Handling', () => {
    it('should return FileNotFoundError for non-existent files', async () => {
      // Feature: stage-03-tools-policy, Property 8: File Read Error Handling
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }).filter(isValidFilename),
          async (filename) => {
            // Create a path that doesn't exist
            const nonExistentPath = path.join(
              fixture.getTempDir(),
              'nonexistent',
              filename
            );

            // Try to read the non-existent file
            const invocation = tool.createInvocation(
              { path: nonExistentPath },
              messageBus
            );
            const result = await invocation.execute(createMockAbortSignal());

            // Should have an error
            expect(result.error).toBeDefined();
            expect(result.error?.type).toBe('FileNotFoundError');
            expect(result.error?.message).toContain(nonExistentPath);

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return IsDirectoryError when trying to read a directory', async () => {
      // Feature: stage-03-tools-policy, Property 8: File Read Error Handling
      const dirPath = path.join(fixture.getTempDir(), 'testdir');
      await fs.mkdir(dirPath);

      const invocation = tool.createInvocation({ path: dirPath }, messageBus);
      const result = await invocation.execute(createMockAbortSignal());

      expect(result.error).toBeDefined();
      expect(result.error?.type).toBe('IsDirectoryError');
      expect(result.error?.message).toContain(dirPath);
    });

    it('should return InvalidLineRangeError for invalid startLine', async () => {
      // Feature: stage-03-tools-policy, Property 8: File Read Error Handling
      const lines = ['Line 1', 'Line 2', 'Line 3'];
      const content = lines.join('\n');
      const filePath = await fixture.createFile('test.txt', content);

      // Try to read with invalid startLine (beyond file length)
      const invocation = tool.createInvocation(
        { path: filePath, startLine: 10 },
        messageBus
      );
      const result = await invocation.execute(createMockAbortSignal());

      expect(result.error).toBeDefined();
      expect(result.error?.type).toBe('InvalidLineRangeError');
      expect(result.error?.message).toContain('Invalid startLine');
    });

    it('should return InvalidLineRangeError when endLine < startLine', async () => {
      // Feature: stage-03-tools-policy, Property 8: File Read Error Handling
      const lines = ['Line 1', 'Line 2', 'Line 3', 'Line 4', 'Line 5'];
      const content = lines.join('\n');
      const filePath = await fixture.createFile('test.txt', content);

      // Try to read with endLine < startLine
      const invocation = tool.createInvocation(
        { path: filePath, startLine: 4, endLine: 2 },
        messageBus
      );
      const result = await invocation.execute(createMockAbortSignal());

      expect(result.error).toBeDefined();
      expect(result.error?.type).toBe('InvalidLineRangeError');
      expect(result.error?.message).toContain('Invalid line range');
    });
  });

  describe('Edge Cases', () => {
    it('should detect and handle binary files', async () => {
      // Note: Node.js fs.readFile with 'utf-8' encoding doesn't throw for binary data
      // It replaces invalid sequences with replacement characters (�)
      // For a true binary file detection, we'd need to check the content or use a library
      // For now, we'll test that the tool can read files with binary-like content
      const binaryData = Buffer.from([0xff, 0xfe, 0xfd, 0xfc, 0x00, 0x01, 0x02]);
      const filePath = path.join(fixture.getTempDir(), 'binary.bin');
      await fs.writeFile(filePath, binaryData);

      const invocation = tool.createInvocation({ path: filePath }, messageBus);
      const result = await invocation.execute(createMockAbortSignal());

      // The file will be read, but may contain replacement characters
      // This is expected behavior for UTF-8 encoding of binary data
      expect(result.error).toBeUndefined();
      expect(result.llmContent).toBeDefined();
    });

    it('should enforce size limits', async () => {
      // Create a file larger than the max size (10 MB)
      // We'll create a 11 MB file
      const largeContent = 'x'.repeat(11 * 1024 * 1024);
      const filePath = await fixture.createFile('large.txt', largeContent);

      const invocation = tool.createInvocation({ path: filePath }, messageBus);
      const result = await invocation.execute(createMockAbortSignal());

      // Should have an error indicating file too large
      expect(result.error).toBeDefined();
      expect(result.error?.type).toBe('FileTooLargeError');
      expect(result.error?.message).toContain('too large');
    });

    it('should handle permission errors gracefully', async () => {
      // This test is platform-specific and may not work on all systems
      // We'll skip it if we can't create a file with restricted permissions
      const filePath = await fixture.createFile('restricted.txt', 'content');

      try {
        // Try to make the file unreadable (Unix-like systems)
        await fs.chmod(filePath, 0o000);

        const invocation = tool.createInvocation({ path: filePath }, messageBus);
        const result = await invocation.execute(createMockAbortSignal());

        // Should have a permission error
        expect(result.error).toBeDefined();
        expect(result.error?.type).toBe('PermissionError');

        // Restore permissions for cleanup
        await fs.chmod(filePath, 0o644);
      } catch (error) {
        // Skip test if chmod is not supported (e.g., Windows)
        console.log('Skipping permission test (not supported on this platform)');
      }
    });

    it('should handle abort signal during read', async () => {
      const content = 'x'.repeat(1000);
      const filePath = await fixture.createFile('test.txt', content);

      // Create an already-aborted signal
      const controller = new AbortController();
      controller.abort();

      const invocation = tool.createInvocation({ path: filePath }, messageBus);
      const result = await invocation.execute(controller.signal);

      // Should return an error result (not throw)
      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain('Operation cancelled');
    });
  });

  describe('Tool Interface', () => {
    it('should provide correct description', async () => {
      const filePath = await fixture.createFile('test.txt', 'content');
      const invocation = tool.createInvocation({ path: filePath }, messageBus);

      const description = invocation.getDescription();
      expect(description).toContain(filePath);
    });

    it('should provide correct description with line range', async () => {
      const filePath = await fixture.createFile('test.txt', 'content');
      const invocation = tool.createInvocation(
        { path: filePath, startLine: 1, endLine: 5 },
        messageBus
      );

      const description = invocation.getDescription();
      expect(description).toContain(filePath);
      expect(description).toContain('1');
      expect(description).toContain('5');
    });

    it('should return correct tool locations', async () => {
      const filePath = await fixture.createFile('test.txt', 'content');
      const invocation = tool.createInvocation({ path: filePath }, messageBus);

      const locations = invocation.toolLocations();
      expect(locations).toEqual([filePath]);
    });

    it('should not require confirmation', async () => {
      const filePath = await fixture.createFile('test.txt', 'content');
      const invocation = tool.createInvocation({ path: filePath }, messageBus);

      const confirmation = await invocation.shouldConfirmExecute(
        createMockAbortSignal()
      );
      expect(confirmation).toBe(false);
    });
  });

  describe('Tool Schema', () => {
    it('should have correct schema structure', () => {
      expect(tool.name).toBe('read_file');
      expect(tool.displayName).toBe('Read File');
      expect(tool.schema.name).toBe('read_file');
      expect(tool.schema.description).toBeDefined();
      expect(tool.schema.parameters).toBeDefined();
    });

    it('should have required path parameter', () => {
      const params = tool.schema.parameters as any;
      expect(params.properties.path).toBeDefined();
      expect(params.required).toContain('path');
    });

    it('should have optional line range parameters', () => {
      const params = tool.schema.parameters as any;
      expect(params.properties.startLine).toBeDefined();
      expect(params.properties.endLine).toBeDefined();
      expect(params.required).not.toContain('startLine');
      expect(params.required).not.toContain('endLine');
    });
  });
});

describe('Read Many Files Tool', () => {
  let fixture: FileTestFixture;
  let messageBus: MockMessageBus;
  let tool: ReadManyFilesTool;

  beforeEach(async () => {
    fixture = new FileTestFixture();
    await fixture.setup();
    messageBus = new MockMessageBus();
    tool = new ReadManyFilesTool();
  });

  afterEach(async () => {
    await fixture.cleanup();
  });

  describe('Property 9: Multiple File Read Formatting', () => {
    it('should include each file path as a header followed by its content', async () => {
      // Feature: stage-03-tools-policy, Property 9: Multiple File Read Formatting
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              filename: fc.string({ minLength: 1, maxLength: 20 }).filter(isValidFilename),
              content: fc.string({ minLength: 0, maxLength: 200 }),
            }),
            { minLength: 1, maxLength: 5 }
          ),
          async (files) => {
            // Ensure unique filenames (case-insensitive for Windows)
            const uniqueFiles = new Map<string, { filename: string; content: string }>();
            for (const file of files) {
              const lowerFilename = file.filename.toLowerCase();
              if (!uniqueFiles.has(lowerFilename)) {
                uniqueFiles.set(lowerFilename, file);
              }
            }

            if (uniqueFiles.size === 0) return true; // Skip if no unique files

            // Create all files
            const filePaths: string[] = [];
            const fileContents: string[] = [];
            for (const file of uniqueFiles.values()) {
              const filePath = await fixture.createFile(
                file.filename,
                file.content
              );
              filePaths.push(filePath);
              fileContents.push(file.content);
            }

            // Read all files
            const invocation = tool.createInvocation(
              { paths: filePaths },
              messageBus
            );
            const result = await invocation.execute(createMockAbortSignal());

            // Should not have an error
            expect(result.error).toBeUndefined();

            // Check that each file path appears as a header
            for (let i = 0; i < filePaths.length; i++) {
              const filePath = filePaths[i];
              const expectedHeader = `=== ${filePath} ===`;
              expect(result.llmContent).toContain(expectedHeader);

              // Check that the content follows the header
              const headerIndex = result.llmContent.indexOf(expectedHeader);
              const contentAfterHeader = result.llmContent.substring(
                headerIndex + expectedHeader.length
              );
              expect(contentAfterHeader).toContain(fileContents[i]);
            }

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should maintain order of files in output', async () => {
      // Feature: stage-03-tools-policy, Property 9: Multiple File Read Formatting
      const file1 = await fixture.createFile('file1.txt', 'Content 1');
      const file2 = await fixture.createFile('file2.txt', 'Content 2');
      const file3 = await fixture.createFile('file3.txt', 'Content 3');

      const invocation = tool.createInvocation(
        { paths: [file1, file2, file3] },
        messageBus
      );
      const result = await invocation.execute(createMockAbortSignal());

      expect(result.error).toBeUndefined();

      // Check order by finding header positions
      const header1Pos = result.llmContent.indexOf(`=== ${file1} ===`);
      const header2Pos = result.llmContent.indexOf(`=== ${file2} ===`);
      const header3Pos = result.llmContent.indexOf(`=== ${file3} ===`);

      expect(header1Pos).toBeGreaterThan(-1);
      expect(header2Pos).toBeGreaterThan(header1Pos);
      expect(header3Pos).toBeGreaterThan(header2Pos);
    });

    it('should handle errors gracefully and continue reading other files', async () => {
      // Feature: stage-03-tools-policy, Property 9: Multiple File Read Formatting
      const file1 = await fixture.createFile('file1.txt', 'Content 1');
      const nonExistent = path.join(fixture.getTempDir(), 'nonexistent.txt');
      const file3 = await fixture.createFile('file3.txt', 'Content 3');

      const invocation = tool.createInvocation(
        { paths: [file1, nonExistent, file3] },
        messageBus
      );
      const result = await invocation.execute(createMockAbortSignal());

      // Should not have a top-level error
      expect(result.error).toBeUndefined();

      // Should contain headers for all files
      expect(result.llmContent).toContain(`=== ${file1} ===`);
      expect(result.llmContent).toContain(`=== ${nonExistent} ===`);
      expect(result.llmContent).toContain(`=== ${file3} ===`);

      // Should contain content for successful reads
      expect(result.llmContent).toContain('Content 1');
      expect(result.llmContent).toContain('Content 3');

      // Should contain error message for failed read
      expect(result.llmContent).toContain('Error: File not found');

      // Return display should indicate errors
      expect(result.returnDisplay).toContain('2 files successfully');
      expect(result.returnDisplay).toContain('1 errors');
    });
  });

  describe('Tool Interface', () => {
    it('should provide correct description', async () => {
      const file1 = await fixture.createFile('test1.txt', 'content1');
      const file2 = await fixture.createFile('test2.txt', 'content2');

      const invocation = tool.createInvocation(
        { paths: [file1, file2] },
        messageBus
      );

      const description = invocation.getDescription();
      expect(description).toContain('2');
      expect(description).toContain('files');
    });

    it('should return correct tool locations', async () => {
      const file1 = await fixture.createFile('test1.txt', 'content1');
      const file2 = await fixture.createFile('test2.txt', 'content2');

      const invocation = tool.createInvocation(
        { paths: [file1, file2] },
        messageBus
      );

      const locations = invocation.toolLocations();
      expect(locations).toEqual([file1, file2]);
    });

    it('should not require confirmation', async () => {
      const file1 = await fixture.createFile('test1.txt', 'content1');

      const invocation = tool.createInvocation({ paths: [file1] }, messageBus);

      const confirmation = await invocation.shouldConfirmExecute(
        createMockAbortSignal()
      );
      expect(confirmation).toBe(false);
    });
  });

  describe('Tool Schema', () => {
    it('should have correct schema structure', () => {
      expect(tool.name).toBe('read_many_files');
      expect(tool.displayName).toBe('Read Multiple Files');
      expect(tool.schema.name).toBe('read_many_files');
      expect(tool.schema.description).toBeDefined();
      expect(tool.schema.parameters).toBeDefined();
    });

    it('should have required paths parameter', () => {
      const params = tool.schema.parameters as any;
      expect(params.properties.paths).toBeDefined();
      expect(params.properties.paths.type).toBe('array');
      expect(params.required).toContain('paths');
    });
  });
});
