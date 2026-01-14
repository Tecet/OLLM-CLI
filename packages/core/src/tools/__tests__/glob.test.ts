/**
 * Tests for Glob Tool
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';
import { GlobTool, GlobInvocation } from '../glob.js';
import { MockMessageBus, createMockAbortSignal, createToolContext } from './test-helpers.js';

/**
 * Test fixture for file operations
 */
class FileTestFixture {
  private tempDir: string = '';
  private createdFiles: string[] = [];
  private createdDirs: string[] = [];

  async setup(): Promise<void> {
    // Create a temporary directory for test files
    this.tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'glob-test-'));
  }

  async cleanup(): Promise<void> {
    // Clean up all created files and the temp directory
    try {
      await fs.rm(this.tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
    this.createdFiles = [];
    this.createdDirs = [];
  }

  async createFile(relativePath: string, content: string = ''): Promise<string> {
    const filePath = path.join(this.tempDir, relativePath);
    const dir = path.dirname(filePath);
    
    // Create parent directories if needed
    await fs.mkdir(dir, { recursive: true });
    
    await fs.writeFile(filePath, content, 'utf-8');
    this.createdFiles.push(filePath);
    return filePath;
  }

  async createDirectory(relativePath: string): Promise<string> {
    const dirPath = path.join(this.tempDir, relativePath);
    await fs.mkdir(dirPath, { recursive: true });
    this.createdDirs.push(dirPath);
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
 * Filter for valid filename parts (cross-platform)
 */
function isValidFilenamePart(s: string): boolean {
  // Filter out invalid filename characters for Windows/Unix
  const invalidChars = /[<>:"|?*\\/]/;
  // Also filter out "." and ".." which are special directory references
  // Filter out strings that are only whitespace or start with whitespace
  // Filter out strings that start with a dot (hidden files)
  return !invalidChars.test(s) && s.trim().length > 0 && s === s.trim() && s !== '.' && s !== '..' && !s.includes('/') && !s.startsWith('.');
}

/**
 * Normalize path separators to forward slashes for cross-platform testing
 * On Windows, also normalize case since the file system is case-insensitive
 */
function normalizePath(p: string): string {
  const normalized = p.replace(/\\/g, '/');
  // On Windows, normalize to lowercase for comparison since FS is case-insensitive
  return process.platform === 'win32' ? normalized.toLowerCase() : normalized;
}

/**
 * Check if a file matches a glob pattern
 * This is a simple implementation for testing purposes
 */
function matchesPattern(filePath: string, pattern: string): boolean {
  // Convert glob pattern to regex
  // This is a simplified implementation for testing
  let regexPattern = pattern
    .replace(/\./g, '\\.')
    .replace(/\*\*/g, '§§') // Temporary placeholder for **
    .replace(/\*/g, '[^/]*')
    .replace(/§§/g, '.*')
    .replace(/\?/g, '.');
  
  // Handle patterns that start with **/ or contain /**/
  regexPattern = '^' + regexPattern + '$';
  
  const regex = new RegExp(regexPattern);
  return regex.test(filePath);
}

describe('Glob Tool', () => {
  let fixture: FileTestFixture;
  let messageBus: MockMessageBus;
  let tool: GlobTool;

  beforeEach(async () => {
    fixture = new FileTestFixture();
    await fixture.setup();
    messageBus = new MockMessageBus();
    tool = new GlobTool();
  });

  afterEach(async () => {
    await fixture.cleanup();
  });

  describe('Property 16: Glob Pattern Matching', () => {
    it('should return all and only files that match the pattern', async () => {
      // Feature: stage-03-tools-policy, Property 16: Glob Pattern Matching
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              path: fc.array(
                fc.string({ minLength: 1, maxLength: 10 }).filter(isValidFilenamePart),
                { minLength: 1, maxLength: 3 }
              ),
              extension: fc.constantFrom('.ts', '.js', '.txt', '.md', '.json'),
            }),
            { minLength: 3, maxLength: 10 }
          ),
          async (fileSpecs) => {
            // Create a fresh fixture for each test
            const testFixture = new FileTestFixture();
            await testFixture.setup();

            try {
              // Create files with various paths and extensions
              const createdFiles: string[] = [];
              for (const spec of fileSpecs) {
                const filename = spec.path.join('/') + spec.extension;
                const absolutePath = await testFixture.createFile(filename);
                createdFiles.push(absolutePath);
              }

              // Test with a specific extension pattern
              const testExtension = fileSpecs[0]?.extension || '.ts';
              const pattern = `**/*${testExtension}`;

              // Execute glob
              const invocation = tool.createInvocation(
                { pattern, directory: testFixture.getTempDir() },
                createToolContext(messageBus)
              );
              const result = await invocation.execute(createMockAbortSignal());

              // Should not have an error
              expect(result.error).toBeUndefined();

              // Parse the result (newline-separated file paths)
              const matchedFiles = result.llmContent
                .split('\n')
                .filter((line) => line.trim().length > 0)
                .map(normalizePath);

              // Determine which files should match
              const expectedMatches = createdFiles.filter((filePath) => {
                const relativePath = normalizePath(testFixture.getRelativePath(filePath));
                return relativePath.endsWith(testExtension);
              });

              // All matched files should have the correct extension
              for (const matchedFile of matchedFiles) {
                expect(matchedFile).toMatch(new RegExp(`\\${testExtension}$`));
              }

              // All files with the extension should be in the results
              for (const expectedFile of expectedMatches) {
                const relativePath = normalizePath(testFixture.getRelativePath(expectedFile));
                expect(matchedFiles).toContain(relativePath);
              }

              // No files without the extension should be in the results
              const unexpectedMatches = createdFiles.filter((filePath) => {
                const relativePath = normalizePath(testFixture.getRelativePath(filePath));
                return !relativePath.endsWith(testExtension);
              });

              for (const unexpectedFile of unexpectedMatches) {
                const relativePath = normalizePath(testFixture.getRelativePath(unexpectedFile));
                expect(matchedFiles).not.toContain(relativePath);
              }

              return true;
            } finally {
              await testFixture.cleanup();
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should match all files with wildcard pattern', async () => {
      // Feature: stage-03-tools-policy, Property 16: Glob Pattern Matching
      const files = [
        'file1.ts',
        'file2.js',
        'dir/file3.txt',
        'dir/subdir/file4.md',
      ];

      for (const file of files) {
        await fixture.createFile(file);
      }

      const invocation = tool.createInvocation(
        { pattern: '**/*', directory: fixture.getTempDir() },
        createToolContext(messageBus)
      );
      const result = await invocation.execute(createMockAbortSignal());

      expect(result.error).toBeUndefined();

      const matchedFiles = result.llmContent
        .split('\n')
        .filter((line) => line.trim().length > 0);

      // Should match all files
      expect(matchedFiles.length).toBe(files.length);
    });

    it('should match files in specific directory with pattern', async () => {
      // Feature: stage-03-tools-policy, Property 16: Glob Pattern Matching
      await fixture.createFile('root.ts');
      await fixture.createFile('src/index.ts');
      await fixture.createFile('src/utils.ts');
      await fixture.createFile('tests/test.ts');

      const invocation = tool.createInvocation(
        { pattern: 'src/**/*.ts', directory: fixture.getTempDir() },
        createToolContext(messageBus)
      );
      const result = await invocation.execute(createMockAbortSignal());

      expect(result.error).toBeUndefined();

      const matchedFiles = result.llmContent
        .split('\n')
        .filter((line) => line.trim().length > 0)
        .map(normalizePath);

      // Should only match files in src directory
      expect(matchedFiles).toContain('src/index.ts');
      expect(matchedFiles).toContain('src/utils.ts');
      expect(matchedFiles).not.toContain('root.ts');
      expect(matchedFiles).not.toContain('tests/test.ts');
    });

    it('should match files with single character wildcard', async () => {
      // Feature: stage-03-tools-policy, Property 16: Glob Pattern Matching
      await fixture.createFile('file1.ts');
      await fixture.createFile('file2.ts');
      await fixture.createFile('file10.ts');
      await fixture.createFile('fileA.ts');

      const invocation = tool.createInvocation(
        { pattern: 'file?.ts', directory: fixture.getTempDir() },
        createToolContext(messageBus)
      );
      const result = await invocation.execute(createMockAbortSignal());

      expect(result.error).toBeUndefined();

      const matchedFiles = result.llmContent
        .split('\n')
        .filter((line) => line.trim().length > 0);

      // Should match single character wildcards
      expect(matchedFiles).toContain('file1.ts');
      expect(matchedFiles).toContain('file2.ts');
      expect(matchedFiles).toContain('fileA.ts');
      // Should not match multi-character
      expect(matchedFiles).not.toContain('file10.ts');
    });

    it('should handle empty results when no files match', async () => {
      // Feature: stage-03-tools-policy, Property 16: Glob Pattern Matching
      await fixture.createFile('file.ts');
      await fixture.createFile('file.js');

      const invocation = tool.createInvocation(
        { pattern: '**/*.py', directory: fixture.getTempDir() },
        createToolContext(messageBus)
      );
      const result = await invocation.execute(createMockAbortSignal());

      expect(result.error).toBeUndefined();
      expect(result.llmContent.trim()).toBe('');
    });

    it('should match exact filename without wildcards', async () => {
      // Feature: stage-03-tools-policy, Property 16: Glob Pattern Matching
      await fixture.createFile('exact.ts');
      await fixture.createFile('other.ts');

      const invocation = tool.createInvocation(
        { pattern: 'exact.ts', directory: fixture.getTempDir() },
        createToolContext(messageBus)
      );
      const result = await invocation.execute(createMockAbortSignal());

      expect(result.error).toBeUndefined();

      const matchedFiles = result.llmContent
        .split('\n')
        .filter((line) => line.trim().length > 0);

      expect(matchedFiles).toContain('exact.ts');
      expect(matchedFiles).not.toContain('other.ts');
      expect(matchedFiles.length).toBe(1);
    });
  });

  describe('Property 17: Glob Max Results Constraint', () => {
    it('should return at most maxResults files when specified', async () => {
      // Feature: stage-03-tools-policy, Property 17: Glob Max Results Constraint
      // Validates: Requirement 4.2
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 5, max: 20 }), // Number of files to create
          fc.integer({ min: 1, max: 10 }), // maxResults value
          async (numFiles, maxResults) => {
            // Create a fresh fixture for each test
            const testFixture = new FileTestFixture();
            await testFixture.setup();

            try {
              // Create numFiles files
              const files: string[] = [];
              for (let i = 0; i < numFiles; i++) {
                const filename = `file${i}.ts`;
                await testFixture.createFile(filename);
                files.push(filename);
              }

              // Execute glob with maxResults
              const invocation = tool.createInvocation(
                { 
                  pattern: '**/*.ts', 
                  directory: testFixture.getTempDir(),
                  maxResults 
                },
                createToolContext(messageBus)
              );
              const result = await invocation.execute(createMockAbortSignal());

              // Should not have an error
              expect(result.error).toBeUndefined();

              // Parse the result
              const matchedFiles = result.llmContent
                .split('\n')
                .filter((line) => line.trim().length > 0);

              // Should return at most maxResults files
              expect(matchedFiles.length).toBeLessThanOrEqual(maxResults);

              // If there are more files than maxResults, should return exactly maxResults
              if (numFiles > maxResults) {
                expect(matchedFiles.length).toBe(maxResults);
              } else {
                // If there are fewer files than maxResults, should return all files
                expect(matchedFiles.length).toBe(numFiles);
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

    it('should return all files when maxResults is not specified', async () => {
      // Feature: stage-03-tools-policy, Property 17: Glob Max Results Constraint
      // Validates: Requirement 4.2
      const numFiles = 15;
      for (let i = 0; i < numFiles; i++) {
        await fixture.createFile(`file${i}.ts`);
      }

      const invocation = tool.createInvocation(
        { pattern: '**/*.ts', directory: fixture.getTempDir() },
        createToolContext(messageBus)
      );
      const result = await invocation.execute(createMockAbortSignal());

      expect(result.error).toBeUndefined();

      const matchedFiles = result.llmContent
        .split('\n')
        .filter((line) => line.trim().length > 0);

      // Should return all files when maxResults is not specified
      expect(matchedFiles.length).toBe(numFiles);
    });

    it('should return all files when maxResults is greater than number of matches', async () => {
      // Feature: stage-03-tools-policy, Property 17: Glob Max Results Constraint
      // Validates: Requirement 4.2
      const numFiles = 5;
      for (let i = 0; i < numFiles; i++) {
        await fixture.createFile(`file${i}.ts`);
      }

      const invocation = tool.createInvocation(
        { 
          pattern: '**/*.ts', 
          directory: fixture.getTempDir(),
          maxResults: 100 
        },
        createToolContext(messageBus)
      );
      const result = await invocation.execute(createMockAbortSignal());

      expect(result.error).toBeUndefined();

      const matchedFiles = result.llmContent
        .split('\n')
        .filter((line) => line.trim().length > 0);

      // Should return all files when maxResults exceeds available files
      expect(matchedFiles.length).toBe(numFiles);
    });

    it('should handle maxResults of 1', async () => {
      // Feature: stage-03-tools-policy, Property 17: Glob Max Results Constraint
      // Validates: Requirement 4.2
      await fixture.createFile('file1.ts');
      await fixture.createFile('file2.ts');
      await fixture.createFile('file3.ts');

      const invocation = tool.createInvocation(
        { 
          pattern: '**/*.ts', 
          directory: fixture.getTempDir(),
          maxResults: 1 
        },
        createToolContext(messageBus)
      );
      const result = await invocation.execute(createMockAbortSignal());

      expect(result.error).toBeUndefined();

      const matchedFiles = result.llmContent
        .split('\n')
        .filter((line) => line.trim().length > 0);

      // Should return exactly 1 file
      expect(matchedFiles.length).toBe(1);
    });

    it('should handle maxResults of 0', async () => {
      // Feature: stage-03-tools-policy, Property 17: Glob Max Results Constraint
      // Validates: Requirement 4.2
      await fixture.createFile('file1.ts');
      await fixture.createFile('file2.ts');

      const invocation = tool.createInvocation(
        { 
          pattern: '**/*.ts', 
          directory: fixture.getTempDir(),
          maxResults: 0 
        },
        createToolContext(messageBus)
      );
      const result = await invocation.execute(createMockAbortSignal());

      expect(result.error).toBeUndefined();

      const matchedFiles = result.llmContent
        .split('\n')
        .filter((line) => line.trim().length > 0);

      // Should return no files when maxResults is 0
      expect(matchedFiles.length).toBe(0);
    });
  });

  describe('Property 18: Glob Hidden File Filtering', () => {
    it('should exclude hidden files when includeHidden is false', async () => {
      // Feature: stage-03-tools-policy, Property 18: Glob Hidden File Filtering
      // Validates: Requirements 4.3, 4.4
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              name: fc.string({ minLength: 1, maxLength: 10 }).filter(isValidFilenamePart),
              isHidden: fc.boolean(),
            }),
            { minLength: 5, maxLength: 15 }
          ),
          async (fileSpecs) => {
            // Create a fresh fixture for each test
            const testFixture = new FileTestFixture();
            await testFixture.setup();

            try {
              // Create files, some hidden (starting with .)
              // Deduplicate filenames (case-insensitive on Windows)
              const seenNames = new Set<string>();
              const createdFiles: Array<{ path: string; isHidden: boolean }> = [];
              
              for (const spec of fileSpecs) {
                const filename = spec.isHidden ? `.${spec.name}.ts` : `${spec.name}.ts`;
                const normalizedName = filename.toLowerCase();
                
                // Skip if we've already created this filename (case-insensitive)
                if (seenNames.has(normalizedName)) {
                  continue;
                }
                seenNames.add(normalizedName);
                
                const absolutePath = await testFixture.createFile(filename);
                createdFiles.push({ path: absolutePath, isHidden: spec.isHidden });
              }

              // Test with includeHidden=false
              const invocation = tool.createInvocation(
                { 
                  pattern: '**/*.ts', 
                  directory: testFixture.getTempDir(),
                  includeHidden: false 
                },
                createToolContext(messageBus)
              );
              const result = await invocation.execute(createMockAbortSignal());

              // Should not have an error
              expect(result.error).toBeUndefined();

              // Parse the result
              const matchedFiles = result.llmContent
                .split('\n')
                .filter((line) => line.trim().length > 0)
                .map(normalizePath);

              // All matched files should NOT be hidden
              for (const matchedFile of matchedFiles) {
                const basename = path.basename(matchedFile);
                expect(basename.startsWith('.')).toBe(false);
              }

              // All non-hidden files should be in the results
              const nonHiddenFiles = createdFiles.filter(f => !f.isHidden);
              for (const file of nonHiddenFiles) {
                const relativePath = normalizePath(testFixture.getRelativePath(file.path));
                expect(matchedFiles).toContain(relativePath);
              }

              // No hidden files should be in the results
              const hiddenFiles = createdFiles.filter(f => f.isHidden);
              for (const file of hiddenFiles) {
                const relativePath = normalizePath(testFixture.getRelativePath(file.path));
                expect(matchedFiles).not.toContain(relativePath);
              }

              return true;
            } finally {
              await testFixture.cleanup();
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should include hidden files when includeHidden is true', async () => {
      // Feature: stage-03-tools-policy, Property 18: Glob Hidden File Filtering
      // Validates: Requirements 4.3, 4.4
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              name: fc.string({ minLength: 1, maxLength: 10 }).filter(isValidFilenamePart),
              isHidden: fc.boolean(),
            }),
            { minLength: 5, maxLength: 15 }
          ),
          async (fileSpecs) => {
            // Create a fresh fixture for each test
            const testFixture = new FileTestFixture();
            await testFixture.setup();

            try {
              // Create files, some hidden (starting with .)
              // Deduplicate filenames (case-insensitive on Windows)
              const seenNames = new Set<string>();
              const createdFiles: Array<{ path: string; isHidden: boolean }> = [];
              
              for (const spec of fileSpecs) {
                const filename = spec.isHidden ? `.${spec.name}.ts` : `${spec.name}.ts`;
                const normalizedName = filename.toLowerCase();
                
                // Skip if we've already created this filename (case-insensitive)
                if (seenNames.has(normalizedName)) {
                  continue;
                }
                seenNames.add(normalizedName);
                
                const absolutePath = await testFixture.createFile(filename);
                createdFiles.push({ path: absolutePath, isHidden: spec.isHidden });
              }

              // Test with includeHidden=true
              const invocation = tool.createInvocation(
                { 
                  pattern: '**/*.ts', 
                  directory: testFixture.getTempDir(),
                  includeHidden: true 
                },
                createToolContext(messageBus)
              );
              const result = await invocation.execute(createMockAbortSignal());

              // Should not have an error
              expect(result.error).toBeUndefined();

              // Parse the result
              const matchedFiles = result.llmContent
                .split('\n')
                .filter((line) => line.trim().length > 0)
                .map(normalizePath);

              // All files (hidden and non-hidden) should be in the results
              for (const file of createdFiles) {
                const relativePath = normalizePath(testFixture.getRelativePath(file.path));
                expect(matchedFiles).toContain(relativePath);
              }

              return true;
            } finally {
              await testFixture.cleanup();
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should exclude hidden files by default', async () => {
      // Feature: stage-03-tools-policy, Property 18: Glob Hidden File Filtering
      // Validates: Requirements 4.3
      await fixture.createFile('visible.ts');
      await fixture.createFile('.hidden.ts');
      await fixture.createFile('dir/.hidden-in-dir.ts');

      const invocation = tool.createInvocation(
        { pattern: '**/*.ts', directory: fixture.getTempDir() },
        createToolContext(messageBus)
      );
      const result = await invocation.execute(createMockAbortSignal());

      expect(result.error).toBeUndefined();

      const matchedFiles = result.llmContent
        .split('\n')
        .filter((line) => line.trim().length > 0);

      // Should include visible file
      expect(matchedFiles).toContain('visible.ts');
      // Should exclude hidden files
      expect(matchedFiles).not.toContain('.hidden.ts');
      expect(matchedFiles).not.toContain('dir/.hidden-in-dir.ts');
    });

    it('should exclude files in hidden directories when includeHidden is false', async () => {
      // Feature: stage-03-tools-policy, Property 18: Glob Hidden File Filtering
      // Validates: Requirements 4.3
      await fixture.createFile('visible/file.ts');
      await fixture.createFile('.hidden-dir/file.ts');

      const invocation = tool.createInvocation(
        { 
          pattern: '**/*.ts', 
          directory: fixture.getTempDir(),
          includeHidden: false 
        },
        createToolContext(messageBus)
      );
      const result = await invocation.execute(createMockAbortSignal());

      expect(result.error).toBeUndefined();

      const matchedFiles = result.llmContent
        .split('\n')
        .filter((line) => line.trim().length > 0)
        .map(normalizePath);

      // Should include file in visible directory
      expect(matchedFiles).toContain('visible/file.ts');
      // Should exclude file in hidden directory
      expect(matchedFiles).not.toContain('.hidden-dir/file.ts');
    });

    it('should include files in hidden directories when includeHidden is true', async () => {
      // Feature: stage-03-tools-policy, Property 18: Glob Hidden File Filtering
      // Validates: Requirements 4.4
      await fixture.createFile('visible/file.ts');
      await fixture.createFile('.hidden-dir/file.ts');

      const invocation = tool.createInvocation(
        { 
          pattern: '**/*.ts', 
          directory: fixture.getTempDir(),
          includeHidden: true 
        },
        createToolContext(messageBus)
      );
      const result = await invocation.execute(createMockAbortSignal());

      expect(result.error).toBeUndefined();

      const matchedFiles = result.llmContent
        .split('\n')
        .filter((line) => line.trim().length > 0)
        .map(normalizePath);

      // Should include both files
      expect(matchedFiles).toContain('visible/file.ts');
      expect(matchedFiles).toContain('.hidden-dir/file.ts');
    });
  });

  describe('Tool Interface', () => {
    it('should provide correct description', () => {
      const invocation = tool.createInvocation(
        { pattern: '**/*.ts' },
        createToolContext(messageBus)
      );

      const description = invocation.getDescription();
      expect(description).toContain('**/*.ts');
      expect(description).toContain('Find files matching');
    });

    it('should return correct tool locations', () => {
      const invocation = tool.createInvocation(
        { pattern: '**/*.ts', directory: '/test/dir' },
        createToolContext(messageBus)
      );

      const locations = invocation.toolLocations();
      expect(locations).toEqual(['/test/dir']);
    });

    it('should default to current directory when no directory specified', () => {
      const invocation = tool.createInvocation(
        { pattern: '**/*.ts' },
        createToolContext(messageBus)
      );

      const locations = invocation.toolLocations();
      expect(locations).toEqual(['.']);
    });

    it('should not require confirmation', async () => {
      const invocation = tool.createInvocation(
        { pattern: '**/*.ts' },
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
      expect(tool.name).toBe('glob');
      expect(tool.displayName).toBe('Find Files by Pattern');
      expect(tool.schema.name).toBe('glob');
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
      expect(params.properties.maxResults).toBeDefined();
      expect(params.properties.includeHidden).toBeDefined();
      expect(params.required).not.toContain('directory');
      expect(params.required).not.toContain('maxResults');
      expect(params.required).not.toContain('includeHidden');
    });
  });
});
