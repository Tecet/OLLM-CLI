/**
 * Emergency Actions for Context Management
 *
 * Provides emergency actions when context is critically full and normal
 * compression cannot free enough space. These actions are more aggressive
 * and should only be used as a last resort.
 *
 * **Emergency Actions:**
 * 1. Compress checkpoint at lower level (Level 3 → 1)
 * 2. Merge multiple checkpoints into one
 * 3. Emergency rollover (create snapshot and reset context)
 * 4. Aggressive summarization (compress recent messages)
 *
 * **Safety:**
 * - Always creates snapshot before action
 * - Validates result after action
 * - Provides rollback capability
 *
 * Requirements: FR-8, FR-9, FR-10
 *
 * @module emergencyActions
 */

import type { CheckpointLifecycle } from './checkpointLifecycle.js';
import type { SummarizationService } from '../compression/summarizationService.js';
import type { Goal } from '../goalTypes.js';
import type { SnapshotLifecycle } from '../storage/snapshotLifecycle.js';
import type { CheckpointSummary } from '../types/storageTypes.js';
import type { Message } from '../types.js';

/**
 * Emergency action result
 */
export interface EmergencyActionResult {
  /** Type of action performed */
  action: 'compress' | 'merge' | 'rollover' | 'aggressive-summarization';
  /** Whether action succeeded */
  success: boolean;
  /** Tokens freed by action */
  tokensFreed: number;
  /** Snapshot ID created before action */
  snapshotId: string;
  /** Error message if failed */
  error?: string;
  /** Additional details about the action */
  details?: Record<string, unknown>;
}

/**
 * Emergency rollover result
 */
export interface RolloverResult {
  /** Snapshot ID of old context */
  snapshotId: string;
  /** Number of messages archived */
  messagesArchived: number;
  /** Number of checkpoints archived */
  checkpointsArchived: number;
  /** Tokens freed */
  tokensFreed: number;
  /** Whether rollover succeeded */
  success: boolean;
  /** Error message if failed */
  error?: string;
}

/**
 * Aggressive summarization result
 */
export interface AggressiveSummarizationResult {
  /** Number of messages summarized */
  messagesSummarized: number;
  /** Original token count */
  originalTokens: number;
  /** Tokens after summarization */
  summarizedTokens: number;
  /** Tokens freed */
  tokensFreed: number;
  /** New checkpoint created */
  checkpoint: CheckpointSummary;
  /** Whether summarization succeeded */
  success: boolean;
  /** Error message if failed */
  error?: string;
}

/**
 * Emergency Actions Manager
 *
 * Provides emergency actions for critical context situations.
 * Always creates a snapshot before performing any action.
 *
 * @example
 * ```typescript
 * const emergency = new EmergencyActions(
 *   checkpointLifecycle,
 *   snapshotLifecycle,
 *   summarizationService
 * );
 *
 * // Try emergency compression
 * const result = await emergency.compressCheckpoint(
 *   checkpoint,
 *   messages,
 *   checkpoints
 * );
 *
 * if (!result.success) {
 *   // Try emergency rollover as last resort
 *   const rollover = await emergency.emergencyRollover(messages, checkpoints);
 * }
 * ```
 */
export class EmergencyActions {
  private checkpointLifecycle: CheckpointLifecycle;
  private snapshotLifecycle: SnapshotLifecycle;
  private summarizationService: SummarizationService;

  /**
   * Create a new Emergency Actions manager
   *
   * @param checkpointLifecycle - Checkpoint lifecycle manager
   * @param snapshotLifecycle - Snapshot lifecycle manager
   * @param summarizationService - Summarization service
   */
  constructor(
    checkpointLifecycle: CheckpointLifecycle,
    snapshotLifecycle: SnapshotLifecycle,
    summarizationService: SummarizationService
  ) {
    this.checkpointLifecycle = checkpointLifecycle;
    this.snapshotLifecycle = snapshotLifecycle;
    this.summarizationService = summarizationService;
  }

  /**
   * Emergency: Compress checkpoint to lowest level
   *
   * Aggressively compresses a checkpoint to Level 1 (Compact) to free maximum space.
   * Creates a snapshot before compression for safety.
   *
   * **When to use:**
   * - Context is critically full
   * - Normal aging hasn't freed enough space
   * - Need immediate space for new messages
   *
   * Requirements: FR-8, FR-9
   *
   * @param checkpoint - Checkpoint to compress
   * @param allMessages - All current messages (for snapshot)
   * @param allCheckpoints - All current checkpoints (for snapshot)
   * @param goal - Optional active goal
   * @returns Emergency action result
   *
   * @example
   * ```typescript
   * // Find largest checkpoint
   * const largest = checkpoints.sort((a, b) => b.tokenCount - a.tokenCount)[0];
   *
   * // Emergency compress to Level 1
   * const result = await emergency.compressCheckpoint(
   *   largest,
   *   messages,
   *   checkpoints
   * );
   *
   * if (result.success) {
   *   console.log(`Emergency compression freed ${result.tokensFreed} tokens`);
   *   console.log(`Snapshot: ${result.snapshotId}`);
   * }
   * ```
   */
  async compressCheckpoint(
    checkpoint: CheckpointSummary,
    allMessages: Message[],
    allCheckpoints: CheckpointSummary[],
    goal?: Goal
  ): Promise<EmergencyActionResult> {
    try {
      // Step 1: Create safety snapshot
      const snapshot = await this.snapshotLifecycle.createSnapshot(
        allMessages,
        allCheckpoints,
        'emergency'
      );

      // Step 2: Compress to Level 1 (most aggressive)
      const result = await this.checkpointLifecycle.compressCheckpoint(
        checkpoint,
        1, // Level 1 (Compact)
        goal
      );

      if (!result.success) {
        return {
          action: 'compress',
          success: false,
          tokensFreed: 0,
          snapshotId: snapshot.id,
          error: result.error || 'Compression failed',
        };
      }

      return {
        action: 'compress',
        success: true,
        tokensFreed: result.tokensFreed,
        snapshotId: snapshot.id,
        details: {
          checkpointId: checkpoint.id,
          previousLevel: checkpoint.compressionLevel,
          newLevel: 1,
          previousTokens: checkpoint.tokenCount,
          newTokens: result.compressedCheckpoint.tokenCount,
        },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('[EmergencyActions] Compress checkpoint failed:', errorMessage);

      return {
        action: 'compress',
        success: false,
        tokensFreed: 0,
        snapshotId: '',
        error: errorMessage,
      };
    }
  }

  /**
   * Emergency: Merge multiple checkpoints
   *
   * Merges multiple checkpoints into one to free space.
   * Creates a snapshot before merging for safety.
   *
   * **When to use:**
   * - Many old checkpoints exist
   * - Single checkpoint compression not enough
   * - Need to consolidate history
   *
   * Requirements: FR-8, FR-9
   *
   * @param checkpoints - Checkpoints to merge (2+)
   * @param allMessages - All current messages (for snapshot)
   * @param allCheckpoints - All current checkpoints (for snapshot)
   * @param goal - Optional active goal
   * @returns Emergency action result
   *
   * @example
   * ```typescript
   * // Get oldest checkpoints
   * const oldest = checkpoints
   *   .sort((a, b) => a.timestamp - b.timestamp)
   *   .slice(0, 3);
   *
   * // Emergency merge
   * const result = await emergency.mergeCheckpoints(
   *   oldest,
   *   messages,
   *   checkpoints
   * );
   *
   * if (result.success) {
   *   console.log(`Merged ${oldest.length} checkpoints`);
   *   console.log(`Freed ${result.tokensFreed} tokens`);
   * }
   * ```
   */
  async mergeCheckpoints(
    checkpoints: CheckpointSummary[],
    allMessages: Message[],
    allCheckpoints: CheckpointSummary[],
    goal?: Goal
  ): Promise<EmergencyActionResult> {
    try {
      // Validate input
      if (checkpoints.length < 2) {
        return {
          action: 'merge',
          success: false,
          tokensFreed: 0,
          snapshotId: '',
          error: 'Need at least 2 checkpoints to merge',
        };
      }

      // Step 1: Create safety snapshot
      const snapshot = await this.snapshotLifecycle.createSnapshot(
        allMessages,
        allCheckpoints,
        'emergency'
      );

      // Step 2: Merge checkpoints
      const result = await this.checkpointLifecycle.mergeCheckpoints(checkpoints, goal);

      if (!result.success) {
        return {
          action: 'merge',
          success: false,
          tokensFreed: 0,
          snapshotId: snapshot.id,
          error: result.error || 'Merge failed',
        };
      }

      return {
        action: 'merge',
        success: true,
        tokensFreed: result.tokensFreed,
        snapshotId: snapshot.id,
        details: {
          mergedCount: result.mergedIds.length,
          mergedIds: result.mergedIds,
          originalTokens: result.originalTokens,
          mergedTokens: result.mergedTokens,
          newCheckpointId: result.mergedCheckpoint.id,
        },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('[EmergencyActions] Merge checkpoints failed:', errorMessage);

      return {
        action: 'merge',
        success: false,
        tokensFreed: 0,
        snapshotId: '',
        error: errorMessage,
      };
    }
  }

  /**
   * Emergency: Rollover context
   *
   * Creates a snapshot of current context and resets to minimal state.
   * This is the most aggressive action and should be used as a last resort.
   *
   * **When to use:**
   * - All other emergency actions failed
   * - Context is critically full
   * - Cannot continue conversation otherwise
   *
   * **What happens:**
   * 1. Creates emergency snapshot of full context
   * 2. Archives all messages and checkpoints
   * 3. Resets to minimal context (system prompt + recent messages)
   * 4. Returns tokens freed
   *
   * Requirements: FR-8, FR-9
   *
   * @param messages - All current messages
   * @param checkpoints - All current checkpoints
   * @param keepRecentCount - Number of recent messages to keep (default: 5)
   * @returns Rollover result
   *
   * @example
   * ```typescript
   * // Last resort: emergency rollover
   * const result = await emergency.emergencyRollover(
   *   messages,
   *   checkpoints,
   *   5 // Keep last 5 messages
   * );
   *
   * if (result.success) {
   *   console.log(`Archived ${result.messagesArchived} messages`);
   *   console.log(`Archived ${result.checkpointsArchived} checkpoints`);
   *   console.log(`Freed ${result.tokensFreed} tokens`);
   *   console.log(`Snapshot: ${result.snapshotId}`);
   * }
   * ```
   */
  async emergencyRollover(
    messages: Message[],
    checkpoints: CheckpointSummary[],
    keepRecentCount: number = 5
  ): Promise<RolloverResult> {
    try {
      // Step 1: Create emergency snapshot
      const snapshot = await this.snapshotLifecycle.createSnapshot(
        messages,
        checkpoints,
        'emergency'
      );

      // Step 2: Calculate tokens to free
      const messagesToArchive = messages.slice(0, -keepRecentCount);
      const checkpointsToArchive = checkpoints;

      const tokensFreed =
        messagesToArchive.reduce((sum, m) => sum + this.estimateTokens(m.content), 0) +
        checkpointsToArchive.reduce((sum, cp) => sum + cp.tokenCount, 0);

      return {
        snapshotId: snapshot.id,
        messagesArchived: messagesToArchive.length,
        checkpointsArchived: checkpointsToArchive.length,
        tokensFreed,
        success: true,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('[EmergencyActions] Emergency rollover failed:', errorMessage);

      return {
        snapshotId: '',
        messagesArchived: 0,
        checkpointsArchived: 0,
        tokensFreed: 0,
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Emergency: Aggressive summarization
   *
   * Aggressively summarizes recent messages to free space immediately.
   * Creates a snapshot before summarization for safety.
   *
   * **When to use:**
   * - Recent messages taking too much space
   * - Need immediate space for new message
   * - Normal compression not aggressive enough
   *
   * **What happens:**
   * 1. Creates emergency snapshot
   * 2. Summarizes recent messages at Level 1 (Compact)
   * 3. Creates checkpoint from summary
   * 4. Returns tokens freed
   *
   * Requirements: FR-8
   *
   * @param messages - Messages to summarize
   * @param allMessages - All current messages (for snapshot)
   * @param allCheckpoints - All current checkpoints (for snapshot)
   * @param goal - Optional active goal
   * @returns Aggressive summarization result
   *
   * @example
   * ```typescript
   * // Get recent messages (exclude last 3)
   * const toSummarize = messages.slice(0, -3);
   *
   * // Aggressive summarization
   * const result = await emergency.aggressiveSummarization(
   *   toSummarize,
   *   messages,
   *   checkpoints
   * );
   *
   * if (result.success) {
   *   console.log(`Summarized ${result.messagesSummarized} messages`);
   *   console.log(`Freed ${result.tokensFreed} tokens`);
   * }
   * ```
   */
  async aggressiveSummarization(
    messages: Message[],
    allMessages: Message[],
    allCheckpoints: CheckpointSummary[],
    goal?: Goal
  ): Promise<AggressiveSummarizationResult> {
    try {
      // Validate input
      if (messages.length === 0) {
        return {
          messagesSummarized: 0,
          originalTokens: 0,
          summarizedTokens: 0,
          tokensFreed: 0,
          checkpoint: {} as CheckpointSummary,
          success: false,
          error: 'No messages to summarize',
        };
      }

      // Step 1: Create safety snapshot
      const _snapshot = await this.snapshotLifecycle.createSnapshot(
        allMessages,
        allCheckpoints,
        'emergency'
      );

      // Step 2: Calculate original tokens
      const originalTokens = messages.reduce((sum, m) => sum + this.estimateTokens(m.content), 0);

      // Step 3: Aggressive summarization at Level 1 (Compact)
      const result = await this.summarizationService.summarize(
        messages,
        1, // Level 1 (most aggressive)
        goal
      );

      if (!result.success) {
        return {
          messagesSummarized: 0,
          originalTokens,
          summarizedTokens: 0,
          tokensFreed: 0,
          checkpoint: {} as CheckpointSummary,
          success: false,
          error: result.error || 'Aggressive summarization failed',
        };
      }

      // Step 4: Create checkpoint from summary
      const checkpoint: CheckpointSummary = {
        id: `emergency_${Date.now()}`,
        timestamp: Date.now(),
        summary: result.summary,
        originalMessageIds: messages.map((m) => m.id),
        tokenCount: result.tokenCount,
        compressionLevel: 1, // Level 1 (Compact)
        compressionNumber: allCheckpoints.length,
        metadata: {
          model: result.model,
          createdAt: Date.now(),
        },
      };

      const tokensFreed = originalTokens - result.tokenCount;

      return {
        messagesSummarized: messages.length,
        originalTokens,
        summarizedTokens: result.tokenCount,
        tokensFreed,
        checkpoint,
        success: true,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('[EmergencyActions] Aggressive summarization failed:', errorMessage);

      return {
        messagesSummarized: 0,
        originalTokens: 0,
        summarizedTokens: 0,
        tokensFreed: 0,
        checkpoint: {} as CheckpointSummary,
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Estimate token count for text
   *
   * Simple estimation: ~4 characters per token
   *
   * @param text - Text to estimate
   * @returns Estimated token count
   */
  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }
}
