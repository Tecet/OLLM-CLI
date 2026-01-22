# Window System

## Overview

The Window System manages multiple windows (Chat, Terminal, Editor) within the main content area of the OLLM CLI. It provides a unified interface for switching between different views while maintaining consistent navigation and focus management.

## Architecture

### Components

1. **WindowContext** (`WindowContext.tsx`)
   - Centralized state management for active window
   - Provides hooks for accessing and modifying window state
   - Supports three window types: `chat`, `terminal`, `editor`

2. **WindowSwitcher** (`../components/WindowSwitcher.tsx`)
   - Visual indicator showing which window is active
   - Displays dots representing each window
   - Highlights the active window

3. **ChatTab** (`../components/tabs/ChatTab.tsx`)
   - Main container that renders different windows
   - Integrates WindowSwitcher for visual feedback
   - Handles window-specific content rendering

### Window Types

| Window Type | Description | Primary Use Case |
|-------------|-------------|------------------|
| `chat` | Message history and AI responses | Main interaction with LLM |
| `terminal` | Interactive command-line interface | Execute shell commands |
| `editor` | Code editor with syntax highlighting | Edit files directly |

## Usage

### Basic Setup

```tsx
import { WindowProvider, useWindow } from './contexts/WindowContext';

function App() {
  return (
    <WindowProvider>
      <YourComponents />
    </WindowProvider>
  );
}
```

### Accessing Window State

```tsx
function MyComponent() {
  const { 
    activeWindow,      // Current window: 'chat' | 'terminal' | 'editor'
    setActiveWindow,   // Set window directly
    switchWindow,      // Cycle through windows
    isChatActive,      // Convenience flags
    isTerminalActive,
    isEditorActive
  } = useWindow();

  return (
    <Box>
      <Text>Active: {activeWindow}</Text>
      {isChatActive && <ChatContent />}
      {isTerminalActive && <TerminalContent />}
      {isEditorActive && <EditorContent />}
    </Box>
  );
}
```

### Switching Windows

```tsx
// Direct switch
setActiveWindow('terminal');

// Cycle through windows (chat -> terminal -> editor -> chat)
switchWindow();
```

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Left` | Switch to previous window |
| `Ctrl+Right` | Switch to next window |

These shortcuts are handled globally in `App.tsx` and work regardless of which component has focus.

## Integration with Focus Management

The Window System integrates with the Focus Management system to ensure proper keyboard navigation:

1. **Focus ID**: All windows share the `chat-history` focus ID
2. **Focus Detection**: The active window receives focus events
3. **Navigation**: Tab/Shift+Tab cycles through focus areas, ESC exits to nav bar

### Focus Flow

```
User Input (chat-input)
    ↓ Tab
Chat Window (chat-history) ← Window switching happens here
    ↓ Tab
Nav Bar (nav-bar)
    ↓ Tab
Side Panel (context-panel)
    ↓ Tab
User Input (chat-input)
```

## Implementation Details

### Window Rendering

The ChatTab component handles window rendering:

```tsx
<Box>
  {/* Window Switcher - visual indicator */}
  <WindowSwitcher />
  
  {/* Render active window */}
  {activeWindow === 'chat' && <ChatHistory ... />}
  {activeWindow === 'terminal' && <Terminal ... />}
  {activeWindow === 'editor' && <EditorMockup ... />}
</Box>
```

### State Management

Window state is managed in WindowContext:

```tsx
const [activeWindow, setActiveWindow] = useState<WindowType>('chat');

const switchWindow = useCallback(() => {
  setActiveWindow(prev => {
    if (prev === 'chat') return 'terminal';
    if (prev === 'terminal') return 'editor';
    return 'chat';
  });
}, []);
```

## Design Decisions

### Why Not Use Z-Index Overlays?

**Previous Approach (Removed):**
- Terminal and Editor were rendered as overlays using z-index
- This caused the navbar to be covered
- Led to inconsistent visual hierarchy

**Current Approach:**
- All windows render in the same container
- Only the active window is rendered at a time
- Navbar always remains visible
- Consistent visual hierarchy

### Why Three Windows?

The three-window design supports common development workflows:

1. **Chat**: Primary interaction with AI
2. **Terminal**: Execute commands suggested by AI
3. **Editor**: Edit files based on AI suggestions

This allows quick switching between related tasks without leaving the application.

### Why Cycle Instead of Direct Selection?

**Cycling (Current):**
- Simple keyboard shortcuts (Ctrl+Left/Right)
- Predictable navigation pattern
- Works well with 3 windows

**Direct Selection (Future Enhancement):**
- Could add Ctrl+1/2/3 for direct window selection
- More efficient for frequent switching
- Requires more keyboard shortcuts

## Future Enhancements

### Planned Features

1. **Window Container Component**
   - Reusable container for multiple windows
   - Support for custom window configurations
   - Independent state per container
   - See: `.kiro/specs/window-container-refactor/`

2. **Right Panel Windows**
   - Apply window system to side panel
   - Independent window switching
   - Separate keyboard shortcuts (Ctrl+Shift+Left/Right)

3. **Input Routing**
   - Link input to specific window
   - Visual indicator (green border)
   - Keyboard shortcuts (Ctrl+Up/Down)

4. **Window State Persistence**
   - Save active window to settings
   - Restore on startup
   - Per-workspace preferences

### Potential Improvements

- Add window titles to switcher
- Support custom window types via plugins
- Add window-specific keyboard shortcuts
- Implement window history (back/forward)
- Add window split views

## Troubleshooting

### Window Not Switching

**Problem:** Keyboard shortcuts don't switch windows

**Solutions:**
1. Check if focus is on the correct element (`chat-history`)
2. Verify WindowProvider is in component tree
3. Check keyboard shortcut configuration in keybinds

### Visual Indicator Not Updating

**Problem:** WindowSwitcher shows wrong active window

**Solutions:**
1. Verify WindowContext state is updating
2. Check if WindowSwitcher is receiving correct props
3. Ensure theme is properly configured

### Content Not Rendering

**Problem:** Window content doesn't appear

**Solutions:**
1. Check if window type is valid (`chat`, `terminal`, `editor`)
2. Verify component imports are correct
3. Check console for rendering errors

## Related Documentation

- [Focus Management](./../features/context/FOCUS_SYSTEM_README.md)
- [Navigation System](./../../.dev/FINAL-NAVIGATION-SPEC.md)
- [Window Container Refactor](./../../.kiro/specs/window-container-refactor/)
- [Keyboard Shortcuts](./../../docs/Hooks/Keyboard-Shortcuts.md)

## Contributing

When modifying the window system:

1. **Maintain Backward Compatibility**: Don't break existing window switching
2. **Update Documentation**: Keep this README in sync with code changes
3. **Add Tests**: Write unit tests for new window types or features
4. **Follow Patterns**: Use existing patterns for consistency
5. **Comment Complex Logic**: Add inline comments for non-obvious code

## Examples

### Adding a New Window Type

```tsx
// 1. Update WindowType in WindowContext.tsx
export type WindowType = 'chat' | 'terminal' | 'editor' | 'browser';

// 2. Update switchWindow logic
const switchWindow = useCallback(() => {
  setActiveWindow(prev => {
    if (prev === 'chat') return 'terminal';
    if (prev === 'terminal') return 'editor';
    if (prev === 'editor') return 'browser';
    return 'chat';
  });
}, []);

// 3. Add convenience flag
const value: WindowContextValue = {
  // ... existing properties
  isBrowserActive: activeWindow === 'browser',
};

// 4. Update ChatTab to render new window
{activeWindow === 'browser' && <BrowserComponent />}

// 5. Update WindowSwitcher for 4 dots
<DotIndicator total={4} active={activeIndex} theme={theme} />
```

### Custom Window Switching Logic

```tsx
function MyComponent() {
  const { setActiveWindow } = useWindow();
  
  // Switch based on custom logic
  const handleCustomSwitch = () => {
    const hour = new Date().getHours();
    if (hour < 12) {
      setActiveWindow('chat');
    } else if (hour < 18) {
      setActiveWindow('terminal');
    } else {
      setActiveWindow('editor');
    }
  };
  
  return <Button onClick={handleCustomSwitch}>Smart Switch</Button>;
}
```

## Changelog

### Version 0.1.0 (January 2026)
- Initial window system implementation
- Support for Chat, Terminal, Editor windows
- Integration with focus management
- Keyboard shortcuts for window switching
- Visual indicator (WindowSwitcher)
- Comprehensive documentation

### Cleanup (January 2026)
- Removed Terminal/Editor overlay special cases from App.tsx
- Consolidated window rendering in ChatTab
- Added comprehensive comments to WindowContext
- Created this README documentation
- Improved code organization and maintainability
