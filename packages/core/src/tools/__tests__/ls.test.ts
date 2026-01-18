/**
 * Tests for Ls Tool
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';
import { LsTool, LsInvocation } from '../ls.js';
import { MockMessageBus, createMockAbortSignal, createToolContext } from './test-helpers.js';

/**
 * Test fixture for file operations
 */
class FileTestFixture {
  private tempDir: string = '';
  private createdPaths: string[] = [];

  async setup(): Promise<void> {
    this.tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ls-test-'));
  }

  async cleanup(): Promise<void> {
    try {
      await fs.rm(this.tempDir, { recursive: true, force: true });
    } catch (_error) {
      // Ignore
    }
    this.createdPaths = [];
  }

  async createFile(relativePath: string, content: string = ''): Promise<string> {
    const filePath = path.join(this.tempDir, relativePath);
    const dir = path.dirname(filePath);

    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(filePath, content, 'utf-8');
    this.createdPaths.push(filePath);
    return filePath;
  }

  async createDir(relativePath: string): Promise<string> {
    const dirPath = path.join(this.tempDir, relativePath);
    await fs.mkdir(dirPath, { recursive: true });
    this.createdPaths.push(dirPath);
    return dirPath;
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

describe('Ls Tool', () => {
  let fixture: FileTestFixture;
  let messageBus: MockMessageBus;
  let tool: LsTool;

  beforeEach(async () => {
    fixture = new FileTestFixture();
    await fixture.setup();
    messageBus = new MockMessageBus();
    tool = new LsTool();
  });

  afterEach(async () => {
    await fixture.cleanup();
  });

  describe('Property 22: Directory Listing Completeness', () => {
    it('should return all non-hidden entries by default', async () => {
      // Feature: stage-03-tools-policy, Property 22: Directory Listing Completeness
      // Validates: Requirement 4.9
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.string({ minLength: 1, maxLength: 10 }).filter(s => /^[a-z0-9_-]+$/.test(s)), // lowercase only for case-insensitive filesystems
            { minLength: 1, maxLength: 10 }
          ).map(arr => Array.from(new Set(arr))), // ensure unique filenames
          fc.array(
            fc.string({ minLength: 1, maxLength: 10 }).filter(s => /^[a-z0-9_-]+$/.test(s)),
            { minLength: 0, maxLength: 5 }
          ).map(arr => Array.from(new Set(arr))), // ensure unique filenames
          async (visibleFiles, hiddenFiles) => {
            const testFixture = new FileTestFixture();
            await testFixture.setup();

            try {
              // Create visible files
              for (const filename of visibleFiles) {
                await testFixture.createFile(`${filename}.txt`, 'content');
              }

              // Create hidden files (starting with .)
              for (const filename of hiddenFiles) {
                await testFixture.createFile(`.${filename}.txt`, 'content');
              }

              // Execute ls without includeHidden
              const invocation = tool.createInvocation(
                { path: testFixture.getTempDir() },
                createToolContext(messageBus)
              );
              const result = await invocation.execute(createMockAbortSignal());

              expect(result.error).toBeUndefined();

              const lines = result.llmContent
                .split('\n')
                .filter(line => line.trim().length > 0)
                .map(normalizePath);

              // Should include all visible files (format: "- filename.txt")
              for (const filename of visibleFiles) {
                const found = lines.some(line => line.includes(`- ${filename}.txt`));
                expect(found).toBe(true);
              }

              // Should not include hidden files
              for (const filename of hiddenFiles) {
                const found = lines.some(line => line.includes(`.${filename}.txt`));
                expect(found).toBe(false);
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

    it('should return all entries including hidden when includeHidden is true', async () => {
      // Feature: stage-03-tools-policy, Property 22: Directory Listing Completeness
      // Validates: Requirement 4.9
      await fixture.createFile('visible.txt', 'content');
      await fixture.createFile('.hidden.txt', 'content');
      await fixture.createDir('.hidden-dir');
      await fixture.createFile('.hidden-dir/file.txt', 'content');

      const invocation = tool.createInvocation(
        { path: fixture.getTempDir(), includeHidden: true },
        createToolContext(messageBus)
      );
      const result = await invocation.execute(createMockAbortSignal());

      expect(result.error).toBeUndefined();

      const lines = result.llmContent
        .split('\n')
        .filter(line => line.trim().length > 0)
        .map(normalizePath);

      // Should include visible files
      expect(lines.some(line => line.includes('- visible.txt'))).toBe(true);

      // Should include hidden files
      expect(lines.some(line => line.includes('- .hidden.txt'))).toBe(true);

      // Should include hidden directories
      expect(lines.some(line => line.includes('d .hidden-dir'))).toBe(true);
    });

    it('should list directory contents', async () => {
      // Feature: stage-03-tools-policy, Property 22: Directory Listing Completeness
      await fixture.createFile('file1.txt', 'content');
      await fixture.createFile('file2.js', 'code');
      await fixture.createDir('subdir');

      const invocation = tool.createInvocation(
        { path: fixture.getTempDir() },
        createToolContext(messageBus)
      );
      const result = await invocation.execute(createMockAbortSignal());

      expect(result.error).toBeUndefined();

      const lines = result.llmContent
        .split('\n')
        .filter(line => line.trim().length > 0)
        .map(normalizePath);

      expect(lines.some(line => line.includes('- file1.txt'))).toBe(true);
      expect(lines.some(line => line.includes('- file2.js'))).toBe(true);
      expect(lines.some(line => line.includes('d subdir'))).toBe(true);
    });
  });

  describe('Property 23: Directory Listing Recursion', () => {
    it('should include subdirectory contents when recursive is true', async () => {
      // Feature: stage-03-tools-policy, Property 23: Directory Listing Recursion
      // Validates: Requirements 4.10, 4.11
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              dir: fc.string({ minLength: 1, maxLength: 8 }).filter(s => /^[a-z0-9_]+$/.test(s)), // lowercase, no hyphens
              files: fc.array(
                fc.string({ minLength: 1, maxLength: 8 }).filter(s => /^[a-z0-9_]+$/.test(s) && s !== '-'), // no hyphens
                { minLength: 1, maxLength: 5 }
              ).map(arr => Array.from(new Set(arr))), // ensure unique filenames
            }),
            { minLength: 1, maxLength: 5 }
          ).map(arr => {
            // Ensure unique directory names
            const seen = new Set<string>();
            return arr.filter(spec => {
              if (seen.has(spec.dir)) return false;
              seen.add(spec.dir);
              return true;
            });
          }).filter(arr => arr.length > 0), // ensure at least one directory
          async (dirSpecs) => {
            const testFixture = new FileTestFixture();
            await testFixture.setup();

            try {
              // Create directory structure
              const expectedFiles: string[] = [];

              for (const spec of dirSpecs) {
                for (const filename of spec.files) {
                  const relativePath = `${spec.dir}/${filename}.txt`;
                  await testFixture.createFile(relativePath, 'content');
                  expectedFiles.push(normalizePath(relativePath));
                }
              }

              // Execute ls with recursive
              const invocation = tool.createInvocation(
                { path: testFixture.getTempDir(), recursive: true },
                createToolContext(messageBus)
              );
              const result = await invocation.execute(createMockAbortSignal());

              expect(result.error).toBeUndefined();

              const lines = result.llmContent
                .split('\n')
                .filter(line => line.trim().length > 0)
                .map(normalizePath);

              // Should include all files in subdirectories (just the filename, not full path)
              for (const spec of dirSpecs) {
                for (const filename of spec.files) {
                  const found = lines.some(line => line.includes(`- ${filename}.txt`));
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

    it('should respect maxDepth when specified', async () => {
      // Feature: stage-03-tools-policy, Property 23: Directory Listing Recursion
      // Validates: Requirements 4.10, 4.11
      await fixture.createFile('root.txt', 'content');
      await fixture.createFile('level1/file1.txt', 'content');
      await fixture.createFile('level1/level2/file2.txt', 'content');
      await fixture.createFile('level1/level2/level3/file3.txt', 'content');

      const invocation = tool.createInvocation(
        { path: fixture.getTempDir(), recursive: true, maxDepth: 2 },
        createToolContext(messageBus)
      );
      const result = await invocation.execute(createMockAbortSignal());

      expect(result.error).toBeUndefined();

      const lines = result.llmContent
        .split('\n')
        .filter(line => line.trim().length > 0)
        .map(normalizePath);

      // Should include files up to depth 2
      expect(lines.some(line => line.includes('- root.txt'))).toBe(true);
      expect(lines.some(line => line.includes('- file1.txt'))).toBe(true);
      expect(lines.some(line => line.includes('- file2.txt'))).toBe(true);

      // Should not include files at depth 3
      expect(lines.some(line => line.includes('- file3.txt'))).toBe(false);
    });

    it('should not recurse when recursive is false', async () => {
      // Feature: stage-03-tools-policy, Property 23: Directory Listing Recursion
      await fixture.createFile('root.txt', 'content');
      await fixture.createDir('subdir');
      await fixture.createFile('subdir/nested.txt', 'content');

      const invocation = tool.createInvocation(
        { path: fixture.getTempDir(), recursive: false },
        createToolContext(messageBus)
      );
      const result = await invocation.execute(createMockAbortSignal());

      expect(result.error).toBeUndefined();

      const lines = result.llmContent
        .split('\n')
        .filter(line => line.trim().length > 0)
        .map(normalizePath);

      // Should include root level files and directories
      expect(lines.some(line => line.includes('- root.txt'))).toBe(true);
      expect(lines.some(line => line.includes('d subdir'))).toBe(true);

      // Should not include nested files
      expect(lines.some(line => line.includes('- nested.txt'))).toBe(false);
    });
  });

  describe('Tool Interface', () => {
    it('should provide correct description', () => {
      const invocation = tool.createInvocation(
        { path: '/test/dir' },
        createToolContext(messageBus)
      );

      const description = invocation.getDescription();
      expect(description).toContain('/test/dir');
      expect(description).toContain('List');
    });

    it('should return correct tool locations', () => {
      const invocation = tool.createInvocation(
        { path: '/test/dir' },
        createToolContext(messageBus)
      );

      const locations = invocation.toolLocations();
      expect(locations).toEqual(['/test/dir']);
    });

    it('should not require confirmation', async () => {
      const invocation = tool.createInvocation(
        { path: '/test/dir' },
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
      expect(tool.name).toBe('ls');
      expect(tool.displayName).toBe('List Directory');
      expect(tool.schema.name).toBe('ls');
      expect(tool.schema.description).toBeDefined();
      expect(tool.schema.parameters).toBeDefined();
    });

    it('should have required path parameter', () => {
      const params = tool.schema.parameters as any;
      expect(params.properties.path).toBeDefined();
      expect(params.required).toContain('path');
    });

    it('should have optional parameters', () => {
      const params = tool.schema.parameters as any;
      expect(params.properties.recursive).toBeDefined();
      expect(params.properties.includeHidden).toBeDefined();
      expect(params.properties.maxDepth).toBeDefined();
      expect(params.required).not.toContain('recursive');
      expect(params.required).not.toContain('includeHidden');
      expect(params.required).not.toContain('maxDepth');
    });
  });
});
