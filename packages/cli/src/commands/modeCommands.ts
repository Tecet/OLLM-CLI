/**
 * Mode Management Commands
 * 
 * Implements commands for managing prompt modes:
 * - /mode assistant - Switch to assistant mode
 * - /mode planning - Switch to planning mode
 * - /mode developer - Switch to developer mode
 * - /mode debugger - Switch to debugger mode
 * - /mode security - Switch to security mode
 * - /mode reviewer - Switch to reviewer mode
 * - /mode performance - Switch to performance mode
 * - /mode auto - Enable automatic mode switching
 * - /mode status - Show current mode and auto-switch status
 * - /mode history - Show recent mode transitions
 */

import type { Command, CommandResult } from './types.js';
import { getGlobalContextManager } from '../features/context/ContextManagerContext.js';
import type { ModeType, ModeTransition } from '@ollm/core';

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
 * Helper to get mode manager
 */
function ensureModeManager() {
  const manager = ensureContextManager();
  const modeManager = manager.getModeManager();
  if (!modeManager) {
    throw new Error('Mode Manager is not initialized. Please wait for the application to fully load.');
  }
  return modeManager;
}

/**
 * Mode icons for display
 */
const MODE_ICONS: Record<ModeType, string> = {
  assistant: '💬',
  planning: '📋',
  developer: '👨‍💻',
  tool: '🔧',
  debugger: '🐛',
  security: '🔒',
  reviewer: '👀',
  performance: '⚡',
};

/**
 * Mode descriptions
 */
const MODE_DESCRIPTIONS: Record<ModeType, string> = {
  assistant: 'General conversation and explanations',
  planning: 'Research, design, and planning (read-only)',
  developer: 'Full implementation with all tools',
  tool: 'Enhanced tool usage with detailed guidance',
  debugger: 'Systematic debugging and error analysis',
  security: 'Security audits and vulnerability detection',
  reviewer: 'Code review and quality assessment',
  performance: 'Performance analysis and optimization',
};

/**
 * Format a mode transition for display
 */
function formatTransition(transition: ModeTransition): string {
  const fromIcon = MODE_ICONS[transition.from] || '';
  const toIcon = MODE_ICONS[transition.to] || '';
  const timestamp = transition.timestamp.toLocaleTimeString();
  const trigger = transition.trigger === 'auto' ? '🤖' : '👤';
  const confidence = transition.confidence > 0 
    ? ` (${Math.round(transition.confidence * 100)}%)`
    : '';
  
  return `${timestamp} ${trigger} ${fromIcon} ${transition.from} → ${toIcon} ${transition.to}${confidence}`;
}

/**
 * /mode command - Main mode command with subcommands
 */
export const modeCommand: Command = {
  name: '/mode',
  aliases: ['/m'],
  description: 'Manage prompt modes (usage: /mode [assistant|planning|developer|debugger|security|reviewer|performance|auto|status|history])',
  usage: '/mode [subcommand]',
  handler: async (args: string[]): Promise<CommandResult> => {
    try {
      const manager = ensureContextManager();
      const modeManager = ensureModeManager();
      
      // Default: Show status
      if (args.length === 0) {
        const currentMode = modeManager.getCurrentMode();
        const autoSwitch = modeManager.isAutoSwitchEnabled();
        const icon = MODE_ICONS[currentMode] || '';
        const description = MODE_DESCRIPTIONS[currentMode] || '';
        
        return {
          success: true,
          message: 
            `Current Mode: ${icon} ${currentMode}\n` +
            `Description: ${description}\n` +
            `Auto-Switch: ${autoSwitch ? 'Enabled ✓' : 'Disabled ✗'}\n\n` +
            `Use /mode <name> to switch modes or /mode auto to enable auto-switching.`,
        };
      }

      const subcommand = args[0].toLowerCase();

      // Handle mode switching commands
      const validModes: ModeType[] = [
        'assistant', 'planning', 'developer', 'tool',
        'debugger', 'security', 'reviewer', 'performance'
      ];
      
      if (validModes.includes(subcommand as ModeType)) {
        const mode = subcommand as ModeType;
        manager.switchMode(mode);
        
        const icon = MODE_ICONS[mode] || '';
        const description = MODE_DESCRIPTIONS[mode] || '';
        
        return {
          success: true,
          message: 
            `Switched to ${icon} ${mode} mode\n` +
            `${description}\n\n` +
            `Auto-switching has been disabled. Use /mode auto to re-enable.`,
        };
      }

      // Handle special commands
      switch (subcommand) {
        case 'auto': {
          manager.setAutoSwitch(true);
          const currentMode = modeManager.getCurrentMode();
          const icon = MODE_ICONS[currentMode] || '';
          
          return {
            success: true,
            message: 
              `Automatic mode switching enabled ✓\n` +
              `Current mode: ${icon} ${currentMode}\n\n` +
              `The system will now automatically switch modes based on conversation context.`,
          };
        }

        case 'status': {
          const currentMode = modeManager.getCurrentMode();
          const previousMode = modeManager.getPreviousMode();
          const autoSwitch = modeManager.isAutoSwitchEnabled();
          const icon = MODE_ICONS[currentMode] || '';
          const description = MODE_DESCRIPTIONS[currentMode] || '';
          
          let statusMsg = 
            `Mode Status\n` +
            `───────────\n` +
            `Current: ${icon} ${currentMode}\n` +
            `Description: ${description}\n` +
            `Auto-Switch: ${autoSwitch ? 'Enabled ✓' : 'Disabled ✗'}`;
          
          if (previousMode) {
            const prevIcon = MODE_ICONS[previousMode] || '';
            statusMsg += `\nPrevious: ${prevIcon} ${previousMode}`;
          }
          
          // Show allowed tools for current mode
          const allowedTools = modeManager.getAllowedTools(currentMode);
          if (allowedTools.length > 0) {
            if (allowedTools.includes('*')) {
              statusMsg += `\n\nTools: All tools available`;
            } else {
              statusMsg += `\n\nAllowed Tools: ${allowedTools.slice(0, 5).join(', ')}`;
              if (allowedTools.length > 5) {
                statusMsg += ` (+${allowedTools.length - 5} more)`;
              }
            }
          } else {
            statusMsg += `\n\nTools: No tools available`;
          }
          
          return { success: true, message: statusMsg };
        }

        case 'history': {
          const history = modeManager.getRecentHistory(10);
          
          if (history.length === 0) {
            return {
              success: true,
              message: 'No mode transitions yet.',
            };
          }
          
          const historyLines = history.map(formatTransition);
          const historyMsg = 
            `Recent Mode Transitions\n` +
            `───────────────────────\n` +
            historyLines.join('\n') +
            `\n\n🤖 = Auto-switch, 👤 = Manual`;
          
          return { success: true, message: historyMsg };
        }

        default:
          return {
            success: false,
            message: 
              `Unknown mode: ${subcommand}\n\n` +
              `Available modes:\n` +
              `  assistant   - ${MODE_DESCRIPTIONS.assistant}\n` +
              `  planning    - ${MODE_DESCRIPTIONS.planning}\n` +
              `  developer   - ${MODE_DESCRIPTIONS.developer}\n` +
              `  tool        - ${MODE_DESCRIPTIONS.tool}\n` +
              `  debugger    - ${MODE_DESCRIPTIONS.debugger}\n` +
              `  security    - ${MODE_DESCRIPTIONS.security}\n` +
              `  reviewer    - ${MODE_DESCRIPTIONS.reviewer}\n` +
              `  performance - ${MODE_DESCRIPTIONS.performance}\n\n` +
              `Special commands:\n` +
              `  auto    - Enable automatic mode switching\n` +
              `  status  - Show current mode and settings\n` +
              `  history - Show recent mode transitions`,
          };
      }
    } catch (error) {
      return {
        success: false,
        message: `Error: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  },
};

export const modeCommands: Command[] = [
  modeCommand,
];
