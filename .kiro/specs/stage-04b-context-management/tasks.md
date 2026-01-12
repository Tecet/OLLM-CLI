# Implementation Plan: Context Management System

## Overview

This implementation plan breaks down the Context Management System into discrete coding tasks. The system provides memory-efficient conversation management through VRAM monitoring, dynamic context sizing, snapshots, compression, and memory safety guards.

## Tasks

- [ ] 1. Set up context management infrastructure
  - Create directory structure: `packages/core/src/context/`
  - Define core interfaces and types in `types.ts`
  - Set up testing framework with fast-check for property-based testing
  - _Requirements: All_

- [ ] 2. Implement GPU Detection and VRAM Monitor
  - [ ] 2.1 Create GPU detector
    - Implement `detectGPU()` to identify NVIDIA, AMD, Apple Silicon, or CPU-only
    - Use command-line tools (nvidia-smi, rocm-smi, sysctl) for detection
    - _Requirements: 1.1_
  
  - [ ] 2.2 Implement VRAM Monitor service
    - Create `VRAMMonitor` class with `getInfo()` method
    - Implement GPU-specific memory querying for each platform
    - Add fallback to system RAM monitoring for CPU-only mode
    - Implement polling system with 5-second interval
    - Add low-memory event emission
    - _Requirements: 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8_
  
  - [ ] 2.3 Write property test for VRAM info completeness
    - **Property 1: VRAM Info Completeness**
    - **Validates: Requirements 1.2**
  
  - [ ] 2.4 Write property test for low memory events
    - **Property 2: Low Memory Event Emission**
    - **Validates: Requirements 1.8**
  
  - [ ] 2.5 Write unit tests for GPU detection
    - Test detection for each GPU type
    - Test fallback to CPU-only mode
    - _Requirements: 1.1, 1.6_

- [ ] 3. Implement Token Counter
  - [ ] 3.1 Create Token Counter service
    - Implement `countTokens()` with provider API integration
    - Implement fallback estimation using Math.ceil(text.length / 4)
    - Add token count caching by message ID
    - Implement `countConversationTokens()` with tool call overhead
    - Add per-model multiplier support
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_
  
  - [ ] 3.2 Write property test for token count caching
    - **Property 3: Token Count Caching**
    - **Validates: Requirements 2.1, 2.4**
  
  - [ ] 3.3 Write property test for fallback estimation
    - **Property 4: Fallback Token Estimation**
    - **Validates: Requirements 2.3**
  
  - [ ] 3.4 Write property test for tool call overhead
    - **Property 5: Tool Call Overhead Inclusion**
    - **Validates: Requirements 2.5**
  
  - [ ] 3.5 Write property test for model-specific multipliers
    - **Property 6: Model-Specific Multipliers**
    - **Validates: Requirements 2.6**

- [ ] 4. Implement Context Pool
  - [ ] 4.1 Create Context Pool service
    - Implement `calculateOptimalSize()` with VRAM-based formula
    - Add support for f16, q8_0, q4_0 quantization types
    - Implement `resize()` with provider coordination
    - Add min/max size clamping
    - Implement `getUsage()` for real-time statistics
    - Add auto-sizing toggle
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8_
  
  - [ ] 4.2 Write property test for context size formula
    - **Property 7: Context Size Formula**
    - **Validates: Requirements 3.2**
  
  - [ ] 4.3 Write property test for quantization bytes
    - **Property 8: Quantization Bytes Per Token**
    - **Validates: Requirements 3.3, 3.4, 3.5**
  
  - [ ] 4.4 Write property test for resize preservation
    - **Property 9: Context Resize Preservation**
    - **Validates: Requirements 3.7**
  
  - [ ] 4.5 Write property test for usage fields
    - **Property 10: Context Usage Fields**
    - **Validates: Requirements 3.8**
  
  - [ ] 4.6 Write property test for minimum size invariant
    - **Property 31: Minimum Size Invariant**
    - **Validates: Requirements 8.2**
  
  - [ ] 4.7 Write property test for maximum size invariant
    - **Property 32: Maximum Size Invariant**
    - **Validates: Requirements 8.3**

- [ ] 5. Checkpoint - Ensure core services work
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 6. Implement Snapshot Storage
  - [ ] 6.1 Create Snapshot Storage service
    - Implement `save()` with atomic write operations
    - Implement `load()` with JSON parsing and validation
    - Add `list()` with metadata caching
    - Implement `delete()` and `exists()` methods
    - Add `verify()` for corruption detection
    - Create snapshot index management
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.6_
  
  - [ ] 6.2 Write property test for snapshot JSON format
    - **Property 39: Snapshot JSON Format**
    - **Validates: Requirements 10.1**
  
  - [ ] 6.3 Write property test for corruption detection
    - **Property 40: Corruption Detection**
    - **Validates: Requirements 10.3**
  
  - [ ] 6.4 Write property test for corrupted file recovery
    - **Property 41: Corrupted File Recovery**
    - **Validates: Requirements 10.6**

- [ ] 7. Implement Snapshot Manager
  - [ ] 7.1 Create Snapshot Manager service
    - Implement `createSnapshot()` with UUID generation
    - Implement `restoreSnapshot()` with context reconstruction
    - Add `listSnapshots()` and `deleteSnapshot()` methods
    - Implement threshold-based auto-snapshot at 80%
    - Add pre-overflow event emission at 95%
    - Implement rolling cleanup with configurable maxCount
    - _Requirements: 4.1, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8_
  
  - [ ] 7.2 Write property test for snapshot data completeness
    - **Property 11: Snapshot Data Completeness**
    - **Validates: Requirements 4.1**
  
  - [ ] 7.3 Write property test for snapshot round trip
    - **Property 12: Snapshot Round Trip**
    - **Validates: Requirements 4.3**
  
  - [ ] 7.4 Write property test for snapshot list metadata
    - **Property 13: Snapshot List Metadata**
    - **Validates: Requirements 4.4**
  
  - [ ] 7.5 Write property test for snapshot deletion
    - **Property 14: Snapshot Deletion Effect**
    - **Validates: Requirements 4.5**
  
  - [ ] 7.6 Write property test for auto-snapshot threshold
    - **Property 15: Auto-Snapshot Threshold**
    - **Validates: Requirements 4.6**
  
  - [ ] 7.7 Write property test for pre-overflow event
    - **Property 16: Pre-Overflow Event**
    - **Validates: Requirements 4.7**
  
  - [ ] 7.8 Write property test for rolling cleanup
    - **Property 17: Rolling Snapshot Cleanup**
    - **Validates: Requirements 4.8, 8.9**

- [ ] 8. Implement Compression Service
  - [ ] 8.1 Create Compression Service
    - Implement summarize strategy using active model
    - Implement truncate strategy with system prompt preservation
    - Implement hybrid strategy (summarize old + preserve recent)
    - Add `estimateCompression()` without side effects
    - Implement automatic compression at threshold
    - Add compression ratio calculation
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7_
  
  - [ ] 8.2 Write property test for system prompt preservation
    - **Property 18: System Prompt Preservation in Truncation**
    - **Validates: Requirements 5.2**
  
  - [ ] 8.3 Write property test for hybrid compression structure
    - **Property 19: Hybrid Compression Structure**
    - **Validates: Requirements 5.3**
  
  - [ ] 8.4 Write property test for recent token preservation
    - **Property 20: Recent Token Preservation**
    - **Validates: Requirements 5.4**
  
  - [ ] 8.5 Write property test for compression result fields
    - **Property 21: Compression Result Fields**
    - **Validates: Requirements 5.5**
  
  - [ ] 8.6 Write property test for estimation no side effects
    - **Property 22: Compression Estimation No Side Effects**
    - **Validates: Requirements 5.6**
  
  - [ ] 8.7 Write property test for auto-compression threshold
    - **Property 23: Auto-Compression Threshold**
    - **Validates: Requirements 5.7, 8.7**

- [ ] 9. Implement Memory Guard
  - [ ] 9.1 Create Memory Guard service
    - Implement `canAllocate()` with soft limit check (80%)
    - Add threshold monitoring for 80%, 90%, 95% levels
    - Implement action triggering: compression at 80%, reduction at 90%, emergency at 95%
    - Add `executeEmergencyActions()` for snapshot + clear
    - Implement user notification with recovery options
    - Add safety buffer (512MB) to all calculations
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_
  
  - [ ] 9.2 Write property test for allocation safety check
    - **Property 24: Allocation Safety Check**
    - **Validates: Requirements 6.1**
  
  - [ ] 9.3 Write property test for emergency notification
    - **Property 25: Emergency Action Notification**
    - **Validates: Requirements 6.5**
  
  - [ ] 9.4 Write property test for safety buffer inclusion
    - **Property 26: Safety Buffer Inclusion**
    - **Validates: Requirements 6.6**
  
  - [ ] 9.5 Write unit tests for threshold actions
    - Test compression trigger at 80%
    - Test reduction trigger at 90%
    - Test emergency trigger at 95%
    - _Requirements: 6.2, 6.3, 6.4_

- [ ] 10. Checkpoint - Ensure all services integrate
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 11. Implement Context Manager orchestration
  - [ ] 11.1 Create Context Manager
    - Implement main orchestration layer coordinating all services
    - Add configuration management
    - Implement service lifecycle (start/stop)
    - Add event coordination between services
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8, 8.9_
  
  - [ ] 11.2 Write property test for target size configuration
    - **Property 30: Target Size Configuration**
    - **Validates: Requirements 8.1**
  
  - [ ] 11.3 Write property test for auto-size adjustment
    - **Property 33: Auto-Size Dynamic Adjustment**
    - **Validates: Requirements 8.4**
  
  - [ ] 11.4 Write property test for VRAM buffer reservation
    - **Property 34: VRAM Buffer Reservation**
    - **Validates: Requirements 8.5**
  
  - [ ] 11.5 Write property test for quantization configuration
    - **Property 35: Quantization Configuration**
    - **Validates: Requirements 8.6**
  
  - [ ] 11.6 Write property test for auto-snapshot threshold config
    - **Property 36: Auto-Snapshot Threshold**
    - **Validates: Requirements 8.8**

- [ ] 12. Implement /context command
  - [ ] 12.1 Create context command handler
    - Implement `/context` (show status)
    - Implement `/context size <tokens>` (set target size)
    - Implement `/context auto` (enable auto-sizing)
    - Implement `/context snapshot` (create manual snapshot)
    - Implement `/context restore <id>` (restore from snapshot)
    - Implement `/context list` (list snapshots)
    - Implement `/context clear` (clear context)
    - Implement `/context compress` (manual compression)
    - Implement `/context stats` (detailed statistics)
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8, 7.9_
  
  - [ ] 12.2 Write property test for context size command
    - **Property 27: Context Size Command**
    - **Validates: Requirements 7.2**
  
  - [ ] 12.3 Write property test for snapshot restoration
    - **Property 28: Snapshot Restoration**
    - **Validates: Requirements 7.5**
  
  - [ ] 12.4 Write property test for context clear preservation
    - **Property 29: Context Clear Preservation**
    - **Validates: Requirements 7.7**
  
  - [ ] 12.5 Write unit tests for all commands
    - Test `/context` status display
    - Test `/context auto` enable
    - Test `/context snapshot` creation
    - Test `/context list` display
    - Test `/context compress` execution
    - Test `/context stats` display
    - _Requirements: 7.1, 7.3, 7.4, 7.6, 7.8, 7.9_

- [ ] 13. Implement Context Status UI component
  - [ ] 13.1 Create ContextStatus React component
    - Display model name, token usage, VRAM usage
    - Show KV cache info and snapshot count
    - Display compression settings
    - Add warning indicator for usage > 80%
    - Format with proper styling and layout
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7_
  
  - [ ] 13.2 Write property test for status display completeness
    - **Property 37: Status Display Completeness**
    - **Validates: Requirements 9.1, 9.2, 9.3, 9.4, 9.5, 9.6**
  
  - [ ] 13.3 Write property test for high usage warning
    - **Property 38: High Usage Warning**
    - **Validates: Requirements 9.7**

- [ ] 14. Integration and configuration
  - [ ] 14.1 Wire Context Manager into chat runtime
    - Integrate with ChatClient for message tracking
    - Add context checks before message addition
    - Trigger compression/snapshots automatically
    - Handle memory guard interventions
    - _Requirements: All_
  
  - [ ] 14.2 Add configuration schema
    - Update settings schema with context configuration
    - Add default values for all settings
    - Implement configuration validation
    - _Requirements: 8.1-8.9_
  
  - [ ] 14.3 Write integration tests
    - Test VRAM Monitor → Context Pool integration
    - Test Snapshot Manager → Storage integration
    - Test Memory Guard → All Services coordination
    - Test Context Command → All Services end-to-end
    - _Requirements: All_

- [ ] 15. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- All tasks are required for comprehensive implementation
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties using fast-check
- Unit tests validate specific examples and edge cases
- Integration tests verify component interactions
- All property tests should run minimum 100 iterations
