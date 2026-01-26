# Context Compression - Technical Audit

## Scope
Comprehensive audit of all code paths handling context sizing, compression triggers, and Ollama communication to ensure correct use of profile values.

## Core Principle
**Read `size` (user's selection) and `ollama_context_size` (Ollama's limit) from LLM_profiles.json and pass through without recalculation.**

## Files Audited

### ✅ packages/cli/src/features/context/contextSizing.ts
**Status:** Correct with acceptable fallback

**Code:**
```typescript
const ollamaContextSize = fallbackProfile?.ollama_context_size 
  ?? Math.max(1, Math.floor(allowed * safeRatio));
```

**Analysis:**
- Primary path: Uses `ollama_context_size` from profile ✓
- Fallback: Calculates `allowed * 0.85` only if profile missing field
- Assessment: Acceptable since all profiles have `ollama_context_size`

### ✅ packages/cli/src/features/context/ModelContext.tsx
**Status:** Fixed - now updates context.maxTokens

**Code:**
```typescript
const contextSizing = calculateContextSizing(requestedContextSize, modelEntry);
const { allowed, ollamaContextSize } = contextSizing;

// NEW FIX: Update context.maxTokens to match Ollama's limit
contextActions.updateConfig({ targetSize: ollamaContextSize });

// Send to Ollama
options: {
  num_ctx: ollamaContextSize,  // Direct pass-through from profile
}
```

**Analysis:**
- Reads from profile: ✓
- Sends to Ollama: ✓
- Updates context.maxTokens: ✓ (NEW)
- No recalculation: ✓

### ✅ packages/ollm-bridge/src/provider/localProvider.ts
**Status:** Correct - passes through to Ollama

**Code:**
```typescript
options: optionsPayload,  // Includes num_ctx from request
```

**Analysis:**
- No calculation: ✓
- Direct pass-through: ✓

### ✅ packages/cli/src/commands/utilityCommands.ts
**Status:** Correct - uses profile value for /test prompt

**Code:**
```typescript
options: {
  num_ctx: contextSizing.ollamaContextSize,  // From profile
}
```

**Analysis:**
- Uses profile value: ✓
- No recalculation: ✓

### ✅ packages/core/src/context/contextDefaults.ts
**Status:** Correct - thresholds are percentages

**Code:**
```typescript
compression: {
  threshold: 0.75,  // 75% of ollama_context_size
}
snapshots: {
  autoThreshold: 0.80  // 80% of ollama_context_size
}
```

**Analysis:**
- Thresholds are percentages: ✓
- Applied to ollama_context_size: ✓ (after context.maxTokens fix)

### ✅ packages/core/src/context/contextPool.ts
**Status:** Correct - tracks both values

**Code:**
```typescript
public currentSize: number;      // Ollama context size (from profile)
public userContextSize: number;  // User's selected size (for UI display)
```

**Analysis:**
- Separate tracking: ✓
- No calculation: ✓

### ✅ packages/core/src/context/messageStore.ts
**Status:** Correct - uses context.maxTokens

**Code:**
```typescript
if (usageFraction >= this.config.compression.threshold) {
  console.log('[MessageStore] Compression threshold reached', {
    currentTokens: context.tokenCount,
    maxTokens: context.maxTokens  // Now set to ollama_context_size
  });
  await this.compress();
}
```

**Analysis:**
- Uses context.maxTokens: ✓
- context.maxTokens now set to ollama_context_size: ✓

### ✅ packages/core/src/core/turn.ts
**Status:** Fixed - fallback only when profile unavailable

**Code:**
```typescript
if (this.options.ollamaContextSize !== undefined) {
  opts.num_ctx = this.options.ollamaContextSize;  // Preferred
} else if (this.options.contextSize !== undefined) {
  opts.num_ctx = Math.floor(this.options.contextSize * 0.85);  // Fallback
}
```

**Analysis:**
- Primary path: Uses `ollamaContextSize` if provided ✓
- Fallback: Calculates 85% only if not provided
- Usage: ChatClient (non-interactive mode)
- Fix: Non-interactive mode now provides `ollamaContextSize` ✓

### ✅ packages/cli/src/nonInteractive.ts
**Status:** Fixed - now loads profile

**Code:**
```typescript
// Load model profile and calculate context sizing
const modelEntry = profileManager.getModelEntry(model);
const contextSizing = calculateContextSizing(requestedContextSize, modelEntry);

// Pass to ChatClient
chatClient.chat(prompt, {
  contextSize: contextSizing.allowed,
  ollamaContextSize: contextSizing.ollamaContextSize,
});
```

**Analysis:**
- Loads profile: ✓
- Calculates context sizing: ✓
- Provides ollamaContextSize: ✓
- No recalculation in Turn: ✓

## Data Flow Analysis

### Interactive Mode (CLI)
```
LLM_profiles.json
  ↓ (read)
ProfileManager → user_models.json
  ↓ (read)
calculateContextSizing()
  ├─ size: 4096 (user's selection)
  └─ ollama_context_size: 3482 (from profile)
  ↓
ModelContext.sendToLLM()
  ├─ contextActions.updateConfig({ targetSize: 3482 })  ← FIX
  │   └─ Sets context.maxTokens = 3482
  └─ provider.chatStream({ options: { num_ctx: 3482 } })
  ↓
LocalProvider → Ollama
  └─ Receives num_ctx: 3482
```

### Non-Interactive Mode
```
LLM_profiles.json
  ↓ (read)
ProfileManager → user_models.json
  ↓ (read)
calculateContextSizing()
  ├─ size: 4096
  └─ ollama_context_size: 3482
  ↓
NonInteractiveRunner
  └─ ChatClient.chat({
      contextSize: 4096,
      ollamaContextSize: 3482  ← FIX
    })
  ↓
Turn.buildGenerationOptions()
  └─ opts.num_ctx = 3482 (from ollamaContextSize)
  ↓
LocalProvider → Ollama
  └─ Receives num_ctx: 3482
```

### Compression Triggers
```
context.maxTokens = 3482 (ollama_context_size)  ← FIX
  ↓
Compression threshold = 0.75
  ↓
Triggers at: 3482 * 0.75 = 2611 tokens
  ↓
Snapshot threshold = 0.80
  ↓
Triggers at: 3482 * 0.80 = 2785 tokens
  ↓
Ollama stops at: 3482 tokens
  ↓
Buffer: 3482 - 2785 = 697 tokens
```

## Verification Matrix

| Component | Uses Profile | Sets Correctly | No Calculation | Status |
|-----------|-------------|----------------|----------------|--------|
| contextSizing.ts | ✅ | ✅ | ✅ | Pass |
| ModelContext.tsx | ✅ | ✅ | ✅ | Pass |
| localProvider.ts | ✅ | ✅ | ✅ | Pass |
| utilityCommands.ts | ✅ | ✅ | ✅ | Pass |
| contextDefaults.ts | ✅ | ✅ | ✅ | Pass |
| contextPool.ts | ✅ | ✅ | ✅ | Pass |
| messageStore.ts | ✅ | ✅ | ✅ | Pass |
| turn.ts | ✅ | ✅ | ⚠️ Fallback | Pass |
| nonInteractive.ts | ✅ | ✅ | ✅ | Pass |

## Performance Impact

### Before Fix
- Compression triggered too late (3072 tokens)
- Race condition with Ollama stop (3482 tokens)
- Window: 410 tokens
- Result: Compression often incomplete

### After Fix
- Compression triggers early (2611 tokens)
- Snapshot at 2785 tokens
- Ollama stops at 3482 tokens
- Buffer: 871 tokens
- Result: Compression completes reliably

## Test Results

### Unit Tests
```bash
npm test
# ✅ All tests pass
# ✅ No regressions
```

### Integration Tests
```bash
# Test 4k context
ollm --prompt "Generate long response..."
# ✅ Compression at ~2600 tokens
# ✅ Snapshot at ~2800 tokens
# ✅ Ollama stops at ~3482 tokens
# ✅ LLM remembers context
```

### Manual Verification
- ✅ Compression message appears in UI
- ✅ Token count accurate
- ✅ Snapshots created
- ✅ No context loss
- ✅ Debug logs show correct values

## Risk Assessment

### Low Risk
- ✅ Profile values are source of truth
- ✅ Fallbacks only for missing profiles
- ✅ All tests pass
- ✅ Backward compatible

### Mitigations
- Fallback calculations for safety
- Debug logging for visibility
- Comprehensive testing
- Easy rollback path

## Recommendations

### Completed
- ✅ Update context.maxTokens to ollama_context_size
- ✅ Adjust compression thresholds
- ✅ Fix non-interactive mode
- ✅ Add debug logging

### Future Improvements
1. Make `ollama_context_size` required in profile schema
2. Add warnings when fallback calculations used
3. Add metrics for compression timing
4. Monitor compression success rate

## Related Documents
- **Bugs & Fixes:** `.dev/ContextCompression-BugsFixes.md`
- **Design Guide:** `.dev/dev_ContextCompression.md`
- **Bug Reports:** `.dev/llm_bug.md`, `.dev/llm_fixes.md`, `.dev/llm_fixes2.md`
