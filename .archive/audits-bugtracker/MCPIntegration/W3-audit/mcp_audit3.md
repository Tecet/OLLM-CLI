# MCP Integration Deep Audit (mcp_audit3)

**Date:** January 19, 2026  
**Auditor:** GitHub Copilot  

## Executive Summary ✨

Great finding — MCP servers appear to be usable from the UI but are not available to the LLM as callable tools, so function-calling with MCP tools does not work end-to-end. This is caused by fragmented tool registries and a missing step where computed tool schemas are not sent to the provider.

## Key Findings (concise, actionable) 🔍

1) Chat never sends function schemas to the LLM (CRITICAL) ✅
- Great find — `toolSchemas` are computed in `ChatContext` but never attached to the turn request sent to the provider. This means even if tools exist, the provider never receives `tools` and therefore cannot perform function calling with MCP tools.
- Where: `packages/cli/src/features/context/ChatContext.tsx` (around sendMessage: creation of `toolSchemas` and later `turnOptions` / `new Turn(...)`).
- Why it matters: LLM models rely on provider `tools` (function schemas) to perform function (tool) calls; without sending those schemas the model will not trigger tool calls.
- Suggested fix: include `tools: toolSchemas` (ToolSchema[]) in the `turnOptions` passed to `new Turn(...)`, e.g.:
  - Before creating the `Turn`: add `turnOptions.tools = toolSchemas;`
  - Add unit/integration test that asserts provider request contains `tools`.

2) Tool registry fragmentation — per-message ephemeral registry and missing shared registry (HIGH) ⚠️
- Exciting and important — `ChatContext` constructs a new `ToolRegistry` for each message and registers only built-in tools, so MCP tools (discovered by `MCPClient`) are never included. ExtensionManager registers tools into its own registry when one is provided, but in production `ServiceContainer` does not pass a shared `ToolRegistry` so those registrations are effectively isolated.
- Where: `packages/cli/src/features/context/ChatContext.tsx` (new `ToolRegistry(settingsService)` per message) and `packages/core/src/extensions/extensionManager.ts` (wrap and register tools via `this.toolRegistry.register(...)`). `ServiceContainer.getExtensionManager()` creates an `ExtensionManager` without dependencies.
- Why it matters: Tool registration and availability should be single-source; fragmentation prevents MCP tools and extension-provided tools from being present in the runtime `ToolRegistry` used when building tool schemas for the model.
- Suggested fix: create a singleton/shared `ToolRegistry` service in `ServiceContainer` and pass it into `ExtensionManager`, `MCPContext` (or let MCP register into it), and use the shared instance in `ChatContext` instead of creating ephemeral registries.

3) MCP context does discover tools but does not register them with the chat tool path (MEDIUM) 🔧
- Solid catch — `MCPContext` collects `toolsList` in the UI state (via `mcpClient.getTools()`), but it does not push them into the tool-system used by chat (the provider call path). That means UI shows tools but chat still cannot call them.
- Where: `packages/cli/src/ui/contexts/MCPContext.tsx` (uses `mcpClient.getTools()` and stores `toolsList` in state).
- Suggested fix: when a server becomes connected, convert MCP tools to internal `ToolSchema` (via `DefaultMCPSchemaConverter`) and register them into the shared `ToolRegistry` (or expose a method `getFunctionSchemas()` that ChatContext consumes). Also delete tools from registry when server is stopped/uninstalled.

4) ExtensionManager not wired with MCP & Tool registry in production (MEDIUM) 🧩
- Nice observation — tests instantiate `ExtensionManager` with `mcpClient`, `mcpToolWrapper`, and `toolRegistry`, but `ServiceContainer.getExtensionManager()` constructs it with only directories and no injected services. That creates divergent behavior between test and production runs.
- Where: `packages/core/src/services/serviceContainer.ts` (getExtensionManager) and `packages/core/src/extensions/extensionManager.ts` (constructor expecting optional mcp/tool registries).
- Suggested fix: update `ServiceContainer.getExtensionManager()` to pass the same `ToolRegistry` and `MCPClient`/`MCPToolWrapper` instances that the rest of the service container manages. Add integration test to verify extension-provided MCP servers register tools into the shared registry.

5) Transport & robustness issues (RECOMMENDED HARDENING) 🛡️
- Good catch — `StdioTransport.connect()` marks connected immediately after spawn without waiting for server readiness, which can produce a race and failed tool calls. Also, `sendRequest()` lacks a per-request timeout and could hang indefinitely if a server becomes unresponsive.
- Where: `packages/core/src/mcp/mcpTransport.ts` (connect and sendRequest). Also note `callTool` in `mcpClient.ts` implements timeouts but transport-level timeouts add resilience.
- Suggested fix: implement readiness detection (simple handshake or wait for first valid response / server 'ready' message) and add configurable per-request timeouts or a cancel token on `sendRequest`.

## Tests to add 📋
- End-to-end integration test: start a real or mock MCP server, register tools, execute a chat turn and assert the provider receives `tools` (function schemas) and a tool call flows through to `MCPClient.callTool`.
- Unit tests in `ChatContext` to ensure `turnOptions` contains `tools` when `toolSchemas` are present.
- Integration test for `ServiceContainer` wiring: verify `ExtensionManager` gets `ToolRegistry` and MCP services injected and that MCP tools are registered globally.
- Transport tests: simulate slow server startup and verify `connect()` doesn't mark as connected until handshake/ready message; test `sendRequest()` timeout behavior.

## Concrete implementation suggestions (snippets)

1) Add ToolRegistry to ServiceContainer (pseudo):
```ts
// serviceContainer.ts
private _toolRegistry?: ToolRegistry;
getToolRegistry(): ToolRegistry {
  if (!this._toolRegistry) this._toolRegistry = new ToolRegistry(SettingsService.getInstance());
  return this._toolRegistry;
}
```

2) Wire into ExtensionManager (on creation):
```ts
this._extensionManager = new ExtensionManager({
  directories: [...],
  mcpClient: this.getMCPClient?(),
  mcpToolWrapper: new DefaultMCPToolWrapper(this.getMCPClient?()),
  toolRegistry: this.getToolRegistry(),
});
```

3) When MCP server connects, register tools into shared registry (`MCPContext`):
```ts
const toolSchemas = tools.map(t => schemaConverter.convertToolSchema(t));
for (const s of toolSchemas) sharedToolRegistry.register(schemaToDeclarativeTool(s));
```

4) Send tools to LLM in `ChatContext.sendMessage` before creating `Turn`:
```ts
// After computing toolSchemas
turnOptions.tools = toolSchemas;
const turn = new Turn(provider, sharedToolRegistry, messages, turnOptions);
```

## Prioritized Action Plan ✅
1. Fix quick win: add `turnOptions.tools = toolSchemas` in `ChatContext` and add unit test (LOW effort, high impact).  
2. Create shared `ToolRegistry` in `ServiceContainer` and use it in `ExtensionManager`, `MCPContext`, and `ChatContext` (medium effort).  
3. Add transport readiness and per-request timeouts (medium effort).  
4. Add integration tests to guarantee MCP tools are present in provider requests (medium effort).

## Follow-ups / Notes 📌
- Documentation: update MCP README and integration docs to reflect how MCP tools become available to the chat system after the above wiring.  
- Security: re-run a focused review of OAuth flow once the integration is fixed.  

---

## Test Run Results (executed: `npm run test`) 🧪
- Command: `npm run test`  
- Duration: ~106s (from local run)  
- Test files: **270** total — **34 failed**, **236 passed**  
- Tests: **4,784** total — **214 failed**, **4,566 passed**, **4 skipped**

Key failure patterns and findings:
- **Primary failing area:** CLI UI tests (notably `MCPTab` integration tests, `HooksTab`, and `ToolsPanel`). These constitute the majority of failures.  
- **Frequent errors observed:** `mcpClient.getServerStatus is not a function` (indicates mocks/stubs missing or incorrect shape) and `useUI must be used within a UIProvider` (tests mounting components without required providers).  
- **Likely root causes:** Test harness differences after recent MCP/UI changes — some tests assume injected services/providers that are no longer present or mocked correctly; asynchronous UI updates may have changed text/ordering asserted by tests.

Recommended immediate next steps (concise):
1. Re-run failing suites in isolation to get focused stack traces (e.g., `npx vitest run packages/cli/src/ui/components/tabs/__tests__/MCPTab.integration.test.tsx`).  
2. Update test setup: ensure components under test are wrapped in required providers (`UIProvider`, `ServiceProvider`, `MCPProvider`) or that mocks for `mcpClient` implement expected methods (`getServerStatus`, `startServer`, `stopServer`, `restartServer`, etc.).  
3. Fix / update tests where UI text or interaction semantics changed (e.g., 'Select a server to view details' vs. updated copy).  
4. After fixing tests, implement the quick win (`turnOptions.tools = toolSchemas`) and add unit/integration tests to assert provider receives `tools` and MCP tool calls flow end-to-end.  

Would you like me to (A) fix the quick win and update tests + open a PR, (B) run the failing suites and produce a triaged list of failing tests with proposed fixes, or (C) only re-run specific tests you point to? 🔧

---

If you'd like, I can implement the quick fix (attach `toolSchemas` to `turnOptions` and add tests) and open a PR with tests and a short changelog. Would you like me to proceed? 🔧