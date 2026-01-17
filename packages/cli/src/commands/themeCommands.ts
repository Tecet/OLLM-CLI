/**
 * Theme Management Commands
 * 
 * Implements commands for managing themes:
 * - /theme list - List available themes
 * - /theme use <name> - Switch to a different theme
 * - /theme preview <name> - Preview a theme temporarily
 */

import type { Command, CommandResult } from './types.js';
import type { Theme } from '../config/types.js';
import { getThemeManager } from '../ui/services/themeManager.js';
import { SettingsService } from '../config/settingsService.js';

/**
 * /theme list - List available themes
 * 
 * Requirements: 19.8
 */
async function themeListHandler(): Promise<CommandResult> {
  // This will integrate with ThemeManager
  const themes = [
    'default-dark',
    'dracula',
    'nord',
    'monokai',
    'solarized-dark',
  ];

  return {
    success: true,
    message: 'Available themes:\n\n' +
      themes.map(t => `  ${t}`).join('\n'),
    data: {
      themes,
    },
  };
}

/**
 * /theme use <name> - Switch to a different theme
 * 
 * Requirements: 19.8
 */
function createThemeUseHandler(setTheme?: (theme: Theme) => void) {
  return async (args: string[]): Promise<CommandResult> => {
    if (args.length === 0) {
      return {
        success: false,
        message: 'Usage: /theme use <theme-name>',
      };
    }

    const themeName = args[0];
    const themeManager = getThemeManager();

    // Check if theme exists
    if (!themeManager.hasTheme(themeName)) {
      const availableThemes = themeManager.listThemes();
      return {
        success: false,
        message: `Theme "${themeName}" not found.\n\nAvailable themes: ${availableThemes.join(', ')}`,
      };
    }

    // Load the theme
    try {
      const theme = themeManager.loadTheme(themeName);
      
      // Apply theme if setTheme callback is provided
      if (setTheme) {
        setTheme(theme);
      }

      // Persist selection
      SettingsService.getInstance().setTheme(themeName);
      
      return {
        success: true,
        message: `Theme switched to: ${themeName}`,
        data: {
          theme: themeName,
          themeObject: theme,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to load theme: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  };
}

/**
 * /theme preview <name> - Preview a theme temporarily
 * 
 * Requirements: 19.8
 */
function createThemePreviewHandler(setTheme?: (theme: Theme) => void) {
  return async (args: string[]): Promise<CommandResult> => {
    if (args.length === 0) {
      return {
        success: false,
        message: 'Usage: /theme preview <theme-name>',
      };
    }

    const themeName = args[0];
    const themeManager = getThemeManager();

    // Check if theme exists
    if (!themeManager.hasTheme(themeName)) {
      const availableThemes = themeManager.listThemes();
      return {
        success: false,
        message: `Theme "${themeName}" not found.\n\nAvailable themes: ${availableThemes.join(', ')}`,
      };
    }

    // Load and preview the theme
    try {
      const theme = themeManager.loadTheme(themeName);
      
      // Apply theme temporarily if setTheme callback is provided
      if (setTheme) {
        setTheme(theme);
      }
      
      return {
        success: true,
        message: `Previewing theme: ${themeName}\n\nUse /theme use to apply permanently.`,
        data: {
          theme: themeName,
          themeObject: theme,
          preview: true,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to preview theme: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  };
}

/**
 * Create theme command with setTheme callback
 * 
 * Requirements: 19.8
 */
export function createThemeCommand(setTheme?: (theme: Theme) => void): Command {
  const themeUseHandler = createThemeUseHandler(setTheme);
  const themePreviewHandler = createThemePreviewHandler(setTheme);
  
  return {
    name: '/theme',
    description: 'Manage themes',
    usage: '/theme <list|use|preview> [args]',
    handler: async (args: string[]): Promise<CommandResult> => {
      if (args.length === 0) {
        return {
          success: false,
          message: 'Usage: /theme <list|use|preview> [args]\n\n' +
            'Subcommands:\n' +
            '  list              - List available themes\n' +
            '  use <name>        - Switch to a different theme\n' +
            '  preview <name>    - Preview a theme temporarily',
        };
      }

      const subcommand = args[0];
      const subcommandArgs = args.slice(1);

      switch (subcommand) {
        case 'list':
          return themeListHandler();
        case 'use':
          return themeUseHandler(subcommandArgs);
        case 'preview':
          return themePreviewHandler(subcommandArgs);
        default:
          return {
            success: false,
            message: `Unknown subcommand: ${subcommand}\n\n` +
              'Available subcommands: list, use, preview',
          };
      }
    },
  };
}

/**
 * Default theme command (without setTheme callback)
 */
export const themeCommand: Command = createThemeCommand();

/**
 * Create all theme-related commands
 */
export function createThemeCommands(setTheme?: (theme: Theme) => void): Command[] {
  return [
    createThemeCommand(setTheme),
  ];
}

/**
 * All theme-related commands (default, without setTheme)
 */
export const themeCommands: Command[] = [
  themeCommand,
];
