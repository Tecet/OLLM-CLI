# Context Compression - Bugs & Fixes

## Overview
Fixed critical bug where compression wasn't triggering, causing LLM to forget conversation history after context rollover.

## Problem

### Symptoms
1. Compression never triggered during long conversations
2. LLM forgot entire conversation after context filled
3. Token count dropped to 434 (just system prompt)
4. No compression message appeared in UI
5. Snapshots not being created

### Root Cause
**Mismatch between Ollama's limit and compression thresholds:**

- User selects: **4096 tokens**
- Profile defines: `ollama_context_size: 3482` (85% of 4096)
- We send to Ollama: `num_ctx: 3482` ✓
- But `context.maxTokens` was: **4096** ✗
- Compression threshold: 0.75 * 4096 = **3072 tokens**
- Actual Ollama limit: **3482 tokens**

**Result:** Compression triggered at 3072, but Ollama stopped at 3482. Small window (410 tokens) meant compression often didn't complete before Ollama hit its limit.

## Solution

### Fix 1: Update context.maxTokens to Match Ollama Limit
**File:** `packages/cli/src/features/context/ModelContext.tsx`

**Before:**
```typescript
// context.maxTokens stayed at user's selection (4096)
const { allowed, ollamaContextSize } = contextSizing;
// Send to Ollama
options: { num_ctx: ollamaContextSize }
```

**After:**
```typescript
const { allowed, ollamaContextSize } = contextSizing;

// CRITICAL: Update context.maxTokens to match Ollama's limit
contextActions.updateConfig({ targetSize: ollamaContextSize });

// Send to Ollama
options: { num_ctx: ollamaContextSize }
```

**Impact:** Now `context.maxTokens = 3482` (Ollama's limit), so compression thresholds calculate correctly.

### Fix 2: Adjust Compression Thresholds
**File:** `packages/core/src/context/contextDefaults.ts`

**Before:**
```typescript
compression: {
  threshold: 0.68,  // 68% of user's context
}
snapshots: {
  autoThreshold: 0.85,  // 85% of user's context
}
```

**After:**
```typescript
compression: {
  threshold: 0.75,  // 75% of ollama_context_size
}
snapshots: {
  autoThreshold: 0.80,  // 80% of ollama_context_size
}
```

**Impact:** Better buffer before Ollama's hard stop.

### Fix 3: Add Debug Logging
**File:** `packages/core/src/context/messageStore.ts`

**Added:**
```typescript
if (usageFraction >= this.config.compression.threshold) {
  console.log('[MessageStore] Compression threshold reached', {
    usageFraction: usageFraction.toFixed(3),
    threshold: this.config.compression.threshold,
    currentTokens: context.tokenCount,
    maxTokens: context.maxTokens
  });
  await this.compress();
}
```

**Impact:** Visibility into when compression triggers.

### Fix 4: Non-Interactive Mode
**File:** `packages/cli/src/nonInteractive.ts`

**Before:**
```typescript
// No context sizing - Turn calculated 85% as fallback
chatClient.chat(prompt, {
  model,
  provider,
});
```

**After:**
```typescript
// Load profile and calculate context sizing
const modelEntry = profileManager.getModelEntry(model);
const contextSizing = calculateContextSizing(requestedContextSize, modelEntry);

chatClient.chat(prompt, {
  model,
  provider,
  contextSize: contextSizing.allowed,
  ollamaContextSize: contextSizing.ollamaContextSize,
});
```

**Impact:** Non-interactive mode now uses profile values correctly.

## How It Works Now

### For 4k Context Selection:

**Before Fix:**
```
User selects: 4096
context.maxTokens: 4096
Compression at: 0.68 * 4096 = 2785 tokens
Snapshot at: 0.85 * 4096 = 3482 tokens
Ollama stops at: 3482 tokens
❌ Compression too late, race condition
```

**After Fix:**
```
User selects: 4096
ollama_context_size: 3482 (from profile)
context.maxTokens: 3482 ✓
Compression at: 0.75 * 3482 = 2611 tokens ✓
Snapshot at: 0.80 * 3482 = 2785 tokens ✓
Ollama stops at: 3482 tokens ✓
✅ Compression triggers with 871 token buffer
```

## Verification

### Test Scenario
1. Select 4k context
2. Send long prompt forcing streaming until context fills
3. Watch for compression message at ~2600 tokens
4. Verify snapshot created at ~2800 tokens
5. Verify Ollama stops at ~3482 tokens
6. Verify LLM remembers conversation after rollover

### Expected Behavior
- ✅ Compression message appears in UI
- ✅ Token count doesn't exceed ollama_context_size
- ✅ Snapshot files created in `~/.ollm/context-snapshots/`
- ✅ LLM maintains conversation context
- ✅ No "forgot everything" behavior

## Files Modified

1. **packages/cli/src/features/context/ModelContext.tsx**
   - Added `contextActions.updateConfig({ targetSize: ollamaContextSize })`

2. **packages/core/src/context/contextDefaults.ts**
   - Changed compression threshold: 0.68 → 0.75
   - Changed snapshot threshold: 0.85 → 0.80
   - Updated comments

3. **packages/core/src/context/messageStore.ts**
   - Added debug logging for compression triggers

4. **packages/cli/src/nonInteractive.ts**
   - Added profile loading
   - Added context sizing calculation
   - Pass ollamaContextSize to ChatClient

## Related Issues

### Issue 1: Tier 1 Compression
**Problem:** Tier 1 rollover was discarding all messages except system prompt.

**Fix:** Modified `compressForTier1()` to:
- Preserve system prompt in full
- Preserve all user messages in full
- Compress only assistant messages
- Add summary to next prompt

**File:** `packages/core/src/context/compressionCoordinator.ts`

### Issue 2: Event Emission
**Problem:** UI wasn't showing compression messages.

**Fix:** Added `compressed` event emission for UI compatibility.

**File:** `packages/core/src/context/compressionCoordinator.ts`

## Prevention

### Design Principle
**The app should read both `size` and `ollama_context_size` from profiles and pass them through without recalculation.**

### Code Review Checklist
- [ ] Does code use `ollama_context_size` from profile?
- [ ] Is `context.maxTokens` set to `ollama_context_size`?
- [ ] Are thresholds calculated against `ollama_context_size`?
- [ ] Is `num_ctx` sent to Ollama from profile?
- [ ] No hardcoded 0.85 or 85% calculations?

## Related Documents
- **Audit:** `.dev/ContextCompression-Audit.md`
- **Design Guide:** `.dev/dev_ContextCompression.md`
