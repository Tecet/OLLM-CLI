# MCP Audit 1

Date: 2026-01-19

Summary
- Purpose: rapid deep-dive of the MCP (Model Context Protocol) integration and how MCP is surfaced to the LLM/chat tooling. Saved findings, potential issues, and recommendations.

Files inspected
- packages/core/src/mcp/mcpClient.ts
- packages/core/src/mcp/mcpTransport.ts
- packages/core/src/mcp/mcpToolWrapper.ts
- packages/core/src/mcp/config.ts
- packages/core/src/mcp/types.ts
- packages/core/src/prompts/PromptRegistry.ts
- packages/core/src/mcp/README.md
- packages/cli/src/services/mcpMarketplace.ts
- packages/cli/src/services/mcpConfigService.ts
- packages/cli/src/ui/contexts/MCPContext.tsx
- packages/core/src/extensions/extensionManager.ts
- packages/core/typescript-errors.txt

Architecture & integration notes
- Core components
  - `MCPClient` (DefaultMCPClient): manages server lifecycle, tool/resource/prompt discovery, and tool invocation (sync + streaming).
  - `MCPTransport`: implementations for `stdio`, `sse`, and `http` transports. `StdioTransport` spawns local processes and speaks JSON-RPC over lines.
  - `MCPToolWrapper` (DefaultMCPToolWrapper): converts MCP tool schemas to the internal DeclarativeTool API and returns `ToolResult` objects containing `llmContent` and `returnDisplay`.
  - `MCPOAuthProvider` + token storage: OAuth flows + token storage hooks are present (used by MCPClient/startServer when OAuth is enabled).
  - `PromptRegistry`: stores prompts coming from MCP servers (`source: 'mcp'`) — these prompts can be surfaced to prompt registry and used by LLM flows.
  - `extensionManager` integrates MCP by wrapping extension-declared MCP tools via `mcpToolWrapper.wrapTool(...)` and registering them with the tool system.

- How chat/LLM uses MCP
  - MCP tools become first-class internal tools (wrapped by DefaultMCPToolWrapper) so the LLM/tooling stack can call them like any other tool; results are returned as `llmContent` (ready for model consumption).
  - MCP prompts are discoverable and stored through `PromptRegistry` (source `'mcp'`) and can be requested by the runtime via `MCPClient.getPrompt`.
  - Hooks/extensions that define MCP servers have their tools wrapped and registered; when the model or hook system requests a tool call, the MCPToolInvocation executes and relays streaming chunks if available.

Findings / Potential issues
1. TypeScript and API mismatches
  - `packages/core/typescript-errors.txt` contains multiple TypeScript errors referencing the MCP modules (examples: missing exports, incorrect argument counts, property/method mismatches such as `getAccessToken` not found, `'ToolResult'` not exported). These need addressing to keep type-safety.
  - `packages/core/src/mcp/index.ts` re-exports `ToolResult`/types; ensure the named types in `mcpToolWrapper.ts` are exported consistently to avoid TS2459.

2. Transport / lifecycle robustness
  - `StdioTransport.connect()` marks the transport as connected immediately after spawn without an explicit handshake; if the spawned process fails quickly this may transiently report connected and later transition to exit — consider a short handshake or health-check (e.g., expect a ready message or attempt a simple `tools/list` call before marking fully connected).
  - `MAX_OUTPUT_SIZE` enforced (10MB) is good, but large outputs cause hard process kill and reject all pending requests. Consider streaming backpressure / chunk-based limits and clearer error propagation to callers.
  - `sendRequest()` assumes JSON-RPC responses with numeric `id`; server-initiated messages or notifications are logged as unknown. If any MCP servers send unsolicited messages, they may be ignored.

3. Error handling and telemetry
  - Several places mark server status to `error` on exceptions but don't persist diagnostic logs. `getServerLogs()` is TODO; without logs troubleshooting is harder. Implement log capture and access (e.g., file in `~/.ollm/mcp/logs/`).
  - `mcpToolWrapper` translates errors into `llmContent` but developers should ensure sensitive tokens/headers are scrubbed before surfacing to LLM output.

4. OAuth & token handling
  - `DefaultMCPClient.startServer()` constructs `MCPOAuthProvider` and calls `getAccessToken()` immediately. Type errors indicate `MCPOAuthProvider` signatures may not match usage. Verify `mcpOAuth` exports and method names.
  - Token storage implementations (Keytar/file) exist — ensure secrets are persisted with secure permissions and encrypted where applicable on supported platforms.

5. Tests and coverage
  - The repo contains extensive MCP unit/property tests and many appear to pass for `mcpToolWrapper` and `mcpTransport` based on test results coverage artifacts; however TypeScript build errors remain and can hide runtime issues.
  - Several mcp tests in `packages/core/src/mcp/__tests__` cover schema conversion, env substitution, client behaviors — re-run the full suite after fixing TS errors.

6. Configuration and user workspace handling
  - `mcpConfigService` supports user-level and workspace-level configs with watch and atomic writes. It attempts automatic recovery on JSON parse errors — good practice but be cautious about silently accepting corrupted config.

Recommendations (prioritized)
1. Fix TypeScript API errors in `packages/core` (see `packages/core/typescript-errors.txt`) — export missing types (e.g., `ToolResult`), align function names/signatures (`MCPOAuthProvider`), and correct imports/exports. This is blocking for maintainability.
2. Harden `StdioTransport.connect()` with a light handshake or initial `tools/list` probe before reporting `connected`. Add better error classification for early exits.
3. Implement `getServerLogs()` and persist MCP server stderr/stdout to files under `~/.ollm/mcp/logs/` for post-mortem. Add size-rotation.
4. Replace the hard kill-on-oversize output with backpressure or reject incremental chunks; surface a clear error message to the caller rather than an opaque process-kill.
5. Add filtering/scrubbing when converting MCP errors or results to `llmContent` to avoid accidentally leaking secrets or tokens.
6. Add integration tests that spawn a real (mock) MCP process and simulate early crash, large output, streaming chunks, and unsolicited notifications.
7. Re-run full `vitest` for `packages/core` and `packages/cli` after TS fixes; address any failing tests.

Quick action items
- Fix exports in `packages/core/src/mcp/mcpToolWrapper.ts` and re-run TypeScript build.
- Add minimal handshake probe in `StdioTransport.connect()` and update tests that assume immediate connection.
- Implement basic log file writing for MCP server processes.

Next steps I can take (choose one)
- I can open a branch, fix the TypeScript export(s) (small change) and run `npx vitest` on `packages/core` to validate.  
- Or I can run the MCP-related test suite locally and collect failing tests & stack traces for you.

End of audit.
