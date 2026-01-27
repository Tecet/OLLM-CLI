# Input Preprocessing & Goal Extraction System

**Last Updated:** January 27, 2026  
**Status:** Design Document (Implementation Pending)

**Related Documents:**
- [Context Checkpoint Rollover](./dev_ContextCheckpointRollover.md) - Sessions, snapshots, and chat history
- [Context Compression](./dev_ContextCompression.md) - Compression system
- [Context Management](./dev_ContextManagement.md) - Context management
- [Context Pre-Send Validation](./dev_ContextPreSendValidation.md) - Overflow prevention
- [Session Storage](./dev_SessionStorage.md) - Session persistence

---

## Overview

The Input Preprocessing system transforms how conversations start by extracting signal from noise, clarifying intent, and establishing proactive goals BEFORE the conversation begins.

**Core Principle:** Don't let garbage into the context. Extract intent, clarify with user, set goals, then proceed.

---

## The Problem

### Current Flow (Reactive)
```
User sends: [3000 tokens]
├─ Typos: "uhh", "like", "you know"
├─ Rambling: Unclear direction
├─ Logs: 2000 lines pasted
├─ Buried intent: Hidden in noise
└─ No structure

LLM reads everything:
├─ Gets confused by noise
├─ Responds to garbage
├─ No clear direction
└─ Wastes 3000 tokens

Context fills with garbage:
├─ 3000 tokens of rambling
├─ Compression compresses garbage
├─ No clear goals
└─ Reactive conversation
```

### The Solution (Proactive)
```
User sends: [3000 tokens with noise]
  ↓
[PREPROCESSING TRIGGERED: >500 tokens]
  ↓
LLM extracts:
├─ Intent: "Fix auth system crash"
├─ Key points: 3 bullet points
├─ Attachments: Relevant log lines
└─ Typos fixed: 47

LLM clarifies:
"I understand you want to: [intent]
Key points: 1) 2) 3)
Is this correct?"
  ↓
User: "Yes"
  ↓
LLM proposes goal:
"Goal: Fix and test auth system
Milestones: 1) 2) 3) 4) 5)
Shall I proceed?"
  ↓
User: "Yes"
  ↓
Intent Snapshot created:
├─ Original: 3000 tokens (session file)
├─ Extracted: 100 tokens (active context)
├─ Goal: With milestones
└─ Stored for RAG/memory
  ↓
LLM becomes proactive:
├─ Tracks milestone progress
├─ Suggests next steps
├─ Asks for clarification
└─ Goal-driven conversation
```

---

## Architecture

### Components

1. **InputPreprocessor** - Extracts intent from noise
2. **IntentSnapshotManager** - Stores intent snapshots
3. **ClarificationLoop** - Confirms understanding
4. **GoalProposal** - Creates structured goals
5. **ProactiveMode** - Tracks milestones

### Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    USER SENDS MESSAGE                        │
│  "hey so i was thinking like we need to uhh fix that auth   │
│   thing and also [2000 lines of logs] and maybe tests..."   │
└─────────────────────────────────────────────────────────────┘
                              ↓
                    [Token Count: 3000]
                              ↓
                    [TRIGGER: >500 tokens]
                              ↓
┌─────────────────────────────────────────────────────────────┐
│              INPUT PREPROCESSOR (LLM-based)                  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ 1. Fix typos: "uhh" → removed, "like" → removed     │  │
│  │ 2. Extract intent: "Fix auth system crash"          │  │
│  │ 3. Extract key points:                               │  │
│  │    - Users reporting issues                          │  │
│  │    - System crashes (logs provided)                  │  │
│  │    - Need test coverage                              │  │
│  │ 4. Extract attachments:                              │  │
│  │    - Logs: 2000 lines → 150 relevant lines          │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                   CLARIFICATION LOOP                         │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ LLM: "I understand you want to:                      │  │
│  │      Fix authentication system crash and add tests   │  │
│  │                                                       │  │
│  │ Key points:                                          │  │
│  │   1. Users reporting auth issues                     │  │
│  │   2. System crashes (logs provided)                  │  │
│  │   3. Need test coverage                              │  │
│  │                                                       │  │
│  │ Is this correct? (y/n)"                              │  │
│  └──────────────────────────────────────────────────────┘  │
│                              ↓                               │
│                        User: "Yes"                           │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                     GOAL PROPOSAL                            │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ LLM: "🎯 Proposed Goal:                              │  │
│  │      Fix and test authentication system              │  │
│  │                                                       │  │
│  │ Milestones:                                          │  │
│  │   1. Analyze crash logs                              │  │
│  │   2. Identify root cause                             │  │
│  │   3. Implement fix                                   │  │
│  │   4. Add test coverage                               │  │
│  │   5. Verify with user                                │  │
│  │                                                       │  │
│  │ Shall I proceed? (y/n)"                              │  │
│  └──────────────────────────────────────────────────────┘  │
│                              ↓                               │
│                        User: "Yes"                           │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                  INTENT SNAPSHOT CREATED                     │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Snapshot ID: intent-snapshot-abc123                  │  │
│  │ Timestamp: 2026-01-27T12:00:00Z                      │  │
│  │                                                       │  │
│  │ Original: [3000 tokens]                              │  │
│  │ Extracted: [100 tokens]                              │  │
│  │ Compression: 97% (3000 → 100)                        │  │
│  │                                                       │  │
│  │ Goal: Fix and test auth system                       │  │
│  │ Milestones: 5                                        │  │
│  │ Typos fixed: 47                                      │  │
│  │                                                       │  │
│  │ Storage:                                             │  │
│  │   - Active context: 100 tokens ✅                    │  │
│  │   - Session file: 3000 tokens ✅                     │  │
│  │   - Intent snapshot: Complete ✅                     │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                    PROACTIVE MODE                            │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ LLM tracks milestones:                               │  │
│  │   ✅ Milestone 1: Analyze logs (COMPLETED)          │  │
│  │   ⏳ Milestone 2: Identify root cause (CURRENT)     │  │
│  │   ⏳ Milestone 3: Implement fix                     │  │
│  │   ⏳ Milestone 4: Add tests                         │  │
│  │   ⏳ Milestone 5: Verify                            │  │
│  │                                                       │  │
│  │ LLM suggests: "I found the root cause in the JWT    │  │
│  │ validation. Shall I implement the fix?"              │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## Implementation

### 1. InputPreprocessor Service

```typescript
// packages/core/src/services/inputPreprocessor.ts

interface IntentExtraction {
  intent: string;              // Clean 1-sentence intent
  keyPoints: string[];         // 3-5 bullet points
  typosFixed: number;          // Count of typos corrected
  attachments: Attachment[];   // Extracted logs, code, etc.
  originalTokens: number;      // Original message size
  extractedTokens: number;     // Extracted intent size
  compressionRatio: number;    // extractedTokens / originalTokens
}

interface Attachment {
  type: 'logs' | 'code' | 'error' | 'other';
  content: string;
  originalSize: number;
  extractedSize: number;
}

class InputPreprocessor {
  private readonly LONG_MESSAGE_THRESHOLD = 500; // tokens
  
  constructor(
    private tokenCounter: TokenCounter,
    private llmProvider: ProviderAdapter
  ) {}
  
  /**
   * Check if message should be preprocessed
   */
  async shouldPreprocess(message: string): Promise<boolean> {
    const tokenCount = await this.tokenCounter.countTokens(message);
    return tokenCount > this.LONG_MESSAGE_THRESHOLD;
  }
  
  /**
   * Extract intent from noisy message
   */
  async extractIntent(message: string): Promise<IntentExtraction> {
    const originalTokens = await this.tokenCounter.countTokens(message);
    
    const prompt = `Extract the key intent from this message. Fix typos, remove filler words, identify attachments.

Message:
${message}

Respond in JSON format:
{
  "intent": "One clear sentence describing what user wants",
  "keyPoints": ["Point 1", "Point 2", "Point 3"],
  "typosFixed": 0,
  "attachments": [
    {
      "type": "logs",
      "content": "Extracted relevant lines only",
      "originalSize": 2000,
      "extractedSize": 150
    }
  ]
}`;
    
    const response = await this.llmProvider.complete(prompt);
    const extraction = JSON.parse(response);
    
    const extractedTokens = await this.tokenCounter.countTokens(extraction.intent);
    
    return {
      ...extraction,
      originalTokens,
      extractedTokens,
      compressionRatio: extractedTokens / originalTokens
    };
  }
  
  /**
   * Propose goal with milestones
   */
  async proposeGoal(extraction: IntentExtraction): Promise<Goal> {
    const prompt = `Based on this intent, create a goal with 3-5 milestones.

Intent: ${extraction.intent}

Key points:
${extraction.keyPoints.map((p, i) => `${i + 1}. ${p}`).join('\n')}

Respond in JSON format:
{
  "description": "Goal description",
  "milestones": [
    "Milestone 1",
    "Milestone 2",
    "Milestone 3"
  ]
}`;
    
    const response = await this.llmProvider.complete(prompt);
    return JSON.parse(response);
  }
}
```

### 2. IntentSnapshotManager

```typescript
// packages/core/src/context/intentSnapshotManager.ts

interface IntentSnapshot {
  id: string;
  timestamp: Date;
  sessionId: string;
  
  // Original message
  original: {
    content: string;
    tokens: number;
  };
  
  // Extracted intent
  extracted: {
    intent: string;
    keyPoints: string[];
    typosFixed: number;
    attachments: Attachment[];
    tokens: number;
  };
  
  // Proposed goal
  goal: {
    description: string;
    milestones: string[];
  };
  
  // Metadata
  compressionRatio: number;
  confirmed: boolean;
}

class IntentSnapshotManager {
  private storagePath: string;
  
  constructor(storagePath: string = '~/.ollm/intent-snapshots') {
    this.storagePath = storagePath;
  }
  
  async createSnapshot(
    sessionId: string,
    original: string,
    extraction: IntentExtraction,
    goal: Goal
  ): Promise<IntentSnapshot> {
    const snapshot: IntentSnapshot = {
      id: `intent-${Date.now()}`,
      timestamp: new Date(),
      sessionId,
      original: {
        content: original,
        tokens: extraction.originalTokens
      },
      extracted: {
        intent: extraction.intent,
        keyPoints: extraction.keyPoints,
        typosFixed: extraction.typosFixed,
        attachments: extraction.attachments,
        tokens: extraction.extractedTokens
      },
      goal: {
        description: goal.description,
        milestones: goal.milestones
      },
      compressionRatio: extraction.compressionRatio,
      confirmed: false
    };
    
    await this.save(snapshot);
    return snapshot;
  }
  
  async save(snapshot: IntentSnapshot): Promise<void> {
    const path = join(this.storagePath, snapshot.sessionId, `${snapshot.id}.json`);
    await fs.mkdir(dirname(path), { recursive: true });
    await fs.writeFile(path, JSON.stringify(snapshot, null, 2));
  }
  
  async load(snapshotId: string, sessionId: string): Promise<IntentSnapshot> {
    const path = join(this.storagePath, sessionId, `${snapshotId}.json`);
    const content = await fs.readFile(path, 'utf-8');
    return JSON.parse(content);
  }
  
  async list(sessionId: string): Promise<IntentSnapshot[]> {
    const path = join(this.storagePath, sessionId);
    const files = await fs.readdir(path);
    
    const snapshots: IntentSnapshot[] = [];
    for (const file of files) {
      if (file.endsWith('.json')) {
        const content = await fs.readFile(join(path, file), 'utf-8');
        snapshots.push(JSON.parse(content));
      }
    }
    
    return snapshots.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }
}
```

### 3. Integration with chatClient.ts

```typescript
// packages/core/src/core/chatClient.ts

async *chat(prompt: string, options?: ChatOptions): AsyncIterable<ChatEvent> {
  // NEW: Check if preprocessing needed
  if (await this.inputPreprocessor.shouldPreprocess(prompt)) {
    // Extract intent
    yield { type: 'preprocessing_started' };
    
    const extraction = await this.inputPreprocessor.extractIntent(prompt);
    
    // Clarification loop
    yield {
      type: 'clarification_request',
      intent: extraction.intent,
      keyPoints: extraction.keyPoints,
      typosFixed: extraction.typosFixed
    };
    
    const clarified = await this.waitForUserConfirmation();
    
    if (!clarified) {
      // User rejected, ask for correction
      yield { type: 'clarification_rejected' };
      return;
    }
    
    // Propose goal
    const goal = await this.inputPreprocessor.proposeGoal(extraction);
    
    yield {
      type: 'goal_proposal',
      goal: goal
    };
    
    const goalConfirmed = await this.waitForUserConfirmation();
    
    if (!goalConfirmed) {
      // User rejected goal, proceed without goal
      yield { type: 'goal_rejected' };
    }
    
    // Create intent snapshot
    const snapshot = await this.intentSnapshotManager.createSnapshot(
      sessionId,
      prompt,
      extraction,
      goal
    );
    
    yield {
      type: 'intent_snapshot_created',
      snapshot: snapshot
    };
    
    // Store extracted intent in active context (NOT original)
    await this.contextMgmtManager.addMessage({
      id: `user-${Date.now()}`,
      role: 'user',
      content: extraction.intent, // Clean intent, not rambling
      timestamp: new Date(),
      metadata: {
        preprocessed: true,
        intentSnapshotId: snapshot.id,
        originalTokens: extraction.originalTokens,
        extractedTokens: extraction.extractedTokens,
        compressionRatio: extraction.compressionRatio
      }
    });
    
    // Store original in session file (for RAG/memory)
    if (this.recordingService) {
      await this.recordingService.recordMessage(sessionId, {
        role: 'user',
        parts: [{ type: 'text', text: prompt }], // Original
        timestamp: new Date().toISOString(),
        metadata: {
          preprocessed: true,
          intentSnapshotId: snapshot.id,
          extractedIntent: extraction.intent
        }
      });
    }
    
    // Create goal if confirmed
    if (goalConfirmed && this.goalManager) {
      await this.goalManager.createGoal(goal.description, 'high');
      for (const milestone of goal.milestones) {
        await this.goalManager.createCheckpoint(
          this.goalManager.getActiveGoal()!.id,
          milestone,
          {},
          milestone
        );
      }
    }
    
    yield { type: 'preprocessing_complete' };
  } else {
    // Normal flow for short messages
    await this.contextMgmtManager.addMessage({
      id: `user-${Date.now()}`,
      role: 'user',
      content: prompt,
      timestamp: new Date()
    });
    
    if (this.recordingService) {
      await this.recordingService.recordMessage(sessionId, {
        role: 'user',
        parts: [{ type: 'text', text: prompt }],
        timestamp: new Date().toISOString()
      });
    }
  }
  
  // Continue with normal chat flow...
}
```

---

## UI Components

### ClarificationPrompt

```tsx
// packages/cli/src/ui/components/chat/ClarificationPrompt.tsx

export function ClarificationPrompt({
  intent,
  keyPoints,
  typosFixed,
  onConfirm,
  onReject
}: ClarificationPromptProps) {
  return (
    <Box flexDirection="column" borderStyle="round" borderColor="cyan" padding={1}>
      <Text bold color="cyan">🤔 Let me clarify what you want:</Text>
      
      <Box marginTop={1}>
        <Text bold>Intent:</Text>
        <Text>{intent}</Text>
      </Box>
      
      <Box marginTop={1}>
        <Text bold>Key points:</Text>
        {keyPoints.map((point, i) => (
          <Text key={i}>  {i + 1}. {point}</Text>
        ))}
      </Box>
      
      {typosFixed > 0 && (
        <Box marginTop={1}>
          <Text dimColor>✓ Fixed {typosFixed} typos</Text>
        </Box>
      )}
      
      <Box marginTop={1}>
        <Text dimColor>Is this correct? (y/n)</Text>
      </Box>
    </Box>
  );
}
```

### GoalProposal

```tsx
// packages/cli/src/ui/components/goals/GoalProposal.tsx

export function GoalProposal({
  goal,
  onConfirm,
  onReject
}: GoalProposalProps) {
  return (
    <Box flexDirection="column" borderStyle="round" borderColor="green" padding={1}>
      <Text bold color="green">🎯 Proposed Goal:</Text>
      <Text>{goal.description}</Text>
      
      <Box marginTop={1}>
        <Text bold>Milestones:</Text>
        {goal.milestones.map((milestone, i) => (
          <Text key={i}>  {i + 1}. {milestone}</Text>
        ))}
      </Box>
      
      <Box marginTop={1}>
        <Text dimColor>Shall I proceed with this plan? (y/n)</Text>
      </Box>
    </Box>
  );
}
```

---

## Storage

### Active Context
```
User: "Fix authentication system crash and add test coverage"
[100 tokens - clean signal]
```

### Session File
```json
{
  "role": "user",
  "content": "[original 3000 tokens with typos, rambling, logs]",
  "timestamp": "2026-01-27T12:00:00Z",
  "metadata": {
    "preprocessed": true,
    "intentSnapshotId": "intent-snapshot-abc123",
    "extractedIntent": "Fix authentication system crash and add test coverage",
    "typosFixed": 47,
    "originalTokens": 3000,
    "extractedTokens": 100,
    "compressionRatio": 0.033
  }
}
```

### Intent Snapshot
```json
{
  "id": "intent-snapshot-abc123",
  "timestamp": "2026-01-27T12:00:00Z",
  "sessionId": "session-123",
  "original": {
    "content": "[3000 tokens]",
    "tokens": 3000
  },
  "extracted": {
    "intent": "Fix authentication system crash and add test coverage",
    "keyPoints": [
      "Users reporting auth system issues",
      "System crashes (logs provided)",
      "Need test coverage"
    ],
    "typosFixed": 47,
    "attachments": [
      {
        "type": "logs",
        "content": "[150 relevant log lines]",
        "originalSize": 2000,
        "extractedSize": 150
      }
    ],
    "tokens": 100
  },
  "goal": {
    "description": "Fix and test authentication system",
    "milestones": [
      "Analyze crash logs",
      "Identify root cause",
      "Implement fix",
      "Add test coverage",
      "Verify with user"
    ]
  },
  "compressionRatio": 0.033,
  "confirmed": true
}
```

---

## Benefits

### Token Efficiency
- **Before:** 3000 tokens of garbage in active context
- **After:** 100 tokens of clean signal in active context
- **Savings:** 97% reduction (30x improvement)

### Clarity
- **Before:** LLM confused by noise
- **After:** LLM understands clear intent

### Goal-Driven
- **Before:** Reactive conversation
- **After:** Proactive with milestones

### Future Integration
- **RAG:** Intent snapshots searchable
- **Memory:** LLM recalls past intents
- **Analytics:** Track intent patterns

---

## Configuration

```yaml
# ~/.ollm/config.yaml
inputPreprocessing:
  enabled: true
  threshold: 500  # tokens
  typoCorrection: true
  clarificationLoop: true
  goalProposal: true
  intentSnapshots: true
  snapshotPath: ~/.ollm/intent-snapshots
```

---

## Events

- `preprocessing_started` - Preprocessing triggered
- `clarification_request` - Asking user to confirm intent
- `clarification_confirmed` - User confirmed intent
- `clarification_rejected` - User rejected intent
- `goal_proposal` - Proposing goal with milestones
- `goal_confirmed` - User confirmed goal
- `goal_rejected` - User rejected goal
- `intent_snapshot_created` - Intent snapshot saved
- `preprocessing_complete` - Preprocessing finished

---

## Testing

### Unit Tests
- Intent extraction accuracy
- Typo correction
- Attachment detection
- Goal proposal generation

### Integration Tests
- Full preprocessing flow
- Clarification loop
- Goal creation
- Storage verification

### Manual Tests
- Long message with typos
- Message with logs
- Message with code
- Unclear intent

---

**Note:** This is a design document. Implementation is pending approval and will be tracked in `.dev/backlog/sessions_todo.md` as Phase 0.
