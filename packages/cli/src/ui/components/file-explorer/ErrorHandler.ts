/**
 * ErrorHandler - Centralized error handling for File Explorer
 *
 * This module provides consistent error handling across all File Explorer
 * components and services. It categorizes errors, formats error messages,
 * and provides recovery strategies.
 *
 * **Error Categories:**
 * - Filesystem errors (ENOENT, EACCES, EISDIR, etc.)
 * - Path validation errors (traversal, boundary violations)
 * - Permission errors (read, write, execute)
 * - Operation errors (file already exists, not empty, etc.)
 *
 * **Usage:**
 * ```typescript
 * try {
 *   await fs.readFile(path);
 * } catch (error) {
 *   const errorInfo = handleError(error, {
 *     operation: 'readFile',
 *     filePath: path,
 *   });
 *   console.error(errorInfo.message);
 * }
 * ```
 */

/**
 * Structured error information
 */
export interface ErrorInfo {
  /** Human-readable error message */
  message: string;
  /** Error code (e.g., 'ENOENT', 'EACCES') */
  code?: string;
  /** Error category for handling strategy */
  category: ErrorCategory;
  /** Whether the error is recoverable */
  recoverable: boolean;
  /** Original error object for debugging */
  originalError: unknown;
}

/**
 * Context information for error handling
 */
export interface ErrorContext {
  /** Operation that was being performed */
  operation: string;
  /** Path involved in the operation (if applicable) */
  nodePath?: string;
  /** File path involved (alias for nodePath) */
  filePath?: string;
  /** Additional context data */
  /** Additional context data */
  [key: string]: unknown;
  /** If true, suppress console logging */
  silent?: boolean;
}

/**
 * Error categories for different handling strategies
 */
export enum ErrorCategory {
  /** File or directory not found */
  NOT_FOUND = 'NOT_FOUND',
  /** Permission denied */
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  /** Path validation failed (traversal, boundary) */
  PATH_VALIDATION = 'PATH_VALIDATION',
  /** File or directory already exists */
  ALREADY_EXISTS = 'ALREADY_EXISTS',
  /** Directory not empty */
  NOT_EMPTY = 'NOT_EMPTY',
  /** Invalid operation (e.g., expand non-directory) */
  INVALID_OPERATION = 'INVALID_OPERATION',
  /** Network or I/O error */
  IO_ERROR = 'IO_ERROR',
  /** Unknown or unexpected error */
  UNKNOWN = 'UNKNOWN',
}

/**
 * Handle and format errors with categorization and recovery strategies
 *
 * This function:
 * 1. Categorizes the error based on type and code
 * 2. Formats a user-friendly error message
 * 3. Determines if the error is recoverable
 * 4. Logs the error with context for debugging
 *
 * @param error - The original error object
 * @param context - Context where the error occurred
 * @returns Formatted error info with category and recovery info
 */
export function handleError(error: unknown, context: ErrorContext): ErrorInfo {
  // Extract error message and code
  const message = error instanceof Error ? error.message : String(error);
  const code = (error as NodeJS.ErrnoException).code;

  // Determine error category and recoverability
  const category = categorizeError(error, code);
  const recoverable = isRecoverable(category);

  // Format user-friendly message
  const formattedMessage = formatErrorMessage(message, code, context);

  // Log error with context for debugging
  logError(error, context, category);

  return {
    message: formattedMessage,
    code,
    category,
    recoverable,
    originalError: error,
  };
}

/**
 * Categorize an error based on its type and code
 */
function categorizeError(error: unknown, code?: string): ErrorCategory {
  // Check for specific error codes
  if (code === 'ENOENT') return ErrorCategory.NOT_FOUND;
  if (code === 'EACCES' || code === 'EPERM') return ErrorCategory.PERMISSION_DENIED;
  if (code === 'EEXIST') return ErrorCategory.ALREADY_EXISTS;
  if (code === 'ENOTEMPTY') return ErrorCategory.NOT_EMPTY;
  if (code === 'EIO' || code === 'ENOSPC') return ErrorCategory.IO_ERROR;

  // Check for custom error types
  if (error instanceof Error) {
    if (error.name === 'PathTraversalError' || error.name === 'WorkspaceBoundaryError') {
      return ErrorCategory.PATH_VALIDATION;
    }
    if (error.name === 'PermissionError') {
      return ErrorCategory.PERMISSION_DENIED;
    }
    if (error.name === 'FileOperationError') {
      return ErrorCategory.INVALID_OPERATION;
    }
  }

  return ErrorCategory.UNKNOWN;
}

/**
 * Determine if an error category is recoverable
 *
 * Recoverable errors can be handled gracefully without crashing:
 * - NOT_FOUND: Show error message, allow retry
 * - PERMISSION_DENIED: Show error message, suggest fix
 * - ALREADY_EXISTS: Show error message, suggest alternative
 * - NOT_EMPTY: Show error message, offer recursive delete
 *
 * Non-recoverable errors should be propagated:
 * - PATH_VALIDATION: Security issue, must fail
 * - IO_ERROR: System issue, may need restart
 * - UNKNOWN: Unexpected, should be investigated
 */
function isRecoverable(category: ErrorCategory): boolean {
  switch (category) {
    case ErrorCategory.NOT_FOUND:
    case ErrorCategory.PERMISSION_DENIED:
    case ErrorCategory.ALREADY_EXISTS:
    case ErrorCategory.NOT_EMPTY:
    case ErrorCategory.INVALID_OPERATION:
      return true;

    case ErrorCategory.PATH_VALIDATION:
    case ErrorCategory.IO_ERROR:
    case ErrorCategory.UNKNOWN:
      return false;
  }
}

/**
 * Format a user-friendly error message
 */
function formatErrorMessage(
  message: string,
  code: string | undefined,
  context: ErrorContext
): string {
  const path = context.nodePath || context.filePath;
  const operation = context.operation;

  // Format based on error code
  if (code === 'ENOENT') {
    return `File or directory not found: ${path}`;
  }
  if (code === 'EACCES' || code === 'EPERM') {
    return `Permission denied for ${operation} on ${path}`;
  }
  if (code === 'EEXIST') {
    return `File or directory already exists: ${path}`;
  }
  if (code === 'ENOTEMPTY') {
    return `Directory not empty: ${path}. Use recursive delete to remove contents.`;
  }
  if (code === 'EIO') {
    return `I/O error during ${operation}: ${message}`;
  }
  if (code === 'ENOSPC') {
    return `No space left on device during ${operation}`;
  }

  // Default format
  return `${operation} failed${path ? ` for ${path}` : ''}: ${message}`;
}

/**
 * Log error with context for debugging
 *
 * In production, this could integrate with a logging service
 * like Winston, Bunyan, or a cloud logging provider.
 */
function logError(error: unknown, context: ErrorContext, category: ErrorCategory): void {
  // Suppress logging if silent option is true
  if (context.silent) {
    return;
  }

  // Suppress logging in test mode to avoid spam
  const isTestEnv = process.env.NODE_ENV === 'test' || !!process.env.VITEST;
  if (isTestEnv) {
    return;
  }

  // For now, just log to console
  // In production, this would send to a logging service
  console.error(`[FileExplorer] ${category}:`, {
    operation: context.operation,
    path: context.nodePath || context.filePath,
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
    context,
  });
}

/**
 * Get recovery suggestion for an error category
 *
 * Provides user-friendly suggestions for recovering from errors.
 *
 * @param category - Error category
 * @returns Recovery suggestion string
 */
export function getRecoverySuggestion(category: ErrorCategory): string {
  switch (category) {
    case ErrorCategory.NOT_FOUND:
      return 'The file or directory may have been moved or deleted. Try refreshing the file tree.';

    case ErrorCategory.PERMISSION_DENIED:
      return 'Check file permissions and ensure you have the necessary access rights.';

    case ErrorCategory.ALREADY_EXISTS:
      return 'Choose a different name or delete the existing file first.';

    case ErrorCategory.NOT_EMPTY:
      return 'Delete the contents first, or use recursive delete to remove everything.';

    case ErrorCategory.INVALID_OPERATION:
      return 'This operation is not supported for this file type.';

    case ErrorCategory.PATH_VALIDATION:
      return 'The path contains invalid characters or attempts to access restricted locations.';

    case ErrorCategory.IO_ERROR:
      return 'A system I/O error occurred. Check disk space and try again.';

    case ErrorCategory.UNKNOWN:
      return 'An unexpected error occurred. Please try again or contact support.';
  }
}
