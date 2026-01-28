# Command and Model Swap Audit

**Date:** January 28, 2026  
**Status:** 🔍 AUDIT IN PROGRESS

---

## Issues Found

### Issue 1: Model Swap Clears Chat Instead of Creating New Session

**Current Behavior:**
- Model swap calls `__ollmResetSession()`
- `__ollmResetSession()` changes sessionId
- ContextManagerProvider remounts with `key={sessionId}`
- Remount creates fresh context (empty messages)
- Chat appears cleared

**Expected Behavior:**
- Model swap should create new session
- But preserve welcome message
- Show confirmation of model loaded and context size

**Root Cause:**
- ContextManagerProvider remount clears all messages
- No welcome message generated after remount
- No confirmation message about model/context

---

### Issue 2: No Confirmation After Model Swap

**Current Behavior:**
- System message: "Switched to {model}. Tools: {status}"
- No context size information
- No welcome message with model details

**Expected Behavior:**
- Show which model was loaded
- Show which context size was selected
- Show welcome message with model capabilities

---

### Issue 3: /new and /clear Commands Confused

**Current Behavior:**

**`/new` command:**
- Returns `action: 'new-session'`
- Calls `__ollmResetSession(currentModel)`
- Creates new session
- Clears messages (via remount)
- Shows welcome message

**`/clear` command:**
- Returns `action: 'clear-chat'`
- Calls `contextActions.clear()`
- Clears messages
- Preserves system prompt
- Does NOT create new session

**Expected Behavior:**

**`/new` should:**
- Create new session
- Keep current model
- Show welcome message
- NOT clear existing chat (just start fresh session)

**`/clear` should:**
- Clear chat messages only
- Keep same session
- Keep same model
- NOT show welcome message

**User's Requirement:**
> "/clear - clears chat conversation - but not start new session just clear screen"
> "/new only start new session but not clear chat"
> "link model swap to /new"

---

## Proposed Solution

### Fix 1: Model Swap Should NOT Clear Chat

**Change:**
- Model swap should call `/new` command logic
- `/new` creates new session but preserves messages
- Add confirmation message with model and context info

**Implementation:**
1. Model swap calls `__ollmResetSession()` (keeps this)
2. After remount, add welcome message
3. Add confirmation: "Loaded {model} with {context} context"

---

### Fix 2: Separate /new and /clear Behavior

**`/new` command:**
```typescript
// Create new session
// Keep current model
// Keep existing messages
// Add welcome message
// Show: "New session created. Session ID: {id}"
```

**`/clear` command:**
```typescript
// Clear messages only
// Keep same session
// Keep same model
// Show: "Chat cleared. Session continues."
```

---

### Fix 3: Link Model Swap to /new

**Model swap flow:**
1. User selects model + context size
2. Call `/new` command logic internally
3. Set new model
4. Create new session
5. Keep existing messages
6. Add welcome message
7. Add confirmation message

---

## Implementation Plan

### Step 1: Fix ContextManagerProvider Remount

**Problem:** Remount clears all messages

**Solution:** Don't clear messages on remount, just reset context manager

**File:** `packages/cli/src/features/context/ContextManagerContext.tsx`

```typescript
// On remount, preserve messages but create new context manager
// Welcome message should be added by App.tsx after remount
```

---

### Step 2: Fix /new Command

**Problem:** /new clears chat

**Solution:** /new creates new session but preserves messages

**File:** `packages/cli/src/commands/sessionCommands.ts`

```typescript
export const newCommand: Command = {
  name: '/new',
  description: 'Create a new session (preserves chat history)',
  usage: '/new',
  handler: async (): Promise<CommandResult> => {
    return {
      success: true,
      action: 'new-session',
      message: 'New session created.',
    };
  },
};
```

**File:** `packages/cli/src/features/context/handlers/commandHandler.ts`

```typescript
if (result.action === 'new-session') {
  // Create new session WITHOUT clearing messages
  if ((globalThis as any).__ollmResetSession) {
    const newSessionId = (globalThis as any).__ollmResetSession(currentModel);
    console.log(`[CommandHandler] New session: ${newSessionId}`);
  }
  // Don't call clearChat()
}
```

---

### Step 3: Fix /clear Command

**Problem:** Already works correctly

**Solution:** Keep as is - clears messages, same session

---

### Step 4: Add Welcome Message After Model Swap

**Problem:** No welcome message after model swap

**Solution:** App.tsx should add welcome message after remount

**File:** `packages/cli/src/ui/App.tsx`

```typescript
// After __ollmResetSession, add welcome message
useEffect(() => {
  if (sessionId && currentAppModel) {
    // Add welcome message with model info
    const welcomeMsg = buildWelcomeMessage();
    addMessage(welcomeMsg);
    
    // Add confirmation message
    const contextSize = selectedContextSize ?? config.context?.targetSize ?? 4096;
    addMessage({
      role: 'system',
      content: `Loaded **${currentAppModel}** with **${contextSize}** tokens context.`,
      excludeFromContext: true,
    });
  }
}, [sessionId, currentAppModel]);
```

---

### Step 5: Link Model Swap to /new

**Problem:** Model swap should behave like /new

**Solution:** Model swap calls same logic as /new

**File:** `packages/cli/src/features/context/ModelContext.tsx`

```typescript
// Model swap
setCurrentModel(model);
setModelLoading(true);

// Unload old model
if (previousModel && provider.unloadModel) {
  await provider.unloadModel(previousModel);
}

// Create new session (same as /new command)
if ((globalThis as any).__ollmResetSession) {
  const newSessionId = (globalThis as any).__ollmResetSession(model);
  console.log(`[ModelContext] New session: ${newSessionId}`);
}

// Welcome message will be added by App.tsx useEffect
```

---

## Expected Behavior After Fix

### Model Swap

```
User: (selects llama3.2:3b with 8k context)
    ↓
System: "Welcome to OLLM CLI!
         LLM Model: llama3.2:3b
         Context: 8192 tokens (~2.5 GB VRAM)
         ..."
    ↓
System: "Loaded llama3.2:3b with 8192 tokens context."
    ↓
(Chat history preserved if any)
```

### /new Command

```
User: /new
    ↓
System: "New session created. Session ID: session-XXX"
    ↓
System: "Welcome to OLLM CLI!
         LLM Model: llama3.2:3b
         Context: 8192 tokens
         ..."
    ↓
(Chat history preserved)
```

### /clear Command

```
User: /clear
    ↓
System: "Chat cleared. Session continues."
    ↓
(All messages cleared, same session)
```

---

## Testing Checklist

### Model Swap
- [ ] Select model → new session created
- [ ] Welcome message appears
- [ ] Confirmation shows model and context
- [ ] Chat history preserved (if any)
- [ ] Session ID changes
- [ ] Console logs new session

### /new Command
- [ ] Type `/new` → new session created
- [ ] Welcome message appears
- [ ] Chat history preserved
- [ ] Session ID changes
- [ ] Message: "New session created"

### /clear Command
- [ ] Type `/clear` → messages cleared
- [ ] Session ID unchanged
- [ ] No welcome message
- [ ] Message: "Chat cleared"

---

## Files to Modify

1. `packages/cli/src/ui/App.tsx`
   - Add useEffect to show welcome message after session change
   - Add confirmation message with model and context info

2. `packages/cli/src/features/context/ModelContext.tsx`
   - Keep current implementation (already correct)
   - Maybe add more detailed confirmation message

3. `packages/cli/src/features/context/handlers/commandHandler.ts`
   - Remove `clearChat()` call from 'new-session' action
   - Keep session reset only

4. `packages/cli/src/commands/sessionCommands.ts`
   - Update /new description
   - Update /clear description

---

**Status:** Ready to implement fixes
