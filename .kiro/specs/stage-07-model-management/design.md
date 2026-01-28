# Design Document: Model Management and Routing

## Overview

The Model Management and Routing system provides comprehensive model lifecycle management, intelligent model selection, cross-session memory, prompt templates, and project-specific configuration for OLLM CLI. The system consists of multiple services that work together to optimize model usage, maintain context across sessions, and provide a flexible, user-friendly experience.

The design follows a service-oriented architecture where each major capability is encapsulated in a dedicated service with clear interfaces. Services interact through well-defined contracts and emit events for observability.

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         CLI Layer                            │
│  (Commands, UI Components, User Interaction)                 │
└────────────────┬────────────────────────────────────────────┘
                 │
┌────────────────┴────────────────────────────────────────────┐
│                      Service Layer                           │
│  ┌──────────────────┐  ┌──────────────────┐                │
│  │ Model Management │  │  Model Router    │                │
│  │     Service      │  │                  │                │
│  └──────────────────┘  └──────────────────┘                │
│  ┌──────────────────┐  ┌──────────────────┐                │
│  │ Memory Service   │  │ Template Service │                │
│  └──────────────────┘  └──────────────────┘                │
│  ┌──────────────────┐  ┌──────────────────┐                │
│  │ Comparison       │  │ Project Profile  │                │
│  │    Service       │  │    Service       │                │
│  └──────────────────┘  └──────────────────┘                │
└────────────────┬────────────────────────────────────────────┘
                 │
┌────────────────┴────────────────────────────────────────────┐
│                    Data Layer                                │
│  ┌──────────────────┐  ┌──────────────────┐                │
│  │ Model Database   │  │ Routing Profiles │                │
│  └──────────────────┘  └──────────────────┘                │
└────────────────┬────────────────────────────────────────────┘
                 │
┌────────────────┴────────────────────────────────────────────┐
│                  Provider Adapter Layer                      │
│         (Ollama, vLLM, OpenAI-compatible)                    │
└──────────────────────────────────────────────────────────────┘
```

### Component Interaction Flow

**Model Selection Flow:**

```
User Request → Model Router → Model Database → Provider Adapter
                    ↓
              Routing Profile
```

**Memory Injection Flow:**

```
Session Start → Memory Service → Load from Disk → Inject to System Prompt
                                                         ↓
                                                   Token Budget Check
```

**Template Execution Flow:**

```
User Command → Template Service → Load Template → Substitute Variables → Execute Prompt
```

## Components and Interfaces

### 1. Model Management Service

**Purpose:** Manages model lifecycle operations (list, pull, delete, info) and keep-alive functionality.

**Interface:**

```typescript
interface ModelManagementService {
  // Core operations
  listModels(): Promise<ModelInfo[]>;
  pullModel(name: string, onProgress: ProgressCallback): Promise<void>;
  deleteModel(name: string): Promise<void>;
  showModel(name: string): Promise<ModelInfo>;
  getModelStatus(name: string): ModelStatus;

  // Keep-alive management
  keepModelLoaded(name: string): Promise<void>;
  unloadModel(name: string): Promise<void>;
  getLoadedModels(): string[];

  // Cache management
  invalidateCache(): void;
}

interface ModelInfo {
  name: string;
  size: number;
  modifiedAt: Date;
  family: string;
  contextWindow: number;
  capabilities: ModelCapabilities;
  parameterCount?: number;
}

interface ModelCapabilities {
  toolCalling: boolean;
  vision: boolean;
  streaming: boolean;
}

interface ModelStatus {
  exists: boolean;
  loaded: boolean;
  lastUsed?: Date;
}

type ProgressCallback = (progress: ProgressEvent) => void;

interface ProgressEvent {
  percentage: number;
  transferRate: number;
  bytesDownloaded: number;
  totalBytes: number;
}
```

**Implementation Details:**

- Wraps Provider_Adapter calls with error handling and retry logic
- Maintains in-memory cache of model list with TTL
- Emits progress events during model pull operations
- Tracks last-used timestamps for keep-alive management
- Sends periodic keep-alive requests for configured models
- Handles cancellation via AbortController

### 2. Model Router

**Purpose:** Selects appropriate models based on routing profiles and availability.

**Interface:**

```typescript
interface ModelRouter {
  selectModel(profile: string, availableModels: ModelInfo[]): string | null;
  getProfile(name: string): RoutingProfile | null;
  listProfiles(): RoutingProfile[];
  validateModel(modelName: string, profile: string): boolean;
}

interface RoutingProfile {
  name: string;
  description: string;
  preferredFamilies: string[];
  minContextWindow: number;
  requiredCapabilities: string[];
  fallbackProfile?: string;
}
```

**Selection Algorithm:**

1. Filter models by minimum context window
2. Filter models by required capabilities
3. Score models by preferred family match (higher score = better match)
4. Return highest-scoring model
5. If no match, try fallback profile recursively
6. If still no match, return null

**Implementation Details:**

- Loads routing profiles from configuration and built-in defaults
- Supports configuration overrides per profile
- Implements scoring system for model preference
- Handles circular fallback detection

### 3. Model Database

**Purpose:** Stores known model capabilities, limits, and characteristics.

**Interface:**

```typescript
interface ModelDatabase {
  lookup(modelName: string): ModelEntry | null;
  getContextWindow(modelName: string): number;
  getCapabilities(modelName: string): ModelCapabilities;
  getSuitableProfiles(modelName: string): string[];
  listKnownModels(): ModelEntry[];
}

interface ModelEntry {
  pattern: string; // Glob pattern (e.g., "llama3.1:*")
  family: string; // Model family
  contextWindow: number; // Max context tokens
  maxOutputTokens?: number; // Max generation tokens
  capabilities: ModelCapabilities;
  profiles: string[]; // Suitable routing profiles
}
```

**Implementation Details:**

- Uses glob pattern matching for model name lookup
- Returns safe defaults for unknown models (4096 context, no special capabilities)
- Supports wildcard patterns (\*, ?)
- Preloaded with common model families (llama, mistral, phi, gemma, codellama, etc.)

### 4. Memory Service

**Purpose:** Persists facts, preferences, and context across sessions.

**Interface:**

```typescript
interface MemoryService {
  remember(key: string, value: string, options?: RememberOptions): void;
  recall(key: string): MemoryEntry | null;
  search(query: string): MemoryEntry[];
  forget(key: string): void;
  listAll(): MemoryEntry[];
  getSystemPromptAddition(): string;
  load(): Promise<void>;
  save(): Promise<void>;
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

interface RememberOptions {
  category?: 'fact' | 'preference' | 'context';
  source?: 'user' | 'llm' | 'system';
}
```

**Storage Format:**

```json
{
  "version": 1,
  "memories": [
    {
      "key": "user_name",
      "value": "Alice",
      "category": "preference",
      "createdAt": "2026-01-12T10:00:00Z",
      "updatedAt": "2026-01-12T10:00:00Z",
      "accessCount": 5,
      "source": "user"
    }
  ]
}
```

**System Prompt Injection:**

- Loads all memories at session start
- Formats memories as key-value pairs
- Respects token budget (default: 500 tokens)
- Prioritizes by access count and recency when budget exceeded
- Injects as section in system prompt:
  ```
  ## Remembered Context
  - user_name: Alice
  - preferred_language: TypeScript
  - project_type: monorepo
  ```

**Implementation Details:**

- Stores memories in `~/.ollm/memory.json`
- Updates access count on recall
- Supports fuzzy search by key and value
- Atomic file writes to prevent corruption

### 5. Template Service

**Purpose:** Manages reusable prompt templates with variable substitution.

**Interface:**

```typescript
interface TemplateService {
  loadTemplates(): Promise<void>;
  listTemplates(): TemplateInfo[];
  getTemplate(name: string): Template | null;
  applyTemplate(name: string, variables: Record<string, string>): string;
  createTemplate(template: Template): Promise<void>;
  deleteTemplate(name: string): Promise<void>;
}

interface Template {
  name: string;
  description: string;
  template: string;
  variables: VariableDefinition[];
}

interface VariableDefinition {
  name: string;
  required: boolean;
  default?: string;
  description?: string;
}

interface TemplateInfo {
  name: string;
  description: string;
  variableCount: number;
}
```

**Template Format (YAML):**

```yaml
name: code_review
description: Review code for quality and security
template: "Review this {language} code for {focus:bugs and security}:\n\n{code}"
variables:
  - name: language
    required: true
    description: Programming language
  - name: focus
    required: false
    default: 'bugs and security'
    description: Review focus areas
  - name: code
    required: true
    description: Code to review
```

**Variable Substitution:**

- Syntax: `{variable_name}` or `{variable_name:default_value}`
- Required variables without values trigger user prompt
- Default values used when variable not provided
- Supports nested braces by escaping: `\{not_a_variable\}`

**Implementation Details:**

- Loads templates from `~/.ollm/templates/` and `.ollm/templates/`
- Workspace templates override user templates with same name
- Validates template syntax on load
- Caches parsed templates in memory

### 6. Comparison Service

**Purpose:** Runs prompts through multiple models for side-by-side evaluation.

**Interface:**

```typescript
interface ComparisonService {
  compare(prompt: string, models: string[]): Promise<ComparisonResult>;
  cancel(): void;
}

interface ComparisonResult {
  prompt: string;
  results: ModelResult[];
  timestamp: Date;
}

interface ModelResult {
  model: string;
  response: string;
  tokenCount: number;
  latencyMs: number;
  tokensPerSecond: number;
  error?: string;
}
```

**Execution Strategy:**

- Runs all model requests in parallel using Promise.all
- Captures start/end timestamps for latency calculation
- Handles individual model failures gracefully
- Supports cancellation via AbortController
- Returns partial results if some models fail

**Implementation Details:**

- Uses Provider_Adapter for model invocation
- Calculates tokens/second from response metadata
- Includes error messages in results for failed models
- Limits concurrent requests to avoid resource exhaustion

### 7. Project Profile Service

**Purpose:** Auto-detects project type and applies project-specific configuration.

**Interface:**

```typescript
interface ProjectProfileService {
  detectProfile(workspacePath: string): Promise<ProjectProfile | null>;
  loadProfile(workspacePath: string): Promise<ProjectProfile | null>;
  applyProfile(profile: ProjectProfile): void;
  listBuiltInProfiles(): BuiltInProfile[];
  initializeProject(workspacePath: string, profileName: string): Promise<void>;
}

interface ProjectProfile {
  name: string;
  model?: string;
  systemPrompt?: string;
  tools?: {
    enabled?: string[];
    disabled?: string[];
  };
  routing?: {
    defaultProfile?: string;
  };
  options?: Record<string, any>;
}

interface BuiltInProfile {
  name: string;
  description: string;
  detectionFiles: string[];
  defaultSettings: ProjectProfile;
}
```

**Detection Logic:**

```typescript
const DETECTION_RULES = [
  {
    name: 'typescript',
    files: ['package.json'],
    check: (content) => content.includes('typescript'),
  },
  {
    name: 'python',
    files: ['requirements.txt', 'pyproject.toml', 'setup.py'],
  },
  {
    name: 'rust',
    files: ['Cargo.toml'],
  },
  {
    name: 'go',
    files: ['go.mod'],
  },
];
```

**Built-in Profiles:**

- `typescript`: Code-optimized, enables file tools, code routing profile
- `python`: Code-optimized, enables file and shell tools
- `rust`: Code-optimized, emphasizes memory safety
- `go`: Code-optimized, emphasizes concurrency
- `documentation`: Writing-optimized, creative routing profile

**Implementation Details:**

- Checks for characteristic files in workspace root
- Loads profile from `.ollm/project.yaml` if exists
- Merges built-in profile with custom overrides
- Applies settings by updating configuration service

## Data Models

### Model Entry Database

```typescript
const MODEL_DATABASE: ModelEntry[] = [
  {
    pattern: 'llama3.1:*',
    family: 'llama',
    contextWindow: 128000,
    capabilities: { toolCalling: true, vision: false, streaming: true },
    profiles: ['general', 'code'],
  },
  {
    pattern: 'codellama:*',
    family: 'llama',
    contextWindow: 16384,
    capabilities: { toolCalling: false, vision: false, streaming: true },
    profiles: ['code'],
  },
  {
    pattern: 'mistral:*',
    family: 'mistral',
    contextWindow: 32768,
    capabilities: { toolCalling: true, vision: false, streaming: true },
    profiles: ['general', 'fast'],
  },
  {
    pattern: 'phi3:*',
    family: 'phi',
    contextWindow: 4096,
    capabilities: { toolCalling: false, vision: false, streaming: true },
    profiles: ['fast'],
  },
  {
    pattern: 'gemma:*',
    family: 'gemma',
    contextWindow: 8192,
    capabilities: { toolCalling: false, vision: false, streaming: true },
    profiles: ['fast', 'general'],
  },
  {
    pattern: 'deepseek-coder:*',
    family: 'deepseek',
    contextWindow: 16384,
    capabilities: { toolCalling: false, vision: false, streaming: true },
    profiles: ['code'],
  },
  {
    pattern: 'qwen:*',
    family: 'qwen',
    contextWindow: 32768,
    capabilities: { toolCalling: true, vision: false, streaming: true },
    profiles: ['general', 'code'],
  },
];
```

### Routing Profiles

```typescript
const ROUTING_PROFILES: RoutingProfile[] = [
  {
    name: 'fast',
    description: 'Quick responses with smaller models',
    preferredFamilies: ['phi', 'gemma', 'mistral'],
    minContextWindow: 4096,
    requiredCapabilities: ['streaming'],
    fallbackProfile: 'general',
  },
  {
    name: 'general',
    description: 'Balanced performance for most tasks',
    preferredFamilies: ['llama', 'mistral', 'qwen'],
    minContextWindow: 8192,
    requiredCapabilities: ['streaming'],
  },
  {
    name: 'code',
    description: 'Optimized for code generation',
    preferredFamilies: ['codellama', 'deepseek-coder', 'starcoder', 'qwen'],
    minContextWindow: 16384,
    requiredCapabilities: ['streaming'],
    fallbackProfile: 'general',
  },
  {
    name: 'creative',
    description: 'Creative writing and storytelling',
    preferredFamilies: ['llama', 'mistral'],
    minContextWindow: 8192,
    requiredCapabilities: ['streaming'],
    fallbackProfile: 'general',
  },
];
```

### Configuration Schema

```yaml
model:
  default: llama3.1:8b
  routing:
    enabled: true
    defaultProfile: general
    overrides:
      code: deepseek-coder:6.7b
      fast: phi3:mini
  keepAlive:
    enabled: true
    models:
      - llama3.1:8b
    timeout: 300 # seconds

options:
  temperature: 0.7
  maxTokens: 4096
  topP: 0.9
  numCtx: 8192

memory:
  enabled: true
  tokenBudget: 500

templates:
  directories:
    - ~/.ollm/templates
    - .ollm/templates

project:
  profile: typescript
  autoDetect: true
```

## Correctness Properties

A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.

### Model Management Properties

Property 1: Model list retrieval
_For any_ state of the Provider_Adapter, calling listModels should return a list of ModelInfo objects with required fields (name, size, modifiedAt)
**Validates: Requirements 1.1, 1.2**

Property 2: Model list caching
_For any_ sequence of listModels calls without cache invalidation, the second call should return cached results without calling the Provider_Adapter
**Validates: Requirements 1.3**

Property 3: Cache invalidation after mutations
_For any_ model mutation operation (pull, delete), the operation should invalidate the model list cache
**Validates: Requirements 2.3, 3.2**

Property 4: Offline operation with cache
_For any_ cached model list, when the Provider_Adapter is unavailable, listModels should return the cached data
**Validates: Requirements 1.5**

Property 5: Progress event emission
_For any_ model pull operation, progress events should be emitted with required fields (percentage, transferRate, bytesDownloaded, totalBytes)
**Validates: Requirements 2.2**

Property 6: Pull cancellation
_For any_ in-progress model pull, cancelling the operation should abort the download
**Validates: Requirements 2.5**

Property 7: Loaded model unload before deletion
_For any_ model that is currently loaded, deleting it should unload it first
**Validates: Requirements 3.4**

Property 8: Error handling consistency
_For any_ operation that fails (list, pull, delete, show), the service should return a descriptive error message
**Validates: Requirements 1.4, 2.4, 3.3, 4.3**

### Model Routing Properties

Property 9: Profile-based model selection
_For any_ routing profile and list of available models, selectModel should return a model that meets the profile's minimum context window and required capabilities, or null if none match
**Validates: Requirements 5.1, 6.5, 6.6**

Property 10: Preferred family prioritization
_For any_ routing profile with preferred families and multiple matching models, selectModel should prefer models from the preferred families list
**Validates: Requirements 5.2**

Property 11: Fallback profile usage
_For any_ routing profile with a fallback, when no models match the primary profile, selectModel should try the fallback profile
**Validates: Requirements 5.3**

Property 12: Configuration override precedence
_For any_ routing profile with a configuration override, selectModel should return the override model regardless of the selection algorithm
**Validates: Requirements 5.5**

### Model Database Properties

Property 13: Known model lookup
_For any_ known model pattern in the database, looking up a matching model name should return the stored context window, capabilities, and suitable profiles
**Validates: Requirements 7.1, 7.2, 7.3**

Property 14: Unknown model defaults
_For any_ model name not matching any database pattern, lookup should return safe default values (4096 context window, no special capabilities)
**Validates: Requirements 7.4**

Property 15: Wildcard pattern matching
_For any_ model name and database pattern with wildcards, the pattern should match all appropriate model names
**Validates: Requirements 7.5**

Property 16: Token limit enforcement
_For any_ model, token estimation should use the model's context window limit from the database, or the safe default if unknown
**Validates: Requirements 8.1, 8.2**

### Configuration Properties

Property 17: Options validation
_For any_ model options, the system should validate them against the JSON schema and reject invalid options with clear error messages
**Validates: Requirements 9.1, 9.5**

Property 18: Generation parameter support
_For any_ valid temperature, max_tokens, and top_p values, the system should accept and apply them
**Validates: Requirements 9.2**

Property 19: Environment variable precedence
_For any_ configuration setting that has both an environment variable and config file value, the system should use the environment variable value
**Validates: Requirements 10.1, 10.2, 10.3, 10.4, 10.5**

### Memory Service Properties

Property 20: Memory persistence round-trip
_For any_ memory entry stored via remember, it should be persisted to disk and retrievable via recall after service restart
**Validates: Requirements 11.1, 11.2, 12.1, 12.2**

Property 21: System prompt injection with budget
_For any_ set of memories, getSystemPromptAddition should inject memories within the token budget
**Validates: Requirements 11.3**

Property 22: Memory prioritization by recency
_For any_ set of memories exceeding the token budget, getSystemPromptAddition should prioritize recently accessed memories
**Validates: Requirements 11.4**

Property 23: Memory metadata tracking
_For any_ memory entry accessed via recall, the access count should increment and the timestamp should update
**Validates: Requirements 11.5**

Property 24: Memory search
_For any_ search query, the search method should return all memory entries where the key or value contains the query string
**Validates: Requirements 12.3**

Property 25: Memory deletion
_For any_ memory entry, calling forget should remove it such that recall returns null
**Validates: Requirements 12.4**

Property 26: Memory listing
_For any_ set of stored memories, listAll should return all Memory_Entry objects
**Validates: Requirements 12.5**

Property 27: LLM memory source marking
_For any_ memory stored via the remember tool, the source field should be set to 'llm'
**Validates: Requirements 13.2, 13.3**

Property 28: Memory categorization
_For any_ memory stored with a category (fact, preference, context), the category should be preserved in the Memory_Entry
**Validates: Requirements 13.4**

### Comparison Service Properties

Property 29: Parallel model execution
_For any_ comparison request with multiple models, all models should be invoked with the same prompt
**Validates: Requirements 14.1**

Property 30: Comparison result structure
_For any_ comparison result, each ModelResult should contain response text, token count, latency, and tokens per second
**Validates: Requirements 14.2, 15.2, 15.3**

Property 31: Partial failure handling
_For any_ comparison where some models fail, the result should include errors for failed models without failing the entire comparison
**Validates: Requirements 14.4**

### Template Service Properties

Property 32: Template loading from directories
_For any_ valid template file in the user or workspace configuration directory, loadTemplates should parse and make it available
**Validates: Requirements 16.1, 16.2, 16.3**

Property 33: Template metadata preservation
_For any_ loaded template, it should include name, description, and variable definitions
**Validates: Requirements 16.4**

Property 34: Variable substitution
_For any_ template with variables and provided values, applyTemplate should replace all variable placeholders with the provided values
**Validates: Requirements 17.1**

Property 35: Default value usage
_For any_ template variable with a default value, when no value is provided, applyTemplate should use the default
**Validates: Requirements 17.2**

Property 36: Required variable validation
_For any_ template with required variables, applyTemplate should fail or prompt when required variables are missing
**Validates: Requirements 17.3**

Property 37: Template persistence
_For any_ template created via createTemplate, it should be saved to disk and available in subsequent listTemplates calls
**Validates: Requirements 18.3**

### Keep-Alive Properties

Property 38: Keep-alive request sending
_For any_ model with keep-alive enabled, the service should send periodic keep-alive requests to the Provider_Adapter
**Validates: Requirements 19.1, 20.1**

Property 39: Last-used timestamp tracking
_For any_ model usage, the last-used timestamp should be updated
**Validates: Requirements 19.2**

Property 40: Idle timeout unloading
_For any_ model idle beyond the configured timeout, the service should allow it to unload
**Validates: Requirements 19.3, 20.2**

Property 41: Keep-alive disable respect
_For any_ configuration where keep-alive is disabled, no keep-alive requests should be sent
**Validates: Requirements 20.3**

Property 42: Loaded model status reporting
_For any_ point in time, getLoadedModels should return the list of currently loaded models
**Validates: Requirements 20.4**

### Project Profile Properties

Property 43: Project type detection
_For any_ workspace containing characteristic files (package.json with TypeScript, requirements.txt, Cargo.toml, go.mod), detectProfile should identify the correct project type
**Validates: Requirements 21.1, 21.2, 21.3, 21.4, 21.5**

Property 44: Project settings precedence
_For any_ setting that exists in both global and project configuration, the system should use the project setting
**Validates: Requirements 22.1, 22.2**

Property 45: Profile setting application
_For any_ project profile with specified model, system prompt, or tool restrictions, those settings should be applied when the profile is loaded
**Validates: Requirements 22.3, 22.4, 22.5**

Property 46: Manual profile override
_For any_ manually selected profile, it should take precedence over auto-detected profile
**Validates: Requirements 24.4**

Property 47: Project initialization
_For any_ project initialization with a selected profile, a workspace configuration file should be created with the profile settings
**Validates: Requirements 24.3**

## Error Handling

### Error Categories

1. **Provider Errors**: Adapter unavailable, network failures, model not found
2. **Validation Errors**: Invalid options, missing required variables, schema violations
3. **Resource Errors**: Disk full, permission denied, file not found
4. **Timeout Errors**: Model pull timeout, keep-alive timeout, comparison timeout

### Error Handling Strategy

**Graceful Degradation:**

- Use cached data when provider unavailable
- Return partial results when some operations fail
- Provide safe defaults when data unavailable

**Descriptive Messages:**

- Include error type and context
- Suggest remediation steps
- Include relevant identifiers (model name, file path)

**Retry Logic:**

- Exponential backoff for transient failures
- Maximum retry attempts (3)
- User-initiated retry for manual operations

**Error Propagation:**

- Services throw typed errors
- CLI layer catches and formats for display
- Errors include stack traces in debug mode

### Example Error Messages

```typescript
// Provider unavailable
"Failed to connect to Ollama at http://localhost:11434. Is Ollama running? Try 'ollama serve' to start it.";

// Model not found
"Model 'llama3.1:8b' not found. Available models: llama3:8b, mistral:7b. Use 'ollm model pull llama3.1:8b' to download it.";

// Invalid options
'Invalid temperature value: 2.5. Temperature must be between 0.0 and 2.0.';

// Missing required variable
"Template 'code_review' requires variable 'language'. Provide it with: /template use code_review language=TypeScript";
```

## Testing Strategy

### Unit Testing

Unit tests verify specific examples, edge cases, and error conditions for individual components:

**Model Management Service:**

- Test listModels with empty, single, and multiple models
- Test pullModel with progress events and cancellation
- Test deleteModel with loaded and unloaded models
- Test cache invalidation after mutations
- Test error handling for provider failures

**Model Router:**

- Test selection with various profile configurations
- Test fallback chain with multiple levels
- Test configuration overrides
- Test filtering by context window and capabilities
- Test scoring algorithm for preferred families

**Model Database:**

- Test pattern matching with wildcards
- Test lookup for known and unknown models
- Test default value returns
- Test capability flag retrieval

**Memory Service:**

- Test persistence round-trip (store, restart, load)
- Test token budget enforcement
- Test prioritization by access count and recency
- Test search functionality
- Test CRUD operations (create, read, update, delete)

**Template Service:**

- Test template loading from multiple directories
- Test variable substitution with various patterns
- Test default value application
- Test required variable validation
- Test YAML parsing errors

**Comparison Service:**

- Test parallel execution with multiple models
- Test result aggregation
- Test partial failure handling
- Test cancellation

**Project Profile Service:**

- Test detection for each project type
- Test profile loading and application
- Test settings precedence (project > global)
- Test manual override

### Property-Based Testing

Property tests verify universal properties across all inputs using fast-check library. Each test runs minimum 100 iterations with randomized inputs.

**Configuration:**

```typescript
import fc from 'fast-check';

// Example property test
describe('Model Router Properties', () => {
  it('Property 9: Profile-based model selection', () => {
    fc.assert(
      fc.property(
        fc.record({
          name: fc.string(),
          minContextWindow: fc.integer({ min: 1024, max: 128000 }),
          requiredCapabilities: fc.array(fc.constantFrom('toolCalling', 'vision', 'streaming')),
        }),
        fc.array(
          fc.record({
            name: fc.string(),
            contextWindow: fc.integer({ min: 1024, max: 128000 }),
            capabilities: fc.record({
              toolCalling: fc.boolean(),
              vision: fc.boolean(),
              streaming: fc.boolean(),
            }),
          })
        ),
        (profile, models) => {
          const router = new ModelRouter();
          const selected = router.selectModel(profile.name, models);

          if (selected !== null) {
            const model = models.find((m) => m.name === selected);
            // Property: Selected model must meet requirements
            expect(model.contextWindow).toBeGreaterThanOrEqual(profile.minContextWindow);
            profile.requiredCapabilities.forEach((cap) => {
              expect(model.capabilities[cap]).toBe(true);
            });
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
```

**Property Test Coverage:**

- Model routing selection algorithm (Properties 9-12)
- Model database pattern matching (Property 15)
- Memory service round-trip (Property 20)
- Memory prioritization (Property 22)
- Template variable substitution (Properties 34-36)
- Configuration precedence (Properties 19, 44, 46)
- Project detection (Property 43)

### Integration Testing

Integration tests verify component interactions:

**Model Management + Provider Adapter:**

- Test full model lifecycle (list, pull, use, delete)
- Test keep-alive with real provider
- Test error handling with provider failures

**Model Router + Model Database:**

- Test routing with real model database
- Test fallback chains
- Test configuration overrides

**Memory Service + File System:**

- Test persistence across restarts
- Test concurrent access
- Test file corruption recovery

**Template Service + File System:**

- Test loading from multiple directories
- Test workspace override of user templates
- Test file watching for hot reload

**Project Profile + Configuration:**

- Test profile detection and application
- Test settings merge (global + project)
- Test profile switching

### Test Organization

```
packages/core/src/
├── services/
│   ├── __tests__/
│   │   ├── modelManagementService.test.ts
│   │   ├── modelManagementService.property.test.ts
│   │   ├── memoryService.test.ts
│   │   ├── memoryService.property.test.ts
│   │   ├── templateService.test.ts
│   │   ├── comparisonService.test.ts
│   │   └── projectProfileService.test.ts
├── routing/
│   ├── __tests__/
│   │   ├── modelRouter.test.ts
│   │   └── modelRouter.property.test.ts
└── core/
    ├── __tests__/
    │   ├── modelDatabase.test.ts
    │   └── modelDatabase.property.test.ts
```

### Test Data

**Mock Models:**

```typescript
const MOCK_MODELS: ModelInfo[] = [
  {
    name: 'llama3.1:8b',
    size: 4700000000,
    modifiedAt: new Date('2026-01-01'),
    family: 'llama',
    contextWindow: 128000,
    capabilities: { toolCalling: true, vision: false, streaming: true },
  },
  {
    name: 'phi3:mini',
    size: 2300000000,
    modifiedAt: new Date('2026-01-01'),
    family: 'phi',
    contextWindow: 4096,
    capabilities: { toolCalling: false, vision: false, streaming: true },
  },
];
```

**Mock Templates:**

```yaml
name: test_template
description: Test template
template: 'Hello {name:World}, you are {age} years old'
variables:
  - name: name
    required: false
    default: 'World'
  - name: age
    required: true
```

**Mock Memories:**

```json
{
  "version": 1,
  "memories": [
    {
      "key": "test_key",
      "value": "test_value",
      "category": "fact",
      "createdAt": "2026-01-12T10:00:00Z",
      "updatedAt": "2026-01-12T10:00:00Z",
      "accessCount": 0,
      "source": "user"
    }
  ]
}
```
