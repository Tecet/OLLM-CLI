# Bug Tracker - Stage 6 CLI and UI

This document tracks bugs and issues discovered during Stage 6 implementation that need to be resolved before stage completion.

## Status Legend
- 🔴 **Critical** - Blocks core functionality
- 🟡 **High** - Important but has workarounds
- 🟢 **Medium** - Should fix but not blocking
- ⚪ **Low** - Nice to have

---

## Open Issues

### 🟡 Configuration Precedence Edge Cases
**Status:** Open  
**Priority:** High  
**Component:** `packages/cli/src/config/configLoader.ts`  
**Test:** `packages/cli/src/config/__tests__/configLoader.property.test.ts`

**Description:**  
The `deepMerge` function in the configuration loader has edge cases that cause property-based tests to fail. The function doesn't correctly handle all scenarios when merging configuration values.

**Failing Scenarios:**
1. **Whitespace-only strings**: When a higher-priority config has a whitespace-only string (e.g., `" "`), it should fall back to the next non-whitespace value, but currently doesn't
   - Counterexample: `["provider.default", " ", ""]`
   - Expected: `""` (from lower priority)
   - Actual: `" "` (whitespace kept)

2. **Mixed type scenarios**: When config values have different types across layers (string vs number), the whitespace check doesn't apply correctly
   - Counterexample: `["provider.default", "!", 0, ""]`
   - Expected: `"!"` (non-empty string from lower priority)
   - Actual: `""` (empty string from highest priority)

3. **Falsy number values**: The number `0` is being treated as a missing value when it's actually valid
   - Counterexample: `{"model": {"temperature": 0}}`
   - Expected: `0` (explicit zero value)
   - Actual: `0.7` (falls back to default)

**Root Cause:**  
The `deepMerge` function only checks for whitespace-only strings when both source and target are strings. It doesn't handle:
- Cross-type comparisons (string vs number)
- Distinguishing between "missing" (undefined) and "explicitly set to falsy value" (0, false, "")

**Proposed Fix:**
```typescript
// Need to revise the deepMerge logic to:
// 1. Only skip whitespace-only strings, not all empty strings
// 2. Preserve explicit falsy values (0, false) 
// 3. Handle cross-type scenarios correctly
// 4. Consider using a "missing value" sentinel instead of relying on type checks
```

**Related Files:**
- `packages/cli/src/config/configLoader.ts` (lines 20-50)
- `packages/cli/src/config/__tests__/configLoader.property.test.ts` (Property 1 & 3)

**PBT Status:** Failed with multiple counterexamples

---

### 🟡 CLI Bundle Module Resolution
**Status:** Open  
**Priority:** High  
**Component:** `esbuild.config.js`, `dist/cli.js`  
**Test:** `packages/cli/src/__tests__/cli.test.ts`

**Description:**  
The bundled CLI (`dist/cli.js`) fails to run with `--version` and `--help` flags due to module resolution errors. The bundler is trying to import from `@ollm/core/tools` which doesn't exist as a built package.

**Error Message:**
```
Error [ERR_MODULE_NOT_FOUND]: Cannot find module 'D:\Workspaces\OLLM CLI\node_modules\@ollm\core\tools' 
imported from D:\Workspaces\OLLM CLI\dist\cli.js
```

**Failing Tests:**
- `should output version string on --version`
- `should output usage information on --help`

**Root Cause:**  
The esbuild configuration uses `packages: 'external'` which marks all node_modules as external. However, the CLI is importing from workspace packages (`@ollm/core`) that need to be bundled, not treated as external dependencies.

**Proposed Fix:**
```javascript
// Option 1: Bundle workspace packages, externalize only real node_modules
export default {
  // ...
  packages: 'external',
  external: ['react', 'ink', 'yargs', /* other npm packages */],
  // Remove packages: 'external' and explicitly list externals
};

// Option 2: Use esbuild plugins to handle workspace packages
// Option 3: Pre-build workspace packages before bundling CLI
```

**Related Files:**
- `esbuild.config.js`
- `scripts/build.js`
- `packages/cli/src/cli.tsx`

**Impact:**  
The CLI cannot be run as a standalone bundle. Users must run it through the development environment. This blocks distribution and deployment.

---

## Resolved Issues

_No resolved issues yet_

---

## Notes

### Testing Strategy
- All bugs should have corresponding property-based tests that reproduce the issue
- Fixes should be verified by running the full test suite: `npm test -- --run`
- Stage 6 cannot be marked complete until all 🔴 Critical and 🟡 High priority bugs are resolved

### Related Documentation
- [Stage 6 Requirements](.kiro/specs/stage-06-cli-ui/requirements.md)
- [Stage 6 Design](.kiro/specs/stage-06-cli-ui/design.md)
- [Stage 6 Tasks](.kiro/specs/stage-06-cli-ui/tasks.md)

---

**Last Updated:** 2026-01-13  
**Stage:** 6 - CLI and UI  
**Total Open Issues:** 2 (0 Critical, 2 High, 0 Medium, 0 Low)
