import { createLogger } from './logger.js';

const logger = createLogger('logger');
/**
 * Logger utility for OLLM CLI
 * Provides structured logging with configurable log levels
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

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
  
  /* File Logging Support */
  const logDir = path.join(os.homedir(), '.ollm', 'logs');
  try {
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
  } catch (_e) {
    // ignore
  }
  const logFile = path.join(logDir, 'debug.log');

  const logToFile = (formattedMsg: string) => {
    try {
      fs.appendFileSync(logFile, formattedMsg + '\n');
    } catch (_e) {
      // ignore
    }
  };

  return {
    debug: (message: string, meta?: Record<string, unknown>) => {
      const msg = formatMessage('debug', message, meta);
      logToFile(msg);
      if (currentLevel <= 0) {
        logger.debug(msg);
      }
    },
    info: (message: string, meta?: Record<string, unknown>) => {
      const msg = formatMessage('info', message, meta);
      logToFile(msg);
      if (currentLevel <= 1) {
        logger.info(msg);
      }
    },
    warn: (message: string, meta?: Record<string, unknown>) => {
      const msg = formatMessage('warn', message, meta);
      logToFile(msg);
      if (currentLevel <= 2) {
        logger.warn(msg);
      }
    },
    error: (message: string, meta?: Record<string, unknown>) => {
      const msg = formatMessage('error', message, meta);
      logToFile(msg);
      if (currentLevel <= 3) {
        logger.error(msg);
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
