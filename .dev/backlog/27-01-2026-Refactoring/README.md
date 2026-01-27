# Context Management Refactoring

**Date:** January 27, 2026

---

## Current State

**Problem:** Logic is scattered across multiple files doing the same thing. Each fix adds more duplicates and complexity.

**Files with duplicate logic:**
- `packages/core/src/context/contextManager.ts` - Core tier calculation
- `packages/cli/src/features/context/ContextManagerContext.tsx` - React tier calculation (duplicate)
- `packages/cli/src/features/context/contextSizing.ts` - More tier calculation (duplicate)
- `packages/cli/src/ui/App.tsx` - Menu logic mixed with UI

**Race condition:**
- `/test prompt` fails with "Context Manager not initialized" after `/model` command
- Caused by scattered initialization logic and global state

**Auto-sizing problems:**
- Auto-resize logic causes race conditions
- Conflicts with user selections
- Makes debugging impossible

---

## What We Want

**Simple one-way flow:**
1. System detects VRAM
2. Calculates available context range (Tier 1 → Max hardware can handle)
3. User sees menu with available tiers
4. User selects context size
5. System sets that size and determines tier
6. Prompt orchestrator reads tier and selects correct prompt
7. System sends to LLM

**Principles:**
- One file, one job
- No auto-sizing
- No race conditions
- No duplicates

---

## Action Plan

### Phase 1: Create ContextSizeCalculator.ts
**Location:** `packages/core/src/context/ContextSizeCalculator.ts`

**Purpose:** ONE file that does ALL context size calculations

**What it does:**
```typescript
// Input: VRAM, model requirements
// Output: Available tiers, context sizes, tier for selected size

calculateAvailableTiers(vram, modelRequirements)
  → returns: [tier1: 2k, tier2: 4k, tier3: 8k, ...]

determineTier(selectedSize)
  → returns: tier number (1-5)
```

**Why:** Consolidates all scattered calculation logic into one place

---

### Phase 2: Update contextManager.ts
**File:** `packages/core/src/context/contextManager.ts`

**Changes:**
- Import ContextSizeCalculator
- Use calculator instead of scattered logic
- Remove auto-sizing code
- Keep all public methods unchanged (other systems depend on them)

**Why:** Core business logic uses the calculator

---

### Phase 3: Update ContextManagerContext.tsx
**File:** `packages/cli/src/features/context/ContextManagerContext.tsx`

**Changes:**
- Use ContextSizeCalculator
- Remove duplicate calculation code
- Fix race condition by simplifying initialization

**Why:** React layer uses same calculator, no duplicates

---

### Phase 4: Create ContextMenu.tsx
**Location:** `packages/cli/src/ui/components/context/ContextMenu.tsx`

**Purpose:** Display context menu, nothing else

**What it does:**
- Receives available tiers as props
- Displays menu
- Returns user selection
- NO business logic

**Why:** Separates display from logic

---

### Phase 5: Update App.tsx
**File:** `packages/cli/src/ui/App.tsx`

**Changes:**
- Use ContextMenu component
- Remove menu logic from App.tsx

**Why:** UI layer just displays, doesn't calculate

---

### Phase 6: Delete contextSizing.ts
**File:** `packages/cli/src/features/context/contextSizing.ts`

**Action:** DELETE

**Why:** All logic now in ContextSizeCalculator, this is duplicate

---

## Why This Works

**Dependencies verified:**
- All systems use callback functions (loose coupling)
- Public API stays unchanged
- No breaking changes

**What must stay:**
- Context manager public methods (start, stop, addMessage, etc.)
- Event emissions (tier-changed, context-updated, etc.)
- Context pool interface (setCurrentTokens, etc.)

**What can change:**
- Internal calculation logic
- Auto-sizing (remove it)
- Menu display (move to component)

---

## Testing After Each Phase

- [ ] All public methods still work
- [ ] All events still emit
- [ ] `/test prompt` command works
- [ ] `/model` command works
- [ ] Context menu displays correctly
- [ ] No race conditions

---

**Status:** Ready to implement  
**Risk:** Low (incremental changes with testing)  
**Blocking issues:** None
