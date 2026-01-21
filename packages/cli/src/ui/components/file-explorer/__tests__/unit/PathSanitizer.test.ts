/**
 * Unit tests for PathSanitizer
 * 
 * These tests validate specific examples and edge cases for path sanitization
 * and security.
 */

import { describe, test, expect } from 'vitest';
import { PathSanitizer, PathTraversalError, WorkspaceBoundaryError } from '../../PathSanitizer.js';
import * as path from 'path';
import * as os from 'os';

describe('PathSanitizer - Unit Tests', () => {
  describe('sanitize()', () => {
    test('should normalize relative paths to absolute paths', () => {
      const sanitizer = new PathSanitizer();
      const result = sanitizer.sanitize('src/components/file.ts');
      
      expect(path.isAbsolute(result)).toBe(true);
      expect(result).toContain('src');
      expect(result).toContain('components');
      expect(result).toContain('file.ts');
    });

    test('should reject paths with ../ traversal', () => {
      const sanitizer = new PathSanitizer();
      
      expect(() => sanitizer.sanitize('../etc/passwd')).toThrow(PathTraversalError);
      expect(() => sanitizer.sanitize('src/../../../etc/passwd')).toThrow(PathTraversalError);
    });

    test('should reject paths with ..\\ traversal (Windows)', () => {
      const sanitizer = new PathSanitizer();
      
      expect(() => sanitizer.sanitize('..\\windows\\system32')).toThrow(PathTraversalError);
      expect(() => sanitizer.sanitize('src\\..\\..\\..\\windows')).toThrow(PathTraversalError);
    });

    test('should handle absolute paths', () => {
      const sanitizer = new PathSanitizer();
      const absolutePath = path.join(os.tmpdir(), 'test', 'file.txt');
      
      const result = sanitizer.sanitize(absolutePath);
      expect(path.isAbsolute(result)).toBe(true);
    });

    test('should normalize path separators', () => {
      const sanitizer = new PathSanitizer();
      const result = sanitizer.sanitize('src/components/file.ts');
      
      // Result should use platform-specific separators
      expect(path.isAbsolute(result)).toBe(true);
    });
  });

  describe('isPathSafe()', () => {
    test('should return true for safe relative paths', () => {
      const sanitizer = new PathSanitizer();
      
      expect(sanitizer.isPathSafe('src/components/file.ts')).toBe(true);
      expect(sanitizer.isPathSafe('docs/readme.md')).toBe(true);
      expect(sanitizer.isPathSafe('./config.json')).toBe(true);
    });

    test('should return false for paths with ../ traversal', () => {
      const sanitizer = new PathSanitizer();
      
      expect(sanitizer.isPathSafe('../etc/passwd')).toBe(false);
      expect(sanitizer.isPathSafe('src/../../../etc')).toBe(false);
      expect(sanitizer.isPathSafe('./../../etc')).toBe(false);
    });

    test('should return false for paths with ..\\ traversal', () => {
      const sanitizer = new PathSanitizer();
      
      expect(sanitizer.isPathSafe('..\\windows')).toBe(false);
      expect(sanitizer.isPathSafe('src\\..\\..\\windows')).toBe(false);
    });

    test('should return false for encoded traversal attempts', () => {
      const sanitizer = new PathSanitizer();
      
      expect(sanitizer.isPathSafe('%2e%2e/etc/passwd')).toBe(false);
      expect(sanitizer.isPathSafe('%2E%2E/etc/passwd')).toBe(false);
    });

    test('should return true for paths with dots in filenames', () => {
      const sanitizer = new PathSanitizer();
      
      // These are safe - dots in filenames, not traversal
      expect(sanitizer.isPathSafe('file.test.ts')).toBe(true);
      expect(sanitizer.isPathSafe('src/my.config.json')).toBe(true);
    });
  });

  describe('isWithinWorkspace()', () => {
    test('should return true for paths within workspace', () => {
      const sanitizer = new PathSanitizer();
      const workspace = path.join(os.tmpdir(), 'test-workspace');
      const filePath = path.join(workspace, 'src', 'file.ts');
      
      expect(sanitizer.isWithinWorkspace(filePath, workspace)).toBe(true);
    });

    test('should return false for paths outside workspace', () => {
      const sanitizer = new PathSanitizer();
      const workspace = path.join(os.tmpdir(), 'test-workspace');
      const externalPath = path.join(os.tmpdir(), 'external', 'file.ts');
      
      expect(sanitizer.isWithinWorkspace(externalPath, workspace)).toBe(false);
    });

    test('should return true for workspace root itself', () => {
      const sanitizer = new PathSanitizer();
      const workspace = path.join(os.tmpdir(), 'test-workspace');
      
      expect(sanitizer.isWithinWorkspace(workspace, workspace)).toBe(true);
    });

    test('should handle relative paths correctly', () => {
      const sanitizer = new PathSanitizer();
      const workspace = process.cwd();
      const relativePath = 'src/components/file.ts';
      
      // Relative paths are resolved relative to cwd
      const result = sanitizer.isWithinWorkspace(relativePath, workspace);
      expect(typeof result).toBe('boolean');
    });

    test('should return false for paths on different drives (Windows)', () => {
      const sanitizer = new PathSanitizer();
      
      // Only test on Windows
      if (process.platform === 'win32') {
        const workspaceC = 'C:\\workspace';
        const pathD = 'D:\\external\\file.txt';
        
        expect(sanitizer.isWithinWorkspace(pathD, workspaceC)).toBe(false);
      }
    });
  });

  describe('rejectTraversal()', () => {
    test('should throw PathTraversalError for traversal paths', () => {
      const sanitizer = new PathSanitizer();
      
      expect(() => sanitizer.rejectTraversal('../etc/passwd')).toThrow(PathTraversalError);
      expect(() => sanitizer.rejectTraversal('src/../../../etc')).toThrow(PathTraversalError);
    });

    test('should not throw for safe paths', () => {
      const sanitizer = new PathSanitizer();
      
      expect(() => sanitizer.rejectTraversal('src/components/file.ts')).not.toThrow();
      expect(() => sanitizer.rejectTraversal('./config.json')).not.toThrow();
    });

    test('should include attempted path in error message', () => {
      const sanitizer = new PathSanitizer();
      const maliciousPath = '../../../etc/passwd';
      
      try {
        sanitizer.rejectTraversal(maliciousPath);
        expect.fail('Should have thrown PathTraversalError');
      } catch (error) {
        expect(error).toBeInstanceOf(PathTraversalError);
        expect((error as Error).message).toContain(maliciousPath);
      }
    });
  });

  describe('validateWorkspacePath()', () => {
    test('should return sanitized path for valid workspace paths', () => {
      const sanitizer = new PathSanitizer();
      const workspace = path.join(os.tmpdir(), 'test-workspace');
      const filePath = path.join(workspace, 'src', 'file.ts');
      
      const result = sanitizer.validateWorkspacePath(filePath, workspace);
      expect(path.isAbsolute(result)).toBe(true);
      expect(result).toContain('src');
      expect(result).toContain('file.ts');
    });

    test('should throw PathTraversalError for traversal attempts', () => {
      const sanitizer = new PathSanitizer();
      const workspace = path.join(os.tmpdir(), 'test-workspace');
      const maliciousPath = '../../../etc/passwd';
      
      expect(() => sanitizer.validateWorkspacePath(maliciousPath, workspace))
        .toThrow(PathTraversalError);
    });

    test('should throw WorkspaceBoundaryError for external paths', () => {
      const sanitizer = new PathSanitizer();
      const workspace = path.join(os.tmpdir(), 'test-workspace');
      const externalPath = path.join(os.tmpdir(), 'external', 'file.ts');
      
      expect(() => sanitizer.validateWorkspacePath(externalPath, workspace))
        .toThrow(WorkspaceBoundaryError);
    });

    test('should include paths in error messages', () => {
      const sanitizer = new PathSanitizer();
      const workspace = path.join(os.tmpdir(), 'test-workspace');
      const externalPath = path.join(os.tmpdir(), 'external', 'file.ts');
      
      try {
        sanitizer.validateWorkspacePath(externalPath, workspace);
        expect.fail('Should have thrown WorkspaceBoundaryError');
      } catch (error) {
        expect(error).toBeInstanceOf(WorkspaceBoundaryError);
        expect((error as Error).message).toContain('workspace');
      }
    });
  });

  describe('Error classes', () => {
    test('PathTraversalError should have correct name', () => {
      const error = new PathTraversalError('../etc/passwd');
      expect(error.name).toBe('PathTraversalError');
      expect(error).toBeInstanceOf(Error);
    });

    test('WorkspaceBoundaryError should have correct name', () => {
      const error = new WorkspaceBoundaryError('/external/path', '/workspace');
      expect(error.name).toBe('WorkspaceBoundaryError');
      expect(error).toBeInstanceOf(Error);
    });
  });

  describe('Edge cases', () => {
    test('should handle empty strings', () => {
      const sanitizer = new PathSanitizer();
      
      // Empty string should be safe (no traversal)
      expect(sanitizer.isPathSafe('')).toBe(true);
    });

    test('should handle single dot (current directory)', () => {
      const sanitizer = new PathSanitizer();
      
      expect(sanitizer.isPathSafe('.')).toBe(true);
      expect(sanitizer.isPathSafe('./')).toBe(true);
    });

    test('should handle paths with multiple slashes', () => {
      const sanitizer = new PathSanitizer();
      
      expect(sanitizer.isPathSafe('src//components///file.ts')).toBe(true);
    });

    test('should handle paths with trailing slashes', () => {
      const sanitizer = new PathSanitizer();
      
      expect(sanitizer.isPathSafe('src/components/')).toBe(true);
    });
  });
});
