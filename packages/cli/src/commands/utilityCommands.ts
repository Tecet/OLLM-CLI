/**
 * Utility Commands
 * 
 * Implements utility commands:
 * - /help - Show help information
 * - /exit - Exit the CLI
 * - /home - Return to launch screen (already implemented in homeCommand.ts)
 */

import type { Command, CommandResult } from './types.js';

/**
 * /help - Show help information
 * 
 * Requirements: 19.12
 */
export const helpCommand: Command = {
  name: '/help',
  aliases: ['/?'],
  description: 'Show help information',
  usage: '/help [command]',
  handler: async (args: string[]): Promise<CommandResult> => {
    if (args.length > 0) {
      // Show help for specific command
      const commandName = args[0];
      return {
        success: true,
        message: `Help for ${commandName}:\n\nNo detailed help available yet.`,
      };
    }

    // Show general help
    return {
      success: true,
      message: 'OLLM CLI - Available Commands:\n\n' +
        'Session Management:\n' +
        '  /new              - Create new session\n' +
        '  /clear            - Clear chat history\n' +
        '  /compact          - Compress context\n' +
        '  /session          - Manage sessions (save, list, resume)\n' +
        '  /context          - Show context information\n\n' +
        'Model & Provider:\n' +
        '  /model            - Manage models (list, use, pull, rm, info)\n' +
        '  /provider         - Manage providers (list, use)\n\n' +
        'Development:\n' +
        '  /git              - Git operations (status, commit, undo)\n' +
        '  /review           - Manage diff reviews (enable, disable, pending)\n\n' +
        'Customization:\n' +
        '  /theme            - Manage themes (list, use, preview)\n' +
        '  /extensions       - Manage extensions (list, enable, disable)\n\n' +
        'Display:\n' +
        '  /metrics          - Manage metrics (show, toggle, reset)\n' +
        '  /reasoning        - Manage reasoning display (toggle, expand, collapse)\n\n' +
        'Utility:\n' +
        '  /help             - Show this help\n' +
        '  /home             - Return to launch screen\n' +
        '  /exit             - Exit the CLI\n\n' +
        'Use /help <command> for detailed information about a specific command.',
    };
  },
};

/**
 * /exit - Exit the CLI
 * 
 * Requirements: 19.12
 */
export const exitCommand: Command = {
  name: '/exit',
  aliases: ['/quit', '/q'],
  description: 'Exit the CLI',
  usage: '/exit',
  handler: async (): Promise<CommandResult> => {
    return {
      success: true,
      action: 'exit',
      message: 'Exiting...',
    };
  },
};

/**
 * All utility commands
 * 
 * Note: /home is already implemented in homeCommand.ts
 */
export const utilityCommands: Command[] = [
  helpCommand,
  exitCommand,
];
