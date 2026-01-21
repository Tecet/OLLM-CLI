/**
 * Property-based tests for PathSanitizer
 * 
 * These tests validate universal correctness properties for path sanitization
 * and security using property-based testing with fast-check.
 * 
 * Feature: file-explorer-ui
 */

import { describe, test, expect } from 'vitest';
import fc from 'fast-check';
import { PathSanitizer, PathTraversalError, WorkspaceBoundaryError } from '../../PathSanitizer.js';
import * as path from 'path';
import * as os from 'os';

describe('PathSanitizer - Property-Based Tests', () => {
  describe('Property 16: Path Traversal Is Rejected', () => {
    test('any path containing ../ sequences should be rejected', () => {
      fc.assert(
        fc.property(
          // Generate strings that contain ../ somewhere
          fc.tuple(
            fc.string({ minLength: 0, maxLength: 20 }),
            fc.string({ minLength: 0, maxLength: 20 })
          ).map(([before, after]) => `${before}../${after}`),
          (pathWithTraversal) => {
            const sanitizer = new PathSanitizer();
            
            // The sanitizer should reject this path
            expect(() => sanitizer.sanitize(pathWithTraversal)).toThrow(PathTraversalError);
            expect(() => sanitizer.rejectTraversal(pathWithTraversal)).toThrow(PathTraversalError);
            expect(sanitizer.isPathSafe(pathWithTraversal)).toBe(false);
          }
        ),
        { numRuns: 20 }
      );
    });

    test('any path containing ..\\ sequences should be rejected', () => {
      fc.assert(
        fc.property(
          // Generate strings that contain ..\ somewhere (Windows-style)
          fc.tuple(
            fc.string({ minLength: 0, maxLength: 20 }),
            fc.string({ minLength: 0, maxLength: 20 })
          ).map(([before, after]) => `${before}..\\${after}`),
          (pathWithTraversal) => {
            const sanitizer = new PathSanitizer();
            
            // The sanitizer should reject this path
            expect(() => sanitizer.sanitize(pathWithTraversal)).toThrow(PathTraversalError);
            expect(() => sanitizer.rejectTraversal(pathWithTraversal)).toThrow(PathTraversalError);
            expect(sanitizer.isPathSafe(pathWithTraversal)).toBe(false);
          }
        ),
        { numRuns: 20 }
      );
    });

    test('any path with .. as a segment should be rejected', () => {
      fc.assert(
        fc.property(
          // Generate paths with .. as a complete segment
          fc.array(fc.string({ minLength: 1, maxLength: 10 }), { minLength: 1, maxLength: 5 })
            .chain(segments => {
              // Insert .. at a random position
              return fc.integer({ min: 0, max: segments.length }).map(pos => {
                const newSegments = [...segments];
                newSegments.splice(pos, 0, '..');
                return newSegments.join('/');
              });
            }),
          (pathWithDotDot) => {
            const sanitizer = new PathSanitizer();
            
            // The sanitizer should reject this path
            expect(() => sanitizer.sanitize(pathWithDotDot)).toThrow(PathTraversalError);
            expect(sanitizer.isPathSafe(pathWithDotDot)).toBe(false);
          }
        ),
        { numRuns: 20 }
      );
    });

    test('paths without traversal sequences should not be rejected', () => {
      fc.assert(
        fc.property(
          // Generate safe paths without .. sequences
          fc.array(
            fc.string({ minLength: 1, maxLength: 10 })
              .filter(s => !s.includes('..') && !s.includes('/') && !s.includes('\\')),
            { minLength: 1, maxLength: 5 }
          ).map(segments => segments.join('/')),
          (safePath) => {
            const sanitizer = new PathSanitizer();
            
            // Safe paths should not throw
            expect(() => sanitizer.sanitize(safePath)).not.toThrow();
            expect(sanitizer.isPathSafe(safePath)).toBe(true);
          }
        ),
        { numRuns: 20 }
      );
    });

    test('encoded traversal attempts should be rejected', () => {
      fc.assert(
        fc.property(
          fc.tuple(
            fc.string({ minLength: 0, maxLength: 20 }),
            fc.constantFrom('%2e%2e', '%2E%2E'),
            fc.string({ minLength: 0, maxLength: 20 })
          ).map(([before, encoded, after]) => `${before}${encoded}/${after}`),
          (encodedPath) => {
            const sanitizer = new PathSanitizer();
            
            // Encoded traversal should be rejected
            expect(sanitizer.isPathSafe(encodedPath)).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 16: Validation - Requirements 4.5, 10.1', () => {
    test('sanitize() normalizes safe paths to absolute paths', () => {
      fc.assert(
        fc.property(
          // Generate relative paths without traversal
          fc.array(
            fc.string({ minLength: 1, maxLength: 10 })
              .filter(s => !s.includes('..') && !s.includes('/') && !s.includes('\\')),
            { minLength: 1, maxLength: 3 }
          ).map(segments => segments.join('/')),
          (relativePath) => {
            const sanitizer = new PathSanitizer();
            const sanitized = sanitizer.sanitize(relativePath);
            
            // Result should be an absolute path
            expect(path.isAbsolute(sanitized)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('rejectTraversal() throws for any path with .. segments', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 50 })
            .filter(s => s.includes('../') || s.includes('..\\')),
          (traversalPath) => {
            const sanitizer = new PathSanitizer();
            
            expect(() => sanitizer.rejectTraversal(traversalPath)).toThrow(PathTraversalError);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});

describe('Property 35: Workspace Mode Rejects External Paths', () => {
  test('absolute paths outside workspace should be rejected', () => {
    fc.assert(
      fc.property(
        // Generate a workspace root
        fc.constantFrom(
          path.join(os.tmpdir(), 'workspace'),
          path.join(os.homedir(), 'projects', 'myworkspace'),
          '/home/user/workspace',
          'C:\\Users\\user\\workspace'
        ),
        // Generate an external path that's definitely outside
        fc.constantFrom(
          path.join(os.tmpdir(), 'external'),
          path.join(os.homedir(), 'external'),
          '/home/user/external',
          'C:\\Users\\user\\external'
        ),
        (workspaceRoot, externalPath) => {
          const sanitizer = new PathSanitizer();
          
          // External paths should not be within workspace
          expect(sanitizer.isWithinWorkspace(externalPath, workspaceRoot)).toBe(false);
        }
      ),
      { numRuns: 20 }
    );
  });

  test('paths within workspace should be accepted', () => {
    fc.assert(
      fc.property(
        // Generate a workspace root (use tmpdir to ensure same drive on Windows)
        fc.constant(path.join(os.tmpdir(), 'workspace')),
        // Generate a relative path within workspace
        fc.array(
          fc.string({ minLength: 1, maxLength: 10 })
            .filter(s => !s.includes('..') && !s.includes('/') && !s.includes('\\') && s.trim().length > 0),
          { minLength: 1, maxLength: 3 }
        ).map(segments => segments.join('/')),
        (workspaceRoot, relativePath) => {
          const sanitizer = new PathSanitizer();
          const fullPath = path.join(workspaceRoot, relativePath);
          
          // Paths within workspace should be accepted
          expect(sanitizer.isWithinWorkspace(fullPath, workspaceRoot)).toBe(true);
        }
      ),
      { numRuns: 20 }
    );
  });

  test('validateWorkspacePath() should throw for external paths', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(
          path.join(os.tmpdir(), 'workspace'),
          path.join(os.homedir(), 'projects', 'myworkspace')
        ),
        fc.constantFrom(
          path.join(os.tmpdir(), 'external'),
          path.join(os.homedir(), 'external')
        ),
        (workspaceRoot, externalPath) => {
          const sanitizer = new PathSanitizer();
          
          // Should throw WorkspaceBoundaryError
          expect(() => sanitizer.validateWorkspacePath(externalPath, workspaceRoot))
            .toThrow(WorkspaceBoundaryError);
        }
      ),
      { numRuns: 20 }
    );
  });

  test('validateWorkspacePath() should accept internal paths', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(
          path.join(os.tmpdir(), 'workspace'),
          path.join(os.homedir(), 'projects', 'myworkspace')
        ),
        fc.array(
          fc.string({ minLength: 1, maxLength: 10 })
            .filter(s => !s.includes('..') && !s.includes('/') && !s.includes('\\')),
          { minLength: 1, maxLength: 3 }
        ).map(segments => segments.join('/')),
        (workspaceRoot, relativePath) => {
          const sanitizer = new PathSanitizer();
          const fullPath = path.join(workspaceRoot, relativePath);
          
          // Should not throw for internal paths
          expect(() => sanitizer.validateWorkspacePath(fullPath, workspaceRoot))
            .not.toThrow();
          
          // Should return an absolute path
          const result = sanitizer.validateWorkspacePath(fullPath, workspaceRoot);
          expect(path.isAbsolute(result)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('workspace root itself should be within workspace', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(
          path.join(os.tmpdir(), 'workspace'),
          path.join(os.homedir(), 'projects', 'myworkspace'),
          '/home/user/workspace'
        ),
        (workspaceRoot) => {
          const sanitizer = new PathSanitizer();
          
          // The workspace root itself should be within workspace
          expect(sanitizer.isWithinWorkspace(workspaceRoot, workspaceRoot)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('traversal attempts to escape workspace should be rejected', () => {
    fc.assert(
      fc.property(
        fc.constant(path.join(os.tmpdir(), 'workspace')),
        fc.integer({ min: 1, max: 5 }),
        (workspaceRoot, traversalCount) => {
          const sanitizer = new PathSanitizer();
          
          // Create a path with multiple ../ to try to escape
          const traversalPath = path.join(workspaceRoot, '../'.repeat(traversalCount), 'external');
          
          // Should throw an error (either PathTraversalError or WorkspaceBoundaryError)
          // After path.join() normalizes the path, it may throw WorkspaceBoundaryError
          expect(() => sanitizer.validateWorkspacePath(traversalPath, workspaceRoot))
            .toThrow();
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('Property 35: Validation - Requirements 10.2', () => {
  test('isWithinWorkspace() correctly identifies internal vs external paths', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(
          path.join(os.tmpdir(), 'test-workspace'),
          path.join(os.homedir(), 'test-workspace')
        ),
        fc.boolean(),
        (workspaceRoot, shouldBeInternal) => {
          const sanitizer = new PathSanitizer();
          
          let testPath: string;
          if (shouldBeInternal) {
            // Create an internal path
            testPath = path.join(workspaceRoot, 'subdir', 'file.txt');
          } else {
            // Create an external path
            testPath = path.join(path.dirname(workspaceRoot), 'external', 'file.txt');
          }
          
          const result = sanitizer.isWithinWorkspace(testPath, workspaceRoot);
          expect(result).toBe(shouldBeInternal);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('relative paths are resolved relative to current directory', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.string({ minLength: 1, maxLength: 10 })
            .filter(s => !s.includes('..') && !s.includes('/') && !s.includes('\\')),
          { minLength: 1, maxLength: 3 }
        ).map(segments => segments.join('/')),
        (relativePath) => {
          const sanitizer = new PathSanitizer();
          const workspaceRoot = process.cwd();
          
          // Relative paths should be resolved and checked against workspace
          const result = sanitizer.isWithinWorkspace(relativePath, workspaceRoot);
          
          // Result should be a boolean (no errors thrown)
          expect(typeof result).toBe('boolean');
        }
      ),
      { numRuns: 100 }
    );
  });
});
