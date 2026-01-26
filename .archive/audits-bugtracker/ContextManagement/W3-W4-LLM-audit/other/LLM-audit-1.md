# LLM Integration Audit — tLLM / Ollama

Date: 2026-01-18

Audit scope
- Deep audit of local LLM ("tLLM") integration with Ollama-compatible provider.
- Areas inspected: model management commands, provider adapter (`LocalProvider`), message/prompt construction, token counting, tool/function-calling support, NDJSON streaming, UI integration (Chat/Model contexts), and surrounding tests and docs.

Files examined (representative)
- `packages/ollm-bridge/src/provider/localProvider.ts`
- `packages/cli/src/features/context/ModelContext.tsx`
- `packages/cli/src/features/context/ChatContext.tsx`
- `packages/cli/src/commands/modelCommands.ts`
- `packages/core/src/context/SystemPromptBuilder.ts`
- `packages/core/src/context/contextManager.ts` and `tokenCounter.ts`
- `packages/core/src/services/chatCompressionService.ts`
- Tests and docs: `packages/ollm-bridge/src/__tests__/*`, `packages/core/src/__tests__/*`, `docs/Models/Models_commands.md`

Executive summary ✅
- The core data flow is solid: UI -> `ModelContext`/`ChatContext` -> provider adapter (LocalProvider) -> Ollama HTTP API (`/api/chat`, `/api/pull`, `/api/tags`, etc.).
- Multiple robustness, correctness, and edge-case issues were found that could cause inaccurate context sizing, tool calling failures, or silent misbehavior when interacting with local LLMs.
- No code changes made in this audit; recommended tests and fixes are listed below. (File saved: `.dev/LLM-audit-1.md`)

Detailed findings (by area) 🔍

1) Request payloads sent to Ollama (what actually goes over the wire)
- Endpoint: `POST ${baseUrl}/api/chat` (see `LocalProvider.chatStream`).
- Body structure observed: { model, messages, tools?, options?, stream: true, think? }
- `messages` built by `LocalProvider.mapMessages()` and will include an optional system message if `request.systemPrompt` is provided.
- Message content is assembled by concatenating message parts: parts.map(...).join('') — **no separator** between parts (could glue words across parts).

Risk & notes:
- Joining without delimiter may produce malformed sentences if parts were intended to be separate paragraphs or if part boundaries matter to function-calling parsing.
- Images are replaced with the string `[image]`; this is simplest but may be suboptimal for models that can accept image metadata.

2) Tool / function-calling behavior
- `ModelContext.sendToLLM()` gathers `toolSchemas` from `ToolRegistry` (HotSwapTool, MemoryDumpTool registered) and passes them when model supports tools.
- `LocalProvider.mapTools()` maps `ToolSchema` -> {type: 'function', function: {name, description, parameters}}.
- On 400 with an error that looks like a tool error, `LocalProvider` emits a `TOOL_UNSUPPORTED` error then retries without `tools` (good defensive behavior).

Risk & notes:
- Tool unsupported detection is based on heuristic error text matching (regex like /tools?|tool_calls?|unknown field/i). This is brittle: different Ollama versions or other provider error formats may not match and will fail to detect tool incompatibility.
- `mapChunkToEvents()` tries to detect tool calls in plain content by parsing curly-brace JSON (heuristic). This can produce false positives (e.g., normal assistant content that happens to be JSON) or miss valid edge cases.
- If `tool_call.function.arguments` is a string, `mapChunkToEvents()` attempts JSON.parse; on parse error it yields `__parsing_error__` metadata. This is good for visibility but indicates mismatch between provider formats and expected object shapes.

3) Streaming / NDJSON parsing
- The provider expects NDJSON streaming lines; `LocalProvider` reads chunks, splits on `\n`, JSON.parse each line.
- Fields mapped: `message.content` => text events, `message.thinking` => thinking events, `message.tool_calls` => tool_call events; `c.done` and `c.done_reason` map to finish events.

Risk & notes:
- Malformed or large streaming chunks are skipped silently on JSON.parse failure (comment: // Skip malformed JSON) — could hide useful debugging information.
- `done_reason` mapping has limited set: 'length' and 'tool_calls' mapped, other values are treated as 'stop'. Providers that return different done_reason semantics may lose information.

4) Token counting and context sizing (High risk)
- `LocalProvider.countTokens` is a fallback heuristic: char count / 4 (including systemPrompt + text parts).
- `tokenCounter` in core uses provider.countTokens if provided, otherwise falls back to approximate char/4 as well.

Implications:
- Estimation errors can cause incorrect decisions about compression, snapshotting, and context resizing (leading to degraded performance or truncated context unexpectedly).
- Tests exist targeting token limits and property-based behaviors, but the reliance on approximate counts for local providers is a known risk.

5) System prompt composition and context additions
- System prompt layers built by `SystemPromptBuilder` (`IDENTITY_PROMPT`, `MANDATES_PROMPT`, optional `sanity` checks, plus mode-specific `buildPrompt()` implementations).
- `ChatContext` ensures `contextActions.setSystemPrompt(updatedPrompt)` when mode changes; `ContextManager` stores the current system prompt message at front of context messages.

Risk & notes:
- System prompt can grow large (memory + skills + mandates + mode data). There are checks in `memoryService` and `chatCompressionService` to ensure additions fit token budgets, but token estimation inaccuracies (above) mean a mismatch can occur.
- ChatContext adds a note when model does not support tools (string appended). This is a good UX safety measure but is appended as plaintext — consider testing for edge cases (system prompt length limits vs num_ctx).

6) Model commands & UI integration
- CLI commands: `/model list|use|pull|delete|info|keep|unload` implemented in `packages/cli/src/commands/modelCommands.ts` and covered by tests.
- `model use` sets model via `SettingsService.setModel()` and triggers global callback `__ollmModelSwitchCallback` to perform UI-level changes.
- Model management implementation relies on a `ModelManagementService` (abstract type); the default commands provide a fallback message when service container is not provided.

Risk & notes:
- Reliance on globals like `globalThis.__ollmPromptUser` and `globalThis.__ollmAddSystemMessage` for prompting/persistence is fragile; missing global hooks degrade auto-detection flows (autoDetectToolSupport) into safe defaults without visibility.

7) Error handling and user metadata learning
- On tool errors, `ModelContext.handleToolError` prompts the user (if `__ollmPromptUser` exists) and may persist tool_support metadata to `user_models.json` via `profileManager`.

Risk & notes:
- Debouncing exists for repeated prompts (good), but heuristics used to detect tool errors are same brittle regex as provider side. A mismatch here can cause incorrect user prompts or missed learning opportunities.

8) Tests & documentation
- There are many provider integration tests (`packages/ollm-bridge/src/__tests__/*`) that exercise streaming, tool calls, and model management. These tests are valuable and appear to validate many happy-path cases.

Gaps discovered
- Several brittle heuristics: tool detection by textual regex, JSON-in-content detection for tool calls, and char/4 token estimation.
- Some silent failure modes: malformed streaming JSON is skipped with no logging, and errors thrown by provider endpoints may be swallowed or turned into generic messages.
- Potential legacy/duplicate logic: there are several layered fallbacks (default `modelCommands` vs `createModelCommands(container)`), and multiple audits/docs in `.dev/` indicating prior partial refactors that left leftover TODOs and comments.

Concrete examples & lines (spot checks)
- Exact request body keys: `LocalProvider.chatStream()` sends: `model`, `messages` (from `mapMessages()`), `tools` (from `mapTools()`), `options` (from `ModelContext.options`), `stream: true`, `think: request.think`.
- `mapMessages()` concatenates parts with `.join('')` (no delimiter) (see `packages/ollm-bridge/src/provider/localProvider.ts`).
- `mapChunkToEvents()` tries to parse `message.content` that looks like JSON to a tool call and also parses `message.tool_calls` entries (see `localProvider.ts`).
- Token fallback: `countTokens` uses char/4 (see `localProvider.ts` and token fallback tests in core).

Severity matrix (prioritized)
- Critical (requires near-term fixes/tests):
  1. Token counting discrepancies that affect context sizing and compression decisions — add deterministic tests and, where possible, use provider tokenizers or adopt explicit tokenization library. (Files: `tokenCounter.ts`, `localProvider.countTokens()`)
  2. Brittle tool detection/error heuristics (regex + retry logic) — add explicit integration tests against expected Ollama error payloads and broaden/normalize matching logic. (Files: `localProvider.ts`, `ModelContext.handleToolError`)
- Medium:
  1. Danger of false-positive tool-call detection when assistant produces JSON-like text — add stricter validation or signal in protocol. (Files: `mapChunkToEvents`)
  2. Silent skipping of malformed streaming lines — add structured logging or a debug mode to surface these parse failures.
- Low:
  1. Joining message parts without a separator might be fine in many cases but is fragile for multimodal messages (images/text). Consider using explicit separators or preserving part metadata.
  2. Reliance on `globalThis` callbacks for user prompts and system messages; consider dependency injection for testability.

Suggested next steps (tests & mitigations) ⚡
- Create unit/integration tests that assert the exact payload `ModelContext` -> provider includes `options.num_ctx`, systemPrompt content, tools list. Add a stubbed Ollama-like test server to validate behavior when options are ignored and when tool support errors are returned.
- Add explicit tests for `mapMessages()` with multi-part messages (text+image), verifying expected concatenation and expected content. Test for connector edge cases where parts must be separated.
- Improve token counting tests: compare provider.countTokens() results vs tokenCounter fallback on realistic model prompts; add tests to ensure context trimming/compression behaves consistently under both counting regimes.
- Harden tool detection logic: prefer structured provider error fields if available, or require an explicit `tool_supported` capability during model discovery.
- Add better logging for malformed stream lines (at least in debug builds) to make streaming parsing issues visible.

Appendix: Where to inspect next (developer checklist)
- Add integration test: `ModelContext` -> `LocalProvider` payload contains `options.num_ctx` and `options.temperature` (test provider that echoes payload)
- Add tests for `mapChunkToEvents()` JSON heuristics and ensure false-positive cases are covered
- Add token estimation integration test with realistic long system prompts and memory additions
- Consider adding a `ProviderCapabilities` endpoint or discovery phase to obtain structured information (tool/function support, max tokens, streaming features) from local LLM runtime.

---

If you'd like, I can:
1) Open a focused PR with tests that show the breakages (no production fixes yet), or
2) Create an issue tracker epics/tasks list with the prioritized items above.

What would you like me to do next? (I can start by adding tests that capture the most critical token-count and tool-detection bugs.)

---

## Update: Test runs & new findings (2026-01-18) ✅

Actions performed:
- Ran `LocalProvider` unit tests (`packages/ollm-bridge/src/provider/__tests__/localProvider.test.ts`): all tests passed (28 -> 31 with added tests).
- Ran `tokenLimits` unit tests (`packages/core/src/core/__tests__/tokenLimits.test.ts`): all tests passed.
- Ran `ModelContext` tool-detection tests (`packages/cli/src/features/context/__tests__/ModelContext.test.tsx`): all tests passed.
- **Added tests** to `packages/ollm-bridge/src/provider/__tests__/localProvider.test.ts` to cover JSON-in-content heuristics: (1) detect tool call embedded as JSON content, (2) do not detect arbitrary JSON as tool call, (3) handle JSON content where `parameters` is non-object.

New findings from test work:
- The heuristic that detects tool calls embedded in `message.content` behaves as intended for positive and negative cases (tests confirm detection and non-detection).
- **Inconsistency discovered:** when a tool call is detected via JSON-in-content and its `parameters` field is not an object (e.g., a string), `mapChunkToEvents()` currently keeps the raw string as `args`. In contrast, `message.tool_calls` parsing attempts to normalize/parse argument strings into objects (or marks parse errors). This results in inconsistent `args` types depending on where the tool call came from.

Recommendation (short-term):
- Normalize `args` consistently across both code paths. Options:
  - Attempt to parse `parameters` when it's a string and coerce to an object (if JSON), otherwise wrap in `{ __raw__: <value> }` and include a `__parsing_error__` flag as done elsewhere.
  - Add unit tests asserting the expected normalized shape for non-object parameters to prevent regressions.

Recommendation (long-term):
- Consider normalizing the tool call protocol to require `arguments` to always be an object (spec/update) or add a robust conversion layer that guarantees `ToolCall.args` is always an object to simplify downstream tool invocation logic.

Notes:
- All added tests currently pass and have been committed to the working tree.
- No new runtime failures were observed when running the targeted tests; the added tests only exposed the `parameters` normalization inconsistency (behaviorally present but not failing tests before).

Next step suggestions (pick one):
1) Implement a normalization change in `LocalProvider.mapChunkToEvents()` that ensures `args` is always an object, add tests, and run the broader test suite.
2) Open lightweight issues for the token-count and tool-detection items and schedule PRs separately (I can create the issues and include links to the new tests and recommendations).
3) Add logging around JSON parse failures in streaming parser to aid debugging in flaky environments (optional immediate PR).

---

## Final note — No fixes applied in this audit ⚠️

Finding: JSON-in-content tool-call detection inconsistency discovered and confirmed by tests. It is important because it can lead to inconsistent `ToolCall.args` shapes depending on whether the call came via `message.tool_calls` or embedded JSON content.

- Status: **No production fixes were applied** in this audit — only investigative changes and tests were added.
- Artifacts added in this audit:
  - Tests added: `packages/ollm-bridge/src/provider/__tests__/localProvider.test.ts` (JSON-in-content tool-call cases)
  - Audit updated: `.dev/LLM-audit-1.md` (this file)

Planned next steps (to be executed later):
- Create issues for: token-count accuracy, robust tool-detection/error heuristics, streaming parse logging, and args normalization.
- Implement `args` normalization in `LocalProvider.mapChunkToEvents()` and add unit tests verifying normalized object shape for all tool-call sources.
- Add integration test that asserts `ModelContext` sends `options.num_ctx` and `options.temperature` to providers (stubbed provider echoing payload).

If you'd like, I can open the issues now and include the failing tests or PR scaffolds for review. Otherwise, I will wait for your go-ahead before making any production changes.


