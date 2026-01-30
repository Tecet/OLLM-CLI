# Mode Transition Snapshots Analysis

**Date:** January 28, 2026  
**Location:** `C:\Users\rad3k\.ollm\mode-transition-snapshots`  
**Status:** 🟡 FEATURE IMPLEMENTED BUT UNUSED

---

## Executive Summary

The `mode-transition-snapshots` folder is created by the **PromptsSnapshotManager** (also called `SnapshotManager` in `modeSnapshotManager.ts`). This is a **mode-aware snapshot system** designed to preserve conversation state when switching between operational modes (assistant, debugger, architect, etc.).

**Current Status:**

- ✅ Folder is created correctly
- ✅ Session subfolders are created
- ❌ **Snapshots are NOT being saved** (folders are empty)
- ⚠️ Feature is implemented but has a critical bug preventing snapshot creation

---

## What Creates This Folder?

### Location in Code

**File:** `packages/cli/src/features/context/ContextManagerContext.tsx:234-238`

```typescript
// Create prompts snapshot manager
const promptsSnapshotManager = new PromptsSnapshotManager({
  sessionId,
  storagePath: path.join(os.homedir(), '.ollm', 'mode-transition-snapshots'),
  maxCacheSize: 20,
  pruneAfterMs: 7200000, // 2 hours
});
await promptsSnapshotManager.initialize();
```

### Initialization Flow

1. **App.tsx** creates `ContextManagerProvider` with a `sessionId`
2. **ContextManagerProvider** initializes `PromptsSnapshotManager`
3. **PromptsSnapshotManager.initialize()** creates the folder structure:
   ```
   C:\Users\rad3k\.ollm\mode-transition-snapshots\
   └── session-1769629397190\
       └── (empty - should contain transition-*.json files)
   ```

---

## Purpose of Mode Transition Snapshots

### What Are Mode Transition Snapshots?

Mode transition snapshots are **lightweight JSON snapshots** that capture conversation state when switching between operational modes. They are different from regular context snapshots.

### Operational Modes

The system supports multiple operational modes:

- **assistant** - General conversation and assistance
- **debugger** - Debugging and error analysis
- **architect** - System design and architecture
- **code** - Code generation and refactoring
- **research** - Research and information gathering

### Why Mode Snapshots?

When switching modes (e.g., assistant → debugger → assistant), the system needs to:

1. **Preserve context** from the previous mode
2. **Extract mode-specific findings** (e.g., debugger errors, root causes, fixes)
3. **Inject findings** into the new mode's conversation
4. **Maintain conversation continuity** across mode switches

### Snapshot Structure

**File:** `packages/core/src/prompts/modeSnapshotManager.ts:28-50`

```typescript
interface ModeTransitionSnapshot {
  id: string;
  timestamp: Date;
  fromMode: ModeType;
  toMode: ModeType;

  // Recent conversation context (last 5 messages)
  recentMessages: {
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: Date;
  }[];

  // Active state
  activeSkills: string[];
  activeTools: string[];
  currentTask: string | null;

  // Mode-specific findings (for specialized modes)
  findings?: ModeFindings;

  // Extracted reasoning traces (for reasoning-capable models)
  reasoningTraces?: Array<{
    content: string;
    tokenCount?: number;
    duration?: number;
    complete?: boolean;
  }>;
}
```

### Example Use Case

**Scenario:** User debugging an authentication issue

1. **Assistant Mode:**
   - User: "My login isn't working"
   - Assistant: "Let me help you debug this"
   - **Mode switches to debugger**

2. **Debugger Mode:**
   - Analyzes error logs
   - Identifies root cause: "JWT token expired"
   - Suggests fixes: "Refresh token logic needed"
   - **Creates snapshot with findings**

3. **Back to Assistant Mode:**
   - **Snapshot injected:** "Debugger found JWT token expiration issue"
   - Assistant: "Based on the debugging session, you need to implement token refresh..."
   - **Conversation continuity maintained**

---

## Why Are Folders Empty?

### Critical Bug: Snapshots Not Being Created

**Location:** `packages/cli/src/features/context/ContextManagerContext.tsx:268-290`

```typescript
// Listen for mode changes
const modeChangeCallback = (transition: ModeTransition) => {
  setCurrentMode(transition.to);
  console.log(`Mode changed: ${transition.from} → ${transition.to} (${transition.trigger})`);

  // ... other logic ...

  // Create transition snapshot if we have user messages
  const promptsSnapshotMgr = promptsSnapshotManagerRef.current;
  if (promptsSnapshotMgr && managerRef.current) {
    (async () => {
      try {
        const messages = await managerRef.current!.getMessages();
        const hasUserMessages = messages.some((m) => m.role === 'user');
        if (!hasUserMessages) return; // ❌ EXITS EARLY IF NO USER MESSAGES

        const snapshot = promptsSnapshotMgr.createTransitionSnapshot(
          transition.from,
          transition.to,
          {
            messages: messages.map((m) => ({
              role: m.role,
              parts: [{ type: 'text', text: m.content }],
            })),
            activeSkills: modeManager.getActiveSkills(),
            activeTools: [],
            currentTask: undefined,
          }
        );
        await promptsSnapshotMgr.storeSnapshot(snapshot, true);
      } catch (error) {
        console.error('[ModeSnapshot] Failed to capture transition snapshot:', error);
      }
    })();
  }
};
```

### Root Causes

1. **Auto-Switch Disabled by Default**

   ```typescript
   // Line 322
   const savedAutoSwitch = false; // Force auto-switch OFF
   ```

   - Mode switching is **disabled by default**
   - User must manually enable auto-switch
   - Without mode switches, no snapshots are created

2. **Manual Mode Switches Don't Trigger Snapshots**
   - Only **automatic mode switches** trigger snapshot creation
   - Manual switches (via UI or commands) bypass snapshot logic

3. **Early Exit on Empty Conversation**

   ```typescript
   if (!hasUserMessages) return; // Exits if no user messages yet
   ```

   - If mode switches before user sends a message, no snapshot is created

---

## Folder Structure Explained

### Directory Layout

```
C:\Users\rad3k\.ollm\mode-transition-snapshots\
├── session-1769629397190\          # Session ID from App.tsx
│   ├── transition-1769629400000.json  # Should exist but doesn't
│   ├── transition-1769629405000.json  # Should exist but doesn't
│   └── ...
├── session-1769629500000\          # Another session
│   └── ...
└── ...
```

### Session Isolation

Each session gets its own subfolder:

- **Session ID format:** `session-{timestamp}`
- **Snapshot filename format:** `transition-{timestamp}.json`
- **Isolation:** Snapshots from different sessions don't mix

### Pruning Policy

**File:** `packages/core/src/prompts/modeSnapshotManager.ts:237-265`

```typescript
pruneAfterMs: 7200000, // 2 hours
```

- Snapshots older than **2 hours** are automatically deleted
- Prevents unbounded storage growth
- Runs during `pruneSnapshots()` calls

---

## Relationship to Session Contamination Issue

### Are These Related?

**YES - Both issues stem from the same root cause:**

1. **Session ID Never Changes**
   - `mode-transition-snapshots/session-1769629397190/` is created once
   - When you switch models, **same session folder is reused**
   - Mode snapshots from different models mix in same folder

2. **Mode Snapshots Would Contain Mixed Model Data**
   - If snapshots were being created (they're not), they would have:
     - `fromMode: "assistant"` with `gemma3:1b`
     - `toMode: "debugger"` with `llama3.2:3b`
     - Mixed conversation context from both models

3. **Same Fix Applies**
   - Making `sessionId` reactive in `App.tsx` would:
     - Create new session folders on model swap
     - Isolate mode snapshots per model
     - Prevent cross-contamination

---

## Impact Assessment

### Current Impact: 🟡 LOW

**Why Low Impact?**

- Feature is not working (snapshots not created)
- Empty folders don't cause harm
- Mode switching is disabled by default
- Most users don't use mode switching yet

### Potential Impact if Fixed: 🟢 POSITIVE

**Benefits if Feature Works:**

- Better conversation continuity across mode switches
- Preserved debugging findings
- Smoother workflow transitions
- Enhanced user experience

### Risk if Not Fixed: 🟡 MEDIUM

**Risks:**

- Feature is implemented but broken
- Users who enable auto-switch won't get expected behavior
- Wasted storage space (empty folders)
- Confusion about folder purpose

---

## Recommended Actions

### Priority 1: Fix Session ID Issue (P0 - CRITICAL)

**This fixes BOTH issues:**

1. Session contamination in context snapshots
2. Session contamination in mode transition snapshots

**Implementation:** See `.dev/AUDIT_SESSION_SNAPSHOT_SYSTEM.md`

### Priority 2: Fix Mode Snapshot Creation (P1 - HIGH)

**Option A: Enable Auto-Switch by Default**

```typescript
// In ContextManagerContext.tsx:322
const savedAutoSwitch = true; // Enable auto-switch by default
```

**Option B: Trigger Snapshots on Manual Mode Switch**

```typescript
// In switchMode() and switchModeExplicit()
const switchMode = useCallback((mode: ModeType) => {
  if (!modeManagerRef.current) return;

  const previousMode = modeManagerRef.current.getCurrentMode();

  // Create snapshot before switching
  if (promptsSnapshotManagerRef.current && managerRef.current) {
    (async () => {
      try {
        const messages = await managerRef.current!.getMessages();
        const snapshot = promptsSnapshotManagerRef.current!.createTransitionSnapshot(
          previousMode,
          mode,
          {
            /* ... */
          }
        );
        await promptsSnapshotManagerRef.current!.storeSnapshot(snapshot, true);
      } catch (error) {
        console.error('[ModeSnapshot] Failed to capture manual transition:', error);
      }
    })();
  }

  modeManagerRef.current.forceMode(mode);
  // ... rest of logic
}, []);
```

**Option C: Remove Feature if Not Used**

- If mode switching is not a priority feature
- Remove `PromptsSnapshotManager` initialization
- Clean up empty folders
- Reduce code complexity

### Priority 3: Add Logging (P2 - MEDIUM)

**Add debug logging to track snapshot creation:**

```typescript
console.log('[ModeSnapshot] Mode changed:', transition.from, '→', transition.to);
console.log('[ModeSnapshot] Has user messages:', hasUserMessages);
console.log('[ModeSnapshot] Snapshot created:', snapshot.id);
console.log('[ModeSnapshot] Snapshot stored at:', filePath);
```

### Priority 4: Documentation (P3 - LOW)

**Document the feature:**

- Add user guide for mode switching
- Explain when snapshots are created
- Document folder structure
- Add troubleshooting guide

---

## Testing Recommendations

### Test Case 1: Verify Folder Creation

```typescript
test('should create mode-transition-snapshots folder', async () => {
  const manager = new PromptsSnapshotManager({
    sessionId: 'test-session',
    storagePath: '/tmp/mode-transition-snapshots',
  });

  await manager.initialize();

  const folderExists = await fs
    .access('/tmp/mode-transition-snapshots/session-test-session')
    .then(() => true)
    .catch(() => false);

  expect(folderExists).toBe(true);
});
```

### Test Case 2: Verify Snapshot Creation

```typescript
test('should create snapshot on mode transition', async () => {
  const manager = new PromptsSnapshotManager({
    /* ... */
  });
  await manager.initialize();

  const snapshot = manager.createTransitionSnapshot('assistant', 'debugger', {
    messages: [{ role: 'user', parts: [{ type: 'text', text: 'Test' }] }],
    activeSkills: [],
    activeTools: [],
  });

  await manager.storeSnapshot(snapshot, true);

  const files = await fs.readdir('/tmp/mode-transition-snapshots/session-test-session');
  expect(files.length).toBeGreaterThan(0);
  expect(files[0]).toMatch(/^transition-\d+\.json$/);
});
```

### Test Case 3: Verify Session Isolation

```typescript
test('should isolate snapshots per session', async () => {
  const manager1 = new PromptsSnapshotManager({ sessionId: 'session-1' });
  const manager2 = new PromptsSnapshotManager({ sessionId: 'session-2' });

  await manager1.initialize();
  await manager2.initialize();

  const snapshot1 = manager1.createTransitionSnapshot(/* ... */);
  const snapshot2 = manager2.createTransitionSnapshot(/* ... */);

  await manager1.storeSnapshot(snapshot1, true);
  await manager2.storeSnapshot(snapshot2, true);

  const files1 = await fs.readdir('mode-transition-snapshots/session-1');
  const files2 = await fs.readdir('mode-transition-snapshots/session-2');

  expect(files1.length).toBe(1);
  expect(files2.length).toBe(1);
  expect(files1[0]).not.toBe(files2[0]);
});
```

---

## Summary

### What We Know

1. ✅ **Folder is created correctly** by `PromptsSnapshotManager`
2. ✅ **Session subfolders are created** with proper naming
3. ❌ **Snapshots are NOT being saved** (folders are empty)
4. ⚠️ **Feature is implemented but broken** due to:
   - Auto-switch disabled by default
   - Manual switches don't trigger snapshots
   - Early exit on empty conversations

### What Needs to Be Fixed

1. **P0 - CRITICAL:** Fix session ID regeneration (fixes both issues)
2. **P1 - HIGH:** Fix mode snapshot creation logic
3. **P2 - MEDIUM:** Add debug logging
4. **P3 - LOW:** Document the feature

### Estimated Fix Time

- **Session ID fix:** 30 minutes (already planned)
- **Mode snapshot fix:** 1-2 hours
- **Logging:** 30 minutes
- **Documentation:** 1 hour
- **Total:** 3-4 hours

---

**Audit Complete**  
**Date:** January 28, 2026  
**Status:** 🟡 FEATURE IMPLEMENTED BUT UNUSED - LOW PRIORITY FIX
