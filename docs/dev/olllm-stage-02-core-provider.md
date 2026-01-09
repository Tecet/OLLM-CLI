# Stage 02 - Core Runtime and Provider Interface

## Baseline Context (standalone)
- Repo skeleton and tooling from Stage 01.
- Packages: core (runtime), ollm-bridge (provider adapters).

## Goals
- Define provider-agnostic interfaces for chat, tools, and streaming.
- Implement the core chat runtime and a default local provider adapter.

## Key Interfaces
Create these in `packages/core/src/provider/types.ts`:
```ts
export type Role = 'system' | 'user' | 'assistant' | 'tool';

export type MessagePart =
  | { type: 'text'; text: string }
  | { type: 'image'; data: string; mimeType: string };

export interface Message {
  role: Role;
  parts: MessagePart[];
  name?: string;
}

export interface ToolSchema {
  name: string;
  description?: string;
  parameters?: Record<string, unknown>;
}

export interface ToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
}

export interface GenerationOptions {
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  topK?: number;
  repeatPenalty?: number;
  seed?: number;
}

export interface ProviderRequest {
  model: string;
  systemPrompt?: string;
  messages: Message[];
  tools?: ToolSchema[];
  toolChoice?: 'auto' | 'none' | { name: string };
  options?: GenerationOptions;
  abortSignal?: AbortSignal;
}

export type ProviderEvent =
  | { type: 'text'; value: string }
  | { type: 'tool_call'; value: ToolCall }
  | { type: 'finish'; reason: 'stop' | 'length' | 'tool' }
  | { type: 'error'; error: { message: string; code?: string } };

export interface ProviderAdapter {
  name: string;
  chatStream(request: ProviderRequest): AsyncIterable<ProviderEvent>;
  countTokens?(request: ProviderRequest): Promise<number>;
  listModels?(): Promise<ModelInfo[]>;
  pullModel?(name: string, onProgress?: (p: PullProgress) => void): Promise<void>;
  deleteModel?(name: string): Promise<void>;
  showModel?(name: string): Promise<ModelInfo>;
}

export interface ModelInfo {
  name: string;
  sizeBytes?: number;
  modifiedAt?: string;
  details?: Record<string, unknown>;
}

export interface PullProgress {
  status: string;
  completed?: number;
  total?: number;
}
```

## Tasks

### S02-T01: Provider registry
Steps:
- Add `ProviderRegistry` with `register`, `get`, and `getDefault` methods.
- Wire registry into core config so the runtime can resolve active provider.
Deliverables:
- `packages/core/src/provider/registry.ts`
Acceptance criteria:
- Can register and resolve a provider by name.

### S02-T02: Chat runtime and stream events
Steps:
- Implement `ChatClient` and `Turn` in `packages/core/src/core/`.
- Input: user prompt, tool registry, and system prompt.
- Output: stream of events for UI and non-interactive mode.
Deliverables:
- `packages/core/src/core/chatClient.ts`
- `packages/core/src/core/turn.ts`
Acceptance criteria:
- Given a provider adapter, a prompt produces a stream of `text` events.

### S02-T03: Tool call loop
Steps:
- Parse `tool_call` events from provider stream.
- Queue tool calls, execute via ToolRegistry, then continue the model turn with tool results.
- Enforce a max turn count and timeouts.
Deliverables:
- Tool call queue in `Turn` and an execution bridge.
Acceptance criteria:
- A tool call event triggers tool execution and continuation.

### S02-T04: Default local provider adapter
Steps:
- Implement adapter in `packages/ollm-bridge/src/provider/` using a local LLM server API or SDK.
- Map internal messages to provider format and stream responses.
- Map tool schemas to provider function calling format.
Deliverables:
- `packages/ollm-bridge/src/provider/localProvider.ts`
Acceptance criteria:
- Chat with streaming works against a local server.

### S02-T05: ReAct fallback
Steps:
- Add ReAct parser for models without native tool calling.
- Define strict output format: Thought, Action, Action Input, Observation, Final Answer.
- Validate JSON tool inputs before execution.
Deliverables:
- `packages/core/src/core/reactToolHandler.ts`
Acceptance criteria:
- When tool calling is disabled, tools still execute via ReAct loop.

### S02-T06: Token estimation
Steps:
- Implement `countTokens` fallback using `Math.ceil(text.length / 4)`.
- Add per-model limits and context overflow checks.
Deliverables:
- `packages/core/src/core/tokenLimits.ts`
Acceptance criteria:
- Chat runtime blocks when estimated tokens exceed limits.
