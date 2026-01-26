# Window System Audit

**Date**: January 22, 2026  
**Auditor**: Kiro AI  
**Status**: Complete  
**Related Spec**: `.kiro/specs/window-container-refactor/`

## Executive Summary

The window system currently uses a **legacy pattern with special cases** for Terminal and Editor windows that bypass the normal tab rendering flow. This creates z-index issues, inconsistent component hierarchy, and code duplication. A refactor to use a unified `WindowContainer` component has been designed but not yet implemented.

### Key Findings

- ✅ **Working**: Window switching between Chat, Terminal, and Editor works
- ⚠️ **Legacy Pattern**: Terminal/Editor use overlay rendering that covers navbar
- ⚠️ **Code Duplication**: WindowSwitcher duplicated in multiple places
- ⚠️ **Inconsistent Hierarchy**: Special cases in renderActiveTab create maintenance burden
- ⚠️ **Missing Implementation**: WindowContainer component designed but not implemented
- ✅ **Good Context Management**: WindowContext is simple and functional

### Priority Issues

1. **HIGH**: Terminal/Editor overlay pattern covers navbar (z-index issues)
2. **HIGH**: Special cases in `renderActiveTab()` create maintenance burden
3. **MEDIUM**: WindowSwitcher duplicated in ChatTab and App.tsx
4. **MEDIUM**: WindowContainer component not implemented (design exists)
5. **LOW**: WindowContext could be extended for multi-container support

---

## File Analysis

### 1. App.tsx - renderActiveTab Function

**Location**: `packages/cli/src/ui/App.tsx` (lines 800-950)

#### Current Implementation

```typescript
const renderActiveTab = (height: number, width: number) => {
  const content = (() => {
    // LEGACY PATTERN: Terminal overlay
    if (activeWindow === 'terminal') {
      const isTerminalFocused = focusManager.isFocused('chat-input') || 
                                focusManager.isFocused('chat-history');
      return (
        <Box 
          height={height} 
          width={width}
          borderStyle={uiState.theme.border.style as BoxProps['borderStyle']} 
          borderColor={isTerminalFocused ? uiState.theme.border.active : uiState.theme.border.primary} 
          flexDirection="column"
          overflow="hidden"
        >
          <Box width="100%" flexShrink={0} flexDirection="row" justifyContent="flex-end" paddingRight={1}>
            <WindowSwitcher />
          </Box>
          <Box flexGrow={1} width="100%">
            <Terminal height={height - 2} />
          </Box>
        </Box>
      );
    }

    // LEGACY PATTERN: Editor overlay
    if (activeWindow === 'editor') {
      const isEditorFocused = focusManager.isFocused('chat-history');
      return (
        <Box 
          height={height} 
          width={width}
          borderStyle={uiState.theme.border.style as BoxProps['borderStyle']} 
          borderColor={isEditorFocused ? uiState.theme.border.active : uiState.theme.border.primary}
          flexDirection="column"
          overflow="hidden"
        >
          <Box width="100%" flexShrink={0} flexDirection="row" justifyContent="flex-end" paddingRight={1}>
            <WindowSwitcher />
          </Box>
          <Box flexGrow={1} width="100%">
            <EditorMockup width={width - 2} height={height - 3} />
          </Box>
        </Box>
      );
    }

    // Normal tab rendering
    switch (uiState.activeTab) {
      case 'chat':
        return (
          <ChatTab
            height={height}
            showBorder={true}
            showWindowSwitcher={true}  // DUPLICATION
            metricsConfig={{...}}
            reasoningConfig={{...}}
            columnWidth={width}
          />
        );
      case 'tools':
        return <ToolsTab width={width} />;
      // ... other tabs
    }
  })();

  return (
    <Box width={width} height={height}>
      {content}
    </Box>
  );
};
```

#### Issues Identified

1. **Special Case Rendering** (Lines 805-850)
   - Terminal and Editor bypass normal tab rendering
   - Creates inconsistent component hierarchy
   - Causes z-index issues with navbar
   - **Impact**: HIGH - Architectural problem

2. **Code Duplication** (Lines 815, 835, 860)
   - WindowSwitcher rendered in 3 places:
     - Terminal overlay (line 815)
     - Editor overlay (line 835)
     - ChatTab (line 860 via prop)
   - **Impact**: MEDIUM - Maintenance burden

3. **Inconsistent Border Logic**
   - Terminal checks `chat-input` OR `chat-history` for focus
   - Editor only checks `chat-history`
   - ChatTab has its own border logic
   - **Impact**: LOW - Minor inconsistency

4. **Height Calculation Inconsistency**
   - Terminal: `height - 2`
   - Editor: `height - 3`
   - ChatTab: uses full `height`
   - **Impact**: LOW - Visual inconsistency

#### Unused Code

- None identified (all code is actively used)

#### Optimization Opportunities

1. **Consolidate to WindowContainer Pattern**
   - Replace special cases with unified container
   - Single rendering path for all windows
   - Consistent border and focus logic
   - **Benefit**: Cleaner architecture, easier maintenance

2. **Memoize Window Configurations**
   - Window configs could be memoized
   - Prevent unnecessary re-renders
   - **Benefit**: Minor performance improvement

3. **Extract Border Logic**
   - Centralize border color calculation
   - Reuse across all windows
   - **Benefit**: Consistency, DRY principle

#### Documentation Needs

- ✅ File has good header comment explaining purpose
- ⚠️ `renderActiveTab` function lacks explanation of special cases
- ⚠️ No comment explaining why Terminal/Editor are special
- ⚠️ No reference to window-container-refactor spec

**Recommended Comments**:
```typescript
/**
 * Renders the active tab content
 * 
 * LEGACY PATTERN: Terminal and Editor use special case rendering
 * that bypasses normal tab flow. This creates z-index issues with
 * the navbar. See .kiro/specs/window-container-refactor/ for
 * planned refactor to unified WindowContainer pattern.
 * 
 * TODO: Refactor to use WindowContainer component
 */
const renderActiveTab = (height: number, width: number) => {
  // ...
};
```

---

### 2. WindowContext.tsx

**Location**: `packages/cli/src/ui/contexts/WindowContext.tsx`

#### Current Implementation

```typescript
export type WindowType = 'chat' | 'terminal' | 'editor';

interface WindowContextValue {
  activeWindow: WindowType;
  setActiveWindow: (window: WindowType) => void;
  switchWindow: () => void;
  isTerminalActive: boolean;
  isChatActive: boolean;
  isEditorActive: boolean;
}

export function WindowProvider({ children }: { children: React.ReactNode }) {
  const [activeWindow, setActiveWindow] = useState<WindowType>('chat');

  const switchWindow = useCallback(() => {
    setActiveWindow(prev => {
      if (prev === 'chat') return 'terminal';
      if (prev === 'terminal') return 'editor';
      return 'chat';
    });
  }, []);

  const value: WindowContextValue = {
    activeWindow,
    setActiveWindow,
    switchWindow,
    isTerminalActive: activeWindow === 'terminal',
    isChatActive: activeWindow === 'chat',
    isEditorActive: activeWindow === 'editor',
  };

  return (
    <WindowContext.Provider value={value}>
      {children}
    </WindowContext.Provider>
  );
}
```

#### Strengths

1. **Simple and Focused**
   - Clear single responsibility
   - Easy to understand
   - No unnecessary complexity

2. **Good API Design**
   - Convenient boolean helpers (isTerminalActive, etc.)
   - Simple switchWindow() for cycling
   - Direct setActiveWindow() for specific window

3. **Proper Error Handling**
   - useWindow() hook throws error if used outside provider
   - Good developer experience

#### Issues Identified

1. **Limited to Single Container**
   - Only manages one set of windows (main window)
   - Cannot support right panel windows
   - **Impact**: MEDIUM - Limits future extensibility

2. **Circular Switching Logic**
   - Always cycles chat → terminal → editor → chat
   - No way to go backwards
   - **Impact**: LOW - Minor UX limitation

#### Unused Code

- None identified (all exports are used)

#### Optimization Opportunities

1. **Add Container Support**
   - Extend to manage multiple containers
   - Support main window + right panel
   - **Benefit**: Enables right panel windows feature
   - **Design**: Already specified in window-container-refactor spec

2. **Add Bidirectional Switching**
   - Add `switchWindow(direction: 'next' | 'prev')`
   - Support Ctrl+Left and Ctrl+Right
   - **Benefit**: Better UX

3. **Add Window State Persistence**
   - Save active window to settings
   - Restore on app restart
   - **Benefit**: Better UX

#### Documentation Needs

- ✅ File has header comment
- ⚠️ No JSDoc on interface
- ⚠️ No JSDoc on functions
- ⚠️ No usage examples

**Recommended Documentation**:
```typescript
/**
 * Window Context
 * 
 * Manages window switching between Chat, Terminal, and Editor windows.
 * Currently supports a single container (main window). Future enhancement
 * will support multiple containers (main + right panel).
 * 
 * @see .kiro/specs/window-container-refactor/design.md
 * 
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { activeWindow, switchWindow } = useWindow();
 *   
 *   return (
 *     <Box>
 *       <Text>Active: {activeWindow}</Text>
 *       <Button onPress={switchWindow}>Switch</Button>
 *     </Box>
 *   );
 * }
 * ```
 */

/**
 * Window type - represents available windows in the container
 */
export type WindowType = 'chat' | 'terminal' | 'editor';

/**
 * Window context value provided to consumers
 */
interface WindowContextValue {
  /** Currently active window */
  activeWindow: WindowType;
  
  /** Set active window directly */
  setActiveWindow: (window: WindowType) => void;
  
  /** Cycle to next window (chat → terminal → editor → chat) */
  switchWindow: () => void;
  
  /** Convenience: true if terminal is active */
  isTerminalActive: boolean;
  
  /** Convenience: true if chat is active */
  isChatActive: boolean;
  
  /** Convenience: true if editor is active */
  isEditorActive: boolean;
}
```

---

### 3. WindowSwitcher.tsx

**Location**: `packages/cli/src/ui/components/WindowSwitcher.tsx`

#### Current Implementation

```typescript
export function WindowSwitcher() {
  const { activeWindow } = useWindow();
  const { state: uiState } = useUI();
  const { theme } = uiState;

  const activeIndex = activeWindow === 'chat' ? 0 : 
                      activeWindow === 'terminal' ? 1 : 2;

  return (
    <Box>
      <DotIndicator total={3} active={activeIndex} theme={theme} />
    </Box>
  );
}
```

#### Strengths

1. **Simple and Focused**
   - Single responsibility: show window indicator
   - No state management
   - Pure presentation component

2. **Uses Existing DotIndicator**
   - Reuses existing component
   - Consistent with other indicators

#### Issues Identified

1. **Duplicated in Multiple Places**
   - Used in App.tsx (Terminal overlay)
   - Used in App.tsx (Editor overlay)
   - Used in ChatTab (via showWindowSwitcher prop)
   - **Impact**: MEDIUM - Code duplication

2. **Hardcoded Window Count**
   - `total={3}` is hardcoded
   - Doesn't adapt if windows change
   - **Impact**: LOW - Minor inflexibility

3. **No Position Control**
   - Always renders in same position
   - No way to position left/right/top/bottom
   - **Impact**: LOW - Minor limitation

#### Unused Code

- None identified

#### Optimization Opportunities

1. **Replace with WindowIndicator**
   - New component from window-container-refactor spec
   - More flexible positioning
   - Shows window labels, not just dots
   - **Benefit**: Better UX, more information

2. **Make Window Count Dynamic**
   - Get window count from WindowContext
   - Adapt to available windows
   - **Benefit**: More flexible

#### Documentation Needs

- ✅ File has header comment
- ⚠️ No JSDoc on component
- ⚠️ No props documentation
- ⚠️ No usage examples

**Recommended Documentation**:
```typescript
/**
 * Window Switcher Component
 * 
 * Visual indicator showing active window (Chat, Terminal, or Editor).
 * Displays dots representing each window, with the active one highlighted.
 * 
 * NOTE: This component will be replaced by WindowIndicator in the
 * window-container-refactor. See .kiro/specs/window-container-refactor/
 * 
 * @deprecated Use WindowIndicator instead (when implemented)
 * 
 * @example
 * ```tsx
 * <Box>
 *   <WindowSwitcher />
 * </Box>
 * ```
 */
export function WindowSwitcher() {
  // ...
}
```

---

## Related Components

### DotIndicator.tsx

**Location**: `packages/cli/src/ui/components/layout/DotIndicator.tsx`

**Status**: ✅ Good - Reusable component used by WindowSwitcher and SidePanel

**Usage**:
- WindowSwitcher (3 dots for windows)
- SidePanel (2 dots for Tools/Workspace modes)

**No issues identified** - This is a well-designed reusable component.

---

### ChatTab.tsx

**Location**: `packages/cli/src/ui/components/tabs/ChatTab.tsx`

**Window-Related Code**:
```typescript
export interface ChatTabProps {
  // ...
  showWindowSwitcher?: boolean;  // Controls WindowSwitcher rendering
}

export function ChatTab(props: ChatTabProps) {
  // ...
  return (
    <Box>
      {props.showWindowSwitcher && (
        <Box width="100%" flexShrink={0} flexDirection="row" justifyContent="flex-end" paddingRight={1}>
          <WindowSwitcher />
        </Box>
      )}
      {/* Chat content */}
    </Box>
  );
}
```

**Issues**:
1. WindowSwitcher conditionally rendered based on prop
2. Duplicates logic from App.tsx overlays
3. Should be removed when WindowContainer is implemented

**Impact**: MEDIUM - Part of the duplication problem

---

## Dependency Analysis

### Imports

**App.tsx**:
```typescript
import { WindowProvider, useWindow } from './contexts/WindowContext.js';
import { WindowSwitcher } from './components/WindowSwitcher.js';
import { Terminal } from './components/Terminal.js';
import { EditorMockup } from './components/code-editor/EditorMockup.js';
```

**WindowSwitcher.tsx**:
```typescript
import { DotIndicator } from './layout/DotIndicator.js';
import { useWindow } from '../contexts/WindowContext.js';
import { useUI } from '../../features/context/UIContext.js';
```

**ChatTab.tsx**:
```typescript
import { WindowSwitcher } from '../WindowSwitcher.js';
```

### Dependency Graph

```
App.tsx
├── WindowContext (provides activeWindow state)
├── WindowSwitcher (visual indicator)
├── Terminal (window content)
├── EditorMockup (window content)
└── ChatTab
    └── WindowSwitcher (duplicated)

WindowSwitcher
├── WindowContext (reads activeWindow)
├── UIContext (reads theme)
└── DotIndicator (renders dots)
```

### Circular Dependencies

- None identified ✅

### Unused Imports

- None identified ✅

---

## Legacy Patterns Identified

### Pattern 1: Overlay Rendering

**Location**: App.tsx renderActiveTab()

**Description**: Terminal and Editor are rendered as overlays that bypass normal tab rendering

**Problem**:
- Covers navbar (z-index issues)
- Inconsistent with other tabs
- Special case logic

**Why It Exists**:
- Likely implemented before unified window system was designed
- Quick solution to add Terminal/Editor windows
- Never refactored to proper pattern

**Migration Path**:
- Implement WindowContainer component
- Replace special cases with WindowContainer
- Remove overlay rendering

---

### Pattern 2: Conditional WindowSwitcher

**Location**: ChatTab.tsx, App.tsx

**Description**: WindowSwitcher is conditionally rendered in multiple places

**Problem**:
- Code duplication
- Inconsistent positioning
- Hard to maintain

**Why It Exists**:
- ChatTab needs indicator when shown normally
- Overlays need indicator when shown as overlay
- No unified container to manage indicator

**Migration Path**:
- WindowContainer will include indicator
- Remove showWindowSwitcher prop from ChatTab
- Remove WindowSwitcher from overlays

---

### Pattern 3: Manual Window Switching Logic

**Location**: App.tsx global keyboard handler

**Description**: Window switching is handled by global keyboard shortcuts that directly call WindowContext methods

**Current Code**:
```typescript
// In App.tsx useInput handler
if (isKey(input, key, activeKeybinds.layout.switchWindowLeft)) {
  switchWindow();
}
```

**Problem**:
- Works, but limited to single container
- No support for right panel windows
- No bidirectional switching

**Migration Path**:
- Extend WindowContext for multi-container support
- Add container-specific switching
- Add bidirectional switching (next/prev)

---

## Optimization Opportunities

### Opportunity 1: Implement WindowContainer

**Priority**: HIGH

**Description**: Implement the WindowContainer component as designed in window-container-refactor spec

**Benefits**:
- Eliminates overlay pattern
- Fixes z-index issues
- Consistent architecture
- Reusable for right panel

**Effort**: MEDIUM (2-3 days)

**Files to Create**:
- `packages/cli/src/ui/components/layout/WindowContainer.tsx`
- `packages/cli/src/ui/components/layout/WindowIndicator.tsx`
- `packages/cli/src/ui/components/windows/ChatWindow.tsx`
- `packages/cli/src/ui/components/windows/TerminalWindow.tsx`
- `packages/cli/src/ui/components/windows/EditorWindow.tsx`

**Files to Modify**:
- `packages/cli/src/ui/App.tsx` (replace renderActiveTab special cases)
- `packages/cli/src/ui/components/tabs/ChatTab.tsx` (remove showWindowSwitcher)

---

### Opportunity 2: Extend WindowContext

**Priority**: MEDIUM

**Description**: Add multi-container support to WindowContext

**Benefits**:
- Enables right panel windows
- Better state management
- More flexible architecture

**Effort**: SMALL (1 day)

**Changes**:
```typescript
interface WindowState {
  containers: Map<string, ContainerState>;
}

interface ContainerState {
  containerId: string;
  activeWindowId: string;
  windows: string[];
}

// New methods
registerContainer(containerId, windows, initialWindow)
switchContainerWindow(containerId, direction)
setContainerWindow(containerId, windowId)
```

---

### Opportunity 3: Memoize Window Configurations

**Priority**: LOW

**Description**: Memoize window configurations to prevent unnecessary re-renders

**Benefits**:
- Minor performance improvement
- Cleaner code

**Effort**: TRIVIAL (< 1 hour)

**Example**:
```typescript
const windows = useMemo(() => [
  { id: 'chat', label: 'Chat', component: ChatWindow },
  { id: 'terminal', label: 'Terminal', component: TerminalWindow },
  { id: 'editor', label: 'Editor', component: EditorWindow },
], []);
```

---

### Opportunity 4: Add Window State Persistence

**Priority**: LOW

**Description**: Save active window to settings and restore on app restart

**Benefits**:
- Better UX
- Remembers user preference

**Effort**: SMALL (1 day)

**Implementation**:
```typescript
// Save on change
useEffect(() => {
  SettingsService.getInstance().setActiveWindow(activeWindow);
}, [activeWindow]);

// Restore on mount
const initialWindow = SettingsService.getInstance().getActiveWindow() || 'chat';
```

---

## Dead Code Analysis

### Unused Exports

**WindowContext.tsx**:
- All exports are used ✅

**WindowSwitcher.tsx**:
- All exports are used ✅

**App.tsx**:
- No window-related unused exports ✅

### Commented Code

- No commented-out window-related code found ✅

### Unreachable Code

- No unreachable window-related code found ✅

---

## Performance Analysis

### Current Performance

**Rendering**:
- Window switching triggers full re-render of active window
- No unnecessary re-renders detected
- Performance is acceptable

**Memory**:
- Only active window is rendered (good)
- Inactive windows are not mounted (good)
- No memory leaks detected

### Potential Improvements

1. **Memoize Window Components**
   - Use React.memo on window components
   - Prevent re-renders when props don't change
   - **Impact**: Minor improvement

2. **Lazy Load Window Components**
   - Use React.lazy for Terminal and Editor
   - Reduce initial bundle size
   - **Impact**: Minor improvement

3. **Optimize WindowSwitcher**
   - Memoize activeIndex calculation
   - Prevent unnecessary DotIndicator re-renders
   - **Impact**: Negligible

---

## Testing Gaps

### Unit Tests

**Missing Tests**:
- WindowContext state management
- WindowContext switchWindow() logic
- WindowSwitcher rendering
- renderActiveTab() special cases

**Recommended Tests**:
```typescript
describe('WindowContext', () => {
  it('should cycle windows correctly', () => {
    // Test chat → terminal → editor → chat
  });
  
  it('should set active window directly', () => {
    // Test setActiveWindow()
  });
  
  it('should provide correct boolean helpers', () => {
    // Test isTerminalActive, etc.
  });
});

describe('WindowSwitcher', () => {
  it('should render correct number of dots', () => {
    // Test DotIndicator receives total={3}
  });
  
  it('should highlight active window', () => {
    // Test activeIndex calculation
  });
});
```

### Integration Tests

**Missing Tests**:
- Window switching end-to-end
- Focus management with window switching
- Keyboard shortcuts for window switching
- Overlay rendering (Terminal/Editor)

**Recommended Tests**:
```typescript
describe('Window Switching Integration', () => {
  it('should switch windows with Ctrl+Right', () => {
    // Test keyboard shortcut
  });
  
  it('should update focus when switching windows', () => {
    // Test focus management integration
  });
  
  it('should render Terminal overlay correctly', () => {
    // Test Terminal special case
  });
});
```

---

## Security Considerations

### Input Validation

- WindowType is type-safe (TypeScript enum) ✅
- No user input directly sets window state ✅
- No security concerns identified ✅

### State Management

- Window state is local to context ✅
- No global mutable state ✅
- No security concerns identified ✅

---

## Accessibility Considerations

### Keyboard Navigation

- ✅ Window switching works with keyboard (Ctrl+Left/Right)
- ✅ Focus management integrates with window switching
- ⚠️ No screen reader announcements for window changes

**Recommendation**: Add aria-live region for window changes

### Visual Indicators

- ✅ WindowSwitcher provides visual feedback
- ✅ Active window is clearly indicated
- ⚠️ No text labels, only dots (could be confusing)

**Recommendation**: WindowIndicator (from spec) includes labels

---

## Migration Recommendations

### Phase 1: Implement WindowContainer (Week 1)

**Tasks**:
1. Create WindowIndicator component
2. Create WindowContainer component
3. Create window wrapper components (ChatWindow, TerminalWindow, EditorWindow)
4. Add unit tests

**Deliverables**:
- New components in `packages/cli/src/ui/components/layout/`
- New window wrappers in `packages/cli/src/ui/components/windows/`
- Unit tests with >80% coverage

---

### Phase 2: Integrate WindowContainer (Week 2)

**Tasks**:
1. Update App.tsx to use WindowContainer
2. Remove special cases from renderActiveTab
3. Remove showWindowSwitcher from ChatTab
4. Update keyboard shortcuts
5. Add integration tests

**Deliverables**:
- Updated App.tsx without special cases
- Updated ChatTab without WindowSwitcher
- Integration tests passing

---

### Phase 3: Extend for Right Panel (Week 3)

**Tasks**:
1. Extend WindowContext for multi-container support
2. Create InputRoutingContext
3. Update SidePanel to use WindowContainer
4. Add right panel window components
5. Add keyboard shortcuts for right panel

**Deliverables**:
- Extended WindowContext
- InputRoutingContext
- Right panel windows working
- Documentation updated

---

### Phase 4: Cleanup and Polish (Week 4)

**Tasks**:
1. Remove WindowSwitcher component (deprecated)
2. Add window state persistence
3. Add accessibility improvements
4. Update documentation
5. Final testing and bug fixes

**Deliverables**:
- Clean codebase without legacy patterns
- Comprehensive documentation
- All tests passing
- Ready for release

---

## Conclusion

### Summary

The window system is **functional but uses legacy patterns** that create maintenance burden and architectural issues. The main problems are:

1. **Terminal/Editor overlay pattern** bypasses normal rendering
2. **Code duplication** with WindowSwitcher in multiple places
3. **Limited extensibility** - can't support right panel windows

A comprehensive refactor design exists (window-container-refactor spec) that solves all these issues with a unified WindowContainer component.

### Recommendations

**Immediate Actions** (This Week):
1. Add documentation comments explaining legacy patterns
2. Add reference to window-container-refactor spec in code
3. Mark WindowSwitcher as deprecated

**Short-term Actions** (Next Sprint):
1. Implement WindowContainer component
2. Replace special cases in App.tsx
3. Remove WindowSwitcher duplication

**Long-term Actions** (Next Quarter):
1. Extend for right panel windows
2. Add input routing system
3. Add window state persistence

### Risk Assessment

**Low Risk**:
- WindowContext is simple and stable
- Window switching works reliably
- No breaking changes needed for basic cleanup

**Medium Risk**:
- WindowContainer refactor touches core rendering logic
- Need thorough testing to avoid regressions
- Focus management integration needs careful handling

**Mitigation**:
- Implement behind feature flag
- Comprehensive testing before rollout
- Gradual migration (chat tab first, then others)

---

## Appendix

### Related Specifications

- `.kiro/specs/window-container-refactor/design.md` - Detailed design for WindowContainer
- `.kiro/specs/window-container-refactor/requirements.md` - Requirements for refactor
- `.kiro/specs/window-container-refactor/tasks.md` - Implementation tasks
- `.dev/FINAL-NAVIGATION-SPEC.md` - Navigation hierarchy including windows
- `.dev/HIERARCHICAL-FOCUS-IMPLEMENTATION.md` - Focus management with windows

### Related Files

**Core Files**:
- `packages/cli/src/ui/App.tsx` - Main app with renderActiveTab
- `packages/cli/src/ui/contexts/WindowContext.tsx` - Window state management
- `packages/cli/src/ui/components/WindowSwitcher.tsx` - Visual indicator

**Related Components**:
- `packages/cli/src/ui/components/layout/DotIndicator.tsx` - Dot indicator (reused)
- `packages/cli/src/ui/components/tabs/ChatTab.tsx` - Uses WindowSwitcher
- `packages/cli/src/ui/components/Terminal.tsx` - Terminal window content
- `packages/cli/src/ui/components/code-editor/EditorMockup.tsx` - Editor window content

### Metrics

**Code Metrics**:
- Total Lines: ~150 (WindowContext + WindowSwitcher)
- Complexity: Low (simple state management)
- Duplication: Medium (WindowSwitcher in 3 places)
- Test Coverage: 0% (no tests exist)

**Maintenance Metrics**:
- Last Modified: Recent (active development)
- Change Frequency: Medium (modified for new features)
- Bug Count: Low (no known bugs)
- Technical Debt: Medium (legacy patterns need refactor)

---

**Audit Complete** ✅

