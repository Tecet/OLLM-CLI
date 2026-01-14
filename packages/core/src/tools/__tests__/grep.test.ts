/**
 * Tests for Grep Tool
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';
import { GrepTool } from '../grep.js';
import { MockMessageBus, createMockAbortSignal, createToolContext } from './test-helpers.js';

/**
 * Test fixture for file operations
 */
class FileTestFixture {
  private tempDir: string = '';
  private createdFiles: string[] = [];

  async setup(): Promise<void> {
    this.tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'grep-test-'));
  }

  async cleanup(): Promise<void> {
    try {
      await fs.rm(this.tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
    this.createdFiles = [];
  }

  async createFile(relativePath: string, content: string = ''): Promise<string> {
    const filePath = path.join(this.tempDir, relativePath);
    const dir = path.dirname(filePath);
    
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(filePath, content, 'utf-8');
    this.createdFiles.push(filePath);
    return filePath;
  }

  getTempDir(): string {
    return this.tempDir;
  }

  getRelativePath(absolutePath: string): string {
    return path.relative(this.tempDir, absolutePath);
  }
}

/**
 * Normalize path separators to forward slashes for cross-platform testing
 */
function normalizePath(p: string): string {
  return p.replace(/\\/g, '/');
}

describe('Grep Tool', () => {
  let fixture: FileTestFixture;
  let messageBus: MockMessageBus;
  let tool: GrepTool;

  beforeEach(async () => {
    fixture = new FileTestFixture();
    await fixture.setup();
    messageBus = new MockMessageBus();
    tool = new GrepTool();
  });

  afterEach(async () => {
    await fixture.cleanup();
  });

  describe('Property 19: Grep Pattern Matching', () => {
    it('should return all lines matching the pattern with file paths and line numbers', async () => {
      // Feature: stage-03-tools-policy, Property 19: Grep Pattern Matching
      // Validates: Requirement 4.5
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              filename: fc.string({ minLength: 1, maxLength: 10 }).filter(s => /^[a-z0-9_]+$/.test(s)),
              // Filter out backslashes and other problematic characters from line content
              lines: fc.array(
                fc.string({ minLength: 0, maxLength: 50 }).filter(s => !/[\\]/.test(s)),
                { minLength: 3, maxLength: 10 }
              ),
            }),
            { minLength: 2, maxLength: 5 }
          ).map(arr => {
            // Ensure unique filenames
            const seen = new Set<string>();
            return arr.filter(spec => {
              if (seen.has(spec.filename)) return false;
              seen.add(spec.filename);
              return true;
            });
          }).filter(arr => arr.length >= 2),
          // Filter out regex special characters from search terms for predictable matching
          fc.string({ minLength: 1, maxLength: 5 }).filter(s => 
            s.trim().length > 0 && /^[a-zA-Z0-9]+$/.test(s)
          ),
          async (fileSpecs, searchTerm) => {
            const testFixture = new FileTestFixture();
            await testFixture.setup();

            try {
              // Create files with content
              const filesWithMatches: Array<{ file: string; matchingLines: Array<{ lineNum: number; content: string }> }> = [];
              
              for (let fileIndex = 0; fileIndex < fileSpecs.length; fileIndex++) {
                const spec = fileSpecs[fileIndex];
                const filename = `${spec.filename}_${fileIndex}.txt`;
                const content = spec.lines.join('\n');
                await testFixture.createFile(filename, content);

                // Track which lines should match - simple case-insensitive substring match
                const matchingLines: Array<{ lineNum: number; content: string }> = [];
                const searchLower = searchTerm.toLowerCase();
                for (let i = 0; i < spec.lines.length; i++) {
                  if (spec.lines[i].toLowerCase().includes(searchLower)) {
                    matchingLines.push({ lineNum: i + 1, content: spec.lines[i] });
                  }
                }

                if (matchingLines.length > 0) {
                  filesWithMatches.push({ file: filename, matchingLines });
                }
              }

              // Execute grep
              const invocation = tool.createInvocation(
                { pattern: searchTerm, directory: testFixture.getTempDir() },
                createToolContext(messageBus)
              );
              const result = await invocation.execute(createMockAbortSignal());

              // Should not have an error
              expect(result.error).toBeUndefined();

              // Parse the result
              const resultLines = result.llmContent
                .split('\n')
                .filter(line => line.trim().length > 0);

              // Verify all expected matches are present
              for (const fileMatch of filesWithMatches) {
                for (const lineMatch of fileMatch.matchingLines) {
                  const expectedPattern = `${fileMatch.file}:${lineMatch.lineNum}:`;
                  const found = resultLines.some(line => {
                    const normalized = normalizePath(line);
                    return normalized.startsWith(expectedPattern) && normalized.includes(lineMatch.content);
                  });
                  expect(found).toBe(true);
                }
              }

              return true;
            } finally {
              await testFixture.cleanup();
            }
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should match pattern in file contents', async () => {
      // Feature: stage-03-tools-policy, Property 19: Grep Pattern Matching
      await fixture.createFile('file1.txt', 'hello world\nfoo bar\nhello again');
      await fixture.createFile('file2.txt', 'no match here\nnothing');
      await fixture.createFile('file3.txt', 'hello there\ntest');

      const invocation = tool.createInvocation(
        { pattern: 'hello', directory: fixture.getTempDir() },
        createToolContext(messageBus)
      );
      const result = await invocation.execute(createMockAbortSignal());

      expect(result.error).toBeUndefined();

      const lines = result.llmContent.split('\n').filter(l => l.trim().length > 0).map(normalizePath);

      // Should find matches in file1 and file3
      expect(lines.some(l => l.includes('file1.txt:1:') && l.includes('hello world'))).toBe(true);
      expect(lines.some(l => l.includes('file1.txt:3:') && l.includes('hello again'))).toBe(true);
      expect(lines.some(l => l.includes('file3.txt:1:') && l.includes('hello there'))).toBe(true);
      
      // Should not find matches in file2
      expect(lines.some(l => l.includes('file2.txt'))).toBe(false);
    });

    it('should handle regex patterns', async () => {
      // Feature: stage-03-tools-policy, Property 19: Grep Pattern Matching
      await fixture.createFile('test.txt', 'test123\ntest456\nabc789');

      const invocation = tool.createInvocation(
        { pattern: 'test\\d+', directory: fixture.getTempDir() },
        createToolContext(messageBus)
      );
      const result = await invocation.execute(createMockAbortSignal());

      expect(result.error).toBeUndefined();

      const lines = result.llmContent.split('\n').filter(l => l.trim().length > 0);

      // Should match lines with test followed by digits
      expect(lines.length).toBe(2);
      expect(lines.some(l => l.includes('test123'))).toBe(true);
      expect(lines.some(l => l.includes('test456'))).toBe(true);
    });

    it('should handle empty results when no matches found', async () => {
      // Feature: stage-03-tools-policy, Property 19: Grep Pattern Matching
      await fixture.createFile('file.txt', 'no match here');

      const invocation = tool.createInvocation(
        { pattern: 'xyz', directory: fixture.getTempDir() },
        createToolContext(messageBus)
      );
      const result = await invocation.execute(createMockAbortSignal());

      expect(result.error).toBeUndefined();
      expect(result.llmContent.trim()).toBe('');
    });
  });


  describe('Property 20: Grep Case Sensitivity', () => {
    it('should perform case-sensitive matching when caseSensitive is true', async () => {
      // Feature: stage-03-tools-policy, Property 20: Grep Case Sensitivity
      // Validates: Requirements 4.6, 4.7
      await fixture.createFile('test.txt', 'Hello World\nhello world\nHELLO WORLD');

      const invocation = tool.createInvocation(
        { pattern: 'Hello', directory: fixture.getTempDir(), caseSensitive: true },
        createToolContext(messageBus)
      );
      const result = await invocation.execute(createMockAbortSignal());

      expect(result.error).toBeUndefined();

      const lines = result.llmContent.split('\n').filter(l => l.trim().length > 0);

      // Should only match exact case
      expect(lines.length).toBe(1);
      expect(lines[0]).toContain('Hello World');
    });

    it('should perform case-insensitive matching when caseSensitive is false', async () => {
      // Feature: stage-03-tools-policy, Property 20: Grep Case Sensitivity
      // Validates: Requirements 4.6, 4.7
      await fixture.createFile('test.txt', 'Hello World\nhello world\nHELLO WORLD');

      const invocation = tool.createInvocation(
        { pattern: 'Hello', directory: fixture.getTempDir(), caseSensitive: false },
        createToolContext(messageBus)
      );
      const result = await invocation.execute(createMockAbortSignal());

      expect(result.error).toBeUndefined();

      const lines = result.llmContent.split('\n').filter(l => l.trim().length > 0);

      // Should match all cases
      expect(lines.length).toBe(3);
    });

    it('should default to case-insensitive matching', async () => {
      // Feature: stage-03-tools-policy, Property 20: Grep Case Sensitivity
      await fixture.createFile('test.txt', 'Hello World\nhello world');

      const invocation = tool.createInvocation(
        { pattern: 'HELLO', directory: fixture.getTempDir() },
        createToolContext(messageBus)
      );
      const result = await invocation.execute(createMockAbortSignal());

      expect(result.error).toBeUndefined();

      const lines = result.llmContent.split('\n').filter(l => l.trim().length > 0);

      // Should match both lines (case-insensitive by default)
      expect(lines.length).toBe(2);
    });
  });

  describe('Property 21: Grep File Pattern Filtering', () => {
    it('should only search files matching the filePattern', async () => {
      // Feature: stage-03-tools-policy, Property 21: Grep File Pattern Filtering
      // Validates: Requirement 4.8
      await fixture.createFile('test.ts', 'hello world');
      await fixture.createFile('test.js', 'hello world');
      await fixture.createFile('test.txt', 'hello world');

      const invocation = tool.createInvocation(
        { 
          pattern: 'hello', 
          directory: fixture.getTempDir(),
          filePattern: '**/*.ts'
        },
        createToolContext(messageBus)
      );
      const result = await invocation.execute(createMockAbortSignal());

      expect(result.error).toBeUndefined();

      const lines = result.llmContent.split('\n').filter(l => l.trim().length > 0).map(normalizePath);

      // Should only match in .ts files
      expect(lines.length).toBe(1);
      expect(lines[0]).toContain('test.ts');
    });

    it('should search all files when filePattern is not specified', async () => {
      // Feature: stage-03-tools-policy, Property 21: Grep File Pattern Filtering
      await fixture.createFile('file1.txt', 'match');
      await fixture.createFile('file2.js', 'match');
      await fixture.createFile('file3.ts', 'match');

      const invocation = tool.createInvocation(
        { pattern: 'match', directory: fixture.getTempDir() },
        createToolContext(messageBus)
      );
      const result = await invocation.execute(createMockAbortSignal());

      expect(result.error).toBeUndefined();

      const lines = result.llmContent.split('\n').filter(l => l.trim().length > 0);

      // Should match in all files
      expect(lines.length).toBe(3);
    });

    it('should support complex file patterns', async () => {
      // Feature: stage-03-tools-policy, Property 21: Grep File Pattern Filtering
      await fixture.createFile('src/index.ts', 'test');
      await fixture.createFile('src/utils.ts', 'test');
      await fixture.createFile('tests/test.ts', 'test');
      await fixture.createFile('readme.md', 'test');

      const invocation = tool.createInvocation(
        { 
          pattern: 'test', 
          directory: fixture.getTempDir(),
          filePattern: 'src/**/*.ts'
        },
        createToolContext(messageBus)
      );
      const result = await invocation.execute(createMockAbortSignal());

      expect(result.error).toBeUndefined();

      const lines = result.llmContent.split('\n').filter(l => l.trim().length > 0).map(normalizePath);

      // Should only match files in src directory
      expect(lines.length).toBe(2);
      expect(lines.some(l => l.includes('src/index.ts'))).toBe(true);
      expect(lines.some(l => l.includes('src/utils.ts'))).toBe(true);
    });
  });

  describe('Max Results', () => {
    it('should limit results when maxResults is specified', async () => {
      await fixture.createFile('test.txt', 'match\nmatch\nmatch\nmatch\nmatch');

      const invocation = tool.createInvocation(
        { pattern: 'match', directory: fixture.getTempDir(), maxResults: 3 },
        createToolContext(messageBus)
      );
      const result = await invocation.execute(createMockAbortSignal());

      expect(result.error).toBeUndefined();

      const lines = result.llmContent.split('\n').filter(l => l.trim().length > 0);

      expect(lines.length).toBe(3);
    });
  });

  describe('Tool Interface', () => {
    it('should provide correct description', () => {
      const invocation = tool.createInvocation(
        { pattern: 'test' },
        createToolContext(messageBus)
      );

      const description = invocation.getDescription();
      expect(description).toContain('test');
      expect(description).toContain('Search for');
    });

    it('should return correct tool locations', () => {
      const invocation = tool.createInvocation(
        { pattern: 'test', directory: '/test/dir' },
        createToolContext(messageBus)
      );

      const locations = invocation.toolLocations();
      expect(locations).toEqual(['/test/dir']);
    });

    it('should default to current directory when no directory specified', () => {
      const invocation = tool.createInvocation(
        { pattern: 'test' },
        createToolContext(messageBus)
      );

      const locations = invocation.toolLocations();
      expect(locations).toEqual(['.']);
    });

    it('should not require confirmation', async () => {
      const invocation = tool.createInvocation(
        { pattern: 'test' },
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
      expect(tool.name).toBe('grep');
      expect(tool.displayName).toBe('Search File Contents');
      expect(tool.schema.name).toBe('grep');
      expect(tool.schema.description).toBeDefined();
      expect(tool.schema.parameters).toBeDefined();
    });

    it('should have required pattern parameter', () => {
      const params = tool.schema.parameters as any;
      expect(params.properties.pattern).toBeDefined();
      expect(params.required).toContain('pattern');
    });

    it('should have optional parameters', () => {
      const params = tool.schema.parameters as any;
      expect(params.properties.directory).toBeDefined();
      expect(params.properties.filePattern).toBeDefined();
      expect(params.properties.caseSensitive).toBeDefined();
      expect(params.properties.maxResults).toBeDefined();
      expect(params.required).not.toContain('directory');
      expect(params.required).not.toContain('filePattern');
      expect(params.required).not.toContain('caseSensitive');
      expect(params.required).not.toContain('maxResults');
    });
  });
});
