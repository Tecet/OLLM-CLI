# Context Management API Reference

API documentation for Context Management system components.

## Overview

The Context Management API provides programmatic access to all context management features. This section documents the public interfaces, methods, and integration patterns for developers.

## API Components

### [ContextManager](./context-manager.md)
Main orchestration layer for context management:
- Start/stop services
- Add messages to context
- Create and restore snapshots
- Trigger compression
- Configure settings
- Event handling

### [SnapshotManager](./snapshot-manager.md)
Snapshot creation and management:
- Create snapshots
- Restore from snapshots
- List available snapshots
- Delete snapshots
- Automatic snapshot triggers
- Rolling cleanup

### [CompressionService](./compression-service.md)
Context compression functionality:
- Compress messages
- Estimate compression
- Multiple strategies
- Inflation guard
- Fractional preservation

## Quick Start

### Basic Usage

```typescript
import { createContextManager } from '@ollm/ollm-cli-core';

// Create context manager
const contextManager = createContextManager(
  'session-123',
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

// Start services
await contextManager.start();

// Add messages
await contextManager.addMessage({
  id: 'msg-1',
  role: 'user',
  content: 'Hello!',
  timestamp: new Date()
});

// Get usage
const usage = contextManager.getUsage();
console.log(`Context: ${usage.percentage}%`);

// Create snapshot
const snapshot = await contextManager.createSnapshot();

// Compress context
await contextManager.compress();

// Stop services
await contextManager.stop();
```

### Event Handling

```typescript
// Listen for events
contextManager.on('message-added', (data) => {
  console.log('Message added:', data);
});

contextManager.on('compressed', (data) => {
  console.log('Context compressed:', data);
});

contextManager.on('memory-warning', (data) => {
  console.log('Memory warning:', data);
});

contextManager.on('snapshot-created', (data) => {
  console.log('Snapshot created:', data);
});
```

## Common Patterns

### Pattern 1: Auto-Managed Context

```typescript
// Let system handle everything automatically
const manager = createContextManager(sessionId, modelInfo, {
  autoSize: true,
  compression: {
    enabled: true,
    threshold: 0.8,
    strategy: 'hybrid'
  },
  snapshots: {
    enabled: true,
    autoCreate: true,
    autoThreshold: 0.8
  }
});

await manager.start();

// Just add messages, system handles the rest
await manager.addMessage(message);
```

### Pattern 2: Manual Control

```typescript
// Full manual control
const manager = createContextManager(sessionId, modelInfo, {
  autoSize: false,
  targetSize: 16384,
  compression: {
    enabled: false
  },
  snapshots: {
    enabled: true,
    autoCreate: false
  }
});

await manager.start();

// Manual operations
await manager.addMessage(message);

// Check usage
const usage = manager.getUsage();
if (usage.percentage > 80) {
  await manager.createSnapshot();
  await manager.compress();
}
```

### Pattern 3: Event-Driven

```typescript
// React to events
const manager = createContextManager(sessionId, modelInfo);

manager.on('memory-warning', async () => {
  console.log('Memory warning - creating snapshot');
  await manager.createSnapshot();
});

manager.on('memory-critical', async () => {
  console.log('Memory critical - compressing');
  await manager.compress();
});

manager.on('memory-emergency', async () => {
  console.log('Memory emergency - clearing');
  await manager.createSnapshot();
  await manager.clear();
});

await manager.start();
```

## Type Definitions

### Core Types

```typescript
// Message
interface Message {
  id: string;
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  timestamp: Date;
  tokenCount?: number;
}

// Context Usage
interface ContextUsage {
  currentTokens: number;
  maxTokens: number;
  percentage: number;
  vramUsed: number;
  vramTotal: number;
}

// Context Snapshot
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

// Configuration
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

## Events

### ContextManager Events

| Event | Data | Description |
|:------|:-----|:------------|
| `started` | - | Services started |
| `stopped` | - | Services stopped |
| `message-added` | `{ message, usage }` | Message added to context |
| `compressed` | `{ originalTokens, compressedTokens, ratio }` | Context compressed |
| `snapshot-created` | `ContextSnapshot` | Snapshot created |
| `snapshot-restored` | `{ snapshotId, context }` | Snapshot restored |
| `memory-warning` | `{ level }` | Memory warning (80%) |
| `memory-critical` | `{ level }` | Memory critical (90%) |
| `memory-emergency` | `{ level }` | Memory emergency (95%) |
| `context-resized` | `{ newSize }` | Context size changed |
| `config-updated` | `ContextConfig` | Configuration updated |
| `cleared` | - | Context cleared |

## Error Handling

### Common Errors

```typescript
try {
  await contextManager.addMessage(message);
} catch (error) {
  if (error.message.includes('memory safety limit')) {
    // Handle memory limit error
    await contextManager.compress();
    await contextManager.addMessage(message);
  } else if (error.message.includes('Session ID not set')) {
    // Handle session error
    console.error('Session not initialized');
  } else {
    // Handle other errors
    console.error('Unexpected error:', error);
  }
}
```

### Error Types

- **Memory Errors**: Context exceeds memory limits
- **Configuration Errors**: Invalid configuration values
- **Storage Errors**: Snapshot save/load failures
- **Compression Errors**: Compression failures

## Best Practices

### 1. Always Start/Stop Services

```typescript
const manager = createContextManager(sessionId, modelInfo);

try {
  await manager.start();
  // Use manager
} finally {
  await manager.stop();
}
```

### 2. Handle Events

```typescript
manager.on('memory-warning', async () => {
  // Take action before critical
  await manager.compress();
});
```

### 3. Check Usage Regularly

```typescript
const usage = manager.getUsage();
if (usage.percentage > 75) {
  await manager.createSnapshot();
}
```

### 4. Use Auto-Sizing

```typescript
// Let system optimize context size
const manager = createContextManager(sessionId, modelInfo, {
  autoSize: true
});
```

### 5. Enable Auto-Compression

```typescript
// Automatic memory management
const manager = createContextManager(sessionId, modelInfo, {
  compression: {
    enabled: true,
    threshold: 0.8
  }
});
```

## Integration Examples

### Express.js Integration

```typescript
import express from 'express';
import { createContextManager } from '@ollm/ollm-cli-core';

const app = express();
const sessions = new Map();

app.post('/chat', async (req, res) => {
  const { sessionId, message } = req.body;
  
  // Get or create context manager
  let manager = sessions.get(sessionId);
  if (!manager) {
    manager = createContextManager(sessionId, modelInfo);
    await manager.start();
    sessions.set(sessionId, manager);
  }
  
  // Add message
  await manager.addMessage({
    id: `msg-${Date.now()}`,
    role: 'user',
    content: message,
    timestamp: new Date()
  });
  
  // Get usage
  const usage = manager.getUsage();
  
  res.json({ usage });
});
```

### React Integration

```typescript
import { useEffect, useState } from 'react';
import { createContextManager } from '@ollm/ollm-cli-core';

function useContextManager(sessionId, modelInfo) {
  const [manager, setManager] = useState(null);
  const [usage, setUsage] = useState(null);
  
  useEffect(() => {
    const mgr = createContextManager(sessionId, modelInfo);
    
    mgr.on('message-added', () => {
      setUsage(mgr.getUsage());
    });
    
    mgr.start().then(() => {
      setManager(mgr);
      setUsage(mgr.getUsage());
    });
    
    return () => {
      mgr.stop();
    };
  }, [sessionId]);
  
  return { manager, usage };
}
```

## Related Documentation

- [Getting Started](../getting-started.md) - Quick start guide
- [Architecture](../Context_architecture.md) - System design
- [Configuration](../Context_configuration.md) - Configuration options
- [User Guide](../management/user-guide.md) - Using context management

---

**Last Updated:** 2026-01-16  
**Version:** 1.0.0
