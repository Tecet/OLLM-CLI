# Context Compression and Checkpoint System

**Last Updated:** January 29, 2026  
**Status:** ✅ Production - New System Enabled by Default (v0.1.1)

> **🎉 NEW SYSTEM ENABLED:** As of v0.1.1, the new LLM-based compression system is enabled by default. The legacy system is available for backward compatibility by setting feature flags to `false`.

**Related Documents:**

- [Context Management](./dev_ContextManagement.md) - Context sizing and VRAM management
- [Prompt System](./dev_PromptSystem.md) - Prompt structure, tiers, modes
- [Model Management](./dev_ModelManagement.md) - Model size detection for reliability
- [Context Checkpoint Rollover](./dev_ContextCheckpointRollover.md) - Checkpoint strategy, sessions, snapshots
- [Context Checkpoint Aging](./dev_ContextCheckpointAging.md) - Progressive compression
- [Context Tokeniser](./dev_ContextTokeniser.md) - Token counting system
- [Context Pre-Send Validation](./dev_ContextPreSendValidation.md) - Overflow prevention
- [Context Input Preprocessing](./dev_ContextInputPreprocessing.md) - Input preprocessing
- [Session Storage](./dev_SessionStorage.md) - Full history storage

---

## Feature Flags (v0.1.1+)

**Default Behavior:** All new system features are **enabled by default**.

To disable specific features, set environment variables to `false`:

```bash
# Disable all new features (revert to legacy system)
export OLLM_NEW_COMPRESSION=false
export OLLM_NEW_CONTEXT=false
export OLLM_NEW_CHECKPOINTS=false
export OLLM_NEW_SNAPSHOTS=false
export OLLM_NEW_VALIDATION=false
```

**Note:** The legacy system has known issues (crashes after 3-4 checkpoints). Use only for backward compatibility.

---

## Recent Updates (January 28-29, 2026)

### ✅ Complete Architecture Refactor - Now Production Default

**Major Refactor (v0.1.1):**

The context compression system has been completely rewritten with a clean architecture to address fundamental design flaws. The new system is now **enabled by default** and provides:

1. **Storage Layer Separation** - Clear boundaries between active context, snapshots, and session history
2. **LLM-Based Summarization** - Semantic summaries instead of truncation
3. **Pre-Send Validation** - Hard stop before sending oversized prompts
4. **Checkpoint Aging** - Progressive compression of old checkpoints
5. **Comprehensive Error Handling** - Graceful degradation without crashes
6. **System Integration** - Deep integration with tiers, modes, models, providers, goals, and prompt orchestrator

**New Architecture:**

- **Storage Layer** (`types/`, `storage/`) - Type-safe storage interfaces
- **Compression Engine** (`compression/`) - LLM summarization pipeline
- **Checkpoint Lifecycle** (`checkpoints/`) - Aging and emergency actions
- **Orchestration** (`orchestration/`) - Main coordinator
- **Integration** (`integration/`) - System-wide integration
- **Migration** (`migration/`) - Legacy system migration

**Test Results:**

- All property-based tests passing ✅
- Comprehensive integration tests ✅
- Migration scripts tested ✅
- Zero TypeScript errors
- Production ready

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

### New Architecture (v0.1.1 Refactor)

The compression system has been completely rewritten with a **clean, layered architecture**:

```
┌─────────────────────────────────────────────────────────────┐
│ contextOrchestrator.ts (Main Coordination)                  │
│ - Coordinates all subsystems                                │
│ - Manages conversation lifecycle                            │
│ - Enforces storage boundaries                               │
│ - Integrates with all system components                     │
└─────────────────────────────────────────────────────────────┘
                            ↓
    ┌───────────────────────┼───────────────────────┐
    ↓                       ↓                       ↓
┌─────────────┐    ┌─────────────────┐    ┌──────────────────┐
│ Active      │    │ Snapshot        │    │ Session History  │
│ Context     │    │ Lifecycle       │    │ Manager          │
│ Manager     │    │                 │    │                  │
│             │    │                 │    │                  │
│ (LLM-bound) │    │ (Recovery)      │    │ (Full history)   │
└─────────────┘    └─────────────────┘    └──────────────────┘
       ↓                    ↓                       ↓
┌─────────────────────────────────────────────────────────────┐
│ Storage Boundaries (Runtime Enforcement)                    │
│ - Prevents cross-contamination                              │
│ - Type guards and validation                                │
└─────────────────────────────────────────────────────────────┘
       ↓
┌─────────────────────────────────────────────────────────────┐
│ Compression Pipeline                                        │
│ 1. Identification → 2. Preparation → 3. Summarization      │
│ 4. Checkpoint Creation → 5. Context Update → 6. Validation │
└─────────────────────────────────────────────────────────────┘
       ↓
┌─────────────────────────────────────────────────────────────┐
│ Supporting Services                                         │
│ - Summarization Service (LLM integration)                   │
│ - Validation Service (Pre-send checks)                      │
│ - Checkpoint Lifecycle (Aging)                              │
│ - Emergency Actions (Critical situations)                   │
└─────────────────────────────────────────────────────────────┘
       ↓
┌─────────────────────────────────────────────────────────────┐
│ System Integration Layer                                    │
│ - Tier-Aware Compression (prompt budgets)                   │
│ - Mode-Aware Compression (mode-specific strategies)         │
│ - Model-Aware Compression (model size adaptation)           │
│ - Provider-Aware Compression (provider limits)              │
│ - Goal-Aware Compression (goal preservation)                │
│ - Prompt Orchestrator Integration (system prompt)           │
└─────────────────────────────────────────────────────────────┘
```

### Core Components

#### 1. Storage Layer (`packages/core/src/context/storage/`)

**Purpose:** Separate storage concerns with clear boundaries

- **activeContextManager.ts** - Manages what gets sent to LLM
- **snapshotLifecycle.ts** - Recovery and rollback snapshots
- **sessionHistoryManager.ts** - Full uncompressed conversation history
- **storageBoundaries.ts** - Runtime enforcement of storage separation

**Key Principle:** Three distinct storage layers that never mix:
- Active Context: Compressed, sent to LLM
- Snapshots: Recovery only, never sent to LLM
- Session History: Full history, never sent to LLM

#### 2. Compression Engine (`packages/core/src/context/compression/`)

**Purpose:** LLM-based semantic summarization

- **compressionPipeline.ts** - Six-stage compression pipeline
- **summarizationService.ts** - LLM integration for summaries
- **validationService.ts** - Pre-send validation
- **compressionEngine.ts** - Strategy pattern for compression types

**Key Features:**
- LLM creates semantic summaries (not truncation)
- Multi-level compression (detailed → moderate → compact)
- Pre-send validation prevents overflow
- Progress reporting and error handling

#### 3. Checkpoint Lifecycle (`packages/core/src/context/checkpoints/`)

**Purpose:** Progressive checkpoint aging and emergency handling

- **checkpointLifecycle.ts** - Checkpoint aging and merging
- **emergencyActions.ts** - Emergency compression actions

**Key Features:**
- Checkpoints age over time (Level 3 → 2 → 1 → Merged)
- LLM re-summarization at each level
- Emergency actions when context critical
- Snapshot before emergency actions

#### 4. Orchestration (`packages/core/src/context/orchestration/`)

**Purpose:** Main coordination of all subsystems

- **contextOrchestrator.ts** - Main coordinator
- Integrates all compression components
- Manages conversation lifecycle
- Enforces storage boundaries
- Emits events for UI updates

#### 5. System Integration (`packages/core/src/context/integration/`)

**Purpose:** Deep integration with existing systems

- **tierAwareCompression.ts** - Respects tier-specific prompt budgets
- **modeAwareCompression.ts** - Mode-specific compression strategies
- **modelAwareCompression.ts** - Model size affects compression quality
- **providerAwareCompression.ts** - Provider-specific context limits
- **goalAwareCompression.ts** - Goals never compressed, guide summarization
- **promptOrchestratorIntegration.ts** - System prompt integration

#### 6. Migration (`packages/core/src/context/migration/`)

**Purpose:** Migrate from legacy system

- **sessionMigration.ts** - Migrate old sessions
- **snapshotMigration.ts** - Migrate old snapshots
- **migrationCLI.ts** - Command-line migration tool

### Legacy System (Archived)

The old compression system has been backed up to `.legacy/context-compression/2026-01-28-233842/`:

**Legacy Files (Archived):**
- compressionService.ts (920 lines) - Truncation-based compression
- compressionCoordinator.ts (830 lines) - Tier-based dispatch
- chatCompressionService.ts (559 lines) - Session compression
- checkpointManager.ts (~400 lines) - Checkpoint storage
- snapshotManager.ts (615 lines) - Snapshot management
- contextManager.ts (639 lines) - Context orchestration

**Why Replaced:**
- ❌ No LLM summarization (just truncation)
- ❌ Snapshots mixed with active context
- ❌ No pre-send validation
- ❌ Checkpoints don't age properly
- ❌ User messages accumulate unbounded
- ❌ No error handling

### File Organization

```
packages/core/src/context/
├── types/
│   └── storageTypes.ts          # Storage layer interfaces
│
├── storage/
│   ├── activeContextManager.ts  # Active context (LLM-bound)
│   ├── snapshotLifecycle.ts     # Recovery snapshots
│   ├── sessionHistoryManager.ts # Full history
│   └── storageBoundaries.ts     # Boundary enforcement
│
├── compression/
│   ├── compressionPipeline.ts   # Structured flow
│   ├── compressionEngine.ts     # Core compression logic
│   ├── summarizationService.ts  # LLM summarization
│   └── validationService.ts     # Pre-send validation
│
├── checkpoints/
│   ├── checkpointLifecycle.ts   # Checkpoint management
│   └── emergencyActions.ts      # Emergency handling
│
├── orchestration/
│   └── contextOrchestrator.ts   # Main coordinator
│
├── integration/
│   ├── tierAwareCompression.ts
│   ├── modeAwareCompression.ts
│   ├── modelAwareCompression.ts
│   ├── providerAwareCompression.ts
│   ├── goalAwareCompression.ts
│   └── promptOrchestratorIntegration.ts
│
├── migration/
│   ├── sessionMigration.ts
│   ├── snapshotMigration.ts
│   └── migrationCLI.ts
│
└── __tests__/
    ├── storage/
    ├── compression/
    ├── checkpoints/
    ├── orchestration/
    └── integration/
```

---

## Storage Layer Separation

### Three Distinct Storage Layers

The new architecture enforces **strict separation** between three storage layers:

#### 1. Active Context (LLM-Bound)

**Purpose:** What gets sent to the LLM

**Location:** In-memory only

**Contents:**
- System prompt (never compressed)
- Checkpoint summaries (compressed history)
- Recent messages (not yet compressed)
- User messages (never compressed)

**Characteristics:**
- Compressed for efficiency
- Fits within Ollama's context limit
- Rebuilt for each LLM call
- No persistent storage

**Interface:**

```typescript
interface ActiveContext {
  systemPrompt: Message;
  checkpoints: CheckpointSummary[];  // LLM-generated summaries only
  recentMessages: Message[];          // Last N messages
  tokenCount: {
    system: number;
    checkpoints: number;
    recent: number;
    total: number;
  };
}
```

#### 2. Snapshots (Recovery)

**Purpose:** Recovery and rollback

**Location:** `~/.ollm/context-snapshots/`

**Contents:**
- Full conversation state at a point in time
- All messages (uncompressed)
- All checkpoints
- Goals and metadata

**Characteristics:**
- Never sent to LLM
- Used only for recovery
- Created before risky operations
- Automatic cleanup (keep last N)

**Interface:**

```typescript
interface SnapshotData {
  id: string;
  sessionId: string;
  timestamp: number;
  conversationState: {
    messages: Message[];           // Full messages at checkpoint
    checkpoints: CheckpointSummary[];
    goals?: Goal[];
    metadata: Record<string, unknown>;
  };
  purpose: 'recovery' | 'rollback' | 'emergency';
}
```

#### 3. Session History (Full Record)

**Purpose:** Complete uncompressed conversation

**Location:** `~/.ollm/sessions/{sessionId}.json`

**Contents:**
- ALL messages (uncompressed)
- ALL tool calls
- Checkpoint records (metadata)
- Session metadata

**Characteristics:**
- Never sent to LLM
- Never affected by compression
- Permanent record
- Can be exported/reviewed

**Interface:**

```typescript
interface SessionHistory {
  sessionId: string;
  messages: Message[];              // Complete uncompressed history
  checkpointRecords: CheckpointRecord[];
  metadata: {
    startTime: number;
    lastUpdate: number;
    totalMessages: number;
    totalTokens: number;
    compressionCount: number;
  };
}
```

### Storage Boundaries

**Runtime Enforcement:**

```typescript
class StorageBoundaries {
  // Type guards
  isActiveContext(data: unknown): data is ActiveContext;
  isSnapshotData(data: unknown): data is SnapshotData;
  isSessionHistory(data: unknown): data is SessionHistory;
  
  // Validation
  validateActiveContext(context: ActiveContext): ValidationResult;
  validateSnapshotData(snapshot: SnapshotData): ValidationResult;
  validateSessionHistory(history: SessionHistory): ValidationResult;
  
  // Enforcement
  preventSnapshotInPrompt(prompt: Message[]): void;
  preventHistoryInPrompt(prompt: Message[]): void;
}
```

**Key Principle:** These three layers NEVER mix. Snapshots and session history are NEVER sent to the LLM.

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
  level: 1 | 2 | 3; // Compression level (1=compact, 3=detailed)
  range: string; // Message range (e.g., "Messages 1-50")
  summary: Message; // LLM-generated summary
  createdAt: Date;
  compressedAt?: Date; // When aged/re-compressed
  originalTokens: number; // Before compression
  currentTokens: number; // After compression
  compressionCount: number; // How many times compressed
  compressionNumber?: number; // Sequence number
  keyDecisions?: string[]; // Important decisions
  filesModified?: string[]; // Files changed
  nextSteps?: string[]; // Planned actions
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
${goal.checkpoints
  .filter((cp) => cp.status === 'completed')
  .map((cp) => `✅ ${cp.description}`)
  .join('\n')}

IN PROGRESS:
${goal.checkpoints
  .filter((cp) => cp.status === 'in-progress')
  .map((cp) => `🔄 ${cp.description}`)
  .join('\n')}

PENDING:
${goal.checkpoints
  .filter((cp) => cp.status === 'pending')
  .map((cp) => `⏳ ${cp.description}`)
  .join('\n')}

LOCKED DECISIONS:
${goal.decisions
  .filter((d) => d.locked)
  .map((d) => `🔒 ${d.description}`)
  .join('\n')}

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
  markers.checkpoints.forEach((cp) => {
    updateCheckpoint(goal.id, cp.description, cp.status);
  });
}

if (markers.decisions) {
  markers.decisions.forEach((d) => {
    addDecision(goal.id, d.description, d.locked);
  });
}

if (markers.artifacts) {
  markers.artifacts.forEach((a) => {
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

### Summarization Service

The new architecture uses a dedicated **SummarizationService** that integrates with the LLM to create semantic summaries.

**Key Features:**
- LLM creates summaries (not truncation)
- Multi-level compression (detailed → moderate → compact)
- Goal-aware summarization
- Mode-specific prompts
- Error handling and retries

### Compression Pipeline

The compression process follows a **six-stage pipeline**:

```
1. Identification
   ↓ Which messages to compress?
2. Preparation
   ↓ Format for LLM
3. Summarization
   ↓ LLM creates summary
4. Checkpoint Creation
   ↓ Store summary
5. Context Update
   ↓ Replace old with summary
6. Validation
   ↓ Verify result fits
```

### Summarization Process

```typescript
// 1. Identify messages to compress
const messagesToCompress = identifyMessagesToCompress(context);

// 2. Prepare for summarization
const prepared = prepareForSummarization(messagesToCompress, goal);

// 3. Ask the LLM to summarize
const summary = await summarizationService.summarize(
  prepared.messages,
  prepared.level,
  goal
);

// 4. Create checkpoint with summary
const checkpoint = createCheckpoint(summary, messagesToCompress, prepared.level);

// 5. Update active context
activeContext.removeMessages(checkpoint.originalMessageIds);
activeContext.addCheckpoint(checkpoint);

// 6. Validate result
const validation = validationService.validate(activeContext.buildPrompt());
if (!validation.valid) {
  throw new Error(`Compression failed validation: ${validation.message}`);
}
```

### Compression Levels

The system uses three compression levels:

```
Level 3 (Detailed): 50-70% compression
  - Detailed summaries
  - Key decisions preserved
  - Code snippets included
  - ~2000 tokens

Level 2 (Moderate): 60% compression
  - Moderate summaries
  - Main points only
  - Code references only
  - ~1200 tokens

Level 1 (Compact): 70% compression
  - Brief summaries
  - Critical info only
  - No code details
  - ~800 tokens
```

### Summarization Prompts

The system uses different prompts based on compression level and mode:

```typescript
// Level 3 (Detailed)
const detailedPrompt = `
Summarize the following conversation, preserving:
- All key decisions and rationale
- Code snippets and file paths
- Technical details and implementation notes
- Error messages and debugging context
- Next steps and planned actions

${messages.join('\n')}
`;

// Level 2 (Moderate)
const moderatePrompt = `
Summarize the following conversation, preserving:
- Main decisions and outcomes
- File paths (no code snippets)
- Important technical points
- Critical errors
- Next steps

${messages.join('\n')}
`;

// Level 1 (Compact)
const compactPrompt = `
Provide a brief summary of the following conversation:
- Key decisions only
- Files modified
- Critical issues
- Next action

${messages.join('\n')}
`;
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

### Error Handling

The summarization service includes comprehensive error handling:

```typescript
try {
  const summary = await llm.generate(summaryPrompt);
  
  // Validate summary
  if (!summary || summary.length === 0) {
    throw new Error('Empty summary returned');
  }
  
  // Check for inflation (summary larger than original)
  const summaryTokens = countTokens(summary);
  const originalTokens = countTokens(messages);
  if (summaryTokens > originalTokens * 0.9) {
    throw new Error('Summary too large (inflation detected)');
  }
  
  return summary;
} catch (error) {
  // Retry with simpler prompt
  if (retryCount < 3) {
    return await this.summarize(messages, level - 1, goal, retryCount + 1);
  }
  
  // Fallback to truncation
  console.error('Summarization failed, falling back to truncation');
  return truncateMessages(messages);
}
```

---

## System Integration

The new architecture includes deep integration with all major systems:

### 1. Tier System Integration

**Purpose:** Respect tier-specific prompt budgets

**Implementation:** `tierAwareCompression.ts`

**Features:**
- Tier budgets: 200-1500 tokens
- Compression triggers account for tier
- System prompt never compressed
- Tier changes handled gracefully

**Example:**

```typescript
class TierAwareCompression {
  private tierBudgets = {
    TIER_1_MINIMAL: 200,
    TIER_2_BASIC: 500,
    TIER_3_STANDARD: 1000,
    TIER_4_PREMIUM: 1500,
    TIER_5_ULTRA: 1500,
  };

  shouldCompress(tier: ContextTier, currentTokens: number, ollamaLimit: number): boolean {
    const promptBudget = this.tierBudgets[tier];
    const availableForMessages = ollamaLimit - promptBudget - 1000; // Safety margin
    return currentTokens > availableForMessages * 0.75; // Trigger at 75%
  }
}
```

### 2. Mode System Integration

**Purpose:** Mode-aware compression strategies

**Implementation:** `modeAwareCompression.ts`

**Features:**
- Mode-specific summarization prompts
- Developer mode preserves code context
- Planning mode preserves goals/decisions
- Debugger mode preserves errors

**Example:**

```typescript
class ModeAwareCompression {
  getSummarizationPrompt(mode: OperationalMode, level: 1 | 2 | 3): string {
    const basePrompt = this.getBasePrompt(level);
    
    switch (mode) {
      case 'DEVELOPER':
        return `${basePrompt}\n\nFocus on preserving:\n- Code snippets and file paths\n- Technical decisions\n- Error messages and debugging context`;
      
      case 'PLANNING':
        return `${basePrompt}\n\nFocus on preserving:\n- Goals and objectives\n- Architectural decisions\n- Trade-offs discussed`;
      
      // ... other modes
    }
  }
}
```

### 3. Model Management Integration

**Purpose:** Model size affects compression quality

**Implementation:** `modelAwareCompression.ts`

**Features:**
- Model size detection
- Reliability scoring based on model
- Warning thresholds by model size
- Model swaps preserve compression state

**Example:**

```typescript
class ModelAwareCompression {
  calculateReliability(modelSize: number, compressionCount: number): number {
    const modelFactor =
      modelSize >= 70 ? 0.95 :
      modelSize >= 30 ? 0.85 :
      modelSize >= 13 ? 0.7 :
      modelSize >= 7 ? 0.5 :
      0.3; // 3B and below

    const compressionPenalty = Math.pow(0.9, compressionCount);
    return modelFactor * compressionPenalty;
  }
}
```

### 4. Provider System Integration

**Purpose:** Use provider-specific context limits

**Implementation:** `providerAwareCompression.ts`

**Features:**
- Provider limits read from profiles
- 85% values used correctly
- Compression triggers respect provider
- Provider errors handled

**Example:**

```typescript
class ProviderAwareCompression {
  getContextLimit(modelId: string): number {
    const modelEntry = this.profileManager.getModelEntry(modelId);
    const profile = modelEntry.context_profiles.find(
      p => p.size === this.getCurrentContextSize()
    );
    
    return profile?.ollama_context_size || 6800; // Default to 8K * 0.85
  }
}
```

### 5. Goal System Integration

**Purpose:** Goals NEVER compressed, guide summarization

**Implementation:** `goalAwareCompression.ts`

**Features:**
- Goals always in system prompt
- Goal-aware summarization
- Goal markers parsed correctly
- Progress tracked accurately

**Example:**

```typescript
class GoalAwareCompression {
  buildGoalAwarePrompt(messages: Message[], goal: Goal): string {
    return `
ACTIVE GOAL: ${goal.description}
Priority: ${goal.priority}
Status: ${goal.status}

Checkpoints:
${goal.checkpoints.map(cp => `${cp.status === 'completed' ? '✅' : '🔄'} ${cp.description}`).join('\n')}

Summarize the following conversation, focusing on progress toward the goal:
${messages.map(m => `${m.role}: ${m.content}`).join('\n\n')}

Preserve:
- Decisions made toward the goal
- Checkpoints completed
- Files created/modified
- Blockers encountered
    `.trim();
  }
}
```

### 6. Prompt Orchestrator Integration

**Purpose:** System prompt built by PromptOrchestrator

**Implementation:** `promptOrchestratorIntegration.ts`

**Features:**
- System prompt from orchestrator
- Compression respects prompt structure
- Checkpoints integrated into prompt
- Skills/tools/hooks preserved

**Example:**

```typescript
class PromptOrchestratorIntegration {
  getSystemPrompt(): Message {
    // System prompt built by PromptOrchestrator
    // Includes: tier prompt + mandates + goals + skills + sanity checks
    return this.promptOrchestrator.buildSystemPrompt();
  }

  getSystemPromptTokens(): number {
    const systemPrompt = this.getSystemPrompt();
    return countTokens(systemPrompt);
  }
}
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
  context: ConversationContext; // Full state
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
  modelSize >= 70
    ? 0.95 // 70B+ models
    : modelSize >= 30
      ? 0.85 // 30B models
      : modelSize >= 13
        ? 0.7 // 13B models
        : modelSize >= 7
          ? 0.5 // 7B models
          : 0.3; // 3B and below

// Compression penalty (15% per compression)
const compressionPenalty = Math.max(
  1.0 - compressionCount * 0.15,
  0.3 // Never go below 30%
);

// Final score
const score = modelFactor * compressionPenalty * contextConfidence;
```

### Reliability Levels

| Score   | Level    | Icon | Meaning               |
| ------- | -------- | ---- | --------------------- |
| 85-100% | High     | 🟢   | Excellent reliability |
| 60-84%  | Medium   | 🟡   | Good reliability      |
| 40-59%  | Low      | 🟠   | Degraded reliability  |
| <40%    | Critical | 🔴   | Poor reliability      |

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
  preserveRecent: number; // Tokens to preserve
  summaryMaxTokens: number; // Max tokens for summary
}
```

### Snapshot Config

```typescript
interface SnapshotConfig {
  enabled: boolean;
  autoCreate: boolean;
  autoThreshold: number; // Trigger at % of context
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
    autoThreshold: 0.8, // 80% of available budget
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

## Checkpoint Utilities

**Added:** January 28, 2026  
**File:** `packages/core/src/context/checkpointUtils.ts`

A comprehensive utility library for working with compression checkpoints. These utilities simplify common checkpoint operations and improve code reusability.

### Available Utilities (16 functions)

#### Finding Checkpoints

- `findCheckpointById(checkpoints, id)` - Find checkpoint by ID
- `findCheckpointsAfter(checkpoints, timestamp)` - Find checkpoints after timestamp
- `findCheckpointsBefore(checkpoints, timestamp)` - Find checkpoints before timestamp

#### Sorting Checkpoints

- `sortCheckpointsByAge(checkpoints)` - Sort oldest first
- `sortCheckpointsByAgeDesc(checkpoints)` - Sort newest first
- `filterCheckpointsByLevel(checkpoints, level)` - Filter by compression level

#### Getting Subsets

- `getRecentCheckpoints(checkpoints, count)` - Get N most recent
- `getOldestCheckpoints(checkpoints, count)` - Get N oldest

#### Validation

- `validateCheckpoint(checkpoint)` - Validate checkpoint structure

#### Extraction

- `extractCheckpointSummaries(checkpoints)` - Extract summary messages

#### Calculations

- `calculateTotalCheckpointTokens(checkpoints)` - Calculate total current tokens
- `calculateTotalOriginalTokens(checkpoints)` - Calculate total original tokens

#### Management

- `splitCheckpointsByAge(checkpoints, keepRecent)` - Split into old/recent
- `exceedsMaxCheckpoints(checkpoints, maxCount)` - Check if exceeds limit
- `getCheckpointsForMerging(checkpoints, maxCount)` - Identify checkpoints to merge

### Usage Examples

```typescript
import {
  getRecentCheckpoints,
  calculateTotalCheckpointTokens,
  getCheckpointsForMerging,
  extractCheckpointSummaries,
} from './checkpointUtils.js';

// Get 5 most recent checkpoints
const recent = getRecentCheckpoints(context.checkpoints, 5);

// Calculate total tokens used by checkpoints
const totalTokens = calculateTotalCheckpointTokens(context.checkpoints);

// Check if we need to merge old checkpoints
const { toMerge, toKeep } = getCheckpointsForMerging(context.checkpoints, 10);
if (toMerge.length > 0) {
  const merged = mergeCheckpoints(toMerge);
  context.checkpoints = [merged, ...toKeep];
}

// Extract summaries for context reconstruction
const summaries = extractCheckpointSummaries(context.checkpoints);
context.messages = [...systemMessages, ...summaries, ...recentMessages];
```

### Benefits

- **Reusability:** Common operations centralized
- **Type Safety:** Full TypeScript support
- **Testability:** Each utility independently tested (44 tests)
- **Documentation:** Comprehensive JSDoc comments
- **Maintainability:** Clear, focused functions

---

## File Locations

### New Architecture (v0.1.1)

| File                                                                       | Purpose                          | Status      |
| -------------------------------------------------------------------------- | -------------------------------- | ----------- |
| `packages/core/src/context/types/storageTypes.ts`                          | Storage layer interfaces         | ✅ New      |
| `packages/core/src/context/storage/activeContextManager.ts`                | Active context (LLM-bound)       | ✅ New      |
| `packages/core/src/context/storage/snapshotLifecycle.ts`                   | Recovery snapshots               | ✅ New      |
| `packages/core/src/context/storage/sessionHistoryManager.ts`               | Full history                     | ✅ New      |
| `packages/core/src/context/storage/storageBoundaries.ts`                   | Boundary enforcement             | ✅ New      |
| `packages/core/src/context/compression/compressionPipeline.ts`             | Structured flow                  | ✅ New      |
| `packages/core/src/context/compression/compressionEngine.ts`               | Core compression logic           | ✅ New      |
| `packages/core/src/context/compression/summarizationService.ts`            | LLM summarization                | ✅ New      |
| `packages/core/src/context/compression/validationService.ts`               | Pre-send validation              | ✅ New      |
| `packages/core/src/context/checkpoints/checkpointLifecycle.ts`             | Checkpoint management            | ✅ New      |
| `packages/core/src/context/checkpoints/emergencyActions.ts`                | Emergency handling               | ✅ New      |
| `packages/core/src/context/orchestration/contextOrchestrator.ts`           | Main coordinator                 | ✅ New      |
| `packages/core/src/context/integration/tierAwareCompression.ts`            | Tier integration                 | ✅ New      |
| `packages/core/src/context/integration/modeAwareCompression.ts`            | Mode integration                 | ✅ New      |
| `packages/core/src/context/integration/modelAwareCompression.ts`           | Model integration                | ✅ New      |
| `packages/core/src/context/integration/providerAwareCompression.ts`        | Provider integration             | ✅ New      |
| `packages/core/src/context/integration/goalAwareCompression.ts`            | Goal integration                 | ✅ New      |
| `packages/core/src/context/integration/promptOrchestratorIntegration.ts`   | Prompt orchestrator integration  | ✅ New      |
| `packages/core/src/context/migration/sessionMigration.ts`                  | Session migration                | ✅ New      |
| `packages/core/src/context/migration/snapshotMigration.ts`                 | Snapshot migration               | ✅ New      |
| `packages/core/src/context/migration/migrationCLI.ts`                      | Migration CLI tool               | ✅ New      |
| `packages/core/src/context/__tests__/storage/`                             | Storage layer tests              | ✅ New      |
| `packages/core/src/context/__tests__/compression/`                         | Compression tests                | ✅ New      |
| `packages/core/src/context/__tests__/checkpoints/`                         | Checkpoint tests                 | ✅ New      |
| `packages/core/src/context/__tests__/orchestration/`                       | Orchestration tests              | ✅ New      |
| `packages/core/src/context/__tests__/integration/`                         | Integration tests                | ✅ New      |

### Legacy System (Archived)

| File                                                                       | Purpose                          | Status      |
| -------------------------------------------------------------------------- | -------------------------------- | ----------- |
| `.legacy/context-compression/2026-01-28-233842/core/compressionService.ts` | Old compression engine           | 📦 Archived |
| `.legacy/context-compression/2026-01-28-233842/core/compressionCoordinator.ts` | Old orchestration            | 📦 Archived |
| `.legacy/context-compression/2026-01-28-233842/services/chatCompressionService.ts` | Old session compression  | 📦 Archived |
| `.legacy/context-compression/2026-01-28-233842/core/checkpointManager.ts`  | Old checkpoint manager           | 📦 Archived |
| `.legacy/context-compression/2026-01-28-233842/core/snapshotManager.ts`    | Old snapshot manager             | 📦 Archived |
| `.legacy/context-compression/2026-01-28-233842/core/contextManager.ts`     | Old context manager              | 📦 Archived |

---

**Note:** This document describes the new compression architecture (v0.1.1). For context sizing logic, see `dev_ContextManagement.md`. For snapshot details, see `dev_ContextSnapshots.md`. For prompt structure, see `dev_PromptSystem.md`.

