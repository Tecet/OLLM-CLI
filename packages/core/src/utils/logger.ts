/**
 * Logger utility for OLLM CLI
 * Provides structured logging with configurable log levels
 */

export interface Logger {
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * Create a logger instance with the given name
 * Log level is controlled by OLLM_LOG_LEVEL environment variable
 * 
 * @param name - Logger name (typically module or component name)
 * @returns Logger instance
 */
export function createLogger(name: string): Logger {
  const logLevel = (process.env.OLLM_LOG_LEVEL || 'info') as LogLevel;
  const levels: Record<LogLevel, number> = { 
    debug: 0, 
    info: 1, 
    warn: 2, 
    error: 3 
  };
  const currentLevel = levels[logLevel] ?? 1;
  
  const formatMessage = (level: string, message: string, meta?: Record<string, unknown>): string => {
    const timestamp = new Date().toISOString();
    const metaStr = meta ? ` ${JSON.stringify(meta)}` : '';
    return `[${timestamp}] [${level.toUpperCase()}] [${name}] ${message}${metaStr}`;
  };
  
  return {
    debug: (message: string, meta?: Record<string, unknown>) => {
      if (currentLevel <= 0) {
        console.debug(formatMessage('debug', message, meta));
      }
    },
    info: (message: string, meta?: Record<string, unknown>) => {
      if (currentLevel <= 1) {
        console.info(formatMessage('info', message, meta));
      }
    },
    warn: (message: string, meta?: Record<string, unknown>) => {
      if (currentLevel <= 2) {
        console.warn(formatMessage('warn', message, meta));
      }
    },
    error: (message: string, meta?: Record<string, unknown>) => {
      if (currentLevel <= 3) {
        console.error(formatMessage('error', message, meta));
      }
    },
  };
}

/**
 * Get the current log level from environment
 */
export function getLogLevel(): LogLevel {
  return (process.env.OLLM_LOG_LEVEL || 'info') as LogLevel;
}

/**
 * Set the log level (for testing)
 */
export function setLogLevel(level: LogLevel): void {
  process.env.OLLM_LOG_LEVEL = level;
}
