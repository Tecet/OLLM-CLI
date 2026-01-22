# ContextManager API Reference

Complete API reference for the ContextManager class.

## Table of Contents

- [Overview](#overview)
- [Constructor](#constructor)
- [Properties](#properties)
- [Methods](#methods)
- [Events](#events)
- [Types](#types)
- [Examples](#examples)

---

## Overview

The `ContextManager` is the main orchestration layer that coordinates all context management services. It provides a unified API for managing conversation context, VRAM, snapshots, and compression.

**Import:**
```typescript
import { createContextManager, ContextManager } from '@ollm/ollm-cli-core';
```

**Factory Function:**
```typescript
function createContextManager(
  sessionId: string,
  modelInfo: ModelInfo,
  config?: Partial<ContextConfig>
): ContextManager
```

---

## Constructor

### createContextManager()

Creates a new ContextManager instance.

**Signature:**
```typescript
createContextManager(
  sessionId: string,
  modelInfo: ModelInfo,
  config?: Partial<ContextConfig>
): ContextManager
```

**Parameters:**

| Parameter | Type | Required | Description |
|:----------|:-----|:---------|:------------|
| `sessionId` | `string` | Yes | Unique session identifier |
| `modelInfo` | `ModelInfo` | Yes | Model information for calculations |
| `config` | `Partial<ContextConfig>` | No | Configuration options |

**ModelInfo:**
```typescript
interface ModelInfo {
  parameters: number;      // Model size in billions
  contextLimit: number;    // Maximum context tokens
}
```

**Example:**
```typescript
const manager = createContextManager(
  'session-abc123',
  { parameters: 8, contextLimit: 32768 },
  {
    targetSize: 16384,
    autoSize: true,
    compression: {
      enabled: true,
      threshold: 0.8,
      strategy: 'hybrid'
    }
  }
);
```

---

## Properties

### config

Current configuration.

**Type:** `ContextConfig`  
**Read-only:** No (use `updateConfig()` to modify)

**Example:**
```typescript
console.log(manager.config.targetSize);
// 16384
```

---

### activeSkills

List of currently active skills.

**Type:** `string[]`  
**Read-only:** No (use `setActiveSkills()` to modify)

**Example:**
```typescript
console.log(manager.activeSkills);
// ['code-review', 'debugging']
```

---

### activeTools

List of currently active tools.

**Type:** `string[]`  
**Read-only:** No (use `setActiveTools()` to modify)

---

## Methods

### start()

Start context management services.

**Signature:**
```typescript
async start(): Promise<void>
```

**Description:**
- Starts VRAM monitoring
- Calculates optimal context size
- Initializes all services

**Example:**
```typescript
await manager.start();
console.log('Context manager started');
```

**Throws:**
- None (idempotent - safe to call multiple times)

---

### stop()

Stop context management services.

**Signature:**
```typescript
async stop(): Promise<void>
```

**Description:**
- Stops VRAM monitoring
- Cleans up resources

**Example:**
```typescript
await manager.stop();
console.log('Context manager stopped');
```

---

### updateConfig()

Update configuration.

**Signature:**
```typescript
updateConfig(config: Partial<ContextConfig>): void
```

**Parameters:**

| Parameter | Type | Required | Description |
|:----------|:-----|:---------|:------------|
| `config` | `Partial<ContextConfig>` | Yes | Configuration updates |

**Example:**
```typescript
manager.updateConfig({
  targetSize: 24576,
  compression: {
    enabled: true,
    threshold: 0.75
  }
});
```

**Emits:** `config-updated`

---

### getUsage()

Get current context usage statistics.

**Signature:**
```typescript
getUsage(): ContextUsage
```

**Returns:** `ContextUsage`

```typescript
interface ContextUsage {
  currentTokens: number;
  maxTokens: number;
  percentage: number;
  vramUsed: number;
  vramTotal: number;
}
```

**Example:**
```typescript
const usage = manager.getUsage();
console.log(`Context: ${usage.percentage}%`);
console.log(`Tokens: ${usage.currentTokens}/${usage.maxTokens}`);
console.log(`VRAM: ${usage.vramUsed}/${usage.vramTotal} bytes`);
```

---

### addMessage()

Add message to context.

**Signature:**
```typescript
async addMessage(message: Message): Promise<void>
```

**Parameters:**

| Parameter | Type | Required | Description |
|:----------|:-----|:---------|:------------|
| `message` | `Message` | Yes | Message to add |

**Message:**
```typescript
interface Message {
  id: string;
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  timestamp: Date;
  tokenCount?: number;  // Auto-calculated if not provided
}
```

**Example:**
```typescript
await manager.addMessage({
  id: 'msg-1',
  role: 'user',
  content: 'Hello, how are you?',
  timestamp: new Date()
});
```

**Behavior:**
- Counts tokens automatically
- Checks memory safety
- Triggers compression if needed
- Emits `message-added` event

**Throws:**
- `Error` if message exceeds memory safety limit

**Emits:** `message-added`

---

### createSnapshot()

Create manual snapshot of current context.

**Signature:**
```typescript
async createSnapshot(): Promise<ContextSnapshot>
```

**Returns:** `ContextSnapshot`

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

**Example:**
```typescript
const snapshot = await manager.createSnapshot();
console.log(`Snapshot created: ${snapshot.id}`);
console.log(`Tokens: ${snapshot.tokenCount}`);
```

**Emits:** `snapshot-created`

---

### restoreSnapshot()

Restore context from snapshot.

**Signature:**
```typescript
async restoreSnapshot(snapshotId: string): Promise<void>
```

**Parameters:**

| Parameter | Type | Required | Description |
|:----------|:-----|:---------|:------------|
| `snapshotId` | `string` | Yes | Snapshot ID to restore |

**Example:**
```typescript
await manager.restoreSnapshot('snapshot-abc123');
console.log('Context restored');
```

**Behavior:**
- Replaces current context
- Updates token counts
- Resets memory guard

**Throws:**
- `Error` if snapshot not found
- `Error` if snapshot corrupted

**Emits:** `snapshot-restored`

---

### listSnapshots()

List available snapshots for current session.

**Signature:**
```typescript
async listSnapshots(): Promise<ContextSnapshot[]>
```

**Returns:** `ContextSnapshot[]`

**Example:**
```typescript
const snapshots = await manager.listSnapshots();
snapshots.forEach(s => {
  console.log(`${s.id}: ${s.tokenCount} tokens`);
});
```

---

### compress()

Manually trigger context compression.

**Signature:**
```typescript
async compress(): Promise<void>
```

**Example:**
```typescript
const before = manager.getUsage();
await manager.compress();
const after = manager.getUsage();

console.log(`Compressed: ${before.currentTokens} → ${after.currentTokens}`);
```

**Behavior:**
- Uses configured strategy
- Preserves system prompt
- Preserves recent messages
- Updates token counts

**Emits:** `compressed` or `compression-skipped`

---

### clear()

Clear context (except system prompt).

**Signature:**
```typescript
async clear(): Promise<void>
```

**Example:**
```typescript
await manager.clear();
console.log('Context cleared');
```

**Behavior:**
- Removes all messages except system prompt
- Resets token count
- Clears token cache

**Emits:** `cleared`

---

### setSystemPrompt()

Set system prompt.

**Signature:**
```typescript
setSystemPrompt(content: string): void
```

**Parameters:**

| Parameter | Type | Required | Description |
|:----------|:-----|:---------|:------------|
| `content` | `string` | Yes | System prompt content |

**Example:**
```typescript
manager.setSystemPrompt('You are a helpful coding assistant.');
```

**Emits:** `system-prompt-updated`

---

### getSystemPrompt()

Get current system prompt.

**Signature:**
```typescript
getSystemPrompt(): string
```

**Returns:** `string`

**Example:**
```typescript
const prompt = manager.getSystemPrompt();
console.log(prompt);
```

---

### getMessages()

Get all messages in current context.

**Signature:**
```typescript
async getMessages(): Promise<Message[]>
```

**Returns:** `Message[]`

**Example:**
```typescript
const messages = await manager.getMessages();
console.log(`Total messages: ${messages.length}`);
```

---

### setActiveSkills()

Set active skills.

**Signature:**
```typescript
setActiveSkills(skills: string[]): void
```

**Parameters:**

| Parameter | Type | Required | Description |
|:----------|:-----|:---------|:------------|
| `skills` | `string[]` | Yes | List of skill names |

**Example:**
```typescript
manager.setActiveSkills(['code-review', 'debugging']);
```

**Emits:** `active-skills-updated`

---

### setActiveTools()

Set active tools.

**Signature:**
```typescript
setActiveTools(tools: string[]): void
```

**Parameters:**

| Parameter | Type | Required | Description |
|:----------|:-----|:---------|:------------|
| `tools` | `string[]` | Yes | List of tool names |

**Example:**
```typescript
manager.setActiveTools(['read-file', 'write-file', 'shell']);
```

**Emits:** `active-tools-updated`

---

### on()

Register event listener.

**Signature:**
```typescript
on(event: string, callback: (data: unknown) => void): void
```

**Parameters:**

| Parameter | Type | Required | Description |
|:----------|:-----|:---------|:------------|
| `event` | `string` | Yes | Event name |
| `callback` | `Function` | Yes | Event handler |

**Example:**
```typescript
manager.on('message-added', (data) => {
  console.log('Message added:', data);
});
```

---

### off()

Unregister event listener.

**Signature:**
```typescript
off(event: string, callback: (data: unknown) => void): void
```

**Example:**
```typescript
const handler = (data) => console.log(data);
manager.on('message-added', handler);
manager.off('message-added', handler);
```

---

### emit()

Emit event (internal use).

**Signature:**
```typescript
emit(event: string, data?: unknown): boolean
```

---

## Events

### started

Emitted when services start.

**Data:** None

**Example:**
```typescript
manager.on('started', () => {
  console.log('Services started');
});
```

---

### stopped

Emitted when services stop.

**Data:** None

---

### message-added

Emitted when message is added.

**Data:**
```typescript
{
  message: Message;
  usage: ContextUsage;
}
```

**Example:**
```typescript
manager.on('message-added', ({ message, usage }) => {
  console.log(`Added: ${message.content}`);
  console.log(`Usage: ${usage.percentage}%`);
});
```

---

### compressed

Emitted when context is compressed.

**Data:**
```typescript
{
  originalTokens: number;
  compressedTokens: number;
  ratio: number;
}
```

**Example:**
```typescript
manager.on('compressed', ({ originalTokens, compressedTokens, ratio }) => {
  const reduction = ((1 - ratio) * 100).toFixed(1);
  console.log(`Compressed: ${originalTokens} → ${compressedTokens} (${reduction}% reduction)`);
});
```

---

### compression-skipped

Emitted when compression is skipped (inflation guard).

**Data:**
```typescript
{
  reason: string;
  originalTokens: number;
  compressedTokens: number;
}
```

---

### snapshot-created

Emitted when snapshot is created.

**Data:** `ContextSnapshot`

**Example:**
```typescript
manager.on('snapshot-created', (snapshot) => {
  console.log(`Snapshot: ${snapshot.id}`);
});
```

---

### snapshot-restored

Emitted when snapshot is restored.

**Data:**
```typescript
{
  snapshotId: string;
  context: ConversationContext;
}
```

---

### memory-warning

Emitted at 80% VRAM usage.

**Data:**
```typescript
{
  level: MemoryLevel.WARNING;
}
```

**Example:**
```typescript
manager.on('memory-warning', () => {
  console.log('⚠ Memory warning');
});
```

---

### memory-critical

Emitted at 90% VRAM usage.

**Data:**
```typescript
{
  level: MemoryLevel.CRITICAL;
}
```

---

### memory-emergency

Emitted at 95% VRAM usage.

**Data:**
```typescript
{
  level: MemoryLevel.EMERGENCY;
}
```

---

### context-resized

Emitted when context size changes.

**Data:**
```typescript
{
  newSize: number;
}
```

---

### config-updated

Emitted when configuration is updated.

**Data:** `ContextConfig`

---

### cleared

Emitted when context is cleared.

**Data:** None

---

### low-memory

Emitted when VRAM is low.

**Data:** `VRAMInfo`

---

## Types

### ContextConfig

```typescript
interface ContextConfig {
  targetSize: number;
  minSize: number;
  maxSize: number;
  autoSize: boolean;
  vramBuffer: number;
  kvQuantization: 'f16' | 'q8_0' | 'q4_0';
  compression: CompressionConfig;
  snapshots: SnapshotConfig;
}
```

### CompressionConfig

```typescript
interface CompressionConfig {
  enabled: boolean;
  threshold: number;
  strategy: 'truncate' | 'summarize' | 'hybrid';
  preserveRecent: number;
  summaryMaxTokens: number;
}
```

### SnapshotConfig

```typescript
interface SnapshotConfig {
  enabled: boolean;
  maxCount: number;
  autoCreate: boolean;
  autoThreshold: number;
}
```

### ContextUsage

```typescript
interface ContextUsage {
  currentTokens: number;
  maxTokens: number;
  percentage: number;
  vramUsed: number;
  vramTotal: number;
}
```

### Message

```typescript
interface Message {
  id: string;
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  timestamp: Date;
  tokenCount?: number;
  toolCalls?: ToolCall[];
  toolCallId?: string;
}
```

---

## Examples

### Basic Usage

```typescript
import { createContextManager } from '@ollm/ollm-cli-core';

// Create manager
const manager = createContextManager(
  'session-123',
  { parameters: 8, contextLimit: 32768 }
);

// Start services
await manager.start();

// Set system prompt
manager.setSystemPrompt('You are a helpful assistant.');

// Add messages
await manager.addMessage({
  id: 'msg-1',
  role: 'user',
  content: 'Hello!',
  timestamp: new Date()
});

// Check usage
const usage = manager.getUsage();
console.log(`Usage: ${usage.percentage}%`);

// Stop services
await manager.stop();
```

---

### Event-Driven Usage

```typescript
const manager = createContextManager(sessionId, modelInfo);

// Listen for events
manager.on('message-added', ({ usage }) => {
  if (usage.percentage > 75) {
    console.log('Context filling up');
  }
});

manager.on('memory-warning', async () => {
  console.log('Creating safety snapshot');
  await manager.createSnapshot();
});

manager.on('compressed', ({ ratio }) => {
  console.log(`Compression ratio: ${ratio}`);
});

await manager.start();
```

---

### Manual Control

```typescript
const manager = createContextManager(sessionId, modelInfo, {
  autoSize: false,
  targetSize: 16384,
  compression: { enabled: false }
});

await manager.start();

// Manual compression
const usage = manager.getUsage();
if (usage.percentage > 80) {
  await manager.createSnapshot();
  await manager.compress();
}

// Manual size adjustment
if (usage.percentage > 90) {
  manager.updateConfig({ targetSize: 8192 });
}
```

---

### Snapshot Management

```typescript
// Create snapshot
const snapshot = await manager.createSnapshot();
console.log(`Created: ${snapshot.id}`);

// List snapshots
const snapshots = await manager.listSnapshots();
snapshots.forEach(s => {
  console.log(`${s.id}: ${s.tokenCount} tokens`);
});

// Restore snapshot
await manager.restoreSnapshot(snapshot.id);
console.log('Restored');
```

---

### Error Handling

```typescript
try {
  await manager.addMessage(message);
} catch (error) {
  if (error.message.includes('memory safety limit')) {
    // Handle memory error
    console.log('Memory limit reached, compressing...');
    await manager.compress();
    
    // Retry
    await manager.addMessage(message);
  } else {
    console.error('Unexpected error:', error);
  }
}
```

---

## See Also

- [API Overview](./README.md) - API introduction
- [SnapshotManager](./snapshot-manager.md) - Snapshot API
- [CompressionService](./compression-service.md) - Compression API
- [Architecture](../Context_architecture.md) - System design
- [User Guide](../management/user-guide.md) - Using context management

---

**Last Updated:** 2026-01-16  
**Version:** 1.0.0
