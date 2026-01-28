# contextManager.ts Audit

**Date:** January 27, 2026  
**File:** `packages/core/src/context/contextManager.ts`  
**Lines:** 1395

---

## Summary

The file already has the calculation logic we need! It's using model profiles correctly. The problem is:

1. **Duplicate logic** - Same calculations exist in contextSizing.ts and ContextManagerContext.tsx
2. **Auto-sizing complexity** - The auto-sizing code is scattered and causes race conditions
3. **No consolidation** - Logic should be in ContextSizeCalculator, not scattered

---

## Good Code (Keep This)

### ✅ Model Profile Usage

Lines 738-770, 778-806, 813-875

- `getOllamaContextSize()` - Uses model profiles correctly
- `getUserSizeFromOllama()` - Reverse calculation using profiles
- `getTierTargetSize()` - Maps tiers to profile sizes
- All have proper fallbacks with error logging

### ✅ Tier Detection

Lines 656-736

- `getTierForSize()` - Uses model profiles to determine tier
- Proper fallback with error logging
- Works with variable number of profiles (1-5+)

### ✅ Budget Calculation

Lines 556-584

- `getBudget()` - Calculates available space correctly
- Accounts for system prompt and checkpoints
- Used by compression system

### ✅ Public API

All public methods are well-defined and used by other systems:

- `start()`, `stop()`, `addMessage()`, `getContext()`, `getUsage()`, `getBudget()`
- `createSnapshot()`, `restoreSnapshot()`, `compress()`
- Event emissions work correctly

---

## Problems to Fix

### ❌ Auto-Sizing Logic (Lines 327-450)

**Location:** `start()` method

**Problem:**

- Complex auto-sizing flow with file logging
- Calculates optimal size, then recommended size, then user size
- Updates config mid-initialization
- Causes race conditions

**Solution:**

- Move calculation to ContextSizeCalculator
- Remove file logging (use events instead)
- Simplify flow

### ❌ Duplicate Calculations

**Locations:**

- Lines 738-770: `getOllamaContextSize()`
- Lines 778-806: `getUserSizeFromOllama()`
- Lines 813-875: `getTierTargetSize()`
- Lines 656-736: `getTierForSize()`

**Problem:**

- These calculations are ALSO in contextSizing.ts
- Same logic, different files
- Hard to maintain

**Solution:**

- Keep these methods but make them call ContextSizeCalculator
- Remove duplicates from contextSizing.ts

### ❌ Auto-Sizing in updateConfig() (Lines 476-550)

**Location:** `updateConfig()` method

**Problem:**

- Async auto-sizing calculation in config update
- Complex transition logic (manual → auto, auto → manual)
- More file logging
- Can cause race conditions

**Solution:**

- Simplify using ContextSizeCalculator
- Remove async complexity
- Make transitions explicit

### ❌ File Logging Everywhere

**Locations:** Lines 332-450, 920-930

**Problem:**

- Writes to `context-debug.log` file
- Scattered throughout code
- Makes debugging harder

**Solution:**

- Remove file logging
- Use events instead
- Let UI/CLI handle logging

---

## Legacy Code to Remove

### 🗑️ File Logging

Lines 332-450, 920-930

```typescript
const fs = require('fs');
const path = require('path');
const logPath = path.join(process.cwd(), 'context-debug.log');
fs.appendFileSync(logPath, ...);
```

**Why:** Scattered, hard to maintain, should use events

### 🗑️ Complex Auto-Sizing Flow

Lines 327-450

```typescript
if (this.config.autoSize) {
  // 120 lines of complex logic
}
```

**Why:** Should be in ContextSizeCalculator

### 🗑️ Async Config Update

Lines 476-550

```typescript
(async () => {
  // Complex async auto-sizing in config update
})();
```

**Why:** Race condition risk, should be synchronous

---

## Refactoring Plan

### Phase 2A: Import ContextSizeCalculator

Add import at top:

```typescript
import * as ContextSizeCalculator from './ContextSizeCalculator.js';
```

### Phase 2B: Replace getTierForSize()

Lines 656-736

```typescript
private getTierForSize(size: number): ContextTier {
  return ContextSizeCalculator.determineTier(size);
}
```

### Phase 2C: Replace getOllamaContextSize()

Lines 738-770

```typescript
private getOllamaContextSize(userSize: number): number {
  return ContextSizeCalculator.getOllamaContextSize(
    userSize,
    this.modelInfo.contextProfiles || []
  );
}
```

### Phase 2D: Replace getUserSizeFromOllama()

Lines 778-806

```typescript
private getUserSizeFromOllama(ollamaSize: number): number {
  return ContextSizeCalculator.getUserSizeFromOllama(
    ollamaSize,
    this.modelInfo.contextProfiles || []
  );
}
```

### Phase 2E: Simplify Auto-Sizing in start()

Lines 327-450

- Remove file logging
- Use ContextSizeCalculator.calculateAvailableTiers()
- Simplify flow

### Phase 2F: Simplify updateConfig()

Lines 476-550

- Remove async auto-sizing
- Use ContextSizeCalculator
- Make transitions explicit

### Phase 2G: Remove File Logging

Lines 332-450, 920-930

- Delete all fs.appendFileSync() calls
- Use events instead

---

## What NOT to Change

### ✅ Keep Public API

All public methods must stay unchanged:

- `start()`, `stop()`, `addMessage()`
- `getContext()`, `getUsage()`, `getBudget()`
- `createSnapshot()`, `restoreSnapshot()`, `compress()`

### ✅ Keep Event Emissions

All events must continue to be emitted:

- `tier-changed`, `mode-changed`, `context-updated`
- `compression-complete`, `snapshot-created`
- `memory-warning`, `memory-critical`

### ✅ Keep Integration Points

- `contextModules` creation
- `promptOrchestrator` integration
- `messageStore`, `checkpointManager` usage

---

## Risk Assessment

**Low Risk:**

- Replacing calculation methods (internal only)
- Removing file logging (not used by other systems)

**Medium Risk:**

- Simplifying auto-sizing (changes initialization flow)
- Updating config transitions (changes behavior)

**High Risk:**

- None (public API stays unchanged)

---

## Testing Strategy

After each change:

1. Run `npm run build` - must compile
2. Check public API still works
3. Check events still emit
4. Test `/model` command
5. Test `/test prompt` command
6. Test context menu display

---

## Conclusion

The contextManager.ts file is well-structured but has:

- **Duplicate logic** that should be in ContextSizeCalculator
- **Auto-sizing complexity** that causes race conditions
- **File logging** that should be events

The refactoring is safe because:

- Public API stays unchanged
- Integration points preserved
- Only internal logic changes

**Ready to proceed with Phase 2.**
