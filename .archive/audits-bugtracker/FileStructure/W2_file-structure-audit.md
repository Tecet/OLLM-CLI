# File Structure Audit

**Date**: January 23, 2026  
**Task**: 28. Standardize File Structure  
**Status**: Complete

## Executive Summary

This audit reviews the directory structure across the OLLM CLI codebase to identify misplaced files, inconsistent organization, and opportunities for better grouping of related functionality.

## Current Structure Analysis

### packages/cli/src/

```
cli/src/
├── assets/              # Empty - can be removed
├── commands/            # ✅ Well organized
├── components/          # ⚠️ Only contains LlamaAnimation - should move to ui/components
├── config/              # ✅ Well organized
├── features/            # ✅ Well organized (context, hooks, profiles, settings)
├── services/            # ✅ Well organized
├── test/                # ⚠️ Only one file - consider consolidating
├── types/               # ✅ Appropriate location
├── ui/                  # ✅ Well organized
├── utils/               # ✅ Well organized
├── cli.tsx              # ✅ Appropriate location
└── nonInteractive.ts    # ✅ Appropriate location
```

### packages/core/src/

```
core/src/
├── commands/            # ⚠️ Only 2 files - consider moving to services
├── confirmation-bus/    # ✅ Well organized
├── context/             # ⚠️ Contains PascalCase files that should be camelCase
├── core/                # ✅ Well organized
├── extensions/          # ✅ Well organized
├── hooks/               # ✅ Well organized
├── mcp/                 # ✅ Well organized
├── policy/              # ✅ Well organized
├── prompts/             # ⚠️ Contains PascalCase files and duplicates
├── provider/            # ✅ Well organized
├── rag/                 # ⚠️ Contains PascalCase files
├── routing/             # ✅ Well organized
├── services/            # ⚠️ Contains duplicate contextManager.ts
├── tools/               # ⚠️ Contains kebab-case files and PascalCase files
├── types/               # ✅ Appropriate location
├── utils/               # ✅ Well organized
└── workspace/           # ✅ Well organized
```

## Issues Identified

### 1. Empty Directories

**Issue**: `packages/cli/src/assets/` is empty

**Impact**: Low - just clutter

**Recommendation**: Remove empty directory

**Action**:
```bash
rmdir packages/cli/src/assets
```

### 2. Misplaced Component

**Issue**: `packages/cli/src/components/LlamaAnimation.tsx` should be in `packages/cli/src/ui/components/`

**Impact**: Medium - inconsistent organization

**Current Location**: `packages/cli/src/components/LlamaAnimation.tsx`

**Recommended Location**: `packages/cli/src/ui/components/animations/LlamaAnimation.tsx`

**Reason**: All UI components should be under `ui/components/` for consistency

**Action**:
```bash
mkdir -p packages/cli/src/ui/components/animations
git mv packages/cli/src/components/LlamaAnimation.tsx packages/cli/src/ui/components/animations/LlamaAnimation.tsx
git mv packages/cli/src/components/lama packages/cli/src/ui/components/animations/lama
rmdir packages/cli/src/components/__tests__
rmdir packages/cli/src/components
```

### 3. Sparse Test Directory

**Issue**: `packages/cli/src/test/` contains only one file (`ink-testing.tsx`)

**Impact**: Low - minor organizational issue

**Current Location**: `packages/cli/src/test/ink-testing.tsx`

**Recommended Location**: `packages/cli/src/ui/test-utils/ink-testing.tsx`

**Reason**: Test utilities should be co-located with the code they test

**Action**:
```bash
git mv packages/cli/src/test/ink-testing.tsx packages/cli/src/ui/test-utils/ink-testing.tsx
rmdir packages/cli/src/test
```

### 4. Sparse Commands Directory in Core

**Issue**: `packages/core/src/commands/` contains only 2 files

**Impact**: Low - minor organizational issue

**Files**:
- `contextCommand.ts`
- `index.ts`

**Recommendation**: Consider moving to `packages/core/src/services/` or keeping as-is if more commands are planned

**Decision**: Keep as-is - this is a valid separation of concerns for command implementations

### 5. Duplicate Files

**Issue**: `packages/core/src/services/contextManager.ts` duplicates `packages/core/src/context/contextManager.ts`

**Impact**: High - potential confusion and maintenance issues

**Analysis**:
- `packages/core/src/context/contextManager.ts` - Main implementation
- `packages/core/src/services/contextManager.ts` - Wrapper or different implementation?

**Action**: Need to review both files and consolidate

### 6. Duplicate Snapshot Managers

**Issue**: Multiple snapshot manager files in different locations

**Files**:
- `packages/core/src/context/snapshotManager.ts`
- `packages/core/src/context/SnapshotParser.ts`
- `packages/core/src/prompts/SnapshotManager.ts`

**Impact**: High - potential confusion

**Recommendation**: Review and consolidate if they serve the same purpose

### 7. PascalCase Service Files in Context

**Issue**: Several PascalCase files in `packages/core/src/context/` that should be camelCase

**Files**:
- `HotSwapService.ts` → should be `hotSwapService.ts`
- `SnapshotParser.ts` → should be `snapshotParser.ts`
- `SystemPromptBuilder.ts` → should be `systemPromptBuilder.ts`

**Impact**: Medium - naming convention violation

**Action**: Rename as part of naming conventions task (already identified in task 27)

### 8. PascalCase Service Files in Prompts

**Issue**: Several PascalCase files in `packages/core/src/prompts/` that should be camelCase

**Files**:
- `ContextAnalyzer.ts` → should be `contextAnalyzer.ts`
- `FocusModeManager.ts` → should be `focusModeManager.ts`
- `HybridModeManager.ts` → should be `hybridModeManager.ts`
- `ModeMetricsTracker.ts` → should be `modeMetricsTracker.ts`
- `ModeTransitionAnimator.ts` → should be `modeTransitionAnimator.ts`
- `ModeTransitionSuggester.ts` → should be `modeTransitionSuggester.ts`
- `PlanningModeRestrictions.ts` → should be `planningModeRestrictions.ts`
- `ProjectModeMemory.ts` → should be `projectModeMemory.ts`
- `PromptModeManager.ts` → should be `promptModeManager.ts`
- `PromptRegistry.ts` → should be `promptRegistry.ts`
- `SnapshotManager.ts` → should be `snapshotManager.ts` (also duplicate)
- `WorkflowManager.ts` → should be `workflowManager.ts`

**Impact**: Medium - naming convention violation

**Action**: Rename as part of naming conventions task (already identified in task 27)

### 9. PascalCase Service Files in RAG

**Issue**: PascalCase files in `packages/core/src/rag/` that should be camelCase

**Files**:
- `LanceDBSetup.ts` → should be `lanceDBSetup.ts`
- `RAGSystem.ts` → should be `ragSystem.ts`

**Impact**: Medium - naming convention violation

**Action**: Rename as part of naming conventions task (already identified in task 27)

### 10. Kebab-case Tool Files

**Issue**: Tool files using kebab-case instead of camelCase

**Files**:
- `edit-file.ts` → should be `editFile.ts`
- `gitignore-utils.ts` → should be `gitignoreUtils.ts`
- `goal-management.ts` → should be `goalManagement.ts`
- `output-helpers.ts` → should be `outputHelpers.ts`
- `read-file.ts` → should be `readFile.ts`
- `read-many-files.ts` → should be `readManyFiles.ts`
- `read-reasoning.ts` → should be `readReasoning.ts`
- `semantic-tools.ts` → should be `semanticTools.ts`
- `tool-capabilities.ts` → should be `toolCapabilities.ts`
- `tool-registry.ts` → should be `toolRegistry.ts`
- `web-fetch.ts` → should be `webFetch.ts`
- `web-search.ts` → should be `webSearch.ts`
- `write-file.ts` → should be `writeFile.ts`
- `write-todos.ts` → should be `writeTodos.ts`

**Impact**: Medium - naming convention violation

**Action**: Rename as part of naming conventions task (already identified in task 27)

### 11. PascalCase Tool Files

**Issue**: Tool files using PascalCase instead of camelCase

**Files**:
- `HotSwapTool.ts` → should be `hotSwapTool.ts`
- `MemoryDumpTool.ts` → should be `memoryDumpTool.ts`

**Impact**: Medium - naming convention violation

**Action**: Rename as part of naming conventions task (already identified in task 27)

### 12. Cross-Package Import

**Issue**: `packages/cli/src/commands/configCommands.ts` imports from core using relative path

**Current**:
```typescript
import { getDefaultStorageLocations, logAllStorageLocations } from '../../../core/src/utils/pathValidation.js';
```

**Impact**: Medium - fragile import path

**Recommendation**: Use package imports instead

**Preferred**:
```typescript
import { getDefaultStorageLocations, logAllStorageLocations } from '@ollm/ollm-cli-core/utils/pathValidation.js';
```

**Action**: Update import to use package name

## Recommended Directory Structure

### Ideal Structure for packages/cli/src/

```
cli/src/
├── commands/            # Slash command implementations
├── config/              # CLI-specific configuration
├── features/            # Feature-specific contexts and logic
│   ├── context/         # Context-related features
│   ├── hooks/           # Hook-related features
│   ├── profiles/        # Profile-related features
│   └── settings/        # Settings-related features
├── services/            # CLI-specific services
├── types/               # Type definitions
├── ui/                  # All UI components and logic
│   ├── components/      # React components
│   │   ├── animations/  # Animation components (LlamaAnimation)
│   │   ├── chat/        # Chat-related components
│   │   ├── code-editor/ # Code editor components
│   │   ├── dialogs/     # Dialog components
│   │   ├── file-explorer/ # File explorer components
│   │   ├── tabs/        # Tab components
│   │   └── windows/     # Window components
│   ├── contexts/        # React contexts
│   ├── hooks/           # Custom React hooks
│   ├── services/        # UI-specific services
│   ├── test-utils/      # UI testing utilities
│   └── utils/           # UI utility functions
├── utils/               # General utility functions
├── cli.tsx              # Main entry point
└── nonInteractive.ts    # Headless mode execution
```

### Ideal Structure for packages/core/src/

```
core/src/
├── commands/            # Command implementations
├── confirmation-bus/    # Confirmation message bus
├── context/             # Context management
├── core/                # Core chat runtime
├── extensions/          # Extension system
├── hooks/               # Hook system
├── mcp/                 # MCP integration
├── policy/              # Policy engine
├── prompts/             # Prompt management
├── provider/            # Provider interfaces
├── rag/                 # RAG system
├── routing/             # Model routing
├── services/            # Business logic services
├── tools/               # Tool implementations
├── types/               # Type definitions
├── utils/               # Utility functions
└── workspace/           # Workspace management
```

## Migration Plan

### Phase 1: Move Misplaced Files (High Priority)

1. **Move LlamaAnimation to ui/components/animations/**
   ```bash
   mkdir -p packages/cli/src/ui/components/animations
   git mv packages/cli/src/components/LlamaAnimation.tsx packages/cli/src/ui/components/animations/
   git mv packages/cli/src/components/lama packages/cli/src/ui/components/animations/
   ```

2. **Move ink-testing to ui/test-utils/**
   ```bash
   git mv packages/cli/src/test/ink-testing.tsx packages/cli/src/ui/test-utils/
   ```

3. **Remove empty directories**
   ```bash
   rmdir packages/cli/src/components/__tests__
   rmdir packages/cli/src/components
   rmdir packages/cli/src/test
   rmdir packages/cli/src/assets
   ```

4. **Update imports for moved files**
   - Search for imports of `LlamaAnimation`
   - Search for imports of `ink-testing`
   - Update to new paths

### Phase 2: Investigate Duplicates (High Priority)

1. **Review contextManager.ts files**
   - Compare `packages/core/src/context/contextManager.ts`
   - Compare `packages/core/src/services/contextManager.ts`
   - Determine if they serve different purposes
   - Consolidate or rename appropriately

2. **Review snapshot manager files**
   - Compare `packages/core/src/context/snapshotManager.ts`
   - Compare `packages/core/src/context/SnapshotParser.ts`
   - Compare `packages/core/src/prompts/SnapshotManager.ts`
   - Consolidate if they serve the same purpose

### Phase 3: Fix Cross-Package Imports (Medium Priority)

1. **Update configCommands.ts import**
   ```typescript
   // Before
   import { getDefaultStorageLocations, logAllStorageLocations } from '../../../core/src/utils/pathValidation.js';
   
   // After
   import { getDefaultStorageLocations, logAllStorageLocations } from '@ollm/ollm-cli-core/utils/pathValidation.js';
   ```

2. **Search for other cross-package relative imports**
   ```bash
   grep -r "from '\.\./\.\./\.\./core" packages/cli/src/
   grep -r "from '\.\./\.\./\.\./cli" packages/core/src/
   ```

### Phase 4: Naming Convention Fixes (Covered by Task 27)

All PascalCase and kebab-case file renames are covered by Task 27: Standardize Naming Conventions.

## Testing Strategy

After each phase:

1. **TypeScript Compilation**: `npm run build`
2. **Linting**: `npm run lint`
3. **Unit Tests**: `npm test`
4. **Manual Testing**: Test affected features

## Success Criteria

- [ ] No empty directories
- [ ] All UI components under `ui/components/`
- [ ] All test utilities co-located with code
- [ ] No duplicate files (or duplicates are intentional and documented)
- [ ] Cross-package imports use package names, not relative paths
- [ ] All tests passing
- [ ] No TypeScript errors
- [ ] Documentation updated

## Impact Analysis

### Breaking Changes
- Import paths will change for moved files
- No public API changes

### Risk Assessment
- **Low Risk**: Moving files within same package
- **Medium Risk**: Consolidating duplicate files
- **Low Risk**: Updating import paths

### Affected Areas
- LlamaAnimation component and its imports
- ink-testing utility and its imports
- configCommands and its imports
- Any code using duplicate contextManager or snapshotManager

## Timeline Estimate

- **Phase 1 (Move Files)**: 1 hour
- **Phase 2 (Investigate Duplicates)**: 2 hours
- **Phase 3 (Fix Imports)**: 1 hour
- **Testing**: 1 hour
- **Total**: 5 hours

## Notes

- This task focuses on file organization and structure
- Naming convention fixes are handled by Task 27
- Some "issues" may be intentional design decisions
- Always verify with team before consolidating "duplicate" files

## References

- Task 27: Standardize Naming Conventions
- `docs/NAMING-CONVENTIONS.md`
- `.dev/audits/naming-conventions-audit.md`
- Project structure documentation in steering files

