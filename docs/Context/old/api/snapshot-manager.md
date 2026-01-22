# SnapshotManager API Reference

Complete API reference for the SnapshotManager class.

## Table of Contents

- [Overview](#overview)
- [Constructor](#constructor)
- [Methods](#methods)
- [Types](#types)
- [Examples](#examples)

---

## Overview

The `SnapshotManager` handles creation, restoration, and management of context snapshots. It provides automatic snapshot triggers, rolling cleanup, and threshold-based callbacks.

**Import:**
```typescript
import { createSnapshotManager, SnapshotManager } from '@ollm/ollm-cli-core';
```

**Factory Function:**
```typescript
function createSnapshotManager(
  storage: SnapshotStorage,
  config: SnapshotConfig
): SnapshotManager
```

---

## Constructor

### createSnapshotManager()

Creates a new SnapshotManager instance.

**Signature:**
```typescript
createSnapshotManager(
  storage: SnapshotStorage,
  config: SnapshotConfig
): SnapshotManager
```

**Parameters:**

| Parameter | Type | Required | Description |
|:----------|:-----|:---------|:------------|
| `storage` | `SnapshotStorage` | Yes | Storage backend |
| `config` | `SnapshotConfig` | Yes | Configuration |

**Example:**
```typescript
import { createSnapshotStorage, createSnapshotManager } from '@ollm/ollm-cli-core';

const storage = createSnapshotStorage('session-123');
const manager = createSnapshotManager(storage, {
  enabled: true,
  maxCount: 5,
  autoCreate: true,
  autoThreshold: 0.8
});
```

---

## Methods

### setSessionId()

Set the current session ID.

**Signature:**
```typescript
setSessionId(sessionId: string): void
```

**Parameters:**

| Parameter | Type | Required | Description |
|:----------|:-----|:---------|:------------|
| `sessionId` | `string` | Yes | Session identifier |

**Example:**
```typescript
manager.setSessionId('session-abc123');
```

**Note:** Must be called before other operations.

---

### createSnapshot()

Create snapshot from current context.

**Signature:**
```typescript
async createSnapshot(context: ConversationContext): Promise<ContextSnapshot>
```

**Parameters:**

| Parameter | Type | Required | Description |
|:----------|:-----|:---------|:------------|
| `context` | `ConversationContext` | Yes | Current context |

**Returns:** `ContextSnapshot`

**Example:**
```typescript
const snapshot = await manager.createSnapshot(context);
console.log(`Created: ${snapshot.id}`);
console.log(`Tokens: ${snapshot.tokenCount}`);
console.log(`Messages: ${snapshot.messages.length}`);
```

**Behavior:**
- Generates unique ID
- Creates summary
- Clones messages
- Saves to storage
- Performs rolling cleanup

**Throws:**
- `Error` if snapshots disabled
- `Error` if storage fails

---

### restoreSnapshot()

Restore context from snapshot.

**Signature:**
```typescript
async restoreSnapshot(snapshotId: string): Promise<ConversationContext>
```

**Parameters:**

| Parameter | Type | Required | Description |
|:----------|:-----|:---------|:------------|
| `snapshotId` | `string` | Yes | Snapshot ID |

**Returns:** `ConversationContext`

**Example:**
```typescript
const context = await manager.restoreSnapshot('snapshot-abc123');
console.log(`Restored: ${context.tokenCount} tokens`);
console.log(`Messages: ${context.messages.length}`);
```

**Behavior:**
- Loads snapshot from storage
- Reconstructs context
- Clones messages

**Throws:**
- `Error` if snapshot not found
- `Error` if snapshot corrupted

---

### listSnapshots()

List snapshots for a session.

**Signature:**
```typescript
async listSnapshots(sessionId: string): Promise<ContextSnapshot[]>
```

**Parameters:**

| Parameter | Type | Required | Description |
|:----------|:-----|:---------|:------------|
| `sessionId` | `string` | Yes | Session identifier |

**Returns:** `ContextSnapshot[]`

**Example:**
```typescript
const snapshots = await manager.listSnapshots('session-123');
snapshots.forEach(s => {
  console.log(`${s.id}: ${s.tokenCount} tokens (${s.timestamp})`);
});
```

**Behavior:**
- Loads metadata from storage
- Loads full snapshots
- Skips corrupted snapshots

---

### deleteSnapshot()

Delete a snapshot.

**Signature:**
```typescript
async deleteSnapshot(snapshotId: string): Promise<void>
```

**Parameters:**

| Parameter | Type | Required | Description |
|:----------|:-----|:---------|:------------|
| `snapshotId` | `string` | Yes | Snapshot ID |

**Example:**
```typescript
await manager.deleteSnapshot('snapshot-abc123');
console.log('Snapshot deleted');
```

**Throws:**
- `Error` if snapshot not found
- `Error` if deletion fails

---

### onContextThreshold()

Register threshold callback.

**Signature:**
```typescript
onContextThreshold(threshold: number, callback: () => void): void
```

**Parameters:**

| Parameter | Type | Required | Description |
|:----------|:-----|:---------|:------------|
| `threshold` | `number` | Yes | Threshold (0.0-1.0) |
| `callback` | `Function` | Yes | Callback function |

**Example:**
```typescript
manager.onContextThreshold(0.8, async () => {
  console.log('80% threshold reached');
  await manager.createSnapshot(context);
});
```

**Behavior:**
- Registers callback for threshold
- Multiple callbacks can be registered
- Triggered by `checkThresholds()`

---

### onBeforeOverflow()

Register pre-overflow callback.

**Signature:**
```typescript
onBeforeOverflow(callback: () => void): void
```

**Parameters:**

| Parameter | Type | Required | Description |
|:----------|:-----|:---------|:------------|
| `callback` | `Function` | Yes | Callback function |

**Example:**
```typescript
manager.onBeforeOverflow(async () => {
  console.log('Context about to overflow');
  await manager.createSnapshot(context);
});
```

**Behavior:**
- Triggered at 95% usage
- Multiple callbacks can be registered

---

### checkThresholds()

Check context usage and trigger callbacks.

**Signature:**
```typescript
checkThresholds(currentTokens: number, maxTokens: number): void
```

**Parameters:**

| Parameter | Type | Required | Description |
|:----------|:-----|:---------|:------------|
| `currentTokens` | `number` | Yes | Current token count |
| `maxTokens` | `number` | Yes | Maximum tokens |

**Example:**
```typescript
manager.checkThresholds(26000, 32768);
// Triggers callbacks if thresholds exceeded
```

**Behavior:**
- Calculates usage percentage
- Checks auto-snapshot threshold
- Checks pre-overflow threshold (95%)
- Triggers registered callbacks

---

### updateConfig()

Update configuration.

**Signature:**
```typescript
updateConfig(config: Partial<SnapshotConfig>): void
```

**Parameters:**

| Parameter | Type | Required | Description |
|:----------|:-----|:---------|:------------|
| `config` | `Partial<SnapshotConfig>` | Yes | Configuration updates |

**Example:**
```typescript
manager.updateConfig({
  maxCount: 10,
  autoThreshold: 0.75
});
```

---

### getConfig()

Get current configuration.

**Signature:**
```typescript
getConfig(): SnapshotConfig
```

**Returns:** `SnapshotConfig`

**Example:**
```typescript
const config = manager.getConfig();
console.log(`Max snapshots: ${config.maxCount}`);
console.log(`Auto-create: ${config.autoCreate}`);
```

---

### cleanupOldSnapshots()

Cleanup old snapshots, keeping only most recent.

**Signature:**
```typescript
async cleanupOldSnapshots(maxCount: number): Promise<void>
```

**Parameters:**

| Parameter | Type | Required | Description |
|:----------|:-----|:---------|:------------|
| `maxCount` | `number` | Yes | Maximum to keep |

**Example:**
```typescript
await manager.cleanupOldSnapshots(5);
console.log('Kept 5 most recent snapshots');
```

**Behavior:**
- Lists all snapshots
- Sorts by timestamp (newest first)
- Deletes snapshots beyond maxCount
- Skips deletion errors

---

## Types

### SnapshotConfig

```typescript
interface SnapshotConfig {
  enabled: boolean;
  maxCount: number;
  autoCreate: boolean;
  autoThreshold: number;
}
```

**Properties:**

| Property | Type | Description |
|:---------|:-----|:------------|
| `enabled` | `boolean` | Enable snapshot system |
| `maxCount` | `number` | Maximum snapshots to keep |
| `autoCreate` | `boolean` | Auto-create at threshold |
| `autoThreshold` | `number` | Threshold for auto-creation (0.0-1.0) |

---

### ContextSnapshot

```typescript
interface ContextSnapshot {
  id: string;
  sessionId: string;
  timestamp: Date;
  tokenCount: number;
  summary: string;
  messages: Message[];
  metadata: {
    model: string;
    contextSize: number;
    compressionRatio: number;
  };
}
```

**Properties:**

| Property | Type | Description |
|:---------|:-----|:------------|
| `id` | `string` | Unique snapshot ID (UUID) |
| `sessionId` | `string` | Associated session |
| `timestamp` | `Date` | Creation time |
| `tokenCount` | `number` | Total tokens |
| `summary` | `string` | Brief summary |
| `messages` | `Message[]` | Full messages |
| `metadata` | `object` | Additional metadata |

---

### ConversationContext

```typescript
interface ConversationContext {
  sessionId: string;
  messages: Message[];
  systemPrompt: Message;
  tokenCount: number;
  maxTokens: number;
  metadata: {
    model: string;
    contextSize: number;
    compressionHistory: CompressionEvent[];
  };
}
```

---

### SnapshotMetadata

```typescript
interface SnapshotMetadata {
  id: string;
  sessionId: string;
  timestamp: Date;
  tokenCount: number;
  summary: string;
  size: number;
}
```

---

## Examples

### Basic Usage

```typescript
import { createSnapshotStorage, createSnapshotManager } from '@ollm/ollm-cli-core';

// Create storage and manager
const storage = createSnapshotStorage('session-123');
const manager = createSnapshotManager(storage, {
  enabled: true,
  maxCount: 5,
  autoCreate: true,
  autoThreshold: 0.8
});

// Set session ID
manager.setSessionId('session-123');

// Create snapshot
const snapshot = await manager.createSnapshot(context);
console.log(`Created: ${snapshot.id}`);

// List snapshots
const snapshots = await manager.listSnapshots('session-123');
console.log(`Total: ${snapshots.length}`);

// Restore snapshot
const restored = await manager.restoreSnapshot(snapshot.id);
console.log(`Restored: ${restored.tokenCount} tokens`);
```

---

### Automatic Snapshots

```typescript
const manager = createSnapshotManager(storage, {
  enabled: true,
  maxCount: 5,
  autoCreate: true,
  autoThreshold: 0.8
});

// Register threshold callback
manager.onContextThreshold(0.8, async () => {
  console.log('Auto-creating snapshot at 80%');
  const snapshot = await manager.createSnapshot(context);
  console.log(`Created: ${snapshot.id}`);
});

// Check thresholds after adding messages
manager.checkThresholds(26000, 32768);
// Triggers callback if usage >= 80%
```

---

### Manual Snapshot Management

```typescript
// Create snapshot before risky operation
const beforeSnapshot = await manager.createSnapshot(context);

try {
  // Risky operation
  await performRiskyOperation();
} catch (error) {
  // Restore on error
  console.log('Error occurred, restoring snapshot');
  const restored = await manager.restoreSnapshot(beforeSnapshot.id);
  context = restored;
}
```

---

### Snapshot Cleanup

```typescript
// List all snapshots
const snapshots = await manager.listSnapshots('session-123');
console.log(`Total snapshots: ${snapshots.length}`);

// Keep only 3 most recent
await manager.cleanupOldSnapshots(3);

// Verify cleanup
const remaining = await manager.listSnapshots('session-123');
console.log(`Remaining: ${remaining.length}`);
```

---

### Pre-Overflow Handling

```typescript
manager.onBeforeOverflow(async () => {
  console.log('Context about to overflow!');
  
  // Create emergency snapshot
  const snapshot = await manager.createSnapshot(context);
  console.log(`Emergency snapshot: ${snapshot.id}`);
  
  // Notify user
  console.log('Please compress or clear context');
});

// Check thresholds
manager.checkThresholds(31000, 32768);
// Triggers callback at 95% (31,129 tokens)
```

---

### Multiple Thresholds

```typescript
// Register multiple thresholds
manager.onContextThreshold(0.7, () => {
  console.log('70% - Warning');
});

manager.onContextThreshold(0.8, async () => {
  console.log('80% - Creating snapshot');
  await manager.createSnapshot(context);
});

manager.onContextThreshold(0.9, () => {
  console.log('90% - Critical!');
});

// Check thresholds
manager.checkThresholds(currentTokens, maxTokens);
```

---

### Snapshot Browsing

```typescript
// List snapshots with details
const snapshots = await manager.listSnapshots('session-123');

snapshots.forEach((snapshot, index) => {
  const date = snapshot.timestamp.toLocaleString();
  const tokens = snapshot.tokenCount.toLocaleString();
  
  console.log(`${index + 1}. ${snapshot.id}`);
  console.log(`   Created: ${date}`);
  console.log(`   Tokens: ${tokens}`);
  console.log(`   Summary: ${snapshot.summary}`);
  console.log(`   Messages: ${snapshot.messages.length}`);
  console.log();
});
```

---

### Error Handling

```typescript
try {
  const snapshot = await manager.createSnapshot(context);
  console.log(`Created: ${snapshot.id}`);
} catch (error) {
  if (error.message.includes('disabled')) {
    console.error('Snapshots are disabled');
  } else if (error.message.includes('storage')) {
    console.error('Storage error:', error);
  } else {
    console.error('Unexpected error:', error);
  }
}

try {
  const context = await manager.restoreSnapshot('invalid-id');
} catch (error) {
  if (error.message.includes('not found')) {
    console.error('Snapshot not found');
  } else if (error.message.includes('corrupted')) {
    console.error('Snapshot corrupted');
  } else {
    console.error('Unexpected error:', error);
  }
}
```

---

### Configuration Updates

```typescript
// Get current config
const config = manager.getConfig();
console.log(`Current max: ${config.maxCount}`);

// Update config
manager.updateConfig({
  maxCount: 10,
  autoThreshold: 0.75
});

// Verify update
const newConfig = manager.getConfig();
console.log(`New max: ${newConfig.maxCount}`);
console.log(`New threshold: ${newConfig.autoThreshold}`);
```

---

## See Also

- [API Overview](./README.md) - API introduction
- [ContextManager](./context-manager.md) - ContextManager API
- [CompressionService](./compression-service.md) - Compression API
- [Snapshots Guide](../management/snapshots.md) - User guide
- [Architecture](../Context_architecture.md) - System design

---

**Last Updated:** 2026-01-16  
**Version:** 1.0.0
