/**
 * Error Handling Utilities for MCP Panel UI
 *
 * Provides user-friendly error messages, retry logic with exponential backoff,
 * and error recovery suggestions for common failure scenarios.
 */

/**
 * Common error types in MCP operations
 */
export enum MCPErrorType {
  CONNECTION_FAILED = 'CONNECTION_FAILED',
  CONFIG_CORRUPTED = 'CONFIG_CORRUPTED',
  CONFIG_INVALID = 'CONFIG_INVALID',
  SERVER_START_FAILED = 'SERVER_START_FAILED',
  SERVER_STOP_FAILED = 'SERVER_STOP_FAILED',
  OAUTH_FAILED = 'OAUTH_FAILED',
  MARKETPLACE_UNAVAILABLE = 'MARKETPLACE_UNAVAILABLE',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  TIMEOUT = 'TIMEOUT',
  UNKNOWN = 'UNKNOWN',
}

/**
 * Error with recovery suggestions
 */
export interface MCPError {
  type: MCPErrorType;
  message: string;
  originalError?: Error;
  suggestions: string[];
  canRetry: boolean;
}

/**
 * Retry configuration
 */
export interface RetryConfig {
  maxAttempts: number;
  initialDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
}

/**
 * Default retry configuration
 */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  initialDelay: 1000, // 1 second
  maxDelay: 10000, // 10 seconds
  backoffMultiplier: 2,
};

/**
 * Parse error and provide user-friendly message with recovery suggestions
 */
export function parseError(error: unknown): MCPError {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const originalError = error instanceof Error ? error : undefined;

  // Connection errors
  if (
    errorMessage.includes('ECONNREFUSED') ||
    errorMessage.includes('ENOTFOUND') ||
    errorMessage.includes('connection refused')
  ) {
    return {
      type: MCPErrorType.CONNECTION_FAILED,
      message: 'Failed to connect to MCP server',
      originalError,
      suggestions: [
        'Check if the server command is correct',
        'Verify the server is installed and accessible',
        'Check your network connection',
        'Try restarting the server',
      ],
      canRetry: true,
    };
  }

  // Configuration errors
  if (
    errorMessage.includes('JSON') ||
    errorMessage.includes('parse') ||
    errorMessage.includes('syntax')
  ) {
    return {
      type: MCPErrorType.CONFIG_CORRUPTED,
      message: 'Configuration file is corrupted or invalid',
      originalError,
      suggestions: [
        'A backup will be created automatically',
        'The configuration will be restored from backup',
        'You may need to reconfigure your servers',
      ],
      canRetry: false,
    };
  }

  // Validation errors
  if (
    errorMessage.includes('Invalid configuration') ||
    errorMessage.includes('required') ||
    errorMessage.includes('must be')
  ) {
    return {
      type: MCPErrorType.CONFIG_INVALID,
      message: 'Server configuration is invalid',
      originalError,
      suggestions: [
        'Check that all required fields are filled',
        'Verify command and arguments are correct',
        'Ensure environment variables are properly formatted',
      ],
      canRetry: false,
    };
  }

  // Server start errors
  if (
    errorMessage.includes('Failed to start') ||
    errorMessage.includes('spawn') ||
    errorMessage.includes('ENOENT')
  ) {
    return {
      type: MCPErrorType.SERVER_START_FAILED,
      message: 'Failed to start MCP server',
      originalError,
      suggestions: [
        'Verify the server command exists and is executable',
        'Check that all dependencies are installed',
        'Review server logs for more details',
        'Try reinstalling the server',
      ],
      canRetry: true,
    };
  }

  // OAuth errors
  if (
    errorMessage.includes('OAuth') ||
    errorMessage.includes('authorization') ||
    errorMessage.includes('token')
  ) {
    return {
      type: MCPErrorType.OAUTH_FAILED,
      message: 'OAuth authentication failed',
      originalError,
      suggestions: [
        'Check your OAuth credentials',
        'Verify the authorization URL is correct',
        'Try refreshing your token',
        'Re-authorize the application',
      ],
      canRetry: true,
    };
  }

  // Marketplace errors
  if (
    errorMessage.includes('marketplace') ||
    errorMessage.includes('fetch') ||
    errorMessage.includes('network')
  ) {
    return {
      type: MCPErrorType.MARKETPLACE_UNAVAILABLE,
      message: 'Marketplace is temporarily unavailable',
      originalError,
      suggestions: [
        'Using cached marketplace data',
        'Check your internet connection',
        'Try again later',
      ],
      canRetry: true,
    };
  }

  // Permission errors
  if (
    errorMessage.includes('EACCES') ||
    errorMessage.includes('permission denied') ||
    errorMessage.includes('EPERM')
  ) {
    return {
      type: MCPErrorType.PERMISSION_DENIED,
      message: 'Permission denied',
      originalError,
      suggestions: [
        'Check file permissions',
        'You may need administrator privileges',
        'Verify you have write access to the configuration directory',
      ],
      canRetry: false,
    };
  }

  // Timeout errors
  if (errorMessage.includes('timeout') || errorMessage.includes('ETIMEDOUT')) {
    return {
      type: MCPErrorType.TIMEOUT,
      message: 'Operation timed out',
      originalError,
      suggestions: [
        'The server may be slow to respond',
        'Try increasing the timeout value',
        'Check your network connection',
        'Try again',
      ],
      canRetry: true,
    };
  }

  // Unknown errors
  return {
    type: MCPErrorType.UNKNOWN,
    message: errorMessage || 'An unexpected error occurred',
    originalError,
    suggestions: [
      'Try the operation again',
      'Check the logs for more details',
      'Report this issue if it persists',
    ],
    canRetry: true,
  };
}

/**
 * Retry an async operation with exponential backoff
 */
export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  config: Partial<RetryConfig> = {}
): Promise<T> {
  const finalConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
  let lastError: Error | undefined;
  let delay = finalConfig.initialDelay;

  for (let attempt = 1; attempt <= finalConfig.maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Don't retry on last attempt
      if (attempt === finalConfig.maxAttempts) {
        break;
      }

      // Parse error to check if it's retryable
      const parsedError = parseError(error);
      if (!parsedError.canRetry) {
        throw error;
      }

      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, delay));

      // Increase delay for next attempt (exponential backoff)
      delay = Math.min(delay * finalConfig.backoffMultiplier, finalConfig.maxDelay);
    }
  }

  // All attempts failed
  throw lastError || new Error('Operation failed after retries');
}

/**
 * Format error message for display
 */
export function formatErrorMessage(error: MCPError): string {
  let message = `❌ ${error.message}`;

  if (error.suggestions.length > 0) {
    message += '\n\nSuggestions:';
    for (const suggestion of error.suggestions) {
      message += `\n  • ${suggestion}`;
    }
  }

  if (error.canRetry) {
    message += '\n\nYou can try this operation again.';
  }

  return message;
}

/**
 * Check if an error is retryable
 */
export function isRetryableError(error: unknown): boolean {
  const parsed = parseError(error);
  return parsed.canRetry;
}

/**
 * Get error type from error
 */
export function getErrorType(error: unknown): MCPErrorType {
  const parsed = parseError(error);
  return parsed.type;
}
