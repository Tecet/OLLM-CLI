# Stage 05: Hooks, Extensions, and MCP

## Overview
Add a hook system for event-driven customization, extension loading with manifest-defined tools, and MCP server integration for external tools.

## Prerequisites
- Stage 03 complete (Tool System)
- Stage 04 complete (Services)

## Estimated Effort
4-5 days

## Data Locations
- User config: `~/.ollm/`
- Workspace config: `.ollm/`
- User extensions: `~/.ollm/extensions/`
- Workspace extensions: `.ollm/extensions/`
- Trusted hooks: `~/.ollm/trusted-hooks.json`

---

## Hook Protocol

Hooks communicate via JSON over stdin/stdout.

### Input Format
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

### Output Format
```json
{
  "continue": true,
  "systemMessage": "optional message",
  "hookSpecificOutput": {
    "additionalContext": "..."
  }
}
```

### Hook Events
| Event | Trigger | Data |
|-------|---------|------|
| `session_start` | New session begins | `session_id` |
| `session_end` | Session ends | `session_id`, `messages` |
| `before_agent` | Before agent processes | `prompt`, `context` |
| `after_agent` | After agent completes | `response`, `tool_calls` |
| `before_model` | Before model call | `messages`, `model` |
| `after_model` | After model response | `response`, `tokens` |
| `before_tool_selection` | Before tool chosen | `available_tools` |
| `before_tool` | Before tool executes | `tool_name`, `args` |
| `after_tool` | After tool completes | `tool_name`, `result` |

---

## Extension Manifest

`manifest.json` in extension directory:

```json
{
  "name": "my-extension",
  "version": "1.0.0",
  "description": "Example extension",
  "mcpServers": {
    "server": { 
      "command": "node", 
      "args": ["server.js"],
      "env": {}
    }
  },
  "hooks": {
    "session_start": [
      { "name": "init", "command": "echo ready" }
    ],
    "before_tool": [
      { "name": "validate", "command": "node validate.js" }
    ]
  },
  "settings": [
    { 
      "name": "apiKey", 
      "envVar": "MY_API_KEY", 
      "sensitive": true,
      "description": "API key for service"
    }
  ],
  "skills": [
    { 
      "name": "code-review", 
      "description": "Review code for issues",
      "prompt": "Review the following code..."
    }
  ]
}
```

---

## Tasks

### S05-T01: Hook System Core

**Steps**:
1. Implement hook components:
   - `HookRegistry`: Register and manage hooks
   - `HookPlanner`: Determine which hooks to run
   - `HookRunner`: Execute hooks with timeout
   - `HookTranslator`: Convert between formats
2. Support all hook events listed above
3. Handle hook execution:
   - Timeout handling (default: 30s)
   - Error isolation (one hook failure doesn't stop others)
   - Ordered execution
4. Pass data between hooks and core

**Deliverables**:
- `packages/core/src/hooks/hookRegistry.ts`
- `packages/core/src/hooks/hookPlanner.ts`
- `packages/core/src/hooks/hookRunner.ts`
- `packages/core/src/hooks/hookTranslator.ts`

**Acceptance Criteria**:
- Hooks execute in order with timeout handling
- Hook errors are isolated
- Data flows correctly between hooks and core

---

### S05-T02: Hook Trust Model

**Depends on**: T01

**Steps**:
1. Implement trust verification:
   - Hash hook scripts/commands
   - Store approved hashes in `~/.ollm/trusted-hooks.json`
2. Trust sources:
   - Built-in hooks: Always trusted
   - User hooks: Trusted by default
   - Workspace hooks: Require approval
   - Downloaded hooks: Require approval
3. Approval flow:
   - Prompt user for untrusted hooks
   - Store approval with hash
   - Re-prompt if hash changes

**Deliverables**:
- `packages/core/src/hooks/trustedHooks.ts`

**Acceptance Criteria**:
- Untrusted hooks require explicit approval
- Approved hooks are remembered
- Hash changes trigger re-approval

---

### S05-T03: Extension Manager

**Depends on**: T01

**Steps**:
1. Implement `ExtensionManager`:
   - `loadExtensions(): Extension[]`
   - `getExtension(name): Extension`
   - `enableExtension(name): void`
   - `disableExtension(name): void`
2. Load extensions from:
   - `~/.ollm/extensions/` (user)
   - `.ollm/extensions/` (workspace)
3. Parse and validate `manifest.json`
4. Merge extension settings with core settings
5. Register extension hooks and MCP servers

**Deliverables**:
- `packages/core/src/extensions/extensionManager.ts`
- `packages/core/src/extensions/manifestParser.ts`

**Acceptance Criteria**:
- Extensions are discoverable
- Extensions can be enabled/disabled
- Extension settings merge correctly

---

### S05-T04: MCP Client and Tool Wrappers

**Depends on**: T03

**Steps**:
1. Implement MCP client:
   - Support transports: stdio, SSE, HTTP
   - Handle connection lifecycle
   - Manage multiple servers
2. Convert MCP tool schemas to internal format:
   - Map MCP parameters to ToolSchema
   - Handle MCP-specific types
3. Create tool wrappers:
   - Wrap MCP tool calls
   - Handle MCP responses
   - Error translation

**Deliverables**:
- `packages/core/src/mcp/mcpClient.ts`
- `packages/core/src/mcp/mcpTransport.ts`
- `packages/core/src/mcp/mcpSchemaConverter.ts`
- `packages/core/src/tools/mcp-tool.ts`

**Acceptance Criteria**:
- MCP tools appear in tool registry
- MCP tools can execute successfully
- Multiple MCP servers can run simultaneously

---

### S05-T05: Extension Marketplace/Registry

**Depends on**: T03

**Goal**: Allow users to discover and install community extensions.

**Steps**:
1. Implement `ExtensionRegistry`:
   - Fetch extension list from online registry
   - Parse extension metadata
   - Handle versioning
2. Slash commands:
   ```
   /extensions search "github"
   /extensions install @ollm/github-ext
   /extensions update [name]
   /extensions uninstall <name>
   ```
3. Local caching of registry data
4. Integrity verification via checksums

**Deliverables**:
- `packages/core/src/extensions/extensionRegistry.ts`
- `packages/cli/src/commands/extensionMarketplace.ts`

**Acceptance Criteria**:
- [ ] `/extensions search` returns matching extensions
- [ ] `/extensions install` downloads and installs
- [ ] Installed extensions appear in list
- [ ] Updates detect newer versions

---

### S05-T06: Extension Hot-Reload

**Depends on**: T03

**Goal**: Enable live reloading of extensions during development without restarting CLI.

**Steps**:
1. Watch extension directories for changes
2. Implement graceful unload:
   - Disconnect MCP servers
   - Unregister hooks
   - Unregister tools
3. Reload extension manifest and re-register
4. Configuration:
   ```yaml
   extensions:
     hotReload:
       enabled: true
       debounceMs: 500
   ```

**Deliverables**:
- `packages/core/src/extensions/extensionWatcher.ts`
- Updated `packages/core/src/extensions/extensionManager.ts`

**Acceptance Criteria**:
- [ ] File changes trigger reload
- [ ] Extension state cleanly unloaded
- [ ] New hooks/tools registered automatically
- [ ] No restart required

---

### S05-T07: Hook Debugging Mode

**Depends on**: T01

**Goal**: Visualize hook execution in real-time for debugging.

**Steps**:
1. Implement hook execution tracing:
   - Capture timing per hook
   - Capture input/output data
   - Capture errors
2. Debug output format:
   ```
   [hook:before_model] my-ext/validator → 23ms ✓
   [hook:before_tool] logger → 2ms ✓
   [hook:after_tool] analytics → ERROR: timeout
   ```
3. Slash command: `/hooks debug on|off`
4. Log to file option for post-run analysis

**Deliverables**:
- `packages/core/src/hooks/hookDebugger.ts`
- Updated `packages/core/src/hooks/hookRunner.ts`

**Acceptance Criteria**:
- [ ] `/hooks debug on` enables tracing
- [ ] Hook timing displayed in real-time
- [ ] Errors clearly shown
- [ ] Debug log exportable

---

### S05-T08: MCP Server Health Monitoring

**Depends on**: T04

**Goal**: Monitor MCP server status and auto-restart on failure.

**Steps**:
1. Implement health check system:
   - Periodic ping to MCP servers
   - Track connection state
   - Detect unresponsive servers
2. Auto-recovery:
   - Attempt restart on failure
   - Backoff strategy for repeated failures
   - Notify user of persistent issues
3. Configuration:
   ```yaml
   mcp:
     healthCheck:
       enabled: true
       interval: 30000
       maxRetries: 3
       autoRestart: true
   ```
4. Status indicator in UI

**Deliverables**:
- `packages/core/src/mcp/mcpHealthMonitor.ts`
- Updated `packages/core/src/mcp/mcpClient.ts`

**Acceptance Criteria**:
- [ ] Health checks run at configured interval
- [ ] Failed servers auto-restart
- [ ] Status visible in UI
- [ ] Manual restart via `/mcp restart <name>`

---

### S05-T09: Extension Sandboxing

**Depends on**: T03

**Goal**: Limit what extensions can access for security.

**Steps**:
1. Define permission model:
   - `filesystem`: Access to specific paths
   - `network`: HTTP/external calls
   - `env`: Access to environment variables
   - `shell`: Shell command execution
2. Permissions in manifest:
   ```json
   {
     "permissions": {
       "filesystem": ["./src", "~/.config"],
       "network": ["api.github.com"],
       "env": ["GITHUB_TOKEN"],
       "shell": false
     }
   }
   ```
3. Runtime enforcement in hook/tool execution
4. Prompt user for elevated permissions

**Deliverables**:
- `packages/core/src/extensions/extensionSandbox.ts`
- `packages/core/src/extensions/permissionManager.ts`

**Acceptance Criteria**:
- [ ] Extensions declare required permissions
- [ ] Unapproved permissions blocked at runtime
- [ ] User prompted for sensitive permissions
- [ ] Permission violations logged

---

## File Structure After Stage 05

```
packages/core/src/
├── hooks/
│   ├── hookRegistry.ts
│   ├── hookPlanner.ts
│   ├── hookRunner.ts
│   ├── hookTranslator.ts
│   └── trustedHooks.ts
├── extensions/
│   ├── extensionManager.ts
│   └── manifestParser.ts
├── mcp/
│   ├── mcpClient.ts
│   ├── mcpTransport.ts
│   └── mcpSchemaConverter.ts
└── tools/
    └── mcp-tool.ts
```

---

## Trusted Hooks File Format

`~/.ollm/trusted-hooks.json`:
```json
{
  "version": 1,
  "approvals": [
    {
      "source": ".ollm/extensions/my-ext/hooks/validate.js",
      "hash": "sha256:abc123...",
      "approvedAt": "2024-01-15T10:30:00Z",
      "approvedBy": "user"
    }
  ]
}
```

---

## MCP Server Configuration

In extension manifest or direct config:
```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path"],
      "env": {}
    },
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_TOKEN": "${GITHUB_TOKEN}"
      }
    }
  }
}
```

---

## Configuration Example

```yaml
hooks:
  enabled: true
  timeout: 30000
  trustWorkspace: false
  
extensions:
  enabled: true
  directories:
    - ~/.ollm/extensions
    - .ollm/extensions
  autoEnable: true
  
mcp:
  enabled: true
  connectionTimeout: 10000
  servers: {}
```

---

## Verification Checklist

- [ ] Hooks execute on correct events
- [ ] Hook timeout works correctly
- [ ] Hook errors don't crash the system
- [ ] Untrusted hooks prompt for approval
- [ ] Approved hooks are remembered
- [ ] Extensions load from both directories
- [ ] Extension enable/disable works
- [ ] MCP client connects to servers
- [ ] MCP tools appear in registry
- [ ] MCP tool execution works
