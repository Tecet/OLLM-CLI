/**
 * Storage Migration Utility
 * 
 * Handles migration of session and snapshot data from old unified location
 * to new separated locations.
 * 
 * Old structure:
 *   ~/.ollm/session-data/
 *     ├── {sessionId}.json (sessions)
 *     └── {sessionId}/snapshots/ (snapshots)
 * 
 * New structure:
 *   ~/.ollm/sessions/
 *     └── {sessionId}.json
 *   ~/.ollm/context-snapshots/
 *     └── {sessionId}/snapshots/
 */

import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';

/**
 * Migration result
 */
export interface MigrationResult {
  success: boolean;
  sessionsMigrated: number;
  snapshotsMigrated: number;
  errors: string[];
  skipped: boolean;
}

/**
 * Check if migration is needed
 */
export async function needsMigration(): Promise<boolean> {
  const oldLocation = path.join(os.homedir(), '.ollm', 'session-data');
  const newSessionsLocation = path.join(os.homedir(), '.ollm', 'sessions');
  const newSnapshotsLocation = path.join(os.homedir(), '.ollm', 'context-snapshots');

  // Check if old location exists
  try {
    await fs.access(oldLocation);
  } catch {
    // Old location doesn't exist, no migration needed
    return false;
  }

  // Check if new locations already have data
  try {
    const sessionsExist = await fs.access(newSessionsLocation).then(() => true).catch(() => false);
    const snapshotsExist = await fs.access(newSnapshotsLocation).then(() => true).catch(() => false);

    // If new locations exist and have files, assume migration already done
    if (sessionsExist || snapshotsExist) {
      return false;
    }
  } catch {
    // Error checking new locations, proceed with migration
  }

  return true;
}

/**
 * Migrate storage from old to new locations
 */
export async function migrateStorage(): Promise<MigrationResult> {
  const result: MigrationResult = {
    success: true,
    sessionsMigrated: 0,
    snapshotsMigrated: 0,
    errors: [],
    skipped: false,
  };

  const oldLocation = path.join(os.homedir(), '.ollm', 'session-data');
  const newSessionsLocation = path.join(os.homedir(), '.ollm', 'sessions');
  const newSnapshotsLocation = path.join(os.homedir(), '.ollm', 'context-snapshots');

  // Check if migration is needed
  if (!(await needsMigration())) {
    result.skipped = true;
    return result;
  }

  console.log('[Migration] Starting storage migration...');
  console.log(`[Migration] Old location: ${oldLocation}`);
  console.log(`[Migration] New sessions location: ${newSessionsLocation}`);
  console.log(`[Migration] New snapshots location: ${newSnapshotsLocation}`);

  try {
    // Create new directories
    await fs.mkdir(newSessionsLocation, { recursive: true });
    await fs.mkdir(newSnapshotsLocation, { recursive: true });

    // Read old location
    const entries = await fs.readdir(oldLocation, { withFileTypes: true });

    // Migrate session files and snapshot directories
    for (const entry of entries) {
      const oldPath = path.join(oldLocation, entry.name);

      if (entry.isFile() && entry.name.endsWith('.json')) {
        // Session file - move to new sessions location
        try {
          const newPath = path.join(newSessionsLocation, entry.name);
          await fs.copyFile(oldPath, newPath);
          result.sessionsMigrated++;
          console.log(`[Migration] Migrated session: ${entry.name}`);
        } catch (error) {
          const errorMsg = `Failed to migrate session ${entry.name}: ${error instanceof Error ? error.message : String(error)}`;
          result.errors.push(errorMsg);
          console.error(`[Migration] ${errorMsg}`);
        }
      } else if (entry.isDirectory()) {
        // Snapshot directory - move to new snapshots location
        try {
          const newPath = path.join(newSnapshotsLocation, entry.name);
          await copyDirectory(oldPath, newPath);
          
          // Count snapshots
          const snapshotsDir = path.join(newPath, 'snapshots');
          try {
            const snapshots = await fs.readdir(snapshotsDir);
            const snapshotFiles = snapshots.filter(f => f.startsWith('snapshot-') && f.endsWith('.json'));
            result.snapshotsMigrated += snapshotFiles.length;
          } catch {
            // Ignore if snapshots directory doesn't exist
          }
          
          console.log(`[Migration] Migrated snapshots for session: ${entry.name}`);
        } catch (error) {
          const errorMsg = `Failed to migrate snapshots for ${entry.name}: ${error instanceof Error ? error.message : String(error)}`;
          result.errors.push(errorMsg);
          console.error(`[Migration] ${errorMsg}`);
        }
      }
    }

    // If migration was successful and no errors, remove old location
    if (result.errors.length === 0) {
      try {
        await fs.rm(oldLocation, { recursive: true, force: true });
        console.log('[Migration] Removed old location');
      } catch (error) {
        const errorMsg = `Failed to remove old location: ${error instanceof Error ? error.message : String(error)}`;
        result.errors.push(errorMsg);
        console.warn(`[Migration] ${errorMsg}`);
      }
    }

    console.log('[Migration] Migration completed successfully');
    console.log(`[Migration] Sessions migrated: ${result.sessionsMigrated}`);
    console.log(`[Migration] Snapshots migrated: ${result.snapshotsMigrated}`);

    if (result.errors.length > 0) {
      console.warn(`[Migration] Errors encountered: ${result.errors.length}`);
      result.success = false;
    }
  } catch (error) {
    result.success = false;
    const errorMsg = `Migration failed: ${error instanceof Error ? error.message : String(error)}`;
    result.errors.push(errorMsg);
    console.error(`[Migration] ${errorMsg}`);
  }

  return result;
}

/**
 * Copy directory recursively
 */
async function copyDirectory(src: string, dest: string): Promise<void> {
  await fs.mkdir(dest, { recursive: true });
  
  const entries = await fs.readdir(src, { withFileTypes: true });
  
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    
    if (entry.isDirectory()) {
      await copyDirectory(srcPath, destPath);
    } else {
      await fs.copyFile(srcPath, destPath);
    }
  }
}

/**
 * Run migration if needed (safe to call multiple times)
 */
export async function runMigrationIfNeeded(): Promise<MigrationResult | null> {
  if (await needsMigration()) {
    return await migrateStorage();
  }
  return null;
}
