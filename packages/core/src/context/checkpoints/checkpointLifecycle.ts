/**
 * Checkpoint Lifecycle Manager
 *
 * Manages the lifecycle of checkpoints including:
 * - Aging checkpoints over time (Level 3 → 2 → 1)
 * - Merging multiple checkpoints into one
 * - Re-compressing checkpoints at lower levels
 * - LLM re-summarization for aging
 *
 * Checkpoint aging strategy:
 * - Level 3 (Detailed): Recent checkpoints (1-4 compressions old)
 * - Level 2 (Moderate): Older checkpoints (5-9 compressions old)
 * - Level 1 (Compact): Ancient checkpoints (10+ compressions old)
 * - Merged: Multiple Level 1 checkpoints combined into one
 *
 * Requirements: FR-2, FR-6
 *
 * @module checkpointLifecycle
 */

import type { SummarizationService } from '../compression/summarizationService.js';
import type { Goal } from '../goalTypes.js';
import type { CheckpointSummary } from '../types/storageTypes.js';

/**
 * Aging result for a checkpoint
 */
export interface AgingResult {
  /** Original checkpoint ID */
  originalId: string;
  /** New checkpoint after aging */
  agedCheckpoint: CheckpointSummary;
  /** Previous compression level */
  previousLevel: 1 | 2 | 3;
  /** New compression level */
  newLevel: 1 | 2 | 3;
  /** Tokens freed by aging */
  tokensFreed: number;
  /** Whether aging succeeded */
  success: boolean;
  /** Error message if failed */
  error?: string;
}

/**
 * Merge result for multiple checkpoints
 */
export interface MergeResult {
  /** IDs of checkpoints that were merged */
  mergedIds: string[];
  /** New merged checkpoint */
  mergedCheckpoint: CheckpointSummary;
  /** Total tokens before merge */
  originalTokens: number;
  /** Tokens after merge */
  mergedTokens: number;
  /** Tokens freed by merge */
  tokensFreed: number;
  /** Whether merge succeeded */
  success: boolean;
  /** Error message if failed */
  error?: string;
}

/**
 * Compression result for a checkpoint
 */
export interface CompressionResult {
  /** Original checkpoint ID */
  originalId: string;
  /** New compressed checkpoint */
  compressedCheckpoint: CheckpointSummary;
  /** Tokens freed by compression */
  tokensFreed: number;
  /** Whether compression succeeded */
  success: boolean;
  /** Error message if failed */
  error?: string;
}

/**
 * Checkpoint Lifecycle Manager
 *
 * Manages checkpoint aging, merging, and re-compression.
 * Uses LLM to create new summaries at different compression levels.
 *
 * @example
 * ```typescript
 * const lifecycle = new CheckpointLifecycle(summarizationService);
 *
 * // Age old checkpoints
 * const results = await lifecycle.ageCheckpoints(checkpoints, currentCompressionNumber);
 *
 * // Merge multiple checkpoints
 * const mergeResult = await lifecycle.mergeCheckpoints(oldCheckpoints);
 *
 * // Compress a single checkpoint
 * const compressResult = await lifecycle.compressCheckpoint(checkpoint, 1);
 * ```
 */
export class CheckpointLifecycle {
  private summarizationService: SummarizationService;

  /**
   * Create a new Checkpoint Lifecycle Manager
   *
   * @param summarizationService - Service for LLM summarization
   */
  constructor(summarizationService: SummarizationService) {
    this.summarizationService = summarizationService;
  }

  /**
   * Age checkpoints based on compression number
   *
   * Determines which checkpoints need aging and re-summarizes them at lower levels.
   *
   * Aging rules:
   * - Checkpoints 1-4 compressions old: Level 3 (Detailed)
   * - Checkpoints 5-9 compressions old: Level 2 (Moderate)
   * - Checkpoints 10+ compressions old: Level 1 (Compact)
   *
   * Requirements: FR-2, FR-6
   *
   * @param checkpoints - Current checkpoints
   * @param currentCompressionNumber - Current compression count
   * @param goal - Optional active goal for context
   * @returns Array of aging results
   *
   * @example
   * ```typescript
   * const results = await lifecycle.ageCheckpoints(checkpoints, 10);
   * for (const result of results) {
   *   if (result.success) {
   *     console.log(`Aged checkpoint ${result.originalId}: Level ${result.previousLevel} → ${result.newLevel}`);
   *     console.log(`Freed ${result.tokensFreed} tokens`);
   *   }
   * }
   * ```
   */
  async ageCheckpoints(
    checkpoints: CheckpointSummary[],
    currentCompressionNumber: number,
    goal?: Goal
  ): Promise<AgingResult[]> {
    const results: AgingResult[] = [];

    for (const checkpoint of checkpoints) {
      // Calculate age (how many compressions ago was this checkpoint created)
      const age = currentCompressionNumber - checkpoint.compressionNumber;

      // Determine target level based on age
      const targetLevel = this.determineTargetLevel(age);

      // Skip if already at target level or lower
      if (checkpoint.compressionLevel <= targetLevel) {
        continue;
      }

      // Age the checkpoint
      const result = await this.ageCheckpoint(checkpoint, targetLevel, goal);
      results.push(result);
    }

    return results;
  }

  /**
   * Determine target compression level based on age
   *
   * @param age - Number of compressions since checkpoint creation
   * @returns Target compression level
   */
  private determineTargetLevel(age: number): 1 | 2 | 3 {
    if (age >= 10) {
      return 1; // Compact
    } else if (age >= 5) {
      return 2; // Moderate
    } else {
      return 3; // Detailed
    }
  }

  /**
   * Age a single checkpoint to a lower level
   *
   * @param checkpoint - Checkpoint to age
   * @param targetLevel - Target compression level
   * @param goal - Optional active goal
   * @returns Aging result
   */
  private async ageCheckpoint(
    checkpoint: CheckpointSummary,
    targetLevel: 1 | 2 | 3,
    goal?: Goal
  ): Promise<AgingResult> {
    try {
      // Re-summarize at target level
      const result = await this.summarizationService.summarize(
        [
          {
            role: 'assistant',
            content: checkpoint.summary,
            id: checkpoint.id,
            timestamp: new Date(checkpoint.timestamp),
          },
        ],
        targetLevel,
        goal
      );

      if (!result.success) {
        return {
          originalId: checkpoint.id,
          agedCheckpoint: checkpoint,
          previousLevel: checkpoint.compressionLevel,
          newLevel: targetLevel,
          tokensFreed: 0,
          success: false,
          error: result.error || 'Summarization failed',
        };
      }

      // Create aged checkpoint
      const agedCheckpoint: CheckpointSummary = {
        ...checkpoint,
        summary: result.summary,
        tokenCount: result.tokenCount,
        compressionLevel: targetLevel,
        metadata: {
          ...checkpoint.metadata,
          compressedAt: Date.now(),
        },
      };

      const tokensFreed = checkpoint.tokenCount - result.tokenCount;

      return {
        originalId: checkpoint.id,
        agedCheckpoint,
        previousLevel: checkpoint.compressionLevel,
        newLevel: targetLevel,
        tokensFreed,
        success: true,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('[CheckpointLifecycle] Aging failed:', errorMessage);

      return {
        originalId: checkpoint.id,
        agedCheckpoint: checkpoint,
        previousLevel: checkpoint.compressionLevel,
        newLevel: targetLevel,
        tokensFreed: 0,
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Merge multiple checkpoints into one
   *
   * Combines multiple checkpoints (typically Level 1) into a single merged checkpoint.
   * Useful for freeing space when there are many old checkpoints.
   *
   * Requirements: FR-2, FR-6
   *
   * @param checkpoints - Checkpoints to merge (should be 2+)
   * @param goal - Optional active goal for context
   * @returns Merge result
   *
   * @example
   * ```typescript
   * const oldCheckpoints = checkpoints.filter(c => c.compressionLevel === 1);
   * const result = await lifecycle.mergeCheckpoints(oldCheckpoints);
   * if (result.success) {
   *   console.log(`Merged ${result.mergedIds.length} checkpoints`);
   *   console.log(`Freed ${result.tokensFreed} tokens`);
   * }
   * ```
   */
  async mergeCheckpoints(checkpoints: CheckpointSummary[], goal?: Goal): Promise<MergeResult> {
    if (checkpoints.length < 2) {
      return {
        mergedIds: [],
        mergedCheckpoint: checkpoints[0],
        originalTokens: 0,
        mergedTokens: 0,
        tokensFreed: 0,
        success: false,
        error: 'Need at least 2 checkpoints to merge',
      };
    }

    try {
      // Calculate original token count
      const originalTokens = checkpoints.reduce((sum, cp) => sum + cp.tokenCount, 0);

      // Combine summaries
      const combinedSummary = checkpoints
        .map((cp, index) => `[Segment ${index + 1}] ${cp.summary}`)
        .join('\n\n');

      // Re-summarize combined content at Level 1 (Compact)
      const result = await this.summarizationService.summarize(
        [
          {
            role: 'assistant',
            content: combinedSummary,
            id: 'merge-temp',
            timestamp: new Date(),
          },
        ],
        1, // Always merge at Level 1 (Compact)
        goal
      );

      if (!result.success) {
        return {
          mergedIds: checkpoints.map((cp) => cp.id),
          mergedCheckpoint: checkpoints[0],
          originalTokens,
          mergedTokens: 0,
          tokensFreed: 0,
          success: false,
          error: result.error || 'Merge summarization failed',
        };
      }

      // Create merged checkpoint
      const mergedCheckpoint: CheckpointSummary = {
        id: `merged_${Date.now()}`,
        timestamp: Date.now(),
        summary: result.summary,
        originalMessageIds: checkpoints.flatMap((cp) => cp.originalMessageIds),
        tokenCount: result.tokenCount,
        compressionLevel: 1, // Merged checkpoints are always Level 1
        compressionNumber: Math.max(...checkpoints.map((cp) => cp.compressionNumber)),
        metadata: {
          model: result.model,
          createdAt: Date.now(),
          compressedAt: Date.now(),
        },
      };

      const tokensFreed = originalTokens - result.tokenCount;

      return {
        mergedIds: checkpoints.map((cp) => cp.id),
        mergedCheckpoint,
        originalTokens,
        mergedTokens: result.tokenCount,
        tokensFreed,
        success: true,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('[CheckpointLifecycle] Merge failed:', errorMessage);

      return {
        mergedIds: checkpoints.map((cp) => cp.id),
        mergedCheckpoint: checkpoints[0],
        originalTokens: checkpoints.reduce((sum, cp) => sum + cp.tokenCount, 0),
        mergedTokens: 0,
        tokensFreed: 0,
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Compress a checkpoint to a lower level
   *
   * Re-summarizes a checkpoint at a lower compression level to free tokens.
   * This is typically used in emergency situations when space is critically low.
   *
   * Requirements: FR-2, FR-6
   *
   * @param checkpoint - Checkpoint to compress
   * @param targetLevel - Target compression level (must be lower than current)
   * @param goal - Optional active goal for context
   * @returns Compression result
   *
   * @example
   * ```typescript
   * // Emergency: compress a Level 3 checkpoint to Level 1
   * const result = await lifecycle.compressCheckpoint(checkpoint, 1);
   * if (result.success) {
   *   console.log(`Freed ${result.tokensFreed} tokens`);
   * }
   * ```
   */
  async compressCheckpoint(
    checkpoint: CheckpointSummary,
    targetLevel: 1 | 2 | 3,
    goal?: Goal
  ): Promise<CompressionResult> {
    // Validate target level
    if (targetLevel >= checkpoint.compressionLevel) {
      return {
        originalId: checkpoint.id,
        compressedCheckpoint: checkpoint,
        tokensFreed: 0,
        success: false,
        error: `Target level ${targetLevel} must be lower than current level ${checkpoint.compressionLevel}`,
      };
    }

    try {
      // Re-summarize at target level
      const result = await this.summarizationService.summarize(
        [
          {
            role: 'assistant',
            content: checkpoint.summary,
            id: checkpoint.id,
            timestamp: new Date(checkpoint.timestamp),
          },
        ],
        targetLevel,
        goal
      );

      if (!result.success) {
        return {
          originalId: checkpoint.id,
          compressedCheckpoint: checkpoint,
          tokensFreed: 0,
          success: false,
          error: result.error || 'Compression summarization failed',
        };
      }

      // Create compressed checkpoint
      const compressedCheckpoint: CheckpointSummary = {
        ...checkpoint,
        summary: result.summary,
        tokenCount: result.tokenCount,
        compressionLevel: targetLevel,
        metadata: {
          ...checkpoint.metadata,
          compressedAt: Date.now(),
        },
      };

      const tokensFreed = checkpoint.tokenCount - result.tokenCount;

      return {
        originalId: checkpoint.id,
        compressedCheckpoint,
        tokensFreed,
        success: true,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('[CheckpointLifecycle] Compression failed:', errorMessage);

      return {
        originalId: checkpoint.id,
        compressedCheckpoint: checkpoint,
        tokensFreed: 0,
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Get checkpoints that need aging
   *
   * Returns checkpoints that should be aged based on current compression number.
   *
   * @param checkpoints - Current checkpoints
   * @param currentCompressionNumber - Current compression count
   * @returns Checkpoints that need aging
   */
  getCheckpointsNeedingAging(
    checkpoints: CheckpointSummary[],
    currentCompressionNumber: number
  ): CheckpointSummary[] {
    return checkpoints.filter((checkpoint) => {
      const age = currentCompressionNumber - checkpoint.compressionNumber;
      const targetLevel = this.determineTargetLevel(age);
      return checkpoint.compressionLevel > targetLevel;
    });
  }

  /**
   * Get checkpoints eligible for merging
   *
   * Returns Level 1 checkpoints that can be merged together.
   *
   * @param checkpoints - Current checkpoints
   * @param minCount - Minimum number of checkpoints to merge (default: 3)
   * @returns Checkpoints eligible for merging
   */
  getCheckpointsEligibleForMerging(
    checkpoints: CheckpointSummary[],
    minCount: number = 3
  ): CheckpointSummary[] {
    const level1Checkpoints = checkpoints.filter((cp) => cp.compressionLevel === 1);

    if (level1Checkpoints.length >= minCount) {
      return level1Checkpoints;
    }

    return [];
  }
}
