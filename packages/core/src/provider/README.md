# Provider System

## Overview

The Provider System implements a clean adapter pattern for connecting the OLLM CLI core runtime to different LLM backends. It provides a unified interface for streaming chat completions, managing models, and handling tool calls across multiple provider implementations.

## Architecture

```
┌─────────────────────┐
│    ChatClient       │
│   (Core Runtime)    │
└──────────┬──────────┘
           │
           │ uses
           ▼
┌─────────────────────┐
│  ProviderRegistry   │
│  (Manages all)      │
└──────────┬──────────┘
           │
           │ returns
           ▼
┌─────────────────────┐
│  ProviderAdapter    │ ◄─── Interface
│    (Interface)      │
└──────────┬──────────┘
           │
           │ implements
           ▼
┌─────────────────────┐
│   LocalProvider     │
│     (Ollama)        │
└─────────────────────┘
```

### Key Components

1. **ProviderAdapter Interface** (`types.ts`)
   - Defines the contract for all provider implementations
   - Core method: `chatStream()` - streams events from LLM
   - Optional methods: `countTokens()`, `listModels()`, `pullModel()`, etc.

2. **ProviderRegistry** (`registry.ts`)
   - Manages registration of provider adapters
   - Maintains default provider selection
   - Provides centralized provider access

3. **Provider Implementations** (`packages/ollm-bridge/src/provider/`)
   - LocalProvider: Ollama adapter (Tier 1)
   - Future: vLLMProvider, OpenAICompatibleProvider

## Implementing a Provider

### Step 1: Create Provider Class

Create a new file in `packages/ollm-bridge/src/provider/`:

```typescript
import type {
  ProviderAdapter,
  ProviderRequest,
  ProviderEvent,
  ModelInfo,
} from '@ollm/core';

export interface MyProviderConfig {
  baseUrl: string;
  apiKey?: string;
  timeout?: number;
}

export class MyProvider implements ProviderAdapter {
  readonly name = 'my-provider';

  constructor(private config: MyProviderConfig) {}

  async *chatStream(request: ProviderRequest): AsyncIterable<ProviderEvent> {
    // Implementation
  }
}
```

### Step 2: Implement chatStream (Required)

The `chatStream` method is the core of any provider. It must:

1. Accept a `ProviderRequest` with messages, tools, and options
2. Stream events as they arrive from the LLM
3. Handle errors gracefully (emit error events, don't throw)
4. Respect timeout and abort signals

```typescript
async *chatStream(request: ProviderRequest): AsyncIterable<ProviderEvent> {
  const url = `${this.config.baseUrl}/api/chat`;
  
  // Build request body
  const body = {
    model: request.model,
    messages: this.mapMessages(request.messages, request.systemPrompt),
    tools: request.tools ? this.mapTools(request.tools) : undefined,
    options: request.options,
    stream: true,
  };

  // Setup timeout and abort handling
  const timeout = request.timeout ?? this.config.timeout ?? 30000;
  const controller = new AbortController();
  
  if (request.abortSignal) {
    request.abortSignal.addEventListener('abort', () => {
      controller.abort(request.abortSignal?.reason);
    });
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      yield {
        type: 'error',
        error: {
          message: `HTTP ${response.status}: ${errorText}`,
          code: String(response.status),
        },
      };
      return;
    }

    // Parse streaming response
    for await (const chunk of this.parseStream(response.body)) {
      yield* this.mapChunkToEvents(chunk);
    }

  } catch (error) {
    if (error instanceof Error) {
      yield {
        type: 'error',
        error: { message: error.message },
      };
    }
  }
}
```

### Step 3: Map Messages and Tools

Convert internal message format to provider-specific format:

```typescript
private mapMessages(messages: Message[], systemPrompt?: string): unknown[] {
  const mapped = [];

  if (systemPrompt) {
    mapped.push({ role: 'system', content: systemPrompt });
  }

  for (const msg of messages) {
    const content = msg.parts
      .map(part => part.type === 'text' ? part.text : '[image]')
      .join('');

    mapped.push({
      role: msg.role,
      content,
      ...(msg.toolCalls && { tool_calls: this.mapToolCalls(msg.toolCalls) }),
      ...(msg.toolCallId && { tool_call_id: msg.toolCallId }),
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
```

### Step 4: Map Response Events

Convert provider-specific responses to ProviderEvent format:

```typescript
private *mapChunkToEvents(chunk: unknown): Iterable<ProviderEvent> {
  const c = chunk as Record<string, unknown>;
  const message = c.message as Record<string, unknown> | undefined;

  // Text content
  if (message?.content) {
    yield { type: 'text', value: message.content as string };
  }

  // Tool calls
  if (message?.tool_calls) {
    const toolCalls = message.tool_calls as Array<{
      id: string;
      function: { name: string; arguments: unknown };
    }>;

    for (const tc of toolCalls) {
      yield {
        type: 'tool_call',
        value: {
          id: tc.id,
          name: tc.function.name,
          args: this.parseToolArgs(tc.function.arguments),
        },
      };
    }
  }

  // Finish
  if (c.done) {
    yield {
      type: 'finish',
      reason: 'stop',
      metrics: this.extractMetrics(c),
    };
  }
}
```

### Step 5: Implement Optional Methods

Add optional methods as needed:

```typescript
// Token counting
async countTokens(request: ProviderRequest): Promise<number> {
  // Implement token counting logic
  // Can use tiktoken, character-based estimation, or provider API
}

// List models
async listModels(): Promise<ModelInfo[]> {
  const response = await fetch(`${this.config.baseUrl}/api/models`);
  const data = await response.json();
  return data.models.map(m => ({
    name: m.name,
    sizeBytes: m.size,
    modifiedAt: m.modified_at,
  }));
}

// Pull model
async pullModel(
  name: string,
  onProgress?: (progress: PullProgress) => void
): Promise<void> {
  // Implement model download with progress updates
}
```

### Step 6: Register Provider

Register your provider in the application:

```typescript
import { ProviderRegistry } from '@ollm/core';
import { MyProvider } from './myProvider.js';

const registry = new ProviderRegistry();

const provider = new MyProvider({
  baseUrl: 'http://localhost:8000',
  timeout: 30000,
});

registry.register(provider);
registry.setDefault('my-provider');
```

## Provider Event Types

### Text Event
```typescript
{ type: 'text', value: string }
```
Incremental text tokens from the model.

### Thinking Event
```typescript
{ type: 'thinking', value: string }
```
Reasoning/thinking tokens (if model supports it).

### Tool Call Event
```typescript
{
  type: 'tool_call',
  value: {
    id: string,
    name: string,
    args: Record<string, unknown>
  }
}
```
Function/tool call request from the model.

### Finish Event
```typescript
{
  type: 'finish',
  reason: 'stop' | 'length' | 'tool',
  metrics?: ProviderMetrics
}
```
Completion event with reason and optional metrics.

### Error Event
```typescript
{
  type: 'error',
  error: {
    message: string,
    code?: string,
    httpStatus?: number,
    originalError?: string
  }
}
```
Error information (prefer emitting errors over throwing).

## Error Handling Best Practices

### 1. Emit Errors, Don't Throw

```typescript
// ❌ BAD: Throwing errors
async *chatStream(request: ProviderRequest): AsyncIterable<ProviderEvent> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Request failed'); // Don't do this
  }
}

// ✅ GOOD: Emitting error events
async *chatStream(request: ProviderRequest): AsyncIterable<ProviderEvent> {
  const response = await fetch(url);
  if (!response.ok) {
    yield {
      type: 'error',
      error: { message: 'Request failed', code: String(response.status) }
    };
    return;
  }
}
```

### 2. Handle Network Errors

```typescript
try {
  const response = await fetch(url, { signal: controller.signal });
  // ... process response
} catch (error) {
  if (error instanceof Error) {
    if (error.name === 'AbortError') {
      // Request was cancelled - emit finish event
      yield { type: 'finish', reason: 'stop' };
      return;
    }
    
    // Network error - emit error event
    yield {
      type: 'error',
      error: { message: error.message }
    };
  }
}
```

### 3. Validate Input

```typescript
async *chatStream(request: ProviderRequest): AsyncIterable<ProviderEvent> {
  // Validate model name
  if (!request.model || request.model.trim() === '') {
    yield {
      type: 'error',
      error: { message: 'Model name is required' }
    };
    return;
  }

  // Validate messages
  if (!request.messages || request.messages.length === 0) {
    yield {
      type: 'error',
      error: { message: 'At least one message is required' }
    };
    return;
  }

  // ... proceed with request
}
```

### 4. Handle Tool Unsupported Errors

```typescript
// First attempt with tools
let response = await fetch(url, {
  body: JSON.stringify({ ...body, tools: request.tools })
});

if (!response.ok && this.isToolUnsupportedError(await response.text())) {
  // Emit error event
  yield {
    type: 'error',
    error: {
      message: 'Model does not support function calling',
      code: 'TOOL_UNSUPPORTED'
    }
  };

  // Retry without tools
  response = await fetch(url, {
    body: JSON.stringify({ ...body, tools: undefined })
  });
}
```

## Timeout and Cancellation

### Inactivity Timeout

Reset timeout on each chunk received:

```typescript
let timeoutId: ReturnType<typeof setTimeout> | null = null;

const resetTimeout = () => {
  if (timeoutId) clearTimeout(timeoutId);
  timeoutId = setTimeout(() => {
    controller.abort(new Error(`Request timed out after ${timeout}ms`));
  }, timeout);
};

// Start initial timeout
resetTimeout();

// Reset on each chunk
for await (const chunk of parseStream(response.body)) {
  resetTimeout(); // Reset timeout - we received data
  yield* this.mapChunkToEvents(chunk);
}

// Cleanup
if (timeoutId) clearTimeout(timeoutId);
```

### Abort Signal

Respect the abort signal from the request:

```typescript
const controller = new AbortController();

// Link incoming abort signal
if (request.abortSignal) {
  if (request.abortSignal.aborted) {
    yield { type: 'error', error: { message: 'Request aborted' } };
    return;
  }
  
  request.abortSignal.addEventListener('abort', () => {
    controller.abort(request.abortSignal?.reason);
  }, { once: true });
}

// Use controller.signal in fetch
const response = await fetch(url, { signal: controller.signal });
```

## Testing

### Unit Tests

Test individual methods in isolation:

```typescript
describe('MyProvider', () => {
  describe('mapMessages', () => {
    it('should map text messages', () => {
      const provider = new MyProvider({ baseUrl: 'http://localhost' });
      const messages = [
        { role: 'user', parts: [{ type: 'text', text: 'Hello' }] }
      ];
      const mapped = provider['mapMessages'](messages);
      expect(mapped).toEqual([
        { role: 'user', content: 'Hello' }
      ]);
    });
  });

  describe('validateToolSchema', () => {
    it('should accept valid tool names', () => {
      const provider = new MyProvider({ baseUrl: 'http://localhost' });
      expect(() => {
        provider['validateToolSchema']({ name: 'search' });
      }).not.toThrow();
    });

    it('should reject invalid tool names', () => {
      const provider = new MyProvider({ baseUrl: 'http://localhost' });
      expect(() => {
        provider['validateToolSchema']({ name: '' });
      }).toThrow('Tool name is required');
    });
  });
});
```

### Integration Tests

Test streaming with mock server:

```typescript
describe('MyProvider - Integration', () => {
  it('should stream text events', async () => {
    const provider = new MyProvider({ baseUrl: 'http://localhost:8000' });
    
    const request: ProviderRequest = {
      model: 'test-model',
      messages: [{ role: 'user', parts: [{ type: 'text', text: 'Hello' }] }],
    };

    const events: ProviderEvent[] = [];
    for await (const event of provider.chatStream(request)) {
      events.push(event);
    }

    expect(events).toContainEqual({ type: 'text', value: expect.any(String) });
    expect(events).toContainEqual({ type: 'finish', reason: 'stop' });
  });

  it('should handle errors gracefully', async () => {
    const provider = new MyProvider({ baseUrl: 'http://invalid' });
    
    const request: ProviderRequest = {
      model: 'test-model',
      messages: [{ role: 'user', parts: [{ type: 'text', text: 'Hello' }] }],
    };

    const events: ProviderEvent[] = [];
    for await (const event of provider.chatStream(request)) {
      events.push(event);
    }

    expect(events).toContainEqual({
      type: 'error',
      error: expect.objectContaining({ message: expect.any(String) })
    });
  });
});
```

## Performance Considerations

### 1. Connection Pooling

Reuse connections for better performance:

```typescript
export class MyProvider implements ProviderAdapter {
  private agent: http.Agent;

  constructor(config: MyProviderConfig) {
    this.agent = new http.Agent({
      keepAlive: true,
      maxSockets: 10,
    });
  }

  async *chatStream(request: ProviderRequest): AsyncIterable<ProviderEvent> {
    const response = await fetch(url, {
      agent: this.agent, // Reuse connections
    });
  }
}
```

### 2. Token Counting Cache

Cache tokenizer instances:

```typescript
export class MyProvider implements ProviderAdapter {
  private encodingCache?: Encoding;

  async countTokens(request: ProviderRequest): Promise<number> {
    if (!this.encodingCache) {
      const { encoding_for_model } = await import('tiktoken');
      this.encodingCache = encoding_for_model('gpt-3.5-turbo');
    }

    // Use cached encoding
    return this.encodingCache.encode(text).length;
  }

  cleanup(): void {
    if (this.encodingCache) {
      this.encodingCache.free();
      this.encodingCache = undefined;
    }
  }
}
```

### 3. Streaming Optimization

Process chunks as they arrive:

```typescript
// ❌ BAD: Buffering entire response
const text = await response.text();
const lines = text.split('\n');
for (const line of lines) {
  yield* this.mapChunkToEvents(JSON.parse(line));
}

// ✅ GOOD: Streaming line by line
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
    if (line.trim()) {
      yield* this.mapChunkToEvents(JSON.parse(line));
    }
  }
}
```

## Provider Comparison

| Feature | LocalProvider | vLLMProvider | OpenAIProvider |
|---------|---------------|--------------|----------------|
| Streaming | ✅ | ❌ Not Implemented | ❌ Not Implemented |
| Tool Calling | ✅ | ❌ Not Implemented | ❌ Not Implemented |
| Vision | ❌ | ❌ Not Implemented | ❌ Not Implemented |
| Thinking | ✅ | ❌ Not Implemented | ❌ Not Implemented |
| Token Counting | ✅ (tiktoken + multiplier) | ❌ Not Implemented | ❌ Not Implemented |
| Model Management | ✅ (list, pull, delete) | ❌ Not Implemented | ❌ Not Implemented |

## Common Pitfalls

### 1. Throwing Instead of Emitting Errors

```typescript
// ❌ BAD
async *chatStream(request: ProviderRequest): AsyncIterable<ProviderEvent> {
  throw new Error('Not implemented'); // Breaks the stream
}

// ✅ GOOD
async *chatStream(request: ProviderRequest): AsyncIterable<ProviderEvent> {
  yield { type: 'error', error: { message: 'Not implemented' } };
  return;
}
```

### 2. Not Handling Abort Signal

```typescript
// ❌ BAD: Ignoring abort signal
async *chatStream(request: ProviderRequest): AsyncIterable<ProviderEvent> {
  const response = await fetch(url); // No abort handling
}

// ✅ GOOD: Respecting abort signal
async *chatStream(request: ProviderRequest): AsyncIterable<ProviderEvent> {
  const controller = new AbortController();
  if (request.abortSignal) {
    request.abortSignal.addEventListener('abort', () => {
      controller.abort();
    });
  }
  const response = await fetch(url, { signal: controller.signal });
}
```

### 3. Not Cleaning Up Resources

```typescript
// ❌ BAD: Leaking timeout
let timeoutId = setTimeout(() => controller.abort(), timeout);
// ... stream processing
// Timeout never cleared!

// ✅ GOOD: Cleaning up timeout
let timeoutId = setTimeout(() => controller.abort(), timeout);
try {
  // ... stream processing
} finally {
  if (timeoutId) clearTimeout(timeoutId);
}
```

### 4. Loose Type Assertions

```typescript
// ❌ BAD: Unsafe type assertions
const chunk = data as Record<string, unknown>;
const message = chunk.message as Record<string, unknown>;

// ✅ GOOD: Runtime validation
interface OllamaChunk {
  message?: {
    content?: string;
    tool_calls?: Array<{ ... }>;
  };
  done?: boolean;
}

function isOllamaChunk(data: unknown): data is OllamaChunk {
  // Validate structure
  return typeof data === 'object' && data !== null;
}

const chunk = data;
if (!isOllamaChunk(chunk)) {
  yield { type: 'error', error: { message: 'Invalid chunk' } };
  return;
}
```

## Resources

- [ProviderAdapter Interface](./types.ts)
- [ProviderRegistry](./registry.ts)
- [LocalProvider Implementation](../../ollm-bridge/src/provider/localProvider.ts)
- [Ollama API Documentation](https://github.com/ollama/ollama/blob/main/docs/api.md)

## Support

For questions or issues with provider development:
1. Check existing provider implementations for examples
2. Review the audit document: `.dev/audits/provider-system-audit.md`
3. Run tests to validate your implementation
4. Open an issue with the `provider` label
