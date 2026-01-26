Deep audit of context management (conversation & compression)
===========================================================

Scope
-----
- Inspected core context manager, snapshot manager, compression service and related CLI glue.
- Files reviewed (representative):
  - packages/core/src/context/contextManager.ts
  - packages/core/src/context/snapshotManager.ts
  - packages/core/src/context/compressionService.ts
  - packages/core/src/context/types.ts
  - packages/cli/src/features/context/ChatContext.tsx
  - packages/cli/src/features/context/ContextManagerContext.tsx
  - packages/cli/src/features/context/ModelContext.tsx
  - packages/ollm-bridge/src/provider/localProvider.ts

Executive summary
-----------------
- The core summarization/compression flow is implemented end-to-end: snapshot → compress (LLM) → replace context → emit UI events. UI handlers in the CLI surface progress and generated summaries.
- Overall design is sound, with reentrancy guards, inflight token accounting, and timeout forwarding for long LLM operations.
- Several consistency and robustness issues were found that merit fixes to avoid subtle bugs, race conditions, and incorrect error handling.

Findings & recommended fixes (actionable)
----------------------------------------

1) Inconsistent summary-timeout forwarding in compression strategies

  - Files: [packages/core/src/context/compressionService.ts](packages/core/src/context/compressionService.ts)
  - Issue: `summarize()` calls `generateLLMSummary(messagesToSummarize, strategy.summaryMaxTokens, strategy.summaryTimeout)` but `hybrid()` calls `generateLLMSummary(middleMessages, strategy.summaryMaxTokens)` without passing `strategy.summaryTimeout`.
  - Risk: hybrid strategy will use default timeout (2m inside service), but configuration or caller may intend a custom shorter/longer timeout. This inconsistency can lead to surprising failures or timeouts.
  - Fix: Always pass `strategy.summaryTimeout` (or manager-provided default) into `generateLLMSummary` from every caller (summarize/hybrid).

2) Floating-point equality used when testing configured threshold in snapshot manager

  - Files: [packages/core/src/context/snapshotManager.ts](packages/core/src/context/snapshotManager.ts)
  - Issue: In `checkThresholds()` the code compares `threshold === this.config.autoThreshold` to skip callbacks when `autoCreate` is disabled. Because thresholds are floating-point numbers (e.g., 0.8), strict equality may fail if slightly different numeric representations are used.
  - Risk: The skip logic might not run when expected, causing auto-threshold callbacks to fire unexpectedly.
  - Fix: Use approximate comparison or normalize thresholds to the same canonical form (e.g., multiply by 100 and round to integer percentages) when used as Map keys or in comparisons.

3) Duplicate/duplicative threshold callback registration allowed (potential repeated callbacks)

  - Files: [packages/core/src/context/snapshotManager.ts](packages/core/src/context/snapshotManager.ts)
  - Issue: `onContextThreshold()` pushes callbacks without deduping. If the same callback is registered multiple times (likely during re-init or hot reload), the callback will run repeatedly.
  - Risk: Re-entrant summarization or duplicate UI messages.
  - Fix: Add deduplication by storing a Set per threshold or check function identity before pushing.

4) Provider timeout semantics and Abort handling mismatch

  - Files: [packages/ollm-bridge/src/provider/localProvider.ts](packages/ollam-bridge/src/provider/localProvider.ts) and [packages/core/src/context/compressionService.ts](packages/core/src/context/compressionService.ts)
  - Issue: `localProvider.chatStream()` calls `controller.abort(new Error('...'))` on timeout. Code paths elsewhere expect `AbortError` (e.g., checks for `error.name === 'AbortError'`) and can treat a normal `Error` differently.
  - Risk: Timeouts may be surfaced as generic errors instead of aborts; cleanup logic depending on `AbortError` may not run, causing leaked state or misclassification of errors as fatal.
  - Fix: Use `controller.abort()` without a non-AbortError reason or set the reason to a DOMException-like object with name 'AbortError', or adjust caller error handling to detect timeout strings as a fallback. Prefer using the platform recommended pattern: `controller.abort()` and rely on fetch to throw an `AbortError`.

5) Inexact/fragile comparison of tool-unsupported errors and propagation

  - Files: [packages/ollm-bridge/src/provider/localProvider.ts](packages/ollam-bridge/src/provider/localProvider.ts), [packages/cli/src/features/context/ModelContext.tsx](packages/cli/src/features/context/ModelContext.tsx)
  - Issue: Pattern-based detection of tool errors is used in multiple places. The provider emits an `{ type: 'error', error: { code: 'TOOL_UNSUPPORTED', ... } }` for some paths, but other error flows parse text patterns. The code then retries without tools and signals `TOOL_UNSUPPORTED` to the upper layers.
  - Risk: False positives or false negatives in detection; duplicated retries; inconsistent user-facing messages.
  - Fix: Standardize a single structured error format across provider adapters (e.g., always include `error.code` for tool errors) and update consumers to rely primarily on `error.code`, falling back to textual heuristics only as a last resort.

6) Inflight token accounting: flush/timer race and missing clear on retry

  - Files: [packages/cli/src/features/context/ChatContext.tsx](packages/cli/src/features/context/ChatContext.tsx), [packages/core/src/context/contextManager.ts](packages/core/src/context/contextManager.ts)
  - Issue: ChatContext batches estimated tokens and flushes every 500ms; on early cancellation or mid-generation compression, code tries to flush and then `contextActions.clearInflightTokens()`. There are code paths that call `cancelRequest()` then re-enter the loop and re-dispatch messages. If the inflight accumulator or flush timer is not cleaned deterministically, `reportInflightTokens` may see duplicate or stale deltas.
  - Risk: The threshold check in `snapshotManager.checkThresholds` uses `currentTokens + inflightTokens`; double-reporting can prematurely trigger compression or snapshots.
  - Fixes:
    - Ensure atomic flush-and-clear: when a retry path cancels a generation, always clear `inflightFlushTimerRef` and `inflightTokenAccumulatorRef` before re-dispatching.
    - Add a short mutex around the flush handler to avoid overlapping flushes.
    - Consider moving inflight accounting entirely into `ModelContext.sendToLLM` so manager sees precise events (onText/onChunk) rather than UI estimates.

7) Hybrid compression path may produce 'summary' message but ChatContext expects `summary-` id format

  - Files: [packages/core/src/context/compressionService.ts](packages/core/src/context/compressionService.ts), [packages/cli/src/features/context/ChatContext.tsx](packages/cli/src/features/context/ChatContext.tsx)
  - Issue: Compression returns a `summary` Message with id `summary-${Date.now()}` and role 'system'. ChatContext looks for messages whose `id` starts with `summary-` after calling `contextActions.getContext()` in `handleCompressed`. This is fine, but `auto-summary-created` event (emitted elsewhere) contains the summary in-line; some code paths rely on scanning messages to extract the summary while others use the event payload. Maintain a single canonical source of truth to avoid race conditions.
  - Fix: Prefer including the summary text in the `compressed`/`auto-summary-created` event payload and let the UI use that payload instead of scanning the manager's messages, which may race with persistence/cleanup.

8) SnapshotManager.checkThresholds uses usage >= threshold but threshold semantics mix fraction vs percentage

  - Files: [packages/core/src/context/snapshotManager.ts](packages/core/src/context/snapshotManager.ts) and [packages/core/src/context/contextManager.ts](packages/core/src/context/contextManager.ts)
  - Issue: `ContextManager` calls `this.snapshotManager.checkThresholds(this.currentContext.tokenCount + this.inflightTokens, this.currentContext.maxTokens)` where `checkThresholds` computes `usage = currentTokens / maxTokens`. The thresholds are configured as fractions (0.8) in config. Elsewhere code compares usage >= `this.config.compression.threshold * 100` in `addMessage()` — e.g., `if (usage.percentage >= this.config.compression.threshold * 100)`. Mixing fraction vs percentage in different places is confusing and error-prone.
  - Fix: Normalize the unit across the codebase: either always use fractions (0..1) or always use percentages (0..100). Update comments and the `ContextUsage.percentage` semantics to be unambiguous.

9) Missing defensive checks when manager not initialized

  - Files: [packages/cli/src/features/context/ContextManagerContext.tsx](packages/cli/src/features/context/ContextManagerContext.tsx)
  - Issue: Many actions in `actions` call `managerRef.current` without null-checks (some use optional chaining). Some callbacks registered to manager events assume `manager` remains valid, but the provider unmount path clears refs asynchronously.
  - Risk: Rare race where UI tries to call into manager during teardown causing uncaught exceptions.
  - Fix: Harden action wrappers to early-return with clear errors if `managerRef.current` is null and guard event handlers with existence checks.

10) Minor: floating id generation patterns and inconsistent system prompt tracking

  - Files: [packages/core/src/context/contextManager.ts](packages/core/src/context/contextManager.ts), [packages/cli/src/features/context/ChatContext.tsx](packages/cli/src/features/context/ChatContext.tsx)
  - Note: System prompt replacement uses `system-${Date.now()}` ids generated at different times; this is fine but makes deterministic testing harder. Consider a small helper to create system prompt ids for consistent formatting and easier debugging.

Prioritized next steps
----------------------
1. Fix the timeout forwarding inconsistency in `CompressionService.hybrid()` (high impact, low risk).
2. Standardize threshold units (fraction vs percentage) across `ContextManager` / `SnapshotManager` / UI (medium impact).
3. Harden inflight token flush/clear logic in `ChatContext` and ensure atomic clear on cancel/retry (high impact for correctness under streaming).
4. Adjust provider abort semantics in `LocalProvider.chatStream` to use platform-standard `AbortError` behavior (high impact for error classification).
5. Deduplicate snapshot threshold callbacks in `SnapshotManagerImpl.onContextThreshold` (low effort).

Appendix — Quick links to inspected files
--------------------------------------
- [packages/core/src/context/contextManager.ts](packages/core/src/context/contextManager.ts)
- [packages/core/src/context/snapshotManager.ts](packages/core/src/context/snapshotManager.ts)
- [packages/core/src/context/compressionService.ts](packages/core/src/context/compressionService.ts)
- [packages/core/src/context/types.ts](packages/core/src/context/types.ts)
- [packages/cli/src/features/context/ChatContext.tsx](packages/cli/src/features/context/ChatContext.tsx)
- [packages/cli/src/features/context/ContextManagerContext.tsx](packages/cli/src/features/context/ContextManagerContext.tsx)
- [packages/cli/src/features/context/ModelContext.tsx](packages/cli/src/features/context/ModelContext.tsx)
- [packages/ollm-bridge/src/provider/localProvider.ts](packages/ollm-bridge/src/provider/localProvider.ts)

If you'd like, I can now:
- apply the small code fixes described (I can open PR-style patches for each), or
- run an end-to-end CLI scenario reproducing summarization + resume with verbose logging to capture any remaining races and heap footprint.
