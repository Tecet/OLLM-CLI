/**
 * ErrorHandler Unit Tests
 * 
 * Tests for centralized error handling functionality
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  ErrorHandler,
  ErrorSeverity,
  ErrorCategory,
  handleError,
  formatErrorForDisplay,
  type ErrorInfo,
} from '../../ErrorHandler.js';
import {
  PathTraversalError,
  WorkspaceBoundaryError,
} from '../../PathSanitizer.js';
import {
  FileOperationError,
  PermissionError,
} from '../../FileOperations.js';

describe('ErrorHandler', () => {
  let errorHandler: ErrorHandler;
  let logCallback: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    logCallback = vi.fn();
    errorHandler = new ErrorHandler({ logCallback });
  });

  describe('handle()', () => {
    it('should classify PathTraversalError correctly', () => {
      const error = new PathTraversalError('../etc/passwd');
      const errorInfo = errorHandler.handle(error);

      expect(errorInfo.category).toBe(ErrorCategory.SECURITY);
      expect(errorInfo.severity).toBe(ErrorSeverity.ERROR);
      expect(errorInfo.message).toContain('Path traversal detected');
      expect(errorInfo.suggestion).toBeDefined();
    });

    it('should classify WorkspaceBoundaryError correctly', () => {
      const error = new WorkspaceBoundaryError('/outside/path', '/workspace');
      const errorInfo = errorHandler.handle(error);

      expect(errorInfo.category).toBe(ErrorCategory.SECURITY);
      expect(errorInfo.severity).toBe(ErrorSeverity.ERROR);
      expect(errorInfo.message).toContain('outside workspace boundaries');
      expect(errorInfo.suggestion).toBeDefined();
    });

    it('should classify PermissionError correctly', () => {
      const error = new PermissionError('/path/to/file', 'read');
      const errorInfo = errorHandler.handle(error);

      expect(errorInfo.category).toBe(ErrorCategory.FILESYSTEM);
      expect(errorInfo.severity).toBe(ErrorSeverity.ERROR);
      expect(errorInfo.message).toContain('Permission denied');
      expect(errorInfo.suggestion).toBeDefined();
    });

    it('should classify FileOperationError correctly', () => {
      const error = new FileOperationError('create', '/path/to/file', 'already exists');
      const errorInfo = errorHandler.handle(error);

      expect(errorInfo.category).toBe(ErrorCategory.FILESYSTEM);
      expect(errorInfo.severity).toBe(ErrorSeverity.ERROR);
      expect(errorInfo.message).toContain('File operation failed');
      expect(errorInfo.suggestion).toBeDefined();
    });

    it('should handle ENOENT error code', () => {
      const error = new Error('File not found') as NodeJS.ErrnoException;
      error.code = 'ENOENT';
      
      const errorInfo = errorHandler.handle(error);

      expect(errorInfo.category).toBe(ErrorCategory.FILESYSTEM);
      expect(errorInfo.severity).toBe(ErrorSeverity.ERROR);
      expect(errorInfo.message).toContain('not found');
      expect(errorInfo.suggestion).toBeDefined();
    });

    it('should handle EACCES error code', () => {
      const error = new Error('Permission denied') as NodeJS.ErrnoException;
      error.code = 'EACCES';
      
      const errorInfo = errorHandler.handle(error);

      expect(errorInfo.category).toBe(ErrorCategory.FILESYSTEM);
      expect(errorInfo.severity).toBe(ErrorSeverity.ERROR);
      expect(errorInfo.message).toContain('Permission denied');
      expect(errorInfo.suggestion).toBeDefined();
    });

    it('should handle EEXIST error code', () => {
      const error = new Error('File exists') as NodeJS.ErrnoException;
      error.code = 'EEXIST';
      
      const errorInfo = errorHandler.handle(error);

      expect(errorInfo.category).toBe(ErrorCategory.FILESYSTEM);
      expect(errorInfo.severity).toBe(ErrorSeverity.WARNING);
      expect(errorInfo.message).toContain('already exists');
      expect(errorInfo.suggestion).toBeDefined();
    });

    it('should handle ENOSPC error code as critical', () => {
      const error = new Error('No space left') as NodeJS.ErrnoException;
      error.code = 'ENOSPC';
      
      const errorInfo = errorHandler.handle(error);

      expect(errorInfo.category).toBe(ErrorCategory.FILESYSTEM);
      expect(errorInfo.severity).toBe(ErrorSeverity.CRITICAL);
      expect(errorInfo.message).toContain('No space left');
      expect(errorInfo.suggestion).toBeDefined();
    });

    it('should handle ENOTEMPTY error code', () => {
      const error = new Error('Directory not empty') as NodeJS.ErrnoException;
      error.code = 'ENOTEMPTY';
      
      const errorInfo = errorHandler.handle(error);

      expect(errorInfo.category).toBe(ErrorCategory.FILESYSTEM);
      expect(errorInfo.severity).toBe(ErrorSeverity.WARNING);
      expect(errorInfo.message).toContain('not empty');
      expect(errorInfo.suggestion).toBeDefined();
    });

    it('should handle generic Error objects', () => {
      const error = new Error('Something went wrong');
      const errorInfo = errorHandler.handle(error);

      expect(errorInfo.category).toBe(ErrorCategory.UNKNOWN);
      expect(errorInfo.severity).toBe(ErrorSeverity.ERROR);
      expect(errorInfo.message).toBe('Something went wrong');
      expect(errorInfo.originalError).toBe(error);
    });

    it('should handle non-Error objects', () => {
      const error = 'String error';
      const errorInfo = errorHandler.handle(error);

      expect(errorInfo.category).toBe(ErrorCategory.UNKNOWN);
      expect(errorInfo.severity).toBe(ErrorSeverity.ERROR);
      expect(errorInfo.message).toContain('unexpected error');
      expect(errorInfo.details).toBe('String error');
    });

    it('should include context in error info', () => {
      const error = new Error('Test error');
      const context = { operation: 'test', filePath: '/test/path' };
      
      const errorInfo = errorHandler.handle(error, context);

      expect(errorInfo.context).toEqual(context);
    });

    it('should call log callback when provided', () => {
      const error = new Error('Test error');
      errorHandler.handle(error);

      expect(logCallback).toHaveBeenCalledOnce();
      expect(logCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Test error',
          category: ErrorCategory.UNKNOWN,
          severity: ErrorSeverity.ERROR,
        })
      );
    });

    it('should not log when silent mode is enabled', () => {
      const silentHandler = new ErrorHandler({ silent: true });
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      const error = new Error('Test error');
      silentHandler.handle(error);

      expect(consoleSpy).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('formatForDisplay()', () => {
    it('should format error for UI display', () => {
      const error = new Error('Test error');
      const errorInfo = errorHandler.handle(error);
      const display = errorHandler.formatForDisplay(errorInfo);

      expect(display.title).toBeDefined();
      expect(display.message).toBe('Test error');
      expect(display.recoverable).toBe(true);
    });

    it('should mark critical errors as non-recoverable', () => {
      const error = new Error('No space left') as NodeJS.ErrnoException;
      error.code = 'ENOSPC';
      
      const errorInfo = errorHandler.handle(error);
      const display = errorHandler.formatForDisplay(errorInfo);

      expect(display.title).toBe('Critical Error');
      expect(display.recoverable).toBe(false);
    });

    it('should include suggestions in display', () => {
      const error = new PathTraversalError('../etc/passwd');
      const errorInfo = errorHandler.handle(error);
      const display = errorHandler.formatForDisplay(errorInfo);

      expect(display.suggestion).toBeDefined();
      expect(display.suggestion).toContain('valid path');
    });

    it('should set appropriate titles for different categories', () => {
      const testCases = [
        { error: new PathTraversalError('..'), expectedTitle: 'Security Error' },
        { error: new PermissionError('/path', 'read'), expectedTitle: 'File System Error' },
      ];

      for (const { error, expectedTitle } of testCases) {
        const errorInfo = errorHandler.handle(error);
        const display = errorHandler.formatForDisplay(errorInfo);
        expect(display.title).toBe(expectedTitle);
      }
    });
  });

  describe('formatPath()', () => {
    it('should format short paths as-is', () => {
      const path = '/home/user/file.txt';
      const formatted = ErrorHandler.formatPath(path);
      expect(formatted).toBe(path);
    });

    it('should shorten long paths', () => {
      const testPath = '/very/long/path/with/many/segments/file.txt';
      const formatted = ErrorHandler.formatPath(testPath);
      
      // Path has 6 directory segments, should be shortened to last 2
      expect(formatted).toContain('...');
      expect(formatted).toContain('file.txt');
      expect(formatted).toContain('many');
      expect(formatted).toContain('segments');
    });
  });

  describe('isRecoverable()', () => {
    it('should return true for recoverable errors', () => {
      const error = new Error('File not found') as NodeJS.ErrnoException;
      error.code = 'ENOENT';
      
      expect(ErrorHandler.isRecoverable(error)).toBe(true);
    });

    it('should return false for non-recoverable errors', () => {
      const error = new Error('No space left') as NodeJS.ErrnoException;
      error.code = 'ENOSPC';
      
      expect(ErrorHandler.isRecoverable(error)).toBe(false);
    });

    it('should return true for generic errors', () => {
      const error = new Error('Generic error');
      expect(ErrorHandler.isRecoverable(error)).toBe(true);
    });
  });

  describe('suggestRecovery()', () => {
    it('should suggest recovery for ENOENT', () => {
      const error = new Error('File not found') as NodeJS.ErrnoException;
      error.code = 'ENOENT';
      
      const suggestion = ErrorHandler.suggestRecovery(error);
      expect(suggestion).toBeDefined();
      expect(suggestion).toContain('Refresh');
    });

    it('should suggest recovery for EACCES', () => {
      const error = new Error('Permission denied') as NodeJS.ErrnoException;
      error.code = 'EACCES';
      
      const suggestion = ErrorHandler.suggestRecovery(error);
      expect(suggestion).toBeDefined();
      expect(suggestion).toContain('permission');
    });

    it('should suggest recovery for EEXIST', () => {
      const error = new Error('File exists') as NodeJS.ErrnoException;
      error.code = 'EEXIST';
      
      const suggestion = ErrorHandler.suggestRecovery(error);
      expect(suggestion).toBeDefined();
      expect(suggestion).toContain('different name');
    });

    it('should return null for non-Error objects', () => {
      const suggestion = ErrorHandler.suggestRecovery('string error');
      expect(suggestion).toBeNull();
    });
  });

  describe('Global helper functions', () => {
    it('handleError should use global error handler', () => {
      const error = new Error('Test error');
      const errorInfo = handleError(error);

      expect(errorInfo).toBeDefined();
      expect(errorInfo.message).toBe('Test error');
    });

    it('formatErrorForDisplay should format using global handler', () => {
      const error = new Error('Test error');
      const display = formatErrorForDisplay(error);

      expect(display).toBeDefined();
      expect(display.message).toBe('Test error');
      expect(display.title).toBeDefined();
    });
  });
});
