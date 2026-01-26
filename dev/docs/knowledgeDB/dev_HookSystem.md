# Hook System

**Last Updated:** January 26, 2026  
**Status:** Source of Truth

**Related Documents:**
- `dev_ToolExecution.md` - Hook integration with tools
- `dev_MCPIntegration.md` - MCP OAuth pre-authentication requirements
- `works_todo.md` - Task #7 (Hook System Documentation updates)

---

## Overview

The Hook System provides event-driven automation and safety gates. Hooks can trigger agent actions or run commands in response to file changes, user actions, or agent events.

**Core Responsibility:** Execute automated actions in response to events, with proper trust management and rate limiting.

---

## Core Architecture

### Hook Event Flow

```
Event Occurs (fileEdited, promptSubmit, etc.)
  ↓
HookEventHandler.emit(eventType, eventData)
  ↓
HookRegistry.getHooksForEvent(eventType)
  ├─ Filter by event type
  ├─ Filter by file patterns (if file event)
  └─ Return matching hooks
  ↓
For each matching hook:
  ├─ HookPlanner.shouldExecute(hook, context)
  │  ├─ Check conditions
  │  ├─ Check rate limits
  │  └─ Check dependencies
  ├─ HookRunner.execute(hook, eventData)
  │  ├─ Prepare execution context
  │  ├─ Run hook (askAgent or runCommand)
  │  └─ Capture result
  └─ HookDebugger.log(hook, result)
     ├─ Log execution
     ├─ Track metrics
     └─ Store for debugging
```

## Hook Types

### Event Types

**File Events:**
- `fileEdited` - When user saves a file
- `fileCreated` - When user creates a new file
- `fileDeleted` - When user deletes a file

**Agent Events:**
- `promptSubmit` - When user sends a message
- `agentStop` - When agent execution completes
- `before_tool_selection` - Before selecting tools to use

**User Events:**
- `userTriggered` - When user manually triggers hook

**System Events:**
- `notification` - General notification event

**See:** `packages/core/src/hooks/types.ts` line 30-42 for complete event type definitions

### Action Types

**askAgent:**
- Sends a new message to the agent
- Used for reminders, checks, validations
- Can access event data in prompt
- **Valid with all event types**

**runCommand:**
- Executes a shell command
- Used for builds, tests, linting
- Can use event data as input
- **Only valid with promptSubmit and agentStop**
- **Security:** Only whitelisted commands allowed

### Command Whitelist

For security, only specific commands are allowed in `runCommand` hooks:

**Whitelisted Commands:**
- `node` - Node.js runtime
- `python`, `python3` - Python runtime
- `bash`, `sh` - Shell scripts
- `npx` - npm package runner
- `uvx` - uv package runner

**Location:** `packages/core/src/hooks/hookRunner.ts` line 128

**Example:**
```json
{
  "then": {
    "type": "runCommand",
    "command": "npx eslint src/"  // ✅ Allowed
  }
}
```

```json
{
  "then": {
    "type": "runCommand",
    "command": "rm -rf /"  // ❌ Blocked (not whitelisted)
  }
}
```

## Hook Execution

### Trust Model

```
Hook Source
  ↓
Is Trusted?
  ├─ Yes (built-in or verified)
  │  ├─ Execute immediately
  │  └─ No confirmation needed
  └─ No (user-created)
     ├─ Show confirmation dialog
     ├─ User approves/denies
     └─ Remember decision (optional)
```

**Trusted Hooks:**
- Built-in hooks (shipped with app)
- Verified marketplace hooks
- Hooks in `.ollm/hooks/trusted/`

**User Hooks:**
- Hooks in `.ollm/hooks/`
- Require confirmation first time
- Can be marked as trusted

### Execution Context

```typescript
interface HookExecutionContext {
  event: {
    type: string;           // Event type
    timestamp: number;      // When event occurred
    data: any;             // Event-specific data
  };
  
  file?: {
    path: string;          // File path (for file events)
    content?: string;      // File content (if available)
    changes?: string;      // Diff (for fileEdited)
  };
  
  agent: {
    mode: string;          // Current agent mode
    context: any;          // Agent context
    history: Message[];    // Recent messages
  };
  
  user: {
    preferences: any;      // User preferences
    settings: any;         // User settings
  };
}
```

## Hook Planning

### Execution Decision

```
HookPlanner.shouldExecute(hook, context)
  ↓
Check Conditions
  ├─ File pattern matches? (for file events)
  ├─ Rate limit exceeded?
  ├─ Dependencies satisfied?
  └─ Context appropriate?
  ↓
Evaluate Priority
  ├─ Critical hooks (security, data loss)
  ├─ High priority (linting, formatting)
  ├─ Normal priority (reminders, checks)
  └─ Low priority (optional enhancements)
  ↓
Return Decision
  ├─ Execute: true/false
  ├─ Reason: string
  └─ Priority: number
```

**Rate Limiting:**
- Prevent hook spam
- Max executions per minute
- Cooldown period between runs
- Per-hook and global limits

**Dependency Checking:**
- Required tools available?
- Required files exist?
- Required services running?

## Hook Protocol (JSON stdin/stdout)

### Request Format

```json
{
  "jsonrpc": "2.0",
  "method": "execute",
  "params": {
    "event": {
      "type": "fileEdited",
      "timestamp": 1234567890,
      "data": {
        "path": "src/index.ts",
        "changes": "..."
      }
    },
    "context": {
      "agent": { "mode": "developer" },
      "user": { "preferences": {} }
    }
  },
  "id": 1
}
```

### Response Format

```json
{
  "jsonrpc": "2.0",
  "result": {
    "action": "askAgent",
    "prompt": "Run linting on the edited file",
    "metadata": {
      "executionTime": 123,
      "success": true
    }
  },
  "id": 1
}
```

### Error Format

```json
{
  "jsonrpc": "2.0",
  "error": {
    "code": -32603,
    "message": "Hook execution failed",
    "data": {
      "reason": "Command not found",
      "details": "..."
    }
  },
  "id": 1
}
```

## Hook Translation

### Legacy to Modern Format

```
Legacy Hook (JSON)
  ↓
HookTranslator.translate()
  ├─ Extract event type from "when"
  ├─ Extract action type from "then"
  ├─ Extract file patterns
  ├─ Extract prompt or command
  └─ Create modern HookDefinition
  ↓
Modern Hook (TypeScript)
  ├─ Typed event handlers
  ├─ Validated schemas
  └─ Better error handling
```

**Legacy Format:**
```json
{
  "name": "Lint on Save",
  "when": { "type": "fileEdited", "patterns": ["*.ts"] },
  "then": { "type": "askAgent", "prompt": "Run linting" }
}
```

**Modern Format:**
```typescript
{
  id: "lint-on-save",
  name: "Lint on Save",
  eventType: "fileEdited",
  filePatterns: ["*.ts"],
  action: {
    type: "askAgent",
    prompt: "Run linting on {{file.path}}"
  },
  trusted: false,
  enabled: true
}
```

## Key Interconnections

### Event System → Hook Registry
- `HookEventHandler` emits events
- `HookRegistry` stores all hooks
- `getHooksForEvent()` filters by event type
- Returns matching hooks for execution

### Hook Registry → Hook Planner
- `HookPlanner` receives hook list
- Evaluates execution conditions
- Checks rate limits and dependencies
- Returns execution decisions

### Hook Planner → Hook Runner
- `HookRunner` receives approved hooks
- Prepares execution context
- Executes hook action (askAgent or runCommand)
- Captures and returns result

### Hook Runner → Agent/Shell
- `askAgent` → Sends message to agent
- `runCommand` → Executes shell command
- Results returned to hook system
- Logged for debugging

### Hook Debugger → Metrics
- `HookDebugger` logs all executions
- Tracks success/failure rates
- Stores execution times
- Provides debugging information

## Related Files

**Core Hook System:**
- `packages/core/src/hooks/hookRegistry.ts` - Hook storage and retrieval
- `packages/core/src/hooks/hookEventHandler.ts` - Event emission
- `packages/core/src/hooks/hookPlanner.ts` - Execution planning
- `packages/core/src/hooks/hookRunner.ts` - Hook execution
- `packages/core/src/hooks/types.ts` - Type definitions

**Hook Management:**
- `packages/core/src/hooks/hookDebugger.ts` - Debugging and logging
- `packages/core/src/hooks/hookTranslator.ts` - Legacy format translation
- `packages/core/src/hooks/trustedHooks.ts` - Trust management

**Configuration:**
- `packages/core/src/hooks/config.ts` - Hook configuration
- `packages/core/src/hooks/messageBus.ts` - Event bus

**CLI Commands:**
- `packages/cli/src/commands/hookCommands.ts` - Hook management commands

**Services:**
- `packages/core/src/services/hookService.ts` - Hook service integration
- `packages/cli/src/services/hookLoader.ts` - Hook loading
- `packages/cli/src/services/hookFileService.ts` - Hook file operations

---

## Integration with Other Systems

### Hook Integration with Tools

Hooks can trigger tool execution through the `askAgent` action:

```json
{
  "name": "Lint on Save",
  "eventType": "fileEdited",
  "filePatterns": ["*.ts"],
  "action": {
    "type": "askAgent",
    "prompt": "Run linting on {{file.path}} using the shell tool"
  }
}
```

The agent will then use the appropriate tool (e.g., `shell` tool) to execute the linting command.

**See:** `dev_ToolExecution.md` for tool system details

### MCP OAuth Pre-Authentication

**Important:** MCP servers requiring OAuth must be authenticated BEFORE hook execution.

**Authentication Flow:**
1. User authenticates via MCP Panel UI (Ctrl+M → Select server → Press 'O')
2. OAuth tokens stored locally
3. Hook execution retrieves existing tokens
4. No interactive auth during automated hook execution

**Location:** `packages/core/src/mcp/mcpClient.ts` line 127-142

**Why:** Hooks run automatically and cannot prompt for user authentication. All OAuth must be completed beforehand.

**See:** `dev_MCPIntegration.md` for MCP OAuth details

---

## Best Practices

### 1. Hook Design

- Keep hooks focused (single responsibility)
- Use descriptive names
- Document hook purpose
- Test hooks independently

### 2. Event Selection

- Use file events for file-specific actions
- Use agent events for workflow automation
- Use userTriggered for manual actions
- Avoid excessive hook triggers

### 3. Action Selection

- Use `askAgent` for most automation
- Use `runCommand` only when necessary
- Prefer whitelisted commands
- Handle command failures gracefully

### 4. Trust Management

- Mark built-in hooks as trusted
- Review user hooks before trusting
- Use confirmation for untrusted hooks
- Regularly audit trusted hooks

### 5. Rate Limiting

- Set appropriate rate limits
- Prevent hook spam
- Use cooldown periods
- Monitor hook execution frequency

---

## Troubleshooting

### Hook Not Executing

**Symptom:** Hook doesn't run when event occurs

**Solutions:**
1. Check hook is enabled
2. Verify event type matches
3. Check file patterns (for file events)
4. Review rate limits
5. Check hook logs

### Command Blocked

**Symptom:** `runCommand` hook fails with "command not allowed"

**Solution:**
- Only whitelisted commands are allowed
- Use: node, python, bash, npx, uvx
- Or use `askAgent` to let agent choose tool

### MCP Hook Fails

**Symptom:** Hook using MCP server fails with auth error

**Solution:**
- Authenticate MCP server BEFORE hook execution
- Use MCP Panel UI (Ctrl+M → Select server → Press 'O')
- Verify OAuth tokens are stored
- Check MCP server is running

---

## File Locations

| File | Purpose |
|------|---------|
| `packages/core/src/hooks/hookRegistry.ts` | Hook storage and retrieval |
| `packages/core/src/hooks/hookEventHandler.ts` | Event emission |
| `packages/core/src/hooks/hookPlanner.ts` | Execution planning |
| `packages/core/src/hooks/hookRunner.ts` | Hook execution (line 128: whitelist) |
| `packages/core/src/hooks/types.ts` | Type definitions (line 30-42: events) |
| `packages/core/src/hooks/hookDebugger.ts` | Debugging and logging |
| `packages/core/src/hooks/hookTranslator.ts` | Legacy format translation |
| `packages/core/src/hooks/trustedHooks.ts` | Trust management |
| `packages/core/src/hooks/config.ts` | Hook configuration |
| `packages/core/src/hooks/messageBus.ts` | Event bus |
| `packages/cli/src/commands/hookCommands.ts` | Hook management commands |
| `packages/core/src/services/hookService.ts` | Hook service integration |
| `packages/cli/src/services/hookLoader.ts` | Hook loading |
| `packages/cli/src/services/hookFileService.ts` | Hook file operations |

---

**Note:** This document focuses on hook system architecture. For tool integration, see `dev_ToolExecution.md`. For MCP integration, see `dev_MCPIntegration.md`.