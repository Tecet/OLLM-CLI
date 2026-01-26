/**
 * Common Error Handling Utilities
 * 
 * This module provides reusable error handling patterns and utilities.
 */

import { 
  FileSystemError, 
  ConfigError, 
  ProviderConnectionError,
  TimeoutError,
  AbortError,
  isNodeError,
  getErrorMessage,
} from './index.js';

/**
 * Handle file system errors with proper error types
 */
export async function handleFileSystemError<T>(
  operation: 'read' | 'write' | 'delete' | 'stat' | 'mkdir' | 'rename' | 'copy',
  path: string,
  fn: () => Promise<T>
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (isNodeError(error)) {
      // Handle specific Node.js error codes
      switch (error.code) {
        case 'ENOENT':
          throw new FileSystemError(
            `File not found: ${path}`,
            operation,
            path,
            error
          );
        
        case 'EACCES':
        case 'EPERM':
          throw new FileSystemError(
            `Permission denied: ${path}`,
            operation,
            path,
            error
          );
        
        case 'EEXIST':
          throw new FileSystemError(
            `File already exists: ${path}`,
            operation,
            path,
            error
          );
        
        case 'ENOTDIR':
          throw new FileSystemError(
            `Not a directory: ${path}`,
            operation,
            path,
            error
          );
        
        case 'EISDIR':
          throw new FileSystemError(
            `Is a directory: ${path}`,
            operation,
            path,
            error
          );
        
        case 'ENOSPC':
          throw new FileSystemError(
            `No space left on device: ${path}`,
            operation,
            path,
            error
          );
        
        default:
          throw new FileSystemError(
            `File system error: ${error.message}`,
            operation,
            path,
            error
          );
      }
    }
    
    throw new FileSystemError(
      `File system error: ${getErrorMessage(error)}`,
      operation,
      path,
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Handle JSON parsing errors with proper error types
 */
export function handleJSONParseError<T>(
  content: string,
  filePath?: string
): T {
  try {
    return JSON.parse(content) as T;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new ConfigError(
        `Invalid JSON: ${error.message}`,
        filePath
      );
    }
    
    throw new ConfigError(
      `Failed to parse JSON: ${getErrorMessage(error)}`,
      filePath
    );
  }
}

/**
 * Handle provider connection errors with proper error types
 */
export async function handleProviderError<T>(
  provider: string,
  host: string,
  fn: () => Promise<T>
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (isNodeError(error)) {
      // Handle specific Node.js error codes
      switch (error.code) {
        case 'ECONNREFUSED':
          throw new ProviderConnectionError(
            `Cannot connect to provider at ${host}: Connection refused`,
            provider,
            host,
            error
          );
        
        case 'ENOTFOUND':
          throw new ProviderConnectionError(
            `Cannot connect to provider at ${host}: Host not found`,
            provider,
            host,
            error
          );
        
        case 'ETIMEDOUT':
          throw new ProviderConnectionError(
            `Cannot connect to provider at ${host}: Connection timed out`,
            provider,
            host,
            error
          );
        
        default:
          throw new ProviderConnectionError(
            `Provider connection error: ${error.message}`,
            provider,
            host,
            error
          );
      }
    }
    
    throw new ProviderConnectionError(
      `Provider error: ${getErrorMessage(error)}`,
      provider,
      host,
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Handle timeout with proper error types
 */
export async function withTimeout<T>(
  operation: string,
  timeoutMs: number,
  fn: () => Promise<T>,
  signal?: AbortSignal
): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    // Combine signals if provided
    const _combinedSignal = signal 
      ? combineAbortSignals([signal, controller.signal])
      : controller.signal;
    
    const result = await fn();
    return result;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      // Check if it was our timeout or external abort
      if (controller.signal.aborted && !signal?.aborted) {
        throw new TimeoutError(
          `Operation timed out after ${timeoutMs}ms`,
          operation,
          timeoutMs
        );
      }
      
      throw new AbortError(
        'Operation cancelled by user',
        operation
      );
    }
    
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Combine multiple abort signals into one
 */
function combineAbortSignals(signals: AbortSignal[]): AbortSignal {
  const controller = new AbortController();
  
  for (const signal of signals) {
    if (signal.aborted) {
      controller.abort();
      break;
    }
    
    signal.addEventListener('abort', () => controller.abort(), { once: true });
  }
  
  return controller.signal;
}

/**
 * Check if operation was aborted and throw appropriate error
 */
export function checkAborted(signal: AbortSignal | undefined, operation: string): void {
  if (signal?.aborted) {
    throw new AbortError(
      'Operation cancelled by user',
      operation
    );
  }
}

/**
 * Retry operation with exponential backoff
 */
export async function withRetry<T>(
  operation: string,
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    initialDelayMs?: number;
    maxDelayMs?: number;
    backoffMultiplier?: number;
    shouldRetry?: (error: unknown) => boolean;
  } = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelayMs = 1000,
    maxDelayMs = 10000,
    backoffMultiplier = 2,
    shouldRetry = () => true,
  } = options;
  
  let lastError: unknown;
  let delayMs = initialDelayMs;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      // Don't retry if we've exhausted attempts
      if (attempt === maxRetries) {
        break;
      }
      
      // Don't retry if error is not retryable
      if (!shouldRetry(error)) {
        break;
      }
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delayMs));
      
      // Increase delay for next attempt
      delayMs = Math.min(delayMs * backoffMultiplier, maxDelayMs);
    }
  }
  
  throw lastError;
}

/**
 * Execute operation with graceful fallback
 */
export async function withFallback<T>(
  fn: () => Promise<T>,
  fallback: T | (() => T | Promise<T>),
  onError?: (error: unknown) => void
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (onError) {
      onError(error);
    }
    
    return typeof fallback === 'function' 
      ? await (fallback as () => T | Promise<T>)()
      : fallback;
  }
}

/**
 * Aggregate multiple errors into a single error
 */
export class AggregateError extends Error {
  constructor(
    message: string,
    public readonly errors: Error[]
  ) {
    super(message);
    this.name = 'AggregateError';
  }
  
  toString(): string {
    let result = `${this.message}\n`;
    
    for (let i = 0; i < this.errors.length; i++) {
      result += `\n${i + 1}. ${this.errors[i].message}`;
    }
    
    return result;
  }
}

/**
 * Collect errors from multiple operations
 */
export async function collectErrors<T>(
  operations: Array<() => Promise<T>>,
  continueOnError = true
): Promise<{ results: T[]; errors: Error[] }> {
  const results: T[] = [];
  const errors: Error[] = [];
  
  for (const operation of operations) {
    try {
      const result = await operation();
      results.push(result);
    } catch (error) {
      if (error instanceof Error) {
        errors.push(error);
      } else {
        errors.push(new Error(String(error)));
      }
      
      if (!continueOnError) {
        break;
      }
    }
  }
  
  return { results, errors };
}
