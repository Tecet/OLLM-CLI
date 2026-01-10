# Stage 07: Model Management and Routing

## Overview
Implement model management services (list, pull, remove, info) and routing rules for automatic model selection based on task profiles.

## Prerequisites
- Stage 06 complete (CLI and UI)

## Estimated Effort
2-3 days

---

## Tasks

### S07-T01: Model Management Service

**Steps**:
1. Implement `ModelManagementService`:
   - `listModels(): Promise<ModelInfo[]>`
   - `pullModel(name, onProgress): Promise<void>`
   - `deleteModel(name): Promise<void>`
   - `showModel(name): Promise<ModelInfo>`
   - `getModelStatus(name): ModelStatus`
2. Wrap provider adapter calls:
   - Add error handling
   - Emit progress events
   - Handle cancellation
3. Cache model list for performance
4. Handle offline scenarios

**Deliverables**:
- `packages/core/src/services/modelManagementService.ts`

**Acceptance Criteria**:
- List, pull, delete, and show model info work
- Progress events are emitted during pull
- Errors are handled gracefully

---

### S07-T02: Model Routing

**Steps**:
1. Implement `ModelRouter`:
   - `selectModel(profile, available): string`
   - `getProfile(taskType): RoutingProfile`
2. Define routing profiles:
   - `fast`: Quick responses, smaller models
   - `general`: Balanced performance
   - `code`: Code-optimized models
   - `creative`: Creative writing models
3. Implement selection logic:
   - Match profile to available models
   - Consider model capabilities
   - Handle fallbacks
4. Allow config-based overrides

**Deliverables**:
- `packages/core/src/routing/modelRouter.ts`
- `packages/core/src/routing/routingProfiles.ts`

**Acceptance Criteria**:
- Router selects model based on profile
- Fallbacks work when preferred model unavailable
- Config overrides are respected

---

### S07-T03: Model Limit Map

**Steps**:
1. Create known model limits database:
   - Context window sizes
   - Token limits
   - Capability flags
2. Implement limit lookup:
   - Match by model name/family
   - Support wildcards
   - Fallback to safe defaults
3. Integrate with token estimation

**Deliverables**:
- `packages/core/src/core/modelLimits.ts`
- `packages/core/src/core/modelDatabase.ts`

**Acceptance Criteria**:
- Token limit logic uses per-model caps
- Unknown models use safe defaults
- Limits are accurate for common models

---

### S07-T04: Model Options Schema

**Steps**:
1. Extend settings schema:
   - Provider-specific options
   - Model-specific options
   - Generation parameters
2. Add environment variable mappings:
   - `OLLM_MODEL`
   - `OLLM_TEMPERATURE`
   - `OLLM_MAX_TOKENS`
3. Add CLI flag mappings
4. Validate options against schema

**Deliverables**:
- Updated `schemas/settings.schema.json`
- `packages/cli/src/config/optionsMapper.ts`

**Acceptance Criteria**:
- Options are validated on load
- Env vars and flags map correctly
- Invalid options show clear errors

---

## File Structure After Stage 07

```
packages/core/src/
├── services/
│   └── modelManagementService.ts
├── routing/
│   ├── modelRouter.ts
│   └── routingProfiles.ts
└── core/
    ├── modelLimits.ts
    └── modelDatabase.ts

packages/cli/src/config/
└── optionsMapper.ts

schemas/
└── settings.schema.json (updated)
```

---

## Model Database Format

```typescript
interface ModelEntry {
  pattern: string;           // Glob pattern for matching
  family: string;            // Model family (llama, mistral, etc.)
  contextWindow: number;     // Max context tokens
  maxOutputTokens?: number;  // Max generation tokens
  capabilities: {
    toolCalling: boolean;
    vision: boolean;
    streaming: boolean;
  };
  profiles: string[];        // Suitable routing profiles
}

const MODEL_DATABASE: ModelEntry[] = [
  {
    pattern: 'llama3.1:*',
    family: 'llama',
    contextWindow: 128000,
    capabilities: { toolCalling: true, vision: false, streaming: true },
    profiles: ['general', 'code']
  },
  {
    pattern: 'codellama:*',
    family: 'llama',
    contextWindow: 16384,
    capabilities: { toolCalling: false, vision: false, streaming: true },
    profiles: ['code']
  },
  {
    pattern: 'mistral:*',
    family: 'mistral',
    contextWindow: 32768,
    capabilities: { toolCalling: true, vision: false, streaming: true },
    profiles: ['general', 'fast']
  },
  // ... more models
];
```

---

## Routing Profiles

```typescript
interface RoutingProfile {
  name: string;
  description: string;
  preferredFamilies: string[];
  minContextWindow: number;
  requiredCapabilities: string[];
  fallbackProfile?: string;
}

const ROUTING_PROFILES: RoutingProfile[] = [
  {
    name: 'fast',
    description: 'Quick responses with smaller models',
    preferredFamilies: ['phi', 'gemma', 'mistral'],
    minContextWindow: 4096,
    requiredCapabilities: ['streaming'],
    fallbackProfile: 'general'
  },
  {
    name: 'general',
    description: 'Balanced performance for most tasks',
    preferredFamilies: ['llama', 'mistral', 'qwen'],
    minContextWindow: 8192,
    requiredCapabilities: ['streaming'],
    fallbackProfile: undefined
  },
  {
    name: 'code',
    description: 'Optimized for code generation',
    preferredFamilies: ['codellama', 'deepseek-coder', 'starcoder'],
    minContextWindow: 16384,
    requiredCapabilities: ['streaming'],
    fallbackProfile: 'general'
  },
  {
    name: 'creative',
    description: 'Creative writing and storytelling',
    preferredFamilies: ['llama', 'mistral'],
    minContextWindow: 8192,
    requiredCapabilities: ['streaming'],
    fallbackProfile: 'general'
  }
];
```

---

## Configuration Example

```yaml
model:
  default: llama3.1:8b
  routing:
    enabled: true
    defaultProfile: general
    overrides:
      code: deepseek-coder:6.7b
      fast: phi3:mini
      
options:
  temperature: 0.7
  maxTokens: 4096
  topP: 0.9
  
providers:
  ollama:
    host: http://localhost:11434
    options:
      numCtx: 8192
```

---

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `OLLM_MODEL` | Default model | - |
| `OLLM_PROVIDER` | Default provider | ollama |
| `OLLM_HOST` | Provider endpoint | http://localhost:11434 |
| `OLLM_TEMPERATURE` | Generation temperature | 0.7 |
| `OLLM_MAX_TOKENS` | Max output tokens | 4096 |
| `OLLM_CONTEXT_SIZE` | Context window size | model default |

---

## Verification Checklist

- [ ] Model list returns available models
- [ ] Model pull downloads with progress
- [ ] Model delete removes model
- [ ] Model info shows details
- [ ] Router selects appropriate model
- [ ] Routing profiles work correctly
- [ ] Fallbacks work when model unavailable
- [ ] Model limits are enforced
- [ ] Unknown models use safe defaults
- [ ] Options validate correctly
- [ ] Env vars map to settings
- [ ] CLI flags override settings
