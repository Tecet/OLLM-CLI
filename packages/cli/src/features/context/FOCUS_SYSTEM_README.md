# Focus Management System

## Overview

The Focus Management System implements a 3-level hierarchical navigation model for keyboard focus management across the OLLM CLI application. It provides consistent navigation patterns using Tab, Enter, and ESC keys.

## Architecture

### Hierarchical Model

The system uses three distinct levels of focus:

```
Level 1: Tab Cycle (Main UI Areas)
├── User Input (chat-input)
├── Chat Window (chat-history)
├── Nav Bar (nav-bar)
└── Side Panel (context-panel)

Level 2: Tab Content (Deeper Navigation)
├── Files Tab (file-tree)
├── Tools Tab (tools-panel)
├── Hooks Tab (hooks-panel)
├── MCP Tab (mcp-panel)
├── Search Tab (search-panel)
├── Docs Tab (docs-panel)
├── GitHub Tab (github-tab)
└── Settings Tab (settings-panel)

Level 3: Modals & Viewers (Deepest)
├── Syntax Viewer (syntax-viewer)
├── Search Dialog (search-dialog)
├── Quick Open Dialog (quick-open-dialog)
├── Confirmation Dialog (confirmation-dialog)
├── Help Panel (help-panel)
└── Quick Actions Menu (quick-actions-menu)
```

### Navigation Keys

| Key | Action | Description |
|-----|--------|-------------|
| **Tab** | Cycle Forward | Move to next Level 1 area |
| **Shift+Tab** | Cycle Backward | Move to previous Level 1 area |
| **Enter** | Activate/Go Deeper | Activate tab content from nav-bar |
| **ESC** | Move Up One Level | Hierarchical navigation upward |

### ESC Navigation Flow

The ESC key implements consistent hierarchical navigation:

```
Level 3 (Modal) → ESC → Level 2 (Parent Component)
Level 2 (Tab Content) → ESC → Level 1 (Nav Bar)
Level 1 (Nav Bar, not Chat) → ESC → Level 1 (Nav Bar on Chat)
Level 1 (Nav Bar on Chat) → ESC → Level 1 (User Input)
```

**Example Flow:**
```
Syntax Viewer → ESC → File Tree → ESC → Nav Bar → ESC → User Input
```

## Usage

### Basic Component Integration

Every component that needs focus management should follow this pattern:

```typescript
import { useFocusManager } from '../../features/context/FocusContext.js';
import { useInput } from 'ink';

export function MyTab() {
  const { isFocused, exitOneLevel } = useFocusManager();
  const hasFocus = isFocused('my-panel');
  
  useInput((input, key) => {
    if (key.escape) {
      exitOneLevel();
      return;
    }
    
    // Handle other input...
  }, { isActive: hasFocus });
  
  return (
    <Box borderColor={hasFocus ? 'blue' : 'gray'}>
      {/* Component content */}
    </Box>
  );
}
```

### Modal Integration

Components that open modals should use `openModal()` and `closeModal()`:

```typescript
export function FileTree() {
  const focusManager = useFocusManager();
  const [viewerOpen, setViewerOpen] = useState(false);
  
  const openViewer = () => {
    setViewerOpen(true);
    focusManager.openModal('syntax-viewer');
  };
  
  const closeViewer = () => {
    setViewerOpen(false);
    focusManager.closeModal();
  };
  
  useInput((input, key) => {
    if (key.return) {
      openViewer();
    }
  }, { isActive: hasFocus });
  
  return (
    <>
      <FileTreeView />
      {viewerOpen && <SyntaxViewer onClose={closeViewer} />}
    </>
  );
}
```

### Tab Content Activation

The navigation bar activates tab content when Enter is pressed:

```typescript
// In TabBar component
useInput((input, key) => {
  if (key.return) {
    focusManager.activateContent(activeTab);
  }
}, { isActive: hasFocus });
```

## API Reference

### `useFocusManager()`

Hook that provides access to focus management functionality.

**Returns:** `FocusContextValue`

**Methods:**

#### `setFocus(id: FocusableId): void`

Set focus to a specific element.

```typescript
focusManager.setFocus('file-tree');
```

#### `exitOneLevel(): void`

Move focus up one level in the hierarchy. **Use this for ESC key handling.**

```typescript
useInput((input, key) => {
  if (key.escape) {
    focusManager.exitOneLevel();
  }
}, { isActive: hasFocus });
```

#### `exitToNavBar(): void`

**Deprecated.** Jump directly to navigation bar. Use `exitOneLevel()` instead for consistent hierarchical navigation.

#### `openModal(modalId: FocusableId): void`

Open a modal and track its parent for proper return navigation.

```typescript
focusManager.openModal('syntax-viewer');
```

#### `closeModal(): void`

Close the current modal and return to its parent.

```typescript
focusManager.closeModal();
```

#### `cycleFocus(direction: 'next' | 'previous'): void`

Cycle through Level 1 areas (Tab/Shift+Tab).

```typescript
// Handle Tab key
if (key.tab && !key.shift) {
  focusManager.cycleFocus('next');
}
```

#### `isFocused(id: FocusableId): boolean`

Check if a specific element is currently focused.

```typescript
const hasFocus = focusManager.isFocused('file-tree');
```

#### `getFocusLevel(id: FocusableId): number`

Get the focus level (1, 2, or 3) of a specific element.

```typescript
const level = focusManager.getFocusLevel('syntax-viewer'); // Returns 3
```

#### `activateContent(activeTab: string): void`

Activate tab content from navigation bar (called internally).

#### `setMode(mode: NavigationMode): void`

Set navigation mode ('browse' or 'active').

#### `isActive(): boolean`

Check if in active mode (Level 2+).

## Focus IDs

### Level 1: Tab Cycle

| Focus ID | Description |
|----------|-------------|
| `chat-input` | User input area |
| `chat-history` | Chat window/history |
| `nav-bar` | Navigation bar (tab selector) |
| `context-panel` | Side panel (right side) |
| `system-bar` | System status bar |

### Level 2: Tab Content

| Focus ID | Description |
|----------|-------------|
| `file-tree` | Files tab content |
| `side-file-tree` | Workspace panel in side panel |
| `functions` | Functions panel |
| `tools-panel` | Tools tab content |
| `hooks-panel` | Hooks tab content |
| `mcp-panel` | MCP tab content |
| `docs-panel` | Docs tab content |
| `settings-panel` | Settings tab content |
| `search-panel` | Search tab content |
| `github-tab` | GitHub tab content |

### Level 3: Modals & Viewers

| Focus ID | Description |
|----------|-------------|
| `syntax-viewer` | Code syntax viewer |
| `search-dialog` | File search dialog |
| `quick-open-dialog` | Quick open dialog |
| `confirmation-dialog` | Confirmation dialogs |
| `help-panel` | Help panel |
| `quick-actions-menu` | Quick actions menu |

## Common Patterns

### Pattern 1: Tab Component

```typescript
export function MyTab() {
  const { isFocused, exitOneLevel } = useFocusManager();
  const hasFocus = isFocused('my-panel');
  
  useInput((input, key) => {
    if (key.escape) {
      exitOneLevel();
      return;
    }
    // ... other input handling ...
  }, { isActive: hasFocus });
  
  return <Box>...</Box>;
}
```

### Pattern 2: Modal Component

```typescript
export function MyModal({ onClose }: { onClose: () => void }) {
  const focusManager = useFocusManager();
  const hasFocus = focusManager.isFocused('my-modal');
  
  useEffect(() => {
    focusManager.openModal('my-modal');
    return () => focusManager.closeModal();
  }, []);
  
  useInput((input, key) => {
    if (key.escape) {
      onClose();
      focusManager.closeModal();
    }
  }, { isActive: hasFocus });
  
  return <Box>...</Box>;
}
```

### Pattern 3: Nested Navigation

```typescript
export function ComplexTab() {
  const { isFocused, exitOneLevel } = useFocusManager();
  const hasFocus = isFocused('complex-panel');
  const [selectedIndex, setSelectedIndex] = useState(0);
  
  useInput((input, key) => {
    if (key.escape) {
      // Check if we're in a sub-menu
      if (selectedIndex > 0) {
        setSelectedIndex(0); // Return to main menu
      } else {
        exitOneLevel(); // Exit to nav bar
      }
      return;
    }
    
    if (key.upArrow) {
      setSelectedIndex(Math.max(0, selectedIndex - 1));
    }
    if (key.downArrow) {
      setSelectedIndex(Math.min(items.length - 1, selectedIndex + 1));
    }
  }, { isActive: hasFocus });
  
  return <Box>...</Box>;
}
```

## Best Practices

### DO ✅

1. **Use `exitOneLevel()` for ESC key handling**
   ```typescript
   if (key.escape) {
     focusManager.exitOneLevel();
   }
   ```

2. **Check focus before handling input**
   ```typescript
   useInput(handler, { isActive: hasFocus });
   ```

3. **Track modal parents with `openModal()`**
   ```typescript
   focusManager.openModal('syntax-viewer');
   ```

4. **Use visual indicators for focus state**
   ```typescript
   <Box borderColor={hasFocus ? 'blue' : 'gray'}>
   ```

5. **Follow naming conventions for focus IDs**
   - Level 2 tabs: Use `-panel` suffix (e.g., `tools-panel`)
   - Level 3 modals: Use `-dialog` or `-viewer` suffix

### DON'T ❌

1. **Don't use `exitToNavBar()` in new code**
   ```typescript
   // ❌ Avoid
   if (key.escape) {
     focusManager.exitToNavBar();
   }
   
   // ✅ Use instead
   if (key.escape) {
     focusManager.exitOneLevel();
   }
   ```

2. **Don't handle input without checking focus**
   ```typescript
   // ❌ Avoid
   useInput(handler, { isActive: true });
   
   // ✅ Use instead
   useInput(handler, { isActive: hasFocus });
   ```

3. **Don't manage modal state separately**
   ```typescript
   // ❌ Avoid
   const [modalOpen, setModalOpen] = useState(false);
   
   // ✅ Use focus manager
   focusManager.openModal('my-modal');
   ```

4. **Don't create custom focus systems**
   - Use the centralized focus manager
   - Don't implement separate focus tracking

## Testing

### Unit Tests

```typescript
import { renderHook, act } from '@testing-library/react';
import { FocusProvider, useFocusManager } from './FocusContext';

describe('FocusContext', () => {
  it('should move from Level 3 to Level 2 on exitOneLevel', () => {
    const { result } = renderHook(() => useFocusManager(), {
      wrapper: FocusProvider,
    });
    
    // Open modal from file tree
    act(() => {
      result.current.setFocus('file-tree');
      result.current.openModal('syntax-viewer');
    });
    
    expect(result.current.activeId).toBe('syntax-viewer');
    
    // Exit one level
    act(() => {
      result.current.exitOneLevel();
    });
    
    expect(result.current.activeId).toBe('file-tree');
  });
});
```

### Integration Tests

```typescript
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

describe('Focus Navigation', () => {
  it('should navigate through all levels with ESC', async () => {
    const user = userEvent.setup();
    render(<App />);
    
    // Navigate to Files tab
    await user.keyboard('{Tab}{Tab}{ArrowRight}{ArrowRight}{Enter}');
    
    // Open syntax viewer
    await user.keyboard('{Enter}');
    
    // ESC back to file tree
    await user.keyboard('{Escape}');
    expect(screen.getByTestId('file-tree')).toHaveFocus();
    
    // ESC back to nav bar
    await user.keyboard('{Escape}');
    expect(screen.getByTestId('nav-bar')).toHaveFocus();
  });
});
```

## Troubleshooting

### Issue: Component not responding to input

**Solution:** Check that `isActive` is set correctly:

```typescript
const hasFocus = focusManager.isFocused('my-panel');
useInput(handler, { isActive: hasFocus }); // ✅
```

### Issue: ESC not working as expected

**Solution:** Make sure you're using `exitOneLevel()`:

```typescript
if (key.escape) {
  focusManager.exitOneLevel(); // ✅ Not exitToNavBar()
}
```

### Issue: Modal not returning to parent

**Solution:** Use `openModal()` when opening:

```typescript
focusManager.openModal('my-modal'); // ✅ Tracks parent
```

### Issue: Focus stuck in a component

**Solution:** Ensure ESC handler is implemented:

```typescript
useInput((input, key) => {
  if (key.escape) {
    focusManager.exitOneLevel();
    return; // ✅ Important: return after handling
  }
}, { isActive: hasFocus });
```

## Migration Guide

### Updating from `exitToNavBar()` to `exitOneLevel()`

**Before:**
```typescript
useInput((input, key) => {
  if (key.escape) {
    focusManager.exitToNavBar();
  }
}, { isActive: hasFocus });
```

**After:**
```typescript
useInput((input, key) => {
  if (key.escape) {
    focusManager.exitOneLevel();
  }
}, { isActive: hasFocus });
```

**Why:** `exitOneLevel()` provides consistent hierarchical navigation, while `exitToNavBar()` jumps directly to the nav bar, breaking the hierarchy.

## Related Documentation

- [Navigation System Audit](.dev/audits/navigation-system-audit.md)
- [Focus Management Audit](.dev/audits/focus-management-audit.md)
- [Hierarchical Focus Implementation](.dev/debugigng/22-01-2026/HIERARCHICAL-FOCUS-IMPLEMENTATION.md)
- [Final Navigation Spec](.dev/debugigng/22-01-2026/FINAL-NAVIGATION-SPEC.md)

## Contributing

When adding new focusable elements:

1. Add the focus ID to `FocusableId` type in `FocusContext.tsx`
2. Add the ID to the appropriate level array (`LEVEL_1_IDS`, `LEVEL_2_IDS`, or `LEVEL_3_IDS`)
3. Update the `tabToFocusMap` in `activateContent()` if it's a tab
4. Document the new focus ID in this README
5. Add tests for the new focus behavior

## License

MIT
