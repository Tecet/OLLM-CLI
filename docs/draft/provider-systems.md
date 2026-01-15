# Provider Systems in OLLM CLI

This document explains how all three provider tiers integrate with OLLM CLI, including the abstraction layer, data flow, and implementation differences.

---

## Overview: 3-Tier Provider Strategy

| Tier | Provider | Backend(s) | Use Case |
|------|----------|------------|----------|
| **1** | `LocalProvider` | Ollama | ✅ Default - Easy setup, model management |
| **2** | `VllmProvider` | vLLM | Production - High-performance inference |
| **3** | `OpenAICompatibleProvider` | LM Studio, LocalAI, Kobold, etc. | Universal - Any OpenAI-compatible API |

---

## 1. The Provider Abstraction Layer

OLLM CLI uses a **provider-agnostic architecture** where the core chat runtime doesn't know (or care) which LLM backend is being used. This is achieved through the `ProviderAdapter` interface.

### The Core Interface

```typescript
// packages/core/src/provider/types.ts

interface ProviderAdapter {
  /** Unique name for this provider */
  name: string;

  /** Stream chat completion from the provider */
  chatStream(request: ProviderRequest): AsyncIterable<ProviderEvent>;

  /** Count tokens in a request (optional) */
  countTokens?(request: ProviderRequest): Promise<number>;

  /** List available models (optional) */
  listModels?(): Promise<ModelInfo[]>;

  /** Pull/download a model (optional) */
  pullModel?(name: string, onProgress?: (p: PullProgress) => void): Promise<void>;

  /** Delete a model (optional) */
  deleteModel?(name: string): Promise<void>;

  /** Get detailed info about a model (optional) */
  showModel?(name: string): Promise<ModelInfo>;
}
```

**Key insight**: Any LLM backend can be supported as long as it implements this interface. The core runtime only interacts with this abstraction.

---

## 2. The Provider Registry

The `ProviderRegistry` is a central registry that manages all available providers:

```typescript
// packages/core/src/provider/registry.ts

class ProviderRegistry {
  private providers: Map<string, ProviderAdapter>;
  private defaultProviderName?: string;

  register(adapter: ProviderAdapter): void;   // Add a provider
  get(name: string): ProviderAdapter;         // Get by name
  setDefault(name: string): void;             // Set default
  getDefault(): ProviderAdapter;              // Get default
  list(): string[];                           // List all names
}
```

### How it's used at startup:

```typescript
// Pseudocode showing CLI initialization

const registry = new ProviderRegistry();

// Tier 1: Register Ollama provider (default)
registry.register(new LocalProvider({ 
  baseUrl: 'http://localhost:11434' 
}));

// Tier 2: Register vLLM provider
registry.register(new VllmProvider({ 
  baseUrl: 'http://localhost:8000' 
}));

// Tier 3: Register OpenAI-compatible provider (for LM Studio, LocalAI, etc.)
registry.register(new OpenAICompatibleProvider({ 
  baseUrl: 'http://localhost:1234',  // LM Studio default
  backend: 'lmstudio'
}));

// Set default based on config
registry.setDefault(config.provider); // 'local', 'vllm', or 'openai-compatible'
```

---

## 3. Complete Request Flow

Here's how a user message flows through the system with all three provider tiers:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              USER INPUT                                      │
│                        "Explain TypeScript generics"                         │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         CLI PACKAGE (packages/cli)                           │
│                                                                              │
│  1. User types message in terminal UI (React + Ink)                         │
│  2. Input handler captures the message                                       │
│  3. Creates a ProviderRequest object                                         │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        CORE PACKAGE (packages/core)                          │
│                                                                              │
│  4. ChatClient receives the request                                          │
│  5. Adds system prompt and context                                           │
│  6. Attaches available tools (if enabled)                                    │
│  7. Gets provider from ProviderRegistry                                      │
│  8. Calls provider.chatStream(request)                                       │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
           ┌────────────────────────┼────────────────────────┐
           │                        │                        │
           ▼                        ▼                        ▼
┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────────┐
│   LocalProvider     │  │   VllmProvider      │  │ OpenAICompatible    │
│   (Tier 1: Ollama)  │  │   (Tier 2: vLLM)    │  │ (Tier 3: Universal) │
│                     │  │                     │  │                     │
│ POST /api/chat      │  │ POST /v1/chat/...   │  │ POST /v1/chat/...   │
│ Format: NDJSON      │  │ Format: SSE         │  │ Format: SSE         │
└─────────────────────┘  └─────────────────────┘  └─────────────────────┘
           │                        │                        │
           ▼                        ▼                        ▼
┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────────┐
│   Ollama Server     │  │   vLLM Server       │  │   LM Studio /       │
│   localhost:11434   │  │   localhost:8000    │  │   LocalAI / etc.    │
└─────────────────────┘  └─────────────────────┘  └─────────────────────┘
           │                        │                        │
           └────────────────────────┼────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         UNIFIED ProviderEvent STREAM                         │
│                                                                              │
│  ALL providers emit the SAME event types:                                    │
│  • { type: 'text', value: 'Generics allow you to...' }                      │
│  • { type: 'tool_call', value: { name: 'read_file', args: {...} } }         │
│  • { type: 'finish', reason: 'stop' }                                        │
│  • { type: 'error', error: { message: '...' } }                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              TERMINAL UI                                     │
│                                                                              │
│  User sees: "Generics allow you to create reusable components..."           │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Tier 1: LocalProvider (Ollama)

**Status**: ✅ Implemented

### Why Ollama is Default

- **Simplest setup**: Single binary, runs anywhere
- **Best model management**: Pull, delete, switch models at runtime
- **Great UX**: Works offline, fast startup
- **Cross-platform**: Windows, macOS, Linux
- **Apple Silicon**: Excellent M1/M2/M3 optimization

### API Endpoints

| Operation | Endpoint | Method |
|-----------|----------|--------|
| Chat completion | `/api/chat` | POST |
| List models | `/api/tags` | GET |
| Pull model | `/api/pull` | POST |
| Delete model | `/api/delete` | DELETE |
| Show model info | `/api/show` | POST |

### Request Format

```typescript
// What LocalProvider sends to Ollama
const request = {
  model: "llama3.2:3b",
  messages: [
    { role: "system", content: "You are a helpful assistant..." },
    { role: "user", content: "Explain TypeScript generics" }
  ],
  tools: [
    {
      type: "function",
      function: {
        name: "read_file",
        description: "Read a file from disk",
        parameters: { /* JSON Schema */ }
      }
    }
  ],
  options: {
    temperature: 0.7,
    num_predict: 4096  // Ollama-specific: max tokens
  },
  stream: true
};
```

### Response Format (NDJSON Stream)

```json
{"message":{"role":"assistant","content":"Generics"},"done":false}
{"message":{"role":"assistant","content":" are"},"done":false}
{"message":{"role":"assistant","content":" a powerful"},"done":false}
{"message":{"role":"assistant","content":""},"done":true,"done_reason":"stop"}
```

---

## 5. Tier 2: VllmProvider (vLLM)

**Status**: 🔲 Planned

### Why vLLM for Production

- **Maximum performance**: Continuous batching, PagedAttention
- **High throughput**: Optimized for serving many users
- **Distributed inference**: Multi-GPU support
- **Production-grade**: Used by major companies
- **vLLM-specific features**: Guided decoding, speculative decoding

### API Endpoints (OpenAI Format)

| Operation | Endpoint | Method |
|-----------|----------|--------|
| Chat completion | `/v1/chat/completions` | POST |
| List models | `/v1/models` | GET |
| Pull model | ❌ Not supported | - |
| Delete model | ❌ Not supported | - |

### Request Format

```typescript
// What VllmProvider sends to vLLM (OpenAI format)
const request = {
  model: "meta-llama/Llama-2-7b-chat-hf",
  messages: [
    { role: "system", content: "You are a helpful assistant..." },
    { role: "user", content: "Explain TypeScript generics" }
  ],
  temperature: 0.7,
  max_tokens: 4096,
  stream: true
};
```

### Response Format (SSE Stream)

```
data: {"choices":[{"delta":{"content":"Generics"}}]}
data: {"choices":[{"delta":{"content":" are"}}]}
data: {"choices":[{"delta":{"content":" a powerful"}}]}
data: [DONE]
```

### vLLM-Specific Features

```typescript
// Extra options available with vLLM
const extraBody = {
  guided_json: { /* JSON schema for structured output */ },
  guided_regex: "^[A-Z][a-z]+$",
  guided_choice: ["option1", "option2", "option3"],
  min_tokens: 100,
  best_of: 3,
  use_beam_search: true
};
```

---

## 6. Tier 3: OpenAICompatibleProvider (Universal)

**Status**: 🔲 Planned

### Why a Universal Provider

Many LLM backends implement the OpenAI API format. Instead of creating a separate provider for each, one universal provider handles them all:

### Supported Backends

| Backend | Default URL | Notes |
|---------|-------------|-------|
| **LM Studio** | `http://localhost:1234` | Desktop app, easy setup |
| **LocalAI** | `http://localhost:8080` | Docker-based, feature-rich |
| **text-generation-webui** | `http://localhost:5000` | Popular web UI |
| **Kobold.cpp** | `http://localhost:5001` | GGML/GGUF focused |
| **llama.cpp server** | `http://localhost:8080` | Lightweight, CLI |
| **Aphrodite** | `http://localhost:2242` | vLLM fork with extras |
| **TabbyAPI** | `http://localhost:5000` | ExLlamaV2 backend |
| **FastChat** | `http://localhost:8000` | Multi-model serving |

### Configuration

```yaml
# ~/.ollm/config.yaml

provider: openai-compatible

providers:
  openai-compatible:
    baseUrl: http://localhost:1234    # LM Studio
    apiKey: ""                         # Optional
    backend: lmstudio                  # Hint for quirks
```

### Backend-Specific Quirks

The provider handles differences automatically:

```typescript
class OpenAICompatibleProvider {
  private getHeaders(): Record<string, string> {
    const headers = { 'Content-Type': 'application/json' };
    
    if (this.config.backend === 'lmstudio') {
      // LM Studio uses different auth header
      headers['X-API-Key'] = this.config.apiKey || '';
    } else if (this.config.apiKey) {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`;
    }
    
    return headers;
  }
}
```

---

## 7. Comparison Matrix

| Feature | Tier 1: Ollama | Tier 2: vLLM | Tier 3: Universal |
|---------|----------------|--------------|-------------------|
| **Streaming format** | NDJSON | SSE | SSE |
| **Default port** | 11434 | 8000 | Varies |
| **Tool calling** | ✅ Native | ⚠️ Model-dependent | ⚠️ Backend-dependent |
| **Model listing** | ✅ `/api/tags` | ✅ `/v1/models` | ⚠️ May not exist |
| **Model pull** | ✅ Yes | ❌ No | ❌ No |
| **Model delete** | ✅ Yes | ❌ No | ❌ No |
| **API key auth** | ❌ No | ✅ Optional | ✅ Optional |
| **Setup complexity** | Low | Medium | Low-Medium |
| **Performance** | Good | Excellent | Varies |
| **Special features** | Model management | Guided decoding | Universal compat |

---

## 8. When to Use Which

### Use Tier 1 (Ollama) When:

- ✅ You want easy model management (pull, delete, switch)
- ✅ You're running on consumer hardware
- ✅ You need quick experimentation with different models
- ✅ You prefer a simple setup process
- ✅ You're on macOS (excellent Apple Silicon support)

### Use Tier 2 (vLLM) When:

- ✅ You need maximum throughput and performance
- ✅ You're running in production environments
- ✅ You have dedicated GPU servers
- ✅ You want vLLM-specific features (guided decoding)
- ✅ You need distributed inference across multiple GPUs

### Use Tier 3 (OpenAI-Compatible) When:

- ✅ You already use LM Studio, LocalAI, or another compatible server
- ✅ You want to use a specific backend not directly supported
- ✅ You need OpenAI API compatibility for testing
- ✅ You're integrating with existing infrastructure

---

## 9. Configuration Examples

### Tier 1: Ollama (Default)

```yaml
# ~/.ollm/config.yaml
provider: local
model: llama3.2:3b
```

```bash
ollm -p "Hello world"
```

### Tier 2: vLLM

```yaml
# ~/.ollm/config.yaml
provider: vllm
providers:
  vllm:
    baseUrl: http://gpu-server:8000
    apiKey: ${VLLM_API_KEY}
model: meta-llama/Llama-2-7b-chat-hf
```

```bash
ollm --provider vllm --host http://gpu-server:8000 -p "Hello world"
```

### Tier 3: LM Studio

```yaml
# ~/.ollm/config.yaml
provider: openai-compatible
providers:
  openai-compatible:
    baseUrl: http://localhost:1234
    backend: lmstudio
model: local-model
```

```bash
ollm --provider openai-compatible --host http://localhost:1234 -p "Hello world"
```

### Tier 3: LocalAI

```yaml
# ~/.ollm/config.yaml
provider: openai-compatible
providers:
  openai-compatible:
    baseUrl: http://localhost:8080
    backend: localai
model: gpt-3.5-turbo
```

---

## 10. Code Example: Using All Three

```typescript
import { ProviderRegistry } from '@ollm/core';
import { 
  LocalProvider, 
  VllmProvider, 
  OpenAICompatibleProvider 
} from '@ollm/ollm-bridge';

// Initialize registry
const registry = new ProviderRegistry();

// Tier 1: Ollama (default)
registry.register(new LocalProvider({ 
  baseUrl: 'http://localhost:11434' 
}));

// Tier 2: vLLM (production)
registry.register(new VllmProvider({ 
  baseUrl: 'http://localhost:8000',
  apiKey: process.env.VLLM_API_KEY 
}));

// Tier 3: LM Studio (universal)
registry.register(new OpenAICompatibleProvider({ 
  baseUrl: 'http://localhost:1234',
  backend: 'lmstudio'
}));

// Set default
registry.setDefault('local');

// Same code works with ANY provider!
async function chat(providerName: string, prompt: string) {
  const provider = registry.get(providerName)!;
  
  for await (const event of provider.chatStream({
    model: 'llama3.2:3b',
    messages: [{ role: 'user', parts: [{ type: 'text', text: prompt }] }],
  })) {
    if (event.type === 'text') {
      process.stdout.write(event.value);
    }
  }
}

// All three work identically!
await chat('local', "Hello from Ollama!");
await chat('vllm', "Hello from vLLM!");
await chat('openai-compatible', "Hello from LM Studio!");
```

---

## 11. Summary

The 3-tier provider strategy enables maximum flexibility:

1. **Tier 1 (Ollama)**: Best for development and experimentation
2. **Tier 2 (vLLM)**: Best for production and performance
3. **Tier 3 (Universal)**: Best for compatibility with existing setups

All three tiers:
- Implement the same `ProviderAdapter` interface
- Emit the same `ProviderEvent` types
- Work seamlessly with OLLM CLI's tools, hooks, and UI

This design allows OLLM CLI to support virtually any LLM backend without changing the core chat logic.