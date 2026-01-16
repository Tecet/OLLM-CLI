# Context Rework Tasks

Derived from [.kiro/specs/stage-04b-context-management/tasks.md](file:///d:/Workspaces/OLLM%20CLI/.kiro/specs/stage-04b-context-management/tasks.md) (excluding test tasks).

- [ ] 1. Set up context management infrastructure
  - [ ] Create directory structure: `packages/core/src/context/`
  - [ ] Define core interfaces and types in `types.ts`
  - [ ] Set up testing framework with fast-check for property-based testing

- [ ] 2. Implement GPU Detection and VRAM Monitor
  - [ ] 2.1 Create GPU detector
    - [ ] Implement `detectGPU()` to identify NVIDIA, AMD, Apple Silicon, or CPU-only
    - [ ] Use command-line tools (nvidia-smi, rocm-smi, sysctl) for detection
  - [ ] 2.2 Implement VRAM Monitor service
    - [ ] Create `VRAMMonitor` class with `getInfo()` method
    - [ ] Implement GPU-specific memory querying for each platform
    - [ ] Add fallback to system RAM monitoring for CPU-only mode
    - [ ] Implement polling system with 5-second interval
    - [ ] Add low-memory event emission

- [ ] 3. Implement Token Counter
  - [ ] 3.1 Create Token Counter service
    - [ ] Implement `countTokens()` with provider API integration
    - [ ] Implement fallback estimation using Math.ceil(text.length / 4)
    - [ ] Add token count caching by message ID
    - [ ] Implement `countConversationTokens()` with tool call overhead
    - [ ] Add per-model multiplier support

- [ ] 4. Implement Context Pool
  - [ ] 4.1 Create Context Pool service
    - [ ] Implement `calculateOptimalSize()` with VRAM-based formula
    - [ ] Add support for f16, q8_0, q4_0 quantization types
    - [ ] Implement `resize()` with provider coordination
    - [ ] Add min/max size clamping
    - [ ] Implement `getUsage()` for real-time statistics
    - [ ] Add auto-sizing toggle

- [ ] 6. Implement Snapshot Storage
  - [ ] 6.1 Create Snapshot Storage service
    - [ ] Implement `save()` with atomic write operations
    - [ ] Implement `load()` with JSON parsing and validation
    - [ ] Add `list()` with metadata caching
    - [ ] Implement `delete()` and `exists()` methods
    - [ ] Add `verify()` for corruption detection
    - [ ] Create snapshot index management

- [ ] 7. Implement Snapshot Manager
  - [ ] 7.1 Create Snapshot Manager service
    - [ ] Implement `createSnapshot()` with UUID generation
    - [ ] Implement `restoreSnapshot()` with context reconstruction
    - [ ] Add `listSnapshots()` and `deleteSnapshot()` methods
    - [ ] Implement threshold-based auto-snapshot at 80%
    - [ ] Add pre-overflow event emission at 95%
    - [ ] Implement rolling cleanup with configurable maxCount

- [ ] 8. Implement Compression Service
  - [ ] 8.1 Create Compression Service
    - [ ] Implement summarize strategy using active model
    - [ ] Implement truncate strategy with system prompt preservation
    - [ ] Implement hybrid strategy (summarize old + preserve recent)
    - [ ] Add `estimateCompression()` without side effects
    - [ ] Implement automatic compression at threshold
    - [ ] Add compression ratio calculation

- [ ] 9. Implement Memory Guard
  - [ ] 9.1 Create Memory Guard service
    - [ ] Implement `canAllocate()` with soft limit check (80%)
    - [ ] Add threshold monitoring for 80%, 90%, 95% levels
    - [ ] Implement action triggering: compression at 80%, reduction at 90%, emergency at 95%
    - [ ] Add `executeEmergencyActions()` for snapshot + clear
    - [ ] Implement user notification with recovery options
    - [ ] Add safety buffer (512MB) to all calculations

- [ ] 11. Implement Context Manager orchestration
  - [ ] 11.1 Create Context Manager
    - [ ] Implement main orchestration layer coordinating all services
    - [ ] Add configuration management
    - [ ] Implement service lifecycle (start/stop)
    - [ ] Add event coordination between services

- [ ] 12. Implement /context command
  - [ ] 12.1 Create context command handler
    - [ ] Implement `/context` (show status)
    - [ ] Implement `/context size <tokens>` (set target size)
    - [ ] Implement `/context auto` (enable auto-sizing)
    - [ ] Implement `/context snapshot` (create manual snapshot)
    - [ ] Implement `/context restore <id>` (restore from snapshot)
    - [ ] Implement `/context list` (list snapshots)
    - [ ] Implement `/context clear` (clear context)
    - [ ] Implement `/context compress` (manual compression)
    - [ ] Implement `/context stats` (detailed statistics)

- [ ] 13. Implement Context Status UI component
  - [ ] 13.1 Create ContextStatus React component
    - [ ] Display model name, token usage, VRAM usage
    - [ ] Show KV cache info and snapshot count
    - [ ] Display compression settings
    - [ ] Add warning indicator for usage > 80%
    - [ ] Format with proper styling and layout

- [ ] 14. Integration and configuration
  - [ ] 14.1 Wire Context Manager into chat runtime
    - [ ] Integrate with ChatClient for message tracking
    - [ ] Add context checks before message addition
    - [ ] Trigger compression/snapshots automatically
    - [ ] Handle memory guard interventions
  - [ ] 14.2 Add configuration schema
    - [ ] Update settings schema with context configuration
    - [ ] Add default values for all settings
    - [ ] Implement configuration validation
