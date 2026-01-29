# Context Compression Migration

This directory contains migration scripts for upgrading from the legacy context compression system to the new storage layer architecture.

## Overview

The context compression system has been completely refactored to fix critical architectural flaws. This migration tooling helps you upgrade existing session data and snapshots to the new format.

### What Changed?

**Legacy Format:**
- Mixed storage layers (active context + snapshots + history)
- No clear separation between LLM-bound and recovery data
- Checkpoints stored as metadata

**New Format:**
- Three distinct storage layers (ActiveContext, SnapshotData, SessionHistory)
- Clear separation enforced at runtime
- Checkpoints as first-class objects

## Migration Types

### Session Migration

Migrates session data from legacy format to new `SessionHistory` format.

**What it does:**
- Converts legacy session files to new format
- Extracts checkpoint records from metadata
- Preserves all messages
- Calculates accurate token counts

### Snapshot Migration

Migrates snapshot data from legacy format to new `SnapshotData` format.

**What it does:**
- Converts legacy snapshot files to new format
- Combines separate `messages` and `userMessages` arrays
- Converts legacy checkpoints to new format
- Ensures proper purpose classification

## Usage

### Command Line Interface

The migration CLI provides a simple interface for running migrations:

```bash
# Dry run (no actual changes)
npm run migrate -- --dry-run

# Migrate sessions
npm run migrate -- --type session --source ~/.ollm/session-data --target ~/.ollm/session-history --backup

# Migrate snapshots
npm run migrate -- --type snapshot --source ~/.ollm/snapshots --target ~/.ollm/snapshots-new --backup

# Rollback migration
npm run migrate -- --rollback --type session --source ~/.ollm/session-data
```

### CLI Options

| Option | Description | Default |
|--------|-------------|---------|
| `--type <type>` | Migration type: `session` or `snapshot` | `session` |
| `--source <dir>` | Source directory | `~/.ollm/session-data` or `~/.ollm/snapshots` |
| `--target <dir>` | Target directory | `~/.ollm/session-history` or `~/.ollm/snapshots-new` |
| `--dry-run` | Perform a dry run (no actual changes) | `false` |
| `--backup` | Create backup before migration | `false` |
| `--backup-dir <dir>` | Backup directory | `~/.ollm/migration-backup` |
| `--no-validate` | Skip validation of migrated data | Validation enabled |
| `--verbose, -v` | Verbose output | `false` |
| `--rollback` | Rollback migration from backup | `false` |
| `--help, -h` | Show help message | - |

### Programmatic Usage

You can also use the migration functions programmatically:

```typescript
import { migrateAllSessions, migrateAllSnapshots } from '@ollm/ollm-cli-core/context/migration';

// Migrate sessions
const sessionResult = await migrateAllSessions({
  sourceDir: '~/.ollm/session-data',
  targetDir: '~/.ollm/session-history',
  dryRun: false,
  createBackup: true,
  validate: true,
  verbose: true
});

console.log(`Migrated ${sessionResult.sessionsMigrated} sessions`);

// Migrate snapshots
const snapshotResult = await migrateAllSnapshots({
  sourceDir: '~/.ollm/snapshots',
  targetDir: '~/.ollm/snapshots-new',
  dryRun: false,
  createBackup: true,
  validate: true,
  verbose: true
});

console.log(`Migrated ${snapshotResult.snapshotsMigrated} snapshots`);
```

## Migration Workflow

### Recommended Steps

1. **Backup your data** (always do this first!)
   ```bash
   cp -r ~/.ollm/session-data ~/.ollm/session-data.backup
   cp -r ~/.ollm/snapshots ~/.ollm/snapshots.backup
   ```

2. **Run a dry run** to see what will happen
   ```bash
   npm run migrate -- --type session --dry-run --verbose
   npm run migrate -- --type snapshot --dry-run --verbose
   ```

3. **Run the actual migration with backup**
   ```bash
   npm run migrate -- --type session --backup --verbose
   npm run migrate -- --type snapshot --backup --verbose
   ```

4. **Verify the migration**
   - Check that all files were migrated successfully
   - Review any errors or warnings
   - Test the new system with migrated data

5. **If something goes wrong, rollback**
   ```bash
   npm run migrate -- --rollback --type session
   npm run migrate -- --rollback --type snapshot
   ```

## Migration Result

The migration returns a result object with the following structure:

```typescript
{
  success: boolean;           // Overall success flag
  sessionsMigrated: number;   // Number of sessions migrated (or snapshotsMigrated)
  sessionsFailed: number;     // Number of sessions that failed (or snapshotsFailed)
  errors: Array<{             // List of errors
    sessionId: string;        // Session/snapshot ID
    error: string;            // Error message
  }>;
  warnings: string[];         // List of warnings
  dryRun: boolean;           // Whether this was a dry run
}
```

## Validation

The migration includes built-in validation to ensure data integrity:

### Session Validation

- ✅ Session ID is present
- ✅ Messages array is valid
- ✅ Checkpoint records are valid
- ✅ Metadata is complete and consistent
- ✅ Message count matches metadata

### Snapshot Validation

- ✅ Snapshot ID is present
- ✅ Session ID is present
- ✅ Timestamp is valid
- ✅ Conversation state is complete
- ✅ Purpose is valid (recovery/rollback/emergency)
- ✅ Messages and checkpoints are valid arrays

## Troubleshooting

### Migration Fails with Validation Errors

**Problem:** Migration reports validation errors

**Solution:**
1. Run with `--verbose` to see detailed errors
2. Check the error messages for specific issues
3. Fix the source data if possible
4. Use `--no-validate` to skip validation (not recommended)

### Files Not Found

**Problem:** Source directory doesn't exist

**Solution:**
1. Verify the source directory path
2. Check that you have session data to migrate
3. Use `--source` to specify the correct path

### Backup Directory Full

**Problem:** Not enough space for backups

**Solution:**
1. Free up disk space
2. Use a different backup directory with `--backup-dir`
3. Skip backup (not recommended) by omitting `--backup`

### Rollback Fails

**Problem:** Cannot restore from backup

**Solution:**
1. Verify backup directory exists
2. Check that backup files are intact
3. Manually restore from your manual backup

## Testing

The migration scripts include comprehensive tests:

```bash
# Run all migration tests
npm test -- packages/core/src/context/migration/__tests__/ --run

# Run specific test file
npm test -- packages/core/src/context/migration/__tests__/sessionMigration.test.ts --run
npm test -- packages/core/src/context/migration/__tests__/snapshotMigration.test.ts --run
```

### Test Coverage

- ✅ Unit tests for migration functions
- ✅ Unit tests for validation functions
- ✅ Integration tests for full migration workflow
- ✅ Dry run tests
- ✅ Backup creation tests
- ✅ Rollback tests
- ✅ Error handling tests

## Files

| File | Description |
|------|-------------|
| `sessionMigration.ts` | Session migration logic |
| `snapshotMigration.ts` | Snapshot migration logic |
| `migrationCLI.ts` | Command-line interface |
| `index.ts` | Public API exports |
| `__tests__/sessionMigration.test.ts` | Session migration tests |
| `__tests__/snapshotMigration.test.ts` | Snapshot migration tests |
| `README.md` | This file |

## API Reference

### Session Migration

```typescript
// Migrate a single legacy session
function migrateLegacySession(legacySession: LegacySession): SessionHistory

// Migrate a legacy checkpoint
function migrateLegacyCheckpoint(
  legacyCheckpoint: LegacyCheckpoint,
  compressionNumber: number
): CheckpointSummary

// Validate migrated session
function validateMigratedSession(sessionHistory: SessionHistory): string[]

// Migrate all sessions in a directory
async function migrateAllSessions(
  options: SessionMigrationOptions
): Promise<SessionMigrationResult>

// Rollback session migration
async function rollbackMigration(
  options: SessionMigrationOptions
): Promise<SessionMigrationResult>
```

### Snapshot Migration

```typescript
// Migrate a single legacy snapshot
function migrateLegacySnapshot(legacySnapshot: LegacySnapshot): SnapshotData

// Validate migrated snapshot
function validateMigratedSnapshot(snapshotData: SnapshotData): string[]

// Migrate all snapshots in a directory
async function migrateAllSnapshots(
  options: SnapshotMigrationOptions
): Promise<SnapshotMigrationResult>

// Rollback snapshot migration
async function rollbackMigration(
  options: SnapshotMigrationOptions
): Promise<SnapshotMigrationResult>
```

### CLI

```typescript
// Run migration CLI
async function runMigrationCLI(args: string[]): Promise<void>

// Parse command-line arguments
function parseArgs(args: string[]): MigrationCLIOptions
```

## Support

If you encounter issues with migration:

1. Check this README for troubleshooting tips
2. Review the error messages carefully
3. Run with `--verbose` for detailed output
4. Check the test files for examples
5. Open an issue on GitHub with:
   - Migration command used
   - Error messages
   - Relevant log output

## License

Same as the main OLLM CLI project.
