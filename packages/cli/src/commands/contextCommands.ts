/**
 * Context Management Commands
 * 
 * Implements commands for managing context:
 * - /context - Show current context information
 * - /new - Create new session (already implemented in sessionCommands.ts)
 * - /clear - Clear context (already implemented in sessionCommands.ts)
 * - /compact - Compress context (already implemented in sessionCommands.ts)
 */

import type { Command, CommandResult } from './types.js';

/**
 * /context - Show current context information
 * 
 * Requirements: 19.9
 */
export const contextCommand: Command = {
  name: '/context',
  description: 'Show current context information',
  usage: '/context',
  handler: async (): Promise<CommandResult> => {
    // This will integrate with ContextManager
    return {
      success: true,
      message: 'Current context:\n\n' +
        'Messages: 0\n' +
        'Tokens: 0 / 4096\n' +
        'Files: 0',
      data: {
        messages: 0,
        tokens: 0,
        maxTokens: 4096,
        files: 0,
      },
    };
  },
};

/**
 * All context-related commands
 * 
 * Note: /new, /clear, and /compact are already implemented in sessionCommands.ts
 */
export const contextCommands: Command[] = [
  contextCommand,
];
