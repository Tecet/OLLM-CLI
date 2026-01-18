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
 * - /mode prototype - Switch to prototype mode
 * - /mode teacher - Switch to teacher mode
 * - /mode auto - Enable automatic mode switching
 * - /mode status - Show current mode and auto-switch status
 * - /mode history - Show recent mode transitions
 * - /mode hybrid <mode1> <mode2> [...] - Create and switch to hybrid mode
 * - /mode hybrid list - List available preset hybrid modes
 * - /mode focus <mode> <duration> - Lock to a mode for deep work
 * - /mode focus off - Disable focus mode
 * - /mode focus extend <minutes> - Extend current focus session
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
  prototype: '⚡🔬',
  teacher: '👨‍🏫',
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
  prototype: 'Quick experiments and proof-of-concepts',
  teacher: 'Explain concepts and teach best practices',
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
        'debugger', 'security', 'reviewer', 'performance',
        'prototype', 'teacher'
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
          
          // Add metrics display
          try {
            const metricsTracker = modeManager.getMetricsTracker();
            const sessionSummary = metricsTracker.getSessionSummary();
            const timeMetricsSummary = metricsTracker.getTimeMetricsSummary();
            const modeSpecificMetrics = metricsTracker.getModeSpecificSummary(currentMode);
            
            // Session summary
            statusMsg += `\n\nSession Metrics\n───────────────`;
            statusMsg += `\nDuration: ${sessionSummary.duration}`;
            statusMsg += `\nModes Used: ${sessionSummary.modesUsed}`;
            statusMsg += `\nTransitions: ${sessionSummary.totalTransitions}`;
            
            if (sessionSummary.mostUsedMode) {
              const mostUsedIcon = MODE_ICONS[sessionSummary.mostUsedMode] || '';
              statusMsg += `\nMost Used: ${mostUsedIcon} ${sessionSummary.mostUsedMode}`;
            }
            
            // Time breakdown for current mode
            const currentModeTime = timeMetricsSummary.modeBreakdown.find(m => m.mode === currentMode);
            if (currentModeTime && currentModeTime.duration > 0) {
              const minutes = Math.floor(currentModeTime.duration / (1000 * 60));
              const seconds = Math.floor((currentModeTime.duration % (1000 * 60)) / 1000);
              statusMsg += `\nTime in ${currentMode}: ${minutes}m ${seconds}s (${currentModeTime.percentage.toFixed(1)}%)`;
            }
            
            // Mode-specific metrics (if any)
            const metricsKeys = Object.keys(modeSpecificMetrics);
            if (metricsKeys.length > 0) {
              statusMsg += `\n\n${currentMode.charAt(0).toUpperCase() + currentMode.slice(1)} Mode Metrics\n${'─'.repeat(currentMode.length + 14)}`;
              
              // Display up to 5 most relevant metrics
              const displayMetrics = metricsKeys.slice(0, 5);
              for (const key of displayMetrics) {
                const value = modeSpecificMetrics[key];
                // Format key as human-readable (camelCase to Title Case)
                const formattedKey = key
                  .replace(/([A-Z])/g, ' $1')
                  .replace(/^./, str => str.toUpperCase())
                  .trim();
                statusMsg += `\n${formattedKey}: ${value}`;
              }
              
              if (metricsKeys.length > 5) {
                statusMsg += `\n... and ${metricsKeys.length - 5} more metrics`;
              }
            }
            
            // Productivity summary (if any activity)
            const productivity = metricsTracker.getProductivitySummary();
            const hasActivity = productivity.totalFiles > 0 || 
                               productivity.totalBugsFixed > 0 || 
                               productivity.totalVulnerabilitiesFixed > 0;
            
            if (hasActivity) {
              statusMsg += `\n\nProductivity\n────────────`;
              if (productivity.totalFiles > 0) {
                statusMsg += `\nFiles Changed: ${productivity.totalFiles}`;
              }
              if (productivity.totalLines > 0) {
                statusMsg += `\nLines Changed: ${productivity.totalLines}`;
              }
              if (productivity.totalBugsFixed > 0) {
                statusMsg += `\nBugs Fixed: ${productivity.totalBugsFixed}`;
              }
              if (productivity.totalVulnerabilitiesFixed > 0) {
                statusMsg += `\nVulnerabilities Fixed: ${productivity.totalVulnerabilitiesFixed}`;
              }
              if (productivity.totalOptimizations > 0) {
                statusMsg += `\nOptimizations: ${productivity.totalOptimizations}`;
              }
            }
          } catch (error) {
            // If metrics display fails, just continue without metrics
            // This ensures the command still works even if metrics tracking has issues
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

        case 'hybrid': {
          // Get hybrid mode manager
          const hybridManager = manager.getHybridModeManager();
          if (!hybridManager) {
            return {
              success: false,
              message: 'Hybrid mode manager is not available.',
            };
          }
          
          // Handle subcommands
          if (args.length === 1) {
            // No subcommand - show help
            return {
              success: true,
              message: 
                `Hybrid Mode Commands\n` +
                `───────────────────\n` +
                `/mode hybrid list - List available preset hybrid modes\n` +
                `/mode hybrid <mode1> <mode2> [...] - Create and switch to hybrid mode\n` +
                `/mode hybrid <preset-id> - Switch to preset hybrid mode\n\n` +
                `Examples:\n` +
                `  /mode hybrid developer security - Secure development\n` +
                `  /mode hybrid secure-developer - Use preset secure developer mode\n` +
                `  /mode hybrid developer performance reviewer - Multi-mode hybrid`,
            };
          }
          
          const hybridSubcommand = args[1].toLowerCase();
          
          // List preset hybrid modes
          if (hybridSubcommand === 'list') {
            const presets = hybridManager.getPresetHybridModes();
            
            if (presets.length === 0) {
              return {
                success: true,
                message: 'No preset hybrid modes available.',
              };
            }
            
            let listMsg = `Preset Hybrid Modes\n${'─'.repeat(20)}\n`;
            
            for (const preset of presets) {
              listMsg += `\n${preset.icon} ${preset.name} (${preset.id})\n`;
              listMsg += `  ${preset.description}\n`;
              listMsg += `  Modes: ${preset.modes.join(', ')}\n`;
            }
            
            listMsg += `\nUse /mode hybrid <preset-id> to activate a preset.`;
            
            return { success: true, message: listMsg };
          }
          
          // Check if it's a preset ID
          const presetMode = hybridManager.getHybridModeById(hybridSubcommand);
          if (presetMode) {
            // Switch to preset hybrid mode
            manager.switchToHybridMode(presetMode);
            
            return {
              success: true,
              message: 
                `Switched to ${presetMode.icon} ${presetMode.name}\n` +
                `${presetMode.description}\n` +
                `Modes: ${presetMode.modes.join(', ')}\n\n` +
                `Auto-switching has been disabled.`,
            };
          }
          
          // Parse mode names from arguments
          const modeNames = args.slice(1);
          const modes: ModeType[] = [];
          const invalidModes: string[] = [];
          
          for (const modeName of modeNames) {
            if (validModes.includes(modeName as ModeType)) {
              modes.push(modeName as ModeType);
            } else {
              invalidModes.push(modeName);
            }
          }
          
          if (invalidModes.length > 0) {
            return {
              success: false,
              message: 
                `Invalid mode(s): ${invalidModes.join(', ')}\n\n` +
                `Valid modes: ${validModes.join(', ')}`,
            };
          }
          
          if (modes.length === 0) {
            return {
              success: false,
              message: 'Please specify at least one mode.',
            };
          }
          
          if (modes.length === 1) {
            return {
              success: false,
              message: 
                `Hybrid mode requires at least 2 modes.\n` +
                `Use /mode ${modes[0]} to switch to a single mode.`,
            };
          }
          
          // Create and switch to hybrid mode
          const hybridMode = hybridManager.createHybridMode(modes);
          manager.switchToHybridMode(hybridMode);
          
          return {
            success: true,
            message: 
              `Created and switched to ${hybridMode.icon} ${hybridMode.name}\n` +
              `${hybridMode.description}\n` +
              `Persona: ${hybridMode.persona}\n\n` +
              `Auto-switching has been disabled.`,
          };
        }

        case 'focus': {
          // Get focus mode manager
          const focusManager = modeManager.getFocusModeManager();
          if (!focusManager) {
            return {
              success: false,
              message: 'Focus mode manager is not available.',
            };
          }
          
          // Handle subcommands
          if (args.length === 1) {
            // No subcommand - show help or status
            if (focusManager.isFocusModeActive()) {
              const session = focusManager.getCurrentSession();
              if (session) {
                const icon = MODE_ICONS[session.mode] || '';
                const remaining = focusManager.getRemainingTimeFormatted();
                const stats = focusManager.getSessionStats();
                
                return {
                  success: true,
                  message: 
                    `Focus Mode Active 🎯\n` +
                    `─────────────────\n` +
                    `Mode: ${icon} ${session.mode}\n` +
                    `Remaining: ${remaining}\n` +
                    `Progress: ${stats.percentComplete}% complete\n\n` +
                    `Use /mode focus off to disable focus mode.`,
                };
              }
            }
            
            return {
              success: true,
              message: 
                `Focus Mode Commands\n` +
                `──────────────────\n` +
                `/mode focus <mode> <duration> - Lock to a mode for deep work\n` +
                `/mode focus off - Disable focus mode\n` +
                `/mode focus extend <minutes> - Extend current session\n\n` +
                `Examples:\n` +
                `  /mode focus developer 30 - Lock to developer mode for 30 minutes\n` +
                `  /mode focus planning 60 - Lock to planning mode for 1 hour\n` +
                `  /mode focus extend 15 - Add 15 more minutes\n\n` +
                `Focus mode prevents both auto-switching and manual mode changes.`,
            };
          }
          
          const focusSubcommand = args[1].toLowerCase();
          
          // Disable focus mode
          if (focusSubcommand === 'off') {
            if (!focusManager.isFocusModeActive()) {
              return {
                success: true,
                message: 'Focus mode is not currently active.',
              };
            }
            
            focusManager.disableFocusMode('manual');
            
            return {
              success: true,
              message: 
                `Focus mode disabled ✓\n\n` +
                `You can now switch modes freely or enable auto-switching with /mode auto.`,
            };
          }
          
          // Extend focus session
          if (focusSubcommand === 'extend') {
            if (!focusManager.isFocusModeActive()) {
              return {
                success: false,
                message: 'No active focus session to extend.',
              };
            }
            
            if (args.length < 3) {
              return {
                success: false,
                message: 'Please specify minutes to extend: /mode focus extend <minutes>',
              };
            }
            
            const additionalMinutes = parseInt(args[2], 10);
            if (isNaN(additionalMinutes) || additionalMinutes < 1 || additionalMinutes > 120) {
              return {
                success: false,
                message: 'Extension must be between 1 and 120 minutes.',
              };
            }
            
            try {
              focusManager.extendFocusSession(additionalMinutes);
              const remaining = focusManager.getRemainingTimeFormatted();
              
              return {
                success: true,
                message: 
                  `Focus session extended by ${additionalMinutes} minutes ✓\n` +
                  `New remaining time: ${remaining}`,
              };
            } catch (error) {
              return {
                success: false,
                message: `Error extending focus session: ${error instanceof Error ? error.message : String(error)}`,
              };
            }
          }
          
          // Enable focus mode for a specific mode
          const targetMode = focusSubcommand as ModeType;
          
          if (!validModes.includes(targetMode)) {
            return {
              success: false,
              message: 
                `Invalid mode: ${focusSubcommand}\n\n` +
                `Valid modes: ${validModes.join(', ')}`,
            };
          }
          
          if (args.length < 3) {
            return {
              success: false,
              message: 'Please specify duration in minutes: /mode focus <mode> <duration>',
            };
          }
          
          const durationMinutes = parseInt(args[2], 10);
          if (isNaN(durationMinutes) || durationMinutes < 1 || durationMinutes > 240) {
            return {
              success: false,
              message: 'Duration must be between 1 and 240 minutes (4 hours).',
            };
          }
          
          try {
            // Switch to the target mode first (using explicit trigger to bypass focus check)
            manager.switchModeExplicit(targetMode);
            
            // Enable focus mode
            const session = focusManager.enableFocusMode(targetMode, durationMinutes);
            const icon = MODE_ICONS[targetMode] || '';
            
            return {
              success: true,
              message: 
                `Focus Mode Activated 🎯\n` +
                `─────────────────────\n` +
                `Mode: ${icon} ${targetMode}\n` +
                `Duration: ${durationMinutes} minutes\n` +
                `End Time: ${session.endTime.toLocaleTimeString()}\n\n` +
                `Mode switching is now locked. Use /mode focus off to disable.`,
            };
          } catch (error) {
            return {
              success: false,
              message: `Error enabling focus mode: ${error instanceof Error ? error.message : String(error)}`,
            };
          }
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
              `  performance - ${MODE_DESCRIPTIONS.performance}\n` +
              `  prototype   - ${MODE_DESCRIPTIONS.prototype}\n` +
              `  teacher     - ${MODE_DESCRIPTIONS.teacher}\n\n` +
              `Special commands:\n` +
              `  auto    - Enable automatic mode switching\n` +
              `  status  - Show current mode and settings\n` +
              `  history - Show recent mode transitions\n` +
              `  hybrid  - Create and manage hybrid modes\n` +
              `  focus   - Lock to a mode for deep work sessions`,
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
