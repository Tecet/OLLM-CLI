# Model Management Service API

**Complete API Reference**

---

## Overview

The Model Management Service handles model lifecycle operations including listing, pulling, deleting, and keeping models loaded.

**File:** `packages/core/src/services/modelManagementService.ts`

---

## Constructor

```typescript
constructor(provider: ProviderAdapter, options?: ModelManagementOptions)
```

**Parameters:**
- `provider`: Provider adapter (Ollama, vLLM, OpenAI-compatible)
- `options`: Optional configuration

**Options:**
```typescript
interface ModelManagementOptions {
  cacheTTL?: number;        // Cache TTL in seconds (default: 60)
  keepAlive?: number;       // Keep-alive timeout in seconds (default: 300)
  autoPull?: boolean;       // Auto-pull missing models (default: false)
}
```

---

## Methods

### listModels()

List all available models with caching.

```typescript
async listModels(options?: ListOptions): Promise<Model[]>
```

**Parameters:**
- `options.skipCache`: Skip cache and fetch fresh data

**Returns:** Array of models

**Example:**
```typescript
const models = await service.listModels();
console.log(`Found ${models.length} models`);
```

**Caching:**
- Results cached for 60 seconds (configurable)
- Cache invalidated on pull/delete operations
- Use `skipCache: true` to force refresh

---

### pullModel()

Download a model with progress tracking.

```typescript
async pullModel(
  name: string,
  onProgress?: ProgressCallback,
  options?: PullOptions
): Promise<void>
```

**Parameters:**
- `name`: Model name (e.g., 'llama3.1:8b')
- `onProgress`: Progress callback
- `options.signal`: AbortSignal for cancellation

**Progress Callback:**
```typescript
type ProgressCallback = (progress: {
  status: string;
  percent: number;
  completed: number;
  total: number;
}) => void;
```

**Example:**
```typescript
await service.pullModel('llama3.1:8b', (progress) => {
  console.log(`${progress.status}: ${progress.percent}%`);
});
```

**Errors:**
- `MODEL_NOT_FOUND`: Model doesn't exist
- `NETWORK_ERROR`: Network failure
- `DISK_FULL`: Insufficient disk space

---

### deleteModel()

Delete a model (unloads first if loaded).

```typescript
async deleteModel(name: string): Promise<void>
```

**Parameters:**
- `name`: Model name to delete

**Example:**
```typescript
await service.deleteModel('old-model:7b');
```

**Behavior:**
- Automatically unloads model if loaded
- Invalidates cache
- Throws if model doesn't exist

---

### showModel()

Get detailed model information.

```typescript
async showModel(name: string): Promise<ModelDetails>
```

**Parameters:**
- `name`: Model name

**Returns:**
```typescript
interface ModelDetails {
  name: string;
  size: number;
  digest: string;
  modified: Date;
  details: {
    format: string;
    family: string;
    families: string[];
    parameter_size: string;
    quantization_level: string;
  };
  modelfile: string;
  parameters: Record<string, any>;
  template: string;
}
```

**Example:**
```typescript
const details = await service.showModel('llama3.1:8b');
console.log(`Size: ${details.size} bytes`);
console.log(`Family: ${details.details.family}`);
```

---

### keepModelLoaded()

Keep a model loaded in memory.

```typescript
async keepModelLoaded(name: string, timeout?: number): Promise<void>
```

**Parameters:**
- `name`: Model name
- `timeout`: Keep-alive timeout in seconds (default: 300)

**Example:**
```typescript
// Keep loaded for 10 minutes
await service.keepModelLoaded('llama3.1:8b', 600);
```

**Special Values:**
- `0`: Unload immediately
- `-1`: Keep loaded indefinitely

---

### unloadModel()

Unload a model from memory.

```typescript
async unloadModel(name: string): Promise<void>
```

**Parameters:**
- `name`: Model name

**Example:**
```typescript
await service.unloadModel('llama3.1:8b');
```

---

### getLoadedModels()

Get list of currently loaded models.

```typescript
async getLoadedModels(): Promise<LoadedModel[]>
```

**Returns:**
```typescript
interface LoadedModel {
  name: string;
  size: number;
  lastUsed: Date;
  keepAlive: number;
}
```

**Example:**
```typescript
const loaded = await service.getLoadedModels();
console.log(`${loaded.length} models loaded`);
```

---

### invalidateCache()

Manually invalidate the model list cache.

```typescript
invalidateCache(): void
```

**Example:**
```typescript
service.invalidateCache();
const models = await service.listModels(); // Fresh data
```

---

## Events

The service emits events for monitoring:

```typescript
service.on('model:pulled', (name: string) => {
  console.log(`Model pulled: ${name}`);
});

service.on('model:deleted', (name: string) => {
  console.log(`Model deleted: ${name}`);
});

service.on('model:loaded', (name: string) => {
  console.log(`Model loaded: ${name}`);
});

service.on('model:unloaded', (name: string) => {
  console.log(`Model unloaded: ${name}`);
});

service.on('cache:invalidated', () => {
  console.log('Cache invalidated');
});
```

---

## Error Handling

```typescript
try {
  await service.pullModel('llama3.1:8b');
} catch (error) {
  switch (error.code) {
    case 'MODEL_NOT_FOUND':
      console.error('Model not found in registry');
      break;
    case 'NETWORK_ERROR':
      console.error('Network connection failed');
      break;
    case 'DISK_FULL':
      console.error('Insufficient disk space');
      break;
    case 'PERMISSION_DENIED':
      console.error('Permission denied');
      break;
    default:
      console.error('Unknown error:', error.message);
  }
}
```

---

## Complete Example

```typescript
import { ModelManagementService } from '@ollm/ollm-cli-core';
import { OllamaProvider } from '@ollm/ollm-bridge';

// Create service
const provider = new OllamaProvider();
const service = new ModelManagementService(provider, {
  cacheTTL: 120,
  keepAlive: 600,
  autoPull: false
});

// List models
const models = await service.listModels();
console.log(`Available models: ${models.length}`);

// Pull model with progress
await service.pullModel('llama3.1:8b', (progress) => {
  console.log(`${progress.status}: ${progress.percent}%`);
});

// Keep model loaded
await service.keepModelLoaded('llama3.1:8b', 600);

// Get loaded models
const loaded = await service.getLoadedModels();
console.log(`Loaded models: ${loaded.map(m => m.name).join(', ')}`);

// Delete old model
await service.deleteModel('old-model:7b');
```

---

## See Also

- [Model Router API](model-router.md)
- [Commands Reference](../Models_commands.md)
- [Configuration](../Models_configuration.md)

---

**Document Version:** 1.0  
**Last Updated:** 2026-01-16
