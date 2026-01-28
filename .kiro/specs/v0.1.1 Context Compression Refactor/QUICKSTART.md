# Context Compression Refactor - Quick Start

**For:** Developers implementing the refactor  
**Time to Read:** 5 minutes  
**Time to Start:** 15 minutes

---

## TL;DR

We're completely rewriting the context compression system because it crashes after 3-4 checkpoints. All legacy code will be backed up first, then replaced with new implementations.

**What you need to know:**
1. This is a **clean slate rewrite** - no legacy code reuse
2. All old files will be **backed up** to `.legacy/`
3. New files will have **new names** to avoid confusion
4. We'll use **feature flags** for gradual rollout
5. Estimated time: **2-3 weeks**

---

## Before You Start

### 1. Read These Documents (30 minutes)

**Must Read:**
- [README.md](./README.md) - Overview and architecture (10 min)
- [requirements.md](./requirements.md) - What we're building (10 min)
- [design.md](./design.md) - How we're building it (10 min)

**Optional:**
- [tasks.md](./tasks.md) - Detailed task breakdown
- [BACKUP_GUIDE.md](./BACKUP_GUIDE.md) - Backup process details

### 2. Understand the Problem (5 minutes)

**Current Issues:**
- ❌ System crashes after 3-4 checkpoints
- ❌ No LLM summarization (just truncation)
- ❌ Snapshots mixed with active context
- ❌ No pre-send validation
- ❌ Checkpoints don't age
- ❌ User messages accumulate unbounded

**Root Cause:**
The implementation doesn't match the documentation. We have a well-designed system on paper, but the code does something completely different.

### 3. Understand the Solution (5 minutes)

**New Architecture:**
- ✅ Three separate storage layers (active, snapshots, history)
- ✅ Real LLM summarization (semantic, not truncation)
- ✅ Pre-send validation (hard stop before overflow)
- ✅ Checkpoint aging (progressive compression)
- ✅ Bounded user messages (summarize old ones)
- ✅ Comprehensive error handling

---

## Getting Started

### Step 1: Set Up Your Environment (5 minutes)

```bash
# 1. Pull latest code
git checkout main
git pull origin main

# 2. Install dependencies
npm install

# 3. Run tests (should pass)
npm test

# 4. Build project
npm run build

# 5. Create feature branch
git checkout -b feature/context-compression-refactor
```

### Step 2: Run Backup (10 minutes)

```bash
# 1. Create backup script
cat > scripts/backup-context-compression.sh << 'EOF'
# ... (see BACKUP_GUIDE.md for full script)
EOF

# 2. Make executable
chmod +x scripts/backup-context-compression.sh

# 3. Run backup
./scripts/backup-context-compression.sh

# 4. Verify backup
ls -lah .legacy/context-compression/$(date +%Y-%m-%d-*)

# 5. Commit backup
git add .legacy/
git commit -m "backup: Context compression system before rewrite"
```

**Expected Output:**
```
✅ Backup complete!
   Core files: 5
   Service files: 1
   Test files: 3
```

### Step 3: Start Implementation (varies)

Follow the task breakdown in [tasks.md](./tasks.md):

**Phase 0: Backup & Setup** (1 day)
- ✅ TASK-000: Create backup script (done above)
- ✅ TASK-001: Execute backup (done above)
- ⏳ TASK-002: Create new directory structure
- ⏳ TASK-003: Set up feature flags
- ⏳ TASK-004: Create compatibility layer

**Phase 1: Foundation** (3 days)
- ⏳ TASK-100: Create storage types
- ⏳ TASK-101: Implement active context manager
- ⏳ TASK-102: Implement snapshot lifecycle
- ⏳ TASK-103: Implement session history manager
- ⏳ TASK-104: Implement storage boundaries

... (see tasks.md for full breakdown)

---

## Development Workflow

### Daily Workflow

```bash
# 1. Start of day - pull latest
git pull origin feature/context-compression-refactor

# 2. Pick next task from tasks.md
# Example: TASK-100 (Create storage types)

# 3. Create file
touch packages/core/src/context/types/storageTypes.ts

# 4. Implement (see design.md for details)
# ... write code ...

# 5. Write tests
touch packages/core/src/context/__tests__/types/storageTypes.test.ts
# ... write tests ...

# 6. Run tests
npm test -- storageTypes.test.ts

# 7. Commit when task complete
git add .
git commit -m "feat: implement storage types (TASK-100)

- Created ActiveContext interface
- Created CheckpointSummary interface
- Created SnapshotData interface
- Created SessionHistory interface
- Added type guards
- Tests passing (>80% coverage)

Closes TASK-100"

# 8. Push to remote
git push origin feature/context-compression-refactor

# 9. Update tasks.md
# Mark TASK-100 as ✅ Complete
```

### Testing Workflow

```bash
# Run specific test
npm test -- storageTypes.test.ts

# Run all tests
npm test

# Run tests with coverage
npm test -- --coverage

# Run tests in watch mode
npm test -- --watch
```

### Code Review Workflow

```bash
# 1. Create PR after completing a phase
# Example: After Phase 1 (Foundation)

# 2. Request review from team

# 3. Address feedback

# 4. Merge when approved
git checkout main
git merge feature/context-compression-refactor
git push origin main
```

---

## Key Files to Know

### Legacy Files (Don't Modify!)

These will be backed up and eventually deleted:

```
packages/core/src/context/
├── compressionService.ts          # OLD - will be deleted
├── compressionCoordinator.ts      # OLD - will be deleted
├── checkpointManager.ts           # OLD - will be deleted
├── snapshotManager.ts             # OLD - will be deleted
└── contextManager.ts              # OLD - will be deleted
```

### New Files (Create These!)

```
packages/core/src/context/
├── types/
│   └── storageTypes.ts            # NEW - Phase 1
├── storage/
│   ├── activeContextManager.ts    # NEW - Phase 1
│   ├── snapshotLifecycle.ts       # NEW - Phase 1
│   ├── sessionHistoryManager.ts   # NEW - Phase 1
│   └── storageBoundaries.ts       # NEW - Phase 1
├── compression/
│   ├── compressionPipeline.ts     # NEW - Phase 2
│   ├── compressionEngine.ts       # NEW - Phase 2
│   ├── summarizationService.ts    # NEW - Phase 2
│   └── validationService.ts       # NEW - Phase 2
├── checkpoints/
│   ├── checkpointLifecycle.ts     # NEW - Phase 3
│   └── emergencyActions.ts        # NEW - Phase 3
└── orchestration/
    └── contextOrchestrator.ts     # NEW - Phase 4
```

---

## Common Pitfalls

### ❌ Don't: Modify legacy files

```typescript
// DON'T DO THIS
// packages/core/src/context/compressionService.ts
export class CompressionService {
  // Adding new method to legacy file
  async summarizeWithLLM() { ... }  // ❌ Wrong!
}
```

**Why:** We're doing a clean rewrite. Modifying legacy files defeats the purpose.

### ✅ Do: Create new files

```typescript
// DO THIS
// packages/core/src/context/compression/summarizationService.ts
export class SummarizationService {
  async summarize() { ... }  // ✅ Correct!
}
```

### ❌ Don't: Import from legacy files

```typescript
// DON'T DO THIS
import { CompressionService } from '../compressionService.js';  // ❌ Wrong!
```

**Why:** New code should not depend on legacy code.

### ✅ Do: Import from new files

```typescript
// DO THIS
import { SummarizationService } from './summarizationService.js';  // ✅ Correct!
```

### ❌ Don't: Skip tests

```typescript
// DON'T DO THIS
// Implement feature without tests  // ❌ Wrong!
```

**Why:** We need >80% test coverage to ensure quality.

### ✅ Do: Write tests alongside code

```typescript
// DO THIS
// 1. Write interface
// 2. Write tests
// 3. Implement
// 4. Verify tests pass  // ✅ Correct!
```

---

## Getting Help

### Questions About Requirements?

- Read [requirements.md](./requirements.md)
- Check user stories (US-1 through US-8)
- Check functional requirements (FR-1 through FR-10)

### Questions About Design?

- Read [design.md](./design.md)
- Check component designs
- Check architecture diagrams

### Questions About Tasks?

- Read [tasks.md](./tasks.md)
- Check task dependencies
- Check acceptance criteria

### Questions About Backup?

- Read [BACKUP_GUIDE.md](./BACKUP_GUIDE.md)
- Check verification steps
- Check restoration process

### Still Stuck?

1. Review the audit findings: `.dev/backlog/28-01-2026-ContextCompressionAudit/AUDIT_FINDINGS.md`
2. Review the documentation: `.dev/docs/knowledgeDB/dev_ContextCompression.md`
3. Ask the team

---

## Success Checklist

Before considering the refactor complete:

### Code Quality
- [ ] All new files created
- [ ] All legacy files backed up
- [ ] No imports from legacy files
- [ ] All tests passing (>80% coverage)
- [ ] No TypeScript errors
- [ ] No ESLint errors

### Functionality
- [ ] Long conversations work (10+ checkpoints)
- [ ] LLM summarization working
- [ ] Pre-send validation working
- [ ] Checkpoint aging working
- [ ] Error handling working
- [ ] No crashes

### Documentation
- [ ] All documentation updated
- [ ] API documentation complete
- [ ] Migration guide created
- [ ] Release notes written

### Testing
- [ ] Unit tests passing
- [ ] Integration tests passing
- [ ] Performance tests passing
- [ ] Long conversation tests passing

### Deployment
- [ ] Feature flags working
- [ ] Migration scripts working
- [ ] Backward compatibility verified
- [ ] Rollback plan tested

---

## Timeline Expectations

**Phase 0: Backup & Setup** - 1 day
- You should complete this in your first day

**Phase 1: Foundation** - 3 days
- Storage types: 3 hours
- Active context manager: 6 hours
- Snapshot lifecycle: 6 hours
- Session history manager: 4 hours
- Storage boundaries: 3 hours

**Phase 2: Compression Engine** - 3 days
- Summarization service: 6 hours
- Validation service: 4 hours
- Compression pipeline: 8 hours
- Compression engine: 5 hours

**Phase 3: Checkpoint Lifecycle** - 2 days
- Checkpoint lifecycle: 6 hours
- Emergency actions: 5 hours

**Phase 4: Orchestration** - 3 days
- Context orchestrator: 8 hours
- Feature flag integration: 2 hours
- Integration testing: 8 hours

**Phase 5: UI & Progress** - 1 day
- Compression progress UI: 4 hours
- Goal integration: 3 hours

**Phase 6: Migration & Documentation** - 2 days
- Migration scripts: 4 hours
- Documentation: 3 hours
- Release notes: 2 hours
- Enable new system: 2 hours

**Total: 15 days (2-3 weeks)**

---

## Ready to Start?

1. ✅ Read this guide
2. ✅ Read README.md
3. ✅ Read requirements.md
4. ✅ Read design.md
5. ⏳ Run backup script
6. ⏳ Start TASK-002 (Create new directory structure)

**Good luck! 🚀**

---

**Questions?** Review the documents above or ask the team.  
**Stuck?** Check the troubleshooting sections in each document.  
**Need help?** Reach out to the team lead.
