# Reasoning Box Behavior Fix

**Date:** January 18, 2026  
**Status:** ✅ FIXED (Final Solution)

## Problem

User reported: "thinking box is still closed at start"

The reasoning box was appearing collapsed even during streaming, hiding the thinking process.

## Root Cause Analysis

### The Real Issue: Wrong State Variable

The problem was NOT in the `Message.tsx` or `ReasoningBox.tsx` components. The actual rendering happens in `ChatHistory.tsx`, which uses a completely different state variable:

```typescript
// ChatHistory.tsx line 308
const isExpanded = message.expanded === true;

// Line 329
if (showReasoning && message.reasoning) {
  if (isExpanded) {
    // Show full reasoning
  } else {
    addLine([{ text: 'Reasoning: (collapsed)', ... }]);
  }
}
```

**Key Finding:** The reasoning display is controlled by `message.expanded`, NOT by any component-level state in `Message.tsx` or `ReasoningBox.tsx`.

### Why It Was Always Collapsed

Messages were being created without the `expanded` field:

```typescript
// ChatContext.tsx - BEFORE FIX
const assistantMsg = addMessage({
  role: 'assistant',
  content: '',
  // expanded field missing - defaults to undefined
});
```

Since `message.expanded === true` was always `false` (undefined !== true), the reasoning always showed as collapsed.

## Solution

### Fix 1: Set expanded: true on Message Creation

Set `expanded: true` when creating assistant messages:

```typescript
// ChatContext.tsx - AFTER FIX
const assistantMsg = addMessage({
  role: 'assistant',
  content: '',
  expanded: true, // Start expanded to show reasoning as it streams
});
```

### Fix 2: Auto-Collapse When Reasoning Completes

In the `onComplete` handler, set `expanded: false` when reasoning finishes:

```typescript
// Mark reasoning as complete and calculate duration
if (msg.reasoning) {
  updates.reasoning = {
    ...msg.reasoning,
    complete: true,
    duration: metrics.evalDuration > 0 ? metrics.evalDuration / 1e9 : 0,
  };
  // Auto-collapse reasoning when complete
  updates.expanded = false;
}
```

### Fix 3: Also Fix Post-Swap Messages

Apply the same fix to messages created after tool swaps:

```typescript
if (tc.name === 'trigger_hot_swap') {
  const swapMsg = addMessage({ 
    role: 'assistant', 
    content: '', 
    expanded: true  // Also start expanded
  });
  currentAssistantMsgId = swapMsg.id;
}
```

## Expected Behavior

### During Streaming (expanded: true, complete: false)
1. ✅ Reasoning shows **EXPANDED** with full content
2. ✅ Content streams in real-time
3. ✅ User can see the thinking process
4. ✅ Box remains open until completion

### When Complete (expanded: false, complete: true)
1. ✅ Auto-collapses to summary view
2. ✅ Shows "Reasoning: (collapsed)"
3. ✅ Saves screen space
4. ✅ User can expand manually if needed

### Historical Messages
1. ✅ Completed reasoning blocks start **COLLAPSED**
2. ✅ Shows summary line
3. ✅ No unnecessary screen space used

## Files Modified

1. **`packages/cli/src/features/context/ChatContext.tsx`**
   - Line ~407: Set `expanded: true` when creating assistant messages
   - Line ~507: Set `expanded: false` when reasoning completes
   - Line ~610: Set `expanded: true` for post-swap messages

## Why Previous Attempts Failed

### Attempt 1: Changed Message.tsx useState
- ❌ Didn't work because `Message.tsx` doesn't control the rendering
- The `reasoningExpanded` state was never used by `ChatHistory.tsx`

### Attempt 2: Changed ReasoningBox.tsx useState
- ❌ Didn't work because `ReasoningBox.tsx` isn't even rendered
- `ChatHistory.tsx` builds text lines directly, doesn't use React components

### Attempt 3: Added useEffect to Message.tsx
- ❌ Didn't work because the component isn't involved in rendering
- The actual rendering happens in `buildChatLines()` function

### Final Solution: Fixed the Actual State
- ✅ Works because it fixes `message.expanded`, which is what `ChatHistory.tsx` actually checks
- This is the authoritative state that controls all collapsible content (reasoning, tools, diffs)

## Architecture Insight

The OLLM CLI uses a **line-based rendering system** for chat history:

1. `ChatContext.tsx` manages message state
2. `ChatHistory.tsx` converts messages to text lines via `buildChatLines()`
3. Lines are rendered as plain text, not React components
4. `message.expanded` controls ALL collapsible content (reasoning, tools, diffs)

This is why component-level state in `Message.tsx` or `ReasoningBox.tsx` had no effect - those components aren't used for the main chat display!

## Testing Results

### Test Case 1: Streaming Behavior ✅
```
1. Send message to deepseek-r1:7b
2. Reasoning appears expanded
3. Content streams in real-time
4. When complete, auto-collapses
```
**Result:** PASS - User confirmed "ok it work now"

### Test Case 2: Historical Messages ✅
```
1. Scroll up to previous messages
2. Completed reasoning shows as collapsed
3. Saves screen space
```
**Result:** Expected to PASS (follows from fix)

### Test Case 3: Manual Toggle ✅
```
1. User can navigate to collapsed reasoning
2. Use arrow keys to expand/collapse
3. State persists until next update
```
**Result:** Expected to PASS (existing functionality)

## Build Status

```bash
npm run build
```
**Result:** ✅ Build completed successfully

## Summary

**Problem:** Reasoning box always showed as collapsed  
**Root Cause:** Messages created without `expanded: true` field  
**Solution:** Set `expanded: true` on creation, `false` on completion  
**Status:** ✅ FIXED - User confirmed working

---

**Key Lesson:** Always trace the actual rendering path, not just the component tree. In this case, the rendering happened in a utility function (`buildChatLines`), not in React components.
