# Model Management API Reference

**Complete API Documentation**

This directory contains API reference documentation for all Model Management services.

---

## Services

### Core Services

1. **[Model Management Service](model-management-service.md)**
   - List, pull, delete, inspect models
   - Keep-alive management
   - Cache management

2. **[Model Router](model-router.md)**
   - Intelligent model selection
   - Profile-based routing
   - Fallback handling

3. **[Memory Service](memory-service.md)**
   - CRUD operations
   - System prompt injection
   - Search and filtering

4. **[Template Service](template-service.md)**
   - Template loading and parsing
   - Variable substitution
   - CRUD operations

5. **[Project Profile Service](project-profile-service.md)**
   - Project type detection
   - Profile application
   - Configuration management

---

## Quick Reference

### Model Management Service

```typescript
// List models
const models = await modelMgmt.listModels();

// Pull model
await modelMgmt.pullModel('llama3.1:8b', (progress) => {
  console.log(`${progress.percent}%`);
});

// Delete model
await modelMgmt.deleteModel('old-model:7b');

// Keep alive
await modelMgmt.keepModelLoaded('llama3.1:8b');
```

### Model Router

```typescript
// Select model for task
const model = await router.selectModel({
  profile: 'code',
  minContextWindow: 8192,
  requiredCapabilities: ['tools']
});
```

### Memory Service

```typescript
// Remember
await memory.remember('user_name', 'Alice', {
  category: 'fact',
  source: 'user'
});

// Recall
const value = await memory.recall('user_name');

// Search
const results = await memory.search('project');

// Inject into prompt
const addition = await memory.getSystemPromptAddition(500);
```

### Template Service

```typescript
// Load templates
await templates.loadTemplates();

// Get template
const template = await templates.getTemplate('code_review');

// Substitute variables
const prompt = await templates.substitute(template, {
  language: 'TypeScript',
  code: '...'
});
```

### Project Profile Service

```typescript
// Detect project type
const type = await profiles.detectProfile('/path/to/project');

// Load profile
const profile = await profiles.loadProfile('/path/to/project');

// Apply profile
await profiles.applyProfile(profile);
```

---

## Common Patterns

### Error Handling

```typescript
try {
  await modelMgmt.pullModel('llama3.1:8b');
} catch (error) {
  if (error.code === 'MODEL_NOT_FOUND') {
    console.error('Model not found');
  } else if (error.code === 'NETWORK_ERROR') {
    console.error('Network error');
  } else {
    console.error('Unknown error:', error);
  }
}
```

### Progress Tracking

```typescript
await modelMgmt.pullModel('llama3.1:8b', (progress) => {
  console.log(`Progress: ${progress.percent}%`);
  console.log(`Downloaded: ${progress.completed}/${progress.total} bytes`);
  console.log(`Status: ${progress.status}`);
});
```

### Cancellation

```typescript
const controller = new AbortController();

// Start operation
const promise = modelMgmt.pullModel('llama3.1:8b', null, {
  signal: controller.signal
});

// Cancel after 5 seconds
setTimeout(() => controller.abort(), 5000);

try {
  await promise;
} catch (error) {
  if (error.name === 'AbortError') {
    console.log('Operation cancelled');
  }
}
```

---

## Type Definitions

### Model

```typescript
interface Model {
  name: string;
  size: number;
  digest: string;
  modified: Date;
  details?: {
    format: string;
    family: string;
    families: string[];
    parameter_size: string;
    quantization_level: string;
  };
}
```

### RoutingProfile

```typescript
interface RoutingProfile {
  name: string;
  description: string;
  preferredFamilies: string[];
  minContextWindow: number;
  requiredCapabilities: string[];
  fallbackProfile?: string;
}
```

### Memory

```typescript
interface Memory {
  key: string;
  value: string;
  category: 'fact' | 'preference' | 'context';
  source: 'user' | 'llm' | 'system';
  accessCount: number;
  createdAt: Date;
  lastAccessedAt: Date;
}
```

### Template

```typescript
interface Template {
  name: string;
  description: string;
  prompt: string;
  variables: {
    name: string;
    description?: string;
    required: boolean;
    default?: string;
  }[];
  metadata?: Record<string, any>;
}
```

### ProjectProfile

```typescript
interface ProjectProfile {
  name: string;
  type: 'typescript' | 'python' | 'rust' | 'go' | 'documentation';
  description: string;
  detectionRules: {
    files: string[];
    directories?: string[];
  };
  defaultSettings: {
    model?: string;
    systemPrompt?: string;
    tools?: string[];
    routing?: RoutingConfig;
  };
}
```

---

## See Also

- [Getting Started](../getting-started.md) - Quick start guide
- [Architecture](../Models_architecture.md) - System design
- [Configuration](../Models_configuration.md) - Configuration options

---

**Document Version:** 1.0  
**Last Updated:** 2026-01-16  
**Status:** Complete
