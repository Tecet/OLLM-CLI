/**
 * Compression Pipeline
 *
 * Provides a structured, six-stage compression pipeline for context management:
 * 1. Identification - Which messages to compress
 * 2. Preparation - Format for LLM summarization
 * 3. Summarization - LLM creates semantic summary
 * 4. Checkpoint Creation - Store summary as checkpoint
 * 5. Context Update - Replace old messages with checkpoint
 * 6. Validation - Verify result fits within limits
 *
 * Each stage has clear responsibilities and error handling.
 * Progress is reported at each stage for user feedback.
 *
 * Requirements: FR-5, FR-6, FR-7
 */

import { GoalProgressTracker } from './goalProgressTracker.js';
import { SummarizationService } from './summarizationService.js';
import { ValidationService } from './validationService.js';
import { debugLog } from '../../utils/debugLogger.js';
import { ActiveContextManager } from '../storage/activeContextManager.js';
import { SessionHistoryManager } from '../storage/sessionHistoryManager.js';
import { TokenCounterService } from '../tokenCounter.js';

import type { CompressionLevel } from './summarizationService.js';
import type { ExtendedValidationResult } from './validationService.js';
import type { Goal, GoalManager } from '../goalTypes.js';
import type { CheckpointSummary, CheckpointRecord } from '../types/storageTypes.js';
import type { Message } from '../types.js';
import type { ProgressTrackingResult } from './goalProgressTracker.js';

/**
 * Compression result
 */
export interface CompressionResult {
  /** Whether compression succeeded */
  success: boolean;

  /** Reason for failure (if success = false) */
  reason?: string;

  /** Created checkpoint (if success = true) */
  checkpoint?: CheckpointSummary;

  /** Tokens freed by compression */
  freedTokens?: number;

  /** Validation result after compression */
  validation?: ExtendedValidationResult;

  /** Goal progress tracking result (if goal provided) */
  goalProgress?: ProgressTrackingResult;

  /** Error details (if failed) */
  error?: string;
}

/**
 * Prepared summarization data
 */
interface PreparedSummarization {
  /** Messages to summarize */
  messages: Message[];

  /** Compression level to use */
  level: CompressionLevel;

  /** Original token count */
  originalTokens: number;

  /** Goal context (if provided) */
  goal?: Goal;
}

/**
 * Progress callback for reporting compression stages
 */
export type ProgressCallback = (stage: string, progress: number, message: string) => void;

/**
 * Compression Pipeline Configuration
 */
export interface CompressionPipelineConfig {
  /** Summarization service */
  summarizationService: SummarizationService;

  /** Validation service */
  validationService: ValidationService;

  /** Active context manager */
  activeContext: ActiveContextManager;

  /** Session history manager */
  sessionHistory: SessionHistoryManager;

  /** Token counter service */
  tokenCounter: TokenCounterService;

  /** Goal manager for progress tracking (optional) */
  goalManager?: GoalManager;

  /** Progress callback (optional) */
  onProgress?: ProgressCallback;

  /** 
   * Percentage of context to keep uncompressed (default: 0.5 = 50%)
   * For example, with 8K context (6963 ollama limit):
   * - 50% = keep last 3481 tokens uncompressed
   * - 30% = keep last 2089 tokens uncompressed
   * This scales automatically with context size.
   */
  keepRecentPercentage?: number;

  /** 
   * Ollama context limit (for calculating keep budget)
   * This is the 85% pre-calculated value from profiles
   */
  ollamaLimit: number;
}

/**
 * Compression Pipeline
 *
 * Orchestrates the six-stage compression process with error handling
 * and progress reporting at each stage.
 *
 * @example
 * ```typescript
 * const pipeline = new CompressionPipeline({
 *   summarizationService,
 *   validationService,
 *   activeContext,
 *   sessionHistory,
 *   tokenCounter,
 *   onProgress: (stage, progress, message) => {
 *     console.log(`[${progress}%] ${stage}: ${message}`);
 *   }
 * });
 *
 * const result = await pipeline.compress(goal);
 * if (result.success) {
 *   console.log(`Freed ${result.freedTokens} tokens`);
 * } else {
 *   console.error(`Compression failed: ${result.reason}`);
 * }
 * ```
 */
export class CompressionPipeline {
  private summarizationService: SummarizationService;
  private validationService: ValidationService;
  private activeContext: ActiveContextManager;
  private sessionHistory: SessionHistoryManager;
  private tokenCounter: TokenCounterService;
  private goalProgressTracker?: GoalProgressTracker;
  private onProgress?: ProgressCallback;
  private keepRecentPercentage: number;
  private ollamaLimit: number;

  constructor(config: CompressionPipelineConfig) {
    this.summarizationService = config.summarizationService;
    this.validationService = config.validationService;
    this.activeContext = config.activeContext;
    this.sessionHistory = config.sessionHistory;
    this.tokenCounter = config.tokenCounter;
    this.onProgress = config.onProgress;
    this.keepRecentPercentage = config.keepRecentPercentage ?? 0.5; // Default: 50%
    this.ollamaLimit = config.ollamaLimit;

    // Initialize goal progress tracker if goal manager provided
    if (config.goalManager) {
      this.goalProgressTracker = new GoalProgressTracker({
        goalManager: config.goalManager,
      });
    }
  }

  /**
   * Execute full compression pipeline
   *
   * Runs all six stages of compression with error handling and progress reporting.
   *
   * Requirements: FR-5, FR-6, FR-7
   *
   * @param goal - Optional goal for goal-aware compression
   * @returns Compression result
   *
   * @example
   * ```typescript
   * const result = await pipeline.compress(activeGoal);
   * if (!result.success) {
   *   console.error('Compression failed:', result.reason);
   *   if (result.error) {
   *     console.error('Error details:', result.error);
   *   }
   * }
   * ```
   */
  async compress(goal?: Goal): Promise<CompressionResult> {
    try {
      // Stage 1: Identification (0-15%)
      this.reportProgress('Identification', 0, 'Identifying messages to compress...');
      const messagesToCompress = await this.identifyMessagesToCompress();

      if (messagesToCompress.length === 0) {
        this.reportProgress('Complete', 100, 'No messages to compress');
        return {
          success: false,
          reason: 'No messages to compress',
        };
      }

      this.reportProgress('Identification', 15, `Found ${messagesToCompress.length} messages to compress`);

      // Stage 2: Preparation (15-25%)
      this.reportProgress('Preparation', 15, 'Preparing messages for summarization...');
      const prepared = await this.prepareForSummarization(messagesToCompress, goal);
      this.reportProgress('Preparation', 25, `Prepared ${prepared.messages.length} messages (Level ${prepared.level})`);

      // Calculate dynamic maxSummaryTokens based on input size
      // Target: 60% of input tokens for effective compression
      const inputTokens = messagesToCompress.reduce((sum, msg) => 
        sum + this.tokenCounter.countTokensCached(msg.id, msg.content), 0
      );
      const dynamicMaxTokens = Math.max(300, Math.floor(inputTokens * 0.6)); // Min 300, target 60% of input
      this.summarizationService.setMaxSummaryTokens(dynamicMaxTokens);
      
      debugLog('CompressionPipeline', 'Dynamic summary limit', {
        inputTokens,
        maxSummaryTokens: dynamicMaxTokens,
        compressionRatio: `${Math.round((dynamicMaxTokens / inputTokens) * 100)}%`,
      });

      // Stage 3: Summarization (25-70%)
      this.reportProgress('Summarization', 25, 'Calling LLM to create summary...');
      const summarizationResult = await this.summarizationService.summarize(
        prepared.messages,
        prepared.level,
        goal
      );

      if (!summarizationResult.success) {
        this.reportProgress('Error', 100, 'Summarization failed');
        return {
          success: false,
          reason: 'Summarization failed',
          error: summarizationResult.error ?? 'Unknown summarization error',
        };
      }

      this.reportProgress('Summarization', 70, `Created summary (${summarizationResult.tokenCount} tokens)`);

      // Stage 4: Checkpoint Creation (70-80%)
      this.reportProgress('Checkpoint Creation', 70, 'Creating checkpoint...');
      const checkpoint = await this.createCheckpoint(
        summarizationResult.summary,
        messagesToCompress,
        prepared.level,
        summarizationResult.model
      );
      this.reportProgress('Checkpoint Creation', 80, `Checkpoint created: ${checkpoint.id}`);

      // Stage 5: Context Update (80-90%)
      this.reportProgress('Context Update', 80, 'Updating active context...');
      
      // Calculate freed tokens (can be negative if summary is longer than original)
      const freedTokens = prepared.originalTokens - checkpoint.tokenCount;
      
      // If compression didn't actually save tokens, it's still a failure
      if (freedTokens <= 0) {
        this.reportProgress('Error', 100, 'Compression did not reduce token count');
        return {
          success: false,
          reason: 'Compression did not reduce token count',
          error: `Summary (${checkpoint.tokenCount} tokens) is not smaller than original (${prepared.originalTokens} tokens)`,
          freedTokens,
        };
      }
      
      await this.updateActiveContext(checkpoint, messagesToCompress);
      this.reportProgress('Context Update', 90, `Freed ${freedTokens} tokens`);

      // Stage 6: Validation (90-100%)
      this.reportProgress('Validation', 90, 'Validating result...');
      const validation = this.validationService.validatePromptSize(
        this.activeContext.buildPrompt()
      );

      if (!validation.valid) {
        this.reportProgress('Error', 100, 'Validation failed after compression');
        return {
          success: false,
          reason: 'Compression failed validation',
          error: `Validation failed: ${validation.errors?.join(', ')}`,
          validation,
        };
      }

      this.reportProgress('Complete', 100, 'Compression complete');

      // Track goal progress if goal provided and tracker available
      let goalProgress: ProgressTrackingResult | undefined;
      if (goal && this.goalProgressTracker) {
        this.reportProgress('Goal Tracking', 100, 'Tracking goal progress...');
        goalProgress = this.goalProgressTracker.trackProgress(
          summarizationResult.summary,
          goal
        );

        if (goalProgress.success && goalProgress.updatesApplied > 0) {
          this.reportProgress(
            'Goal Tracking',
            100,
            `Applied ${goalProgress.updatesApplied} goal updates`
          );
        }
      }

      return {
        success: true,
        checkpoint,
        freedTokens,
        validation,
        goalProgress,
      };
    } catch (error) {
      // Error handling (FR-7)
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.reportProgress('Error', 100, `Compression error: ${errorMessage}`);

      return {
        success: false,
        reason: 'Compression error',
        error: errorMessage,
      };
    }
  }

  /**
   * Stage 1: Identify messages to compress
   *
   * Determines which messages should be compressed based on:
   * - Keep recent messages up to a token budget (default: 1000 tokens)
   * - Compress ALL older messages (user + assistant) for complete context
   * - Ensure we have enough tokens to make compression worthwhile
   *
   * **CRITICAL**: Must include BOTH user and assistant messages in compression
   * so that the LLM-generated summary includes the full conversation context.
   * Otherwise, the LLM loses track of what the user asked for.
   *
   * **Token-based logic**: Instead of keeping last N messages, we keep messages
   * that fit within a token budget. This ensures short messages don't waste space
   * and long messages don't overflow the context.
   *
   * Requirements: FR-5
   *
   * @returns Array of messages to compress
   *
   * @example
   * ```typescript
   * const messages = await pipeline.identifyMessagesToCompress();
   * console.log(`Compressing ${messages.length} messages`);
   * ```
   */
  private async identifyMessagesToCompress(): Promise<Message[]> {
    const state = this.activeContext.getState();
    const recentMessages = state.recentMessages;

    debugLog('CompressionPipeline', `Total messages: ${recentMessages.length}`);

    if (recentMessages.length === 0) {
      debugLog('CompressionPipeline', `No messages to compress`);
      return [];
    }

    // Calculate token budget for keeping recent messages
    // Use percentage of ollama limit (e.g., 50% of 6963 = 3481 tokens)
    const keepRecentTokenBudget = Math.floor(this.ollamaLimit * this.keepRecentPercentage);

    // Work backwards from most recent message, accumulating tokens
    let recentTokens = 0;
    let keepFromIndex = recentMessages.length;

    for (let i = recentMessages.length - 1; i >= 0; i--) {
      const msg = recentMessages[i];
      const msgTokens = this.tokenCounter.countTokensCached(msg.id, msg.content);
      
      if (recentTokens + msgTokens <= keepRecentTokenBudget) {
        recentTokens += msgTokens;
        keepFromIndex = i;
      } else {
        // Exceeded budget, stop here
        break;
      }
    }

    debugLog('CompressionPipeline', `Keep recent: ${recentMessages.length - keepFromIndex} messages (${recentTokens} tokens), Budget: ${keepRecentTokenBudget} tokens (${Math.round(this.keepRecentPercentage * 100)}% of ${this.ollamaLimit})`);

    // Messages to compress are everything before keepFromIndex
    const oldMessages = recentMessages.slice(0, keepFromIndex);

    if (oldMessages.length === 0) {
      debugLog('CompressionPipeline', `No old messages to compress (all within budget)`);
      return [];
    }

    // Calculate tokens in old messages
    const oldTokens = oldMessages.reduce((sum, m) => {
      return sum + this.tokenCounter.countTokensCached(m.id, m.content);
    }, 0);

    debugLog('CompressionPipeline', `Messages to compress: ${oldMessages.length} (${oldTokens} tokens)`);

    // Need at least 500 tokens to make compression worthwhile
    if (oldTokens < 500) {
      debugLog('CompressionPipeline', `Not enough tokens to compress (need >= 500, have ${oldTokens})`);
      return [];
    }

    return oldMessages;
  }

  /**
   * Stage 2: Prepare for summarization
   *
   * Prepares messages for LLM summarization by:
   * - Calculating original token count
   * - Determining appropriate compression level based on size
   * - Packaging with goal context if provided
   *
   * **Compression Level Selection:**
   * - Level 1 (Compact): > 3000 tokens - ultra-compressed
   * - Level 2 (Moderate): 2000-3000 tokens - balanced
   * - Level 3 (Detailed): < 2000 tokens - full detail
   *
   * Requirements: FR-5, FR-6
   *
   * @param messages - Messages to prepare
   * @param goal - Optional goal for context
   * @returns Prepared summarization data
   *
   * @example
   * ```typescript
   * const prepared = await pipeline.prepareForSummarization(messages, goal);
   * console.log(`Level ${prepared.level}, ${prepared.originalTokens} tokens`);
   * ```
   */
  private async prepareForSummarization(
    messages: Message[],
    goal?: Goal
  ): Promise<PreparedSummarization> {
    // Calculate original token count
    const originalTokens = messages.reduce((sum, m) => {
      return sum + this.tokenCounter.countTokensCached(m.id, m.content);
    }, 0);

    // Determine compression level based on token count
    // More tokens = more aggressive compression
    const level: CompressionLevel =
      originalTokens > 3000 ? 1 : // Compact
      originalTokens > 2000 ? 2 : // Moderate
      3; // Detailed

    return {
      messages,
      level,
      originalTokens,
      goal,
    };
  }

  /**
   * Stage 4: Create checkpoint
   *
   * Creates a checkpoint summary from the LLM-generated summary.
   * Records the checkpoint in session history for tracking.
   *
   * Requirements: FR-5
   *
   * @param summary - LLM-generated summary text
   * @param originalMessages - Original messages that were compressed
   * @param level - Compression level used
   * @param model - Model used for summarization
   * @returns Created checkpoint summary
   *
   * @example
   * ```typescript
   * const checkpoint = await pipeline.createCheckpoint(
   *   summary,
   *   messages,
   *   3,
   *   'llama3:8b'
   * );
   * ```
   */
  private async createCheckpoint(
    summary: string,
    originalMessages: Message[],
    level: CompressionLevel,
    model: string
  ): Promise<CheckpointSummary> {
    const history = this.sessionHistory.getHistory();
    const compressionNumber = history.metadata.compressionCount;

    // Create checkpoint summary
    const checkpoint: CheckpointSummary = {
      id: this.generateId(),
      timestamp: Date.now(),
      summary,
      originalMessageIds: originalMessages.map(m => m.id),
      tokenCount: this.tokenCounter.countTokensCached(
        `checkpoint_${compressionNumber}`,
        summary
      ),
      compressionLevel: level,
      compressionNumber,
      metadata: {
        model,
        createdAt: Date.now(),
      },
    };

    // Calculate original token count
    const originalTokens = originalMessages.reduce((sum, m) => {
      return sum + this.tokenCounter.countTokensCached(m.id, m.content);
    }, 0);

    // Record checkpoint in session history
    const record: CheckpointRecord = {
      id: checkpoint.id,
      timestamp: checkpoint.timestamp,
      messageRange: [0, originalMessages.length], // Simplified - could track actual indices
      originalTokens,
      compressedTokens: checkpoint.tokenCount,
      compressionRatio: checkpoint.tokenCount / originalTokens,
      level,
    };

    this.sessionHistory.recordCheckpoint(record);

    return checkpoint;
  }

  /**
   * Stage 5: Update active context
   *
   * Updates the active context by:
   * 1. Removing compressed messages
   * 2. Adding checkpoint summary
   *
   * This replaces old messages with the compressed checkpoint.
   *
   * Requirements: FR-5
   *
   * @param checkpoint - Checkpoint to add
   * @param compressedMessages - Messages to remove
   *
   * @example
   * ```typescript
   * await pipeline.updateActiveContext(checkpoint, messages);
   * ```
   */
  private async updateActiveContext(
    checkpoint: CheckpointSummary,
    _compressedMessages: Message[]
  ): Promise<void> {
    // Remove compressed messages
    this.activeContext.removeMessages(checkpoint.originalMessageIds);

    // Add checkpoint summary
    this.activeContext.addCheckpoint(checkpoint);
  }

  /**
   * Report progress to callback
   *
   * @param stage - Current stage name
   * @param progress - Progress percentage (0-100)
   * @param message - Progress message
   */
  private reportProgress(stage: string, progress: number, message: string): void {
    if (this.onProgress) {
      this.onProgress(stage, progress, message);
    }
  }

  /**
   * Generate unique ID
   *
   * Simple UUID v4 implementation for checkpoint IDs.
   *
   * @returns Unique identifier
   */
  private generateId(): string {
    return 'ckpt_' + Math.random().toString(36).substring(2, 15) +
           Math.random().toString(36).substring(2, 15);
  }

  /**
   * Get configuration
   *
   * @returns Current pipeline configuration
   */
  getConfig(): {
    keepRecentPercentage: number;
    ollamaLimit: number;
    keepRecentTokens: number;
    hasProgressCallback: boolean;
  } {
    return {
      keepRecentPercentage: this.keepRecentPercentage,
      ollamaLimit: this.ollamaLimit,
      keepRecentTokens: Math.floor(this.ollamaLimit * this.keepRecentPercentage),
      hasProgressCallback: !!this.onProgress,
    };
  }

  /**
   * Set percentage of context to keep uncompressed
   *
   * @param percentage - Percentage (0.0 to 1.0, e.g., 0.5 = 50%)
   */
  setKeepRecentPercentage(percentage: number): void {
    if (percentage < 0.1 || percentage > 0.9) {
      throw new Error('keepRecentPercentage must be between 0.1 (10%) and 0.9 (90%)');
    }
    this.keepRecentPercentage = percentage;
  }
}
