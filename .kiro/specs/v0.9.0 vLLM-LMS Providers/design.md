# Design Document: Multi-Provider Support (vLLM & OpenAI-Compatible)

## Overview

This design extends OLLM CLI's provider system to support multiple LLM backends through a 3-tier architecture:

- **Tier 1 (Existing)**: LocalProvider for Ollama - default, best for development
- **Tier 2 (New)**: VllmProvider for vLLM - high-performance production deployments
- **Tier 3 (New)**: OpenAICompatibleProvider - universal adapter for LM Studio, LocalAI, Kobold, llama.cpp, and other OpenAI-compatible servers

The design maintains backward compatibility with existing Ollama setups while enabling users to choose the best backend for their use case. The provider abstraction already exists in the codebase, so this implementation focuses on adding new provider adapters and enhancing the registry with alias support.

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      OLLM CLI Core                          │
│  ┌──────────────────────────────────────────────────────┐  │
│  │           Provider Registry                          │  │
│  │  - Provider lookup by name or alias                  │  │
│  │  - Default provider management                       │  │
│  │  - Alias mapping (e.g., 'lmstudio' → 'openai-compat')│  │
│  └──────────────────────────────────────────────────────┘  │
│                           │                                  │
│                           ▼                                  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │         ProviderAdapter Interface                    │  │
│  │  - chatStream(request): AsyncIterable<ProviderEvent> │  │
│  │  - listModels?(): Promise<ModelInfo[]>              │  │
│  │  - pullModel?(...): Promise<void>                   │  │
│  │  - deleteModel?(...): Promise<void>                 │  │
│  │  - streamingFormat?: 'ndjson' | 'sse'               │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                           │
        ┌──────────────────┼──────────────────┐
        ▼                  ▼                   ▼
┌───────────────┐  ┌───────────────┐  ┌──────────────────────┐
│ LocalProvider │  │ VllmProvider  │  │ OpenAICompatible     │
│ (Tier 1)      │  │ (Tier 2)      │  │ Provider (Tier 3)    │
├───────────────┤  ├───────────────┤  ├──────────────────────┤
│ - NDJSON      │  │ - SSE         │  │ - SSE                │
│ - Ollama API  │  │ - OpenAI API  │  │ - OpenAI API         │
│ - Model mgmt  │  │ - vLLM extras │  │ - Backend quirks     │
└───────────────┘  └───────────────┘  └──────────────────────┘
        │                  │                   │
        ▼                  ▼                   ▼
┌───────────────┐  ┌───────────────┐  ┌──────────────────────┐
│    Ollama     │  │     vLLM      │  │  LM Studio, LocalAI, │
│  localhost:   │  │  localhost:   │  │  Kobold, llama.cpp,  │
│     11434     │  │     8000      │  │  etc.                │
└───────────────┘  └───────────────┘  └──────────────────────┘
```

### Streaming Format Differences

The key architectural difference between providers is the streaming format:

**NDJSON (LocalProvider)**:
```
{"message":{"content":"Hello"}}\n
{"message":{"content":" world"}}\n
{"done":true}\n
```

**SSE (VllmProvider, OpenAICompatibleProvider)**:
```
data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n
data: {"choices":[{"delta":{"content":" world"}}]}\n\n
data: [DONE]\n\n
```

## Components and Interfaces

### 1. SSE Parser Utility

A shared utility for parsing Server-Sent Events streams, used by both VllmProvider and OpenAICompatibleProvider.

**File**: `packages/ollm-bridge/src/utils/sseParser.ts`

```typescript
/**
 * Parse Server-Sent Events stream from an HTTP response.
 * Handles partial chunks, malformed JSON, and [DONE] markers.
 * 
 * @param response - HTTP response with SSE body
 * @returns Async iterable of parsed JSON objects
 */
export async function* parseSSEStream(
  response: Response
): AsyncIterable<Record<string, unknown>> {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || ''; // Keep incomplete line in buffer

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      
      const data = line.slice(6).trim();
      if (data === '[DONE]') return;
      
      try {
        yield JSON.parse(data);
      } catch {
        // Skip malformed JSON lines
      }
    }
  }
}
```

**Key Design Decisions**:
- Buffers incomplete lines to handle partial chunks
- Silently skips malformed JSON (resilient to backend quirks)
- Terminates on `[DONE]` marker
- Returns raw JSON objects for provider-specific mapping

### 2. VllmProvider

High-performance provider for vLLM backend with support for vLLM-specific features.

**File**: `packages/ollm-bridge/src/provider/vllmProvider.ts`

```typescript
export interface VllmProviderConfig {
  baseUrl: string;          // Default: http://localhost:8000
  apiKey?: string;          // Optional API key
  timeout?: number;         // Request timeout in ms
}

export interface VllmExtraOptions {
  guided_json?: object;        // JSON schema constraint
  guided_regex?: string;       // Regex constraint
  guided_choice?: string[];    // Choice constraint
  min_tokens?: number;         // Minimum response length
  presence_penalty?: number;
  frequency_penalty?: number;
  best_of?: number;            // Beam search
  use_beam_search?: boolean;
  skip_special_tokens?: boolean;
}

export class VllmProvider implements ProviderAdapter {
  readonly name = 'vllm';
  readonly streamingFormat = 'sse';

  constructor(private config: VllmProviderConfig) {}

  async *chatStream(request: ProviderRequest): AsyncIterable<ProviderEvent> {
    const url = `${this.config.baseUrl}/v1/chat/completions`;
    
    const body = {
      model: request.model,
      messages: this.mapMessages(request.messages, request.systemPrompt),
      tools: request.tools ? this.mapTools(request.tools) : undefined,
      temperature: request.options?.temperature,
      max_tokens: request.options?.maxTokens,
      top_p: request.options?.topP,
      stream: true,
      ...request.options?.extraBody, // vLLM-specific options
    };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: this.getHeaders(),
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

      // Use shared SSE parser
      for await (const chunk of parseSSEStream(response)) {
        yield* this.mapChunkToEvents(chunk);
      }

      yield { type: 'finish', reason: 'stop' };
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          yield { type: 'finish', reason: 'stop' };
          return;
        }
        yield {
          type: 'error',
          error: { message: error.message },
        };
      }
    }
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    if (this.config.apiKey) {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`;
    }
    
    return headers;
  }

  private mapMessages(messages: Message[], systemPrompt?: string): unknown[] {
    const mapped = [];

    if (systemPrompt) {
      mapped.push({ role: 'system', content: systemPrompt });
    }

    for (const msg of messages) {
      const content = msg.parts
        .map((part) => (part.type === 'text' ? part.text : '[image]'))
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
    return tools.map((tool) => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      },
    }));
  }

  private *mapChunkToEvents(chunk: any): Iterable<ProviderEvent> {
    const choice = chunk.choices?.[0];
    if (!choice) return;

    if (choice.delta?.content) {
      yield { type: 'text', value: choice.delta.content };
    }

    if (choice.delta?.tool_calls) {
      for (const toolCall of choice.delta.tool_calls) {
        if (toolCall.function?.name && toolCall.function?.arguments) {
          yield {
            type: 'tool_call',
            value: {
              id: toolCall.id ?? crypto.randomUUID(),
              name: toolCall.function.name,
              args: JSON.parse(toolCall.function.arguments),
            },
          };
        }
      }
    }

    if (choice.finish_reason) {
      yield {
        type: 'finish',
        reason: choice.finish_reason === 'length' ? 'length' : 'stop',
      };
    }
  }

  async listModels(): Promise<ModelInfo[]> {
    const url = `${this.config.baseUrl}/v1/models`;
    const response = await fetch(url, {
      headers: this.getHeaders(),
    });
    
    const data = await response.json();
    return data.data.map((model: any) => ({
      name: model.id,
      details: model,
    }));
  }
}
```

**Key Design Decisions**:
- Uses SSE streaming format via shared parser
- Supports vLLM-specific options through `extraBody` passthrough
- Standard OpenAI-compatible endpoint (`/v1/chat/completions`)
- Optional API key authentication
- Model listing via `/v1/models` endpoint
- No model management (pull/delete) - vLLM doesn't support this

### 3. OpenAICompatibleProvider

Universal provider for any OpenAI-compatible backend with backend-specific quirk handling.

**File**: `packages/ollm-bridge/src/provider/openaiCompatibleProvider.ts`

```typescript
export interface OpenAICompatibleProviderConfig {
  baseUrl: string;          // Server URL (e.g., http://localhost:1234)
  apiKey?: string;          // Optional API key
  timeout?: number;         // Request timeout in ms
  backend?: string;         // Hint: 'lmstudio', 'localai', 'kobold', 'llamacpp', 'generic'
}

export class OpenAICompatibleProvider implements ProviderAdapter {
  readonly name = 'openai-compatible';
  readonly streamingFormat = 'sse';

  constructor(private config: OpenAICompatibleProviderConfig) {}

  async *chatStream(request: ProviderRequest): AsyncIterable<ProviderEvent> {
    const url = `${this.config.baseUrl}/v1/chat/completions`;
    
    const body = {
      model: request.model,
      messages: this.mapMessages(request.messages, request.systemPrompt),
      tools: request.tools ? this.mapTools(request.tools) : undefined,
      temperature: request.options?.temperature,
      max_tokens: request.options?.maxTokens,
      top_p: request.options?.topP,
      stream: true,
      ...request.options?.extraBody,
    };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: this.getHeaders(),
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

      // Use shared SSE parser
      for await (const chunk of parseSSEStream(response)) {
        yield* this.mapChunkToEvents(chunk);
      }

      yield { type: 'finish', reason: 'stop' };
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          yield { type: 'finish', reason: 'stop' };
          return;
        }
        yield {
          type: 'error',
          error: { message: error.message },
        };
      }
    }
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    if (this.config.apiKey) {
      // LM Studio uses X-API-Key header
      if (this.config.backend === 'lmstudio') {
        headers['X-API-Key'] = this.config.apiKey;
      } else {
        // Standard OpenAI format
        headers['Authorization'] = `Bearer ${this.config.apiKey}`;
      }
    }
    
    return headers;
  }

  private mapMessages(messages: Message[], systemPrompt?: string): unknown[] {
    const mapped = [];

    if (systemPrompt) {
      mapped.push({ role: 'system', content: systemPrompt });
    }

    for (const msg of messages) {
      const content = msg.parts
        .map((part) => (part.type === 'text' ? part.text : '[image]'))
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
    return tools.map((tool) => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      },
    }));
  }

  private *mapChunkToEvents(chunk: any): Iterable<ProviderEvent> {
    const choice = chunk.choices?.[0];
    if (!choice) return;

    if (choice.delta?.content) {
      yield { type: 'text', value: choice.delta.content };
    }

    if (choice.delta?.tool_calls) {
      for (const toolCall of choice.delta.tool_calls) {
        if (toolCall.function?.name && toolCall.function?.arguments) {
          yield {
            type: 'tool_call',
            value: {
              id: toolCall.id ?? crypto.randomUUID(),
              name: toolCall.function.name,
              args: JSON.parse(toolCall.function.arguments),
            },
          };
        }
      }
    }

    if (choice.finish_reason) {
      yield {
        type: 'finish',
        reason: choice.finish_reason === 'length' ? 'length' : 'stop',
      };
    }
  }

  async listModels(): Promise<ModelInfo[]> {
    try {
      const url = `${this.config.baseUrl}/v1/models`;
      const response = await fetch(url, {
        headers: this.getHeaders(),
      });
      
      if (!response.ok) {
        // Model listing not supported by this backend
        return [];
      }
      
      const data = await response.json();
      return data.data?.map((model: any) => ({
        name: model.id,
        details: model,
      })) || [];
    } catch {
      // Gracefully handle backends without model listing
      return [];
    }
  }
}
```

**Key Design Decisions**:
- Identical to VllmProvider except for backend-specific quirks
- LM Studio uses `X-API-Key` header instead of `Authorization`
- Gracefully handles missing `/v1/models` endpoint
- Backend hint allows future quirk handling without breaking changes
- No model management (pull/delete) - not supported by most backends

### 4. Provider Registry Enhancement

Enhanced registry with alias support for user-friendly provider names.

**File**: `packages/core/src/provider/registry.ts` (modifications)

```typescript
export class ProviderRegistry {
  private providers: Map<string, ProviderAdapter>;
  private defaultProviderName?: string;
  private providerAliases: Map<string, string>;  // NEW

  constructor() {
    this.providers = new Map();
    this.providerAliases = new Map();  // NEW
  }

  // Existing methods remain unchanged...

  /**
   * Register an alias for a provider.
   * Allows users to reference providers by friendly names.
   * 
   * @param alias - Friendly name (e.g., 'lmstudio')
   * @param providerName - Actual provider name (e.g., 'openai-compatible')
   */
  registerAlias(alias: string, providerName: string): void {
    this.providerAliases.set(alias, providerName);
  }

  /**
   * Resolve a provider by name or alias.
   * 
   * @param nameOrAlias - Provider name or alias
   * @returns Provider adapter, or undefined if not found
   */
  resolve(nameOrAlias: string): ProviderAdapter | undefined {
    const resolved = this.providerAliases.get(nameOrAlias) || nameOrAlias;
    return this.providers.get(resolved);
  }
}
```

**Alias Examples**:
- `'lmstudio'` → `'openai-compatible'`
- `'localai'` → `'openai-compatible'`
- `'kobold'` → `'openai-compatible'`
- `'ollama'` → `'local'`

### 5. Provider Type System Extension

**File**: `packages/core/src/provider/types.ts` (modifications)

```typescript
export interface ProviderAdapter {
  name: string;
  streamingFormat?: 'ndjson' | 'sse';  // NEW: Hint for debugging/logging
  // ... rest unchanged
}

export interface GenerationOptions {
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  topK?: number;
  repeatPenalty?: number;
  seed?: number;
  extraBody?: Record<string, unknown>;  // NEW: Provider-specific options
}
```

## Data Models

### Configuration Schema

**File**: `schemas/settings.schema.json` (additions)

```json
{
  "properties": {
    "provider": {
      "type": "string",
      "enum": ["local", "vllm", "openai-compatible"],
      "default": "local",
      "description": "LLM provider to use"
    },
    "providers": {
      "type": "object",
      "properties": {
        "local": {
          "type": "object",
          "properties": {
            "baseUrl": {
              "type": "string",
              "default": "http://localhost:11434"
            }
          }
        },
        "vllm": {
          "type": "object",
          "properties": {
            "baseUrl": {
              "type": "string",
              "default": "http://localhost:8000"
            },
            "apiKey": {
              "type": "string"
            }
          }
        },
        "openai-compatible": {
          "type": "object",
          "properties": {
            "baseUrl": {
              "type": "string",
              "default": "http://localhost:1234"
            },
            "apiKey": {
              "type": "string"
            },
            "backend": {
              "type": "string",
              "enum": ["lmstudio", "localai", "kobold", "llamacpp", "generic"],
              "default": "generic"
            }
          }
        }
      }
    }
  }
}
```

### Environment Variables

**File**: `packages/cli/src/config/env.ts` (additions)

```typescript
export const ENV_VARS = {
  // Existing
  OLLAMA_HOST: process.env.OLLAMA_HOST || 'http://localhost:11434',
  
  // New
  VLLM_HOST: process.env.VLLM_HOST || 'http://localhost:8000',
  VLLM_API_KEY: process.env.VLLM_API_KEY,
  
  OPENAI_COMPATIBLE_HOST: process.env.OPENAI_COMPATIBLE_HOST || 'http://localhost:1234',
  OPENAI_COMPATIBLE_API_KEY: process.env.OPENAI_COMPATIBLE_API_KEY,
};
```

### CLI Arguments

New command-line flags for provider selection:

```bash
ollm --provider vllm --host http://gpu-server:8000 --api-key $KEY -p "Hello"
ollm --provider openai-compatible --host http://localhost:1234 -p "Hello"
ollm --provider local -p "Hello"  # Default
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*


### Property 1: Provider Interface Compliance
*For any* provider implementation (VllmProvider, OpenAICompatibleProvider), it SHALL implement all required methods from the ProviderAdapter interface (name, chatStream).

**Validates: Requirements 1.1, 2.1**

### Property 2: SSE Stream Parsing Correctness
*For any* valid Server-Sent Events stream, the SSE parser SHALL correctly extract and yield all data lines as parsed JSON objects.

**Validates: Requirements 3.1, 3.2, 3.6**

### Property 3: SSE Stream Termination
*For any* SSE stream containing a `[DONE]` marker, the parser SHALL terminate iteration immediately upon encountering it.

**Validates: Requirements 3.3**

### Property 4: SSE Malformed JSON Resilience
*For any* SSE stream containing lines with malformed JSON, the parser SHALL skip those lines and continue processing subsequent valid lines.

**Validates: Requirements 3.4**

### Property 5: SSE Partial Chunk Buffering
*For any* sequence of partial data chunks, the SSE parser SHALL buffer incomplete lines until a complete line is received.

**Validates: Requirements 3.5**

### Property 6: OpenAI-Compatible Endpoint Usage
*For any* chat request made by VllmProvider or OpenAICompatibleProvider, the request SHALL be sent to the `/v1/chat/completions` endpoint.

**Validates: Requirements 1.3, 2.3**

### Property 7: Provider-Specific Options Passthrough
*For any* GenerationOptions containing extraBody fields, the provider SHALL include all extraBody key-value pairs in the API request body.

**Validates: Requirements 1.5, 11.1, 11.2, 11.3**

### Property 8: Authenticated Request Headers
*For any* provider request where an API key is configured, the provider SHALL include authentication credentials in the request headers.

**Validates: Requirements 1.6, 2.9**

### Property 9: Model Listing Error Handling
*For any* error encountered during model listing by OpenAICompatibleProvider, the provider SHALL return an empty array instead of throwing an exception.

**Validates: Requirements 2.5, 9.4**

### Property 10: Backend-Specific Header Adaptation
*For any* OpenAICompatibleProvider configuration with backend='lmstudio' and an API key, the provider SHALL use the `X-API-Key` header; for all other backends, it SHALL use the `Authorization: Bearer` header.

**Validates: Requirements 2.6**

### Property 11: Provider Registry Alias Resolution
*For any* provider name or alias passed to the registry's resolve() method, it SHALL first check the alias map, then fall back to exact name matching.

**Validates: Requirements 4.2**

### Property 12: Provider Registry Not Found Behavior
*For any* unregistered provider name or alias, the registry's resolve() method SHALL return undefined.

**Validates: Requirements 4.4**

### Property 13: Provider Registry Backward Compatibility
*For any* existing code using the registry's get() method, the method SHALL continue to work identically to before the alias feature was added.

**Validates: Requirements 4.5, 12.5**

### Property 14: Configuration Schema Validation
*For any* valid provider configuration (vllm or openai-compatible), the schema SHALL accept the baseUrl and apiKey fields without validation errors.

**Validates: Requirements 6.3, 6.4**

### Property 15: Environment Variable Substitution
*For any* configuration value that references an environment variable, the system SHALL substitute the environment variable's value.

**Validates: Requirements 6.6**

### Property 16: Configuration Precedence
*For any* configuration setting that exists in both environment variables and config file, the environment variable value SHALL take precedence.

**Validates: Requirements 7.5**

### Property 17: CLI Flag Precedence
*For any* configuration setting that exists in both CLI flags and config file, the CLI flag value SHALL override the config file value.

**Validates: Requirements 8.4**

### Property 18: Network Error Messages
*For any* provider request that fails due to network unreachability, the system SHALL yield an error event with a descriptive message indicating the connection failure.

**Validates: Requirements 9.1**

### Property 19: Authentication Error Messages
*For any* provider request that fails with HTTP 401 or 403, the system SHALL yield an error event indicating invalid or missing API credentials.

**Validates: Requirements 9.2**

### Property 20: Unsupported Operation Messages
*For any* operation called on a provider that doesn't implement that optional method, the system SHALL return a clear message indicating the operation is not supported by that provider.

**Validates: Requirements 9.3**

### Property 21: Mid-Stream Error Handling
*For any* streaming response that fails after partial content has been yielded, the system SHALL yield all received content followed by an error event with details.

**Validates: Requirements 9.5**

### Property 22: Feature Capability Detection
*For any* provider, the system SHALL be able to determine whether optional features (model management, tool calling) are supported by checking for the presence of the corresponding methods.

**Validates: Requirements 10.4**

### Property 23: Graceful Feature Degradation
*For any* unsupported optional feature, the system SHALL continue operation without that feature rather than failing completely.

**Validates: Requirements 10.5**

### Property 24: Backward Compatibility Preservation
*For any* existing Ollama configuration and usage pattern, the system SHALL continue to function identically after the multi-provider changes are implemented.

**Validates: Requirements 12.1, 12.2, 12.3, 12.4**

## Error Handling

### Network Errors

All providers implement consistent error handling for network failures:

1. **Connection Refused**: Yield error event with message "Failed to connect to {baseUrl}"
2. **Timeout**: Yield error event with message "Request timed out after {timeout}ms"
3. **DNS Failure**: Yield error event with message "Could not resolve hostname {host}"
4. **Abort Signal**: Yield finish event with reason 'stop' (graceful cancellation)

### Authentication Errors

HTTP 401/403 responses are mapped to clear error messages:

```typescript
if (response.status === 401 || response.status === 403) {
  yield {
    type: 'error',
    error: {
      message: 'Authentication failed. Check your API key.',
      code: String(response.status),
    },
  };
}
```

### Streaming Errors

Mid-stream failures are handled by yielding partial content before the error:

```typescript
try {
  for await (const chunk of parseSSEStream(response)) {
    yield* this.mapChunkToEvents(chunk);
  }
  yield { type: 'finish', reason: 'stop' };
} catch (error) {
  // Partial content already yielded
  yield {
    type: 'error',
    error: { message: error.message },
  };
}
```

### Graceful Degradation

Optional features fail gracefully:

```typescript
async listModels(): Promise<ModelInfo[]> {
  try {
    const response = await fetch(`${this.baseUrl}/v1/models`);
    if (!response.ok) return [];
    const data = await response.json();
    return data.data || [];
  } catch {
    return []; // Backend doesn't support model listing
  }
}
```

## Testing Strategy

### Unit Tests

Unit tests will verify specific examples, edge cases, and error conditions:

**SSE Parser Tests**:
- Empty stream returns no results
- Single data line is parsed correctly
- Multiple data lines are parsed in order
- [DONE] marker terminates stream
- Malformed JSON lines are skipped
- Partial chunks are buffered correctly
- Mixed valid/invalid lines are handled

**VllmProvider Tests**:
- Default base URL is http://localhost:8000
- API key is included in Authorization header when configured
- extraBody options are passed through to request
- Model listing returns parsed model data
- Network errors yield error events
- Abort signal terminates stream gracefully

**OpenAICompatibleProvider Tests**:
- Default base URL is http://localhost:1234
- LM Studio backend uses X-API-Key header
- Other backends use Authorization header
- Model listing returns empty array on error
- Backend hint affects header selection

**Provider Registry Tests**:
- Alias registration and resolution
- Exact name resolution still works
- Unregistered names return undefined
- Backward compatibility with get() method

### Property-Based Tests

Property tests will verify universal properties across all inputs using a property-based testing library (fast-check for TypeScript):

**Configuration**: Each property test will run a minimum of 100 iterations with randomized inputs.

**Property Test 1: SSE Parser Handles All Valid Streams**
- Generate random valid SSE streams
- Verify all data lines are extracted
- Verify [DONE] terminates correctly
- **Tag**: Feature: stage-11-vllm-openai, Property 2: SSE Stream Parsing Correctness

**Property Test 2: SSE Parser Buffers Partial Chunks**
- Generate random chunk boundaries
- Verify complete lines are eventually parsed
- Verify no data is lost
- **Tag**: Feature: stage-11-vllm-openai, Property 5: SSE Partial Chunk Buffering

**Property Test 3: Provider Options Passthrough**
- Generate random extraBody options
- Verify all options appear in request body
- Verify no options are dropped or modified
- **Tag**: Feature: stage-11-vllm-openai, Property 7: Provider-Specific Options Passthrough

**Property Test 4: Registry Alias Resolution**
- Generate random alias mappings
- Verify aliases resolve correctly
- Verify exact names still work
- **Tag**: Feature: stage-11-vllm-openai, Property 11: Provider Registry Alias Resolution

**Property Test 5: Configuration Precedence**
- Generate random config combinations (env vars, config file, CLI flags)
- Verify precedence order is always respected
- **Tag**: Feature: stage-11-vllm-openai, Property 16: Configuration Precedence, Property 17: CLI Flag Precedence

**Property Test 6: Error Message Clarity**
- Generate random network errors
- Verify all error messages are descriptive
- Verify error codes are included
- **Tag**: Feature: stage-11-vllm-openai, Property 18: Network Error Messages

**Property Test 7: Backward Compatibility**
- Generate random Ollama configurations
- Verify behavior is identical to before changes
- **Tag**: Feature: stage-11-vllm-openai, Property 24: Backward Compatibility Preservation

### Integration Tests

Integration tests will use mock HTTP servers to simulate real backends:

**Mock vLLM Server**:
- Responds with SSE format
- Supports /v1/chat/completions endpoint
- Supports /v1/models endpoint
- Requires Bearer token authentication

**Mock LM Studio Server**:
- Responds with SSE format
- Supports /v1/chat/completions endpoint
- Requires X-API-Key authentication
- Model listing may fail (404)

**Mock Ollama Server**:
- Responds with NDJSON format
- Supports /api/chat endpoint
- No authentication required
- Supports model management endpoints

### Test Coverage Goals

- Line coverage: >90% for new provider implementations
- Branch coverage: >85% for error handling paths
- Property test iterations: 100+ per property
- Integration test scenarios: All 3 provider types × 3 scenarios (success, auth error, network error)
