/**
 * Migration CLI
 * 
 * Command-line interface for running context compression migrations.
 * 
 * **Usage:**
 * ```bash
 * # Dry run (no actual changes)
 * npm run migrate -- --dry-run
 * 
 * # Migrate sessions
 * npm run migrate -- --type session --source ~/.ollm/session-data --target ~/.ollm/session-history
 * 
 * # Migrate snapshots
 * npm run migrate -- --type snapshot --source ~/.ollm/snapshots --target ~/.ollm/snapshots-new
 * 
 * # Migrate with backup
 * npm run migrate -- --type session --source ~/.ollm/session-data --target ~/.ollm/session-history --backup
 * 
 * # Rollback migration
 * npm run migrate -- --rollback --type session --source ~/.ollm/session-data
 * ```
 * 
 * @module migrationCLI
 */

import * as os from 'os';
import * as path from 'path';

import {
  migrateAllSessions,
  rollbackMigration as rollbackSessionMigration,
  type SessionMigrationOptions,
  type SessionMigrationResult,
} from './sessionMigration.js';
import {
  migrateAllSnapshots,
  rollbackMigration as rollbackSnapshotMigration,
  type SnapshotMigrationOptions,
  type SnapshotMigrationResult,
} from './snapshotMigration.js';

// ============================================================================
// CLI Options
// ============================================================================

/**
 * CLI options for migration
 */
export interface MigrationCLIOptions {
  /** Migration type (session or snapshot) */
  type: 'session' | 'snapshot';

  /** Source directory */
  source?: string;

  /** Target directory */
  target?: string;

  /** Dry run flag */
  dryRun?: boolean;

  /** Create backup flag */
  backup?: boolean;

  /** Backup directory */
  backupDir?: string;

  /** Validate flag */
  validate?: boolean;

  /** Verbose flag */
  verbose?: boolean;

  /** Rollback flag */
  rollback?: boolean;
}

// ============================================================================
// Default Paths
// ============================================================================

/**
 * Get default paths for migration
 */
function getDefaultPaths(): {
  sessionSource: string;
  sessionTarget: string;
  snapshotSource: string;
  snapshotTarget: string;
  backupDir: string;
} {
  const homeDir = os.homedir();
  const ollmDir = path.join(homeDir, '.ollm');

  return {
    sessionSource: path.join(ollmDir, 'session-data'),
    sessionTarget: path.join(ollmDir, 'session-history'),
    snapshotSource: path.join(ollmDir, 'snapshots'),
    snapshotTarget: path.join(ollmDir, 'snapshots-new'),
    backupDir: path.join(ollmDir, 'migration-backup'),
  };
}

// ============================================================================
// CLI Functions
// ============================================================================

/**
 * Parse command-line arguments
 * 
 * @param args - Command-line arguments
 * @returns Parsed options
 */
export function parseArgs(args: string[]): MigrationCLIOptions {
  const options: MigrationCLIOptions = {
    type: 'session',
    dryRun: false,
    backup: false,
    validate: true,
    verbose: false,
    rollback: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case '--type':
        options.type = args[++i] as 'session' | 'snapshot';
        break;

      case '--source':
        options.source = args[++i];
        break;

      case '--target':
        options.target = args[++i];
        break;

      case '--dry-run':
        options.dryRun = true;
        break;

      case '--backup':
        options.backup = true;
        break;

      case '--backup-dir':
        options.backupDir = args[++i];
        break;

      case '--no-validate':
        options.validate = false;
        break;

      case '--verbose':
      case '-v':
        options.verbose = true;
        break;

      case '--rollback':
        options.rollback = true;
        break;

      case '--help':
      case '-h':
        printHelp();
        process.exit(0);
        break;
    }
  }

  return options;
}

/**
 * Print help message
 */
function printHelp(): void {
  console.log(`
Context Compression Migration Tool

Usage:
  npm run migrate -- [options]

Options:
  --type <type>           Migration type: session or snapshot (default: session)
  --source <dir>          Source directory (default: ~/.ollm/session-data or ~/.ollm/snapshots)
  --target <dir>          Target directory (default: ~/.ollm/session-history or ~/.ollm/snapshots-new)
  --dry-run               Perform a dry run (no actual changes)
  --backup                Create backup before migration
  --backup-dir <dir>      Backup directory (default: ~/.ollm/migration-backup)
  --no-validate           Skip validation of migrated data
  --verbose, -v           Verbose output
  --rollback              Rollback migration from backup
  --help, -h              Show this help message

Examples:
  # Dry run
  npm run migrate -- --dry-run

  # Migrate sessions
  npm run migrate -- --type session --backup --verbose

  # Migrate snapshots
  npm run migrate -- --type snapshot --backup --verbose

  # Rollback session migration
  npm run migrate -- --rollback --type session

  # Custom paths
  npm run migrate -- --type session --source /path/to/old --target /path/to/new
  `);
}

/**
 * Print migration result
 * 
 * @param result - Migration result
 * @param type - Migration type
 */
function printResult(
  result: SessionMigrationResult | SnapshotMigrationResult,
  type: 'session' | 'snapshot'
): void {
  console.log('\n' + '='.repeat(60));
  console.log(`${type.toUpperCase()} MIGRATION RESULT`);
  console.log('='.repeat(60));

  if (result.dryRun) {
    console.log('\n⚠️  DRY RUN - No actual changes were made\n');
  }

  console.log(`Status: ${result.success ? '✅ SUCCESS' : '❌ FAILED'}`);
  
  // Handle different result types
  if ('sessionsMigrated' in result) {
    console.log(`Migrated: ${result.sessionsMigrated}`);
    console.log(`Failed: ${result.sessionsFailed}`);
  } else {
    console.log(`Migrated: ${result.snapshotsMigrated}`);
    console.log(`Failed: ${result.snapshotsFailed}`);
  }

  if (result.warnings.length > 0) {
    console.log(`\n⚠️  Warnings (${result.warnings.length}):`);
    for (const warning of result.warnings) {
      console.log(`  - ${warning}`);
    }
  }

  if (result.errors.length > 0) {
    console.log(`\n❌ Errors (${result.errors.length}):`);
    for (const error of result.errors) {
      const id = 'sessionId' in error ? error.sessionId : error.snapshotId;
      console.log(`  - ${id}: ${error.error}`);
    }
  }

  console.log('\n' + '='.repeat(60) + '\n');
}

/**
 * Run session migration
 * 
 * @param options - CLI options
 */
async function runSessionMigration(options: MigrationCLIOptions): Promise<void> {
  const defaults = getDefaultPaths();

  const migrationOptions: SessionMigrationOptions = {
    sourceDir: options.source || defaults.sessionSource,
    targetDir: options.target || defaults.sessionTarget,
    dryRun: options.dryRun,
    createBackup: options.backup,
    backupDir: options.backupDir || defaults.backupDir,
    validate: options.validate,
    verbose: options.verbose,
  };

  console.log('\n🔄 Starting session migration...\n');
  console.log(`Source: ${migrationOptions.sourceDir}`);
  console.log(`Target: ${migrationOptions.targetDir}`);
  if (migrationOptions.createBackup) {
    console.log(`Backup: ${migrationOptions.backupDir}`);
  }
  console.log('');

  let result: SessionMigrationResult;

  if (options.rollback) {
    console.log('⏪ Rolling back migration...\n');
    result = await rollbackSessionMigration(migrationOptions);
  } else {
    result = await migrateAllSessions(migrationOptions);
  }

  printResult(result, 'session');

  if (!result.success) {
    process.exit(1);
  }
}

/**
 * Run snapshot migration
 * 
 * @param options - CLI options
 */
async function runSnapshotMigration(options: MigrationCLIOptions): Promise<void> {
  const defaults = getDefaultPaths();

  const migrationOptions: SnapshotMigrationOptions = {
    sourceDir: options.source || defaults.snapshotSource,
    targetDir: options.target || defaults.snapshotTarget,
    dryRun: options.dryRun,
    createBackup: options.backup,
    backupDir: options.backupDir || defaults.backupDir,
    validate: options.validate,
    verbose: options.verbose,
  };

  console.log('\n🔄 Starting snapshot migration...\n');
  console.log(`Source: ${migrationOptions.sourceDir}`);
  console.log(`Target: ${migrationOptions.targetDir}`);
  if (migrationOptions.createBackup) {
    console.log(`Backup: ${migrationOptions.backupDir}`);
  }
  console.log('');

  let result: SnapshotMigrationResult;

  if (options.rollback) {
    console.log('⏪ Rolling back migration...\n');
    result = await rollbackSnapshotMigration(migrationOptions);
  } else {
    result = await migrateAllSnapshots(migrationOptions);
  }

  printResult(result, 'snapshot');

  if (!result.success) {
    process.exit(1);
  }
}

/**
 * Main CLI entry point
 * 
 * @param args - Command-line arguments
 */
export async function main(args: string[]): Promise<void> {
  try {
    const options = parseArgs(args);

    if (options.type === 'session') {
      await runSessionMigration(options);
    } else if (options.type === 'snapshot') {
      await runSnapshotMigration(options);
    } else {
      console.error(`Unknown migration type: ${options.type}`);
      process.exit(1);
    }
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main(process.argv.slice(2));
}
