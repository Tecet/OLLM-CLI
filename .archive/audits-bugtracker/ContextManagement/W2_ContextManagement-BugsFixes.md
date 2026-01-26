# LLM Fixes Tracker

This file keeps the context/VRAM guard, prompt composition, and snapshot wiring documented so future work does not drift apart from the strict source-of-truth that drives Ollama behavior.

## Core goals
1. **Treat `packages/cli/src/config/LLM_profiles.json` as the immutable catalog.** It is generated via `node scripts/generate_model_db.js` → `packages/core/src/routing/generated_model_db.ts` and no part of the CLI should write back to it.
2. **Mirror the catalog with local overrides.** `ProfileManager` merges the shipped catalog with `~/.ollm/user_models.json`, normalizes every profile to include `ollama_context_size`, `max_context_window`, `quantization`, and `vram_estimate` metadata, and persists the resolved view to `~/.ollm/LLM_models.json`.
3. **Propagate the merged metadata into every prompt.** `contextSizing` (`packages/cli/src/features/context/contextSizing.ts`) clamps requests against `max_context_window`, copies `ollama_context_size` straight from the merged profile, and lets `SettingsService` (e.g. `packages/cli/src/config/settingsService.ts:212`) remember the final `contextSize` so the UI and CLI agree on the cap.
4. **Keep the guard, compression, and snapshot thresholds in sync with the cap we pass to Ollama.** `ModelContext` feeds `contextSizing.ollamaContextSize` into `options.num_ctx` and `syncAutoThreshold`, while `ContextManager` (`packages/core/src/context/contextManager.ts`) enforces compressor activity (mid-stream guard, snapshot auto-thresholds) before usage matches the sent `num_ctx`.

## Source-of-truth wiring (catalog → user folder → provider)
- `LLM_profiles.json` is the ReadOnly catalog; any future DB updates must follow the same `node scripts/generate_model_db.js` → `packages/core/src/routing/generated_model_db.ts` pipeline.
- `ProfileManager` (`packages/cli/src/features/profiles/ProfileManager.ts`) watches installed models, records overrides in `~/.ollm/user_models.json`, falls back to `llama3.2:3b` whenever Ollama returns unfamiliar metadata, and writes the merged & normalized store to `~/.ollm/LLM_models.json` so every consumer (context sizing, UI, commands) reads the same `max_context_window`, `ollama_context_size`, and `quantization` values. This keeps the source-of-truth chain explicit: **repo catalog → user folder overrides → merged LLM_models.json → prompt builders → Ollama provider.**
- When manual context changes happen (ContextManagerContext resizing, user settings), `SettingsService` saves the user’s `contextSize` but never touches `LLM_profiles.json`; the UI still compares the requested size to the merged metadata before sending the request.
- `contextSizing.calculateContextSizing` consumes `profileManager.getModelEntry`, picks the matching `context_profile`, and returns `allowed`, `ollamaContextSize`, and the ratio. There is still a safety fallback (85% of `allowed`) for corrupt entries, but in practice every installed model now gets normalized `ollama_context_size` from either the catalog or the `llama3.2:3b` fallback.
- `ModelContext.sendToLLM` packages the context into the provider request, sets `options.num_ctx` to `contextSizing.ollamaContextSize`, and immediately calls `syncAutoThreshold` to propagate the `ollamaContextSize / allowed` ratio down to `ContextManager` (the auto-threshold is kept in sync with each request to avoid drifts). The final data flows directly to the Ollama provider, satisfying **source-of-truth → user folder settings → Ollama provider**.

## Context guard & threshold alignment
- `ContextManager.DEFAULT_CONFIG` (`packages/core/src/context/contextManager.ts:40-90`) now carries the spec-aligned thresholds (`compression.threshold = 0.68`, `snapshots.autoThreshold = 0.85`). Whenever `contextActions.updateConfig({ snapshots })` runs, the manager shallow-copies the existing snapshot config before overriding `autoThreshold`, so we never lose the guard ratio.
- `ModelContext.syncAutoThreshold` updates `ContextManager` with the latest `ollamaContextSize / requestedContext` ratio, ensuring UI and core share the same threshold target (see `packages/cli/src/features/context/ModelContext.tsx:632-720`).
- Mid-stream guard is implemented in `ContextManager.reportInflightTokens` (`packages/core/src/context/contextManager.ts:2092-2122`): the guard compares `currentTokens + inflightTokens` to `config.compression.threshold`, queues a `compress()` if the guard trips, and blocks re-entry until the guard finishes. This prevents runaway streaming even when the assistant message is still open.
- The context pool, snapshot manager, and compression service share the same usage stats so the guard runs before Ollama hits the `num_ctx` cap we requested.

## Session history, rollovers, and persistence
- Chat history lives in `currentContext.messages` inside `ContextManager`. As compression runs, `currentContext.checkpoints` capture summarized slices plus metadata (key decisions, next steps, compressionNumber). This is the **context rollover** pathway: as `ContextManager` compresses, it rebuilds the prompt with the preserved checkpoints so the conversation can continue without losing the conversation goal.
- Snapshot metadata (session id, token count, summary, `StateSnapshot` content) is shipped to disk via `snapshotStorage` (`packages/core/src/context/snapshotStorage.ts`), which writes JSON under `~/.ollm/context-snapshots/[sessionId]/snapshots`. The `SnapshotManager` indexes these files so CLI commands can list/restore snapshots without recomputing anything.
- Session checkpoints, history, and snapshot files are never injected directly into the prompt without first passing through the compression/snapshot pipeline, so rollovers always respect the configured thresholds.

## Debugging & observability
- `/test prompt` (`packages/cli/src/commands/utilityCommands.ts:137-192`) reroutes the assembled system prompt, the context snippet, usage stats, and provider options back into the chat window as a system message. This makes it possible to inspect exactly what would be sent to Ollama without hitting the provider.
- The `/test prompt` dump now also shows the latest GPU placement hints (if any) that will be sent as `num_gpu`/`gpu_layers`, so we can confirm the VRAM-driven guidance without running a real request.
- The global `__ollmAddSystemMessage` hook lets `/test prompt` emit the debug dump; the command also reports current mode and the ratio that the guard is enforcing.
- `.vitest.setup.ts` patches `console.Console` early so the `ink` + keybind stack that Vitest loads no longer throws `console.Console is not a constructor` (resolves the previous test blocker), making the full `npm run test` suite run successfully.

## Tests & coverage
- `packages/core/src/context/__tests__/contextManager.test.ts` validates the mid-stream guard, the auto-threshold sync, and the compression event coverage we rely on when incoming tokens push usage above the cap.
- `packages/cli/src/features/context/__tests__/contextSizing.test.tsx` asserts that `calculateContextSizing` respects `max_context_window`, uses the matching profile when available, and falls back to the 85% guard only when a `context_profile` omits `ollama_context_size`.
- `packages/cli/src/commands/__tests__/utilityCommands.test.ts` protects `/test prompt`, verifying failure when the context manager is missing and the debug dump once it is available.
- `packages/cli/src/features/context/__tests__/gpuHints.test.ts` locks down the heuristic that turns free GPU VRAM into `num_gpu`/`gpu_layers` hints so the placement guidance remains predictable.
- `npm run test` (priority suite) now succeeds end-to-end thanks to the `console.Console` patch and the adjusted guard test.

## Remaining work
- **GPU/VRAM hints in the Ollama request:** LocalProvider still only forwards `temperature`/`num_ctx`; we intend to derive `num_gpu`/`gpu_layers` from `vramMonitor` and carry those into `provider/chatStream` (`packages/ollm-bridge/src/provider/localProvider.ts`).
- **Metadata sync between CLI overrides and core routing:** `ProfileManager` already keeps `~/.ollm/LLM_models.json` up to date, but the core `ModelDatabase` (`packages/core/src/routing/modelDatabase.ts`) currently reads only the generated catalog. We still need to bridge that gap so UI and core thresholds always match the merged store.
- **Manual `/test prompt` confirmation:** After running the full suite, execute `/test prompt` in the chat to ensure the debug dump reflects the current context, provider options, and `num_ctx` cap before shipping.

## Notes
- `~/.ollm/user_models.json` stores the lightweight delta (tool support overrides, manual contexts) that the user can edit; `~/.ollm/LLM_models.json` is the merged view that upstream logic (context sizing, snapshot manager, test prompt) reads. The split exists so the CLI does not recompute overrides every time it reads metadata while still keeping `LLM_profiles.json` untouched.
- Every provider-facing context value is built from `LLM_profiles.json` → merged `LLM_models.json` → `contextSizing` → `ModelContext`, so we never invent a second `num_ctx` cap; the CLI simply copies the catalog’s `ollama_context_size`.
- Session rollovers and history snapshots are stored under `~/.ollm/context-snapshots` and can be replayed manually if needed.
