/**
 * Built-in Application Themes
 * 
 * This file defines the standard color schemes used throughout the CLI.
 * Each theme defines colors for:
 * - Backgrounds (primary, secondary, tertiary)
 * - Text (primary, secondary, accent)
 * - Roles (user, assistant, system, tool)
 * - Status states (success, warning, error, info)
 * - Borders and Diff highlighting
 */

import type { Theme } from './types.js';

export const themesData: Record<string, Theme> = {
  /**
   * Solarized Dark
   * A precision theme designed to decrease eye strain.
   */
  "solarized-dark": {
    "name": "solarized-dark",
    "bg": {
      "primary": "#002b36",
      "secondary": "#073642",
      "tertiary": "#586e75"
    },
    "text": {
      "primary": "#839496",
      "secondary": "#657b83",
      "accent": "#b58900"
    },
    "role": {
      "user": "#268bd2",
      "assistant": "#2aa198",
      "system": "#586e75",
      "tool": "#b58900"
    },
    "status": {
      "success": "#859900",
      "warning": "#cb4b16",
      "error": "#dc322f",
      "info": "#268bd2"
    },
    "border": {
      "primary": "#073642",
      "secondary": "#268bd2",
      "active": "#268bd2",
      "style": "round"
    },
    "diff": {
      "added": "#859900",
      "removed": "#dc322f"
    }
  },
  
  /**
   * Default Dark Theme
   * A balanced dark theme suitable for most terminals.
   */
  "neon-dark": {
    "name": "neon-dark",
    "bg": {
      "primary": "#1e1e1e",
      "secondary": "#252526",
      "tertiary": "#2d2d30"
    },
    "text": {
      "primary": "#d4d4d4",
      "secondary": "#858585",
      "accent": "#4ec9b0"
    },
    "role": {
      "user": "#569cd6",
      "assistant": "#4ec9b0",
      "system": "#858585",
      "tool": "#dcdcaa"
    },
    "status": {
      "success": "#4ec9b0",
      "warning": "#ce9178",
      "error": "#f48771",
      "info": "#569cd6"
    },
    "border": {
      "primary": "#4ec9b0",
      "secondary": "#4ec9b0",
      "active": "#22d239ff",
      "style": "round"
    },
    "diff": {
      "added": "#4ec9b0",
      "removed": "#f48771"
    }
  },

  /**
   * Dracula
   * A high-contrast theme based on the popular Dracula specification.
   */
  "dracula-dark": {
    "name": "dracula-dark",
    "bg": {
      "primary": "#282a36",
      "secondary": "#44475a",
      "tertiary": "#6272a4"
    },
    "text": {
      "primary": "#f8f8f2",
      "secondary": "#6272a4",
      "accent": "#bd93f9"
    },
    "role": {
      "user": "#8be9fd",
      "assistant": "#bd93f9",
      "system": "#6272a4",
      "tool": "#f1fa8c"
    },
    "status": {
      "success": "#50fa7b",
      "warning": "#ffb86c",
      "error": "#ff5555",
      "info": "#8be9fd"
    },
    "border": {
      "primary": "#44475a",
      "secondary": "#bd93f9",
      "active": "#bd93f9",
      "style": "round"
    },
    "diff": {
      "added": "#50fa7b",
      "removed": "#ff5555"
    }
  },

  /**
   * Nord
   * An arctic, north-bluish color palette.
   */
  "nord-dark": {
    "name": "nord-dark",
    "bg": {
      "primary": "#2e3440",
      "secondary": "#3b4252",
      "tertiary": "#434c5e"
    },
    "text": {
      "primary": "#eceff4",
      "secondary": "#d8dee9",
      "accent": "#88c0d0"
    },
    "role": {
      "user": "#81a1c1",
      "assistant": "#88c0d0",
      "system": "#4c566a",
      "tool": "#ebcb8b"
    },
    "status": {
      "success": "#a3be8c",
      "warning": "#d08770",
      "error": "#bf616a",
      "info": "#5e81ac"
    },
    "border": {
      "primary": "#3b4252",
      "secondary": "#88c0d0",
      "active": "#88c0d0",
      "style": "round"
    },
    "diff": {
      "added": "#a3be8c",
      "removed": "#bf616a"
    }
  },

  /**
   * Monokai
   * A vibrant, high-contrast theme popular in Sublime Text.
   */
  "monokai-dark": {
    "name": "monokai-dark",
    "bg": {
      "primary": "#272822",
      "secondary": "#3e3d32",
      "tertiary": "#49483e"
    },
    "text": {
      "primary": "#f8f8f2",
      "secondary": "#75715e",
      "accent": "#fd971f"
    },
    "role": {
      "user": "#66d9ef",
      "assistant": "#a6e22e",
      "system": "#75715e",
      "tool": "#e6db74"
    },
    "status": {
      "success": "#a6e22e",
      "warning": "#fd971f",
      "error": "#f92672",
      "info": "#66d9ef"
    },
    "border": {
      "primary": "#1e1437ff",
      "secondary": "#3a3ac1ff",
      "active": "#fd971f",
      "style": "round"
    },
    "diff": {
      "added": "#a6e22e",
      "removed": "#f92672"
    }
  },

  /**
   * Solarized Dark 2
   * A precision theme designed to decrease eye strain.
   */
  "solarized-dark-2": {
    "name": "solarized-dark-2",
    "bg": {
      "primary": "#002b36",
      "secondary": "#073642",
      "tertiary": "#586e75"
    },
    "text": {
      "primary": "#839496",
      "secondary": "#657b83",
      "accent": "#b58900"
    },
    "role": {
      "user": "#268bd2",
      "assistant": "#2aa198",
      "system": "#586e75",
      "tool": "#b58900"
    },
    "status": {
      "success": "#859900",
      "warning": "#cb4b16",
      "error": "#dc322f",
      "info": "#268bd2"
    },
    "border": {
      "primary": "#073642",
      "secondary": "#268bd2",
      "active": "#268bd2",
      "style": "round"
    },
    "diff": {
      "added": "#859900",
      "removed": "#dc322f"
    }
  }
};
