/**
 * Context Management Commands
 * 
 * Implements commands for managing context:
 * - /context - Show current context information
 * - /context size <tokens> - Set target context size
 * - /context auto - Enable auto-sizing
 * - /context snapshot - Create manual snapshot
 * - /context restore <id> - Restore snapshot
 * - /context list - List snapshots
 * - /context stats - Detailed statistics
 */

import { SettingsService } from '../config/settingsService.js';
import { getGlobalContextManager } from '../features/context/ContextManagerContext.js';

import type { Command, CommandResult } from './types.js';

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
 * /context command - Main context command with subcommands
 */
export const contextCommand: Command = {
  name: '/context',
  description: 'Manage context (usage: /context [size|auto|snapshot|restore|list|stats])',
  usage: '/context [subcommand] [args]',
  handler: async (args: string[]): Promise<CommandResult> => {
    try {
      const manager = ensureContextManager();
      
      // Default: Show status
      if (args.length === 0) {
        const messages = await manager.getContext();
        return {
          success: true,
          message: `Context System Active\nMessages: ${messages.length}`,
        };
      }

      const subcommand = args[0].toLowerCase();
      const subArgs = args.slice(1);

      switch (subcommand) {
        case 'size': {
          if (subArgs.length === 0) {
            return { success: false, message: 'Usage: /context size <tokens>' };
          }
          const size = parseInt(subArgs[0], 10);
          if (isNaN(size) || size <= 0) {
            return { success: false, message: 'Invalid size. Must be a positive number.' };
          }
          await manager.resize(size);
          SettingsService.getInstance().setContextSize(size); // Persist
          return { success: true, message: `Context target size set to ${size} tokens` };
        }

        case 'auto': {
          manager.updateConfig({ autoSize: true });
          return { success: true, message: 'Automatic context sizing enabled' };
        }

        case 'snapshot': {
          const snapshot = await manager.createSnapshot();
          return { 
            success: true, 
            message: `Snapshot created: ${snapshot.id.substring(0, 8)} (${snapshot.tokenCount} tokens)` 
          };
        }

        case 'list': {
          await manager.refreshSnapshots(); // Trigger refresh
          // The UI should update to show the list, but we can't easily return the list here
          // unless we exposed a getter. 
          return { success: true, message: 'Refreshing snapshot list...' };
        }

        case 'restore': {
          if (subArgs.length === 0) {
            return { success: false, message: 'Usage: /context restore <snapshot-id>' };
          }
          await manager.restoreSnapshot(subArgs[0]);
          return { success: true, message: `Restoring snapshot ${subArgs[0]}...` };
        }
        
        case 'stats': {
           const usage = manager.getUsage();
           const config = manager.getConfig();
           
           const statsMsg = 
             `Context Statistics:\n` +
             `------------------\n` +
             `Tokens: ${usage.currentTokens} / ${usage.maxTokens} (${Math.round(usage.percentage)}%)\n` +
             `VRAM: ${(usage.vramUsed / 1024 / 1024).toFixed(0)}MB / ${(usage.vramTotal / 1024 / 1024).toFixed(0)}MB\n` +
             `Target Size: ${config.targetSize}\n` +
             `Auto-Size: ${config.autoSize ? 'Enabled' : 'Disabled'}\n` +
             `Strategy: ${config.compression.strategy}`;

           return { success: true, message: statsMsg };
        }

        default:
          return {
            success: false,
            message: `Unknown subcommand: ${subcommand}\nAvailable: size, auto, snapshot, restore, list, stats`
          };
      }
    } catch (error) {
      return {
        success: false,
        message: `Error: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  },
};

export const contextCommands: Command[] = [
  contextCommand,
];
