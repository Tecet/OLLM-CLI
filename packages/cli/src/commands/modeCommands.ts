/**
 * Mode Management Commands
 * 
 * Implements commands for managing prompt modes:
 * - /mode assistant - Switch to assistant mode
 * - /mode planning - Switch to planning mode
 * - /mode developer - Switch to developer mode
 * - /mode debugger - Switch to debugger mode
 * - /mode auto - Enable automatic mode switching
 * - /mode status - Show current mode and auto-switch status
 * - /mode history - Show recent mode transitions
 * - /mode focus <mode> <duration> - Lock to a mode for deep work
 * - /mode focus off - Disable focus mode
 * - /mode focus extend <minutes> - Extend current focus session
 */

import { MODE_METADATA } from '@ollm/core';

import { getGlobalContextManager } from '../features/context/ContextManagerContext.js';

import type { Command, CommandResult } from './types.js';
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
const MODE_ICONS: Record<ModeType, string> = Object.entries(MODE_METADATA).reduce((acc, [key, meta]) => {
  acc[key as ModeType] = meta.icon;
  return acc;
}, {} as Record<ModeType, string>);

/**
 * Mode descriptions
 */
const MODE_DESCRIPTIONS: Record<ModeType, string> = Object.entries(MODE_METADATA).reduce((acc, [key, meta]) => {
  acc[key as ModeType] = meta.description;
  return acc;
}, {} as Record<ModeType, string>);

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
 * Build a system message to notify LLM of mode change
 * This informs the LLM of its new role, available tools, and capabilities
 */
function buildModeChangeNotification(
  mode: ModeType,
  modeManager: ReturnType<typeof ensureModeManager>
): string {
  const metadata = MODE_METADATA[mode];
  const allowedTools = modeManager.getAllowedTools(mode);
  const deniedTools = modeManager.getDeniedTools(mode);
  
  let notification = `[System: Mode changed to ${metadata.icon} ${mode}]\n\n`;
  notification += `${metadata.description}\n\n`;
  
  // Tool availability
  if (allowedTools.includes('*')) {
    notification += `Tools: All tools available\n`;
  } else if (allowedTools.length > 0) {
    notification += `Available tools: ${allowedTools.slice(0, 10).join(', ')}`;
    if (allowedTools.length > 10) {
      notification += ` (+${allowedTools.length - 10} more)`;
    }
    notification += `\n`;
  } else {
    notification += `Tools: No tools available (read-only mode)\n`;
  }
  
  // Restrictions (only show if not all tools denied)
  if (deniedTools.length > 0 && !deniedTools.includes('*')) {
    notification += `Restricted: ${deniedTools.slice(0, 5).join(', ')}`;
    if (deniedTools.length > 5) {
      notification += ` (+${deniedTools.length - 5} more)`;
    }
    notification += `\n`;
  }
  
  // Mode-specific guidance
  const guidance = getModeGuidance(mode);
  if (guidance) {
    notification += `\n${guidance}`;
  }
  
  return notification;
}

/**
 * Get mode-specific guidance for LLM
 */
function getModeGuidance(mode: ModeType): string {
  // Not all ModeType variants necessarily have guidance here; use Partial to avoid exhaustive mapping
  const guidance: Partial<Record<ModeType, string>> = {
    assistant: 'Focus on answering questions and providing explanations.',
    planning: 'Focus on research, design, and planning. You have read-only access to the codebase.',
    developer: 'Focus on implementation, refactoring, and code changes. You have full access to all tools.',
    debugger: 'Focus on finding root causes and implementing fixes. Analyze errors systematically.'
  };

  return guidance[mode] ?? '';
}

/**
 * /mode command - Main mode command with subcommands
 */
export const modeCommand: Command = {
  name: '/mode',
  aliases: ['/m'],
  description: 'Manage prompt modes (usage: /mode [assistant|planning|developer|debugger|auto|status|history])',
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
        'assistant', 'planning', 'developer', 'debugger'
      ];
      
      if (validModes.includes(subcommand as ModeType)) {
        const mode = subcommand as ModeType;
        manager.switchMode(mode);
        
        const metadata = MODE_METADATA[mode];
        const icon = metadata?.icon || '';
        
        // Inject system message to LLM about mode change
        if (globalThis.__ollmAddSystemMessage) {
          const modeManager = manager.getModeManager();
          if (modeManager) {
            const notification = buildModeChangeNotification(mode, modeManager);
            globalThis.__ollmAddSystemMessage(notification);
          }
        }
        
        return {
          success: true,
          message: 
            `Switched to ${icon} ${mode}\n` +
            `Auto-switching disabled. Use /mode auto to re-enable.`,
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
              `Auto-switch: Enabled ✓\n` +
              `Current mode: ${icon} ${currentMode}`,
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
            if (metricsTracker) {
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
                                 productivity.totalBugsFixed > 0;

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
              }
            }
          } catch (_error) {
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
              `  debugger    - ${MODE_DESCRIPTIONS.debugger}\n\n` +
              `Special commands:\n` +
              `  auto    - Enable automatic mode switching\n` +
              `  status  - Show current mode and settings\n` +
              `  history - Show recent mode transitions\n` +
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
