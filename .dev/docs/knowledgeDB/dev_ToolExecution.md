# Tool Execution System

**Last Updated:** January 26, 2026  
**Status:** Source of Truth

**Related Documents:**

- `dev_ProviderSystem.md` - Provider integration with tools
- `dev_MCPIntegration.md` - MCP tool integration
- `dev_HookSystem.md` - Hook integration with tools
- `dev_PromptSystem.md` - Goal management tools
- `dev_ContextCompression.md` - Goal system integration

---

## Overview

The Tool Execution System manages tool registration, validation, permission checking, and execution. It provides a unified interface for built-in tools, MCP tools, and dynamically registered tools.

**Core Responsibility:** Execute tools safely and efficiently, with proper permission checking and result formatting.

---

## Core Architecture

### Tool Registration Flow

```
Tool Definition
  ↓
ToolRegistry.registerTool(definition)
  ├─ Validate tool schema
  ├─ Store tool definition
  ├─ Create wrapper function
  └─ Make available to LLM
  ↓
LLM sees tool in available tools list
```

## Tool Categories

### Tool Capabilities Summary

| Category       | Tools                             | Risk Level | Auto-Approve (AUTO mode) |
| -------------- | --------------------------------- | ---------- | ------------------------ |
| File Discovery | glob, ls, grep                    | Low        | ✅ Yes                   |
| File Reading   | read_file, read_many_files        | Low        | ✅ Yes                   |
| File Writing   | write_file, edit_file             | Medium     | ❌ Ask                   |
| Web            | web_search, web_fetch             | Low        | ✅ Yes                   |
| Shell          | shell                             | High       | ❌ Ask                   |
| Memory         | memory, remember                  | Low        | ✅ Yes                   |
| Goals          | create_goal, etc.                 | Low        | ✅ Yes                   |
| Context        | write_memory_dump, read_reasoning | Low        | ✅ Yes                   |

### File Discovery Tools

- `glob` - Find files by pattern (wildcards, respects .gitignore)
- `ls` - List directory contents (recursive, sizes, permissions)
- `grep` - Search file contents (regex, case-sensitive/insensitive)

### File Operations Tools

- `read_file` - Read single file (line ranges, large file handling)
- `read_many_files` - Read multiple files (batch reading)
- `edit_file` - Edit file sections (search-replace, diff preview)
- `write_file` - Create/overwrite files (creates directories)

### Web Tools

- `web_search` - Search internet (multiple results, snippets)
- `web_fetch` - Fetch URL content (various content types, redirects)

### Shell Tool

**Note:** Shell tool execution is functional but UI enhancement is planned (see below).

- `shell` - Execute shell commands (streams output, env vars)

**Planned Enhancement: Collapsible Terminal UI** (Work in Progress - Low Priority)

The shell tool will be enhanced with a visual collapsible terminal component for better user experience:

**Current:** Plain text output in chat  
**Planned:** Collapsible terminal with visual indicators

```
▶ Shell: npm test (exit code: 0) ✓  [Collapsed - Success]

▼ Shell: npm test (exit code: 1) ✗  [Expanded - Error]
┌──────────────────────────────────────────┐
│ $ npm test                               │
│                                          │
│ > test                                   │
│ > vitest                                 │
│                                          │
│  ✗ src/api.test.ts (2 failed)           │
│    Expected: 404, Received: 500         │
│                                          │
│ Exit code: 1                             │
└──────────────────────────────────────────┘
```

**Features:**

- Auto-expand on errors (show details)
- Auto-collapse on success (save space)
- Real-time streaming output
- Visual status indicators (⏳ running, ✓ success, ✗ error)
- Click to expand/collapse

**Priority:** Low (focus on prompt/context management first)  
**See:** `works_todo.md` Task #11 for implementation details

### Memory & Context Tools

- `memory` - Persistent memory (survives sessions, searchable)
- `remember` - Simplified memory (quick storage)
- `write_memory_dump` - Context snapshot (debugging, backup)
- `read_reasoning` - Review past reasoning (conversation history)

### Goal Management Tools

**Note:** Goal management tools are part of the goal system documented in `dev_PromptSystem.md` and `dev_ContextCompression.md`.

- `create_goal` - Create new goal
- `switch_goal` - Switch active goal
- `complete_goal` - Mark goal complete
- `create_checkpoint` - Create goal checkpoint
- `record_decision` - Record decision with rationale

**See:** `dev_PromptSystem.md` for goal system architecture

### Other Tools

- `write_todos` - Manage todo list
- `trigger_hot_swap` - Trigger context hot swap (dynamic registration)

## Tool Execution Flow

### Standard Execution

```
LLM requests tool call
  ↓
ToolRegistry.executeTool(toolName, args)
  ↓
Validate tool exists
  ├─ Check tool registered
  └─ Return error if not found
  ↓
Validate parameters
  ├─ Check against schema
  ├─ Validate required fields
  └─ Type checking
  ↓
Check permissions
  ├─ PolicyEngine.checkPermission(tool, args)
  ├─ User approval if needed
  └─ Deny if not approved
  ↓
Execute tool function
  ├─ Call tool implementation
  ├─ Handle errors gracefully
  └─ Capture result
  ↓
Format result
  ├─ Convert to LLM format
  ├─ Add metadata
  └─ Truncate if too long
  ↓
Return result to LLM
```

### MCP Tool Execution

```
LLM requests MCP tool call
  ↓
ToolRegistry.executeTool(mcpToolName, args)
  ↓
MCPToolWrapper.execute()
  ├─ Validate tool exists
  ├─ Validate parameters
  └─ Check permissions
  ↓
MCPClient.callTool(toolName, args)
  ↓
MCPTransport.send()
  ├─ Serialize request (JSON-RPC 2.0)
  ├─ Send via transport
  └─ Wait for response
  ↓
MCP Server processes request
  ↓
MCPTransport.receive()
  ├─ Deserialize response
  ├─ Check for errors
  └─ Extract result
  ↓
MCPToolWrapper.formatResult()
  ├─ Convert to internal format
  ├─ Handle errors
  └─ Add metadata
  ↓
Return result to LLM
```

## Permission System

### Policy Engine Flow

```
Tool execution requested
  ↓
PolicyEngine.checkPermission(tool, args)
  ↓
Check approval mode
  ├─ YOLO: Auto-approve all
  ├─ AUTO: Auto-approve safe tools
  └─ ASK: Require user confirmation
  ↓
Evaluate tool risk
  ├─ Read-only: Low risk (auto-approve in AUTO)
  ├─ Write: Medium risk (ask in AUTO)
  └─ Shell/Delete: High risk (always ask unless YOLO)
  ↓
User confirmation (if needed)
  ├─ Show tool name and arguments
  ├─ Show diff preview (for file edits)
  ├─ User approves/denies
  └─ Remember decision (optional)
  ↓
Return permission result
  ├─ Approved: Continue execution
  └─ Denied: Return error to LLM
```

### Approval Modes

**YOLO Mode:**

- Auto-approve all tools
- No confirmations
- Maximum speed
- Use with caution

**AUTO Mode:**

- Auto-approve read-only tools
- Ask for write operations
- Ask for shell commands
- Balanced safety/speed

**ASK Mode:**

- Confirm every tool
- Maximum safety
- Slower workflow
- Recommended for beginners

## Tool Registration

### Built-in Tools Registration

```
Application Startup
  ↓
ToolRegistry.initialize()
  ↓
Register built-in tools
  ├─ File tools (glob, ls, grep, read, write, edit)
  ├─ Web tools (search, fetch)
  ├─ Shell tool
  ├─ Memory tools
  ├─ Goal tools
  └─ Context tools
  ↓
Register MCP tools (if configured)
  ├─ Connect to MCP servers
  ├─ Discover tools
  ├─ Convert schemas
  └─ Register with wrapper
  ↓
Register dynamic tools (runtime)
  ├─ write_memory_dump (ChatContext)
  ├─ trigger_hot_swap (HotSwapService)
  └─ Extension tools
  ↓
Tools available to LLM
```

### Dynamic Tool Registration

```
Runtime Event
  ↓
Service needs to register tool
  ↓
ToolRegistry.registerTool(definition)
  ├─ Validate schema
  ├─ Check for conflicts
  └─ Store definition
  ↓
Tool immediately available
  ↓
LLM can use tool in next turn
```

**Examples:**

- `write_memory_dump` - Registered by ChatContext when memory service available
- `trigger_hot_swap` - Registered by HotSwapService when enabled
- Extension tools - Registered when extension loads

## Tool Schema

### Tool Definition Structure

```typescript
interface ToolDefinition {
  name: string; // Tool identifier
  description: string; // What the tool does
  inputSchema: {
    type: 'object';
    properties: {
      [key: string]: {
        type: string; // Parameter type
        description: string; // Parameter description
        required?: boolean; // Is required?
      };
    };
    required: string[]; // Required parameters
  };
  execute: (args: any) => Promise<any>; // Implementation
}
```

### Example: read_file Tool

```typescript
{
  name: 'read_file',
  description: 'Reads and displays the complete contents of a single file',
  inputSchema: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Path to file to read'
      },
      start_line: {
        type: 'number',
        description: 'Starting line number (optional)'
      },
      end_line: {
        type: 'number',
        description: 'Ending line number (optional)'
      }
    },
    required: ['path']
  },
  execute: async (args) => {
    // Implementation
  }
}
```

## Output Handling

### Result Formatting

```
Tool execution completes
  ↓
Format result for LLM
  ├─ Success result
  │  ├─ Extract data
  │  ├─ Add metadata (execution time, etc.)
  │  └─ Format as string or structured data
  └─ Error result
     ├─ Extract error message
     ├─ Add context
     └─ Format user-friendly error
  ↓
Check result size
  ├─ If < 10KB: Return full result
  └─ If > 10KB: Truncate with indicator
  ↓
Return to LLM
```

### Truncation Strategy

**Large outputs:**

- File contents > 10KB: Show first 5KB + "... [truncated]"
- Directory listings > 1000 items: Show first 500 + count
- Search results > 100 matches: Show first 50 + count
- Shell output > 10KB: Show last 5KB (most recent)

**Rationale:**

- Prevents context overflow
- Keeps most relevant information
- LLM can request specific sections if needed

## Key Interconnections

### Tool Registry → Policy Engine

- `ToolRegistry.executeTool()` calls `PolicyEngine.checkPermission()`
- Policy engine evaluates risk level
- Returns approval/denial
- Registry proceeds or aborts based on result

### Tool Registry → MCP Client

- MCP tools registered via `MCPToolWrapper`
- Wrapper routes to `MCPClient.callTool()`
- MCP client handles transport and protocol
- Result returned through wrapper

### Tool Registry → LLM

- Registry provides tool list to LLM
- LLM sees tool names and descriptions
- LLM requests tool execution
- Registry executes and returns result

### Policy Engine → User Interface

- Policy engine requests confirmation
- UI shows tool details and preview
- User approves/denies
- Result returned to policy engine

### Dynamic Tools → Services

- Services register tools at runtime
- `ChatContext` registers memory dump tool
- `HotSwapService` registers hot swap tool
- Extensions register custom tools

## Related Files

**Core Tool System:**

- `packages/core/src/tools/tool-registry.ts` - Tool registration and execution
- `packages/core/src/tools/types.ts` - Tool type definitions
- `packages/core/src/tools/validation.ts` - Parameter validation
- `packages/core/src/tools/output-helpers.ts` - Result formatting

**Built-in Tools:**

- `packages/core/src/tools/glob.ts` - File pattern search
- `packages/core/src/tools/ls.ts` - Directory listing
- `packages/core/src/tools/grep.ts` - Content search
- `packages/core/src/tools/read-file.ts` - Read single file
- `packages/core/src/tools/read-many-files.ts` - Read multiple files
- `packages/core/src/tools/edit-file.ts` - Edit file sections
- `packages/core/src/tools/write-file.ts` - Create/overwrite files
- `packages/core/src/tools/web-search.ts` - Web search
- `packages/core/src/tools/web-fetch.ts` - Fetch URL content
- `packages/core/src/tools/shell.ts` - Shell execution
- `packages/core/src/tools/memory.ts` - Persistent memory
- `packages/core/src/tools/remember.ts` - Simplified memory
- `packages/core/src/tools/goal-management.ts` - Goal tools
- `packages/core/src/tools/write-todos.ts` - Todo management
- `packages/core/src/tools/read-reasoning.ts` - Reasoning retrieval

**Dynamic Tools:**

- `packages/core/src/tools/MemoryDumpTool.ts` - Memory dump tool
- `packages/core/src/tools/HotSwapTool.ts` - Hot swap tool

**Policy System:**

- `packages/core/src/policy/policyEngine.ts` - Permission checking
- `packages/core/src/policy/policyRules.ts` - Risk evaluation rules

**MCP Integration:**

- `packages/core/src/mcp/mcpToolWrapper.ts` - MCP tool wrapper
- `packages/core/src/mcp/mcpClient.ts` - MCP client

### Troubleshooting

### Tools Not Available to LLM

**Symptom:** LLM doesn't use tools, only provides advice

**Status:** ✅ RESOLVED (January 27, 2026)

**Solution:** Tools are now properly passed to the provider in chat requests via the refactored ChatContext system.

**Implementation:**

- Tools registered in ToolRegistry
- Passed through ChatContext to provider
- Available to LLM in all chat requests

**See:** ChatContext refactoring work (January 27, 2026) for complete implementation details

### Tool Execution Fails

**Symptom:** Tool call returns error

**Solutions:**

1. Check tool implementation for bugs
2. Verify parameters match schema
3. Check file paths are valid
4. Review error logs for details

### Permission Denied

**Symptom:** Tool execution blocked by policy engine

**Solutions:**

1. Check approval mode (YOLO, AUTO, ASK)
2. Approve tool manually if in ASK mode
3. Review tool risk level
4. Check policy rules configuration

---

## Best Practices

### 1. Tool Design

- Keep tools focused (single responsibility)
- Provide clear descriptions
- Use descriptive parameter names
- Validate inputs thoroughly
- Handle errors gracefully

### 2. Permission Management

- Use AUTO mode for balanced safety/speed
- Use ASK mode when learning
- Use YOLO mode only when safe
- Review tool approvals regularly

### 3. Output Formatting

- Truncate large outputs
- Provide context in errors
- Include metadata when helpful
- Format for LLM readability

### 4. Tool Integration

- Register tools at startup
- Validate schemas before registration
- Test tools independently
- Monitor tool usage and errors

---

## File Locations

| File                                        | Purpose                         |
| ------------------------------------------- | ------------------------------- |
| `packages/core/src/tools/tool-registry.ts`  | Tool registration and execution |
| `packages/core/src/tools/types.ts`          | Tool type definitions           |
| `packages/core/src/tools/validation.ts`     | Parameter validation            |
| `packages/core/src/tools/output-helpers.ts` | Result formatting               |
| `packages/core/src/policy/policyEngine.ts`  | Permission checking             |
| `packages/core/src/policy/policyRules.ts`   | Risk evaluation rules           |
| `packages/core/src/mcp/mcpToolWrapper.ts`   | MCP tool wrapper                |
| `packages/core/src/mcp/mcpClient.ts`        | MCP client                      |

**Built-in Tools:**

- `packages/core/src/tools/glob.ts` - File pattern search
- `packages/core/src/tools/ls.ts` - Directory listing
- `packages/core/src/tools/grep.ts` - Content search
- `packages/core/src/tools/read-file.ts` - Read single file
- `packages/core/src/tools/read-many-files.ts` - Read multiple files
- `packages/core/src/tools/edit-file.ts` - Edit file sections
- `packages/core/src/tools/write-file.ts` - Create/overwrite files
- `packages/core/src/tools/web-search.ts` - Web search
- `packages/core/src/tools/web-fetch.ts` - Fetch URL content
- `packages/core/src/tools/shell.ts` - Shell execution
- `packages/core/src/tools/memory.ts` - Persistent memory
- `packages/core/src/tools/remember.ts` - Simplified memory
- `packages/core/src/tools/goal-management.ts` - Goal tools
- `packages/core/src/tools/write-todos.ts` - Todo management
- `packages/core/src/tools/read-reasoning.ts` - Reasoning retrieval

**Dynamic Tools:**

- `packages/core/src/tools/MemoryDumpTool.ts` - Memory dump tool
- `packages/core/src/tools/HotSwapTool.ts` - Hot swap tool

---

**Note:** This document focuses on tool execution architecture. For MCP-specific tools, see `dev_MCPIntegration.md`. For hook integration with tools, see `dev_HookSystem.md`.
