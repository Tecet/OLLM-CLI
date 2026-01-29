# Debug: LLM Forgetting After Compression

**Date**: 2026-01-29
**Issue**: LLM forgets context after first compression and starts over

## Problem Analysis

### What User Sees
After context fills up and compression happens, the LLM starts over from the beginning:
- User asked to continue writing about prime numbers
- LLM had reached prime number 50
- After compression, LLM started over from "Section 1: Prime Numbers 2-6"
- Lost all progress and context

### Current Code Flow

1. **identifyMessagesToCompress()** (Line 327-330):
   ```typescript
   // Only compress assistant messages (keep user messages for continuity)
   const toCompress = oldMessages.filter(m => m.role === 'assistant');
   ```
   - Returns ONLY assistant messages
   - User messages stay in `recentMessages`

2. **Summarization** (Line 207):
   ```typescript
   const summarizationResult = await this.summarizationService.summarize(
     prepared.messages,  // Only assistant messages!
     prepared.level,
     goal
   );
   ```
   - LLM receives ONLY assistant responses
   - No user questions/context

3. **updateActiveContext()** (Line 490-500):
   ```typescript
   // Remove compressed messages
   this.activeContext.removeMessages(checkpoint.originalMessageIds);
   
   // Add checkpoint summary
   this.activeContext.addCheckpoint(checkpoint);
   ```
   - Removes ONLY assistant messages (because that's what was compressed)
   - User messages remain in `recentMessages`

### The Real Problem

**User messages ARE preserved** - they stay in `recentMessages`.

**But the checkpoint summary is INCOMPLETE** - it only summarizes assistant responses without the user questions that prompted them.

When the LLM sees:
```
System: You are an AI assistant...
Checkpoint: [Summary of assistant responses without user questions]
User: continue
```

The LLM doesn't know what to continue because the checkpoint doesn't include:
- What the user originally asked for
- The context of the conversation
- What task was being performed

### Example of What's Happening

**Before Compression:**
```
User: Write about prime numbers 2-1000
Assistant: [writes about 2-10]
User: continue
Assistant: [writes about 11-20]
User: continue
Assistant: [writes about 21-30]
User: continue
Assistant: [writes about 31-40]
User: continue
Assistant: [writes about 41-50]
```

**After Compression (WRONG):**
```
Checkpoint: "Wrote about prime numbers 2-50, covering their properties..."
User: continue  [from recentMessages]
```

**What LLM sees:**
- No context about the original task
- Just a summary of what IT said
- A "continue" command with no context

**What SHOULD happen:**
```
Checkpoint: "User requested documentation of prime numbers 2-1000. 
            Completed: 2-50 with properties and significance.
            Next: Continue from 51 onwards."
User: continue
```

## Solution Options

### Option 1: Include User Messages in Summarization (CORRECT)
When compressing, include BOTH user and assistant messages:

```typescript
// Get conversation pairs (user question + assistant response)
const oldMessages = recentMessages.slice(0, -this.keepRecentCount);

// Don't filter - send ALL messages to LLM for summarization
return oldMessages;
```

**Pros:**
- LLM sees full conversation context
- Summary includes user intent and assistant responses
- Maintains conversation continuity

**Cons:**
- None - this is the correct approach

### Option 2: Keep More Recent Messages
Increase `keepRecentCount` from 5 to 10-20:

**Pros:**
- More context preserved

**Cons:**
- Doesn't solve the root problem
- Just delays the issue
- Context still fills up

### Option 3: Smarter Message Selection
Select conversation pairs (user + assistant) together:

```typescript
// Group messages into conversation pairs
const pairs = this.groupIntoPairs(oldMessages);

// Compress complete pairs
return pairs.flatMap(pair => pair.messages);
```

**Pros:**
- Preserves conversation structure

**Cons:**
- More complex
- Still need to include user messages

## Recommended Fix

**Change `identifyMessagesToCompress()` to include ALL messages:**

```typescript
private async identifyMessagesToCompress(): Promise<Message[]> {
  const state = this.activeContext.getState();
  const recentMessages = state.recentMessages;

  // Keep last N messages
  if (recentMessages.length <= this.keepRecentCount) {
    return [];
  }

  // Compress older messages (exclude last N)
  // INCLUDE BOTH user and assistant messages for complete context
  const oldMessages = recentMessages.slice(0, -this.keepRecentCount);

  // Need at least 2 messages to make compression worthwhile
  if (oldMessages.length < 2) {
    return [];
  }

  return oldMessages;  // Return ALL messages, not filtered
}
```

## Why This is Correct

1. **Audit says "User messages accumulate unbounded"** - This is the problem we're fixing
2. **Verification says "keeps only recent N"** - We DO keep recent N, but compress the OLD ones
3. **User messages SHOULD be in summaries** - Otherwise LLM loses context
4. **The audit was about unbounded growth** - Not about never compressing user messages

## Testing Plan

1. Start long conversation (10+ turns)
2. Let compression trigger
3. Verify checkpoint includes BOTH user questions and assistant responses
4. Verify LLM can continue conversation correctly
5. Verify no "starting over" behavior

## Next Steps

1. Make the fix to `identifyMessagesToCompress()`
2. Test with real conversation
3. Verify LLM maintains context
4. Update documentation if needed
