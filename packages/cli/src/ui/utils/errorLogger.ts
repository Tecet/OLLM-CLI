import { createLogger } from '../../../../core/src/utils/logger.js';

const logger = createLogger('errorLogger');
/**
 * Error logging utilities for UI components
 */

/**
 * Log levels
 */
export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
}

/**
 * Check if logging is enabled for a given level
 */
function isLogLevelEnabled(level: LogLevel): boolean {
  const configuredLevel = process.env.OLLM_LOG_LEVEL?.toLowerCase() || 'error';

  const levels = [LogLevel.ERROR, LogLevel.WARN, LogLevel.INFO, LogLevel.DEBUG];
  const configuredIndex = levels.indexOf(configuredLevel as LogLevel);
  const requestedIndex = levels.indexOf(level);

  // If configured level is not found, default to ERROR only
  if (configuredIndex === -1) {
    return level === LogLevel.ERROR;
  }

  // Enable if requested level is at or above configured level
  return requestedIndex <= configuredIndex;
}

/**
 * Log an error to debug output
 */
export function logError(context: string, error: unknown, details?: Record<string, unknown>): void {
  if (!isLogLevelEnabled(LogLevel.ERROR)) {
    return;
  }

  const timestamp = new Date().toISOString();
  logger.error(`[${timestamp}] [${context}] Error:`, error);

  if (details) {
    logger.error(`[${timestamp}] [${context}] Details:`, details);
  }

  // Log stack trace if available
  if (error instanceof Error && error.stack) {
    logger.error(`[${timestamp}] [${context}] Stack:`, error.stack);
  }
}

/**
 * Log a warning to debug output
 */
export function logWarning(
  context: string,
  message: string,
  details?: Record<string, unknown>
): void {
  if (!isLogLevelEnabled(LogLevel.WARN)) {
    return;
  }

  const timestamp = new Date().toISOString();
  logger.warn(`[${timestamp}] [${context}] Warning: ${message}`);

  if (details) {
    logger.warn(`[${timestamp}] [${context}] Details:`, details);
  }
}

/**
 * Log an info message to debug output
 */
export function logInfo(context: string, message: string, details?: Record<string, unknown>): void {
  if (!isLogLevelEnabled(LogLevel.INFO)) {
    return;
  }

  const timestamp = new Date().toISOString();
  logger.info(`[${timestamp}] [${context}] ${message}`);

  if (details) {
    logger.info(`[${timestamp}] [${context}] Details:`, details);
  }
}

/**
 * Log a debug message to debug output
 */
export function logDebug(
  context: string,
  message: string,
  details?: Record<string, unknown>
): void {
  if (!isLogLevelEnabled(LogLevel.DEBUG)) {
    return;
  }

  const timestamp = new Date().toISOString();
  logger.info(`[${timestamp}] [${context}] [DEBUG] ${message}`);

  if (details) {
    logger.info(`[${timestamp}] [${context}] [DEBUG] Details:`, details);
  }
}

/**
 * Format error for user display
 */
export function formatErrorForUser(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  return 'An unknown error occurred';
}

/**
 * Check if error is a network error
 */
export function isNetworkError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  return (
    message.includes('network') ||
    message.includes('econnrefused') ||
    message.includes('enotfound') ||
    message.includes('timeout') ||
    message.includes('fetch failed')
  );
}

/**
 * Check if error is a validation error
 */
export function isValidationError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  return (
    message.includes('validation') ||
    message.includes('invalid') ||
    message.includes('required') ||
    message.includes('must be')
  );
}
