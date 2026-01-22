# Context Management System

Comprehensive context management for LLM conversations with automatic sizing, compression, snapshots, and memory safety.

## Overview

The context management system coordinates multiple services to provide intelligent conversation context handling:

- **VRAM Monitor**: Tracks GPU memory availability
- **Token Counter**: Measures context usage accurately
- **Context Pool**: Manages dynamic context sizing
- **Snapshot Manager**: Handles conversation checkpoints
- **Compression Service**: Reduces context size intelligently
- **Memory Guard**: Prevents out-of-memory errors

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Context Manager                          │
│  (Orchestrates all services, provides unified API)          │
└─────────────────────────────────────────────────────────────┘
         │         │         │         │         │
         ▼         ▼         ▼         ▼         ▼
    ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐
    │ VRAM   │ │ Token  │ │Context │ │Snapshot│ │Compress│
    │Monitor │ │Counter │ │  Pool  │ │Manager │ │Service │
    └────────┘ └────────┘ └────────┘ └────────┘ └────────┘
         │         │         │         │         │
         ▼         ▼         ▼         ▼         ▼
    ┌────────────────────────────────────────────────────┐
    │              Memory Guard                          │
    │  (Prevents OOM, triggers emergency actions)        │
    └────────────────────────────────────────────────────┘
```

## Core Services

### Context Manager (`contextManager.ts`)

Main orchestration layer that coordinates all services.

**Key Features:**
- Automatic context sizing based on available VRAM
- Tier-based compression strategies (5 tiers from 2K to 64K+)
- Adaptive system prompts based on context tier
- Goal stack and reasoning storage integration
- Hierarchical checkpoint compression

**Usage:**
```typescript
const manager = createContextManager('session-123', modelInfo, {
  targetSize: 8192,
  autoSize: true,
  compression: {
    enabled: true,
    threshold: 0.95,
    strategy: 'hybrid'
  }
});

await manager.start();
await manager.addMessage(message);
```

### Compression Service (`compressionService.ts`)

Reduces context size using three strategies:

#### 1. Truncate Strategy
- **Algorithm**: Remove oldest messages until under target
- **Preserves**: System prompt, all user messages
- **Performance**: O(n), instant
- **Best for**: Simple token reduction

#### 2. Summarize Strategy
- **Algorithm**: LLM generates summary of older messages
- **Preserves**: System prompt, all user messages, recent messages
- **Performance**: O(n) + LLM call (~2-5s)
- **Best for**: Maintaining conversation context

#### 3. Hybrid Strategy
- **Algorithm**: Truncate very old + summarize middle + preserve recent
- **Preserves**: System prompt, all user messages, recent messages
- **Performance**: O(n) + LLM call (~2-5s)
- **Best for**: Long conversations with multiple compression cycles

**Compression Algorithm Details:**

```
Input: messages[], strategy
Output: CompressedContext

1. Separate messages by role:
   - User messages → NEVER compress (preserve all)
   - System messages → Always preserve first one
   - Other messages → Candidates for compression

2. Calculate preservation budget:
   - Base budget: strategy.preserveRecent tokens
   - Fractional budget: 30% of total tokens
   - Actual budget: max(base, fractional)

3. Select recent messages to preserve:
   - Start from newest message
   - Add messages until budget exhausted
   - These stay verbatim in context

4. Compress older messages:
   - Truncate: Simply remove them
   - Summarize: Generate LLM summary
   - Hybrid: Truncate oldest, summarize middle

5. Reconstruct context:
   - System prompt
   - All user messages (never compressed!)
   - Compression summary (if any)
   - Preserved recent messages

6. Inflation guard:
   - Compare compressed vs original token count
   - Mark as 'inflated' if compression failed
   - Caller decides whether to use result
```

**Performance Characteristics:**

| Strategy   | Time Complexity | LLM Calls | Typical Time | Compression Ratio |
|------------|----------------|-----------|--------------|-------------------|
| Truncate   | O(n)           | 0         | <10ms        | 0.3-0.5           |
| Summarize  | O(n)           | 1         | 2-5s         | 0.4-0.6           |
| Hybrid     | O(n)           | 1         | 2-5s         | 0.3-0.5           |

### Snapshot Manager (`snapshotManager.ts`)

Manages conversation snapshots for recovery and rollback.

**Key Features:**
- Automatic snapshots at configurable thresholds (default: 85%)
- Rolling cleanup (keeps N most recent snapshots)
- Threshold callbacks for proactive management
- Migration support for old snapshot formats

**Snapshot Format:**
```typescript
{
  id: string;
  sessionId: string;
  timestamp: Date;
  tokenCount: number;
  summary: string;
  userMessages: Message[];      // ALL user messages preserved
  messages: Message[];           // Other messages
  goalStack?: GoalStack;         // Active goals
  reasoningStorage?: ReasoningStorage;  // Reasoning traces
  metadata: {
    model: string;
    contextSize: number;
    compressionRatio: number;
    totalUserMessages: number;
  }
}
```

**Usage:**
```typescript
const manager = createSnapshotManager(storage, {
  enabled: true,
  maxCount: 5,
  autoCreate: true,
  autoThreshold: 0.85
});

// Create snapshot
const snapshot = await manager.createSnapshot(context);

// Restore later
const restored = await manager.restoreSnapshot(snapshot.id);

// Register threshold callback
manager.onContextThreshold(0.85, () => {
  console.log('Context 85% full, creating snapshot...');
});
```

**Performance:**
- Create: O(n) where n = message count, ~10-50ms
- Restore: O(n), ~10-50ms
- List: O(m) where m = snapshot count, ~1-5ms
- Delete: O(1), ~1ms

### Token Counter (`tokenCounter.ts`)

Accurate token counting with caching.

**Features:**
- Per-message token caching
- Conversation-level token counting
- Tool call overhead accounting
- Cache invalidation support

**Usage:**
```typescript
const counter = createTokenCounter();

// Count single message (cached)
const tokens = counter.countTokensCached(messageId, content);

// Count entire conversation
const total = counter.countConversationTokens(messages);

// Clear cache
counter.clearCache();
```

### Context Pool (`contextPool.ts`)

Dynamic context sizing based on available VRAM.

**Features:**
- Automatic size calculation from VRAM info
- KV cache quantization support
- Safety buffer management
- Resize callbacks

**Usage:**
```typescript
const pool = createContextPool({
  minContextSize: 2048,
  maxContextSize: 131072,
  targetContextSize: 8192,
  autoSize: true
}, async (newSize) => {
  console.log(`Context resized to ${newSize} tokens`);
});

// Calculate optimal size
const optimal = pool.calculateOptimalSize(vramInfo, modelInfo);
await pool.resize(optimal);
```

### VRAM Monitor (`vramMonitor.ts`)

Tracks GPU memory availability.

**Features:**
- Cross-platform GPU detection (NVIDIA, AMD, Apple Silicon)
- Periodic monitoring
- Low memory callbacks
- Fallback to CPU mode

**Usage:**
```typescript
const monitor = createVRAMMonitor();

// Start monitoring (poll every 5 seconds)
monitor.startMonitoring(5000);

// Register low memory callback
monitor.onLowMemory((vramInfo) => {
  console.warn('Low VRAM:', vramInfo);
});

// Get current info
const info = await monitor.getInfo();
```

### Memory Guard (`memoryGuard.ts`)

Prevents out-of-memory errors.

**Features:**
- Multi-level memory thresholds (WARNING, CRITICAL, EMERGENCY)
- Automatic compression triggers
- Emergency snapshot creation
- Allocation safety checks

**Usage:**
```typescript
const guard = createMemoryGuard(vramMonitor, contextPool, {
  safetyBuffer: 512 * 1024 * 1024,  // 512MB
  thresholds: {
    soft: 0.8,    // 80% - warning
    hard: 0.9,    // 90% - critical
    critical: 0.95 // 95% - emergency
  }
});

// Check if allocation is safe
if (guard.canAllocate(tokenCount)) {
  await addMessage(message);
}

// Register threshold callbacks
guard.onThreshold(MemoryLevel.WARNING, async () => {
  await compress();
});
```

## Tier-Based Compression

The system uses 5 context tiers with different compression strategies:

### Tier 1: Minimal (2-4K tokens)
- **Strategy**: Rollover
- **Behavior**: Create snapshot, start fresh with ultra-compact summary
- **Checkpoints**: 0 (rollover instead)
- **Best for**: Constrained devices, simple tasks

### Tier 2: Basic (4-8K tokens)
- **Strategy**: Smart compression
- **Behavior**: Create ONE detailed checkpoint + preserve critical info
- **Checkpoints**: 1-3
- **Best for**: Standard conversations, moderate complexity

### Tier 3: Standard (8-32K tokens)
- **Strategy**: Progressive checkpoints
- **Behavior**: Create 3-5 checkpoints with hierarchical compression
- **Checkpoints**: 3-5
- **Best for**: Complex conversations, code generation

### Tier 4: Premium (32-64K tokens)
- **Strategy**: Structured checkpoints
- **Behavior**: Up to 10 checkpoints with rich metadata
- **Checkpoints**: 5-10
- **Best for**: Long-running sessions, architecture discussions

### Tier 5: Ultra (64K+ tokens)
- **Strategy**: Ultra structured
- **Behavior**: Up to 15 checkpoints with maximum preservation
- **Checkpoints**: 10-15
- **Best for**: Extended sessions, comprehensive context

## Hierarchical Checkpoint Compression

Checkpoints are automatically compressed as they age:

```
Age 0-2 compressions: DETAILED (full summary, ~1000 tokens)
Age 3-5 compressions: MODERATE (key points, ~500 tokens)
Age 6+ compressions:  COMPACT (essentials only, ~100 tokens)
```

This creates a natural hierarchy where:
- Recent history is detailed
- Medium history is summarized
- Old history is ultra-compact

## Configuration

### Context Config
```typescript
{
  targetSize: 8192,           // Target context size
  minSize: 2048,              // Minimum context size
  maxSize: 131072,            // Maximum context size
  autoSize: true,             // Enable automatic sizing
  vramBuffer: 512 * 1024 * 1024,  // VRAM safety buffer
  kvQuantization: 'q8_0',     // KV cache quantization
  compression: {
    enabled: true,            // Enable compression
    threshold: 0.95,          // Compress at 95% usage
    strategy: 'hybrid',       // Compression strategy
    preserveRecent: 4096,     // Tokens to preserve
    summaryMaxTokens: 1024    // Max tokens in summary
  },
  snapshots: {
    enabled: true,            // Enable snapshots
    maxCount: 5,              // Keep 5 most recent
    autoCreate: true,         // Auto-create snapshots
    autoThreshold: 0.85       // Create at 85% usage
  }
}
```

## Events

The Context Manager emits events for monitoring and integration:

```typescript
manager.on('started', (data) => {
  // Context manager started
});

manager.on('message-added', ({ message, usage }) => {
  // Message added to context
});

manager.on('snapshot-created', (snapshot) => {
  // Snapshot created
});

manager.on('auto-summary-created', ({ summary, checkpoint }) => {
  // Automatic summarization completed
});

manager.on('tier-changed', ({ tier, config }) => {
  // Context tier changed
});

manager.on('low-memory', (vramInfo) => {
  // Low VRAM detected
});

manager.on('memory-warning', ({ level }) => {
  // Memory threshold crossed
});
```

## Best Practices

### 1. Always Start the Manager
```typescript
await manager.start();  // Initializes VRAM monitoring and sizing
```

### 2. Use Auto-Sizing for Production
```typescript
{
  autoSize: true,  // Automatically adjusts to available VRAM
  targetSize: 8192 // Fallback if auto-sizing unavailable
}
```

### 3. Enable Snapshots for Safety
```typescript
{
  snapshots: {
    enabled: true,
    autoCreate: true,
    autoThreshold: 0.85  // Snapshot before risky operations
  }
}
```

### 4. Configure Compression Appropriately
```typescript
{
  compression: {
    enabled: true,
    threshold: 0.95,     // Compress when nearly full
    strategy: 'hybrid',  // Best balance of quality and speed
    preserveRecent: 4096 // Keep recent context detailed
  }
}
```

### 5. Monitor Events
```typescript
manager.on('memory-warning', async () => {
  // Take action before memory runs out
  await manager.compress();
});

manager.on('auto-summary-created', ({ summary }) => {
  // Show user that compression occurred
  console.log('Context compressed:', summary.content);
});
```

### 6. Handle Errors Gracefully
```typescript
try {
  await manager.addMessage(message);
} catch (error) {
  if (error.message.includes('memory safety limit')) {
    // Context is full, compress or rollover
    await manager.compress();
    await manager.addMessage(message);
  }
}
```

## Performance Optimization

### Token Counting
- Uses caching to avoid recounting unchanged messages
- Batch counts entire conversations efficiently
- Clear cache periodically to prevent memory growth

### Compression
- Truncate strategy is instant (no LLM calls)
- Summarize/Hybrid strategies cache summaries
- Compression runs asynchronously to avoid blocking

### Snapshots
- Snapshots are created asynchronously
- Rolling cleanup prevents unbounded growth
- Metadata-only listing for fast UI updates

### Memory Management
- VRAM monitoring runs in background (5s intervals)
- Context pool caches size calculations
- Memory guard uses efficient threshold checks

## Troubleshooting

### Context Fills Up Too Quickly
- Increase `preserveRecent` to keep more recent messages
- Lower `compression.threshold` to compress earlier
- Use `hybrid` strategy for better compression ratio

### Compression Takes Too Long
- Use `truncate` strategy for instant compression
- Reduce `summaryMaxTokens` for faster LLM calls
- Increase `compression.threshold` to compress less often

### Snapshots Use Too Much Storage
- Reduce `snapshots.maxCount` to keep fewer snapshots
- Disable `autoCreate` and create snapshots manually
- Implement custom storage backend with compression

### VRAM Detection Fails
- System falls back to CPU mode automatically
- Manually set `autoSize: false` and specify `targetSize`
- Check GPU drivers are installed correctly

## Testing

The context management system includes comprehensive tests:

```bash
# Run all context tests
npm test -- packages/core/src/context

# Run specific service tests
npm test -- packages/core/src/context/compressionService.test.ts
npm test -- packages/core/src/context/snapshotManager.test.ts
npm test -- packages/core/src/context/contextManager.test.ts
```

## Migration Guide

### From Old Snapshot Format
Old snapshots without `userMessages` field are automatically migrated:
```typescript
// Old format
{ messages: [...all messages...] }

// New format (automatic migration)
{
  userMessages: [...user messages...],
  messages: [...other messages...]
}
```

### From Manual Context Management
```typescript
// Before
let messages = [];
if (messages.length > 100) {
  messages = messages.slice(-50);  // Manual truncation
}

// After
const manager = createContextManager(sessionId, modelInfo);
await manager.start();
await manager.addMessage(message);  // Automatic management
```

## References

- [Context Architecture](../../../../docs/Context/New/Context-Architecture.md)
- [Compression Strategies](../../../../docs/Context/New/Adaptive_system_Prompts.md)
- [Snapshot System](../../../../docs/Context/New/Session-Snapshots.md)
- [VRAM Monitoring](../../../../docs/Context/New/Checkpoint_Flow-Diagram.md)
