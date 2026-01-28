# LLM Model Compiler System

**Last Updated:** January 27, 2026  
**Status:** Source of Truth

**Related Documents:**

- `dev_ModelDB.md` - Model database schema and access patterns
- `dev_ModelManagement.md` - Model selection, profiles, tool support
- `dev_ContextManagement.md` - Context sizing, VRAM

---

## Overview

The LLM Model Compiler System builds user-specific model profiles by querying Ollama for installed models and matching them against the master database. It creates and maintains `~/.ollm/LLM_profiles.json` with only the models the user has installed.

**Core Responsibility:** Compile user-specific model profiles from installed models, providing fallback templates for unknown models.

---

## Architecture Principle

**CRITICAL:** The master database is READ ONLY by the ProfileCompiler. All other components read from the user file.

```
Master DB (packages/cli/src/config/LLM_profiles.json)
  ↓ READ ONLY by ProfileCompiler
ProfileCompiler
  ↓ WRITES
User File (~/.ollm/LLM_profiles.json)
  ↓ READ by entire app
ProfileManager, ContextManager, ModelDatabase, etc.
```

**Why This Matters:**

- Future database migration = change compiler only
- Single source of truth for runtime
- User can customize their profiles
- System naturally aligns when DB changes

---

## Core Components

### 1. ProfileCompiler (`packages/cli/src/services/profileCompiler.ts`)

**Responsibilities:**

- Query Ollama for installed models
- Load master database (ONLY component that does this)
- Match installed models with master database
- Apply unknown-model template for unrecognized models
- Preserve user overrides on recompilation
- Write to user file

**Key Methods:**

```typescript
async compileUserProfiles(): Promise<void>
  // Main entry point - called on app startup
  // 1. Load master DB
  // 2. Query Ollama
  // 3. Match models
  // 4. Merge with existing user file
  // 5. Save to user location

private loadMasterDatabase(): Promise<ProfilesData>
  // ONLY place that reads from packages/cli/src/config/LLM_profiles.json
  // Returns master database with ALL models

private getInstalledModels(): Promise<string[]>
  // Queries Ollama: GET /api/tags
  // Returns array of model IDs (e.g., ["qwen2.5:7b", "llama3.2:3b"])
  // Fails silently if Ollama not available

private matchModels(installedModelIds, masterDb): LLMProfile[]
  // Matches installed models with master DB
  // Uses "user-unknown-model" template for unknown models
  // Returns array of profiles to save

private mergeProfiles(newProfiles, existing): LLMProfile[]
  // Preserves user overrides when recompiling
  // User edits to ~/.ollm/LLM_profiles.json are preserved
```

### 2. Master Database (`packages/cli/src/config/LLM_profiles.json`)

**Structure:**

```json
{
  "version": "0.1.0",
  "models": [
    {
      "id": "user-unknown-model",
      "name": "Unknown Model",
      "creator": "User",
      "parameters": "Based on Llama 3.2 3B",
      "quantization": "Based on Llama 3.2 3B (4-bit estimated)",
      "description": "Unknown model - please edit your settings at ~/.ollm/LLM_profiles.json",
      "abilities": ["Unknown"],
      "tool_support": false,
      "ollama_url": "Unknown",
      "max_context_window": 131072,
      "context_profiles": [
        {
          "size": 4096,
          "size_label": "4k",
          "vram_estimate": "2.5 GB",
          "ollama_context_size": 2867,
          "vram_estimate_gb": 2.5
        }
        // ... more profiles
      ],
      "default_context": 4096
    },
    {
      "id": "qwen2.5:7b",
      "name": "Qwen2.5 7B"
      // ... full metadata
    }
    // ... more known models
  ]
}
```

**Key Fields:**

- `id`: Model identifier (matches Ollama model name)
- `name`: Display name
- `creator`: Model creator/organization
- `parameters`: Model size (e.g., "7.6B")
- `quantization`: Quantization method
- `description`: Model description
- `abilities`: Array of capabilities
- `tool_support`: Boolean - supports function calling
- `ollama_url`: Link to Ollama library
- `max_context_window`: Maximum context size
- `context_profiles`: Array of context size configurations
  - `size`: User-facing context size (e.g., 4096)
  - `size_label`: Display label (e.g., "4k")
  - `ollama_context_size`: Pre-calculated 85% value (e.g., 3482)
  - `vram_estimate`: Human-readable VRAM estimate
  - `vram_estimate_gb`: Numeric VRAM estimate
- `default_context`: Default context size for this model

**Special Entry: user-unknown-model**

- Template for unknown models
- Based on llama3.2:3b defaults
- First entry in models array
- Never installed by users
- Used by ProfileCompiler for fallback

### 3. User File (`~/.ollm/LLM_profiles.json`)

**Location:**

- Windows: `C:\Users\{username}\.ollm\LLM_profiles.json`
- Linux/Mac: `~/.ollm/LLM_profiles.json`

**Structure:**

```json
{
  "version": "0.1.0",
  "last_updated": "2026-01-27T10:00:00Z",
  "source": "compiled from installed models",
  "models": [
    {
      "id": "qwen2.5:7b"
      // ... full metadata from master DB
    },
    {
      "id": "custom-model:latest",
      "name": "Unknown Model (custom-model:latest)",
      "creator": "User",
      "parameters": "Based on Llama 3.2 3B",
      "description": "Unknown model \"custom-model:latest\". Please edit your settings..."
      // ... template metadata from user-unknown-model
    }
  ]
}
```

**Key Differences from Master DB:**

- Contains ONLY installed models
- Includes metadata fields (version, last_updated, source)
- May contain unknown models with template values
- User can manually edit this file
- Rebuilt on each app startup

---

## Compilation Flow

### Startup Sequence

```
1. App starts (cli.tsx mainCLI function)
   ↓
2. Load config
   ↓
3. Call compileUserProfiles() ← FIRST THING after config
   ↓
4. ProfileCompiler runs:
   a. Load master DB (packages/cli/src/config/LLM_profiles.json)
   b. Query Ollama (GET /api/tags)
   c. Match installed models with master DB
   d. Apply unknown-model template for unrecognized models
   e. Load existing user file (if exists)
   f. Merge (preserve user overrides)
   g. Save to ~/.ollm/LLM_profiles.json
   ↓
5. ProfileManager loads from user file
   ↓
6. App continues startup
```

### Model Matching Logic

```typescript
For each installed model from Ollama:
  1. Skip if model ID is "user-unknown-model" (template itself)

  2. Look up in master DB by exact ID match

  3. If found in master DB:
     - Copy entire entry (ALL metadata)
     - Add to matched array

  4. If NOT found in master DB (unknown model):
     - Load "user-unknown-model" template
     - Copy all template fields
     - Override:
       - id: actual model ID from Ollama
       - name: "Unknown Model ({model_id})"
       - description: Instructions to edit user file
     - Add to matched array
     - Log warning in debug mode

  5. Return matched array
```

### Unknown Model Handling

**Example:** User installs `qwen2.5-coder:7b` (not in master DB)

```
1. Ollama reports: "qwen2.5-coder:7b"
   ↓
2. ProfileCompiler looks up in master DB
   ↓
3. Not found → Load "user-unknown-model" template
   ↓
4. Create entry:
   {
     "id": "qwen2.5-coder:7b",
     "name": "Unknown Model (qwen2.5-coder:7b)",
     "creator": "User",
     "parameters": "Based on Llama 3.2 3B",
     "quantization": "Based on Llama 3.2 3B (4-bit estimated)",
     "description": "Unknown model \"qwen2.5-coder:7b\". Please edit...",
     "abilities": ["Unknown"],
     "tool_support": false,
     "ollama_url": "Unknown",
     "max_context_window": 131072,
     "context_profiles": [ /* llama3.2:3b defaults */ ],
     "default_context": 4096
   }
   ↓
5. Save to user file
   ↓
6. User can manually edit ~/.ollm/LLM_profiles.json to customize
```

**User Customization:**
User can edit the file to update:

- `name`: "Qwen2.5 Coder 7B"
- `parameters`: "7.6B"
- `quantization`: "4-bit"
- `tool_support`: true
- `context_profiles`: Adjust VRAM estimates
- Any other field

**Preservation:**
On next startup, ProfileCompiler preserves user edits via `mergeProfiles()`.

---

## User Override Preservation

### Merge Logic

```typescript
For each new profile from compilation:
  1. Look up existing profile in user file by ID

  2. If no existing profile:
     - Use new profile as-is

  3. If existing profile found:
     - Start with new profile (latest from master DB)
     - Overlay user-added fields that don't exist in new profile
     - Preserve custom fields user added
     - Result: Updated metadata + user customizations

  4. Return merged profile
```

**Example:**

User file before recompilation:

```json
{
  "id": "qwen2.5:7b",
  "name": "Qwen2.5 7B",
  "custom_field": "user_value",
  "tool_support": true
}
```

Master DB updated:

```json
{
  "id": "qwen2.5:7b",
  "name": "Qwen2.5 7B (Updated)",
  "tool_support": true,
  "new_field": "new_value"
}
```

User file after recompilation:

```json
{
  "id": "qwen2.5:7b",
  "name": "Qwen2.5 7B (Updated)", // ← Updated from master
  "tool_support": true,
  "new_field": "new_value", // ← Added from master
  "custom_field": "user_value" // ← Preserved from user
}
```

---

## Integration Points

### 1. App Startup (`packages/cli/src/cli.tsx`)

```typescript
// After config loading
try {
  const { compileUserProfiles } = await import('./services/profileCompiler.js');
  await compileUserProfiles();
} catch (error) {
  // Non-fatal - app can continue with existing profiles
  if (process.env.OLLM_LOG_LEVEL === 'debug') {
    console.warn('Failed to compile user profiles:', error);
  }
}
```

### 2. ProfileManager (`packages/cli/src/features/profiles/ProfileManager.ts`)

```typescript
private loadProfiles(): LLMProfile[] {
  // Read from USER file (~/.ollm/LLM_profiles.json)
  // NOT from app config (packages/cli/src/config/LLM_profiles.json)

  if (!existsSync(this.userProfilesPath)) {
    // Trigger async compilation for next startup
    compileUserProfiles().catch(err => { /* ... */ });
    return [];
  }

  const raw = readFileSync(this.userProfilesPath, 'utf-8');
  const data = JSON.parse(raw) as ProfilesData;
  return data.models.map(m => this.normalizeRawProfile(m));
}
```

### 3. ModelDatabase (`packages/core/src/routing/modelDatabase.ts`)

```typescript
function tryLoadProfilesFromUser(): ModelEntry[] | null {
  // Read from USER file (~/.ollm/LLM_profiles.json)
  // NOT from app config

  const homeDir = process.env.VITEST ? join(tmpdir(), `ollm-vitest-${process.pid}`) : homedir();
  const p = join(homeDir, '.ollm', 'LLM_profiles.json');

  if (!existsSync(p)) return null;
  // ... load and parse
}
```

---

## Error Handling

### Ollama Not Available

```typescript
// ProfileCompiler handles gracefully
try {
  const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`, {
    signal: controller.signal, // 2s timeout
  });

  if (!response.ok) {
    // Silent fail - return empty array
    return [];
  }
} catch (error) {
  // Silent fail - Ollama might not be running
  return [];
}
```

**Result:** App continues with existing user file or empty profiles.

### Master DB Not Found

```typescript
if (!existsSync(this.masterDbPath)) {
  throw new Error(`Master database not found at ${this.masterDbPath}`);
}
```

**Result:** Compilation fails, but app can continue with existing user file.

### User File Corrupted

```typescript
try {
  const raw = readFileSync(this.userProfilePath, 'utf-8');
  const data = JSON.parse(raw);
} catch (error) {
  // Log warning, return null
  return null;
}
```

**Result:** Compilation creates new user file from scratch.

---

## Testing Strategy

### Test Suite 1: ProfileCompiler Tests (`profileCompiler.test.ts`)

**Purpose:** Verify ProfileCompiler functionality

**Tests:**

- Master DB validation (exists, valid JSON, has models)
- ProfileCompiler construction
- User profile compilation
- Model matching (known and unknown)
- User override preservation
- Error handling (Ollama unavailable, timeout)
- Regression detectors (file must exist, valid structure)

### Test Suite 2: Integration Tests (`ProfileManager.integration.test.ts`)

**Purpose:** Verify end-to-end flow

**Tests:**

- TEST 1: Master DB validation
- TEST 2: ProfileCompiler creates user file
- TEST 3: User file exists (MUST FAIL if not created)
- Architecture validation

**Critical Tests:**

```typescript
it('REGRESSION DETECTOR: User file MUST exist in ~/.ollm/', () => {
  // This test MUST FAIL if compilation is broken
  expect(existsSync(userProfilePath)).toBe(true);
});
```

---

## File Locations

| File                                                   | Purpose            | Read By              | Write By        |
| ------------------------------------------------------ | ------------------ | -------------------- | --------------- |
| `packages/cli/src/config/LLM_profiles.json`            | Master database    | ProfileCompiler ONLY | Developers      |
| `~/.ollm/LLM_profiles.json`                            | User profiles      | Entire app           | ProfileCompiler |
| `packages/cli/src/services/profileCompiler.ts`         | Compiler logic     | -                    | -               |
| `packages/cli/src/features/profiles/ProfileManager.ts` | Profile management | App                  | -               |
| `packages/core/src/routing/modelDatabase.ts`           | Model routing      | App                  | -               |

---

## Future Enhancements

### Database Migration

When migrating to proper database:

```
1. Replace master DB file with database connection
   ↓
2. Update ProfileCompiler.loadMasterDatabase()
   - Change from readFileSync() to database query
   ↓
3. All other code unchanged
   - Still reads from ~/.ollm/LLM_profiles.json
   - ProfileCompiler still writes to user file
   ↓
4. System naturally aligns
```

**Why This Works:**

- ProfileCompiler is ONLY component that reads master DB
- User file format stays the same
- No changes needed in ProfileManager, ModelDatabase, etc.

### Model Change Detection

**Future:** Detect when models are added/removed without restart

```typescript
// Watch Ollama for model changes
ollamaWatcher.on('model-added', async (modelId) => {
  await compileUserProfiles();
  profileManager.reload();
});

ollamaWatcher.on('model-removed', async (modelId) => {
  await compileUserProfiles();
  profileManager.reload();
});
```

---

## Debugging

### Enable Debug Logging

```bash
# Windows
$env:OLLM_LOG_LEVEL='debug'
npm start

# Linux/Mac
OLLM_LOG_LEVEL=debug npm start
```

**Debug Output:**

```
[ProfileCompiler] Loaded master database with 50 models
[ProfileCompiler] Found 12 installed models: ["qwen2.5:7b", ...]
[ProfileCompiler] Unknown model "custom-model:latest" - using fallback template
[ProfileCompiler] Compiled 12 model profiles to user location
[ProfileCompiler] Saved 12 profiles to C:\Users\rad3k\.ollm\LLM_profiles.json
```

### Check User File

```bash
# Windows
cat $env:USERPROFILE\.ollm\LLM_profiles.json

# Linux/Mac
cat ~/.ollm/LLM_profiles.json
```

### Verify Ollama Models

```bash
curl http://localhost:11434/api/tags
```

---

## Common Issues

### Issue: User file not created

**Symptoms:** ProfileManager returns empty profiles

**Causes:**

1. Ollama not running
2. Master DB not found
3. Compilation failed silently

**Solution:**

```bash
# Check Ollama
curl http://localhost:11434/api/tags

# Check master DB
ls packages/cli/src/config/LLM_profiles.json

# Enable debug logging
$env:OLLM_LOG_LEVEL='debug'
npm start
```

### Issue: Unknown models not detected

**Symptoms:** Custom models missing from user file

**Causes:**

1. "user-unknown-model" template missing from master DB
2. Model ID mismatch
3. Compilation logic error

**Solution:**

```bash
# Verify template exists
cat packages/cli/src/config/LLM_profiles.json | grep "user-unknown-model"

# Check Ollama model names
curl http://localhost:11434/api/tags | jq '.models[].name'

# Enable debug logging
$env:OLLM_LOG_LEVEL='debug'
npm start
```

### Issue: User edits lost on restart

**Symptoms:** Manual edits to user file disappear

**Causes:**

1. Merge logic not preserving custom fields
2. Model ID changed
3. User file corrupted

**Solution:**

- Check merge logic in `mergeProfiles()`
- Verify model ID matches Ollama
- Backup user file before restart

---

## Summary

The LLM Model Compiler System:

- ✅ Compiles user-specific profiles from installed models
- ✅ Provides fallback templates for unknown models
- ✅ Preserves user customizations
- ✅ Enables future database migration
- ✅ Single source of truth for runtime
- ✅ User can manually edit profiles
- ✅ Comprehensive test coverage

**Key Principle:** Master DB is READ ONLY by ProfileCompiler. All other components read from user file.
