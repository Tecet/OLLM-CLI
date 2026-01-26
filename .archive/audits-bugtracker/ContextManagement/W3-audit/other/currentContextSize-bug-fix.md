# currentContextSize Bug Fix

**Date:** 2026-01-17  
**Status:** ✅ Resolved

## Problem

The CLI crashed on startup with:
```
ReferenceError: currentContextSize is not defined
at file:///D:/Workspaces/OLLM%20CLI/packages/cli/dist/cli.js:35075:44
```

## Root Cause

The `buildWelcomeMessage` callback in `packages/cli/src/ui/App.tsx` was trying to use a variable `currentContextSize` that was not defined in its scope. The callback needed to get the current context size from the ContextManager state.

## Solution

1. **Get context state**: Updated the `useContextManager` hook destructuring to include `state: contextState`
2. **Extract context size**: Added `const currentContextSize = contextState.usage.maxTokens;` inside the callback
3. **Update dependencies**: Added `contextState.usage.maxTokens` to the callback's dependency array

## Changes Made

**File:** `packages/cli/src/ui/App.tsx`

### Change 1: Get context state
```typescript
// Before
const { actions: contextActions } = useContextManager();

// After
const { state: contextState, actions: contextActions } = useContextManager();
```

### Change 2: Use context size from state
```typescript
// Before
const buildWelcomeMessage = useCallback(() => {
  // ... setup code ...
  return createWelcomeMessage(modelName, currentContextSize, profile, effectiveGPUInfo);
}, [currentModel, gpuInfo]);

// After
const buildWelcomeMessage = useCallback(() => {
  // ... setup code ...
  const currentContextSize = contextState.usage.maxTokens;
  return createWelcomeMessage(modelName, currentContextSize, profile, effectiveGPUInfo);
}, [currentModel, gpuInfo, contextState.usage.maxTokens]);
```

## Verification

- ✅ Build completed successfully
- ✅ No TypeScript diagnostics
- ✅ Bug added to bug tracker

## Related Files

- `packages/cli/src/ui/App.tsx` - Fixed
- `packages/cli/src/features/context/ContextManagerContext.tsx` - Source of context size
- `packages/cli/src/features/context/SystemMessages.tsx` - Welcome message creation
- `.dev/bugtracker.md` - Bug tracking entry added
