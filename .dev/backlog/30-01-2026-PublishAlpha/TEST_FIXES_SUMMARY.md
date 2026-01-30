# Test Suite Fixes Summary

## Phase 2.3: Test Suite Fixes - Progress Report

**Date:** January 30, 2026  
**Status:** In Progress  
**Tests Fixed:** 17 out of 99 failing tests  
**Remaining:** 82 failing tests

---

## ✅ Completed Fixes

### 1. Tier-Aware Compression Tests (FIXED - 12 tests)

**File:** `packages/core/src/context/integration/__tests__/tierAwareCompression.test.ts`

**Issue:** Tests expected old hardcoded tier budget values (200, 500, 1000, 1500) but implementation now uses dynamic calculation based on context size.

**Root Cause:** Implementation was updated to calculate budgets dynamically:

- Tier 1: 12% of context (min 450) = 983 tokens for 8K context
- Tier 2: 9% of context (min 700) = 737 tokens for 8K context
- Tier 3: 6% of context (min 1000) = 1000 tokens for 8K context
- Tier 4: 5% of context (min 1500) = 1500 tokens for 8K context

**Fix Applied:**

- Updated all test expectations to match new dynamic budget calculations
- Added `contextSize` parameter to all method calls
- Updated comments to reflect new budget values

**Result:** ✅ All 30 tests passing

---

### 2. Provider-Aware Compression Tests (FIXED - 5 tests)

**File:** `packages/core/src/context/integration/__tests__/providerAwareCompression.test.ts`

**Issue:** Tests were passing `tierBudget` parameter to methods that no longer accept it.

**Root Cause:** Method signatures changed:

- `shouldCompress(currentTokens, modelId, systemPromptTokens)` - removed `tierBudget` parameter
- `getCompressionUrgency(currentTokens, modelId, systemPromptTokens)` - removed `tierBudget` parameter

**Fix Applied:**

- Removed `tierBudget` parameter from all test calls
- Updated calculations to match new logic (tier budget is NOT subtracted from available space)
- Fixed test expectations to use correct threshold calculations

**Result:** ✅ All 54 tests passing

---

## ❌ Remaining Issues

### 1. ChatClient Tests (82 failing tests)

**File:** `packages/core/src/core/__tests__/chatClient.test.ts`

**Issue:** "Context manager not initialized" error

**Root Cause:** ChatClient now requires `contextMgmtManager` in config or `contextSize`/`ollamaContextSize` in options:

```typescript
// From chatClient.ts line 107-115
if (!options?.contextSize || !options?.ollamaContextSize) {
  if (!this.contextMgmtManager) {
    throw new Error('[ChatClient] Context manager not initialized');
  }
  // ... get values from contextMgmtManager
}
```

**Affected Test Categories:**

- Property-Based Tests (Event Stream Forwarding, Abort Signal, Max Turns)
- Unit Tests (Single Turn, Multiple Turns, Error Handling)
- Session Recording Integration
- Compression Service Integration
- Loop Detection Integration
- Context Manager Integration

**Proposed Fix:**
Two options:

1. **Option A:** Mock `contextMgmtManager` in all tests
2. **Option B:** Pass `contextSize` and `ollamaContextSize` in chat options for tests that don't need context management

**Recommendation:** Use Option B for most tests (simpler), Option A only for tests specifically testing context management features.

---

## Next Steps

### Immediate Actions:

1. Fix ChatClient tests by adding context size options to chat calls
2. Create mock `contextMgmtManager` for tests that need it
3. Run full test suite again to identify any remaining issues

### Test Fix Strategy:

```typescript
// For simple tests - add options
const events = await collectEvents(
  client.chat('test prompt', {
    contextSize: 8192,
    ollamaContextSize: 6963,
  })
);

// For context management tests - add mock manager
const mockContextMgr = {
  getUsage: () => ({ contextSize: 8192 }),
  getOllamaContextLimit: () => 6963,
};

const client = new ChatClient(providerRegistry, toolRegistry, {
  contextMgmtManager: mockContextMgr,
});
```

---

## Test Suite Statistics

### Before Fixes:

- **Total Tests:** 1596
- **Failing:** 99
- **Passing:** 1497
- **Pass Rate:** 93.8%

### After Tier/Provider Fixes:

- **Total Tests:** 1596
- **Failing:** 82
- **Passing:** 1514
- **Pass Rate:** 94.9%

### Target:

- **Total Tests:** 1596
- **Failing:** 0
- **Passing:** 1596
- **Pass Rate:** 100%

---

## Files Modified

### ✅ Fixed:

1. `packages/core/src/context/integration/__tests__/tierAwareCompression.test.ts`
2. `packages/core/src/context/integration/__tests__/providerAwareCompression.test.ts`

### 🔄 Needs Fixing:

1. `packages/core/src/core/__tests__/chatClient.test.ts` (82 failing tests)
2. Other integration tests (TBD after chatClient fixes)

---

## Lessons Learned

1. **Dynamic Budget Calculation:** Tier budgets are now calculated as percentages of context size, not hardcoded values
2. **Method Signature Changes:** `tierBudget` parameter removed from compression methods - tier budget is already included in `systemPromptTokens`
3. **Context Manager Requirement:** ChatClient now requires either `contextMgmtManager` or explicit context size values
4. **Test Maintenance:** When implementation changes, tests need comprehensive updates to match new behavior

---

## Time Estimate

- **ChatClient Test Fixes:** 30-45 minutes
- **Verification & Cleanup:** 15 minutes
- **Total Remaining:** ~1 hour

---

## Notes

- All tier-aware and provider-aware compression tests are now passing
- The remaining failures are concentrated in chatClient tests
- Once chatClient tests are fixed, we should have a clean test suite
- Some integration tests may also need updates after chatClient fixes
