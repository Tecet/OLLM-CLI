/**
 * Storage Initialization
 * 
 * Handles storage initialization tasks including migration and directory setup.
 */

import { createLogger } from './logger.js';
import { ensureStorageDirectories, logAllStorageLocations } from './pathValidation.js';
import { runMigrationIfNeeded } from './storageMigration.js';

const logger = createLogger('storageInitialization');

/**
 * Initialize storage system
 * 
 * This should be called once during application startup before any storage operations.
 * It will:
 * 1. Log storage locations for debugging
 * 2. Run migration if needed (from old unified location to new separated locations)
 * 3. Ensure all storage directories exist
 */
export async function initializeStorage(): Promise<void> {

  logger.info('[Storage] Initializing storage system...');
  
  // Log storage locations for debugging
  logAllStorageLocations();
  
  // Run migration if needed
  try {
    const migrationResult = await runMigrationIfNeeded();
    
    if (migrationResult) {
      if (migrationResult.success) {
        logger.info('[Storage] Migration completed successfully');
        logger.info(`[Storage] Sessions migrated: ${migrationResult.sessionsMigrated}`);
        logger.info(`[Storage] Snapshots migrated: ${migrationResult.snapshotsMigrated}`);
      } else {
        logger.warn('[Storage] Migration had errors:');
        for (const error of migrationResult.errors) {
          logger.warn(`[Storage]   - ${error}`);
        }
      }
    } else {
      logger.info('[Storage] No migration needed');
    }
  } catch (error) {
    logger.error('[Storage] Migration failed:', { error: error instanceof Error ? error.message : String(error) });
    // Don't throw - allow app to continue even if migration fails
  }
  
  // Ensure all storage directories exist
  try {
    await ensureStorageDirectories();
    logger.info('[Storage] All storage directories verified');
  } catch (error) {
    logger.error('[Storage] Failed to create storage directories:', { error: error instanceof Error ? error.message : String(error) });
    throw error; // This is critical - can't continue without storage
  }
  
  logger.info('[Storage] Storage initialization complete');
}

/**
 * Initialize storage with error handling
 * 
 * Safe wrapper that logs errors but doesn't throw.
 * Use this in production to prevent storage issues from crashing the app.
 */
export async function initializeStorageSafe(): Promise<boolean> {
  try {
    await initializeStorage();
    return true;
  } catch (error) {
    logger.error('[Storage] Storage initialization failed:', { error: error instanceof Error ? error.message : String(error) });
    logger.error('[Storage] Application may not function correctly');
    return false;
  }
}
