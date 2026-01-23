/**
 * Mode Shortcuts
 * 
 * Provides convenient shortcut commands for mode switching and mode-specific actions.
 * 
 * Mode Switching Shortcuts:
 * - /assist - Switch to assistant mode
 * - /plan - Switch to planning mode
 * - /dev - Switch to developer mode
 * - /proto - Switch to prototype mode
 * - /teach - Switch to teacher mode
 * 
 * Debugger Mode Shortcuts:
 * - /debug trace - Show stack trace analysis
 * - /debug reproduce - Reproduce the error
 * - /debug bisect - Binary search for bug location
 * 
 * Security Mode Shortcuts:
 * - /secure scan - Scan for vulnerabilities
 * - /secure audit - Full security audit
 * - /secure cve - Check for known CVEs
 * 
 * Reviewer Mode Shortcuts:
 * - /review checklist - Show code review checklist
 * - /review diff - Review git diff
 * - /review quality - Assess code quality
 * 
 * Performance Mode Shortcuts:
 * - /perf profile - Profile performance
 * - /perf benchmark - Run benchmarks
 * - /perf analyze - Analyze bottlenecks
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
  '/proto': 'prototype',
  '/teach': 'teacher',
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
  secure: {
    scan: 'Scan the codebase for common vulnerabilities',
    audit: 'Perform a comprehensive security audit',
    cve: 'Check dependencies for known CVEs',
  },
  review: {
    checklist: 'Show code review checklist and assess the code',
    diff: 'Review the current git diff',
    quality: 'Assess overall code quality and maintainability',
  },
  perf: {
    profile: 'Profile the application to find performance bottlenecks',
    benchmark: 'Run performance benchmarks',
    analyze: 'Analyze performance metrics and suggest optimizations',
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

/**
 * /proto - Switch to prototype mode
 */
export const protoCommand: Command = {
  name: '/proto',
  description: 'Switch to prototype mode (quick experiments)',
  usage: '/proto',
  handler: async (): Promise<CommandResult> => {
    try {
      const manager = ensureContextManager();
      manager.switchMode('prototype');
      
      return {
        success: true,
        message: '⚡🔬 Switched to prototype mode\nQuick experiments and proof-of-concepts',
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
 * /teach - Switch to teacher mode
 */
export const teachCommand: Command = {
  name: '/teach',
  description: 'Switch to teacher mode (explain concepts)',
  usage: '/teach',
  handler: async (): Promise<CommandResult> => {
    try {
      const manager = ensureContextManager();
      manager.switchMode('teacher');
      
      return {
        success: true,
        message: '👨‍🏫 Switched to teacher mode\nExplain concepts and teach best practices',
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
// Security Mode Shortcuts
// ============================================================================

/**
 * /secure - Security mode shortcuts
 */
export const secureCommand: Command = {
  name: '/secure',
  description: 'Security mode shortcuts (scan, audit, cve)',
  usage: '/secure [scan|audit|cve]',
  handler: async (args: string[]): Promise<CommandResult> => {
    try {
      const manager = ensureContextManager();
      
      // Switch to security mode
      manager.switchMode('security');
      
      // Handle subcommands
      if (args.length === 0) {
        return {
          success: true,
          message: 
            '🔒 Switched to security mode\n\n' +
            'Available shortcuts:\n' +
            '  /secure scan  - Scan for vulnerabilities\n' +
            '  /secure audit - Full security audit\n' +
            '  /secure cve   - Check for known CVEs',
        };
      }
      
      const subcommand = args[0].toLowerCase();
      const action = MODE_ACTION_SHORTCUTS.secure[subcommand as keyof typeof MODE_ACTION_SHORTCUTS.secure];
      
      if (!action) {
        return {
          success: false,
          message: 
            `Unknown security command: ${subcommand}\n\n` +
            'Available commands:\n' +
            '  scan  - Scan for vulnerabilities\n' +
            '  audit - Full security audit\n' +
            '  cve   - Check for known CVEs',
        };
      }
      
      return {
        success: true,
        message: `🔒 Security mode: ${subcommand}\n${action}`,
        data: { mode: 'security', action: subcommand, instruction: action },
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
// Reviewer Mode Shortcuts
// ============================================================================

/**
 * /review - Reviewer mode shortcuts
 */
export const reviewCommand: Command = {
  name: '/review',
  description: 'Reviewer mode shortcuts (checklist, diff, quality)',
  usage: '/review [checklist|diff|quality]',
  handler: async (args: string[]): Promise<CommandResult> => {
    try {
      const manager = ensureContextManager();
      
      // Switch to reviewer mode
      manager.switchMode('reviewer');
      
      // Handle subcommands
      if (args.length === 0) {
        return {
          success: true,
          message: 
            '👀 Switched to reviewer mode\n\n' +
            'Available shortcuts:\n' +
            '  /review checklist - Show code review checklist\n' +
            '  /review diff      - Review git diff\n' +
            '  /review quality   - Assess code quality',
        };
      }
      
      const subcommand = args[0].toLowerCase();
      const action = MODE_ACTION_SHORTCUTS.review[subcommand as keyof typeof MODE_ACTION_SHORTCUTS.review];
      
      if (!action) {
        return {
          success: false,
          message: 
            `Unknown review command: ${subcommand}\n\n` +
            'Available commands:\n' +
            '  checklist - Show code review checklist\n' +
            '  diff      - Review git diff\n' +
            '  quality   - Assess code quality',
        };
      }
      
      return {
        success: true,
        message: `👀 Reviewer mode: ${subcommand}\n${action}`,
        data: { mode: 'reviewer', action: subcommand, instruction: action },
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
// Performance Mode Shortcuts
// ============================================================================

/**
 * /perf - Performance mode shortcuts
 */
export const perfCommand: Command = {
  name: '/perf',
  description: 'Performance mode shortcuts (profile, benchmark, analyze)',
  usage: '/perf [profile|benchmark|analyze]',
  handler: async (args: string[]): Promise<CommandResult> => {
    try {
      const manager = ensureContextManager();
      
      // Switch to performance mode
      manager.switchMode('performance');
      
      // Handle subcommands
      if (args.length === 0) {
        return {
          success: true,
          message: 
            '⚡ Switched to performance mode\n\n' +
            'Available shortcuts:\n' +
            '  /perf profile   - Profile performance\n' +
            '  /perf benchmark - Run benchmarks\n' +
            '  /perf analyze   - Analyze bottlenecks',
        };
      }
      
      const subcommand = args[0].toLowerCase();
      const action = MODE_ACTION_SHORTCUTS.perf[subcommand as keyof typeof MODE_ACTION_SHORTCUTS.perf];
      
      if (!action) {
        return {
          success: false,
          message: 
            `Unknown performance command: ${subcommand}\n\n` +
            'Available commands:\n' +
            '  profile   - Profile performance\n' +
            '  benchmark - Run benchmarks\n' +
            '  analyze   - Analyze bottlenecks',
        };
      }
      
      return {
        success: true,
        message: `⚡ Performance mode: ${subcommand}\n${action}`,
        data: { mode: 'performance', action: subcommand, instruction: action },
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
  protoCommand,
  teachCommand,
  
  // Mode-specific action shortcuts
  debugCommand,
  secureCommand,
  reviewCommand,
  perfCommand,
];
