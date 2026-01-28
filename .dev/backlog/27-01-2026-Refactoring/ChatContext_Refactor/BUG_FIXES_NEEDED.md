# Bug Fixes Needed After Refactoring

## Bug 1: Missing Reasoning Display (Collapsible Thinking Box)

**Status:** ✅ FIXED
**Priority:** HIGH
**Impact:** Users can now see model thinking process from reasoning models

### Problem

The ReasoningBox component exists and is being rendered in Message.tsx, but the reasoning data was never populated because the ReasoningParser was not being used during streaming.

### Root Cause

The implementation relied solely on Ollama's native `thinking` events, which only work with specific models configured with `think: true`. Models that output `<think>` tags in their text stream (like deepseek-r1, qwen-qwq) were not being parsed.

### Solution Implemented

Added `ReasoningParser` as a fallback to parse `<think>` tags from text stream AND enabled reasoning display in UI:

1. ✅ Import ReasoningParser in ChatContext
2. ✅ Initialize parser state at start of agent loop
3. ✅ Parse text chunks for `<think>` tags in `onText` callback
4. ✅ Extract reasoning content and update message
5. ✅ Remove `<think>` tags from displayed response
6. ✅ Keep native `onThinking` callback as primary method
7. ✅ **Enable reasoning display in App.tsx** (was disabled!)

### How It Works

- **Primary Method:** Native `thinking` events from Ollama (for models with `think: true`)
  - Parser is DISABLED when native thinking is active to avoid interference
- **Fallback Method:** Parse `<think>` tags from text stream (only when native thinking is not available)
- Reasoning is displayed inline in chat with expand/collapse toggle
- **Auto-collapses when thinking completes** so the response is visible
- User can expand by navigating to message header (up/down arrows) and pressing right arrow
- Shows "Reasoning: (collapsed)" when collapsed, full content when expanded

### Important Notes

- **Simplified system prompt for reasoning models**: Reasoning models get a concise, focused system prompt instead of the verbose tier-based prompts. This reduces unnecessary thinking about instructions and keeps the model focused on the user's actual question.
- **Reasoning models think about system prompts**: Even with simplified prompts, reasoning models will still think about the instructions before responding. This is normal behavior that ensures responses follow guidelines.
- **Native thinking takes precedence**: When Ollama emits native `thinking` events, the `<think>` tag parser is disabled to avoid conflicts.
- **Auto-collapse on complete**: The reasoning box auto-collapses when thinking finishes so users see the actual response immediately.
- **Explicit instruction to focus on user's question**: The simplified prompt includes "Focus your thinking on the user's actual question, not on these instructions" to guide the model's reasoning.

### Files Modified

- `packages/cli/src/features/context/ChatContext.tsx`
  - Added `ReasoningParser` import
  - Initialize parser state in agent loop
  - Parse text chunks in `onText` callback **ONLY when native thinking is not active**
  - Update message with reasoning block
  - Remove `<think>` tags from response
  - Auto-collapse reasoning when complete (not when streaming)
  - Native thinking takes precedence over parser
  - **Added simplified system prompt for reasoning models** to reduce verbose thinking about instructions
- `packages/cli/src/ui/App.tsx`
  - **Changed `reasoningConfig.enabled` from `false` to `true`** (critical fix!)

### Testing Results

- ✅ Build passes
- ✅ All 502 tests pass
- ✅ No type errors
- ✅ Reasoning parser correctly extracts `<think>` content
- ✅ Native `thinking` events still work as primary method
- ✅ Reasoning display is now enabled in UI

---

## Bug 2: Automatic Mode Switching Mid-Response

**Status:** ✅ FIXED
**Priority:** CRITICAL
**Impact:** Conversation no longer resets or goes off-topic during responses

### Problem

The PromptModeManager is automatically switching modes during streaming responses, causing:

- Conversation context loss
- Topic drift
- User confusion
- Incomplete responses

### Root Cause

The `PromptModeManager` has `autoSwitchEnabled: true` by default and uses aggressive thresholds:

- `minDuration: 15000` (15 seconds) - too short
- `cooldownPeriod: 10000` (10 seconds) - too short
- Confidence thresholds as low as 0.60 for some transitions

The mode analyzer is being called during streaming and triggering switches mid-response.

### Current Behavior

```typescript
// From PromptModeManager.ts
private readonly minDuration = 15000;  // 15 seconds
private readonly cooldownPeriod = 10000;  // 10 seconds

CONFIDENCE_THRESHOLDS = {
  'developer->planning': 0.60,  // Too low!
  'developer->debugger': 0.85,
  'debugger->developer': 0.70,
  // ...
}
```

### Solution Options

#### Option 1: Disable Auto-Switching (Recommended)

- Set `autoSwitchEnabled: false` by default
- Only allow manual mode switching via user commands
- Keep mode detection for suggestions only (not auto-switch)

#### Option 2: Increase Thresholds & Timing

- Increase `minDuration` to 60000 (60 seconds)
- Increase `cooldownPeriod` to 30000 (30 seconds)
- Raise confidence thresholds to 0.85+ for all transitions
- Block mode switching during active streaming

#### Option 3: Smart Blocking

- Detect when streaming is active
- Block ALL mode switches during streaming
- Only allow switches between user turns

### Recommended Fix

**Combination of Options 1 & 3:**

1. **Disable auto-switching by default**

   ```typescript
   autoSwitchEnabled: false; // Was: true
   ```

2. **Add streaming state check**

   ```typescript
   shouldSwitchMode(currentMode, analysis) {
     // Block if currently streaming
     if (this.isStreaming) {
       return false;
     }
     // ... rest of checks
   }
   ```

3. **Keep mode detection for UI suggestions**
   - Show mode suggestions to user
   - Require explicit confirmation
   - Never auto-switch

### Files to Modify

- `packages/core/src/prompts/PromptModeManager.ts`
- `packages/cli/src/features/context/ContextManagerContext.tsx`
- Possibly add streaming state tracking

---

## Implementation Plan

### Phase 1: Fix Reasoning Display (Bug 1)

1. Add ReasoningParser to ModelContext
2. Integrate with streaming logic
3. Test with reasoning models (deepseek-r1, qwen-qwq)
4. Verify collapsible box appears and auto-collapses

### Phase 2: Fix Mode Switching (Bug 2)

1. Disable auto-switching by default
2. Add streaming state check
3. Test that modes don't switch mid-response
4. Verify manual mode switching still works

### Phase 3: Testing

1. Test with reasoning models
2. Test mode switching behavior
3. Test long conversations
4. Verify no regressions

---

## Testing Checklist

### Reasoning Display

- [ ] Reasoning box appears during thinking
- [ ] Box shows streaming content
- [ ] Box auto-collapses when complete
- [ ] User can manually expand/collapse
- [ ] Token count displayed correctly
- [ ] Duration displayed correctly

### Mode Switching

- [ ] No automatic switches during streaming
- [ ] Manual mode switching works
- [ ] Mode persists across messages
- [ ] No conversation resets
- [ ] No topic drift

---

## Notes

- Both bugs were introduced during the refactoring when we simplified the context management
- The components exist but the integration was lost
- This is a good example of why comprehensive testing is important after major refactors
