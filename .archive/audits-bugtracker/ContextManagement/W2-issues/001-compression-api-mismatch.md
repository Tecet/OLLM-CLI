Title: Compression API Mismatch — Context vs Chat services

Severity: Critical

Summary:
Memory-related flows directly invoke `compressionService.compress(this.currentContext)` (passing a ConversationContext object), while the context-level `CompressionService` expects `(messages: Message[], strategy: CompressionStrategy)` and the chat-level `ChatCompressionService` expects `(messages, options)` and returns a different shaped result. This API divergence leads to runtime mismatches and can cause MemoryGuard emergency/automatic compression flows to fail or behave incorrectly.

Files of interest:
- Caller: `packages/core/src/context/memoryGuard.ts` (calls `compress(this.currentContext)`)
- Context compression impl: `packages/core/src/context/compressionService.ts` (expects messages + strategy)
- Chat compression impl: `packages/core/src/services/chatCompressionService.ts` (expects messages + options)
- Caller mismatch: `packages/core/src/core/chatClient.ts` expects `ChatCompressionService` API

Reproduction steps (tests added):
- `packages/core/src/context/__tests__/memoryGuard.warning.test.ts` demonstrates that MemoryGuard calls `compression.compress(conversationContext)` (test asserts the passed argument is the ConversationContext object). **Result: test passes**.
- `packages/core/src/context/__tests__/compression-api-mismatch.test.ts` shows `CompressionService.shouldCompress()` behavior diverges when called with the ChatClient-style args. **Result: test passes**.
- `packages/core/src/context/__tests__/memoryGuard.enforce-compress-signature.test.ts` is an intentionally failing test that asserts `MemoryGuard` must call `compress(messages[], strategy)`; it fails with the current code and provides a reproducible failure to be fixed. **Result: test fails (expected)**.

Status & next steps:
- The failing test is now the canonical reproduction for this issue. Use it as the gate for any fix: implement the adapter or unify the API and ensure this test passes.
- Recommended immediate action: implement a small adapter in `packages/core/src/context/` that accepts a `ConversationContext` and calls the underlying compression implementation with `messages` and a normalized `strategy`. Add tests that confirm MemoryGuard invokes the adapter and that the adapter calls the compression API with the expected signature.

Impact:
- Memory warning/critical/emergency flows may not compress context as intended, potentially allowing OOM conditions or failing emergency snapshot/clear routines.

Suggested fixes:
1. Unify compression API: define a single `ICompressionService` contract used by all callers, or
2. Introduce an adapter that adapts between `context`-style and `services`-style compression implementations, ensuring callers pass the correct parameters and consume the correct result shape.
3. Add unit and integration tests that exercise MemoryGuard and ChatClient with both implementations to ensure compatibility.

Priority: High — needs follow-up with a compatibility test and small refactor/adapter.
