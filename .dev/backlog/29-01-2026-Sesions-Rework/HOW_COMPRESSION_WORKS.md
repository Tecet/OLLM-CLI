# How Context Compression Works

**Date**: 2026-01-29  
**Status**: Documentation

---

## Overview

Context compression allows the LLM to maintain long conversations by summarizing old messages into compact checkpoints, freeing up space for new messages while preserving conversation continuity.

---

## The Flow (Step by Step)

### 1. User Sends Message

```
User: "Write about prime numbers 2-1000"
```

**What happens:**
- Message added to `recentMessages` array
- Token count updated: `currentTokens = 1500`
- Check if compression needed: `1500 > 3347?` → NO
- Send to LLM

---

### 2. LLM Responds

```
Assistant: "Let me write about prime numbers 2-10..."
[generates 1000 tokens of content]
```

**What happens:**
- Response added to `recentMessages` array
- Token count updated: `currentTokens = 2500`
- Check if compression needed: `2500 > 3347?` → NO
- Continue conversation

---

### 3. Conversation Continues

```
User: "continue"
Assistant: [generates 1000 tokens about 11-20]
currentTokens = 3500

User: "continue"  
Assistant: [generates 1000 tokens about 21-30]
currentTokens = 4500 ⚠️ OVER THRESHOLD!
```

**Compression triggers at 75% of available space (~3347 tokens)**

---

## Compression Process (6 Stages)

### Stage 1: Identification (0-15%)

**What it does:** Identifies which messages to compress

```typescript
// Keep last 5 messages (default)
// Compress everything older

recentMessages = [
  {role: 'user', content: 'Write about primes 2-1000'},     // OLD
  {role: 'assistant', content: '[2-10 content]'},           // OLD
  {role: 'user', content: 'continue'},                      // OLD
  {role: 'assistant', content: '[11-20 content]'},          // OLD
  {role: 'user', content: 'continue'},                      // OLD
  {role: 'assistant', content: '[21-30 content]'},          // OLD
  {role: 'user', content: 'continue'},                      // KEEP (recent)
  {role: 'assistant', content: '[31-40 content]'},          // KEEP (recent)
  {role: 'user', content: 'continue'},                      // KEEP (recent)
  {role: 'assistant', content: '[41-50 content]'},          // KEEP (recent)
  {role: 'user', content: 'continue'},                      // KEEP (recent)
];

// Messages to compress: first 6 messages
// Messages to keep: last 5 messages
```

**Output:** Array of 6 messages to compress

---

### Stage 2: Preparation (15-25%)

**What it does:** Prepares messages for LLM summarization

```typescript
// Calculate original token count
originalTokens = 3000 tokens

// Determine compression level based on size
if (originalTokens > 3000) level = 1; // COMPACT (50-100 tokens)
else if (originalTokens > 2000) level = 2; // MODERATE (150-300 tokens)
else level = 3; // DETAILED (300-500 tokens)

// In this case: level = 1 (COMPACT)
```

**Output:** Prepared data with compression level

---

### Stage 3: Summarization (25-70%)

**What it does:** Calls LLM to create semantic summary

**Prompt sent to LLM:**
```
You are summarizing a conversation history. Create an ULTRA-COMPACT summary (50-100 tokens).

Focus on:
- Key decisions made
- Critical information only
- Essential context for continuation

Omit:
- Conversational details
- Intermediate steps
- Explanations

CONVERSATION TO SUMMARIZE:
USER: Write about prime numbers 2-1000
ASSISTANT: [2-10 content - 1000 tokens]
USER: continue
ASSISTANT: [11-20 content - 1000 tokens]
USER: continue
ASSISTANT: [21-30 content - 1000 tokens]

Provide a concise summary that maintains essential information for continuing the conversation.
```

**LLM Response:**
```
User requested comprehensive documentation of prime numbers 2-1000 with 
historical significance, proofs, and poems. Completed: 2-30 covering 
fundamental properties and cultural importance. Next: Continue from 31 onwards.
```

**Token count:** 80 tokens (compressed from 3000!)

**Output:** Summary text (80 tokens)

---

### Stage 4: Checkpoint Creation (70-80%)

**What it does:** Creates checkpoint record

```typescript
checkpoint = {
  id: 'ckpt_abc123',
  timestamp: 1769700787368,
  summary: 'User requested comprehensive documentation...',
  originalMessageIds: ['msg1', 'msg2', 'msg3', 'msg4', 'msg5', 'msg6'],
  tokenCount: 80,
  compressionLevel: 1,
  compressionNumber: 1,
  metadata: {
    model: 'llama3.2:3b',
    createdAt: 1769700787368
  }
};

// Record in session history
sessionHistory.recordCheckpoint({
  id: 'ckpt_abc123',
  timestamp: 1769700787368,
  messageRange: [0, 6],
  originalTokens: 3000,
  compressedTokens: 80,
  compressionRatio: 0.027, // 80/3000 = 2.7%
  level: 1
});
```

**Output:** Checkpoint summary object

---

### Stage 5: Context Update (80-90%)

**What it does:** Replaces old messages with checkpoint

**Before:**
```typescript
activeContext = {
  systemPrompt: {content: '...', tokens: 500},
  checkpoints: [],
  recentMessages: [
    {role: 'user', content: 'Write about primes...'},     // 100 tokens
    {role: 'assistant', content: '[2-10]'},               // 1000 tokens
    {role: 'user', content: 'continue'},                  // 10 tokens
    {role: 'assistant', content: '[11-20]'},              // 1000 tokens
    {role: 'user', content: 'continue'},                  // 10 tokens
    {role: 'assistant', content: '[21-30]'},              // 1000 tokens
    {role: 'user', content: 'continue'},                  // 10 tokens (KEEP)
    {role: 'assistant', content: '[31-40]'},              // 1000 tokens (KEEP)
    {role: 'user', content: 'continue'},                  // 10 tokens (KEEP)
    {role: 'assistant', content: '[41-50]'},              // 1000 tokens (KEEP)
    {role: 'user', content: 'continue'},                  // 10 tokens (KEEP)
  ],
  tokenCount: {
    system: 500,
    checkpoints: 0,
    recent: 4150,
    total: 4650
  }
};
```

**After:**
```typescript
activeContext = {
  systemPrompt: {content: '...', tokens: 500},
  checkpoints: [
    {id: 'ckpt_abc123', summary: 'User requested...', tokens: 80}
  ],
  recentMessages: [
    {role: 'user', content: 'continue'},                  // 10 tokens
    {role: 'assistant', content: '[31-40]'},              // 1000 tokens
    {role: 'user', content: 'continue'},                  // 10 tokens
    {role: 'assistant', content: '[41-50]'},              // 1000 tokens
    {role: 'user', content: 'continue'},                  // 10 tokens
  ],
  tokenCount: {
    system: 500,
    checkpoints: 80,
    recent: 2030,
    total: 2610
  }
};
```

**Tokens freed:** 4650 - 2610 = **2040 tokens!**

**Output:** Updated active context

---

### Stage 6: Validation (90-100%)

**What it does:** Validates result fits within limits

```typescript
// Build prompt that will be sent to LLM
prompt = [
  systemPrompt,           // 500 tokens
  checkpoint,             // 80 tokens
  ...recentMessages,      // 2030 tokens
];

totalTokens = 2610;
ollamaLimit = 6963;

// Check if valid
if (totalTokens <= ollamaLimit) {
  return {success: true, freedTokens: 2040};
} else {
  return {success: false, reason: 'Still exceeds limit'};
}
```

**Output:** Validation result

---

## What Gets Sent to LLM

### Before Compression

```
[System Prompt - 500 tokens]
You are an AI assistant...

[Recent Messages - 4150 tokens]
USER: Write about prime numbers 2-1000
ASSISTANT: [2-10 content - 1000 tokens]
USER: continue
ASSISTANT: [11-20 content - 1000 tokens]
USER: continue
ASSISTANT: [21-30 content - 1000 tokens]
USER: continue
ASSISTANT: [31-40 content - 1000 tokens]
USER: continue
ASSISTANT: [41-50 content - 1000 tokens]
USER: continue

[New Message]
ASSISTANT: [generating response...]

TOTAL: 4650 tokens ⚠️ OVER THRESHOLD
```

### After Compression

```
[System Prompt - 500 tokens]
You are an AI assistant...

[Checkpoint - 80 tokens]
ASSISTANT: User requested comprehensive documentation of prime numbers 2-1000 
with historical significance, proofs, and poems. Completed: 2-30 covering 
fundamental properties and cultural importance. Next: Continue from 31 onwards.

[Recent Messages - 2030 tokens]
USER: continue
ASSISTANT: [31-40 content - 1000 tokens]
USER: continue
ASSISTANT: [41-50 content - 1000 tokens]
USER: continue

[New Message]
ASSISTANT: [generating response...]

TOTAL: 2610 tokens ✅ UNDER THRESHOLD
```

**The LLM sees:**
1. System prompt (who it is)
2. Checkpoint summary (what happened before)
3. Recent messages (current context)
4. Can continue from where it left off!

---

## Checkpoint Aging (Progressive Compression)

As conversation continues, old checkpoints get re-compressed:

### First Compression
```
Checkpoint 1: Level 3 (DETAILED) - 300 tokens
"User requested prime numbers 2-1000. Completed 2-30 with detailed 
historical context, mathematical proofs, and poetic tributes..."
```

### After 5 More Compressions
```
Checkpoint 1: Level 2 (MODERATE) - 150 tokens
"User requested prime numbers 2-1000. Completed 2-30 with proofs and poems."
```

### After 10 More Compressions
```
Checkpoint 1: Level 1 (COMPACT) - 80 tokens
"Prime numbers 2-1000 documentation. Completed: 2-30."
```

### After 20 More Compressions
```
Checkpoint 1: MERGED with Checkpoint 2 - 100 tokens
"Prime numbers 2-100 documentation completed."
```

---

## When Compression Triggers

### Calculation

```typescript
// For 8K context (ollama limit ~6963):
ollamaLimit = 6963;
systemPromptTokens = 500;
promptBudget = 1000;        // TIER_3_STANDARD
safetyMargin = 1000;        // Reserve for response

availableForMessages = 6963 - 500 - 1000 - 1000 = 4463;
compressionThreshold = 4463 * 0.75 = 3347;

// Trigger compression when currentTokens > 3347
```

### Example Timeline

```
Turn 1:  500 (system) + 1000 (messages) = 1500 total ✅
Turn 2:  500 (system) + 2000 (messages) = 2500 total ✅
Turn 3:  500 (system) + 3000 (messages) = 3500 total ⚠️ TRIGGER!

🔄 COMPRESSION HAPPENS

Turn 4:  500 (system) + 80 (checkpoint) + 1000 (recent) = 1580 total ✅
Turn 5:  500 (system) + 80 (checkpoint) + 2000 (recent) = 2580 total ✅
Turn 6:  500 (system) + 80 (checkpoint) + 3000 (recent) = 3580 total ⚠️ TRIGGER!

🔄 COMPRESSION HAPPENS AGAIN

Turn 7:  500 (system) + 160 (2 checkpoints) + 1000 (recent) = 1660 total ✅
...continues indefinitely
```

---

## Where Messages Are Stored

### Storage Location: In-Memory (ActiveContext)

Messages are stored in **`activeContext.recentMessages`** array in memory:

```typescript
// Location: packages/core/src/context/storage/activeContextManager.ts

class ActiveContextManager {
  private context: ActiveContext = {
    systemPrompt: Message,
    checkpoints: CheckpointSummary[],
    recentMessages: Message[],  // ← MESSAGES STORED HERE
    tokenCount: {...}
  };
}
```

### How Messages Get There

**When user sends message:**
```typescript
// packages/core/src/context/orchestration/contextOrchestrator.ts
async addMessage(message: Message) {
  // 1. Add to session history (disk)
  this.sessionHistory.appendMessage(message);
  
  // 2. Add to active context (memory)
  this.activeContext.addMessage(message);  // ← Goes to recentMessages[]
}
```

**When LLM responds:**
```typescript
// packages/cli/src/features/context/handlers/agentLoopHandler.ts
await contextActions.addMessage({
  role: 'assistant',
  content: assistantContent,
});
// ← Also goes to recentMessages[]
```

### How Messages Are Retrieved for Summarization

**Step 1: Get messages from active context**
```typescript
// packages/core/src/context/compression/compressionPipeline.ts
private async identifyMessagesToCompress(): Promise<Message[]> {
  // Get state from active context manager
  const state = this.activeContext.getState();
  
  // Get recent messages array
  const recentMessages = state.recentMessages;  // ← READ FROM HERE
  
  // Keep last 5, compress the rest
  const oldMessages = recentMessages.slice(0, -5);
  
  return oldMessages;  // ← THESE GO TO LLM FOR SUMMARIZATION
}
```

**Step 2: Send to LLM**
```typescript
// packages/core/src/context/compression/summarizationService.ts
async summarize(messages: Message[]) {
  // Build prompt with messages
  const conversationText = messages
    .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
    .join('\n\n');
  
  const prompt = `Summarize this conversation:\n${conversationText}`;
  
  // Call LLM
  const summary = await this.callLLM(prompt);  // ← MESSAGES SENT HERE
  
  return summary;
}
```

### Data Flow Diagram

```
User Input
    ↓
[SessionHistory] ← Full history saved to disk
    ↓
[ActiveContext.recentMessages[]] ← Messages stored in memory
    ↓
Compression Triggered (at 75% threshold)
    ↓
[CompressionPipeline.identifyMessagesToCompress()]
    ↓
Gets messages from: activeContext.getState().recentMessages
    ↓
[SummarizationService.summarize(messages)]
    ↓
Sends to LLM: "Summarize this conversation: USER: ... ASSISTANT: ..."
    ↓
LLM returns summary
    ↓
[CheckpointSummary] created with summary text
    ↓
[ActiveContext.checkpoints[]] ← Checkpoint added
[ActiveContext.recentMessages[]] ← Old messages removed
```

### Storage Layers

**1. Active Context (In-Memory)**
- Location: `activeContext.recentMessages[]`
- Purpose: What gets sent to LLM
- Lifetime: Current session
- Size: Limited by Ollama context limit

**2. Session History (On Disk)**
- Location: `~/.ollm/sessions/{sessionId}.json`
- Purpose: Full conversation history
- Lifetime: Permanent
- Size: Unlimited

**3. Snapshots (On Disk)**
- Location: `~/.ollm/context-storage/{sessionId}/snapshots/`
- Purpose: Recovery and rollback
- Lifetime: Configurable (pruned after 2 hours)
- Size: Limited by pruning policy

### Example: Where Messages Are

**After 10 turns of conversation:**

```typescript
// In Memory (Active Context)
activeContext.recentMessages = [
  {role: 'user', content: 'Write about primes 2-1000'},     // Turn 1
  {role: 'assistant', content: '[2-10 content]'},           // Turn 2
  {role: 'user', content: 'continue'},                      // Turn 3
  {role: 'assistant', content: '[11-20 content]'},          // Turn 4
  {role: 'user', content: 'continue'},                      // Turn 5
  {role: 'assistant', content: '[21-30 content]'},          // Turn 6
  {role: 'user', content: 'continue'},                      // Turn 7
  {role: 'assistant', content: '[31-40 content]'},          // Turn 8
  {role: 'user', content: 'continue'},                      // Turn 9
  {role: 'assistant', content: '[41-50 content]'},          // Turn 10
];

// On Disk (Session History)
~/.ollm/sessions/abc123.json = {
  messages: [
    // ALL 10 turns saved here in full
  ]
}
```

**When compression triggers:**

```typescript
// 1. Get messages from memory
const messagesToCompress = activeContext.recentMessages.slice(0, -5);
// = first 5 messages (turns 1-6)

// 2. Send to LLM
summarizationService.summarize(messagesToCompress);
// LLM receives: "USER: Write about primes... ASSISTANT: [2-10]... USER: continue..."

// 3. LLM returns summary
const summary = "User requested primes 2-1000. Completed 2-30...";

// 4. Update memory
activeContext.checkpoints.push({summary: "User requested..."});
activeContext.recentMessages = activeContext.recentMessages.slice(-5);
// Now only last 5 messages remain in memory

// 5. Disk unchanged
// Session history still has ALL 10 turns
```

---

## Key Points

### ✅ What Works

1. **LLM does the summarization** - Not our code, the LLM creates semantic summaries
2. **Preserves context** - Checkpoints maintain conversation continuity
3. **Frees space** - Compression ratio ~2-5% (3000 tokens → 80 tokens)
4. **Automatic** - Triggers at 75% threshold, no user intervention
5. **Progressive** - Old checkpoints age and compress further
6. **Goal-aware** - Can preserve goal-relevant information

### ❌ What Doesn't Work (Before Fixes)

1. **Token counting bug** - Double-subtracted system prompt, compression never triggered
2. **Missing user messages** - Only compressed assistant messages, lost user context
3. **Duplicate messages** - Added assistant message twice to context
4. **No real-time updates** - Token count only updated after message completed

### ✅ What's Fixed Now

1. **Compression triggers correctly** - At 3347 tokens (75% threshold)
2. **User messages included** - Full conversation context in summaries
3. **No duplicates** - Assistant message added once
4. **Real-time estimates** - Token count updates during streaming (estimates)

---

## Files Involved

### Core Compression
- `packages/core/src/context/compression/compressionPipeline.ts` - 6-stage pipeline
- `packages/core/src/context/compression/summarizationService.ts` - LLM summarization
- `packages/core/src/context/compression/validationService.ts` - Size validation

### Storage
- `packages/core/src/context/storage/activeContextManager.ts` - What goes to LLM
- `packages/core/src/context/storage/sessionHistoryManager.ts` - Full history tracking
- `packages/core/src/context/storage/snapshotLifecycle.ts` - Recovery snapshots

### Orchestration
- `packages/core/src/context/orchestration/contextOrchestrator.ts` - Coordinates everything
- `packages/core/src/context/integration/tierAwareCompression.ts` - Compression triggers

### Checkpoints
- `packages/core/src/context/checkpoints/checkpointLifecycle.ts` - Aging and merging

---

## Testing

### Manual Test

1. Start conversation: "Write about prime numbers 2-1000"
2. Keep saying "continue" until compression triggers
3. Watch token count in UI: should trigger at ~3347 tokens
4. After compression: token count should drop significantly
5. LLM should continue from where it left off (not start over)
6. Check session file: `compressionCount` should be > 0

### Expected Session File

```json
{
  "metadata": {
    "tokenCount": 2610,
    "compressionCount": 1
  },
  "checkpoints": [
    {
      "id": "ckpt_abc123",
      "timestamp": 1769700787368,
      "messageRange": [0, 6],
      "originalTokens": 3000,
      "compressedTokens": 80,
      "compressionRatio": 0.027,
      "level": 1
    }
  ]
}
```

---

## Summary

**Compression = LLM summarizes old messages into compact checkpoints**

- Triggers at 75% of available space
- LLM creates semantic summaries (not truncation)
- Frees 95-98% of tokens
- Maintains conversation continuity
- Allows infinite conversations
- Progressive aging for old checkpoints

**The key insight:** The LLM sees checkpoints as assistant messages, so it knows what happened before and can continue naturally.
