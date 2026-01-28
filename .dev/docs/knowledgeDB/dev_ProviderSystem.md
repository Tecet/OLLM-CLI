# Provider System

**Last Updated:** January 27, 2026  
**Status:** Source of Truth

**Related Documents:**

- `dev_ContextManagement.md` - Context sizing, VRAM monitoring
- `dev_ModelManagement.md` - Model profiles, detection
- `dev_ModelDB.md` - Model database schema and access patterns
- `dev_ModelCompiler.md` - User profile compilation system
- `.kiro/specs/v0.6.0 Release Kraken` - Codex, Claude, Gemini providers
- `.kiro/specs/v0.9.0 vLLM-LMS Providers` - Open source providers

---

## Overview

The Provider System abstracts LLM backend communication, allowing the application to work with different LLM providers through a unified interface.

**Current Implementation (v0.1.0):** Ollama provider only  
**Upcoming:** Codex, Claude, Gemini (v0.6.0), vLLM and other open source providers (v0.9.0)

---

## Core Architecture

### Provider Abstraction

```
Application Layer
  ↓
Provider Registry
  ↓
Provider Adapter Interface
  ├─ chatStream(messages, options)
  ├─ listModels()
  ├─ getModelInfo(modelId)
  └─ healthCheck()
  ↓
Transport Layer
  ├─ HTTP Client
  ├─ SSE Parser
  └─ NDJSON Parser
  ↓
LLM Backend (Ollama)
```

**Design Principle:** Provider adapters implement a common interface, allowing the application to switch between providers without changing core logic.

---

## Ollama Provider (Current Implementation)

### Overview

The Ollama provider is the primary and currently only implemented provider. It provides local LLM execution with full privacy and no API costs.

**Use Case:** Local development, privacy-focused, offline operation

**Features:**

- Full local execution
- No API keys required
- Model management (pull, remove, list)
- Context window detection
- VRAM monitoring integration
- Streaming responses
- Tool calling (function calling)

### Configuration

```json
{
  "provider": "ollama",
  "host": "http://localhost:11434",
  "model": "llama3.2:3b"
}
```

**Environment Variables:**

- `OLLAMA_HOST` - Ollama server URL (default: http://localhost:11434)

**User Settings:**

The application reads Ollama configuration from `~/.ollm/settings.json`:

```json
{
  "provider": {
    "ollama": {
      "autoStart": true,
      "host": "localhost",
      "port": 11434,
      "url": "http://localhost:11434"
    }
  }
}
```

**Settings Fields:**

- `autoStart` - Enable/disable automatic `ollama serve` on app startup
- `host` - Ollama server hostname (default: localhost)
- `port` - Ollama server port (default: 11434)
- `url` - Full URL (computed from host:port)

**Auto-Start Feature:**

The application can automatically start `ollama serve` in the background on startup:

- **Enabled by default** - App starts Ollama server automatically
- **Configurable** - Users can disable auto-start in settings
- **Custom host/port** - Users can configure custom Ollama server location
- **Background process** - Runs in background, doesn't block app

**Configuration Commands:**

```bash
# Enable/disable auto-start
/config ollama autostart on
/config ollama autostart off

# Configure custom server
/config ollama host localhost
/config ollama port 11434

# Show current settings
/config ollama show
```

**Settings UI:**

```
┌─ Ollama Provider Settings ─────────────┐
│                                         │
│ Auto-start Ollama:  [✓] Enabled        │
│ Host:               [localhost      ]  │
│ Port:               [11434          ]  │
│ URL:                http://localhost:11434 │
│                                         │
│ [Save Settings]  [Reset to Defaults]   │
└─────────────────────────────────────────┘
```

**npm Installation:**

When installing via npm, the package will:

1. Detect if Ollama is installed
2. Ask user permission to install Ollama (if not found)
3. Ask user permission to pull default model (llama3.2:3b)
4. Configure settings automatically

**See:** `dev_npm_package.md` for npm packaging and installation details  
**See:** `works_todo.md` Task #8 for implementation details

### Capabilities

| Feature                  | Status | Notes                                  |
| ------------------------ | ------ | -------------------------------------- |
| Streaming responses      | ✅     | NDJSON format                          |
| Tool calling             | ✅     | Function calling format                |
| Context window detection | ✅     | From model metadata                    |
| Model management         | ✅     | Pull, remove, list                     |
| VRAM monitoring          | ✅     | Platform-specific (NVIDIA, AMD, Apple) |
| Multi-modal              | ⚠️     | Limited (images only)                  |
| Multi-GPU                | ❌     | Single GPU only                        |

### Message Format

Ollama uses a simple message format:

```typescript
interface OllamaMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  images?: string[]; // Base64-encoded images
}
```

**Translation from Internal Format:**

```typescript
// Internal message
{
  role: 'user',
  parts: [
    { type: 'text', text: 'Hello' },
    { type: 'image', data: 'base64...' }
  ]
}

// Ollama message
{
  role: 'user',
  content: 'Hello',
  images: ['base64...']
}
```

### Tool Schema Format

Ollama uses OpenAI-compatible function calling format:

```typescript
{
  name: 'read_file',
  description: 'Read contents of a file',
  parameters: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'File path to read'
      }
    },
    required: ['path']
  }
}
```

### Stream Format

Ollama uses NDJSON (Newline-Delimited JSON) for streaming:

```
{"model":"llama3.2:3b","created_at":"...","message":{"role":"assistant","content":"Hello"},"done":false}
{"model":"llama3.2:3b","created_at":"...","message":{"role":"assistant","content":" world"},"done":false}
{"model":"llama3.2:3b","created_at":"...","message":{"role":"assistant","content":"!"},"done":true}
```

**Parsing:**

1. Split stream by newlines
2. Parse each line as JSON
3. Extract `message.content` for text delta
4. Check `done` flag for completion

### Model Management

**List Models:**

```bash
GET /api/tags
```

**Pull Model:**

```bash
POST /api/pull
{ "name": "llama3.2:3b" }
```

**Remove Model:**

```bash
DELETE /api/delete
{ "name": "llama3.2:3b" }
```

**Model Info:**

```bash
POST /api/show
{ "name": "llama3.2:3b" }
```

### Context Window Detection

Ollama provides context window size in model metadata:

```json
{
  "modelfile": "...",
  "parameters": "...",
  "template": "...",
  "details": {
    "parameter_size": "3B",
    "quantization_level": "Q4_0"
  },
  "model_info": {
    "general.parameter_count": 3213312000,
    "llama.context_length": 8192
  }
}
```

**Extraction:**

```typescript
const contextLength = modelInfo.model_info['llama.context_length'];
// Returns: 8192
```

---

## Future Providers

### v0.6.0: Release Kraken

**Planned Providers:**

- **Codex** - GitHub Copilot backend
- **Claude Code** - Anthropic's code-focused model
- **Gemini CLI** - Google's Gemini via CLI

**See:** `.kiro/specs/v0.6.0 Release Kraken` for details

### v0.9.0: vLLM-LMS Providers

**Planned Providers:**

- **vLLM** - High-performance inference engine
- **Other open source providers** - TBD

**See:** `.kiro/specs/v0.9.0 vLLM-LMS Providers` for details

---

## Provider Interface

All providers must implement the `ProviderAdapter` interface:

```typescript
interface ProviderAdapter {
  // Streaming chat
  chatStream(messages: Message[], options: ChatOptions): AsyncGenerator<StreamEvent>;

  // Model management
  listModels(): Promise<ModelInfo[]>;
  getModelInfo(modelId: string): Promise<ModelInfo>;

  // Health check
  healthCheck(): Promise<boolean>;

  // Optional: Model operations
  pullModel?(modelId: string): Promise<void>;
  removeModel?(modelId: string): Promise<void>;
}
```

### Stream Events

```typescript
type StreamEvent =
  | { type: 'chunk'; delta: string }
  | { type: 'tool_call'; toolCall: ToolCall }
  | { type: 'done'; metadata: ResponseMetadata }
  | { type: 'error'; error: Error };
```

### Chat Options

```typescript
interface ChatOptions {
  model: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  topK?: number;
  stop?: string[];
  tools?: Tool[];
  num_ctx?: number; // Context window size
}
```

---

## Provider Registry

### Registration

```typescript
// Register provider
providerRegistry.register('ollama', ollamaProvider);

// Get provider
const provider = providerRegistry.get('ollama');

// List providers
const providers = providerRegistry.list();
```

### Provider Selection

**Current (v0.1.0):**

- Single provider (Ollama)
- No selection logic needed

**Future (v0.6.0+):**

- User preference
- Automatic detection
- Fallback mechanisms

---

## Message Translation

### Internal Message Format

```typescript
interface Message {
  id: string;
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  timestamp: Date;
  toolCalls?: ToolCall[];
  toolCallId?: string;
  tokenCount?: number;
}
```

### Provider-Specific Translation

Each provider adapter translates internal messages to provider-specific format:

```typescript
class OllamaProvider implements ProviderAdapter {
  private translateMessage(message: Message): OllamaMessage {
    return {
      role: message.role,
      content: message.content,
      // Ollama-specific fields
    };
  }
}
```

---

## Stream Parsing

### NDJSON Parser (Ollama)

```typescript
async function* parseNDJSON(stream: ReadableStream) {
  const reader = stream.getReader();
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
        const data = JSON.parse(line);
        yield {
          type: 'chunk',
          delta: data.message?.content || '',
        };

        if (data.done) {
          yield { type: 'done', metadata: data };
        }
      }
    }
  }
}
```

### SSE Parser (Future Providers)

```typescript
async function* parseSSE(stream: ReadableStream) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split('\n\n');
    buffer = events.pop() || '';

    for (const event of events) {
      if (event.startsWith('data: ')) {
        const data = event.slice(6);
        if (data === '[DONE]') {
          yield { type: 'done' };
        } else {
          const parsed = JSON.parse(data);
          yield {
            type: 'chunk',
            delta: parsed.choices[0]?.delta?.content || '',
          };
        }
      }
    }
  }
}
```

---

## Integration with Context Management

### Context Window Size

Provider reports context window size to Context Manager:

```typescript
// Provider detects context window
const modelInfo = await provider.getModelInfo(modelId);
const contextWindow = modelInfo.contextLength;

// Context Manager uses this for sizing
contextManager.updateConfig({
  maxSize: contextWindow,
});
```

### VRAM Monitoring

For local providers (Ollama), VRAM monitoring is integrated:

```typescript
// VRAM Monitor detects available memory
const vramInfo = await vramMonitor.getInfo();

// Context Manager adjusts context size
const optimalSize = contextPool.calculateOptimalSize(vramInfo, modelInfo);
```

**See:** `dev_ContextManagement.md` for details

---

## Tool Execution Integration

### Tool Call Flow

```
LLM generates tool call
  ↓
Provider adapter parses tool call
  ↓
Emits 'tool_call' event
  ↓
Tool Registry executes tool
  ↓
Tool result returned
  ↓
Provider adapter formats result
  ↓
Sent back to LLM
```

**See:** `dev_ToolExecution.md` for details

---

## Configuration

### Provider Config

```typescript
interface ProviderConfig {
  provider: 'ollama'; // Only Ollama in v0.1.0
  host: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  topK?: number;
}
```

### Default Values

```typescript
const DEFAULT_PROVIDER_CONFIG = {
  provider: 'ollama',
  host: 'http://localhost:11434',
  model: 'llama3.2:3b',
  temperature: 0.7,
  topP: 0.9,
};
```

---

## Error Handling

### Connection Errors

```typescript
try {
  const response = await provider.chatStream(messages, options);
} catch (error) {
  if (error.code === 'ECONNREFUSED') {
    throw new Error('Ollama server is not running. Start it with: ollama serve');
  }
  throw error;
}
```

### Model Not Found

```typescript
try {
  const modelInfo = await provider.getModelInfo(modelId);
} catch (error) {
  if (error.status === 404) {
    throw new Error(`Model ${modelId} not found. Pull it with: ollama pull ${modelId}`);
  }
  throw error;
}
```

### Stream Errors

```typescript
for await (const event of provider.chatStream(messages, options)) {
  if (event.type === 'error') {
    console.error('Stream error:', event.error);
    // Handle error (retry, fallback, etc.)
  }
}
```

---

## Best Practices

### 1. Provider Selection

- Use Ollama for local development (v0.1.0)
- Future: Choose provider based on use case
  - Codex for code generation (v0.6.0)
  - Claude for reasoning tasks (v0.6.0)
  - vLLM for production deployments (v0.9.0)

### 2. Error Handling

- Always check provider health before use
- Handle connection errors gracefully
- Provide clear error messages to users
- Implement retry logic for transient failures

### 3. Stream Processing

- Process stream events as they arrive
- Handle partial messages correctly
- Detect stream completion
- Clean up resources on error

### 4. Context Window Management

- Query provider for context window size
- Adjust context based on provider limits
- Monitor token usage during streaming
- Trigger compression when needed

---

## Troubleshooting

### Ollama Not Running

**Symptom:** Connection refused error

**Solution:**

**If auto-start is enabled:**

```bash
# Check if ollama process is running
ps aux | grep ollama

# Check app logs for startup errors
# The app should have started ollama automatically
```

**If auto-start is disabled:**

```bash
# Start Ollama server manually
ollama serve

# Or enable auto-start
/config ollama autostart on
```

**Check connection:**

```bash
curl http://localhost:11434/api/tags
```

**Custom server:**

```bash
# If using custom host/port
/config ollama host your-server.com
/config ollama port 11434
```

### Model Not Found

**Symptom:** 404 error when loading model

**Solution:**

```bash
# Pull the model
ollama pull llama3.2:3b

# List available models
ollama list
```

### Stream Parsing Errors

**Symptom:** Invalid JSON errors during streaming

**Solution:**

1. Check Ollama version (update if needed)
2. Verify model is compatible
3. Check for network issues
4. Review stream buffer handling

---

## File Locations

| File                                                   | Purpose              |
| ------------------------------------------------------ | -------------------- |
| `packages/core/src/provider/types.ts`                  | Provider interfaces  |
| `packages/core/src/provider/registry.ts`               | Provider registry    |
| `packages/ollm-bridge/src/provider/localProvider.ts`   | Ollama adapter       |
| `packages/ollm-bridge/src/adapters/sseParser.ts`       | SSE parsing (future) |
| `packages/cli/src/config/LLM_profiles.json`            | Model profiles       |
| `packages/core/src/services/modelManagementService.ts` | Model management     |

---

**Note:** This document focuses on the current Ollama provider implementation. For upcoming providers, see `.kiro/specs/v0.6.0 Release Kraken` and `.kiro/specs/v0.9.0 vLLM-LMS Providers`.
