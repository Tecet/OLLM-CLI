/**
 * Storage Initialization
 *
 * Handles storage initialization tasks including migration and directory setup.
 */

import { ensureStorageDirectories, logAllStorageLocations } from './pathValidation.js';
import { runMigrationIfNeeded } from './storageMigration.js';

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
  console.log('[Storage] Initializing storage system...');

  // Log storage locations for debugging
  logAllStorageLocations();

  // Run migration if needed
  try {
    const migrationResult = await runMigrationIfNeeded();

    if (migrationResult) {
      if (migrationResult.success) {
        console.log('[Storage] Migration completed successfully');
        console.log(`[Storage] Sessions migrated: ${migrationResult.sessionsMigrated}`);
        console.log(`[Storage] Snapshots migrated: ${migrationResult.snapshotsMigrated}`);
      } else {
        console.warn('[Storage] Migration had errors:');
        for (const error of migrationResult.errors) {
          console.warn(`[Storage]   - ${error}`);
        }
      }
    } else {
      console.log('[Storage] No migration needed');
    }
  } catch (error) {
    console.error('[Storage] Migration failed:', error);
    // Don't throw - allow app to continue even if migration fails
  }

  // Ensure all storage directories exist
  try {
    await ensureStorageDirectories();
    console.log('[Storage] All storage directories verified');
  } catch (error) {
    console.error('[Storage] Failed to create storage directories:', error);
    throw error; // This is critical - can't continue without storage
  }

  console.log('[Storage] Storage initialization complete');
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
    console.error('[Storage] Storage initialization failed:', error);
    console.error('[Storage] Application may not function correctly');
    return false;
  }
}
