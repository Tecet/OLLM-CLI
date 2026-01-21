/**
 * Snapshot Management Commands
 * 
 * Implements commands for managing context snapshots:
 * - /snapshot list <session-id> - List snapshots for a session
 * - /snapshot show <snapshot-id> - Show snapshot details
 * - /snapshot restore <snapshot-id> - Restore from snapshot
 * - /snapshot rollback <session-id> - Rollback to last snapshot
 * - /snapshot create - Manually create snapshot
 */

import type { Command, CommandResult } from './types.js';
import { getGlobalContextManager } from '../features/context/ContextManagerContext.js';

/**
 * Helper to check if context manager is available
 */
function ensureContextManager() {
  const manager = getGlobalContextManager();
  if (!manager) {
    throw new Error('Context Manager is not initialized. Please wait for the application to fully load.');
  }
  return manager;
}

/**
 * /snapshot list <session-id> - List snapshots for a session
 */
async function snapshotListHandler(args: string[]): Promise<CommandResult> {
  if (args.length === 0) {
    return {
      success: false,
      message: 'Usage: /snapshot list <session-id>',
    };
  }

  const sessionId = args[0];

  try {
    const manager = ensureContextManager();
    const snapshots = await manager.listSnapshots(sessionId);

    if (snapshots.length === 0) {
      return {
        success: true,
        message: `No snapshots found for session: ${sessionId}`,
      };
    }

    // Format snapshots as table
    const lines = [
      `Snapshots for session: ${sessionId}`,
      '',
      'ID                                   | Timestamp           | Tokens | Summary',
      '------------------------------------ | ------------------- | ------ | -------',
    ];

    for (const snapshot of snapshots) {
      const id = snapshot.id.substring(0, 36);
      const timestamp = new Date(snapshot.timestamp).toLocaleString();
      const tokens = snapshot.tokenCount.toString().padStart(6);
      const summary = snapshot.summary.substring(0, 50);
      
      lines.push(`${id} | ${timestamp} | ${tokens} | ${summary}`);
    }

    return {
      success: true,
      message: lines.join('\n'),
      data: { snapshots },
    };
  } catch (error) {
    return {
      success: false,
      message: `Error listing snapshots: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * /snapshot show <snapshot-id> - Show snapshot details
 */
async function snapshotShowHandler(args: string[]): Promise<CommandResult> {
  if (args.length === 0) {
    return {
      success: false,
      message: 'Usage: /snapshot show <snapshot-id>',
    };
  }

  const snapshotId = args[0];

  try {
    const manager = ensureContextManager();
    const snapshot = await manager.getSnapshot(snapshotId);

    if (!snapshot) {
      return {
        success: false,
        message: `Snapshot not found: ${snapshotId}`,
      };
    }

    const lines = [
      `Snapshot: ${snapshot.id}`,
      '',
      `Session ID: ${snapshot.sessionId}`,
      `Timestamp: ${new Date(snapshot.timestamp).toLocaleString()}`,
      `Token Count: ${snapshot.tokenCount}`,
      `Message Count: ${snapshot.messages.length}`,
      '',
      'Summary:',
      snapshot.summary,
      '',
      'Metadata:',
      `  Model: ${snapshot.metadata.model}`,
      `  Context Size: ${snapshot.metadata.contextSize}`,
      `  Compression Ratio: ${(snapshot.metadata.compressionRatio * 100).toFixed(1)}%`,
    ];

    return {
      success: true,
      message: lines.join('\n'),
      data: { snapshot },
    };
  } catch (error) {
    return {
      success: false,
      message: `Error showing snapshot: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * /snapshot restore <snapshot-id> - Restore from snapshot
 */
async function snapshotRestoreHandler(args: string[]): Promise<CommandResult> {
  if (args.length === 0) {
    return {
      success: false,
      message: 'Usage: /snapshot restore <snapshot-id>',
    };
  }

  const snapshotId = args[0];

  try {
    const manager = ensureContextManager();
    await manager.restoreSnapshot(snapshotId);

    return {
      success: true,
      action: 'restore-snapshot',
      message: `Context restored from snapshot: ${snapshotId}`,
      data: { snapshotId },
    };
  } catch (error) {
    return {
      success: false,
      message: `Error restoring snapshot: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * /snapshot rollback <session-id> - Rollback to last snapshot
 */
async function snapshotRollbackHandler(args: string[]): Promise<CommandResult> {
  if (args.length === 0) {
    return {
      success: false,
      message: 'Usage: /snapshot rollback <session-id>',
    };
  }

  const sessionId = args[0];

  try {
    const manager = ensureContextManager();
    const snapshots = await manager.listSnapshots(sessionId);

    if (snapshots.length === 0) {
      return {
        success: false,
        message: `No snapshots available for session: ${sessionId}`,
      };
    }

    // Get most recent snapshot
    const latest = snapshots[0];
    await manager.restoreSnapshot(latest.id);

    return {
      success: true,
      action: 'restore-snapshot',
      message: `Rolled back to snapshot: ${latest.id}\nTimestamp: ${new Date(latest.timestamp).toLocaleString()}`,
      data: { snapshotId: latest.id },
    };
  } catch (error) {
    return {
      success: false,
      message: `Error rolling back: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * /snapshot create - Manually create snapshot
 */
async function snapshotCreateHandler(_args: string[]): Promise<CommandResult> {
  try {
    const manager = ensureContextManager();
    const snapshot = await manager.createSnapshot();

    return {
      success: true,
      message: `Snapshot created: ${snapshot.id}\nTimestamp: ${new Date(snapshot.timestamp).toLocaleString()}`,
      data: { snapshot },
    };
  } catch (error) {
    return {
      success: false,
      message: `Error creating snapshot: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * /snapshot command - Main snapshot command with subcommands
 */
export const snapshotCommand: Command = {
  name: '/snapshot',
  description: 'Manage context snapshots',
  usage: '/snapshot <list|show|restore|rollback|create> [args]',
  handler: async (args: string[]): Promise<CommandResult> => {
    if (args.length === 0) {
      return {
        success: false,
        message: 'Usage: /snapshot <list|show|restore|rollback|create> [args]\n\n' +
          'Subcommands:\n' +
          '  list <session-id>     - List snapshots for a session\n' +
          '  show <snapshot-id>    - Show snapshot details\n' +
          '  restore <snapshot-id> - Restore from snapshot\n' +
          '  rollback <session-id> - Rollback to last snapshot\n' +
          '  create                - Manually create snapshot',
      };
    }

    const subcommand = args[0];
    const subcommandArgs = args.slice(1);

    switch (subcommand) {
      case 'list':
        return snapshotListHandler(subcommandArgs);
      case 'show':
        return snapshotShowHandler(subcommandArgs);
      case 'restore':
        return snapshotRestoreHandler(subcommandArgs);
      case 'rollback':
        return snapshotRollbackHandler(subcommandArgs);
      case 'create':
        return snapshotCreateHandler(subcommandArgs);
      default:
        return {
          success: false,
          message: `Unknown subcommand: ${subcommand}\n\n` +
            'Available subcommands: list, show, restore, rollback, create',
        };
    }
  },
};

/**
 * All snapshot-related commands
 */
export const snapshotCommands: Command[] = [
  snapshotCommand,
];
