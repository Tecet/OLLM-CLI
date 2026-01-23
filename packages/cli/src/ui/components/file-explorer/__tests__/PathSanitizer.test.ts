/**
 * PathSanitizer Tests
 * 
 * Tests for path normalization and sanitization
 */

import { sep } from 'path';

import { describe, it, expect } from 'vitest';

import { PathSanitizer } from '../PathSanitizer.js';

describe('PathSanitizer', () => {
  const sanitizer = new PathSanitizer();

  describe('sanitize', () => {
    it('should normalize path separators', () => {
      const input = 'C:\\Users\\test\\file.txt';
      const result = sanitizer.sanitize(input);

      // Should use platform-specific separator
      expect(result).toContain(sep);
    });

    it('should handle forward slashes', () => {
      const input = 'C:/Users/test/file.txt';
      const result = sanitizer.sanitize(input);

      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(0);
    });

    it('should handle mixed separators', () => {
      const input = 'C:\\Users/test\\file.txt';
      const result = sanitizer.sanitize(input);

      expect(result).toBeDefined();
    });

    it('should handle relative paths', () => {
      const input = './test/file.txt';
      const result = sanitizer.sanitize(input);

      expect(result).toBeDefined();
    });

    it('should handle empty string', () => {
      const result = sanitizer.sanitize('');
      expect(result).toBe('');
    });
  });

  describe('isAbsolute', () => {
    it('should detect absolute paths on Windows', () => {
      const path = 'C:\\Users\\test';
      const result = sanitizer.isAbsolute(path);

      if (process.platform === 'win32') {
        expect(result).toBe(true);
      }
    });

    it('should detect absolute paths on Unix', () => {
      const path = '/home/user/test';
      const result = sanitizer.isAbsolute(path);

      if (process.platform !== 'win32') {
        expect(result).toBe(true);
      }
    });

    it('should detect relative paths', () => {
      const path = './test/file.txt';
      const result = sanitizer.isAbsolute(path);

      expect(result).toBe(false);
    });
  });

  describe('normalize', () => {
    it('should remove redundant separators', () => {
      const input = 'test//file///path';
      const result = sanitizer.normalize(input);

      expect(result).not.toContain('//');
    });

    it('should resolve . and .. segments', () => {
      const input = 'test/./file/../path';
      const result = sanitizer.normalize(input);

      expect(result).not.toContain('./');
      expect(result).not.toContain('../');
    });
  });
});
