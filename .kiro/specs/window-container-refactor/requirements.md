# Window Container Component - Requirements

## Overview
Refactor the main chat window area to use a unified `WindowContainer` component that properly manages multiple windows (Chat, Terminal, Editor) without z-index/layering issues.

## Problem Statement
Currently, Terminal and Editor windows are implemented as special cases in `renderActiveTab()` that override the normal tab rendering. This causes:
1. **Z-index Issues**: Terminal/Editor cover the navbar tabs
2. **Inconsistent Architecture**: Different rendering paths for Chat vs Terminal/Editor
3. **Code Duplication**: Window switching logic scattered across components
4. **Limited Reusability**: Cannot easily add more windows or reuse for right panel

## User Stories

### US-1: Unified Window Container
**As a** developer  
**I want** a single `WindowContainer` component that manages all main window types  
**So that** the rendering is consistent and respects the layout hierarchy

**Acceptance Criteria:**
- WindowContainer component exists in `packages/cli/src/ui/components/layout/WindowContainer.tsx`
- Accepts `windows` prop: array of window configurations
- Accepts `activeWindow` prop: currently active window ID
- Accepts `onWindowChange` callback for window switching
- Renders only the active window's content
- Never uses `position="absolute"` or overlays

### US-2: Window Switching
**As a** user  
**I want** to switch between Chat/Terminal/Editor using Ctrl+Left/Right  
**So that** I can quickly access different tools

**Acceptance Criteria:**
- Ctrl+Left switches to previous window (wraps around)
- Ctrl+Right switches to next window (wraps around)
- Window order: Chat → Terminal → Editor → Chat
- Switching works from any focus state
- Visual indicator shows current window

### US-3: Visual Window Indicator
**As a** user  
**I want** to see which windows are available and which is active  
**So that** I know my current context

**Acceptance Criteria:**
- Dots indicator shows all available windows
- Active window dot is highlighted (different color/style)
- Indicator positioned at top-right of window area
- Updates immediately when switching windows
- Shows window names on hover (if possible in terminal)

### US-4: Navbar Always Visible
**As a** user  
**I want** the navbar tabs to always be visible  
**So that** I can see which tab I'm on regardless of active window

**Acceptance Criteria:**
- Navbar (Row 1) is never covered by window content
- Terminal window respects Row 2 boundaries
- Editor window respects Row 2 boundaries
- Chat window respects Row 2 boundaries (already working)
- All windows render within their designated height

### US-5: Right Panel Window Container
**As a** user  
**I want** the right panel to support multiple windows (Tools/Workspace/Terminal/Chat)  
**So that** I can have multiple views open simultaneously

**Acceptance Criteria:**
- Right panel uses WindowContainer component
- Supports 4 windows: Tools, Workspace, Terminal, Chat
- Window switching works independently from main window
- Ctrl+Shift+Left/Right switches right panel windows
- Visual indicator shows active right panel window

### US-6: Input Routing System
**As a** user  
**I want** to control which window receives my input  
**So that** I can send commands to the correct chat/terminal instance

**Acceptance Criteria:**
- Visual indicator shows which window is "linked" to input
- Ctrl+Up links input to main window (left side)
- Ctrl+Down links input to right panel window (right side)
- Linked window has distinct visual indicator (e.g., green border)
- Input is sent to the linked window's active chat/terminal
- Default: input linked to main window

## Technical Requirements

### TR-1: Component Architecture
```typescript
interface Window {
  id: string;
  label: string;
  icon?: string;
  component: React.ComponentType<WindowContentProps>;
}

interface WindowContentProps {
  height: number;
  width: number;
  hasFocus: boolean;
}

interface WindowContainerProps {
  windows: Window[];
  activeWindowId: string;
  onWindowChange: (windowId: string) => void;
  height: number;
  width: number;
  showIndicator?: boolean;
  hasFocus: boolean;
}
```

### TR-2: Window Context
- Create `WindowContext` to manage window state globally
- Supports multiple container instances
- Provides `useWindowContainer(containerId)` hook
- Handles window switching logic
- Persists active window per container

### TR-3: Integration Points
**Files to Modify:**
1. `packages/cli/src/ui/App.tsx` - Replace `renderActiveTab` logic
2. `packages/cli/src/ui/contexts/WindowContext.tsx` - Extend for multiple containers
3. `packages/cli/src/ui/components/layout/WindowContainer.tsx` - New component
4. `packages/cli/src/ui/components/WindowSwitcher.tsx` - Update to use new context

**Files to Create:**
1. `packages/cli/src/ui/components/layout/WindowContainer.tsx`
2. `packages/cli/src/ui/components/layout/WindowIndicator.tsx`

### TR-4: Backward Compatibility
- Existing window switching (Ctrl+Left/Right) continues to work
- Focus management remains unchanged
- Navigation (Tab, ESC) continues to work
- No breaking changes to existing components

## Non-Functional Requirements

### NFR-1: Performance
- Window switching should be instant (<50ms)
- No flickering when switching windows
- Lazy load window content if not active

### NFR-2: Maintainability
- Clear separation of concerns
- Well-documented component API
- Easy to add new windows
- Reusable across different contexts

### NFR-3: Testing
- Unit tests for WindowContainer component
- Integration tests for window switching
- Visual regression tests for indicator

## Out of Scope
- Window state persistence across sessions
- Window-specific settings/configuration
- Drag-and-drop window reordering
- Split-screen within a single window
- Custom window layouts

## Success Metrics
1. ✅ Navbar always visible regardless of active window
2. ✅ No z-index/layering issues
3. ✅ Window switching works consistently
4. ✅ Code is more maintainable (less duplication)
5. ✅ Component is reusable for future features

## Dependencies
- Existing WindowContext (`packages/cli/src/ui/contexts/WindowContext.tsx`)
- Existing WindowSwitcher (`packages/cli/src/ui/components/WindowSwitcher.tsx`)
- Focus management system
- Layout system (4-row structure)

## Risks & Mitigation

### Risk 1: Breaking Navigation
**Mitigation**: Preserve all existing focus IDs and navigation paths

### Risk 2: Window Switching Conflicts
**Mitigation**: Use container-scoped state, not global state

### Risk 3: Performance Regression
**Mitigation**: Profile before/after, ensure no unnecessary re-renders

## Implementation Phases

### Phase 1: Create WindowContainer Component
- Build the base component
- Add window rendering logic
- Add indicator component
- Unit tests

### Phase 2: Extend WindowContext
- Support multiple container instances
- Add container-scoped state management
- Update useWindow hook

### Phase 3: Integrate with App.tsx
- Replace renderActiveTab logic
- Wire up window switching
- Test all windows render correctly

### Phase 4: Verification & Testing
- Test navbar visibility
- Test window switching
- Test focus management
- Test navigation (Tab, ESC)
- Visual verification

### Phase 5: Documentation
- Update component documentation
- Add usage examples
- Document window registration process
