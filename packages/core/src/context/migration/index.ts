/**
 * Context Compression Migration
 *
 * This module provides migration utilities for upgrading from the legacy
 * context compression system to the new storage layer architecture.
 *
 * **Migration Types:**
 * - Session Migration: Migrates session data to new SessionHistory format
 * - Snapshot Migration: Migrates snapshots to new SnapshotData format
 *
 * **Features:**
 * - Dry run mode for testing
 * - Automatic backup creation
 * - Validation of migrated data
 * - Rollback capability
 * - CLI interface
 *
 * @module migration
 *
 * @example
 * ```typescript
 * import { migrateAllSessions, migrateAllSnapshots } from './migration/index.js';
 *
 * // Migrate sessions
 * const sessionResult = await migrateAllSessions({
 *   sourceDir: '~/.ollm/session-data',
 *   targetDir: '~/.ollm/session-history',
 *   dryRun: false,
 *   createBackup: true,
 *   validate: true,
 *   verbose: true
 * });
 *
 * // Migrate snapshots
 * const snapshotResult = await migrateAllSnapshots({
 *   sourceDir: '~/.ollm/snapshots',
 *   targetDir: '~/.ollm/snapshots-new',
 *   dryRun: false,
 *   createBackup: true,
 *   validate: true,
 *   verbose: true
 * });
 * ```
 */

// Session migration
export {
  migrateLegacySession,
  migrateLegacyCheckpoint,
  validateMigratedSession,
  migrateAllSessions,
  rollbackMigration as rollbackSessionMigration,
  type SessionMigrationOptions,
  type SessionMigrationResult,
} from './sessionMigration.js';

// Snapshot migration
export {
  migrateLegacySnapshot,
  validateMigratedSnapshot,
  migrateAllSnapshots,
  rollbackMigration as rollbackSnapshotMigration,
  type SnapshotMigrationOptions,
  type SnapshotMigrationResult,
} from './snapshotMigration.js';

// CLI
export { main as runMigrationCLI, parseArgs, type MigrationCLIOptions } from './migrationCLI.js';
