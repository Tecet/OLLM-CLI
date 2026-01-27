# Bug Fixes Needed After Refactoring

## Bug 1: Missing Reasoning Display (Collapsible Thinking Box)

**Status:** IDENTIFIED
**Priority:** HIGH
**Impact:** Users cannot see model thinking process from reasoning models

### Problem
The ReasoningBox component exists and is being rendered in Message.tsx, but the reasoning data is never populated because the ReasoningParser is not being used during streaming.

### Root Cause
During refactoring, the integration between streaming responses and ReasoningParser was lost. The parser exists in `packages/core/src/services/reasoningParser.ts` but is never called.

### Components Involved
- ✅ `ReasoningBox.tsx` - Component exists and works
- ✅ `Message.tsx` - Renders ReasoningBox when `message.reasoning` exists
- ✅ `reasoningParser.ts` - Parser exists with streaming support
- ❌ `ModelContext.tsx` - NOT using ReasoningParser during streaming
- ❌ `ChatContext.tsx` - Message type has reasoning field but never populated

### Solution
1. Import ReasoningParser in ModelContext
2. Create parser instance with token counter
3. Initialize parser state when streaming starts
4. Call `parseStreaming()` for each chunk
5. Extract reasoning block and update message
6. Pass reasoning to ChatContext when adding assistant message

### Files to Modify
- `packages/cli/src/features/context/ModelContext.tsx`
- Possibly `packages/cli/src/features/context/ChatContext.tsx`

---

## Bug 2: Automatic Mode Switching Mid-Response

**Status:** IDENTIFIED  
**Priority:** CRITICAL
**Impact:** Conversation resets and goes off-topic during responses

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
   autoSwitchEnabled: false  // Was: true
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
