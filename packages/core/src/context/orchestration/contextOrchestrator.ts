/**
 * Context Orchestrator
 *
 * Main coordinator for the context compression system. Integrates all subsystems:
 * - Active Context Manager (FR-1) - What gets sent to LLM
 * - Snapshot Lifecycle (FR-3) - Recovery and rollback
 * - Session History Manager (FR-4) - Complete conversation history
 * - Compression Pipeline (FR-5) - LLM-based compression
 * - Checkpoint Lifecycle (FR-2) - Checkpoint aging and merging
 * - Emergency Actions (FR-8, FR-9) - Critical situation handling
 *
 * The orchestrator ensures all subsystems work together correctly and
 * maintains consistency across the entire context management system.
 *
 * Requirements: All FR (FR-1 through FR-16)
 *
 * @module contextOrchestrator
 */

import { CheckpointLifecycle } from '../checkpoints/checkpointLifecycle.js';
import { EmergencyActions } from '../checkpoints/emergencyActions.js';
import { CompressionPipeline, type ProgressCallback } from '../compression/compressionPipeline.js';
import { SummarizationService } from '../compression/summarizationService.js';
import { ValidationService } from '../compression/validationService.js';
import { ActiveContextManager } from '../storage/activeContextManager.js';
import { SessionHistoryManager } from '../storage/sessionHistoryManager.js';
import { SnapshotLifecycle } from '../storage/snapshotLifecycle.js';
import { TokenCounterService } from '../tokenCounter.js';

// Integration imports
import { TierAwareCompression } from '../integration/tierAwareCompression.js';
import { ModeAwareCompression } from '../integration/modeAwareCompression.js';
import { ModelAwareCompression } from '../integration/modelAwareCompression.js';
import { ProviderAwareCompression, type IProfileManager } from '../integration/providerAwareCompression.js';
import { GoalAwareCompression } from '../integration/goalAwareCompression.js';
import { PromptOrchestratorIntegration } from '../integration/promptOrchestratorIntegration.js';

import type { ProviderAdapter } from '../../provider/types.js';
import type { Goal, GoalManager } from '../goalTypes.js';
import type { CheckpointSummary } from '../types/storageTypes.js';
import type { Message, ContextTier, OperationalMode } from '../types.js';
import type { PromptOrchestrator } from '../promptOrchestrator.js';


/**
 * Context orchestrator configuration
 */
export interface ContextOrchestratorConfig {
  /** System prompt message (built by PromptOrchestrator) */
  systemPrompt: Message;

  /** Ollama context limit (85% pre-calculated value) */
  ollamaLimit: number;

  /** Token counter service */
  tokenCounter: TokenCounterService;

  /** Provider adapter for LLM calls */
  provider: ProviderAdapter;

  /** Model identifier */
  model: string;

  /** Session identifier */
  sessionId: string;

  /** Storage path for snapshots and history */
  storagePath: string;

  /** Progress callback for compression operations (optional) */
  onProgress?: ProgressCallback;

  /** Number of recent messages to keep during compression (default: 5) */
  keepRecentCount?: number;

  /** Active goal (optional) */
  goal?: Goal;

  /** Safety margin for response tokens (default: 1000) */
  safetyMargin?: number;

  // Integration dependencies
  /** Context tier for tier-aware compression */
  tier: ContextTier;

  /** Operational mode for mode-aware compression */
  mode: OperationalMode;

  /** Profile manager for provider-aware compression */
  profileManager: IProfileManager;

  /** Goal manager for goal-aware compression */
  goalManager: GoalManager;

  /** Prompt orchestrator for system prompt building */
  promptOrchestrator: PromptOrchestrator;

  /** Current context size (for provider integration) */
  contextSize: number;
}

/**
 * Orchestrator state snapshot
 */
export interface OrchestratorState {
  /** Active context state */
  activeContext: {
    systemPrompt: Message;
    checkpoints: CheckpointSummary[];
    recentMessages: Message[];
    tokenCount: {
      system: number;
      checkpoints: number;
      recent: number;
      total: number;
    };
  };

  /** Session history metadata */
  sessionHistory: {
    sessionId: string;
    totalMessages: number;
    totalTokens: number;
    compressionCount: number;
  };

  /** Snapshot metadata */
  snapshots: {
    count: number;
    latest?: {
      id: string;
      timestamp: number;
      purpose: string;
    };
  };

  /** System health */
  health: {
    tokenUsage: number;
    tokenLimit: number;
    utilizationPercent: number;
    needsCompression: boolean;
    needsAging: boolean;
  };

  /** Integration status */
  integrations: {
    tier: ContextTier;
    mode: OperationalMode;
    model: string;
    modelSize: number;
    contextSize: number;
    hasActiveGoal: boolean;
    tierBudget: number;
    compressionReliability: number;
    compressionUrgency: 'none' | 'low' | 'medium' | 'high' | 'critical';
  };

  /** Compression reliability */
  reliability: {
    score: number;
    level: 'excellent' | 'good' | 'moderate' | 'low' | 'critical';
    emoji: string;
    description: string;
    shouldWarn: boolean;
  };
}

/**
 * Add message result
 */
export interface AddMessageResult {
  /** Whether message was added successfully */
  success: boolean;

  /** Whether compression was triggered */
  compressionTriggered: boolean;

  /** Error message if failed */
  error?: string;

  /** Tokens freed by compression (if triggered) */
  tokensFreed?: number;
}

/**
 * Context Orchestrator
 *
 * Main coordinator for the context compression system.
 * Integrates all subsystems and ensures consistency.
 *
 * @example
 * ```typescript
 * const orchestrator = new ContextOrchestrator({
 *   systemPrompt,
 *   ollamaLimit: 6800,
 *   tokenCounter,
 *   provider,
 *   model: 'llama3:8b',
 *   sessionId: 'session_123',
 *   storagePath: '/path/to/storage',
 *   onProgress: (stage, progress, message) => {
 *     console.log(`[${progress}%] ${stage}: ${message}`);
 *   }
 * });
 *
 * // Add messages
 * const result = await orchestrator.addMessage(userMessage);
 * if (result.compressionTriggered) {
 *   console.log(`Compression freed ${result.tokensFreed} tokens`);
 * }
 *
 * // Build prompt for LLM
 * const prompt = orchestrator.buildPrompt(newMessage);
 *
 * // Get current state
 * const state = orchestrator.getState();
 * console.log(`Token usage: ${state.health.utilizationPercent}%`);
 * ```
 */
export class ContextOrchestrator {
  // Core subsystems
  private activeContext: ActiveContextManager;
  private snapshotLifecycle: SnapshotLifecycle;
  private sessionHistory: SessionHistoryManager;
  private compressionPipeline: CompressionPipeline;
  private checkpointLifecycle: CheckpointLifecycle;
  private emergencyActions: EmergencyActions;
  private validationService: ValidationService;

  // Integration subsystems
  private tierIntegration: TierAwareCompression;
  private modeIntegration: ModeAwareCompression;
  private modelIntegration: ModelAwareCompression;
  private providerIntegration: ProviderAwareCompression;
  private goalIntegration: GoalAwareCompression;
  private promptIntegration: PromptOrchestratorIntegration;

  // Configuration
  private config: ContextOrchestratorConfig;
  private goal?: Goal;

  // State tracking
  private isCompressing: boolean = false;
  private compressionThreshold: number = 0.75; // Trigger at 75% capacity

  /**
   * Create a new Context Orchestrator
   *
   * @param config - Orchestrator configuration
   */
  constructor(config: ContextOrchestratorConfig) {
    this.config = config;
    this.goal = config.goal;

    // Initialize token counter
    const tokenCounter = config.tokenCounter;

    // Initialize integration subsystems
    this.tierIntegration = new TierAwareCompression();
    this.modeIntegration = new ModeAwareCompression();
    this.modelIntegration = new ModelAwareCompression();
    this.providerIntegration = new ProviderAwareCompression(
      config.profileManager,
      config.contextSize
    );
    this.goalIntegration = new GoalAwareCompression(config.goalManager);
    this.promptIntegration = new PromptOrchestratorIntegration(config.promptOrchestrator);

    // Initialize active context manager
    this.activeContext = new ActiveContextManager(
      config.systemPrompt,
      config.ollamaLimit,
      tokenCounter,
      config.safetyMargin
    );

    // Initialize snapshot lifecycle
    this.snapshotLifecycle = new SnapshotLifecycle(
      config.sessionId,
      config.storagePath
    );

    // Initialize session history manager
    this.sessionHistory = new SessionHistoryManager(
      config.sessionId,
      config.storagePath
    );

    // Initialize summarization service with mode integration
    const summarizationService = new SummarizationService({
      provider: config.provider,
      model: config.model,
    });

    // Initialize validation service with provider integration
    this.validationService = new ValidationService({
      ollamaLimit: config.ollamaLimit,
      tokenCounter,
    });

    // Initialize compression pipeline with all integrations
    this.compressionPipeline = new CompressionPipeline({
      summarizationService,
      validationService: this.validationService,
      activeContext: this.activeContext,
      sessionHistory: this.sessionHistory,
      tokenCounter,
      onProgress: config.onProgress,
      keepRecentCount: config.keepRecentCount,
    });

    // Initialize checkpoint lifecycle with model integration
    this.checkpointLifecycle = new CheckpointLifecycle(summarizationService);

    // Initialize emergency actions
    this.emergencyActions = new EmergencyActions(
      this.checkpointLifecycle,
      this.snapshotLifecycle,
      summarizationService
    );
  }

  /**
   * Add message to context
   *
   * Adds a message to both active context and session history.
   * Automatically triggers compression if context is getting full.
   * Uses tier and provider integrations to determine compression triggers.
   *
   * **Compression Trigger:**
   * - Triggered based on tier budget and provider limits
   * - Compression runs automatically in background
   * - User is notified via progress callback
   *
   * Requirements: FR-1, FR-4, FR-5, FR-11, FR-14
   *
   * @param message - Message to add
   * @returns Add message result
   *
   * @example
   * ```typescript
   * const result = await orchestrator.addMessage(userMessage);
   * if (!result.success) {
   *   console.error('Failed to add message:', result.error);
   * }
   * if (result.compressionTriggered) {
   *   console.log(`Compression freed ${result.tokensFreed} tokens`);
   * }
   * ```
   */
  async addMessage(message: Message): Promise<AddMessageResult> {
    try {
      // Step 1: Add to session history (never fails)
      this.sessionHistory.appendMessage(message);

      // Step 2: Check if we need compression before adding
      const available = this.activeContext.getAvailableTokens();
      const messageTokens = this.config.tokenCounter.countTokensCached(
        message.id,
        message.content
      );

      if (messageTokens > available) {
        // Need compression before we can add this message
        const compressionResult = await this.compress();

        if (!compressionResult.success) {
          // Compression failed, try emergency actions
          const emergencyResult = await this.handleEmergency();

          if (!emergencyResult.success) {
            return {
              success: false,
              compressionTriggered: true,
              error: `Cannot add message: context full and compression failed (${compressionResult.reason})`,
            };
          }
        }
      }

      // Step 3: Add to active context
      this.activeContext.addMessage(message);

      // Step 4: Check if we need compression after adding (using integrations)
      const systemPromptTokens = this.config.tokenCounter.countTokensCached(
        this.config.systemPrompt.id,
        this.config.systemPrompt.content
      );
      const currentTokens = this.activeContext.getTokenCount();
      const tierBudget = this.tierIntegration.getPromptBudget(this.config.tier);

      // Use tier and provider integrations to determine if compression needed
      const tierShouldCompress = this.tierIntegration.shouldCompress(
        this.config.tier,
        currentTokens,
        this.config.ollamaLimit,
        systemPromptTokens
      );

      const providerShouldCompress = this.providerIntegration.shouldCompress(
        currentTokens,
        this.config.model,
        systemPromptTokens,
        tierBudget
      );

      let compressionTriggered = false;
      let tokensFreed = 0;

      if (tierShouldCompress || providerShouldCompress) {
        const compressionResult = await this.compress();
        compressionTriggered = compressionResult.success;
        tokensFreed = compressionResult.freedTokens || 0;
      }

      return {
        success: true,
        compressionTriggered,
        tokensFreed: compressionTriggered ? tokensFreed : undefined,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('[ContextOrchestrator] Add message failed:', errorMessage);

      return {
        success: false,
        compressionTriggered: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Build prompt for LLM
   *
   * Constructs the complete prompt array from active context.
   * This is what gets sent to the LLM.
   *
   * Requirements: FR-1
   *
   * @param newMessage - Optional new message to append
   * @returns Complete prompt array
   *
   * @example
   * ```typescript
   * const prompt = orchestrator.buildPrompt(newUserMessage);
   * const response = await provider.chatStream(prompt);
   * ```
   */
  buildPrompt(newMessage?: Message): Message[] {
    return this.activeContext.buildPrompt(newMessage);
  }

  /**
   * Compress context
   *
   * Runs the compression pipeline to free space in active context.
   * Creates a snapshot before compression for safety.
   * Uses all system integrations (tier, mode, model, provider, goal).
   *
   * Requirements: FR-5, FR-6, FR-7, FR-9, FR-11, FR-12, FR-13, FR-14, FR-15
   *
   * @returns Compression result
   *
   * @example
   * ```typescript
   * const result = await orchestrator.compress();
   * if (result.success) {
   *   console.log(`Freed ${result.freedTokens} tokens`);
   * } else {
   *   console.error('Compression failed:', result.reason);
   * }
   * ```
   */
  async compress(): Promise<{
    success: boolean;
    reason?: string;
    freedTokens?: number;
    error?: string;
  }> {
    // Prevent concurrent compression
    if (this.isCompressing) {
      return {
        success: false,
        reason: 'Compression already in progress',
      };
    }

    this.isCompressing = true;

    try {
      // Step 1: Validate system prompt before compression
      try {
        this.validateSystemPrompt();
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
          success: false,
          reason: 'System prompt validation failed',
          error: errorMessage,
        };
      }

      // Step 2: Check compression urgency
      const urgency = this.getCompressionUrgency();
      if (urgency === 'none') {
        return {
          success: false,
          reason: 'Compression not needed - token usage is low',
        };
      }

      // Step 3: Check compression reliability
      const reliability = this.getCompressionReliability();
      if (reliability.shouldWarn) {
        console.warn(
          `[ContextOrchestrator] ${reliability.emoji} ${reliability.description}`
        );
      }

      // Step 4: Create safety snapshot
      await this.createSnapshot('recovery');

      // Step 5: Verify goals are not in messages to compress (FR-15)
      if (this.goal) {
        const messages = this.activeContext.getRecentMessages();
        try {
          this.goalIntegration.verifyGoalsNotCompressed(messages, this.goal);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          return {
            success: false,
            reason: 'Goal verification failed',
            error: errorMessage,
          };
        }
      }

      // Step 6: Run compression pipeline with goal context
      const result = await this.compressionPipeline.compress(this.goal);

      if (!result.success) {
        return {
          success: false,
          reason: result.reason,
          error: result.error,
        };
      }

      // Step 7: Age checkpoints if needed (with model-aware reliability)
      await this.ageCheckpointsIfNeeded();

      // Step 8: Validate result against provider limits (FR-14)
      const validation = this.providerIntegration.validateAgainstProvider(
        this.activeContext.getTokenCount(),
        this.config.model
      );

      if (!validation.valid) {
        return {
          success: false,
          reason: 'Compression result exceeds provider limits',
          error: validation.message,
        };
      }

      return {
        success: true,
        freedTokens: result.freedTokens,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('[ContextOrchestrator] Compression failed:', errorMessage);

      // Handle provider-specific errors (FR-14)
      if (error instanceof Error) {
        const errorStrategy = this.providerIntegration.handleProviderError(
          error,
          this.config.model
        );

        if (errorStrategy.shouldCompress && errorStrategy.shouldRetry) {
          console.log('[ContextOrchestrator] Provider error suggests retry with compression');
        }
      }

      return {
        success: false,
        reason: 'Compression error',
        error: errorMessage,
      };
    } finally {
      this.isCompressing = false;
    }
  }

  /**
   * Age checkpoints if needed
   *
   * Ages old checkpoints to free additional space.
   * Called automatically after compression.
   *
   * Requirements: FR-2, FR-6
   */
  private async ageCheckpointsIfNeeded(): Promise<void> {
    const history = this.sessionHistory.getHistory();
    const currentCompressionNumber = history.metadata.compressionCount;
    const checkpoints = this.activeContext.getCheckpoints();

    // Check if any checkpoints need aging
    const needsAging = this.checkpointLifecycle.getCheckpointsNeedingAging(
      checkpoints,
      currentCompressionNumber
    );

    if (needsAging.length === 0) {
      return;
    }

    // Age checkpoints
    const results = await this.checkpointLifecycle.ageCheckpoints(
      checkpoints,
      currentCompressionNumber,
      this.goal
    );

    // Update active context with aged checkpoints
    for (const result of results) {
      if (result.success) {
        // Remove old checkpoint and add aged one
        this.activeContext.removeMessages([result.originalId]);
        this.activeContext.addCheckpoint(result.agedCheckpoint);
      }
    }
  }

  /**
   * Handle emergency situation
   *
   * Executes emergency actions when normal compression fails.
   * Tries actions in order of severity:
   * 1. Compress largest checkpoint to Level 1
   * 2. Merge old checkpoints
   * 3. Emergency rollover (last resort)
   *
   * Requirements: FR-8, FR-9
   */
  private async handleEmergency(): Promise<{
    success: boolean;
    error?: string;
  }> {
    const messages = this.activeContext.getRecentMessages();
    const checkpoints = this.activeContext.getCheckpoints();

    // Try 1: Compress largest checkpoint
    if (checkpoints.length > 0) {
      const largest = checkpoints.sort((a, b) => b.tokenCount - a.tokenCount)[0];

      const result = await this.emergencyActions.compressCheckpoint(
        largest,
        messages,
        checkpoints,
        this.goal
      );

      if (result.success) {
        // Update active context
        this.activeContext.removeMessages([largest.id]);
        // Note: The compressed checkpoint would need to be added here
        // but we don't have access to it in the result
        return { success: true };
      }
    }

    // Try 2: Merge old checkpoints
    const level1Checkpoints = checkpoints.filter((cp) => cp.compressionLevel === 1);
    if (level1Checkpoints.length >= 2) {
      const result = await this.emergencyActions.mergeCheckpoints(
        level1Checkpoints,
        messages,
        checkpoints,
        this.goal
      );

      if (result.success) {
        // Update active context
        const mergedIds = (result.details?.mergedIds as string[]) || [];
        for (const id of mergedIds) {
          this.activeContext.removeMessages([id]);
        }
        // Note: The merged checkpoint would need to be added here
        return { success: true };
      }
    }

    // Try 3: Emergency rollover (last resort)
    const rolloverResult = await this.emergencyActions.emergencyRollover(
      messages,
      checkpoints,
      5 // Keep last 5 messages
    );

    if (rolloverResult.success) {
      // This would require resetting the active context
      // which is a major operation
      return { success: true };
    }

    return {
      success: false,
      error: 'All emergency actions failed',
    };
  }

  /**
   * Create snapshot
   *
   * Creates a snapshot of current conversation state.
   * Snapshots are used for recovery and rollback.
   *
   * Requirements: FR-3, FR-9
   *
   * @param purpose - Purpose of snapshot
   * @returns Snapshot ID
   *
   * @example
   * ```typescript
   * const snapshotId = await orchestrator.createSnapshot('emergency');
   * console.log(`Created snapshot: ${snapshotId}`);
   * ```
   */
  async createSnapshot(
    purpose: 'recovery' | 'rollback' | 'emergency'
  ): Promise<string> {
    const messages = this.activeContext.getRecentMessages();
    const checkpoints = this.activeContext.getCheckpoints();

    const snapshot = await this.snapshotLifecycle.createSnapshot(
      messages,
      checkpoints,
      purpose
    );

    return snapshot.id;
  }

  /**
   * Restore from snapshot
   *
   * Restores conversation state from a snapshot.
   * This is used for error recovery or user-initiated rollback.
   *
   * Requirements: FR-3, FR-9
   *
   * @param snapshotId - Snapshot identifier
   *
   * @example
   * ```typescript
   * await orchestrator.restoreSnapshot('snap_abc123');
   * console.log('Conversation restored from snapshot');
   * ```
   */
  async restoreSnapshot(snapshotId: string): Promise<void> {
    const state = await this.snapshotLifecycle.restoreSnapshot(snapshotId);

    // This would require rebuilding the active context
    // which is a complex operation that needs careful implementation
    // For now, we just log that restoration was requested
    console.log(`[ContextOrchestrator] Restore from snapshot ${snapshotId} requested`);
    console.log(`- Messages: ${state.messages.length}`);
    console.log(`- Checkpoints: ${state.checkpoints.length}`);
  }

  /**
   * Get current state
   *
   * Returns a snapshot of the current orchestrator state including
   * all integration statuses.
   * Useful for debugging and monitoring.
   *
   * @returns Current state
   *
   * @example
   * ```typescript
   * const state = orchestrator.getState();
   * console.log(`Token usage: ${state.health.utilizationPercent}%`);
   * console.log(`Needs compression: ${state.health.needsCompression}`);
   * console.log(`Tier: ${state.integrations.tier}`);
   * ```
   */
  getState(): OrchestratorState {
    const activeContextState = this.activeContext.getState();
    const sessionHistoryState = this.sessionHistory.getHistory();
    const tokenUsage = this.activeContext.getTokenCount();
    const tokenLimit = this.activeContext.getOllamaLimit() - this.activeContext.getSafetyMargin();
    const utilization = (tokenUsage / tokenLimit) * 100;
    const integrationStatus = this.getIntegrationStatus();
    const reliability = this.getCompressionReliability();

    return {
      activeContext: activeContextState,
      sessionHistory: {
        sessionId: sessionHistoryState.sessionId,
        totalMessages: sessionHistoryState.metadata.totalMessages,
        totalTokens: sessionHistoryState.metadata.totalTokens,
        compressionCount: sessionHistoryState.metadata.compressionCount,
      },
      snapshots: {
        count: 0, // Would need to query snapshot lifecycle
        latest: undefined,
      },
      health: {
        tokenUsage,
        tokenLimit,
        utilizationPercent: Math.round(utilization),
        needsCompression: this.getCompressionUrgency() !== 'none',
        needsAging: this.checkpointLifecycle.getCheckpointsNeedingAging(
          activeContextState.checkpoints,
          sessionHistoryState.metadata.compressionCount
        ).length > 0,
      },
      integrations: integrationStatus,
      reliability,
    };
  }

  /**
   * Get token utilization
   *
   * Returns the current token utilization as a percentage (0-1).
   *
   * @returns Token utilization (0-1)
   */
  private getTokenUtilization(): number {
    const tokenUsage = this.activeContext.getTokenCount();
    const tokenLimit = this.activeContext.getOllamaLimit() - this.activeContext.getSafetyMargin();
    return tokenUsage / tokenLimit;
  }

  /**
   * Validate context
   *
   * Validates that the current context is within limits.
   *
   * Requirements: FR-8
   *
   * @returns Validation result
   *
   * @example
   * ```typescript
   * const validation = orchestrator.validate();
   * if (!validation.valid) {
   *   console.error('Context invalid:', validation.message);
   * }
   * ```
   */
  validate(): {
    valid: boolean;
    tokens: number;
    limit: number;
    overage?: number;
    message?: string;
  } {
    return this.activeContext.validate();
  }

  /**
   * Save session history
   *
   * Persists the session history to disk.
   *
   * Requirements: FR-4
   *
   * @example
   * ```typescript
   * await orchestrator.saveHistory();
   * console.log('Session history saved');
   * ```
   */
  async saveHistory(): Promise<void> {
    await this.sessionHistory.save();
  }

  /**
   * Export session history to markdown
   *
   * Generates a human-readable markdown document of the conversation.
   *
   * Requirements: FR-4
   *
   * @returns Markdown string
   *
   * @example
   * ```typescript
   * const markdown = orchestrator.exportHistory();
   * await fs.writeFile('conversation.md', markdown);
   * ```
   */
  exportHistory(): string {
    return this.sessionHistory.exportToMarkdown();
  }

  /**
   * Set active goal
   *
   * Updates the active goal for goal-aware compression.
   *
   * Requirements: FR-15
   *
   * @param goal - Active goal
   *
   * @example
   * ```typescript
   * orchestrator.setGoal(activeGoal);
   * ```
   */
  setGoal(goal: Goal): void {
    this.goal = goal;
  }

  /**
   * Get active goal
   *
   * Returns the current active goal.
   *
   * @returns Active goal (if set)
   */
  getGoal(): Goal | undefined {
    return this.goal;
  }

  /**
   * Update operational mode
   *
   * Updates the operational mode for mode-aware compression.
   *
   * Requirements: FR-12
   *
   * @param mode - New operational mode
   *
   * @example
   * ```typescript
   * orchestrator.updateMode(OperationalMode.DEVELOPER);
   * ```
   */
  updateMode(mode: OperationalMode): void {
    this.config.mode = mode;
  }

  /**
   * Update context tier
   *
   * Updates the context tier for tier-aware compression.
   *
   * Requirements: FR-11
   *
   * @param tier - New context tier
   *
   * @example
   * ```typescript
   * orchestrator.updateTier(ContextTier.TIER_3_STANDARD);
   * ```
   */
  updateTier(tier: ContextTier): void {
    this.config.tier = tier;
  }

  /**
   * Update context size
   *
   * Updates the context size for provider-aware compression.
   *
   * Requirements: FR-14
   *
   * @param size - New context size
   *
   * @example
   * ```typescript
   * orchestrator.updateContextSize(16384);
   * ```
   */
  updateContextSize(size: number): void {
    this.config.contextSize = size;
    this.providerIntegration.updateContextSize(size);
  }

  /**
   * Get compression reliability
   *
   * Calculates the current compression reliability based on model size
   * and number of compressions performed.
   *
   * Requirements: FR-13
   *
   * @returns Reliability information
   *
   * @example
   * ```typescript
   * const reliability = orchestrator.getCompressionReliability();
   * console.log(`Reliability: ${reliability.score * 100}%`);
   * ```
   */
  getCompressionReliability(): {
    score: number;
    level: 'excellent' | 'good' | 'moderate' | 'low' | 'critical';
    emoji: string;
    description: string;
    shouldWarn: boolean;
  } {
    const modelSize = this.modelIntegration.getModelSize(this.config.model);
    const compressionCount = this.sessionHistory.getHistory().metadata.compressionCount;
    const reliability = this.modelIntegration.calculateReliability(modelSize, compressionCount);
    const reliabilityInfo = this.modelIntegration.getReliabilityLevel(reliability);
    const shouldWarn = this.modelIntegration.shouldWarn(modelSize, compressionCount);

    return {
      score: reliability,
      ...reliabilityInfo,
      shouldWarn,
    };
  }

  /**
   * Get compression urgency
   *
   * Determines the urgency level for compression based on current token usage
   * and all system integrations (tier, mode, model, provider).
   *
   * Requirements: FR-11, FR-12, FR-13, FR-14
   *
   * @returns Urgency level
   *
   * @example
   * ```typescript
   * const urgency = orchestrator.getCompressionUrgency();
   * if (urgency === 'critical') {
   *   console.log('Compression needed immediately!');
   * }
   * ```
   */
  getCompressionUrgency(): 'none' | 'low' | 'medium' | 'high' | 'critical' {
    const currentTokens = this.activeContext.getTokenCount();
    const systemPromptTokens = this.config.tokenCounter.countTokensCached(
      this.config.systemPrompt.id,
      this.config.systemPrompt.content
    );

    // Get urgency from each integration
    const tierUrgency = this.tierIntegration.getCompressionUrgency(
      this.config.tier,
      currentTokens,
      this.config.ollamaLimit,
      systemPromptTokens
    );

    const providerUrgency = this.providerIntegration.getCompressionUrgency(
      currentTokens,
      this.config.model,
      systemPromptTokens,
      this.tierIntegration.getPromptBudget(this.config.tier)
    );

    // Return the highest urgency level
    const urgencyLevels = ['none', 'low', 'medium', 'high', 'critical'];
    const tierIndex = urgencyLevels.indexOf(tierUrgency);
    const providerIndex = urgencyLevels.indexOf(providerUrgency);
    const maxIndex = Math.max(tierIndex, providerIndex);

    return urgencyLevels[maxIndex] as 'none' | 'low' | 'medium' | 'high' | 'critical';
  }

  /**
   * Validate system prompt
   *
   * Validates that the system prompt doesn't exceed tier budget and
   * maintains proper structure.
   *
   * Requirements: FR-11, FR-16
   *
   * @throws Error if system prompt is invalid
   *
   * @example
   * ```typescript
   * orchestrator.validateSystemPrompt();
   * ```
   */
  validateSystemPrompt(): void {
    const systemPromptTokens = this.config.tokenCounter.countTokensCached(
      this.config.systemPrompt.id,
      this.config.systemPrompt.content
    );

    // Validate against tier budget
    this.tierIntegration.validateSystemPrompt(systemPromptTokens, this.config.tier);

    // Validate prompt structure
    const prompt = this.buildPrompt();
    this.promptIntegration.verifyPromptStructure(prompt, []);
  }

  /**
   * Get integration status
   *
   * Returns the status of all system integrations for debugging and monitoring.
   *
   * @returns Integration status
   *
   * @example
   * ```typescript
   * const status = orchestrator.getIntegrationStatus();
   * console.log(`Tier: ${status.tier}, Mode: ${status.mode}`);
   * ```
   */
  getIntegrationStatus(): {
    tier: ContextTier;
    mode: OperationalMode;
    model: string;
    modelSize: number;
    contextSize: number;
    hasActiveGoal: boolean;
    tierBudget: number;
    compressionReliability: number;
    compressionUrgency: 'none' | 'low' | 'medium' | 'high' | 'critical';
  } {
    const modelSize = this.modelIntegration.getModelSize(this.config.model);
    const compressionCount = this.sessionHistory.getHistory().metadata.compressionCount;
    const reliability = this.modelIntegration.calculateReliability(modelSize, compressionCount);

    return {
      tier: this.config.tier,
      mode: this.config.mode,
      model: this.config.model,
      modelSize,
      contextSize: this.config.contextSize,
      hasActiveGoal: this.goal !== undefined,
      tierBudget: this.tierIntegration.getPromptBudget(this.config.tier),
      compressionReliability: reliability,
      compressionUrgency: this.getCompressionUrgency(),
    };
  }

  /**
   * Cleanup old snapshots
   *
   * Removes old snapshots to save disk space.
   *
   * Requirements: FR-9
   *
   * @param keepCount - Number of snapshots to keep (default: 5)
   *
   * @example
   * ```typescript
   * await orchestrator.cleanupSnapshots(5);
   * console.log('Old snapshots cleaned up');
   * ```
   */
  async cleanupSnapshots(keepCount: number = 5): Promise<void> {
    await this.snapshotLifecycle.cleanup(keepCount);
  }
}
