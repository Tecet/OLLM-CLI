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

  /** Number of recent messages to keep (default: 5) */
  keepRecentCount?: number;
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
  private keepRecentCount: number;

  constructor(config: CompressionPipelineConfig) {
    this.summarizationService = config.summarizationService;
    this.validationService = config.validationService;
    this.activeContext = config.activeContext;
    this.sessionHistory = config.sessionHistory;
    this.tokenCounter = config.tokenCounter;
    this.onProgress = config.onProgress;
    this.keepRecentCount = config.keepRecentCount ?? 5;

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
   * - Keep last N recent messages (default: 5)
   * - Only compress assistant messages (keep user messages for context)
   * - Ensure we have enough messages to make compression worthwhile
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

    // Keep last N messages
    if (recentMessages.length <= this.keepRecentCount) {
      return [];
    }

    // Compress older messages (exclude last N)
    const oldMessages = recentMessages.slice(0, -this.keepRecentCount);

    // Only compress assistant messages (keep user messages for continuity)
    const toCompress = oldMessages.filter(m => m.role === 'assistant');

    // Need at least 2 messages to make compression worthwhile
    if (toCompress.length < 2) {
      return [];
    }

    return toCompress;
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
    keepRecentCount: number;
    hasProgressCallback: boolean;
  } {
    return {
      keepRecentCount: this.keepRecentCount,
      hasProgressCallback: !!this.onProgress,
    };
  }

  /**
   * Set number of recent messages to keep
   *
   * @param count - Number of messages to keep
   */
  setKeepRecentCount(count: number): void {
    if (count < 1) {
      throw new Error('keepRecentCount must be at least 1');
    }
    this.keepRecentCount = count;
  }
}
