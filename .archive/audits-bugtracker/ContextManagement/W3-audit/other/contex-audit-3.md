# Context Management Deep Audit — Round 3

Date: 2026-01-18

Scope: Deep investigation of context management, compression, token counting, context rollover, Ollama provider communication (num_ctx, tool usage), user settings interaction when model is selected, auto-mode (dynamic context sizing based on RAM/VRAM), and snapshot / dumps on local machine. No code changes made — investigative notes only.

Summary Findings (high level)
- Critical API mismatches between different compression implementations and their callers (runtime bug potential).
- Multiple, inconsistent token counting heuristics remain across modules (character-count heuristics vs. `TokenCounterService`). This continues to explain "Issue 3: Inaccurate Token Counting".
- Memory safety flows (MemoryGuard) invoke compression with incorrect arguments; emergency actions may not work as intended.
- Provider mapping (LocalProvider for Ollama) generally passes `options` including `num_ctx`, but there are places where `num_ctx` might not be validated by callers.
- Snapshot storage looks robust (atomic writes, index rebuild), but Windows-specific path and permission testing should be exercised more.

Detailed Findings (evidence + impact)

1) API mismatch: compression implementations vs callers (Critical, high confidence)
- Evidence:
  - `packages/core/src/context/compressionService.ts` — CompressionService API: `shouldCompress(tokenCount: number, threshold: number)` and `compress(messages: Message[], strategy: CompressionStrategy): Promise<CompressedContext>`.
  - `packages/core/src/services/chatCompressionService.ts` — ChatCompressionService API: `shouldCompress(messages, tokenLimit, threshold)` and `compress(messages, options)` returning `{ compressedMessages, compressedTokenCount }`.
  - `packages/core/src/core/chatClient.ts` calls `this.compressionService.shouldCompress(sessionMessages, tokenLimit, threshold)` and expects `compress()` returning `compressedMessages` and `compressedTokenCount` (ChatCompressionService shape).
  - `packages/core/src/context/contextManager.ts` constructs `this.compressionService = new CompressionServiceImpl()` (context/compression style), and wires it into MemoryGuard and snapshot flows.
  - `packages/core/src/context/memoryGuard.ts` (line ~159) calls `await this.compressionService.compress(this.currentContext);` — passing a ConversationContext rather than messages + strategy.
- Impact:
  - Runtime mismatch leads to either exceptions or silent failures when a `context`-style CompressionService is injected into callers expecting `services/chatCompressionService` shape (or vice versa).
  - Memory warning/emergency flows may fail to compress context or throw, undermining VM safety and causing lost snapshots or missed emergency behavior.
- Recommendation (investigative - no fix here): add a compatibility adapter or unify the compression API; add tests exercising MemoryGuard flows with the default CompressionService implementation to reproduce.

2) Token counting inconsistencies and duplicate heuristics (High)
- Evidence:
  - `packages/core/src/context/tokenCounter.ts` is the authoritative `TokenCounterService` with provider integration and caching (good).
  - Multiple places still use ad-hoc heuristics:
    - `packages/core/src/services/chatCompressionService.ts` uses `countTokens(text) { Math.ceil(text.length/4) }` and extra +10 per message overhead.
    - `packages/core/src/context/compressionService.ts` uses `countMessagesTokens()` and `countMessageTokens()` implemented with length/4 heuristics.
    - `packages/core/src/core/chatClient.ts` emits `pre_compress`/`post_compress` events using character-length sums (parts.reduce sum of p.text.length) instead of token counts.
    - Test/demo utilities (e.g., `test-compression-demo.js`) implement the same heuristic.
  - Unit tests exist for the `TokenCounterService`, but many compression and event paths don't use it.
- Impact:
  - Inconsistent token counts across system components cause incorrect compression triggers, wrong VRAM usage estimations, wrong snapshot metadata, and inaccuracies in UI displays and metrics.
  - This strongly correlates with Issue 3 (Inaccurate Token Counting).
- Recommendation: consolidate to `TokenCounterService` usage; add unit tests that assert parity between heuristic and provider counts for representative inputs (code, prose, emojis).

3) MemoryGuard automatic actions may call compression incorrectly (Critical)
- Evidence:
  - `MemoryGuardImpl.checkMemoryLevelAndAct()` case `MemoryLevel.WARNING` calls `await this.compressionService.compress(this.currentContext);` (passes ConversationContext). The CompressionService contract expects message arrays + strategy.
- Impact:
  - In low-memory situations, attempted auto-compression may throw or do nothing. Since MemoryGuard is central to emergency handling (snapshots, clearing context), this can allow OOMs or data loss.
- Repro steps to validate: write an integration test that simulates usage percentage >= 80% and check that `compression.compress` is invoked with correct params and that MemoryGuard handles failure gracefully.

4) ChatClient pre/post compression instrumentation uses character-sum metrics (Medium)
- Evidence:
  - `ChatClient` `pre_compress` and `post_compress` events compute `tokenCount` by summing `p.text.length` across parts rather than using `TokenCounterService.countTokens` or `countConversationTokens`.
- Impact:
  - Telemetry and debugging info is misleading; compression thresholds might be decided based on wrong numbers if callers rely on these emitted values.

5) Provider token counting & Ollama mapping (Info / Medium)
- Evidence:
  - `TokenCounterService` calls `provider.countTokens()` if available.
  - `packages/ollm-bridge/src/provider/localProvider.ts` *implements* `countTokens(request)` with fallback char/4 (Ollama does not expose a token count), so providers are available but approximate.
  - `ModelContext` passes `options: { num_ctx: contextSize }` to `provider.chatStream(...)` (so `num_ctx` is passed), and `LocalProvider` includes `options` in the payload to Ollama.
- Impact:
  - Passing `num_ctx` is implemented in several places, but there's no universal verification of whether a provider accepted `num_ctx` or that a provider's `num_ctx` semantics match the context size. Tests should assert that provider receives parameters and reacts as expected.
- Recommendation: add a small integration test for `ModelContext`->provider payload that asserts `options.num_ctx` is sent for Ollama provider and verify behavior when provider ignores it.

6) Snapshot storage & snapshot manager (Info)
- Evidence:
  - `snapshotStorage.ts` uses atomic writes (`.tmp` -> rename), index rebuilds, and verifies snapshots. There are tests (`snapshotStorage.test.ts`) covering save/load/verify behavior.
  - SnapshotManager triggers auto-snapshots based on thresholds and rolling cleanup.
- Impact: Good. Only note: cross-platform permission/path specifics on Windows should be re-tested (Windows PowerShell path usage in VRAM monitor suggests platform-aware code is present but snapshot code should be exercised on Windows file system semantics in CI or a local run).

Other observations / low-risk issues
- Duplicate compression implementations (context vs services) add to cognitive overhead and risk of API drift. The recent `context_rework.md` suggests work is planned and should prioritize API convergence.
- Tests often use the char/4 heuristic (test-helpers, demo scripts). If we centralize token counting, these tests should be updated accordingly.
- VRAM estimation and bytes-per-token formula in `contextPool.ts` uses an approximation; that's fine but should be documented as heuristic.

Test verification & status (update: 2026-01-18)

- Tests added and executed:
  - `packages/core/src/context/__tests__/memoryGuard.warning.test.ts` — **passed**. Demonstrates that `MemoryGuard` currently calls `compression.compress(conversationContext)` and records the exact object passed.
  - `packages/core/src/context/__tests__/compression-api-mismatch.test.ts` — **passed**. Demonstrates `CompressionService.shouldCompress()` diverges when invoked with ChatClient-style args vs context-style args.
  - `packages/core/src/context/__tests__/memoryGuard.enforce-compress-signature.test.ts` — **failing (intentional)**. This test asserts the desired behavior: `MemoryGuard` should call `compression.compress(messages[], strategy)`; it fails with the current implementation, providing a reproducible failing test to drive a fix.

- Outcome: These tests validate the API mismatch and provide an actionable, reproducible failing test to guide the refactor. The failing test should be used to verify any subsequent fix (it should be updated to pass once the implementation is corrected).

Prioritized next steps (investigative → actionable)
1. (High) Implement an adapter or unify the compression API so MemoryGuard invokes `compress(messages[], strategy)` (or provide a small adapter in `context/` that maps ConversationContext → messages + strategy). Update the failing test to pass.
2. (High) Centralize token counting to `TokenCounterService` and replace ad-hoc heuristics in compression & chat paths; add parity tests for representative text.
3. (Medium) Add unit/integration tests to verify `ModelContext` sends `options.num_ctx` and that providers accept/respond to it (add a stubbed Ollama endpoint test).
4. (Medium) Add Windows-specific snapshot path/permission checks to CI or a local verification checklist.

(Appendix and reproduction instructions remain unchanged — run the tests in `packages/core/src/context/__tests__` and use the failing test to validate any fix.)

Files of interest (evidence locations)
- Token counting / provider integration:
  - `packages/core/src/context/tokenCounter.ts`
  - `packages/core/src/core/tokenLimits.ts`
  - `packages/test-utils/src/mockProvider.ts` (implements test countTokens)
- Compression implementations & callers:
  - `packages/core/src/context/compressionService.ts` (context-level)
  - `packages/core/src/services/chatCompressionService.ts` (chat-level)
  - `packages/core/src/core/chatClient.ts` (caller expecting chat-compression shape)
  - `packages/core/src/context/contextManager.ts` (wires CompressionServiceImpl)
  - `packages/core/src/context/memoryGuard.ts` (calls compression incorrectly)
- VRAM / auto-sizing / Context Pool:
  - `packages/core/src/context/vramMonitor.ts`
  - `packages/core/src/context/contextPool.ts`
  - `packages/core/src/context/memoryGuard.ts`
- Snapshot storage / manager:
  - `packages/core/src/context/snapshotStorage.ts`
  - `packages/core/src/context/snapshotManager.ts`
  - Test snapshots under `test-session-*` directories
- Ollama / provider mapping:
  - `packages/ollm-bridge/src/provider/localProvider.ts`
  - `packages/cli/src/features/context/ModelContext.tsx` (sending `num_ctx` in `options`)

Conclusion
- Root cause of Issue 3 (Inaccurate Token Counting) is confirmed to be multiple duplicate heuristics and incomplete adoption of `TokenCounterService`. This is compounded by API mismatches that affect compression and memory management flows. The highest-risk items to address next are (1) unify/commercialize the compression API (or add an adapter), and (2) consolidate token counting to a single authoritative implementation.

Appendix: quick reproductions to run locally
- Run compression & memory guard tests: `npm test -- packages/core/src/context/memoryGuard.test.ts` and `npm test -- packages/core/src/services/__tests__/service-integration.test.ts` to see behavior. Add failing test cases if needed.
- Run token counter tests: `npm test -- packages/core/src/context/__tests__/tokencounter.test.ts`
- Manual check: run a workflow that triggers the MemoryGuard WARNING path (simulate usage >80%) and observe logs or thrown errors.

---

Report saved to `.dev/contex-audit-3.md` (this file).

If you want, I can now (a) create targeted failing tests that reproduce the compression API mismatches and MemoryGuard behavior, or (b) create issues/tickets enumerating fixes and prioritization. State which you prefer and I will proceed (investigation-only, no code fixes unless you ask).