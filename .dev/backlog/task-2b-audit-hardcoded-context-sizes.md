# Task 2B Audit: Hardcoded Context Sizes

**Date:** January 27, 2026  
**Auditor:** AI Assistant  
**Issue:** Hardcoded context size values in contextManager.ts should come from LLM_profiles.json

---

## Executive Summary

**CRITICAL ISSUE:** Context size mappings are hardcoded in `contextManager.ts` instead of being loaded from the user's model profiles. This violates the single-source-of-truth principle and prevents per-model context size customization.

**Impact:** HIGH
- Users cannot have model-specific context sizes
- System ignores pre-calculated 85% values from LLM_profiles.json
- Hardcoded values don't match actual model capabilities
- Breaks the intended architecture

---

## Current Architecture (WRONG)

### Hardcoded Values Location

**File:** `packages/core/src/context/contextManager.ts` (lines 433-461)

```typescript
private getTierForSize(size: number): ContextTier {
  const tiers: Array<{ size: number; tier: ContextTier }> = [
    { size: 4096, tier: ContextTier.TIER_1_MINIMAL },      // ❌ HARDCODED
    { size: 8192, tier: ContextTier.TIER_2_BASIC },        // ❌ HARDCODED
    { size: 16384, tier: ContextTier.TIER_3_STANDARD },    // ❌ HARDCODED
    { size: 32768, tier: ContextTier.TIER_4_PREMIUM },     // ❌ HARDCODED
    { size: 65536, tier: ContextTier.TIER_5_ULTRA }        // ❌ HARDCODED
  ];
  // ...
}

private getTierTargetSize(tier: ContextTier): number {
  const sizes: Record<ContextTier, number> = {
    [ContextTier.TIER_1_MINIMAL]: 4096,      // ❌ HARDCODED
    [ContextTier.TIER_2_BASIC]: 8192,        // ❌ HARDCODED
    [ContextTier.TIER_3_STANDARD]: 16384,    // ❌ HARDCODED
    [ContextTier.TIER_4_PREMIUM]: 32768,     // ❌ HARDCODED
    [ContextTier.TIER_5_ULTRA]: 65536        // ❌ HARDCODED
  };
  return sizes[tier];
}
```

### What Should Happen Instead

**Source of Truth:** `~/.ollm/user_models.json` (compiled from installed models)

```json
{
  "version": "0.1.0",
  "user_models": [
    {
      "id": "qwen2.5:7b",
      "context_profiles": [
        {
          "size": 4096,
          "ollama_context_size": 3482,    // ✅ Pre-calculated 85%
          "vram_estimate_gb": 5.5
        },
        {
          "size": 8192,
          "ollama_context_size": 6963,    // ✅ Pre-calculated 85%
          "vram_estimate_gb": 6.0
        }
        // ... more profiles
      ]
    }
  ]
}
```

---

## Intended Architecture (CORRECT)

### Data Flow

```
1. App Startup
   ↓
2. Query Ollama for installed models
   ↓
3. Load master database: packages/cli/src/config/LLM_profiles.json
   ↓
4. Match installed models with master database
   ↓
5. Compile user-specific profiles: ~/.ollm/user_models.json
   ↓
6. ContextManager loads from ~/.ollm/user_models.json
   ↓
7. Use model-specific context sizes (not hardcoded)
```

### User Models File Location

**Path:** `~/.ollm/user_models.json`

**Purpose:**
- Contains ONLY models user has installed
- Compiled from master database on each startup
- Updated when models are added/removed
- Single source of truth for runtime

**Structure:**
```json
{
  "version": "0.1.0",
  "last_updated": "2026-01-27T10:00:00Z",
  "user_models": [
    {
      "id": "qwen2.5:7b",
      "name": "Qwen2.5 7B",
      "parameters": "7.6B",
      "max_context_window": 131072,
      "default_context": 4096,
      "context_profiles": [
        {
          "size": 4096,
          "size_label": "4k",
          "ollama_context_size": 3482,
          "vram_estimate_gb": 5.5
        },
        {
          "size": 8192,
          "size_label": "8k",
          "ollama_context_size": 6963,
          "vram_estimate_gb": 6.0
        },
        {
          "size": 16384,
          "size_label": "16k",
          "ollama_context_size": 13926,
          "vram_estimate_gb": 7.0
        }
      ]
    }
  ]
}
```

---

## Current Implementation Status

### ✅ What Works

1. **ProfileManager exists** (`packages/cli/src/features/profiles/ProfileManager.ts`)
   - Loads master database from `LLM_profiles.json`
   - Manages `~/.ollm/user_models.json`
   - Has `getModelEntry(modelId)` method
   - Auto-refreshes on startup

2. **Master database exists** (`packages/cli/src/config/LLM_profiles.json`)
   - Contains all known models
   - Has pre-calculated 85% values
   - Has context profiles per model

3. **User models file exists** (`~/.ollm/user_models.json`)
   - Created on first run
   - Updated when models change
   - Preserves user overrides

### ❌ What's Broken

1. **ContextManager doesn't use ProfileManager**
   - Uses hardcoded values instead
   - Ignores model-specific profiles
   - Doesn't load from user_models.json

2. **No model-specific context sizing**
   - All models use same hardcoded sizes
   - Ignores pre-calculated 85% values
   - Can't customize per model

3. **Tier mapping is generic**
   - Doesn't account for model capabilities
   - Some models support 128K, others only 32K
   - Hardcoded tiers don't match reality

---

## Root Cause Analysis

### Why This Happened

1. **Early development:** Hardcoded values were placeholder
2. **ProfileManager added later:** Integration never completed
3. **No refactoring:** Old code wasn't updated when ProfileManager was added
4. **Missing dependency:** ContextManager doesn't import ProfileManager

### Why It's Critical

1. **Breaks architecture:** Violates single-source-of-truth
2. **Limits functionality:** Can't have model-specific sizes
3. **Ignores calculations:** Pre-calculated 85% values unused
4. **User confusion:** Settings don't match behavior

---

## Proposed Solution

### Phase 1: Inject ProfileManager into ContextManager

**Goal:** Make ContextManager aware of model profiles

**Changes:**
1. Add ProfileManager dependency to ContextManager constructor
2. Store modelId in ContextManager
3. Load model entry on startup
4. Use model's context_profiles instead of hardcoded values

**Files:**
- `packages/core/src/context/contextManager.ts`
- `packages/core/src/context/contextModules.ts` (factory)

### Phase 2: Replace Hardcoded Methods

**Goal:** Use model-specific context profiles

**Replace:**
```typescript
// OLD (hardcoded)
private getTierForSize(size: number): ContextTier {
  const tiers = [
    { size: 4096, tier: TIER_1 },
    { size: 8192, tier: TIER_2 },
    // ...
  ];
}

// NEW (from profile)
private getTierForSize(size: number): ContextTier {
  const profiles = this.modelEntry.context_profiles;
  // Find matching profile
  const profile = profiles.find(p => p.size === size);
  // Map to tier based on actual model capabilities
}
```

### Phase 3: Use Pre-calculated 85% Values

**Goal:** Use ollama_context_size from profiles

**Replace:**
```typescript
// OLD (hardcoded)
const contextSize = 16384;  // User selection

// NEW (from profile)
const profile = this.modelEntry.context_profiles.find(p => p.size === 16384);
const contextSize = profile.ollama_context_size;  // 13926 (85% pre-calculated)
```

### Phase 4: Dynamic Tier Mapping

**Goal:** Map tiers based on model's max_context_window

**Logic:**
```typescript
// Model supports 128K
max_context_window: 131072
→ TIER_5_ULTRA available

// Model supports only 32K
max_context_window: 32768
→ TIER_5_ULTRA not available, max is TIER_4_PREMIUM
```

---

## Implementation Plan

### Step 1: Add ProfileManager Dependency

**File:** `packages/core/src/context/contextManager.ts`

```typescript
import { ProfileManager } from '@ollm/cli/features/profiles/ProfileManager.js';

constructor(
  sessionId: string,
  modelInfo: ModelInfo,
  config: Partial<ContextConfig> = {},
  profileManager: ProfileManager,  // ✅ Add this
  services?: ContextModuleOverrides
) {
  // ...
  this.profileManager = profileManager;
  this.modelEntry = profileManager.getModelEntry(modelInfo.id);
}
```

### Step 2: Replace getTierForSize()

```typescript
private getTierForSize(size: number): ContextTier {
  // Get model's context profiles
  const profiles = this.modelEntry.context_profiles;
  
  // Find profile for this size
  const profile = profiles.find(p => p.size >= size);
  if (!profile) {
    // Fallback to smallest
    return ContextTier.TIER_1_MINIMAL;
  }
  
  // Map size to tier based on model's capabilities
  const maxWindow = this.modelEntry.max_context_window;
  
  if (profile.size >= 65536 && maxWindow >= 65536) return ContextTier.TIER_5_ULTRA;
  if (profile.size >= 32768 && maxWindow >= 32768) return ContextTier.TIER_4_PREMIUM;
  if (profile.size >= 16384) return ContextTier.TIER_3_STANDARD;
  if (profile.size >= 8192) return ContextTier.TIER_2_BASIC;
  return ContextTier.TIER_1_MINIMAL;
}
```

### Step 3: Replace getTierTargetSize()

```typescript
private getTierTargetSize(tier: ContextTier): number {
  // Get model's context profiles
  const profiles = this.modelEntry.context_profiles;
  
  // Map tier to size based on model's capabilities
  const tierSizes = {
    [ContextTier.TIER_1_MINIMAL]: 4096,
    [ContextTier.TIER_2_BASIC]: 8192,
    [ContextTier.TIER_3_STANDARD]: 16384,
    [ContextTier.TIER_4_PREMIUM]: 32768,
    [ContextTier.TIER_5_ULTRA]: 65536
  };
  
  const targetSize = tierSizes[tier];
  
  // Find closest profile
  const profile = profiles.find(p => p.size >= targetSize) || profiles[profiles.length - 1];
  
  return profile.size;
}
```

### Step 4: Use ollama_context_size

```typescript
// When setting context size
const userSelection = 16384;  // User wants 16K

// Find profile
const profile = this.modelEntry.context_profiles.find(p => p.size === userSelection);

// Use pre-calculated 85% value
this.currentContext.maxTokens = profile.ollama_context_size;  // 13926, not 16384
```

---

## Testing Strategy

### Unit Tests

1. Test with different models (3B, 7B, 70B)
2. Test with different max_context_window values
3. Test tier mapping for each model
4. Test fallback when profile not found

### Integration Tests

1. Test full flow: startup → load profiles → set context
2. Test model switching
3. Test context size changes
4. Test with missing user_models.json

### Manual Tests

1. Install model with Ollama
2. Start app
3. Verify user_models.json created
4. Verify context sizes match model profiles
5. Change model, verify sizes update

---

## Risks & Mitigation

### Risk 1: Breaking Changes

**Risk:** Existing code depends on hardcoded values

**Mitigation:**
- Keep hardcoded values as fallback
- Gradual migration
- Comprehensive testing

### Risk 2: ProfileManager Not Available

**Risk:** ContextManager created without ProfileManager

**Mitigation:**
- Make ProfileManager optional in constructor
- Fallback to hardcoded values if not provided
- Log warning when using fallback

### Risk 3: Model Not in Database

**Risk:** User has model not in LLM_profiles.json

**Mitigation:**
- ProfileManager already handles this
- Returns default profile
- User can add custom profiles

---

## Success Criteria

### Must Have

- [ ] ContextManager uses ProfileManager
- [ ] Context sizes come from model profiles
- [ ] Pre-calculated 85% values used
- [ ] Tier mapping based on model capabilities
- [ ] All tests passing

### Should Have

- [ ] Fallback to hardcoded values if profile missing
- [ ] Warning logged when using fallback
- [ ] Documentation updated
- [ ] Migration guide for existing users

### Nice to Have

- [ ] UI shows model-specific context sizes
- [ ] User can override per-model sizes
- [ ] Validation of custom profiles

---

## Timeline Estimate

**Total:** 1-2 days

- **Step 1:** Add ProfileManager dependency (2-3h)
- **Step 2:** Replace getTierForSize() (2-3h)
- **Step 3:** Replace getTierTargetSize() (1-2h)
- **Step 4:** Use ollama_context_size (1-2h)
- **Testing:** Comprehensive testing (4-6h)
- **Documentation:** Update docs (1-2h)

---

## Dependencies

### Before Starting

- [ ] Task 1 complete (Simplify Tier Selection)
- [ ] Task 2 complete (Remove Runtime 85%)
- [ ] Task 3 complete (Fix Auto-Sizing Warning)

### Blockers

- None (ProfileManager already exists and works)

---

## Related Files

| File | Purpose |
|------|---------|
| `packages/core/src/context/contextManager.ts` | Main file to modify |
| `packages/cli/src/features/profiles/ProfileManager.ts` | Profile loading logic |
| `packages/cli/src/config/LLM_profiles.json` | Master database |
| `~/.ollm/user_models.json` | User-specific profiles |
| `packages/core/src/routing/modelDatabase.ts` | Model database utilities |

---

## Conclusion

This is a **CRITICAL** architectural issue that must be fixed. The hardcoded values violate the single-source-of-truth principle and prevent the system from using model-specific context sizes and pre-calculated 85% values.

The fix is straightforward: inject ProfileManager into ContextManager and use model profiles instead of hardcoded values. The ProfileManager infrastructure already exists and works correctly.

**Recommendation:** Add as Task 2B and complete before Task 4 (Compression System), as compression depends on accurate context sizing.
