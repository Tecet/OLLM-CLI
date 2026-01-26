Title: Inaccurate Token Counting — Duplicate heuristics and inconsistent usage

Severity: High

Summary:
Multiple token counting heuristics (character-based Math.ceil(text.length / 4) and ad-hoc summations) are used across the codebase while a canonical `TokenCounterService` exists. Compression services, ChatClient metrics, and several test helpers use local heuristics instead of `/context/tokenCounter.ts` leading to inconsistent token-related behavior and contributing to Issue 3: "Inaccurate Token Counting".

Files of interest:
- Canonical token counter: `packages/core/src/context/tokenCounter.ts`
- Chat-level heuristics: `packages/core/src/services/chatCompressionService.ts` (local countTokens, +10 overhead)
- Context-level heuristics: `packages/core/src/context/compressionService.ts` (countMessageTokens uses length/4)
- Emitters & metrics: `packages/core/src/core/chatClient.ts` (pre/post compress events compute char sums)
- Test helpers & demos: `test-compression-demo.js`, `packages/core/src/services/__tests__/test-helpers.ts`

Reproduction steps (tests added):
- `packages/core/src/context/__tests__/compression-api-mismatch.test.ts` demonstrates how different call shapes and heuristics lead to divergent decisions about whether to compress.
- Add token parity tests that compare `TokenCounterService.countTokens()` results to the ad-hoc heuristics across representative corpuses (code, prose, emojis).

Impact:
- Compression triggers, VRAM estimates, UI metrics, and session metadata may be incorrect.
- Hard to reason about system behavior and to tune thresholds safely.

Suggested fixes:
1. Centralize token counting: replace ad-hoc heuristics with `TokenCounterService` (or a chosen tokenizer adapter such as `tiktoken`) and add an adapter for providers lacking token counts.
2. Update tests and demos to use the canonical counter.
3. Add unit/integration tests asserting parity for representative inputs to avoid regressions.

Priority: High — central to correct compression and auto-sizing behaviour.
