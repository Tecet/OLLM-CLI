import { createLogger } from '../utils/logger.js';

const logger = createLogger('messageStore');
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
  private midStreamGuardActive = false;

  constructor(options: MessageStoreOptions) {
    this.config = options.config;
    this.getContext = options.getContext;
    this.getUsage = options.getUsage;
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
        logger.debug('[ContextManager] addMessage: tokenCount=', tokenCount, 'currentContext.tokenCount=', context.tokenCount, 'currentContext.maxTokens=', context.maxTokens);
      }
    } catch (_e) {
      // ignore logging errors
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
    context.tokenCount += tokenCount;
    this.contextPool.setCurrentTokens(context.tokenCount);

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
        logger.info(`[ContextManager] Safety Snapshot Triggered (${reason}) - Pre-generation backup`);

        this.createSnapshot().catch(err =>
          logger.error('[ContextManager] Snapshot failed:', err)
        );

        this.lastSnapshotTokens = context.tokenCount;
        this.messagesSinceLastSnapshot = 0;
      }
    }

    if (message.role === 'assistant') {
      // Post-assistant checks include threshold callbacks and compression.
      try {
        logger.debug('[ContextManager] calling snapshotManager.checkThresholds', { currentTokens: context.tokenCount, maxTokens: context.maxTokens });
      } catch (_e) {
        // ignore logging errors
      }
      this.snapshotManager.checkThresholds(
        context.tokenCount + this.inflightTokens,
        context.maxTokens
      );

      if (this.config.compression.enabled) {
        const usage = this.getUsage();
        const usageFraction = usage.percentage / 100;
        if (usageFraction >= this.config.compression.threshold) {
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
   */
  reportInflightTokens(delta: number): void {
    try {
      const context = this.getContext();
      this.inflightTokens = Math.max(0, this.inflightTokens + delta);
      this.contextPool.setCurrentTokens(context.tokenCount + this.inflightTokens);
      this.snapshotManager.checkThresholds(context.tokenCount + this.inflightTokens, context.maxTokens);
      this.ensureMidStreamGuard();
    } catch (e) {
      logger.error('[ContextManager] reportInflightTokens failed', e);
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
      logger.error('[ContextManager] clearInflightTokens failed', e);
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
   * Compute context usage ratio, optionally including streaming tokens.
   */
  private getUsageFraction(includeInflight = false): number {
    const context = this.getContext();
    const totalTokens = context.maxTokens || 1;
    const currentTokens = context.tokenCount + (includeInflight ? this.inflightTokens : 0);
    return Math.min(1, Math.max(0, currentTokens / totalTokens));
  }

  /**
   * Guard mid-stream overflow by triggering a compression once.
   */
  private ensureMidStreamGuard(): void {
    if (!this.config.compression.enabled) {
      return;
    }

    const fraction = this.getUsageFraction(true);
    if (fraction < this.config.compression.threshold) {
      return;
    }

    if (this.midStreamGuardActive || this.isAutoSummaryRunning()) {
      return;
    }

    this.midStreamGuardActive = true;
    const guardPromise = this.compress()
      .catch((error) => {
        logger.error('[ContextManager] mid-stream guard compression failed', error);
      })
      .finally(() => {
        this.midStreamGuardActive = false;
      });

    void guardPromise;
  }
}
