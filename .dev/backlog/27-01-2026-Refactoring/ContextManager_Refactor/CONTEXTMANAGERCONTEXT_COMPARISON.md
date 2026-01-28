# ContextManagerContext.tsx Refactoring - What Was Removed

## File Size Comparison
- **Old:** 1056 lines
- **New:** 750 lines
- **Removed:** 306 lines (29% reduction)

## What Was Removed

### 1. File Logging (REMOVED)
**Old location:** Scattered throughout tier change callback
```typescript
fs.appendFileSync('context-debug.log', `[${timestamp}] TIER CHANGE EVENT: ...`);
fs.appendFileSync('context-debug.log', `[${timestamp}] effectivePromptTier event received`);
fs.appendFileSync('context-debug.log', `[${timestamp}] Raw value: ...`);
```

**New:** NO file logging
**Reason:** File logging is bad practice, use proper logger or console

### 2. Hardcoded Tier Mapping (REMOVED)
**Old location:** Inside tierChangeCallback
```typescript
const tierToString = (tier: string | number | undefined): string => {
  if (tier === undefined) return 'Unknown';
  
  if (typeof tier === 'string') {
    const tierMap: Record<string, string> = {
      '2-4K': 'Tier 1',
      '8K': 'Tier 2',
      '16K': 'Tier 3',
      '32K': 'Tier 4',
      '64K+': 'Tier 5'
    };
    return tierMap[tier] || `Tier ${tier}`;
  }
  
  return `Tier ${tier}`;
};
```

**New:** Core emits `ContextTier` enum (1-5), UI just displays it
**Reason:** No need to convert, core already sends the right format

### 3. Complex Tier State Management (SIMPLIFIED)
**Old state:**
```typescript
const [currentTier, setCurrentTier] = useState<string>('Tier 3');
const [effectivePromptTier, setEffectivePromptTier] = useState<string>('Tier 3');
const [actualContextTier, setActualContextTier] = useState<string>('Tier 3');
const [forceUpdateCounter, setForceUpdateCounter] = useState(0);

const currentTierRef = useRef(currentTier);
const effectivePromptTierRef = useRef(effectivePromptTier);
const actualContextTierRef = useRef(actualContextTier);

useEffect(() => { currentTierRef.current = currentTier; }, [currentTier]);
useEffect(() => { effectivePromptTierRef.current = effectivePromptTier; }, [effectivePromptTier]);
useEffect(() => { actualContextTierRef.current = actualContextTier; }, [actualContextTier]);
```

**New state:**
```typescript
const [currentTier, setCurrentTier] = useState<ContextTier>(3);
```

**Reason:** 
- Core manages tier logic, UI just displays
- No need for 3 different tier states
- No need for refs to avoid stale closures
- No need for force update counter

### 4. Complex Tier Change Callback (SIMPLIFIED)
**Old:** 100+ lines of tier conversion logic, file logging, multiple state updates

**New:** 5 lines
```typescript
manager.on('tier-changed', (data: unknown) => {
  const tierData = data as { tier?: ContextTier };
  if (tierData.tier !== undefined) {
    setCurrentTier(tierData.tier);
  }
});
```

**Reason:** Core does all the work, UI just listens

### 5. Duplicate Event Listeners (REMOVED)
**Old:** Listened to both 'tier-changed' AND 'started' events with complex logic

**New:** Listen to both but simplified
```typescript
manager.on('tier-changed', (data) => { /* update tier */ });
manager.on('started', (data) => { /* update tier and autoSize */ });
```

**Reason:** Simpler, no duplicate logic

## What Was Kept

### Core Responsibilities (Still in ContextManagerContext):
1. ✅ Initialize core ContextManager
2. ✅ Create mode manager, snapshot manager, workflow manager
3. ✅ Listen to core events and update UI state
4. ✅ Expose actions to React components
5. ✅ Manage global context manager reference
6. ✅ Handle mode changes and persistence
7. ✅ Create mode transition snapshots

### All Actions (Still exposed):
- ✅ addMessage, compress, clear
- ✅ createSnapshot, restoreSnapshot, refreshSnapshots
- ✅ updateConfig, refreshVRAM, getContext
- ✅ resize, hotSwap, getSystemPrompt
- ✅ on, off, getUsage, getConfig, getManager
- ✅ Mode management (switchMode, setAutoSwitch, etc.)
- ✅ reportInflightTokens, clearInflightTokens

## Summary

### Removed (306 lines):
- ❌ File logging (fs.appendFileSync)
- ❌ Hardcoded tier mapping (tierToString function)
- ❌ Complex tier state (3 tier states + refs + force update)
- ❌ Complex tier conversion logic
- ❌ Duplicate event handling

### Kept (750 lines):
- ✅ Core manager initialization
- ✅ Mode manager integration
- ✅ Snapshot manager integration
- ✅ Event listeners (simplified)
- ✅ All actions
- ✅ React hooks
- ✅ Global manager reference

### Result:
- **Cleaner:** No file logging, no hardcoded mappings
- **Simpler:** One tier state instead of three
- **Focused:** Just bridges core to React, no business logic
- **Maintainable:** Core does calculations, UI just displays
- **Type-safe:** Uses ContextTier enum from core
