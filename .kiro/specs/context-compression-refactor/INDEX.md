# Context Compression Refactor - Document Index

**Status:** ✅ Specification Complete  
**Created:** January 28, 2026  
**Total Documents:** 6  
**Total Size:** ~110 KB

---

## Quick Navigation

### 🚀 Getting Started

**Start Here:** [QUICKSTART.md](./QUICKSTART.md)  
**Time:** 5 minutes to read, 15 minutes to start  
**For:** Developers implementing the refactor

### 📋 Overview

**Read Next:** [README.md](./README.md)  
**Time:** 10 minutes  
**For:** Everyone - high-level overview

---

## Core Documents

### 1. Requirements ([requirements.md](./requirements.md))

**Size:** 37 KB  
**Time to Read:** 30 minutes  
**Purpose:** What we're building and why

**Contents:**
- Executive summary
- 8 user stories with acceptance criteria
- 10 functional requirements (FR-1 through FR-10)
- 4 non-functional requirements (NFR-1 through NFR-4)
- Rewrite strategy with backup plan
- Risk analysis and mitigation
- Success metrics
- Timeline (5 phases, 2-3 weeks)

**Key Sections:**
- Rewrite Strategy (page 1)
- Functional Requirements (page 2-5)
- User Stories (page 6-8)
- Success Criteria (page 9)

**When to Read:**
- Before starting implementation
- When clarifying requirements
- When making design decisions

---

### 2. Design ([design.md](./design.md))

**Size:** 20 KB  
**Time to Read:** 30 minutes  
**Purpose:** How we're building it

**Contents:**
- Architecture principles
- Component designs (11 new components)
- Implementation plan (6 phases)
- Testing strategy
- Code examples and interfaces

**Key Components:**
1. Storage Types (interfaces)
2. Active Context Manager (LLM-bound)
3. Snapshot Lifecycle (recovery)
4. Session History Manager (full history)
5. Compression Pipeline (6 stages)
6. Summarization Service (LLM integration)
7. Validation Service (pre-send checks)
8. Checkpoint Lifecycle (aging)
9. Emergency Actions (critical situations)
10. Context Orchestrator (main coordinator)
11. Storage Boundaries (enforcement)

**When to Read:**
- Before implementing each component
- When understanding architecture
- When writing tests

---

### 3. Tasks ([tasks.md](./tasks.md))

**Size:** 17 KB  
**Time to Read:** 20 minutes  
**Purpose:** What needs to be done

**Contents:**
- 25 tasks across 6 phases
- Dependencies mapped
- Acceptance criteria for each task
- Time estimates
- Progress tracking

**Phases:**
- Phase 0: Backup & Setup (5 tasks, 1 day)
- Phase 1: Foundation (5 tasks, 3 days)
- Phase 2: Compression Engine (4 tasks, 3 days)
- Phase 3: Checkpoint Lifecycle (2 tasks, 2 days)
- Phase 4: Orchestration (3 tasks, 3 days)
- Phase 5: UI & Progress (2 tasks, 1 day)
- Phase 6: Migration & Documentation (4 tasks, 2 days)

**When to Read:**
- Daily - to pick next task
- When planning work
- When tracking progress

---

## Supporting Documents

### 4. Backup Guide ([BACKUP_GUIDE.md](./BACKUP_GUIDE.md))

**Size:** 12.6 KB  
**Time to Read:** 10 minutes  
**Purpose:** How to backup legacy code

**Contents:**
- Step-by-step backup process
- Full backup script (copy-paste ready)
- Verification steps
- Restoration process
- Troubleshooting

**When to Read:**
- Before starting Phase 0
- When executing backup
- When verifying backup
- When restoring legacy code

---

### 5. Quick Start ([QUICKSTART.md](./QUICKSTART.md))

**Size:** 11 KB  
**Time to Read:** 5 minutes  
**Purpose:** Get started quickly

**Contents:**
- TL;DR summary
- Before you start checklist
- Getting started steps
- Development workflow
- Common pitfalls
- Success checklist

**When to Read:**
- First thing - before anything else
- When onboarding new developers
- When stuck or confused

---

### 6. README ([README.md](./README.md))

**Size:** 11.7 KB  
**Time to Read:** 10 minutes  
**Purpose:** Overview and quick reference

**Contents:**
- Problem statement
- Solution overview
- Architecture diagrams
- Timeline
- Success criteria
- References

**When to Read:**
- After QUICKSTART.md
- When explaining to others
- When reviewing progress

---

## Reading Order

### For Implementers

1. **QUICKSTART.md** (5 min) - Get oriented
2. **README.md** (10 min) - Understand overview
3. **requirements.md** (30 min) - Understand what to build
4. **design.md** (30 min) - Understand how to build it
5. **tasks.md** (20 min) - Understand what to do
6. **BACKUP_GUIDE.md** (10 min) - Execute backup

**Total Time:** ~2 hours

### For Reviewers

1. **README.md** (10 min) - Overview
2. **requirements.md** (30 min) - Review requirements
3. **design.md** (30 min) - Review design
4. **tasks.md** (20 min) - Review task breakdown

**Total Time:** ~1.5 hours

### For Stakeholders

1. **README.md** (10 min) - Overview
2. **requirements.md** - User Stories section (10 min)
3. **requirements.md** - Success Metrics section (5 min)

**Total Time:** ~25 minutes

---

## Document Relationships

```
QUICKSTART.md
    ↓ (start here)
README.md
    ↓ (overview)
requirements.md ←→ design.md
    ↓ (what)         ↓ (how)
tasks.md
    ↓ (breakdown)
BACKUP_GUIDE.md
    ↓ (execute)
Implementation
```

---

## Key Concepts

### Storage Layers (3 layers)

Defined in: requirements.md (FR-1), design.md (Component 1-4)

1. **Active Context** - What goes to LLM (compressed, in memory)
2. **Snapshots** - Recovery/rollback (on disk, never sent to LLM)
3. **Session History** - Full conversation (on disk, never sent to LLM)

### Compression Pipeline (6 stages)

Defined in: requirements.md (FR-5), design.md (Component 5)

1. Identification → 2. Preparation → 3. Summarization
4. Checkpoint Creation → 5. Context Update → 6. Validation

### Checkpoint Aging (4 levels)

Defined in: requirements.md (FR-4), design.md (Component 8)

Level 3 (Detailed) → Level 2 (Moderate) → Level 1 (Compact) → Merged (Ultra-compact)

---

## Files to Create

### New Files (11 files, ~4,500 lines)

Location: `packages/core/src/context/`

```
types/
  └── storageTypes.ts (200 lines)

storage/
  ├── activeContextManager.ts (400 lines)
  ├── snapshotLifecycle.ts (500 lines)
  ├── sessionHistoryManager.ts (300 lines)
  └── storageBoundaries.ts (200 lines)

compression/
  ├── compressionPipeline.ts (600 lines)
  ├── compressionEngine.ts (400 lines)
  ├── summarizationService.ts (400 lines)
  └── validationService.ts (300 lines)

checkpoints/
  ├── checkpointLifecycle.ts (500 lines)
  └── emergencyActions.ts (400 lines)

orchestration/
  └── contextOrchestrator.ts (700 lines)
```

### Files to Backup (6 files, ~4,000 lines)

Location: `packages/core/src/context/` → `.legacy/context-compression/YYYY-MM-DD/`

```
compressionService.ts (920 lines)
compressionCoordinator.ts (830 lines)
chatCompressionService.ts (559 lines)
checkpointManager.ts (~400 lines)
snapshotManager.ts (615 lines)
contextManager.ts (639 lines)
```

---

## Timeline

**Phase 0:** Backup & Setup (1 day)  
**Phase 1:** Foundation (3 days)  
**Phase 2:** Compression Engine (3 days)  
**Phase 3:** Checkpoint Lifecycle (2 days)  
**Phase 4:** Orchestration (3 days)  
**Phase 5:** UI & Progress (1 day)  
**Phase 6:** Migration & Documentation (2 days)

**Total:** 15 days (2-3 weeks)

---

## Success Criteria

### Must Have (P0)

- [ ] System supports 10+ checkpoints without crashes
- [ ] LLM creates semantic summaries
- [ ] Pre-send validation prevents overflow
- [ ] Checkpoints age progressively
- [ ] Error handling prevents crashes
- [ ] Full history preserved on disk
- [ ] Tests pass (>80% coverage)

### Should Have (P1)

- [ ] Goal-aware compression
- [ ] User message management
- [ ] Compression progress UI
- [ ] Documentation updated
- [ ] Migration scripts work

---

## References

### Internal Documents

- [Audit Findings](../../../.dev/backlog/28-01-2026-ContextCompressionAudit/AUDIT_FINDINGS.md)
- [Context Compression](../../../.dev/docs/knowledgeDB/dev_ContextCompression.md)
- [Context Management](../../../.dev/docs/knowledgeDB/dev_ContextManagement.md)
- [Context Snapshots](../../../.dev/docs/knowledgeDB/dev_ContextSnapshots.md)

### External References

- TypeScript Documentation
- React Documentation
- Vitest Documentation
- Ollama API Documentation

---

## FAQ

### Q: Why a complete rewrite?

**A:** The current implementation has fundamental architectural flaws that can't be fixed with incremental changes. A clean rewrite ensures we don't carry forward broken patterns.

### Q: What happens to existing sessions?

**A:** Migration scripts will convert existing sessions to the new format. Full conversation history is preserved.

### Q: Can we roll back if needed?

**A:** Yes. All legacy code is backed up and can be restored using the restoration script.

### Q: How long will this take?

**A:** Estimated 2-3 weeks (15 days) for full implementation and testing.

### Q: What if we find issues during implementation?

**A:** Feature flags allow us to switch between old and new systems. We can roll back at any time.

---

## Status

**Specification:** ✅ Complete  
**Implementation:** ⏳ Not Started  
**Testing:** ⏳ Not Started  
**Documentation:** ⏳ Not Started  
**Deployment:** ⏳ Not Started

---

## Next Steps

1. ✅ Read QUICKSTART.md
2. ✅ Read README.md
3. ✅ Read requirements.md
4. ✅ Read design.md
5. ✅ Read tasks.md
6. ⏳ Execute backup (BACKUP_GUIDE.md)
7. ⏳ Start TASK-002 (Create new directory structure)

---

**Last Updated:** January 28, 2026  
**Status:** Ready for Implementation  
**Priority:** 🔴 CRITICAL
