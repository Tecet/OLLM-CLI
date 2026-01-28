/**
 * CompressionCoordinator
 *
 * Centralizes all compression and checkpoint strategies so the manager can stay lean.
 */
import { MemoryLevel } from './types.js';

import type { CheckpointManager } from './checkpointManager.js';
import type {
  ContextConfig,
  ContextUsage,
  ConversationContext,
  ContextPool,
  ContextTier,
  ICompressionService,
  MemoryGuard,
  ModeProfile,
  SnapshotManager,
  SnapshotConfig,
  TokenCounter,
} from './types.js';

type EmitFn = (event: string, payload?: unknown) => void;

interface CompressionCoordinatorOptions {
  config: ContextConfig;
  getContext: () => ConversationContext;
  getUsage: () => ContextUsage;
  getTierConfig: () => { tier: ContextTier; strategy: string; maxCheckpoints: number };
  getModeProfile: () => ModeProfile;
  snapshotManager: SnapshotManager;
  compressionService: ICompressionService;
  tokenCounter: TokenCounter;
  contextPool: ContextPool;
  emit: EmitFn;
  checkpointManager: CheckpointManager;
  isTestEnv?: boolean;
}

export class CompressionCoordinator {
  private readonly config: ContextConfig;
  private readonly getContext: () => ConversationContext;
  private readonly getUsage: () => ContextUsage;
  private readonly getTierConfig: () => {
    tier: ContextTier;
    strategy: string;
    maxCheckpoints: number;
  };
  private readonly getModeProfile: () => ModeProfile;
  private readonly snapshotManager: SnapshotManager;
  private readonly compressionService: ICompressionService;
  private readonly tokenCounter: TokenCounter;
  private readonly contextPool: ContextPool;
  private readonly emit: EmitFn;
  private readonly checkpointManager: CheckpointManager;
  private readonly isTestEnv: boolean;

  private autoSummaryRunning = false;
  private lastAutoSummaryAt: number | null = null;
  private readonly autoSummaryCooldownMs = 60000;

  // Phase 2: Blocking Mechanism
  private summarizationInProgress = false;
  private summarizationLock: Promise<void> | null = null;
  private readonly summarizationTimeoutMs = 30000; // 30 seconds max

  constructor(options: CompressionCoordinatorOptions) {
    this.config = options.config;
    this.getContext = options.getContext;
    this.getUsage = options.getUsage;
    this.getTierConfig = options.getTierConfig;
    this.getModeProfile = options.getModeProfile;
    this.snapshotManager = options.snapshotManager;
    this.compressionService = options.compressionService;
    this.tokenCounter = options.tokenCounter;
    this.contextPool = options.contextPool;
    this.emit = options.emit;
    this.checkpointManager = options.checkpointManager;
    this.isTestEnv = options.isTestEnv ?? false;
  }

  isAutoSummaryRunning(): boolean {
    return this.autoSummaryRunning;
  }

  /**
   * Check if summarization is currently in progress (Phase 2: Blocking Mechanism)
   */
  isSummarizationInProgress(): boolean {
    return this.summarizationInProgress;
  }

  /**
   * Wait for any in-progress summarization to complete (Phase 2: Blocking Mechanism)
   * @param timeoutMs - Optional timeout in milliseconds (default: 30000)
   * @returns Promise that resolves when summarization completes or times out
   */
  async waitForSummarization(timeoutMs?: number): Promise<void> {
    if (!this.summarizationInProgress || !this.summarizationLock) {
      return;
    }

    const timeout = timeoutMs ?? this.summarizationTimeoutMs;

    // Create a timeout promise
    const timeoutPromise = new Promise<void>((resolve) => {
      setTimeout(() => {
        if (!this.isTestEnv) {
          console.warn('[CompressionCoordinator] Summarization timeout reached');
        }
        resolve();
      }, timeout);
    });

    // Race between summarization completion and timeout
    await Promise.race([this.summarizationLock, timeoutPromise]);
  }

  /**
   * Wire snapshot manager callbacks to auto-compression flow.
   */
  registerSnapshotHandlers(snapshotConfig: SnapshotConfig): void {
    if (snapshotConfig.autoCreate) {
      this.snapshotManager.onContextThreshold(snapshotConfig.autoThreshold, async () => {
        await this.handleAutoThreshold();
      });
    }

    this.snapshotManager.onBeforeOverflow(async () => {
      this.emit('pre-overflow', {
        usage: this.getUsage(),
        context: this.getContext(),
      });
    });
  }

  /**
   * Wire memory guard thresholds to compression and event emission.
   */
  registerMemoryGuard(memoryGuard: MemoryGuard): void {
    memoryGuard.onThreshold(MemoryLevel.WARNING, async () => {
      this.emit('memory-warning', { level: MemoryLevel.WARNING });

      if (this.config.compression.enabled) {
        await this.compress();
      }
    });

    memoryGuard.onThreshold(MemoryLevel.CRITICAL, async () => {
      this.emit('memory-critical', { level: MemoryLevel.CRITICAL });
    });

    memoryGuard.onThreshold(MemoryLevel.EMERGENCY, async () => {
      this.emit('memory-emergency', { level: MemoryLevel.EMERGENCY });
    });

    memoryGuard.on('emergency', (data) => {
      this.emit('emergency', data);
    });
  }

  /**
   * Tier 1 rollover - create a snapshot and keep an ultra-compact summary.
   */
  private async compressForTier1(): Promise<void> {
    console.log('[ContextManager] Tier 1 rollover compression triggered');

    const context = this.getContext();
    const baseSystemPrompt =
      context.systemPrompt ??
      context.messages.find((m) => m.id.startsWith('system-')) ??
      context.messages.find((m) => m.role === 'system');
    const userAssistantMessages = context.messages.filter(
      (m) => m.role === 'user' || m.role === 'assistant'
    );

    if (userAssistantMessages.length === 0) {
      context.messages = baseSystemPrompt ? [baseSystemPrompt] : [];
      const newTokenCount = this.tokenCounter.countConversationTokens(context.messages);
      context.tokenCount = newTokenCount;
      this.contextPool.setCurrentTokens(newTokenCount);
      this.emit('rollover-complete', {
        snapshot: null,
        summary: null,
        originalTokens: 0,
        compressedTokens: newTokenCount,
      });
      return;
    }

    let snapshot = null as Awaited<ReturnType<SnapshotManager['createSnapshot']>> | null;
    try {
      snapshot = await this.snapshotManager.createSnapshot(context);
      this.emit('rollover-snapshot-created', { snapshot });
      console.log('[ContextManager] Rollover snapshot created', { id: snapshot.id });
    } catch (error) {
      if (!this.isTestEnv)
        console.error('[ContextManager] Rollover snapshot creation failed', error);
      this.emit('snapshot-error', error);
    }

    const recentMessages = userAssistantMessages.slice(-10);
    const summaryContent = this.generateCompactSummary(recentMessages);

    const summaryMessage = {
      id: `rollover-summary-${Date.now()}`,
      role: 'system' as const,
      content: summaryContent,
      timestamp: new Date(),
    };

    const systemMessages = baseSystemPrompt ? [baseSystemPrompt] : [];
    context.messages = [...systemMessages, summaryMessage];

    const newTokenCount = this.tokenCounter.countConversationTokens(context.messages);
    context.tokenCount = newTokenCount;
    this.contextPool.setCurrentTokens(newTokenCount);

    context.metadata.compressionHistory.push({
      timestamp: new Date(),
      strategy: 'rollover',
      originalTokens: snapshot?.tokenCount || 0,
      compressedTokens: newTokenCount,
      ratio: snapshot ? newTokenCount / snapshot.tokenCount : 0,
    });

    this.emit('rollover-complete', {
      snapshot,
      summary: summaryMessage,
      originalTokens: snapshot?.tokenCount || 0,
      compressedTokens: newTokenCount,
    });
  }

  /**
   * Produce a small summary from the most recent exchange set.
   */
  private generateCompactSummary(messages: Array<{ role: string; content: string }>): string {
    const keyPoints = messages
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .slice(-10)
      .map((m) => `${m.role}: ${m.content.substring(0, 100)}...`)
      .join('\n');

    return `[Previous conversation summary - ${messages.length} messages]\n${keyPoints}`;
  }

  /**
   * Auto-threshold handler for snapshot + summarize flow.
   * Phase 2: Blocks user input during checkpoint creation
   */
  async handleAutoThreshold(): Promise<void> {
    const now = Date.now();
    if (this.autoSummaryRunning) {
      console.debug(
        '[ContextManager] autoThreshold reached but auto-summary already running; skipping'
      );
      return;
    }
    if (this.lastAutoSummaryAt && now - this.lastAutoSummaryAt < this.autoSummaryCooldownMs) {
      console.debug('[ContextManager] autoThreshold reached but within cooldown; skipping');
      return;
    }

    // Phase 2: Set blocking flags and emit block event
    this.autoSummaryRunning = true;
    this.summarizationInProgress = true;
    this.lastAutoSummaryAt = now;

    // Emit block-user-input event
    this.emit('block-user-input', {
      reason: 'checkpoint-creation',
      estimatedDuration: 'Creating checkpoint...',
    });

    // Create lock promise
    let resolveLock: (() => void) | undefined;
    this.summarizationLock = new Promise<void>((resolve) => {
      resolveLock = resolve;
    });

    try {
      const context = this.getContext();
      console.log(
        '[ContextManager] autoThreshold reached, starting snapshot and summarization checks',
        { usage: this.getUsage() }
      );
      this.emit('summarizing', { usage: this.getUsage() });

      const hasUserMessages = context.messages.some((m) => m.role === 'user');
      if (!hasUserMessages) {
        console.log('[ContextManager] No user messages, skipping snapshot/compression');
        return;
      }

      const checkpointIds = new Set((context.checkpoints || []).map((cp) => cp.summary.id));
      const compressibleMessages = context.messages.filter(
        (m) => m.role !== 'system' && !checkpointIds.has(m.id)
      );

      const MIN_MESSAGES_TO_COMPRESS = 10;
      if (compressibleMessages.length < MIN_MESSAGES_TO_COMPRESS) {
        console.log('[ContextManager] Not enough compressible messages, skipping compression', {
          compressible: compressibleMessages.length,
          minimum: MIN_MESSAGES_TO_COMPRESS,
          total: context.messages.length,
          checkpoints: context.checkpoints?.length || 0,
        });
        return;
      }

      let snapshot = null as Awaited<ReturnType<SnapshotManager['createSnapshot']>> | null;
      try {
        snapshot = await this.snapshotManager.createSnapshot(context);
        this.emit('auto-snapshot-created', snapshot);
        console.log('[ContextManager] auto-snapshot-created', {
          id: snapshot.id,
          tokenCount: snapshot.tokenCount,
        });
      } catch (error) {
        console.error('[ContextManager] snapshot creation failed', error);
        this.emit('snapshot-error', error);
      }

      try {
        const strategy: import('./types.js').CompressionStrategy = {
          type: 'summarize',
          preserveRecent: this.config.compression.preserveRecent,
          summaryMaxTokens: this.config.compression.summaryMaxTokens,
        };

        console.log('[ContextManager] invoking compressionService.compress', { strategy });
        const compressed = await this.compressionService.compress(context.messages, strategy);
        console.log('[ContextManager] compressionService.compress completed', {
          originalTokens: compressed.originalTokens,
          compressedTokens: compressed.compressedTokens,
          status: compressed.status,
        });

        if (compressed.status === 'inflated') {
          console.log('[ContextManager] Compression skipped - no messages to compress', {
            status: compressed.status,
          });
          this.emit('compression-skipped', { reason: compressed.status });
          return;
        }

        if (compressed && compressed.summary) {
          const systemMessages = context.messages.filter((m) => m.role === 'system');

          const checkpoint: import('./types.js').CompressionCheckpoint = {
            id: `checkpoint-${Date.now()}`,
            level: 3,
            range: `Messages 1-${context.messages.length - compressed.preserved.length}`,
            summary: compressed.summary,
            createdAt: new Date(),
            originalTokens: compressed.originalTokens,
            currentTokens: compressed.compressedTokens,
            compressionCount: 1,
            keyDecisions: compressed.checkpoint?.keyDecisions,
            filesModified: compressed.checkpoint?.filesModified,
            nextSteps: compressed.checkpoint?.nextSteps,
          };

          if (!context.checkpoints) {
            context.checkpoints = [];
          }

          context.checkpoints.push(checkpoint);

          const MAX_CHECKPOINTS = 10;
          if (context.checkpoints.length > MAX_CHECKPOINTS) {
            const removed = context.checkpoints.length - MAX_CHECKPOINTS;
            context.checkpoints = context.checkpoints.slice(-MAX_CHECKPOINTS);
            console.log('[ContextManager] Checkpoint limit reached, removed oldest checkpoints', {
              removed,
              remaining: context.checkpoints.length,
            });
          }

          await this.checkpointManager.compressOldCheckpoints();

          const checkpointMessages = context.checkpoints.map((cp) => cp.summary);

          context.messages = [...systemMessages, ...checkpointMessages, ...compressed.preserved];

          const newTokenCount = this.tokenCounter.countConversationTokens(context.messages);
          context.tokenCount = newTokenCount;
          this.contextPool.setCurrentTokens(newTokenCount);

          context.metadata.compressionHistory.push({
            timestamp: new Date(),
            strategy: 'summarize',
            originalTokens: compressed.originalTokens,
            compressedTokens: compressed.compressedTokens,
            ratio: compressed.compressionRatio,
          });

          this.emit('auto-summary-created', {
            summary: compressed.summary,
            checkpoint,
            snapshot: snapshot || null,
            originalTokens: compressed.originalTokens,
            compressedTokens: compressed.compressedTokens,
            ratio: compressed.compressionRatio,
          });
        } else {
          console.warn('[ContextManager] compression returned no summary');
          this.emit('auto-summary-failed', { reason: 'no-summary' });
        }
      } catch (error) {
        console.error('[ContextManager] auto-summary failed', error);
        this.emit('auto-summary-failed', { error });
      }
    } finally {
      // Phase 2: Clear blocking flags and emit unblock event
      this.autoSummaryRunning = false;
      this.summarizationInProgress = false;

      // Resolve lock
      if (resolveLock) {
        resolveLock();
      }
      this.summarizationLock = null;

      // Emit unblock-user-input event
      this.emit('unblock-user-input', {
        reason: 'checkpoint-complete',
      });
    }
  }

  /**
   * Tier 2 smart compression with a single detailed checkpoint.
   */
  private async compressForTier2(): Promise<void> {
    console.log('[ContextManager] Tier 2 smart compression triggered');

    const context = this.getContext();
    const preserved = this.checkpointManager.preserveNeverCompressed(context);
    const critical = this.checkpointManager.extractCriticalInfo(
      context.messages,
      this.getModeProfile()
    );

    const systemMessages = context.messages.filter((m) => m.role === 'system');
    const checkpointIds = new Set((context.checkpoints || []).map((cp) => cp.summary.id));
    const neverCompressedMessages = this.checkpointManager.reconstructNeverCompressed(preserved);
    const neverCompressedIds = new Set(neverCompressedMessages.map((m) => m.id));

    const compressibleMessages = context.messages.filter(
      (m) => m.role !== 'system' && !checkpointIds.has(m.id) && !neverCompressedIds.has(m.id)
    );

    const recentCount = 10;
    const minToCompress = 3;

    if (compressibleMessages.length < minToCompress) {
      this.emit('compression-skipped', { reason: 'not-enough-messages', tier: 'tier2' });
      return;
    }

    const recentMessages = compressibleMessages.slice(-recentCount);
    const oldMessages = compressibleMessages.slice(0, -recentCount);

    if (oldMessages.length < minToCompress) {
      this.emit('compression-skipped', { reason: 'not-enough-old-messages', tier: 'tier2' });
      return;
    }

    const strategy = {
      type: 'summarize' as const,
      preserveRecent: 0,
      summaryMaxTokens: 700,
    };

    const compressed = await this.compressionService.compress(oldMessages, strategy);

    if (compressed.status === 'inflated') {
      this.emit('compression-skipped', { reason: 'inflation', tier: 'tier2' });
      return;
    }

    const checkpointId = `checkpoint-tier2-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const compressionNumber = context.metadata.compressionHistory.length;

    const checkpoint: import('./types.js').CompressionCheckpoint = {
      id: checkpointId,
      level: 3,
      range: `Messages 1-${oldMessages.length}`,
      summary: compressed.summary,
      createdAt: new Date(),
      originalTokens: compressed.originalTokens,
      currentTokens: compressed.compressedTokens,
      compressionCount: 1,
      compressionNumber,
      keyDecisions: critical.decisions,
      filesModified: critical.files,
      nextSteps: compressed.checkpoint?.nextSteps,
    };

    if (!context.checkpoints) {
      context.checkpoints = [];
    }
    context.checkpoints.push(checkpoint);

    const checkpointMessages = context.checkpoints.map((cp) => cp.summary);
    context.messages = [
      ...systemMessages,
      ...neverCompressedMessages,
      ...checkpointMessages,
      ...recentMessages,
    ];

    await this.checkpointManager.compressOldCheckpoints();

    const newTokenCount = this.tokenCounter.countConversationTokens(context.messages);
    context.tokenCount = newTokenCount;
    this.contextPool.setCurrentTokens(newTokenCount);

    const softLimit = 6;
    const toKeep = 4;
    if (context.checkpoints.length > softLimit) {
      const toMerge = context.checkpoints.slice(0, -toKeep);
      const recent = context.checkpoints.slice(-toKeep);
      if (toMerge.length > 1) {
        const merged = this.checkpointManager.mergeCheckpoints(
          toMerge.slice(0, -1),
          toMerge[toMerge.length - 1]
        );
        context.checkpoints = [merged, ...recent];

        const rebuiltNeverCompressed = this.checkpointManager.reconstructNeverCompressed(preserved);
        const rebuiltCheckpointMessages = context.checkpoints.map((cp) => cp.summary);
        context.messages = [
          ...systemMessages,
          ...rebuiltNeverCompressed,
          ...rebuiltCheckpointMessages,
          ...recentMessages,
        ];
      }
    }

    context.metadata.compressionHistory.push({
      timestamp: new Date(),
      strategy: 'smart',
      originalTokens: compressed.originalTokens,
      compressedTokens: compressed.compressedTokens,
      ratio: compressed.compressionRatio,
    });

    this.emit('tier2-compressed', {
      checkpoint,
      critical,
      originalTokens: compressed.originalTokens,
      compressedTokens: compressed.compressedTokens,
    });
  }

  /**
   * Tier 3 progressive checkpoints with hierarchical compression.
   */
  private async compressForTier3(): Promise<void> {
    console.log('[ContextManager] Tier 3 progressive compression triggered');

    const context = this.getContext();
    const preserved = this.checkpointManager.preserveNeverCompressed(context);
    const strategy = {
      type: this.config.compression.strategy,
      preserveRecent: this.config.compression.preserveRecent,
      summaryMaxTokens: this.config.compression.summaryMaxTokens,
    };

    const compressed = await this.compressionService.compress(context.messages, strategy);

    if (compressed.status === 'inflated') {
      this.emit('compression-skipped', { reason: 'inflation', tier: 'tier3' });
      return;
    }

    const extracted = this.checkpointManager.extractCriticalInfo(
      context.messages,
      this.getModeProfile()
    );
    const checkpointId = `checkpoint-tier3-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const compressionNumber = context.metadata.compressionHistory.length;

    const checkpoint: import('./types.js').CompressionCheckpoint = {
      id: checkpointId,
      level: 3,
      range: `Messages 1-${context.messages.length - compressed.preserved.length}`,
      summary: compressed.summary,
      createdAt: new Date(),
      originalTokens: compressed.originalTokens,
      currentTokens: compressed.compressedTokens,
      compressionCount: 1,
      compressionNumber,
      keyDecisions: extracted.decisions,
      filesModified: extracted.files,
      nextSteps: compressed.checkpoint?.nextSteps,
    };

    if (!context.checkpoints) {
      context.checkpoints = [];
    }

    context.checkpoints.push(checkpoint);

    await this.checkpointManager.compressOldCheckpoints();

    const tierConfig = this.getTierConfig();
    if (context.checkpoints.length > tierConfig.maxCheckpoints) {
      const excess = context.checkpoints.length - tierConfig.maxCheckpoints;
      const toMerge = context.checkpoints.slice(0, excess + 1);
      const remaining = context.checkpoints.slice(excess + 1);

      const mergedCheckpoint: import('./types.js').CompressionCheckpoint = {
        id: `checkpoint-merged-${Date.now()}`,
        level: 1,
        range: `${toMerge[0].range} to ${toMerge[toMerge.length - 1].range}`,
        summary: {
          id: `summary-merged-${Date.now()}`,
          role: 'system',
          content: `[Merged checkpoint: ${toMerge.length} earlier checkpoints]`,
          timestamp: new Date(),
        },
        createdAt: toMerge[0].createdAt,
        compressedAt: new Date(),
        originalTokens: toMerge.reduce((sum, cp) => sum + cp.originalTokens, 0),
        currentTokens: 100,
        compressionCount: Math.max(...toMerge.map((cp) => cp.compressionCount)) + 1,
        keyDecisions: toMerge.flatMap((cp) => cp.keyDecisions || []).slice(0, 10),
        filesModified: toMerge.flatMap((cp) => cp.filesModified || []).slice(0, 20),
      };

      context.checkpoints = [mergedCheckpoint, ...remaining];
    }

    const systemMessages = context.messages.filter((m) => m.role === 'system');
    const neverCompressedMessages = this.checkpointManager.reconstructNeverCompressed(preserved);
    const checkpointMessages = context.checkpoints.map((cp) => cp.summary);

    context.messages = [
      ...systemMessages,
      ...neverCompressedMessages,
      ...checkpointMessages,
      ...compressed.preserved,
    ];

    const newTokenCount = this.tokenCounter.countConversationTokens(context.messages);
    context.tokenCount = newTokenCount;
    this.contextPool.setCurrentTokens(newTokenCount);

    context.metadata.compressionHistory.push({
      timestamp: new Date(),
      strategy: 'progressive',
      originalTokens: compressed.originalTokens,
      compressedTokens: compressed.compressedTokens,
      ratio: compressed.compressionRatio,
    });

    this.emit('tier3-compressed', {
      checkpoint,
      checkpointCount: context.checkpoints.length,
      neverCompressedCount: preserved.length,
      extracted,
      originalTokens: compressed.originalTokens,
      compressedTokens: compressed.compressedTokens,
    });
  }

  /**
   * Tier 4 structured compression with broader summaries.
   */
  private async compressForTier4(): Promise<void> {
    console.log('[ContextManager] Tier 4 structured compression triggered');

    const context = this.getContext();
    const preserved = this.checkpointManager.preserveNeverCompressed(context);
    const extracted = this.checkpointManager.extractCriticalInfo(
      context.messages,
      this.getModeProfile()
    );

    const strategy = {
      type: 'summarize' as const,
      preserveRecent: this.config.compression.preserveRecent,
      summaryMaxTokens: 1500,
    };

    const compressed = await this.compressionService.compress(context.messages, strategy);

    if (compressed.status === 'inflated') {
      this.emit('compression-skipped', { reason: 'inflation', tier: 'tier4' });
      return;
    }

    const checkpointId = `checkpoint-tier4-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const compressionNumber = context.metadata.compressionHistory.length;

    const checkpoint: import('./types.js').CompressionCheckpoint = {
      id: checkpointId,
      level: 3,
      range: `Messages 1-${context.messages.length - compressed.preserved.length}`,
      summary: compressed.summary,
      createdAt: new Date(),
      originalTokens: compressed.originalTokens,
      currentTokens: compressed.compressedTokens,
      compressionCount: 1,
      compressionNumber,
      keyDecisions: extracted.decisions,
      filesModified: extracted.files,
      nextSteps: compressed.checkpoint?.nextSteps,
    };

    if (!context.checkpoints) {
      context.checkpoints = [];
    }

    context.checkpoints.push(checkpoint);

    const tierConfig = this.getTierConfig();
    if (context.checkpoints.length > tierConfig.maxCheckpoints) {
      const excess = context.checkpoints.length - tierConfig.maxCheckpoints;
      const toMerge = context.checkpoints.slice(0, excess + 1);
      const remaining = context.checkpoints.slice(excess + 1);

      const mergedContent = toMerge.map((cp) => cp.summary.content).join('\n\n---\n\n');

      const mergedCheckpoint: import('./types.js').CompressionCheckpoint = {
        id: `checkpoint-merged-tier4-${Date.now()}`,
        level: 1,
        range: `${toMerge[0].range} to ${toMerge[toMerge.length - 1].range}`,
        summary: {
          id: `summary-merged-tier4-${Date.now()}`,
          role: 'system',
          content: `[Merged ${toMerge.length} checkpoints]\n${mergedContent.substring(0, 500)}...`,
          timestamp: new Date(),
        },
        createdAt: toMerge[0].createdAt,
        compressedAt: new Date(),
        originalTokens: toMerge.reduce((sum, cp) => sum + cp.originalTokens, 0),
        currentTokens: 200,
        compressionCount: Math.max(...toMerge.map((cp) => cp.compressionCount)) + 1,
        keyDecisions: toMerge.flatMap((cp) => cp.keyDecisions || []).slice(0, 10),
        filesModified: toMerge.flatMap((cp) => cp.filesModified || []).slice(0, 20),
      };

      context.checkpoints = [mergedCheckpoint, ...remaining];
    }

    void this.checkpointManager.compressOldCheckpoints();

    const systemMessages = context.messages.filter((m) => m.role === 'system');
    const neverCompressedMessages = this.checkpointManager.reconstructNeverCompressed(preserved);
    const checkpointMessages = context.checkpoints.map((cp) => cp.summary);

    context.messages = [
      ...systemMessages,
      ...neverCompressedMessages,
      ...checkpointMessages,
      ...compressed.preserved,
    ];

    const newTokenCount = this.tokenCounter.countConversationTokens(context.messages);
    context.tokenCount = newTokenCount;
    this.contextPool.setCurrentTokens(newTokenCount);

    context.metadata.compressionHistory.push({
      timestamp: new Date(),
      strategy: 'structured',
      originalTokens: compressed.originalTokens,
      compressedTokens: compressed.compressedTokens,
      ratio: compressed.compressionRatio,
    });

    this.emit('tier4-compressed', {
      checkpoint,
      checkpointCount: context.checkpoints.length,
      neverCompressedCount: preserved.length,
      richMetadata: {
        decisions: extracted.decisions.length,
        files: extracted.files.length,
      },
      originalTokens: compressed.originalTokens,
      compressedTokens: compressed.compressedTokens,
    });
  }

  /**
   * Tier 5 ultra structured compression with maximal detail.
   */
  private async compressForTier5(): Promise<void> {
    console.log('[ContextManager] Tier 5 ultra structured compression triggered');

    const context = this.getContext();
    const preserved = this.checkpointManager.preserveNeverCompressed(context);
    const extracted = this.checkpointManager.extractCriticalInfo(
      context.messages,
      this.getModeProfile()
    );

    const strategy = {
      type: 'summarize' as const,
      preserveRecent: this.config.compression.preserveRecent,
      summaryMaxTokens: 2000,
    };

    const compressed = await this.compressionService.compress(context.messages, strategy);

    if (compressed.status === 'inflated') {
      this.emit('compression-skipped', { reason: 'inflation', tier: 'tier5' });
      return;
    }

    const checkpointId = `checkpoint-tier5-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const compressionNumber = context.metadata.compressionHistory.length;

    const checkpoint: import('./types.js').CompressionCheckpoint = {
      id: checkpointId,
      level: 3,
      range: `Messages 1-${context.messages.length - compressed.preserved.length}`,
      summary: compressed.summary,
      createdAt: new Date(),
      originalTokens: compressed.originalTokens,
      currentTokens: compressed.compressedTokens,
      compressionCount: 1,
      compressionNumber,
      keyDecisions: extracted.decisions,
      filesModified: extracted.files,
      nextSteps: compressed.checkpoint?.nextSteps,
    };

    if (!context.checkpoints) {
      context.checkpoints = [];
    }

    context.checkpoints.push(checkpoint);

    const tierConfig = this.getTierConfig();
    if (context.checkpoints.length > tierConfig.maxCheckpoints) {
      const excess = context.checkpoints.length - tierConfig.maxCheckpoints;
      const toMerge = context.checkpoints.slice(0, excess + 1);
      const remaining = context.checkpoints.slice(excess + 1);

      const mergedContent = toMerge.map((cp) => cp.summary.content).join('\n\n---\n\n');

      const mergedCheckpoint: import('./types.js').CompressionCheckpoint = {
        id: `checkpoint-merged-tier5-${Date.now()}`,
        level: 1,
        range: `${toMerge[0].range} to ${toMerge[toMerge.length - 1].range}`,
        summary: {
          id: `summary-merged-tier5-${Date.now()}`,
          role: 'system',
          content: `[Merged ${toMerge.length} checkpoints - Ultra tier]\n${mergedContent.substring(0, 800)}...`,
          timestamp: new Date(),
        },
        createdAt: toMerge[0].createdAt,
        compressedAt: new Date(),
        originalTokens: toMerge.reduce((sum, cp) => sum + cp.originalTokens, 0),
        currentTokens: 300,
        compressionCount: Math.max(...toMerge.map((cp) => cp.compressionCount)) + 1,
        keyDecisions: toMerge.flatMap((cp) => cp.keyDecisions || []).slice(0, 15),
        filesModified: toMerge.flatMap((cp) => cp.filesModified || []).slice(0, 30),
      };

      context.checkpoints = [mergedCheckpoint, ...remaining];
    }

    await this.checkpointManager.compressOldCheckpoints();

    const systemMessages = context.messages.filter((m) => m.role === 'system');
    const neverCompressedMessages = this.checkpointManager.reconstructNeverCompressed(preserved);
    const checkpointMessages = context.checkpoints.map((cp) => cp.summary);

    context.messages = [
      ...systemMessages,
      ...neverCompressedMessages,
      ...checkpointMessages,
      ...compressed.preserved,
    ];

    const newTokenCount = this.tokenCounter.countConversationTokens(context.messages);
    context.tokenCount = newTokenCount;
    this.contextPool.setCurrentTokens(newTokenCount);

    context.metadata.compressionHistory.push({
      timestamp: new Date(),
      strategy: 'structured',
      originalTokens: compressed.originalTokens,
      compressedTokens: compressed.compressedTokens,
      ratio: compressed.compressionRatio,
    });

    this.emit('tier5-compressed', {
      checkpoint,
      checkpointCount: context.checkpoints.length,
      neverCompressedCount: preserved.length,
      richMetadata: {
        decisions: extracted.decisions.length,
        files: extracted.files.length,
      },
      originalTokens: compressed.originalTokens,
      compressedTokens: compressed.compressedTokens,
    });
  }

  /**
   * Dispatch compression strategy based on the active tier config.
   */
  async compress(): Promise<void> {
    const tier = this.getTierConfig();
    console.log('[ContextManager] compress invoked', {
      tier: tier.tier,
      strategy: tier.strategy,
      messageCount: this.getContext().messages.length,
    });

    try {
      switch (tier.strategy) {
        case 'rollover':
          await this.compressForTier1();
          break;
        case 'smart':
          await this.compressForTier2();
          break;
        case 'progressive':
          await this.compressForTier3();
          break;
        case 'structured':
          if (tier.maxCheckpoints >= 15) {
            await this.compressForTier5();
          } else {
            await this.compressForTier4();
          }
          break;
        default:
          console.warn(`[ContextManager] Unknown strategy ${tier.strategy}, using progressive`);
          await this.compressForTier3();
      }

      console.log('[ContextManager] compression complete', {
        tier: tier.tier,
        newTokenCount: this.getContext().tokenCount,
        checkpointCount: this.getContext().checkpoints?.length || 0,
      });
    } catch (error) {
      console.error('[ContextManager] compression failed', error);
      this.emit('compression-error', { error, tier: tier.tier });
      throw error;
    }
  }
}
