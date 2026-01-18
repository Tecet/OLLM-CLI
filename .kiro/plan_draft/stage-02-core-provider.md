# Stage 02: Core Runtime and Provider Interface

## Overview
Define provider-agnostic interfaces for chat, tools, and streaming. Implement the core chat runtime and a default local provider adapter.

## Prerequisites
- Stage 01 complete (repo skeleton and tooling)

## Estimated Effort
3-4 days

## Package Responsibilities
- `packages/core`: Runtime, interfaces, chat client
- `packages/ollm-bridge`: Provider adapters

---

## Key Interfaces

Create in `packages/core/src/provider/types.ts`:

```typescript
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

---

## Tasks

### S02-T01: Provider Registry

**Steps**:
1. Implement `ProviderRegistry` class:
   - `register(adapter: ProviderAdapter): void`
   - `get(name: string): ProviderAdapter | undefined`
   - `getDefault(): ProviderAdapter`
   - `list(): string[]`
2. Wire registry into core config for runtime resolution

**Deliverables**:
- `packages/core/src/provider/registry.ts`

**Acceptance Criteria**:
- Can register and resolve a provider by name
- Default provider is configurable

---

### S02-T02: Chat Runtime and Stream Events

**Steps**:
1. Implement `ChatClient` class:
   - Constructor takes provider, tool registry, config
   - `chat(prompt: string, options?: ChatOptions): AsyncIterable<ChatEvent>`
2. Implement `Turn` class:
   - Manages single conversation turn
   - Handles streaming from provider
   - Emits events for UI consumption

**Deliverables**:
- `packages/core/src/core/chatClient.ts`
- `packages/core/src/core/turn.ts`

**Acceptance Criteria**:
- Given a provider adapter, a prompt produces a stream of `text` events
- Events are typed and consumable by UI

---

### S02-T03: Tool Call Loop

**Steps**:
1. Parse `tool_call` events from provider stream
2. Implement tool call queue in `Turn`:
   - Collect tool calls during streaming
   - Execute via ToolRegistry after stream completes
   - Continue model turn with tool results
3. Enforce max turn count and timeouts
4. Handle parallel tool calls

**Deliverables**:
- Tool call queue in `Turn`
- Execution bridge between Turn and ToolRegistry

**Acceptance Criteria**:
- A tool call event triggers tool execution
- Model continues with tool results
- Max turns prevent infinite loops

---

### S02-T04: Default Local Provider Adapter

**Steps**:
1. Implement adapter in `packages/ollm-bridge/src/provider/`:
   - Use Ollama API or compatible local server
   - Map internal messages to provider format
   - Stream responses via async iterator
2. Map tool schemas to provider function calling format
3. Handle connection errors gracefully

**Deliverables**:
- `packages/ollm-bridge/src/provider/localProvider.ts`

**Acceptance Criteria**:
- Chat with streaming works against local server
- Tool schemas are properly formatted for provider

---

### S02-T05: ReAct Fallback

**Steps**:
1. Implement ReAct parser for models without native tool calling
2. Define strict output format:
   ```
   Thought: [reasoning]
   Action: [tool_name]
   Action Input: [JSON arguments]
   Observation: [tool result]
   Final Answer: [response]
   ```
3. Validate JSON tool inputs before execution
4. Parse model output to extract tool calls

**Deliverables**:
- `packages/core/src/core/reactToolHandler.ts`

**Acceptance Criteria**:
- When tool calling is disabled, tools still execute via ReAct loop
- Invalid JSON inputs are handled gracefully

---

### S02-T06: Token Estimation

**Steps**:
1. Implement `countTokens` fallback:
   - Default: `Math.ceil(text.length / 4)`
   - Use provider's tokenizer if available
2. Add per-model context limits
3. Implement context overflow checks:
   - Warn when approaching limit
   - Block when exceeded

**Deliverables**:
- `packages/core/src/core/tokenLimits.ts`

**Acceptance Criteria**:
- Chat runtime blocks when estimated tokens exceed limits
- Warnings are emitted before hard limit

---

## File Structure After Stage 02

```
packages/core/src/
├── provider/
│   ├── types.ts          # Interfaces defined above
│   └── registry.ts       # Provider registry
├── core/
│   ├── chatClient.ts     # Main chat client
│   ├── turn.ts           # Single turn handler
│   ├── reactToolHandler.ts # ReAct fallback
│   └── tokenLimits.ts    # Token estimation
└── index.ts              # Public exports

packages/ollm-bridge/src/
├── provider/
│   └── localProvider.ts  # Ollama/local adapter
└── index.ts
```

---

## Testing Notes

- Unit test for chat stream mapping
- Unit test for tool call parsing
- Unit test for ReAct output parsing
- Mock provider for testing without real server

---

## Verification Checklist

- [ ] Provider registry registers and resolves adapters
- [ ] ChatClient produces streaming text events
- [ ] Tool calls are detected and queued
- [ ] Local provider connects to Ollama
- [ ] ReAct fallback parses tool calls correctly
- [ ] Token limits are enforced
