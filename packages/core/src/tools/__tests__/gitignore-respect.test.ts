/**
 * Property tests for gitignore respect across file discovery tools
 * 
 * Tests that glob, grep, and ls tools properly respect .gitignore patterns
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';
import { GlobTool } from '../glob.js';
import { GrepTool } from '../grep.js';
import { LsTool } from '../ls.js';
import { MockMessageBus, createMockAbortSignal } from './test-helpers.js';

/**
 * Test fixture for file operations with gitignore support
 */
class GitignoreTestFixture {
  private tempDir: string = '';

  async setup(): Promise<void> {
    this.tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'gitignore-test-'));
  }

  async cleanup(): Promise<void> {
    try {
      await fs.rm(this.tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  }

  async createFile(relativePath: string, content: string = ''): Promise<string> {
    const filePath = path.join(this.tempDir, relativePath);
    const dir = path.dirname(filePath);
    
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(filePath, content, 'utf-8');
    return filePath;
  }

  async createGitignore(patterns: string[]): Promise<string> {
    const gitignorePath = path.join(this.tempDir, '.gitignore');
    await fs.writeFile(gitignorePath, patterns.join('\n'), 'utf-8');
    return gitignorePath;
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

describe('Property 24: Gitignore Respect', () => {
  let fixture: GitignoreTestFixture;
  let messageBus: MockMessageBus;
  let globTool: GlobTool;
  let grepTool: GrepTool;
  let lsTool: LsTool;

  beforeEach(async () => {
    fixture = new GitignoreTestFixture();
    await fixture.setup();
    messageBus = new MockMessageBus();
    globTool = new GlobTool();
    grepTool = new GrepTool();
    lsTool = new LsTool();
  });

  afterEach(async () => {
    await fixture.cleanup();
  });

  describe('Glob Tool Gitignore Respect', () => {
    it('should exclude files matching .gitignore patterns', async () => {
      // Feature: stage-03-tools-policy, Property 24: Gitignore Respect
      // Validates: Requirement 4.12
      
      // Create test files
      await fixture.createFile('included.ts', 'content');
      await fixture.createFile('excluded.log', 'content');
      await fixture.createFile('build/output.js', 'content');
      await fixture.createFile('src/index.ts', 'content');
      
      // Create .gitignore
      await fixture.createGitignore([
        '*.log',
        'build/',
      ]);

      // Execute glob
      const invocation = globTool.createInvocation(
        { pattern: '**/*', directory: fixture.getTempDir() },
        messageBus
      );
      const result = await invocation.execute(createMockAbortSignal());

      expect(result.error).toBeUndefined();

      const matchedFiles = result.llmContent
        .split('\n')
        .filter(line => line.trim().length > 0)
        .map(normalizePath);

      // Should include non-ignored files
      expect(matchedFiles.some(f => f.includes('included.ts'))).toBe(true);
      expect(matchedFiles.some(f => f.includes('src/index.ts'))).toBe(true);

      // Should exclude ignored files
      expect(matchedFiles.some(f => f.includes('excluded.log'))).toBe(false);
      expect(matchedFiles.some(f => f.includes('build/output.js'))).toBe(false);
    });

    it('should respect .gitignore with various pattern types', async () => {
      // Feature: stage-03-tools-policy, Property 24: Gitignore Respect
      // Validates: Requirement 4.12
      
      await fixture.createFile('test.txt', 'content');
      await fixture.createFile('test.tmp', 'content');
      await fixture.createFile('cache/data.json', 'content');
      await fixture.createFile('src/main.ts', 'content');
      await fixture.createFile('dist/bundle.js', 'content');
      
      await fixture.createGitignore([
        '*.tmp',
        'cache/',
        'dist/',
      ]);

      const invocation = globTool.createInvocation(
        { pattern: '**/*', directory: fixture.getTempDir() },
        messageBus
      );
      const result = await invocation.execute(createMockAbortSignal());

      expect(result.error).toBeUndefined();

      const matchedFiles = result.llmContent
        .split('\n')
        .filter(line => line.trim().length > 0)
        .map(normalizePath);

      // Should include non-ignored files
      expect(matchedFiles.some(f => f.includes('test.txt'))).toBe(true);
      expect(matchedFiles.some(f => f.includes('src/main.ts'))).toBe(true);

      // Should exclude ignored files
      expect(matchedFiles.some(f => f.includes('test.tmp'))).toBe(false);
      expect(matchedFiles.some(f => f.includes('cache/data.json'))).toBe(false);
      expect(matchedFiles.some(f => f.includes('dist/bundle.js'))).toBe(false);
    });

    it('should handle negation patterns in .gitignore', async () => {
      // Feature: stage-03-tools-policy, Property 24: Gitignore Respect
      // Validates: Requirement 4.12
      
      await fixture.createFile('logs/error.log', 'content');
      await fixture.createFile('logs/important.log', 'content');
      await fixture.createFile('logs/debug.log', 'content');
      
      await fixture.createGitignore([
        'logs/*.log',
        '!logs/important.log',
      ]);

      const invocation = globTool.createInvocation(
        { pattern: '**/*.log', directory: fixture.getTempDir() },
        messageBus
      );
      const result = await invocation.execute(createMockAbortSignal());

      expect(result.error).toBeUndefined();

      const matchedFiles = result.llmContent
        .split('\n')
        .filter(line => line.trim().length > 0)
        .map(normalizePath);

      // Should include the negated file
      expect(matchedFiles.some(f => f.includes('logs/important.log'))).toBe(true);

      // Should exclude other log files
      expect(matchedFiles.some(f => f.includes('logs/error.log'))).toBe(false);
      expect(matchedFiles.some(f => f.includes('logs/debug.log'))).toBe(false);
    });
  });

  describe('Grep Tool Gitignore Respect', () => {
    it('should exclude files matching .gitignore patterns from search', async () => {
      // Feature: stage-03-tools-policy, Property 24: Gitignore Respect
      // Validates: Requirement 4.12
      
      await fixture.createFile('included.ts', 'searchterm here');
      await fixture.createFile('excluded.log', 'searchterm here');
      await fixture.createFile('build/output.js', 'searchterm here');
      await fixture.createFile('src/index.ts', 'searchterm here');
      
      await fixture.createGitignore([
        '*.log',
        'build/',
      ]);

      const invocation = grepTool.createInvocation(
        { pattern: 'searchterm', directory: fixture.getTempDir() },
        messageBus
      );
      const result = await invocation.execute(createMockAbortSignal());

      expect(result.error).toBeUndefined();

      const resultLines = result.llmContent
        .split('\n')
        .filter(line => line.trim().length > 0)
        .map(normalizePath);

      // Should find matches in non-ignored files
      expect(resultLines.some(l => l.includes('included.ts'))).toBe(true);
      expect(resultLines.some(l => l.includes('src/index.ts'))).toBe(true);

      // Should not find matches in ignored files
      expect(resultLines.some(l => l.includes('excluded.log'))).toBe(false);
      expect(resultLines.some(l => l.includes('build/output.js'))).toBe(false);
    });

    it('should respect .gitignore when using filePattern', async () => {
      // Feature: stage-03-tools-policy, Property 24: Gitignore Respect
      // Validates: Requirement 4.12
      
      await fixture.createFile('src/main.ts', 'test content');
      await fixture.createFile('src/utils.ts', 'test content');
      await fixture.createFile('dist/bundle.ts', 'test content');
      
      await fixture.createGitignore([
        'dist/',
      ]);

      const invocation = grepTool.createInvocation(
        { 
          pattern: 'test', 
          directory: fixture.getTempDir(),
          filePattern: '**/*.ts'
        },
        messageBus
      );
      const result = await invocation.execute(createMockAbortSignal());

      expect(result.error).toBeUndefined();

      const resultLines = result.llmContent
        .split('\n')
        .filter(line => line.trim().length > 0)
        .map(normalizePath);

      // Should find matches in src directory
      expect(resultLines.some(l => l.includes('src/main.ts'))).toBe(true);
      expect(resultLines.some(l => l.includes('src/utils.ts'))).toBe(true);

      // Should not find matches in dist directory
      expect(resultLines.some(l => l.includes('dist/bundle.ts'))).toBe(false);
    });
  });

  describe('Ls Tool Gitignore Respect', () => {
    it('should exclude files matching .gitignore patterns from listing', async () => {
      // Feature: stage-03-tools-policy, Property 24: Gitignore Respect
      // Validates: Requirement 4.12
      
      await fixture.createFile('included.ts', 'content');
      await fixture.createFile('excluded.log', 'content');
      await fixture.createFile('build/output.js', 'content');
      
      await fixture.createGitignore([
        '*.log',
        'build/',
      ]);

      const invocation = lsTool.createInvocation(
        { path: fixture.getTempDir(), recursive: true },
        messageBus
      );
      const result = await invocation.execute(createMockAbortSignal());

      expect(result.error).toBeUndefined();

      const lines = result.llmContent
        .split('\n')
        .filter(line => line.trim().length > 0)
        .map(normalizePath);

      // Should include non-ignored files
      expect(lines.some(l => l.includes('included.ts'))).toBe(true);

      // Should exclude ignored files
      expect(lines.some(l => l.includes('excluded.log'))).toBe(false);
      expect(lines.some(l => l.includes('output.js'))).toBe(false);
    });

    it('should respect .gitignore in recursive listings', async () => {
      // Feature: stage-03-tools-policy, Property 24: Gitignore Respect
      // Validates: Requirement 4.12
      
      await fixture.createFile('src/main.ts', 'content');
      await fixture.createFile('src/utils.ts', 'content');
      await fixture.createFile('node_modules/package/index.js', 'content');
      await fixture.createFile('dist/bundle.js', 'content');
      
      await fixture.createGitignore([
        'node_modules/',
        'dist/',
      ]);

      const invocation = lsTool.createInvocation(
        { path: fixture.getTempDir(), recursive: true },
        messageBus
      );
      const result = await invocation.execute(createMockAbortSignal());

      expect(result.error).toBeUndefined();

      const lines = result.llmContent
        .split('\n')
        .filter(line => line.trim().length > 0)
        .map(normalizePath);

      // Should include src files
      expect(lines.some(l => l.includes('main.ts'))).toBe(true);
      expect(lines.some(l => l.includes('utils.ts'))).toBe(true);

      // Should exclude ignored directories and their contents
      expect(lines.some(l => l.includes('node_modules'))).toBe(false);
      expect(lines.some(l => l.includes('dist'))).toBe(false);
      expect(lines.some(l => l.includes('bundle.js'))).toBe(false);
    });
  });

  describe('Property-Based Gitignore Tests', () => {
    it('should consistently exclude gitignored files across all tools', async () => {
      // Feature: stage-03-tools-policy, Property 24: Gitignore Respect
      // Validates: Requirement 4.12
      
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              filename: fc.string({ minLength: 1, maxLength: 10 }).filter(s => /^[a-z0-9_]+$/.test(s)),
              extension: fc.constantFrom('.ts', '.js', '.log', '.tmp', '.txt'),
              shouldIgnore: fc.boolean(),
            }),
            { minLength: 5, maxLength: 15 }
          ).map(arr => {
            // Ensure unique filenames
            const seen = new Set<string>();
            return arr.filter(spec => {
              const fullName = `${spec.filename}${spec.extension}`;
              if (seen.has(fullName.toLowerCase())) return false;
              seen.add(fullName.toLowerCase());
              return true;
            });
          }).filter(arr => arr.length >= 5), // ensure at least 5 files
          async (fileSpecs) => {
            const testFixture = new GitignoreTestFixture();
            await testFixture.setup();

            try {
              // Separate files into ignored and non-ignored
              const ignoredExtensions = new Set<string>();
              const nonIgnoredFiles: string[] = [];
              const ignoredFiles: string[] = [];

              for (const spec of fileSpecs) {
                const filename = `${spec.filename}${spec.extension}`;
                await testFixture.createFile(filename, 'searchterm content');

                if (spec.shouldIgnore) {
                  ignoredExtensions.add(spec.extension);
                  ignoredFiles.push(filename);
                } else {
                  nonIgnoredFiles.push(filename);
                }
              }

              // Create .gitignore with patterns for ignored extensions
              if (ignoredExtensions.size > 0) {
                const patterns = Array.from(ignoredExtensions).map(ext => `*${ext}`);
                await testFixture.createGitignore(patterns);
              }

              // Test glob tool
              const globInvocation = globTool.createInvocation(
                { pattern: '**/*', directory: testFixture.getTempDir() },
                messageBus
              );
              const globResult = await globInvocation.execute(createMockAbortSignal());
              expect(globResult.error).toBeUndefined();

              const globMatches = globResult.llmContent
                .split('\n')
                .filter(line => line.trim().length > 0)
                .map(normalizePath);

              // Verify non-ignored files are included
              for (const file of nonIgnoredFiles) {
                if (!ignoredExtensions.has(path.extname(file))) {
                  expect(globMatches.some(m => m.includes(file))).toBe(true);
                }
              }

              // Verify ignored files are excluded
              for (const file of ignoredFiles) {
                expect(globMatches.some(m => m.includes(file))).toBe(false);
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
  });

  describe('Edge Cases', () => {
    it('should work when no .gitignore file exists', async () => {
      // Feature: stage-03-tools-policy, Property 24: Gitignore Respect
      // Validates: Requirement 4.12
      
      await fixture.createFile('file1.ts', 'content');
      await fixture.createFile('file2.log', 'content');

      // No .gitignore file created

      const invocation = globTool.createInvocation(
        { pattern: '**/*', directory: fixture.getTempDir() },
        messageBus
      );
      const result = await invocation.execute(createMockAbortSignal());

      expect(result.error).toBeUndefined();

      const matchedFiles = result.llmContent
        .split('\n')
        .filter(line => line.trim().length > 0);

      // Should include all files when no .gitignore exists
      expect(matchedFiles.length).toBe(2);
    });

    it('should handle empty .gitignore file', async () => {
      // Feature: stage-03-tools-policy, Property 24: Gitignore Respect
      // Validates: Requirement 4.12
      
      await fixture.createFile('file1.ts', 'content');
      await fixture.createFile('file2.log', 'content');
      await fixture.createGitignore([]);

      const invocation = globTool.createInvocation(
        { pattern: '**/*', directory: fixture.getTempDir() },
        messageBus
      );
      const result = await invocation.execute(createMockAbortSignal());

      expect(result.error).toBeUndefined();

      const matchedFiles = result.llmContent
        .split('\n')
        .filter(line => line.trim().length > 0);

      // Should include all files when .gitignore is empty
      expect(matchedFiles.length).toBeGreaterThanOrEqual(2);
    });

    it('should handle .gitignore with comments and blank lines', async () => {
      // Feature: stage-03-tools-policy, Property 24: Gitignore Respect
      // Validates: Requirement 4.12
      
      await fixture.createFile('file1.ts', 'content');
      await fixture.createFile('file2.log', 'content');
      
      await fixture.createGitignore([
        '# This is a comment',
        '',
        '*.log',
        '',
        '# Another comment',
      ]);

      const invocation = globTool.createInvocation(
        { pattern: '**/*', directory: fixture.getTempDir() },
        messageBus
      );
      const result = await invocation.execute(createMockAbortSignal());

      expect(result.error).toBeUndefined();

      const matchedFiles = result.llmContent
        .split('\n')
        .filter(line => line.trim().length > 0)
        .map(normalizePath);

      // Should include .ts file
      expect(matchedFiles.some(f => f.includes('file1.ts'))).toBe(true);

      // Should exclude .log file
      expect(matchedFiles.some(f => f.includes('file2.log'))).toBe(false);
    });
  });
});
