# Tier Synchronization Audit

**Status:** CLEANUP COMPLETE ✓

**Changes Made:**
1. ✓ Debug log spam from tests - FIXED (wrapped in !isTestEnv check)
2. ✓ Duplicate tier-changed events - FIXED (removed started listener)
3. ✓ Context size persistence - REMOVED (always auto-size on startup)
4. ✓ Duplicate auto-sizing in UI menu - REMOVED
5. ✓ All VRAM logic removed from App.tsx - CLEANED UP
6. ⏳ contextPool.updateConfig() corruption - PENDING (already fixed earlier)

**Major Cleanup - Removed from App.tsx:**
- `getVramGBFromOption()` function (~10 lines)
- `getVramDisplayFromOption()` function (~8 lines)
- VRAM calculation logic (~18 lines)
- VRAM safety checks in menus (~15 lines)
- "Auto" menu option (~15 lines)
- `maxSafeSize` calculation (~10 lines)
- "(Recommended)" labels
- **Total: ~76 lines of duplicate code removed**

**Single Source of Truth:**
- VRAM detection: `vramMonitor.ts` (core)
- Context sizing: `contextPool.ts` (core)
- Tier detection: `contextManager.ts` (core)
- UI: Just displays and calls `contextActions.resize(size)`

**Benefits:**
- 76 fewer lines of code
- No conflicting logic
- Easier to debug (one place to look)
- Core validates all sizes
- Simpler menu code

## Flow Analysis

### 1. Startup Flow (Auto Mode)

```
App.tsx (line 1149)
  ↓ autoSize: !persistedContextSize (true if no saved preference)
  ↓
ContextManager.constructor()
  ↓ config.targetSize = default (e.g., 16384)
  ↓ config.autoSize = true
  ↓
ContextManager.start()
  ↓ calculateOptimalSize() → returns Ollama size (e.g., 13926)
  ↓ getRecommendedAutoSize(13926) → should return 8K Ollama size
  ↓ getUserSizeFromOllama() → converts to user size (8192)
  ↓ config.targetSize = 8192 ✓
  ↓ contextPool.setUserContextSize(8192) ✓
  ↓ detectContextTier() → uses config.targetSize (8192) → Tier 2 ✓
  ↓ emit('tier-changed', { effectivePromptTier: Tier 2 })
  ↓
ContextManagerContext (UI)
  ↓ Receives tier-changed event
  ↓ setEffectivePromptTier('Tier 2') ✓
  ↓
ActivePromptInfo.tsx
  ↓ formatTierDisplay('Tier 2') → should return '8K'
  ↓ BUT SHOWS '2-4K' ❌
```

## Problem Areas to Check

### A. formatTierDisplay() Logic
Location: `packages/cli/src/ui/components/layout/ActivePromptInfo.tsx`

```typescript
function formatTierDisplay(tier: string): string {
  const match = tier.match(/Tier (\d+)/);
  if (!match) return tier;
  
  const tierNum = match[1];
  const tierRanges: Record<string, string> = {
    '1': '2-4K',
    '2': '8K',
    '3': '16K',
    '4': '32K',
    '5': '64K+'
  };
  
  return tierRanges[tierNum] || tier;
}
```

**Expected:** 'Tier 2' → '8K'
**Actual:** Shows '2-4K' (Tier 1)

**Hypothesis:** effectivePromptTier is 'Tier 1' not 'Tier 2'

### B. Event Data Structure
Location: `packages/core/src/context/contextManager.ts`

Check what's actually emitted:
```typescript
this.emit('tier-changed', {
  tier: this.currentTier,
  config: this.tierConfig,
  selectedTier: this.selectedTier,
  effectivePromptTier: this.selectedTier, // ← This should be Tier 2
  promptTierLocked: false
});
```

### C. State Update in ContextManagerContext
Location: `packages/cli/src/features/context/ContextManagerContext.tsx`

```typescript
if (tierData.effectivePromptTier !== undefined) {
  const newEffective = tierToString(tierData.effectivePromptTier);
  console.log('[UI] Setting effectivePromptTier to:', newEffective);
  setEffectivePromptTier(newEffective);
}
```

**Check:** Is tierToString() converting correctly?

### D. Tier Detection Logic
Location: `packages/core/src/context/contextManager.ts`

```typescript
private detectContextTier(): TierConfig {
  const userSize = this.config.targetSize; // Should be 8192
  return TIER_CONFIGS[this.getTierForSize(userSize)];
}

private getTierForSize(size: number): ContextTier {
  // Uses model profiles or fallback
  // For 8192, should return TIER_2_BASIC
}
```

## Testing Points

1. **Log config.targetSize after auto-sizing**
   - Should be 8192 (user-facing)
   
2. **Log selectedTier after detectContextTier()**
   - Should be ContextTier.TIER_2_BASIC
   
3. **Log tier-changed event payload**
   - effectivePromptTier should be 'Tier 2' or ContextTier.TIER_2_BASIC
   
4. **Log effectivePromptTier state in UI**
   - Should be 'Tier 2'
   
5. **Log formatTierDisplay input/output**
   - Input: 'Tier 2'
   - Output: '8K'

## Suspected Root Causes

### Theory 1: ContextTier enum vs string mismatch
- Core emits: ContextTier.TIER_2_BASIC (enum value = 2)
- UI expects: 'Tier 2' (string)
- tierToString() might not handle enum correctly

### Theory 2: Multiple tier-changed events
- Initial event with wrong tier
- Correct event emitted later but state not updating

### Theory 3: getTierForSize() using wrong thresholds
- Model profiles not loaded
- Fallback logic using wrong size ranges

### Theory 4: Race condition
- tier-changed event fires before config.targetSize is updated
- detectContextTier() uses old targetSize value

## Next Steps

### FIXES NEEDED:

#### Fix 1: contextPool.updateConfig() Corruption
**File:** `packages/core/src/context/contextPool.ts`
**Line:** ~254-260
**Problem:** Overwrites userContextSize with Ollama size

```typescript
// BEFORE:
if (config.targetContextSize !== undefined) {
  this.currentSize = this.clampSize(config.targetContextSize);
  this.userContextSize = config.targetContextSize; // ← BUG: Overwrites with Ollama size
}

// AFTER:
if (config.targetContextSize !== undefined) {
  this.currentSize = this.clampSize(config.targetContextSize);
  // userContextSize is managed separately via resize() or setUserContextSize()
}
```

#### Fix 2: Duplicate Event Listeners
**File:** `packages/cli/src/features/context/ContextManagerContext.tsx`
**Line:** ~527-528
**Problem:** Both tier-changed and started events trigger same callback

```typescript
// BEFORE:
manager.on('tier-changed', tierChangeCallback);
manager.on('started', tierChangeCallback); // ← REMOVE: Causes duplicates

// AFTER:
manager.on('tier-changed', tierChangeCallback);
```

#### Fix 3: Debug Log Spam from Tests
**File:** `packages/core/src/context/contextManager.ts`
**Lines:** 879-889 (detectContextTier), 287-324 (start auto-sizing)
**Problem:** Logs to file during property-based tests (100+ runs)

```typescript
// BEFORE:
private detectContextTier(): TierConfig {
  const fs = require('fs');
  fs.appendFileSync('context-debug.log', ...); // ← Runs during tests!
  // ...
}

// AFTER:
private detectContextTier(): TierConfig {
  const userSize = this.config.targetSize;
  const tier = this.getTierForSize(userSize);
  const tierConfig = TIER_CONFIGS[tier];
  
  // Log only in non-test environments
  if (!isTestEnv) {
    const fs = require('fs');
    fs.appendFileSync('context-debug.log', `[${new Date().toISOString()}] detectContextTier: userSize = ${userSize}\n`);
    fs.appendFileSync('context-debug.log', `[${new Date().toISOString()}] detectContextTier: detected tier = ${tier}\n`);
    fs.appendFileSync('context-debug.log', `[${new Date().toISOString()}] detectContextTier: tierConfig.tier = ${tierConfig.tier}\n`);
  }
  
  return tierConfig;
}
```

Same fix needed in `start()` method for auto-sizing logs.

---

## Complete Chain Audit

### CHAIN 1: AUTO-SIZING BASED ON VRAM

1. **VRAM Detection** → `vramMonitor.getInfo()` → `{ total, used, available }`
2. **Optimal Size** → `contextPool.calculateOptimalSize()` → Ollama size (85%)
3. **Recommendation** → `getRecommendedAutoSize()` → One tier lower than max
4. **Execution** → `start()` → Sets config.targetSize (user), contextPool sizes (both)

**Critical Flow in start():**
```typescript
if (config.autoSize) {
  maxPossibleContext = calculateOptimalSize(vramInfo, modelInfo)  // Ollama size
  recommendedSize = getRecommendedAutoSize(maxPossibleContext)    // Ollama size
  userFacingSize = getUserSizeFromOllama(recommendedSize)         // User size
  config.targetSize = userFacingSize                              // ✓
  await contextPool.resize(recommendedSize, userFacingSize)       // ✓ Sets both
  contextPool.updateConfig({ targetContextSize: recommendedSize }) // ✗ Corrupts userContextSize!
  detectContextTier()                                             // Uses config.targetSize
  emit('tier-changed', { selectedTier, effectivePromptTier })
}
```

### CHAIN 2: USER SELECTION

1. **UI Action** → User selects size → `contextActions.resize(size)`
2. **Config Update** → `updateConfig({ targetSize: size, autoSize: false })`
3. **Pool Update** → Converts to Ollama size, updates both sizes
4. **Tier Detection** → `detectContextTier()` → Uses config.targetSize
5. **Event Emission** → `emit('tier-changed')`

### CHAIN 3: UI DISPLAY

1. **Event Emission** → `emit('tier-changed', { effectivePromptTier })`
2. **Event Reception** → `tierChangeCallback` in ContextManagerContext
3. **Conversion** → `tierToString()` → "2-4K" → "Tier 1"
4. **State Update** → `setEffectivePromptTier('Tier 1')`
5. **Display** → `formatTierDisplay('Tier 1')` → "2-4K"

**Duplicate Events Issue:**
- `start()` emits `tier-changed` at line 326
- `start()` emits `started` at line 351
- UI listens to BOTH events with same callback
- Result: Callback fires twice with same data

### CHAIN 4: PROMPT BUILDER

1. **Tier Detection** → `detectContextTier()` → Uses config.targetSize (user size)
2. **Prompt Selection** → `promptOrchestrator.updateSystemPrompt({ tier: selectedTier })`
3. **Template Loading** → `getSystemPromptForTierAndMode(mode, tier)`
4. **Prompt Injection** → Adds to currentContext.messages

**Important:** Prompt uses `selectedTier` which comes from `detectContextTier()` using user-facing size.

---

## Data Flow Summary

### Size Types:
- **User Size**: What user selected (e.g., 8192) - for UI and tier detection
- **Ollama Size**: 85% of user size (e.g., 6963) - actual limit sent to Ollama
- **config.targetSize**: User size
- **contextPool.userContextSize**: User size (for UI display)
- **contextPool.currentSize**: Ollama size (for Ollama API)

### The Bug:
`updateConfig({ targetContextSize: ollamaSize })` overwrites `userContextSize` with Ollama size, causing:
- UI shows wrong tier (based on corrupted userContextSize)
- Context shows wrong maxTokens (based on corrupted userContextSize)
- Prompt is correct (uses config.targetSize which isn't corrupted)

---

## Verification Checklist

After fixes:
- [ ] Auto-sizing sets correct userContextSize
- [ ] Manual resize sets correct userContextSize  
- [ ] UI displays correct tier (matches context size)
- [ ] Context displays correct maxTokens (matches userContextSize)
- [ ] Prompt uses correct tier (matches context size)
- [ ] No duplicate tier-changed events
- [ ] Debug log clean (no test spam)
- [ ] Tests pass

---

## PROBLEM: Logic Scattered Across Multiple Files

### Current State - VRAM & Context Logic Locations:

**1. VRAM Detection (3 places):**
- `packages/core/src/context/vramMonitor.ts` - Core VRAM detection ✓ (correct place)
- `packages/cli/src/ui/App.tsx` - Duplicate VRAM calculation ❌ (lines 382-398)
- `packages/cli/src/features/context/GPUContext.tsx` - GPU info provider ✓ (correct place)

**2. Context Size Calculation (4 places):**
- `packages/core/src/context/contextPool.ts` - `calculateOptimalSize()` ✓ (correct place)
- `packages/core/src/context/contextManager.ts` - `getRecommendedAutoSize()` ✓ (correct place)
- `packages/cli/src/ui/App.tsx` - Duplicate 80% rule ❌ (removed)
- `packages/cli/src/ui/App.tsx` - VRAM safety checks ❌ (lines 430-441)

**3. Context Resizing (2 places):**
- `packages/core/src/context/contextPool.ts` - `resize()` ✓ (correct place)
- `packages/cli/src/features/context/ContextManagerContext.tsx` - `resize()` wrapper ✓ (correct place)

**4. Tier Detection (1 place):**
- `packages/core/src/context/contextManager.ts` - `detectContextTier()` ✓ (correct place)

### Issues:

**App.tsx has duplicate logic:**
```typescript
// Lines 382-398: Duplicate VRAM calculation
let effectiveTotalVRAM_GB = 0;
if (gpuInfo) {
  effectiveTotalVRAM_GB = gpuInfo.vramTotal / (1024 * 1024 * 1024);
}
const SAFETY_BUFFER_GB = effectiveTotalVRAM_GB > 0 ? Math.max(1.5, effectiveTotalVRAM_GB * 0.1) : 0;
const availableForContextGB = effectiveTotalVRAM_GB > 0 ? (effectiveTotalVRAM_GB - SAFETY_BUFFER_GB) : 0;

// Lines 430-441: Duplicate safety checks
const vramNum = parseFloat(vramEst.replace(' GB', ''));
const vramLimitWithOffload = availableForContextGB * 1.5;
if (!isNaN(vramNum) && vramNum > vramLimitWithOffload) {
  isUnsafe = true;
}
```

**This duplicates logic from:**
- `contextPool.calculateOptimalSize()` - Already has VRAM calculations
- `contextPool.config.reserveBuffer` - Already has safety buffer
- Core auto-sizing - Already filters unsafe sizes

### Recommendation:

**Remove ALL VRAM/context logic from App.tsx:**
1. Remove `effectiveTotalVRAM_GB` calculation
2. Remove `SAFETY_BUFFER_GB` calculation  
3. Remove `availableForContextGB` calculation
4. Remove `getVramGBFromOption()` function
5. Remove VRAM safety checks in menu (lines 430-441)

**Why:**
- Core already handles all this correctly
- Menu should just call `contextActions.resize(size)`
- Core will validate and apply safety limits
- Single source of truth = easier to debug
- No conflicting calculations

**Keep in App.tsx:**
- Menu UI only
- Call `contextActions.resize(size)` for user selection
- Display current context size from `contextState.usage.maxTokens`
- That's it!

### Proposed Cleanup:

**Delete from App.tsx:**
- Lines 352-360: `getVramGBFromOption()` function
- Lines 382-400: VRAM calculations
- Lines 430-441: VRAM safety checks

**Result:**
- Menu just shows all available sizes from profile
- User clicks size → calls `contextActions.resize(size)`
- Core validates and applies (or rejects if unsafe)
- Simple, clean, single source of truth
