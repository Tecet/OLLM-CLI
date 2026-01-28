# Context Compression System Refactor - Task Tracking

**Feature Name:** context-compression-refactor  
**Created:** January 28, 2026  
**Status:** Not Started  
**Related:** requirements.md, design.md

---

## Task Overview

**Total Phases:** 6  
**Total Tasks:** 45  
**Estimated Time:** 2-3 weeks  
**Priority:** 🔴 CRITICAL

---

## Phase 0: Backup & Setup (1 day)

**Goal:** Backup all legacy code and set up new structure

### TASK-000: Create Backup Script ⏳ Not Started

**Description:** Create comprehensive backup script for all legacy files

**Acceptance Criteria:**
- [ ] Script backs up all 6 core files
- [ ] Script creates timestamped directory
- [ ] Script generates MANIFEST.md
- [ ] Script creates restore.sh
- [ ] Script creates VERIFICATION.md

**Files:**
- `scripts/backup-context-compression.sh` (new)

**Estimated Time:** 2 hours

---

### TASK-001: Execute Backup ⏳ Not Started

**Description:** Run backup script and verify integrity

**Acceptance Criteria:**
- [ ] All files backed up successfully
- [ ] Backup directory created
- [ ] MANIFEST.md generated
- [ ] restore.sh created and executable
- [ ] Verification checklist completed
- [ ] Backup committed to git

**Dependencies:** TASK-000

**Estimated Time:** 1 hour

---

### TASK-002: Create New Directory Structure ⏳ Not Started

**Description:** Create new directory structure for rewritten code

**Acceptance Criteria:**
- [ ] `packages/core/src/context/types/` created
- [ ] `packages/core/src/context/storage/` created
- [ ] `packages/core/src/context/compression/` created
- [ ] `packages/core/src/context/checkpoints/` created
- [ ] `packages/core/src/context/orchestration/` created
- [ ] `packages/core/src/context/__tests__/storage/` created
- [ ] `packages/core/src/context/__tests__/compression/` created
- [ ] `packages/core/src/context/__tests__/integration/` created

**Dependencies:** TASK-001

**Estimated Time:** 30 minutes

---

### TASK-003: Set Up Feature Flags ⏳ Not Started

**Description:** Create feature flag system for gradual rollout

**Acceptance Criteria:**
- [ ] `config/features.ts` created
- [ ] Feature flags defined
- [ ] Environment variable support
- [ ] Default to legacy system
- [ ] Documentation updated

**Files:**
- `packages/core/src/config/features.ts` (new)

**Dependencies:** TASK-002

**Estimated Time:** 1 hour

---

### TASK-004: Create Compatibility Layer ⏳ Not Started

**Description:** Create adapters for backward compatibility

**Acceptance Criteria:**
- [ ] `adapters/legacyContextAdapter.ts` created
- [ ] Session migration logic
- [ ] Snapshot migration logic
- [ ] Tests for migration

**Files:**
- `packages/core/src/adapters/legacyContextAdapter.ts` (new)

**Dependencies:** TASK-003

**Estimated Time:** 2 hours

---

**Phase 0 Total:** 6.5 hours (~1 day)

---

## Phase 1: Foundation (2-3 days)

**Goal:** Create storage layer interfaces and managers

### TASK-100: Create Storage Types ⏳ Not Started

**Description:** Define interfaces for all storage layers

**Acceptance Criteria:**
- [ ] `ActiveContext` interface defined
- [ ] `CheckpointSummary` interface defined
- [ ] `SnapshotData` interface defined
- [ ] `SessionHistory` interface defined
- [ ] `CheckpointRecord` interface defined
- [ ] `StorageBoundaries` interface defined
- [ ] Type guards implemented
- [ ] JSDoc documentation complete

**Files:**
- `packages/core/src/context/types/storageTypes.ts` (new, ~200 lines)

**Dependencies:** TASK-004

**Estimated Time:** 3 hours

---

### TASK-101: Implement Active Context Manager ⏳ Not Started

**Description:** Manage what gets sent to LLM

**Acceptance Criteria:**
- [ ] `ActiveContextManager` class created
- [ ] `buildPrompt()` method implemented
- [ ] `addMessage()` method implemented
- [ ] `addCheckpoint()` method implemented
- [ ] `removeMessages()` method implemented
- [ ] `getTokenCount()` method implemented
- [ ] `getAvailableTokens()` method implemented
- [ ] `validate()` method implemented
- [ ] Unit tests written (>80% coverage)

**Files:**
- `packages/core/src/context/storage/activeContextManager.ts` (new, ~400 lines)
- `packages/core/src/context/__tests__/storage/activeContextManager.test.ts` (new)

**Dependencies:** TASK-100

**Estimated Time:** 6 hours

---

### TASK-102: Implement Snapshot Lifecycle ⏳ Not Started

**Description:** Manage recovery snapshots

**Acceptance Criteria:**
- [ ] `SnapshotLifecycle` class created
- [ ] `createSnapshot()` method implemented
- [ ] `restoreSnapshot()` method implemented
- [ ] `listSnapshots()` method implemented
- [ ] `cleanup()` method implemented
- [ ] Integration with `SnapshotStorage`
- [ ] Unit tests written (>80% coverage)

**Files:**
- `packages/core/src/context/storage/snapshotLifecycle.ts` (new, ~500 lines)
- `packages/core/src/context/__tests__/storage/snapshotLifecycle.test.ts` (new)

**Dependencies:** TASK-100

**Estimated Time:** 6 hours

---

### TASK-103: Implement Session History Manager ⏳ Not Started

**Description:** Store full uncompressed conversation

**Acceptance Criteria:**
- [ ] `SessionHistoryManager` class created
- [ ] `appendMessage()` method implemented
- [ ] `recordCheckpoint()` method implemented
- [ ] `getHistory()` method implemented
- [ ] `save()` method implemented
- [ ] `load()` method implemented
- [ ] `exportToMarkdown()` method implemented
- [ ] Unit tests written (>80% coverage)

**Files:**
- `packages/core/src/context/storage/sessionHistoryManager.ts` (new, ~300 lines)
- `packages/core/src/context/__tests__/storage/sessionHistoryManager.test.ts` (new)

**Dependencies:** TASK-100

**Estimated Time:** 4 hours

---

### TASK-104: Implement Storage Boundaries ⏳ Not Started

**Description:** Enforce storage layer separation

**Acceptance Criteria:**
- [ ] `StorageBoundaries` class created
- [ ] Type guards implemented
- [ ] Validation methods implemented
- [ ] Enforcement methods implemented
- [ ] Runtime checks added
- [ ] Unit tests written (>80% coverage)

**Files:**
- `packages/core/src/context/storage/storageBoundaries.ts` (new, ~200 lines)
- `packages/core/src/context/__tests__/storage/storageBoundaries.test.ts` (new)

**Dependencies:** TASK-100

**Estimated Time:** 3 hours

---

**Phase 1 Total:** 22 hours (~3 days)

---

## Phase 2: Compression Engine (2-3 days)

**Goal:** Implement compression pipeline and LLM summarization

### TASK-200: Implement Summarization Service ⏳ Not Started

**Description:** LLM-based summarization

**Acceptance Criteria:**
- [ ] `SummarizationService` class created
- [ ] `summarize()` method implemented
- [ ] `buildSummarizationPrompt()` method implemented
- [ ] `validateSummary()` method implemented
- [ ] Prompts for all compression levels
- [ ] Error handling for LLM failures
- [ ] Unit tests written (>80% coverage)

**Files:**
- `packages/core/src/context/compression/summarizationService.ts` (new, ~400 lines)
- `packages/core/src/context/compression/prompts/summarizationPrompts.ts` (new)
- `packages/core/src/context/__tests__/compression/summarizationService.test.ts` (new)

**Dependencies:** TASK-104

**Estimated Time:** 6 hours

---

### TASK-201: Implement Validation Service ⏳ Not Started

**Description:** Pre-send validation

**Acceptance Criteria:**
- [ ] `ValidationService` class created
- [ ] `validatePromptSize()` method implemented
- [ ] `calculateTotalTokens()` method implemented
- [ ] `checkOllamaLimit()` method implemented
- [ ] `suggestActions()` method implemented
- [ ] Unit tests written (>80% coverage)

**Files:**
- `packages/core/src/context/compression/validationService.ts` (new, ~300 lines)
- `packages/core/src/context/__tests__/compression/validationService.test.ts` (new)

**Dependencies:** TASK-104

**Estimated Time:** 4 hours

---

### TASK-202: Implement Compression Pipeline ⏳ Not Started

**Description:** Structured compression flow

**Acceptance Criteria:**
- [ ] `CompressionPipeline` class created
- [ ] `compress()` method implemented
- [ ] `identifyMessagesToCompress()` method implemented
- [ ] `prepareForSummarization()` method implemented
- [ ] `createCheckpoint()` method implemented
- [ ] `updateActiveContext()` method implemented
- [ ] Progress reporting implemented
- [ ] Error handling at each stage
- [ ] Unit tests written (>80% coverage)

**Files:**
- `packages/core/src/context/compression/compressionPipeline.ts` (new, ~600 lines)
- `packages/core/src/context/__tests__/compression/compressionPipeline.test.ts` (new)

**Dependencies:** TASK-200, TASK-201

**Estimated Time:** 8 hours

---

### TASK-203: Implement Compression Engine ⏳ Not Started

**Description:** Core compression logic

**Acceptance Criteria:**
- [ ] `CompressionEngine` class created
- [ ] Integration with pipeline
- [ ] Strategy pattern for compression types
- [ ] Token counting integration
- [ ] Unit tests written (>80% coverage)

**Files:**
- `packages/core/src/context/compression/compressionEngine.ts` (new, ~400 lines)
- `packages/core/src/context/__tests__/compression/compressionEngine.test.ts` (new)

**Dependencies:** TASK-202

**Estimated Time:** 5 hours

---

**Phase 2 Total:** 23 hours (~3 days)

---

## Phase 3: Checkpoint Lifecycle (2-3 days)

**Goal:** Implement checkpoint aging and emergency actions

### TASK-300: Implement Checkpoint Lifecycle ⏳ Not Started

**Description:** Checkpoint aging and management

**Acceptance Criteria:**
- [ ] `CheckpointLifecycle` class created
- [ ] `ageCheckpoints()` method implemented
- [ ] `mergeCheckpoints()` method implemented
- [ ] `compressCheckpoint()` method implemented
- [ ] LLM re-summarization integrated
- [ ] Unit tests written (>80% coverage)

**Files:**
- `packages/core/src/context/checkpoints/checkpointLifecycle.ts` (new, ~500 lines)
- `packages/core/src/context/__tests__/checkpoints/checkpointLifecycle.test.ts` (new)

**Dependencies:** TASK-203

**Estimated Time:** 6 hours

---

### TASK-301: Implement Emergency Actions ⏳ Not Started

**Description:** Emergency compression handling

**Acceptance Criteria:**
- [ ] `EmergencyActions` class created
- [ ] `compressCheckpoint()` method implemented
- [ ] `mergeCheckpoints()` method implemented
- [ ] `emergencyRollover()` method implemented
- [ ] `aggressiveSummarization()` method implemented
- [ ] Snapshot creation before actions
- [ ] Unit tests written (>80% coverage)

**Files:**
- `packages/core/src/context/checkpoints/emergencyActions.ts` (new, ~400 lines)
- `packages/core/src/context/__tests__/checkpoints/emergencyActions.test.ts` (new)

**Dependencies:** TASK-300

**Estimated Time:** 5 hours

---

**Phase 3 Total:** 11 hours (~2 days)

---

## Phase 4: Orchestration (2-3 days)

**Goal:** Wire up all components and create main orchestrator

### TASK-400: Implement Context Orchestrator ⏳ Not Started

**Description:** Main coordination layer

**Acceptance Criteria:**
- [ ] `ContextOrchestrator` class created
- [ ] All subsystems integrated
- [ ] Lifecycle management implemented
- [ ] Event emission implemented
- [ ] Error handling throughout
- [ ] Unit tests written (>80% coverage)

**Files:**
- `packages/core/src/context/orchestration/contextOrchestrator.ts` (new, ~700 lines)
- `packages/core/src/context/__tests__/orchestration/contextOrchestrator.test.ts` (new)

**Dependencies:** TASK-301

**Estimated Time:** 8 hours

---

### TASK-401: Implement Feature Flag Integration ⏳ Not Started

**Description:** Wire up feature flags for gradual rollout

**Acceptance Criteria:**
- [ ] Feature flag checks in place
- [ ] Factory function for context manager
- [ ] Fallback to legacy system
- [ ] Tests for both paths

**Files:**
- `packages/core/src/context/contextManagerFactory.ts` (new)

**Dependencies:** TASK-400

**Estimated Time:** 2 hours

---

### TASK-402: Integration Testing ⏳ Not Started

**Description:** Comprehensive integration tests

**Acceptance Criteria:**
- [ ] Long conversation test (10+ checkpoints)
- [ ] Checkpoint aging test
- [ ] Emergency scenario test
- [ ] Error handling test
- [ ] Goal integration test
- [ ] All tests passing

**Files:**
- `packages/core/src/context/__tests__/integration/longConversation.test.ts` (new)
- `packages/core/src/context/__tests__/integration/checkpointAging.test.ts` (new)
- `packages/core/src/context/__tests__/integration/emergencyScenarios.test.ts` (new)
- `packages/core/src/context/__tests__/integration/errorHandling.test.ts` (new)

**Dependencies:** TASK-401

**Estimated Time:** 8 hours

---

**Phase 4 Total:** 18 hours (~3 days)

---

## Phase 5: UI & Progress (1-2 days)

**Goal:** Add compression progress UI and user feedback

### TASK-500: Implement Compression Progress UI ⏳ Not Started

**Description:** Show compression progress to user

**Acceptance Criteria:**
- [ ] `CompressionProgress` component created
- [ ] Progress indicator shown
- [ ] User input blocked during compression
- [ ] Completion message shown
- [ ] Good UX

**Files:**
- `packages/cli/src/ui/components/compression/CompressionProgress.tsx` (new)

**Dependencies:** TASK-402

**Estimated Time:** 4 hours

---

### TASK-501: Implement Goal Integration ⏳ Not Started

**Description:** Goal-aware compression

**Acceptance Criteria:**
- [ ] Goals passed to summarization
- [ ] Goal markers parsed
- [ ] Goal progress tracked
- [ ] Tests passing

**Dependencies:** TASK-500

**Estimated Time:** 3 hours

---

**Phase 5 Total:** 7 hours (~1 day)

---

## Phase 5b: System Integration (2-3 days)

**Goal:** Integrate with existing tier/mode/model/provider/goal systems

### TASK-510: Implement Tier System Integration ⏳ Not Started

**Description:** Integrate with tier-specific prompt budgets

**Acceptance Criteria:**
- [ ] `TierAwareCompression` class created
- [ ] Tier budgets respected (200-1500 tokens)
- [ ] Compression triggers account for tier
- [ ] System prompt never compressed
- [ ] Token calculations include all components
- [ ] Tests for all tiers

**Files:**
- `packages/core/src/context/integration/tierIntegration.ts` (new)
- `packages/core/src/context/__tests__/integration/tierIntegration.test.ts` (new)

**Dependencies:** TASK-501

**Estimated Time:** 4 hours

**References:**
- `dev_PromptSystem.md` - Tier token budgets
- FR-11 in requirements.md

---

### TASK-511: Implement Mode System Integration ⏳ Not Started

**Description:** Mode-aware compression strategies

**Acceptance Criteria:**
- [ ] `ModeAwareCompression` class created
- [ ] Mode-specific summarization prompts
- [ ] Developer mode preserves code
- [ ] Planning mode preserves goals
- [ ] Debugger mode preserves errors
- [ ] Tests for all modes

**Files:**
- `packages/core/src/context/integration/modeIntegration.ts` (new)
- `packages/core/src/context/__tests__/integration/modeIntegration.test.ts` (new)

**Dependencies:** TASK-510

**Estimated Time:** 4 hours

**References:**
- `dev_PromptSystem.md` - Operational modes
- FR-12 in requirements.md

---

### TASK-512: Implement Model Management Integration ⏳ Not Started

**Description:** Model size affects compression quality

**Acceptance Criteria:**
- [ ] `ModelAwareCompression` class created
- [ ] Model size detection working
- [ ] Reliability calculation integrated
- [ ] Warning thresholds based on model
- [ ] Tests for different model sizes

**Files:**
- `packages/core/src/context/integration/modelIntegration.ts` (new)
- `packages/core/src/context/__tests__/integration/modelIntegration.test.ts` (new)

**Dependencies:** TASK-511

**Estimated Time:** 3 hours

**References:**
- `dev_ModelManagement.md` - Model size detection
- FR-13 in requirements.md

---

### TASK-513: Implement Provider System Integration ⏳ Not Started

**Description:** Use provider-specific context limits

**Acceptance Criteria:**
- [ ] `ProviderAwareCompression` class created
- [ ] Provider limits read from profiles
- [ ] 85% values used correctly
- [ ] Compression triggers respect provider
- [ ] Provider errors handled
- [ ] Tests for provider integration

**Files:**
- `packages/core/src/context/integration/providerIntegration.ts` (new)
- `packages/core/src/context/__tests__/integration/providerIntegration.test.ts` (new)

**Dependencies:** TASK-512

**Estimated Time:** 4 hours

**References:**
- `dev_ProviderSystem.md` - Provider integration
- FR-14 in requirements.md

---

### TASK-514: Implement Goal System Integration ⏳ Not Started

**Description:** Deep integration with goal management

**Acceptance Criteria:**
- [ ] `GoalAwareCompression` class created
- [ ] Goals never compressed
- [ ] Goal-aware summarization working
- [ ] Goal markers parsed correctly
- [ ] Goal progress tracked
- [ ] Tests for goal integration

**Files:**
- `packages/core/src/context/integration/goalIntegration.ts` (new)
- `packages/core/src/context/__tests__/integration/goalIntegration.test.ts` (new)

**Dependencies:** TASK-513

**Estimated Time:** 5 hours

**References:**
- `dev_PromptSystem.md` - Goal management system
- FR-15 in requirements.md

---

### TASK-515: Implement Prompt Orchestrator Integration ⏳ Not Started

**Description:** System prompt built by PromptOrchestrator

**Acceptance Criteria:**
- [ ] `PromptOrchestratorIntegration` class created
- [ ] System prompt from orchestrator
- [ ] Compression respects prompt structure
- [ ] Checkpoints integrated into prompt
- [ ] Skills/tools/hooks preserved
- [ ] Tests for orchestrator integration

**Files:**
- `packages/core/src/context/integration/promptOrchestratorIntegration.ts` (new)
- `packages/core/src/context/__tests__/integration/promptOrchestratorIntegration.test.ts` (new)

**Dependencies:** TASK-514

**Estimated Time:** 4 hours

**References:**
- `dev_PromptSystem.md` - PromptOrchestrator
- FR-16 in requirements.md

---

### TASK-516: Wire Up All Integrations ⏳ Not Started

**Description:** Connect all integration components to main system

**Acceptance Criteria:**
- [ ] All integrations wired to `ContextOrchestrator`
- [ ] Integration tests passing
- [ ] End-to-end tests with all systems
- [ ] Documentation updated
- [ ] No regressions

**Files:**
- `packages/core/src/context/orchestration/contextOrchestrator.ts` (update)

**Dependencies:** TASK-515

**Estimated Time:** 4 hours

---

**Phase 5b Total:** 28 hours (~4 days)

---

## Phase 6: Migration & Documentation (1-2 days)

**Goal:** Migrate existing data and update documentation

### TASK-600: Create Migration Scripts ⏳ Not Started

**Description:** Migrate existing sessions and snapshots

**Acceptance Criteria:**
- [ ] Session migration script created
- [ ] Snapshot migration script created
- [ ] Tests for migration
- [ ] Dry-run mode
- [ ] Rollback capability

**Files:**
- `scripts/migrate-sessions.ts` (new)
- `scripts/migrate-snapshots.ts` (new)

**Dependencies:** TASK-501

**Estimated Time:** 4 hours

---

### TASK-601: Update Documentation ⏳ Not Started

**Description:** Update all documentation

**Acceptance Criteria:**
- [ ] `dev_ContextCompression.md` updated
- [ ] `dev_ContextManagement.md` updated
- [ ] `dev_ContextSnapshots.md` updated
- [ ] Architecture diagrams updated
- [ ] API documentation updated

**Files:**
- `.dev/docs/knowledgeDB/dev_ContextCompression.md` (update)
- `.dev/docs/knowledgeDB/dev_ContextManagement.md` (update)
- `.dev/docs/knowledgeDB/dev_ContextSnapshots.md` (update)

**Dependencies:** TASK-600

**Estimated Time:** 3 hours

---

### TASK-602: Create Release Notes ⏳ Not Started

**Description:** Document changes for users

**Acceptance Criteria:**
- [ ] Release notes created
- [ ] Breaking changes documented
- [ ] Migration guide created
- [ ] Known issues documented

**Files:**
- `CHANGELOG.md` (update)
- `docs/migration/context-compression-v2.md` (new)

**Dependencies:** TASK-601

**Estimated Time:** 2 hours

---

### TASK-603: Enable New System by Default ⏳ Not Started

**Description:** Switch to new system

**Acceptance Criteria:**
- [ ] Feature flag default changed
- [ ] Legacy code moved to `.legacy/`
- [ ] Old imports removed
- [ ] Tests passing
- [ ] Documentation updated

**Dependencies:** TASK-602

**Estimated Time:** 2 hours

---

**Phase 6 Total:** 11 hours (~2 days)

---

## Summary

### By Phase

| Phase | Tasks | Estimated Time | Status |
|-------|-------|----------------|--------|
| Phase 0: Backup | 5 | 6.5 hours (~1 day) | ⏳ Not Started |
| Phase 1: Foundation | 5 | 22 hours (~3 days) | ⏳ Not Started |
| Phase 2: Compression | 4 | 23 hours (~3 days) | ⏳ Not Started |
| Phase 3: Lifecycle | 2 | 11 hours (~2 days) | ⏳ Not Started |
| Phase 4: Orchestration | 3 | 18 hours (~3 days) | ⏳ Not Started |
| Phase 5: UI | 2 | 7 hours (~1 day) | ⏳ Not Started |
| Phase 5b: System Integration | 7 | 28 hours (~4 days) | ⏳ Not Started |
| Phase 6: Migration | 4 | 11 hours (~2 days) | ⏳ Not Started |
| **Total** | **32** | **126.5 hours (~19 days)** | **⏳ Not Started** |

### By Priority

| Priority | Tasks | Estimated Time |
|----------|-------|----------------|
| P0 (Critical) | 24 | 98 hours |
| P1 (High) | 8 | 28.5 hours |
| **Total** | **32** | **126.5 hours** |

---

## Progress Tracking

**Started:** Not yet  
**Current Phase:** Phase 0  
**Current Task:** TASK-000  
**Completion:** 0% (0/32 tasks)

---

## Notes

- All legacy code will be backed up before any changes
- New code will use new file names to avoid confusion
- Feature flags will allow gradual rollout
- Comprehensive testing at each phase
- Documentation updated throughout
- **CRITICAL:** System integration with tier/mode/model/provider/goal systems is essential
- Integration tasks added in Phase 5b to ensure compatibility with existing systems

---

**Status:** Ready to Begin  
**Next Step:** TASK-000 (Create Backup Script)
