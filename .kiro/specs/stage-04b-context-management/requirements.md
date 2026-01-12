# Requirements Document: Context Management System

## Introduction

The Context Management System provides memory-efficient conversation management for local LLMs running in OLLM CLI. It dynamically adjusts context size based on available VRAM, creates snapshots for conversation rollover, and prevents out-of-memory errors while maximizing usable context.

## Glossary

- **Context**: The conversation history (messages) maintained by the LLM during a session
- **VRAM**: Video RAM - GPU memory available for model weights and KV cache
- **KV Cache**: Key-Value cache storing attention states for processed tokens
- **Token**: A unit of text processed by the LLM (roughly 0.75 words)
- **Context Pool**: The allocated memory space for conversation context
- **Snapshot**: A saved checkpoint of conversation state at a point in time
- **Compression**: Reducing context size by summarizing or truncating older messages
- **VRAM_Monitor**: Service that tracks GPU memory availability
- **Context_Manager**: Core service coordinating all context operations
- **Snapshot_Manager**: Service handling snapshot creation and restoration
- **Compression_Service**: Service that reduces context size
- **Memory_Guard**: Safety system preventing out-of-memory errors
- **Token_Counter**: Service that counts tokens in messages
- **Context_Pool**: Service managing dynamic context size allocation

## Requirements

### Requirement 1: VRAM Monitoring

**User Story:** As a user running local LLMs, I want the system to monitor available GPU memory, so that context size can be optimized without causing out-of-memory errors.

#### Acceptance Criteria

1. WHEN the system starts THEN THE VRAM_Monitor SHALL detect the GPU type (NVIDIA, AMD, Apple Silicon, or CPU-only)
2. WHEN GPU memory information is requested THEN THE VRAM_Monitor SHALL return total, used, available, and model-loaded memory values
3. WHEN running on NVIDIA GPUs THEN THE VRAM_Monitor SHALL query memory using nvidia-smi or NVML bindings
4. WHEN running on AMD GPUs THEN THE VRAM_Monitor SHALL query memory using ROCm tools
5. WHEN running on Apple Silicon THEN THE VRAM_Monitor SHALL query memory using Metal API or system calls
6. WHEN no GPU is detected THEN THE VRAM_Monitor SHALL fall back to monitoring system RAM
7. WHEN active inference is occurring THEN THE VRAM_Monitor SHALL poll memory status every 5 seconds
8. WHEN available memory drops below a threshold THEN THE VRAM_Monitor SHALL emit a low-memory event

### Requirement 2: Token Counting

**User Story:** As a developer, I want accurate token counting for messages, so that context usage can be tracked and limits enforced.

#### Acceptance Criteria

1. WHEN a message is added to context THEN THE Token_Counter SHALL calculate and cache its token count
2. WHEN the provider offers token counting THEN THE Token_Counter SHALL use the provider's API
3. WHEN provider token counting is unavailable THEN THE Token_Counter SHALL estimate tokens using the formula: Math.ceil(text.length / 4)
4. WHEN token counts are requested for previously counted messages THEN THE Token_Counter SHALL return cached values
5. WHEN calculating conversation token usage THEN THE Token_Counter SHALL include tool call overhead
6. WHEN per-model token adjustments are configured THEN THE Token_Counter SHALL apply model-specific multipliers

### Requirement 3: Dynamic Context Sizing

**User Story:** As a user, I want context size to automatically adjust based on available VRAM, so that I can use the maximum safe context without manual configuration.

#### Acceptance Criteria

1. WHEN calculating optimal context size THEN THE Context_Pool SHALL use available VRAM, model parameters, and KV cache quantization type
2. WHEN auto-sizing is enabled THEN THE Context_Pool SHALL calculate context size using the formula: floor((availableVRAM - safetyBuffer) / bytesPerToken)
3. WHEN KV cache quantization is f16 THEN THE Context_Pool SHALL use 2 bytes per value in calculations
4. WHEN KV cache quantization is q8_0 THEN THE Context_Pool SHALL use 1 byte per value in calculations
5. WHEN KV cache quantization is q4_0 THEN THE Context_Pool SHALL use 0.5 bytes per value in calculations
6. WHEN context size needs to change THEN THE Context_Pool SHALL coordinate with the provider to resize context
7. WHEN resizing context THEN THE Context_Pool SHALL preserve existing conversation data
8. WHEN context usage is requested THEN THE Context_Pool SHALL return current usage percentage and token counts

### Requirement 4: Context Snapshots

**User Story:** As a user with long conversations, I want to create snapshots of my context, so that I can rollover to a new context while preserving conversation history.

#### Acceptance Criteria

1. WHEN a snapshot is created THEN THE Snapshot_Manager SHALL save the current conversation messages, token count, and metadata
2. WHEN saving a snapshot THEN THE Snapshot_Manager SHALL use atomic write operations to prevent corruption
3. WHEN a snapshot is restored THEN THE Snapshot_Manager SHALL load the saved messages and metadata into the current context
4. WHEN listing snapshots for a session THEN THE Snapshot_Manager SHALL return all snapshots with their IDs, timestamps, and token counts
5. WHEN deleting a snapshot THEN THE Snapshot_Manager SHALL remove the snapshot file and update the index
6. WHEN context usage reaches 80% capacity THEN THE Snapshot_Manager SHALL automatically create a snapshot
7. WHEN context is about to overflow THEN THE Snapshot_Manager SHALL emit a pre-overflow event
8. WHEN more than the configured maximum snapshots exist THEN THE Snapshot_Manager SHALL delete the oldest snapshots

### Requirement 5: Context Compression

**User Story:** As a user, I want older context to be compressed automatically, so that I can maintain conversation continuity without hitting context limits.

#### Acceptance Criteria

1. WHEN using summarize strategy THEN THE Compression_Service SHALL use the active model to create a coherent summary of older messages
2. WHEN using truncate strategy THEN THE Compression_Service SHALL remove the oldest messages while preserving the system prompt
3. WHEN using hybrid strategy THEN THE Compression_Service SHALL summarize old messages and keep recent messages intact
4. WHEN compressing context THEN THE Compression_Service SHALL preserve the configured number of recent tokens uncompressed
5. WHEN compression is complete THEN THE Compression_Service SHALL return the compressed context with original and compressed token counts
6. WHEN estimating compression THEN THE Compression_Service SHALL predict the resulting token count without performing actual compression
7. WHEN context reaches the compression threshold THEN THE Compression_Service SHALL automatically trigger compression

### Requirement 6: Memory Safety

**User Story:** As a user, I want the system to prevent out-of-memory errors, so that my LLM session doesn't crash due to memory exhaustion.

#### Acceptance Criteria

1. WHEN checking if tokens can be allocated THEN THE Memory_Guard SHALL return true only if allocation would not exceed the soft limit
2. WHEN memory usage reaches 80% of available VRAM THEN THE Memory_Guard SHALL trigger context compression
3. WHEN memory usage reaches 90% of available VRAM THEN THE Memory_Guard SHALL force context size reduction
4. WHEN memory usage reaches 95% of available VRAM THEN THE Memory_Guard SHALL create an emergency snapshot and clear context
5. WHEN emergency actions are taken THEN THE Memory_Guard SHALL notify the user with recovery options
6. WHEN calculating safe allocation limits THEN THE Memory_Guard SHALL include a safety buffer of 512MB

### Requirement 7: Context Command Interface

**User Story:** As a user, I want to control context settings through commands, so that I can manage context size, snapshots, and compression during my session.

#### Acceptance Criteria

1. WHEN the user runs `/context` THEN THE System SHALL display current context status including token usage, VRAM usage, and snapshot count
2. WHEN the user runs `/context size <tokens>` THEN THE System SHALL set the target context size to the specified value
3. WHEN the user runs `/context auto` THEN THE System SHALL enable automatic context sizing based on VRAM
4. WHEN the user runs `/context snapshot` THEN THE System SHALL create a manual snapshot of the current context
5. WHEN the user runs `/context restore <id>` THEN THE System SHALL restore context from the specified snapshot
6. WHEN the user runs `/context list` THEN THE System SHALL display all available snapshots with their metadata
7. WHEN the user runs `/context clear` THEN THE System SHALL clear all context except the system prompt
8. WHEN the user runs `/context compress` THEN THE System SHALL manually trigger context compression
9. WHEN the user runs `/context stats` THEN THE System SHALL display detailed memory statistics including model memory, KV cache size, and compression ratios

### Requirement 8: Configuration Management

**User Story:** As a user, I want to configure context management settings, so that the system behaves according to my preferences and hardware capabilities.

#### Acceptance Criteria

1. WHEN configuration specifies targetSize THEN THE Context_Manager SHALL use that value as the preferred context size
2. WHEN configuration specifies minSize THEN THE Context_Manager SHALL never reduce context below that value
3. WHEN configuration specifies maxSize THEN THE Context_Manager SHALL never exceed that context size
4. WHEN configuration enables autoSize THEN THE Context_Manager SHALL dynamically adjust context based on VRAM
5. WHEN configuration specifies vramBuffer THEN THE Context_Manager SHALL reserve that amount of VRAM as a safety buffer
6. WHEN configuration specifies kvQuantization THEN THE Context_Manager SHALL use that quantization type in calculations
7. WHEN compression is enabled in configuration THEN THE Context_Manager SHALL automatically compress at the specified threshold
8. WHEN snapshots are enabled in configuration THEN THE Snapshot_Manager SHALL automatically create snapshots at the specified threshold
9. WHEN maxCount is specified for snapshots THEN THE Snapshot_Manager SHALL maintain no more than that number of snapshots

### Requirement 9: Status Display

**User Story:** As a user, I want to see context status in the UI, so that I can monitor memory usage and context capacity at a glance.

#### Acceptance Criteria

1. WHEN displaying context status THEN THE System SHALL show the current model name
2. WHEN displaying context status THEN THE System SHALL show current token usage and maximum context size with percentage
3. WHEN displaying context status THEN THE System SHALL show current VRAM usage and total VRAM with percentage
4. WHEN displaying context status THEN THE System SHALL show KV cache quantization type and memory usage
5. WHEN displaying context status THEN THE System SHALL show the number of available snapshots
6. WHEN displaying context status THEN THE System SHALL show whether auto-compression is enabled and its threshold
7. WHEN context usage exceeds 80% THEN THE System SHALL display a warning indicator in the status

### Requirement 10: Snapshot Storage

**User Story:** As a developer, I want snapshots to be stored reliably, so that users can restore their context without data loss or corruption.

#### Acceptance Criteria

1. WHEN saving a snapshot THEN THE System SHALL store it in JSON format with compressed message data
2. WHEN writing a snapshot file THEN THE System SHALL use atomic write operations to prevent partial writes
3. WHEN loading a snapshot THEN THE System SHALL detect and report file corruption
4. WHEN indexing snapshots THEN THE System SHALL cache metadata for quick lookup
5. WHEN large snapshots are saved THEN THE System SHALL handle them efficiently without blocking the UI
6. WHEN snapshot files are corrupted THEN THE System SHALL skip them and continue loading other snapshots
