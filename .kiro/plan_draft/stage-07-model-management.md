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

### S07-T05: Simple Memory (Cross-Session Context)

**Goal**: Persist facts, preferences, and context across sessions without requiring RAG.

**Effort**: 1 day

**Steps**:

1. Implement `MemoryService`:

```typescript
interface MemoryService {
  remember(key: string, value: string, options?: RememberOptions): void;
  recall(key: string): MemoryEntry | null;
  search(query: string): MemoryEntry[];
  forget(key: string): void;
  listAll(): MemoryEntry[];
  getSystemPromptAddition(): string;
}

interface MemoryEntry {
  key: string;
  value: string;
  category: 'fact' | 'preference' | 'context';
  createdAt: Date;
  updatedAt: Date;
  accessCount: number;
  source: 'user' | 'llm' | 'system';
}
```

2. Storage in `~/.ollm/memory.json`
3. System prompt injection with token budget
4. Slash commands:
   ```
   /memory list              # Show all memories
   /memory add <key> <value> # Add memory
   /memory forget <key>      # Remove memory
   /memory clear             # Clear all memories
   ```
5. LLM `remember` tool for AI-initiated memories

**Deliverables**:
- `packages/core/src/services/memoryService.ts`
- `packages/core/src/tools/remember.ts`
- `docs/simple_memory.md`

**Acceptance Criteria**:
- [ ] Memories persist across sessions
- [ ] Memories included in system prompt
- [ ] LLM can add memories via tool
- [ ] User can manage via slash commands
- [ ] Token budget respected

---

### S07-T06: Model Comparison Mode

**Goal**: Run the same prompt through multiple models and compare outputs side-by-side.

**Steps**:
1. Implement `ModelComparisonService`:
   - `compare(prompt, models[]): ComparisonResult`
   - Run prompt through 2-3 models in parallel
   - Collect responses with timing metrics
2. Add `/compare` command:
   ```
   /compare "Explain recursion" llama3:8b mistral:7b phi3:mini
   ```
3. Create comparison UI component:
   - Side-by-side response display
   - Metrics comparison (t/s, tokens, latency)
   - Select winner action

**Deliverables**:
- `packages/core/src/services/modelComparisonService.ts`
- `packages/cli/src/ui/components/compare/ComparisonView.tsx`

**Acceptance Criteria**:
- [ ] `/compare` runs prompt through multiple models
- [ ] Responses displayed side-by-side
- [ ] Performance metrics shown for each
- [ ] User can select preferred response

---

### S07-T07: Prompt Templates Library

**Goal**: Reusable prompts with variable substitution.

**Steps**:
1. Implement `TemplateService`:
   - Load templates from `~/.ollm/templates/`
   - Variable substitution: `{variable}`
   - Default values: `{variable:default}`
2. Template format:
   ```yaml
   # ~/.ollm/templates/code_review.yaml
   name: code_review
   description: Review code for quality
   template: "Review this {language} code for {focus:bugs and security}: {code}"
   variables:
     - name: language
       required: true
     - name: focus
       default: "bugs and security"
     - name: code
       required: true
   ```
3. Slash commands:
   ```
   /template list
   /template use <name> [vars...]
   /template create <name>
   ```

**Deliverables**:
- `packages/core/src/services/templateService.ts`
- `packages/cli/src/commands/templateCommands.ts`

**Acceptance Criteria**:
- [ ] Templates loaded from config directory
- [ ] Variable substitution works
- [ ] Missing required variables prompt user
- [ ] `/template` commands work

---

### S07-T08: Model Keep-Alive

**Goal**: Keep frequently-used models loaded in VRAM to reduce time-to-first-token.

**Steps**:
1. Implement keep-alive logic in `ModelManagementService`:
   - Send periodic keep-alive requests to Ollama
   - Track last-used timestamps
   - Configurable timeout per model
2. Configuration:
   ```yaml
   model:
     keepAlive:
       enabled: true
       models:
         - llama3.1:8b   # Always keep loaded
       timeout: 300      # Seconds before unload
   ```
3. Status bar indicator for loaded models
4. `/model keep <name>` and `/model unload <name>` commands

**Deliverables**:
- Updated `packages/core/src/services/modelManagementService.ts`
- `packages/cli/src/commands/modelKeepAliveCommands.ts`

**Acceptance Criteria**:
- [ ] Configured models stay loaded
- [ ] Idle models unload after timeout
- [ ] Status bar shows loaded models
- [ ] Manual keep/unload commands work

---

### S07-T09: Project Profiles

**Goal**: Auto-configure model, tools, and system prompt based on project type.

**Steps**:
1. Implement `ProjectProfileService`:
   - Detect project type from files (package.json, Cargo.toml, etc.)
   - Load profile from `.ollm/project.yaml`
   - Override global settings with project settings
2. Project profile format:
   ```yaml
   # .ollm/project.yaml
   profile: typescript-monorepo
   model: llama3.1:70b
   systemPrompt: "You are helping with a TypeScript monorepo using pnpm..."
   tools:
     enabled: [read_file, write_file, shell, glob]
     disabled: [web_fetch]
   routing:
     defaultProfile: code
   ```
3. Built-in profile templates:
   - `typescript`, `python`, `rust`, `go`, `documentation`
4. `/project` commands:
   ```
   /project detect   # Auto-detect and show profile
   /project use <profile>
   /project init     # Create .ollm/project.yaml
   ```

**Deliverables**:
- `packages/core/src/services/projectProfileService.ts`
- `packages/cli/src/commands/projectCommands.ts`
- Built-in profiles in `packages/core/src/profiles/`

**Acceptance Criteria**:
- [ ] Project profile auto-detected on startup
- [ ] Profile overrides global settings
- [ ] `/project` commands work
- [ ] Built-in profiles available

---

## File Structure After Stage 07

```
packages/core/src/
├── services/
│   ├── modelManagementService.ts
│   └── memoryService.ts
├── routing/
│   ├── modelRouter.ts
│   └── routingProfiles.ts
├── core/
│   ├── modelLimits.ts
│   └── modelDatabase.ts
└── tools/
    └── remember.ts

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
