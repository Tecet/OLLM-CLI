import type { Command, CommandResult } from './types.js';

/**
 * /home command - Returns to the launch screen
 *
 * Requirements: 14.6
 */
export const homeCommand: Command = {
  name: '/home',
  description: 'Return to the launch screen',
  usage: '/home',

  handler: async (): Promise<CommandResult> => {
    return {
      success: true,
      action: 'show-launch-screen',
      message: 'Returning to launch screen...',
    };
  },
};
