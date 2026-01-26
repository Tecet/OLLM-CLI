# LLM Fix 3.2: Replace Global Callbacks with DI - Implementation Plan

**Date:** January 19, 2026  
**Priority:** P2 - MEDIUM  
**Effort:** 3-4 days  
**Status:** ⏳ IN PROGRESS

---

## Overview

Replace global callback pattern (`globalThis.__ollm*`) with proper dependency injection using React Context. This improves testability, type safety, and maintainability.

---

## Current State Analysis

### Global Callbacks in Use

1. **`globalThis.__ollmPromptUser`**
   - **Purpose:** Prompt user for input (e.g., tool support confirmation)
   - **Signature:** `(message: string, options: string[]) => Promise<string>`
   - **Registered in:** `UserPromptBridge.tsx`
   - **Used in:** `ModelContext.tsx` (3 locations)

2. **`globalThis.__ollmAddSystemMessage`**
   - **Purpose:** Add system messages to chat
   - **Signature:** `(message: string) => void`
   - **Registered in:** `App.tsx` (likely)
   - **Used in:** `ModelContext.tsx` (6 locations), `ToolSupportMessages.ts`

3. **`globalThis.__ollmClearContext`**
   - **Purpose:** Clear conversation context
   - **Signature:** `() => void`
   - **Registered in:** `App.tsx` (likely)
   - **Used in:** `ModelContext.tsx` (2 locations)

4. **`globalThis.__ollmOpenModelMenu`**
   - **Purpose:** Open model selection menu
   - **Signature:** `() => void`
   - **Registered in:** `App.tsx`
   - **Used in:** Unknown (needs investigation)

### Problems with Current Approach

1. **No Type Safety**
   - Callbacks can be undefined at runtime
   - No compile-time checking
   - Easy to forget to register callbacks

2. **Difficult to Test**
   - Requires global mocks
   - Tests must clean up global state
   - No isolation between tests

3. **Fragile Integration**
   - Features degrade silently when callbacks missing
   - No clear contract between components
   - Hard to track dependencies

4. **Poor Architecture**
   - Violates React best practices
   - Makes refactoring difficult
   - Unclear data flow

---

## Solution Design

### Approach: React Context + Dependency Injection

Create a new `UICallbacksContext` that provides type-safe callbacks to components that need them.

### Architecture

```
App.tsx
  └─ UICallbacksProvider (new)
       ├─ promptUser: (message, options) => Promise<string>
       ├─ addSystemMessage: (message) => void
       ├─ clearContext: () => void
       └─ openModelMenu: () => void
       
       └─ ModelProvider
            └─ Uses useUICallbacks() hook
            
       └─ Other components
            └─ Use useUICallbacks() hook
```

### Benefits

1. **Type Safety**
   - TypeScript interfaces for all callbacks
   - Compile-time checking
   - IntelliSense support

2. **Testability**
   - Easy to mock in tests
   - No global state pollution
   - Isolated test environments

3. **Clear Contracts**
   - Explicit dependencies
   - Clear data flow
   - Better documentation

4. **React Best Practices**
   - Uses Context API properly
   - Follows React patterns
   - Easier to maintain

---

## Implementation Steps

### Step 1: Create UICallbacks Context (1-2 hours)

**File:** `packages/cli/src/ui/contexts/UICallbacksContext.tsx` (NEW)

```typescript
import React, { createContext, useContext, ReactNode } from 'react';

/**
 * UI Callbacks interface
 * Provides methods for components to interact with the UI layer
 */
export interface UICallbacks {
  /**
   * Prompt the user for input
   * @param message The prompt message
   * @param options Available options
   * @returns The user's selection
   */
  promptUser: (message: string, options: string[]) => Promise<string>;
  
  /**
   * Add a system message to the chat
   * @param message The message to add
   */
  addSystemMessage: (message: string) => void;
  
  /**
   * Clear the conversation context
   */
  clearContext: () => void;
  
  /**
   * Open the model selection menu
   */
  openModelMenu: () => void;
}

/**
 * Default no-op implementations for callbacks
 * Used when context is not available (e.g., in tests)
 */
const defaultCallbacks: UICallbacks = {
  promptUser: async (message: string, options: string[]) => {
    console.warn('promptUser called but no callback registered:', message);
    return options[options.length - 1]; // Default to last option
  },
  addSystemMessage: (message: string) => {
    console.warn('addSystemMessage called but no callback registered:', message);
  },
  clearContext: () => {
    console.warn('clearContext called but no callback registered');
  },
  openModelMenu: () => {
    console.warn('openModelMenu called but no callback registered');
  },
};

const UICallbacksContext = createContext<UICallbacks>(defaultCallbacks);

export interface UICallbacksProviderProps {
  children: ReactNode;
  callbacks: UICallbacks;
}

/**
 * Provider for UI callbacks
 */
export function UICallbacksProvider({ children, callbacks }: UICallbacksProviderProps) {
  return (
    <UICallbacksContext.Provider value={callbacks}>
      {children}
    </UICallbacksContext.Provider>
  );
}

/**
 * Hook to access UI callbacks
 */
export function useUICallbacks(): UICallbacks {
  return useContext(UICallbacksContext);
}
```

---

### Step 2: Update App.tsx to Provide Callbacks (1-2 hours)

**File:** `packages/cli/src/ui/App.tsx`

**Changes:**
1. Import `UICallbacksProvider` and `UICallbacks`
2. Create callback implementations
3. Wrap `ModelProvider` with `UICallbacksProvider`
4. Remove global callback registrations

**Before:**
```typescript
useEffect(() => {
  globalThis.__ollmOpenModelMenu = () => openModelContextMenu();
  return () => {
    if (globalThis.__ollmOpenModelMenu) {
      globalThis.__ollmOpenModelMenu = undefined;
    }
  };
}, [openModelContextMenu]);
```

**After:**
```typescript
const uiCallbacks: UICallbacks = {
  promptUser: async (message: string, options: string[]) => {
    // Implementation using existing prompt logic
    return await promptUser(message, options, 30000, options[options.length - 1]);
  },
  addSystemMessage: (message: string) => {
    // Implementation using existing message logic
    addMessage({ role: 'system', content: message });
  },
  clearContext: () => {
    // Implementation using existing clear logic
    setMessages([]);
  },
  openModelMenu: () => {
    openModelContextMenu();
  },
};

return (
  <UICallbacksProvider callbacks={uiCallbacks}>
    <ModelProvider provider={provider} initialModel={currentModel}>
      {/* ... rest of app */}
    </ModelProvider>
  </UICallbacksProvider>
);
```

---

### Step 3: Update ModelContext to Use Hook (2-3 hours)

**File:** `packages/cli/src/features/context/ModelContext.tsx`

**Changes:**
1. Import `useUICallbacks` hook
2. Replace all `globalThis.__ollm*` calls with hook calls
3. Remove fallback checks (hook provides defaults)

**Before:**
```typescript
const promptUser = globalThis.__ollmPromptUser;
const addSystemMessage = globalThis.__ollmAddSystemMessage;

if (!promptUser) {
  // Fallback logic
}
```

**After:**
```typescript
const { promptUser, addSystemMessage, clearContext } = useUICallbacks();

// No fallback needed - hook provides defaults
```

**Locations to Update:**
1. Line 265: `handleToolError` function
2. Line 343: `autoDetectToolSupport` function
3. Line 431: `handleUnknownModel` function
4. Line 519: Model switch tool status message
5. Line 543: Context clearing on model switch
6. Line 561: Tool support status message
7. Line 581: Context clearing on model switch (duplicate)
8. Line 765: Warmup skip message

---

### Step 4: Update ToolSupportMessages.ts (30 minutes)

**File:** `packages/cli/src/features/context/ToolSupportMessages.ts`

**Changes:**
1. Remove `addSystemMessage` function (no longer needed)
2. Update callers to use `useUICallbacks` hook directly

**Note:** This file may need to be refactored into a hook or component to access React context.

---

### Step 5: Remove UserPromptBridge.tsx (15 minutes)

**File:** `packages/cli/src/features/context/UserPromptBridge.tsx`

**Action:** Delete this file - no longer needed

**Reason:** Callbacks are now provided via context, not global registration

---

### Step 6: Update Tests (3-4 hours)

**Files to Update:**
1. `packages/cli/src/features/context/__tests__/ModelContext.test.tsx`
2. `packages/cli/src/features/context/__tests__/ToolSupportDetection.property.test.tsx`

**Changes:**
1. Remove global callback setup/teardown
2. Wrap test components with `UICallbacksProvider`
3. Provide mock callbacks via context
4. Update assertions to check context callbacks

**Before:**
```typescript
beforeEach(() => {
  globalThis.__ollmAddSystemMessage = undefined;
  globalThis.__ollmPromptUser = undefined;
});

afterEach(() => {
  globalThis.__ollmAddSystemMessage = undefined;
  globalThis.__ollmPromptUser = undefined;
});
```

**After:**
```typescript
const mockCallbacks: UICallbacks = {
  promptUser: vi.fn().mockResolvedValue('Yes'),
  addSystemMessage: vi.fn(),
  clearContext: vi.fn(),
  openModelMenu: vi.fn(),
};

// In test:
render(
  <UICallbacksProvider callbacks={mockCallbacks}>
    <ModelProvider provider={mockProvider} initialModel="test">
      {/* test component */}
    </ModelProvider>
  </UICallbacksProvider>
);
```

---

### Step 7: Update Type Definitions (30 minutes)

**File:** `packages/cli/src/types/global.d.ts` (if exists)

**Action:** Remove global callback type definitions

**Before:**
```typescript
declare global {
  var __ollmPromptUser: ((message: string, options: string[]) => Promise<string>) | undefined;
  var __ollmAddSystemMessage: ((message: string) => void) | undefined;
  var __ollmClearContext: (() => void) | undefined;
  var __ollmOpenModelMenu: (() => void) | undefined;
}
```

**After:** Delete these declarations

---

### Step 8: Documentation Updates (1 hour)

**Files to Update:**
1. Architecture documentation
2. Component documentation
3. Testing guide

**Topics to Cover:**
1. How to use `useUICallbacks` hook
2. How to provide callbacks in tests
3. Migration guide for existing code

---

## Testing Strategy

### Unit Tests

1. **UICallbacksContext Tests**
   - Default callbacks work
   - Custom callbacks override defaults
   - Hook returns correct callbacks

2. **ModelContext Tests**
   - Callbacks are called correctly
   - Fallback behavior works
   - Error handling

3. **Integration Tests**
   - Full callback flow works
   - Multiple components can use callbacks
   - Context updates propagate

### Manual Testing

1. **Tool Support Detection**
   - Prompt appears correctly
   - User selection works
   - System messages appear

2. **Model Switching**
   - Context clearing works
   - Tool status messages appear
   - Warmup messages appear

3. **Error Scenarios**
   - Missing callbacks handled gracefully
   - Error messages clear

---

## Migration Checklist

- [ ] Step 1: Create UICallbacksContext
- [ ] Step 2: Update App.tsx
- [ ] Step 3: Update ModelContext
- [ ] Step 4: Update ToolSupportMessages
- [ ] Step 5: Remove UserPromptBridge
- [ ] Step 6: Update tests
- [ ] Step 7: Update type definitions
- [ ] Step 8: Update documentation
- [ ] Run all tests
- [ ] Manual testing
- [ ] Code review
- [ ] Create completion document

---

## Risk Assessment

### Low Risk
- Context API is well-established React pattern
- Default callbacks provide safety net
- Incremental migration possible

### Medium Risk
- Large number of files to update
- Tests need significant changes
- Potential for missed usage sites

### Mitigation
- Comprehensive grep search for all usage
- Keep global callbacks temporarily during migration
- Thorough testing at each step
- Rollback plan if issues arise

---

## Rollback Plan

If issues arise:
1. Revert context changes
2. Restore global callbacks
3. Keep both systems temporarily
4. Gradual migration over multiple PRs

---

## Timeline

| Step | Estimated Time | Cumulative |
|------|----------------|------------|
| 1. Create Context | 1-2 hours | 2 hours |
| 2. Update App.tsx | 1-2 hours | 4 hours |
| 3. Update ModelContext | 2-3 hours | 7 hours |
| 4. Update ToolSupportMessages | 30 min | 7.5 hours |
| 5. Remove UserPromptBridge | 15 min | 7.75 hours |
| 6. Update Tests | 3-4 hours | 11.75 hours |
| 7. Update Types | 30 min | 12.25 hours |
| 8. Documentation | 1 hour | 13.25 hours |
| Testing & Review | 2-3 hours | 16 hours |
| **Total** | **~2 days** | **16 hours** |

---

## Success Criteria

- [ ] All global callbacks removed
- [ ] All tests passing
- [ ] No TypeScript errors
- [ ] Manual testing successful
- [ ] Documentation updated
- [ ] Code review approved
- [ ] No regressions in functionality

---

## Next Steps

1. Review this plan
2. Start with Step 1 (Create Context)
3. Proceed incrementally through steps
4. Test after each step
5. Create completion document

---

**Plan Created:** January 19, 2026  
**Ready to Start:** Yes  
**First Task:** Step 1 - Create UICallbacksContext
