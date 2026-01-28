# Context Compression System Refactor

**Status:** 🔴 CRITICAL - Ready for Implementation  
**Created:** January 28, 2026  
**Priority:** P0

---

## Overview

Complete rewrite of the context compression system to fix critical architectural flaws causing crashes after 3-4 checkpoints. This is a **clean slate rewrite** - all legacy code will be backed up and replaced with new implementations.

---

## Problem Statement

The current context compression system has fundamental design flaws:

1. ❌ **No LLM Summarization** - Uses truncation instead of semantic summaries
2. ❌ **Storage Layer Confusion** - Snapshots mixed with active context
3. ❌ **Missing Validation** - No pre-send checks before sending to Ollama
4. ❌ **Checkpoint Accumulation** - Old checkpoints don't compress further
5. ❌ **Unbounded User Messages** - User messages never compress
6. ❌ **Poor Error Handling** - System crashes instead of degrading gracefully

**Impact:** System crashes after 3-4 checkpoints, making long conversations impossible.

---

## Solution

Rebuild the compression system from scratch with:

1. ✅ **Real LLM Summarization** - LLM creates semantic summaries
2. ✅ **Clear Storage Layers** - Active context, snapshots, session history separated
3. ✅ **Pre-Send Validation** - Hard stop before sending oversized prompts
4. ✅ **Checkpoint Aging** - Progressive compression of old checkpoints
5. ✅ **User Message Management** - Bounded growth with summarization
6. ✅ **Comprehensive Error Handling** - Graceful degradation

---

## Documents

### 1. Requirements ([requirements.md](./requirements.md))

Comprehensive requirements document covering:
- 8 user stories with acceptance criteria
- 10 functional requirements
- 4 non-functional requirements
- Risk analysis and mitigation
- Success metrics
- **Rewrite strategy** with backup plan

**Key Sections:**
- Rewrite Strategy (backup and new file structure)
- Functional Requirements (FR-1 through FR-10)
- User Stories (US-1 through US-8)
- Timeline (5 phases, 2-3 weeks)

### 2. Design ([design.md](./design.md))

Technical design document covering:
- Architecture principles
- Component designs (11 new components)
- Implementation plan
- Testing strategy

**Key Components:**
- Storage Types (interfaces)
- Active Context Manager (LLM-bound)
- Snapshot Lifecycle (recovery)
- Session History Manager (full history)
- Compression Pipeline (6 stages)
- Summarization Service (LLM integration)
- Validation Service (pre-send checks)
- Checkpoint Lifecycle (aging)
- Emergency Actions (critical situations)
- Context Orchestrator (main coordinator)
- Storage Boundaries (enforcement)

### 3. Tasks ([tasks.md](./tasks.md))

Detailed task breakdown covering:
- 25 tasks across 6 phases
- Estimated time: ~15 days
- Dependencies mapped
- Acceptance criteria for each task

**Phases:**
- Phase 0: Backup & Setup (1 day)
- Phase 1: Foundation (3 days)
- Phase 2: Compression Engine (3 days)
- Phase 3: Checkpoint Lifecycle (2 days)
- Phase 4: Orchestration (3 days)
- Phase 5: UI & Progress (1 day)
- Phase 6: Migration & Documentation (2 days)

---

## Rewrite Strategy

### Backup First

All legacy code will be backed up to `.legacy/context-compression/YYYY-MM-DD/` before any changes:

**Files to Backup:**
- `compressionService.ts` (920 lines)
- `compressionCoordinator.ts` (830 lines)
- `chatCompressionService.ts` (559 lines)
- `checkpointManager.ts` (~400 lines)
- `snapshotManager.ts` (615 lines)
- `contextManager.ts` (639 lines)

**Total Legacy Code:** ~4,000 lines

### New Files

All new implementations with new names:

**New Files:**
- `storageTypes.ts` (200 lines)
- `activeContextManager.ts` (400 lines)
- `snapshotLifecycle.ts` (500 lines)
- `sessionHistoryManager.ts` (300 lines)
- `compressionPipeline.ts` (600 lines)
- `summarizationService.ts` (400 lines)
- `validationService.ts` (300 lines)
- `checkpointLifecycle.ts` (500 lines)
- `emergencyActions.ts` (400 lines)
- `contextOrchestrator.ts` (700 lines)
- `storageBoundaries.ts` (200 lines)

**Total New Code:** ~4,500 lines

### Feature Flags

Gradual rollout with feature flags:

```typescript
// Enable new system
OLLM_NEW_COMPRESSION=true

// Enable new context manager
OLLM_NEW_CONTEXT=true

// Enable new checkpoints
OLLM_NEW_CHECKPOINTS=true
```

### Migration

Compatibility layer for existing sessions:
- Session migration scripts
- Snapshot migration scripts
- Backward compatibility adapters
- Rollback capability

---

## Architecture

### Storage Layers (3 layers)

```
┌─────────────────────────────────────────────────────────────┐
│ Active Context (Memory)                                     │
│ - System prompt                                             │
│ - Checkpoint summaries (LLM-generated)                      │
│ - Recent messages                                           │
│ - Sent to LLM                                               │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ Snapshots (Disk)                                            │
│ - Full conversation state                                   │
│ - For recovery/rollback                                     │
│ - NEVER sent to LLM                                         │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ Session History (Disk)                                      │
│ - Complete uncompressed conversation                        │
│ - For analysis/export                                       │
│ - NEVER sent to LLM                                         │
└─────────────────────────────────────────────────────────────┘
```

### Compression Pipeline (6 stages)

```
1. Identification
   ↓
2. Preparation
   ↓
3. Summarization (LLM)
   ↓
4. Checkpoint Creation
   ↓
5. Context Update
   ↓
6. Validation
```

### Checkpoint Aging (4 levels)

```
Level 3 (Detailed)    → 2000 tokens
   ↓ (age)
Level 2 (Moderate)    → 1200 tokens
   ↓ (age)
Level 1 (Compact)     → 800 tokens
   ↓ (age)
Merged (Ultra-compact) → 400 tokens
```

---

## Timeline

### Phase 0: Backup & Setup (1 day)
- Create backup script
- Execute backup
- Create new directory structure
- Set up feature flags
- Create compatibility layer

### Phase 1: Foundation (3 days)
- Create storage types
- Implement active context manager
- Implement snapshot lifecycle
- Implement session history manager
- Implement storage boundaries

### Phase 2: Compression Engine (3 days)
- Implement summarization service
- Implement validation service
- Implement compression pipeline
- Implement compression engine

### Phase 3: Checkpoint Lifecycle (2 days)
- Implement checkpoint lifecycle
- Implement emergency actions

### Phase 4: Orchestration (3 days)
- Implement context orchestrator
- Implement feature flag integration
- Integration testing

### Phase 5: UI & Progress (1 day)
- Implement compression progress UI
- Implement goal integration

### Phase 6: Migration & Documentation (2 days)
- Create migration scripts
- Update documentation
- Create release notes
- Enable new system by default

**Total Estimated Time:** 15 days (2-3 weeks)

---

## Success Criteria

### System-Level

- [ ] System supports 10+ checkpoints without crashes
- [ ] LLM creates semantic summaries
- [ ] Pre-send validation prevents overflow
- [ ] Checkpoints age progressively
- [ ] Error handling prevents crashes
- [ ] Full history preserved on disk
- [ ] Tests pass (>80% coverage)
- [ ] Documentation updated
- [ ] Migration scripts work
- [ ] User feedback positive

### Phase-Level

- [ ] Phase 0: All legacy files backed up
- [ ] Phase 1: Storage layers separated
- [ ] Phase 2: LLM summarization working
- [ ] Phase 3: Checkpoint aging working
- [ ] Phase 4: Integration complete
- [ ] Phase 5: UI complete
- [ ] Phase 6: Documentation and release ready

---

## Testing Strategy

### Unit Tests
- Test each component in isolation
- Mock dependencies
- Test error cases
- Property-based tests for compression

### Integration Tests
- Test full compression pipeline
- Test long conversations (10+ checkpoints)
- Test checkpoint aging
- Test error recovery

### Performance Tests
- Compression time < 5 seconds
- Validation time < 100ms
- Memory usage reasonable

**Target Coverage:** >80%

---

## Risk Mitigation

### Risk: Rewrite takes longer than expected

**Mitigation:**
- Clear requirements and design
- Incremental development
- Feature flags for gradual rollout
- Keep legacy code as fallback

### Risk: Breaking changes for users

**Mitigation:**
- Compatibility layer for old sessions
- Migration scripts
- Thorough testing
- Gradual rollout with feature flags

### Risk: Missing edge cases from legacy code

**Mitigation:**
- Review legacy code for edge cases
- Document known issues
- Comprehensive test suite
- User feedback during beta

---

## Getting Started

### For Implementers

1. Read [requirements.md](./requirements.md) - Understand what we're building
2. Read [design.md](./design.md) - Understand how we're building it
3. Read [tasks.md](./tasks.md) - See what needs to be done
4. Start with TASK-000 (Create Backup Script)

### For Reviewers

1. Review requirements for completeness
2. Review design for soundness
3. Review tasks for feasibility
4. Provide feedback before implementation starts

### For Users

1. This is a critical fix for crashes after 3-4 checkpoints
2. Your existing sessions will be migrated automatically
3. Full conversation history will be preserved
4. Long conversations (10+ checkpoints) will work
5. No action required on your part

---

## References

### Internal Documents

- [Audit Findings](../../../.dev/backlog/28-01-2026-ContextCompressionAudit/AUDIT_FINDINGS.md)
- [Context Compression](../../../.dev/docs/knowledgeDB/dev_ContextCompression.md)
- [Context Management](../../../.dev/docs/knowledgeDB/dev_ContextManagement.md)
- [Context Snapshots](../../../.dev/docs/knowledgeDB/dev_ContextSnapshots.md)

### Related Issues

- System crashes after 3-4 checkpoints
- Context overflow not prevented
- LLM not involved in compression
- Snapshots mixed with active context

---

## Questions?

For questions or clarifications:
1. Review the requirements document
2. Review the design document
3. Check the task breakdown
4. Consult the audit findings

---

**Status:** Ready for Implementation  
**Next Step:** Begin Phase 0 (TASK-000: Create Backup Script)  
**Estimated Completion:** 2-3 weeks from start
