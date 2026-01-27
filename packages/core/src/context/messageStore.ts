/**
 * MessageStore
 *
 * Owns message mutation, token accounting, and snapshot/compression triggers.
 */
import type {
  ContextConfig,
  ContextUsage,
  ConversationContext,
  Message,
  MemoryGuard,
  SnapshotManager,
  TokenCounter,
  ContextPool,
} from './types.js';

type EmitFn = (event: string, payload?: unknown) => void;

interface MessageStoreOptions {
  config: ContextConfig;
  getContext: () => ConversationContext;
  getUsage: () => ContextUsage;
  getBudget: () => import('./types.js').ContextBudget;
  tokenCounter: TokenCounter;
  contextPool: ContextPool;
  memoryGuard: MemoryGuard;
  snapshotManager: SnapshotManager;
  emit: EmitFn;
  compress: () => Promise<void>;
  isAutoSummaryRunning: () => boolean;
  createSnapshot: () => Promise<unknown>;
  isTestEnv: boolean;
}

export class MessageStore {
  private readonly config: ContextConfig;
  private readonly getContext: () => ConversationContext;
  private readonly getUsage: () => ContextUsage;
  private readonly getBudget: () => import('./types.js').ContextBudget;
  private readonly tokenCounter: TokenCounter;
  private readonly contextPool: ContextPool;
  private readonly memoryGuard: MemoryGuard;
  private readonly snapshotManager: SnapshotManager;
  private readonly emit: EmitFn;
  private compress: () => Promise<void>;
  private readonly isAutoSummaryRunning: () => boolean;
  private createSnapshot: () => Promise<unknown>;
  private readonly isTestEnv: boolean;

  private inflightTokens = 0;
  private lastSnapshotTokens = 0;
  private messagesSinceLastSnapshot = 0;

  constructor(options: MessageStoreOptions) {
    this.config = options.config;
    this.getContext = options.getContext;
    this.getUsage = options.getUsage;
    this.getBudget = options.getBudget;
    this.tokenCounter = options.tokenCounter;
    this.contextPool = options.contextPool;
    this.memoryGuard = options.memoryGuard;
    this.snapshotManager = options.snapshotManager;
    this.emit = options.emit;
    this.compress = options.compress;
    this.isAutoSummaryRunning = options.isAutoSummaryRunning;
    this.createSnapshot = options.createSnapshot;
    this.isTestEnv = options.isTestEnv;
  }

  /**
   * Add a message and update token accounting + thresholds.
   */
  async addMessage(message: Message): Promise<void> {
    const context = this.getContext();
    const tokenCount = this.tokenCounter.countTokensCached(
      message.id,
      message.content
    );
    message.tokenCount = tokenCount;

    try {
      if (!this.isTestEnv) {
        console.debug('[ContextManager] addMessage: tokenCount=', tokenCount, 'currentContext.tokenCount=', context.tokenCount, 'currentContext.maxTokens=', context.maxTokens);
      }
    } catch (_e) {
      // ignore logging errors
    }
    
    // ✅ VALIDATION: Ensure token count is valid
    if (tokenCount < 0) {
      console.error('[MessageStore] INVALID: Negative token count!', {
        messageId: message.id,
        tokenCount,
        contentLength: message.content.length
      });
      throw new Error(`Invalid token count for message ${message.id}: ${tokenCount}`);
    }

    if (!this.memoryGuard.canAllocate(tokenCount)) {
      await this.memoryGuard.checkMemoryLevelAndAct();

      if (!this.memoryGuard.canAllocate(tokenCount)) {
        const systemPrompt = context.messages.find(m => m.role === 'system');
        const nonSystemMessages = context.messages.filter(m => m.role !== 'system');

        while (nonSystemMessages.length > 0 && !this.memoryGuard.canAllocate(tokenCount)) {
          nonSystemMessages.shift();

          context.messages = [
            ...(systemPrompt ? [systemPrompt] : []),
            ...nonSystemMessages
          ];

          context.tokenCount = this.tokenCounter.countConversationTokens(
            context.messages
          );
          this.contextPool.setCurrentTokens(context.tokenCount);
        }

        if (!this.memoryGuard.canAllocate(tokenCount)) {
          throw new Error(
            'Cannot add message: would exceed memory safety limit even after truncation. ' +
            'The message itself might be too large for the current context window.'
          );
        }
      }
    }

    context.messages.push(message);
    const _previousTokenCount = context.tokenCount;
    context.tokenCount += tokenCount;
    this.contextPool.setCurrentTokens(context.tokenCount);
    
    // ✅ ASSERTION: Verify token count consistency (development only)
    if (this.isDevelopmentMode() && message.role === 'assistant') {
      const calculatedTotal = this.tokenCounter.countConversationTokens(context.messages);
      const drift = Math.abs(calculatedTotal - context.tokenCount);
      
      if (drift > 10) {
        console.warn('[MessageStore] TOKEN DRIFT DETECTED!', {
          tracked: context.tokenCount,
          calculated: calculatedTotal,
          drift,
          messageCount: context.messages.length,
          lastMessageTokens: tokenCount
        });
      }
    }
    
    // ⚠️ WARNING: Check if exceeding limit
    if (context.tokenCount > context.maxTokens) {
      console.warn('[MessageStore] OVERFLOW: Token count exceeds limit!', {
        current: context.tokenCount,
        max: context.maxTokens,
        overage: context.tokenCount - context.maxTokens,
        percentage: Math.round((context.tokenCount / context.maxTokens) * 100)
      });
    }

    if (message.role === 'user') {
      // Snapshot heuristics for user turns (usage-based and turn-based).
      const usage = this.getUsage();
      const usageFraction = usage.percentage / 100;

      const lastSnapTokens = this.lastSnapshotTokens || 0;
      const tokenDiff = Math.abs(context.tokenCount - lastSnapTokens);
      const significantChange = tokenDiff > (context.maxTokens * 0.02);

      this.messagesSinceLastSnapshot++;
      const turnBasedSnapshotNeeded = this.config.snapshots.enabled &&
                                      this.config.snapshots.autoCreate &&
                                      this.messagesSinceLastSnapshot >= 5;

      const safetySnapshotNeeded = usageFraction >= 0.85 && significantChange;

      if (safetySnapshotNeeded || turnBasedSnapshotNeeded) {
        const reason = safetySnapshotNeeded ? 'User Input > 85%' : 'Periodic Backup (5 turns)';
        console.log(`[ContextManager] Safety Snapshot Triggered (${reason}) - Pre-generation backup`);

        this.createSnapshot().catch(err =>
          console.error('[ContextManager] Snapshot failed:', err)
        );

        this.lastSnapshotTokens = context.tokenCount;
        this.messagesSinceLastSnapshot = 0;
      }
    }

    if (message.role === 'assistant') {
      // Post-assistant checks include threshold callbacks and compression.
      try {
        console.debug('[ContextManager] calling snapshotManager.checkThresholds', { currentTokens: context.tokenCount, maxTokens: context.maxTokens });
      } catch (_e) {
        // ignore logging errors
      }
      this.snapshotManager.checkThresholds(
        context.tokenCount + this.inflightTokens,
        context.maxTokens
      );

      if (this.config.compression.enabled) {
        // Get dynamic budget information from context manager
        const budget = this.getBudget();
        const budgetFraction = budget.budgetPercentage / 100;
        
        // Warn user when available budget is getting full (70-75% range)
        if (budgetFraction >= 0.70 && budgetFraction < 0.75) {
          this.emit('context-warning-low', {
            percentage: budget.budgetPercentage,
            currentTokens: budget.conversationTokens,
            availableBudget: budget.availableBudget,
            checkpointTokens: budget.checkpointTokens,
            message: 'Available budget is filling up - compression will trigger soon'
          });
        }
        
        // Trigger compression at threshold (80% of AVAILABLE BUDGET, not total)
        // This accounts for space used by system prompt and checkpoints
        if (budgetFraction >= this.config.compression.threshold) {
          console.log('[ContextManager] Compression triggered by budget threshold', {
            budgetPercentage: budget.budgetPercentage.toFixed(1) + '%',
            conversationTokens: budget.conversationTokens,
            availableBudget: budget.availableBudget,
            checkpointTokens: budget.checkpointTokens,
            systemPromptTokens: budget.systemPromptTokens,
            totalOllamaSize: budget.totalOllamaSize
          });
          await this.compress();
        }
      }
    }

    this.emit('message-added', { message, usage: this.getUsage() });
  }

  /**
   * Clear the conversation while preserving the system prompt.
   */
  clear(): void {
    const context = this.getContext();
    const systemPrompt = context.messages.find(
      m => m.role === 'system'
    );

    context.messages = systemPrompt ? [systemPrompt] : [];
    context.tokenCount = systemPrompt?.tokenCount || 0;

    this.contextPool.setCurrentTokens(context.tokenCount);
    this.tokenCounter.clearCache();

    this.emit('cleared');
  }

  /**
   * Track streaming tokens so thresholds can react mid-generation.
   * 
   * STRATEGY: Trust Ollama to stop at num_ctx limit, compress AFTER message completes.
   * SAFETY: Emergency brake if stream exceeds limit (prevents runaway streams).
   */
  reportInflightTokens(delta: number): void {
    try {
      const context = this.getContext();
      this.inflightTokens = Math.max(0, this.inflightTokens + delta);
      const totalTokens = context.tokenCount + this.inflightTokens;
      
      this.contextPool.setCurrentTokens(totalTokens);
      this.snapshotManager.checkThresholds(totalTokens, context.maxTokens);
      
      // EMERGENCY BRAKE: If streaming exceeds Ollama limit, emit warning
      // This should NEVER happen (Ollama stops at num_ctx), but protects against bugs
      const ollamaLimit = context.maxTokens; // This is the Ollama size (85%)
      if (totalTokens > ollamaLimit) {
        const overage = totalTokens - ollamaLimit;
        
        // Only log in non-test mode (tests intentionally trigger this)
        if (!this.isTestEnv) {
          console.error('[ContextManager] EMERGENCY: Stream exceeded Ollama limit!', {
            totalTokens,
            ollamaLimit,
            overage,
            message: 'This indicates a bug - Ollama should stop at num_ctx'
          });
        }
        
        // Emit emergency event for UI to display
        this.emit('stream-overflow-emergency', {
          totalTokens,
          ollamaLimit,
          overage
        });
      }
      
      // NO mid-stream compression - we compress AFTER addMessage() completes
      // This ensures we capture the full message before compressing
    } catch (e) {
      console.error('[ContextManager] reportInflightTokens failed', e);
    }
  }

  /**
   * Reset streaming token tracking after a generation finishes.
   */
  clearInflightTokens(): void {
    try {
      const context = this.getContext();
      this.inflightTokens = 0;
      this.contextPool.setCurrentTokens(context.tokenCount);
    } catch (e) {
      console.error('[ContextManager] clearInflightTokens failed', e);
    }
  }

  /**
   * Override the compression callback (used by external orchestrators).
   */
  setCompress(handler: () => Promise<void>): void {
    this.compress = handler;
  }

  /**
   * Override the snapshot callback (used by external orchestrators).
   */
  setCreateSnapshot(handler: () => Promise<unknown>): void {
    this.createSnapshot = handler;
  }

  /**
   * Reset snapshot counters after a restore or hard reset.
   */
  resetSnapshotTracking(): void {
    this.lastSnapshotTokens = 0;
    this.messagesSinceLastSnapshot = 0;
  }
  
  /**
   * Check if running in development mode
   */
  private isDevelopmentMode(): boolean {
    return process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test';
  }

  /**
   * Compute context usage ratio, optionally including streaming tokens.
   */
  private _getUsageFraction(includeInflight = false): number {
    const context = this.getContext();
    const totalTokens = context.maxTokens || 1;
    const currentTokens = context.tokenCount + (includeInflight ? this.inflightTokens : 0);
    return Math.min(1, Math.max(0, currentTokens / totalTokens));
  }
}
