# Context Management System

This module provides memory-efficient conversation management for local LLMs running in OLLM CLI. It dynamically adjusts context size based on available VRAM, creates snapshots for conversation rollover, and prevents out-of-memory errors while maximizing usable context.

## Components

### VRAM Monitor
Tracks GPU memory availability across different platforms (NVIDIA, AMD, Apple Silicon, CPU-only). Provides real-time memory information and emits low-memory events.

### Token Counter
Measures context usage by counting tokens in messages. Integrates with provider APIs and provides fallback estimation. Caches token counts for performance.

### Context Pool
Manages dynamic context sizing based on available VRAM. Calculates optimal context size using model parameters and KV cache quantization. Enforces min/max limits.

### Snapshot Manager
Handles conversation checkpoints for rollover. Creates automatic snapshots at thresholds, implements rolling cleanup, and provides snapshot restoration.

### Compression Service
Reduces context size through multiple strategies (summarize, truncate, hybrid). Preserves recent messages and system prompts. Provides compression estimation.

### Memory Guard
Prevents out-of-memory errors through proactive monitoring. Triggers actions at memory thresholds (80%, 90%, 95%). Executes emergency snapshot and clear operations.

### Snapshot Storage
Persists snapshots to disk with atomic writes. Detects corruption and maintains metadata index for quick lookup.

### Context Manager
Orchestrates all context operations and coordinates between services. Provides the main API for context management.

## Architecture

```
Context Manager (Orchestration)
├── VRAM Monitor (Memory Tracking)
├── Token Counter (Usage Measurement)
├── Context Pool (Dynamic Sizing)
├── Snapshot Manager (Checkpoints)
│   └── Snapshot Storage (Persistence)
├── Compression Service (Size Reduction)
└── Memory Guard (Safety)
```

## Usage

```typescript
import { ContextManager, ContextConfig } from './context/index.js';

// Create context manager with configuration
const config: ContextConfig = {
  targetSize: 8192,
  minSize: 2048,
  maxSize: 32768,
  autoSize: true,
  vramBuffer: 512 * 1024 * 1024, // 512MB
  kvQuantization: 'q8_0',
  compression: {
    enabled: true,
    threshold: 0.8,
    strategy: 'hybrid',
    preserveRecent: 4096,
    summaryMaxTokens: 1024
  },
  snapshots: {
    enabled: true,
    maxCount: 5,
    autoCreate: true,
    autoThreshold: 0.8
  }
};

const contextManager = createContextManager(config);
await contextManager.start();

// Add messages to context
await contextManager.addMessage({
  id: 'msg-1',
  role: 'user',
  content: 'Hello!',
  timestamp: new Date()
});

// Get usage statistics
const usage = contextManager.getUsage();
console.log(`Context usage: ${usage.percentage}%`);

// Create manual snapshot
const snapshot = await contextManager.createSnapshot();

// Compress context manually
await contextManager.compress();

// Stop context manager
await contextManager.stop();
```

## Testing

The module uses property-based testing with fast-check to verify correctness properties across all inputs. Each component has both unit tests and property tests.

Run tests:
```bash
npm test -- packages/core/src/context
```

## Configuration

Context management can be configured through the main OLLM config file:

```yaml
context:
  targetSize: 8192
  minSize: 2048
  maxSize: 32768
  autoSize: true
  vramBuffer: 536870912  # 512MB in bytes
  kvQuantization: q8_0
  compression:
    enabled: true
    threshold: 0.8
    strategy: hybrid
    preserveRecent: 4096
    summaryMaxTokens: 1024
  snapshots:
    enabled: true
    maxCount: 5
    autoCreate: true
    autoThreshold: 0.8
```

## Commands

Users can control context management through CLI commands:

- `/context` - Show current status
- `/context size <tokens>` - Set target size
- `/context auto` - Enable auto-sizing
- `/context snapshot` - Create snapshot
- `/context restore <id>` - Restore snapshot
- `/context list` - List snapshots
- `/context clear` - Clear context
- `/context compress` - Manual compression
- `/context stats` - Detailed statistics

## Implementation Status

- [x] Task 1: Infrastructure setup (types, directory structure)
- [ ] Task 2: GPU Detection and VRAM Monitor
- [ ] Task 3: Token Counter
- [ ] Task 4: Context Pool
- [ ] Task 5: Checkpoint
- [ ] Task 6: Snapshot Storage
- [ ] Task 7: Snapshot Manager
- [ ] Task 8: Compression Service
- [ ] Task 9: Memory Guard
- [ ] Task 10: Checkpoint
- [ ] Task 11: Context Manager orchestration
- [ ] Task 12: /context command
- [ ] Task 13: Context Status UI component
- [ ] Task 14: Integration and configuration
- [ ] Task 15: Final checkpoint
