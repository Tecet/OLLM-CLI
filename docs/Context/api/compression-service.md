# CompressionService API Reference

Complete API reference for the CompressionService class.

## Table of Contents

- [Overview](#overview)
- [Constructor](#constructor)
- [Methods](#methods)
- [Types](#types)
- [Examples](#examples)

---

## Overview

The `CompressionService` reduces context size through multiple strategies while preserving important information. It implements truncation, summarization, and hybrid approaches with inflation guard and fractional preservation.

**Import:**
```typescript
import { CompressionService } from '@ollm/ollm-cli-core';
```

**Constructor:**
```typescript
const service = new CompressionService();
```

---

## Constructor

### new CompressionService()

Creates a new CompressionService instance.

**Signature:**
```typescript
constructor()
```

**Example:**
```typescript
import { CompressionService } from '@ollm/ollm-cli-core';

const service = new CompressionService();
```

**Note:** No configuration needed at construction time.

---

## Methods

### compress()

Compress messages using specified strategy.

**Signature:**
```typescript
async compress(
  messages: Message[],
  strategy: CompressionStrategy
): Promise<CompressedContext>
```

**Parameters:**

| Parameter | Type | Required | Description |
|:----------|:-----|:---------|:------------|
| `messages` | `Message[]` | Yes | Messages to compress |
| `strategy` | `CompressionStrategy` | Yes | Compression strategy |

**CompressionStrategy:**
```typescript
interface CompressionStrategy {
  type: 'truncate' | 'summarize' | 'hybrid';
  preserveRecent: number;
  summaryMaxTokens: number;
}
```

**Returns:** `CompressedContext`

```typescript
interface CompressedContext {
  summary: Message;
  preserved: Message[];
  originalTokens: number;
  compressedTokens: number;
  compressionRatio: number;
  status?: 'success' | 'inflated';
}
```

**Example:**
```typescript
const result = await service.compress(messages, {
  type: 'hybrid',
  preserveRecent: 4096,
  summaryMaxTokens: 1024
});

console.log(`Original: ${result.originalTokens} tokens`);
console.log(`Compressed: ${result.compressedTokens} tokens`);
console.log(`Ratio: ${result.compressionRatio}`);
console.log(`Status: ${result.status}`);
```

**Behavior:**
- Preserves system prompt (always)
- Preserves recent messages (configurable)
- Compresses or removes old messages
- Implements inflation guard
- Returns status indicator

**Strategies:**

**1. Truncate:**
- Removes oldest messages
- Fastest (instant)
- No LLM call required

**2. Summarize:**
- LLM-generated summary
- Best quality
- Requires ~2s LLM call

**3. Hybrid (Recommended):**
- Truncates oldest
- Summarizes middle
- Preserves recent
- Balanced approach

---

### estimateCompression()

Estimate compression without performing it.

**Signature:**
```typescript
estimateCompression(messages: Message[]): CompressionEstimate
```

**Parameters:**

| Parameter | Type | Required | Description |
|:----------|:-----|:---------|:------------|
| `messages` | `Message[]` | Yes | Messages to estimate |

**Returns:** `CompressionEstimate`

```typescript
interface CompressionEstimate {
  estimatedTokens: number;
  estimatedRatio: number;
  strategy: CompressionStrategy;
}
```

**Example:**
```typescript
const estimate = service.estimateCompression(messages);
console.log(`Estimated tokens: ${estimate.estimatedTokens}`);
console.log(`Estimated ratio: ${estimate.estimatedRatio}`);
```

**Behavior:**
- Fast estimation
- No actual compression
- Uses heuristics

---

### shouldCompress()

Check if compression is needed.

**Signature:**
```typescript
shouldCompress(tokenCount: number, threshold: number): boolean
```

**Parameters:**

| Parameter | Type | Required | Description |
|:----------|:-----|:---------|:------------|
| `tokenCount` | `number` | Yes | Current token count |
| `threshold` | `number` | Yes | Threshold (0.0-1.0) |

**Returns:** `boolean`

**Example:**
```typescript
const currentTokens = 26000;
const maxTokens = 32768;
const threshold = 0.8;

const usage = currentTokens / maxTokens;
if (service.shouldCompress(usage, threshold)) {
  console.log('Compression recommended');
  await service.compress(messages, strategy);
}
```

---

## Types

### CompressionStrategy

```typescript
interface CompressionStrategy {
  type: 'truncate' | 'summarize' | 'hybrid';
  preserveRecent: number;
  summaryMaxTokens: number;
}
```

**Properties:**

| Property | Type | Description |
|:---------|:-----|:------------|
| `type` | `string` | Strategy type |
| `preserveRecent` | `number` | Tokens to keep uncompressed |
| `summaryMaxTokens` | `number` | Max tokens for summary |

**Strategy Types:**

**truncate:**
- Removes oldest messages
- Fast (instant)
- May lose context

**summarize:**
- LLM-generated summary
- Best quality
- Slower (~2s)

**hybrid:**
- Truncate + summarize + preserve
- Balanced
- Recommended

---

### CompressedContext

```typescript
interface CompressedContext {
  summary: Message;
  preserved: Message[];
  originalTokens: number;
  compressedTokens: number;
  compressionRatio: number;
  status?: 'success' | 'inflated';
}
```

**Properties:**

| Property | Type | Description |
|:---------|:-----|:------------|
| `summary` | `Message` | System message with summary |
| `preserved` | `Message[]` | Recent messages kept intact |
| `originalTokens` | `number` | Original token count |
| `compressedTokens` | `number` | Compressed token count |
| `compressionRatio` | `number` | Ratio (compressed/original) |
| `status` | `string` | Success or inflated |

**Status Values:**

**success:**
- Compression reduced tokens
- Safe to use result

**inflated:**
- Compression increased tokens
- Should skip update (inflation guard)

---

### CompressionEstimate

```typescript
interface CompressionEstimate {
  estimatedTokens: number;
  estimatedRatio: number;
  strategy: CompressionStrategy;
}
```

---

### Message

```typescript
interface Message {
  id: string;
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  timestamp: Date;
  tokenCount?: number;
}
```

---

## Examples

### Basic Compression

```typescript
import { CompressionService } from '@ollm/ollm-cli-core';

const service = new CompressionService();

// Compress with hybrid strategy
const result = await service.compress(messages, {
  type: 'hybrid',
  preserveRecent: 4096,
  summaryMaxTokens: 1024
});

if (result.status === 'success') {
  console.log(`Compressed: ${result.originalTokens} → ${result.compressedTokens}`);
  
  // Use compressed messages
  const newMessages = [
    systemPrompt,
    result.summary,
    ...result.preserved
  ];
} else {
  console.log('Compression would inflate, skipping');
}
```

---

### Truncate Strategy

```typescript
// Fast compression - just remove old messages
const result = await service.compress(messages, {
  type: 'truncate',
  preserveRecent: 4096,
  summaryMaxTokens: 0  // Not used for truncate
});

console.log(`Removed ${messages.length - result.preserved.length} messages`);
```

---

### Summarize Strategy

```typescript
// Quality compression - LLM summary
const result = await service.compress(messages, {
  type: 'summarize',
  preserveRecent: 4096,
  summaryMaxTokens: 2048  // Larger summary
});

console.log(`Summary: ${result.summary.content}`);
console.log(`Preserved: ${result.preserved.length} messages`);
```

---

### Hybrid Strategy (Recommended)

```typescript
// Balanced compression
const result = await service.compress(messages, {
  type: 'hybrid',
  preserveRecent: 4096,
  summaryMaxTokens: 1024
});

console.log(`Strategy: hybrid`);
console.log(`Original: ${result.originalTokens} tokens`);
console.log(`Compressed: ${result.compressedTokens} tokens`);
console.log(`Reduction: ${((1 - result.compressionRatio) * 100).toFixed(1)}%`);
```

---

### Estimate Before Compressing

```typescript
// Estimate compression
const estimate = service.estimateCompression(messages);
console.log(`Estimated result: ${estimate.estimatedTokens} tokens`);
console.log(`Estimated ratio: ${estimate.estimatedRatio}`);

// Decide whether to compress
if (estimate.estimatedRatio < 0.9) {
  console.log('Good compression expected, proceeding');
  const result = await service.compress(messages, strategy);
} else {
  console.log('Poor compression expected, skipping');
}
```

---

### Check If Compression Needed

```typescript
const currentTokens = 26000;
const maxTokens = 32768;
const threshold = 0.8;

const usage = currentTokens / maxTokens;

if (service.shouldCompress(usage, threshold)) {
  console.log('Compression recommended');
  
  const result = await service.compress(messages, {
    type: 'hybrid',
    preserveRecent: 4096,
    summaryMaxTokens: 1024
  });
  
  if (result.status === 'success') {
    // Apply compression
    messages = [systemPrompt, result.summary, ...result.preserved];
  }
}
```

---

### Inflation Guard

```typescript
const result = await service.compress(messages, strategy);

if (result.status === 'inflated') {
  console.log('⚠ Compression would increase tokens');
  console.log(`Original: ${result.originalTokens}`);
  console.log(`Would be: ${result.compressedTokens}`);
  console.log('Skipping compression');
  
  // Keep original messages
} else {
  console.log('✓ Compression successful');
  console.log(`Saved: ${result.originalTokens - result.compressedTokens} tokens`);
  
  // Use compressed messages
  messages = [systemPrompt, result.summary, ...result.preserved];
}
```

---

### Progressive Compression

```typescript
// Start with gentle compression
let result = await service.compress(messages, {
  type: 'hybrid',
  preserveRecent: 8192,  // Preserve more
  summaryMaxTokens: 2048
});

// If still too large, compress more aggressively
if (result.compressedTokens > targetTokens) {
  result = await service.compress(messages, {
    type: 'hybrid',
    preserveRecent: 4096,  // Preserve less
    summaryMaxTokens: 1024
  });
}

// If still too large, use truncate
if (result.compressedTokens > targetTokens) {
  result = await service.compress(messages, {
    type: 'truncate',
    preserveRecent: 2048,  // Minimal preservation
    summaryMaxTokens: 0
  });
}
```

---

### Compression with Metrics

```typescript
const before = {
  count: messages.length,
  tokens: messages.reduce((sum, m) => sum + (m.tokenCount || 0), 0)
};

const result = await service.compress(messages, strategy);

const after = {
  count: result.preserved.length + 1,  // +1 for summary
  tokens: result.compressedTokens
};

console.log('Compression Metrics:');
console.log(`Messages: ${before.count} → ${after.count}`);
console.log(`Tokens: ${before.tokens} → ${after.tokens}`);
console.log(`Reduction: ${((1 - result.compressionRatio) * 100).toFixed(1)}%`);
console.log(`Status: ${result.status}`);
```

---

### Error Handling

```typescript
try {
  const result = await service.compress(messages, strategy);
  
  if (result.status === 'success') {
    // Use result
    console.log('Compression successful');
  } else {
    // Handle inflation
    console.log('Compression skipped (inflation guard)');
  }
} catch (error) {
  if (error.message.includes('LLM')) {
    console.error('LLM error during summarization:', error);
    
    // Fallback to truncate
    const result = await service.compress(messages, {
      type: 'truncate',
      preserveRecent: 4096,
      summaryMaxTokens: 0
    });
  } else {
    console.error('Unexpected error:', error);
  }
}
```

---

### Strategy Comparison

```typescript
const strategies = [
  { type: 'truncate', preserveRecent: 4096, summaryMaxTokens: 0 },
  { type: 'summarize', preserveRecent: 4096, summaryMaxTokens: 1024 },
  { type: 'hybrid', preserveRecent: 4096, summaryMaxTokens: 1024 }
];

console.log('Strategy Comparison:');
console.log(`Original: ${messages.length} messages\n`);

for (const strategy of strategies) {
  const result = await service.compress(messages, strategy);
  
  console.log(`${strategy.type}:`);
  console.log(`  Tokens: ${result.originalTokens} → ${result.compressedTokens}`);
  console.log(`  Ratio: ${result.compressionRatio.toFixed(3)}`);
  console.log(`  Status: ${result.status}`);
  console.log();
}
```

---

### Adaptive Compression

```typescript
async function adaptiveCompress(
  messages: Message[],
  targetTokens: number
): Promise<CompressedContext> {
  // Try gentle compression first
  let result = await service.compress(messages, {
    type: 'hybrid',
    preserveRecent: 8192,
    summaryMaxTokens: 2048
  });
  
  // If not enough, try moderate
  if (result.compressedTokens > targetTokens) {
    result = await service.compress(messages, {
      type: 'hybrid',
      preserveRecent: 4096,
      summaryMaxTokens: 1024
    });
  }
  
  // If still not enough, try aggressive
  if (result.compressedTokens > targetTokens) {
    result = await service.compress(messages, {
      type: 'truncate',
      preserveRecent: 2048,
      summaryMaxTokens: 0
    });
  }
  
  return result;
}

const result = await adaptiveCompress(messages, 16384);
console.log(`Final: ${result.compressedTokens} tokens`);
```

---

## See Also

- [API Overview](./README.md) - API introduction
- [ContextManager](./context-manager.md) - ContextManager API
- [SnapshotManager](./snapshot-manager.md) - SnapshotManager API
- [Compression Guide](../management/compression.md) - User guide
- [Architecture](../Context_architecture.md) - System design

---

**Last Updated:** 2026-01-16  
**Version:** 1.0.0
