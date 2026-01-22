# Progressive Checkpoint Compression

## Overview

Progressive Checkpoint Compression is a context management strategy that maintains conversation history through hierarchical compression checkpoints. Unlike traditional compression that replaces history with a single summary, this approach preserves the "journey" of multi-step tasks while efficiently managing token usage.

## The Problem

Traditional context compression suffers from **concept drift** in long, complex tasks:

```
Initial Context:
[System Prompt] + [Task] + [Work Steps 1-50]

After Compression (OLD WAY):
[System Prompt] + [Summary of 1-50] + [Recent messages]

❌ Lost: Detailed progress of steps 1-50
❌ Lost: Intermediate decisions
❌ Lost: Code structure built so far
❌ Result: LLM loses direction, changes approach, repeats work
```

## The Solution: Additive Checkpoints

Instead of replacing history, we **accumulate checkpoints** that preserve the journey:

```
After Compression (NEW WAY):
[System Prompt]
[Checkpoint 1: Steps 1-20 summary]    ← Detailed
[Checkpoint 2: Steps 21-40 summary]   ← Detailed
[Checkpoint 3: Steps 41-60 summary]   ← Detailed
[Recent messages: Steps 61-70]

✅ Maintains progress history
✅ LLM knows what was done
✅ Prevents direction changes
✅ Preserves architectural decisions
```

## Hierarchical Compression

As checkpoints age, they are progressively compressed to save tokens:

### Compression Levels

| Level | Name | Age | Detail | Token Usage |
|-------|------|-----|--------|-------------|
| 3 | DETAILED | 1-4 compressions old | Full summary with decisions, files, next steps | ~500-1000 tokens |
| 2 | MODERATE | 5-9 compressions old | Key decisions and summary | ~200-400 tokens |
| 1 | COMPACT | 10+ compressions old | Ultra-compact summary | ~50-100 tokens |

### Compression Timeline

```
Checkpoint Lifecycle:

Creation (Level 3 - DETAILED):
[Checkpoint: Steps 1-20]
Summary: Full detailed summary of work done
Key Decisions: ["Use pattern X", "API design Y"]
Files Modified: ["file1.ts", "file2.ts"]
Next Steps: ["Implement Z", "Test W"]
Token Count: ~800 tokens

After 5 More Compressions (Level 2 - MODERATE):
[Checkpoint: Steps 1-20]
Summary: Condensed summary (first 5 lines)
Key Decisions: ["Use pattern X", "API design Y"]
Token Count: ~300 tokens

After 10 More Compressions (Level 1 - COMPACT):
[Checkpoint: Steps 1-20]
Summary: "Built foundation with pattern X..."
Token Count: ~80 tokens
```

## Architecture

### Data Structures

```typescript
interface CompressionCheckpoint {
  id: string;
  level: CheckpointLevel; // 1=COMPACT, 2=MODERATE, 3=DETAILED
  range: string; // "Messages 1-20"
  summary: Message; // The summary message
  createdAt: Date;
  compressedAt?: Date;
  originalTokens: number;
  currentTokens: number;
  compressionCount: number;
  
  // Optional metadata (preserved at MODERATE level)
  keyDecisions?: string[];
  filesModified?: string[];
  nextSteps?: string[];
}

interface ConversationContext {
  sessionId: string;
  messages: Message[];
  systemPrompt: Message;
  checkpoints?: CompressionCheckpoint[]; // Additive history!
  tokenCount: number;
  maxTokens: number;
  metadata: {
    model: string;
    contextSize: number;
    compressionHistory: CompressionEvent[];
  };
}
```

### Compression Flow

```
1. Context reaches threshold (80% full)
   ↓
2. Create snapshot for recovery
   ↓
3. Compress messages → Create new checkpoint (Level 3)
   ↓
4. Add checkpoint to history (ADDITIVE!)
   ↓
5. Compress old checkpoints hierarchically:
   - Age 5+: Level 3 → Level 2
   - Age 10+: Level 2 → Level 1
   ↓
6. Merge oldest checkpoints if > 10 total
   ↓
7. Reconstruct context:
   [System] + [All Checkpoints] + [Recent Messages]
```

## Configuration

### Context Manager Config

```typescript
const config: ContextConfig = {
  compression: {
    enabled: true,
    threshold: 0.8, // Trigger at 80% capacity
    strategy: 'summarize', // Use LLM summarization
    preserveRecent: 4096, // Keep last 4K tokens detailed
    summaryMaxTokens: 1024 // Max tokens per summary
  }
};
```

### Checkpoint Limits

```typescript
// In contextManager.ts
const MAX_CHECKPOINTS = 10; // Maximum checkpoints to keep
const MODERATE_AGE = 5; // Compress to moderate after 5 checkpoints
const COMPACT_AGE = 10; // Compress to compact after 10 checkpoints
```

## Usage Examples

### Automatic Compression

Compression triggers automatically when context reaches threshold:

```typescript
// Context manager handles this automatically
contextManager.on('auto-summary-created', ({ checkpoint, summary }) => {
  console.log('New checkpoint created:', checkpoint.range);
  console.log('Level:', checkpoint.level);
  console.log('Tokens:', checkpoint.currentTokens);
});
```

### Manual Compression

Trigger compression manually:

```typescript
await contextManager.compress();

// Check checkpoint stats
const stats = contextManager.getCheckpointStats();
console.log('Total checkpoints:', stats.total);
console.log('By level:', stats.byLevel);
console.log('Total tokens in checkpoints:', stats.totalTokens);
```

### Viewing Checkpoints

```typescript
const checkpoints = contextManager.getCheckpoints();

for (const checkpoint of checkpoints) {
  console.log(`Checkpoint ${checkpoint.id}:`);
  console.log(`  Range: ${checkpoint.range}`);
  console.log(`  Level: ${checkpoint.level}`);
  console.log(`  Tokens: ${checkpoint.currentTokens}`);
  console.log(`  Created: ${checkpoint.createdAt}`);
  
  if (checkpoint.keyDecisions) {
    console.log(`  Key Decisions: ${checkpoint.keyDecisions.join(', ')}`);
  }
}
```

## Benefits

### 1. Prevents Concept Drift

The LLM maintains awareness of the full journey:
- ✅ Knows what was already done
- ✅ Remembers architectural decisions
- ✅ Maintains consistent direction
- ✅ Avoids repeating work

### 2. Efficient Token Usage

Hierarchical compression optimizes token allocation:
- Recent work: Full detail (4K tokens)
- Recent checkpoints: Detailed summaries (800 tokens each)
- Medium checkpoints: Moderate summaries (300 tokens each)
- Old checkpoints: Compact summaries (80 tokens each)

### 3. Scalable to Long Tasks

Can handle very long conversations:
- 10 checkpoints × 300 tokens avg = 3K tokens
- Recent messages = 4K tokens
- System prompt = 1K tokens
- **Total: ~8K tokens for potentially 100+ compression cycles**

### 4. Preserves Critical Information

Key decisions and architecture choices are preserved:
- Stored in checkpoint metadata
- Maintained at MODERATE level
- Never fully lost even at COMPACT level

## Token Budget Example

For a 32K context window with 80% threshold (25.6K trigger):

```
Context Composition After Multiple Compressions:

System Prompt:                    1,000 tokens
Checkpoint 1 (COMPACT):              80 tokens
Checkpoint 2 (COMPACT):              80 tokens
Checkpoint 3 (MODERATE):            300 tokens
Checkpoint 4 (MODERATE):            300 tokens
Checkpoint 5 (DETAILED):            800 tokens
Checkpoint 6 (DETAILED):            800 tokens
Recent Messages:                  4,096 tokens
                                 ─────────────
Total:                           7,456 tokens (23% of capacity)

Remaining capacity: 24,544 tokens (77%)
```

## Comparison with Traditional Compression

| Aspect | Traditional | Progressive Checkpoints |
|--------|-------------|------------------------|
| History Preservation | ❌ Lost after compression | ✅ Maintained through checkpoints |
| Concept Drift | ❌ High risk | ✅ Low risk |
| Token Efficiency | ✅ Good | ✅ Excellent |
| Scalability | ⚠️ Limited | ✅ Scales to very long tasks |
| Recovery | ⚠️ Requires snapshots | ✅ Built-in through checkpoints |
| Complexity | ✅ Simple | ⚠️ More complex |

## Future Enhancements

### Phase 2: Structured Checkpoints (Planned)

Add explicit tracking of architectural decisions:

```typescript
interface ArchitectureDecision {
  id: string;
  decision: string;
  reason: string;
  impact: string;
  timestamp: Date;
}

interface ConversationContext {
  // ... existing fields
  architectureDecisions?: ArchitectureDecision[]; // NEVER compressed!
  taskDefinition?: {
    goal: string;
    requirements: string[];
    constraints: string[];
  }; // NEVER compressed!
}
```

### Phase 3: Semantic Checkpoint Merging

Use embeddings to intelligently merge related checkpoints:
- Group checkpoints by semantic similarity
- Merge related work into cohesive summaries
- Preserve distinct architectural phases

### Phase 4: Checkpoint Visualization

UI components to visualize checkpoint history:
- Timeline view of checkpoints
- Compression level indicators
- Token usage graphs
- Expandable checkpoint details

## Testing

### Unit Tests

```typescript
describe('Progressive Checkpoint Compression', () => {
  it('should create checkpoints additively', async () => {
    // Add messages and trigger compression
    // Verify checkpoint is added, not replaced
  });

  it('should compress old checkpoints hierarchically', async () => {
    // Create multiple checkpoints
    // Verify older ones are compressed to lower levels
  });

  it('should merge checkpoints when limit exceeded', async () => {
    // Create > MAX_CHECKPOINTS
    // Verify oldest are merged
  });
});
```

### Integration Tests

```typescript
describe('Long Task Scenario', () => {
  it('should maintain context through 20+ compressions', async () => {
    // Simulate long coding task
    // Verify LLM maintains direction
    // Verify no concept drift
  });
});
```

## Monitoring

### Events

```typescript
contextManager.on('auto-summary-created', ({ checkpoint, summary }) => {
  // New checkpoint created
});

contextManager.on('checkpoint-compressed', ({ checkpoint, oldLevel, newLevel }) => {
  // Checkpoint compressed to lower level
});

contextManager.on('checkpoints-merged', ({ merged, result }) => {
  // Multiple checkpoints merged
});
```

### Metrics

```typescript
const stats = contextManager.getCheckpointStats();

// Monitor these metrics:
- stats.total // Total checkpoint count
- stats.byLevel // Distribution across levels
- stats.totalTokens // Token usage by checkpoints
- stats.oldestDate // Age of oldest checkpoint
```

## Troubleshooting

### Issue: Checkpoints consuming too many tokens

**Solution:** Adjust compression thresholds:
```typescript
const MODERATE_AGE = 3; // Compress sooner
const COMPACT_AGE = 6;
```

### Issue: Losing important context

**Solution:** Increase preserveRecent tokens:
```typescript
compression: {
  preserveRecent: 8192, // Keep more recent detail
}
```

### Issue: Too many checkpoints

**Solution:** Reduce MAX_CHECKPOINTS:
```typescript
const MAX_CHECKPOINTS = 5; // Keep fewer checkpoints
```

## References

- [Context Management Architecture](../Context_architecture.md)
- [Compression Service API](../api/compression-service.md)
- [Context Manager API](../api/context-manager.md)
- [Snapshot Management](./snapshots.md)

## Changelog

- **2026-01-20**: Initial implementation of progressive checkpoint compression
- **2026-01-20**: Added hierarchical compression levels
- **2026-01-20**: Added checkpoint merging for bounded growth
