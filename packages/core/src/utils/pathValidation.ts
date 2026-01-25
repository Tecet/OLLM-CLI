import { createLogger } from './logger.js';

const logger = createLogger('pathValidation');
/**
 * Path Validation Utilities
 * 
 * Provides cross-platform path validation and diagnostics for storage locations.
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

/**
 * Path validation result
 */
export interface PathValidationResult {
  valid: boolean;
  resolved: string;
  exists: boolean;
  writable: boolean;
  error?: string;
}

/**
 * Validate and resolve a storage path
 * 
 * @param dirPath - Path to validate (can be relative or absolute)
 * @param createIfMissing - Whether to create the directory if it doesn't exist
 * @returns Validation result with resolved path and status
 */
export function validateStoragePath(
  dirPath: string,
  createIfMissing = false
): PathValidationResult {
  try {
    // Resolve ~ to home directory
    let resolved = dirPath;
    if (dirPath.startsWith('~')) {
      resolved = path.join(os.homedir(), dirPath.slice(1));
    }

    // Resolve to absolute path
    resolved = path.resolve(resolved);

    // Check if path is absolute
    if (!path.isAbsolute(resolved)) {
      return {
        valid: false,
        resolved,
        exists: false,
        writable: false,
        error: `Path must be absolute: ${resolved}`,
      };
    }

    // Check if path exists
    const exists = fs.existsSync(resolved);

    // If doesn't exist and we should create it
    if (!exists && createIfMissing) {
      try {
        fs.mkdirSync(resolved, { recursive: true });
        return {
          valid: true,
          resolved,
          exists: true,
          writable: true,
        };
      } catch (error) {
        return {
          valid: false,
          resolved,
          exists: false,
          writable: false,
          error: `Failed to create directory: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
    }

    // Check if writable
    let writable = false;
    if (exists) {
      try {
        fs.accessSync(resolved, fs.constants.W_OK);
        writable = true;
      } catch {
        writable = false;
      }
    } else {
      // Check if parent directory is writable
      const parent = path.dirname(resolved);
      if (fs.existsSync(parent)) {
        try {
          fs.accessSync(parent, fs.constants.W_OK);
          writable = true;
        } catch {
          writable = false;
        }
      }
    }

    return {
      valid: exists && writable,
      resolved,
      exists,
      writable,
      error: !writable ? `Path not writable: ${resolved}` : undefined,
    };
  } catch (error) {
    return {
      valid: false,
      resolved: dirPath,
      exists: false,
      writable: false,
      error: `Path validation failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Log storage path diagnostics
 * 
 * @param label - Label for the path (e.g., "Sessions", "Snapshots")
 * @param dirPath - Path to diagnose
 */
export function logPathDiagnostics(label: string, dirPath: string): void {
  const result = validateStoragePath(dirPath, false);
  
  logger.info(`[Storage] ${label}:`);
  logger.info(`  Path: ${dirPath}`);
  logger.info(`  Resolved: ${result.resolved}`);
  logger.info(`  Exists: ${result.exists}`);
  logger.info(`  Writable: ${result.writable}`);
  logger.info(`  Valid: ${result.valid}`);
  
  if (result.error) {
    logger.info(`  Error: ${result.error}`);
  }
}

/**
 * Get all storage locations for diagnostics
 */
export interface StorageLocations {
  sessions: string;
  contextSnapshots: string;
  config: string;
  cache: string;
}

/**
 * Get default storage locations
 */
export function getDefaultStorageLocations(): StorageLocations {
  const home = os.homedir();
  const ollmDir = path.join(home, '.ollm');

  return {
    sessions: path.join(ollmDir, 'sessions'),
    contextSnapshots: path.join(ollmDir, 'context-snapshots'),
    config: path.join(ollmDir, 'config'),
    cache: path.join(ollmDir, 'cache'),
  };
}

/**
 * Log all storage locations
 */
export function logAllStorageLocations(): void {
  const locations = getDefaultStorageLocations();
  
  logger.info('[Storage] Default Locations:');
  logger.info(`  Home: ${os.homedir()}`);
  logger.info(`  Platform: ${os.platform()}`);
  logger.info(`  Sessions: ${locations.sessions}`);
  logger.info(`  Context Snapshots: ${locations.contextSnapshots}`);
  logger.info(`  Config: ${locations.config}`);
  logger.info(`  Cache: ${locations.cache}`);
}

/**
 * Ensure all storage directories exist
 */
export async function ensureStorageDirectories(): Promise<void> {
  const locations = getDefaultStorageLocations();
  
  for (const [name, location] of Object.entries(locations)) {
    const result = validateStoragePath(location, true);
    if (!result.valid) {
      throw new Error(`Failed to create ${name} directory: ${result.error}`);
    }
  }
}
