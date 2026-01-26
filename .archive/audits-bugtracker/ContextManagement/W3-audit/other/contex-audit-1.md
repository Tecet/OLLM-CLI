# Context Management Deep Audit — Round 1

**Started:** 2026-01-18T21:10:00Z

## Scope
- Deep inspection of context management, compression, rollover, token counting, Ollama/local provider context handling, user model-selection settings related to context, auto-mode sizing (RAM/VRAM), and snapshot/dump storage.
- This is an investigative snapshot only — no code changes made.

## Summary of High-Priority Findings

1) Token counting is inconsistent and duplicated across the codebase (Critical)
  - `packages/core/src/context/tokenCounter.ts` implements `TokenCounterService` with provider integration and caching (good). Fallback uses `Math.ceil(text.length / 4)`.
  - Multiple places still use character-length heuristics directly instead of the token counter:
    - `packages/core/src/core/chatClient.ts` uses `parts.reduce((s,p) => s + p.text.length, 0)` when emitting compression events and when calculating token-like metrics.
    - `packages/core/src/context/compressionService.ts` uses `Math.ceil(message.content.length / 4)` in `countMessageTokens`/`countMessagesTokens`.
    - `packages/core/src/services/chatCompressionService.ts` defines its own `countTokens`/`countMessageTokens` utilities (same 4-char heuristic).
  - Result: the system has multiple heuristics and a fallback implemented but not consistently invoked, causing incorrect compression triggers, VRAM estimates, and session token metadata.

2) Duplicate / divergent compression implementations and mismatched APIs (High)
  - There are two main compression implementations:
    - `packages/core/src/services/chatCompressionService.ts` — used by `ChatClient` and UI-level chat flows. API: `shouldCompress(messages, tokenLimit, threshold)` and `compress(messages, options)` returning `compressedMessages`, `compressedTokenCount`, etc.
    - `packages/core/src/context/compressionService.ts` — used by context manager and memory guard flows. API: `shouldCompress(tokenCount, threshold)` and `compress(messages, strategy)` returning `CompressedContext` (summary + preserved + compressedTokens + originalTokens).
  - `ChatClient` expects the `services`-style API; `ContextManager` wires the `context` style implementation. If services are swapped or misconfigured, calls will break or produce incorrect behavior.

3) API misuse / call-site bugs found (Critical)
  - In `packages/core/src/core/chatClient.ts` the compression check calls: `this.compressionService.shouldCompress(sessionMessages, tokenLimit, threshold)` — this matches `ChatCompressionService` but not `context/compressionService`'s signature. If a different compression implementation is injected, this is a runtime mismatch.
  - `ChatClient` uses `compressionResult.compressedMessages` and `compressionResult.compressedTokenCount` — these properties are present on the `services/chatCompressionService` result, but not on the `context/compressionService` result (which uses `summary`, `preserved`, `compressedTokens`). This is a concrete incompatibility.

4) TokenCounter exists but isn't always used where it should be (High)
  - `ConversationContextManager.addMessage()` does correctly use `tokenCounter.countTokensCached()` and `countConversationTokens()`.
  - However, `ChatClient` pre-compression metrics, `context/compressionService`, and `services/chatCompressionService` still compute tokens locally via simple heuristics.

5) Double/parallel implementations cause maintenance and correctness risk (Medium)
  - Two compression service families, two token heuristics, and multiple count implementations mean changes in one place won't propagate to others.

6) Snapshot storage and rollover generally implement sound mechanics (Info)
  - `packages/core/src/context/snapshotStorage.ts` writes snapshots atomically to `~/.ollm/session-data` and maintains an index. It includes integrity checks and rebuild logic.
  - `packages/core/src/context/snapshotManager.ts` triggers auto-snapshots and cleanup per config.
  - Note: Windows path/permissions should be validated during integration tests; `os.homedir()` is used and should work cross-platform but Windows ACLs can block writes in some environments.

7) VRAM/auto-sizing appears implemented and tested (Info)
  - `packages/core/src/context/vramMonitor.ts`, `contextPool.ts`, and `memoryGuard.ts` coordinate auto-sizing and thresholds; tests indicate integration coverage. Still, those components rely on token counts from the tokenCounter/compression implementations — if token counts are wrong, auto-sizing and thresholds will be off.

8) Ollama / local provider mapping (Info)
  - `packages/ollm-bridge/src/provider/localProvider.ts` maps internal message parts to Ollama messages and streams NDJSON replies. It expects message content assembled from `parts` (joined text) and maps tools. The provider looks robust but depends on callers to pass correctly shaped messages and tokens.

9) Tool result encoding and recording quirks (Resolved elsewhere)
  - Audit file `.dev/audit-chat-system-fix.md` documents a past fix for double JSON encoding and invalid 'tool' mode switching; those items are already addressed.

## Concrete Problems to Triage / Verify

- Inconsistent token accounting across:
  - `tokenCounter.ts` (authoritative service)
  - `compressionService.ts` (context-level)
  - `services/chatCompressionService.ts` (chat-level)
  - `chatClient.ts` (ad-hoc length usage)

- API incompatibility between compression implementations; `ChatClient` assumes `services/chatCompressionService` API while `ContextManager` wires `context/compressionService` by default in other flows.

- Places to search for ad-hoc token heuristics (examples found already): `Math.ceil(...length / 4)`, `text.length` sums. These are candidates for replacement with `TokenCounterService` calls.

## Files of Interest (read during this pass)
- `packages/core/src/context/tokenCounter.ts`
- `packages/core/src/core/chatClient.ts`
- `packages/core/src/services/chatCompressionService.ts`
- `packages/core/src/context/compressionService.ts`
- `packages/core/src/context/contextManager.ts`
- `packages/core/src/context/snapshotStorage.ts`
- `packages/ollm-bridge/src/provider/localProvider.ts`

## Recommended Next Steps (no fixes performed in this task)
1. Converge on a single token-counting abstraction and make it the single source of truth:
   - Decide on integrating a tokenizer library (e.g., `tiktoken` or multi-provider adapters) vs. requiring providers to implement `countTokens()`.
   - If choosing library integration, add it to `TokenCounterService` and update all call-sites to use the service.

2. Standardize compression API and adapter layer:
   - Create a small adapter wrapper that normalizes `context/compressionService` <-> `services/chatCompressionService` shapes or merge into a single implementation with clear interface.

3. Replace all direct `text.length`/`/4` heuristics with calls to `TokenCounterService` (or an adapter) and add unit tests asserting close-to-expected counts for representative text/code samples.

4. Audit `ChatClient` compression call sites and recording paths to ensure they call the intended compression implementation and expect the correct return shape.

5. Add integration tests for Windows snapshot storage (path/permission), and exercise auto-snapshot/rollover scenarios with mocked VRAM boundaries.

6. Create a decision ticket for tokenizer selection (tiktoken vs provider-required) and estimate work/time (2-4 hours to prototype).

## Immediate Low-Risk Checks to Run (suggested)
- Grep the repo for `length / 4`, `Math.ceil(` + `length`, and direct `parts.reduce(...text.length...)` occurrences and list all locations (we already found several).
- Run existing token counter tests: `packages/core/src/context/__tests__/tokencounter.test.ts` and `packages/core/src/context/__tests__/contextPool.test.ts` to verify current behavior under test harness.

## Notes & Context
- This audit picked up the previously-documented Issue 3 (Inaccurate Token Counting) and expanded it into structural problems: duplicated heuristics and API mismatches across compression/tokenization layers.
- No code was modified in this investigation step.

---

Prepared by: audit script + manual inspection (files read inline)

---

## Repo-wide Ad-hoc Token Heuristics

- A repo-wide grep was run to locate local character-based token heuristics and ad-hoc counters. A short, exportable list was saved to `.dev/token-heuristics-list.md`.
- Key locations (short):
  - `packages/core/src/context/tokenCounter.ts` (fallback Math.ceil(text.length / 4))
  - `packages/core/src/context/compressionService.ts` (countMessageTokens uses length/4)
  - `packages/core/src/services/chatCompressionService.ts` (local countTokens/countMessageTokens)
  - `packages/core/src/core/chatClient.ts` (uses parts.reduce(... text.length ...) for metrics)
  - `test-compression-demo.js` (demo countTokens)
  - `packages/core/src/services/__tests__/test-helpers.ts` (test helper countTokens)
  - `packages/test-utils/src/mockProvider.ts` (mock provider countTokens)
  - `packages/ollm-bridge/src/provider/localProvider.ts` (provider countTokens implementation)

Action: replace ad-hoc heuristics with `TokenCounterService` (or chosen tokenizer integration) starting with `chatCompressionService`, `context/compressionService`, and `ChatClient`.

---
