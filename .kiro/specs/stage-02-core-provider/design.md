# Design Document: Core Runtime and Provider Interface

## Overview

This design defines the core runtime system that enables OLLM CLI to interact with multiple LLM backends through a provider-agnostic interface. The system consists of three main layers:

1. **Provider Layer**: Standardized interfaces and registry for LLM backend adapters
2. **Runtime Layer**: Chat client, turn management, and streaming event handling
3. **Tool Integration Layer**: Tool call detection, execution, and ReAct fallback

The design prioritizes flexibility (supporting multiple providers), reliability (graceful error handling), and extensibility (easy addition of new providers and capabilities).

## Architecture

### High-Level Component Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                      Chat Client                            │
│  - Manages conversation state                               │
│  - Coordinates turns and tool execution                     │
│  - Emits events for UI consumption                          │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    Provider Registry                        │
│  - Stores registered provider adapters                      │
│  - Resolves provider by name                                │
│  - Manages default provider                                 │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   Provider Adapter                          │
│  - Implements ProviderAdapter interface                     │
│  - Translates messages to/from provider format              │
│  - Streams events back to runtime                           │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    LLM Backend (Ollama)                     │
└─────────────────────────────────────────────────────────────┘
```

### Turn Execution Flow

```
User Input
    │
    ▼
┌─────────────────────┐
│  Chat Client        │
│  - Create Turn      │
└─────────────────────┘
    │
    ▼
┌─────────────────────┐
│  Turn               │
│  - Stream from      │
│    Provider         │
│  - Collect events   │
└─────────────────────┘
    │
    ├─→ Text Event ──→ UI
    │
    ├─→ Tool Call ──→ Queue
    │
    └─→ Finish Event
            │
            ▼
    ┌─────────────────┐
    │ Execute Tools   │
    │ (via Registry)  │
    └─────────────────┘
            │
            ▼
    ┌─────────────────┐
    │ Continue Turn   │
    │ with Results    │
    └─────────────────┘
```

## Components and Interfaces

### Provider Types (`packages/core/src/provider/types.ts`)

**Core Message Types:**

```typescript
export type Role = 'system' | 'user' | 'assistant' | 'tool';

export type MessagePart =
  | { type: 'text'; text: string }
  | { type: 'image'; data: string; mimeType: string };

export interface Message {
  role: Role;
  parts: MessagePart[];
  name?: string; // For tool messages
}
```

**Tool Definitions:**

```typescript
export interface ToolSchema {
  name: string;
  description?: string;
  parameters?: Record<string, unknown>; // JSON Schema
}

export interface ToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
}
```

**Provider Request:**

```typescript
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
```

**Provider Events:**

```typescript
export type ProviderEvent =
  | { type: 'text'; value: string }
  | { type: 'tool_call'; value: ToolCall }
  | { type: 'finish'; reason: 'stop' | 'length' | 'tool' }
  | { type: 'error'; error: { message: string; code?: string } };
```

**Provider Adapter Interface:**

```typescript
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

### Provider Registry (`packages/core/src/provider/registry.ts`)

**Purpose**: Manages registration and resolution of provider adapters.

**Interface:**

```typescript
export class ProviderRegistry {
  private providers: Map<string, ProviderAdapter>;
  private defaultProviderName?: string;

  constructor() {
    this.providers = new Map();
  }

  register(adapter: ProviderAdapter): void {
    this.providers.set(adapter.name, adapter);
  }

  get(name: string): ProviderAdapter | undefined {
    return this.providers.get(name);
  }

  setDefault(name: string): void {
    if (!this.providers.has(name)) {
      throw new Error(`Provider "${name}" not registered`);
    }
    this.defaultProviderName = name;
  }

  getDefault(): ProviderAdapter {
    if (!this.defaultProviderName) {
      throw new Error('No default provider set');
    }
    const provider = this.providers.get(this.defaultProviderName);
    if (!provider) {
      throw new Error(`Default provider "${this.defaultProviderName}" not found`);
    }
    return provider;
  }

  list(): string[] {
    return Array.from(this.providers.keys());
  }
}
```

### Chat Client (`packages/core/src/core/chatClient.ts`)

**Purpose**: Main entry point for chat interactions. Manages conversation state and coordinates turns.

**Interface:**

```typescript
export interface ChatOptions {
  model?: string;
  provider?: string;
  systemPrompt?: string;
  tools?: ToolSchema[];
  temperature?: number;
  maxTokens?: number;
  maxTurns?: number;
  abortSignal?: AbortSignal;
}

export type ChatEvent =
  | { type: 'text'; value: string }
  | { type: 'tool_call_start'; toolCall: ToolCall }
  | { type: 'tool_call_result'; toolCall: ToolCall; result: unknown }
  | { type: 'turn_complete'; turnNumber: number }
  | { type: 'finish'; reason: string }
  | { type: 'error'; error: Error };

export class ChatClient {
  constructor(
    private providerRegistry: ProviderRegistry,
    private toolRegistry: ToolRegistry,
    private config: ChatConfig
  ) {}

  async *chat(prompt: string, options?: ChatOptions): AsyncIterable<ChatEvent> {
    const provider = options?.provider
      ? this.providerRegistry.get(options.provider)
      : this.providerRegistry.getDefault();

    if (!provider) {
      throw new Error('No provider available');
    }

    const messages: Message[] = [
      { role: 'user', parts: [{ type: 'text', text: prompt }] }
    ];

    let turnNumber = 0;
    const maxTurns = options?.maxTurns ?? 10;

    while (turnNumber < maxTurns) {
      turnNumber++;

      const turn = new Turn(
        provider,
        this.toolRegistry,
        messages,
        options
      );

      let hasToolCalls = false;

      for await (const event of turn.execute()) {
        if (event.type === 'tool_call') {
          hasToolCalls = true;
        }
        yield this.mapTurnEventToChatEvent(event);
      }

      yield { type: 'turn_complete', turnNumber };

      if (!hasToolCalls) {
        yield { type: 'finish', reason: 'complete' };
        break;
      }

      // Tool results are already added to messages by Turn
    }

    if (turnNumber >= maxTurns) {
      yield { type: 'finish', reason: 'max_turns' };
    }
  }

  private mapTurnEventToChatEvent(event: TurnEvent): ChatEvent {
    // Map Turn events to Chat events
    // Implementation details...
  }
}
```

### Turn (`packages/core/src/core/turn.ts`)

**Purpose**: Manages a single conversation turn, including streaming from provider and tool execution.

**Interface:**

```typescript
export type TurnEvent =
  | { type: 'text'; value: string }
  | { type: 'tool_call'; toolCall: ToolCall }
  | { type: 'tool_result'; toolCall: ToolCall; result: unknown }
  | { type: 'error'; error: Error };

export class Turn {
  private toolCallQueue: ToolCall[] = [];
  private accumulatedText: string = '';

  constructor(
    private provider: ProviderAdapter,
    private toolRegistry: ToolRegistry,
    private messages: Message[],
    private options?: ChatOptions
  ) {}

  async *execute(): AsyncIterable<TurnEvent> {
    const request: ProviderRequest = {
      model: this.options?.model ?? 'default',
      messages: this.messages,
      tools: this.options?.tools,
      options: {
        temperature: this.options?.temperature,
        maxTokens: this.options?.maxTokens,
      },
      abortSignal: this.options?.abortSignal,
    };

    // Stream from provider
    try {
      for await (const event of this.provider.chatStream(request)) {
        if (event.type === 'text') {
          this.accumulatedText += event.value;
          yield { type: 'text', value: event.value };
        } else if (event.type === 'tool_call') {
          this.toolCallQueue.push(event.value);
          yield { type: 'tool_call', toolCall: event.value };
        } else if (event.type === 'finish') {
          // Stream complete, execute tools if any
          break;
        } else if (event.type === 'error') {
          yield { type: 'error', error: new Error(event.error.message) };
          return;
        }
      }
    } catch (error) {
      yield { type: 'error', error: error as Error };
      return;
    }

    // Add assistant message to history
    if (this.accumulatedText) {
      this.messages.push({
        role: 'assistant',
        parts: [{ type: 'text', text: this.accumulatedText }],
      });
    }

    // Execute tool calls
    if (this.toolCallQueue.length > 0) {
      yield* this.executeToolCalls();
    }
  }

  private async *executeToolCalls(): AsyncIterable<TurnEvent> {
    // Execute tool calls in parallel
    const results = await Promise.allSettled(
      this.toolCallQueue.map(async (toolCall) => {
        const tool = this.toolRegistry.get(toolCall.name);
        if (!tool) {
          return {
            toolCall,
            result: { error: `Tool "${toolCall.name}" not found` },
          };
        }

        try {
          const result = await tool.execute(toolCall.args);
          return { toolCall, result };
        } catch (error) {
          return {
            toolCall,
            result: { error: (error as Error).message },
          };
        }
      })
    );

    // Emit results and add to message history
    for (const result of results) {
      if (result.status === 'fulfilled') {
        const { toolCall, result: toolResult } = result.value;
        yield { type: 'tool_result', toolCall, result: toolResult };

        this.messages.push({
          role: 'tool',
          parts: [{ type: 'text', text: JSON.stringify(toolResult) }],
          name: toolCall.name,
        });
      }
    }
  }
}
```

### Token Limits (`packages/core/src/core/tokenLimits.ts`)

**Purpose**: Estimate token counts and enforce context limits.

**Interface:**

```typescript
export interface TokenLimitConfig {
  modelLimits: Map<string, number>; // Model name -> max tokens
  warningThreshold: number; // Percentage (e.g., 0.9 for 90%)
}

export class TokenCounter {
  constructor(
    private provider: ProviderAdapter,
    private config: TokenLimitConfig
  ) {}

  async estimateTokens(request: ProviderRequest): Promise<number> {
    // Use provider's token counter if available
    if (this.provider.countTokens) {
      return await this.provider.countTokens(request);
    }

    // Fallback: estimate based on character count
    return this.fallbackEstimate(request);
  }

  private fallbackEstimate(request: ProviderRequest): number {
    let totalChars = 0;

    // Count system prompt
    if (request.systemPrompt) {
      totalChars += request.systemPrompt.length;
    }

    // Count messages
    for (const message of request.messages) {
      for (const part of message.parts) {
        if (part.type === 'text') {
          totalChars += part.text.length;
        }
      }
    }

    // Rough estimate: 1 token ≈ 4 characters
    return Math.ceil(totalChars / 4);
  }

  checkLimit(model: string, estimatedTokens: number): {
    withinLimit: boolean;
    isWarning: boolean;
    limit: number;
  } {
    const limit = this.config.modelLimits.get(model) ?? 4096;
    const warningThreshold = limit * this.config.warningThreshold;

    return {
      withinLimit: estimatedTokens <= limit,
      isWarning: estimatedTokens >= warningThreshold && estimatedTokens <= limit,
      limit,
    };
  }
}
```

### ReAct Tool Handler (`packages/core/src/core/reactToolHandler.ts`)

**Purpose**: Provides tool calling fallback for models without native function calling support.

**ReAct Format:**

```
Thought: [Model's reasoning about what to do]
Action: [tool_name]
Action Input: [JSON arguments]
Observation: [Tool result from previous turn]
... (repeat Thought/Action/Observation as needed)
Final Answer: [Final response to user]
```

**Interface:**

```typescript
export interface ReActParseResult {
  thought?: string;
  action?: string;
  actionInput?: Record<string, unknown>;
  finalAnswer?: string;
}

export class ReActToolHandler {
  private static readonly REACT_PATTERN = /Thought:\s*(.+?)\n(?:Action:\s*(.+?)\n)?(?:Action Input:\s*(.+?)\n)?(?:Final Answer:\s*(.+))?/s;

  static formatToolsAsInstructions(tools: ToolSchema[]): string {
    const toolDescriptions = tools.map(tool => {
      return `- ${tool.name}: ${tool.description || 'No description'}
  Parameters: ${JSON.stringify(tool.parameters, null, 2)}`;
    }).join('\n');

    return `You have access to the following tools:

${toolDescriptions}

To use a tool, respond in this exact format:

Thought: [Your reasoning about what to do]
Action: [tool_name]
Action Input: [JSON object with parameters]

After receiving the tool result, you'll see:
Observation: [tool result]

You can then continue with more Thought/Action/Observation cycles.

When you have the final answer, respond with:
Final Answer: [Your response to the user]`;
  }

  static parseReActOutput(output: string): ReActParseResult {
    const match = output.match(this.REACT_PATTERN);
    if (!match) {
      return {};
    }

    const [, thought, action, actionInputStr, finalAnswer] = match;

    let actionInput: Record<string, unknown> | undefined;
    if (actionInputStr) {
      try {
        actionInput = JSON.parse(actionInputStr.trim());
      } catch (error) {
        // Invalid JSON, will be handled by caller
      }
    }

    return {
      thought: thought?.trim(),
      action: action?.trim(),
      actionInput,
      finalAnswer: finalAnswer?.trim(),
    };
  }

  static formatObservation(toolName: string, result: unknown): string {
    return `Observation: ${JSON.stringify(result)}`;
  }

  static validateActionInput(actionInput: unknown): actionInput is Record<string, unknown> {
    return (
      typeof actionInput === 'object' &&
      actionInput !== null &&
      !Array.isArray(actionInput)
    );
  }
}
```

### Local Provider Adapter (`packages/ollm-bridge/src/provider/localProvider.ts`)

**Purpose**: Implements ProviderAdapter interface for Ollama (or compatible local LLM server).

**Interface:**

```typescript
export interface LocalProviderConfig {
  baseUrl: string; // e.g., 'http://localhost:11434'
  timeout?: number;
}

export class LocalProvider implements ProviderAdapter {
  readonly name = 'local';

  constructor(private config: LocalProviderConfig) {}

  async *chatStream(request: ProviderRequest): AsyncIterable<ProviderEvent> {
    const url = `${this.config.baseUrl}/api/chat`;

    const body = {
      model: request.model,
      messages: this.mapMessages(request.messages, request.systemPrompt),
      tools: request.tools ? this.mapTools(request.tools) : undefined,
      options: request.options,
      stream: true,
    };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: request.abortSignal,
      });

      if (!response.ok) {
        yield {
          type: 'error',
          error: {
            message: `HTTP ${response.status}: ${response.statusText}`,
            code: String(response.status),
          },
        };
        return;
      }

      if (!response.body) {
        yield {
          type: 'error',
          error: { message: 'No response body' },
        };
        return;
      }

      // Parse NDJSON stream
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;

          try {
            const chunk = JSON.parse(line);
            yield* this.mapChunkToEvents(chunk);
          } catch (error) {
            // Skip malformed JSON
          }
        }
      }

      yield { type: 'finish', reason: 'stop' };
    } catch (error) {
      if (error instanceof Error) {
        yield {
          type: 'error',
          error: { message: error.message },
        };
      }
    }
  }

  private mapMessages(messages: Message[], systemPrompt?: string): unknown[] {
    const mapped = [];

    if (systemPrompt) {
      mapped.push({ role: 'system', content: systemPrompt });
    }

    for (const msg of messages) {
      const content = msg.parts
        .map(part => (part.type === 'text' ? part.text : '[image]'))
        .join('');

      mapped.push({
        role: msg.role,
        content,
        ...(msg.name && { name: msg.name }),
      });
    }

    return mapped;
  }

  private mapTools(tools: ToolSchema[]): unknown[] {
    return tools.map(tool => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      },
    }));
  }

  private *mapChunkToEvents(chunk: any): Iterable<ProviderEvent> {
    if (chunk.message?.content) {
      yield { type: 'text', value: chunk.message.content };
    }

    if (chunk.message?.tool_calls) {
      for (const toolCall of chunk.message.tool_calls) {
        yield {
          type: 'tool_call',
          value: {
            id: toolCall.id || crypto.randomUUID(),
            name: toolCall.function.name,
            args: JSON.parse(toolCall.function.arguments || '{}'),
          },
        };
      }
    }

    if (chunk.done) {
      yield { type: 'finish', reason: chunk.done_reason || 'stop' };
    }
  }

  async countTokens(request: ProviderRequest): Promise<number> {
    // Ollama doesn't provide token counting, use fallback
    let totalChars = 0;

    if (request.systemPrompt) {
      totalChars += request.systemPrompt.length;
    }

    for (const msg of request.messages) {
      for (const part of msg.parts) {
        if (part.type === 'text') {
          totalChars += part.text.length;
        }
      }
    }

    return Math.ceil(totalChars / 4);
  }

  async listModels(): Promise<ModelInfo[]> {
    const url = `${this.config.baseUrl}/api/tags`;
    const response = await fetch(url);
    const data = await response.json();

    return data.models.map((model: any) => ({
      name: model.name,
      sizeBytes: model.size,
      modifiedAt: model.modified_at,
      details: model.details,
    }));
  }

  async pullModel(name: string, onProgress?: (p: PullProgress) => void): Promise<void> {
    const url = `${this.config.baseUrl}/api/pull`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, stream: true }),
    });

    if (!response.body) return;

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.trim()) continue;

        try {
          const progress = JSON.parse(line);
          onProgress?.({
            status: progress.status,
            completed: progress.completed,
            total: progress.total,
          });
        } catch {
          // Skip malformed JSON
        }
      }
    }
  }

  async deleteModel(name: string): Promise<void> {
    const url = `${this.config.baseUrl}/api/delete`;
    await fetch(url, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
  }

  async showModel(name: string): Promise<ModelInfo> {
    const url = `${this.config.baseUrl}/api/show`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });

    const data = await response.json();
    return {
      name: data.name,
      sizeBytes: data.size,
      modifiedAt: data.modified_at,
      details: data.details,
    };
  }
}
```

## Data Models

### Message Flow

1. **User Input** → `Message` with role='user'
2. **Provider Request** → `ProviderRequest` with messages array
3. **Provider Stream** → `ProviderEvent` stream (text, tool_call, finish, error)
4. **Tool Execution** → Results added as `Message` with role='tool'
5. **Next Turn** → Updated messages array sent to provider

### State Management

**ChatClient State:**
- Current conversation messages
- Turn counter
- Active provider
- Tool registry reference

**Turn State:**
- Tool call queue
- Accumulated text
- Message history reference

**Provider Registry State:**
- Map of provider name → adapter
- Default provider name

## Error Handling

### Connection Errors

When the provider cannot connect to the backend:

```typescript
yield {
  type: 'error',
  error: {
    message: 'Failed to connect to local server at http://localhost:11434',
    code: 'CONNECTION_FAILED'
  }
};
```

### Tool Execution Errors

When a tool fails during execution:

```typescript
{
  role: 'tool',
  parts: [{ type: 'text', text: JSON.stringify({ error: 'Tool execution failed: ...' }) }],
  name: toolCall.name
}
```

The error is included in the tool result and sent back to the model, allowing it to handle the error or retry.

### ReAct Parsing Errors

When ReAct output contains invalid JSON:

```typescript
// Add error message to conversation
{
  role: 'user',
  parts: [{
    type: 'text',
    text: 'Error: Action Input must be valid JSON. Please try again with proper JSON formatting.'
  }]
}
```

### Token Limit Errors

When estimated tokens exceed model limit:

```typescript
throw new Error(
  `Request exceeds token limit: ${estimatedTokens} > ${limit} for model ${model}`
);
```

### Abort Signal Handling

When user cancels the request:

```typescript
try {
  const response = await fetch(url, {
    signal: request.abortSignal
  });
} catch (error) {
  if (error.name === 'AbortError') {
    yield { type: 'finish', reason: 'cancelled' };
    return;
  }
  throw error;
}
```


## Correctness Properties

A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.

### Property 1: Provider Registration and Retrieval

*For any* provider adapter with a unique name, registering it in the Provider_Registry and then retrieving it by name should return the same adapter instance.

**Validates: Requirements 1.1, 1.2**

### Property 2: Default Provider Resolution

*For any* provider adapter set as the default, calling getDefault() should return that adapter, and calling get() without a name should also return that adapter.

**Validates: Requirements 1.3, 1.5**

### Property 3: Provider List Completeness

*For any* set of registered providers, the list() method should return exactly the names of all registered providers, with no duplicates or omissions.

**Validates: Requirements 1.4**

### Property 4: Event Stream Forwarding

*For any* sequence of provider events (text, tool_call, finish, error), the Chat_Runtime should forward each event to consumers in the same order with the same content.

**Validates: Requirements 2.1, 2.2, 2.3, 2.4**

### Property 5: Abort Signal Cancellation

*For any* chat stream in progress, triggering the abort signal should cause the stream to terminate and emit a cancellation event.

**Validates: Requirements 2.5**

### Property 6: Tool Call Queuing and Execution

*For any* set of tool_call events emitted during a turn, all tool calls should be queued and then executed after the stream completes.

**Validates: Requirements 3.1, 3.2, 8.3, 8.4**

### Property 7: Tool Result Continuation

*For any* completed tool execution, the tool result should be added to the conversation history as a tool message, and a new turn should begin with the updated history.

**Validates: Requirements 3.3**

### Property 8: Parallel Tool Execution

*For any* set of multiple tool calls in a single turn, all tool calls should execute concurrently rather than sequentially (execution time should be closer to the slowest tool rather than the sum of all tools).

**Validates: Requirements 3.4**

### Property 9: Maximum Turn Limit

*For any* conversation that would continue indefinitely, the Chat_Runtime should terminate after reaching the maximum turn count and emit a finish event with reason 'max_turns'.

**Validates: Requirements 3.5**

### Property 10: Provider Interface Compliance

*For any* provider adapter, it should implement the chatStream method that returns an async iterable of ProviderEvent objects.

**Validates: Requirements 4.1**

### Property 11: Optional Method Presence

*For any* provider adapter that supports token counting, calling countTokens should return a positive number; for any provider that supports model management, the methods listModels, pullModel, deleteModel, and showModel should be defined.

**Validates: Requirements 4.2, 4.3**

### Property 12: Message Format Mapping

*For any* internal message, converting it to provider format and then back to internal format should produce an equivalent message (round-trip property).

**Validates: Requirements 4.4, 9.4, 9.5**

### Property 13: Tool Schema Conversion

*For any* set of tool schemas, converting them to the provider's function calling format should preserve all tool names, descriptions, and parameter definitions.

**Validates: Requirements 4.5, 5.5**

### Property 14: Local Provider Request Formatting

*For any* chat request, the Local_Provider should generate an HTTP request body that contains all required fields (model, messages, options) in the correct format.

**Validates: Requirements 5.2**

### Property 15: Local Provider Event Streaming

*For any* server response stream, the Local_Provider should emit corresponding ProviderEvent objects for each chunk received.

**Validates: Requirements 5.3**

### Property 16: Connection Error Handling

*For any* connection failure, the provider should emit an error event with a descriptive message and error code.

**Validates: Requirements 5.4, 10.1**

### Property 17: ReAct Instruction Formatting

*For any* set of tool schemas, the ReAct_Handler should format them as text instructions that include tool names, descriptions, and parameter schemas.

**Validates: Requirements 6.1**

### Property 18: ReAct Output Parsing

*For any* valid ReAct-formatted string, the ReAct_Handler should correctly extract the Thought, Action, Action Input, and Final Answer fields.

**Validates: Requirements 6.2**

### Property 19: ReAct JSON Validation

*For any* Action Input string, the ReAct_Handler should validate it as JSON before execution, accepting valid JSON and rejecting invalid JSON.

**Validates: Requirements 6.3, 6.4**

### Property 20: ReAct Observation Formatting

*For any* tool result, the ReAct_Handler should format it as "Observation: [JSON result]" for inclusion in the next turn.

**Validates: Requirements 6.5**

### Property 21: ReAct Turn Completion

*For any* model output containing "Final Answer", the ReAct_Handler should treat it as the completion of the turn and not attempt further tool calls.

**Validates: Requirements 6.6**

### Property 22: Token Count Estimation

*For any* chat request, the Token_Counter should produce a positive integer estimate of the total token count.

**Validates: Requirements 7.1**

### Property 23: Provider Tokenizer Usage

*For any* provider that implements countTokens, the Token_Counter should use the provider's method rather than the fallback estimation.

**Validates: Requirements 7.2**

### Property 24: Fallback Token Estimation

*For any* text content, the fallback token estimation should equal Math.ceil(text.length / 4).

**Validates: Requirements 7.3**

### Property 25: Token Limit Warning

*For any* chat request where estimated tokens are between 90% and 100% of the model's limit, the system should emit a warning.

**Validates: Requirements 7.4**

### Property 26: Token Limit Enforcement

*For any* chat request where estimated tokens exceed the model's limit, the system should block the request and throw an error.

**Validates: Requirements 7.5**

### Property 27: Turn Initialization

*For any* turn, it should begin with the current conversation state (messages array) and maintain that state throughout execution.

**Validates: Requirements 8.1**

### Property 28: Event Collection Completeness

*For any* provider stream, the Turn should collect and emit all events until a finish or error event is received.

**Validates: Requirements 8.2**

### Property 29: Conversation History Update

*For any* completed turn, the conversation history should include the assistant's response and all tool results from that turn.

**Validates: Requirements 8.5**

### Property 30: Message Structure Validity

*For any* message, it should have a role field with one of the valid values (system, user, assistant, tool) and a parts array containing at least one part.

**Validates: Requirements 9.1, 9.2**

### Property 31: Tool Message Name Field

*For any* message with role='tool', it should include a name field identifying the tool that produced the result.

**Validates: Requirements 9.3**

### Property 32: Tool Execution Error Handling

*For any* tool execution that fails, the error should be captured in the tool result message and the conversation should continue rather than terminating.

**Validates: Requirements 10.2**

### Property 33: ReAct JSON Error Recovery

*For any* invalid JSON in ReAct Action Input, the system should add an error message to the conversation requesting the model to correct the format.

**Validates: Requirements 10.3**

### Property 34: Abort Signal Cleanup

*For any* aborted chat stream, the system should clean up resources (close connections, cancel pending operations) and emit a cancellation event.

**Validates: Requirements 10.4**

### Property 35: Unexpected Error Resilience

*For any* unexpected error during chat execution, the system should emit an error event and continue running without crashing the process.

**Validates: Requirements 10.5**

## Testing Strategy

### Dual Testing Approach

This feature will use both unit tests and property-based tests to ensure comprehensive coverage:

**Unit Tests** will verify:
- Specific examples of provider registration and retrieval
- Edge cases like empty provider registries or missing default providers
- Error conditions such as connection failures and invalid JSON
- Integration between components (ChatClient → Turn → Provider)

**Property-Based Tests** will verify:
- Universal properties across all inputs (as defined above)
- Randomized message sequences, tool calls, and provider events
- Round-trip properties for message format conversion
- Concurrent tool execution behavior

### Property-Based Testing Configuration

We will use **fast-check** (already in package.json) as the property-based testing library for TypeScript.

Each property test will:
- Run a minimum of 100 iterations to ensure comprehensive input coverage
- Be tagged with a comment referencing the design property
- Tag format: `// Feature: stage-02-core-provider, Property N: [property text]`

Example test structure:

```typescript
import fc from 'fast-check';
import { describe, it } from 'vitest';

describe('Provider Registry', () => {
  it('Property 1: Provider Registration and Retrieval', () => {
    // Feature: stage-02-core-provider, Property 1: Provider Registration and Retrieval
    fc.assert(
      fc.property(
        fc.string(), // provider name
        fc.record({ name: fc.string() }), // mock provider
        (name, mockProvider) => {
          const registry = new ProviderRegistry();
          mockProvider.name = name;
          registry.register(mockProvider as any);
          const retrieved = registry.get(name);
          return retrieved === mockProvider;
        }
      ),
      { numRuns: 100 }
    );
  });
});
```

### Testing Focus Areas

1. **Provider Registry**: Registration, retrieval, default provider, listing
2. **Message Format Conversion**: Round-trip properties for internal ↔ provider format
3. **Event Streaming**: Forwarding, ordering, completion
4. **Tool Call Execution**: Queuing, parallel execution, result handling
5. **ReAct Parsing**: Format validation, JSON parsing, error recovery
6. **Token Counting**: Estimation accuracy, limit enforcement, warnings
7. **Error Handling**: Connection failures, tool errors, abort signals
8. **Turn Management**: State initialization, event collection, history updates

### Mock Providers for Testing

We will create mock provider adapters in `packages/test-utils` that:
- Emit predictable event sequences for testing
- Simulate various error conditions
- Support configurable delays for testing parallel execution
- Provide deterministic token counting for limit testing

This allows testing the core runtime without requiring a real LLM backend.
