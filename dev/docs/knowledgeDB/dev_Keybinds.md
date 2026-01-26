# Keybinds

**Last Updated:** January 26, 2026  
**Status:** ✅ Implemented  
**Related Documents:**
- `dev_SlashCommands.md` - Slash commands
- User settings location: `~/.ollm/user_keybinds.json`

---

## Overview

OLLM CLI provides customizable keyboard shortcuts for efficient navigation and interaction. Keybinds are organized by functional area and can be customized through the Settings UI.

**Key Features:**
- Default keybinds defined in code
- User overrides saved to `~/.ollm/user_keybinds.json`
- Deep merge strategy (user overrides defaults)
- Reset to defaults available
- Settings UI for customization

---

## Keybind Categories

### Tab Navigation

Switch between main application tabs using Ctrl + Number.

| Action | Default Keybind | Description |
|--------|----------------|-------------|
| Chat Tab | `Ctrl+1` | Switch to chat view |
| Tools Tab | `Ctrl+2` | Switch to tools panel |
| Hooks Tab | `Ctrl+3` | Switch to hooks panel |
| Files Tab | `Ctrl+4` | Switch to file explorer |
| Search Tab | `Ctrl+5` | Switch to search panel |
| Docs Tab | `Ctrl+6` | Switch to documentation |
| GitHub Tab | `Ctrl+7` | Switch to GitHub integration |
| MCP Tab | `Ctrl+8` | Switch to MCP servers |
| Settings Tab | `Ctrl+9` | Switch to settings |

---

### Layout Controls

Global layout and panel management.

| Action | Default Keybind | Description |
|--------|----------------|-------------|
| Toggle Panel | `Ctrl+P` | Toggle side panel visibility |
| Command Palette | `Ctrl+K` | Open command palette |
| Toggle Debug | `Ctrl+/` | Toggle debug mode |
| Switch Window Left | `Ctrl+Shift+Tab` | Switch to previous window |
| Switch Window Right | `Ctrl+Tab` | Switch to next window |

---

### Chat Interaction

Shortcuts for chat input and session management.

| Action | Default Keybind | Description |
|--------|----------------|-------------|
| Send Message | `Return` | Send message to LLM |
| New Line | `Shift+Return` | Insert new line in message |
| Clear Chat | `Ctrl+L` | Clear chat history |
| Save Session | `Ctrl+S` | Save current session |
| Cancel | `Escape` | Cancel current operation |
| Edit Previous | `Up` | Edit previous message |

---

### Review Mode

Code diff review shortcuts.

| Action | Default Keybind | Description |
|--------|----------------|-------------|
| Approve | `Y` | Approve current diff |
| Reject | `N` | Reject current diff |

---

### Navigation

Standard navigation keys with Vim-style alternatives.

| Action | Default Keybind | Description |
|--------|----------------|-------------|
| Scroll Down | `J` | Scroll down (Vim-style) |
| Scroll Up | `K` | Scroll up (Vim-style) |
| Select | `Return` | Select current item |
| Back | `Backspace` | Go back |
| Cycle Focus | `Tab` | Cycle focus forward |
| Move Left | `Left` | Move cursor/selection left |
| Move Right | `Right` | Move cursor/selection right |
| Move Up | `Up` | Move cursor/selection up |
| Move Down | `Down` | Move cursor/selection down |

---

### File Explorer

File tree navigation and operations.

| Action | Default Keybind | Description |
|--------|----------------|-------------|
| Open File | `O` | Open selected file |
| Focus Explorer | `F` | Focus file explorer |
| Edit File | `E` | Edit selected file |
| Rename | `R` | Rename file/folder |
| Delete | `D` | Delete file/folder |
| Copy Path | `C` | Copy file path to clipboard |
| Move Down | `J` | Move selection down (Vim-style) |
| Move Up | `K` | Move selection up (Vim-style) |
| Collapse | `H` | Collapse folder (Vim-style) |
| Expand | `L` | Expand folder (Vim-style) |
| Toggle Follow | `Shift+F` | Toggle follow active file |
| Toggle Help | `?` | Toggle help overlay |
| Select | `Return` | Select/open item |
| Quick Open | `P` | Quick file open |
| Actions Menu | `A` | Open actions menu |

---

### Terminal

Terminal interaction shortcuts.

| Action | Default Keybind | Description |
|--------|----------------|-------------|
| Scroll Up | `Up` | Scroll terminal up |
| Scroll Down | `Down` | Scroll terminal down |
| History Up | `Ctrl+Up` | Navigate command history up |
| History Down | `Ctrl+Down` | Navigate command history down |
| Interrupt | `Ctrl+C` | Send interrupt signal (hardcoded) |

---

### Global Focus Management

Focus management across the application.

| Action | Default Keybind | Description |
|--------|----------------|-------------|
| Focus Chat Input | `Ctrl+Space` | Focus chat input field |
| Focus Navigation | `Ctrl+M` | Focus navigation panel |
| Focus Context | `Ctrl+C` | Focus context panel |
| Focus File Tree | `Ctrl+F` | Focus file explorer |
| Focus Functions | `Ctrl+I` | Focus functions panel |
| Cycle Next | `Tab` | Cycle focus to next element |
| Cycle Previous | `Shift+Tab` | Cycle focus to previous element |

---

## User Configuration

### Configuration File

**Location:** `~/.ollm/user_keybinds.json`

**Format:**
```json
{
  "tabNavigation": {
    "tabChat": "ctrl+1",
    "tabTools": "ctrl+2"
  },
  "chat": {
    "send": "return",
    "newline": "shift+return"
  }
}
```

### Merge Strategy

User keybinds are deep-merged with defaults:
1. Default keybinds are loaded from `packages/cli/src/config/keybinds.ts`
2. User keybinds are loaded from `~/.ollm/user_keybinds.json`
3. User values override defaults
4. Missing keys in user config are filled with defaults

### Customization via Settings UI

1. Open Settings: `Ctrl+9` or `/settings`
2. Navigate to Keybinds section
3. Click on keybind to edit
4. Press new key combination
5. Save changes

### Reset to Defaults

Use the "Reset All" button in Settings UI or delete `~/.ollm/user_keybinds.json`.

---

## Keybind Format

Keybinds use the following format:

**Modifiers:**
- `ctrl` - Control key
- `shift` - Shift key
- `alt` - Alt key (Option on macOS)
- `meta` - Meta key (Command on macOS, Windows key on Windows)

**Special Keys:**
- `return` - Enter key
- `escape` - Escape key
- `tab` - Tab key
- `backspace` - Backspace key
- `space` - Space bar
- `up`, `down`, `left`, `right` - Arrow keys

**Format:**
```
[modifier+][modifier+]key
```

**Examples:**
- `ctrl+s` - Control + S
- `shift+return` - Shift + Enter
- `ctrl+shift+tab` - Control + Shift + Tab
- `return` - Enter (no modifier)

---

## Known Issues & Conflicts

### Potential Conflicts

**Terminal Conflicts:**
- Some terminal emulators intercept certain key combinations
- `Ctrl+C` is hardcoded for interrupt (cannot be changed)
- `Ctrl+Z` may be intercepted by terminal for suspend

**System Conflicts:**
- `Ctrl+Tab` may be intercepted by browser/OS for tab switching
- `Ctrl+W` may close terminal window
- `Ctrl+Q` may quit terminal application

**Internal Conflicts:**
- Some keybinds may conflict with each other
- Focus context determines which keybind takes precedence

### Hardcoded Keybinds

**Known Hardcoded Keybinds:**
- `Ctrl+C` - Terminal interrupt (in `TerminalContext.tsx`)
- Some `useInput` hooks may have hardcoded keys

**Post-Alpha Task:** Audit and remove all hardcoded keybinds.

---

## Architecture

### KeybindsService

**Location:** `packages/cli/src/services/KeybindsService.ts`

**Responsibilities:**
- Load default keybinds
- Load user keybinds from `~/.ollm/user_keybinds.json`
- Merge user and default keybinds
- Save user keybinds
- Reset to defaults

**Singleton Pattern:**
```typescript
const keybindsService = KeybindsService.getInstance();
const keybinds = keybindsService.load();
```

### Default Keybinds

**Location:** `packages/cli/src/config/keybinds.ts`

**Export:**
```typescript
export const keybindsData = {
  tabNavigation: { ... },
  layout: { ... },
  chat: { ... },
  // ...
};
```

### KeybindsContext

**Location:** `packages/cli/src/ui/contexts/KeybindsContext.tsx` (assumed)

**Provides:**
- Current active keybinds
- Keybind update functions
- Reset functionality

---

## Post-Alpha Tasks

### Task 1: Settings UI Tweaks

**Priority:** Medium  
**Effort:** 4-6 hours

**Issues:**
- Not all keybinds displayed in Settings UI
- Some keybinds don't work (conflicts)
- No visual feedback for conflicts
- No validation for invalid keybinds

**Implementation:**
1. Audit Settings UI keybind display
2. Add all missing keybinds to UI
3. Add conflict detection
4. Add visual feedback for conflicts
5. Add keybind validation
6. Add "Test" button to test keybind

**Files to Modify:**
- `packages/cli/src/ui/components/settings/KeybindsSettings.tsx` - Settings UI
- `packages/cli/src/services/KeybindsService.ts` - Add validation

---

### Task 2: Integration Check

**Priority:** Medium  
**Effort:** 4-6 hours

**Issues:**
- Some keybinds don't work
- Conflicts with terminal/system
- Conflicts between keybinds
- Focus context issues

**Investigation:**
1. Test each keybind in different contexts
2. Identify conflicts with terminal
3. Identify conflicts with system
4. Identify internal conflicts
5. Document working/non-working keybinds

**Files to Check:**
- All `useInput` hooks in UI components
- Focus management system
- Input routing system

---

### Task 3: Remove Hardcoded Keybinds

**Priority:** Low  
**Effort:** 6-8 hours

**Goal:** All keybinds should be configurable, no hardcoded keys

**Implementation:**
1. Search for all `useInput` hooks
2. Search for hardcoded key checks (e.g., `key.ctrl && input === 'c'`)
3. Replace with keybind lookups
4. Add keybinds to `keybinds.ts` if missing
5. Test all keybinds work after changes

**Search Patterns:**
```bash
# Find useInput hooks
grep -r "useInput" packages/cli/src/ui/

# Find hardcoded key checks
grep -r "key\.ctrl" packages/cli/src/ui/
grep -r "key\.shift" packages/cli/src/ui/
grep -r "input ===" packages/cli/src/ui/
```

**Files to Modify:**
- All UI components with `useInput` hooks
- `packages/cli/src/ui/contexts/TerminalContext.tsx` - `Ctrl+C` hardcoded

---

## File Locations

| File | Purpose |
|------|---------|
| `packages/cli/src/config/keybinds.ts` | Default keybind definitions |
| `packages/cli/src/services/KeybindsService.ts` | Keybind loading/saving service |
| `packages/cli/src/ui/contexts/KeybindsContext.tsx` | Keybinds React context (assumed) |
| `packages/cli/src/ui/components/settings/KeybindsSettings.tsx` | Settings UI (assumed) |
| `~/.ollm/user_keybinds.json` | User keybind overrides |

---

## Best Practices

### For Developers

1. **Always use KeybindsContext** - Don't hardcode keybinds
2. **Check focus context** - Keybinds should respect focus
3. **Document conflicts** - Note any known conflicts
4. **Test on multiple platforms** - Windows, macOS, Linux
5. **Provide alternatives** - Offer mouse/menu alternatives

### For Users

1. **Avoid system conflicts** - Don't override system shortcuts
2. **Test after changes** - Verify keybinds work as expected
3. **Keep backups** - Save `user_keybinds.json` before major changes
4. **Report conflicts** - Help identify problematic keybinds
5. **Use Settings UI** - Easier than manual JSON editing

---

## Troubleshooting

### Keybind Not Working

1. Check if keybind conflicts with terminal/system
2. Check if correct focus context
3. Check if keybind is hardcoded elsewhere
4. Try different key combination
5. Check console for errors

### Keybind Conflicts

1. Open Settings → Keybinds
2. Look for duplicate keybinds
3. Change one of the conflicting keybinds
4. Save and test

### Reset Not Working

1. Delete `~/.ollm/user_keybinds.json` manually
2. Restart application
3. Defaults will be restored

---

## Examples

### Custom Keybinds

**Example 1: Vim-style navigation everywhere**
```json
{
  "navigation": {
    "scrollDown": "j",
    "scrollUp": "k",
    "left": "h",
    "right": "l"
  },
  "fileExplorer": {
    "moveDown": "j",
    "moveUp": "k",
    "collapse": "h",
    "expand": "l"
  }
}
```

**Example 2: Emacs-style shortcuts**
```json
{
  "chat": {
    "send": "ctrl+return",
    "newline": "return"
  },
  "navigation": {
    "moveUp": "ctrl+p",
    "moveDown": "ctrl+n",
    "left": "ctrl+b",
    "right": "ctrl+f"
  }
}
```

**Example 3: Custom tab navigation**
```json
{
  "tabNavigation": {
    "tabChat": "alt+1",
    "tabTools": "alt+2",
    "tabFiles": "alt+3"
  }
}
```
