/**
 * Mode Shortcuts
 * 
 * Provides convenient shortcut commands for mode switching and debugger actions.
 * 
 * Mode Switching Shortcuts:
 * - /assist - Switch to assistant mode
 * - /plan - Switch to planning mode
 * - /dev - Switch to developer mode
 * 
 * Debugger Mode Shortcuts:
 * - /debug trace - Show stack trace analysis
 * - /debug reproduce - Reproduce the error
 * - /debug bisect - Binary search for bug location
 */

import { getGlobalContextManager } from '../features/context/ContextManagerContext.js';

import type { Command, CommandResult } from './types.js';
import type { ModeType } from '@ollm/core';

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
 * Shortcut command mappings
 */
export const MODE_SHORTCUTS: Record<string, ModeType> = {
  '/assist': 'assistant',
  '/plan': 'planning',
  '/dev': 'developer',
};

/**
 * Mode-specific action shortcuts
 */
export const MODE_ACTION_SHORTCUTS = {
  debug: {
    trace: 'Analyze the stack trace and identify the error location',
    reproduce: 'Reproduce the error with minimal test case',
    bisect: 'Use binary search to find where the bug was introduced',
  },
};

// ============================================================================
// Mode Switching Shortcuts
// ============================================================================

/**
 * /assist - Switch to assistant mode
 */
export const assistCommand: Command = {
  name: '/assist',
  aliases: ['/a'],
  description: 'Switch to assistant mode (general conversation)',
  usage: '/assist',
  handler: async (): Promise<CommandResult> => {
    try {
      const manager = ensureContextManager();
      manager.switchMode('assistant');
      
      return {
        success: true,
        message: '💬 Switched to assistant mode\nGeneral conversation and explanations',
      };
    } catch (error) {
      return {
        success: false,
        message: `Error: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  },
};

/**
 * /plan - Switch to planning mode
 */
export const planCommand: Command = {
  name: '/plan',
  aliases: ['/p'],
  description: 'Switch to planning mode (research and design)',
  usage: '/plan',
  handler: async (): Promise<CommandResult> => {
    try {
      const manager = ensureContextManager();
      manager.switchMode('planning');
      
      return {
        success: true,
        message: '📋 Switched to planning mode\nResearch, design, and planning (read-only)',
      };
    } catch (error) {
      return {
        success: false,
        message: `Error: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  },
};

/**
 * /dev - Switch to developer mode
 */
export const devCommand: Command = {
  name: '/dev',
  aliases: ['/d'],
  description: 'Switch to developer mode (full implementation)',
  usage: '/dev',
  handler: async (): Promise<CommandResult> => {
    try {
      const manager = ensureContextManager();
      manager.switchMode('developer');
      
      return {
        success: true,
        message: '👨‍💻 Switched to developer mode\nFull implementation with all tools',
      };
    } catch (error) {
      return {
        success: false,
        message: `Error: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  },
};

// ============================================================================
// Debugger Mode Shortcuts
// ============================================================================

/**
 * /debug - Debugger mode shortcuts
 */
export const debugCommand: Command = {
  name: '/debug',
  description: 'Debugger mode shortcuts (trace, reproduce, bisect)',
  usage: '/debug [trace|reproduce|bisect]',
  handler: async (args: string[]): Promise<CommandResult> => {
    try {
      const manager = ensureContextManager();
      
      // Switch to debugger mode
      manager.switchMode('debugger');
      
      // Handle subcommands
      if (args.length === 0) {
        return {
          success: true,
          message: 
            '🐛 Switched to debugger mode\n\n' +
            'Available shortcuts:\n' +
            '  /debug trace     - Analyze stack trace\n' +
            '  /debug reproduce - Reproduce the error\n' +
            '  /debug bisect    - Binary search for bug location',
        };
      }
      
      const subcommand = args[0].toLowerCase();
      const action = MODE_ACTION_SHORTCUTS.debug[subcommand as keyof typeof MODE_ACTION_SHORTCUTS.debug];
      
      if (!action) {
        return {
          success: false,
          message: 
            `Unknown debug command: ${subcommand}\n\n` +
            'Available commands:\n' +
            '  trace     - Analyze stack trace\n' +
            '  reproduce - Reproduce the error\n' +
            '  bisect    - Binary search for bug location',
        };
      }
      
      return {
        success: true,
        message: `🐛 Debugger mode: ${subcommand}\n${action}`,
        data: { mode: 'debugger', action: subcommand, instruction: action },
      };
    } catch (error) {
      return {
        success: false,
        message: `Error: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  },
};

// ============================================================================
// Export all shortcuts
// ============================================================================

export const modeShortcuts: Command[] = [
  // Mode switching shortcuts
  assistCommand,
  planCommand,
  devCommand,
  
  // Mode-specific action shortcuts
  debugCommand,
];
