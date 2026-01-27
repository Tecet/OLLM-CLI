# Context Compression and Checkpoint System

**Last Updated:** January 27, 2026  
**Status:** Source of Truth (with known issues - see below)

**Related Documents:**
- `dev_ContextManagement.md` - Context sizing, tiers, VRAM
- `dev_PromptSystem.md` - Prompt structure, tiers, modes
- `dev_ModelDB.md` - Model database schema and access patterns
- `dev_ModelManagement.md` - Model size detection for reliability

---

## ⚠️ Known Issues (To Be Fixed in Task 4)

The following issues have been identified:

1. ✅ **FIXED: contextDefaults.ts** - Confusing compression threshold
   - Was: `threshold: 0.68` with misleading comment
   - Fixed: `threshold: 0.80` with clear comment (commit b709085)

2. ✅ **FIXED: contextPool.ts** - Percentage calculated against wrong base
   - Was: `percentage = currentTokens / userContextSize * 100`
   - Fixed: `percentage = currentTokens / currentSize * 100` (commit b709085)

3. ✅ **FIXED: Mid-stream compression** - Could truncate messages
   - Was: Compression triggered during streaming
   - Fixed: Compression only after `addMessage()` completes (commit 383c008)
   - Result: No message truncation, simple & robust architecture

4. ✅ **FIXED: Dynamic budget tracking** - Compression didn't account for checkpoint space
   - Was: Triggered at 80% of total context
   - Fixed: Triggers at 80% of available budget (total - system - checkpoints) (commit 2f4afbc)
   - Result: No rapid re-compression after first compression

5. ✅ **VERIFIED: Checkpoint aging** - Checkpoints age and compress over time
   - Implementation: `checkpointManager.compressOldCheckpoints()`
   - Level 3 (detailed) → Level 2 (moderate) → Level 1 (compact)
   - Age thresholds: MODERATE_AGE = 3, COMPACT_AGE = 6
   - Status: Working correctly, called after each compression

**Status:** All issues resolved! Task 4 complete.

---

## Overview

The Compression System manages conversation history when context approaches its limit. It creates checkpoints (compressed summaries) and ages them over time to sustain long conversations within fixed context limits.

**Core Principle:** Dynamic budget management with checkpoint aging enables long conversations within fixed context limits.

---

## Why Compression Matters

Ollama enforces a fixed context limit (e.g., 6800 tokens for 8K selection). As conversation grows, we must compress history into checkpoints while maintaining available space for new messages.

**Without dynamic budget tracking:**
- Compression triggers too frequently
- Context fills up prematurely
- Conversation ends after 1-2 compressions

**With dynamic budget tracking:**
- Compression triggers based on available space
- Checkpoints age and compress further
- Conversation sustains 3-5+ compressions

---

## Architecture

### Core Components

1. **Compression Coordinator** (`compressionCoordinator.ts`)
   - Orchestrates compression strategies
   - Manages checkpoint aging
   - Handles context rollover
   - Calculates dynamic budget

2. **Compression Service** (`compressionService.ts`)
   - Calls LLM for summarization
   - Generates compressed summaries
   - Handles compression failures

3. **Checkpoint Manager** (`checkpointManager.ts`)
   - Stores and retrieves checkpoints
   - Ages checkpoints over time
   - Merges old checkpoints
   - Preserves never-compressed content

4. **Snapshot Manager** (`snapshotManager.ts`)
   - Creates full conversation snapshots
   - Saves to disk for recovery
   - Restores previous states
   - Lists available snapshots

5. **Message Store** (`messageStore.ts`)
   - Tracks token usage
   - Triggers compression at thresholds
   - Manages message history

---

## Dynamic Budget Calculation

### Available Budget Formula

```
Available Budget = ollama_context_size - system_prompt_tokens - checkpoint_tokens
```

**Example: 8K Context**

```
Initial State:
├─ Ollama context: 6800 tokens (FIXED, 85% of 8K)
├─ System prompt: 500 tokens (fixed)
└─ Available for conversation: 6300 tokens
   └─ Trigger compression at: 6300 * 0.80 = 5040 tokens

After 1st Compression:
├─ Ollama context: 6800 tokens (FIXED)
├─ System prompt: 500 tokens (fixed)
├─ Checkpoint 1: 3400 tokens (recent history, 50-70% compressed)
└─ Available for NEW conversation: 2900 tokens
   └─ Trigger compression at: 2900 * 0.80 = 2320 tokens

After 2nd Compression:
├─ Ollama context: 6800 tokens (FIXED)
├─ System prompt: 500 tokens (fixed)
├─ Checkpoint 1: 1500 tokens (aged, 60% compressed)
├─ Checkpoint 2: 2000 tokens (recent, 50-70% compressed)
└─ Available for NEW: 2800 tokens
   └─ Trigger at: 2800 * 0.80 = 2240 tokens

After 3rd Compression:
├─ Ollama context: 6800 tokens (FIXED)
├─ System prompt: 500 tokens (fixed)
├─ Checkpoint 1: 800 tokens (ancient, 70% compressed)
├─ Checkpoint 2: 1200 tokens (old, 60% compressed)
├─ Checkpoint 3: 1800 tokens (recent, 50-70% compressed)
└─ Available for NEW: 2500 tokens
   └─ Trigger at: 2500 * 0.80 = 2000 tokens
```

**Key Insight:** Available budget shrinks with each checkpoint, but aging keeps it sustainable for 3-5+ compressions.

---

## Compression Trigger

Compression is triggered at **80% of Ollama context limit** AFTER the full message is added.

### Trigger Strategy (SIMPLE & ROBUST)

**Primary: Trust Ollama** ✅
- Ollama stops streaming at `num_ctx` limit (85% pre-calculated from user's selection)
- Full message is captured and added to context via `addMessage()`
- Compression triggers AFTER message is complete (not during streaming)
- Simple, reliable, no race conditions, no message truncation

**Safety: Emergency Brake** 🚨
- If streaming exceeds Ollama limit → emit warning event
- Should NEVER happen (indicates bug in Ollama or our code)
- Protects against runaway streams

### Trigger Calculation

```typescript
// Compression triggers AFTER message is added (not during streaming)
async addMessage(message: Message): Promise<void> {
  // 1. Add full message to context
  context.messages.push(message);
  context.tokenCount += message.tokenCount;
  
  // 2. Check if compression needed (AFTER message is complete)
  if (message.role === 'assistant') {
    const usage = this.getUsage();
    const usageFraction = usage.percentage / 100;
    
    // Trigger at 80% of Ollama limit (not user's selection)
    if (usageFraction >= 0.80) {
      await this.compress();
    }
  }
}

// During streaming: NO compression, only tracking
reportInflightTokens(delta: number): void {
  this.inflightTokens += delta;
  const totalTokens = context.tokenCount + this.inflightTokens;
  
  // Emergency brake: warn if exceeds Ollama limit
  if (totalTokens > context.maxTokens) {
    console.error('EMERGENCY: Stream exceeded Ollama limit!');
    this.emit('stream-overflow-emergency', { totalTokens, ollamaLimit: context.maxTokens });
  }
  
  // NO compression during streaming - prevents message truncation
}
```

**Why 80%?**
- Leaves 20% buffer (1393 tokens for 8K context)
- Prevents race condition with Ollama's limit
- Allows time for compression to complete
- Compression happens AFTER message is saved (no truncation)

### Flow Example (8K Context)

```
User selects: 8192 tokens (UI display)
Ollama receives: 6963 tokens (85% pre-calculated, sent as num_ctx)

Streaming phase:
├─ Ollama streams tokens
├─ We track inflight tokens (for UI display only)
├─ NO compression during streaming ✅
└─ Ollama stops at 6963 tokens (naturally, enforced by num_ctx)

After streaming completes:
├─ Full message added via addMessage()
├─ Current: 5570 tokens
├─ Check: 5570 / 6963 = 80% → Trigger compression
├─ Compress old messages into checkpoint
├─ Free up space for new conversation
└─ Continue conversation

Emergency brake (should never trigger):
└─ If stream exceeds 6963 → emit 'stream-overflow-emergency' event
```

---

## Checkpoint System

### Checkpoint Structure

```typescript
interface CompressionCheckpoint {
  id: string;
  level: 1 | 2 | 3;           // Compression level (1=compact, 3=detailed)
  range: string;              // Message range (e.g., "Messages 1-50")
  summary: Message;           // LLM-generated summary
  createdAt: Date;
  compressedAt?: Date;        // When aged/re-compressed
  originalTokens: number;     // Before compression
  currentTokens: number;      // After compression
  compressionCount: number;   // How many times compressed
  compressionNumber?: number; // Sequence number
  keyDecisions?: string[];    // Important decisions
  filesModified?: string[];   // Files changed
  nextSteps?: string[];       // Planned actions
}
```

### Checkpoint Aging

When a new compression is triggered, existing checkpoints age and compress further:

```
New compression triggered:
  ↓
1. Create new checkpoint from recent messages
   - Compress LLM output only (50-70% compression)
   - Preserve user messages (never compress)
   - Target: ~2000 tokens
  ↓
2. Age existing checkpoints:
   - Checkpoint 3 → Checkpoint 2 (compress to 60%)
   - Checkpoint 2 → Checkpoint 1 (compress to 50%)
   - Checkpoint 1 → Ultra-compress (compress to 40%)
  ↓
3. Recalculate available budget
  ↓
4. Continue conversation with new budget
```

### Compression Levels

```
Recent (Checkpoint 3): 50-70% compression
  - Detailed summaries
  - Key decisions preserved
  - Code snippets included
  - ~2000 tokens

Old (Checkpoint 2): 60% compression
  - Moderate summaries
  - Main points only
  - Code references only
  - ~1200 tokens

Ancient (Checkpoint 1): 70% compression
  - Brief summaries
  - Critical info only
  - No code details
  - ~800 tokens

Ultra (Merged): 80% compression
  - Minimal summary
  - Essential context only
  - ~400 tokens
```

---

## Goal-Aware Compression

### Overview

Goals guide the compression process by helping the LLM understand what information is important to preserve. When compressing conversation history, the active goal provides context for what should be kept and what can be summarized more aggressively.

### Goal Structure in Context

```typescript
interface Goal {
  id: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  status: 'active' | 'paused' | 'completed';
  createdAt: Date;
  completedAt?: Date;
  checkpoints: Checkpoint[];
  decisions: Decision[];
  artifacts: Artifact[];
}
```

### Goal Preservation Rules

**Always Preserved (Never Compressed):**
- Active goal description
- All checkpoints (pending, in-progress, completed)
- Locked decisions
- Artifact list (files created/modified)
- Next steps

**Updated During Compression:**
- Checkpoint status (marked as completed)
- New decisions added
- New artifacts recorded

### Goal-Aware Summarization Prompt

When creating checkpoints, the LLM receives the active goal as context:

```typescript
const summaryPrompt = `
ACTIVE GOAL: ${goal.description}
Priority: ${goal.priority}
Status: ${goal.status}

COMPLETED CHECKPOINTS:
${goal.checkpoints.filter(cp => cp.status === 'completed').map(cp => `✅ ${cp.description}`).join('\n')}

IN PROGRESS:
${goal.checkpoints.filter(cp => cp.status === 'in-progress').map(cp => `🔄 ${cp.description}`).join('\n')}

PENDING:
${goal.checkpoints.filter(cp => cp.status === 'pending').map(cp => `⏳ ${cp.description}`).join('\n')}

LOCKED DECISIONS:
${goal.decisions.filter(d => d.locked).map(d => `🔒 ${d.description}`).join('\n')}

---

Summarize the following conversation, focusing on progress toward the goal:
${messagesToCompress.join('\n')}

PRESERVE:
- Decisions made toward the goal
- Checkpoints completed
- Files created/modified
- Blockers encountered
- Technical details relevant to the goal
- Next steps planned

SUMMARIZE AGGRESSIVELY:
- Off-topic discussions
- Exploratory conversations
- Debugging steps that succeeded
- Repeated information

Provide a concise summary that maintains essential information for continuing work on the goal.
`;
```

### Goal Markers

The LLM can use special markers in its output to update goals:

```
[GOAL] Implement user authentication system
[CHECKPOINT] Design authentication flow - COMPLETED
[CHECKPOINT] Implement login endpoint - COMPLETED
[CHECKPOINT] Add JWT token generation - IN PROGRESS
[DECISION] Use JWT for authentication - LOCKED
[DECISION] Store tokens in httpOnly cookies - LOCKED
[ARTIFACT] Created src/auth/login.ts
[ARTIFACT] Created src/auth/jwt.ts
[ARTIFACT] Modified src/routes/api.ts
[NEXT] Complete JWT token generation, then move to user registration
```

These markers are parsed and used to update the goal structure:

```typescript
// Parse markers from LLM output
const markers = parseGoalMarkers(llmOutput);

// Update goal
if (markers.checkpoints) {
  markers.checkpoints.forEach(cp => {
    updateCheckpoint(goal.id, cp.description, cp.status);
  });
}

if (markers.decisions) {
  markers.decisions.forEach(d => {
    addDecision(goal.id, d.description, d.locked);
  });
}

if (markers.artifacts) {
  markers.artifacts.forEach(a => {
    recordArtifact(goal.id, a.type, a.path, a.action);
  });
}
```

### Context Structure with Goals

```
[System Prompt] - 500 tokens (never compressed)
  ├─ Core Mandates
  ├─ Active Goal - 200 tokens (never compressed)
  │  ├─ Goal: "Implement user authentication system"
  │  ├─ Checkpoints:
  │  │  ✅ Design authentication flow
  │  │  ✅ Implement login endpoint
  │  │  🔄 Add JWT token generation (IN PROGRESS)
  │  │  ⏳ Create user registration
  │  │  ⏳ Add password hashing
  │  ├─ Decisions:
  │  │  🔒 Use JWT for authentication (locked)
  │  │  🔒 Store tokens in httpOnly cookies (locked)
  │  │  - Use bcrypt for password hashing
  │  └─ Artifacts:
  │     - Created: src/auth/login.ts
  │     - Created: src/auth/jwt.ts
  │     - Modified: src/routes/api.ts
  └─ Skills

[Checkpoint 1] - 800 tokens (ancient, 70% compressed)
  Summary of early exploration and design decisions

[Checkpoint 2] - 1200 tokens (old, 60% compressed)
  Summary of login endpoint implementation

[Checkpoint 3] - 1800 tokens (recent, 50-70% compressed)
  Summary of JWT token work in progress

[User Messages] - 1500 tokens (never compressed)
[Recent Assistant Messages] - 1000 tokens (not yet compressed)
```

### Benefits of Goal-Aware Compression

**1. Better Summarization Quality**
- LLM knows what's important
- Preserves goal-relevant information
- Summarizes off-topic content more aggressively

**2. Maintains Context Continuity**
- Goals provide thread through conversation
- Checkpoints show progress
- Decisions prevent backtracking

**3. Improved Reliability**
- Less context loss over compressions
- Clear progress tracking
- Explicit decision recording

**4. Better User Experience**
- User can see progress at a glance
- Clear next steps
- Transparent decision-making

---

## LLM-Based Summarization

### Who Does the Compression?

**The LLM does the summarization**, not our app. Our app:
1. Identifies messages to compress
2. Sends them to the LLM with a summarization prompt
3. Receives the summary back
4. Stores the summary as a checkpoint
5. Removes the original messages from active context

### Summarization Process

```typescript
// 1. Extract messages to compress
const messagesToCompress = getRecentAssistantMessages(context);

// 2. Ask the SAME LLM to summarize its own output
const summaryPrompt = `Summarize the following conversation history, preserving key decisions, code changes, and important context:

${messagesToCompress.join('\n')}

Provide a concise summary that maintains essential information.`;

const summary = await llm.generate(summaryPrompt);

// 3. Create checkpoint with summary
const checkpoint = {
  summary: summary,
  tokens: countTokens(summary),
  originalTokens: countTokens(messagesToCompress),
  compressionRatio: summary.tokens / messagesToCompress.tokens,
  timestamp: Date.now()
};

// 4. Replace original messages with checkpoint
context.messages = [
  systemPrompt,           // Always preserved
  ...checkpoints,         // All previous checkpoints
  checkpoint,             // New checkpoint
  ...userMessages,        // Always preserved (never compress)
  ...recentMessages       // Most recent (not yet compressed)
];
```

### Compression Rules

- ✅ Compress LLM output only (assistant messages)
- ❌ Never compress user messages
- ❌ Never compress system prompt
- ❌ Never compress goals or architecture decisions
- ❌ Never compress active goal checkpoints
- ❌ Never compress locked decisions
- ✅ Each aging step compresses more aggressively
- ✅ Oldest checkpoints are most compressed

### Never-Compressed Content

The following content is ALWAYS preserved in full and never compressed:

**1. System Prompt**
- Core mandates
- Active goals
- Active skills
- Sanity checks

**2. User Messages**
- All user input
- All user questions
- All user instructions

**3. Goals and Decisions**
- Active goal description
- Goal checkpoints (pending, in-progress, completed)
- Locked decisions
- Key artifacts

**4. Architecture Decisions**
- Design patterns chosen
- Technology stack decisions
- API contracts
- Database schemas

**Example Context Structure:**
```
[System Prompt] - 500 tokens (never compressed)
  ├─ Core Mandates
  ├─ Active Goal - 200 tokens (never compressed)
  │  ├─ Goal description
  │  ├─ Checkpoints
  │  ├─ Decisions (locked)
  │  └─ Artifacts
  └─ Skills

[Checkpoint 1] - 800 tokens (ancient, 70% compressed)
[Checkpoint 2] - 1200 tokens (old, 60% compressed)
[Checkpoint 3] - 1800 tokens (recent, 50-70% compressed)

[User Messages] - 1500 tokens (never compressed)
[Recent Assistant Messages] - 1000 tokens (not yet compressed)
```

### Compression Quality by Model Size

```
Small models (3B-7B):
  - Basic summarization
  - May lose subtle context
  - Good for simple conversations
  - Compression: 50-70%
  - Recommend: 2-3 compressions max

Medium models (13B-30B):
  - Good summarization
  - Preserves most context
  - Handles complex topics
  - Compression: 60-80%
  - Recommend: 3-5 compressions

Large models (70B+):
  - Excellent summarization
  - Preserves nuance and meaning
  - Handles very complex topics
  - Compression: 70-90%
  - Recommend: 5-7 compressions
```

---

## Session History Storage

The system maintains two separate storage systems:

### 1. Active Context (Memory)

- Compressed for LLM efficiency
- Sent to LLM with each message
- Contains:
  - System prompt
  - Checkpoints (compressed history)
  - User messages (never compressed)
  - Recent messages (not yet compressed)

### 2. Full History (Disk)

- Uncompressed complete record
- Saved to `~/.ollm/sessions/{sessionId}.json`
- Contains:
  - ALL messages (uncompressed)
  - ALL tool calls
  - Metadata (tokens, compressions)
- Never affected by compression
- User can review anytime

**Key Principle:** Compression only affects what's sent to the LLM, not what's saved to disk.

### Session File Structure

```json
{
  "sessionId": "uuid",
  "startTime": "2026-01-26T10:00:00Z",
  "lastActivity": "2026-01-26T11:30:00Z",
  "model": "llama3.2:3b",
  "provider": "ollama",
  "messages": [
    {
      "role": "user",
      "parts": [{ "type": "text", "text": "..." }],
      "timestamp": "2026-01-26T10:00:00Z"
    },
    {
      "role": "assistant",
      "parts": [{ "type": "text", "text": "..." }],
      "timestamp": "2026-01-26T10:00:15Z"
    }
  ],
  "toolCalls": [
    {
      "id": "call_123",
      "name": "read_file",
      "args": { "path": "file.ts" },
      "result": { "llmContent": "..." },
      "timestamp": "2026-01-26T10:00:20Z"
    }
  ],
  "metadata": {
    "tokenCount": 8500,
    "compressionCount": 2
  }
}
```

---

## Snapshot System

### Snapshot vs Checkpoint

**Checkpoint:**
- Compressed summary of conversation history
- Part of active context
- Sent to LLM with each message
- Ages over time

**Snapshot:**
- Full conversation state saved to disk
- Not part of active context
- Used for recovery and rollback
- Never changes after creation

### Snapshot Structure

```typescript
interface ContextSnapshot {
  id: string;
  sessionId: string;
  timestamp: Date;
  context: ConversationContext;  // Full state
  tokenCount: number;
  messageCount: number;
  checkpointCount: number;
  metadata: {
    model: string;
    tier: ContextTier;
    mode: OperationalMode;
  };
}
```

### Snapshot Operations

**Create Snapshot:**
```typescript
const snapshot = await contextManager.createSnapshot();
// Saves full conversation state to disk
```

**Restore Snapshot:**
```typescript
await contextManager.restoreSnapshot(snapshotId);
// Restores conversation to previous state
```

**List Snapshots:**
```typescript
const snapshots = await contextManager.listSnapshots();
// Returns all available snapshots
```

---

## Reliability Tracking

The system tracks conversation reliability based on model size and compression count.

### Reliability Score Calculation

```typescript
// Model size factor (see dev_ModelManagement.md for detection)
const modelFactor = 
  modelSize >= 70 ? 0.95 :  // 70B+ models
  modelSize >= 30 ? 0.85 :  // 30B models
  modelSize >= 13 ? 0.70 :  // 13B models
  modelSize >= 7  ? 0.50 :  // 7B models
  0.30;                      // 3B and below

// Compression penalty (15% per compression)
const compressionPenalty = Math.max(
  1.0 - (compressionCount * 0.15),
  0.30  // Never go below 30%
);

// Final score
const score = modelFactor * compressionPenalty * contextConfidence;
```

### Reliability Levels

| Score | Level | Icon | Meaning |
|-------|-------|------|---------|
| 85-100% | High | 🟢 | Excellent reliability |
| 60-84% | Medium | 🟡 | Good reliability |
| 40-59% | Low | 🟠 | Degraded reliability |
| <40% | Critical | 🔴 | Poor reliability |

### UI Display

```
Context: 5,234/6,800  🟡 65%  (2 compressions)
```

**Warning for Low Reliability:**
```
⚠️ Context Compression Warning
Your model (llama3.2:3b) has compressed the conversation 3 times.
Small models may lose context accuracy after multiple compressions.

Recommendations:
- Continue if making good progress
- Start new conversation if seeing hallucinations
- Use larger model for complex long-term tasks
```

---

## Configuration

### Compression Config

```typescript
interface CompressionConfig {
  enabled: boolean;
  strategy: 'summarize' | 'truncate';
  preserveRecent: number;     // Tokens to preserve
  summaryMaxTokens: number;   // Max tokens for summary
}
```

### Snapshot Config

```typescript
interface SnapshotConfig {
  enabled: boolean;
  autoCreate: boolean;
  autoThreshold: number;  // Trigger at % of context
}
```

### Default Values

```typescript
const DEFAULT_CONFIG = {
  compression: {
    enabled: true,
    strategy: 'summarize',
    preserveRecent: 2048,
    summaryMaxTokens: 1024,
  },
  snapshots: {
    enabled: true,
    autoCreate: true,
    autoThreshold: 0.80,  // 80% of available budget
  },
};
```

---

## Events

### Compression Events

- `compressed` - Compression completed
- `compression-skipped` - Compression skipped (not needed)
- `compression-error` - Compression failed
- `rollover-complete` - Context rollover completed
- `auto-summary-created` - Auto-summary created
- `tier1-compressed` - Tier 1 rollover compression
- `tier2-compressed` - Tier 2 smart compression
- `tier3-compressed` - Tier 3 progressive compression
- `tier4-compressed` - Tier 4 structured compression
- `tier5-compressed` - Tier 5 ultra compression

### Snapshot Events

- `snapshot-created` - Snapshot created
- `snapshot-restored` - Snapshot restored
- `snapshot-error` - Snapshot operation failed
- `auto-snapshot-created` - Auto-snapshot created

---

## Best Practices

### 1. Compression

- Enable compression for long conversations
- Monitor reliability score
- Start new conversation if reliability drops below 40%
- Use larger models for complex long-term tasks

### 2. Goals and Decisions

- Always mark important decisions as "never compress"
- Set clear goals at conversation start
- Track checkpoints for complex tasks
- Goals are preserved across all compressions

### 3. Session Management

- Full history always saved to disk
- Review full history anytime
- Export sessions for documentation
- Search across sessions for insights

### 4. Snapshots

- Create snapshots before major changes
- Use snapshots for experimentation
- Restore snapshots if conversation goes off track
- Keep important snapshots for reference

---

## Troubleshooting

### Poor Reliability

**Symptom:** Reliability score below 40%

**Solutions:**
1. Start new conversation
2. Use larger model (13B+ recommended)
3. Review and preserve important decisions
4. Create checkpoint before continuing

### Compression Failures

**Symptom:** "Compression failed" error

**Solutions:**
1. Check LLM is responding
2. Verify enough messages to compress
3. Check compression config
4. Review logs for specific error

### Rapid Re-Compression

**Symptom:** Compression triggers immediately after previous compression

**Solutions:**
1. Verify dynamic budget calculation is working
2. Check checkpoint tokens are being tracked
3. Ensure checkpoints are aging properly
4. Review compression trigger threshold (should be 80% of available)

---

## Goal Integration Summary

Goals are integrated into both the Compression System and Prompt System:

**In Compression System (this document):**
- Goals are NEVER compressed
- Goals guide summarization (what to preserve)
- Goal markers update goal structure
- Goals maintain continuity across compressions

**In Prompt System (dev_PromptSystem.md):**
- Goals are part of the system prompt
- Always visible to the LLM
- Updated when milestones are reached
- Guide LLM behavior and focus

**Flow:**
```
User provides task
  ↓
LLM analyzes and creates goal (Prompt System)
  ↓
Goal added to system prompt
  ↓
LLM works on goal, conversation grows
  ↓
Compression triggered (this system)
  ↓
LLM summarizes with goal context
  ↓
Goal preserved, history compressed
  ↓
Goal updated with progress markers
  ↓
Continue conversation with updated goal
```

---

## File Locations

| File | Purpose |
|------|---------|
| `packages/core/src/context/compressionCoordinator.ts` | Orchestrates compression |
| `packages/core/src/context/compressionService.ts` | LLM summarization |
| `packages/core/src/context/checkpointManager.ts` | Checkpoint management |
| `packages/core/src/context/snapshotManager.ts` | Snapshot operations |
| `packages/core/src/context/messageStore.ts` | Tracks usage, triggers compression |
| `packages/core/src/context/goalManager.ts` | Goal management |
| `packages/core/src/services/chatRecordingService.ts` | Full history storage |

---

**Note:** This document focuses on compression and snapshots. For context sizing logic, see `dev_ContextManagement.md`. For prompt structure, see `dev_PromptSystem.md`.
