# Lint Fixes Needed After Refactoring

## Critical Fixes (In Our Refactored Code)

### 1. ChatContext.tsx line 487

- `message` is assigned but never used
- Need to check if this is a bug or intentional

### 2. ContextManagerContext.tsx lines 171-172

- `setVRAM` and `setMemoryLevel` are assigned but never used
- These might be needed for future functionality - prefix with `_` if intentional

### 3. ModelContext.tsx line 109 ✅ FIXED

- `contextActions` unused - prefixed with `_`

### 4. contextSizing.ts line 77

- `contextCapRatio` parameter unused
- Check if this parameter is still needed after refactoring

### 5. App.tsx line 257

- `rightPanelFullHeight` calculated but never used
- Remove if not needed

### 6. App.tsx lines 444, 474

- `require()` style imports forbidden
- Convert to ES6 imports

### 7. HeaderBar.tsx line 20

- `connection` parameter unused
- Remove from interface if not needed

### 8. SidePanel.tsx

- `useStdout` imported but never used
- `HeaderBar` imported but never used
- `connection`, `model`, `gpu` parameters unused
- Clean up unused imports and parameters

## Non-Critical (Test Files & Backup Files)

### Backup Files (.dev/backup-before-refactoring)

- 17 errors in old backup files
- Can be ignored or moved to .legacy

### Test Files

- Various unused imports in test files
- Lower priority, fix when touching those files

## Action Plan

1. ✅ Fix ModelContext.tsx - DONE
2. Check ChatContext.tsx line 487 for potential bug
3. Clean up ContextManagerContext.tsx unused state setters
4. Remove unused parameter from contextSizing.ts
5. Clean up App.tsx unused variable and require() imports
6. Clean up HeaderBar.tsx and SidePanel.tsx unused parameters
7. Move .dev/backup-before-refactoring to .legacy
