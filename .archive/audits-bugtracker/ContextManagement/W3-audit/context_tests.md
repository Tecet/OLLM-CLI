# Context management — recent changes and test notes

Summary of implemented behavior and changes made while addressing auto-summary, timeout, and streaming issues.

- Auto-summary trigger
  - Auto-summary is invoked when context usage reaches the snapshot `autoThreshold` (default 80%).
  - When triggered, a pre-summary snapshot is created and the core emits `summarizing`.
  - The LLM summarization compresses older messages into a single summary message and replaces the live context (system prompts retained).
  - Events emitted: `auto-snapshot-created`, `auto-summary-created`, `auto-summary-failed`, `compressed`.

- UI feedback and resume behavior
  - The CLI shows `Summarizing conversation history...` during summarization.
  - After summarization completes, default behavior is to `ask` the user to `continue` (setting `llm.resumeAfterSummary` can be set to `auto|ask|never`).
  - Typing `continue` re-dispatches the last user message so the model resumes without repeating content.

- Streaming and in-flight tokens
  - Implemented inflight token accounting so the manager includes streaming tokens when checking thresholds.
  - `reportInflightTokens(delta)` and `clearInflightTokens()` are exposed on the context manager actions.
  - Streaming reports are batched (flush every 500ms) to reduce allocation churn and GC pressure.

- Timeouts and provider behavior
  - Summarization requests forward a `summaryTimeout` (defaults to 120s) to the provider to avoid provider default (30s) aborts.
  - `sendToLLM` calls from `ChatContext` use a 120s timeout by default for long-running requests.

- Retry / continuity improvements
  - If compression happens mid-generation, the UI flags it and the agent will retry once after compression.
  - Retry logic re-adds the last user message to the authoritative context if it was removed by compression to avoid the model repeating the last output.

- Spam / reentrancy and GC mitigations
  - Added a short cooldown and reentrancy guard in `ConversationContextManager` to avoid repeated auto-summary triggers (5s cooldown).
  - Throttled in-flight token reporting and batched reports to reduce GC pressure.
  - Added debug logs around snapshot creation, compression start/finish, and errors to aid investigation.

- Crash/diagnostics
  - Global uncaughtException/unhandledRejection handlers write crash traces to `logs/cli-errors.log`.
  - Guidance: if OOM recurs, run the CLI with increased node heap and `--trace-gc` to capture traces.

Files changed (high level)
- `packages/core/src/context/contextManager.ts` — summary orchestration, inflight accounting, cooldown guard, debug logs
- `packages/core/src/context/compressionService.ts` — forward `summaryTimeout` to provider
- `packages/cli/src/features/context/ChatContext.tsx` — UI messages, inflight batching, retry/resume logic, mark summaries as excluded from context
- `packages/cli/src/features/context/ContextManagerContext.tsx` — expose inflight actions, compressing state handling
- `packages/ollm-bridge/src/provider/localProvider.ts` — provider adapter (timeouts observed, may need provider config)

Notes for testing
- To reproduce: start the CLI, perform a long streaming generation and watch for `Summarizing conversation history...` and the summary message.
- If the model stops mid-generation, use `continue` to resume when prompted.
- If OOM occurs, increase Node heap (`--max-old-space-size`) and capture GC trace/heap snapshot.

Changelog / next steps
- Consider exposing `llm.resumeAfterSummary` in CLI settings UI for user preference.
- Further reduce memory footprint by streaming snapshots to disk rather than keeping large arrays in memory.
- Add periodic `process.memoryUsage()` logging to find growth hotspots.

