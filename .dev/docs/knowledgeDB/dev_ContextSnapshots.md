# Snapshot Systems - New Architecture

**Created:** January 27, 2026  
**Updated:** January 29, 2026  
**Status:** ✅ Refactored (v0.1.1)  
**Related:** Context Compression Refactor

---

## Overview

The snapshot system has been refactored as part of the v0.1.1 Context Compression System rewrite. The new architecture provides clear separation between recovery snapshots and session history, with improved type safety and storage boundaries.

**New Architecture:** The snapshot system uses a **clean, layered architecture**:

1. **Storage Layer** (`snapshotStorage.ts`) - File I/O, serialization, cleanup
2. **Lifecycle Layer** (`snapshotLifecycle.ts`) - Business logic, validation, recovery
3. **Coordination Layer** (`snapshotCoordinator.ts`) - Integration with context system
4. **Intent Layer** (`intentSnapshotStorage.ts`) - Mode transitions, hot swaps (legacy)

This layering ensures clean separation between storage operations, business logic, system integration, and specialized use cases.

---

## Snapshot System (New Architecture)

### Purpose

The snapshot system provides **recovery and rollback** capabilities for conversations. Snapshots capture the full conversation state at a point in time and can be restored if needed.

**Key Principle:** Snapshots are NEVER sent to the LLM. They exist solely for recovery purposes.

### Snapshot Structure (New)

```typescript
interface SnapshotData {
  id: string;
  sessionId: string;
  timestamp: number;
  conversationState: {
    messages: Message[];           // Full messages at checkpoint
    checkpoints: CheckpointSummary[];
    goals?: Goal[];
    metadata: Record<string, unknown>;
  };
  purpose: 'recovery' | 'rollback' | 'emergency';
}
```

### Storage Location

**New System:** `~/.ollm/context-snapshots/`

**File Format:** `snapshot-<uuid>.json`

### Snapshot Lifecycle

The new `SnapshotLifecycle` class manages the complete lifecycle:

```typescript
class SnapshotLifecycle {
  // Create snapshot from current conversation state
  async createSnapshot(
    messages: Message[],
    checkpoints: CheckpointSummary[],
    purpose: 'recovery' | 'rollback' | 'emergency'
  ): Promise<SnapshotData>;

  // Restore snapshot to conversation state
  async restoreSnapshot(snapshotId: string): Promise<{
    messages: Message[];
    checkpoints: CheckpointSummary[];
  }>;

  // List all snapshots for session
  async listSnapshots(): Promise<SnapshotData[]>;

  // Delete old snapshots (keep last N)
  async cleanup(keepCount: number = 5): Promise<void>;
}
```

### When Snapshots Are Created

1. **Manual:** User explicitly creates snapshot
2. **Automatic:** At 85% context usage (configurable)
3. **Emergency:** Before context rollover (100% usage)
4. **Pre-compression:** Before aggressive compression
5. **Before risky operations:** User-initiated or system-detected

### Snapshot vs Session History

**Snapshot:**
- Point-in-time recovery
- Created periodically
- Limited retention (keep last N)
- Used for rollback

**Session History:**
- Complete conversation record
- Created continuously
- Permanent storage
- Used for review/export

### Integration with Compression

Snapshots work with the compression system:

```typescript
// Before compression
const snapshot = await snapshotLifecycle.createSnapshot(
  context.messages,
  context.checkpoints,
  'recovery'
);

// Perform compression
try {
  await compressionPipeline.compress();
} catch (error) {
  // Restore from snapshot on error
  const restored = await snapshotLifecycle.restoreSnapshot(snapshot.id);
  context.messages = restored.messages;
  context.checkpoints = restored.checkpoints;
}
```

---

## New Architecture (v0.1.1)

### Layered Design

The snapshot system follows a clean, layered architecture:

```
┌─────────────────────────────────────────┐
│ snapshotLifecycle.ts                    │  ← Business Logic Layer
│ - Create/restore snapshots              │
│ - Validate snapshot data                │
│ - Manage lifecycle                      │
│ - Cleanup old snapshots                 │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│ snapshotStorage.ts                      │  ← Storage Layer
│ - File I/O operations                   │
│ - Serialization/deserialization         │
│ - Directory management                  │
│ - Error handling                        │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│ File System                             │
│ ~/.ollm/context-snapshots/              │
│ ├─ snapshot-<uuid>.json                 │
│ ├─ snapshot-<uuid>.json                 │
│ └─ ...                                  │
└─────────────────────────────────────────┘
```

### Integration with Context Orchestrator

The snapshot system integrates with the new `ContextOrchestrator`:

```typescript
class ContextOrchestrator {
  private snapshotLifecycle: SnapshotLifecycle;
  private activeContext: ActiveContextManager;
  private sessionHistory: SessionHistoryManager;

  // Create snapshot before risky operation
  async createSnapshot(purpose: 'recovery' | 'rollback' | 'emergency'): Promise<SnapshotData> {
    const messages = this.activeContext.getState().recentMessages;
    const checkpoints = this.activeContext.getState().checkpoints;
    
    return await this.snapshotLifecycle.createSnapshot(
      messages,
      checkpoints,
      purpose
    );
  }

  // Restore snapshot
  async restoreSnapshot(snapshotId: string): Promise<void> {
    const restored = await this.snapshotLifecycle.restoreSnapshot(snapshotId);
    
    // Update active context
    this.activeContext.clear();
    restored.messages.forEach(m => this.activeContext.addMessage(m));
    restored.checkpoints.forEach(cp => this.activeContext.addCheckpoint(cp));
  }
}
```

### Storage Boundaries

Snapshots respect storage boundaries:

```typescript
// ✅ Correct: Snapshot stores full state
const snapshot = {
  conversationState: {
    messages: [...allMessages],      // Full messages
    checkpoints: [...checkpoints],   // All checkpoints
  }
};

// ❌ Wrong: Never send snapshot to LLM
const prompt = [
  systemPrompt,
  ...snapshot.conversationState.messages,  // NEVER DO THIS
];

// ✅ Correct: Use active context for LLM
const prompt = activeContext.buildPrompt();
```

---

## Comparison: Old vs New

| Feature           | Old System (Legacy)          | New System (v0.1.1)              |
| ----------------- | ---------------------------- | -------------------------------- |
| **Architecture**  | Mixed concerns               | Layered (lifecycle + storage)    |
| **Storage**       | `snapshotStorage.ts`         | `snapshotLifecycle.ts` + storage |
| **Type Safety**   | Partial                      | Full TypeScript                  |
| **Boundaries**    | Not enforced                 | Runtime enforcement              |
| **Integration**   | Direct with contextManager   | Via contextOrchestrator          |
| **Validation**    | Basic                        | Comprehensive                    |
| **Error Handling**| Limited                      | Comprehensive                    |
| **Testing**       | Unit tests only              | Unit + integration + property    |

---

## File Locations

### New Architecture (v0.1.1)

| File                                                                       | Purpose                          | Status      |
| -------------------------------------------------------------------------- | -------------------------------- | ----------- |
| `packages/core/src/context/storage/snapshotLifecycle.ts`                   | Snapshot lifecycle management    | ✅ New      |
| `packages/core/src/context/storage/snapshotStorage.ts`                     | File I/O and serialization       | ✅ Refactored |
| `packages/core/src/context/storage/snapshotCoordinator.ts`                 | Integration with context system  | ✅ Refactored |
| `packages/core/src/context/__tests__/storage/snapshotLifecycle.test.ts`    | Lifecycle tests                  | ✅ New      |
| `packages/core/src/context/__tests__/storage/snapshotStorage.test.ts`      | Storage tests                    | ✅ Updated  |

### Legacy System (Archived)

| File                                                                       | Purpose                          | Status      |
| -------------------------------------------------------------------------- | -------------------------------- | ----------- |
| `.legacy/context-compression/2026-01-28-233842/core/snapshotManager.ts`    | Old snapshot manager             | 📦 Archived |

### Mode Snapshots (Legacy - Separate System)

| File                                                                       | Purpose                          | Status      |
| -------------------------------------------------------------------------- | -------------------------------- | ----------- |
| `packages/core/src/services/intentSnapshotStorage.ts`                      | Mode transition snapshots        | ⚠️ Legacy   |
| `packages/core/src/prompts/modeSnapshotManager.ts`                         | Mode snapshot manager            | ⚠️ Legacy   |

**Note:** Mode snapshots are a separate system for mode transitions. They are not part of the main snapshot system and may be deprecated in future versions.

---

## Migration Guide

### Migrating from Legacy Snapshots

The new system includes migration support:

```typescript
import { migrateSnapshot } from './migration/snapshotMigration.js';

// Migrate old snapshot to new format
const oldSnapshot = await loadOldSnapshot(snapshotId);
const newSnapshot = migrateSnapshot(oldSnapshot);
await snapshotLifecycle.saveSnapshot(newSnapshot);
```

### Migration CLI

```bash
# Migrate all snapshots for a session
npm run migrate:snapshots -- --session <sessionId>

# Dry run (preview changes)
npm run migrate:snapshots -- --session <sessionId> --dry-run

# Migrate all sessions
npm run migrate:snapshots -- --all
```

---

## Best Practices

### 1. Snapshot Creation

- Create snapshots before risky operations
- Use descriptive purposes ('recovery', 'rollback', 'emergency')
- Don't create too many snapshots (use cleanup)

### 2. Snapshot Restoration

- Validate snapshot before restoring
- Update UI to reflect restored state
- Log restoration for debugging

### 3. Cleanup

- Keep last 5-10 snapshots (configurable)
- Run cleanup periodically
- Don't delete emergency snapshots too quickly

### 4. Error Handling

- Always handle snapshot errors gracefully
- Provide fallback if snapshot fails
- Log errors for debugging

---

## Testing

### Property-Based Tests

The new system includes property-based tests:

```typescript
// Property: Snapshot round trip preserves data
fc.assert(
  fc.property(fc.array(messageArb), fc.array(checkpointArb), async (messages, checkpoints) => {
    const snapshot = await snapshotLifecycle.createSnapshot(messages, checkpoints, 'recovery');
    const restored = await snapshotLifecycle.restoreSnapshot(snapshot.id);
    
    expect(restored.messages).toEqual(messages);
    expect(restored.checkpoints).toEqual(checkpoints);
  })
);

// Property: Cleanup keeps last N snapshots
fc.assert(
  fc.property(fc.array(snapshotArb), fc.nat(10), async (snapshots, keepCount) => {
    await snapshotLifecycle.cleanup(keepCount);
    const remaining = await snapshotLifecycle.listSnapshots();
    
    expect(remaining.length).toBeLessThanOrEqual(keepCount);
  })
);
```

---

## Conclusion

The snapshot system has been refactored as part of the v0.1.1 Context Compression System rewrite. The new architecture provides:

✅ **Clear Layering** - Lifecycle + storage separation  
✅ **Type Safety** - Full TypeScript support  
✅ **Storage Boundaries** - Runtime enforcement  
✅ **Integration** - Clean integration with context orchestrator  
✅ **Testing** - Comprehensive test coverage  
✅ **Migration** - Support for legacy snapshots

The system is production-ready and provides reliable recovery and rollback capabilities for conversations.

---

**Status:** ✅ Refactored (v0.1.1)  
**Related Documents:**
- [Context Compression](./dev_ContextCompression.md) - Compression system
- [Context Management](./dev_ContextManagement.md) - Context sizing
- [Session Storage](./dev_SessionStorage.md) - Session management
