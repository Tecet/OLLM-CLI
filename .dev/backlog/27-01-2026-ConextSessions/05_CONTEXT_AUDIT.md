# Context Management System Audit Report

**Date:** January 27, 2026  
**Scope:** Context sizing, token counting, tier selection, and prompt system alignment

---

## Executive Summary

Found **6 critical bugs** causing misalignment between UI display, Ollama limits, tier selection, and prompt system.

All bugs stem from confusion between **user-facing context size** vs **Ollama context size (85%)**.

---

## Bug #1: Token Count Display Shows Wrong Denominator ❌

**Issue:** UI displays `408/4000` but should show `408/16384`

**Root Cause:** `userContextSize` not updated correctly during resize operations

**Location:** `packages/core/src/context/contextPool.ts`

**Fix:** Update `userContextSize` in `resize()` and `updateConfig()` methods

---

## Bug #2: Auto Context Does Not Influence Context Goals ❌

**Issue:** Auto-context calculates size but doesn't update tier selection properly

**Root Cause:** `currentContext.maxTokens` set to Ollama size instead of user-facing size

**Location:** `packages/core/src/context/contextManager.ts` line 365

**Fix:** Store both sizes separately, use user-facing size for tier detection

---

## Bug #3: Manual Context Change Shows Wrong Tier ❌

**Issue:** Changing to 8K still shows 16K tier in UI

**Root Cause:** Tier detection uses `config.targetSize` but `maxTokens` uses Ollama size

**Location:** `packages/core/src/context/contextManager.ts` line 420

**Fix:** Ensure tier detection always uses user-facing size

---

## Bug #4: Switching from User-Defined to Auto Keeps Old Mode ❌

**Issue:** Manual → auto transition doesn't recalculate optimal size

**Root Cause:** Missing detection of manual → auto transition

**Location:** `packages/core/src/context/contextManager.ts` `updateConfig()`

**Fix:** Detect transition, recalculate size, update tier and prompt

---

## Bug #5: Prompt Tier Misalignment ❌

**Issue:** Tier changes don't consistently trigger prompt rebuilds

**Root Cause:** Multiple places update tier without rebuilding prompt

**Location:** Multiple locations in `contextManager.ts`

**Fix:** Centralize prompt rebuilding, always rebuild on tier change

---

## Bug #6: Compression Triggers Not in Sync ⚠️

**Issue:** UI shows user size but compression uses Ollama size (85%)

**Root Cause:** Percentage calculated against Ollama size, UI shows user size

**Location:** `packages/core/src/context/contextPool.ts` `getUsage()`

**Fix:** Document clearly or show both sizes in UI

---

## Fix Strategy

### Phase 1: Size Tracking (HIGH PRIORITY)
- Add clear distinction between `userContextSize` and `ollamaContextSize`
- Update `contextPool.ts` to maintain both values
- Document the 85% calculation

### Phase 2: Tier Selection (HIGH PRIORITY)
- Fix `detectContextTier()` to use `userContextSize`
- Update auto-sizing to set `config.targetSize`
- Ensure consistency across all tier detection points

### Phase 3: Prompt System (HIGH PRIORITY)
- Centralize prompt rebuilding in `updateSystemPrompt()`
- Add prompt tier locking for auto-sizing
- Emit events on tier changes

### Phase 4: UI Display (MEDIUM PRIORITY)
- Show correct context size in UI
- Consider showing both user and Ollama sizes
- Update tier display

### Phase 5: Auto-Context (MEDIUM PRIORITY)
- Detect manual → auto transition
- Recalculate optimal size
- Update tier and prompt

### Phase 6: Testing (HIGH PRIORITY)
- Test all context size changes
- Test tier transitions
- Test prompt rebuilding
- Test compression triggers

---

## Files Requiring Changes

1. `packages/core/src/context/contextPool.ts` - Size tracking
2. `packages/core/src/context/contextManager.ts` - Tier detection, prompt rebuilding
3. `packages/core/src/context/promptOrchestrator.ts` - Prompt building
4. `packages/cli/src/features/context/ContextManagerContext.tsx` - UI updates
5. `packages/cli/src/ui/components/layout/SidePanel.tsx` - Display updates

---

## Testing Checklist

### Manual Context
- [ ] 4K → 8K: Tier updates, prompt rebuilds, UI correct
- [ ] 8K → 16K: Tier updates, prompt rebuilds, UI correct
- [ ] 16K → 8K: Tier updates, prompt rebuilds, UI correct

### Auto Context
- [ ] Enable auto: Calculates size, selects tier, updates UI
- [ ] Low VRAM: Selects lower tier, updates prompt
- [ ] High VRAM: Selects higher tier, updates prompt

### Transitions
- [ ] Manual → Auto: Recalculates, updates tier, updates prompt
- [ ] Auto → Manual: Locks size, updates tier, updates prompt

### Compression
- [ ] 80%: Normal compression triggers
- [ ] 95%: Emergency compression triggers
- [ ] 100%: Emergency rollover triggers

---

## Priority

1. **CRITICAL:** Bugs #1, #2, #3
2. **HIGH:** Bugs #4, #5, Phases 1-3
3. **MEDIUM:** Bug #6, Phases 4-5
4. **LOW:** Documentation, logging

**Estimated Effort:** 4-6 hours + testing

**Risk:** Medium (core changes, well-defined fixes)
