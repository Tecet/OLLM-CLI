/**
 * Configuration Commands
 * 
 * Implements commands for viewing and managing configuration:
 * - /config paths - Show storage paths
 * - /config show - Show current configuration
 */

import type { Command, CommandResult } from './types.js';
import { getDefaultStorageLocations, logAllStorageLocations } from '../../../core/src/utils/pathValidation.js';
import * as os from 'os';

/**
 * /config paths - Show storage paths
 */
async function configPathsHandler(_args: string[]): Promise<CommandResult> {
  try {
    const locations = getDefaultStorageLocations();
    
    const lines = [
      'Storage Locations:',
      '',
      `Home Directory: ${os.homedir()}`,
      `Platform: ${os.platform()}`,
      '',
      'Data Directories:',
      `  Sessions:          ${locations.sessions}`,
      `  Context Snapshots: ${locations.contextSnapshots}`,
      `  Config:            ${locations.config}`,
      `  Cache:             ${locations.cache}`,
      '',
      'Note: These are the default locations. Actual locations may differ if custom paths are configured.',
    ];

    // Also log to console for debugging
    logAllStorageLocations();

    return {
      success: true,
      message: lines.join('\n'),
      data: { locations },
    };
  } catch (error) {
    return {
      success: false,
      message: `Error getting storage paths: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * /config show - Show current configuration
 */
async function configShowHandler(_args: string[]): Promise<CommandResult> {
  // This will be implemented when we have a config service
  return {
    success: true,
    message: 'Configuration display not yet implemented.',
  };
}

/**
 * /config command - Main config command with subcommands
 */
export const configCommand: Command = {
  name: '/config',
  description: 'View and manage configuration',
  usage: '/config <paths|show> [args]',
  handler: async (args: string[]): Promise<CommandResult> => {
    if (args.length === 0) {
      return {
        success: false,
        message: 'Usage: /config <paths|show> [args]\n\n' +
          'Subcommands:\n' +
          '  paths - Show storage paths\n' +
          '  show  - Show current configuration',
      };
    }

    const subcommand = args[0];
    const subcommandArgs = args.slice(1);

    switch (subcommand) {
      case 'paths':
        return configPathsHandler(subcommandArgs);
      case 'show':
        return configShowHandler(subcommandArgs);
      default:
        return {
          success: false,
          message: `Unknown subcommand: ${subcommand}\n\n` +
            'Available subcommands: paths, show',
        };
    }
  },
};

/**
 * All config-related commands
 */
export const configCommands: Command[] = [
  configCommand,
];
