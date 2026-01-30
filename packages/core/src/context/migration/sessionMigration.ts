/**
 * Session Migration Script
 *
 * Migrates session data from legacy format to new storage layer format.
 *
 * **Legacy Format:**
 * - Mixed storage layers (active context + snapshots + history)
 * - No clear separation between LLM-bound and recovery data
 * - Checkpoints stored as metadata
 *
 * **New Format:**
 * - Three distinct storage layers (ActiveContext, SnapshotData, SessionHistory)
 * - Clear separation enforced at runtime
 * - Checkpoints as first-class objects
 *
 * @module sessionMigration
 */

import { randomUUID } from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';

import type { CheckpointRecord, CheckpointSummary, SessionHistory } from '../types/storageTypes.js';
import type { Message } from '../types.js';

// ============================================================================
// Legacy Types
// ============================================================================

/**
 * Legacy session format (before refactor)
 */
interface LegacySession {
  sessionId: string;
  messages: Message[];
  metadata?: {
    checkpoints?: Array<{
      id?: string;
      timestamp: number;
      summary?: string;
      messageIds?: string[];
      tokenCount?: number;
      level?: number;
    }>;
    compressionCount?: number;
    totalTokens?: number;
  };
  startTime?: number;
  lastUpdate?: number;
}

/**
 * Legacy checkpoint format
 */
interface LegacyCheckpoint {
  id?: string;
  timestamp: number;
  summary?: string;
  messageIds?: string[];
  tokenCount?: number;
  level?: number;
}

// ============================================================================
// Migration Options
// ============================================================================

/**
 * Options for session migration
 */
export interface SessionMigrationOptions {
  /** Source directory containing legacy sessions */
  sourceDir: string;

  /** Target directory for new session history files */
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
 * Result of session migration
 */
export interface SessionMigrationResult {
  /** Whether the migration was successful */
  success: boolean;

  /** Number of sessions migrated */
  sessionsMigrated: number;

  /** Number of sessions that failed migration */
  sessionsFailed: number;

  /** List of errors encountered */
  errors: Array<{
    sessionId: string;
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
 * Migrate a single legacy session to new format
 *
 * @param legacySession - Legacy session data
 * @returns Migrated session history
 */
export function migrateLegacySession(legacySession: LegacySession): SessionHistory {
  // Extract checkpoint records from metadata
  const checkpointRecords: CheckpointRecord[] = [];

  if (legacySession.metadata?.checkpoints) {
    for (const legacyCheckpoint of legacySession.metadata.checkpoints) {
      const record: CheckpointRecord = {
        id: legacyCheckpoint.id || randomUUID(),
        timestamp: legacyCheckpoint.timestamp,
        messageRange: [0, legacyCheckpoint.messageIds?.length || 0], // Approximate
        originalTokens: legacyCheckpoint.tokenCount || 0,
        compressedTokens: legacyCheckpoint.tokenCount || 0,
        compressionRatio: 1.0, // Unknown in legacy format
        level: (legacyCheckpoint.level as 1 | 2 | 3) || 3,
      };
      checkpointRecords.push(record);
    }
  }

  // Calculate total tokens (approximate if not available)
  const totalTokens =
    legacySession.metadata?.totalTokens ||
    legacySession.messages.reduce((sum, msg) => sum + Math.ceil(msg.content.length / 4), 0);

  // Create new session history
  const sessionHistory: SessionHistory = {
    sessionId: legacySession.sessionId,
    messages: [...legacySession.messages], // Copy all messages
    checkpointRecords,
    metadata: {
      startTime: legacySession.startTime || Date.now(),
      lastUpdate: legacySession.lastUpdate || Date.now(),
      totalMessages: legacySession.messages.length,
      totalTokens,
      compressionCount: legacySession.metadata?.compressionCount || 0,
    },
  };

  return sessionHistory;
}

/**
 * Migrate legacy checkpoint to new checkpoint summary format
 *
 * @param legacyCheckpoint - Legacy checkpoint data
 * @param compressionNumber - Current compression number
 * @returns Migrated checkpoint summary
 */
export function migrateLegacyCheckpoint(
  legacyCheckpoint: LegacyCheckpoint,
  compressionNumber: number
): CheckpointSummary {
  return {
    id: legacyCheckpoint.id || randomUUID(),
    timestamp: legacyCheckpoint.timestamp,
    summary: legacyCheckpoint.summary || '[Migrated checkpoint - summary unavailable]',
    originalMessageIds: legacyCheckpoint.messageIds || [],
    tokenCount: legacyCheckpoint.tokenCount || 0,
    compressionLevel: (legacyCheckpoint.level as 1 | 2 | 3) || 3,
    compressionNumber,
    metadata: {
      model: 'unknown', // Not available in legacy format
      createdAt: legacyCheckpoint.timestamp,
    },
  };
}

/**
 * Validate migrated session history
 *
 * @param sessionHistory - Migrated session history
 * @returns Validation errors (empty if valid)
 */
export function validateMigratedSession(sessionHistory: SessionHistory): string[] {
  const errors: string[] = [];

  // Check required fields
  if (!sessionHistory.sessionId) {
    errors.push('Missing sessionId');
  }

  if (!Array.isArray(sessionHistory.messages)) {
    errors.push('Messages is not an array');
    // Return early to avoid further errors
    return errors;
  }

  if (!Array.isArray(sessionHistory.checkpointRecords)) {
    errors.push('CheckpointRecords is not an array');
  }

  if (!sessionHistory.metadata) {
    errors.push('Missing metadata');
  } else {
    // Check metadata fields
    if (typeof sessionHistory.metadata.startTime !== 'number') {
      errors.push('Invalid metadata.startTime');
    }

    if (typeof sessionHistory.metadata.lastUpdate !== 'number') {
      errors.push('Invalid metadata.lastUpdate');
    }

    if (typeof sessionHistory.metadata.totalMessages !== 'number') {
      errors.push('Invalid metadata.totalMessages');
    }

    if (typeof sessionHistory.metadata.totalTokens !== 'number') {
      errors.push('Invalid metadata.totalTokens');
    }

    if (typeof sessionHistory.metadata.compressionCount !== 'number') {
      errors.push('Invalid metadata.compressionCount');
    }

    // Check consistency (only if messages is valid array)
    if (
      Array.isArray(sessionHistory.messages) &&
      sessionHistory.metadata.totalMessages !== sessionHistory.messages.length
    ) {
      errors.push(
        `Metadata totalMessages (${sessionHistory.metadata.totalMessages}) ` +
          `doesn't match actual message count (${sessionHistory.messages.length})`
      );
    }
  }

  return errors;
}

/**
 * Migrate all sessions in a directory
 *
 * @param options - Migration options
 * @returns Migration result
 */
export async function migrateAllSessions(
  options: SessionMigrationOptions
): Promise<SessionMigrationResult> {
  const result: SessionMigrationResult = {
    success: true,
    sessionsMigrated: 0,
    sessionsFailed: 0,
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

    // Read all session files
    const files = await fs.readdir(options.sourceDir);
    const sessionFiles = files.filter((f) => f.endsWith('.json'));

    if (options.verbose) {
      console.log(`Found ${sessionFiles.length} session files to migrate`);
    }

    // Migrate each session
    for (const file of sessionFiles) {
      const sourcePath = path.join(options.sourceDir, file);
      const targetPath = path.join(options.targetDir, file);

      try {
        // Read legacy session
        const content = await fs.readFile(sourcePath, 'utf-8');
        const legacySession: LegacySession = JSON.parse(content);

        // Migrate to new format
        const sessionHistory = migrateLegacySession(legacySession);

        // Validate if requested
        if (options.validate) {
          const validationErrors = validateMigratedSession(sessionHistory);
          if (validationErrors.length > 0) {
            result.errors.push({
              sessionId: legacySession.sessionId,
              error: `Validation failed: ${validationErrors.join(', ')}`,
            });
            result.sessionsFailed++;
            continue;
          }
        }

        // Create backup if requested
        if (options.createBackup && !options.dryRun) {
          const backupDir = options.backupDir || path.join(options.sourceDir, '../backup');
          const backupPath = path.join(backupDir, file);
          await fs.copyFile(sourcePath, backupPath);
        }

        // Write migrated session if not dry run
        if (!options.dryRun) {
          await fs.writeFile(targetPath, JSON.stringify(sessionHistory, null, 2));
        }

        result.sessionsMigrated++;

        if (options.verbose) {
          console.log(`✓ Migrated session: ${legacySession.sessionId}`);
        }
      } catch (error) {
        result.errors.push({
          sessionId: file,
          error: error instanceof Error ? error.message : String(error),
        });
        result.sessionsFailed++;

        if (options.verbose) {
          console.error(`✗ Failed to migrate ${file}:`, error);
        }
      }
    }

    // Set overall success flag
    result.success = result.sessionsFailed === 0;

    return result;
  } catch (error) {
    result.success = false;
    result.errors.push({
      sessionId: 'MIGRATION',
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
  options: SessionMigrationOptions
): Promise<SessionMigrationResult> {
  const result: SessionMigrationResult = {
    success: true,
    sessionsMigrated: 0,
    sessionsFailed: 0,
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
    const sessionFiles = files.filter((f) => f.endsWith('.json'));

    if (options.verbose) {
      console.log(`Found ${sessionFiles.length} backup files to restore`);
    }

    // Restore each session
    for (const file of sessionFiles) {
      const backupPath = path.join(backupDir, file);
      const targetPath = path.join(options.sourceDir, file);

      try {
        if (!options.dryRun) {
          await fs.copyFile(backupPath, targetPath);
        }

        result.sessionsMigrated++;

        if (options.verbose) {
          console.log(`✓ Restored session: ${file}`);
        }
      } catch (error) {
        result.errors.push({
          sessionId: file,
          error: error instanceof Error ? error.message : String(error),
        });
        result.sessionsFailed++;

        if (options.verbose) {
          console.error(`✗ Failed to restore ${file}:`, error);
        }
      }
    }

    result.success = result.sessionsFailed === 0;

    return result;
  } catch (error) {
    result.success = false;
    result.errors.push({
      sessionId: 'ROLLBACK',
      error: error instanceof Error ? error.message : String(error),
    });
    return result;
  }
}
