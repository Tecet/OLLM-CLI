/**
 * Styles Registry
 * 
 * This file serves as the registry for visual styles and themes.
 * It connects the raw JSON theme data to the application's type system.
 * 
 * Responsibilities:
 * - Load built-in themes from themes.json
 * - Export named theme constants
 * - Provide type-safe access to visual definitions
 */

import { themesData } from './themes.js';
import type { Theme, UISettings } from './types.js';
import { defaultTypography, defaultKeybinds } from './defaults.js';

/**
 * Built-in Themes Registry
 */
export const builtInThemes: Record<string, Theme> = themesData;

// Common Themes
export const defaultDarkTheme = builtInThemes['default-dark'];
export const draculaTheme = builtInThemes['dracula'];
export const nordTheme = builtInThemes['nord'];
export const monokaiTheme = builtInThemes['monokai'];
export const solarizedDarkTheme = builtInThemes['solarized-dark'];

/**
 * Default UI Settings Wrapper
 * Retained for backward compatibility during refactor, aggregates values from defaults.ts
 */
export const defaultUISettings: UISettings = {
  theme: defaultDarkTheme,
  typography: defaultTypography,
  keybinds: defaultKeybinds,
};

// Re-export types for convenience if needed, though direct import from types.ts is preferred
export type { Theme };
