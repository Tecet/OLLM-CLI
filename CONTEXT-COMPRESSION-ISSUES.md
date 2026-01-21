# Context Compression & Snapshot Issues - Analysis

**Date:** 2026-01-21  
**Session:** Context overflow and compression debugging

---

## Issues Identified

### 1. ❌ Snapshot Summary is Wrong
**Location:** `packages/core/src/context/snapshotManager.ts` line 333-335

**Problem:**
```typescript
if (userMessages.length === 1) {
  return this.truncateText(userMessages[0].content, 100);
}
```

When there's only 1 user message, the snapshot summary is just the user's message ("yes", "continue") instead of describing the conversation.

**Impact:** Low - Snapshots are for recovery, not for LLM context

**Fix Needed:** Generate a proper summary that describes the conversation, not just echo the user's message.

---

### 2. ❌ LLM Loses Context After First "Continue"
**Observed Behavior:**
- User sends long message → LLM responds correctly
- User types "continue" → LLM remembers and continues (1st time works ✓)
- User types "continue" again → LLM says "How can I help you?" (lost memory ✗)

**Root Cause:** Compression creates checkpoints, but checkpoints are NOT being sent to LLM

**Evidence:**
- 3 snapshot files created (shows compression is running)
- Snapshots created with delay (shows LLM is generating summaries)
- LLM loses memory on 2nd continue (shows checkpoints not in context)

---

### 3. ❌ Checkpoint Summaries Not Sent to LLM
**Location:** Message flow from context manager to LLM

**Problem:** After compression creates checkpoints:
1. ✅ Checkpoints are created and stored in `context.checkpoints[]`
2. ✅ Checkpoint summaries are added to `context.messages[]`
3. ❌ When `getContext()` is called, checkpoint messages are NOT included
4. ❌ LLM receives incomplete history without checkpoints

**Expected Flow:**
```
User: "Write about prime numbers"
Assistant: [long response]
→ Context fills → Compression runs
→ Creates checkpoint: "User asked about primes, assistant explained..."
→ Context now has: [system, checkpoint, recent messages]

User: "continue"
→ LLM should receive: [system, checkpoint, "continue"]
→ LLM should understand context from checkpoint
```

**Actual Flow:**
```
User: "continue"
→ LLM receives: [system, "continue"]  ← Missing checkpoint!
→ LLM has no context, responds with "How can I help?"
```

---

### 4. ❌ Assistant Messages Not in Snapshots
**Location:** `packages/cli/src/features/context/ChatContext.tsx` onComplete callback

**Problem:** Race condition between adding assistant message and creating snapshot

**Current Code:**
```typescript
// Add assistant message
await contextActions?.addMessage({ role: 'assistant', content: assistantContent });

// Create snapshot (async, doesn't wait)
contextActions?.createSnapshot().then(...)
```

**Issue:** Snapshot is created before assistant message is fully committed to context

**Fix Applied:** Changed to use async/await to ensure proper sequencing

---

### 5. ⚠️ 85% Context Cap Not Working
**Location:** `packages/cli/src/features/context/ModelContext.tsx` line 726-738

**Problem:** The 85% cap strategy is implemented but not triggering `finishReason: 'length'`

**Evidence:**
- Context shows "650/4096" but LLM doesn't stop at 85% (3482 tokens)
- No `compression-debug.log` file created (means finishReason !== 'length')

**Possible Causes:**
1. Model profile doesn't have `context_profiles` with `ollama_context_size`
2. Ollama is not respecting the `num_ctx` parameter
3. Token counting is inaccurate (not matching Ollama's count)

---

## Files Modified

### 1. `packages/cli/src/features/context/ChatContext.tsx`
**Changes:**
- Moved assistant message addition to `onComplete` callback (before snapshot)
- Changed snapshot/compression from `.then()` to `async/await`
- Added extensive debug logging to `compression-debug.log`
- Added message logging to `llm-messages-debug.json`

### 2. `packages/cli/src/features/context/ModelContext.tsx`
**Changes:**
- Added debug logging to `context-cap-debug.log` for 85% cap strategy

---

## Debug Files to Check

After rebuilding and testing, check these files:

1. **`compression-debug.log`** - Shows compression flow:
   - When assistant message is added
   - When context limit is reached
   - Pre/post compression context state

2. **`llm-messages-debug.json`** - Shows messages sent to LLM:
   - All messages with roles and content previews
   - Should show if checkpoints are included

3. **`context-cap-debug.log`** - Shows 85% cap calculation:
   - User selected context size
   - Actual size sent to Ollama
   - Whether profile has `ollama_context_size`

4. **`sendMessage-debug.log`** - Confirms code is running:
   - Logs every user message sent

---

## Next Steps

### Immediate (Must Fix):
1. **Find why checkpoints are not sent to LLM**
   - Check `getMessages()` in contextManager
   - Verify checkpoint messages are in `context.messages[]`
   - Trace message flow from context manager to LLM

2. **Fix 85% cap strategy**
   - Verify model profile has correct `context_profiles`
   - Check if Ollama respects `num_ctx` parameter
   - Add logging to see actual token counts

### Secondary (Nice to Have):
3. **Fix snapshot summary generation**
   - Generate meaningful conversation summary
   - Don't just echo user's message

4. **Add better error handling**
   - Catch and log compression failures
   - Provide user feedback when compression fails

---

## Testing Plan

1. **Rebuild project:** `npm run build`

2. **Test scenario:**
   - Set context to 4096 tokens
   - Send long message (fills context)
   - Type "continue" → Should work (1st time)
   - Type "continue" → Should work (2nd time) ← Currently fails

3. **Check debug logs:**
   - `compression-debug.log` - Verify compression runs
   - `llm-messages-debug.json` - Verify checkpoints sent to LLM
   - `context-cap-debug.log` - Verify 85% cap applied

4. **Verify snapshots:**
   - Check snapshot files have assistant messages
   - Check checkpoint summaries are meaningful

---

## Root Cause Summary

The core issue is **architectural**: 

- Context manager creates checkpoints ✓
- Checkpoints are stored in `context.messages[]` ✓
- But when `getContext()` is called, it returns incomplete messages ✗
- LLM never sees the checkpoint summaries ✗

This is why the first "continue" works (full history still in context) but the second "continue" fails (only checkpoint remains, but LLM doesn't see it).

**Fix:** Ensure `getMessages()` returns ALL messages including checkpoint summaries.
