/**
 * ErrorHandler - Centralized error handling for File Explorer
 */

export interface ErrorInfo {
  message: string;
  code?: string;
  originalError: unknown;
}

export interface ErrorContext {
  operation: string;
  nodePath?: string;
  [key: string]: unknown;
}

/**
 * Handle and format errors
 * 
 * @param error - The original error object
 * @param context - Context where the error occurred
 * @returns Formatted error info
 */
export function handleError(error: unknown, _context: ErrorContext): ErrorInfo {
  const message = error instanceof Error ? error.message : String(error);
  
  // Log error with context (could be enhanced to use a logging service)
  // console.error(`Error in ${context.operation}:`, message, context);
  
  return {
    message,
    originalError: error,
  };
}