# Design Document: Model Management and Routing

## Overview

The Model Management and Routing system provides comprehensive lifecycle management for LLM models and intelligent model selection based on task requirements. It enables users to discover, download, inspect, and remove models through a unified service interface, while automatically selecting appropriate models based on routing profiles that match task characteristics to model capabilities.

The system consists of three core components: Model Management Service handles CRUD operations for models with caching and progress tracking, Model Router implements intelligent selection logic using routing profiles and capability matching, and Model Database provides a registry of known models with their limits and capabilities. Together, these components enable both manual model management and automatic model selection optimized for specific use cases.

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                  Model Management Layer                     │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────────┐  ┌──────────────────────────────────┐ │
│  │     Model        │  │        Model Router              │ │
│  │   Management     │  │  (Selection & Routing Logic)     │ │
│  │    Service       │  └────────────┬─────────────────────┘ │
│  │ (CRUD + Cache)   │               │                       │
│  └────────┬─────────┘               │                       │
│           │                         │                       │
│           v                         v                       │
│  ┌─────────────────────────────────────────────────────────┐│
│  │              Model Database                             ││
│  │     (Limits, Capabilities, Family Info)                 ││
│  └─────────────────────────────────────────────────────────┘│
│           │                         │                       │
│           v                         v                       │
│  ┌──────────────────┐  ┌──────────────────────────────────┐ │
│  │    Provider      │  │    Configuration Manager         │ │
│  │    Adapter       │  │  (Options, Env Vars, CLI Flags)  │ │
│  └──────────────────┘  └──────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

**Model Management Service**: Provides CRUD operations for models (list, pull, delete, show), manages caching with TTL, emits progress events during downloads, handles offline scenarios, and coordinates with provider adapters.

**Model Router**: Selects appropriate models based on routing profiles, matches models to task requirements, filters by capabilities, applies user configuration overrides, and implements fallback logic.

**Model Database**: Maintains registry of known models with glob pattern matching, stores context limits and capabilities, provides default values for unknown models, and supports family-based categorization.

**Configuration Manager**: Merges configuration from multiple sources (files, environment variables, CLI flags), validates options against schema, applies precedence rules, and provides model-specific option overrides.

**Provider Adapter**: Interfaces with backend model providers (Ollama, etc.), translates API calls, handles streaming responses, and reports model metadata.



## Components and Interfaces

### Model Management Service

```typescript
interface ModelInfo {
  name: string;              // Model identifier (e.g., "llama3.1:8b")
  family: string;            // Model family (llama, mistral, etc.)
  size: number;              // Size in bytes
  parameters: number;        // Parameter count in billions
  quantization: string;      // Quantization type (q4_0, q8_0, f16, etc.)
  contextWindow: number;     // Maximum context tokens
  maxOutputTokens?: number;  // Maximum generation tokens
  modifiedAt: Date;          // Last modified timestamp
  capabilities: ModelCapabilities;
}

interface ModelCapabilities {
  toolCalling: boolean;
  vision: boolean;
  streaming: boolean;
}

enum ModelStatus {
  AVAILABLE = 'available',
  DOWNLOADING = 'downloading',
  NOT_FOUND = 'not_found'
}

interface ProgressEvent {
  percentage: number;        // 0-100
  downloadedBytes: number;
  totalBytes: number;
  downloadSpeed: number;     // Bytes per second
  status: 'downloading' | 'complete' | 'cancelled' | 'error';
  error?: string;
}

interface ModelManagementService {
  // List all available models
  listModels(): Promise<ModelInfo[]>;
  
  // Download a model with progress tracking
  pullModel(
    name: string,
    onProgress: (event: ProgressEvent) => void
  ): Promise<void>;
  
  // Remove a model
  deleteModel(name: string): Promise<void>;
  
  // Get detailed model information
  showModel(name: string): Promise<ModelInfo>;
  
  // Check model availability status
  getModelStatus(name: string): Promise<ModelStatus>;
  
  // Clear cache manually
  clearCache(): void;
}
```

**Implementation Notes**:
- Cache model list for 60 seconds to reduce provider queries
- Cache individual model info for 5 minutes
- Invalidate cache on pull/delete operations
- When offline, serve cached data regardless of expiration
- Progress events emitted at least every 2 seconds during download
- Support cancellation via AbortController
- Prevent deletion of models currently in use
- Return descriptive errors with recovery guidance



### Model Router

```typescript
interface RoutingProfile {
  name: string;
  description: string;
  preferredFamilies: string[];     // Preferred model families
  minContextWindow: number;        // Minimum context tokens required
  requiredCapabilities: string[];  // Required capabilities
  fallbackProfile?: string;        // Fallback if no match
}

interface ModelRouter {
  // Select best model for a profile
  selectModel(
    profile: string | RoutingProfile,
    availableModels: ModelInfo[]
  ): string;
  
  // Get routing profile by name
  getProfile(name: string): RoutingProfile;
  
  // List all available profiles
  listProfiles(): RoutingProfile[];
  
  // Check if model matches profile requirements
  matchesProfile(model: ModelInfo, profile: RoutingProfile): boolean;
}

interface RoutingConfig {
  enabled: boolean;
  defaultProfile: string;
  overrides: Record<string, string>;  // profile -> model name
}
```

**Routing Profiles**:

```typescript
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

**Selection Algorithm**:

1. Check for user configuration override for the profile
2. Filter models by minimum context window requirement
3. Filter models by required capabilities
4. Prefer models from preferred families (in order)
5. If no match, try fallback profile
6. If still no match, return error

**Implementation Notes**:
- Configuration overrides take precedence over profile logic
- Unknown model capabilities default to basic text generation only
- Multiple required capabilities use AND logic (all must be present)
- Family matching is case-insensitive substring match
- Most specific family match wins when multiple families match



### Model Database

```typescript
interface ModelEntry {
  pattern: string;           // Glob pattern for matching (e.g., "llama3.1:*")
  family: string;            // Model family identifier
  contextWindow: number;     // Maximum context tokens
  maxOutputTokens?: number;  // Maximum generation tokens
  capabilities: ModelCapabilities;
  profiles: string[];        // Suitable routing profiles
}

interface ModelDatabase {
  // Look up model limits by name
  getModelLimits(modelName: string): ModelLimits;
  
  // Get model family from name
  getModelFamily(modelName: string): string;
  
  // Get model capabilities
  getModelCapabilities(modelName: string): ModelCapabilities;
  
  // Check if model matches a pattern
  matchesPattern(modelName: string, pattern: string): boolean;
}

interface ModelLimits {
  contextWindow: number;
  maxOutputTokens: number;
}

const DEFAULT_LIMITS: ModelLimits = {
  contextWindow: 4096,
  maxOutputTokens: 2048
};
```

**Model Database Entries**:

```typescript
const MODEL_DATABASE: ModelEntry[] = [
  {
    pattern: 'llama3.1:*',
    family: 'llama',
    contextWindow: 128000,
    maxOutputTokens: 4096,
    capabilities: { toolCalling: true, vision: false, streaming: true },
    profiles: ['general', 'code', 'creative']
  },
  {
    pattern: 'llama3.2:*',
    family: 'llama',
    contextWindow: 128000,
    maxOutputTokens: 4096,
    capabilities: { toolCalling: true, vision: true, streaming: true },
    profiles: ['general', 'code', 'creative']
  },
  {
    pattern: 'codellama:*',
    family: 'codellama',
    contextWindow: 16384,
    maxOutputTokens: 4096,
    capabilities: { toolCalling: false, vision: false, streaming: true },
    profiles: ['code']
  },
  {
    pattern: 'mistral:*',
    family: 'mistral',
    contextWindow: 32768,
    maxOutputTokens: 4096,
    capabilities: { toolCalling: true, vision: false, streaming: true },
    profiles: ['general', 'fast']
  },
  {
    pattern: 'phi3:*',
    family: 'phi',
    contextWindow: 4096,
    maxOutputTokens: 2048,
    capabilities: { toolCalling: false, vision: false, streaming: true },
    profiles: ['fast']
  },
  {
    pattern: 'gemma:*',
    family: 'gemma',
    contextWindow: 8192,
    maxOutputTokens: 2048,
    capabilities: { toolCalling: false, vision: false, streaming: true },
    profiles: ['fast', 'general']
  },
  {
    pattern: 'deepseek-coder:*',
    family: 'deepseek-coder',
    contextWindow: 16384,
    maxOutputTokens: 4096,
    capabilities: { toolCalling: false, vision: false, streaming: true },
    profiles: ['code']
  },
  {
    pattern: 'qwen:*',
    family: 'qwen',
    contextWindow: 32768,
    maxOutputTokens: 4096,
    capabilities: { toolCalling: true, vision: false, streaming: true },
    profiles: ['general', 'code']
  }
];
```

**Pattern Matching**:
- Use glob patterns with wildcards (*, ?, [])
- Match against full model name including tag (e.g., "llama3.1:8b")
- When multiple patterns match, use most specific (longest) pattern
- If no pattern matches, return default limits

**Family Detection**:
- Check model name for family keywords (case-insensitive)
- Priority order: codellama > llama, deepseek-coder > deepseek
- If no family detected, return "unknown"

**Implementation Notes**:
- Patterns are evaluated in order of specificity (most specific first)
- Cache lookup results to avoid repeated pattern matching
- Support adding custom entries via configuration
- Validate patterns on load to catch syntax errors



### Configuration Manager

```typescript
interface ModelConfig {
  default: string;              // Default model name
  routing: RoutingConfig;       // Routing configuration
  options: GenerationOptions;   // Default generation options
  providers: Record<string, ProviderConfig>;
}

interface GenerationOptions {
  temperature: number;          // 0.0 - 2.0
  maxTokens: number;           // > 0
  topP: number;                // 0.0 - 1.0
  topK?: number;
  repeatPenalty?: number;
}

interface ProviderConfig {
  host: string;
  options: Record<string, any>;  // Provider-specific options
}

interface ConfigurationManager {
  // Load configuration from all sources
  loadConfig(): Promise<ModelConfig>;
  
  // Get effective configuration with precedence
  getEffectiveConfig(): ModelConfig;
  
  // Validate configuration
  validateConfig(config: ModelConfig): ValidationResult;
  
  // Get model-specific options
  getModelOptions(modelName: string): GenerationOptions;
}

interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

interface ValidationError {
  field: string;
  message: string;
  value: any;
}
```

**Configuration Sources** (in precedence order):

1. **CLI Flags** (highest priority)
   - `--model <name>`
   - `--temperature <value>`
   - `--max-tokens <value>`
   - `--profile <name>`

2. **Environment Variables**
   - `OLLM_MODEL`
   - `OLLM_PROVIDER`
   - `OLLM_HOST`
   - `OLLM_TEMPERATURE`
   - `OLLM_MAX_TOKENS`
   - `OLLM_CONTEXT_SIZE`

3. **Configuration File** (lowest priority)
   - `~/.ollm/config.yaml` (user-level)
   - `.ollm/config.yaml` (workspace-level)

**Configuration Example**:

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
      numGpu: 1
```

**Validation Rules**:

| Field | Rule | Error Message |
|-------|------|---------------|
| temperature | 0.0 ≤ value ≤ 2.0 | "Temperature must be between 0.0 and 2.0" |
| maxTokens | value > 0 | "Max tokens must be positive" |
| topP | 0.0 ≤ value ≤ 1.0 | "Top P must be between 0.0 and 1.0" |
| model | valid model name | "Invalid model name format" |
| profile | known profile name | "Unknown routing profile" |

**Implementation Notes**:
- Merge configurations with precedence: CLI > Env > File
- Validate merged configuration before use
- Cache effective configuration to avoid repeated merging
- Support per-model option overrides in config file
- Provide clear validation errors with field names and values



## Data Models

### Model Information

```typescript
interface ModelInfo {
  name: string;
  family: string;
  size: number;
  parameters: number;
  quantization: string;
  contextWindow: number;
  maxOutputTokens?: number;
  modifiedAt: Date;
  capabilities: ModelCapabilities;
  metadata?: Record<string, any>;
}

interface ModelCapabilities {
  toolCalling: boolean;
  vision: boolean;
  streaming: boolean;
}
```

### Routing Profile

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

### Configuration

```typescript
interface ModelConfig {
  default: string;
  routing: {
    enabled: boolean;
    defaultProfile: string;
    overrides: Record<string, string>;
  };
  options: {
    temperature: number;
    maxTokens: number;
    topP: number;
    topK?: number;
    repeatPenalty?: number;
  };
  providers: Record<string, {
    host: string;
    options: Record<string, any>;
  }>;
}
```

### Progress Tracking

```typescript
interface ProgressEvent {
  percentage: number;
  downloadedBytes: number;
  totalBytes: number;
  downloadSpeed: number;
  status: 'downloading' | 'complete' | 'cancelled' | 'error';
  error?: string;
  timestamp: Date;
}
```

### Cache Entry

```typescript
interface CacheEntry<T> {
  data: T;
  timestamp: Date;
  ttl: number;  // Time to live in milliseconds
}

interface ModelCache {
  modelList?: CacheEntry<ModelInfo[]>;
  modelInfo: Map<string, CacheEntry<ModelInfo>>;
}
```



## Correctness Properties

A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.

### Property 1: Model List Return Type
*For any* model list request, the returned value should be an array containing only ModelInfo objects with all required fields (name, size, family, modifiedAt, contextWindow, capabilities).
**Validates: Requirements 1.1, 1.3**

### Property 2: Model List Caching
*For any* model list retrieval, subsequent requests within 60 seconds should return cached data without querying the provider.
**Validates: Requirements 1.5, 18.1**

### Property 3: Descriptive Error Messages
*For any* operation that fails, the error message should be non-empty and include information about the failure cause and suggested recovery actions.
**Validates: Requirements 1.6, 2.5, 3.5, 17.3, 17.4, 17.5**

### Property 4: Progress Event Structure
*For any* progress event emitted during model download, it should contain all required fields: percentage, downloadedBytes, totalBytes, and downloadSpeed.
**Validates: Requirements 2.2, 15.3**

### Property 5: Cache Invalidation on Mutation
*For any* model pull or delete operation that completes successfully, the model list cache should be invalidated.
**Validates: Requirements 2.3, 3.2, 18.2**

### Property 6: Model Status Enum Values
*For any* model status check, the returned status should be one of the valid enum values: available, downloading, or not_found.
**Validates: Requirements 5.1**

### Property 7: Router Returns Available Model
*For any* model selection by the router, the returned model name should be present in the list of available models provided to the router.
**Validates: Requirements 6.2**

### Property 8: Preferred Family Selection
*For any* routing profile with preferred families, when multiple models match the requirements, the router should select a model from the first matching preferred family.
**Validates: Requirements 6.3**

### Property 9: Profile Minimum Context Requirement
*For any* routing profile, the selected model should have a context window greater than or equal to the profile's minimum context window requirement.
**Validates: Requirements 7.1, 7.2, 7.3, 7.4**

### Property 10: Required Capabilities Matching
*For any* routing profile with required capabilities, the selected model should support all capabilities listed in the requirements.
**Validates: Requirements 7.5, 8.1, 8.2, 8.3, 8.5**

### Property 11: Glob Pattern Matching
*For any* model name and glob pattern, the pattern matching should correctly identify matches using standard glob syntax (*, ?, []).
**Validates: Requirements 9.1**

### Property 12: Model Database Lookup Fields
*For any* model that matches a database entry, the returned limits should include both contextWindow and maxOutputTokens fields.
**Validates: Requirements 9.2, 9.5**

### Property 13: Most Specific Pattern Wins
*For any* model name that matches multiple database patterns, the system should use the longest (most specific) matching pattern.
**Validates: Requirements 9.3**

### Property 14: Generation Parameter Application
*For any* configured generation parameters (temperature, maxTokens, topP), those parameters should be applied to model requests.
**Validates: Requirements 10.2**

### Property 15: Provider Options Pass-Through
*For any* provider-specific options in configuration, those options should be passed to the provider adapter without modification.
**Validates: Requirements 10.3**

### Property 16: Model-Specific Options
*For any* per-model options configured, those options should only be applied when that specific model is in use.
**Validates: Requirements 10.5**

### Property 17: Configuration Validation Errors
*For any* invalid configuration, the validation should reject it and return a descriptive error message indicating which field is invalid and why.
**Validates: Requirements 10.6, 13.4, 13.5, 13.6**

### Property 18: Configuration Precedence Chain
*For any* configuration value specified in multiple sources (CLI flags, environment variables, config file), the effective value should follow the precedence: CLI > Env > File.
**Validates: Requirements 11.7, 12.5**

### Property 19: Parameter Validation Bounds
*For any* generation parameter, values outside the valid range should be rejected: temperature ∈ [0.0, 2.0], maxTokens > 0, topP ∈ [0.0, 1.0].
**Validates: Requirements 13.1, 13.2, 13.3**

### Property 20: Family Detection Pattern Matching
*For any* model name containing family keywords (llama, mistral, codellama, deepseek-coder, starcoder, phi, gemma), the system should categorize it into the corresponding family.
**Validates: Requirements 16.1, 16.2, 16.3, 16.4**

### Property 21: Cache Expiration Behavior
*For any* cached data past its TTL, the next request should fetch fresh data from the provider.
**Validates: Requirements 18.3**

### Property 22: Model Info Caching Duration
*For any* model info request, the result should be cached for 5 minutes.
**Validates: Requirements 18.5**



## Error Handling

### Model Management Service Errors

| Error | Cause | Recovery |
|-------|-------|----------|
| Model Not Found | Model doesn't exist locally or remotely | List available models, suggest similar names |
| Download Failed | Network error, disk full, permission denied | Check connectivity, disk space, retry with backoff |
| Delete Failed | Model in use, permission denied | Stop using model, check permissions |
| Provider Offline | Cannot connect to provider | Use cached data, suggest checking provider status |
| Cache Corruption | Invalid cache data | Clear cache, fetch fresh data |
| Model In Use | Attempting to delete active model | Notify user, suggest switching models first |

### Model Router Errors

| Error | Cause | Recovery |
|-------|-------|----------|
| No Compatible Models | No models match profile requirements | Suggest installing compatible models, try fallback profile |
| Invalid Profile | Unknown profile name | List available profiles, suggest closest match |
| Configuration Error | Invalid routing config | Validate config, provide specific error |
| Capability Mismatch | Required capability not available | List models with capability, suggest alternatives |

### Model Database Errors

| Error | Cause | Recovery |
|-------|-------|----------|
| Pattern Syntax Error | Invalid glob pattern | Validate pattern, provide syntax help |
| No Pattern Match | Model not in database | Use default limits, log warning |
| Ambiguous Match | Multiple equally specific patterns | Use first match, log warning |

### Configuration Manager Errors

| Error | Cause | Recovery |
|-------|-------|----------|
| Validation Failed | Invalid parameter values | List validation errors with field names |
| File Not Found | Config file missing | Use defaults, create example config |
| Parse Error | Invalid YAML/JSON syntax | Show syntax error location, suggest fix |
| Type Mismatch | Wrong value type | Show expected type, provide example |
| Unknown Field | Unrecognized config key | Ignore with warning, list valid keys |

### Progress Tracking Errors

| Error | Cause | Recovery |
|-------|-------|----------|
| Download Timeout | Network too slow | Increase timeout, retry |
| Cancellation | User cancelled download | Clean up partial download |
| Disk Full | Insufficient space | Show space required, suggest cleanup |
| Checksum Mismatch | Corrupted download | Retry download, verify integrity |



## Testing Strategy

### Unit Tests

Unit tests verify specific examples, edge cases, and error conditions for individual components:

**Model Management Service**:
- List models returns array of ModelInfo
- Pull model emits progress events
- Delete model invalidates cache
- Show model returns detailed info
- Get status returns correct enum value
- Cache hit/miss behavior
- Offline mode uses cached data
- Error messages are descriptive

**Model Router**:
- Select model from available list
- Prefer models from preferred families
- Filter by minimum context window
- Filter by required capabilities
- Apply configuration overrides
- Fallback profile logic
- Error when no compatible models
- Handle unknown model capabilities

**Model Database**:
- Glob pattern matching (*, ?, [])
- Most specific pattern wins
- Default limits for unknown models
- Family detection from model names
- Capability lookup
- Cache pattern match results

**Configuration Manager**:
- Load from multiple sources
- Precedence: CLI > Env > File
- Validate parameter bounds
- Merge configurations correctly
- Per-model option overrides
- Validation error messages
- Handle missing config files

**Progress Tracking**:
- Initial event at 0%
- Final event at 100%
- Cancellation event
- Error event with details
- All required fields present

### Property-Based Tests

Property tests verify universal properties across all inputs using randomized test data. Each test should run a minimum of 100 iterations.

**Test Configuration**:
- Use `fast-check` library for TypeScript property-based testing
- Minimum 100 iterations per property test
- Each test references its design document property number
- Tag format: `Feature: stage-07-model-management, Property N: <property text>`

**Key Properties to Test**:
- Property 1: Model list structure (generate random model data, verify structure)
- Property 2: Cache timing (generate random timestamps, verify cache behavior)
- Property 3: Error messages (generate random errors, verify non-empty messages)
- Property 4: Progress events (generate random progress data, verify fields)
- Property 7: Router selection (generate random model lists, verify selection is from list)
- Property 9: Context requirements (generate random profiles and models, verify minimum met)
- Property 10: Capability matching (generate random capability requirements, verify all present)
- Property 11: Glob patterns (generate random model names and patterns, verify matching)
- Property 13: Pattern specificity (generate overlapping patterns, verify most specific wins)
- Property 18: Configuration precedence (generate random configs, verify precedence order)
- Property 19: Parameter bounds (generate random parameter values, verify validation)
- Property 20: Family detection (generate random model names, verify family categorization)

**Generators**:
```typescript
// Example generators for property tests
const arbModelInfo = fc.record({
  name: fc.string({ minLength: 1, maxLength: 50 }),
  family: fc.constantFrom('llama', 'mistral', 'codellama', 'phi', 'gemma', 'unknown'),
  size: fc.integer({ min: 1e9, max: 100e9 }),
  parameters: fc.integer({ min: 1, max: 70 }),
  quantization: fc.constantFrom('q4_0', 'q8_0', 'f16', 'f32'),
  contextWindow: fc.integer({ min: 2048, max: 128000 }),
  maxOutputTokens: fc.option(fc.integer({ min: 512, max: 8192 })),
  modifiedAt: fc.date(),
  capabilities: fc.record({
    toolCalling: fc.boolean(),
    vision: fc.boolean(),
    streaming: fc.boolean()
  })
});

const arbRoutingProfile = fc.record({
  name: fc.constantFrom('fast', 'general', 'code', 'creative'),
  preferredFamilies: fc.array(fc.string(), { minLength: 1, maxLength: 5 }),
  minContextWindow: fc.integer({ min: 2048, max: 32768 }),
  requiredCapabilities: fc.array(
    fc.constantFrom('toolCalling', 'vision', 'streaming'),
    { maxLength: 3 }
  )
});

const arbGenerationOptions = fc.record({
  temperature: fc.float({ min: 0.0, max: 2.0 }),
  maxTokens: fc.integer({ min: 1, max: 8192 }),
  topP: fc.float({ min: 0.0, max: 1.0 })
});

const arbProgressEvent = fc.record({
  percentage: fc.integer({ min: 0, max: 100 }),
  downloadedBytes: fc.integer({ min: 0, max: 10e9 }),
  totalBytes: fc.integer({ min: 1, max: 10e9 }),
  downloadSpeed: fc.integer({ min: 0, max: 100e6 }),
  status: fc.constantFrom('downloading', 'complete', 'cancelled', 'error')
});
```

### Integration Tests

Integration tests verify interactions between components:

- Model Management Service → Provider Adapter: List, pull, delete operations
- Model Router → Model Database: Lookup limits and capabilities
- Configuration Manager → All Services: Apply configuration
- Cache → Provider: Cache hit/miss behavior
- Progress Tracking → UI: Event emission and handling
- Routing → Configuration: Override application

### Performance Tests

Performance tests verify system efficiency:

- Model list caching reduces provider queries (< 1 query per minute)
- Pattern matching latency (< 1ms per lookup)
- Configuration merging speed (< 10ms)
- Cache lookup speed (< 1ms)
- Router selection speed (< 5ms for 100 models)

### Manual Testing

Manual testing scenarios for user-facing features:

1. List models and verify output format
2. Pull a model and verify progress display
3. Delete a model and verify removal
4. Show model info and verify details
5. Use routing profile and verify model selection
6. Override profile with configuration
7. Test offline mode with cached data
8. Test invalid configuration rejection
9. Test environment variable overrides
10. Test CLI flag precedence
11. Test model family detection
12. Test capability-based filtering

