# Stage 03 - Tool System and Policy

## Baseline Context (standalone)
- Provider and core runtime are available from Stage 02.
- Tool calls are executed via ToolRegistry.

## Goals
- Implement a robust tool system with schema validation and confirmation.
- Provide built-in tools for file, shell, and web operations.

## Core Interfaces
Create these in `packages/core/src/tools/tools.ts`:
```ts
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
```

## Built-in Tool Specs
- read_file: { path, startLine?, endLine? }
- read_many_files: { paths[] }
- write_file: { path, content, overwrite? }
- edit_file: { path, edits: [{ target, replacement, startLine?, endLine? }] }
- glob: { pattern, directory?, maxResults?, includeHidden? }
- grep: { pattern, directory?, filePattern?, caseSensitive?, maxResults? }
- ls: { path, recursive?, includeHidden?, maxDepth? }
- shell: { command, cwd?, timeout?, background? }
- web_fetch: { url, selector?, maxLength? }
- web_search: { query, numResults? }
- memory: { action: save|get|list|delete, key?, value? }
- write_todos: { action: add|complete|list|clear, task?, id? }

## Tasks

### S03-T01: Tool registry
Steps:
- Implement `ToolRegistry` with register/unregister/get/list.
- Provide `getFunctionSchemas()` for provider tool exposure.
Deliverables:
- `packages/core/src/tools/tool-registry.ts`
Acceptance criteria:
- Tools are discoverable and ordered predictably.

### S03-T02: File tools
Steps:
- Implement read, write, edit, glob, grep, ls tools with schema validation.
- Add size limits, encoding detection, and safe overwrite checks.
Deliverables:
- `packages/core/src/tools/read-file.ts` and related tools
Acceptance criteria:
- File tools support line ranges and robust errors.

### S03-T03: Shell tool
Steps:
- Implement shell execution with PTY support and fallback.
- Stream output to UI; enforce timeouts and idle termination.
Deliverables:
- `packages/core/src/tools/shell.ts`
- `packages/core/src/services/shellExecutionService.ts`
Acceptance criteria:
- Commands execute with streaming and timeouts.

### S03-T04: Web tools
Steps:
- Implement web fetch and web search with output truncation and errors.
Deliverables:
- `packages/core/src/tools/web-fetch.ts`, `web-search.ts`
Acceptance criteria:
- Fetch returns clean text with length limits.

### S03-T05: Policy engine and message bus
Steps:
- Implement `PolicyEngine` with decisions: allow, deny, ask.
- Implement `MessageBus` with request/response and correlation IDs.
- Connect tool confirmation UI to policy decisions.
Deliverables:
- `packages/core/src/policy/`
- `packages/core/src/confirmation-bus/`
Acceptance criteria:
- Tools require confirmation when policy demands it.

### S03-T06: Tool output handling
Steps:
- Add output truncation and line limits.
- Allow tool output streaming to the UI.
Deliverables:
- Output helpers in `packages/core/src/tools/`.
Acceptance criteria:
- Very large tool output is truncated safely.
