# Model Management System

**Last Updated:** January 27, 2026  
**Status:** Source of Truth

**Related Documents:**

- `dev_ModelDB.md` - Model database schema and access patterns
- `dev_ModelCompiler.md` - Model profile compilation system
- `dev_ContextManagement.md` - Context sizing, tiers, VRAM
- `dev_ProviderSystem.md` - Provider adapters and integration
- `dev_ContextCompression.md` - Model size impact on compression reliability

---

## Overview

The Model Management System handles model discovery, metadata enrichment, tool support detection, and context window configuration. It bridges shipped model profiles with user-installed models.

**Core Responsibility:** Track installed models and their capabilities.

---

## Core Architecture

### Model Data Sources

**See `dev_ModelCompiler.md` for detailed compilation system documentation.**

```
Master Database (LLM_profiles.json)
  ├─ Source of truth for model metadata
  ├─ Edited only by developers
  ├─ READ ONLY by ProfileCompiler
  └─ Contains: id, name, description, abilities, tool_support, context_profiles
  ↓
ProfileCompiler (on app startup)
  ├─ Queries Ollama for installed models
  ├─ Matches with master database
  ├─ Applies "user-unknown-model" template for unknown models
  └─ Writes to user file
  ↓
User File (~/.ollm/LLM_profiles.json)
  ├─ Contains ONLY installed models
  ├─ READ by entire app (ProfileManager, ModelDatabase, etc.)
  ├─ User can manually edit
  └─ Rebuilt on each app startup
  ↓
User Installed Models (user_models.json)
  ├─ Tracks installed models from provider
  ├─ Enriched with metadata from user file
  ├─ User overrides preserved
  └─ Updated by /model list command
  ↓
Model Selection Menu
  └─ Shows only models from user_models.json
```

**Key Principle:** Master database is READ ONLY by ProfileCompiler. All other components read from user file. This enables future database migration by changing only the ProfileCompiler.

---

## Model Discovery Flow

### /model list Command

```
User runs /model list
  ↓
Query provider for installed models
  ├─ Ollama: GET /api/tags
  ├─ vLLM: GET /v1/models
  └─ OpenAI-compatible: GET /v1/models
  ↓
Load existing user_models.json
  ↓
For each installed model:
  ├─ Match with LLM_profiles.json by id
  │  ├─ Found: Use profile metadata
  │  └─ Not found: Use fallback defaults
  ├─ Preserve user overrides
  │  ├─ manual_context
  │  ├─ tool_support_source (if user_confirmed)
  │  └─ tool_support_confirmed_at
  └─ Update last_seen timestamp
  ↓
Remove models not returned by provider
  ↓
Write updated user_models.json
  ↓
Display model list to user
```

---

## Tool Support Detection

### Detection Methods

```
Unknown Model Encountered
  ↓
Check tool_support in user_models.json
  ├─ tool_support_source: 'user_confirmed' → Use saved value
  ├─ tool_support_source: 'auto_detected' → Use saved value
  ├─ tool_support_source: 'runtime_error' → Use saved value
  └─ tool_support_source: 'profile' → Can be overridden
  ↓
If no reliable data, prompt user:
  "Does this model support tools? (y/n/auto-detect)"
  ↓
User Choice:
  ├─ y → Set tool_support: true, source: 'user_confirmed'
  ├─ n → Set tool_support: false, source: 'user_confirmed'
  └─ auto-detect → Run detection test
     ↓
     Auto-Detection Test:
       ├─ Send test request with minimal tool schema
       ├─ 5s timeout
       ├─ Check for tool errors vs success
       └─ Save result with source: 'auto_detected'
  ↓
Save to user_models.json with timestamp
```

### Runtime Learning

```
During Normal Usage
  ↓
Provider returns tool error
  ↓
Detect error pattern
  ↓
Prompt user:
  "This model appears to not support tools. Update metadata? (y/n)"
  ↓
User Response:
  ├─ y → Update user_models.json
  │     ├─ tool_support: false
  │     ├─ tool_support_source: 'runtime_error'
  │     └─ tool_support_confirmed_at: timestamp
  └─ n → Apply session-only override
        └─ Don't save to file
```

### Tool Support Precedence

**Priority Order (highest to lowest):**

1. `user_confirmed` - User explicitly confirmed (never auto-overwritten)
2. `auto_detected` - Automatically detected via test
3. `runtime_error` - Detected from actual errors
4. `profile` - Default from shipped profiles (can be overridden)

---

## Context Window Management

### Context Profile Structure

```json
{
  "context_profiles": [
    {
      "size": 4096,
      "size_label": "4k",
      "ollama_context_size": 3482
    },
    {
      "size": 8192,
      "size_label": "8k",
      "ollama_context_size": 6963
    }
  ],
  "default_context": 4096
}
```

### Context Selection Flow

```
User selects model
  ↓
Load context_profiles from user_models.json
  ↓
Present context options:
  ├─ Auto (hardware-based detection)
  ├─ Manual (user input)
  └─ Profile sizes (4k, 8k, 16k, etc.)
  ↓
User selects context size
  ↓
If Manual:
  ├─ Prompt for token count
  ├─ Save as manual_context in user_models.json
  └─ Use for this model going forward
  ↓
If Profile size:
  ├─ Use ollama_context_size (85% of displayed size)
  └─ Send to provider via num_ctx parameter
  ↓
If Auto:
  ├─ Detect hardware capability
  ├─ Calculate optimal context size
  └─ Use detected size
```

---

## Fallback Model Handling

### Unknown Model Seeding

```
Model not in LLM_profiles.json
  ↓
Load fallback_model template
  ↓
Create user_models.json entry:
  ├─ description: "No metadata available."
  ├─ tool_support: false (safe default)
  ├─ tool_support_source: 'profile'
  ├─ context_profiles: Generated from model size or fallback
  └─ default_context: From fallback or first profile
  ↓
Prompt user for tool support
  ↓
Save enriched entry to user_models.json
```

### Fallback Template

```json
{
  "fallback_model": {
    "description": "No metadata available.",
    "tool_support": false,
    "context_sizes": [2048, 4096, 8192],
    "default_context": 4096
  }
}
```

---

## Model Routing (Planned)

### Routing Profiles

```
User Request
  ↓
Model Router
  ↓
Select Profile:
  ├─ Fast: Small models (< 7B)
  ├─ General: Medium models (7-13B)
  ├─ Code: Code-specialized models
  └─ Creative: Large models (> 13B)
  ↓
Match to Available Models:
  ├─ Filter by profile criteria
  ├─ Check availability in user_models.json
  └─ Select best match
  ↓
Route to Provider
```

**Profile Criteria:**

- Model size (parameters)
- Context window size
- Specialization (code, chat, etc.)
- Tool support capability
- Performance requirements

---

## Model Size Detection

### Overview

Model size (parameter count) is used for reliability tracking in the compression system (see `dev_ContextCompression.md`). Larger models produce better summaries and maintain context quality through multiple compressions.

### Detection Methods

**1. From Model Name (Primary)**

```typescript
// Extract size from model name
// Examples: "llama3:7b" → 7, "mistral:13b" → 13, "qwen2.5:72b" → 72
function detectModelSize(modelName: string): number {
  const match = modelName.match(/(\d+)b/i);
  if (match) return parseInt(match[1]);

  // Fallback to default
  return 7; // Assume 7B if unknown
}
```

**2. From Model Metadata (Secondary)**

```typescript
// Some providers return parameter count in metadata
interface ModelMetadata {
  parameter_count?: number; // e.g., 7000000000 for 7B
  size?: string; // e.g., "7B"
}
```

**3. From LLM_profiles.json (Tertiary)**

```json
{
  "models": [
    {
      "id": "llama3:7b",
      "parameters": 7, // Billions of parameters
      "description": "7B parameter model"
    }
  ]
}
```

### Model Size Categories

| Size         | Category     | Compression Quality | Reliability                      |
| ------------ | ------------ | ------------------- | -------------------------------- |
| 3B and below | Small        | Basic               | Low after 2-3 compressions       |
| 7B           | Medium-Small | Good                | Moderate after 3-4 compressions  |
| 13B          | Medium       | Very Good           | Good after 4-5 compressions      |
| 30B          | Large        | Excellent           | Very Good after 5-7 compressions |
| 70B+         | Very Large   | Outstanding         | Excellent after 7+ compressions  |

### Integration with Reliability System

Model size is a key factor in the reliability score calculation:

```typescript
// From dev_ContextCompression.md
const modelFactor =
  modelSize >= 70
    ? 0.95 // 70B+ models
    : modelSize >= 30
      ? 0.85 // 30B models
      : modelSize >= 13
        ? 0.7 // 13B models
        : modelSize >= 7
          ? 0.5 // 7B models
          : 0.3; // 3B and below

const reliabilityScore = modelFactor * compressionPenalty * contextConfidence;
```

**Why Model Size Matters:**

- Larger models understand context better
- Better at summarization (compression quality)
- Preserve nuance through multiple compressions
- Less prone to hallucination after compression

### Storage in user_models.json

```json
{
  "models": [{
    "id": "llama3:7b",
    "name": "Llama 3 7B",
    "parameters": 7,  // Detected or from profile
    "tool_support": true,
    "context_profiles": [...]
  }]
}
```

**Detection Priority:**

1. Explicit value in user_models.json (user override)
2. Value from LLM_profiles.json (shipped profile)
3. Extracted from model name (regex)
4. Default to 7B (safe assumption)

---

## Key Interconnections

### LLM_profiles.json → user_models.json

- Shipped profiles are source of truth
- `/model list` enriches installed models with profile data
- Profile metadata merged into user_models.json
- User overrides preserved during updates

### user_models.json → Model Selection

- Model menu reads from user_models.json only
- If empty, prompts user to run `/model list`
- Context options from context_profiles
- Tool support from tool_support field

### Tool Support Detection → user_models.json

- Detection results saved with source and timestamp
- User confirmations have highest priority
- Runtime errors trigger update prompts
- Profile defaults can be overridden

### Context Selection → Provider

- User selection → ollama_context_size (85% value)
- Manual context saved to user_models.json
- Auto context uses hardware detection
- Provider receives num_ctx parameter

### Model Router → user_models.json

- Router queries available models
- Filters by routing profile criteria
- Selects best match from installed models
- Falls back if primary unavailable

### Model Size → Reliability Tracking

- Model size detected from name or profile
- Used in compression reliability calculation (see `dev_ContextCompression.md`)
- Larger models = better compression quality
- Affects user warnings about compression limits

---

## File Locations

**Profile Compilation (see `dev_ModelCompiler.md`):**

- `packages/cli/src/config/LLM_profiles.json` - Master database (READ ONLY by ProfileCompiler)
- `~/.ollm/LLM_profiles.json` - User file (READ by entire app)
- `packages/cli/src/services/profileCompiler.ts` - Compilation logic

**Profile Management:**

- `~/.ollm/user_models.json` - User installed models

**Model Management:**

- `packages/core/src/services/modelManagementService.ts` - Model operations
- `packages/cli/src/commands/modelCommands.ts` - CLI commands

**Model Routing:**

- `packages/core/src/routing/modelRouter.ts` - Routing logic (planned)
- `packages/core/src/routing/routingProfiles.ts` - Profile definitions (planned)
- `packages/core/src/routing/modelDatabase.ts` - Model database

**Context Management:**

- `packages/cli/src/features/context/contextSizing.ts` - Context calculations (see dev_ContextManagement.md)
- `packages/cli/src/features/profiles/ProfileManager.ts` - Profile loading

---

**Note:** This document focuses on model management. For model profile compilation, see `dev_ModelCompiler.md`. For context sizing logic, see `dev_ContextManagement.md`. For provider integration, see `dev_ProviderSystem.md`.
