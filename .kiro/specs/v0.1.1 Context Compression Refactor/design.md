# Context Compression System Refactor - Design Document

**Feature Name:** context-compression-refactor  
**Created:** January 28, 2026  
**Status:** Draft  
**Related:** requirements.md

---

## Design Overview

This document details the technical design for the complete rewrite of the context compression system. All legacy code will be backed up and replaced with new implementations.

---

## Architecture Principles

### 1. Clean Slate Approach

- **No legacy code reuse** in core compression logic
- **New file names** to avoid confusion
- **Clear separation** of concerns
- **Type-safe** interfaces throughout
- **Test-driven** development

### 2. Storage Layer Separation

Three distinct storage layers with **runtime enforcement**:

1. **Active Context** - What goes to LLLM (compressed, in memory)
2. **Snapshots** - Recovery/rollback (on disk, never sent to LLM)
3. **Session History** - Full conversation (on disk, never sent to LLM)

### 3. Compression Pipeline

Six-stage pipeline with **clear responsibilities**:

1. **Identification** - Which messages to compress
2. **Preparation** - Format for LLM
3. **Summarization** - LLM creates summary
4. **Checkpoint Creation** - Store summary
5. **Context Update** - Replace old with summary
6. **Validation** - Verify result fits

### 4. System Integration

**Integration with existing systems** (CRITICAL):

1. **Tier System** - Respect tier-specific prompt budgets (200-1500 tokens)
2. **Mode System** - Mode-aware compression strategies
3. **Model Management** - Model size affects compression quality
4. **Provider System** - Use provider-specific context limits
5. **Goal System** - Goals NEVER compressed, guide summarization
6. **Prompt Orchestrator** - System prompt built by orchestrator

---

## System Integration Design

### Integration 1: Tier System

**Purpose:** Respect tier-specific prompt budgets during compression

**Design:**

```typescript
interface TierIntegration {
  // Get tier-specific prompt budget
  getPromptBudget(tier: ContextTier): number;

  // Calculate available space for checkpoints
  calculateCheckpointBudget(tier: ContextTier, systemPromptTokens: number): number;

  // Determine if compression needed based on tier
  shouldCompress(tier: ContextTier, currentTokens: number): boolean;
}

class TierAwareCompression {
  private tierBudgets = {
    TIER_1_MINIMAL: 200,
    TIER_2_BASIC: 500,
    TIER_3_STANDARD: 1000,
    TIER_4_PREMIUM: 1500,
    TIER_5_ULTRA: 1500,
  };

  getPromptBudget(tier: ContextTier): number {
    return this.tierBudgets[tier];
  }

  calculateCheckpointBudget(tier: ContextTier, systemPromptTokens: number): number {
    const totalBudget = this.getPromptBudget(tier);
    const checkpointBudget = totalBudget - systemPromptTokens;
    return Math.max(0, checkpointBudget);
  }

  shouldCompress(tier: ContextTier, currentTokens: number, ollamaLimit: number): boolean {
    const promptBudget = this.getPromptBudget(tier);
    const availableForMessages = ollamaLimit - promptBudget - 1000; // 1000 token safety margin
    return currentTokens > availableForMessages * 0.75; // Trigger at 75%
  }
}
```

**Integration Points:**

- `ActiveContextManager` - Respects tier budgets
- `CompressionPipeline` - Tier-aware compression triggers
- `ValidationService` - Validates against tier limits

**References:**

- `dev_PromptSystem.md` - Tier token budgets
- `dev_ContextManagement.md` - Tier detection

---

### Integration 2: Mode System

**Purpose:** Mode-aware compression strategies

**Design:**

```typescript
interface ModeIntegration {
  // Get mode-specific summarization prompt
  getSummarizationPrompt(mode: OperationalMode, level: 1 | 2 | 3): string;

  // Determine what to preserve based on mode
  getPreservationStrategy(mode: OperationalMode): PreservationStrategy;
}

class ModeAwareCompression {
  getSummarizationPrompt(mode: OperationalMode, level: 1 | 2 | 3): string {
    const basePrompt = this.getBasePrompt(level);

    switch (mode) {
      case 'DEVELOPER':
        return `${basePrompt}\n\nFocus on preserving:\n- Code snippets and file paths\n- Technical decisions\n- Error messages and debugging context\n- Implementation details`;

      case 'PLANNING':
        return `${basePrompt}\n\nFocus on preserving:\n- Goals and objectives\n- Architectural decisions\n- Trade-offs discussed\n- Next steps planned`;

      case 'DEBUGGER':
        return `${basePrompt}\n\nFocus on preserving:\n- Error symptoms and stack traces\n- Debugging steps taken\n- Root cause analysis\n- Solutions attempted`;

      case 'ASSISTANT':
      default:
        return `${basePrompt}\n\nFocus on preserving:\n- Key decisions made\n- Important context\n- User preferences\n- Conversation flow`;
    }
  }

  getPreservationStrategy(mode: OperationalMode): PreservationStrategy {
    return {
      preserveCode: mode === 'DEVELOPER' || mode === 'DEBUGGER',
      preserveGoals: mode === 'PLANNING',
      preserveErrors: mode === 'DEBUGGER',
      preserveDecisions: true, // Always preserve
    };
  }
}
```

**Integration Points:**

- `SummarizationService` - Mode-specific prompts
- `CompressionPipeline` - Mode-aware preservation

**References:**

- `dev_PromptSystem.md` - Operational modes

---

### Integration 3: Model Management

**Purpose:** Model size affects compression quality and reliability

**Design:**

```typescript
interface ModelIntegration {
  // Get model size for reliability calculation
  getModelSize(modelId: string): number;

  // Calculate compression reliability based on model
  calculateReliability(modelSize: number, compressionCount: number): number;

  // Determine warning thresholds based on model
  getWarningThreshold(modelSize: number): number;
}

class ModelAwareCompression {
  getModelSize(modelId: string): number {
    // Extract from model name (e.g., "llama3:7b" → 7)
    const match = modelId.match(/(\d+)b/i);
    return match ? parseInt(match[1]) : 7; // Default to 7B
  }

  calculateReliability(modelSize: number, compressionCount: number): number {
    // From dev_ContextCompression.md
    const modelFactor =
      modelSize >= 70
        ? 0.95
        : modelSize >= 30
          ? 0.85
          : modelSize >= 13
            ? 0.7
            : modelSize >= 7
              ? 0.5
              : 0.3; // 3B and below

    const compressionPenalty = Math.pow(0.9, compressionCount);
    return modelFactor * compressionPenalty;
  }

  getWarningThreshold(modelSize: number): number {
    // Smaller models need earlier warnings
    if (modelSize <= 3) return 3; // Warn after 3 compressions
    if (modelSize <= 7) return 5; // Warn after 5 compressions
    if (modelSize <= 13) return 7; // Warn after 7 compressions
    return 10; // Larger models can handle more
  }
}
```

**Integration Points:**

- `CheckpointLifecycle` - Reliability scoring
- `CompressionPipeline` - Warning thresholds
- `EmergencyActions` - Model-aware decisions

**References:**

- `dev_ModelManagement.md` - Model size detection
- `dev_ContextCompression.md` - Reliability scoring

---

### Integration 4: Provider System

**Purpose:** Use provider-specific context limits

**Design:**

```typescript
interface ProviderIntegration {
  // Get provider-specific context limit
  getContextLimit(modelId: string): number;

  // Get pre-calculated ollama_context_size (85% value)
  getOllamaContextSize(modelId: string, requestedSize: number): number;

  // Validate against provider limits
  validateAgainstProvider(tokens: number, modelId: string): ValidationResult;
}

class ProviderAwareCompression {
  private profileManager: ProfileManager;

  constructor(profileManager: ProfileManager) {
    this.profileManager = profileManager;
  }

  getContextLimit(modelId: string): number {
    const modelEntry = this.profileManager.getModelEntry(modelId);
    if (!modelEntry) {
      throw new Error(`Model not found: ${modelId}`);
    }

    // Get current context profile
    const profile = modelEntry.context_profiles.find(
      (p) => p.size === this.getCurrentContextSize()
    );

    return profile?.ollama_context_size || 6800; // Default to 8K * 0.85
  }

  getOllamaContextSize(modelId: string, requestedSize: number): number {
    const modelEntry = this.profileManager.getModelEntry(modelId);
    if (!modelEntry) {
      throw new Error(`Model not found: ${modelId}`);
    }

    // Find matching profile
    const profile = modelEntry.context_profiles.find((p) => p.size === requestedSize);

    if (!profile) {
      throw new Error(`No profile for size ${requestedSize}`);
    }

    // Return pre-calculated 85% value
    return profile.ollama_context_size;
  }

  validateAgainstProvider(tokens: number, modelId: string): ValidationResult {
    const limit = this.getContextLimit(modelId);
    const safetyMargin = 1000; // Reserve for response
    const effectiveLimit = limit - safetyMargin;

    if (tokens <= effectiveLimit) {
      return { valid: true, tokens, limit: effectiveLimit };
    }

    return {
      valid: false,
      tokens,
      limit: effectiveLimit,
      overage: tokens - effectiveLimit,
      message: `Context exceeds provider limit by ${tokens - effectiveLimit} tokens`,
    };
  }
}
```

**Integration Points:**

- `ActiveContextManager` - Provider limits
- `ValidationService` - Provider validation
- `CompressionPipeline` - Provider-aware triggers

**References:**

- `dev_ProviderSystem.md` - Provider integration
- `dev_ContextManagement.md` - Context sizing logic

---

### Integration 5: Goal System

**Purpose:** Goals NEVER compressed, guide summarization

**Design:**

```typescript
interface GoalIntegration {
  // Get active goal for summarization context
  getActiveGoal(): Goal | null;

  // Build goal-aware summarization prompt
  buildGoalAwarePrompt(messages: Message[], goal: Goal): string;

  // Parse goal markers from LLM output
  parseGoalMarkers(summary: string): GoalUpdate[];

  // Update goal based on markers
  updateGoal(goal: Goal, updates: GoalUpdate[]): Goal;
}

class GoalAwareCompression {
  private goalManager: GoalManager;

  constructor(goalManager: GoalManager) {
    this.goalManager = goalManager;
  }

  getActiveGoal(): Goal | null {
    return this.goalManager.getActiveGoal();
  }

  buildGoalAwarePrompt(messages: Message[], goal: Goal): string {
    return `
ACTIVE GOAL: ${goal.description}
Priority: ${goal.priority}
Status: ${goal.status}

Checkpoints:
${goal.checkpoints.map((cp) => `${cp.status === 'completed' ? '✅' : cp.status === 'in-progress' ? '🔄' : '⏳'} ${cp.description}`).join('\n')}

Key Decisions:
${goal.decisions.map((d) => `${d.locked ? '🔒' : '-'} ${d.description}`).join('\n')}

Summarize the following conversation, focusing on progress toward the goal:
${messages.map((m) => `${m.role}: ${m.content}`).join('\n\n')}

Preserve:
- Decisions made toward the goal
- Checkpoints completed
- Files created/modified
- Blockers encountered
- Next steps planned

Provide a concise summary that maintains essential information for continuing work on the goal.
    `.trim();
  }

  parseGoalMarkers(summary: string): GoalUpdate[] {
    const updates: GoalUpdate[] = [];
    const lines = summary.split('\n');

    for (const line of lines) {
      if (line.startsWith('[CHECKPOINT]')) {
        const match = line.match(/\[CHECKPOINT\] (.+) - (COMPLETED|IN-PROGRESS|PENDING)/);
        if (match) {
          updates.push({
            type: 'checkpoint',
            description: match[1],
            status: match[2].toLowerCase() as any,
          });
        }
      } else if (line.startsWith('[DECISION]')) {
        const match = line.match(/\[DECISION\] (.+) - (LOCKED)?/);
        if (match) {
          updates.push({
            type: 'decision',
            description: match[1],
            locked: !!match[2],
          });
        }
      } else if (line.startsWith('[ARTIFACT]')) {
        const match = line.match(/\[ARTIFACT\] (Created|Modified|Deleted) (.+)/);
        if (match) {
          updates.push({
            type: 'artifact',
            action: match[1].toLowerCase() as any,
            path: match[2],
          });
        }
      }
    }

    return updates;
  }

  updateGoal(goal: Goal, updates: GoalUpdate[]): Goal {
    const updatedGoal = { ...goal };

    for (const update of updates) {
      switch (update.type) {
        case 'checkpoint':
          const checkpoint = updatedGoal.checkpoints.find(
            (cp) => cp.description === update.description
          );
          if (checkpoint) {
            checkpoint.status = update.status;
            if (update.status === 'completed') {
              checkpoint.completedAt = new Date();
            }
          }
          break;

        case 'decision':
          updatedGoal.decisions.push({
            id: generateId(),
            description: update.description,
            rationale: '', // Extracted from summary
            locked: update.locked,
          });
          break;

        case 'artifact':
          updatedGoal.artifacts.push({
            type: 'file', // Infer from path
            path: update.path,
            action: update.action,
          });
          break;
      }
    }

    return updatedGoal;
  }
}
```

**Integration Points:**

- `SummarizationService` - Goal-aware prompts
- `CompressionPipeline` - Goal preservation
- `ActiveContextManager` - Goals never compressed

**References:**

- `dev_PromptSystem.md` - Goal management system

---

### Integration 6: Prompt Orchestrator

**Purpose:** System prompt built by PromptOrchestrator, not compression system

**Design:**

```typescript
interface PromptOrchestratorIntegration {
  // Get system prompt from orchestrator
  getSystemPrompt(): Message;

  // Update system prompt (triggers orchestrator rebuild)
  updateSystemPrompt(config: SystemPromptConfig): void;

  // Get token count for system prompt
  getSystemPromptTokens(): number;
}

class PromptOrchestratorIntegration {
  private promptOrchestrator: PromptOrchestrator;

  constructor(promptOrchestrator: PromptOrchestrator) {
    this.promptOrchestrator = promptOrchestrator;
  }

  getSystemPrompt(): Message {
    // System prompt built by PromptOrchestrator
    // Includes: tier prompt + mandates + goals + skills + sanity checks
    return this.promptOrchestrator.buildSystemPrompt();
  }

  updateSystemPrompt(config: SystemPromptConfig): void {
    // Trigger orchestrator to rebuild
    this.promptOrchestrator.updateSystemPrompt(config);
  }

  getSystemPromptTokens(): number {
    const systemPrompt = this.getSystemPrompt();
    return countTokens(systemPrompt);
  }
}
```

**Integration Points:**

- `ActiveContextManager` - Uses orchestrator for system prompt
- `CompressionPipeline` - Never compresses system prompt
- `ValidationService` - Includes system prompt in validation

**References:**

- `dev_PromptSystem.md` - PromptOrchestrator

---

## Component Design

### Component 1: Storage Types

**File:** `packages/core/src/context/types/storageTypes.ts`  
**Purpose:** Define interfaces for all storage layers  
**Lines:** ~200

#### Interfaces

```typescript
/**
 * Active context - what gets sent to LLM
 * MUST fit within Ollama's context limit
 */
export interface ActiveContext {
  systemPrompt: Message;
  checkpoints: CheckpointSummary[]; // LLM-generated summaries only
  recentMessages: Message[]; // Last N messages
  tokenCount: {
    system: number;
    checkpoints: number;
    recent: number;
    total: number;
  };
}

/**
 * Checkpoint summary - LLM-generated summary of old messages
 */
export interface CheckpointSummary {
  id: string;
  timestamp: number;
  summary: string; // LLM-generated summary
  originalMessageIds: string[]; // IDs of replaced messages
  tokenCount: number;
  compressionLevel: 1 | 2 | 3; // 1=compact, 2=moderate, 3=detailed
  compressionNumber: number; // For aging
  metadata: {
    model: string;
    createdAt: number;
    compressedAt?: number;
  };
}

/**
 * Snapshot data - for recovery and rollback
 * NEVER sent to LLM
 */
export interface SnapshotData {
  id: string;
  sessionId: string;
  timestamp: number;
  conversationState: {
    messages: Message[]; // Full messages at checkpoint
    checkpoints: CheckpointSummary[];
    goals?: Goal[];
    metadata: Record<string, unknown>;
  };
  purpose: 'recovery' | 'rollback' | 'emergency';
}

/**
 * Session history - complete uncompressed conversation
 * NEVER sent to LLM
 */
export interface SessionHistory {
  sessionId: string;
  messages: Message[]; // Complete uncompressed history
  checkpointRecords: CheckpointRecord[];
  metadata: {
    startTime: number;
    lastUpdate: number;
    totalMessages: number;
    totalTokens: number;
    compressionCount: number;
  };
}

/**
 * Checkpoint record - metadata about checkpoint creation
 */
export interface CheckpointRecord {
  id: string;
  timestamp: number;
  messageRange: [number, number]; // Start and end message indices
  originalTokens: number;
  compressedTokens: number;
  compressionRatio: number;
  level: 1 | 2 | 3;
}

/**
 * Storage boundaries - prevent cross-contamination
 */
export interface StorageBoundaries {
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

#### Type Guards

```typescript
export function isActiveContext(data: unknown): data is ActiveContext {
  return (
    typeof data === 'object' &&
    data !== null &&
    'systemPrompt' in data &&
    'checkpoints' in data &&
    'recentMessages' in data &&
    'tokenCount' in data
  );
}

export function isSnapshotData(data: unknown): data is SnapshotData {
  return (
    typeof data === 'object' &&
    data !== null &&
    'conversationState' in data &&
    'purpose' in data &&
    ['recovery', 'rollback', 'emergency'].includes((data as any).purpose)
  );
}

export function isSessionHistory(data: unknown): data is SessionHistory {
  return (
    typeof data === 'object' &&
    data !== null &&
    'sessionId' in data &&
    'messages' in data &&
    'checkpointRecords' in data
  );
}
```

---

### Component 2: Active Context Manager

**File:** `packages/core/src/context/storage/activeContextManager.ts`  
**Purpose:** Manage what gets sent to LLM  
**Lines:** ~400

#### Class Structure

```typescript
export class ActiveContextManager {
  private context: ActiveContext;
  private ollamaLimit: number;
  private safetyMargin: number = 1000; // Reserve for response

  constructor(systemPrompt: Message, ollamaLimit: number) {
    this.ollamaLimit = ollamaLimit;
    this.context = {
      systemPrompt,
      checkpoints: [],
      recentMessages: [],
      tokenCount: {
        system: countTokens(systemPrompt),
        checkpoints: 0,
        recent: 0,
        total: countTokens(systemPrompt),
      },
    };
  }

  /**
   * Build prompt for LLM
   * ONLY includes active context
   */
  buildPrompt(newMessage?: Message): Message[] {
    const prompt: Message[] = [
      this.context.systemPrompt,
      ...this.context.checkpoints.map((cp) => ({
        role: 'assistant' as const,
        content: cp.summary,
        id: cp.id,
        timestamp: cp.timestamp,
      })),
      ...this.context.recentMessages,
    ];

    if (newMessage) {
      prompt.push(newMessage);
    }

    return prompt;
  }

  /**
   * Add message to active context
   * Validates size before adding
   */
  addMessage(message: Message): void {
    const messageTokens = countTokens(message);
    const newTotal = this.context.tokenCount.total + messageTokens;

    if (newTotal > this.ollamaLimit - this.safetyMargin) {
      throw new Error(
        `Cannot add message: would exceed limit (${newTotal} > ${this.ollamaLimit - this.safetyMargin})`
      );
    }

    this.context.recentMessages.push(message);
    this.context.tokenCount.recent += messageTokens;
    this.context.tokenCount.total += messageTokens;
  }

  /**
   * Add checkpoint summary
   * Replaces old messages with summary
   */
  addCheckpoint(checkpoint: CheckpointSummary): void {
    this.context.checkpoints.push(checkpoint);
    this.context.tokenCount.checkpoints += checkpoint.tokenCount;
    this.context.tokenCount.total += checkpoint.tokenCount;
  }

  /**
   * Remove old messages that were compressed
   */
  removeMessages(messageIds: string[]): void {
    const idsSet = new Set(messageIds);
    const removed = this.context.recentMessages.filter((m) => idsSet.has(m.id));
    const removedTokens = removed.reduce((sum, m) => sum + countTokens(m), 0);

    this.context.recentMessages = this.context.recentMessages.filter((m) => !idsSet.has(m.id));

    this.context.tokenCount.recent -= removedTokens;
    this.context.tokenCount.total -= removedTokens;
  }

  /**
   * Get current token count
   */
  getTokenCount(): number {
    return this.context.tokenCount.total;
  }

  /**
   * Get available tokens
   */
  getAvailableTokens(): number {
    return this.ollamaLimit - this.safetyMargin - this.context.tokenCount.total;
  }

  /**
   * Validate context size
   */
  validate(): ValidationResult {
    const total = this.context.tokenCount.total;
    const limit = this.ollamaLimit - this.safetyMargin;

    if (total <= limit) {
      return { valid: true, tokens: total, limit };
    }

    return {
      valid: false,
      tokens: total,
      limit,
      overage: total - limit,
      message: `Context exceeds limit by ${total - limit} tokens`,
    };
  }

  /**
   * Get context state (for debugging)
   */
  getState(): ActiveContext {
    return { ...this.context };
  }
}
```

---

### Component 3: Snapshot Lifecycle

**File:** `packages/core/src/context/storage/snapshotLifecycle.ts`  
**Purpose:** Manage recovery snapshots  
**Lines:** ~500

#### Class Structure

```typescript
export class SnapshotLifecycle {
  private storage: SnapshotStorage;
  private sessionId: string;

  constructor(sessionId: string, storagePath: string) {
    this.sessionId = sessionId;
    this.storage = new SnapshotStorage(storagePath);
  }

  /**
   * Create snapshot from current conversation state
   * NEVER includes this in active context
   */
  async createSnapshot(
    messages: Message[],
    checkpoints: CheckpointSummary[],
    purpose: 'recovery' | 'rollback' | 'emergency'
  ): Promise<SnapshotData> {
    const snapshot: SnapshotData = {
      id: generateId(),
      sessionId: this.sessionId,
      timestamp: Date.now(),
      conversationState: {
        messages: [...messages], // Full copy
        checkpoints: [...checkpoints],
        metadata: {
          purpose,
          createdBy: 'SnapshotLifecycle',
        },
      },
      purpose,
    };

    await this.storage.save(snapshot);
    return snapshot;
  }

  /**
   * Restore snapshot to conversation state
   */
  async restoreSnapshot(snapshotId: string): Promise<{
    messages: Message[];
    checkpoints: CheckpointSummary[];
  }> {
    const snapshot = await this.storage.load(snapshotId);

    if (!snapshot) {
      throw new Error(`Snapshot not found: ${snapshotId}`);
    }

    return {
      messages: snapshot.conversationState.messages,
      checkpoints: snapshot.conversationState.checkpoints,
    };
  }

  /**
   * List all snapshots for session
   */
  async listSnapshots(): Promise<SnapshotData[]> {
    return await this.storage.listBySession(this.sessionId);
  }

  /**
   * Delete old snapshots (keep last N)
   */
  async cleanup(keepCount: number = 5): Promise<void> {
    const snapshots = await this.listSnapshots();
    const sorted = snapshots.sort((a, b) => b.timestamp - a.timestamp);
    const toDelete = sorted.slice(keepCount);

    for (const snapshot of toDelete) {
      await this.storage.delete(snapshot.id);
    }
  }
}
```

---

### Component 4: Session History Manager

**File:** `packages/core/src/context/storage/sessionHistoryManager.ts`  
**Purpose:** Store full uncompressed conversation  
**Lines:** ~300

#### Class Structure

```typescript
export class SessionHistoryManager {
  private history: SessionHistory;
  private storagePath: string;

  constructor(sessionId: string, storagePath: string) {
    this.storagePath = storagePath;
    this.history = {
      sessionId,
      messages: [],
      checkpointRecords: [],
      metadata: {
        startTime: Date.now(),
        lastUpdate: Date.now(),
        totalMessages: 0,
        totalTokens: 0,
        compressionCount: 0,
      },
    };
  }

  /**
   * Append message to history
   * NEVER compresses or removes messages
   */
  appendMessage(message: Message): void {
    this.history.messages.push(message);
    this.history.metadata.totalMessages++;
    this.history.metadata.totalTokens += countTokens(message);
    this.history.metadata.lastUpdate = Date.now();
  }

  /**
   * Record checkpoint creation
   */
  recordCheckpoint(record: CheckpointRecord): void {
    this.history.checkpointRecords.push(record);
    this.history.metadata.compressionCount++;
    this.history.metadata.lastUpdate = Date.now();
  }

  /**
   * Get full history
   */
  getHistory(): SessionHistory {
    return { ...this.history };
  }

  /**
   * Save history to disk
   */
  async save(): Promise<void> {
    const filePath = path.join(this.storagePath, `${this.history.sessionId}.json`);
    await fs.writeFile(filePath, JSON.stringify(this.history, null, 2));
  }

  /**
   * Load history from disk
   */
  async load(sessionId: string): Promise<SessionHistory> {
    const filePath = path.join(this.storagePath, `${sessionId}.json`);
    const data = await fs.readFile(filePath, 'utf-8');
    this.history = JSON.parse(data);
    return this.history;
  }

  /**
   * Export history to markdown
   */
  exportToMarkdown(): string {
    let md = `# Session ${this.history.sessionId}\n\n`;
    md += `**Started:** ${new Date(this.history.metadata.startTime).toISOString()}\n`;
    md += `**Messages:** ${this.history.metadata.totalMessages}\n`;
    md += `**Compressions:** ${this.history.metadata.compressionCount}\n\n`;

    for (const message of this.history.messages) {
      md += `## ${message.role} (${new Date(message.timestamp).toISOString()})\n\n`;
      md += `${message.content}\n\n`;
    }

    return md;
  }
}
```

---

### Component 5: Compression Pipeline

**File:** `packages/core/src/context/compression/compressionPipeline.ts`  
**Purpose:** Structured compression flow  
**Lines:** ~600

#### Class Structure

```typescript
export class CompressionPipeline {
  private summarizationService: SummarizationService;
  private validationService: ValidationService;
  private activeContext: ActiveContextManager;
  private sessionHistory: SessionHistoryManager;

  constructor(
    summarizationService: SummarizationService,
    validationService: ValidationService,
    activeContext: ActiveContextManager,
    sessionHistory: SessionHistoryManager
  ) {
    this.summarizationService = summarizationService;
    this.validationService = validationService;
    this.activeContext = activeContext;
    this.sessionHistory = sessionHistory;
  }

  /**
   * Execute full compression pipeline
   */
  async compress(goal?: Goal): Promise<CompressionResult> {
    // Stage 1: Identification
    const messagesToCompress = await this.identifyMessagesToCompress();

    if (messagesToCompress.length === 0) {
      return { success: false, reason: 'No messages to compress' };
    }

    // Stage 2: Preparation
    const prepared = await this.prepareForSummarization(messagesToCompress, goal);

    // Stage 3: Summarization
    const summary = await this.summarizationService.summarize(
      prepared.messages,
      prepared.level,
      goal
    );

    // Stage 4: Checkpoint Creation
    const checkpoint = await this.createCheckpoint(summary, messagesToCompress, prepared.level);

    // Stage 5: Context Update
    await this.updateActiveContext(checkpoint, messagesToCompress);

    // Stage 6: Validation
    const validation = await this.validationService.validate(this.activeContext.buildPrompt());

    if (!validation.valid) {
      throw new Error(`Compression failed validation: ${validation.message}`);
    }

    return {
      success: true,
      checkpoint,
      freedTokens: prepared.originalTokens - checkpoint.tokenCount,
      validation,
    };
  }

  /**
   * Stage 1: Identify messages to compress
   */
  private async identifyMessagesToCompress(): Promise<Message[]> {
    const state = this.activeContext.getState();
    const recentMessages = state.recentMessages;

    // Keep last 5 messages
    const keepCount = 5;
    if (recentMessages.length <= keepCount) {
      return [];
    }

    // Compress older messages (exclude user messages)
    const toCompress = recentMessages.slice(0, -keepCount).filter((m) => m.role === 'assistant');

    return toCompress;
  }

  /**
   * Stage 2: Prepare for summarization
   */
  private async prepareForSummarization(
    messages: Message[],
    goal?: Goal
  ): Promise<PreparedSummarization> {
    const originalTokens = messages.reduce((sum, m) => sum + countTokens(m), 0);

    // Determine compression level based on token count
    const level: 1 | 2 | 3 = originalTokens > 3000 ? 1 : originalTokens > 2000 ? 2 : 3;

    return {
      messages,
      level,
      originalTokens,
      goal,
    };
  }

  /**
   * Stage 4: Create checkpoint
   */
  private async createCheckpoint(
    summary: string,
    originalMessages: Message[],
    level: 1 | 2 | 3
  ): Promise<CheckpointSummary> {
    const checkpoint: CheckpointSummary = {
      id: generateId(),
      timestamp: Date.now(),
      summary,
      originalMessageIds: originalMessages.map((m) => m.id),
      tokenCount: countTokens(summary),
      compressionLevel: level,
      compressionNumber: this.sessionHistory.getHistory().metadata.compressionCount,
      metadata: {
        model: 'current-model', // TODO: Get from context
        createdAt: Date.now(),
      },
    };

    // Record in session history
    this.sessionHistory.recordCheckpoint({
      id: checkpoint.id,
      timestamp: checkpoint.timestamp,
      messageRange: [0, originalMessages.length], // TODO: Calculate actual range
      originalTokens: originalMessages.reduce((sum, m) => sum + countTokens(m), 0),
      compressedTokens: checkpoint.tokenCount,
      compressionRatio:
        checkpoint.tokenCount / originalMessages.reduce((sum, m) => sum + countTokens(m), 0),
      level,
    });

    return checkpoint;
  }

  /**
   * Stage 5: Update active context
   */
  private async updateActiveContext(
    checkpoint: CheckpointSummary,
    compressedMessages: Message[]
  ): Promise<void> {
    // Remove compressed messages
    this.activeContext.removeMessages(checkpoint.originalMessageIds);

    // Add checkpoint summary
    this.activeContext.addCheckpoint(checkpoint);
  }
}
```

---

## Implementation Plan

### Phase 0: Backup (1 day)

1. Run backup script
2. Verify backup integrity
3. Commit backup to git
4. Create restoration script

### Phase 1: Foundation (2-3 days)

1. Create `storageTypes.ts`
2. Implement `activeContextManager.ts`
3. Implement `snapshotLifecycle.ts`
4. Implement `sessionHistoryManager.ts`
5. Implement `storageBoundaries.ts`
6. Write unit tests

### Phase 2: Compression (2-3 days)

1. Implement `compressionPipeline.ts`
2. Implement `summarizationService.ts`
3. Implement `validationService.ts`
4. Write unit tests
5. Write integration tests

### Phase 3: Lifecycle (2-3 days)

1. Implement `checkpointLifecycle.ts`
2. Implement `emergencyActions.ts`
3. Write unit tests
4. Write integration tests

### Phase 4: Orchestration (2-3 days)

1. Implement `contextOrchestrator.ts`
2. Wire up all components
3. Add feature flags
4. Write integration tests
5. Test long conversations (10+ checkpoints)

### Phase 5: Migration (1-2 days)

1. Create migration scripts
2. Test migration
3. Update documentation
4. Create release notes

---

## Testing Strategy

### Unit Tests

- Test each component in isolation
- Mock dependencies
- Test error cases
- Property-based tests for compression

### Integration Tests

- Test full compression pipeline
- Test long conversations (10+ checkpoints)
- Test checkpoint aging
- Test error recovery

### Performance Tests

- Compression time < 5 seconds
- Validation time < 100ms
- Memory usage reasonable

---

## Success Criteria

- [ ] All legacy files backed up
- [ ] All new files created
- [ ] All tests passing (>80% coverage)
- [ ] Long conversations work (10+ checkpoints)
- [ ] No crashes
- [ ] Documentation updated

---

**Status:** Draft - Ready for Implementation  
**Next Step:** Begin Phase 0 (Backup)
