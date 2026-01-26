# Context Management Test Suite Audit
**Date:** 2026-01-20  
**Status:** 🟡 Tests Need Updates  
**Purpose:** Identify outdated, missing, and broken tests

---

## 📋 EXECUTIVE SUMMARY

The Context Management test suite has **17 test files** with comprehensive coverage, but several tests are **outdated** or **testing non-existent functions** due to recent code changes. Additionally, **new features are not tested**.

### **Key Findings:**
1. ✅ **Good Coverage:** Property-based tests for core functionality
2. ❌ **Outdated Tests:** 2 intentionally failing tests need updates
3. ❌ **Missing Tests:** New features (auto-summary, inflight tokens, retry logic) not tested
4. ⚠️ **API Mismatches:** Tests reveal compression service API inconsistencies

---

## 📊 TEST FILE INVENTORY

### **Core Context Tests (17 files)**

#### **✅ Working Tests:**
1. `contextManager.test.ts` (392 lines)
   - Property-based tests for configuration
   - Unit tests for basic operations
   - **Status:** ✅ Passing

2. `snapshotManager.test.ts` (597 lines)
   - Comprehensive snapshot tests
   - Property-based tests for round-trip
   - **Status:** ✅ Passing

3. `compressionService.test.ts` (529 lines)
   - Tests for truncate, summarize, hybrid strategies
   - Inflation guard tests
   - **Status:** ✅ Passing

4. `contextPool.test.ts`
   - Context pool management tests
   - **Status:** ✅ Passing

5. `memoryGuard.test.ts`
   - Memory guard threshold tests
   - **Status:** ✅ Passing

6. `tokenCounter.test.ts`
   - Token counting tests
   - **Status:** ✅ Passing

7. `vramMonitor.test.ts`
   - VRAM monitoring tests
   - **Status:** ✅ Passing

8. `snapshotStorage.test.ts`
   - Snapshot storage tests
   - **Status:** ✅ Passing

9. `jitDiscovery.test.ts`
   - JIT context discovery tests
   - **Status:** ✅ Passing

10. `integration.test.ts`
    - Integration tests
    - **Status:** ✅ Passing

11. `dynamicSizing.integration.test.ts`
    - Dynamic sizing integration tests
    - **Status:** ✅ Passing

#### **❌ Intentionally Failing Tests (Need Updates):**

12. **`compression-api-mismatch.test.ts`** (32 lines)
    - **Purpose:** Demonstrates API mismatch between compression services
    - **Status:** ❌ Intentionally failing
    - **Issue:** Tests the mismatch we just fixed!
    - **Action Needed:** Update or remove after API consolidation

13. **`memoryGuard.enforce-compress-signature.test.ts`** (58 lines)
    - **Purpose:** Enforces correct compression signature in MemoryGuard
    - **Status:** ❌ Intentionally failing
    - **Issue:** Tests the bug we just fixed!
    - **Action Needed:** Update to verify correct signature is now used

#### **⚠️ Platform-Specific Tests:**

14. `snapshotStorage.windows.test.ts`
    - Windows-specific snapshot storage tests
    - **Status:** ⚠️ May not run on all platforms

#### **📝 Other Tests:**

15. `types.test.ts`
    - Type definition tests
    - **Status:** ✅ Passing

16. `property-test-example.test.ts`
    - Example property-based test
    - **Status:** ✅ Passing

17. `memoryGuard.warning.test.ts`
    - Memory guard warning tests
    - **Status:** ✅ Passing

---

## 🔍 DETAILED AUDIT FINDINGS

### **1. Tests for Non-Existent/Changed Functions**

#### **❌ `compression-api-mismatch.test.ts`**
**Problem:** Tests API mismatch that we just fixed

**Current Test:**
```typescript
// Tests that shouldCompress has different behavior with different args
const chatClientStyleCall = (service as any).shouldCompress(sessionMessages, tokenLimit, threshold);
expect(chatClientStyleCall).not.toBe(expectTrue);
```

**Issue:** This test was written to demonstrate the bug, but now that we've fixed the MemoryGuard to call compression correctly, this test is outdated.

**Action Needed:**
- ✅ **Option A:** Remove this test (bug is fixed)
- ✅ **Option B:** Update to verify correct API is used
- ❌ **Option C:** Keep as regression test

**Recommendation:** Remove or update to test that the correct signature is now used everywhere.

---

#### **❌ `memoryGuard.enforce-compress-signature.test.ts`**
**Problem:** Tests that MemoryGuard calls compression with correct signature

**Current Test:**
```typescript
// Assert: Should have been called with (messages[], strategy)
expect(mockCompression.compress).toHaveBeenCalled();
const args = mockCompression.compress.mock.calls[0];
expect(Array.isArray(args[0])).toBe(true); // messages[]
expect(args[1]).toBeDefined(); // strategy
```

**Issue:** This test was intentionally failing to demonstrate the bug. Now that we've fixed it (Fix 3), this test should pass!

**Action Needed:**
- ✅ **Update test expectations** - Test should now PASS
- ✅ **Remove "failing test" comment**
- ✅ **Move to regular test suite**

**Recommendation:** Update and verify it now passes with our fixes.

---

### **2. Missing Tests for New Features**

#### **❌ No Tests for Auto-Summary Feature**
**Missing:** Tests for auto-summary at 80% threshold

**What's Not Tested:**
- Auto-summary trigger at 80% threshold
- `auto-summary-created` event emission
- `auto-summary-failed` event emission
- Snapshot creation before summary
- Summary message format
- Resume behavior after summary

**Recommendation:** Add integration test:
```typescript
describe('Auto-Summary Feature', () => {
  it('should trigger auto-summary at 80% threshold', async () => {
    const manager = createContextManager('test', modelInfo, {
      snapshots: { autoCreate: true, autoThreshold: 0.8 }
    });
    
    // Fill context to 80%
    // Verify auto-summary-created event
    // Verify snapshot created
    // Verify summary message added
  });
});
```

---

#### **❌ No Tests for Inflight Token Accounting**
**Missing:** Tests for `reportInflightTokens()` and `clearInflightTokens()`

**What's Not Tested:**
- Inflight token accumulation
- Threshold checks including inflight tokens
- Clearing inflight tokens
- Mutex protection for flush operations

**Recommendation:** Add unit tests:
```typescript
describe('Inflight Token Accounting', () => {
  it('should include inflight tokens in threshold checks', () => {
    const manager = createContextManager('test', modelInfo);
    
    manager.reportInflightTokens(100);
    // Verify threshold check includes inflight tokens
    
    manager.clearInflightTokens();
    // Verify inflight tokens cleared
  });
});
```

---

#### **❌ No Tests for Resume Loop Prevention**
**Missing:** Tests for retry counter and max attempts

**What's Not Tested:**
- Retry counter increments
- Max 3 retry attempts
- Error message after max retries
- Counter reset on successful summary

**Recommendation:** Add integration test:
```typescript
describe('Resume Loop Prevention', () => {
  it('should stop after 3 failed resume attempts', async () => {
    // Simulate failing compression
    // Trigger resume 3 times
    // Verify error message on 4th attempt
    // Verify no infinite loop
  });
});
```

---

#### **❌ No Tests for Floating-Point Threshold Fix**
**Missing:** Tests for epsilon comparison

**What's Not Tested:**
- Epsilon comparison for thresholds
- Callback deduplication
- Threshold callback firing

**Recommendation:** Add unit test:
```typescript
describe('Threshold Comparison', () => {
  it('should use epsilon comparison for floating-point thresholds', () => {
    const manager = createSnapshotManager(storage, {
      autoThreshold: 0.8,
      autoCreate: true
    });
    
    const callback = vi.fn();
    manager.onContextThreshold(0.8, callback);
    
    // Should trigger even with floating-point precision issues
    manager.checkThresholds(800, 1000); // Exactly 0.8
    expect(callback).toHaveBeenCalled();
  });
});
```

---

#### **❌ No Tests for Normalized Threshold Units**
**Missing:** Tests for consistent fraction usage

**What's Not Tested:**
- Threshold comparisons use fractions (0.0-1.0)
- No mixing of fractions and percentages
- Correct calculation

**Recommendation:** Add unit test:
```typescript
describe('Threshold Units', () => {
  it('should use fractions consistently for thresholds', () => {
    const manager = createContextManager('test', modelInfo, {
      compression: { threshold: 0.6 } // Fraction, not 60
    });
    
    // Verify compression triggers at 60% (0.6 fraction)
    // Not at 6000% (0.6 * 100)
  });
});
```

---

### **3. Tests That May Be Outdated**

#### **⚠️ `contextManager.test.ts` - Missing New Methods**
**Issue:** Tests don't cover new methods added during development

**Missing Coverage:**
- `reportInflightTokens(delta: number)`
- `clearInflightTokens()`
- `setActiveSkills(skills: string[])`
- `setActiveHooks(hooks: string[])`
- `setActiveMcpServers(servers: string[])`
- `setActiveTools(tools: string[])`

**Recommendation:** Add unit tests for these methods.

---

#### **⚠️ `snapshotManager.test.ts` - Missing Cooldown Tests**
**Issue:** No tests for auto-summary cooldown guard

**Missing Coverage:**
- 5-second cooldown after auto-summary
- Reentrancy guard
- Multiple rapid threshold triggers

**Recommendation:** Add test:
```typescript
describe('Auto-Summary Cooldown', () => {
  it('should prevent rapid auto-summary triggers', async () => {
    // Trigger auto-summary
    // Immediately trigger again
    // Verify second trigger is ignored (within 5s cooldown)
  });
});
```

---

### **4. Tests That Need Updates**

#### **🔧 Update Needed: `memoryGuard.enforce-compress-signature.test.ts`**
**Current Status:** Intentionally failing  
**Expected After Fix:** Should pass

**Changes Needed:**
```typescript
// BEFORE:
describe('MemoryGuard compression signature enforcement (failing test)', () => {
  it('must call compression.compress(messages[], strategy) on WARNING', async () => {
    // ... test code ...
    // This WILL fail with current code
  });
});

// AFTER:
describe('MemoryGuard compression signature enforcement', () => {
  it('calls compression.compress(messages[], strategy) on WARNING', async () => {
    // ... test code ...
    // This should now PASS with our fixes
  });
});
```

**Action:** Remove "(failing test)" comment and verify test passes.

---

#### **🔧 Update Needed: `compression-api-mismatch.test.ts`**
**Current Status:** Demonstrates API mismatch  
**Expected After Fix:** No longer relevant

**Options:**
1. **Remove entirely** - Bug is fixed, test is obsolete
2. **Convert to regression test** - Verify correct API is used
3. **Update to test unified API** - After service consolidation

**Recommendation:** Remove this test file after verifying the fix works.

---

## 📈 TEST COVERAGE ANALYSIS

### **Current Coverage:**

| Component | Test File | Coverage | Status |
|-----------|-----------|----------|--------|
| **ContextManager** | contextManager.test.ts | 🟡 Partial | Missing new methods |
| **SnapshotManager** | snapshotManager.test.ts | ✅ Good | Missing cooldown tests |
| **CompressionService** | compressionService.test.ts | ✅ Good | Complete |
| **ContextPool** | contextPool.test.ts | ✅ Good | Complete |
| **MemoryGuard** | memoryGuard.test.ts | 🟡 Partial | Missing signature test update |
| **TokenCounter** | tokenCounter.test.ts | ✅ Good | Complete |
| **VRAMMonitor** | vramMonitor.test.ts | ✅ Good | Complete |
| **SnapshotStorage** | snapshotStorage.test.ts | ✅ Good | Complete |
| **JIT Discovery** | jitDiscovery.test.ts | ✅ Good | Complete |

### **Missing Coverage:**

| Feature | Status | Priority |
|---------|--------|----------|
| **Auto-Summary (80%)** | ❌ No tests | 🔴 HIGH |
| **Inflight Tokens** | ❌ No tests | 🟡 MEDIUM |
| **Resume Loop Prevention** | ❌ No tests | 🔴 HIGH |
| **Epsilon Threshold Comparison** | ❌ No tests | 🟡 MEDIUM |
| **Normalized Threshold Units** | ❌ No tests | 🟢 LOW |
| **Auto-Summary Cooldown** | ❌ No tests | 🟡 MEDIUM |
| **Retry Counter** | ❌ No tests | 🔴 HIGH |
| **Mutex Protection** | ❌ No tests | 🟡 MEDIUM |

---

## 🎯 RECOMMENDED ACTIONS

### **Priority 1: Update Failing Tests (Immediate)**

1. **Update `memoryGuard.enforce-compress-signature.test.ts`**
   - Remove "(failing test)" comment
   - Verify test now passes with Fix 3
   - Move to regular test suite

2. **Remove or Update `compression-api-mismatch.test.ts`**
   - Bug is fixed, test is obsolete
   - Either remove or convert to regression test

**Estimated Time:** 30 minutes

---

### **Priority 2: Add Tests for New Features (This Week)**

3. **Add Auto-Summary Integration Test**
   - Test 80% threshold trigger
   - Test event emission
   - Test snapshot creation
   - Test summary message format

4. **Add Resume Loop Prevention Test**
   - Test retry counter
   - Test max 3 attempts
   - Test error message
   - Test counter reset

5. **Add Inflight Token Tests**
   - Test accumulation
   - Test threshold checks
   - Test clearing
   - Test mutex protection

**Estimated Time:** 4-6 hours

---

### **Priority 3: Add Tests for Bug Fixes (Next Week)**

6. **Add Epsilon Comparison Test**
   - Test floating-point threshold matching
   - Test callback deduplication

7. **Add Normalized Threshold Test**
   - Test consistent fraction usage
   - Test correct calculations

8. **Add Cooldown Guard Test**
   - Test 5-second cooldown
   - Test reentrancy prevention

**Estimated Time:** 2-3 hours

---

### **Priority 4: Update Existing Tests (Later)**

9. **Add Missing Method Tests to `contextManager.test.ts`**
   - Test `reportInflightTokens()`
   - Test `clearInflightTokens()`
   - Test `setActiveSkills()`, `setActiveHooks()`, etc.

10. **Add Edge Case Tests**
    - Test boundary conditions
    - Test error handling
    - Test race conditions

**Estimated Time:** 3-4 hours

---

## 📋 TEST UPDATE CHECKLIST

### **Immediate (Today):**
- [ ] Update `memoryGuard.enforce-compress-signature.test.ts`
- [ ] Remove or update `compression-api-mismatch.test.ts`
- [ ] Run tests to verify fixes don't break existing tests
- [ ] Document any test failures

### **This Week:**
- [ ] Add auto-summary integration test
- [ ] Add resume loop prevention test
- [ ] Add inflight token tests
- [ ] Add epsilon comparison test
- [ ] Add normalized threshold test

### **Next Week:**
- [ ] Add cooldown guard test
- [ ] Add mutex protection test
- [ ] Update contextManager tests for new methods
- [ ] Add edge case tests
- [ ] Review test coverage report

---

## 🎉 SUCCESS CRITERIA

### **Tests are Up-to-Date When:**
- ✅ All intentionally failing tests are updated or removed
- ✅ New features have integration tests
- ✅ Bug fixes have regression tests
- ✅ All tests pass
- ✅ Coverage is >80% for critical paths

### **Test Suite is Complete When:**
- ✅ Auto-summary feature is tested
- ✅ Resume loop prevention is tested
- ✅ Inflight token accounting is tested
- ✅ Threshold comparison fixes are tested
- ✅ All new methods have unit tests
- ✅ Edge cases are covered

---

## 📊 SUMMARY

### **Current State:**
- **Total Test Files:** 17
- **Passing Tests:** 15 ✅
- **Failing Tests:** 2 ❌ (intentionally)
- **Missing Tests:** 8 major features ❌
- **Outdated Tests:** 2 files need updates ⚠️

### **After Updates:**
- **Expected Passing:** 17 ✅
- **Expected Failing:** 0 ❌
- **New Tests Needed:** 8 test suites
- **Estimated Effort:** 10-14 hours

---

**Document Status:** ✅ Complete  
**Created:** 2026-01-20  
**Purpose:** Guide test suite updates  
**Next Action:** Update failing tests, then add new tests
