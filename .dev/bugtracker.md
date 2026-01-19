# Bug Tracker - Stages 6 & 8 (CLI, UI, and Testing)

This document tracks bugs and issues discovered during Stage 6 (CLI and UI) and Stage 8 (Testing and QA) implementation that need to be resolved before stage completion.

## Status Legend
- [CRITICAL] **Critical** - Blocks core functionality
- [HIGH] **High** - Important but has workarounds
- [MEDIUM] **Medium** - Should fix but not blocking
- [LOW] **Low** - Nice to have

### Bug log template
```
## Bug Log: <short bug title>
- **Issue:** <one-line summary>
- **Symptoms:** <what the user sees>
- **Scope:** <where it fails; where it still works>

### Attempts
1. **Timestamp:** <YYYY-MM-DDThh:mm:ss+hh:mm>
  **Hypothesis:** <why it might be failing>
  **Plan:** <what will be changed or tested>
  **Action:** <commands/files touched>
  **Result:** <observed outcome>
  **Next step:** <what to try next>

2. **Timestamp:** <YYYY-MM-DDThh:mm:ss+hh:mm>
  **Hypothesis:** ...
  **Plan:** ...
  **Action:** ...
  **Result:** ...
  **Next step:** ...
```

---

## Bug Log: Unwanted Developer Mode Switch at Startup
- **Issue:** LLM calls `trigger_hot_swap` immediately after simple greetings like "hi", switching from Assistant to Developer mode
- **Symptoms:** User sends "hi" → LLM responds with `trigger_hot_swap` tool call → Mode switches to Developer
- **Scope:** Affects all fresh app starts in Assistant mode; impacts user experience by forcing Developer context unexpectedly
- **Status:** [CRITICAL] ✅ RESOLVED (2026-01-18)

### Root Causes Identified
1. **Tool ID Mismatch**: UI config (`toolsConfig.ts`) used `hot-swap` as ID, but actual tool (`HotSwapTool.ts`) used `trigger_hot_swap`. The `getToolState()` check failed to match, defaulting to `true` (enabled).
2. **Race Condition**: `modeManager` was null during async initialization, causing tool filtering to be skipped entirely.
3. **Leaking Tool Schema**: Even when filtering was intended, the tool was registered before mode checks.

### Attempts
1. **Timestamp:** 2026-01-18T11:52:00Z
   **Hypothesis:** Tool schemas being passed to LLM without mode filtering
   **Plan:** Add `modeManager.isToolAllowed()` filter before passing tools to LLM
   **Action:** Modified `ChatContext.tsx` to filter `toolSchemas` based on mode permissions
   **Result:** Issue persisted
   **Next step:** Check if modeManager is null

2. **Timestamp:** 2026-01-18T12:00:00Z
   **Hypothesis:** modeManager is null due to async initialization race
   **Plan:** Default to empty tools when modeManager is null
   **Action:** Added fallback `toolSchemas = []` when modeManager unavailable
   **Result:** Issue persisted
   **Next step:** Check if tools are registered from another source

3. **Timestamp:** 2026-01-18T12:10:00Z
   **Hypothesis:** Tools UI settings override filtering; tool ID mismatch
   **Plan:** Align tool IDs between UI config and actual tool implementations
   **Action:** Changed `toolsConfig.ts` IDs: `hot-swap` → `trigger_hot_swap`, `memory-dump` → `write_memory_dump`
   **Result:** ✅ **FIXED** - Tool now respects user preferences and mode filtering

### Files Modified
- `packages/cli/src/config/toolsConfig.ts` - Fixed tool ID alignment
- `packages/cli/src/features/context/ChatContext.tsx` - Added mode-based filtering and race condition safeguard
- `packages/core/src/tools/HotSwapTool.ts` - Added index signature to params
- `packages/core/src/tools/MemoryDumpTool.ts` - Added index signature to params
- `packages/core/src/prompts/PromptModeManager.ts` - Fixed lint errors

### Design Decision
Tool filtering follows this order:
1. **Mode permissions** (what the SYSTEM should offer based on active mode)
2. **User settings** (what the USER allows from their enabled tool pool)

Final tools = `Mode Allowed ∩ User Enabled`

---

## Bug Log: Test Suite Failures from Outdated References
- **Issue:** 122 tests failing due to references to removed modes and renamed classes
- **Symptoms:** Test suite shows 97% pass rate (4047/4173), with 122 failures
- **Scope:** Affects mode template tests and some integration tests; does not affect production code
- **Status:** [MEDIUM] ✅ RESOLVED (2026-01-18T23:00:00Z)

### Root Causes Identified
1. **Removed Modes**: Tests reference modes that were deleted: 'tool', 'security', 'performance', 'prototype', 'teacher'
2. **Orphaned Template Files**: Template files existed but weren't exported or used
3. **Template Imports**: Test files import deleted mode templates

### Resolution Summary
**Completed Actions:**
1. ✅ Deleted 5 orphaned template files (tool.ts, security.ts, performance.ts, prototype.ts, teacher.ts)
2. ✅ Removed 113 tests from `modeTemplates.test.ts` for deleted modes
3. ✅ Removed 3 tests from `ModeMetricsTracker.test.ts` for deleted modes
4. ✅ Fixed 1 test expectation (mostUsedMode)
5. ✅ Updated mode count expectations (10 → 5)

**Final Results:**
- **Mode-related tests:** 100% passing (127/127)
  - modeTemplates.test.ts: 39/39 ✅
  - ModeMetricsTracker.test.ts: 88/88 ✅
- **Overall test suite:** 4,062/4,158 passing (97.7%)
- **Remaining failures:** 92 UI-related tests (unrelated to mode cleanup)

### Files Modified
- ✅ `packages/core/src/prompts/templates/modes/__tests__/modeTemplates.test.ts` - Removed 113 tests
- ✅ `packages/core/src/prompts/__tests__/ModeMetricsTracker.test.ts` - Removed 3 tests, fixed 1 expectation
- ✅ Deleted: `tool.ts`, `security.ts`, `performance.ts`, `prototype.ts`, `teacher.ts`

---

## Bug Log: ContextManager Rename in Tests
- **Issue:** 4 tests failing due to old `ContextManager` class name
- **Symptoms:** Error: "ContextManager is not a constructor"
- **Scope:** Affects `chatClient.test.ts` Context Injection tests only
- **Status:** [LOW] 🔧 TODO

### Root Cause
Tests use old `ContextManager` name instead of new `DynamicContextInjector` name from refactoring.

### Failing Tests
1. "should inject context additions into system prompt"
2. "should inject context from multiple sources in priority order"
3. "should append context to existing system prompt"
4. "should inject context on every turn"

### Action Plan
1. Update imports in `chatClient.test.ts`: `ContextManager` → `DynamicContextInjector`
2. Update constructor calls to use new class name
3. Verify tests pass

**Estimated Time:** 15 minutes

### Files to Modify
- `packages/core/src/core/__tests__/chatClient.test.ts`

---

## Bug Log: UI Component Test Failures
- **Issue:** 88 UI component tests failing due to missing UIProvider context
- **Symptoms:** Error: "useUI must be used within a UIProvider"
- **Scope:** Affects multiple UI component test files; does not affect production code
- **Status:** [MEDIUM] 🔧 TODO

### Root Cause
UI components use `useUI()` hook which requires `UIProvider` wrapper, but tests don't provide it.

### Affected Test Files
- `ToolsPanel.test.tsx` (4 failures)
- `LaunchScreen.test.tsx` (4 failures)
- `TabBar.highlighting.property.test.tsx` (2 failures)
- Various other UI component tests (~78 failures)

### Action Plan
1. Create test utility wrapper with UIProvider
2. Update affected test files to use wrapper
3. Verify all UI tests pass

**Estimated Time:** 1-2 hours

### Files to Modify
- Create: `packages/cli/src/ui/test-utils/TestProviders.tsx` (wrapper utility)
- Update: ~20 test files to use wrapper

### Expected Outcome
- **100% test pass rate** (4,158/4,158)
- **All UI components properly tested** with required context
- **No breaking changes** to production code

---

## Current Modes (Reference)
Valid modes after refactoring:
1. `assistant` - General conversation
2. `planning` - Architecture and design
3. `developer` - Code implementation
4. `debugger` - Bug fixing and debugging
5. `reviewer` - Code review

**Removed modes:**
- `tool` - Merged into developer
- `security` - Merged into reviewer
- `performance` - Merged into debugger
- `prototype` - Merged into developer
- `teacher` - Merged into assistant
\n---\n\nAutomated test logs: see .dev/bug-reports/automated-test-run-2026-01-19.md (2026-01-19)\n
