/**
 * Centralized Error Classes
 *
 * This module provides standardized error classes for the OLLM CLI.
 * All errors extend OllmError and include structured context.
 */

/**
 * Base error class with enhanced context
 */
export class OllmError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly context?: Record<string, unknown>
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      context: this.context,
    };
  }
}

/**
 * Non-interactive execution errors
 */
export class NonInteractiveError extends OllmError {
  constructor(
    message: string,
    public readonly exitCode: number
  ) {
    super(message, 'NON_INTERACTIVE_ERROR', {
      exitCode,
    });
  }
}

/**
 * File system operation errors
 */
export class FileSystemError extends OllmError {
  constructor(
    message: string,
    public readonly operation: 'read' | 'write' | 'delete' | 'stat' | 'mkdir' | 'rename' | 'copy',
    public readonly path: string,
    public readonly originalError?: Error
  ) {
    super(message, 'FILE_SYSTEM_ERROR', {
      operation,
      path,
      originalError: originalError?.message,
    });
  }
}

/**
 * Configuration errors
 */
export class ConfigError extends OllmError {
  constructor(
    message: string,
    public readonly filePath?: string,
    public readonly line?: number,
    public readonly column?: number,
    public readonly snippet?: string
  ) {
    super(message, 'CONFIG_ERROR', {
      filePath,
      line,
      column,
      snippet,
    });
  }

  toString(): string {
    let result = `Configuration Error: ${this.message}`;

    if (this.filePath) {
      result += `\n  File: ${this.filePath}`;
    }

    if (this.line !== undefined) {
      result += `\n  Line: ${this.line}`;
      if (this.column !== undefined) {
        result += `, Column: ${this.column}`;
      }
    }

    if (this.snippet) {
      result += `\n\n${this.snippet}`;
    }

    return result;
  }
}

/**
 * Provider connection errors
 */
export class ProviderConnectionError extends OllmError {
  constructor(
    message: string,
    public readonly provider: string,
    public readonly host?: string,
    public readonly originalError?: Error
  ) {
    super(message, 'PROVIDER_CONNECTION_ERROR', {
      provider,
      host,
      originalError: originalError?.message,
    });
  }
}

/**
 * Model errors
 */
export class ModelError extends OllmError {
  constructor(
    message: string,
    public readonly model: string,
    public readonly operation: 'load' | 'list' | 'pull' | 'remove' | 'show',
    public readonly originalError?: Error
  ) {
    super(message, 'MODEL_ERROR', {
      model,
      operation,
      originalError: originalError?.message,
    });
  }
}

/**
 * Workspace boundary errors
 */
export class WorkspaceBoundaryError extends OllmError {
  constructor(
    message: string,
    public readonly attemptedPath: string,
    public readonly workspacePath: string,
    public readonly allowedPaths: string[]
  ) {
    super(message, 'WORKSPACE_BOUNDARY_ERROR', {
      attemptedPath,
      workspacePath,
      allowedPaths,
    });
  }
}

/**
 * Tool execution errors
 */
export class ToolExecutionError extends OllmError {
  constructor(
    message: string,
    public readonly toolName: string,
    public readonly args: Record<string, unknown>,
    public readonly originalError?: Error
  ) {
    super(message, 'TOOL_EXECUTION_ERROR', {
      toolName,
      args,
      originalError: originalError?.message,
    });
  }
}

/**
 * Validation errors for input/parameter validation
 */
export class InputValidationError extends OllmError {
  constructor(
    message: string,
    public readonly field: string,
    public readonly value: unknown,
    public readonly constraint: string
  ) {
    super(message, 'INPUT_VALIDATION_ERROR', {
      field,
      value,
      constraint,
    });
  }
}

/**
 * Timeout errors
 */
export class TimeoutError extends OllmError {
  constructor(
    message: string,
    public readonly operation: string,
    public readonly timeoutMs: number
  ) {
    super(message, 'TIMEOUT_ERROR', {
      operation,
      timeoutMs,
    });
  }
}

/**
 * Abort errors
 */
export class AbortError extends OllmError {
  constructor(
    message: string,
    public readonly operation: string
  ) {
    super(message, 'ABORT_ERROR', {
      operation,
    });
  }
}

/**
 * MCP (Model Context Protocol) connection errors
 */
export class MCPConnectionError extends OllmError {
  constructor(
    message: string,
    public readonly serverName: string,
    public readonly operation: 'connect' | 'disconnect' | 'call' | 'list',
    public readonly originalError?: Error
  ) {
    super(message, 'MCP_CONNECTION_ERROR', {
      serverName,
      operation,
      originalError: originalError?.message,
    });
  }
}

/**
 * Hook execution errors
 */
export class HookError extends OllmError {
  constructor(
    message: string,
    public readonly hookName: string,
    public readonly event: string,
    public readonly originalError?: Error
  ) {
    super(message, 'HOOK_ERROR', {
      hookName,
      event,
      originalError: originalError?.message,
    });
  }
}

/**
 * Context management errors
 */
export class ContextError extends OllmError {
  constructor(
    message: string,
    public readonly operation: 'compress' | 'snapshot' | 'restore' | 'size',
    public readonly originalError?: Error
  ) {
    super(message, 'CONTEXT_ERROR', {
      operation,
      originalError: originalError?.message,
    });
  }
}

/**
 * Type guard to check if error is an OllmError
 */
export function isOllmError(error: unknown): error is OllmError {
  return error instanceof OllmError;
}

/**
 * Type guard to check if error is a Node.js error with code
 */
export function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}

/**
 * Extract error message safely from unknown error
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

/**
 * Extract error stack safely from unknown error
 */
export function getErrorStack(error: unknown): string | undefined {
  if (error instanceof Error) {
    return error.stack;
  }
  return undefined;
}

/**
 * Create a standardized error response for logging
 */
export function createErrorContext(
  error: unknown,
  additionalContext?: Record<string, unknown>
): Record<string, unknown> {
  const context: Record<string, unknown> = {
    message: getErrorMessage(error),
    stack: getErrorStack(error),
    ...additionalContext,
  };

  if (isOllmError(error)) {
    context.code = error.code;
    context.context = error.context;
  }

  if (isNodeError(error)) {
    context.nodeErrorCode = error.code;
    context.errno = error.errno;
    context.syscall = error.syscall;
    context.path = error.path;
  }

  return context;
}
