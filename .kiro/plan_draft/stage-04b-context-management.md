# Stage 04b: Context Management System

## Overview
Implement a memory-efficient context management system for local LLMs with dynamic VRAM-based sizing, context snapshots for rollover, and user-configurable settings.

## Prerequisites
- Stage 04 complete (Services and Sessions)
- Stage 02 complete (Core Runtime - for token counting)

## Estimated Effort
3-4 days

## Can Run Parallel With
- Stage 05 (Hooks, Extensions, MCP) - after core context manager is done

## Reference Document
See `docs/dev-draft/context-management-plan.md` for detailed architecture.

---

## Architecture Overview

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

---

## Core Interfaces

```typescript
// VRAM Monitoring
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

// Context Pool
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

// Snapshots
interface ContextSnapshot {
  id: string;
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

interface SnapshotManager {
  createSnapshot(context: ConversationContext): Promise<ContextSnapshot>;
  restoreSnapshot(snapshotId: string): Promise<ConversationContext>;
  listSnapshots(sessionId: string): Promise<ContextSnapshot[]>;
  deleteSnapshot(snapshotId: string): Promise<void>;
  onContextThreshold(threshold: number, callback: () => void): void;
  onBeforeOverflow(callback: () => void): void;
}

// Compression
interface CompressionStrategy {
  type: 'summarize' | 'truncate' | 'hybrid';
  preserveRecent: number;
  summaryMaxTokens: number;
}

interface CompressionService {
  compress(messages: Message[], strategy: CompressionStrategy): Promise<CompressedContext>;
  estimateCompression(messages: Message[]): CompressionEstimate;
}

interface CompressedContext {
  summary: Message;
  preserved: Message[];
  originalTokens: number;
  compressedTokens: number;
}
```

---

## Tasks

### S04b-T01: VRAM Monitor Service

**Steps**:
1. Implement GPU memory querying:
   - NVIDIA: Use `nvidia-smi` or NVML bindings
   - AMD: Use ROCm tools
   - Apple Silicon: Use Metal API or system calls
2. Add polling system:
   - Poll interval: 5 seconds during active inference
   - Event emission for memory changes
3. Create fallback for CPU-only mode:
   - Monitor system RAM instead
   - Adjust calculations for CPU inference
4. Integrate with Ollama API for model memory usage

**Deliverables**:
- `packages/core/src/context/vramMonitor.ts`
- `packages/core/src/context/gpuDetector.ts`

**Acceptance Criteria**:
- VRAM info is accurate on NVIDIA GPUs
- Fallback works on CPU-only systems
- Low memory events fire correctly

---

### S04b-T02: Token Counter Integration

**Steps**:
1. Integrate with provider's token counting:
   - Use provider API if available
   - Cache token counts for messages
2. Implement fallback estimation:
   - Default: `Math.ceil(text.length / 4)`
   - Per-model adjustments
3. Track token usage per conversation:
   - Running total
   - Per-message counts
   - Tool call overhead

**Deliverables**:
- `packages/core/src/context/tokenCounter.ts`

**Acceptance Criteria**:
- Token counts are reasonably accurate
- Caching improves performance
- Fallback works when provider unavailable

---

### S04b-T03: Context Pool

**Steps**:
1. Implement dynamic sizing algorithm:
   ```typescript
   function calculateOptimalContext(
     availableVRAM: number,
     modelParams: number,
     kvQuantization: string
   ): number {
     const kvBytesPerToken = {
       'f16': modelParams * 2 * 2 / 1e9,
       'q8_0': modelParams * 1 * 2 / 1e9,
       'q4_0': modelParams * 0.5 * 2 / 1e9
     };
     const bytesPerToken = kvBytesPerToken[kvQuantization];
     const safetyBuffer = 512 * 1024 * 1024;
     const usableVRAM = availableVRAM - safetyBuffer;
     return Math.floor(usableVRAM / bytesPerToken);
   }
   ```
2. Add resize capability:
   - Coordinate with provider for context resize
   - Handle model reload if needed
3. Create usage tracking:
   - Current usage percentage
   - Trend analysis

**Deliverables**:
- `packages/core/src/context/contextPool.ts`

**Acceptance Criteria**:
- Optimal size calculation is accurate
- Resize works without data loss
- Usage tracking is real-time

---

### S04b-T04: Snapshot Storage

**Steps**:
1. Define snapshot file format:
   - JSON metadata
   - Compressed message storage
2. Implement save/load operations:
   - Atomic writes
   - Corruption detection
3. Add snapshot indexing:
   - Quick lookup by session
   - Metadata caching

**Deliverables**:
- `packages/core/src/context/snapshotStorage.ts`

**Acceptance Criteria**:
- Snapshots save and load correctly
- Large snapshots are handled efficiently
- Corruption is detected

---

### S04b-T05: Snapshot Manager

**Steps**:
1. Implement CRUD operations:
   - Create snapshot from current context
   - Restore context from snapshot
   - List and delete snapshots
2. Add automatic triggers:
   - Threshold-based (80% capacity)
   - Pre-overflow detection
3. Implement rolling cleanup:
   - Keep last N snapshots (default: 5)
   - Age-based cleanup option

**Deliverables**:
- `packages/core/src/context/snapshotManager.ts`

**Acceptance Criteria**:
- Manual snapshots work
- Auto-snapshots trigger correctly
- Rolling cleanup maintains limit

---

### S04b-T06: Compression Service

**Steps**:
1. Implement summarization strategy:
   - Use active model to create summary
   - Preserve semantic meaning
   - Handle long conversations
2. Implement truncation strategy:
   - Remove oldest messages
   - Keep system prompt
3. Implement hybrid strategy:
   - Summarize old messages
   - Keep recent N tokens intact
4. Add compression scheduling:
   - Background compression
   - Priority handling

**Deliverables**:
- `packages/core/src/context/compressionService.ts`
- `packages/core/src/context/compressionStrategies.ts`

**Acceptance Criteria**:
- Summarization produces coherent summaries
- Truncation preserves recent context
- Hybrid balances quality and speed

---

### S04b-T07: Memory Guard

**Steps**:
1. Implement pre-allocation checks:
   - `canAllocate(requestedTokens): boolean`
   - `getSafeLimit(): number`
2. Define memory thresholds:
   - Soft limit (80%): Trigger compression
   - Hard limit (90%): Force context reduction
   - Critical (95%): Emergency snapshot + clear
3. Implement emergency actions:
   - Immediate compression
   - Context size reduction
   - Snapshot and clear
   - User notification

**Deliverables**:
- `packages/core/src/context/memoryGuard.ts`

**Acceptance Criteria**:
- OOM errors are prevented
- Thresholds trigger correct actions
- User is notified of interventions

---

### S04b-T08: /context Command

**Steps**:
1. Implement subcommands:
   - `/context` - Show status
   - `/context size <tokens>` - Set target size
   - `/context auto` - Enable auto-sizing
   - `/context snapshot` - Create snapshot
   - `/context restore <id>` - Restore snapshot
   - `/context list` - List snapshots
   - `/context clear` - Clear context
   - `/context compress` - Manual compression
   - `/context stats` - Detailed stats
2. Add status display component:
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

**Deliverables**:
- `packages/cli/src/commands/contextCommand.ts`
- `packages/cli/src/ui/components/ContextStatus.tsx`

**Acceptance Criteria**:
- All subcommands work
- Status display is accurate
- Interactive snapshot picker works

---

## File Structure After Stage 04b

```
packages/core/src/context/
├── vramMonitor.ts
├── gpuDetector.ts
├── tokenCounter.ts
├── contextPool.ts
├── snapshotStorage.ts
├── snapshotManager.ts
├── compressionService.ts
├── compressionStrategies.ts
├── memoryGuard.ts
└── index.ts

packages/cli/src/
├── commands/
│   └── contextCommand.ts
└── ui/components/
    └── ContextStatus.tsx
```

---

## Configuration

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
    threshold: 0.8
    strategy: hybrid
    preserveRecent: 4096
    summaryMaxTokens: 1024
  
  # Snapshot settings
  snapshots:
    enabled: true
    maxCount: 5
    autoCreate: true
    autoThreshold: 0.8
```

---

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `OLLM_CONTEXT_SIZE` | Target context size | 16384 |
| `OLLM_CONTEXT_AUTO` | Enable auto-sizing | true |
| `OLLM_CONTEXT_VRAM_BUFFER` | VRAM buffer (MB) | 512 |
| `OLLM_KV_CACHE_TYPE` | KV cache quantization | q8_0 |

---

## Memory Estimation Formulas

### Model Weight Memory
```
Model Memory (GB) ≈ Parameters (B) × Bits / 8
Example: 8B model at Q4 = 8 × 4 / 8 = 4 GB
```

### KV Cache Memory
```
KV Cache (GB) = 2 × num_layers × num_heads × head_dim × context_length × bytes_per_value / 1e9

Simplified:
KV Cache (GB) ≈ Parameters (B) × Context (K) × Multiplier

Multipliers:
- F16: 0.00025 GB per billion params per K context
- Q8_0: 0.000125 GB per billion params per K context
- Q4_0: 0.0000625 GB per billion params per K context
```

### Total VRAM
```
Total VRAM = Model Weights + KV Cache + Overhead (0.5-1 GB)
```

---

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

---

## Verification Checklist

- [ ] VRAM monitor detects GPU correctly
- [ ] VRAM monitor falls back to CPU mode
- [ ] Token counter is accurate
- [ ] Context pool calculates optimal size
- [ ] Context resize works
- [ ] Snapshots save and load
- [ ] Auto-snapshot triggers at threshold
- [ ] Compression reduces token count
- [ ] Hybrid compression preserves recent messages
- [ ] Memory guard prevents OOM
- [ ] Emergency actions work
- [ ] /context command works
- [ ] Status display is accurate
