/**
 * Debug Logger - Writes debug logs to file
 * 
 * Used for debugging compression and context management issues
 * when console.log is not visible (Ink UI).
 */

import { appendFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

const DEBUG_LOG_PATH = join(homedir(), '.ollm', 'debug.log');

/**
 * Write debug log to file
 */
export function debugLog(category: string, message: string, data?: unknown): void {
  const timestamp = new Date().toISOString();
  const logLine = `[${timestamp}] [${category}] ${message}${data ? '\n' + JSON.stringify(data, null, 2) : ''}\n`;
  
  try {
    appendFileSync(DEBUG_LOG_PATH, logLine);
  } catch (_error) {
    // Ignore write errors
  }
}

/**
 * Clear debug log file
 */
export function clearDebugLog(): void {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { writeFileSync } = require('fs');
    writeFileSync(DEBUG_LOG_PATH, '');
  } catch (_error) {
    // Ignore errors
  }
}
