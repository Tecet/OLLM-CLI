/**
 * Default Keybinding Configuration
 * 
 * This file defines the default keyboard shortcuts for the application.
 * Bindings are grouped by functional area:
 * - Tab Navigation: Switching between main views
 * - Layout: Toggling panels and debug modes
 * - Chat: Interactive chat controls
 * - Review: Code diff review actions
 * - Navigation: Global movement keys
 * - Global: Focus management
 */

export const keybindsData = {
  /**
   * Shortcuts for switching main tabs.
   * Typically Ctrl + Number.
   */
  "tabNavigation": {
    "tabChat": "ctrl+1",
    "tabTools": "ctrl+2",
    "tabHooks": "ctrl+3",
    "tabFiles": "ctrl+4",
    "tabSearch": "ctrl+5",
    "tabDocs": "ctrl+6",
    "tabGithub": "ctrl+7",
    "tabMcp": "ctrl+8",
    "tabSettings": "ctrl+9"
  },

  /**
   * Global layout controls.
   */
  "layout": {
    "togglePanel": "ctrl+p",
    "commandPalette": "ctrl+k",
    "toggleDebug": "ctrl+/",
    "switchWindowLeft": "ctrl+left",
    "switchWindowRight": "ctrl+right"
  },

  /**
   * Chat interaction shortcuts.
   */
  "chat": {
    "clearChat": "ctrl+l",
    "saveSession": "ctrl+s",
    "cancel": "escape",
    "send": "return",
    "newline": "shift+return",
    "editPrevious": "up"
  },

  /**
   * Review mode shortcuts (diff viewer).
   */
  "review": {
    "approve": "y",
    "reject": "n"
  },

  /**
   * Standard navigation keys (Vim-style fallback included).
   */
  "navigation": {
    "scrollDown": "j",
    "scrollUp": "k",
    "select": "return",
    "back": "backspace",
    "cycleFocus": "tab",
    "left": "left",
    "right": "right",
    "moveUp": "up",
    "moveDown": "down"
  },

  /**
   * File Explorer shortcuts.
   */
  "fileExplorer": {
    "open": "o",
    "focus": "f",
    "edit": "e",
    "rename": "r",
    "delete": "d",
    "copyPath": "c",
    "moveDown": "j",
    "moveUp": "k",
    "collapse": "h",
    "expand": "l",
    "toggleFollow": "F",
    "toggleHelp": "?",
    "select": "return",
    "quickOpen": "p",
    "actions": "a"
  },

  /**
   * Global focus management shortcuts.
   */
  "global": {
    "focusChatInput": "ctrl+space",
    "focusNavigation": "ctrl+m",
    "focusContext": "ctrl+c",
    "focusFileTree": "ctrl+f",
    "focusFunctions": "ctrl+i",
    "cycleNext": "tab",
    "cyclePrev": "shift+tab"
  }
};
