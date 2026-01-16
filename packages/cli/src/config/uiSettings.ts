/**
 * UI Settings - Theme, Typography, and Keybinds
 * 
 * This module defines the visual appearance and keyboard shortcuts for the CLI.
 * Users can customize these settings via ~/.ollm/ui.yaml
 */

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

/**
 * Default Dark Theme
 */
export const defaultDarkTheme: Theme = {
  name: 'default-dark',
  bg: {
    primary: '#1e1e1e',
    secondary: '#252526',
    tertiary: '#2d2d30',
  },
  text: {
    primary: '#d4d4d4',
    secondary: '#858585',
    accent: '#4ec9b0',
  },
  role: {
    user: '#569cd6',      // Blue
    assistant: '#4ec9b0',  // Teal
    system: '#858585',     // Gray
    tool: '#dcdcaa',       // Yellow
  },
  status: {
    success: '#4ec9b0',    // Green
    warning: '#ce9178',    // Orange
    error: '#f48771',      // Red
    info: '#569cd6',       // Blue
  },
  border: {
    primary: '#858585',
    secondary: '#555555',
  },
  diff: {
    added: '#4ec9b0',      // Green
    removed: '#f48771',    // Red
  },
};

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
  // Tab navigation
  tabChat: 'ctrl+1',
  tabTools: 'ctrl+2',
  tabFiles: 'ctrl+3',
  tabSearch: 'ctrl+4',
  tabDocs: 'ctrl+5',
  tabSettings: 'ctrl+6',
  
  // Layout
  togglePanel: 'ctrl+p',
  commandPalette: 'ctrl+k',
  toggleDebug: 'ctrl+/',
  
  // Chat
  clearChat: 'ctrl+l',
  saveSession: 'ctrl+s',
  cancel: 'escape',
  send: 'return',
  newline: 'shift+return',
  editPrevious: 'up',
  
  // Review
  approve: 'y',
  reject: 'n',
  
  // Navigation
  scrollDown: 'j',
  scrollUp: 'k',
  select: 'return',
  back: 'backspace',
  cycleFocus: 'tab',
};

/**
 * Dracula Theme
 */
export const draculaTheme: Theme = {
  name: 'dracula',
  bg: {
    primary: '#282a36',
    secondary: '#44475a',
    tertiary: '#6272a4',
  },
  text: {
    primary: '#f8f8f2',
    secondary: '#6272a4',
    accent: '#50fa7b',
  },
  role: {
    user: '#8be9fd',      // Cyan
    assistant: '#50fa7b',  // Green
    system: '#6272a4',     // Comment
    tool: '#f1fa8c',       // Yellow
  },
  status: {
    success: '#50fa7b',    // Green
    warning: '#ffb86c',    // Orange
    error: '#ff5555',      // Red
    info: '#8be9fd',       // Cyan
  },
  border: {
    primary: '#6272a4',
    secondary: '#44475a',
  },
  diff: {
    added: '#50fa7b',      // Green
    removed: '#ff5555',    // Red
  },
};

/**
 * Nord Theme
 */
export const nordTheme: Theme = {
  name: 'nord',
  bg: {
    primary: '#2e3440',
    secondary: '#3b4252',
    tertiary: '#434c5e',
  },
  text: {
    primary: '#eceff4',
    secondary: '#d8dee9',
    accent: '#88c0d0',
  },
  role: {
    user: '#81a1c1',      // Blue
    assistant: '#88c0d0',  // Cyan
    system: '#4c566a',     // Gray
    tool: '#ebcb8b',       // Yellow
  },
  status: {
    success: '#a3be8c',    // Green
    warning: '#d08770',    // Orange
    error: '#bf616a',      // Red
    info: '#5e81ac',       // Blue
  },
  border: {
    primary: '#4c566a',
    secondary: '#3b4252',
  },
  diff: {
    added: '#a3be8c',      // Green
    removed: '#bf616a',    // Red
  },
};

/**
 * Monokai Theme
 */
export const monokaiTheme: Theme = {
  name: 'monokai',
  bg: {
    primary: '#272822',
    secondary: '#3e3d32',
    tertiary: '#49483e',
  },
  text: {
    primary: '#f8f8f2',
    secondary: '#75715e',
    accent: '#a6e22e',
  },
  role: {
    user: '#66d9ef',      // Cyan
    assistant: '#a6e22e',  // Green
    system: '#75715e',     // Comment
    tool: '#e6db74',       // Yellow
  },
  status: {
    success: '#a6e22e',    // Green
    warning: '#fd971f',    // Orange
    error: '#f92672',      // Pink/Red
    info: '#66d9ef',       // Cyan
  },
  border: {
    primary: '#75715e',
    secondary: '#49483e',
  },
  diff: {
    added: '#a6e22e',      // Green
    removed: '#f92672',    // Pink/Red
  },
};

/**
 * Solarized Dark Theme
 */
export const solarizedDarkTheme: Theme = {
  name: 'solarized-dark',
  bg: {
    primary: '#002b36',
    secondary: '#073642',
    tertiary: '#586e75',
  },
  text: {
    primary: '#839496',
    secondary: '#657b83',
    accent: '#2aa198',
  },
  role: {
    user: '#268bd2',      // Blue
    assistant: '#2aa198',  // Cyan
    system: '#586e75',     // Base01
    tool: '#b58900',       // Yellow
  },
  status: {
    success: '#859900',    // Green
    warning: '#cb4b16',    // Orange
    error: '#dc322f',      // Red
    info: '#268bd2',       // Blue
  },
  border: {
    primary: '#586e75',
    secondary: '#073642',
  },
  diff: {
    added: '#859900',      // Green
    removed: '#dc322f',    // Red
  },
};

/**
 * Built-in Themes Registry
 */
export const builtInThemes: Record<string, Theme> = {
  'default-dark': defaultDarkTheme,
  'dracula': draculaTheme,
  'nord': nordTheme,
  'monokai': monokaiTheme,
  'solarized-dark': solarizedDarkTheme,
};

/**
 * Default UI Settings
 */
export const defaultUISettings: UISettings = {
  theme: defaultDarkTheme,
  typography: defaultTypography,
  keybinds: defaultKeybinds,
};
