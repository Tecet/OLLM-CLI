# Context Folder Complete Audit

**Date**: 2026-01-29  
**Purpose**: Identify ALL files in packages/core/src/context and classify as NEW SYSTEM, LEGACY, or SHARED

---

## File Classification

### ✅ NEW SYSTEM (v0.1.1) - KEEP

These files are part of the new ContextOrchestrator system:

#### Core Orchestration
- `orchestration/contextOrchestrator.ts` - Main orchestrator
- `orchestration/contextOrchestrator.ts.backup` - Backup (can delete after verification)

#### Storage Layer
- `storage/activeContextManager.ts` - Active context (what gets sent to LLM)
- `storage/sessionHistoryManager.ts` - Complete conversation history
- `storage/snapshotLifecycle.ts` - Snapshot management
- `storage/storageBoundaries.ts` - Storage validation

#### Compression Engine
- `compression/compressionEngine.ts` - Compression engine
- `compression/compressionPipeline.ts` - Compression pipeline
- `compression/summarizationService.ts` - LLM-based summarization
- `compression/validationService.ts` - Context validation
- `compression/goalMarkerParser.ts` - Goal marker parsing
- `compression/goalProgressTracker.ts` - Goal progress tracking

#### Checkpoint System
- `checkpoints/checkpointLifecycle.ts` - Checkpoint aging/merging
- `checkpoints/emergencyActions.ts` - Emergency compression

#### Integration Layer
- `integration/tierAwareCompression.ts` - Tier system integration
- `integration/modeAwareCompression.ts` - Mode system integration
- `integration/modelAwareCompression.ts` - Model management integration
- `integration/providerAwareCompression.ts` - Provider system integration
- `integration/goalAwareCompression.ts` - Goal system integration
- `integration/promptOrchestratorIntegration.ts` - Prompt orchestrator integration

#### Types
- `types/storageTypes.ts` - Storage type definitions
- `types.ts` - Core type definitions (SHARED - has both old and new types)

#### Adapters
- `adapters/contextOrchestratorAdapter.ts` - Adapter for CLI compatibility
- `adapters/legacyContextAdapter.ts` - Migration adapter (can move to migration/)

#### Factory
- `contextManagerFactory.ts` - Factory (UPDATED for new system)

#### Migration
- `migration/index.ts` - Migration exports
- `migration/migrationCLI.ts` - Migration CLI
- `migration/sessionMigration.ts` - Session migration
- `migration/snapshotMigration.ts` - Snapshot migration
- `migration/README.md` - Migration docs

#### Tests (NEW SYSTEM)
- All files in `storage/__tests__/` - New system tests
- All files in `compression/__tests__/` - New system tests
- All files in `checkpoints/__tests__/` - New system tests
- All files in `integration/__tests__/` - New system tests
- All files in `orchestration/__tests__/` - New system tests
- All files in `types/__tests__/` - New system tests
- All files in `__tests__/integration/` - Integration tests for new system

---

### 🔴 LEGACY SYSTEM (v0.1.0 and earlier) - MOVE TO .legacy/

These files are from the OLD ConversationContextManager system:

#### Old Context Manager (LEGACY)
- `contextManager.ts` - OLD ConversationContextManager class
- `checkpointManager.ts` - OLD checkpoint manager
- `compressionCoordinator.ts` - OLD compression coordinator
- `compressionService.ts` - OLD compression service (not LLM-based)
- `snapshotCoordinator.ts` - OLD snapshot coordinator
- `snapshotManager.ts` - OLD snapshot manager
- `messageStore.ts` - OLD message store

#### Old Utilities (LEGACY)
- `checkpointUtils.ts` - OLD checkpoint utilities
- `snapshotParser.ts` - OLD snapshot parser
- `snapshotUtils.ts` - OLD snapshot utilities
- `contextModules.ts` - OLD module system (may have some shared types)

#### Old Tests (LEGACY)
- `__tests__/contextManager.test.ts` - Tests for OLD system
- `__tests__/checkpointAging.test.ts` - Tests for OLD system
- `__tests__/compressionCoordinator.test.ts` - Tests for OLD system
- `__tests__/compressionService.test.ts` - Tests for OLD system
- `__tests__/snapshotCoordinator.test.ts` - Tests for OLD system
- `__tests__/snapshotManager.test.ts` - Tests for OLD system
- `__tests__/snapshotStorage.test.ts` - Tests for OLD system
- `__tests__/snapshotUtils.test.ts` - Tests for OLD system
- `__tests__/checkpointUtils.test.ts` - Tests for OLD system
- `__tests__/legacyContextAdapter.test.ts` - Tests for migration adapter
- `__tests__/contextManagerFactory.test.ts` - Tests for OLD factory
- `__tests__/blockingMechanism.test.ts` - Tests for OLD system
- `__tests__/hotSwapReasoning.test.ts` - Tests for OLD system
- `__tests__/promptRouting.test.ts` - Tests for OLD system
- `__tests__/validateAndBuildPrompt.test.ts` - Tests for OLD system

---

### 🟡 SHARED/UTILITY - KEEP (Used by both or standalone)

These files are used by both systems or are standalone utilities:

#### Shared Utilities
- `tokenCounter.ts` - Token counting (used by both)
- `snapshotStorage.ts` - Snapshot storage interface (used by both)
- `contextDefaults.ts` - Default configurations
- `contextPool.ts` - Context pool (VRAM-based sizing)
- `vramMonitor.ts` - VRAM monitoring
- `gpuDetector.ts` - GPU detection
- `gpuHints.ts` - GPU hints
- `memoryGuard.ts` - Memory safety
- `HotSwapService.ts` - Hot swap service
- `jitDiscovery.ts` - JIT discovery

#### Shared Managers
- `promptOrchestrator.ts` - Prompt orchestrator (used by new system)
- `goalManager.ts` - Goal manager (used by new system)
- `goalTypes.ts` - Goal types (used by new system)
- `reasoningManager.ts` - Reasoning manager
- `reasoningTypes.ts` - Reasoning types
- `SystemPromptBuilder.ts` - System prompt builder
- `ContextSizeCalculator.ts` - Context size calculator

#### Entry Point
- `index.ts` - Module exports (NEEDS UPDATE to remove legacy exports)

#### Tests (SHARED)
- `__tests__/tokenCounter.test.ts` - Token counter tests
- `__tests__/memoryGuard.test.ts` - Memory guard tests

---

## Summary Statistics

| Category | Count | Action |
|----------|-------|--------|
| **NEW SYSTEM** | ~40 files | ✅ KEEP |
| **LEGACY SYSTEM** | ~15 files | 🔴 MOVE TO .legacy/ |
| **SHARED/UTILITY** | ~15 files | 🟡 KEEP |
| **TOTAL** | ~70 files | - |

---

## Files to Move to .legacy/

### Create: `.legacy/context-compression/2026-01-29-old-system/`

Move these files:

```
packages/core/src/context/contextManager.ts
packages/core/src/context/checkpointManager.ts
packages/core/src/context/compressionCoordinator.ts
packages/core/src/context/compressionService.ts
packages/core/src/context/snapshotCoordinator.ts
packages/core/src/context/snapshotManager.ts
packages/core/src/context/messageStore.ts
packages/core/src/context/checkpointUtils.ts
packages/core/src/context/snapshotParser.ts
packages/core/src/context/snapshotUtils.ts
packages/core/src/context/contextModules.ts (check for shared types first)

packages/core/src/context/__tests__/contextManager.test.ts
packages/core/src/context/__tests__/checkpointAging.test.ts
packages/core/src/context/__tests__/compressionCoordinator.test.ts
packages/core/src/context/__tests__/compressionService.test.ts
packages/core/src/context/__tests__/snapshotCoordinator.test.ts
packages/core/src/context/__tests__/snapshotManager.test.ts
packages/core/src/context/__tests__/snapshotStorage.test.ts
packages/core/src/context/__tests__/snapshotUtils.test.ts
packages/core/src/context/__tests__/checkpointUtils.test.ts
packages/core/src/context/__tests__/legacyContextAdapter.test.ts
packages/core/src/context/__tests__/contextManagerFactory.test.ts
packages/core/src/context/__tests__/blockingMechanism.test.ts
packages/core/src/context/__tests__/hotSwapReasoning.test.ts
packages/core/src/context/__tests__/promptRouting.test.ts
packages/core/src/context/__tests__/validateAndBuildPrompt.test.ts
```

---

## Files to Check for Dependencies

Before moving, check these files for imports/dependencies:

1. **contextModules.ts** - May have shared type definitions
2. **index.ts** - Remove legacy exports
3. **types.ts** - May have both old and new types mixed

---

## Action Plan

1. ✅ Create backup directory: `.legacy/context-compression/2026-01-29-old-system/`
2. ⏳ Check contextModules.ts for shared types
3. ⏳ Check types.ts for mixed old/new types
4. ⏳ Move all legacy files to backup
5. ⏳ Update index.ts to remove legacy exports
6. ⏳ Update imports in any files that reference moved files
7. ⏳ Run tests to verify nothing breaks
8. ⏳ Commit changes

---

## Expected Result

After cleanup:

```
packages/core/src/context/
├── adapters/
│   └── contextOrchestratorAdapter.ts (NEW)
├── checkpoints/
│   ├── checkpointLifecycle.ts (NEW)
│   └── emergencyActions.ts (NEW)
├── compression/
│   ├── compressionEngine.ts (NEW)
│   ├── compressionPipeline.ts (NEW)
│   ├── summarizationService.ts (NEW)
│   ├── validationService.ts (NEW)
│   ├── goalMarkerParser.ts (NEW)
│   └── goalProgressTracker.ts (NEW)
├── integration/
│   ├── tierAwareCompression.ts (NEW)
│   ├── modeAwareCompression.ts (NEW)
│   ├── modelAwareCompression.ts (NEW)
│   ├── providerAwareCompression.ts (NEW)
│   ├── goalAwareCompression.ts (NEW)
│   └── promptOrchestratorIntegration.ts (NEW)
├── migration/
│   ├── index.ts
│   ├── migrationCLI.ts
│   ├── sessionMigration.ts
│   ├── snapshotMigration.ts
│   ├── README.md
│   └── legacyContextAdapter.ts (MOVED HERE)
├── orchestration/
│   └── contextOrchestrator.ts (NEW)
├── storage/
│   ├── activeContextManager.ts (NEW)
│   ├── sessionHistoryManager.ts (NEW)
│   ├── snapshotLifecycle.ts (NEW)
│   └── storageBoundaries.ts (NEW)
├── types/
│   └── storageTypes.ts (NEW)
├── contextManagerFactory.ts (UPDATED)
├── index.ts (UPDATED - remove legacy exports)
├── types.ts (SHARED - clean up old types)
├── tokenCounter.ts (SHARED)
├── snapshotStorage.ts (SHARED)
├── contextDefaults.ts (SHARED)
├── contextPool.ts (SHARED)
├── vramMonitor.ts (SHARED)
├── gpuDetector.ts (SHARED)
├── gpuHints.ts (SHARED)
├── memoryGuard.ts (SHARED)
├── HotSwapService.ts (SHARED)
├── jitDiscovery.ts (SHARED)
├── promptOrchestrator.ts (SHARED)
├── goalManager.ts (SHARED)
├── goalTypes.ts (SHARED)
├── reasoningManager.ts (SHARED)
├── reasoningTypes.ts (SHARED)
├── SystemPromptBuilder.ts (SHARED)
└── ContextSizeCalculator.ts (SHARED)
```

Much cleaner! Only ~30 files instead of ~70.

---

**Last Updated**: 2026-01-29  
**Status**: Analysis Complete - Ready for Cleanup
