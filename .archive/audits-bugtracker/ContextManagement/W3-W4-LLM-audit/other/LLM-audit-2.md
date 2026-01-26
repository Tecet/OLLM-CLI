# LLM Integration Audit — tLLM / Ollama (Investigation Only)

Date: 2026-01-18

Summary
- Scope: deep read-only audit of local LLM integration (Ollama-compatible), how models are handled, what is passed to Ollama, available commands, UI integration points, and likely legacy/conflicting code areas. No fixes applied here.

High-level data flow
- UI (Chat/Model contexts) -> ModelContext / ChatContext -> provider adapter (LocalProvider) -> Ollama HTTP API (/api/chat, /api/pull, /api/tags, /api/show, /api/delete, /api/generate).

Key code locations
- Provider adapter: [packages/ollm-bridge/src/provider/localProvider.ts](packages/ollm-bridge/src/provider/localProvider.ts#L1-L30)
- Model management / UI integration: [packages/cli/src/features/context/ModelContext.tsx](packages/cli/src/features/context/ModelContext.tsx#L1-L40)
- Chat flow + ToolRegistry usage: [packages/cli/src/features/context/ChatContext.tsx](packages/cli/src/features/context/ChatContext.tsx#L1-L40)
- System prompt composition: [packages/core/src/context/SystemPromptBuilder.ts](packages/core/src/context/SystemPromptBuilder.ts#L1-L40)
- Commands registry and model/provider commands: [packages/cli/src/commands/commandRegistry.ts](packages/cli/src/commands/commandRegistry.ts#L1-L40) and [packages/cli/src/commands/modelCommands.ts](packages/cli/src/commands/modelCommands.ts#L1-L40), [packages/cli/src/commands/providerCommands.ts](packages/cli/src/commands/providerCommands.ts#L1-L40)

What is sent to Ollama (payload summary)
- Endpoint: POST ${baseUrl}/api/chat (LocalProvider.chatStream).
- Body structure assembled in LocalProvider.chatStream:
  - model: request.model
  - messages: LocalProvider.mapMessages(request.messages, request.systemPrompt)
  - tools: request.tools ? LocalProvider.mapTools(request.tools) : undefined
  - options: request.options (num_ctx, temperature, etc.) — forwarded as-is
  - stream: true
  - think: request.think

- message mapping details (LocalProvider.mapMessages):
  - systemPrompt (string) becomes a single system message {role: 'system', content: systemPrompt}
  - message parts are concatenated without separators; non-text parts (images) replaced with "[image]"
  - tool messages include `tool_calls` objects mapping internal tool-call fields to Ollama fields

- tools mapping (LocalProvider.mapTools): maps ToolSchema -> {type: 'function', function: {name, description, parameters}}

Streaming & response handling
- LocalProvider expects NDJSON stream lines, JSON.parse each line (mapChunkToEvents).
- mapChunkToEvents translates server chunks to internal ProviderEvent types: thinking, text, tool_call (from either `message.tool_calls` or heuristically-parsed JSON in `message.content`), finish events (with done_reason mapping).

Token counting
- LocalProvider.countTokens uses a fallback heuristic: total char count (systemPrompt + text parts) / 4. Ollama doesn't provide a token endpoint so this is an approximation.

Commands and UI integration
- Slash commands are registered via commandRegistry; many model/provider commands are available: /model (list/use/pull/delete/info/keep/unload), /provider (list/use), and many other commands (context, theme, reasoning, memory, etc.). See [packages/cli/src/commands/index.ts](packages/cli/src/commands/index.ts#L1-L1) and registry at [packages/cli/src/commands/commandRegistry.ts](packages/cli/src/commands/commandRegistry.ts#L1-L40).
- ModelContext exposes `sendToLLM`, `setCurrentModel`, `modelSupportsTools` and manages model warmup/unload (calls provider.unloadModel when switching).
- ChatContext uses CommandRegistry and routes commands (commands starting with `/`) and will call provider.unloadModel on `/exit` flow.

Identified risks, brittleness, and likely issues (investigation findings)
1) Tool support detection is brittle
   - Detection relies on regex matching error text (/tools?|tool_calls?|unknown field/i) in LocalProvider and ModelContext. This is fragile across different Ollama versions or providers and may produce false positives/negatives. (LocalProvider.chatStream error branch; ModelContext.isToolUnsupportedError)

2) Double-formatting / mismatched tool-call representations
   - LocalProvider.mapMessages constructs `tool_calls` with `function.arguments: tc.args` and explicitly notes "Ollama expects an object, not a JSON string". Meanwhile mapChunkToEvents defensively parses string `arguments`. There is potential for mismatch when callers stringify args (or when Ollama returns stringified args), causing parsing errors or mis-identified tool_calls.

3) Heuristic JSON parser for tool calls in content
   - mapChunkToEvents attempts to parse message.content if it looks like JSON to produce a tool_call. This heuristic may misfire on legitimate JSON text or miss cases where model emits a multi-line JSON object with whitespace. Also the code `if (content.trim().startsWith('{') && content.trim().endsWith('}'))` is too strict for arrays or trailing newlines.

4) Strict tool name validation may reject valid tool identifiers
   - validateToolSchema enforces /^[a-zA-Z_][a-zA-Z0-9_-]*$/. External tools or existing schemas using dots, slashes, or other allowed identifiers will fail validation and throw during mapping, potentially crashing the call path.

5) Token counting is approximate and may be misleading
   - countTokens uses char/4 heuristic. This can under/overestimate across encodings and languages — affecting context trimming logic or cost estimations.

6) Options passed to Ollama are forwarded without normalization
   - LocalProvider forwards `request.options` directly. If different callers pass unknown/incorrect option keys, the server may reject the request or silently ignore fields. No normalization/whitelist of options is present.

7) Timeout and Abort handling subtlety
   - ModelContext warmup and send flows use AbortController and timeouts; LocalProvider maps AbortError to benign behavior. However some code paths set `controller.abort(new Error(...))` (sending an Error as reason) which may produce different AbortError shapes; tests should verify abort semantics on Node versions/environments.

8) Use of Node globals / runtime APIs may be fragile in some environments
   - mapChunkToEvents uses `crypto.randomUUID()`; older Node versions or unusual runtimes may not provide this API. The code has no fallback.

9) Potential legacy/duplicate implementations
   - Several audit notes and earlier audit files (.dev/LLM-audit-1.md, context-audit-*.md) show overlapping investigations. Search reveals code paths that re-create ToolRegistry per message; creating registries per message can cause inconsistent tool schema sources and lead to differing tool lists used for prompt building vs runtime. See notes in .dev/toolsandhooks-audit-3.md and ChatContext (ToolRegistry usage evidence).

10) Tests show intermittent failures around LocalProvider streaming
   - test-results.json contains failing test runs referencing packages/ollm-bridge/src/provider/__tests__/localProvider.test.ts — investigate CI/test logs to reproduce flaky NDJSON/stream parsing behavior.

Suggested next investigative steps (no fixes applied here)
- Add integration tests that stub an Ollama-like server to assert exact payloads sent (messages, systemPrompt, options.num_ctx, tools) and server streaming shapes (tool_calls vs content JSON).
- Run unit tests for LocalProvider streaming and simulate edge cases: stringified arguments, array arguments, malformed trailing NDJSON, Abort behavior.
- Audit places that build tool schemas (ToolRegistry usage) to centralize schema sourcing and avoid per-message registry creation.
- Add normalization/whitelist for options forwarded to Ollama; record which options are supported by targeted Ollama versions.
- Replace fragile regexes with structured error parsing (where possible) or broaden patterns and add integration tests.

Collected code references (for reviewer)
- LocalProvider (payload & streaming): [packages/ollm-bridge/src/provider/localProvider.ts](packages/ollm-bridge/src/provider/localProvider.ts#L1-L716)
- Model context: [packages/cli/src/features/context/ModelContext.tsx](packages/cli/src/features/context/ModelContext.tsx#L1-L843)
- Chat context (command handling and ToolRegistry evidence): [packages/cli/src/features/context/ChatContext.tsx](packages/cli/src/features/context/ChatContext.tsx#L1-L870)
- System prompt builder: [packages/core/src/context/SystemPromptBuilder.ts](packages/core/src/context/SystemPromptBuilder.ts#L1-L200)
- Commands index/registry: [packages/cli/src/commands/commandRegistry.ts](packages/cli/src/commands/commandRegistry.ts#L1-L418) and [packages/cli/src/commands/modelCommands.ts](packages/cli/src/commands/modelCommands.ts#L1-L509)

Notes
- This is an investigative report only. No code changes were made.
- I collected examples and code references from the repository to support follow-up fixes and tests.

Prepared by: repository audit script (investigation run)

----

**Test Runs & Findings (unit + integration)**

- Unit tests: `packages/ollm-bridge/src/provider/__tests__/localProvider.test.ts` — all tests passed locally (31 tests). This validates message mapping, tool schema mapping, error handling, and stream parsing for many cases.

- Integration test added and executed: `packages/ollm-bridge/src/provider/__tests__/localProvider.integration.test.ts` — passed.
   - The integration test spins up a minimal HTTP server that streams NDJSON lines for:
      1) a text message chunk ({ message: { content } })
      2) a tool_calls chunk ({ message: { tool_calls: [...] } })
      3) a done chunk ({ done: true, done_reason: 'stop' })
   - `LocalProvider.chatStream` consumed the NDJSON stream and produced `text`, `tool_call`, and `finish` events as expected.

Observations from tests
- The provider correctly handles simple NDJSON streaming and maps tool_calls with object arguments to `tool_call` events.
- The integration test confirms the streaming parser tolerates small delays and multiple writes; however, more exhaustive tests (fragmented JSON across TCP chunks, large payloads, arrays returned as top-level content) would be useful.

Edge-case integration tests added & results
- `packages/ollm-bridge/src/provider/__tests__/localProvider.integration.edgecases.test.ts` (3 tests) — all passed locally.
   - Fragmented NDJSON: verified LocalProvider handles JSON split across multiple TCP writes and reconstructs it.
   - Stringified function.arguments: verified provider yields a `tool_call` event when `function.arguments` is a JSON string (parsing fallback exercised).
   - Options assertion: verified outgoing request body includes `options.num_ctx` when provided by caller.

Implication
- Tests indicate the current `LocalProvider` implementation is robust for these edge cases, but the heuristic parsing and permissive behaviors should still be made explicit in tests and docs to avoid regressions.

**Prioritized Fix Plan**

1. Harden tool error detection (Priority: High, Effort: Small)
   - Replace brittle regex-only checks with structured parsing of HTTP error responses where possible; broaden patterns and add unit tests covering Ollama error variants.
   - Acceptance: `ModelContext.handleToolError` and `LocalProvider.chatStream` detect tool-unsupported errors in >=95% of known Ollama error cases (tests included).

2. Normalize & whitelist `options` forwarded to Ollama (Priority: High, Effort: Small)
   - Implement option validation/whitelist in `LocalProvider.chatStream` (allow `num_ctx`, `temperature`, `top_p`, etc.) and reject/strip unknown keys with a logged warning.
   - Acceptance: Outgoing payload tests assert `options` contains only allowed keys; server-side integration test verifies `num_ctx` present when provided.

3. Make tool schema validation and naming flexible (Priority: Medium, Effort: Small)
   - Relax `validateToolSchema` name restrictions to accept common external identifiers (dots, slashes) or provide a mapping layer to transform invalid names safely.
   - Acceptance: Existing external tool schemas no longer throw validation errors; tests cover mapping and rejection paths.

4. Improve tool-call parsing and remove fragile heuristics (Priority: High, Effort: Medium)
   - Replace content-JSON heuristic in `mapChunkToEvents` with a configurable parser and safer heuristics (support arrays, whitespace, and multi-line JSON). Add tests for stringified args, arrays, and primitives.
   - Acceptance: Tests cover content-as-JSON cases and ensure legitimate JSON text is not misclassified as tool_call.

5. Add robust NDJSON fragmentation tests & resilience (Priority: Medium, Effort: Small)
   - Extend integration tests to cover fragmented JSON across TCP chunks, very large NDJSON lines, and mixed-order chunks.
   - Acceptance: All edge-case streaming tests pass on CI.

6. Token counting improvements (Priority: Low, Effort: Medium)
   - Make token counting pluggable per provider; document the heuristic fallback and add a provider override to plug in better estimators.
   - Acceptance: New API allows injecting a token counter for Ollama and tests validate estimations change accordingly.

7. Abort/timeout and AbortReason normalization (Priority: Medium, Effort: Small)
   - Ensure consistent AbortError handling (do not pass Error instance as abort reason), normalize messages, and add tests across Node versions.
   - Acceptance: Abort-related unit tests reproduce timeout/abort behavior reliably.

8. Fallbacks for runtime APIs (Priority: Low, Effort: Small)
   - Add safe fallback for `crypto.randomUUID()` (e.g., `crypto.randomUUID?.() ?? fallbackUuid()`), and test in Node v16+ scenarios.
   - Acceptance: No runtime crash on environments without `randomUUID`.

9. Centralize ToolRegistry usage (Priority: Medium, Effort: Medium)
   - Audit code that constructs `ToolRegistry` per message; centralize registration so prompt-building and runtime tool lists align.
   - Acceptance: Single source-of-truth for tool schemas; tests ensure prompt and provider tool lists are identical.

10. Documentation & tests (Priority: Medium, Effort: Small)
   - Document provider behaviors (options accepted, tool schema expectations, token heuristics) and add integration test harness documentation.
   - Acceptance: README/docs updated and CI runs the integration test harness.

Suggested sequencing
- Sprint 1 (2 weeks): items 1, 2, 4, 5 (high-impact, small-to-medium effort)
- Sprint 2 (1-2 weeks): items 3, 7, 8
- Sprint 3 (1 week): items 6, 9, 10 and cleanup

Testing & validation
- Add integration tests that assert outgoing payload (options present), server streaming shapes, and failure modes.
- Add unit tests for the refactored error detection and tool-call parsing.

Owners & notes
- Primary owner: `packages/ollm-bridge` maintainers (LocalProvider changes)
- Secondary owner: `packages/cli` (ModelContext behavior and prompts)


Recommended next steps (follow-up, not applied here)
- Add tests that simulate malformed but recoverable NDJSON fragments (split JSON across TCP packets) to exercise the buffer/line-splitting code paths.
- Add tests where `function.arguments` are stringified JSON or primitives to validate graceful parsing and error reporting.
- Add integration tests that verify `options` / `num_ctx` are included in the outgoing payload (stub server can assert incoming request body before streaming response).

