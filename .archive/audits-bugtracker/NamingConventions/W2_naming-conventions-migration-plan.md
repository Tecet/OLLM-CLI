# Naming Conventions Migration Plan

**Date**: January 23, 2026  
**Task**: 27. Standardize Naming Conventions  
**Status**: Ready for Execution

## Overview

This document provides a step-by-step migration plan to standardize naming conventions across the OLLM CLI codebase. The migration is divided into phases to minimize risk and ensure thorough testing.

## Pre-Migration Checklist

- [x] Audit completed (`.dev/audits/naming-conventions-audit.md`)
- [x] Naming conventions documented (`docs/NAMING-CONVENTIONS.md`)
- [ ] All tests passing before migration
- [ ] Git working directory clean
- [ ] Create migration branch

## Phase 1: Service Files (PascalCase → camelCase)

### Files to Rename (29 files)

| Current Name | New Name | Location |
|--------------|----------|----------|
| `ContextConfigService.ts` | `contextConfigService.ts` | `packages/cli/src/features/context/` |
| `EditorIntegration.ts` | `editorIntegration.ts` | `packages/cli/src/ui/components/code-editor/` |
| `ErrorHandler.ts` | `errorHandler.ts` | `packages/cli/src/ui/utils/` |
| `FileOperations.ts` | `fileOperations.ts` | `packages/cli/src/ui/components/file-explorer/` |
| `FileTreeService.ts` | `fileTreeService.ts` | `packages/cli/src/ui/components/file-explorer/` |
| `FocusSystem.ts` | `focusSystem.ts` | `packages/cli/src/ui/components/file-explorer/` |
| `FollowModeService.ts` | `followModeService.ts` | `packages/core/src/services/` |
| `GitStatusService.ts` | `gitStatusService.ts` | `packages/cli/src/services/` |
| `HotSwapService.ts` | `hotSwapService.ts` | `packages/core/src/services/` |
| `HybridModeManager.ts` | `hybridModeManager.ts` | `packages/core/src/services/` |
| `KeybindsService.ts` | `keybindsService.ts` | `packages/cli/src/services/` |
| `LanceDBSetup.ts` | `lanceDBSetup.ts` | `packages/core/src/rag/` |
| `ModeMetricsTracker.ts` | `modeMetricsTracker.ts` | `packages/core/src/services/` |
| `ModeTransitionAnimator.ts` | `modeTransitionAnimator.ts` | `packages/core/src/services/` |
| `ModeTransitionSuggester.ts` | `modeTransitionSuggester.ts` | `packages/core/src/services/` |
| `PathSanitizer.ts` | `pathSanitizer.ts` | `packages/core/src/utils/` |
| `PlanningModeRestrictions.ts` | `planningModeRestrictions.ts` | `packages/core/src/services/` |
| `ProfileManager.ts` | `profileManager.ts` | `packages/cli/src/services/` |
| `PromptModeManager.ts` | `promptModeManager.ts` | `packages/core/src/prompts/` |
| `PromptRegistry.ts` | `promptRegistry.ts` | `packages/core/src/prompts/` |
| `ProjectModeMemory.ts` | `projectModeMemory.ts` | `packages/core/src/services/` |
| `RAGSystem.ts` | `ragSystem.ts` | `packages/core/src/rag/` |
| `SnapshotManager.ts` | `snapshotManager.ts` | `packages/core/src/context/` |
| `SnapshotParser.ts` | `snapshotParser.ts` | `packages/core/src/context/` |
| `SystemPromptBuilder.ts` | `systemPromptBuilder.ts` | `packages/core/src/prompts/` |
| `ToolSupportMessages.ts` | `toolSupportMessages.ts` | `packages/core/src/tools/` |
| `VisionService.ts` | `visionService.ts` | `packages/core/src/vision/` |
| `WorkflowManager.ts` | `workflowManager.ts` | `packages/core/src/services/` |
| `WorkspaceManager.ts` | `workspaceManager.ts` | `packages/cli/src/services/` |

### Migration Steps

1. **Backup**: Create git branch `refactor/naming-conventions`
2. **Rename Files**: Use git mv to preserve history
3. **Update Imports**: Search and replace import statements
4. **Update Tests**: Rename corresponding test files
5. **Verify**: Run TypeScript compiler
6. **Test**: Run full test suite

### Commands

```bash
# Create branch
git checkout -b refactor/naming-conventions

# Rename files (example for first file)
git mv packages/cli/src/features/context/ContextConfigService.ts packages/cli/src/features/context/contextConfigService.ts

# Update imports (will be done programmatically)
# Search for: from './ContextConfigService'
# Replace with: from './contextConfigService'

# Verify TypeScript
npm run build

# Run tests
npm test
```

## Phase 2: Utility Files (kebab-case → camelCase)

### Files to Rename (15 files)

| Current Name | New Name | Location |
|--------------|----------|----------|
| `gitignore-utils.ts` | `gitignoreUtils.ts` | `packages/core/src/utils/` |
| `output-helpers.ts` | `outputHelpers.ts` | `packages/core/src/utils/` |
| `tool-capabilities.ts` | `toolCapabilities.ts` | `packages/core/src/tools/` |
| `tool-registry.ts` | `toolRegistry.ts` | `packages/core/src/tools/` |
| `read-file.ts` | `readFile.ts` | `packages/core/src/tools/` |
| `write-file.ts` | `writeFile.ts` | `packages/core/src/tools/` |
| `edit-file.ts` | `editFile.ts` | `packages/core/src/tools/` |
| `read-many-files.ts` | `readManyFiles.ts` | `packages/core/src/tools/` |
| `read-reasoning.ts` | `readReasoning.ts` | `packages/core/src/tools/` |
| `web-fetch.ts` | `webFetch.ts` | `packages/core/src/tools/` |
| `web-search.ts` | `webSearch.ts` | `packages/core/src/tools/` |
| `write-todos.ts` | `writeTodos.ts` | `packages/core/src/tools/` |
| `semantic-tools.ts` | `semanticTools.ts` | `packages/core/src/tools/` |
| `goal-management.ts` | `goalManagement.ts` | `packages/core/src/services/` |
| `test-helpers.ts` | `testHelpers.ts` | `packages/cli/src/test/` (if duplicate) |

### Migration Steps

Same as Phase 1, but for utility files.

## Phase 3: Constant Naming Standardization

### Review Required

Need to review all constants and apply consistent naming:
- Primitive constants → UPPER_SNAKE_CASE
- Complex objects → camelCase

### Files to Review

1. `packages/test-utils/src/testHelpers.ts` - DEFAULT_SERVER_URL (already correct)
2. `packages/test-utils/src/index.ts` - TEST_UTILS_VERSION (already correct)
3. `packages/test-utils/src/uiTestHelpers.ts` - mockTheme, mockKeybinds (already correct)
4. All configuration files in `packages/cli/src/config/`
5. All service files with constants

### Migration Steps

1. **Audit**: Review each file for constants
2. **Categorize**: Determine if primitive or complex
3. **Rename**: Apply appropriate naming convention
4. **Test**: Verify no breakage

## Phase 4: Documentation and Enforcement

### Tasks

1. **Update CONTRIBUTING.md**: Add naming conventions section
2. **Update ESLint Config**: Add naming convention rules
3. **Update Code Review Checklist**: Include naming checks
4. **Create Pre-commit Hook**: Enforce naming conventions

### ESLint Rules to Add

```javascript
// eslint.config.js additions
{
  rules: {
    '@typescript-eslint/naming-convention': [
      'error',
      {
        selector: 'class',
        format: ['PascalCase'],
      },
      {
        selector: 'interface',
        format: ['PascalCase'],
      },
      {
        selector: 'typeAlias',
        format: ['PascalCase'],
      },
      {
        selector: 'enum',
        format: ['PascalCase'],
      },
      {
        selector: 'variable',
        format: ['camelCase', 'UPPER_CASE'],
        leadingUnderscore: 'forbid',
        trailingUnderscore: 'forbid',
      },
      {
        selector: 'function',
        format: ['camelCase', 'PascalCase'],
      },
      {
        selector: 'parameter',
        format: ['camelCase'],
        leadingUnderscore: 'allow',
      },
      {
        selector: 'method',
        format: ['camelCase'],
      },
    ],
  },
}
```

## Testing Strategy

### After Each Phase

1. **TypeScript Compilation**: `npm run build`
2. **Linting**: `npm run lint`
3. **Unit Tests**: `npm test`
4. **Integration Tests**: `npm run test:integration` (if available)
5. **Manual Testing**: Test key features in CLI

### Regression Testing

- [ ] Chat functionality works
- [ ] File explorer works
- [ ] Tool execution works
- [ ] MCP integration works
- [ ] Context management works
- [ ] All tabs render correctly

## Rollback Plan

If issues are discovered:

1. **Immediate**: `git checkout main` to revert
2. **Partial**: Cherry-pick successful changes
3. **Investigation**: Identify root cause
4. **Fix**: Address issues and retry

## Risk Mitigation

### Low Risk Items
- File renames (git preserves history)
- Import path updates (TypeScript will catch errors)

### Medium Risk Items
- Dynamic imports (need manual verification)
- String-based file references (need search)

### High Risk Items
- None identified (all changes are mechanical)

## Success Criteria

- [ ] All 29 service files renamed to camelCase
- [ ] All 15 utility files renamed to camelCase
- [ ] All imports updated correctly
- [ ] All tests passing
- [ ] No TypeScript errors
- [ ] No ESLint errors
- [ ] Documentation updated
- [ ] ESLint rules added

## Timeline

- **Phase 1**: 2-3 hours (service files)
- **Phase 2**: 1-2 hours (utility files)
- **Phase 3**: 1 hour (constants)
- **Phase 4**: 1 hour (documentation)
- **Testing**: 1 hour (comprehensive testing)
- **Total**: 6-8 hours

## Notes

- Use `git mv` to preserve file history
- Update imports in batches to avoid conflicts
- Run tests after each batch of changes
- Commit frequently with clear messages
- Consider using automated refactoring tools

## Automated Migration Script

```bash
#!/bin/bash
# migrate-naming-conventions.sh

# Phase 1: Service Files
echo "Phase 1: Renaming service files..."

# Array of files to rename (old_name:new_name:path)
declare -a service_files=(
  "ContextConfigService.ts:contextConfigService.ts:packages/cli/src/features/context"
  "EditorIntegration.ts:editorIntegration.ts:packages/cli/src/ui/components/code-editor"
  "ErrorHandler.ts:errorHandler.ts:packages/cli/src/ui/utils"
  # ... add all files
)

for file_info in "${service_files[@]}"; do
  IFS=':' read -r old_name new_name path <<< "$file_info"
  if [ -f "$path/$old_name" ]; then
    echo "Renaming $path/$old_name to $path/$new_name"
    git mv "$path/$old_name" "$path/$new_name"
  fi
done

# Update imports
echo "Updating imports..."
# This would use a more sophisticated tool like jscodeshift or ts-morph

# Verify
echo "Verifying TypeScript compilation..."
npm run build

echo "Running tests..."
npm test

echo "Migration complete!"
```

## Post-Migration Tasks

1. **Update Documentation**: Ensure all docs reference new file names
2. **Update Examples**: Update code examples in docs
3. **Update Scripts**: Update any scripts that reference old file names
4. **Announce Changes**: Notify team of naming convention changes
5. **Monitor**: Watch for any issues in production

## Conclusion

This migration plan provides a systematic approach to standardizing naming conventions across the OLLM CLI codebase. By following these phases and testing thoroughly, we can ensure a smooth transition with minimal risk.
