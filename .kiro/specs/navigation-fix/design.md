# Navigation System Fix - Design

**Version**: 1.0.0  
**Status**: 📋 Planning  
**Created**: January 23, 2026

## Overview

This document outlines the fix for the hierarchical navigation system. The core issue is that ESC key handling treats navigation as secondary to cancellation, when it should be the other way around.

## Root Cause Analysis

### The Problem

The current implementation in `useGlobalKeyboardShortcuts.ts`:

```typescript
const handleCancel = useCallback(() => {
  if (chatState.streaming || chatState.waitingForResponse) {
    cancelGeneration();  // Cancel if streaming
  } else {
    focusManager.exitOneLevel();  // Navigate if NOT streaming
  }
}, [chatState.streaming, chatState.waitingForResponse, cancelGeneration, focusManager]);
```

This logic is **backwards** for a navigation system. It says:
- "If streaming, cancel"
- "Otherwise, navigate"

But it should be:
- "Always navigate"
- "If streaming, also cancel"

### Why This Matters

1. **Navigation is Primary**: The ESC key's primary purpose is hierarchical navigation
2. **Cancellation is Secondary**: Canceling generation is a side effect that happens when streaming
3. **Consistency**: Users expect ESC to always move up one level, regardless of state

## Solution Design

### 1. Rename and Refactor handleCancel

**Before**:
```typescript
const handleCancel = useCallback(() => {
  if (chatState.streaming || chatState.waitingForResponse) {
    cancelGeneration();
  } else {
    focusManager.exitOneLevel();
  }
}, [chatState.streaming, chatState.waitingForResponse, cancelGeneration, focusManager]);
```

**After**:
```typescript
const handleEscape = useCallback(() => {
  // Side effect: Cancel generation if streaming
  if (chatState.streaming || chatState.waitingForResponse) {
    cancelGeneration();
  }
  
  // Primary action: Always perform hierarchical navigation
  focusManager.exitOneLevel();
}, [chatState.streaming, chatState.waitingForResponse, cancelGeneration, focusManager]);
```

**Changes**:
- Renamed `handleCancel` → `handleEscape` (more accurate name)
- Cancellation happens first (if needed)
- Navigation ALWAYS happens
- Clear comments explain the logic

### 2. Update Keybind Handler

**Before**:
```typescript
else if (isKey(input, key, activeKeybinds.chat.cancel)) {
  handleCancel();
}
```

**After**:
```typescript
// ESC key - hierarchical navigation (with cancellation side effect)
else if (key.escape) {
  handleEscape();
}
```

**Changes**:
- Direct `key.escape` check instead of keybind lookup
- ESC is fundamental to navigation, not just a "cancel" action
- Clear comment explains dual purpose

### 3. Keep Separate Cancel Keybind (Optional)

For users who want a dedicated cancel key (e.g., Ctrl+C), we can keep the cancel keybind:

```typescript
// Dedicated cancel (if user has configured a different key)
else if (isKey(input, key, activeKeybinds.chat.cancel) && activeKeybinds.chat.cancel !== 'escape') {
  // Only cancel, don't navigate
  if (chatState.streaming || chatState.waitingForResponse) {
    cancelGeneration();
  }
}
```

This allows users to have both:
- ESC: Navigate + cancel (if streaming)
- Ctrl+C: Cancel only (no navigation)

## Implementation Plan

### Step 1: Update useGlobalKeyboardShortcuts.ts

1. Rename `handleCancel` to `handleEscape`
2. Reorder logic: cancel first, then navigate
3. Add `else if (key.escape)` handler
4. Update comments

### Step 2: Test Navigation Flow

Test all navigation paths:

1. **Level 3 → Level 2**:
   - Open syntax viewer from file tree
   - Press ESC
   - Should return to file tree

2. **Level 2 → Level 1**:
   - Focus file tree
   - Press ESC
   - Should return to nav-bar

3. **Level 1 → Level 1 (Two-step)**:
   - Focus nav-bar on Tools tab
   - Press ESC
   - Should switch to Chat tab (stay in nav-bar)
   - Press ESC again
   - Should move to user input

4. **Streaming Cancellation**:
   - Start generation
   - Press ESC while streaming
   - Should cancel generation AND navigate

### Step 3: Verify Tab Cycling

Test Tab/Shift+Tab:

1. From user input, press Tab
   - Should move to chat-history
2. Press Tab again
   - Should move to nav-bar
3. Press Tab again (with side panel visible)
   - Should move to context-panel
4. Press Tab again
   - Should wrap to user input

### Step 4: Verify Enter Activation

Test Enter key:

1. Focus nav-bar on Files tab
2. Press Enter
   - Should activate file-tree
   - Mode should be 'active'

## Edge Cases

### Edge Case 1: ESC During Menu
**Scenario**: User has menu open (e.g., context menu)  
**Expected**: ESC closes menu, doesn't navigate  
**Implementation**: Menu components handle ESC locally, prevent bubbling

### Edge Case 2: ESC in Input Field
**Scenario**: User is typing in input field  
**Expected**: ESC clears input or exits field  
**Implementation**: Input component handles ESC locally

### Edge Case 3: ESC During Modal
**Scenario**: User has confirmation dialog open  
**Expected**: ESC closes dialog, returns to parent  
**Implementation**: `exitOneLevel()` already handles this via `modalParent` tracking

### Edge Case 4: Rapid ESC Presses
**Scenario**: User presses ESC multiple times quickly  
**Expected**: Navigate up multiple levels smoothly  
**Implementation**: No debouncing needed, each press moves up one level

## Performance Considerations

### No Performance Impact

The changes are minimal and don't affect performance:
- Same number of function calls
- Same conditional checks
- No new state or effects

### Potential Improvement

If we want to optimize, we could memoize the streaming check:

```typescript
const isStreaming = useMemo(
  () => chatState.streaming || chatState.waitingForResponse,
  [chatState.streaming, chatState.waitingForResponse]
);

const handleEscape = useCallback(() => {
  if (isStreaming) {
    cancelGeneration();
  }
  focusManager.exitOneLevel();
}, [isStreaming, cancelGeneration, focusManager]);
```

But this is premature optimization - the current approach is fine.

## Testing Strategy

### Unit Tests

Test `handleEscape` logic:

```typescript
describe('handleEscape', () => {
  it('should always call exitOneLevel', () => {
    // Test with streaming = false
    // Test with streaming = true
    // Verify exitOneLevel called in both cases
  });

  it('should cancel generation when streaming', () => {
    // Test with streaming = true
    // Verify cancelGeneration called
  });

  it('should not cancel when not streaming', () => {
    // Test with streaming = false
    // Verify cancelGeneration NOT called
  });
});
```

### Integration Tests

Test navigation flows:

```typescript
describe('Navigation Flow', () => {
  it('should navigate from Level 3 to Level 2', () => {
    // Open modal
    // Press ESC
    // Verify focus returned to parent
  });

  it('should navigate from Level 2 to Level 1', () => {
    // Focus tab content
    // Press ESC
    // Verify focus on nav-bar
  });

  it('should navigate from Level 1 to user input', () => {
    // Focus nav-bar on Chat tab
    // Press ESC
    // Verify focus on user input
  });
});
```

### Manual Testing

Test with real UI:

1. Open app
2. Navigate through all levels
3. Test ESC at each level
4. Test Tab/Shift+Tab cycling
5. Test Enter activation
6. Test streaming cancellation

## Rollout Plan

### Phase 1: Fix ESC Handler
- Update `useGlobalKeyboardShortcuts.ts`
- Test locally
- Commit with clear message

### Phase 2: Verify Navigation
- Test all navigation paths
- Fix any issues found
- Update documentation

### Phase 3: User Testing
- Deploy to staging
- Get user feedback
- Address any concerns

## Documentation Updates

### Update Design Document

Add note to `.kiro/specs/v0.1.0 Debugging and Polishing/design.md`:

```markdown
## ESC Key Behavior

The ESC key has dual purpose:
1. **Primary**: Hierarchical navigation (always)
2. **Secondary**: Cancel generation (when streaming)

Implementation:
- ESC always calls `focusManager.exitOneLevel()`
- If streaming, ESC also calls `cancelGeneration()`
- Order: Cancel first, then navigate
```

### Update README

Add to navigation section:

```markdown
### ESC Key

The ESC key moves up one level in the navigation hierarchy:
- Level 3 (Modal) → Level 2 (Parent)
- Level 2 (Tab Content) → Level 1 (Nav Bar)
- Level 1 (Nav Bar) → User Input (via Chat tab)

When generation is in progress, ESC also cancels the generation.
```

## Success Metrics

- [ ] ESC always navigates (100% of cases)
- [ ] ESC cancels when streaming (100% of streaming cases)
- [ ] Tab/Shift+Tab cycle correctly (100% of cases)
- [ ] Enter activates content (100% of cases)
- [ ] No regressions in existing tests
- [ ] User feedback positive

## Conclusion

This fix is straightforward and addresses a fundamental issue in the navigation system. By treating navigation as primary and cancellation as secondary, we restore the intended hierarchical navigation behavior while maintaining the ability to cancel streaming generation.

The changes are minimal, well-tested, and have no performance impact. Users will experience more consistent and predictable navigation throughout the application.
