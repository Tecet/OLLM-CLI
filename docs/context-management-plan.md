# Context Management System Plan

## Overview

The Context Management System is a critical component of OLLM CLI that handles memory-efficient conversation management for local LLMs. It provides dynamic context sizing based on available VRAM, context snapshots for rollover, and user-configurable settings.

## Goals

1. **Adaptive Context Pool**: Dynamically adjust context size based on available VRAM
2. **Context Snapshots**: Enable rollover/checkpoint system for long conversations
3. **User Control**: Provide `/context` command for runtime configuration
4. **Memory Safety**: Prevent OOM errors while maximizing usable context

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Context Manager                          │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │   VRAM      │  │  Context    │  │    Snapshot         │ │
│  │   Monitor   │  │  Pool       │  │    Manager          │ │
│  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘ │
│         │                │                     │            │
│         v                v                     v            │
│  ┌─────────────────────────────────────────────────────────┐│
│  │              Context Allocation Engine                  ││
│  └─────────────────────────────────────────────────────────┘│
│         │                │                     │            │
│         v                v                     v            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │   Token     │  │  KV Cache   │  │    Compression      │ │
│  │   Counter   │  │  Manager    │  │    Service          │ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## Core Components

### 1. VRAM Monitor

Monitors available GPU memory and calculates safe context limits.

```typescript
interface VRAMInfo {
  total: number;        // Total VRAM in bytes
  used: number;         // Currently used VRAM
  available: number;    // Available for allocation
  modelLoaded: number;  // Memory used by loaded model
}

interface VRAMMonitor {
  getInfo(): Promise<VRAMInfo>;
  getAvailableForContext(): Promise<number>;
  onLowMemory(callback: (info: VRAMInfo) => void): void;
}
```

**Implementation Notes**:
- Query Ollama API for model memory usage
- Use `nvidia-smi` or ROCm tools for GPU memory stats
- Fallback to system RAM monitoring for CPU-only mode
- Poll interval: 5 seconds during active inference

### 2. Context Pool

Manages the flexible context size allocation.

```typescript
interface ContextPoolConfig {
  minContextSize: number;     // Minimum context (default: 2048)
  maxContextSize: number;     // Maximum context (model limit)
  targetContextSize: number;  // User-preferred size
  reserveBuffer: number;      // Safety buffer (default: 512MB)
  kvCacheQuantization: 'f16' | 'q8_0' | 'q4_0';
}

interface ContextPool {
  config: ContextPoolConfig;
  currentSize: number;
  
  calculateOptimalSize(vramInfo: VRAMInfo, modelInfo: ModelInfo): number;
  resize(newSize: number): Promise<void>;
  getUsage(): ContextUsage;
}
```

**Context Size Calculation**:
```typescript
function calculateOptimalContext(
  availableVRAM: number,
  modelParams: number,
  kvQuantization: string
): number {
  // KV cache memory per token (approximate)
  const kvBytesPerToken = {
    'f16': modelParams * 2 * 2 / 1e9,  // 2 bytes * 2 (K+V)
    'q8_0': modelParams * 1 * 2 / 1e9, // 1 byte * 2 (K+V)
    'q4_0': modelParams * 0.5 * 2 / 1e9
  };
  
  const bytesPerToken = kvBytesPerToken[kvQuantization];
  const safetyBuffer = 512 * 1024 * 1024; // 512MB
  const usableVRAM = availableVRAM - safetyBuffer;
  
  return Math.floor(usableVRAM / bytesPerToken);
}
```

### 3. Snapshot Manager

Handles context checkpoints for conversation rollover.

```typescript
interface ContextSnapshot {
  id: string;
  timestamp: Date;
  tokenCount: number;
  summary: string;           // Compressed summary of snapshot content
  messages: Message[];       // Full messages at snapshot point
  metadata: {
    model: string;
    contextSize: number;
    compressionRatio: number;
  };
}

interface SnapshotManager {
  createSnapshot(context: ConversationContext): Promise<ContextSnapshot>;
  restoreSnapshot(snapshotId: string): Promise<ConversationContext>;
  listSnapshots(sessionId: string): Promise<ContextSnapshot[]>;
  deleteSnapshot(snapshotId: string): Promise<void>;
  
  // Auto-snapshot triggers
  onContextThreshold(threshold: number, callback: () => void): void;
  onBeforeOverflow(callback: () => void): void;
}
```

**Snapshot Strategy**:
1. **Automatic**: Create snapshot when context reaches 80% capacity
2. **Manual**: User can trigger via `/context snapshot` command
3. **Rolling**: Keep last N snapshots (configurable, default: 5)

### 4. Context Compression Service

Compresses older context to maintain conversation continuity.

```typescript
interface CompressionStrategy {
  type: 'summarize' | 'truncate' | 'hybrid';
  preserveRecent: number;    // Tokens to keep uncompressed
  summaryMaxTokens: number;  // Max tokens for summary
}

interface CompressionService {
  compress(
    messages: Message[],
    strategy: CompressionStrategy
  ): Promise<CompressedContext>;
  
  estimateCompression(messages: Message[]): CompressionEstimate;
}

interface CompressedContext {
  summary: Message;          // System message with summary
  preserved: Message[];      // Recent messages kept intact
  originalTokens: number;
  compressedTokens: number;
}
```

**Compression Strategies**:

1. **Summarize**: Use the model to create a summary of older messages
   - Best quality, requires inference call
   - Preserves semantic meaning

2. **Truncate**: Remove oldest messages
   - Fastest, no inference needed
   - May lose important context

3. **Hybrid** (recommended):
   - Summarize messages older than threshold
   - Keep recent N messages intact
   - Balance between quality and speed

## User Interface

### /context Command

```
/context                    Show current context status
/context size <tokens>      Set target context size
/context auto               Enable automatic sizing
/context snapshot           Create manual snapshot
/context restore <id>       Restore from snapshot
/context list               List available snapshots
/context clear              Clear context (keep system prompt)
/context compress           Manually trigger compression
/context stats              Show detailed memory statistics
```

### Context Status Display

```
┌─ Context Status ─────────────────────────────────────┐
│ Model: llama3.1:8b                                   │
│ Context: 12,847 / 32,768 tokens (39%)               │
│ VRAM: 6.2 / 8.0 GB (77%)                            │
│ KV Cache: q8_0 (1.8 GB)                             │
│ Snapshots: 3 available                               │
│ Auto-compress: enabled at 80%                        │
└──────────────────────────────────────────────────────┘
```

## Configuration

### Settings Schema

```yaml
context:
  # Target context size (tokens)
  targetSize: 16384
  
  # Minimum context size
  minSize: 2048
  
  # Maximum context size (0 = model default)
  maxSize: 0
  
  # Auto-sizing based on VRAM
  autoSize: true
  
  # VRAM safety buffer (MB)
  vramBuffer: 512
  
  # KV cache quantization
  kvQuantization: q8_0
  
  # Compression settings
  compression:
    enabled: true
    threshold: 0.8          # Trigger at 80% capacity
    strategy: hybrid
    preserveRecent: 4096    # Keep last 4K tokens intact
    summaryMaxTokens: 1024
  
  # Snapshot settings
  snapshots:
    enabled: true
    maxCount: 5
    autoCreate: true
    autoThreshold: 0.8
```

### Environment Variables

```bash
OLLM_CONTEXT_SIZE=16384
OLLM_CONTEXT_AUTO=true
OLLM_CONTEXT_VRAM_BUFFER=512
OLLM_KV_CACHE_TYPE=q8_0
```

## Implementation Tasks

### Phase 1: Core Infrastructure

1. **VRAM Monitor Service**
   - Implement GPU memory querying (NVIDIA, AMD, Apple Silicon)
   - Add polling and event system for memory changes
   - Create fallback for CPU-only mode

2. **Token Counter**
   - Integrate with provider's token counting
   - Implement fallback estimation (chars/4)
   - Cache token counts for messages

3. **Context Pool**
   - Implement dynamic sizing algorithm
   - Add resize capability with model reload
   - Create usage tracking

### Phase 2: Snapshot System

4. **Snapshot Storage**
   - Define snapshot file format (JSON + compressed messages)
   - Implement save/load operations
   - Add snapshot indexing

5. **Snapshot Manager**
   - Implement create/restore/delete operations
   - Add automatic snapshot triggers
   - Create rolling snapshot cleanup

### Phase 3: Compression

6. **Compression Service**
   - Implement summarization using active model
   - Add truncation strategy
   - Create hybrid compression logic

7. **Auto-Compression**
   - Implement threshold monitoring
   - Add pre-overflow detection
   - Create compression scheduling

### Phase 4: User Interface

8. **/context Command**
   - Implement all subcommands
   - Add status display component
   - Create interactive snapshot picker

9. **Status Bar Integration**
   - Add context usage indicator
   - Show compression warnings
   - Display snapshot availability

## Memory Estimation Formulas

### Model Weight Memory
```
Model Memory (GB) ≈ Parameters (B) × Bits / 8
Example: 8B model at Q4 = 8 × 4 / 8 = 4 GB
```

### KV Cache Memory
```
KV Cache (GB) = 2 × num_layers × num_heads × head_dim × context_length × bytes_per_value / 1e9

Simplified for common models:
KV Cache (GB) ≈ Parameters (B) × Context (K) × Multiplier

Multipliers:
- F16: 0.00025 GB per billion params per K context
- Q8_0: 0.000125 GB per billion params per K context
- Q4_0: 0.0000625 GB per billion params per K context
```

### Total VRAM Estimation
```
Total VRAM = Model Weights + KV Cache + Overhead (0.5-1 GB)
```

## Error Handling

### Out of Memory Prevention

```typescript
interface MemoryGuard {
  // Check before allocation
  canAllocate(requestedTokens: number): boolean;
  
  // Get safe allocation limit
  getSafeLimit(): number;
  
  // Emergency actions
  onCriticalMemory(): Promise<void>;
}
```

**Emergency Actions**:
1. Trigger immediate compression
2. Reduce context size
3. Create snapshot and clear context
4. Notify user with recovery options

### Recovery Strategies

1. **Soft Limit** (80% VRAM): Trigger compression
2. **Hard Limit** (90% VRAM): Force context reduction
3. **Critical** (95% VRAM): Emergency snapshot + clear

## Testing Strategy

### Unit Tests
- Token counting accuracy
- Context size calculations
- Compression ratio verification
- Snapshot serialization

### Integration Tests
- VRAM monitoring with real GPU
- Context resize with model reload
- Compression with actual inference
- Snapshot restore continuity

### Performance Tests
- Compression latency
- Snapshot save/load speed
- Memory monitoring overhead
- Context resize impact

## Future Enhancements

1. **Sliding Window Attention**: Support models with native sliding window
2. **Multi-Model Context**: Share context across model switches
3. **Semantic Chunking**: Intelligent message grouping for compression
4. **Context Prefetch**: Predictive context loading
5. **Distributed Context**: Split context across multiple GPUs
