/**
 * Snapshot Migration Script
 * 
 * Migrates snapshot data from legacy format to new storage layer format.
 * 
 * **Legacy Format:**
 * - Mixed active context and recovery data
 * - No clear purpose distinction
 * - Inconsistent structure
 * 
 * **New Format:**
 * - Clear SnapshotData structure
 * - Explicit purpose (recovery/rollback/emergency)
 * - Consistent conversationState
 * 
 * @module snapshotMigration
 */

import { randomUUID } from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';

import type { Message } from '../types.js';
import type { SnapshotData, CheckpointSummary } from '../types/storageTypes.js';

// ============================================================================
// Legacy Types
// ============================================================================

/**
 * Legacy snapshot format (before refactor)
 */
interface LegacySnapshot {
  id?: string;
  sessionId: string;
  timestamp: number;
  messages?: Message[];
  userMessages?: Message[];
  metadata?: {
    checkpoints?: Array<{
      id?: string;
      timestamp: number;
      summary?: string;
      messageIds?: string[];
      tokenCount?: number;
      level?: number;
    }>;
    goals?: unknown[];
    [key: string]: unknown;
  };
  purpose?: string;
}

// ============================================================================
// Migration Options
// ============================================================================

/**
 * Options for snapshot migration
 */
export interface SnapshotMigrationOptions {
  /** Source directory containing legacy snapshots */
  sourceDir: string;

  /** Target directory for new snapshot files */
  targetDir: string;

  /** Whether to perform a dry run (no actual writes) */
  dryRun?: boolean;

  /** Whether to create backups before migration */
  createBackup?: boolean;

  /** Backup directory (if createBackup is true) */
  backupDir?: string;

  /** Whether to validate migrated data */
  validate?: boolean;

  /** Whether to log verbose output */
  verbose?: boolean;
}

/**
 * Result of snapshot migration
 */
export interface SnapshotMigrationResult {
  /** Whether the migration was successful */
  success: boolean;

  /** Number of snapshots migrated */
  snapshotsMigrated: number;

  /** Number of snapshots that failed migration */
  snapshotsFailed: number;

  /** List of errors encountered */
  errors: Array<{
    snapshotId: string;
    error: string;
  }>;

  /** List of warnings */
  warnings: string[];

  /** Dry run flag */
  dryRun: boolean;
}

// ============================================================================
// Migration Functions
// ============================================================================

/**
 * Migrate a single legacy snapshot to new format
 * 
 * @param legacySnapshot - Legacy snapshot data
 * @returns Migrated snapshot data
 */
export function migrateLegacySnapshot(legacySnapshot: LegacySnapshot): SnapshotData {
  // Combine messages and userMessages (legacy had them separate)
  const allMessages: Message[] = [];
  
  if (legacySnapshot.messages) {
    allMessages.push(...legacySnapshot.messages);
  }
  
  if (legacySnapshot.userMessages) {
    // Filter out duplicates (userMessages might be subset of messages)
    const existingIds = new Set(allMessages.map(m => m.id));
    for (const msg of legacySnapshot.userMessages) {
      if (!existingIds.has(msg.id)) {
        allMessages.push(msg);
      }
    }
  }

  // Sort messages by timestamp
  allMessages.sort((a, b) => {
    const aTime = a.timestamp instanceof Date ? a.timestamp.getTime() : new Date(a.timestamp).getTime();
    const bTime = b.timestamp instanceof Date ? b.timestamp.getTime() : new Date(b.timestamp).getTime();
    return aTime - bTime;
  });

  // Convert legacy checkpoints to new format
  const checkpoints: CheckpointSummary[] = [];
  
  if (legacySnapshot.metadata?.checkpoints) {
    for (const legacyCheckpoint of legacySnapshot.metadata.checkpoints) {
      const checkpoint: CheckpointSummary = {
        id: legacyCheckpoint.id || randomUUID(),
        timestamp: legacyCheckpoint.timestamp,
        summary: legacyCheckpoint.summary || '[Migrated checkpoint - summary unavailable]',
        originalMessageIds: legacyCheckpoint.messageIds || [],
        tokenCount: legacyCheckpoint.tokenCount || 0,
        compressionLevel: (legacyCheckpoint.level as 1 | 2 | 3) || 3,
        compressionNumber: 0, // Unknown in legacy format
        metadata: {
          model: 'unknown',
          createdAt: legacyCheckpoint.timestamp,
        },
      };
      checkpoints.push(checkpoint);
    }
  }

  // Determine purpose (default to recovery if not specified)
  let purpose: 'recovery' | 'rollback' | 'emergency' = 'recovery';
  if (legacySnapshot.purpose) {
    const purposeLower = legacySnapshot.purpose.toLowerCase();
    if (purposeLower === 'rollback' || purposeLower === 'emergency') {
      purpose = purposeLower as 'rollback' | 'emergency';
    }
  }

  // Create new snapshot data
  const snapshotData: SnapshotData = {
    id: legacySnapshot.id || randomUUID(),
    sessionId: legacySnapshot.sessionId,
    timestamp: legacySnapshot.timestamp,
    conversationState: {
      messages: allMessages,
      checkpoints,
      goals: legacySnapshot.metadata?.goals as any,
      metadata: {
        ...(legacySnapshot.metadata || {}),
        migrated: true,
        migratedAt: Date.now(),
      },
    },
    purpose,
  };

  return snapshotData;
}

/**
 * Validate migrated snapshot data
 * 
 * @param snapshotData - Migrated snapshot data
 * @returns Validation errors (empty if valid)
 */
export function validateMigratedSnapshot(snapshotData: SnapshotData): string[] {
  const errors: string[] = [];

  // Check required fields
  if (!snapshotData.id) {
    errors.push('Missing id');
  }

  if (!snapshotData.sessionId) {
    errors.push('Missing sessionId');
  }

  if (typeof snapshotData.timestamp !== 'number') {
    errors.push('Invalid timestamp');
  }

  if (!snapshotData.conversationState) {
    errors.push('Missing conversationState');
  } else {
    // Check conversationState fields
    if (!Array.isArray(snapshotData.conversationState.messages)) {
      errors.push('conversationState.messages is not an array');
    }

    if (!Array.isArray(snapshotData.conversationState.checkpoints)) {
      errors.push('conversationState.checkpoints is not an array');
    }

    if (typeof snapshotData.conversationState.metadata !== 'object') {
      errors.push('conversationState.metadata is not an object');
    }
  }

  // Check purpose
  const validPurposes = ['recovery', 'rollback', 'emergency'];
  if (!validPurposes.includes(snapshotData.purpose)) {
    errors.push(`Invalid purpose: ${snapshotData.purpose}`);
  }

  return errors;
}

/**
 * Migrate all snapshots in a directory
 * 
 * @param options - Migration options
 * @returns Migration result
 */
export async function migrateAllSnapshots(
  options: SnapshotMigrationOptions
): Promise<SnapshotMigrationResult> {
  const result: SnapshotMigrationResult = {
    success: true,
    snapshotsMigrated: 0,
    snapshotsFailed: 0,
    errors: [],
    warnings: [],
    dryRun: options.dryRun || false,
  };

  try {
    // Ensure source directory exists
    try {
      await fs.access(options.sourceDir);
    } catch {
      throw new Error(`Source directory does not exist: ${options.sourceDir}`);
    }

    // Create target directory if not dry run
    if (!options.dryRun) {
      await fs.mkdir(options.targetDir, { recursive: true });
    }

    // Create backup directory if requested
    if (options.createBackup && !options.dryRun) {
      const backupDir = options.backupDir || path.join(options.sourceDir, '../backup');
      await fs.mkdir(backupDir, { recursive: true });
    }

    // Read all snapshot files
    const files = await fs.readdir(options.sourceDir);
    const snapshotFiles = files.filter(f => f.endsWith('.json'));

    if (options.verbose) {
      console.log(`Found ${snapshotFiles.length} snapshot files to migrate`);
    }

    // Migrate each snapshot
    for (const file of snapshotFiles) {
      const sourcePath = path.join(options.sourceDir, file);
      const targetPath = path.join(options.targetDir, file);

      try {
        // Read legacy snapshot
        const content = await fs.readFile(sourcePath, 'utf-8');
        const legacySnapshot: LegacySnapshot = JSON.parse(content);

        // Migrate to new format
        const snapshotData = migrateLegacySnapshot(legacySnapshot);

        // Validate if requested
        if (options.validate) {
          const validationErrors = validateMigratedSnapshot(snapshotData);
          if (validationErrors.length > 0) {
            result.errors.push({
              snapshotId: legacySnapshot.id || file,
              error: `Validation failed: ${validationErrors.join(', ')}`,
            });
            result.snapshotsFailed++;
            continue;
          }
        }

        // Create backup if requested
        if (options.createBackup && !options.dryRun) {
          const backupDir = options.backupDir || path.join(options.sourceDir, '../backup');
          const backupPath = path.join(backupDir, file);
          await fs.copyFile(sourcePath, backupPath);
        }

        // Write migrated snapshot if not dry run
        if (!options.dryRun) {
          await fs.writeFile(targetPath, JSON.stringify(snapshotData, null, 2));
        }

        result.snapshotsMigrated++;

        if (options.verbose) {
          console.log(`✓ Migrated snapshot: ${snapshotData.id}`);
        }
      } catch (error) {
        result.errors.push({
          snapshotId: file,
          error: error instanceof Error ? error.message : String(error),
        });
        result.snapshotsFailed++;

        if (options.verbose) {
          console.error(`✗ Failed to migrate ${file}:`, error);
        }
      }
    }

    // Set overall success flag
    result.success = result.snapshotsFailed === 0;

    return result;
  } catch (error) {
    result.success = false;
    result.errors.push({
      snapshotId: 'MIGRATION',
      error: error instanceof Error ? error.message : String(error),
    });
    return result;
  }
}

/**
 * Rollback migration (restore from backup)
 * 
 * @param options - Migration options (must have backupDir)
 * @returns Rollback result
 */
export async function rollbackMigration(
  options: SnapshotMigrationOptions
): Promise<SnapshotMigrationResult> {
  const result: SnapshotMigrationResult = {
    success: true,
    snapshotsMigrated: 0,
    snapshotsFailed: 0,
    errors: [],
    warnings: [],
    dryRun: options.dryRun || false,
  };

  try {
    const backupDir = options.backupDir || path.join(options.sourceDir, '../backup');

    // Ensure backup directory exists
    try {
      await fs.access(backupDir);
    } catch {
      throw new Error(`Backup directory does not exist: ${backupDir}`);
    }

    // Read all backup files
    const files = await fs.readdir(backupDir);
    const snapshotFiles = files.filter(f => f.endsWith('.json'));

    if (options.verbose) {
      console.log(`Found ${snapshotFiles.length} backup files to restore`);
    }

    // Restore each snapshot
    for (const file of snapshotFiles) {
      const backupPath = path.join(backupDir, file);
      const targetPath = path.join(options.sourceDir, file);

      try {
        if (!options.dryRun) {
          await fs.copyFile(backupPath, targetPath);
        }

        result.snapshotsMigrated++;

        if (options.verbose) {
          console.log(`✓ Restored snapshot: ${file}`);
        }
      } catch (error) {
        result.errors.push({
          snapshotId: file,
          error: error instanceof Error ? error.message : String(error),
        });
        result.snapshotsFailed++;

        if (options.verbose) {
          console.error(`✗ Failed to restore ${file}:`, error);
        }
      }
    }

    result.success = result.snapshotsFailed === 0;

    return result;
  } catch (error) {
    result.success = false;
    result.errors.push({
      snapshotId: 'ROLLBACK',
      error: error instanceof Error ? error.message : String(error),
    });
    return result;
  }
}
