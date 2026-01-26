# Keyboard Shortcuts Reference

Complete reference of all keyboard shortcuts available in OLLM CLI.

## Table of Contents

- [Global Shortcuts](#global-shortcuts)
- [Tab Navigation](#tab-navigation)
- [Chat Shortcuts](#chat-shortcuts)
- [File Explorer](#file-explorer)
- [Tools Tab](#tools-tab)
- [Hooks Tab](#hooks-tab)
- [Settings Tab](#settings-tab)
- [Focus Management](#focus-management)
- [Customization](#customization)

---

## Global Shortcuts

These shortcuts work from anywhere in the application.

### Tab Navigation

| Shortcut | Action | Description |
|----------|--------|-------------|
| `Ctrl+1` | Switch to Chat | Go to Chat tab and focus nav bar |
| `Ctrl+2` | Switch to Tools | Go to Tools tab and focus nav bar |
| `Ctrl+3` | Switch to Hooks | Go to Hooks tab and focus nav bar |
| `Ctrl+4` | Switch to Files | Go to Files tab and focus nav bar |
| `Ctrl+5` | Switch to Search | Go to Search tab and focus nav bar |
| `Ctrl+6` | Switch to Docs | Go to Docs tab and focus nav bar |
| `Ctrl+7` | Switch to GitHub | Go to GitHub tab and focus nav bar |
| `Ctrl+8` | Switch to MCP | Go to MCP tab and focus nav bar |
| `Ctrl+9` | Switch to Settings | Go to Settings tab and focus nav bar |

### Layout

| Shortcut | Action | Description |
|----------|--------|-------------|
| `Ctrl+B` | Toggle Side Panel | Show or hide the right side panel |
| `Ctrl+K` | Command Palette | Open the command palette (coming soon) |
| `Ctrl+Shift+D` | Toggle Debug | Show or hide debug overlay |

### Navigation

| Shortcut | Action | Description |
|----------|--------|-------------|
| `Tab` | Cycle Next | Cycle to next focus area (Input → Chat → Nav Bar → Panel) |
| `Shift+Tab` | Cycle Previous | Cycle to previous focus area |
| `ESC` | Exit One Level | Navigate up one level in the hierarchy |
| `Enter` | Activate | Activate the focused element or go deeper |

---

## Tab Navigation

### In Navigation Bar

When the navigation bar is focused:

| Shortcut | Action | Description |
|----------|--------|-------------|
| `←` or `h` | Previous Tab | Move to the previous tab |
| `→` or `l` | Next Tab | Move to the next tab |
| `Enter` | Activate Tab | Activate the selected tab's content |
| `ESC` | Exit | First ESC: Switch to Chat tab, Second ESC: Go to input |

---

## Chat Shortcuts

### Chat Management

| Shortcut | Action | Description |
|----------|--------|-------------|
| `Ctrl+L` | Clear Chat | Clear all chat history |
| `Ctrl+S` | Save Session | Save the current chat session |
| `Ctrl+C` | Cancel | Cancel generation (if streaming) or exit one level |

### Scrolling

| Shortcut | Action | Description |
|----------|--------|-------------|
| `Ctrl+PageUp` | Scroll Up | Scroll chat history up |
| `Ctrl+PageDown` | Scroll Down | Scroll chat history down |
| `Meta+Up` | Scroll Up | Scroll chat history up (Mac) |
| `Meta+Down` | Scroll Down | Scroll chat history down (Mac) |

### Window Switching

When in Chat tab:

| Shortcut | Action | Description |
|----------|--------|-------------|
| `Ctrl+→` | Next Window | Switch to next window (Chat → Terminal → Editor) |
| `Ctrl+←` | Previous Window | Switch to previous window |
| `Ctrl+Shift+C` | Chat Window | Switch directly to Chat window |
| `Ctrl+Shift+T` | Terminal Window | Switch directly to Terminal window |
| `Ctrl+Shift+E` | Editor Window | Switch directly to Editor window |

---

## File Explorer

### Navigation

| Shortcut | Action | Description |
|----------|--------|-------------|
| `↑` or `k` | Move Up | Move selection up |
| `↓` or `j` | Move Down | Move selection down |
| `←` or `h` | Collapse | Collapse folder or go to parent |
| `→` or `l` | Expand | Expand folder or open file |
| `Enter` | Open/Expand | Open file or expand/collapse folder |
| `Space` | Toggle | Toggle folder expansion |

### File Operations

| Shortcut | Action | Description |
|----------|--------|-------------|
| `n` | New File | Create a new file |
| `N` | New Folder | Create a new folder |
| `r` | Rename | Rename selected file/folder |
| `d` | Delete | Delete selected file/folder |
| `c` | Copy | Copy selected file/folder |
| `x` | Cut | Cut selected file/folder |
| `v` | Paste | Paste copied/cut file/folder |

### Search & Quick Actions

| Shortcut | Action | Description |
|----------|--------|-------------|
| `Ctrl+F` | Search | Open file search dialog |
| `Ctrl+P` | Quick Open | Open quick open dialog |
| `/` | Filter | Filter files in current view |
| `?` | Help | Show help overlay |

### View Options

| Shortcut | Action | Description |
|----------|--------|-------------|
| `g` | Go to Top | Jump to top of file tree |
| `G` | Go to Bottom | Jump to bottom of file tree |
| `f` | Focus Tree | Focus the file tree |
| `F` | Focus Search | Focus the search input |

### Exit

| Shortcut | Action | Description |
|----------|--------|-------------|
| `ESC` | Exit | Exit to navigation bar |
| `0` | Exit | Alternative exit shortcut |

---

## Tools Tab

### Navigation

| Shortcut | Action | Description |
|----------|--------|-------------|
| `↑` or `k` | Move Up | Move selection up |
| `↓` or `j` | Move Down | Move selection down |
| `Enter` | Execute | Execute the selected tool |
| `Space` | Toggle Mode | Toggle tool approval mode (ASK/AUTO/YOLO) |

### Tool Management

| Shortcut | Action | Description |
|----------|--------|-------------|
| `r` | Refresh | Refresh tool list |
| `i` | Info | Show tool information |
| `?` | Help | Show help overlay |

### Exit

| Shortcut | Action | Description |
|----------|--------|-------------|
| `ESC` | Exit | Exit to navigation bar |
| `0` | Exit | Alternative exit shortcut |

---

## Hooks Tab

### Navigation

| Shortcut | Action | Description |
|----------|--------|-------------|
| `↑` or `k` | Move Up | Move selection up |
| `↓` or `j` | Move Down | Move selection down |
| `Enter` | Toggle | Enable/disable selected hook |
| `Space` | Toggle | Alternative toggle shortcut |

### Hook Management

| Shortcut | Action | Description |
|----------|--------|-------------|
| `n` | New Hook | Create a new hook |
| `e` | Edit | Edit selected hook |
| `d` | Delete | Delete selected hook |
| `r` | Refresh | Refresh hook list |
| `?` | Help | Show help overlay |

### Exit

| Shortcut | Action | Description |
|----------|--------|-------------|
| `ESC` | Exit | Exit to navigation bar |
| `0` | Exit | Alternative exit shortcut |

---

## Settings Tab

### Navigation

| Shortcut | Action | Description |
|----------|--------|-------------|
| `↑` or `k` | Move Up | Move selection up |
| `↓` or `j` | Move Down | Move selection down |
| `Enter` | Edit | Edit selected setting |
| `Space` | Toggle | Toggle boolean setting |

### Setting Management

| Shortcut | Action | Description |
|----------|--------|-------------|
| `r` | Reset | Reset setting to default |
| `s` | Save | Save all settings |
| `?` | Help | Show help overlay |

### While Editing

| Shortcut | Action | Description |
|----------|--------|-------------|
| `Enter` | Save | Save the edited value |
| `ESC` | Cancel | Cancel editing and revert |

### Exit

| Shortcut | Action | Description |
|----------|--------|-------------|
| `ESC` | Exit | Exit to navigation bar |
| `0` | Exit | Alternative exit shortcut |

---

## Focus Management

### Direct Focus Shortcuts

| Shortcut | Action | Description |
|----------|--------|-------------|
| `Ctrl+Shift+I` | Focus Input | Focus the chat input area |
| `Ctrl+Shift+N` | Focus Nav Bar | Focus the navigation bar |
| `Ctrl+Shift+P` | Focus Panel | Focus the side panel |
| `Ctrl+Shift+F` | Focus File Tree | Focus the file tree |
| `Ctrl+Shift+U` | Focus Functions | Focus the functions panel |

### Focus Cycling

| Shortcut | Action | Description |
|----------|--------|-------------|
| `Tab` | Cycle Next | Cycle to next focus area |
| `Shift+Tab` | Cycle Previous | Cycle to previous focus area |

---

## Customization

### Viewing Current Keybinds

You can view your current keybinds configuration:

```bash
# View keybinds file
cat ~/.ollm/keybinds.json
```

### Customizing Shortcuts

To customize keyboard shortcuts:

1. Open the Settings tab (`Ctrl+9`)
2. Navigate to "Keybinds" section
3. Select the shortcut you want to change
4. Press `Enter` to edit
5. Type the new shortcut combination
6. Press `Enter` to save

### Keybinds File Format

The keybinds configuration file (`~/.ollm/keybinds.json`) uses this format:

```json
{
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
  "layout": {
    "togglePanel": "ctrl+b",
    "commandPalette": "ctrl+k",
    "toggleDebug": "ctrl+shift+d"
  },
  "chat": {
    "clearChat": "ctrl+l",
    "saveSession": "ctrl+s",
    "cancel": "ctrl+c"
  },
  "navigation": {
    "up": "up",
    "down": "down",
    "left": "left",
    "right": "right",
    "select": "return",
    "back": "escape"
  },
  "global": {
    "cycleNext": "tab",
    "cyclePrev": "shift+tab",
    "focusChatInput": "ctrl+shift+i",
    "focusNavigation": "ctrl+shift+n",
    "focusContext": "ctrl+shift+p",
    "focusFileTree": "ctrl+shift+f",
    "focusFunctions": "ctrl+shift+u"
  }
}
```

### Resetting to Defaults

To reset all keybinds to defaults:

1. Open the Settings tab (`Ctrl+9`)
2. Navigate to "Keybinds" section
3. Press `r` to reset all keybinds
4. Confirm the reset

Or delete the keybinds file:

```bash
rm ~/.ollm/keybinds.json
```

---

## Tips & Tricks

### Vim-Style Navigation

Most lists support Vim-style navigation:
- `j` = Down
- `k` = Up
- `h` = Left/Collapse
- `l` = Right/Expand
- `g` = Go to top
- `G` = Go to bottom

### Quick Navigation

Use number shortcuts to quickly switch tabs:
- `Ctrl+1` through `Ctrl+9` for instant tab switching
- No need to cycle through tabs with Tab key

### ESC Key Hierarchy

The ESC key follows a consistent hierarchy:
1. Close modal/dialog (if open)
2. Exit tab content to nav bar
3. Switch to Chat tab (if not already)
4. Focus chat input

### Focus Cycling

Use `Tab` and `Shift+Tab` to cycle through main areas:
- Input → Chat → Nav Bar → Side Panel → Input

### Alternative Exit

Most tabs support `0` as an alternative to ESC for exiting.

---

## Platform-Specific Notes

### macOS

- `Meta` key is the `Command` (⌘) key
- `Ctrl` key is the `Control` (⌃) key
- Some shortcuts use `Meta` instead of `Ctrl` (e.g., `Meta+Up` for scroll)

### Windows/Linux

- `Meta` key is the `Windows` key (Windows) or `Super` key (Linux)
- Most shortcuts use `Ctrl` key
- Terminal emulator may intercept some shortcuts

### Terminal Compatibility

Some shortcuts may not work in all terminal emulators:
- `Ctrl+Shift+*` shortcuts may require terminal configuration
- Function keys (`F1`-`F12`) may be intercepted by the terminal
- Mouse support requires terminal with mouse reporting enabled

---

## Related Documentation

- [Navigation System](../packages/cli/src/ui/hooks/NAVIGATION_SYSTEM_README.md)
- [Focus System](../packages/cli/src/features/context/FOCUS_SYSTEM_README.md)
- [Keybinds Configuration](../packages/cli/src/config/keybinds.ts)

---

## Changelog

| Date | Version | Changes |
|------|---------|---------|
| 2026-01-22 | 1.0.0 | Initial keyboard shortcuts reference |
