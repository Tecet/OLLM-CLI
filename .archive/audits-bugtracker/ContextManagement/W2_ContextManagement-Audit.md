#! LLM Context/GPU Audit Findings

Date: 2026-01-24
Scope:
- Context compression and thresholds
- Context size/num_ctx propagation (LLM_profiles.json)
- GPU/VRAM detection vs Ollama GPU usage
- Streaming stop behavior vs compression triggers

Sources reviewed:
- .dev/Context/Adaptive_system_Prompts.md
- .dev/Context/Checkpoint_Flow-Diagram.md
- .dev/Context/Context-Architecture.md
- .dev/Context/Prompts-Routing.md
- .dev/Context/Session-Snapshots.md
- packages/core/src/context/contextManager.ts
- packages/core/src/context/memoryGuard.ts
- packages/core/src/context/tokenCounter.ts
- packages/core/src/core/chatClient.ts
- packages/core/src/core/turn.ts
- packages/ollm-bridge/src/provider/localProvider.ts
- packages/cli/src/features/context/ModelContext.tsx
- packages/cli/src/features/context/ChatContext.tsx
- packages/cli/src/ui/App.tsx
- packages/cli/src/config/LLM_profiles.json
- packages/core/src/routing/modelDatabase.ts

Observed issue (user report):
- Context usage exceeds max (e.g., 11161/4096) without compression triggering.
- Model streams "forever" (no natural stop), suggesting num_ctx not enforced.
- Model appears to load on CPU instead of GPU; expected VRAM-based sizing and GPU offload.

Key spec expectations (from .dev/Context/*):
- Ollama should receive 85% of user context size (`num_ctx`), with compression triggering at ~80% of the 85% cap.
- Compression/snapshot should be aligned to Ollama length stops (predictable triggers).
- Context sizing should be VRAM-aware when auto-sizing is enabled.

Findings

1) Compression threshold mismatch vs spec
- Spec: Compression trigger at ~80% of 85% cap.
- Implementation: core default compression threshold is 0.95 and snapshots autoThreshold is 0.85.
  - packages/core/src/context/contextManager.ts:40-70 (DEFAULT_CONFIG)
  - Compression is checked only when assistant message is added:
    - packages/core/src/context/contextManager.ts:740-822
- App config does not override compression threshold unless config.context.compressionThreshold is set.
  - packages/cli/src/ui/App.tsx:1060-1070
Impact:
- Compression triggers later than the spec (or never if streaming never ends).
Evidence:
- `DEFAULT_CONFIG` (packages/core/src/context/contextManager.ts:52-74) still sets `compression.threshold` to 0.95 and `snapshots.autoThreshold` to 0.85, so compression is waited on until the CLI hits 95% of the 8k target instead of the ~68% (0.8 * 0.85) cap that the spec calls out.
- Threshold evaluation is only executed when `message.role === 'assistant'` (packages/core/src/context/contextManager.ts:795-820), deferring compression/snapshots until Ollama has finished responding.
- Status: **Fixed.** The default `ContextManager` configuration now sets `compression.threshold = 0.68` (packages/core/src/context/contextManager.ts:59-68), and the CLI pushes the adjusted `snapshots.autoThreshold` ratio whenever `contextActions.updateConfig` runs, so compression now fires before the Ollama cap is reached.

2) Chat path bypasses ChatClient auto-threshold syncing
- ChatClient syncs snapshot autoThreshold to `ollamaContextSize / contextSize`:
  - packages/core/src/core/chatClient.ts:139-151
- UI uses ModelContext.sendToLLM directly and never calls ChatClient.
  - packages/cli/src/features/context/ChatContext.tsx:225, 743
Impact:
- Any per-request `ollama_context_size` ratio never updates the ContextManager snapshot threshold.
- If profile context size differs from user context size, thresholds can drift from actual Ollama limits.
Evidence:
- `ChatClient` (packages/core/src/core/chatClient.ts:139-151) is the only path that updates `snapshotManager.autoThreshold` based on the `ollamaContextSize / contextSize` ratio.
- The CLI `ModelContext`/`ChatContext` workflow sends requests directly through the provider (packages/cli/src/features/context/ModelContext.tsx:715-762 and ChatContext.tsx:225,743) instead of using `ChatClient`, so the auto-threshold sync never happens in the UI path.
- Status: **Fixed.** `ModelContext.syncAutoThreshold` (packages/cli/src/features/context/ModelContext.tsx:660-720) now recalculates the ratio and calls `contextActions.updateConfig` so the UI path mirrors the ChatClient ratio; this keeps `snapshotManager.autoThreshold` aligned with the per-request `ollama_context_size`.

3) Compression only checks after assistant message commit
- ContextManager checks thresholds and compression only on assistant messages, not during streaming:
  - packages/core/src/context/contextManager.ts:766-822
- Inflight token reporting only triggers snapshotManager.checkThresholds (no compression).
  - packages/core/src/context/contextManager.ts:2096-2105
Impact:
- If streaming never finishes (or runs long), compression will not trigger mid-stream.
- This matches the “response stream goes forever” failure mode and allows usage to exceed max.
Evidence:
- `snapshotManager.checkThresholds` is nested under `if (message.role === 'assistant')` (packages/core/src/context/contextManager.ts:795-820), so only completed assistant turns trigger the check.
- `reportInflightTokens` (packages/core/src/context/contextManager.ts:2091-2117) now updates `currentTokens + inflightTokens`, reruns thresholds, and lets `ensureMidStreamGuard` queue compression before we reach `config.compression.threshold`, so inflight usage can no longer race past the cap.
- Status: **Fixed.** The new guard compresses as soon as the usage fraction (current+inflight)/maxTokens hits `compression.threshold`, and `packages/core/src/context/__tests__/contextManager.test.ts` now asserts that `compress()` runs when inflight tokens push us over the limit.

4) num_ctx appears set, but Ollama stop not guaranteed in UI path
- ModelContext sets `options.num_ctx` based on settings + LLM_profiles.json:
  - packages/cli/src/features/context/ModelContext.tsx:724-760
- LocalProvider passes `options` through to Ollama:
  - packages/ollm-bridge/src/provider/localProvider.ts:189-207
Possible gap:
- No enforcement if Ollama ignores `num_ctx` for certain models or incorrect settings.
- No fallback stop when `finish` never arrives; stream continues until user cancels.
Impact:
- The CLI can run indefinitely when models ignore `num_ctx`, leaving token counts and VRAM usage unchecked until the user manually aborts.
Evidence:
- `ModelContext` explicitly sends `options.num_ctx = ollamaContextSize` (packages/cli/src/features/context/ModelContext.tsx:755-760) but the stream loop has no secondary guard if Ollama keeps emitting tokens.
- `LocalProvider` just forwards `request.options` to Ollama (packages/ollm-bridge/src/provider/localProvider.ts:191-199) without adding any additional `num_ctx` enforcement or timeout, so the client cannot clamp streams that exceed the requested context.
- Status: **Monitoring.** We still send `options.num_ctx` but rely on the context manager’s mid-stream guard when Ollama ignores the stop; there is not yet a fail-safe break that cancels the stream automatically.

5) Auto-sizing disabled in App, VRAM not used to set context size
- App config explicitly disables auto-size:
  - packages/cli/src/ui/App.tsx:1063
Impact:
- VRAM-based context sizing (spec) never engages in the CLI UI.
- GPU detection exists (ContextManager), but autoSize=false prevents resizing to GPU capacity.
Evidence:
- The CLI `App` always forces `autoSize: false` when building `contextConfig` (packages/cli/src/ui/App.tsx:1059-1067), so the `ContextManager` never exercises its default VRAM-driven resizing behavior defined in `DEFAULT_CONFIG.autoSize`.
- Status: **Open.** Auto-sizing is still disabled in the App (`packages/cli/src/ui/App.tsx:1059-1067`), so the VRAM-aware contextManager code path never receives approval to resize for GPU capacity.

6) No GPU offload options sent to Ollama
- LocalProvider does not set `num_gpu`, `gpu_layers`, or similar options.
  - packages/ollm-bridge/src/provider/localProvider.ts:181-207
Impact:
- GPU/CPU placement is left entirely to Ollama defaults or environment variables.
 - Spec expectation (“detect GPU RAM and pass in command”) is not implemented.
Evidence:
- `LocalProvider` forwards `request.options` (temperature + num_ctx) to Ollama (packages/ollm-bridge/src/provider/localProvider.ts:191-199), so any GPU hints must originate from the CLI request builder.
- Prior versions never computed `num_gpu`/`gpu_layers`, so Ollama had no placement guidance.
- Status: **Fixed.** `ModelContext.sendToLLM` now derives `num_gpu`/`gpu_layers` from the cached `GPUInfo`, `LocalProvider.chatStream` polls the VRAM monitor and merges the same hints into every request, and `/test prompt` reuses the data so diagnostics and live requests stay aligned (`packages/cli/src/features/context/ModelContext.tsx:724-820`, `packages/ollm-bridge/src/provider/localProvider.ts:142-223`, `GPUContext.tsx`, `utilityCommands.ts`).

7) Context usage can exceed max without hard clamp
- Token counting uses length/4 heuristic (unless provider token counting is used).
  - packages/core/src/context/tokenCounter.ts:44-86
- Usage is not clamped; display can exceed 100% (e.g., 11161/4096).
  - packages/core/src/context/contextPool.ts and usage display in UI
Impact:
- UI can show usage far beyond max even if Ollama is supposed to stop.
Evidence:
- `tokenCounter.ts` falls back to `Math.ceil(text.length / 4)` whenever provider-side counting isn't available (packages/core/src/context/tokenCounter.ts:94-116), so token totals drift and may exceed the actual Ollama limits.
- `contextPool.ts:setCurrentTokens` only clamps negative values (packages/core/src/context/contextPool.ts:249-251) and never honors `maxTokens`, letting the UI display 11161/4096 even when Ollama should have stopped earlier.
- Status: **Open.** The heuristic counter still reports >100% usage and we do not clamp the displayed value to the `maxTokens` we send to Ollama.

8) Dual model/profile sources can diverge
- ModelContext uses ProfileManager (LLM_profiles.json) to pick context profiles.
  - packages/cli/src/features/context/ModelContext.tsx:724-740
- ChatClient uses ModelDatabase (generated_model_db from LLM_profiles.json).
  - packages/core/src/routing/modelDatabase.ts
Impact:
- Two paths (core ChatClient vs UI ModelContext) can diverge in behavior and thresholds.
Evidence:
- `ProfileManager` loads `LLM_profiles.json` plus persistent `~/.ollm/user_models.json` overrides (packages/cli/src/features/profiles/ProfileManager.ts:1-150), so the UI path already has a more flexible metadata source.
- The core `ModelDatabase` (packages/core/src/routing/modelDatabase.ts:218-221) is compiled from `generated_model_db` and does not incorporate the runtime overrides managed by `ProfileManager`, meaning the thresholds used by `ChatClient` can stay stale when the UI updates context/profile data.
- Status: **Fixed.** ProfileManager continues to flush the merged store into `~/.ollm/LLM_models.json`, and the core `ModelDatabase` now reloads that file (`refreshModelDatabase`) whenever the CLI resyncs, so both the UI and routing paths read the same overrides.

9) Mode transition snapshots create `session-session-*` folders
- Mode transition snapshots use a `session-${sessionId}` path, but the session IDs already include a `session-` prefix in the CLI.
- Result: empty `~/.ollm/mode-transition-snapshots/session-session-*` folders with no snapshot files.
Impact:
- Transition snapshot folders are duplicated and make it look like snapshotting is broken.
Evidence:
- `SnapshotManager.initialize`/`persistSnapshot` always prefix `session-` (packages/core/src/prompts/modeSnapshotManager.ts:93, 247, 440), while the UI provides `sessionId` already prefixed (`packages/cli/src/features/context/ContextManagerContext.tsx:340-346`).
- Status: **Fixed.** `modeSnapshotManager` now normalizes the session folder name to avoid double prefixes.

10) Auto snapshots created with empty conversations
- Auto-threshold snapshotting runs even when the context only contains system messages, producing snapshots with "Empty conversation" summaries.
Impact:
- `~/.ollm/context-snapshots` fills with low-value snapshots before any user messages.
Evidence:
- Auto-threshold callback creates a snapshot before checking for compressible messages (packages/core/src/context/contextManager.ts:329-347).
- Status: **Fixed.** Auto-threshold now skips snapshot/compression when there are no user/assistant messages or too few compressible messages.

11) Mode transition snapshots never written during normal UI mode switches
- Mode transition snapshots are only created by `HotSwapService`, which runs on explicit hot swap flows, not standard mode changes.
Impact:
- `~/.ollm/mode-transition-snapshots/session-*` folders remain empty even when users switch modes.
Evidence:
- Only `HotSwapService` invokes `SnapshotManager.createTransitionSnapshot` (`packages/core/src/context/HotSwapService.ts:62-78`); `PromptModeManager.switchMode` just emits events.
- Status: **Fixed.** The UI mode-change handler now captures a transition snapshot (if there are user messages) and persists it via the prompts snapshot manager (`packages/cli/src/features/context/ContextManagerContext.tsx`).

12) Emergency snapshots can be created with no user input
- MemoryGuard emergency snapshot creation does not check for user messages, so it can create "Empty conversation" snapshots during warmup or system-only sessions.
Impact:
- Fills `~/.ollm/context-snapshots` with low-value snapshots.
Evidence:
- `MemoryGuard.executeEmergencyActions` always creates a snapshot if the manager is present (`packages/core/src/context/memoryGuard.ts:267-279`).
- Status: **Fixed.** Emergency snapshots are skipped if there are no user messages.

13) Tier 1 rollover keeps stacking system summaries and creates empty snapshots
- Tier 1 rollover compression keeps all system messages (including previous rollover summaries), so the context never shrinks enough and repeatedly snapshots with no user messages left.
Impact:
- Multiple "Empty conversation" snapshots appear in rapid succession during rollovers, and context never stabilizes.
Evidence:
- `compressForTier1` used `systemMessages = messages.filter(role === 'system')`, which preserves all prior rollover summaries, and then snapshots the system-only context (`packages/core/src/context/contextManager.ts:1259-1292`).
- Status: **Fixed.** Tier 1 rollover now keeps only the base system prompt, skips snapshotting when no user/assistant messages exist, and summarizes only user/assistant messages.

Potential root causes (aligned to report)
- Compression not triggering: threshold too high and only checked on assistant commit; streaming never finishes.
- num_ctx enforcement not leading to stop: model-specific or server-side ignores; no client-side stop fallback.
- GPU usage not enforced: no `num_gpu`/`gpu_layers` in request; autoSize disabled in App.

Recommended next steps
- Metadata sync is complete; rerun the full context/VRAM regression suite whenever `~/.ollm/LLM_models.json` or `packages/cli/src/config/LLM_profiles.json` changes to catch any drift.
- If you want a live sanity check, manually run `/test prompt` so the system message containing the latest context/GPU dump can be inspected in an active session; the automated test already covers the payload.

## Audit status
- **Status:** Work in progress; thresholds and mid-stream guard are aligned, `/test prompt` captures the assembled payload, and the new `llm_fixes.md` tracker documents the wiring. Metadata sync is now complete; next validation is a fresh regression run plus `/test prompt`.
- **Outstanding work:** Manual `/test prompt` run and regression suite to validate the merged metadata in a live session after the pending workstation restart.
- **Next validation:** Rerun the full context/VRAM regression suite plus a manual `/test prompt` check so we can capture fresh snapshot usage data with the merged metadata.
- **Testing note:** GPU hint heuristics now have a dedicated regression (`packages/cli/src/features/context/__tests__/gpuHints.test.ts`), and the priority Vitest include list captures `.test.ts` files so the helper runs as part of `npm run test`.
- **Pending reboot:** The user is restarting the workstation; resume the metadata sync work after the restart and re-run any failing tests if the tree changes.

## Recent work
- **Metadata sync complete:** Added `refreshModelDatabase` to `@ollm/core` and call it from `ProfileManager.syncLLMModelsFile`, so every store update immediately reloads `~/.ollm/LLM_models.json` and keeps the core routing path aligned with the UI overrides (`packages/core/src/routing/modelDatabase.ts`, `packages/cli/src/features/profiles/ProfileManager.ts`).
*- **New regression guard:** Added `packages/core/src/routing/__tests__/modelDatabase.test.ts` and included the routing tests in `.dev/vitest.priority.config.ts` so the suite now verifies that writing to the runtime store + running `refreshModelDatabase` yields the expected `getContextWindow` values.
