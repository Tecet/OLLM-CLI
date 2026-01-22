/**
 * Hook debugging commands
 */

import { getHookDebugger } from '@ollm/ollm-cli-core/hooks';
import type { Command } from './types.js';

/**
 * Hook debug command - enable/disable hook debugging
 */
export const hookDebugCommand: Command = {
  name: 'hooks debug',
  description: 'Enable or disable hook execution debugging',
  usage: '/hooks debug <on|off|status|clear|export|summary>',
  aliases: ['hook-debug', 'hdebug'],
  execute: async (args: string[]) => {
    const hookDebugger = getHookDebugger();
    const subcommand = args[0]?.toLowerCase();

    switch (subcommand) {
      case 'on':
      case 'enable':
        hookDebugger.enable();
        return {
          success: true,
          message: '🔍 Hook debugging enabled. All hook executions will be traced.',
        };

      case 'off':
      case 'disable':
        hookDebugger.disable();
        return {
          success: true,
          message: '🔍 Hook debugging disabled.',
        };

      case 'status':
        {
          const isEnabled = hookDebugger.isEnabled();
          const traces = hookDebugger.getTraces();
          return {
            success: true,
            message: `Hook debugging is ${isEnabled ? 'enabled' : 'disabled'}. ${traces.length} traces collected.`,
          };
        }

      case 'clear':
        hookDebugger.clearTraces();
        return {
          success: true,
          message: '🗑️  All hook traces cleared.',
        };

      case 'export': {
        const format = args[1]?.toLowerCase() || 'json';
        let output: string;

        if (format === 'text' || format === 'txt') {
          output = hookDebugger.exportToText();
        } else {
          output = hookDebugger.exportToJSON();
        }

        // In a real implementation, this would save to a file
        // For now, we'll just return the output
        return {
          success: true,
          message: `Exported ${hookDebugger.getTraces().length} traces to ${format} format`,
          data: output,
        };
      }

      case 'summary': {
        const summary = hookDebugger.getSummary();
        const lines = [
          '📊 Hook Execution Summary',
          '',
          `Total executions: ${summary.total}`,
          `Successful: ${summary.successful}`,
          `Failed: ${summary.failed}`,
          `Average duration: ${summary.averageDuration.toFixed(2)}ms`,
          '',
          'By Hook:',
          ...Object.entries(summary.byHook).map(([hook, count]) => `  ${hook}: ${count}`),
          '',
          'By Event:',
          ...Object.entries(summary.byEvent).map(([event, count]) => `  ${event}: ${count}`),
        ];

        return {
          success: true,
          message: lines.join('\n'),
        };
      }

      case 'failed': {
        const failed = hookDebugger.getFailedTraces();
        if (failed.length === 0) {
          return {
            success: true,
            message: '✓ No failed hook executions.',
          };
        }

        const lines = [
          `❌ ${failed.length} Failed Hook Executions:`,
          '',
          ...failed.map((trace: any) => 
            `  ${trace.hookName} (${trace.event}) - ${trace.error || 'Unknown error'}`
          ),
        ];

        return {
          success: true,
          message: lines.join('\n'),
        };
      }

      case 'format': {
        const format = args[1]?.toLowerCase();
        if (!format || !['json', 'pretty', 'compact'].includes(format)) {
          return {
            success: false,
            message: 'Invalid format. Use: json, pretty, or compact',
          };
        }

        hookDebugger.setFormat(format as 'json' | 'pretty' | 'compact');
        return {
          success: true,
          message: `🔍 Debug output format set to: ${format}`,
        };
      }

      default:
        return {
          success: false,
          message: `Unknown subcommand: ${subcommand}. Use: on, off, status, clear, export, summary, failed, or format`,
        };
    }
  },
};

/**
 * All hook commands
 */
export const hookCommands: Command[] = [
  hookDebugCommand,
];
