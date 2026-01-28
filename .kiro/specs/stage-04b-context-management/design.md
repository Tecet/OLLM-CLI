# Design Document: Context Management System

## Overview

The Context Management System provides intelligent memory management for local LLM conversations in OLLM CLI. It dynamically adjusts context size based on available GPU memory (VRAM), creates snapshots for conversation rollover, compresses older context to maintain continuity, and prevents out-of-memory errors through proactive monitoring and intervention.

The system consists of six core services that work together: VRAM Monitor tracks GPU memory availability, Token Counter measures context usage, Context Pool manages dynamic sizing, Snapshot Manager handles conversation checkpoints, Compression Service reduces context size, and Memory Guard prevents OOM errors.

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                    Context Manager                          │
│                  (Orchestration Layer)                      │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │   VRAM      │  │  Context    │  │    Snapshot         │ │
│  │   Monitor   │  │  Pool       │  │    Manager          │ │
│  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘ │
│         │                │                     │            │
│         v                v                     v            │
│  ┌─────────────────────────────────────────────────────────┐│
│  │              Memory Guard                               ││
│  │         (Safety & Threshold Management)                 ││
│  └─────────────────────────────────────────────────────────┘│
│         │                │                     │            │
│         v                v                     v            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │   Token     │  │  Snapshot   │  │    Compression      │ │
│  │   Counter   │  │  Storage    │  │    Service          │ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

**Context Manager**: Orchestrates all context operations, coordinates between services, and provides the main API for context management.

**VRAM Monitor**: Detects GPU type, queries memory status, emits low-memory events, and provides fallback to RAM monitoring for CPU-only systems.

**Context Pool**: Calculates optimal context size based on VRAM, manages dynamic resizing, tracks usage, and enforces min/max limits.

**Snapshot Manager**: Creates and restores conversation snapshots, manages automatic snapshot triggers, implements rolling cleanup, and maintains snapshot index.

**Compression Service**: Implements summarize/truncate/hybrid strategies, preserves recent messages, estimates compression ratios, and handles automatic compression triggers.

**Memory Guard**: Monitors memory thresholds (80%/90%/95%), triggers appropriate actions, prevents OOM errors, and notifies users of interventions.

**Token Counter**: Counts tokens in messages, caches counts, integrates with provider APIs, and provides fallback estimation.

**Snapshot Storage**: Persists snapshots to disk, implements atomic writes, detects corruption, and maintains metadata index.

## Components and Interfaces

### VRAM Monitor

```typescript
interface VRAMInfo {
  total: number; // Total VRAM in bytes
  used: number; // Currently used VRAM
  available: number; // Available for allocation
  modelLoaded: number; // Memory used by loaded model
}

interface VRAMMonitor {
  // Query current memory status
  getInfo(): Promise<VRAMInfo>;

  // Get memory available for context allocation
  getAvailableForContext(): Promise<number>;

  // Register callback for low memory events
  onLowMemory(callback: (info: VRAMInfo) => void): void;

  // Start/stop monitoring
  startMonitoring(intervalMs: number): void;
  stopMonitoring(): void;
}

interface GPUDetector {
  // Detect GPU type on system
  detectGPU(): Promise<GPUType>;

  // Check if GPU is available
  hasGPU(): Promise<boolean>;
}

enum GPUType {
  NVIDIA = 'nvidia',
  AMD = 'amd',
  APPLE_SILICON = 'apple',
  CPU_ONLY = 'cpu',
}
```

**Implementation Notes**:

- NVIDIA: Use `nvidia-smi --query-gpu=memory.total,memory.used --format=csv,noheader,nounits` or NVML bindings
- AMD: Use `rocm-smi --showmeminfo vram` or ROCm API
- Apple Silicon: Use `sysctl hw.memsize` and Metal API for GPU memory
- CPU-only: Monitor system RAM using Node.js `os.totalmem()` and `os.freemem()`
- Poll interval: 5 seconds during active inference, stop when idle
- Low memory threshold: Emit event when available < 20% of total

### Token Counter

```typescript
interface TokenCounter {
  // Count tokens in a message
  countTokens(text: string): Promise<number>;

  // Count tokens using cached value if available
  countTokensCached(messageId: string, text: string): number;

  // Count total tokens in conversation
  countConversationTokens(messages: Message[]): number;

  // Clear cache
  clearCache(): void;
}

interface TokenCountCache {
  get(messageId: string): number | undefined;
  set(messageId: string, count: number): void;
  clear(): void;
}
```

**Implementation Notes**:

- Primary: Use provider's token counting API if available (e.g., Ollama `/api/encode`)
- Fallback: Estimate using `Math.ceil(text.length / 4)` (roughly 0.75 words per token)
- Cache token counts by message ID to avoid recalculation
- Include tool call overhead: ~50 tokens per tool call for schema + result
- Per-model adjustments: Apply multiplier from config (e.g., 1.2x for multilingual models)
- Clear cache when model changes

### Context Pool

```typescript
interface ContextPoolConfig {
  minContextSize: number; // Minimum context (default: 2048)
  maxContextSize: number; // Maximum context (model limit)
  targetContextSize: number; // User-preferred size
  reserveBuffer: number; // Safety buffer in bytes (default: 512MB)
  kvCacheQuantization: 'f16' | 'q8_0' | 'q4_0';
  autoSize: boolean; // Enable automatic sizing
}

interface ContextPool {
  config: ContextPoolConfig;
  currentSize: number;

  // Calculate optimal context size based on available VRAM
  calculateOptimalSize(vramInfo: VRAMInfo, modelInfo: ModelInfo): number;

  // Resize context (may require model reload)
  resize(newSize: number): Promise<void>;

  // Get current usage statistics
  getUsage(): ContextUsage;

  // Update configuration
  updateConfig(config: Partial<ContextPoolConfig>): void;
}

interface ContextUsage {
  currentTokens: number;
  maxTokens: number;
  percentage: number;
  vramUsed: number;
  vramTotal: number;
}

interface ModelInfo {
  parameters: number; // Model size in billions
  contextLimit: number; // Maximum context tokens
}
```

**Context Size Calculation**:

```typescript
function calculateOptimalContext(
  availableVRAM: number,
  modelParams: number,
  kvQuantization: 'f16' | 'q8_0' | 'q4_0'
): number {
  // KV cache memory per token (approximate)
  // Formula: 2 (K+V) × layers × hidden_dim × bytes_per_value
  // Simplified: params × multiplier × bytes
  const kvBytesPerToken = {
    f16: (modelParams * 2 * 2) / 1e9, // 2 bytes per value
    q8_0: (modelParams * 1 * 2) / 1e9, // 1 byte per value
    q4_0: (modelParams * 0.5 * 2) / 1e9, // 0.5 bytes per value
  };

  const bytesPerToken = kvBytesPerToken[kvQuantization];
  const safetyBuffer = 512 * 1024 * 1024; // 512MB
  const usableVRAM = availableVRAM - safetyBuffer;

  return Math.floor(usableVRAM / bytesPerToken);
}
```

**Implementation Notes**:

- Clamp calculated size between minContextSize and maxContextSize
- If autoSize is disabled, use targetContextSize
- Coordinate with provider for context resize (may require model reload)
- Preserve conversation data during resize
- Update usage statistics in real-time

### Snapshot Manager

```typescript
interface ContextSnapshot {
  id: string; // Unique snapshot ID (UUID)
  sessionId: string; // Associated session
  timestamp: Date; // Creation time
  tokenCount: number; // Total tokens at snapshot
  summary: string; // Brief summary of content
  messages: Message[]; // Full conversation messages
  metadata: {
    model: string;
    contextSize: number;
    compressionRatio: number;
  };
}

interface SnapshotManager {
  // Create snapshot from current context
  createSnapshot(context: ConversationContext): Promise<ContextSnapshot>;

  // Restore context from snapshot
  restoreSnapshot(snapshotId: string): Promise<ConversationContext>;

  // List snapshots for a session
  listSnapshots(sessionId: string): Promise<ContextSnapshot[]>;

  // Delete a snapshot
  deleteSnapshot(snapshotId: string): Promise<void>;

  // Register threshold callback
  onContextThreshold(threshold: number, callback: () => void): void;

  // Register pre-overflow callback
  onBeforeOverflow(callback: () => void): void;

  // Cleanup old snapshots
  cleanupOldSnapshots(maxCount: number): Promise<void>;
}

interface SnapshotConfig {
  enabled: boolean;
  maxCount: number; // Maximum snapshots to keep (default: 5)
  autoCreate: boolean; // Auto-create at threshold
  autoThreshold: number; // Threshold for auto-creation (default: 0.8)
}
```

**Implementation Notes**:

- Generate snapshot ID using UUID v4
- Store snapshots in `~/.ollm/session-data/<sessionId>/snapshots/`
- Filename format: `snapshot-<id>.json`
- Automatic snapshot at 80% context capacity (configurable)
- Rolling cleanup: Keep last N snapshots, delete oldest
- Pre-overflow detection: Trigger when usage > 95%
- Summary generation: Use first/last messages or compression service

### Compression Service

```typescript
interface CompressionStrategy {
  type: 'summarize' | 'truncate' | 'hybrid';
  preserveRecent: number; // Tokens to keep uncompressed
  summaryMaxTokens: number; // Max tokens for summary
}

interface CompressionService {
  // Compress messages using specified strategy
  compress(messages: Message[], strategy: CompressionStrategy): Promise<CompressedContext>;

  // Estimate compression without performing it
  estimateCompression(messages: Message[]): CompressionEstimate;

  // Check if compression is needed
  shouldCompress(tokenCount: number, threshold: number): boolean;
}

interface CompressedContext {
  summary: Message; // System message with summary
  preserved: Message[]; // Recent messages kept intact
  originalTokens: number;
  compressedTokens: number;
  compressionRatio: number;
}

interface CompressionEstimate {
  estimatedTokens: number;
  estimatedRatio: number;
  strategy: CompressionStrategy;
}

interface CompressionConfig {
  enabled: boolean;
  threshold: number; // Trigger at % capacity (default: 0.8)
  strategy: 'summarize' | 'truncate' | 'hybrid';
  preserveRecent: number; // Tokens to preserve (default: 4096)
  summaryMaxTokens: number; // Max summary size (default: 1024)
}
```

**Compression Strategies**:

1. **Summarize**: Use active model to create summary
   - Best quality, preserves semantic meaning
   - Requires inference call (adds latency)
   - Prompt: "Summarize the following conversation concisely, preserving key points and context:"

2. **Truncate**: Remove oldest messages
   - Fastest, no inference needed
   - May lose important context
   - Always preserve system prompt

3. **Hybrid** (recommended):
   - Summarize messages older than preserveRecent threshold
   - Keep recent N tokens intact
   - Balance between quality and speed

**Implementation Notes**:

- Always preserve system prompt (role: 'system')
- Preserve tool definitions in context
- Compression ratio = compressedTokens / originalTokens
- Estimation: Assume 50% compression for summarize, 0% for preserved messages
- Automatic trigger at configured threshold (default: 80%)

### Memory Guard

```typescript
interface MemoryGuard {
  // Check if allocation is safe
  canAllocate(requestedTokens: number): boolean;

  // Get safe allocation limit
  getSafeLimit(): number;

  // Handle memory threshold events
  onThreshold(level: MemoryLevel, callback: () => void): void;

  // Execute emergency actions
  executeEmergencyActions(): Promise<void>;
}

enum MemoryLevel {
  NORMAL = 'normal', // < 80%
  WARNING = 'warning', // 80-90%
  CRITICAL = 'critical', // 90-95%
  EMERGENCY = 'emergency', // > 95%
}

interface MemoryThresholds {
  soft: number; // 80% - Trigger compression
  hard: number; // 90% - Force context reduction
  critical: number; // 95% - Emergency snapshot + clear
}
```

**Threshold Actions**:

| Level     | Threshold | Action                                      |
| --------- | --------- | ------------------------------------------- |
| Normal    | < 80%     | No action                                   |
| Warning   | 80-90%    | Trigger automatic compression               |
| Critical  | 90-95%    | Force context size reduction                |
| Emergency | > 95%     | Create snapshot, clear context, notify user |

**Implementation Notes**:

- Check before every message addition
- Safety buffer: 512MB reserved for overhead
- Emergency actions: Create snapshot → Clear context → Notify user with recovery options
- User notification includes: snapshot ID, recovery command, memory stats
- Soft limit prevents allocation, hard limit forces action

### Snapshot Storage

```typescript
interface SnapshotStorage {
  // Save snapshot to disk
  save(snapshot: ContextSnapshot): Promise<void>;

  // Load snapshot from disk
  load(snapshotId: string): Promise<ContextSnapshot>;

  // List all snapshots for a session
  list(sessionId: string): Promise<SnapshotMetadata[]>;

  // Delete snapshot
  delete(snapshotId: string): Promise<void>;

  // Check if snapshot exists
  exists(snapshotId: string): Promise<boolean>;

  // Verify snapshot integrity
  verify(snapshotId: string): Promise<boolean>;
}

interface SnapshotMetadata {
  id: string;
  sessionId: string;
  timestamp: Date;
  tokenCount: number;
  summary: string;
  size: number; // File size in bytes
}
```

**File Format**:

```json
{
  "version": "1.0",
  "id": "uuid-v4",
  "sessionId": "session-id",
  "timestamp": "2024-01-15T10:30:00Z",
  "tokenCount": 12847,
  "summary": "Discussion about context management...",
  "metadata": {
    "model": "llama3.1:8b",
    "contextSize": 32768,
    "compressionRatio": 0.65
  },
  "messages": [
    {
      "role": "system",
      "content": "You are a helpful assistant..."
    },
    {
      "role": "user",
      "content": "Hello..."
    }
  ]
}
```

**Implementation Notes**:

- Storage location: `~/.ollm/session-data/<sessionId>/snapshots/`
- Atomic writes: Write to temp file, then rename
- Compression: Use gzip for message content if > 100KB
- Index file: `snapshots-index.json` with metadata for quick lookup
- Corruption detection: Verify JSON parse + required fields
- Error handling: Skip corrupted files, log warning, continue with valid snapshots

## Data Models

### Message

```typescript
interface Message {
  id: string;
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  timestamp: Date;
  tokenCount?: number; // Cached token count
  metadata?: {
    toolCalls?: ToolCall[];
    toolResults?: ToolResult[];
  };
}
```

### Conversation Context

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

interface CompressionEvent {
  timestamp: Date;
  strategy: string;
  originalTokens: number;
  compressedTokens: number;
  ratio: number;
}
```

### Configuration

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

## Correctness Properties

A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.

### Property 1: VRAM Info Completeness

_For any_ VRAM information request, the returned VRAMInfo object should contain all required fields (total, used, available, modelLoaded) with non-negative values.
**Validates: Requirements 1.2**

### Property 2: Low Memory Event Emission

_For any_ memory state and threshold, when available memory drops below the threshold, a low-memory event should be emitted.
**Validates: Requirements 1.8**

### Property 3: Token Count Caching

_For any_ message, counting tokens twice for the same message should return the cached value without recalculation.
**Validates: Requirements 2.1, 2.4**

### Property 4: Fallback Token Estimation

_For any_ text when provider token counting is unavailable, the estimated token count should equal Math.ceil(text.length / 4).
**Validates: Requirements 2.3**

### Property 5: Tool Call Overhead Inclusion

_For any_ conversation with tool calls, the total token count should include overhead for each tool call.
**Validates: Requirements 2.5**

### Property 6: Model-Specific Multipliers

_For any_ configured per-model token adjustment multiplier, the token count should be multiplied by that factor.
**Validates: Requirements 2.6**

### Property 7: Context Size Formula

_For any_ available VRAM, safety buffer, and bytes per token, the calculated context size should equal floor((availableVRAM - safetyBuffer) / bytesPerToken).
**Validates: Requirements 3.2**

### Property 8: Quantization Bytes Per Token

_For any_ KV cache quantization type (f16, q8_0, q4_0), the bytes per value used in calculations should match the specification (2, 1, 0.5 respectively).
**Validates: Requirements 3.3, 3.4, 3.5**

### Property 9: Context Resize Preservation

_For any_ context with existing conversation data, resizing the context should preserve all messages without data loss.
**Validates: Requirements 3.7**

### Property 10: Context Usage Fields

_For any_ context usage request, the returned ContextUsage object should contain current usage percentage and token counts.
**Validates: Requirements 3.8**

### Property 11: Snapshot Data Completeness

_For any_ created snapshot, it should contain all required fields: messages, token count, and metadata.
**Validates: Requirements 4.1**

### Property 12: Snapshot Round Trip

_For any_ conversation context, creating a snapshot and then restoring it should produce an equivalent context with the same messages and metadata.
**Validates: Requirements 4.3**

### Property 13: Snapshot List Metadata

_For any_ session with snapshots, listing snapshots should return all snapshots with their IDs, timestamps, and token counts.
**Validates: Requirements 4.4**

### Property 14: Snapshot Deletion Effect

_For any_ snapshot, after deletion, the snapshot should no longer appear in the list of snapshots.
**Validates: Requirements 4.5**

### Property 15: Auto-Snapshot Threshold

_For any_ context usage level, when usage reaches 80% capacity, a snapshot should be automatically created.
**Validates: Requirements 4.6**

### Property 16: Pre-Overflow Event

_For any_ context approaching overflow (>95%), a pre-overflow event should be emitted.
**Validates: Requirements 4.7**

### Property 17: Rolling Snapshot Cleanup

_For any_ configured maximum snapshot count, the number of snapshots should never exceed that maximum, with oldest deleted first.
**Validates: Requirements 4.8, 8.9**

### Property 18: System Prompt Preservation in Truncation

_For any_ set of messages including a system prompt, truncation compression should always preserve the system prompt.
**Validates: Requirements 5.2**

### Property 19: Hybrid Compression Structure

_For any_ hybrid compression, the result should contain summarized old messages and intact recent messages.
**Validates: Requirements 5.3**

### Property 20: Recent Token Preservation

_For any_ compression with a configured preserveRecent value, exactly that number of recent tokens should remain uncompressed.
**Validates: Requirements 5.4**

### Property 21: Compression Result Fields

_For any_ completed compression, the result should include both original and compressed token counts.
**Validates: Requirements 5.5**

### Property 22: Compression Estimation No Side Effects

_For any_ context, estimating compression should not modify the context or trigger actual compression.
**Validates: Requirements 5.6**

### Property 23: Auto-Compression Threshold

_For any_ context usage level, when usage reaches the compression threshold, compression should be automatically triggered.
**Validates: Requirements 5.7, 8.7**

### Property 24: Allocation Safety Check

_For any_ token allocation request, canAllocate should return true only if the allocation would not exceed the soft limit (80%).
**Validates: Requirements 6.1**

### Property 25: Emergency Action Notification

_For any_ emergency action taken by Memory Guard, the user should be notified with recovery options.
**Validates: Requirements 6.5**

### Property 26: Safety Buffer Inclusion

_For any_ safe allocation limit calculation, a safety buffer of 512MB should be subtracted from available memory.
**Validates: Requirements 6.6**

### Property 27: Context Size Command

_For any_ target context size value, running `/context size <tokens>` should set the target to that value.
**Validates: Requirements 7.2**

### Property 28: Snapshot Restoration

_For any_ snapshot ID, running `/context restore <id>` should restore the context to match that snapshot.
**Validates: Requirements 7.5**

### Property 29: Context Clear Preservation

_For any_ context with a system prompt, running `/context clear` should remove all messages except the system prompt.
**Validates: Requirements 7.7**

### Property 30: Target Size Configuration

_For any_ configured targetSize value, the Context Manager should use that value as the preferred context size.
**Validates: Requirements 8.1**

### Property 31: Minimum Size Invariant

_For any_ context operation, the context size should never be reduced below the configured minSize.
**Validates: Requirements 8.2**

### Property 32: Maximum Size Invariant

_For any_ context operation, the context size should never exceed the configured maxSize.
**Validates: Requirements 8.3**

### Property 33: Auto-Size Dynamic Adjustment

_For any_ VRAM availability change when autoSize is enabled, the context size should adjust accordingly.
**Validates: Requirements 8.4**

### Property 34: VRAM Buffer Reservation

_For any_ configured vramBuffer value, that amount should be reserved and subtracted from available VRAM in all calculations.
**Validates: Requirements 8.5**

### Property 35: Quantization Configuration

_For any_ configured kvQuantization type, that quantization should be used in all context size calculations.
**Validates: Requirements 8.6**

### Property 36: Auto-Snapshot Threshold

_For any_ configured snapshot threshold, snapshots should be automatically created when context usage reaches that threshold.
**Validates: Requirements 8.8**

### Property 37: Status Display Completeness

_For any_ context status display, it should include model name, token usage with percentage, VRAM usage with percentage, KV cache info, snapshot count, and compression settings.
**Validates: Requirements 9.1, 9.2, 9.3, 9.4, 9.5, 9.6**

### Property 38: High Usage Warning

_For any_ context usage level, when usage exceeds 80%, a warning indicator should be displayed in the status.
**Validates: Requirements 9.7**

### Property 39: Snapshot JSON Format

_For any_ saved snapshot, the file should be valid JSON with the expected structure including messages and metadata.
**Validates: Requirements 10.1**

### Property 40: Corruption Detection

_For any_ corrupted snapshot file, loading should detect the corruption and report an error.
**Validates: Requirements 10.3**

### Property 41: Corrupted File Recovery

_For any_ set of snapshots including corrupted files, the system should skip corrupted files and successfully load valid snapshots.
**Validates: Requirements 10.6**

## Error Handling

### VRAM Monitor Errors

| Error                | Cause                  | Recovery                                    |
| -------------------- | ---------------------- | ------------------------------------------- |
| GPU Detection Failed | No GPU tools available | Fall back to CPU-only mode, monitor RAM     |
| Query Timeout        | GPU command hangs      | Use cached values, retry with backoff       |
| Permission Denied    | No access to GPU tools | Fall back to estimation based on model size |

### Token Counter Errors

| Error                    | Cause                  | Recovery                          |
| ------------------------ | ---------------------- | --------------------------------- |
| Provider API Unavailable | Network/service error  | Use fallback estimation (chars/4) |
| Invalid Token Count      | Negative or NaN result | Log warning, use estimation       |
| Cache Corruption         | Invalid cache data     | Clear cache, recalculate          |

### Context Pool Errors

| Error             | Cause               | Recovery                                    |
| ----------------- | ------------------- | ------------------------------------------- |
| Resize Failed     | Provider error      | Revert to previous size, notify user        |
| Invalid Size      | Size < min or > max | Clamp to valid range                        |
| Insufficient VRAM | Not enough memory   | Reduce to minimum size, trigger compression |

### Snapshot Errors

| Error               | Cause                        | Recovery                               |
| ------------------- | ---------------------------- | -------------------------------------- |
| Save Failed         | Disk full, permissions       | Notify user, suggest cleanup           |
| Load Failed         | File not found               | Return error, list available snapshots |
| Corruption Detected | Invalid JSON, missing fields | Skip file, log warning, continue       |
| Restore Failed      | Invalid snapshot data        | Return error, keep current context     |

### Compression Errors

| Error                | Cause                 | Recovery                         |
| -------------------- | --------------------- | -------------------------------- |
| Summarization Failed | Model error           | Fall back to truncation strategy |
| Invalid Strategy     | Unknown strategy type | Use default (hybrid)             |
| Compression Timeout  | Model too slow        | Cancel, use truncation           |

### Memory Guard Errors

| Error                     | Cause                    | Recovery                          |
| ------------------------- | ------------------------ | --------------------------------- |
| OOM Imminent              | Memory > 95%             | Emergency snapshot + clear        |
| Threshold Action Failed   | Compression/resize error | Escalate to next threshold level  |
| Emergency Snapshot Failed | Disk/permission error    | Clear context anyway, notify user |

## Testing Strategy

### Unit Tests

Unit tests verify specific examples, edge cases, and error conditions for individual components:

**VRAM Monitor**:

- GPU detection for each type (NVIDIA, AMD, Apple, CPU-only)
- Memory info parsing from command output
- Low memory event emission
- Fallback to RAM monitoring

**Token Counter**:

- Provider API integration
- Fallback estimation formula
- Cache hit/miss behavior
- Tool call overhead calculation

**Context Pool**:

- Context size calculation with different quantization types
- Min/max size clamping
- Resize coordination with provider
- Usage statistics accuracy

**Snapshot Manager**:

- Snapshot creation with all required fields
- Snapshot restoration
- Rolling cleanup logic
- Threshold-based auto-creation

**Compression Service**:

- Each compression strategy (summarize, truncate, hybrid)
- System prompt preservation
- Recent message preservation
- Compression ratio calculation

**Memory Guard**:

- Threshold detection (80%, 90%, 95%)
- Action triggering at each level
- Emergency action execution
- User notification

**Snapshot Storage**:

- JSON serialization/deserialization
- Corruption detection
- Index management
- File operations (save, load, delete)

### Property-Based Tests

Property tests verify universal properties across all inputs using randomized test data. Each test should run a minimum of 100 iterations.

**Test Configuration**:

- Use `fast-check` library for TypeScript property-based testing
- Minimum 100 iterations per property test
- Each test references its design document property number
- Tag format: `Feature: stage-04b-context-management, Property N: <property text>`

**Key Properties to Test**:

- Property 3: Token count caching (generate random messages, verify cache hits)
- Property 4: Fallback estimation formula (generate random text, verify formula)
- Property 7: Context size calculation (generate random VRAM values, verify formula)
- Property 9: Context resize preservation (generate random contexts, verify no data loss)
- Property 12: Snapshot round trip (generate random contexts, verify save/restore equivalence)
- Property 18: System prompt preservation (generate random message sets, verify system prompt remains)
- Property 24: Allocation safety check (generate random allocation requests, verify soft limit)
- Property 31: Minimum size invariant (generate random operations, verify min never violated)
- Property 32: Maximum size invariant (generate random operations, verify max never violated)

**Generators**:

```typescript
// Example generators for property tests
const arbMessage = fc.record({
  id: fc.uuid(),
  role: fc.constantFrom('system', 'user', 'assistant', 'tool'),
  content: fc.string({ minLength: 1, maxLength: 1000 }),
  timestamp: fc.date(),
});

const arbVRAMInfo = fc.record({
  total: fc.integer({ min: 1e9, max: 80e9 }), // 1-80 GB
  used: fc.integer({ min: 0, max: 80e9 }),
  available: fc.integer({ min: 0, max: 80e9 }),
  modelLoaded: fc.integer({ min: 0, max: 40e9 }),
});

const arbContextConfig = fc.record({
  minContextSize: fc.integer({ min: 512, max: 4096 }),
  maxContextSize: fc.integer({ min: 8192, max: 131072 }),
  targetContextSize: fc.integer({ min: 4096, max: 65536 }),
  kvQuantization: fc.constantFrom('f16', 'q8_0', 'q4_0'),
});
```

### Integration Tests

Integration tests verify interactions between components:

- VRAM Monitor → Context Pool: Auto-sizing based on real memory
- Context Pool → Provider: Resize coordination
- Snapshot Manager → Storage: Save/load operations
- Compression Service → Model: Summarization with real inference
- Memory Guard → All Services: Threshold-based action coordination
- Context Command → All Services: End-to-end command execution

### Performance Tests

Performance tests verify system efficiency:

- Token counting latency (< 10ms per message)
- Compression latency (< 2s for 10K tokens)
- Snapshot save/load speed (< 500ms for 100KB)
- Memory monitoring overhead (< 1% CPU)
- Context resize impact (< 5s for model reload)

### Manual Testing

Manual testing scenarios for user-facing features:

1. Run `/context` and verify status display
2. Run `/context size 8192` and verify context resizes
3. Run `/context snapshot` and verify snapshot creation
4. Run `/context list` and verify snapshots are listed
5. Run `/context restore <id>` and verify context restoration
6. Run `/context compress` and verify token count reduction
7. Fill context to 80% and verify auto-snapshot
8. Fill context to 95% and verify emergency actions
9. Switch models and verify context adjusts
10. Restart session and verify snapshots persist
