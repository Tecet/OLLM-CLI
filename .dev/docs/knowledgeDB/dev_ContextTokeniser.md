# Token Counting System

**Last Updated:** January 27, 2026  
**Status:** Production Ready ✅  
**Audit Date:** January 27, 2026

**Related Documents:**

- `dev_ContextManagement.md` - Context sizing and VRAM management
- `dev_ContextCompression.md` - Compression triggers and budget calculation
- `dev_PromptSystem.md` - System prompt token accounting
- `dev_SessionsSnapChat.md` - Sessions, snapshots, and chat history
- `.dev/backlog/token-counting-audit.md` - Detailed audit findings

---

## Overview

The Token Counting System provides accurate, efficient token counting with caching, validation, and metrics tracking. It's the foundation for context management, compression triggers, and VRAM optimization.

**Core Principle:** Accurate token counting with validation and monitoring enables reliable context management.

---

## Architecture

### Components

1. **TokenCounterService** (`tokenCounter.ts`)
   - Counts tokens using provider API or fallback estimation
   - Caches counts to avoid recalculation
   - Tracks metrics for performance monitoring
   - Validates token counts for safety

2. **TokenCounterMetrics** (`tokenCounter.ts`)
   - Tracks cache hit/miss rates
   - Monitors recalculation frequency
   - Records message size statistics
   - Provides performance insights

3. **MessageStore** (`messageStore.ts`)
   - Uses token counter for message accounting
   - Validates token counts on message addition
   - Detects token drift in development mode
   - Warns on overflow conditions

---

## Token Counting Formula

### Fallback Estimation

```typescript
// Single rounding operation for accuracy
tokenCount = Math.ceil((text.length / 4) * modelMultiplier);
```

**Why `/4`?**

- Approximates ~0.75 words per token
- Standard estimation for English text
- Works well for most languages

**Why single `Math.ceil()`?**

- More accurate than double rounding
- Consistent behavior with multipliers
- Example: 10 chars, 1.2x multiplier
  - Old: `Math.round(Math.ceil(10/4) * 1.2)` = `round(3.6)` = 4
  - New: `Math.ceil((10/4) * 1.2)` = `ceil(3)` = 3 ✅

### Model Multipliers

Different models have different tokenization:

- GPT models: 1.0x (baseline)
- Llama models: 1.1x (slightly more tokens)
- Code models: 0.9x (fewer tokens for code)

---

## Caching Strategy

### How It Works

```typescript
countTokensCached(messageId: string, text: string): number {
  // 1. Check cache first
  const cached = this.cache.get(messageId);
  if (cached !== undefined) {
    this.metrics.recordCacheHit(); // 📊
    return cached;
  }

  // 2. Calculate if not cached
  const count = Math.ceil((text.length / 4) * this.modelMultiplier);

  // 3. Validate
  if (count < 0) {
    throw new Error(`Invalid token count: ${count}`);
  }

  // 4. Cache and return
  this.cache.set(messageId, count);
  this.metrics.recordCacheMiss(count); // 📊
  return count;
}
```

### Cache Invalidation

Cache is cleared when:

- Model multiplier changes
- Context is cleared
- Manual reset requested

**Why?** Cached values become invalid when counting parameters change.

---

## Validation & Safety

### Validation Checks

The system includes multiple validation checks to catch bugs early:

```typescript
// 1. Negative token count detection
if (tokenCount < 0) {
  console.error('[ContextManager] INVALID: Negative token count!', {
    messageId: message.id,
    tokenCount,
    contentLength: message.content.length,
  });
  throw new Error(`Invalid token count: ${tokenCount}`);
}

// 2. Overflow warnings
if (context.tokenCount > context.maxTokens) {
  console.error('[ContextManager] OVERFLOW: Token count exceeds limit!', {
    current: context.tokenCount,
    max: context.maxTokens,
    overage: context.tokenCount - context.maxTokens,
  });
}

// 3. Token drift detection (development mode)
if (process.env.NODE_ENV === 'development') {
  const calculatedTotal = this.tokenCounter.countConversationTokens(context.messages);
  if (Math.abs(calculatedTotal - context.tokenCount) > 10) {
    console.warn('[ContextManager] TOKEN DRIFT DETECTED!', {
      tracked: context.tokenCount,
      calculated: calculatedTotal,
      drift: calculatedTotal - context.tokenCount,
    });
  }
}
```

### Benefits

- 🐛 Catches bugs early (before they cause problems)
- 🔍 Easier debugging (clear error messages)
- 🛡️ Prevents invalid states (negative tokens, overflow)
- 📊 Detects drift (tracked vs calculated mismatch)

---

## Metrics Tracking

### TokenCounterMetrics

The system tracks performance and usage statistics:

```typescript
interface TokenCounterMetrics {
  cacheHits: number; // Successful cache lookups
  cacheMisses: number; // Cache misses (new calculations)
  recalculations: number; // Full conversation recalculations
  totalTokensCounted: number; // Total tokens processed
  largestMessage: number; // Largest single message
  startTime: number; // Metrics start time
}
```

### Tracked Events

**Cache Hit:**

```typescript
countTokensCached(messageId: string, text: string): number {
  const cached = this.cache.get(messageId);
  if (cached !== undefined) {
    this.metrics.recordCacheHit(); // 📊 Track hit
    return cached;
  }
  // ...
}
```

**Cache Miss:**

```typescript
const count = Math.ceil((text.length / 4) * this.modelMultiplier);
this.cache.set(messageId, count);
this.metrics.recordCacheMiss(count); // 📊 Track miss
return count;
```

**Recalculation:**

```typescript
countConversationTokens(messages: Message[]): number {
  this.metrics.recordRecalculation(messages.length, total); // 📊 Track recalc
  return total;
}
```

### Viewing Metrics

Metrics are accessible via the `/context stats` command:

```
Token Counter Metrics:
  Cache Hit Rate: 87.3%
  Cache Hits: 1245
  Cache Misses: 181
  Recalculations: 12
  Total Tokens Counted: 45230
  Largest Message: 2048 tokens
  Avg Tokens/Message: 250
  Uptime: 45m 23s
```

### Performance Insights

**Good Performance:**

- Cache hit rate: >85% ✅
- Recalculations: <10 per session ✅
- Avg tokens/message: 150-300 ✅

**Needs Attention:**

- Cache hit rate: <70% ⚠️ (too many unique messages)
- Recalculations: >20 per session ⚠️ (too much compression)
- Largest message: >5000 tokens ⚠️ (consider chunking)

---

## Integration Points

### Context Manager

Token counter is used by Context Manager for:

- Message token counting
- Conversation total calculation
- Compression trigger detection
- Usage percentage calculation

```typescript
// Add message with token counting
const tokenCount = this.tokenCounter.countTokensCached(message.id, message.content);
message.tokenCount = tokenCount;
context.tokenCount += tokenCount;
```

### Compression System

Token counter is used by Compression System for:

- Checkpoint token calculation
- Compression ratio measurement
- Available budget calculation

```typescript
// Recalculate after compression
const newTokenCount = this.tokenCounter.countConversationTokens(context.messages);
context.tokenCount = newTokenCount;
```

### Message Store

Token counter is used by Message Store for:

- Real-time usage tracking
- Streaming token estimation
- Validation checks

```typescript
// Track streaming tokens
reportInflightTokens(delta: number): void {
  this.inflightTokens += delta;
  const totalTokens = context.tokenCount + this.inflightTokens;
  this.contextPool.setCurrentTokens(totalTokens);
}
```

---

## Cross-References

### Related Systems

**Context Management** (`dev_ContextManagement.md`)

- Context sizing and VRAM management
- Auto-sizing logic
- Memory thresholds

**Context Compression** (`dev_ContextCompression.md`)

- Compression triggers (80% of Ollama limit)
- Dynamic budget calculation
- Checkpoint aging

**Prompt System** (`dev_PromptSystem.md`)

- System prompt token accounting
- Tier-based prompt selection
- Mode-specific prompts

---

## Usage Examples

### Basic Token Counting

```typescript
// Count tokens for a single message
const tokens = tokenCounter.countTokens('Hello, world!');
console.log(`Tokens: ${tokens}`); // ~3 tokens

// Count with caching
const cachedTokens = tokenCounter.countTokensCached(messageId, content);
```

### Conversation Counting

```typescript
// Count entire conversation
const total = tokenCounter.countConversationTokens(messages);
console.log(`Total: ${total} tokens`);

// Includes tool call overhead
// Each tool call adds ~50 tokens
```

### Model Multiplier

```typescript
// Set model-specific multiplier
tokenCounter.setModelMultiplier(1.1); // Llama models
tokenCounter.setModelMultiplier(0.9); // Code models
tokenCounter.setModelMultiplier(1.0); // GPT models (baseline)
```

### Metrics Access

```typescript
// Get current metrics
const metrics = tokenCounter.getMetrics();
console.log(`Cache hit rate: ${metrics.cacheHitRate}`);
console.log(`Total tokens: ${metrics.totalTokensCounted}`);

// Reset metrics
tokenCounter.resetMetrics();
```

---

## Best Practices

### 1. Cache Management

- ✅ Use `countTokensCached()` for messages (fast)
- ✅ Clear cache when model changes
- ✅ Monitor cache hit rate (should be >85%)
- ❌ Don't bypass cache for repeated content

### 2. Validation

- ✅ Enable validation in development mode
- ✅ Check for negative token counts
- ✅ Monitor token drift
- ✅ Log overflow conditions

### 3. Metrics

- ✅ Review metrics regularly
- ✅ Track cache hit rate
- ✅ Monitor recalculation frequency
- ✅ Identify performance bottlenecks

### 4. Model Multipliers

- ✅ Set correct multiplier for model type
- ✅ Update multiplier when model changes
- ✅ Test multiplier accuracy with real data
- ❌ Don't use default 1.0 for all models

---

## Troubleshooting

### Low Cache Hit Rate

**Symptom:** Cache hit rate <70%

**Solutions:**

1. Check if messages have stable IDs
2. Verify cache isn't being cleared too often
3. Review message creation patterns
4. Consider increasing cache size

### Token Drift

**Symptom:** "TOKEN DRIFT DETECTED" warnings

**Solutions:**

1. Check for manual token count modifications
2. Verify all token updates go through proper channels
3. Review compression logic
4. Ensure cache invalidation is correct

### Negative Token Counts

**Symptom:** "INVALID: Negative token count" errors

**Solutions:**

1. Check text length calculation
2. Verify model multiplier is positive
3. Review token counting formula
4. Check for integer overflow

### High Recalculation Frequency

**Symptom:** >20 recalculations per session

**Solutions:**

1. Review compression trigger threshold
2. Check if system prompt changes too often
3. Verify compression isn't too aggressive
4. Consider increasing context size

---

## File Locations

| File                                           | Purpose                            |
| ---------------------------------------------- | ---------------------------------- |
| `packages/core/src/context/tokenCounter.ts`    | Token counting implementation      |
| `packages/core/src/context/messageStore.ts`    | Message token tracking             |
| `packages/core/src/context/contextManager.ts`  | Token counter integration          |
| `packages/cli/src/commands/contextCommands.ts` | Metrics display (`/context stats`) |

---

## Audit History

| Date       | Status        | Changes                       |
| ---------- | ------------- | ----------------------------- |
| 2026-01-27 | ✅ Fixed      | Double rounding eliminated    |
| 2026-01-27 | ✅ Added      | Validation checks             |
| 2026-01-27 | ✅ Added      | Metrics tracking              |
| 2026-01-27 | ✅ Documented | Complete system documentation |

---

**Note:** This document describes the token counting system. For context sizing, see `dev_ContextManagement.md`. For compression triggers, see `dev_ContextCompression.md`.
