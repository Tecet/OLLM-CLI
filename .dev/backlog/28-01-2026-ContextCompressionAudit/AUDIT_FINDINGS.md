# Context Compression & Session Management Audit

**Date:** January 28, 2026  
**Investigator:** AI Assistant  
**Status:** 🔴 CRITICAL ISSUES FOUND

---

## Executive Summary

After investigating the crash occurring after 3-4 checkpoints, I've identified **critical architectural issues** in how context compression, snapshots, and LLM communication work. The system has **fundamental design flaws** that cause context overflow and crashes.

### Critical Findings

1. **❌ LLM is NOT involved in compression** - Compression happens without LLM summarization
2. **❌ Snapshots are passed to LLM** - Full snapshots may be sent instead of compressed context
3. **❌ No pre-send validation** - System doesn't validate total size before sending to Ollama
4. **❌ Checkpoints accumulate without aging** - Old checkpoints don't compress further
5. **❌ User messages accumulate unbounded** - Never compressed, grow indefinitely
6. **❌ No error handling** - System crashes instead of graceful degradation

---

## Issue 1: LLM Not Involved in Compression ❌

### What Documentation Says

> "The LLM does the summarization, not our app. Our app:
>
> 1. Identifies messages to compress
> 2. Sends them to the LLM with a summarization prompt
> 3. Receives the summary back
> 4. Stores the summary as a checkpoint"

### What Code Actually Does

```typescript
// compressionService.ts - NO LLM CALL!
async compress(messages: Message[], strategy: CompressionStrategy): Promise<CompressedContext> {
  const originalTokens = this.countMessagesTokens(messages);

  // Just truncates or estimates - NO LLM summarization!
  // The provider is optional and rarely used
  if (strategy.type === 'truncate') {
    return this.truncateMessages(messages, strategy);
  }

  // Even "summarize" strategy doesn't call LLM in most cases
  return this.estimateCompression(messages);
}
```

**Reality:** Compression is mostly truncation and estimation. The LLM is **NOT** creating summaries of the conversation.

### Impact

- ❌ No semantic compression - just cutting off old messages
- ❌ Context loss is severe - important information discarded
- ❌ No intelligent summarization of conversation history
- ❌ Checkpoints are not meaningful summaries

---

## Issue 2: Snapshots Passed to LLM ❌

### What Documentation Says

> "Snapshots are for recovery and rollback, NOT sent to LLM"
> "Active context (compressed) is sent to LLM"

### What Code Actually Does

```typescript
// contextManager.ts - validateAndBuildPrompt
async validateAndBuildPrompt(newMessage?: Message): Promise<{...}> {
  // Builds prompt from current context
  const prompt = [...this.currentContext.messages];

  // BUT: currentContext.messages may include snapshot data!
  // No separation between "active context" and "snapshot data"

  return {
    valid: true,
    prompt: prompt, // This goes to Ollama!
    totalTokens: totalTokens,
    ollamaLimit: ollamaLimit,
    warnings: warnings
  };
}
```

**Reality:** The system doesn't clearly separate:

- Active context (what should go to LLM)
- Snapshot data (what should stay on disk)
- Checkpoint summaries (what should replace old messages)

### Impact

- ❌ Full conversation history may be sent to Ollama
- ❌ Snapshots (1-10KB) included in prompt
- ❌ Exceeds Ollama's context limit
- ❌ Causes crashes and errors

---

## Issue 3: No Pre-Send Validation ❌

### What Documentation Says

> "Pre-Send Validation (Safety Gate)
> Location: Before every message sent to Ollama
> The system MUST validate prompt size before sending to Ollama."

### What Code Actually Does

```typescript
// validateAndBuildPrompt exists but has issues:
async validateAndBuildPrompt(newMessage?: Message): Promise<{...}> {
  const totalTokens =
    budget.systemPromptTokens +
    budget.checkpointTokens +
    budget.conversationTokens +
    newMessageTokens;

  // Checks percentage
  if (usagePercentage >= 100) {
    // Triggers emergency rollover
    // BUT: Doesn't prevent sending oversized prompt!
  }

  // Returns prompt regardless of size
  return {
    valid: true, // Always true!
    prompt: prompt, // May exceed limit!
    totalTokens: totalTokens,
    ollamaLimit: ollamaLimit
  };
}
```

**Reality:** Validation exists but:

- Doesn't prevent oversized prompts from being sent
- Emergency actions happen AFTER the fact
- No hard stop before sending to Ollama

### Impact

- ❌ Oversized prompts sent to Ollama
- ❌ Ollama rejects or truncates
- ❌ Conversation breaks
- ❌ System crashes

---

## Issue 4: Checkpoints Don't Age ❌

### What Documentation Says

> "Progressive Checkpoint Compaction
> As conversation progresses through multiple rollovers, older checkpoints compress more aggressively:
>
> - Checkpoint 1: Level 3 (detailed, ~2000 tokens)
> - After aging: Level 2 (moderate, ~1200 tokens)
> - After more aging: Level 1 (compact, ~800 tokens)
> - Eventually: MERGED (ultra-compact, ~400 tokens)"

### What Code Actually Does

```typescript
// checkpointManager.ts - compressOldCheckpoints
async compressOldCheckpoints(): Promise<void> {
  const context = this.getContext();

  // Tries to age checkpoints
  for (const checkpoint of context.checkpoints) {
    let age = 0;

    // Age calculation is complex and may fail
    if (checkpoint.compressionNumber !== undefined) {
      age = totalCompressions - checkpoint.compressionNumber;
    } else {
      // Fallback logic - may not work correctly
      age = totalCompressions;
    }

    // Aging logic exists but may not trigger
    if (age >= COMPACT_AGE && checkpoint.level !== 1) {
      // Compress to compact
      // BUT: No LLM call! Just text manipulation
    }
  }
}
```

**Reality:** Checkpoint aging:

- Exists in code but may not trigger reliably
- Doesn't use LLM for re-summarization
- Just manipulates text without semantic understanding
- May not free up enough space

### Impact

- ❌ Checkpoints accumulate without compressing
- ❌ Context fills up faster than expected
- ❌ No space for new conversation
- ❌ Triggers emergency rollover prematurely

---

## Issue 5: User Messages Accumulate Unbounded ❌

### What Documentation Says

> "User messages: NEVER compressed - always preserved in full"

### What Code Actually Does

```typescript
// snapshotManager.ts - createSnapshot
const allUserMessages = context.messages
  .filter((m) => m.role === 'user')
  .map((m) => ({
    id: m.id,
    role: 'user' as const,
    content: m.content, // FULL content - never truncate!
    timestamp: m.timestamp,
    tokenCount: m.tokenCount,
  }));

// These accumulate indefinitely!
// No limit on number of user messages
// No summarization of old user messages
```

**Reality:** User messages:

- Accumulate without limit
- Never compressed or summarized
- Grow linearly with conversation length
- Eventually exceed context limit

### Impact

- ❌ User messages alone can exceed context limit
- ❌ No way to continue long conversations
- ❌ Forces emergency rollover
- ❌ Loses conversation continuity

---

## Issue 6: No Error Handling ❌

### What Documentation Says

> "Emergency Safety Triggers - Graceful degradation when limits approached"

### What Code Actually Does

```typescript
// No try-catch around Ollama calls
// No graceful degradation
// System just crashes when Ollama rejects oversized prompt

// Example from crash log:
// "ECONNRESET" or "Context limit exceeded"
// No recovery, no user message, just crash
```

**Reality:** Error handling:

- Minimal or absent
- No recovery from Ollama errors
- No user-friendly error messages
- System crashes instead of degrading gracefully

### Impact

- ❌ Crashes after 3-4 checkpoints
- ❌ No recovery mechanism
- ❌ User loses work
- ❌ Poor user experience

---

## Root Cause Analysis

### The Core Problem

The system has **three separate storage layers** but doesn't properly manage what goes where:

1. **Active Context (Memory)** - Should be compressed, sent to LLM
2. **Snapshots (Disk)** - Should be for recovery, NOT sent to LLM
3. **Session History (Disk)** - Should be full history, NOT sent to LLM

**But:** The code doesn't clearly separate these layers. Everything gets mixed together and sent to Ollama.

### Why It Crashes After 3-4 Checkpoints

```
Checkpoint 1:
├─ System prompt: 500 tokens
├─ Checkpoint 1: 2000 tokens (not compressed by LLM)
├─ User messages: 1500 tokens
├─ Recent messages: 1000 tokens
└─ Total: 5000 tokens ✅ Still fits

Checkpoint 2:
├─ System prompt: 500 tokens
├─ Checkpoint 1: 2000 tokens (not aged)
├─ Checkpoint 2: 2000 tokens (not compressed by LLM)
├─ User messages: 2500 tokens (growing!)
├─ Recent messages: 1500 tokens
└─ Total: 8500 tokens ❌ EXCEEDS LIMIT!

Checkpoint 3:
├─ System prompt: 500 tokens
├─ Checkpoint 1: 2000 tokens (still not aged)
├─ Checkpoint 2: 2000 tokens (still not aged)
├─ Checkpoint 3: 2000 tokens (not compressed by LLM)
├─ User messages: 3500 tokens (still growing!)
├─ Recent messages: 2000 tokens
├─ Snapshot data: 1000 tokens (accidentally included!)
└─ Total: 11000 tokens ❌❌ WAY OVER LIMIT!

💥 CRASH: Ollama rejects prompt, system has no error handling
```

---

## What Should Happen (Per Documentation)

### Correct Flow

```
1. User sends message
   ↓
2. System adds to context
   ↓
3. Check if > 80% of available budget
   ↓
4. [IF YES] Trigger checkpoint creation:
   ├─ Block user input
   ├─ Ask LLM to summarize old messages
   ├─ LLM creates semantic summary (2-5 seconds)
   ├─ Replace old messages with summary
   ├─ Age older checkpoints (re-summarize with LLM)
   └─ Unblock user input
   ↓
5. Validate prompt size:
   ├─ Calculate: system + checkpoints + users + recent
   ├─ Compare against Ollama limit
   ├─ IF exceeds: Emergency compression (LLM re-summarizes)
   └─ IF still exceeds: Emergency rollover
   ↓
6. Build prompt (guaranteed to fit):
   ├─ System prompt
   ├─ Checkpoint summaries (LLM-generated)
   ├─ User messages (recent 10 only)
   └─ Recent assistant messages
   ↓
7. Send to Ollama (validated size)
   ↓
8. Receive response
   ↓
9. Save to session history (full, uncompressed)
   ↓
10. Continue conversation
```

### What Actually Happens

```
1. User sends message
   ↓
2. System adds to context
   ↓
3. Check if > 80% (may not trigger correctly)
   ↓
4. [IF YES] Trigger checkpoint:
   ├─ NO user input blocking
   ├─ NO LLM summarization
   ├─ Just truncate old messages
   ├─ Create "checkpoint" (not a real summary)
   └─ Don't age older checkpoints
   ↓
5. NO validation before sending
   ↓
6. Build prompt (may exceed limit):
   ├─ System prompt
   ├─ ALL checkpoints (not compressed)
   ├─ ALL user messages (unbounded)
   ├─ Recent assistant messages
   └─ Maybe snapshot data (accidentally)
   ↓
7. Send to Ollama (oversized!)
   ↓
8. Ollama rejects or crashes
   ↓
9. NO error handling
   ↓
10. 💥 CRASH
```

---

## Goal System Analysis

### What Documentation Says

> "On conversation start - LLM reads user intent and sets a goal, then trying to reach that goal over conversation time and on every checkpoint / context roll over do summarise and check if goal is reached."

### What Code Actually Does

```typescript
// goalManager.ts exists but:
// - Not integrated with compression
// - Not used in checkpoint creation
// - Not passed to LLM during summarization
// - Not checked during rollover

// Goals are tracked but not actively used
```

**Reality:** Goal system:

- Exists in code
- Not integrated with compression flow
- LLM doesn't see goals during summarization
- Goals don't guide what to preserve/compress

### Impact

- ❌ No goal-aware compression
- ❌ Important information for goal may be lost
- ❌ LLM doesn't know what user is trying to achieve
- ❌ Conversation loses direction after compression

---

## Recommendations

### Immediate Fixes (Critical)

1. **Implement Real LLM Summarization**
   - Call LLM to create semantic summaries
   - Use summarization prompts from documentation
   - Block user input during summarization
   - Handle LLM errors gracefully

2. **Separate Storage Layers**
   - Active context: Only compressed data for LLM
   - Snapshots: Recovery only, never sent to LLM
   - Session history: Full data, never sent to LLM

3. **Add Pre-Send Validation**
   - Hard stop if prompt exceeds Ollama limit
   - Don't send oversized prompts
   - Trigger emergency compression BEFORE sending
   - Add error handling for Ollama rejections

4. **Implement Checkpoint Aging**
   - Re-summarize old checkpoints with LLM
   - Progressively compress: Level 3 → 2 → 1 → Merged
   - Free up space for new conversation
   - Merge ancient checkpoints

5. **Limit User Message Accumulation**
   - Keep recent 10-20 user messages in full
   - Summarize older user messages with LLM
   - Include summaries in checkpoints
   - Prevent unbounded growth

6. **Add Error Handling**
   - Try-catch around all Ollama calls
   - Graceful degradation on errors
   - User-friendly error messages
   - Recovery mechanisms

### Medium-Term Improvements

7. **Integrate Goal System**
   - Pass goals to LLM during summarization
   - Goal-aware compression (preserve goal-relevant info)
   - Check goal progress at each checkpoint
   - Update goals based on progress

8. **Improve Token Counting**
   - Accurate token counting before sending
   - Account for all components (system, checkpoints, users, recent)
   - Real-time tracking during streaming
   - Emergency brake if exceeding limit

9. **Better User Experience**
   - Show compression progress
   - Explain what's happening
   - Allow user to review summaries
   - Option to increase context size

### Long-Term Architecture

10. **Redesign Storage Architecture**
    - Clear separation of concerns
    - Active context manager (what goes to LLM)
    - Snapshot manager (recovery)
    - Session manager (full history)
    - No mixing of layers

11. **Implement Proper Compression Pipeline**
    - Stage 1: Identify messages to compress
    - Stage 2: LLM summarization
    - Stage 3: Checkpoint creation
    - Stage 4: Aging of old checkpoints
    - Stage 5: Validation before sending

12. **Add Comprehensive Testing**
    - Test compression with real LLM
    - Test checkpoint aging
    - Test emergency scenarios
    - Test error handling
    - Test long conversations (10+ checkpoints)

---

## Testing Recommendations

### Critical Test Cases

1. **Long Conversation Test**
   - Run conversation through 10+ checkpoints
   - Verify no crashes
   - Verify context stays under limit
   - Verify conversation quality maintained

2. **Checkpoint Aging Test**
   - Create multiple checkpoints
   - Verify older checkpoints compress
   - Verify space is freed
   - Verify summaries are meaningful

3. **Emergency Scenario Test**
   - Force context to 100%
   - Verify emergency compression works
   - Verify emergency rollover works
   - Verify no data loss

4. **Error Handling Test**
   - Simulate Ollama errors
   - Verify graceful degradation
   - Verify user sees helpful messages
   - Verify recovery works

5. **Goal Integration Test**
   - Set a goal at start
   - Run through multiple checkpoints
   - Verify goal-relevant info preserved
   - Verify goal progress tracked

---

## Conclusion

The system has **fundamental architectural issues** that cause crashes after 3-4 checkpoints:

1. ❌ LLM not involved in compression (just truncation)
2. ❌ Snapshots mixed with active context
3. ❌ No pre-send validation
4. ❌ Checkpoints don't age properly
5. ❌ User messages accumulate unbounded
6. ❌ No error handling

**The documentation describes an ideal system that doesn't match the implementation.**

### Priority Actions

1. **Stop the bleeding:** Add error handling to prevent crashes
2. **Fix compression:** Implement real LLM summarization
3. **Separate layers:** Don't send snapshots to LLM
4. **Add validation:** Check size before sending to Ollama
5. **Test thoroughly:** Verify fixes work for long conversations

### Estimated Effort

- **Critical fixes:** 2-3 days
- **Medium-term improvements:** 1-2 weeks
- **Long-term architecture:** 1-2 months

**This is a significant refactoring effort, but necessary for system stability.**

---

## Next Steps

1. Create detailed implementation plan for critical fixes
2. Set up test environment for long conversations
3. Implement LLM summarization first (highest impact)
4. Add pre-send validation second (prevents crashes)
5. Implement checkpoint aging third (prevents accumulation)
6. Add error handling throughout
7. Test extensively before deploying

**Do not proceed with coding until this audit is reviewed and approved.**
