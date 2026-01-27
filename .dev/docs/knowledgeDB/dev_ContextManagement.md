# Context Management System

**Last Updated:** January 27, 2026  
**Status:** Source of Truth

**Related Documents:**
- `dev_ContextCompression.md` - Compression, checkpoints, snapshots
- `dev_PromptSystem.md` - Prompt structure, tiers, modes
- `dev_ModelDB.md` - Model database schema and access patterns
- `dev_ModelCompiler.md` - User profile compilation system

---

## Overview

The Context Management System determines context window sizes, monitors VRAM, and manages token counting. It provides the foundation for compression and prompt systems.

**Core Responsibility:** Determine and maintain the context size that will be sent to Ollama.

---

## Architecture

### Core Components

1. **Context Manager** (`contextManager.ts`)
   - Main orchestration layer
   - Coordinates all context services
   - Manages conversation state
   - Owns system prompt

2. **VRAM Monitor** (`vramMonitor.ts`)
   - Tracks GPU memory availability
   - Detects low memory conditions
   - Platform-specific implementations (NVIDIA, AMD, Apple Silicon)

3. **Token Counter** (`tokenCounter.ts`)
   - Measures context usage in tokens
   - Caches token counts for performance
   - Estimates tokens for messages

4. **Context Pool** (`contextPool.ts`)
   - Manages dynamic context sizing
   - Calculates optimal context size based on VRAM
   - Handles context resizing

5. **Memory Guard** (`memoryGuard.ts`)
   - Prevents OOM errors
   - Emits warnings at memory thresholds
   - Triggers emergency actions

---

## Context Tiers

Context tiers are **labels** that represent different context window sizes. They are the **result** of user selection or hardware detection, not decision makers.

### Tier Definitions

Tiers are now **dynamically mapped** based on the model's available context profiles. The system no longer uses hardcoded size thresholds.

**Example with 4 profiles:**

| Tier | Profile Index | Use Case |
|------|---------------|----------|
| Tier 1 (Minimal) | Profile 0 | Quick tasks, minimal context |
| Tier 2 (Basic) | Profile 1 | Standard conversations |
| Tier 3 (Standard) | Profile 2 | Complex tasks, code review |
| Tier 4 (Premium) | Profile 3 | Large codebases, long conversations |
| Tier 5 (Ultra) | Profile 3 | Maximum context (same as Tier 4 if only 4 profiles) |

**Example with 5+ profiles:**

| Tier | Profile Index | Calculation |
|------|---------------|-------------|
| Tier 1 (Minimal) | 0 | First profile |
| Tier 2 (Basic) | 25% position | Math.floor(totalProfiles * 0.25) |
| Tier 3 (Standard) | 50% position | Math.floor(totalProfiles * 0.5) |
| Tier 4 (Premium) | 75% position | Math.floor(totalProfiles * 0.75) |
| Tier 5 (Ultra) | Last profile | totalProfiles - 1 |

**Key Points:**
- Tiers are **labels only** - they don't make decisions
- Context size drives everything
- Tier mapping adapts to model's available profiles (1-5+ profiles)
- No hardcoded size thresholds (4096, 8192, 16384, etc.)
- Tiers are used for prompt selection (see `dev_PromptSystem.md`)
- The 85% values are **pre-calculated by devs** in `LLM_profiles.json`

### Tier Detection Logic

```typescript
// OLD (WRONG - hardcoded thresholds):
if (size >= 65536) return TIER_5_ULTRA;
if (size >= 32768) return TIER_4_PREMIUM;
if (size >= 16384) return TIER_3_STANDARD;
// ...

// NEW (CORRECT - profile-based):
const profiles = modelInfo.contextProfiles.sort((a, b) => a.size - b.size);
const matchingProfile = profiles.find(p => p.size >= size);
const profileIndex = profiles.indexOf(matchingProfile);
// Map profileIndex to tier based on total profile count
```

---

## Context Size Flow

### User Selection → Ollama

```
1. User selects context size (e.g., 16K)
   ↓
2. System reads LLM_profiles.json
   ↓
3. Gets pre-calculated ollama_context_size (e.g., 13926 for 16K)
   ↓
4. System determines tier label (Tier 3 for 16K)
   ↓
5. System builds prompt based on tier label (see dev_PromptSystem.md)
   ↓
6. System sends prompt + ollama_context_size (13926) to Ollama
   ↓
7. Ollama uses 100% of that value (13926 tokens)
```

**Critical:** The 85% is already calculated in `LLM_profiles.json`. No runtime calculation of 85% should exist in the code.

### Data Flow Chain

```
LLM_profiles.json (source of truth)
  ↓ read by
ProfileManager.getModelEntry(modelId)
  ↓ provides modelEntry to
calculateContextSizing(requestedSize, modelEntry)
  ↓ returns { allowed, ollamaContextSize, ratio }
  ↓ used by
ModelContext.sendToLLM() OR nonInteractive.ts
  ↓ updates
contextActions.updateConfig({ targetSize: ollamaContextSize })
  ↓ sets
context.maxTokens = ollamaContextSize
  ↓ sent to
provider.chatStream({ options: { num_ctx: ollamaContextSize } })
  ↓ enforced by
Ollama (stops at ollamaContextSize)
```

**Critical:** `context.maxTokens` MUST equal `ollamaContextSize`, not user's selection.

---

## LLM_profiles.json Structure

### Profile Format

```json
{
  "models": [{
    "id": "llama3.2:3b",
    "context_profiles": [{
      "size": 4096,                    // User sees this (for tier detection)
      "ollama_context_size": 3482,     // We send this to Ollama valuse set by devs
      "size_label": "4k",
      "vram_estimate_gb": 2.0          // VRAM estimate
    }]
  }]
}
```

**Why pre-calculate ratios?**
- Model-specific (different models need different ratios)
- Empirically tested values
- No runtime calculation = no bugs
- Single source of truth

**Critical Architecture:**
- **Tier detection** uses `size` field (user-facing value)
- **Ollama limit** uses `ollama_context_size` field (85% pre-calculated)
- **Compression triggers** use percentage of `ollama_context_size`
- The 85% cap is internal and should NOT degrade tier capabilities

---

## Auto-Sizing

Auto-sizing picks the optimal context size at startup based on available VRAM, then **stays fixed** for the session.

### Auto-Sizing Flow

```
1. System checks VRAM availability
   ↓
2. Calculates maximum possible context size
   ↓
3. Picks one tier below maximum (safety margin)
   ↓
4. Sets context size and LOCKS IT for session
   ↓
5. On low memory: Show warning (don't resize)
```

### Context Sizing Logic

**Step 1: Load Profile**
```typescript
const modelEntry = profileManager.getModelEntry(modelId);
```

**Step 2: Calculate Sizing**
```typescript
const contextSizing = calculateContextSizing(requestedSize, modelEntry, contextCapRatio);
// Returns: { requested: 4096, allowed: 4096, ollamaContextSize: 3482, ratio: 0.85 }
```

**Step 3: Set Context Limits (CRITICAL)**
```typescript
// Set context.maxTokens to Ollama's limit, NOT user's selection
contextActions.updateConfig({ targetSize: contextSizing.ollamaContextSize });
// Now context.maxTokens = 3482
```

**Step 4: Send to Provider**
```typescript
provider.chatStream({
  options: { num_ctx: contextSizing.ollamaContextSize }  // 3482
});
```

### Expected Behavior

- **Auto mode:** Check VRAM → pick one tier below max → FIXED for session
- **Manual mode:** User picks → FIXED for session
- **On low memory:** Show warning to user (system message)
- **No automatic mid-conversation changes**

### Warning Message Example

```
⚠️ Low memory detected (VRAM: 85% used)
Your current context size may cause performance issues.
Consider restarting with a smaller context size.
```

---

## Token Counting

### Token Counter Responsibilities

- Count tokens in messages
- Cache token counts for performance
- Estimate tokens for new content
- Track total context usage

### Usage Tracking

```typescript
interface ContextUsage {
  currentTokens: number;    // Current usage
  maxTokens: number;        // Ollama limit (85% of user selection)
  percentage: number;       // Usage percentage
  available: number;        // Remaining tokens
}
```

**Example:**
```
User selects: 16K
Ollama limit: 13926 (85%)
Current usage: 8500 tokens
Percentage: 61%
Available: 5426 tokens
```

---

## VRAM Monitoring

### VRAM Monitor Responsibilities

- Detect GPU type (NVIDIA, AMD, Apple Silicon)
- Query VRAM usage
- Emit low memory warnings
- Calculate optimal context size

### Platform Support

**NVIDIA (nvidia-smi):**
- Total VRAM
- Used VRAM
- Free VRAM
- GPU utilization

**AMD (rocm-smi):**
- Total VRAM
- Used VRAM
- Free VRAM

**Apple Silicon (system APIs):**
- Unified memory
- Memory pressure
- Available memory

### Memory Thresholds

```typescript
enum MemoryLevel {
  NORMAL,      // < 70% usage
  WARNING,     // 70-85% usage
  CRITICAL,    // 85-95% usage
  EMERGENCY    // > 95% usage
}
```

---

## Configuration

### Context Config

```typescript
interface ContextConfig {
  targetSize: number;      // Target context size (user selection)
  minSize: number;         // Minimum context size
  maxSize: number;         // Maximum context size
  autoSize: boolean;       // Enable auto-sizing
  vramBuffer: number;      // VRAM safety buffer (MB)
  kvQuantization: boolean; // Enable KV cache quantization
}
```

### Default Values

```typescript
const DEFAULT_CONTEXT_CONFIG = {
  targetSize: 8192,
  minSize: 2048,
  maxSize: 131072,
  autoSize: false,
  vramBuffer: 1024,  // 1GB safety buffer
  kvQuantization: false,
};
```

---

## Events

### Core Events

- `started` - Context management started
- `stopped` - Context management stopped
- `config-updated` - Configuration changed
- `tier-changed` - Context tier changed
- `mode-changed` - Operational mode changed

### Memory Events

- `low-memory` - Low VRAM detected
- `memory-warning` - Memory usage warning (70-85%)
- `memory-critical` - Critical memory usage (85-95%)
- `memory-emergency` - Emergency memory condition (>95%)

### Context Events

- `context-resized` - Context size changed
- `context-recalculated` - Available tokens recalculated
- `context-discovered` - New context discovered (JIT)

---

## API Reference

### Context Manager

```typescript
class ConversationContextManager {
  // Lifecycle
  async start(): Promise<void>;
  async stop(): Promise<void>;
  
  // Configuration
  updateConfig(config: Partial<ContextConfig>): void;
  
  // Context
  getUsage(): ContextUsage;
  getContext(): ConversationContext;
  
  // Messages
  async addMessage(message: Message): Promise<void>;
  async getMessages(): Promise<Message[]>;
  
  // System Prompt (see dev_PromptSystem.md)
  setSystemPrompt(content: string): void;
  getSystemPrompt(): string;
  
  // Mode & Skills (see dev_PromptSystem.md)
  setMode(mode: OperationalMode): void;
  getMode(): OperationalMode;
  setActiveSkills(skills: string[]): void;
  setActiveTools(tools: string[]): void;
  setActiveHooks(hooks: string[]): void;
  setActiveMcpServers(servers: string[]): void;
  
  // Compression (see dev_ContextCompression.md)
  async compress(): Promise<void>;
  getCheckpoints(): CompressionCheckpoint[];
  
  // Snapshots (see dev_ContextCompression.md)
  async createSnapshot(): Promise<ContextSnapshot>;
  async restoreSnapshot(snapshotId: string): Promise<void>;
  
  // Discovery
  async discoverContext(targetPath: string): Promise<void>;
  
  // Streaming
  reportInflightTokens(delta: number): void;
  clearInflightTokens(): void;
}
```

---

## Best Practices

### 1. Context Size Selection

- Start with Tier 3 (16K) for most tasks
- Use Tier 2 (8K) for quick conversations
- Use Tier 1 (2K, 4K) for minimal context needs
- Use Tier 4 (32K) for large codebases
- Use Tier 5 (64K, 128K) only when necessary (high VRAM cost)

### 2. Auto-Sizing

- Enable for automatic optimization
- Picks one tier below maximum for safety
- Fixed for session (no mid-conversation changes)
- Show warnings on low memory

### 3. VRAM Management

- Monitor VRAM usage regularly
- Keep 1GB safety buffer
- Close other GPU applications
- Use KV cache quantization for large contexts

---

## Troubleshooting

### Context Overflow

**Symptom:** "Context usage at 95%" warning

**Solutions:**
1. Create a snapshot and start fresh (see `dev_ContextCompression.md`)
2. Enable compression if disabled
3. Use smaller context size
4. Clear old messages

### Low Memory

**Symptom:** "Low memory detected" warning

**Solutions:**
1. Restart with smaller context size
2. Close other applications
3. Use model with smaller parameters
4. Enable KV cache quantization

### Wrong Context Size Sent to Ollama

**Symptom:** Ollama receives wrong `num_ctx` value

**Solutions:**
1. Verify `context.maxTokens` equals `ollamaContextSize`
2. Check `LLM_profiles.json` has correct pre-calculated values
3. Ensure `calculateContextSizing()` reads from profile (no calculation)
4. Verify `contextActions.updateConfig()` is called before sending to provider

---

## Common Mistakes

### ❌ Calculating instead of reading
```typescript
const ollamaSize = userSize * 0.85;  // Wrong
const ollamaSize = profile.ollama_context_size;  // Correct
```

### ❌ Not updating context.maxTokens
```typescript
// Wrong - maxTokens stays at user selection
provider.chat({ options: { num_ctx: ollamaContextSize } });

// Correct - update maxTokens first
contextActions.updateConfig({ targetSize: ollamaContextSize });
provider.chat({ options: { num_ctx: ollamaContextSize } });
```

### ❌ Using user selection for thresholds
```typescript
const trigger = userContextSize * 0.75;  // Wrong - uses user selection
const trigger = context.maxTokens * 0.75;  // Correct - uses ollama limit
```

### ❌ Hardcoding tier thresholds
```typescript
// Wrong - hardcoded thresholds
if (size >= 16384) return TIER_3_STANDARD;
if (size >= 8192) return TIER_2_BASIC;

// Correct - profile-based mapping
const profiles = modelInfo.contextProfiles.sort((a, b) => a.size - b.size);
const matchingProfile = profiles.find(p => p.size >= size);
const profileIndex = profiles.indexOf(matchingProfile);
// Map profileIndex to tier based on total profile count
```

### ❌ Using hardcoded sizes for tier targets
```typescript
// Wrong - hardcoded sizes
const tierSizes = { TIER_1: 4096, TIER_2: 8192, TIER_3: 16384 };
return tierSizes[tier];

// Correct - profile-based selection
const sortedProfiles = [...profiles].sort((a, b) => a.size - b.size);
const targetIndex = calculateIndexForTier(tier, sortedProfiles.length);
return sortedProfiles[targetIndex].size;
```

---

## File Locations

| File | Purpose |
|------|---------|
| `packages/core/src/context/contextManager.ts` | Main orchestration |
| `packages/core/src/context/vramMonitor.ts` | VRAM monitoring |
| `packages/core/src/context/tokenCounter.ts` | Token counting |
| `packages/core/src/context/contextPool.ts` | Dynamic sizing |
| `packages/core/src/context/memoryGuard.ts` | Memory safety |
| `packages/core/src/context/types.ts` | Type definitions |
| `packages/cli/src/config/LLM_profiles.json` | Pre-calculated 85% values |
| `packages/cli/src/features/context/contextSizing.ts` | calculateContextSizing() |
| `packages/cli/src/features/context/ModelContext.tsx` | Interactive mode |
| `packages/cli/src/nonInteractive.ts` | CLI mode |

---

**Note:** This document focuses on context sizing logic. For compression and snapshots, see `dev_ContextCompression.md`. For prompt structure, see `dev_PromptSystem.md`.
