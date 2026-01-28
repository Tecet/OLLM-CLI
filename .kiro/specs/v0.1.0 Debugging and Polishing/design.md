# Debugging and Polishing - Design Document

**Version**: 1.0.0  
**Status**: 📋 Planning  
**Created**: January 22, 2026

## Overview

This document outlines the design principles, patterns, and strategies for cleaning up and polishing the OLLM CLI codebase. It serves as a reference for maintaining code quality and consistency throughout the cleanup process.

## Navigation Pattern (Canonical Reference)

### Hierarchical Navigation Model

The application uses a 3-level hierarchical navigation system:

```
Level 1: Top-Level Navigation
├── User Input (chat-input)
├── Chat Window (chat-history)
├── Nav Bar (nav-bar)
└── Side Panel (context-panel)

Level 2: Tab Content
├── Chat Tab Content
├── Tools Tab Content
├── Hooks Tab Content
├── Files Tab Content (File Explorer)
├── Search Tab Content
├── Docs Tab Content
├── GitHub Tab Content
├── MCP Tab Content
└── Settings Tab Content

Level 3: Modals/Dialogs
├── Confirmation Dialogs
├── Search Dialogs
├── Input Dialogs
└── Menu Overlays
```

### Navigation Keys

#### Tab Key (Cycle Forward)

```
User Input → Chat Window → Nav Bar → Side Panel → User Input
```

#### Shift+Tab (Cycle Backward)

```
User Input ← Chat Window ← Nav Bar ← Side Panel ← User Input
```

#### ESC Key (Hierarchical Up)

```
Level 3 (Modal) → ESC → Level 2 (Tab Content)
Level 2 (Tab Content) → ESC → Level 1 (Nav Bar)
Level 1 (Nav Bar) → 1st ESC → Switch to Chat tab in navbar
Level 1 (Nav Bar) → 2nd ESC → User Input
```

#### Enter Key (Activate/Go Deeper)

```
Nav Bar → Enter → Activate selected tab content
Tab Content → Enter → Activate focused element
```

### Focus IDs (Canonical List)

**Level 1 Focus IDs:**

- `chat-input` - User input area
- `chat-history` - Main chat/window area (Chat, Terminal, Editor)
- `nav-bar` - Top navigation bar
- `context-panel` - Right side panel
- `side-file-tree` - File tree in side panel
- `functions` - Functions panel

**Level 2 Focus IDs (Tab-Specific):**

- `file-tree` - File explorer tree view
- `file-search` - File search dialog
- `tools-list` - Tools tab list
- `hooks-list` - Hooks tab list
- `mcp-servers` - MCP servers list
- `search-input` - Search tab input
- `docs-viewer` - Docs tab viewer
- `github-repos` - GitHub tab repos
- `settings-form` - Settings tab form

**Level 3 Focus IDs (Modals):**

- `confirmation-dialog` - Confirmation dialogs
- `input-dialog` - Input dialogs
- `menu-overlay` - Menu overlays

### Navigation Rules

1. **Tab Cycling**: Always cycles through Level 1 only
2. **ESC Hierarchy**: Always goes up one level
3. **Enter Activation**: Always goes down one level (activates)
4. **Focus Persistence**: Focus returns to last active element when returning to a level
5. **Modal Priority**: Modals (Level 3) always capture focus first
6. **Bubbling**: ESC bubbles up if not handled at current level

## Code Quality Standards

### Documentation Standards

#### JSDoc Comments

All public functions must have JSDoc comments:

````typescript
/**
 * Switches to the next window in the container
 *
 * @param containerId - The ID of the window container
 * @param direction - Direction to switch ('next' or 'prev')
 * @returns The new active window ID
 *
 * @example
 * ```typescript
 * switchContainerWindow('main-window', 'next');
 * ```
 */
function switchContainerWindow(containerId: string, direction: 'next' | 'prev'): string {
  // Implementation
}
````

#### Inline Comments

Complex logic must have explanatory comments:

```typescript
// Calculate content height by subtracting indicator height
// This ensures the window content doesn't overflow the container
const indicatorHeight = showIndicator ? 1 : 0;
const contentHeight = height - indicatorHeight;
```

#### Architecture Comments

Major architectural decisions must be documented:

```typescript
/**
 * Window Container Architecture
 *
 * This component uses a unified container pattern to manage multiple windows
 * (Chat, Terminal, Editor) without z-index issues. The key design decisions:
 *
 * 1. Single rendering path - no special cases or overlays
 * 2. Container-scoped state - each container manages its own windows
 * 3. Visual indicators - dots show active window
 * 4. Input routing - manual linking controls which window receives input
 *
 * See: .kiro/specs/window-container-refactor/design.md
 */
```

### Naming Conventions

#### Files

- Components: `PascalCase.tsx` (e.g., `WindowContainer.tsx`)
- Services: `camelCase.ts` (e.g., `contextManager.ts`)
- Hooks: `useCamelCase.ts` (e.g., `useWindowContainer.ts`)
- Types: `types.ts` or `PascalCase.types.ts`
- Tests: `*.test.ts` or `*.test.tsx`

#### Functions

- Components: `PascalCase` (e.g., `WindowContainer`)
- Hooks: `useCamelCase` (e.g., `useWindowContainer`)
- Utilities: `camelCase` (e.g., `switchContainerWindow`)
- Event handlers: `handleCamelCase` (e.g., `handleWindowChange`)

#### Variables

- Constants: `UPPER_SNAKE_CASE` (e.g., `MAX_WINDOWS`)
- Regular: `camelCase` (e.g., `activeWindowId`)
- Private: `_camelCase` (e.g., `_internalState`)
- Boolean: `isCamelCase` or `hasCamelCase` (e.g., `isActive`, `hasError`)

#### Types/Interfaces

- Interfaces: `PascalCase` (e.g., `WindowContainerProps`)
- Types: `PascalCase` (e.g., `WindowType`)
- Enums: `PascalCase` (e.g., `FocusLevel`)

### File Structure

```
packages/cli/src/ui/
├── components/
│   ├── layout/           # Layout components (WindowContainer, SidePanel)
│   ├── tabs/             # Tab components (ChatTab, ToolsTab)
│   ├── dialogs/          # Dialog components
│   ├── windows/          # Window wrapper components
│   └── [feature]/        # Feature-specific components
├── contexts/             # React contexts
├── hooks/                # Custom hooks
├── services/             # UI services
├── utils/                # Utility functions
└── App.tsx               # Main app component
```

### Import Order

```typescript
// 1. External dependencies
import { useState, useCallback } from 'react';
import { Box, Text } from 'ink';

// 2. Internal dependencies (absolute imports)
import { useUI } from '../features/context/UIContext.js';
import { useWindow } from './contexts/WindowContext.js';

// 3. Types
import type { Theme, WindowConfig } from '../config/types.js';

// 4. Relative imports
import { WindowIndicator } from './WindowIndicator.js';
```

## Cleanup Opportunities

### 1. Window System Cleanup

**Current Issues:**

- Terminal/Editor use special cases in `renderActiveTab()`
- WindowSwitcher duplicated in ChatTab
- Inconsistent rendering paths
- Z-index issues with navbar

**Cleanup Strategy:**

```typescript
// BEFORE (Legacy Pattern)
const renderActiveTab = (height: number, width: number) => {
  if (activeWindow === 'terminal') {
    return <Terminal ... />; // OVERLAY - covers navbar
  }
  if (activeWindow === 'editor') {
    return <EditorMockup ... />; // OVERLAY - covers navbar
  }
  switch (uiState.activeTab) {
    case 'chat':
      return <ChatTab showWindowSwitcher={true} ... />;
  }
};

// AFTER (Clean Pattern)
const renderActiveTab = (height: number, width: number) => {
  switch (uiState.activeTab) {
    case 'chat':
      return (
        <WindowContainer
          containerId="main-window"
          windows={[
            { id: 'chat', label: 'Chat', component: ChatWindow },
            { id: 'terminal', label: 'Terminal', component: TerminalWindow },
            { id: 'editor', label: 'Editor', component: EditorWindow },
          ]}
          activeWindowId={activeWindow}
          onWindowChange={setActiveWindow}
          height={height}
          width={width}
          showIndicator={true}
          hasFocus={focusManager.isFocused('chat-history')}
          theme={uiState.theme}
        />
      );
  }
};
```

**Files to Clean:**

- `packages/cli/src/ui/App.tsx` - Remove special cases
- `packages/cli/src/ui/components/tabs/ChatTab.tsx` - Remove WindowSwitcher
- `packages/cli/src/ui/components/WindowSwitcher.tsx` - Mark as deprecated

### 2. Focus Management Cleanup

**Current Issues:**

- Duplicate focus logic across components
- Unused focus IDs
- Inconsistent focus detection
- Missing focus documentation

**Cleanup Strategy:**

```typescript
// BEFORE (Duplicate Pattern)
// In ChatTab.tsx
useInput(
  (input, key) => {
    if (key.escape) {
      focusManager.exitOneLevel();
    }
  },
  { isActive: hasFocus }
);

// In ToolsTab.tsx
useInput(
  (input, key) => {
    if (key.escape) {
      focusManager.exitOneLevel();
    }
  },
  { isActive: hasFocus }
);

// AFTER (Consolidated Pattern)
// In shared hook: useTabNavigation.ts
export function useTabNavigation(hasFocus: boolean) {
  useInput(
    (input, key) => {
      if (key.escape) {
        focusManager.exitOneLevel();
      }
    },
    { isActive: hasFocus }
  );
}

// In each tab
useTabNavigation(hasFocus);
```

**Files to Clean:**

- `packages/cli/src/features/context/FocusContext.tsx` - Remove unused focus IDs
- All tab components - Consolidate focus logic
- Create `packages/cli/src/ui/hooks/useTabNavigation.ts` - Shared hook

### 3. Navigation System Cleanup

**Current Issues:**

- Keyboard shortcut handling scattered
- Duplicate ESC handlers
- Inconsistent navigation levels
- Missing navigation documentation

**Cleanup Strategy:**

```typescript
// BEFORE (Scattered Pattern)
// In App.tsx
useInput((input, key) => {
  if (isKey(input, key, 'ctrl+1')) handleTabSwitch('chat');
  if (isKey(input, key, 'ctrl+2')) handleTabSwitch('tools');
  // ... many more shortcuts
});

// In ChatTab.tsx
useInput((input, key) => {
  if (key.escape) {
    /* handle */
  }
});

// In ToolsTab.tsx
useInput((input, key) => {
  if (key.escape) {
    /* handle */
  }
});

// AFTER (Consolidated Pattern)
// In useGlobalKeyboardShortcuts.ts
export function useGlobalKeyboardShortcuts() {
  const shortcuts = useKeybinds();

  useInput(
    (input, key) => {
      // Tab navigation
      if (isKey(input, key, shortcuts.tabNavigation.tabChat)) handleTabSwitch('chat');
      if (isKey(input, key, shortcuts.tabNavigation.tabTools)) handleTabSwitch('tools');
      // ... all shortcuts in one place
    },
    { isActive: true }
  );
}

// In useTabEscapeHandler.ts
export function useTabEscapeHandler(hasFocus: boolean) {
  const focusManager = useFocusManager();

  useInput(
    (input, key) => {
      if (key.escape) {
        focusManager.exitOneLevel();
      }
    },
    { isActive: hasFocus }
  );
}
```

**Files to Clean:**

- `packages/cli/src/ui/App.tsx` - Extract keyboard shortcuts to hook
- Create `packages/cli/src/ui/hooks/useGlobalKeyboardShortcuts.ts`
- Create `packages/cli/src/ui/hooks/useTabEscapeHandler.ts`
- All tab components - Use shared hooks

### 4. Context Management Cleanup

**Current Issues:**

- Unused compression strategies
- Complex snapshot logic
- Missing JSDoc comments
- Unclear compression algorithm

**Cleanup Strategy:**

```typescript
// BEFORE (Unclear Pattern)
export class CompressionService {
  compress(content: string) {
    // Complex logic with no comments
    const chunks = this.splitIntoChunks(content);
    const compressed = chunks.map((c) => this.compressChunk(c));
    return compressed.join('');
  }
}

// AFTER (Documented Pattern)
export class CompressionService {
  /**
   * Compresses content using a sliding window algorithm
   *
   * Algorithm:
   * 1. Split content into semantic chunks (by message boundaries)
   * 2. Compress each chunk independently
   * 3. Preserve recent messages (last 10) without compression
   * 4. Summarize older messages using LLM
   *
   * @param content - The content to compress
   * @returns Compressed content with preserved structure
   */
  compress(content: string): string {
    // Split content into semantic chunks (by message boundaries)
    const chunks = this.splitIntoChunks(content);

    // Compress each chunk independently
    const compressed = chunks.map((chunk) => this.compressChunk(chunk));

    // Join compressed chunks
    return compressed.join('');
  }

  /**
   * Splits content into semantic chunks at message boundaries
   * This preserves message structure for better compression
   */
  private splitIntoChunks(content: string): string[] {
    // Implementation with comments
  }
}
```

**Files to Clean:**

- `packages/core/src/context/compressionService.ts` - Add JSDoc and comments
- `packages/core/src/context/snapshotManager.ts` - Document snapshot logic
- `packages/core/src/context/contextManager.ts` - Add architecture comments

### 5. Provider System Cleanup

**Current Issues:**

- Unused provider methods
- Inconsistent error handling
- Missing type documentation
- Unclear provider lifecycle

**Cleanup Strategy:**

````typescript
// BEFORE (Unclear Pattern)
export interface ProviderAdapter {
  chatStream(request: ProviderRequest): AsyncIterable<ProviderEvent>;
  countTokens?(text: string): number;
  listModels?(): Promise<string[]>;
}

// AFTER (Documented Pattern)
/**
 * Provider Adapter Interface
 *
 * Defines the contract for LLM provider implementations. All providers
 * must implement chatStream, while other methods are optional.
 *
 * Lifecycle:
 * 1. Provider instantiated with config
 * 2. chatStream called for each request
 * 3. Events streamed back to caller
 * 4. Provider cleaned up on app exit
 *
 * @example
 * ```typescript
 * const provider = new LocalProvider({ baseUrl: 'http://localhost:11434' });
 * for await (const event of provider.chatStream(request)) {
 *   console.log(event);
 * }
 * ```
 */
export interface ProviderAdapter {
  /**
   * Streams chat responses from the LLM
   *
   * @param request - The chat request with messages and options
   * @returns Async iterable of provider events (text, tool_call, finish)
   * @throws {ProviderError} If the provider encounters an error
   */
  chatStream(request: ProviderRequest): AsyncIterable<ProviderEvent>;

  /**
   * Counts tokens in the given text (optional)
   *
   * @param text - The text to count tokens for
   * @returns The number of tokens, or undefined if not supported
   */
  countTokens?(text: string): number;

  /**
   * Lists available models (optional)
   *
   * @returns Array of model names, or undefined if not supported
   */
  listModels?(): Promise<string[]>;
}
````

**Files to Clean:**

- `packages/core/src/provider/types.ts` - Add comprehensive JSDoc
- `packages/ollm-bridge/src/provider/localProvider.ts` - Document lifecycle
- Add `packages/core/src/provider/README.md` - Provider development guide

## Refactoring Strategies

### Strategy 1: Extract Shared Hooks

**Pattern**: When multiple components have similar logic, extract to shared hook

**Example**:

```typescript
// Before: Duplicated in ChatTab, ToolsTab, HooksTab
useInput(
  (input, key) => {
    if (key.escape) {
      if (dialogOpen) {
        closeDialog();
      } else {
        focusManager.exitOneLevel();
      }
    }
  },
  { isActive: hasFocus }
);

// After: Shared hook
export function useDialogEscape(hasFocus: boolean, dialogOpen: boolean, closeDialog: () => void) {
  const focusManager = useFocusManager();

  useInput(
    (input, key) => {
      if (key.escape) {
        if (dialogOpen) {
          closeDialog();
        } else {
          focusManager.exitOneLevel();
        }
      }
    },
    { isActive: hasFocus }
  );
}
```

### Strategy 2: Consolidate Error Handling

**Pattern**: Use consistent error handling patterns across the codebase

**Example**:

```typescript
// Before: Inconsistent error handling
try {
  await saveFile(path, content);
} catch (err) {
  console.error(err);
}

try {
  await loadFile(path);
} catch (error) {
  showError(error.message);
}

// After: Consistent error handling
try {
  await saveFile(path, content);
} catch (error) {
  handleFileError(error, 'save', path);
}

try {
  await loadFile(path);
} catch (error) {
  handleFileError(error, 'load', path);
}

// Centralized error handler
function handleFileError(error: unknown, operation: string, path: string) {
  const message = error instanceof Error ? error.message : 'Unknown error';
  logger.error(`Failed to ${operation} file: ${path}`, { error: message });
  showError(`Failed to ${operation} file: ${message}`);
}
```

### Strategy 3: Memoize Expensive Computations

**Pattern**: Use React.memo and useMemo for expensive operations

**Example**:

```typescript
// Before: Re-computes on every render
function WindowContainer(props: WindowContainerProps) {
  const windows = [
    { id: 'chat', label: 'Chat', component: ChatWindow },
    { id: 'terminal', label: 'Terminal', component: TerminalWindow },
    { id: 'editor', label: 'Editor', component: EditorWindow },
  ];

  return <Box>{/* render */}</Box>;
}

// After: Memoized
function WindowContainer(props: WindowContainerProps) {
  const windows = useMemo(() => [
    { id: 'chat', label: 'Chat', component: ChatWindow },
    { id: 'terminal', label: 'Terminal', component: TerminalWindow },
    { id: 'editor', label: 'Editor', component: EditorWindow },
  ], []);

  return <Box>{/* render */}</Box>;
}

// Component memoization
export const WindowContainer = React.memo(function WindowContainer(props) {
  // Implementation
});
```

### Strategy 4: Simplify Complex Conditionals

**Pattern**: Extract complex conditionals to named functions

**Example**:

```typescript
// Before: Complex inline conditional
if (
  (activeWindow === 'terminal' && focusManager.isFocused('chat-history')) ||
  (activeWindow === 'editor' && focusManager.isFocused('chat-history')) ||
  (activeWindow === 'chat' && focusManager.isFocused('chat-history'))
) {
  // Do something
}

// After: Named function
function isMainWindowFocused(): boolean {
  return focusManager.isFocused('chat-history');
}

if (isMainWindowFocused()) {
  // Do something
}
```

### Strategy 5: Remove Dead Code

**Pattern**: Identify and remove unused code

**Checklist**:

- [ ] Search for unused exports (ESLint can help)
- [ ] Remove commented-out code
- [ ] Remove unused imports
- [ ] Remove unused variables
- [ ] Remove unused functions
- [ ] Remove unused types

**Tools**:

```bash
# Find unused exports
npx ts-prune

# Find unused imports
npx eslint . --fix

# Find dead code
npx knip
```

## Performance Optimization Patterns

### Pattern 1: Virtual Scrolling

For large lists (file tree, chat history):

```typescript
// Only render visible items
const visibleItems = items.slice(scrollOffset, scrollOffset + visibleCount);
```

### Pattern 2: Debouncing

For expensive operations triggered by user input:

```typescript
const debouncedSearch = useMemo(() => debounce((query: string) => performSearch(query), 300), []);
```

### Pattern 3: Lazy Loading

For heavy components:

```typescript
const CodeEditor = lazy(() => import('./components/code-editor/CodeEditor'));
```

### Pattern 4: Cleanup in useEffect

Prevent memory leaks:

```typescript
useEffect(() => {
  const subscription = observable.subscribe(handler);

  return () => {
    subscription.unsubscribe();
  };
}, [observable]);
```

## Testing Patterns

### Unit Test Pattern

```typescript
describe('WindowContainer', () => {
  it('should render active window only', () => {
    const { getByText } = render(
      <WindowContainer
        windows={mockWindows}
        activeWindowId="chat"
        {...mockProps}
      />
    );

    expect(getByText('Chat Content')).toBeInTheDocument();
    expect(queryByText('Terminal Content')).not.toBeInTheDocument();
  });
});
```

### Integration Test Pattern

```typescript
describe('Window Switching', () => {
  it('should switch windows with Ctrl+Right', async () => {
    const { user } = renderApp();

    // Start on chat window
    expect(screen.getByText('Chat')).toHaveClass('active');

    // Press Ctrl+Right
    await user.keyboard('{Control>}{ArrowRight}{/Control}');

    // Should switch to terminal
    expect(screen.getByText('Terminal')).toHaveClass('active');
  });
});
```

### Property-Based Test Pattern

```typescript
import fc from 'fast-check';

describe('Context Compression', () => {
  it('should preserve message count', () => {
    fc.assert(
      fc.property(fc.array(fc.string(), { minLength: 1, maxLength: 100 }), (messages) => {
        const compressed = compressMessages(messages);
        const decompressed = decompressMessages(compressed);

        expect(decompressed.length).toBe(messages.length);
      })
    );
  });
});
```

## Success Metrics

### Code Quality Metrics

- Test coverage > 80%
- TypeScript strict mode compliance
- Zero ESLint errors
- Zero ESLint warnings
- All public APIs documented

### Performance Metrics

- UI operations < 100ms
- Memory usage stable over time
- No memory leaks
- Efficient re-rendering
- Fast startup time

### Maintainability Metrics

- Consistent naming conventions
- Consistent file structure
- Consistent error handling
- Comprehensive documentation
- Clear architecture

## Migration Path

### Phase 1: Audit (Week 1)

1. Create audit documents for each module
2. Identify cleanup opportunities
3. Prioritize by severity
4. Document findings

### Phase 2: Cleanup (Week 2)

1. Remove dead code
2. Consolidate duplicates
3. Add documentation
4. Update tests

### Phase 3: Optimize (Week 3)

1. Profile performance
2. Fix bottlenecks
3. Eliminate memory leaks
4. Measure improvements

### Phase 4: Polish (Week 4)

1. Ensure consistency
2. Fill test gaps
3. Final review
4. Documentation update

## Conclusion

This design document serves as the canonical reference for code quality, navigation patterns, and cleanup strategies. All cleanup work should follow these patterns and standards to ensure consistency and maintainability.

## References

- Navigation Spec: `.dev/FINAL-NAVIGATION-SPEC.md`
- Focus Hierarchy: `.dev/HIERARCHICAL-FOCUS-IMPLEMENTATION.md`
- Window Container Spec: `.kiro/specs/window-container-refactor/`
- ESLint Config: `eslint.config.js`
- TypeScript Config: `tsconfig.base.json`
