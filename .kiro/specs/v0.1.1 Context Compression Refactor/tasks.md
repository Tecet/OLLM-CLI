#         plementation Plan: Context Compression System Refactor

## Overview

This implementation plan breaks down the context compression system refactor into discrete, incremental tasks. The approach follows a bottom-up strategy: first backing up legacy code, then implementing storage layers, compression engine, checkpoint lifecycle, orchestration, system integration, and finally migration.

## Tasks

## Phase 0: Backup & Setup

- [x] 0. Create backup infrastructure
  - Create backup script for all legacy files
  - Script creates timestamped directory with MANIFEST.md
  - Script creates restore.sh for rollback
  - Script creates VERIFICATION.md checklist
  - _Requirements: All (safety measure)_

- [x] 0.1 Execute backup and verify
  - Run backup script
  - Verify all files backed up
  - Commit backup to git
  - _Requirements: All (safety measure)_

- [x] 0.2 Create new directory structure
  - Create `packages/core/src/context/types/`
  - Create `packages/core/src/context/storage/`
  - Create `packages/core/src/context/compression/`
  - Create `packages/core/src/context/checkpoints/`
  - Create `packages/core/src/context/orchestration/`
  - Create `packages/core/src/context/integration/`
  - Create test directories
  - _Requirements: All_

- [x] 0.3 Set up feature flags
  - Create `config/features.ts`
  - Define feature flags for gradual rollout
  - Add environment variable support
  - Default to legacy system
  - _Requirements: NFR-1, NFR-2_

- [x] 0.4 Create compatibility layer
  - Create `adapters/legacyContextAdapter.ts`
  - Implement session migration logic
  - Implement snapshot migration logic
  - Write migration tests
  - _Requirements: NFR-2_

## Phase 1: Foundation

- [x] 1. Create storage type definitions
  - Define `ActiveContext` interface
  - Define `CheckpointSummary` interface
  - Define `SnapshotData` interface
  - Define `SessionHistory` interface
  - Define `CheckpointRecord` interface
  - Define `StorageBoundaries` interface
  - Implement type guards
  - Add comprehensive JSDoc
  - _Requirements: FR-1, FR-2, FR-3, FR-4_

- [x] 1.1 Write property test for storage type validation
  - **Property 1: Storage Type Validation**
  - **Validates: Requirements FR-1, FR-2, FR-3, FR-4**

- [x] 2. Implement Active Context Manager
  - Create `ActiveContextManager` class
  - Implement `buildPrompt()` method
  - Implement `addMessage()` method
  - Implement `addCheckpoint()` method
  - Implement `removeMessages()` method
  - Implement `getTokenCount()` method
  - Implement `getAvailableTokens()` method
  - Implement `validate()` method
  - _Requirements: FR-1, FR-5, FR-6_

- [x] 2.1 Write property test for active context token limits
  - **Property 2: Active Context Token Limits**
  - **Validates: Requirements FR-1, FR-5**

- [x] 2.2 Write property test for active context message ordering
  - **Property 3: Active Context Message Ordering**
  - **Validates: Requirements FR-1**

- [x] 2.3 Write unit tests for active context edge cases
  - Test empty context
  - Test single message
  - Test checkpoint integration
  - _Requirements: FR-1, FR-6_

- [x] 3. Implement Snapshot Lifecycle
  - Create `SnapshotLifecycle` class
  - Implement `createSnapshot()` method
  - Implement `restoreSnapshot()` method
  - Implement `listSnapshots()` method
  - Implement `cleanup()` method
  - Integrate with `SnapshotStorage`
  - _Requirements: FR-3, FR-9_

- [x] 3.1 Write property test for snapshot round trip
  - **Property 4: Snapshot Round Trip**
  - **Validates: Requirements FR-3**

- [x] 3.2 Write property test for snapshot cleanup
  - **Property 5: Snapshot Cleanup**
  - **Validates: Requirements FR-9**

- [x] 4. Implement Session History Manager
  - Create `SessionHistoryManager` class
  - Implement `appendMessage()` method
  - Implement `recordCheckpoint()` method
  - Implement `getHistory()` method
  - Implement `save()` method
  - Implement `load()` method
  - Implement `exportToMarkdown()` method
  - _Requirements: FR-4_

- [x] 4.1 Write property test for session history append
  - **Property 6: Session History Append**
  - **Validates: Requirements FR-4**

- [x] 4.2 Write property test for session history persistence
  - **Property 7: Session History Persistence**
  - **Validates: Requirements FR-4**

- [x] 5. Implement Storage Boundaries
  - Create `StorageBoundaries` class
  - Implement type guards
  - Implement validation methods
  - Implement enforcement methods
  - Add runtime checks
  - _Requirements: FR-1, FR-2, FR-3, FR-4_

- [x] 5.1 Write property test for storage boundary enforcement
  - **Property 8: Storage Boundary Enforcement**
  - **Validates: Requirements FR-1, FR-2, FR-3, FR-4**

- [x] 6. Checkpoint - Ensure all Phase 1 tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Phase 2: Compression Engine

- [x] 7. Implement Summarization Service
  - Create `SummarizationService` class
  - Implement `summarize()` method
  - Implement `buildSummarizationPrompt()` method
  - Implement `validateSummary()` method
  - Create prompts for all compression levels
  - Add error handling for LLM failures
  - _Requirements: FR-5, FR-6, FR-7_

- [x] 7.1 Write property test for summarization quality
  - **Property 9: Summarization Quality**
  - **Validates: Requirements FR-5, FR-6**

- [x] 7.2 Write property test for summarization token reduction
  - **Property 10: Summarization Token Reduction**
  - **Validates: Requirements FR-5**

- [x] 7.3 Write unit tests for summarization edge cases
  - Test empty input
  - Test single message
  - Test LLM failure
  - _Requirements: FR-5, FR-6, FR-7_

- [x] 8. Implement Validation Service
  - Create `ValidationService` class
  - Implement `validatePromptSize()` method
  - Implement `calculateTotalTokens()` method
  - Implement `checkOllamaLimit()` method
  - Implement `suggestActions()` method
  - _Requirements: FR-5, FR-8_

- [x] 8.1 Write property test for validation accuracy
  - **Property 11: Validation Accuracy**
  - **Validates: Requirements FR-5, FR-8**

- [x] 8.2 Write property test for validation suggestions
  - **Property 12: Validation Suggestions**
  - **Validates: Requirements FR-8**

- [x] 9. Implement Compression Pipeline
  - Create `CompressionPipeline` class
  - Implement `compress()` method
  - Implement `identifyMessagesToCompress()` method
  - Implement `prepareForSummarization()` method
  - Implement `createCheckpoint()` method
  - Implement `updateActiveContext()` method
  - Add progress reporting
  - Add error handling at each stage
  - _Requirements: FR-5, FR-6, FR-7_

- [x] 9.1 Write property test for compression pipeline stages
  - **Property 13: Compression Pipeline Stages**
  - **Validates: Requirements FR-5, FR-6**

- [x] 9.2 Write property test for compression pipeline error handling
  - **Property 14: Compression Pipeline Error Handling**
  - **Validates: Requirements FR-7**

- [ ] 10. Implement Compression Engine
  - Create `CompressionEngine` class
  - Integrate with pipeline
  - Implement strategy pattern for compression types
  - Integrate token counting
  - _Requirements: FR-5, FR-6_

- [ ] 10.1 Write property test for compression engine strategies
  - **Property 15: Compression Engine Strategies**
  - **Validates: Requirements FR-5, FR-6**

- [ ] 11. Checkpoint - Ensure all Phase 2 tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Phase 3: Checkpoint Lifecycle

- [ ] 12. Implement Checkpoint Lifecycle
  - Create `CheckpointLifecycle` class
  - Implement `ageCheckpoints()` method
  - Implement `mergeCheckpoints()` method
  - Implement `compressCheckpoint()` method
  - Integrate LLM re-summarization
  - _Requirements: FR-2, FR-6_

- [ ] 12.1 Write property test for checkpoint aging
  - **Property 16: Checkpoint Aging**
  - **Validates: Requirements FR-2, FR-6**

- [ ] 12.2 Write property test for checkpoint merging
  - **Property 17: Checkpoint Merging**
  - **Validates: Requirements FR-2, FR-6**

- [ ] 12.3 Write unit tests for checkpoint edge cases
  - Test single checkpoint
  - Test no checkpoints
  - Test maximum checkpoints
  - _Requirements: FR-2_

- [ ] 13. Implement Emergency Actions
  - Create `EmergencyActions` class
  - Implement `compressCheckpoint()` method
  - Implement `mergeCheckpoints()` method
  - Implement `emergencyRollover()` method
  - Implement `aggressiveSummarization()` method
  - Create snapshot before actions
  - _Requirements: FR-8, FR-9_

- [ ] 13.1 Write property test for emergency action safety
  - **Property 18: Emergency Action Safety**
  - **Validates: Requirements FR-8, FR-9**

- [ ] 13.2 Write property test for emergency action effectiveness
  - **Property 19: Emergency Action Effectiveness**
  - **Validates: Requirements FR-8**

- [ ] 14. Checkpoint - Ensure all Phase 3 tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Phase 4: Orchestration

- [ ] 15. Implement Context Orchestrator
  - Create `ContextOrchestrator` class
  - Integrate all subsystems
  - Implement lifecycle management
  - Implement event emission
  - Add comprehensive error handling
  - _Requirements: All FR_

- [ ] 15.1 Write property test for orchestrator coordination
  - **Property 20: Orchestrator Coordination**
  - **Validates: Requirements FR-1, FR-2, FR-3, FR-4, FR-5**

- [ ] 15.2 Write property test for orchestrator error recovery
  - **Property 21: Orchestrator Error Recovery**
  - **Validates: Requirements FR-7, FR-8, FR-9**

- [ ] 16. Implement Feature Flag Integration
  - Create `contextManagerFactory.ts`
  - Add feature flag checks
  - Implement fallback to legacy system
  - Write tests for both paths
  - _Requirements: NFR-1, NFR-2_

- [ ] 16.1 Write integration tests for feature flags
  - Test new system enabled
  - Test legacy system fallback
  - Test migration path
  - _Requirements: NFR-1, NFR-2_

- [ ] 17. Integration Testing - Core System
  - Write long conversation test (10+ checkpoints)
  - Write checkpoint aging test
  - Write emergency scenario test
  - Write error handling test
  - Ensure all tests passing
  - _Requirements: All FR_

- [ ] 18. Checkpoint - Ensure all Phase 4 tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Phase 5: UI & Progress

- [ ] 19. Implement Compression Progress UI
  - Create `CompressionProgress` component
  - Add progress indicator
  - Block user input during compression
  - Show completion message
  - Ensure good UX
  - _Requirements: NFR-3_

- [ ] 19.1 Write UI tests for compression progress
  - Test progress display
  - Test input blocking
  - Test completion message
  - _Requirements: NFR-3_

- [ ] 20. Implement Goal Integration
  - Pass goals to summarization
  - Parse goal markers
  - Track goal progress
  - Write tests
  - _Requirements: FR-10_

- [ ] 20.1 Write property test for goal preservation
  - **Property 22: Goal Preservation**
  - **Validates: Requirements FR-10**

- [ ] 21. Checkpoint - Ensure all Phase 5 tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Phase 5b: System Integration

- [ ] 22. Implement Tier System Integration
  - Create `TierAwareCompression` class
  - Respect tier budgets (200-1500 tokens)
  - Account for tier in compression triggers
  - Never compress system prompt
  - Include all components in token calculations
  - _Requirements: FR-11_

- [ ] 22.1 Write property test for tier budget enforcement
  - **Property 23: Tier Budget Enforcement**
  - **Validates: Requirements FR-11**

- [ ] 22.2 Write unit tests for all tiers
  - Test Tier 1 (200 tokens)
  - Test Tier 2 (500 tokens)
  - Test Tier 3 (1000 tokens)
  - Test Tier 4 (1500 tokens)
  - _Requirements: FR-11_

- [ ] 23. Implement Mode System Integration
  - Create `ModeAwareCompression` class
  - Create mode-specific summarization prompts
  - Preserve code in developer mode
  - Preserve goals in planning mode
  - Preserve errors in debugger mode
  - _Requirements: FR-12_

- [ ] 23.1 Write property test for mode-specific preservation
  - **Property 24: Mode-Specific Preservation**
  - **Validates: Requirements FR-12**

- [ ] 23.2 Write unit tests for all modes
  - Test developer mode
  - Test planning mode
  - Test debugger mode
  - Test general mode
  - _Requirements: FR-12_

- [ ] 24. Implement Model Management Integration
  - Create `ModelAwareCompression` class
  - Implement model size detection
  - Calculate reliability based on model
  - Set warning thresholds by model
  - _Requirements: FR-13_

- [ ] 24.1 Write property test for model size adaptation
  - **Property 25: Model Size Adaptation**
  - **Validates: Requirements FR-13**

- [ ] 24.2 Write unit tests for different model sizes
  - Test small models (<7B)
  - Test medium models (7B-13B)
  - Test large models (>13B)
  - _Requirements: FR-13_

- [ ] 25. Implement Provider System Integration
  - Create `ProviderAwareCompression` class
  - Read provider limits from profiles
  - Use 85% values correctly
  - Respect provider in compression triggers
  - Handle provider errors
  - _Requirements: FR-14_

- [ ] 25.1 Write property test for provider limit respect
  - **Property 26: Provider Limit Respect**
  - **Validates: Requirements FR-14**

- [ ] 25.2 Write unit tests for provider integration
  - Test Ollama provider
  - Test vLLM provider
  - Test OpenAI-compatible provider
  - _Requirements: FR-14_

- [ ] 26. Implement Goal System Integration
  - Create `GoalAwareCompression` class
  - Never compress goals
  - Implement goal-aware summarization
  - Parse goal markers correctly
  - Track goal progress
  - _Requirements: FR-15_

- [ ] 26.1 Write property test for goal never compressed
  - **Property 27: Goal Never Compressed**
  - **Validates: Requirements FR-15**

- [ ] 26.2 Write property test for goal-aware summarization
  - **Property 28: Goal-Aware Summarization**
  - **Validates: Requirements FR-15**

- [ ] 27. Implement Prompt Orchestrator Integration
  - Create `PromptOrchestratorIntegration` class
  - Get system prompt from orchestrator
  - Respect prompt structure in compression
  - Integrate checkpoints into prompt
  - Preserve skills/tools/hooks
  - _Requirements: FR-16_

- [ ] 27.1 Write property test for prompt structure preservation
  - **Property 29: Prompt Structure Preservation**
  - **Validates: Requirements FR-16**

- [ ] 27.2 Write integration tests for orchestrator
  - Test system prompt integration
  - Test checkpoint integration
  - Test skills/tools/hooks preservation
  - _Requirements: FR-16_

- [ ] 28. Wire Up All Integrations
  - Connect all integrations to `ContextOrchestrator`
  - Write end-to-end integration tests
  - Test all systems together
  - Update documentation
  - Ensure no regressions
  - _Requirements: All FR_

- [ ] 28.1 Integration Testing - Full System
  - Test tier + mode + model + provider + goal integration
  - Test compression with all systems active
  - Test emergency scenarios with all systems
  - Test error handling across all systems
  - _Requirements: All FR_

- [ ] 29. Checkpoint - Ensure all Phase 5b tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Phase 6: Migration & Documentation

- [ ] 30. Create Migration Scripts
  - Create session migration script
  - Create snapshot migration script
  - Write migration tests
  - Add dry-run mode
  - Add rollback capability
  - _Requirements: NFR-2_

- [ ] 30.1 Write tests for migration scripts
  - Test session migration
  - Test snapshot migration
  - Test dry-run mode
  - Test rollback
  - _Requirements: NFR-2_

- [ ] 31. Update Documentation
  - Update `dev_ContextCompression.md`
  - Update `dev_ContextManagement.md`
  - Update `dev_ContextSnapshots.md`
  - Update architecture diagrams
  - Update API documentation
  - _Requirements: All_

- [ ] 32. Create Release Notes
  - Create release notes
  - Document breaking changes
  - Create migration guide
  - Document known issues
  - _Requirements: All_

- [ ] 33. Enable New System by Default
  - Change feature flag default
  - Move legacy code to `.legacy/`
  - Remove old imports
  - Ensure tests passing
  - Update documentation
  - _Requirements: NFR-1_

- [ ] 34. Final Checkpoint - All Tests Pass
  - Run full test suite
  - Verify all integration tests pass
  - Verify no regressions
  - Get user approval for release

## Notes

- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- Integration tests verify components work together correctly
- All legacy code backed up before changes
- Feature flags allow gradual rollout
- Comprehensive testing at each phase
- Documentation updated throughout
