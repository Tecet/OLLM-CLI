# Post‑Alpha Works Audit (Context, Compression, Modes, Prompt Builder)

**Date:** 2026-01-31  
**Scope:** Context mechanics, compression pipeline, mode system, prompt builder, and KnowledgeDB doc freshness  
**Inputs Reviewed:**  
- `.dev/backlog/29-01-2026-Sesions-Rework/*`  
- `.dev/backlog/30-01-2026-PublishAlpha/*`  
- `.dev/docs/knowledgeDB/*`  
- Core + CLI implementation under `packages/core/src/context` and `packages/cli/src/features/context`

---

## Executive Summary

The refactor to a single `ContextOrchestrator` is real and largely wired, but several **behavioral regressions and mismatches** remain. The most critical gaps are: **tools effectively disabled by default**, **snapshots list/metadata broken**, **sanity checks dropped on mode changes**, **tier logic and budgets inconsistent across modules**, and **session history not persisted**.  
Additionally, several KnowledgeDB documents are **out of date** with the new architecture, which will mislead future maintenance.

---

## Verification Snapshot

**Where the system matches intended design**
- Context orchestration is centralized in `ContextOrchestrator` (legacy system removed).  
  File: `packages/core/src/context/orchestration/contextOrchestrator.ts`
- Prompt templates are loaded from disk and assembled dynamically.  
  File: `packages/core/src/context/SystemPromptBuilder.ts`
- Mode switching updates system prompt via `ContextOrchestratorAdapter.setMode()`.  
  File: `packages/core/src/context/adapters/contextOrchestratorAdapter.ts`

**Where it does NOT match intended design**
- Tool defaults are empty, resulting in **no tools in prompts** for new installs.  
  File: `packages/cli/src/config/settingsService.ts`
- Snapshot listing and metadata are non-functional.  
  File: `packages/core/src/context/adapters/contextOrchestratorAdapter.ts`
- Session history persistence is not invoked, despite storage layer existing.  
  File: `packages/core/src/context/storage/sessionHistoryManager.ts`

---

## Findings (By Area)

### 1) Context Mechanics

**High**
- **Tier calculation is hardcoded**, conflicting with design docs that map tiers to profile indices.  
  Files:  
  - `packages/core/src/context/contextManagerFactory.ts`  
  - `packages/core/src/context/ContextSizeCalculator.ts`  
  - `packages/core/src/context/adapters/contextOrchestratorAdapter.ts`  
  Impact: Incorrect tier selection for non-standard profiles; tier budgets and prompts may be wrong.  
  Proposed fix: Centralize tier mapping using profile index logic (from `LLM_profiles.json`) in one module and reuse everywhere.

**Medium**
- **Ollama limit fallback uses runtime 85% calculation**, contradicting "no runtime 85%" rule.  
  Files:  
  - `packages/core/src/context/contextManagerFactory.ts`  
  - `packages/core/src/context/ContextSizeCalculator.ts`  
  - `packages/cli/src/features/context/ContextManagerContext.tsx` (resize fallback)  
  Impact: Violates design rule and can diverge from profile data.  
  Proposed fix: If profile missing, explicitly warn and require profile refresh instead of calculating.

**Medium**
- **Session history is never saved** unless some external caller invokes `saveHistory()` (none found).  
  Files:  
  - `packages/core/src/context/orchestration/contextOrchestrator.ts`  
  - `packages/core/src/context/storage/sessionHistoryManager.ts`  
  Impact: History is kept in memory only; persistence promises in docs are not met.  
  Proposed fix: Save on each `addMessage()` or on a debounce (e.g., every N messages).

---

### 2) Compression & Snapshots

**High**
- **Snapshots list is non-functional**: adapter returns `[]`, blocking `/snapshot list`, `/snapshot rollback`, UI snapshots.  
  File: `packages/core/src/context/adapters/contextOrchestratorAdapter.ts`  
  Impact: Snapshot commands appear to work but cannot enumerate or show snapshots.  
  Proposed fix: Expose `SnapshotLifecycle.listSnapshots()` via adapter.

**High**
- **Snapshot metadata is incorrect**: `sessionId` set to `'default'`, model `'unknown'`.  
  File: `packages/core/src/context/adapters/contextOrchestratorAdapter.ts`  
  Impact: Snapshots are unusable for accurate recovery or audit.  
  Proposed fix: Plumb real session/model metadata from `ContextOrchestratorConfig`.

**Medium**
- **Emergency actions do not update active context** after compress/merge.  
  Files:  
  - `packages/core/src/context/orchestration/contextOrchestrator.ts`  
  - `packages/core/src/context/checkpoints/emergencyActions.ts`  
  Impact: Emergency path reports success but leaves context unchanged → likely still overflowed.  
  Proposed fix: Apply updated checkpoint(s) to `ActiveContextManager` on success.

**Medium**
- **Snapshots store only recent messages**, not full conversation history.  
  File: `packages/core/src/context/orchestration/contextOrchestrator.ts`  
  Impact: Incomplete recovery compared to docs that state "full conversation state".  
  Proposed fix: Decide: either update docs or include full history from `SessionHistoryManager`.

---

### 3) Modes & Tooling

**High**
- **Default tool sets are empty**, resulting in *no tools passed* to the LLM on fresh installs.  
  File: `packages/cli/src/config/settingsService.ts`  
  Impact: Tool routing breaks across all modes; contradicts `TOOL_OVERLOAD_FIX.md` and `dev_ToolsManager.md`.  
  Proposed fix: Restore intended defaults (limited tool lists per mode).

**Medium**
- **Tool naming inconsistency**: prompt parsing uses kebab-case (`read-file`) while actual tools are snake_case (`read_file`).  
  File: `packages/core/src/context/integration/promptOrchestratorIntegration.ts`  
  Impact: Any logic relying on parsed tools will mis-detect them.  
  Proposed fix: Update tool keyword list to snake_case.

---

### 4) Prompt Builder

**High**
- **Sanity checks are dropped on mode changes**.  
  File: `packages/core/src/context/orchestration/contextOrchestrator.ts` (`rebuildSystemPrompt`)  
  Impact: Tier 1–2 safeguards disappear after switching modes, contrary to requirements.  
  Proposed fix: Use `useSanityChecks = tier <= TIER_2_BASIC`.

**Medium**
- **Tier prompt budgets conflict** between modules.  
  Files:  
  - `packages/core/src/context/integration/tierAwareCompression.ts`  
  - `packages/core/src/context/promptOrchestrator.ts`  
  Impact: Budget enforcement is inconsistent; validation may pass in one layer and fail in another.  
  Proposed fix: Single source of truth for tier budgets.

**Medium**
- **Prompt component order mismatch** with documented order.  
  File: `packages/core/src/context/integration/promptOrchestratorIntegration.ts`  
  Impact: The final prompt order is `tierPrompt -> basePrompt`, but docs state core mandates/skills/tools then tier prompt.  
  Proposed fix: Align order or update documentation to match reality.

**Low**
- **Token counting in prompt integration uses a 4-char heuristic** instead of actual token counter.  
  File: `packages/core/src/context/integration/promptOrchestratorIntegration.ts`  
  Impact: Budget decisions less accurate.  
  Proposed fix: Pass `TokenCounterService` into integration.

---

## KnowledgeDB Freshness Audit

**Up-to-date**
- `dev_PromptComponents.md`  
- `dev_ToolsManager.md`

**Out of date / Misaligned**
- `dev_ContextManagement.md`  
  - References `ConversationContextManager` and `contextManager.ts` (removed).  
  - Describes tier mapping by profiles (not implemented in code).  
- `dev_ContextCompression.md`  
  - Mentions feature flags and legacy fallback (removed).  
  - Uses outdated tier budgets.  
- `dev_ContextSnapshots.md`  
  - References `snapshotCoordinator.ts` (does not exist).  
  - States snapshots capture full history; code captures recent messages only.  
- `dev_SessionStorage.md`  
  - Describes ChatRecordingService flow, but new context history uses `SessionHistoryManager` in a different path (`.ollm/context-storage`).  
  - Should clarify dual systems or consolidate.

**Action:** Update the four documents above to match the new single-system architecture and current storage paths.

---

## Legacy / Cleanup Candidates

These appear unused or legacy with the current ContextOrchestrator flow:
- `packages/core/src/context/contextPool.ts`  
- `packages/core/src/context/memoryGuard.ts`  
- `packages/core/src/context/vramMonitor.ts`  
- `packages/core/src/context/ContextSizeCalculator.ts` (if tier mapping is moved to profile index logic)  
- `packages/core/src/context/promptOrchestrator.ts` (parts not used, e.g., `updateSystemPrompt`)

**Recommendation:** Either integrate them deliberately or document as legacy and move to `.legacy/` to reduce confusion.

---

## Proposed Rework Plan (Concrete)

### Phase 1 — Bug Fixes (Short-term)
1. Restore tool defaults per mode in `SettingsService`.  
2. Fix `ContextOrchestrator.rebuildSystemPrompt()` to respect tier sanity checks.  
3. Implement snapshot listing and correct metadata in adapter.  
4. Persist session history automatically (debounced or per-message).  
5. Align tier budgets between `TierAwareCompression` and `PromptOrchestrator`.

### Phase 2 — Design Alignment (Medium-term)
1. Decide canonical tier mapping (profile index vs size thresholds) and implement once.  
2. Remove runtime 85% fallback or downgrade to explicit warning + profile refresh.  
3. Align prompt component ordering with docs and update templates if needed.

### Phase 3 — Cleanup & Docs (Medium-term)
1. Update KnowledgeDB docs listed above.  
2. Remove or migrate legacy/unused modules.  
3. Add tests for: snapshot listing, sanity checks persistence, tool defaults, tier mapping.

---

## Tests to Add/Restore

- Tool defaults per mode: ensure at least 3 tools are enabled by default.  
  File: `packages/cli/src/config/settingsService.ts`  
- Sanity checks survive mode change at Tier 1–2.  
  File: `packages/core/src/context/orchestration/contextOrchestrator.ts`  
- Snapshot list/rollback works end-to-end via `/snapshot` commands.  
  Files: `packages/cli/src/commands/snapshotCommands.ts`, adapter, snapshot lifecycle  
- Tier mapping uses profile index when profiles are irregular (non-4/8/16/32k).  

---

## Conclusion

The context refactor is structurally correct, but **several user-visible behaviors are broken or inconsistent**.  
The highest-impact fixes are restoring tool defaults, ensuring sanity checks persist, and exposing snapshots properly.  
Documentation updates are also overdue and should be done immediately to avoid further drift.

