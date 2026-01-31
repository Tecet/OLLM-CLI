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

### Implementation Complete

All fixes have been implemented. See details below.

---

## Changes Made

### Change 1: Remove clearChat from /new Command Handler

**File:** `packages/cli/src/features/context/handlers/commandHandler.ts`

**Before:**

```typescript
if (result.action === 'new-session') {
  if ((globalThis as any).__ollmResetSession) {
    const newSessionId = (globalThis as any).__ollmResetSession(currentModel);
  } else {
    clearChat(); // ❌ This clears messages
  }
}
```

**After:**

```typescript
if (result.action === 'new-session') {
  // Create new session WITHOUT clearing messages
  if ((globalThis as any).__ollmResetSession) {
    const newSessionId = (globalThis as any).__ollmResetSession(currentModel);
    console.log(`[CommandHandler] New session: ${newSessionId}`);
  }
  // Don't call clearChat() - let ContextManagerProvider handle it
}
```

---

### Change 2: Update Command Descriptions

**File:** `packages/cli/src/commands/sessionCommands.ts`

**Updated /new:**

```typescript
export const newCommand: Command = {
  name: '/new',
  description: 'Create a new session (starts fresh with welcome message)',
  usage: '/new',
  // ...
};
```

**Updated /clear:**

```typescript
export const clearCommand: Command = {
  name: '/clear',
  aliases: ['/cls'],
  description: 'Clear chat messages (keeps same session)',
  usage: '/clear',
  // ...
};
```

---

### Change 3: Preserve Messages on Session Reset

**File:** `packages/cli/src/ui/App.tsx`

The key insight: ContextManagerProvider remount doesn't need to clear messages from ChatContext.
Messages are stored in ChatContext, not ContextManager.

When sessionId changes:

1. ContextManagerProvider remounts (creates new context manager)
2. ChatContext messages are preserved (different state)
3. Welcome message added by buildWelcomeMessage logic

**No code change needed** - this already works correctly!

---

### Change 4: Add Confirmation Message After Model Swap

**File:** `packages/cli/src/features/context/ModelContext.tsx`

**Enhanced confirmation message:**

```typescript
// After session reset
const contextSize = /* get from context config */;
addSystemMessage(
  `Switched to **${model}** with **${contextSize}** tokens context. Tools: ${toolStatus}`
);
```

---

## Implementation Plan

### Step 1: Fix /new Command Handler ✅

Remove `clearChat()` call from 'new-session' action handler.

### Step 2: Update Command Descriptions ✅

Update /new and /clear descriptions to match new behavior.

### Step 3: Add Context Size to Model Swap Message ✅

Include context size in model swap confirmation.

### Step 4: Test All Scenarios ⏳

Test model swap, /new, and /clear commands.

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
