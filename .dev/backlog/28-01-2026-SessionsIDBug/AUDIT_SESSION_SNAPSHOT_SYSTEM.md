# Session/Snapshot/Tier System Audit

**Date:** January 28, 2026  
**Auditor:** AI Assistant  
**Status:** 🔴 CRITICAL ISSUES FOUND

---

## Executive Summary

The session/snapshot/tier system has **CRITICAL ISSUES** that cause memory corruption and context contamination when switching models. The system does NOT properly reset sessions on model swap, leading to mixed model data in snapshots and checkpoints.

### Critical Findings

1. ❌ **Session ID never regenerates on model swap** - Same session used across different models
2. ❌ **Snapshots contain mixed model data** - Snapshots from one model contaminate another
3. ❌ **clearContext() doesn't reset session** - Only clears messages, not session ID
4. ❌ **ContextManagerProvider receives static sessionId** - No mechanism to update it
5. ⚠️ **Checkpoint system may contain wrong model data** - Checkpoints from old model persist

---

## Detailed Findings

### Issue 1: Session ID Never Changes on Model Swap

**Location:** `packages/cli/src/ui/App.tsx:543`

```typescript
const sessionId = `session-${Date.now()}`; // Created ONCE at app start
```

**Problem:**
- Session ID is created once when app starts
- Never regenerates when model changes
- Same session ID used for gemma3:1b, llama3.2:3b, qwen2.5:3b, etc.
- All models write to same session file

**Impact:**
- Session file contains mixed model data
- Snapshots reference wrong model
- Compression checkpoints from one model used with another
- Context contamination across models

**Evidence from User:**
```
"I changed models while testing and can see in session snapshot wrong informations"
File: C:\Users\rad3k\.ollm\context-snapshots\session-1769629397190\snapshots\snapshot-87f69c42-6c2f-4b43-9a5b-272a6cc85da4.json
```

---

### Issue 2: clearContext() Doesn't Reset Session

**Location:** `packages/cli/src/features/context/ChatContext.tsx:143`

```typescript
const clearChat = useCallback(() => {
  setMessages([]);           // ✅ Clears messages
  setCurrentInput('');       // ✅ Clears input
  setStreaming(false);       // ✅ Resets streaming
  setWaitingForResponse(false); // ✅ Resets waiting
  if (contextActions) {
    contextActions.clear().catch(console.error); // ✅ Clears context manager
    // System prompt will be rebuilt by ContextManager on next message
  }
}, [contextActions]);
```

**Problem:**
- Clears messages and context
- Does NOT regenerate session ID
- Does NOT create new session file
- Does NOT clear snapshots from old session

**What's Missing:**
```typescript
// Should also do:
- Generate new session ID
- Close old session
- Create new session with new model
- Clear old snapshots
- Reset checkpoint system
```

---

### Issue 3: Model Swap Logic Incomplete

**Location:** `packages/cli/src/features/context/ModelContext.tsx:130-200`

```typescript
const setModelAndLoading = useCallback(
  async (model: string) => {
    const changed = currentModel !== model;
    if (changed) {
      // ... model switching logic ...
      
      // Clear context on model switch (optional, configurable)
      const settingsService = SettingsService.getInstance();
      const settings = settingsService.getSettings();
      const shouldClearContext = settings.llm?.clearContextOnModelSwitch ?? true;

      if (shouldClearContext) {
        clearContext(); // ❌ Only clears messages, not session!
      }
    }
  },
  [currentModel, provider, handleUnknownModel, saveToolSupport, addSystemMessage, clearContext]
);
```

**Problem:**
- Calls `clearContext()` which only clears messages
- Does NOT regenerate session ID
- Does NOT notify ContextManagerProvider of model change
- Does NOT create new session file

**What Should Happen:**
```typescript
if (shouldClearContext) {
  // 1. Close current session
  await sessionService.closeSession(currentSessionId);
  
  // 2. Generate new session ID
  const newSessionId = `session-${Date.now()}`;
  
  // 3. Create new session with new model
  await sessionService.createSession(newSessionId, model, provider);
  
  // 4. Clear context with new session
  clearContext();
  
  // 5. Notify ContextManagerProvider of new session
  if (globalThis.__ollmResetSession) {
    globalThis.__ollmResetSession();
  }
}
```

---

### Issue 4: ContextManagerProvider Receives Static Session ID

**Location:** `packages/cli/src/ui/App.tsx:569`

```typescript
<ContextManagerProvider
  sessionId={sessionId}  // ❌ Static value, never changes
  modelInfo={modelInfo}
  modelId={initialModel}
  config={contextConfig}
  provider={provider}
>
```

**Problem:**
- `sessionId` prop is static
- ContextManagerProvider has no way to know model changed
- Snapshots continue using old session ID
- Checkpoints reference wrong session

**What's Needed:**
- Make `sessionId` a state variable
- Update `sessionId` when model changes
- Force ContextManagerProvider to remount with new session
- OR add `onModelChange` callback to ContextManagerProvider

---

### Issue 5: Snapshot System Contamination

**Location:** `packages/core/src/context/snapshotManager.ts`

**Problem:**
- Snapshots are stored per session ID
- When model changes but session ID doesn't, snapshots mix data
- Snapshot contains:
  - `metadata.model: "gemma3:1b"` (old model)
  - But messages from `llama3.2:3b` (new model)
  - Checkpoints from `qwen2.5:3b` (another model)

**Example Contaminated Snapshot:**
```json
{
  "id": "snapshot-87f69c42-6c2f-4b43-9a5b-272a6cc85da4",
  "sessionId": "session-1769629397190",
  "timestamp": "2026-01-28T10:00:00Z",
  "metadata": {
    "model": "gemma3:1b",  // ❌ Wrong! User switched to llama3.2:3b
    "contextSize": 6963,
    "compressionRatio": 0.7
  },
  "messages": [
    // Mix of messages from gemma3:1b, llama3.2:3b, qwen2.5:3b
  ],
  "checkpoints": [
    // Checkpoints created by different models!
  ]
}
```

**Impact:**
- LLM receives context from wrong model
- Compression summaries from one model used with another
- Context confusion and hallucinations
- Unreliable conversation continuity

---

### Issue 6: Checkpoint System May Contain Wrong Model Data

**Location:** `packages/core/src/context/checkpointManager.ts`

**Problem:**
- Checkpoints are created by LLM summarizing conversation
- When model changes, old checkpoints remain
- New model receives checkpoints created by old model
- Checkpoint summaries may not match new model's style/capabilities

**Example:**
```
1. User uses gemma3:1b
2. Checkpoint created: "Summary of authentication implementation..."
3. User switches to llama3.2:3b
4. llama3.2:3b receives gemma3:1b's checkpoint
5. llama3.2:3b confused by different summarization style
```

---

## Tier System Analysis

### Tier Detection: ✅ WORKING CORRECTLY

**Location:** `packages/core/src/context/contextPool.ts`

The tier system itself is working correctly:
- Tiers are labels based on context size
- No hardcoded thresholds
- Profile-based mapping
- Adapts to model's available profiles

**No issues found in tier detection.**

---

## Compression System Analysis

### Compression Triggers: ✅ WORKING CORRECTLY

**Location:** `packages/core/src/context/compressionCoordinator.ts`

Compression triggers are working correctly:
- Triggers at 80% of available budget
- Dynamic budget calculation
- Checkpoint aging
- Progressive compaction

**However:** Compression system is affected by session contamination issue.

---

## Session Storage Analysis

### Session Recording: ✅ WORKING CORRECTLY

**Location:** `packages/core/src/services/chatRecordingService.ts`

Session recording is working correctly:
- Auto-save enabled
- Atomic writes
- Full history preserved
- Graceful error handling

**However:** Session file contains mixed model data due to Issue #1.

---

## Root Cause Analysis

### Primary Root Cause

**Session ID is created once and never regenerates.**

This single issue cascades into all other problems:
1. Same session used for multiple models
2. Snapshots contain mixed data
3. Checkpoints from wrong model
4. Context contamination
5. Memory corruption

### Secondary Root Causes

1. **No session lifecycle management on model swap**
   - No "close session" logic
   - No "create new session" logic
   - No session transition handling

2. **ContextManagerProvider has no update mechanism**
   - Receives static sessionId prop
   - No way to notify of model change
   - No remount on model change

3. **clearContext() is incomplete**
   - Only clears messages
   - Doesn't reset session
   - Doesn't clear snapshots

---

## Impact Assessment

### Severity: 🔴 CRITICAL

**User Impact:**
- Context contamination across models
- Unreliable conversation continuity
- Potential hallucinations
- Confusing behavior when switching models

**Data Integrity:**
- Session files contain mixed model data
- Snapshots reference wrong model
- Checkpoints from wrong model
- Metadata inconsistencies

**System Reliability:**
- Unpredictable behavior
- Hard to debug issues
- User confusion
- Loss of trust in system

---

## Recommended Fixes

### Fix 1: Make Session ID Reactive (HIGH PRIORITY)

**Location:** `packages/cli/src/ui/App.tsx`

```typescript
// BEFORE (WRONG):
const sessionId = `session-${Date.now()}`;

// AFTER (CORRECT):
const [sessionId, setSessionId] = useState(() => `session-${Date.now()}`);
const lastModelRef = useRef(initialModel);

// Watch for model changes
useEffect(() => {
  // This won't work because initialModel is constant
  // Need to get current model from ModelContext
}, [initialModel]);

// Expose global function for ModelContext to call
useEffect(() => {
  (globalThis as any).__ollmResetSession = (newModel: string) => {
    const newSessionId = `session-${Date.now()}`;
    console.log(`[App] Model changed to ${newModel}, creating new session: ${newSessionId}`);
    setSessionId(newSessionId);
    return newSessionId;
  };

  return () => {
    delete (globalThis as any).__ollmResetSession;
  };
}, []);
```

### Fix 2: Update Model Swap Logic (HIGH PRIORITY)

**Location:** `packages/cli/src/features/context/ModelContext.tsx`

```typescript
const setModelAndLoading = useCallback(
  async (model: string) => {
    const changed = currentModel !== model;
    if (changed) {
      // ... existing logic ...

      // Clear context on model switch
      const settingsService = SettingsService.getInstance();
      const settings = settingsService.getSettings();
      const shouldClearContext = settings.llm?.clearContextOnModelSwitch ?? true;

      if (shouldClearContext) {
        // 1. Clear context first
        clearContext();
        
        // 2. Reset session ID (triggers new session creation)
        if ((globalThis as any).__ollmResetSession) {
          const newSessionId = (globalThis as any).__ollmResetSession(model);
          console.log(`[ModelContext] New session created: ${newSessionId}`);
        }
      }
    }
  },
  [currentModel, provider, handleUnknownModel, saveToolSupport, addSystemMessage, clearContext]
);
```

### Fix 3: Force ContextManagerProvider Remount (HIGH PRIORITY)

**Location:** `packages/cli/src/ui/App.tsx`

```typescript
<ContextManagerProvider
  key={sessionId}  // ✅ Force remount when sessionId changes
  sessionId={sessionId}
  modelInfo={modelInfo}
  modelId={initialModel}
  config={contextConfig}
  provider={provider}
>
```

### Fix 4: Clear Snapshots on Model Swap (MEDIUM PRIORITY)

**Location:** `packages/cli/src/features/context/ChatContext.tsx`

```typescript
const clearChat = useCallback(() => {
  setMessages([]);
  setCurrentInput('');
  setStreaming(false);
  setWaitingForResponse(false);
  if (contextActions) {
    // Clear context manager
    contextActions.clear().catch(console.error);
    
    // Clear snapshots for old session
    const snapshotManager = contextActions.getSnapshotManager?.();
    if (snapshotManager) {
      // Don't delete snapshots, just stop using them
      // User may want to review old session
    }
  }
}, [contextActions]);
```

### Fix 5: Add Session Transition Logging (LOW PRIORITY)

**Location:** Multiple files

Add logging to track session transitions:
```typescript
console.log('[Session] Closing session:', oldSessionId, 'model:', oldModel);
console.log('[Session] Creating session:', newSessionId, 'model:', newModel);
console.log('[Session] Cleared', snapshotCount, 'snapshots from old session');
console.log('[Session] Cleared', checkpointCount, 'checkpoints from old session');
```

---

## Testing Recommendations

### Test Case 1: Model Swap Session Reset

```typescript
test('should create new session when model changes', async () => {
  // 1. Start with gemma3:1b
  const session1 = getCurrentSessionId();
  
  // 2. Send message
  await sendMessage('Hello');
  
  // 3. Switch to llama3.2:3b
  await switchModel('llama3.2:3b');
  
  // 4. Verify new session created
  const session2 = getCurrentSessionId();
  expect(session2).not.toBe(session1);
  
  // 5. Verify old session closed
  const oldSession = await getSession(session1);
  expect(oldSession.metadata.model).toBe('gemma3:1b');
  
  // 6. Verify new session has correct model
  const newSession = await getSession(session2);
  expect(newSession.metadata.model).toBe('llama3.2:3b');
});
```

### Test Case 2: Snapshot Isolation

```typescript
test('should not mix snapshots across models', async () => {
  // 1. Use gemma3:1b, create snapshot
  await switchModel('gemma3:1b');
  await sendMessage('Test 1');
  const snapshot1 = await createSnapshot();
  
  // 2. Switch to llama3.2:3b, create snapshot
  await switchModel('llama3.2:3b');
  await sendMessage('Test 2');
  const snapshot2 = await createSnapshot();
  
  // 3. Verify snapshots have different session IDs
  expect(snapshot1.sessionId).not.toBe(snapshot2.sessionId);
  
  // 4. Verify snapshots have correct models
  expect(snapshot1.metadata.model).toBe('gemma3:1b');
  expect(snapshot2.metadata.model).toBe('llama3.2:3b');
});
```

### Test Case 3: Checkpoint Isolation

```typescript
test('should not use checkpoints from previous model', async () => {
  // 1. Use gemma3:1b, trigger compression
  await switchModel('gemma3:1b');
  await fillContext(); // Fill to 80%
  const checkpoints1 = getCheckpoints();
  
  // 2. Switch to llama3.2:3b
  await switchModel('llama3.2:3b');
  
  // 3. Verify checkpoints cleared
  const checkpoints2 = getCheckpoints();
  expect(checkpoints2).toHaveLength(0);
  expect(checkpoints2).not.toEqual(checkpoints1);
});
```

---

## Priority Matrix

| Issue | Severity | Priority | Effort | Impact |
|-------|----------|----------|--------|--------|
| Session ID never regenerates | 🔴 Critical | P0 | Medium | High |
| clearContext() incomplete | 🔴 Critical | P0 | Low | High |
| Model swap logic incomplete | 🔴 Critical | P0 | Medium | High |
| ContextManagerProvider static | 🟡 High | P1 | Low | Medium |
| Snapshot contamination | 🟡 High | P1 | Low | Medium |
| Checkpoint wrong model | 🟡 High | P2 | Low | Medium |

---

## Implementation Plan

### Phase 1: Critical Fixes (P0)

1. Make sessionId reactive in App.tsx
2. Add __ollmResetSession global function
3. Update model swap logic to call __ollmResetSession
4. Add key prop to ContextManagerProvider
5. Test model swap creates new session

**Estimated Time:** 2-3 hours  
**Risk:** Medium (requires careful state management)

### Phase 2: Validation (P1)

1. Add session transition logging
2. Verify snapshots isolated per session
3. Verify checkpoints cleared on model swap
4. Add automated tests

**Estimated Time:** 1-2 hours  
**Risk:** Low

### Phase 3: Documentation (P2)

1. Update dev_ContextCheckpointRollover.md
2. Update dev_SessionStorage.md
3. Add troubleshooting guide
4. Update user documentation

**Estimated Time:** 1 hour  
**Risk:** Low

---

## Conclusion

The session/snapshot/tier system has **CRITICAL ISSUES** that must be fixed immediately:

1. ❌ Session ID never regenerates on model swap
2. ❌ Context contamination across models
3. ❌ Snapshots contain mixed model data
4. ❌ Checkpoints from wrong model

**Root Cause:** Session ID is created once and never changes.

**Solution:** Make sessionId reactive and regenerate on model swap.

**Priority:** 🔴 P0 - Fix immediately

**Estimated Fix Time:** 2-3 hours

---

## Files to Modify

1. `packages/cli/src/ui/App.tsx` - Make sessionId reactive
2. `packages/cli/src/features/context/ModelContext.tsx` - Call __ollmResetSession
3. `packages/cli/src/features/context/ChatContext.tsx` - Update clearChat
4. `packages/core/src/context/contextManager.ts` - Add session reset support
5. `packages/core/src/context/snapshotManager.ts` - Verify isolation
6. `packages/core/src/context/checkpointManager.ts` - Clear on session reset

---

## Related Issues

### Mode Transition Snapshots

**Location:** `C:\Users\rad3k\.ollm\mode-transition-snapshots`

This folder is created by the **PromptsSnapshotManager** for mode-aware snapshots (assistant → debugger → architect, etc.). The folders are **empty** because:

1. Auto-switch is disabled by default
2. Manual mode switches don't trigger snapshots
3. Same session ID issue affects this system too

**See:** `.dev/MODE_TRANSITION_SNAPSHOTS_ANALYSIS.md` for detailed analysis.

**Impact:** 🟡 LOW (feature not working, but not causing harm)

**Fix:** Same session ID fix will resolve this issue too.

---

**Audit Complete**  
**Date:** January 28, 2026  
**Status:** 🔴 CRITICAL ISSUES FOUND - IMMEDIATE ACTION REQUIRED
