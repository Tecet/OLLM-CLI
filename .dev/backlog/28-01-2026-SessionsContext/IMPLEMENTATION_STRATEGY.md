# Implementation Strategy - Sessions/Context Improvements

**Created:** January 28, 2026  
**Status:** Ready to Execute  
**Approach:** Surgical, Conservative, Thoroughly Tested

---

## Overview

This document outlines our careful, methodical approach to implementing the improvements identified in the sessions/context audit. We will proceed with **extreme caution**, backing up files, testing after every change, and committing frequently.

---

## Core Principles

### 🎯 Our Approach

1. **No Cutting Corners**
   - Every change is thoroughly reviewed
   - Every change is tested
   - Every change is documented
   - Every change is committed

2. **Backup Everything**
   - Create backup of original file before ANY changes
   - Keep backup until all tests pass
   - Document what was changed and why

3. **Test After Every Step**
   - Run full test suite (615 tests) after each change
   - Run lint after each change
   - Manual testing for UI changes
   - No exceptions

4. **Commit Frequently**
   - Commit after each completed sub-task
   - Clear, descriptive commit messages
   - Push to GitHub after each major milestone
   - Easy to revert if needed

5. **One Task at a Time**
   - Complete one task fully before starting next
   - Don't mix concerns
   - Clear separation between tasks
   - Document completion

---

## Implementation Phases

### Phase 1: Critical (REQUIRED before v1.0)

**Timeline:** 1 day (4-6 hours)  
**Risk Level:** Medium  
**Tasks:** 1 task (TASK-001)

#### TASK-001: Refactor ModelContext.tsx

**Current State:**
- File: `packages/cli/src/ui/contexts/ModelContext.tsx`
- Size: 883 lines
- Issues: Too many responsibilities, hard to test

**Target State:**
- Main file: ~400-500 lines
- 3 new hook files: ~550 lines total
- Clear separation of concerns
- Independently testable

**Step-by-Step Approach:**

##### Step 1: Backup Original File (5 minutes)
```bash
# Create backup
cp packages/cli/src/ui/contexts/ModelContext.tsx packages/cli/src/ui/contexts/ModelContext.tsx.backup

# Verify backup
diff packages/cli/src/ui/contexts/ModelContext.tsx packages/cli/src/ui/contexts/ModelContext.tsx.backup
```

**Commit:** `backup: Create backup of ModelContext.tsx before refactoring`

---

##### Step 2: Extract useModelManagement Hook (1.5-2 hours)

**What to Extract:**
- Model loading/unloading functions
- Model listing functions
- Model validation functions
- Model metadata functions

**Process:**
1. Read ModelContext.tsx carefully
2. Identify all model management code
3. Create `packages/cli/src/ui/contexts/hooks/useModelManagement.ts`
4. Copy model management code to new file
5. Add proper imports and exports
6. Update ModelContext.tsx to use new hook
7. **TEST:** Run all 615 tests
8. **TEST:** Run lint
9. **TEST:** Manual UI testing (model switching, loading)
10. **COMMIT:** `refactor: Extract useModelManagement hook from ModelContext`

**Expected File Structure:**
```typescript
// packages/cli/src/ui/contexts/hooks/useModelManagement.ts
export function useModelManagement() {
  // Model loading
  const loadModel = useCallback(...);
  const unloadModel = useCallback(...);
  
  // Model listing
  const listModels = useCallback(...);
  const refreshModels = useCallback(...);
  
  // Model validation
  const validateModel = useCallback(...);
  
  // Model metadata
  const getModelMetadata = useCallback(...);
  
  return {
    loadModel,
    unloadModel,
    listModels,
    refreshModels,
    validateModel,
    getModelMetadata,
  };
}
```

**Testing Checklist:**
- [ ] All 615 tests pass
- [ ] Lint passes (0 errors)
- [ ] Can switch models in UI
- [ ] Can load new models
- [ ] Model metadata displays correctly
- [ ] No console errors

---

##### Step 3: Extract useProviderManagement Hook (1-1.5 hours)

**What to Extract:**
- Provider initialization
- Provider switching
- Provider health checks
- Provider configuration

**Process:**
1. Identify all provider management code
2. Create `packages/cli/src/ui/contexts/hooks/useProviderManagement.ts`
3. Copy provider management code to new file
4. Add proper imports and exports
5. Update ModelContext.tsx to use new hook
6. **TEST:** Run all 615 tests
7. **TEST:** Run lint
8. **TEST:** Manual UI testing (provider switching)
9. **COMMIT:** `refactor: Extract useProviderManagement hook from ModelContext`

**Expected File Structure:**
```typescript
// packages/cli/src/ui/contexts/hooks/useProviderManagement.ts
export function useProviderManagement() {
  // Provider initialization
  const initProvider = useCallback(...);
  
  // Provider switching
  const switchProvider = useCallback(...);
  
  // Provider health
  const checkProviderHealth = useCallback(...);
  
  // Provider config
  const getProviderConfig = useCallback(...);
  const updateProviderConfig = useCallback(...);
  
  return {
    initProvider,
    switchProvider,
    checkProviderHealth,
    getProviderConfig,
    updateProviderConfig,
  };
}
```

**Testing Checklist:**
- [ ] All 615 tests pass
- [ ] Lint passes (0 errors)
- [ ] Can switch providers
- [ ] Provider health checks work
- [ ] Provider config updates work
- [ ] No console errors

---

##### Step 4: Extract useStreamHandling Hook (1.5-2 hours)

**What to Extract:**
- Stream processing
- Token counting
- Error handling
- Completion handling

**Process:**
1. Identify all stream handling code
2. Create `packages/cli/src/ui/contexts/hooks/useStreamHandling.ts`
3. Copy stream handling code to new file
4. Add proper imports and exports
5. Update ModelContext.tsx to use new hook
6. **TEST:** Run all 615 tests
7. **TEST:** Run lint
8. **TEST:** Manual UI testing (streaming responses)
9. **COMMIT:** `refactor: Extract useStreamHandling hook from ModelContext`

**Expected File Structure:**
```typescript
// packages/cli/src/ui/contexts/hooks/useStreamHandling.ts
export function useStreamHandling() {
  // Stream processing
  const processStream = useCallback(...);
  const handleStreamChunk = useCallback(...);
  
  // Token counting
  const countTokens = useCallback(...);
  const updateTokenCount = useCallback(...);
  
  // Error handling
  const handleStreamError = useCallback(...);
  
  // Completion
  const handleStreamComplete = useCallback(...);
  
  return {
    processStream,
    handleStreamChunk,
    countTokens,
    updateTokenCount,
    handleStreamError,
    handleStreamComplete,
  };
}
```

**Testing Checklist:**
- [ ] All 615 tests pass
- [ ] Lint passes (0 errors)
- [ ] Streaming responses work
- [ ] Token counting accurate
- [ ] Error handling works
- [ ] Completion callbacks fire
- [ ] No console errors

---

##### Step 5: Final Cleanup and Verification (30 minutes)

**Process:**
1. Review ModelContext.tsx for any remaining cleanup
2. Ensure all imports are correct
3. Ensure all exports are correct
4. Remove any dead code
5. **TEST:** Run all 615 tests
6. **TEST:** Run lint
7. **TEST:** Full manual UI testing
8. **COMMIT:** `refactor: Final cleanup of ModelContext.tsx refactoring`

**Final Verification Checklist:**
- [ ] ModelContext.tsx is ~400-500 lines
- [ ] All 3 hooks created and working
- [ ] All 615 tests pass
- [ ] Lint passes (0 errors, 1 warning)
- [ ] All UI functionality works
- [ ] No regressions
- [ ] Code is cleaner and more maintainable

---

##### Step 6: Remove Backup (5 minutes)

**Process:**
1. Verify everything works perfectly
2. Remove backup file
3. **COMMIT:** `cleanup: Remove ModelContext.tsx backup after successful refactoring`
4. **PUSH:** Push all commits to GitHub

---

### Phase 2: High Priority (Soon After v1.0)

**Timeline:** 1 day (5-7 hours)  
**Risk Level:** Low  
**Tasks:** 2 tasks (TASK-002, TASK-003)

#### TASK-002: Add Tests for Snapshot System (2-3 hours)

**Approach:**

##### Step 1: Create snapshotCoordinator.test.ts (1-1.5 hours)

**Process:**
1. Create `packages/core/src/context/__tests__/snapshotCoordinator.test.ts`
2. Write tests for coordination logic
3. Write tests for snapshot triggers
4. Write tests for integration with context manager
5. **TEST:** Run new tests
6. **TEST:** Run all 615+ tests
7. **COMMIT:** `test: Add comprehensive tests for snapshotCoordinator`

**Test Coverage:**
- Coordination with context manager
- Snapshot creation triggers
- Snapshot restoration
- Error handling
- Edge cases

---

##### Step 2: Create intentSnapshotStorage.test.ts (1-1.5 hours)

**Process:**
1. Create `packages/core/src/context/__tests__/intentSnapshotStorage.test.ts`
2. Write tests for mode transition snapshots
3. Write tests for hot swap state preservation
4. Write tests for cache eviction
5. Write tests for auto-pruning
6. **TEST:** Run new tests
7. **TEST:** Run all 615+ tests
8. **COMMIT:** `test: Add comprehensive tests for intentSnapshotStorage`

**Test Coverage:**
- Mode transition snapshots
- Hot swap state preservation
- Cache eviction (LRU)
- Auto-pruning (1 hour TTL)
- Edge cases

---

#### TASK-003: Add Tests for Compression System (3-4 hours)

**Approach:**

##### Step 1: Create compressionCoordinator.test.ts (1.5-2 hours)

**Process:**
1. Create `packages/core/src/context/__tests__/compressionCoordinator.test.ts`
2. Write tests for coordination logic
3. Write tests for strategy selection
4. Write tests for threshold triggers
5. Write tests for integration with context manager
6. **TEST:** Run new tests
7. **TEST:** Run all 615+ tests
8. **COMMIT:** `test: Add comprehensive tests for compressionCoordinator`

**Test Coverage:**
- Coordination logic
- Strategy selection (aggressive, moderate, conservative)
- Threshold triggers (75%, 80%, 85%)
- Integration with context manager
- Error handling

---

##### Step 2: Create chatCompressionService.test.ts (1.5-2 hours)

**Process:**
1. Create `packages/cli/src/services/__tests__/chatCompressionService.test.ts`
2. Write tests for message compression
3. Write tests for checkpoint creation
4. Write tests for rollback functionality
5. Write tests for error handling
6. **TEST:** Run new tests
7. **TEST:** Run all 615+ tests
8. **COMMIT:** `test: Add comprehensive tests for chatCompressionService`

**Test Coverage:**
- Message compression
- Checkpoint creation
- Checkpoint rollback
- Error handling
- Edge cases

---

### Phase 3: Medium Priority (Post-v1.0)

**Timeline:** 1 day (4-7 hours)  
**Risk Level:** Low  
**Tasks:** 3 tasks (TASK-004, TASK-005, TASK-006)

#### TASK-004: Extract Checkpoint Utilities (1-2 hours)

**Approach:**

##### Step 1: Create checkpointUtils.ts (1-2 hours)

**Process:**
1. Backup `compressionService.ts`
2. Create `packages/core/src/context/checkpointUtils.ts`
3. Extract utility functions:
   - `findCheckpointById()`
   - `findCheckpointByTimestamp()`
   - `sortCheckpointsByAge()`
   - `validateCheckpoint()`
4. Update `compressionService.ts` to use utilities
5. **TEST:** Run all tests
6. **TEST:** Run lint
7. **COMMIT:** `refactor: Extract checkpoint utilities to separate file`

---

#### TASK-005: Extract Snapshot Utilities (1-2 hours)

**Approach:**

##### Step 1: Create snapshotUtils.ts (1-2 hours)

**Process:**
1. Backup `snapshotManager.ts`
2. Create `packages/core/src/context/snapshotUtils.ts`
3. Extract utility functions:
   - `validateSnapshot()`
   - `sortSnapshotsByAge()`
   - `filterSnapshotsBySession()`
   - `calculateSnapshotSize()`
4. Update `snapshotManager.ts` to use utilities
5. **TEST:** Run all tests
6. **TEST:** Run lint
7. **COMMIT:** `refactor: Extract snapshot utilities to separate file`

---

#### TASK-006: Add JSDoc Comments (2-3 hours)

**Approach:**

##### Step 1: Add JSDoc to Compression Files (1 hour)

**Process:**
1. Add JSDoc to `compressionService.ts`
2. Add JSDoc to `compressionCoordinator.ts`
3. Add JSDoc to `chatCompressionService.ts`
4. **TEST:** Run lint
5. **COMMIT:** `docs: Add JSDoc comments to compression system`

---

##### Step 2: Add JSDoc to Snapshot Files (1 hour)

**Process:**
1. Add JSDoc to `snapshotManager.ts`
2. Add JSDoc to `snapshotStorage.ts`
3. Add JSDoc to `snapshotCoordinator.ts`
4. Add JSDoc to `intentSnapshotStorage.ts`
5. **TEST:** Run lint
6. **COMMIT:** `docs: Add JSDoc comments to snapshot system`

---

##### Step 3: Add JSDoc to Context Management Files (30 minutes)

**Process:**
1. Add JSDoc to `contextManager.ts`
2. Add JSDoc to `ContextManagerContext.tsx`
3. Add JSDoc to `contextPool.ts`
4. **TEST:** Run lint
5. **COMMIT:** `docs: Add JSDoc comments to context management system`

---

### Phase 4: Low Priority (Future)

**Timeline:** 2-3 days (11-16 hours)  
**Risk Level:** Low  
**Tasks:** 4 tasks (TASK-007, TASK-008, TASK-009, TASK-010)

**Note:** These tasks can be done later, after v1.0 release. They are optimizations and enhancements, not critical fixes.

---

## Testing Strategy

### Test Levels

#### 1. Unit Tests
- Test individual functions
- Test edge cases
- Test error handling
- Fast execution

#### 2. Integration Tests
- Test component interactions
- Test data flow
- Test state management
- Medium execution time

#### 3. End-to-End Tests
- Test full user workflows
- Test UI interactions
- Test real scenarios
- Slower execution

### Test Execution

**After Every Change:**
```bash
# Run all tests
npm test

# Run lint
npm run lint

# Check test count
# Should be 615+ (increasing as we add tests)
```

**Manual Testing Checklist:**
- [ ] Start application
- [ ] Switch models
- [ ] Send messages
- [ ] Check streaming
- [ ] Check token counting
- [ ] Check context management
- [ ] Check compression
- [ ] Check snapshots
- [ ] No console errors
- [ ] No UI glitches

---

## Commit Strategy

### Commit Message Format

```
<type>: <subject>

<body>

<footer>
```

**Types:**
- `feat:` - New feature
- `fix:` - Bug fix
- `refactor:` - Code refactoring
- `test:` - Adding tests
- `docs:` - Documentation
- `style:` - Code style (formatting)
- `chore:` - Maintenance
- `backup:` - Creating backups
- `cleanup:` - Removing backups/cleanup

**Examples:**
```
refactor: Extract useModelManagement hook from ModelContext

- Created new hook file with ~200 lines
- Moved model loading/unloading logic
- Moved model listing logic
- Moved model validation logic
- Updated ModelContext to use new hook
- All 615 tests passing
- No functionality changes

Ref: TASK-001 Step 2
```

### Commit Frequency

**Commit After:**
- Each completed sub-step
- Each successful test run
- Each backup creation
- Each backup removal
- Each major milestone

**Push to GitHub After:**
- Each completed task
- Each completed phase
- End of work session

---

## Rollback Strategy

### If Tests Fail

1. **Don't Panic**
   - Tests failing is expected sometimes
   - We have backups
   - We can revert

2. **Investigate**
   - Read test output carefully
   - Identify what broke
   - Check if it's a real issue or test issue

3. **Fix or Revert**
   - If simple fix: Fix and re-test
   - If complex issue: Revert to backup
   - Document what went wrong

4. **Learn**
   - Update this document with lessons learned
   - Adjust approach for next attempt
   - Share knowledge with team

### Revert Process

```bash
# Revert to backup
cp packages/cli/src/ui/contexts/ModelContext.tsx.backup packages/cli/src/ui/contexts/ModelContext.tsx

# Verify revert
npm test

# Commit revert
git add packages/cli/src/ui/contexts/ModelContext.tsx
git commit -m "revert: Restore ModelContext.tsx from backup due to test failures"

# Document issue
# Add notes to IMPLEMENTATION_STRATEGY.md about what went wrong
```

---

## Success Metrics

### Phase 1 Success
- [ ] ModelContext.tsx reduced to ~400-500 lines
- [ ] 3 new hook files created
- [ ] All 615 tests passing
- [ ] Lint clean (0 errors, 1 warning)
- [ ] No functionality regressions
- [ ] Code is more maintainable

### Phase 2 Success
- [ ] 50+ new tests added
- [ ] All new tests passing
- [ ] 100% coverage for snapshot system
- [ ] 100% coverage for compression system
- [ ] All 665+ tests passing

### Phase 3 Success
- [ ] Utility functions extracted
- [ ] JSDoc comments added
- [ ] Code quality improved
- [ ] All tests passing

### Phase 4 Success
- [ ] Performance baseline established
- [ ] Metrics collection working
- [ ] Compression tuned
- [ ] Snapshot compression working

---

## Risk Mitigation

### Medium Risk: TASK-001 (ModelContext Refactoring)

**Risks:**
- Breaking UI functionality
- Breaking model switching
- Breaking streaming
- Introducing regressions

**Mitigation:**
1. **Backup:** Create backup before ANY changes
2. **Incremental:** Extract one hook at a time
3. **Testing:** Test after each hook extraction
4. **Manual:** Manual UI testing after each change
5. **Revert:** Easy to revert with backup

### Low Risk: All Other Tasks

**Risks:**
- Test failures
- Lint errors
- Minor issues

**Mitigation:**
1. **Additive:** Only adding code, not changing existing
2. **Testing:** Test after each change
3. **Review:** Code review before commit
4. **Revert:** Easy to revert with git

---

## Timeline Estimates

### Optimistic (Everything Goes Smoothly)
- Phase 1: 4 hours
- Phase 2: 5 hours
- Phase 3: 4 hours
- **Total:** 13 hours (1.5 days)

### Realistic (Some Issues, Normal Pace)
- Phase 1: 6 hours
- Phase 2: 7 hours
- Phase 3: 7 hours
- **Total:** 20 hours (2.5 days)

### Pessimistic (Many Issues, Slow Pace)
- Phase 1: 8 hours
- Phase 2: 9 hours
- Phase 3: 9 hours
- **Total:** 26 hours (3.5 days)

**Recommendation:** Plan for realistic timeline (2.5 days)

---

## Communication

### Progress Updates

**After Each Task:**
- Update BACKLOG.md with task status
- Update PROGRESS_SUMMARY.md
- Commit changes
- Push to GitHub

**After Each Phase:**
- Create summary document
- Update all documentation
- Commit and push
- Notify team

### Issue Reporting

**If Issues Found:**
1. Document in IMPLEMENTATION_STRATEGY.md
2. Create issue in GitHub (if applicable)
3. Discuss with team
4. Decide on approach
5. Update strategy

---

## Next Steps

### Immediate (Today)
1. ✅ Read and understand this strategy
2. ✅ Review BACKLOG.md
3. ✅ Review analysis documents
4. ⏳ Begin Phase 1, TASK-001, Step 1 (Backup)

### This Week
1. Complete Phase 1 (TASK-001)
2. Begin Phase 2 (TASK-002, TASK-003)

### Next Week
1. Complete Phase 2
2. Begin Phase 3 (TASK-004, TASK-005, TASK-006)

### Future
1. Complete Phase 3
2. Plan Phase 4
3. Execute Phase 4 (post-v1.0)

---

## Conclusion

This strategy ensures we:
- ✅ Don't cut corners
- ✅ Backup everything
- ✅ Test thoroughly
- ✅ Commit frequently
- ✅ Can revert easily
- ✅ Maintain quality
- ✅ Deliver safely

**Remember:** Quality over speed. Safety over convenience. Testing over assumptions.

---

**Created:** January 28, 2026  
**Status:** Ready to Execute  
**Next Action:** Begin Phase 1, TASK-001, Step 1
