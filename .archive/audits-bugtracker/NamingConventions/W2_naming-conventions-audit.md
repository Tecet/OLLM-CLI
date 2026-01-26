# Naming Conventions Audit

**Date**: January 23, 2026  
**Task**: 27. Standardize Naming Conventions  
**Status**: In Progress

## Executive Summary

This audit reviews file names, function names, and variable names across the OLLM CLI codebase to identify inconsistencies and establish standardized naming conventions.

## File Naming Analysis

### Current Patterns Observed

#### Components (React/Ink)
- **PascalCase.tsx**: Majority pattern (e.g., `ChatTab.tsx`, `FileExplorerComponent.tsx`)
- **Inconsistencies Found**: None - all React components follow PascalCase

#### Services
- **camelCase.ts**: Majority pattern (e.g., `contextManager.ts`, `hookRegistry.ts`)
- **Inconsistencies Found**:
  - `ContextConfigService.ts` - PascalCase (should be `contextConfigService.ts`)
  - `EditorIntegration.ts` - PascalCase (should be `editorIntegration.ts`)
  - `ErrorHandler.ts` - PascalCase (should be `errorHandler.ts`)
  - `FileOperations.ts` - PascalCase (should be `fileOperations.ts`)
  - `FileTreeService.ts` - PascalCase (should be `fileTreeService.ts`)
  - `FocusSystem.ts` - PascalCase (should be `focusSystem.ts`)
  - `FollowModeService.ts` - PascalCase (should be `followModeService.ts`)
  - `GitStatusService.ts` - PascalCase (should be `gitStatusService.ts`)
  - `HotSwapService.ts` - PascalCase (should be `hotSwapService.ts`)
  - `HybridModeManager.ts` - PascalCase (should be `hybridModeManager.ts`)
  - `KeybindsService.ts` - PascalCase (should be `keybindsService.ts`)
  - `LanceDBSetup.ts` - PascalCase (should be `lanceDBSetup.ts`)
  - `ModeMetricsTracker.ts` - PascalCase (should be `modeMetricsTracker.ts`)
  - `ModeTransitionAnimator.ts` - PascalCase (should be `modeTransitionAnimator.ts`)
  - `ModeTransitionSuggester.ts` - PascalCase (should be `modeTransitionSuggester.ts`)
  - `PathSanitizer.ts` - PascalCase (should be `pathSanitizer.ts`)
  - `PlanningModeRestrictions.ts` - PascalCase (should be `planningModeRestrictions.ts`)
  - `ProfileManager.ts` - PascalCase (should be `profileManager.ts`)
  - `PromptModeManager.ts` - PascalCase (should be `promptModeManager.ts`)
  - `PromptRegistry.ts` - PascalCase (should be `promptRegistry.ts`)
  - `ProjectModeMemory.ts` - PascalCase (should be `projectModeMemory.ts`)
  - `RAGSystem.ts` - PascalCase (should be `ragSystem.ts`)
  - `SnapshotManager.ts` - PascalCase (should be `snapshotManager.ts`)
  - `SnapshotParser.ts` - PascalCase (should be `snapshotParser.ts`)
  - `SystemPromptBuilder.ts` - PascalCase (should be `systemPromptBuilder.ts`)
  - `ToolSupportMessages.ts` - PascalCase (should be `toolSupportMessages.ts`)
  - `VisionService.ts` - PascalCase (should be `visionService.ts`)
  - `WorkflowManager.ts` - PascalCase (should be `workflowManager.ts`)
  - `WorkspaceManager.ts` - PascalCase (should be `workspaceManager.ts`)

#### Utilities
- **camelCase.ts**: Standard pattern (e.g., `keyUtils.ts`, `errorLogger.ts`)
- **kebab-case.ts**: Some files (e.g., `gitignore-utils.ts`, `output-helpers.ts`)
- **Inconsistencies Found**: Mix of camelCase and kebab-case

#### Test Files
- **camelCase.test.ts**: Majority pattern
- **PascalCase.test.tsx**: For component tests
- **Inconsistencies Found**: None - follows source file naming

#### Configuration Files
- **camelCase.ts**: Standard (e.g., `defaults.ts`, `schema.ts`)
- **Inconsistencies Found**: None

### File Naming Recommendations

1. **Components**: Keep PascalCase.tsx (already consistent)
2. **Services**: Standardize to camelCase.ts (fix 28 files)
3. **Utilities**: Standardize to camelCase.ts (convert kebab-case files)
4. **Test Files**: Match source file naming convention
5. **Configuration**: Keep camelCase.ts (already consistent)

## Function Naming Analysis

### Current Patterns Observed

#### Exported Functions
- **camelCase**: Majority pattern (e.g., `createTestMessage`, `getServerUrl`)
- **Inconsistencies Found**: None - all exported functions follow camelCase

#### React Components
- **PascalCase**: Standard pattern (e.g., `ChatTab`, `FileExplorer`)
- **Inconsistencies Found**: None - all components follow PascalCase

#### Class Methods
- **camelCase**: Standard pattern (e.g., `chatStream`, `countTokens`)
- **Inconsistencies Found**: None - all methods follow camelCase

#### Event Handlers
- **handleCamelCase**: Standard pattern (e.g., `handleWindowChange`, `handleKeyPress`)
- **Inconsistencies Found**: None - all handlers follow convention

### Function Naming Recommendations

1. **Exported Functions**: Keep camelCase (already consistent)
2. **React Components**: Keep PascalCase (already consistent)
3. **Class Methods**: Keep camelCase (already consistent)
4. **Event Handlers**: Keep handleCamelCase prefix (already consistent)

## Variable Naming Analysis

### Current Patterns Observed

#### Constants
- **UPPER_SNAKE_CASE**: Some constants (e.g., `DEFAULT_SERVER_URL`, `TEST_UTILS_VERSION`)
- **camelCase**: Many constants (e.g., `mockTheme`, `mockKeybinds`, `fixtureMessages`)
- **Inconsistencies Found**: Mix of UPPER_SNAKE_CASE and camelCase for constants

#### Regular Variables
- **camelCase**: Standard pattern (e.g., `activeWindow`, `focusManager`)
- **Inconsistencies Found**: None - all regular variables follow camelCase

#### Boolean Variables
- **isCamelCase/hasCamelCase**: Standard pattern (e.g., `isActive`, `hasError`)
- **Inconsistencies Found**: None - all boolean variables follow convention

#### Private Variables
- **_camelCase**: Some private variables use underscore prefix
- **camelCase**: Many private variables don't use prefix
- **Inconsistencies Found**: Inconsistent use of underscore prefix for private variables

### Variable Naming Recommendations

1. **Constants**: 
   - Use UPPER_SNAKE_CASE for true constants (primitive values, never change)
   - Use camelCase for complex objects/arrays that are readonly
2. **Regular Variables**: Keep camelCase (already consistent)
3. **Boolean Variables**: Keep is/has prefix (already consistent)
4. **Private Variables**: Use camelCase without underscore (modern TypeScript convention)

## Type/Interface Naming Analysis

### Current Patterns Observed

#### Interfaces
- **PascalCase**: Standard pattern (e.g., `ServerDetection`, `TestExecutionResult`)
- **Inconsistencies Found**: None - all interfaces follow PascalCase

#### Types
- **PascalCase**: Standard pattern (e.g., `MockProviderConfig`, `TestMessage`)
- **Inconsistencies Found**: None - all types follow PascalCase

#### Enums
- **PascalCase**: Standard pattern
- **Inconsistencies Found**: None - all enums follow PascalCase

### Type/Interface Naming Recommendations

1. **Interfaces**: Keep PascalCase (already consistent)
2. **Types**: Keep PascalCase (already consistent)
3. **Enums**: Keep PascalCase (already consistent)

## Summary of Issues Found

### Critical Issues (Must Fix)
1. **28 Service Files**: Using PascalCase instead of camelCase
2. **Utility Files**: Mix of camelCase and kebab-case

### Minor Issues (Should Fix)
1. **Constants**: Inconsistent use of UPPER_SNAKE_CASE vs camelCase
2. **Private Variables**: Inconsistent use of underscore prefix

### Non-Issues (Already Consistent)
1. ✅ React Components: All PascalCase.tsx
2. ✅ Exported Functions: All camelCase
3. ✅ Class Methods: All camelCase
4. ✅ Event Handlers: All handleCamelCase
5. ✅ Regular Variables: All camelCase
6. ✅ Boolean Variables: All is/has prefix
7. ✅ Interfaces/Types: All PascalCase

## Recommended Actions

### Phase 1: File Renaming (High Priority)
- [ ] Rename 28 service files from PascalCase to camelCase
- [ ] Update all imports referencing renamed files
- [ ] Run tests to verify no breakage

### Phase 2: Utility File Standardization (Medium Priority)
- [ ] Convert kebab-case utility files to camelCase
- [ ] Update all imports
- [ ] Run tests to verify no breakage

### Phase 3: Constant Naming (Low Priority)
- [ ] Review all constants and apply consistent naming
- [ ] UPPER_SNAKE_CASE for primitive constants
- [ ] camelCase for complex readonly objects

### Phase 4: Documentation (Required)
- [ ] Document naming conventions in CONTRIBUTING.md
- [ ] Add ESLint rules to enforce conventions
- [ ] Update code review checklist

## Files Requiring Rename

### Service Files (PascalCase → camelCase)

1. `ContextConfigService.ts` → `contextConfigService.ts`
2. `EditorIntegration.ts` → `editorIntegration.ts`
3. `ErrorHandler.ts` → `errorHandler.ts`
4. `FileOperations.ts` → `fileOperations.ts`
5. `FileTreeService.ts` → `fileTreeService.ts`
6. `FocusSystem.ts` → `focusSystem.ts`
7. `FollowModeService.ts` → `followModeService.ts`
8. `GitStatusService.ts` → `gitStatusService.ts`
9. `HotSwapService.ts` → `hotSwapService.ts`
10. `HybridModeManager.ts` → `hybridModeManager.ts`
11. `KeybindsService.ts` → `keybindsService.ts`
12. `LanceDBSetup.ts` → `lanceDBSetup.ts`
13. `ModeMetricsTracker.ts` → `modeMetricsTracker.ts`
14. `ModeTransitionAnimator.ts` → `modeTransitionAnimator.ts`
15. `ModeTransitionSuggester.ts` → `modeTransitionSuggester.ts`
16. `PathSanitizer.ts` → `pathSanitizer.ts`
17. `PlanningModeRestrictions.ts` → `planningModeRestrictions.ts`
18. `ProfileManager.ts` → `profileManager.ts`
19. `PromptModeManager.ts` → `promptModeManager.ts`
20. `PromptRegistry.ts` → `promptRegistry.ts`
21. `ProjectModeMemory.ts` → `projectModeMemory.ts`
22. `RAGSystem.ts` → `ragSystem.ts`
23. `SnapshotManager.ts` → `snapshotManager.ts`
24. `SnapshotParser.ts` → `snapshotParser.ts`
25. `SystemPromptBuilder.ts` → `systemPromptBuilder.ts`
26. `ToolSupportMessages.ts` → `toolSupportMessages.ts`
27. `VisionService.ts` → `visionService.ts`
28. `WorkflowManager.ts` → `workflowManager.ts`
29. `WorkspaceManager.ts` → `workspaceManager.ts`

### Utility Files (kebab-case → camelCase)

1. `gitignore-utils.ts` → `gitignoreUtils.ts`
2. `output-helpers.ts` → `outputHelpers.ts`
3. `tool-capabilities.ts` → `toolCapabilities.ts`
4. `tool-registry.ts` → `toolRegistry.ts`
5. `read-file.ts` → `readFile.ts`
6. `write-file.ts` → `writeFile.ts`
7. `edit-file.ts` → `editFile.ts`
8. `read-many-files.ts` → `readManyFiles.ts`
9. `read-reasoning.ts` → `readReasoning.ts`
10. `web-fetch.ts` → `webFetch.ts`
11. `web-search.ts` → `webSearch.ts`
12. `write-todos.ts` → `writeTodos.ts`
13. `semantic-tools.ts` → `semanticTools.ts`
14. `goal-management.ts` → `goalManagement.ts`
15. `test-helpers.ts` → `testHelpers.ts` (already has camelCase version)

## Impact Analysis

### Breaking Changes
- **None**: All renames are internal file names
- Import paths will change but no public API changes

### Risk Assessment
- **Low Risk**: File renames with import updates
- **Medium Risk**: Large number of files to update (40+ files)
- **Mitigation**: Automated search/replace, comprehensive testing

### Testing Strategy
1. Run TypeScript compiler after each batch of renames
2. Run full test suite after all renames
3. Verify no broken imports
4. Check for any dynamic imports that might break

## Timeline Estimate

- **Phase 1 (Service Files)**: 2-3 hours
- **Phase 2 (Utility Files)**: 1-2 hours
- **Phase 3 (Constants)**: 1 hour
- **Phase 4 (Documentation)**: 1 hour
- **Total**: 5-7 hours

## Success Criteria

- [ ] All service files use camelCase naming
- [ ] All utility files use camelCase naming
- [ ] Constants follow consistent naming pattern
- [ ] All tests pass
- [ ] No TypeScript errors
- [ ] Documentation updated
- [ ] ESLint rules added (if applicable)

## Notes

- This is a large refactoring that touches many files
- Consider doing this in multiple PRs for easier review
- Automated tools (like TypeScript's rename symbol) can help
- Git history will be preserved with proper commit messages
