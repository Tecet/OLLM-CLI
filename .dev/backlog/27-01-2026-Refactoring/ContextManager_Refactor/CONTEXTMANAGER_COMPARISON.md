# ContextManager Refactoring - What Was Removed

## File Size Comparison

- **Old:** 1089 lines
- **New:** 616 lines
- **Removed:** 473 lines (43% reduction)

## Methods Removed (Moved to ContextSizeCalculator)

### 1. `getTierForSize(size: number): ContextTier`

**Old location:** contextManager.ts line 597
**New location:** ContextSizeCalculator.determineTier()
**Reason:** Pure calculation, belongs in calculator

### 2. `getOllamaContextSize(userSize: number): number`

**Old location:** contextManager.ts line 604
**New location:** ContextSizeCalculator.getOllamaContextSize()
**Reason:** Pure calculation, belongs in calculator

### 3. `getUserSizeFromOllama(ollamaSize: number): number`

**Old location:** contextManager.ts line 614
**New location:** ContextSizeCalculator.getUserSizeFromOllama()
**Reason:** Pure calculation, belongs in calculator

### 4. `getLowerTier(tier: ContextTier): ContextTier`

**Old location:** contextManager.ts line 621
**New location:** REMOVED - not used
**Reason:** Dead code, no callers

### 5. `getRecommendedAutoSize(maxPossibleOllamaContext: number): number`

**Old location:** contextManager.ts line 636
**New location:** REMOVED - logic simplified
**Reason:** Complex auto-sizing logic removed, now uses ContextPool.calculateOptimalSize()

### 6. `getTierTargetSize(tier: ContextTier): number`

**Old location:** old_contextManager.ts (not in grep results, but was there)
**New location:** REMOVED - not needed
**Reason:** Hardcoded tier sizes, now uses model profiles

## Methods Removed (Delegated to Other Services)

### 7. `detectContextTier(): TierConfig`

**Old location:** contextManager.ts line 671
**New location:** Simplified in start() method
**Reason:** Just calls ContextSizeCalculator.determineTier() now

### 8. `updateSystemPrompt(): void`

**Old location:** contextManager.ts line 706
**New location:** REMOVED - delegated to PromptOrchestrator
**Reason:** ContextManager shouldn't build prompts, just coordinate

### 9. `setTaskDefinition(task: TaskDefinition): void`

**Old location:** contextManager.ts line 726
**New location:** Still exists, delegates to checkpointManager
**Reason:** Kept as convenience method

### 10. `addArchitectureDecision(decision: ArchitectureDecision): void`

**Old location:** contextManager.ts line 733
**New location:** Still exists, delegates to checkpointManager
**Reason:** Kept as convenience method

### 11. `addNeverCompressed(section: NeverCompressedSection): void`

**Old location:** contextManager.ts line 740
**New location:** Still exists, delegates to checkpointManager
**Reason:** Kept as convenience method

### 12. `discoverContext(targetPath: string): Promise<void>`

**Old location:** contextManager.ts line 748
**New location:** REMOVED - not used
**Reason:** JIT discovery feature not implemented yet

## File Logging Removed

### All `fs.appendFileSync` calls to `context-debug.log`

**Old location:** Scattered throughout old file
**New location:** REMOVED
**Reason:** File logging is bad practice, use proper logger instead

Examples removed:

```typescript
fs.appendFileSync('context-debug.log', `[${timestamp}] Auto-sizing: ...`);
fs.appendFileSync('context-debug.log', `[${timestamp}] Tier detection: ...`);
fs.appendFileSync('context-debug.log', `[${timestamp}] VRAM info: ...`);
```

## Complex Auto-Sizing Logic Removed

### Old auto-sizing flow (lines 277-341 in old file):

```typescript
// 1. Get VRAM info
// 2. Calculate max possible context
// 3. Get recommended size
// 4. Detect tier
// 5. Get tier target size
// 6. Calculate Ollama size
// 7. Resize context pool
// 8. Update system prompt
```

### New auto-sizing flow (lines 238-290 in new file):

```typescript
// 1. Get VRAM info
// 2. Calculate optimal size (delegates to ContextPool)
// 3. Detect tier (uses ContextSizeCalculator)
// 4. Resize if needed
// 5. Emit events (other services react)
```

**Reason:** Simplified, no scattered logic, clear separation of concerns

## Prompt Building Logic Removed

### Old: ContextManager built prompts directly

```typescript
private updateSystemPrompt(): void {
  const { message, tokenBudget } = this.promptOrchestrator.updateSystemPrompt({
    mode: this.currentMode,
    tier: this.currentTier,
    // ... lots of parameters
  });
  // ... update context
}
```

### New: ContextManager just coordinates

```typescript
// Prompt building happens in validateAndBuildPrompt()
// which is called by chatClient, not by ContextManager
```

**Reason:** ContextManager shouldn't build prompts, that's PromptOrchestrator's job

## Snapshot Creation Logic Removed

### Old: ContextManager created snapshots directly

```typescript
// Had direct calls to snapshotCoordinator.createSnapshot()
// Mixed with context management logic
```

### New: ContextManager just coordinates

```typescript
// Snapshot creation is bound as a callback
// messageStore.setCreateSnapshot(() => snapshotCoordinator.createSnapshot())
```

**Reason:** ContextManager shouldn't create snapshots, just coordinate them

## What Was Kept

### Core Responsibilities (Still in ContextManager):

1. ✅ Start/stop lifecycle
2. ✅ Add messages (delegates to messageStore)
3. ✅ Get messages
4. ✅ Clear context
5. ✅ Set/get mode
6. ✅ Get tier
7. ✅ Validate and build prompt (coordinates with PromptOrchestrator)
8. ✅ Event coordination (low-memory, tier-changed, etc.)
9. ✅ VRAM monitoring coordination
10. ✅ Context pool coordination

### Delegation Methods (Convenience wrappers):

- `setTaskDefinition()` → checkpointManager
- `addArchitectureDecision()` → checkpointManager
- `addNeverCompressed()` → checkpointManager
- `setActiveSkills()` → promptOrchestrator
- `getActiveSkills()` → promptOrchestrator

## Summary

### Removed (473 lines):

- ❌ Calculation logic (moved to ContextSizeCalculator)
- ❌ File logging (removed entirely)
- ❌ Complex auto-sizing logic (simplified)
- ❌ Direct prompt building (delegated to PromptOrchestrator)
- ❌ Direct snapshot creation (delegated to SnapshotCoordinator)
- ❌ Dead code (getLowerTier, discoverContext)
- ❌ Hardcoded tier sizes (now uses model profiles)

### Kept (616 lines):

- ✅ Lifecycle management (start/stop)
- ✅ Message coordination (add/get/clear)
- ✅ Mode management (set/get)
- ✅ Tier tracking (get)
- ✅ Event coordination (emit events, other services react)
- ✅ Service coordination (VRAM, pool, modules)
- ✅ Validation and prompt building coordination

### Result:

- **Cleaner:** No scattered calculation logic
- **Simpler:** No complex auto-sizing flow
- **Focused:** Does ONE job (orchestrate context)
- **Testable:** Pure functions extracted to ContextSizeCalculator
- **Maintainable:** Clear separation of concerns
