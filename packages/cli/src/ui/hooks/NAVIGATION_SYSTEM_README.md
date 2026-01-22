# Navigation System

This document describes the navigation system architecture, keyboard shortcuts, and implementation patterns for the OLLM CLI application.

## Table of Contents

- [Overview](#overview)
- [Navigation Hierarchy](#navigation-hierarchy)
- [Keyboard Shortcuts](#keyboard-shortcuts)
- [Implementation Patterns](#implementation-patterns)
- [Shared Hooks](#shared-hooks)
- [Focus IDs Reference](#focus-ids-reference)

---

## Overview

The OLLM CLI uses a **3-level hierarchical navigation system** that provides consistent keyboard navigation throughout the application. The system is built on top of the FocusContext and uses a combination of Tab, ESC, and Enter keys for navigation.

### Key Principles

1. **Hierarchical Navigation**: Navigation follows a clear 3-level hierarchy
2. **Consistent Behavior**: ESC always moves up one level
3. **Focus Persistence**: Focus returns to the last active element when returning to a level
4. **Modal Priority**: Modals (Level 3) always capture focus first
5. **Bubbling**: ESC bubbles up if not handled at the current level

---

## Navigation Hierarchy

### Level 1: Top-Level Navigation (Tab Cycle)

The top level consists of the main UI areas that users can cycle through with Tab/Shift+Tab:

```
┌─────────────────────────────────────────────────────────────┐
│ Level 1: Tab Cycle                                          │
├─────────────────────────────────────────────────────────────┤
│ • chat-input      - User input area                         │
│ • chat-history    - Main chat/window area                   │
│ • nav-bar         - Top navigation bar (tab selector)       │
│ • context-panel   - Right side panel (if visible)           │
└─────────────────────────────────────────────────────────────┘
```

**Navigation Keys:**
- `Tab` - Cycle forward through Level 1 areas
- `Shift+Tab` - Cycle backward through Level 1 areas
- `Enter` - Activate content (go to Level 2)
- `ESC` - Two-step exit:
  1. First ESC: Switch to Chat tab (if not already on it)
  2. Second ESC: Go to chat-input

### Level 2: Tab Content (Deeper Navigation)

The second level consists of tab-specific content areas:

```
┌─────────────────────────────────────────────────────────────┐
│ Level 2: Tab Content                                        │
├─────────────────────────────────────────────────────────────┤
│ • file-tree       - Files tab content                       │
│ • side-file-tree  - Workspace panel in side panel           │
│ • functions       - Functions panel                         │
│ • tools-panel     - Tools tab content                       │
│ • hooks-panel     - Hooks tab content                       │
│ • mcp-panel       - MCP tab content                         │
│ • docs-panel      - Docs tab content                        │
│ • settings-panel  - Settings tab content                    │
│ • search-panel    - Search tab content                      │
│ • github-tab      - GitHub tab content                      │
└─────────────────────────────────────────────────────────────┘
```

**Navigation Keys:**
- `Enter` (from nav-bar) - Activate tab content
- `ESC` - Exit to nav-bar (Level 1)
- `Arrow keys`, `j/k` - Navigate within content
- Tab-specific shortcuts (varies by component)

### Level 3: Modals & Viewers (Deepest Level)

The third level consists of temporary overlays and dialogs:

```
┌─────────────────────────────────────────────────────────────┐
│ Level 3: Modals & Viewers                                   │
├─────────────────────────────────────────────────────────────┤
│ • syntax-viewer        - Code syntax viewer                 │
│ • search-dialog        - File search dialog                 │
│ • quick-open-dialog    - Quick open dialog                  │
│ • confirmation-dialog  - Confirmation dialogs               │
│ • help-panel           - Help overlay                       │
│ • quick-actions-menu   - Quick actions menu                 │
└─────────────────────────────────────────────────────────────┘
```

**Navigation Keys:**
- `ESC` - Close modal, return to parent (Level 2)
- Modal-specific shortcuts (varies by component)

---

## Keyboard Shortcuts

### Global Shortcuts (Always Active)

#### Tab Navigation
| Shortcut | Action | Description |
|----------|--------|-------------|
| `Ctrl+1` | Switch to Chat | Go to Chat tab |
| `Ctrl+2` | Switch to Tools | Go to Tools tab |
| `Ctrl+3` | Switch to Hooks | Go to Hooks tab |
| `Ctrl+4` | Switch to Files | Go to Files tab |
| `Ctrl+5` | Switch to Search | Go to Search tab |
| `Ctrl+6` | Switch to Docs | Go to Docs tab |
| `Ctrl+7` | Switch to GitHub | Go to GitHub tab |
| `Ctrl+8` | Switch to MCP | Go to MCP tab |
| `Ctrl+9` | Switch to Settings | Go to Settings tab |

#### Layout
| Shortcut | Action | Description |
|----------|--------|-------------|
| `Ctrl+B` | Toggle Side Panel | Show/hide right side panel |
| `Ctrl+K` | Command Palette | Open command palette |
| `Ctrl+Shift+D` | Toggle Debug | Show/hide debug overlay |

#### Chat
| Shortcut | Action | Description |
|----------|--------|-------------|
| `Ctrl+L` | Clear Chat | Clear chat history |
| `Ctrl+S` | Save Session | Save current session |
| `Ctrl+C` | Cancel | Cancel generation or exit one level |

#### Scroll
| Shortcut | Action | Description |
|----------|--------|-------------|
| `Ctrl+PageUp` | Scroll Up | Scroll chat history up |
| `Ctrl+PageDown` | Scroll Down | Scroll chat history down |
| `Meta+Up` | Scroll Up | Scroll chat history up (Mac) |
| `Meta+Down` | Scroll Down | Scroll chat history down (Mac) |

#### Focus Management
| Shortcut | Action | Description |
|----------|--------|-------------|
| `Tab` | Cycle Next | Cycle to next focus area |
| `Shift+Tab` | Cycle Previous | Cycle to previous focus area |
| `Ctrl+Shift+I` | Focus Input | Focus chat input |
| `Ctrl+Shift+N` | Focus Nav Bar | Focus navigation bar |
| `Ctrl+Shift+P` | Focus Panel | Focus side panel |
| `Ctrl+Shift+F` | Focus File Tree | Focus file tree |
| `Ctrl+Shift+U` | Focus Functions | Focus functions panel |

### Tab-Specific Shortcuts

#### File Explorer
| Shortcut | Action | Description |
|----------|--------|-------------|
| `↑/↓` or `j/k` | Navigate | Move selection up/down |
| `Enter` | Open/Expand | Open file or expand folder |
| `Space` | Toggle | Toggle folder expansion |
| `Ctrl+F` | Search | Open file search dialog |
| `Ctrl+P` | Quick Open | Open quick open dialog |
| `?` | Help | Show help overlay |

#### Tools Tab
| Shortcut | Action | Description |
|----------|--------|-------------|
| `↑/↓` or `j/k` | Navigate | Move selection up/down |
| `Enter` | Execute | Execute selected tool |
| `Space` | Toggle | Toggle tool approval mode |
| `0` or `ESC` | Exit | Return to nav bar |

#### Settings Tab
| Shortcut | Action | Description |
|----------|--------|-------------|
| `↑/↓` or `j/k` | Navigate | Move selection up/down |
| `Enter` | Edit | Edit selected setting |
| `Space` | Toggle | Toggle boolean setting |
| `0` or `ESC` | Exit | Return to nav bar |

---

## Implementation Patterns

### Pattern 1: Using Global Shortcuts Hook

For the main App component, use the `useGlobalKeyboardShortcuts` hook:

```typescript
import { useGlobalKeyboardShortcuts } from './hooks/useGlobalKeyboardShortcuts.js';

function App() {
  const [debugMode, setDebugMode] = useState(false);
  const { scrollUp, scrollDown } = useChat();
  
  // Register all global shortcuts
  useGlobalKeyboardShortcuts({
    onToggleDebug: () => setDebugMode(prev => !prev),
    onCommandPalette: () => console.log('Command palette'),
    onSaveSession: () => console.log('Save session'),
    onScrollUp: scrollUp,
    onScrollDown: scrollDown,
  });
  
  return <Box>...</Box>;
}
```

### Pattern 2: Using Tab Escape Handler

For tab components, use the `useTabEscapeHandler` hook:

```typescript
import { useTabEscapeHandler } from '../hooks/useTabEscapeHandler.js';

function MyTabComponent({ hasFocus }: { hasFocus: boolean }) {
  // Automatically handles ESC navigation
  useTabEscapeHandler(hasFocus);
  
  // Rest of component logic
  return <Box>...</Box>;
}
```

### Pattern 3: ESC Bubbling (Recommended)

For components that don't need custom ESC handling, allow ESC to bubble:

```typescript
useInput((input, key) => {
  // Allow ESC to bubble to global handler
  if (key.escape) return;
  
  // Handle other keys
  if (key.upArrow) {
    // Move selection up
  }
}, { isActive: hasFocus });
```

### Pattern 4: Modal ESC Handling

For modals and dialogs, handle ESC locally to close:

```typescript
useInput((input, key) => {
  if (key.escape) {
    onClose(); // Close modal
    return;
  }
  
  // Handle other keys
}, { isActive: isVisible });
```

### Pattern 5: Conditional ESC Handling

For components with multiple states, handle ESC conditionally:

```typescript
useInput((input, key) => {
  if (key.escape) {
    if (dialogOpen) {
      closeDialog(); // Close dialog first
    } else {
      // Allow ESC to bubble to global handler
      return;
    }
  }
}, { isActive: hasFocus });
```

---

## Shared Hooks

### useGlobalKeyboardShortcuts

Centralizes all global keyboard shortcuts in one place.

**Location**: `packages/cli/src/ui/hooks/useGlobalKeyboardShortcuts.ts`

**Usage**:
```typescript
useGlobalKeyboardShortcuts({
  onToggleDebug?: () => void;
  onCommandPalette?: () => void;
  onSaveSession?: () => void;
  onScrollUp?: () => void;
  onScrollDown?: () => void;
});
```

**Features**:
- Tab navigation (Ctrl+1-9)
- Layout shortcuts (toggle panel, command palette, debug)
- Chat shortcuts (clear, save, cancel)
- Scroll shortcuts (Ctrl+PageUp/Down)
- Focus management shortcuts (Tab, Shift+Tab, focus shortcuts)

### useTabEscapeHandler

Provides consistent ESC key handling for tab components.

**Location**: `packages/cli/src/ui/hooks/useTabEscapeHandler.ts`

**Usage**:
```typescript
useTabEscapeHandler(hasFocus: boolean);
```

**Features**:
- Handles ESC key for hierarchical navigation
- Handles '0' as alternative exit key (legacy pattern)
- Only active when component has focus
- Integrates with FocusContext.exitOneLevel()

---

## Focus IDs Reference

### Level 1 Focus IDs (Tab Cycle)

| Focus ID | Description | Location |
|----------|-------------|----------|
| `chat-input` | User input area | Bottom of screen |
| `chat-history` | Main chat/window area | Center of screen |
| `nav-bar` | Top navigation bar | Top of screen |
| `context-panel` | Right side panel | Right side of screen |

### Level 2 Focus IDs (Tab Content)

| Focus ID | Description | Tab |
|----------|-------------|-----|
| `file-tree` | File explorer tree view | Files |
| `side-file-tree` | Workspace panel file tree | Side Panel |
| `functions` | Functions panel | Side Panel |
| `tools-panel` | Tools list | Tools |
| `hooks-panel` | Hooks list | Hooks |
| `mcp-panel` | MCP servers list | MCP |
| `docs-panel` | Documentation viewer | Docs |
| `settings-panel` | Settings form | Settings |
| `search-panel` | Search interface | Search |
| `github-tab` | GitHub repositories | GitHub |

### Level 3 Focus IDs (Modals)

| Focus ID | Description | Trigger |
|----------|-------------|---------|
| `syntax-viewer` | Code syntax viewer | View file in workspace panel |
| `search-dialog` | File search dialog | Ctrl+F in file explorer |
| `quick-open-dialog` | Quick open dialog | Ctrl+P in file explorer |
| `confirmation-dialog` | Confirmation dialogs | Various actions |
| `help-panel` | Help overlay | ? key in file explorer |
| `quick-actions-menu` | Quick actions menu | Various contexts |

---

## Navigation Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     Level 1: Tab Cycle                      │
│                                                             │
│  ┌──────────┐   Tab    ┌──────────┐   Tab    ┌──────────┐ │
│  │  Input   │ ──────> │  Chat    │ ──────> │  Nav Bar │ │
│  │          │ <────── │  History │ <────── │          │ │
│  └──────────┘ Shift+  └──────────┘ Shift+  └──────────┘ │
│                Tab                    Tab                  │
│                                                             │
│                         Enter ↓                             │
│                                                             │
│                     Level 2: Tab Content                    │
│                                                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │  Tools   │  │  Hooks   │  │  Files   │  │ Settings │  │
│  │  Panel   │  │  Panel   │  │  Tree    │  │  Panel   │  │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘  │
│                                                             │
│                         Enter ↓                             │
│                                                             │
│                   Level 3: Modals/Viewers                   │
│                                                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │  Search  │  │  Quick   │  │  Syntax  │  │  Help    │  │
│  │  Dialog  │  │  Open    │  │  Viewer  │  │  Panel   │  │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘  │
│                                                             │
│                         ESC ↑                               │
│                                                             │
└─────────────────────────────────────────────────────────────┘

ESC Key Behavior:
- Level 3 → Level 2: Close modal, return to parent
- Level 2 → Level 1: Exit to nav bar
- Level 1 → Chat: Switch to Chat tab (if not already)
- Level 1 → Input: Go to chat input (if already on Chat)
```

---

## Best Practices

### DO ✅

1. **Use shared hooks** for consistent behavior
   ```typescript
   useTabEscapeHandler(hasFocus);
   ```

2. **Allow ESC to bubble** when no custom handling needed
   ```typescript
   if (key.escape) return;
   ```

3. **Handle ESC locally in modals** to close them
   ```typescript
   if (key.escape) {
     onClose();
     return;
   }
   ```

4. **Use FocusContext methods** for navigation
   ```typescript
   focusManager.exitOneLevel();
   focusManager.setFocus('nav-bar');
   ```

5. **Document custom shortcuts** in component comments
   ```typescript
   /**
    * Keyboard Shortcuts:
    * - ↑/↓: Navigate list
    * - Enter: Select item
    * - ESC: Exit to nav bar
    */
   ```

### DON'T ❌

1. **Don't implement custom exit logic** in tab components
   ```typescript
   // ❌ Bad
   if (key.escape) {
     setActiveTab('chat');
     setFocus('nav-bar');
   }
   
   // ✅ Good
   useTabEscapeHandler(hasFocus);
   ```

2. **Don't duplicate keyboard shortcut handling**
   ```typescript
   // ❌ Bad - duplicates global shortcuts
   if (isKey(input, key, 'ctrl+1')) {
     setActiveTab('chat');
   }
   
   // ✅ Good - let global handler manage it
   useGlobalKeyboardShortcuts();
   ```

3. **Don't break the navigation hierarchy**
   ```typescript
   // ❌ Bad - skips levels
   if (key.escape) {
     setFocus('chat-input'); // Jumps from Level 2 to Level 1
   }
   
   // ✅ Good - respects hierarchy
   focusManager.exitOneLevel();
   ```

4. **Don't forget to check focus state**
   ```typescript
   // ❌ Bad - always active
   useInput((input, key) => {
     // ...
   }, { isActive: true });
   
   // ✅ Good - respects focus
   useInput((input, key) => {
     // ...
   }, { isActive: hasFocus });
   ```

---

## Troubleshooting

### ESC key not working

**Problem**: ESC key doesn't navigate as expected

**Solutions**:
1. Check if component is handling ESC locally
2. Ensure `isActive` is set correctly in `useInput`
3. Verify focus state with `focusManager.isFocused()`
4. Check if a modal is open and capturing ESC

### Keyboard shortcuts not working

**Problem**: Global shortcuts (Ctrl+1-9) don't work

**Solutions**:
1. Ensure `useGlobalKeyboardShortcuts` is called in App
2. Check keybinds configuration in `keybinds.ts`
3. Verify `isActive: true` in global shortcuts hook
4. Check for conflicting shortcuts in child components

### Focus stuck in component

**Problem**: Can't navigate out of a component

**Solutions**:
1. Implement `useTabEscapeHandler` in the component
2. Ensure ESC is allowed to bubble: `if (key.escape) return;`
3. Check if component is preventing default behavior
4. Verify focus state is being updated correctly

---

## Related Documentation

- [Focus System README](../../features/context/FOCUS_SYSTEM_README.md)
- [Window System README](../contexts/WINDOW_SYSTEM_README.md)
- [Keybinds Configuration](../../config/keybinds.ts)
- [Navigation System Audit](.dev/audits/navigation-system-audit.md)

---

## Changelog

| Date | Version | Changes |
|------|---------|---------|
| 2026-01-22 | 1.0.0 | Initial documentation |
