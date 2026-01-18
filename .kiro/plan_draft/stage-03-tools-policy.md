# Stage 03: Tool System and Policy

## Overview
Implement a robust tool system with schema validation, confirmation UI, and built-in tools for file, shell, and web operations.

## Prerequisites
- Stage 02 complete (provider and core runtime)

## Estimated Effort
4-5 days

## Can Run Parallel With
- Stage 04 (Services and Sessions)

---

## Core Interfaces

Create in `packages/core/src/tools/types.ts`:

```typescript
export interface ToolInvocation<TParams extends object, TResult> {
  params: TParams;
  getDescription(): string;
  toolLocations(): string[];
  shouldConfirmExecute(abortSignal: AbortSignal): Promise<ToolCallConfirmationDetails | false>;
  execute(signal: AbortSignal, updateOutput?: (output: string) => void): Promise<TResult>;
}

export interface DeclarativeTool<TParams extends object, TResult> {
  name: string;
  displayName: string;
  schema: { name: string; description?: string; parameters?: Record<string, unknown> };
  createInvocation(params: TParams, messageBus: MessageBus): ToolInvocation<TParams, TResult>;
}

export interface ToolResult {
  llmContent: string;
  returnDisplay: string;
  error?: { message: string; type: string };
}

export interface ToolCallConfirmationDetails {
  toolName: string;
  description: string;
  risk: 'low' | 'medium' | 'high';
  locations?: string[];
}
```

---

## Built-in Tool Specifications

| Tool | Parameters | Description |
|------|------------|-------------|
| `read_file` | `path, startLine?, endLine?` | Read file content with optional line range |
| `read_many_files` | `paths[]` | Read multiple files at once |
| `write_file` | `path, content, overwrite?` | Write content to file |
| `edit_file` | `path, edits[]` | Apply targeted edits to file |
| `glob` | `pattern, directory?, maxResults?, includeHidden?` | Find files by pattern |
| `grep` | `pattern, directory?, filePattern?, caseSensitive?, maxResults?` | Search file contents |
| `ls` | `path, recursive?, includeHidden?, maxDepth?` | List directory contents |
| `shell` | `command, cwd?, timeout?, background?` | Execute shell command |
| `web_fetch` | `url, selector?, maxLength?` | Fetch web page content |
| `web_search` | `query, numResults?` | Search the web |
| `memory` | `action, key?, value?` | Persistent key-value storage |
| `write_todos` | `action, task?, id?` | Manage todo list |

---

## Tasks

### S03-T01: Tool Registry

**Steps**:
1. Implement `ToolRegistry` class:
   - `register(tool: DeclarativeTool): void`
   - `unregister(name: string): void`
   - `get(name: string): DeclarativeTool | undefined`
   - `list(): DeclarativeTool[]`
   - `getFunctionSchemas(): ToolSchema[]` - for provider exposure
2. Ensure predictable ordering (alphabetical or registration order)

**Deliverables**:
- `packages/core/src/tools/tool-registry.ts`

**Acceptance Criteria**:
- Tools are discoverable and ordered predictably
- Schemas are properly formatted for providers

---

### S03-T02: File Tools

**Steps**:
1. Implement `read_file`:
   - Support line ranges (startLine, endLine)
   - Detect encoding (UTF-8, binary)
   - Enforce size limits
2. Implement `read_many_files`:
   - Batch read with combined output
3. Implement `write_file`:
   - Safe overwrite checks
   - Create parent directories
4. Implement `edit_file`:
   - Target-based edits with line hints
   - Validate edits before applying
5. Implement `glob`:
   - Pattern matching with configurable depth
   - Respect ignore files
6. Implement `grep`:
   - Regex search with context lines
   - Case sensitivity option
7. Implement `ls`:
   - Recursive listing with depth limit
   - Hidden file toggle

**Deliverables**:
- `packages/core/src/tools/read-file.ts`
- `packages/core/src/tools/read-many-files.ts`
- `packages/core/src/tools/write-file.ts`
- `packages/core/src/tools/edit-file.ts`
- `packages/core/src/tools/glob.ts`
- `packages/core/src/tools/grep.ts`
- `packages/core/src/tools/ls.ts`

**Acceptance Criteria**:
- File tools support line ranges and robust errors
- Size limits prevent memory issues
- Encoding is detected correctly

---

### S03-T03: Shell Tool

**Steps**:
1. Implement shell execution:
   - PTY support for interactive commands
   - Fallback to spawn for simple commands
2. Stream output to UI via callback
3. Enforce timeouts:
   - Configurable timeout per command
   - Idle termination (no output for N seconds)
4. Handle background processes

**Deliverables**:
- `packages/core/src/tools/shell.ts`
- `packages/core/src/services/shellExecutionService.ts`

**Acceptance Criteria**:
- Commands execute with streaming output
- Timeouts terminate hung processes
- Background processes are tracked

---

### S03-T04: Web Tools

**Steps**:
1. Implement `web_fetch`:
   - Fetch URL content
   - Optional CSS selector for extraction
   - Output truncation with maxLength
   - Handle errors (404, timeout, etc.)
2. Implement `web_search`:
   - Search query execution
   - Result formatting
   - Configurable result count

**Deliverables**:
- `packages/core/src/tools/web-fetch.ts`
- `packages/core/src/tools/web-search.ts`

**Acceptance Criteria**:
- Fetch returns clean text with length limits
- Search returns formatted results
- Errors are handled gracefully

---

### S03-T05: Policy Engine and Message Bus

**Steps**:
1. Implement `PolicyEngine`:
   - Decisions: `allow`, `deny`, `ask`
   - Rule-based policy configuration
   - Tool risk classification
2. Implement `MessageBus`:
   - Request/response pattern
   - Correlation IDs for tracking
   - Timeout handling
3. Connect tool confirmation UI to policy decisions

**Deliverables**:
- `packages/core/src/policy/policyEngine.ts`
- `packages/core/src/policy/policyRules.ts`
- `packages/core/src/confirmation-bus/messageBus.ts`

**Acceptance Criteria**:
- Tools require confirmation when policy demands it
- Policy rules are configurable
- Message bus handles async confirmations

---

### S03-T06: Tool Output Handling

**Steps**:
1. Implement output truncation:
   - Max characters limit
   - Max lines limit
   - Truncation indicator
2. Allow tool output streaming to UI
3. Format output for LLM consumption

**Deliverables**:
- `packages/core/src/tools/output-helpers.ts`

**Acceptance Criteria**:
- Very large tool output is truncated safely
- Truncation is indicated in output
- Streaming works for long-running tools

---

## File Structure After Stage 03

```
packages/core/src/
├── tools/
│   ├── types.ts
│   ├── tool-registry.ts
│   ├── output-helpers.ts
│   ├── read-file.ts
│   ├── read-many-files.ts
│   ├── write-file.ts
│   ├── edit-file.ts
│   ├── glob.ts
│   ├── grep.ts
│   ├── ls.ts
│   ├── shell.ts
│   ├── web-fetch.ts
│   ├── web-search.ts
│   ├── memory.ts
│   └── write-todos.ts
├── policy/
│   ├── policyEngine.ts
│   └── policyRules.ts
├── confirmation-bus/
│   └── messageBus.ts
└── services/
    └── shellExecutionService.ts
```

---

## Policy Configuration Example

```yaml
policy:
  defaultAction: ask
  rules:
    - tool: read_file
      action: allow
    - tool: write_file
      action: ask
      message: "Allow writing to {path}?"
    - tool: shell
      action: ask
      risk: high
      message: "Execute command: {command}?"
    - tool: web_fetch
      action: allow
      conditions:
        - domain: "docs.*"
```

---

## Verification Checklist

- [ ] Tool registry registers and lists tools
- [ ] File tools handle line ranges correctly
- [ ] Shell tool streams output
- [ ] Shell tool respects timeouts
- [ ] Web fetch truncates large responses
- [ ] Policy engine enforces rules
- [ ] Confirmation flow works end-to-end
- [ ] Output truncation works correctly
