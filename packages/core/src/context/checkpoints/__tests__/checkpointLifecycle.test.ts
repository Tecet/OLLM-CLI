/**
 * Unit Tests for Checkpoint Lifecycle
 *
 * Tests edge cases and specific scenarios for checkpoint aging, merging, and compression.
 *
 * Requirements: FR-2
 */

import { describe, it, expect, beforeEach } from 'vitest';

import { SummarizationService } from '../../compression/summarizationService.js';
import { CheckpointLifecycle } from '../checkpointLifecycle.js';

import type { ProviderAdapter } from '../../../provider/types.js';
import type { CheckpointSummary } from '../../types/storageTypes.js';

// ============================================================================
// Mock Provider
// ============================================================================

class MockProvider implements Partial<ProviderAdapter> {
  name = 'mock';
  
  async *chatStream(request: any) {
    // Extract the original content length to generate appropriately sized summary
    const originalContent = request.messages[0]?.content || '';
    const originalLength = originalContent.length;
    
    // Generate a summary that's shorter than the original
    const summaryLength = Math.max(50, Math.floor(originalLength * 0.5));
    const summary = 'Summarized conversation content. '.repeat(Math.ceil(summaryLength / 33)).slice(0, summaryLength);
    
    yield { type: 'text' as const, value: summary };
    yield { type: 'finish' as const, reason: 'stop' as const };
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

function createCheckpoint(
  id: string,
  level: 1 | 2 | 3,
  compressionNumber: number,
  tokenCount: number = 200
): CheckpointSummary {
  // Create a longer summary to avoid validation issues
  const baseSummary = `This is a detailed summary for checkpoint ${id}. It contains information about the conversation segment that was compressed, including key decisions made, important context discussed, and relevant details that need to be preserved for future reference.`;
  
  return {
    id,
    timestamp: Date.now(),
    summary: baseSummary,
    originalMessageIds: [`msg_${id}_1`, `msg_${id}_2`],
    tokenCount,
    compressionLevel: level,
    compressionNumber,
    metadata: {
      model: 'test-model',
      createdAt: Date.now(),
    },
  };
}

// ============================================================================
// Edge Case Tests
// ============================================================================

describe('CheckpointLifecycle - Edge Cases', () => {
  let lifecycle: CheckpointLifecycle;
  let summarizationService: SummarizationService;

  beforeEach(() => {
    const mockProvider = new MockProvider() as ProviderAdapter;
    summarizationService = new SummarizationService({
      provider: mockProvider,
      model: 'test-model',
    });
    lifecycle = new CheckpointLifecycle(summarizationService);
  });

  // ==========================================================================
  // Single Checkpoint Tests
  // ==========================================================================

  describe('Single Checkpoint', () => {
    it('should handle aging a single checkpoint', async () => {
      const checkpoint = createCheckpoint('ckpt1', 3, 0);
      const currentCompressionNumber = 10; // Old enough to age to Level 1

      const results = await lifecycle.ageCheckpoints([checkpoint], currentCompressionNumber);

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(true);
      expect(results[0].newLevel).toBe(1); // Should age to Level 1
    });

    it('should handle merging a single checkpoint (should fail)', async () => {
      const checkpoint = createCheckpoint('ckpt1', 1, 0);

      const result = await lifecycle.mergeCheckpoints([checkpoint]);

      expect(result.success).toBe(false);
      expect(result.error).toContain('at least 2 checkpoints');
    });

    it('should handle compressing a single checkpoint', async () => {
      const checkpoint = createCheckpoint('ckpt1', 3, 0, 300);

      const result = await lifecycle.compressCheckpoint(checkpoint, 1);

      expect(result.success).toBe(true);
      expect(result.compressedCheckpoint.compressionLevel).toBe(1);
      expect(result.tokensFreed).toBeGreaterThan(0);
    });

    it('should not age a checkpoint that is already at target level', async () => {
      const checkpoint = createCheckpoint('ckpt1', 1, 0); // Already Level 1
      const currentCompressionNumber = 10; // Would target Level 1

      const results = await lifecycle.ageCheckpoints([checkpoint], currentCompressionNumber);

      expect(results).toHaveLength(0); // No aging needed
    });

    it('should not compress a checkpoint to same or higher level', async () => {
      const checkpoint = createCheckpoint('ckpt1', 2, 0);

      const result = await lifecycle.compressCheckpoint(checkpoint, 2); // Same level

      expect(result.success).toBe(false);
      expect(result.error).toContain('must be lower than current level');
    });
  });

  // ==========================================================================
  // No Checkpoints Tests
  // ==========================================================================

  describe('No Checkpoints', () => {
    it('should handle aging with no checkpoints', async () => {
      const results = await lifecycle.ageCheckpoints([], 10);

      expect(results).toHaveLength(0);
    });

    it('should handle merging with no checkpoints', async () => {
      const result = await lifecycle.mergeCheckpoints([]);

      expect(result.success).toBe(false);
      expect(result.error).toContain('at least 2 checkpoints');
    });

    it('should return empty array for checkpoints needing aging when none exist', () => {
      const checkpoints = lifecycle.getCheckpointsNeedingAging([], 10);

      expect(checkpoints).toHaveLength(0);
    });

    it('should return empty array for checkpoints eligible for merging when none exist', () => {
      const checkpoints = lifecycle.getCheckpointsEligibleForMerging([]);

      expect(checkpoints).toHaveLength(0);
    });
  });

  // ==========================================================================
  // Maximum Checkpoints Tests
  // ==========================================================================

  describe('Maximum Checkpoints', () => {
    it('should handle aging many checkpoints', async () => {
      // Create 20 checkpoints at various ages
      const checkpoints: CheckpointSummary[] = [];
      for (let i = 0; i < 20; i++) {
        checkpoints.push(createCheckpoint(`ckpt${i}`, 3, i));
      }

      const currentCompressionNumber = 20;
      const results = await lifecycle.ageCheckpoints(checkpoints, currentCompressionNumber);

      // Checkpoints 0-10 should be aged (age >= 10)
      expect(results.length).toBeGreaterThan(0);
      expect(results.every(r => r.success)).toBe(true);
    });

    it('should handle merging many checkpoints', async () => {
      // Create 10 Level 1 checkpoints
      const checkpoints: CheckpointSummary[] = [];
      for (let i = 0; i < 10; i++) {
        checkpoints.push(createCheckpoint(`ckpt${i}`, 1, 0, 100));
      }

      const result = await lifecycle.mergeCheckpoints(checkpoints);

      expect(result.success).toBe(true);
      expect(result.mergedIds).toHaveLength(10);
      expect(result.mergedCheckpoint.originalMessageIds).toHaveLength(20); // 10 checkpoints * 2 messages each
    });

    it('should identify all checkpoints needing aging', () => {
      // Create checkpoints at various ages
      const checkpoints: CheckpointSummary[] = [
        createCheckpoint('ckpt1', 3, 0), // Age 15 - needs aging to Level 1
        createCheckpoint('ckpt2', 3, 5), // Age 10 - needs aging to Level 1
        createCheckpoint('ckpt3', 3, 10), // Age 5 - needs aging to Level 2
        createCheckpoint('ckpt4', 3, 12), // Age 3 - no aging needed
        createCheckpoint('ckpt5', 2, 8), // Age 7 - needs aging to Level 2 (already there)
        createCheckpoint('ckpt6', 1, 0), // Age 15 - already Level 1
      ];

      const currentCompressionNumber = 15;
      const needingAging = lifecycle.getCheckpointsNeedingAging(checkpoints, currentCompressionNumber);

      // Only checkpoints that need to go to a lower level
      expect(needingAging).toHaveLength(3); // ckpt1, ckpt2, ckpt3
    });

    it('should identify checkpoints eligible for merging', () => {
      const checkpoints: CheckpointSummary[] = [
        createCheckpoint('ckpt1', 1, 0),
        createCheckpoint('ckpt2', 1, 0),
        createCheckpoint('ckpt3', 1, 0),
        createCheckpoint('ckpt4', 2, 0), // Not Level 1
        createCheckpoint('ckpt5', 3, 0), // Not Level 1
      ];

      const eligible = lifecycle.getCheckpointsEligibleForMerging(checkpoints, 3);

      expect(eligible).toHaveLength(3); // Only Level 1 checkpoints
    });

    it('should not return checkpoints for merging if below minimum count', () => {
      const checkpoints: CheckpointSummary[] = [
        createCheckpoint('ckpt1', 1, 0),
        createCheckpoint('ckpt2', 1, 0),
      ];

      const eligible = lifecycle.getCheckpointsEligibleForMerging(checkpoints, 3);

      expect(eligible).toHaveLength(0); // Below minimum of 3
    });
  });

  // ==========================================================================
  // Aging Level Transitions
  // ==========================================================================

  describe('Aging Level Transitions', () => {
    it('should age Level 3 to Level 2 for age 5-9', async () => {
      const checkpoint = createCheckpoint('ckpt1', 3, 0);
      const currentCompressionNumber = 7; // Age 7

      const results = await lifecycle.ageCheckpoints([checkpoint], currentCompressionNumber);

      expect(results).toHaveLength(1);
      expect(results[0].newLevel).toBe(2);
    });

    it('should age Level 3 to Level 1 for age >= 10', async () => {
      const checkpoint = createCheckpoint('ckpt1', 3, 0);
      const currentCompressionNumber = 15; // Age 15

      const results = await lifecycle.ageCheckpoints([checkpoint], currentCompressionNumber);

      expect(results).toHaveLength(1);
      expect(results[0].newLevel).toBe(1);
    });

    it('should age Level 2 to Level 1 for age >= 10', async () => {
      const checkpoint = createCheckpoint('ckpt1', 2, 0);
      const currentCompressionNumber = 12; // Age 12

      const results = await lifecycle.ageCheckpoints([checkpoint], currentCompressionNumber);

      expect(results).toHaveLength(1);
      expect(results[0].newLevel).toBe(1);
    });

    it('should not age Level 3 for age < 5', async () => {
      const checkpoint = createCheckpoint('ckpt1', 3, 10);
      const currentCompressionNumber = 13; // Age 3

      const results = await lifecycle.ageCheckpoints([checkpoint], currentCompressionNumber);

      expect(results).toHaveLength(0); // No aging needed
    });
  });

  // ==========================================================================
  // Token Counting
  // ==========================================================================

  describe('Token Counting', () => {
    it('should accurately calculate tokens freed by aging', async () => {
      const checkpoint = createCheckpoint('ckpt1', 3, 0, 300);
      const currentCompressionNumber = 10;

      const results = await lifecycle.ageCheckpoints([checkpoint], currentCompressionNumber);

      expect(results).toHaveLength(1);
      expect(results[0].tokensFreed).toBeGreaterThanOrEqual(0);
      expect(results[0].tokensFreed).toBe(
        checkpoint.tokenCount - results[0].agedCheckpoint.tokenCount
      );
    });

    it('should accurately calculate tokens freed by merging', async () => {
      const checkpoints = [
        createCheckpoint('ckpt1', 1, 0, 100),
        createCheckpoint('ckpt2', 1, 0, 150),
        createCheckpoint('ckpt3', 1, 0, 120),
      ];

      const result = await lifecycle.mergeCheckpoints(checkpoints);

      expect(result.success).toBe(true);
      expect(result.originalTokens).toBe(370); // 100 + 150 + 120
      expect(result.tokensFreed).toBe(result.originalTokens - result.mergedTokens);
    });

    it('should accurately calculate tokens freed by compression', async () => {
      const checkpoint = createCheckpoint('ckpt1', 3, 0, 400);

      const result = await lifecycle.compressCheckpoint(checkpoint, 1);

      expect(result.success).toBe(true);
      expect(result.tokensFreed).toBeGreaterThanOrEqual(0);
      expect(result.tokensFreed).toBe(
        checkpoint.tokenCount - result.compressedCheckpoint.tokenCount
      );
    });
  });

  // ==========================================================================
  // Metadata Preservation
  // ==========================================================================

  describe('Metadata Preservation', () => {
    it('should preserve original message IDs when aging', async () => {
      const checkpoint = createCheckpoint('ckpt1', 3, 0);
      const originalIds = checkpoint.originalMessageIds;
      const currentCompressionNumber = 10;

      const results = await lifecycle.ageCheckpoints([checkpoint], currentCompressionNumber);

      expect(results[0].agedCheckpoint.originalMessageIds).toEqual(originalIds);
    });

    it('should combine original message IDs when merging', async () => {
      const checkpoints = [
        createCheckpoint('ckpt1', 1, 0),
        createCheckpoint('ckpt2', 1, 0),
      ];

      const result = await lifecycle.mergeCheckpoints(checkpoints);

      expect(result.success).toBe(true);
      expect(result.mergedCheckpoint.originalMessageIds).toEqual([
        ...checkpoints[0].originalMessageIds,
        ...checkpoints[1].originalMessageIds,
      ]);
    });

    it('should preserve original message IDs when compressing', async () => {
      const checkpoint = createCheckpoint('ckpt1', 3, 0);
      const originalIds = checkpoint.originalMessageIds;

      const result = await lifecycle.compressCheckpoint(checkpoint, 1);

      expect(result.compressedCheckpoint.originalMessageIds).toEqual(originalIds);
    });

    it('should update compressedAt timestamp when aging', async () => {
      const checkpoint = createCheckpoint('ckpt1', 3, 0);
      const currentCompressionNumber = 10;

      const results = await lifecycle.ageCheckpoints([checkpoint], currentCompressionNumber);

      expect(results[0].agedCheckpoint.metadata.compressedAt).toBeDefined();
      expect(results[0].agedCheckpoint.metadata.compressedAt).toBeGreaterThan(0);
    });

    it('should set compressedAt timestamp when merging', async () => {
      const checkpoints = [
        createCheckpoint('ckpt1', 1, 0),
        createCheckpoint('ckpt2', 1, 0),
      ];

      const result = await lifecycle.mergeCheckpoints(checkpoints);

      expect(result.mergedCheckpoint.metadata.compressedAt).toBeDefined();
      expect(result.mergedCheckpoint.metadata.compressedAt).toBeGreaterThan(0);
    });

    it('should use latest compression number when merging', async () => {
      const checkpoints = [
        createCheckpoint('ckpt1', 1, 5),
        createCheckpoint('ckpt2', 1, 10),
        createCheckpoint('ckpt3', 1, 7),
      ];

      const result = await lifecycle.mergeCheckpoints(checkpoints);

      expect(result.mergedCheckpoint.compressionNumber).toBe(10); // Max of 5, 10, 7
    });
  });
});
