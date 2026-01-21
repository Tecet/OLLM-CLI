/**
 * Property-based tests for Follow Mode
 * 
 * Tests the correctness properties of Follow Mode functionality,
 * including file path detection and automatic tree expansion.
 * 
 * Feature: file-explorer-ui
 * Property 29: Follow Mode Expands to Referenced Files
 * Validates: Requirements 7.5
 */

import { describe, it, expect, beforeEach } from 'vitest';
import fc from 'fast-check';
import { FollowModeService } from '../../FollowModeService.js';
import * as path from 'path';

describe('Property 29: Follow Mode Expands to Referenced Files', () => {
  let followModeService: FollowModeService;

  beforeEach(() => {
    followModeService = new FollowModeService();
  });

  /**
   * Property: For any file path referenced in LLM text when Follow Mode is enabled,
   * the file tree should automatically expand to show that file.
   * 
   * This property tests that:
   * 1. File paths are correctly detected in LLM responses
   * 2. Detected paths are normalized and validated
   * 3. Only paths within the workspace root are considered
   */
  it('should detect file paths in LLM responses', () => {
    fc.assert(
      fc.property(
        // Generate a root path
        fc.constantFrom('/workspace', 'C:\\workspace', '/home/user/project'),
        // Generate a relative file path
        fc.array(fc.stringMatching(/^[a-z]+$/), { minLength: 1, maxLength: 3 }),
        // Generate a file name with extension
        fc.record({
          name: fc.stringMatching(/^[a-z]+$/),
          ext: fc.constantFrom('ts', 'js', 'py', 'md', 'json', 'txt'),
        }),
        (rootPath, pathParts, file) => {
          // Build a file path
          const fileName = `${file.name}.${file.ext}`;
          const relativePath = [...pathParts, fileName].join('/');
          const fullPath = path.join(rootPath, relativePath);

          // Create LLM response text that mentions the file
          const llmText = `I've updated the file at ${fullPath} to fix the issue.`;

          // Detect file paths
          const detectedPaths = followModeService.detectFilePaths(llmText, {
            rootPath,
            filterByRoot: true,
          });

          // Should detect at least one path
          expect(detectedPaths.length).toBeGreaterThan(0);

          // The detected path should be normalized
          const normalizedExpected = path.normalize(fullPath);
          expect(detectedPaths).toContain(normalizedExpected);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should extract file paths from LLM responses with code blocks', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('/workspace', 'C:\\workspace'),
        fc.stringMatching(/^[a-z]+$/),
        fc.constantFrom('ts', 'js', 'py', 'md'),
        (rootPath, fileName, ext) => {
          const filePath = path.join(rootPath, 'src', `${fileName}.${ext}`);
          
          // LLM response with code block
          const llmText = `
Here's the updated code:

\`\`\`${ext}
// Code here
\`\`\`

I've modified ${filePath} to implement the feature.
          `;

          const detectedPaths = followModeService.extractFromLLMResponse(llmText, {
            rootPath,
            filterByRoot: true,
          });

          // Should detect the file path outside the code block
          expect(detectedPaths.length).toBeGreaterThan(0);
          const normalizedExpected = path.normalize(filePath);
          expect(detectedPaths).toContain(normalizedExpected);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should only detect paths within the workspace root when filterByRoot is true', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('/workspace', 'C:\\workspace'),
        fc.stringMatching(/^[a-z]+$/),
        fc.constantFrom('ts', 'js', 'py'),
        (rootPath, fileName, ext) => {
          const insidePath = path.join(rootPath, 'src', `${fileName}.${ext}`);
          const outsidePath = path.join('/other', 'src', `${fileName}.${ext}`);

          const llmText = `
I've updated ${insidePath} and also checked ${outsidePath}.
          `;

          const detectedPaths = followModeService.detectFilePaths(llmText, {
            rootPath,
            filterByRoot: true,
          });

          // Should only detect the path inside the workspace
          const normalizedInside = path.normalize(insidePath);
          expect(detectedPaths).toContain(normalizedInside);

          // Should not detect the path outside the workspace
          const normalizedOutside = path.normalize(outsidePath);
          expect(detectedPaths).not.toContain(normalizedOutside);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should validate that detected paths have valid extensions', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('/workspace', 'C:\\workspace'),
        fc.stringMatching(/^[a-z]+$/),
        fc.constantFrom('exe', 'dll', 'bin', 'obj'), // Invalid extensions
        (rootPath, fileName, ext) => {
          const filePath = path.join(rootPath, 'src', `${fileName}.${ext}`);
          const llmText = `I've updated ${filePath}.`;

          const detectedPaths = followModeService.detectFilePaths(llmText, {
            rootPath,
            filterByRoot: true,
          });

          // Should not detect paths with invalid extensions
          expect(detectedPaths).toHaveLength(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should correctly determine if a path should trigger expansion', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('/workspace', 'C:\\workspace'),
        fc.array(fc.stringMatching(/^[a-z]+$/), { minLength: 1, maxLength: 3 }),
        fc.record({
          name: fc.stringMatching(/^[a-z]+$/),
          ext: fc.constantFrom('ts', 'js', 'py', 'md', 'json'),
        }),
        (rootPath, pathParts, file) => {
          const fileName = `${file.name}.${file.ext}`;
          const filePath = path.join(rootPath, ...pathParts, fileName);

          // Should trigger expansion for valid paths within root
          const shouldExpand = followModeService.shouldExpandToPath(filePath, rootPath);
          expect(shouldExpand).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should not trigger expansion for paths outside the workspace', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('/workspace', 'C:\\workspace'),
        fc.stringMatching(/^[a-z]+$/),
        fc.constantFrom('ts', 'js', 'py'),
        (rootPath, fileName, ext) => {
          const outsidePath = path.join('/other', 'src', `${fileName}.${ext}`);

          // Should not trigger expansion for paths outside root
          const shouldExpand = followModeService.shouldExpandToPath(outsidePath, rootPath);
          expect(shouldExpand).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle multiple file paths in a single LLM response', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('/workspace', 'C:\\workspace'),
        fc.array(
          fc.record({
            name: fc.stringMatching(/^[a-z]+$/),
            ext: fc.constantFrom('ts', 'js', 'py', 'md'),
          }),
          { minLength: 2, maxLength: 5 }
        ),
        (rootPath, files) => {
          // Create multiple file paths
          const filePaths = files.map((file, i) => 
            path.join(rootPath, 'src', `file${i}_${file.name}.${file.ext}`)
          );

          // Create LLM text mentioning all files
          const llmText = `I've updated the following files: ${filePaths.join(', ')}.`;

          const detectedPaths = followModeService.detectFilePaths(llmText, {
            rootPath,
            filterByRoot: true,
          });

          // Should detect all file paths
          expect(detectedPaths.length).toBe(filePaths.length);

          // All paths should be detected
          filePaths.forEach(filePath => {
            const normalized = path.normalize(filePath);
            expect(detectedPaths).toContain(normalized);
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle relative paths when root is provided', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('/workspace', 'C:\\workspace'),
        fc.stringMatching(/^[a-z]+$/),
        fc.constantFrom('ts', 'js', 'py'),
        (rootPath, fileName, ext) => {
          const relativePath = `./src/${fileName}.${ext}`;
          const llmText = `I've updated ${relativePath}.`;

          const detectedPaths = followModeService.detectFilePaths(llmText, {
            rootPath,
            filterByRoot: true,
          });

          // Should resolve relative path against root
          expect(detectedPaths.length).toBeGreaterThan(0);

          // The resolved path should be within the root
          const expectedPath = path.normalize(path.join(rootPath, relativePath));
          expect(detectedPaths).toContain(expectedPath);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should ignore inline code when extracting from LLM responses', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('/workspace', 'C:\\workspace'),
        fc.stringMatching(/^[a-z]+$/),
        fc.constantFrom('ts', 'js'),
        (rootPath, fileName, ext) => {
          const realPath = path.join(rootPath, 'src', `${fileName}.${ext}`);
          const fakePath = path.join(rootPath, 'fake', `${fileName}.${ext}`);

          // LLM response with inline code
          const llmText = `
I've updated ${realPath}. You can import it with \`import { foo } from '${fakePath}'\`.
          `;

          const detectedPaths = followModeService.extractFromLLMResponse(llmText, {
            rootPath,
            filterByRoot: true,
          });

          // Should detect the real path
          const normalizedReal = path.normalize(realPath);
          expect(detectedPaths).toContain(normalizedReal);

          // Should not detect the path in inline code
          const normalizedFake = path.normalize(fakePath);
          expect(detectedPaths).not.toContain(normalizedFake);
        }
      ),
      { numRuns: 100 }
    );
  });
});
