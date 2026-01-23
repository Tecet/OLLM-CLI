# Navigation System Fix - Requirements

**Version**: 1.0.0  
**Status**: 📋 Planning  
**Created**: January 23, 2026

## Overview

The hierarchical navigation system is not working as designed. The ESC key should always perform hierarchical navigation (moving up one level), but currently it only works when not streaming. This breaks the navigation pattern described in the design document.

## Problem Statement

### Current Behavior
- ESC key is mapped to "cancel" action
- When streaming: ESC cancels generation (correct)
- When NOT streaming: ESC calls `exitOneLevel()` (correct)
- **Problem**: The logic is in `handleCancel()` which treats navigation as secondary to cancellation

### Expected Behavior (from design.md)
```
Level 3 (Modal) → ESC → Level 2 (Tab Content)
Level 2 (Tab Content) → ESC → Level 1 (Nav Bar)
Level 1 (Nav Bar) → 1st ESC → Switch to Chat tab in navbar
Level 1 (Nav Bar) → 2nd ESC → User Input
```

ESC should ALWAYS perform hierarchical navigation, and cancellation should be a side effect when streaming.

## User Stories

### US-1: Hierarchical ESC Navigation
**As a** user  
**I want** ESC to always move up one level in the navigation hierarchy  
**So that** I can navigate consistently regardless of application state

**Acceptance Criteria**:
- ESC always calls `exitOneLevel()` first
- If streaming, ESC also cancels generation
- Navigation works from any level (1, 2, or 3)
- Navigation works whether streaming or not

### US-2: Consistent Navigation Flow
**As a** user  
**I want** Tab/Shift+Tab to cycle through Level 1 areas  
**So that** I can quickly move between main UI sections

**Acceptance Criteria**:
- Tab cycles: User Input → Chat Window → Nav Bar → Side Panel → User Input
- Shift+Tab cycles in reverse
- Cycling works from any Level 1 area
- Cycling does not affect Level 2/3 focus

### US-3: Enter Key Activation
**As a** user  
**I want** Enter to activate/go deeper when on nav-bar  
**So that** I can access tab content

**Acceptance Criteria**:
- Enter on nav-bar activates current tab content
- Focus moves to appropriate Level 2 element
- Mode switches to 'active'

## Technical Requirements

### TR-1: ESC Key Handling
- ESC must always call `focusManager.exitOneLevel()`
- If streaming, ESC must also call `cancelGeneration()`
- Order: Cancel first (if streaming), then navigate
- No conditional logic that skips navigation

### TR-2: Tab Cycle Implementation
- Tab/Shift+Tab must call `focusManager.cycleFocus()`
- Must work from any Level 1 focus ID
- Must respect side panel visibility
- Must not interfere with Level 2/3 navigation

### TR-3: Enter Key Implementation
- Enter on nav-bar must call `focusManager.activateContent(activeTab)`
- Must set mode to 'active'
- Must focus appropriate Level 2 element

### TR-4: Focus Level Detection
- `getFocusLevel()` must correctly identify level 1, 2, 3
- Level detection must be fast (O(1) lookup)
- Must handle all focus IDs correctly

## Current Implementation Issues

### Issue 1: ESC Logic in handleCancel
**Location**: `packages/cli/src/ui/hooks/useGlobalKeyboardShortcuts.ts`

**Current Code**:
```typescript
const handleCancel = useCallback(() => {
  if (chatState.streaming || chatState.waitingForResponse) {
    cancelGeneration();
  } else {
    focusManager.exitOneLevel();
  }
}, [chatState.streaming, chatState.waitingForResponse, cancelGeneration, focusManager]);
```

**Problem**: Navigation only happens when NOT streaming. This is backwards.

**Fix**: Always navigate, cancel as side effect:
```typescript
const handleEscape = useCallback(() => {
  // Cancel generation if streaming (side effect)
  if (chatState.streaming || chatState.waitingForResponse) {
    cancelGeneration();
  }
  
  // Always perform hierarchical navigation
  focusManager.exitOneLevel();
}, [chatState.streaming, chatState.waitingForResponse, cancelGeneration, focusManager]);
```

### Issue 2: No Direct ESC Handler
**Location**: `packages/cli/src/ui/hooks/useGlobalKeyboardShortcuts.ts`

**Current**: ESC is handled through "cancel" keybind
**Problem**: Conflates cancellation with navigation

**Fix**: Add explicit ESC handler:
```typescript
// ESC key - hierarchical navigation
else if (key.escape) {
  handleEscape();
}
```

### Issue 3: Tab Bubbling in Components
**Location**: Various tab components

**Current**: Some components allow ESC to bubble, some don't
**Problem**: Inconsistent behavior

**Fix**: All Level 2 components should allow ESC to bubble to global handler

## Success Criteria

- [ ] ESC always performs hierarchical navigation
- [ ] ESC cancels generation when streaming (as side effect)
- [ ] Tab/Shift+Tab cycle through Level 1 areas
- [ ] Enter activates tab content from nav-bar
- [ ] Navigation works from all levels (1, 2, 3)
- [ ] Navigation works whether streaming or not
- [ ] All tests pass
- [ ] No regressions in existing functionality

## Out of Scope

- New navigation features
- Keyboard shortcut customization UI
- Mouse navigation improvements
- Focus visual indicators

## Dependencies

- Existing FocusContext implementation
- Existing useGlobalKeyboardShortcuts hook
- Existing keybinds configuration

## Risks

1. **Breaking Existing Behavior**: Users may be accustomed to current ESC behavior
   - Mitigation: This is a bug fix, not a feature change
2. **Streaming Cancellation**: Ensure cancellation still works reliably
   - Mitigation: Test streaming scenarios thoroughly

## Timeline

- **Estimated Effort**: 2-4 hours
- **Priority**: High (core navigation is broken)

## References

- Design Document: `.kiro/specs/v0.1.0 Debugging and Polishing/design.md`
- Focus Context: `packages/cli/src/features/context/FocusContext.tsx`
- Global Shortcuts: `packages/cli/src/ui/hooks/useGlobalKeyboardShortcuts.ts`
