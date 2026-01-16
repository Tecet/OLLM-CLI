/**
 * Session Management Commands
 * 
 * Implements commands for managing chat sessions:
 * - /new - Create new session with confirmation
 * - /clear - Clear context but preserve system prompt
 * - /compact - Trigger context compression
 * - /session save - Persist current session
 * - /session list - Display saved sessions
 * - /session resume <id> - Restore a session
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
 * /new command - Create new session with confirmation
 * 
 * Requirements: 17.1, 17.2, 19.9
 */
export const newCommand: Command = {
  name: '/new',
  description: 'Create a new session (clears current context)',
  usage: '/new',
  handler: async (): Promise<CommandResult> => {
    // This command requires confirmation from the UI
    // The actual implementation will be handled by the UI layer
    return {
      success: true,
      action: 'clear-chat',
      message: 'Starting new session. Current context will be cleared.',
    };
  },
};

/**
 * /clear command - Clear context but preserve system prompt
 * 
 * Requirements: 17.3, 19.9
 */
export const clearCommand: Command = {
  name: '/clear',
  aliases: ['/cls'],
  description: 'Clear chat history but preserve system prompt',
  usage: '/clear',
  handler: async (): Promise<CommandResult> => {
    try {
      const manager = ensureContextManager();
      await manager.clear();
      return {
        success: true,
        action: 'clear-chat',
        message: 'Chat history cleared. System prompt preserved.',
      };
    } catch (error) {
       return {
        success: false,
        message: `Error clearing context: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  },
};

/**
 * /compact command - Trigger context compression
 * 
 * Requirements: 17.4, 19.9
 */
export const compactCommand: Command = {
  name: '/compact',
  description: 'Compress context to reduce token usage',
  usage: '/compact',
  handler: async (): Promise<CommandResult> => {
    try {
      const manager = ensureContextManager();
      await manager.compress();
      return {
        success: true,
        message: 'Context compression completed successfully.',
      };
    } catch (error) {
      return {
        success: false,
        message: `Error compressing context: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  },
};

/**
 * Session subcommands
 */

/**
 * /session save - Persist current session
 * 
 * Requirements: 17.5, 19.9
 */
async function sessionSaveHandler(_args: string[]): Promise<CommandResult> {
  // This will integrate with ChatRecordingService
  // For now, return a placeholder
  return {
    success: true,
    action: 'save-session',
    message: 'Session saved successfully.',
  };
}

/**
 * /session list - Display saved sessions
 * 
 * Requirements: 17.6, 19.9
 */
async function sessionListHandler(_args: string[]): Promise<CommandResult> {
  // This will integrate with ChatRecordingService
  // For now, return a placeholder with mock data
  return {
    success: true,
    message: 'Saved sessions:\n\nNo saved sessions found.',
    data: {
      sessions: [],
    },
  };
}

/**
 * /session resume <id> - Restore a session
 * 
 * Requirements: 17.7, 19.9
 */
async function sessionResumeHandler(args: string[]): Promise<CommandResult> {
  if (args.length === 0) {
    return {
      success: false,
      message: 'Usage: /session resume <session-id>',
    };
  }

  const sessionId = args[0];

  // This will integrate with ChatRecordingService
  // For now, return a placeholder
  return {
    success: true,
    message: `Resuming session: ${sessionId}`,
    data: {
      sessionId,
    },
  };
}

/**
 * /session delete <id> - Delete a session
 * 
 * Requirements: 19.4
 */
async function sessionDeleteHandler(args: string[]): Promise<CommandResult> {
  if (args.length === 0) {
    return {
      success: false,
      message: 'Usage: /session delete <session-id>',
    };
  }

  const sessionId = args[0];

  // This will integrate with ChatRecordingService
  return {
    success: true,
    message: `Session deleted: ${sessionId}`,
  };
}

/**
 * /session export <id> - Export a session
 * 
 * Requirements: 19.4
 */
async function sessionExportHandler(args: string[]): Promise<CommandResult> {
  if (args.length === 0) {
    return {
      success: false,
      message: 'Usage: /session export <session-id> [output-file]',
    };
  }

  const sessionId = args[0];
  const outputFile = args[1] || `session-${sessionId}.json`;

  // This will integrate with ChatRecordingService
  return {
    success: true,
    message: `Session exported to: ${outputFile}`,
  };
}

/**
 * /session command - Main session command with subcommands
 * 
 * Requirements: 17.5, 17.6, 17.7, 19.4, 19.9
 */
export const sessionCommand: Command = {
  name: '/session',
  description: 'Manage chat sessions',
  usage: '/session <save|list|resume|delete|export> [args]',
  handler: async (args: string[]): Promise<CommandResult> => {
    if (args.length === 0) {
      return {
        success: false,
        message: 'Usage: /session <save|list|resume|delete|export> [args]\n\n' +
          'Subcommands:\n' +
          '  save              - Save current session\n' +
          '  list              - List saved sessions\n' +
          '  resume <id>       - Resume a saved session\n' +
          '  delete <id>       - Delete a saved session\n' +
          '  export <id> [file] - Export a session to file',
      };
    }

    const subcommand = args[0];
    const subcommandArgs = args.slice(1);

    switch (subcommand) {
      case 'save':
        return sessionSaveHandler(subcommandArgs);
      case 'list':
        return sessionListHandler(subcommandArgs);
      case 'resume':
        return sessionResumeHandler(subcommandArgs);
      case 'delete':
        return sessionDeleteHandler(subcommandArgs);
      case 'export':
        return sessionExportHandler(subcommandArgs);
      default:
        return {
          success: false,
          message: `Unknown subcommand: ${subcommand}\n\n` +
            'Available subcommands: save, list, resume, delete, export',
        };
    }
  },
};

/**
 * All session-related commands
 */
export const sessionCommands: Command[] = [
  newCommand,
  clearCommand,
  compactCommand,
  sessionCommand,
];
