# Stage 05 - Hooks, Extensions, and MCP

## Baseline Context (standalone)
- Core runtime, tools, and services exist.
- Use `~/.ollm/` for user config and `.ollm/` for workspace config.

## Goals
- Add a hook system for event-driven customization.
- Add extension loading with manifest-defined tools and settings.
- Integrate MCP servers for external tools.

## Hook Protocol (JSON via stdin/stdout)
Input example:
```json
{
  "event": "before_model",
  "data": {
    "session_id": "abc",
    "prompt": "...",
    "model": "model-name",
    "messages": []
  }
}
```
Output example:
```json
{
  "continue": true,
  "systemMessage": "optional message",
  "hookSpecificOutput": {
    "additionalContext": "..."
  }
}
```

## Extension Manifest (manifest.json)
```json
{
  "name": "my-extension",
  "version": "1.0.0",
  "description": "Example extension",
  "mcpServers": {
    "server": { "command": "node", "args": ["server.js"] }
  },
  "hooks": {
    "session_start": [{ "name": "init", "command": "echo ready" }]
  },
  "settings": [
    { "name": "apiKey", "envVar": "MY_API_KEY", "sensitive": true }
  ],
  "skills": [
    { "name": "code-review", "description": "Review code" }
  ]
}
```

## Tasks

### S05-T01: Hook system core
Steps:
- Implement hook registry, planner, runner, and translator.
- Support events: session_start, session_end, before_agent, after_agent, before_model, after_model, before_tool_selection, before_tool, after_tool.
Deliverables:
- `packages/core/src/hooks/*`
Acceptance criteria:
- Hooks execute in order with timeout and error handling.

### S05-T02: Hook trust model
Steps:
- Add hash-based approval for hooks from untrusted sources.
- Store approvals in `~/.ollm/trusted-hooks.json`.
Deliverables:
- `packages/core/src/hooks/trustedHooks.ts`
Acceptance criteria:
- Untrusted hooks require explicit approval.

### S05-T03: Extension manager
Steps:
- Load extensions from `~/.ollm/extensions/` and `.ollm/extensions/`.
- Merge extension settings with core settings.
Deliverables:
- `packages/core/src/extensions/extensionManager.ts`
Acceptance criteria:
- Extensions are discoverable and can be enabled or disabled.

### S05-T04: MCP client and tool wrappers
Steps:
- Implement MCP client with stdio, SSE, and HTTP transports.
- Convert MCP tool schemas into internal tool schemas.
Deliverables:
- `packages/core/src/mcp/*`
- `packages/core/src/tools/mcp-tool.ts`
Acceptance criteria:
- MCP tools appear in the tool registry and can execute.
