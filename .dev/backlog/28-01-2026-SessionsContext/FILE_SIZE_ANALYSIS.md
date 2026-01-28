# File Size Analysis - Sessions/Context Cleanup

**Date:** January 28, 2026  
**Status:** 📊 Analysis Complete

---

## Summary

**Total Files Analyzed:** 48 files  
**Files >500 lines:** 11 files (23%)  
**Files >800 lines:** 4 files (8%)  
**Largest File:** types.ts (926 lines)

---

## Critical Files (>500 lines) - Split Candidates

### Core Context (packages/core/src/context/)

| File | Lines | Priority | Notes |
|------|-------|----------|-------|
| **types.ts** | 926 | 🔴 HIGH | Type definitions - can split by domain |
| **compressionService.ts** | 833 | 🔴 HIGH | LLM summarization - large, complex |
| **compressionCoordinator.ts** | 830 | 🔴 HIGH | Orchestration - many responsibilities |
| **contextManager.ts** | 639 | 🟡 MEDIUM | Main orchestrator - review for bloat |
| **snapshotManager.ts** | 615 | 🟡 MEDIUM | Snapshot operations - check duplicates |
| **snapshotStorage.ts** | 541 | 🟡 MEDIUM | Storage layer - may have legacy code |

### Services (packages/core/src/services/)

| File | Lines | Priority | Notes |
|------|-------|----------|-------|
| **serviceContainer.ts** | 636 | 🟡 MEDIUM | DI container - review structure |
| **chatCompressionService.ts** | 559 | 🟡 MEDIUM | Compression - check vs compressionService.ts |

### UI Context (packages/cli/src/features/context/)

| File | Lines | Priority | Notes |
|------|-------|----------|-------|
| **ModelContext.tsx** | 811 | 🔴 HIGH | Model management - split by concern |
| **ContextManagerContext.tsx** | 684 | 🟡 MEDIUM | Context provider - review for bloat |
| **FocusContext.tsx** | 581 | 🟡 MEDIUM | Focus management - check if needed |
| **ChatContext.tsx** | 579 | 🟡 MEDIUM | Main chat context - recently refactored |

### Handlers (packages/cli/src/features/context/handlers/)

| File | Lines | Priority | Notes |
|------|-------|----------|-------|
| **agentLoopHandler.ts** | 572 | 🟡 MEDIUM | Agent loop - complex logic |

---

## Medium Files (300-500 lines) - Review for Bloat

### Core Context

| File | Lines | Notes |
|------|-------|-------|
| goalManager.ts | 456 | Goal management |
| memoryGuard.ts | 320 | Memory safety |
| messageStore.ts | 317 | Message tracking |

### Services

| File | Lines | Notes |
|------|-------|-------|
| chatRecordingService.ts | 344 | Session storage |
| inputPreprocessor.ts | 332 | Input preprocessing |
| memoryService.ts | 306 | Memory management |

### UI Context

| File | Lines | Notes |
|------|-------|-------|
| HooksContext.tsx | 344 | Hooks management |
| ActiveContextState.tsx | 323 | Active context state |
| contextEventHandlers.ts | 269 | Event handlers |
| UserPromptContext.tsx | 247 | User prompt context |

---

## Small Files (<300 lines) - Likely OK

### Core Context (18 files)
- vramMonitor.ts (283)
- goalTypes.ts (283)
- tokenCounter.ts (252)
- ContextSizeCalculator.ts (245)
- checkpointManager.ts (230)
- reasoningManager.ts (197)
- contextPool.ts (194)
- HotSwapService.ts (182)
- contextModules.ts (155)
- gpuDetector.ts (137)
- promptOrchestrator.ts (129)
- reasoningTypes.ts (115)
- jitDiscovery.ts (97)
- snapshotCoordinator.ts (88)
- snapshotParser.ts (64)
- SystemPromptBuilder.ts (53)
- gpuHints.ts (44)
- index.ts (32)
- contextDefaults.ts (27)

### Services (4 files)
- types.ts (250)
- intentSnapshotStorage.ts (184)
- metricsCollector.ts (140)
- index.ts (104)

### UI Context (8 files)
- ServiceContext.tsx (192)
- ReviewContext.tsx (171)
- ContextStatus.tsx (164)
- SystemMessages.tsx (139)
- ToolSupportMessages.ts (125)
- contextSizing.ts (120)
- UIContext.tsx (99)
- KeybindsContext.tsx (92)
- GPUContext.tsx (91)
- SettingsContext.tsx (86)
- useFocusedFilesInjection.ts (40)
- gpuHintStore.ts (16)
- gpuHints.ts (2)

### Handlers (1 file)
- commandHandler.ts (141)

---

## Duplicate Code Suspects

### Compression Logic
- `compressionService.ts` (833 lines) - LLM summarization
- `chatCompressionService.ts` (559 lines) - Compression service
- `compressionCoordinator.ts` (830 lines) - Orchestration

**Question:** Do we have duplicate compression logic across these 3 files?

### Snapshot Logic
- `snapshotManager.ts` (615 lines) - Snapshot operations
- `snapshotStorage.ts` (541 lines) - Storage layer
- `snapshotCoordinator.ts` (88 lines) - Coordination
- `intentSnapshotStorage.ts` (184 lines) - Intent snapshots

**Question:** Is there overlap between snapshot systems?

### Context Management
- `contextManager.ts` (639 lines) - Main orchestrator
- `ContextManagerContext.tsx` (684 lines) - UI context provider
- `contextPool.ts` (194 lines) - Dynamic sizing

**Question:** Is there duplicate state management?

---

## Split Candidates (Priority Order)

### 1. types.ts (926 lines) - 🔴 CRITICAL
**Current:** All type definitions in one file  
**Proposed Split:**
- `types/context.ts` - Context types
- `types/compression.ts` - Compression types
- `types/snapshot.ts` - Snapshot types
- `types/goal.ts` - Goal types
- `types/message.ts` - Message types
- `types/events.ts` - Event types

**Benefit:** Better organization, easier to find types

---

### 2. compressionService.ts (833 lines) - 🔴 HIGH
**Current:** All compression logic in one file  
**Proposed Split:**
- `compression/summarizer.ts` - LLM summarization
- `compression/strategies.ts` - Compression strategies
- `compression/validator.ts` - Validation logic
- `compression/formatter.ts` - Output formatting

**Benefit:** Clearer separation of concerns

---

### 3. compressionCoordinator.ts (830 lines) - 🔴 HIGH
**Current:** Orchestration + aging + rollover  
**Proposed Split:**
- `compression/coordinator.ts` - Main orchestration
- `compression/aging.ts` - Checkpoint aging logic
- `compression/rollover.ts` - Context rollover
- `compression/emergency.ts` - Emergency triggers

**Benefit:** Each file has single responsibility

---

### 4. ModelContext.tsx (811 lines) - 🔴 HIGH
**Current:** Model management + provider + config  
**Proposed Split:**
- `model/ModelContext.tsx` - Main context
- `model/ModelSelector.tsx` - Model selection UI
- `model/ProviderManager.tsx` - Provider management
- `model/ModelConfig.tsx` - Configuration

**Benefit:** Smaller, more maintainable components

---

### 5. contextManager.ts (639 lines) - 🟡 MEDIUM
**Review First:** Check for dead code, duplicates  
**Possible Split:**
- `context/manager.ts` - Core management
- `context/lifecycle.ts` - Start/stop logic
- `context/events.ts` - Event handling
- `context/validation.ts` - Validation logic

**Benefit:** Depends on bloat analysis

---

## Analysis Plan

### Phase 1: Read & Understand (Current)
- ✅ Measure file sizes
- ⏭️ Read critical files (>500 lines)
- ⏭️ Identify duplicate code
- ⏭️ Find legacy/dead code
- ⏭️ Document findings

### Phase 2: Prioritize
- Rank issues by impact
- Plan split strategy
- Identify quick wins
- Create refactoring plan

### Phase 3: Execute
- Start with types.ts (biggest, safest)
- Move to compression files
- Handle UI contexts
- Clean up duplicates

### Phase 4: Verify
- Run all tests after each change
- Check for regressions
- Measure improvement
- Update documentation

---

## Next Steps

1. **Read compressionService.ts** - Understand compression logic
2. **Read compressionCoordinator.ts** - Understand orchestration
3. **Read chatCompressionService.ts** - Check for duplicates
4. **Compare snapshot files** - Find overlaps
5. **Read contextManager.ts** - Check for bloat
6. **Document findings** - Create detailed analysis

---

## Success Metrics

**Before:**
- 11 files >500 lines (23%)
- 4 files >800 lines (8%)
- Largest: 926 lines

**Target After Cleanup:**
- 0 files >500 lines (0%)
- 0 files >800 lines (0%)
- Largest: <400 lines
- No duplicate code
- Clear separation of concerns

---

**Status:** Ready for detailed file analysis
