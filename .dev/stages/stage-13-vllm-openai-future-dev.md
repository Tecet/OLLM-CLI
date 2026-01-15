# Stage 10: Future Development - Multi-Provider Support

**Goal**: Expand OLLM CLI to support multiple LLM backends with a 3-tier provider strategy.

**Prerequisites**: Stages 01-09 complete (core functionality stable)

**Estimated Effort**: 5-7 days

---

## Overview

This stage extends OLLM CLI's provider system to support three categories of LLM backends:

| Tier | Provider | Backend | Priority |
|------|----------|---------|----------|
| **1** | `LocalProvider` | Ollama | ✅ Default (exists) |
| **2** | `VllmProvider` | vLLM | High-performance production |
| **3** | `OpenAICompatibleProvider` | LM Studio, LocalAI, Kobold, etc. | Universal fallback |

---

## Provider Strategy

### Tier 1: Ollama (Default) - `LocalProvider`

**Status**: ✅ Already implemented

**File**: `packages/ollm-bridge/src/provider/localProvider.ts`

**Why default**:
- Simplest setup (single binary)
- Best model management (pull, delete, switch at runtime)
- Excellent cross-platform support (Windows, macOS, Linux)
- Active development and community
- Apple Silicon optimization

**API Format**: Ollama native (`/api/chat`, `/api/tags`, etc.)

---

### Tier 2: vLLM (Production) - `VllmProvider`

**Status**: 🔲 To be implemented

**File**: `packages/ollm-bridge/src/provider/vllmProvider.ts` (NEW)

**Why dedicated provider**:
- Maximum throughput and performance
- vLLM-specific features (guided decoding, speculative decoding)
- Production-grade deployment
- Distributed inference support
- Continuous batching

**API Format**: OpenAI-compatible (`/v1/chat/completions`)

**vLLM-Specific Features**:
```typescript
interface VllmExtraOptions {
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
```

---

### Tier 3: OpenAI-Compatible (Universal) - `OpenAICompatibleProvider`

**Status**: 🔲 To be implemented

**File**: `packages/ollm-bridge/src/provider/openaiCompatibleProvider.ts` (NEW)

**Why universal provider**:
- Single implementation covers many backends
- Users can bring any OpenAI-compatible server
- Future-proof for new backends

**Supported Backends**:

| Backend | URL | Notes |
|---------|-----|-------|
| LM Studio | `http://localhost:1234` | Desktop app, easy setup |
| LocalAI | `http://localhost:8080` | Docker-based, feature-rich |
| text-generation-webui | `http://localhost:5000` | Popular web UI |
| Kobold.cpp | `http://localhost:5001` | GGML/GGUF focused |
| llama.cpp server | `http://localhost:8080` | Lightweight, CLI |
| Aphrodite | `http://localhost:2242` | vLLM fork with extras |
| TabbyAPI | `http://localhost:5000` | ExLlamaV2 backend |
| FastChat | `http://localhost:8000` | Multi-model serving |

**API Format**: Standard OpenAI (`/v1/chat/completions`, `/v1/models`)

---

## Code Changes Required

### Files to Modify

#### 1. `packages/ollm-bridge/src/index.ts`

**Current**:
```typescript
export { LocalProvider, LocalProviderConfig } from './provider/localProvider.js';
```

**After**:
```typescript
export { LocalProvider, LocalProviderConfig } from './provider/localProvider.js';
export { VllmProvider, VllmProviderConfig } from './provider/vllmProvider.js';
export { OpenAICompatibleProvider, OpenAICompatibleProviderConfig } from './provider/openaiCompatibleProvider.js';
```

---

#### 2. `packages/core/src/provider/types.ts`

**Add streaming format hint** (for provider detection):

```diff
 export interface ProviderAdapter {
   name: string;
+  streamingFormat?: 'ndjson' | 'sse';  // Hint for parsers
   chatStream(request: ProviderRequest): AsyncIterable<ProviderEvent>;
   // ... rest unchanged
 }
```

**Extend GenerationOptions** for provider-specific features:

```diff
 export interface GenerationOptions {
   temperature?: number;
   maxTokens?: number;
   topP?: number;
   topK?: number;
   repeatPenalty?: number;
   seed?: number;
+  extraBody?: Record<string, unknown>;  // Provider-specific options
 }
```

---

#### 3. `packages/core/src/provider/registry.ts`

**Add auto-detection capability**:

```diff
 export class ProviderRegistry {
   private providers: Map<string, ProviderAdapter>;
   private defaultProviderName?: string;
+  private providerAliases: Map<string, string>;  // 'lmstudio' -> 'openai-compatible'

   constructor() {
     this.providers = new Map();
+    this.providerAliases = new Map();
   }

+  registerAlias(alias: string, providerName: string): void {
+    this.providerAliases.set(alias, providerName);
+  }

+  resolve(nameOrAlias: string): ProviderAdapter | undefined {
+    const resolved = this.providerAliases.get(nameOrAlias) || nameOrAlias;
+    return this.providers.get(resolved);
+  }
 }
```

---

#### 4. CLI Configuration Schema

**Update**: `schemas/settings.schema.json`

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
            "baseUrl": { "type": "string", "default": "http://localhost:11434" }
          }
        },
        "vllm": {
          "type": "object",
          "properties": {
            "baseUrl": { "type": "string", "default": "http://localhost:8000" },
            "apiKey": { "type": "string" }
          }
        },
        "openai-compatible": {
          "type": "object",
          "properties": {
            "baseUrl": { "type": "string", "default": "http://localhost:1234" },
            "apiKey": { "type": "string" },
            "backend": { 
              "type": "string",
              "enum": ["lmstudio", "localai", "kobold", "llamacpp", "generic"]
            }
          }
        }
      }
    }
  }
}
```

---

#### 5. Environment Variable Updates

**Add to**: `packages/cli/src/config/env.ts`

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

---

## New Files to Create

### 1. `packages/ollm-bridge/src/provider/vllmProvider.ts`

```typescript
/**
 * vLLM Provider Adapter
 * High-performance inference with vLLM-specific features
 */

export interface VllmProviderConfig {
  baseUrl: string;          // Default: http://localhost:8000
  apiKey?: string;          // Optional API key
  timeout?: number;         // Request timeout
}

export class VllmProvider implements ProviderAdapter {
  readonly name = 'vllm';
  readonly streamingFormat = 'sse';

  constructor(private config: VllmProviderConfig) {}

  async *chatStream(request: ProviderRequest): AsyncIterable<ProviderEvent> {
    // Implementation with SSE parsing
    // POST to /v1/chat/completions
  }

  async listModels(): Promise<ModelInfo[]> {
    // GET /v1/models
  }

  // vLLM-specific methods
  async getServerInfo(): Promise<VllmServerInfo> {
    // GET /version or /health
  }
}
```

---

### 2. `packages/ollm-bridge/src/provider/openaiCompatibleProvider.ts`

```typescript
/**
 * Universal OpenAI-Compatible Provider Adapter
 * Works with LM Studio, LocalAI, Kobold, llama.cpp, etc.
 */

export interface OpenAICompatibleProviderConfig {
  baseUrl: string;          // Server URL
  apiKey?: string;          // Optional API key
  timeout?: number;         // Request timeout
  backend?: string;         // Hint: 'lmstudio', 'localai', 'kobold', 'generic'
}

export class OpenAICompatibleProvider implements ProviderAdapter {
  readonly name = 'openai-compatible';
  readonly streamingFormat = 'sse';

  constructor(private config: OpenAICompatibleProviderConfig) {}

  async *chatStream(request: ProviderRequest): AsyncIterable<ProviderEvent> {
    // Standard OpenAI format
    // POST to /v1/chat/completions
  }

  async listModels(): Promise<ModelInfo[]> {
    // GET /v1/models (if supported)
  }

  // Backend-specific quirks handled internally
  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    if (this.config.apiKey) {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`;
    }
    
    // LM Studio uses different auth header
    if (this.config.backend === 'lmstudio') {
      headers['X-API-Key'] = this.config.apiKey || '';
    }
    
    return headers;
  }
}
```

---

### 3. `packages/ollm-bridge/src/utils/sseParser.ts`

**Shared SSE parsing utility** (used by both vLLM and OpenAI-compatible):

```typescript
/**
 * Parse Server-Sent Events stream
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
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      
      const data = line.slice(6).trim();
      if (data === '[DONE]') return;
      
      try {
        yield JSON.parse(data);
      } catch {
        // Skip malformed JSON
      }
    }
  }
}
```

---

## Feature Comparison Matrix

| Feature | LocalProvider | VllmProvider | OpenAICompatibleProvider |
|---------|---------------|--------------|--------------------------|
| **Streaming format** | NDJSON | SSE | SSE |
| **Default port** | 11434 | 8000 | Varies |
| **Tool calling** | ✅ Native | ⚠️ Model-dependent | ⚠️ Backend-dependent |
| **Model listing** | ✅ `/api/tags` | ✅ `/v1/models` | ⚠️ May not exist |
| **Model pull** | ✅ Yes | ❌ No | ❌ No |
| **Model delete** | ✅ Yes | ❌ No | ❌ No |
| **API key auth** | ❌ No | ✅ Optional | ✅ Optional |
| **Guided decoding** | ❌ No | ✅ Yes | ❌ No |
| **Vision/Images** | ✅ Some models | ⚠️ Model-dependent | ⚠️ Backend-dependent |
| **Setup complexity** | Low | Medium | Low-Medium |
| **Performance** | Good | Excellent | Varies |

---

## Benefits

### For Users

1. **Choice**: Pick the best backend for their use case
2. **Flexibility**: Switch providers without code changes
3. **Future-proof**: New backends automatically supported via Tier 3
4. **Performance options**: Development (Ollama) vs Production (vLLM)

### For the Project

1. **Clean architecture**: Provider abstraction already exists
2. **Minimal core changes**: Only bridge package needs new files
3. **Shared utilities**: SSE parser reused across providers
4. **Testability**: Each provider can be unit tested independently

---

## Tasks

| ID | Task | Deliverables | Effort |
|----|------|--------------|--------|
| S10-T01 | Create SSE parser utility | `sseParser.ts` | 0.5 day |
| S10-T02 | Implement VllmProvider | `vllmProvider.ts`, tests | 1.5 days |
| S10-T03 | Implement OpenAICompatibleProvider | `openaiCompatibleProvider.ts`, tests | 1.5 days |
| S10-T04 | Update configuration schema | `settings.schema.json` | 0.5 day |
| S10-T05 | Add CLI provider flags | `--provider`, `--host`, `--api-key` | 0.5 day |
| S10-T06 | Update provider registry | Aliases, auto-detection | 0.5 day |
| S10-T07 | Write documentation | Provider guides, examples | 1 day |
| S10-T08 | Integration testing | Test with real servers | 1 day |

---

## Configuration Examples

### Using Ollama (Default)

```yaml
# ~/.ollm/config.yaml
provider: local
model: llama3.2:3b
```

```bash
ollm -p "Hello world"
# Uses Ollama at localhost:11434
```

---

### Using vLLM

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

---

### Using LM Studio

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

---

### Using LocalAI

```yaml
# ~/.ollm/config.yaml
provider: openai-compatible
providers:
  openai-compatible:
    baseUrl: http://localhost:8080
    backend: localai
model: gpt-3.5-turbo  # LocalAI model alias
```

---

## Risk Considerations

1. **Backend Quirks**: Each backend has subtle API differences
2. **Feature Detection**: Not all backends support all features
3. **Error Messages**: Different backends return different error formats
4. **Testing Coverage**: Need test instances of each backend
5. **Documentation Burden**: Each backend needs setup guides

---

## Acceptance Criteria

- [ ] SSE parser handles all edge cases
- [ ] VllmProvider streams responses correctly
- [ ] OpenAICompatibleProvider works with LM Studio
- [ ] OpenAICompatibleProvider works with LocalAI
- [ ] Provider can be selected via config or CLI flag
- [ ] Tool calling works where supported
- [ ] Model listing works where supported
- [ ] Clear error messages for unsupported operations
- [ ] Documentation covers all three tiers

---

## Related Documentation

- [Architecture Overview](../../docs/architecture.md)
- [Provider Types](../../packages/core/src/provider/types.ts)
- [Existing LocalProvider](../../packages/ollm-bridge/src/provider/localProvider.ts)
