/**
 * UI Settings - Theme, Typography, and Keybinds
 * 
 * This module defines the visual appearance and keyboard shortcuts for the CLI.
 * Users can customize these settings via ~/.ollm/ui.yaml
 */

import themesData from './themes.json' with { type: 'json' };

export interface Theme {
  name: string;
  bg: {
    primary: string;
    secondary: string;
    tertiary: string;
  };
  text: {
    primary: string;
    secondary: string;
    accent: string;
  };
  role: {
    user: string;
    assistant: string;
    system: string;
    tool: string;
  };
  status: {
    success: string;
    warning: string;
    error: string;
    info: string;
  };
  border: {
    primary: string;
    secondary: string;
    active: string;
  };
  diff: {
    added: string;
    removed: string;
  };
}

export interface Typography {
  headers: { bold: boolean; underline: boolean };
  code: { dim: boolean; italic: boolean };
  emphasis: { bold: boolean };
  bullets: string;
  checkmark: string;
  cross: string;
  arrow: string;
  spinner: 'dots' | 'line' | 'arc' | 'bounce';
  borders: 'round' | 'single' | 'double' | 'bold' | 'ascii';
}

export interface Keybinds {
  // Tab navigation
  tabChat: string;
  tabTools: string;
  tabFiles: string;
  tabSearch: string;
  tabDocs: string;
  tabSettings: string;
  
  // Layout
  togglePanel: string;
  commandPalette: string;
  toggleDebug: string;
  
  // Chat
  clearChat: string;
  saveSession: string;
  cancel: string;
  send: string;
  newline: string;
  editPrevious: string;
  
  // Review
  approve: string;
  reject: string;
  
  // Navigation
  scrollDown: string;
  scrollUp: string;
  select: string;
  back: string;
  cycleFocus: string;
}

export interface UISettings {
  theme: Theme;
  typography: Typography;
  keybinds: Keybinds;
}

import keybindsData from './keybinds.json' with { type: 'json' };

/**
 * Default Typography Settings
 */
export const defaultTypography: Typography = {
  headers: { bold: true, underline: false },
  code: { dim: false, italic: false },
  emphasis: { bold: true },
  bullets: '•',
  checkmark: '✓',
  cross: '✗',
  arrow: '→',
  spinner: 'dots',
  borders: 'round',
};

/**
 * Default Keybinds
 */
export const defaultKeybinds: Keybinds = {
  ...keybindsData.tabNavigation,
  ...keybindsData.layout,
  ...keybindsData.chat,
  ...keybindsData.review,
  // Map navigation keys explicitly to match interface
  scrollDown: keybindsData.navigation.scrollDown,
  scrollUp: keybindsData.navigation.scrollUp,
  select: keybindsData.navigation.select,
  back: keybindsData.navigation.back,
  cycleFocus: keybindsData.navigation.cycleFocus,
};

/**
 * Built-in Themes Registry
 */
export const builtInThemes: Record<string, Theme> = themesData as unknown as Record<string, Theme>;

export const defaultDarkTheme = builtInThemes['default-dark'];
export const draculaTheme = builtInThemes['dracula'];
export const nordTheme = builtInThemes['nord'];
export const monokaiTheme = builtInThemes['monokai'];
export const solarizedDarkTheme = builtInThemes['solarized-dark'];

/**
 * Default UI Settings
 */
export const defaultUISettings: UISettings = {
  theme: defaultDarkTheme,
  typography: defaultTypography,
  keybinds: defaultKeybinds,
};
