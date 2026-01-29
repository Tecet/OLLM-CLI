/**
 * Property-Based Tests for Checkpoint Lifecycle
 *
 * Tests universal properties that must hold for checkpoint aging, merging, and compression.
 *
 * **Property 16: Checkpoint Aging**
 * **Validates: Requirements FR-2, FR-6**
 *
 * **Property 17: Checkpoint Merging**
 * **Validates: Requirements FR-2, FR-6**
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { CheckpointLifecycle } from '../checkpointLifecycle.js';
import { SummarizationService } from '../../compression/summarizationService.js';
import type { CheckpointSummary } from '../../types/storageTypes.js';
import type { ProviderAdapter } from '../../../provider/types.js';

// ============================================================================
// Mock Provider
// ============================================================================

class MockProvider implements Partial<ProviderAdapter> {
  async *chatStream() {
    // Return a simple summary
    yield { type: 'text' as const, value: 'Summarized content' };
    yield { type: 'finish' as const, reason: 'stop' as const };
  }
}

// ============================================================================
// Arbitraries
// ============================================================================

/**
 * Generate a valid checkpoint summary
 */
const checkpointArbitrary = (
  level: 1 | 2 | 3 = 3,
  compressionNumber: number = 0
): fc.Arbitrary<CheckpointSummary> =>
  fc.record({
    id: fc.uuid(),
    timestamp: fc.integer({ min: 1000000000000, max: Date.now() }),
    summary: fc.string({ minLength: 20, maxLength: 500 }),
    originalMessageIds: fc.array(fc.uuid(), { minLength: 1, maxLength: 10 }),
    tokenCount: fc.integer({ min: 50, max: 500 }),
    compressionLevel: fc.constant(level),
    compressionNumber: fc.constant(compressionNumber),
    metadata: fc.record({
      model: fc.constant('test-model'),
      createdAt: fc.integer({ min: 1000000000000, max: Date.now() }),
    }),
  });

/**
 * Generate an array of checkpoints with varying ages
 */
const checkpointsWithAgesArbitrary = fc
  .tuple(
    fc.integer({ min: 1, max: 5 }), // Number of checkpoints
    fc.integer({ min: 10, max: 20 }) // Current compression number
  )
  .chain(([count, currentNumber]) =>
    fc.tuple(
      fc.array(
        fc
          .integer({ min: 0, max: currentNumber - 1 })
          .chain(compressionNumber =>
            checkpointArbitrary(3, compressionNumber)
          ),
        { minLength: count, maxLength: count }
      ),
      fc.constant(currentNumber)
    )
  );

// ============================================================================
// Property 16: Checkpoint Aging
// ============================================================================

describe('Property 16: Checkpoint Aging', () => {
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

  it('Property: Aged checkpoints always have level <= target level', async () => {
    await fc.assert(
      fc.asyncProperty(checkpointsWithAgesArbitrary, async ([checkpoints, currentNumber]) => {
        // Age checkpoints
        const results = await lifecycle.ageCheckpoints(checkpoints, currentNumber);

        // Property: All successful aging results have level <= target level
        for (const result of results) {
          if (result.success) {
            expect(result.agedCheckpoint.compressionLevel).toBeLessThanOrEqual(
              result.newLevel
            );
          }
        }
      }),
      { numRuns: 20 } // Reduced runs for async tests
    );
  });

  it('Property: Aging never increases token count', async () => {
    await fc.assert(
      fc.asyncProperty(checkpointsWithAgesArbitrary, async ([checkpoints, currentNumber]) => {
        // Age checkpoints
        const results = await lifecycle.ageCheckpoints(checkpoints, currentNumber);

        // Property: Aging always reduces or maintains token count
        for (const result of results) {
          if (result.success) {
            expect(result.agedCheckpoint.tokenCount).toBeLessThanOrEqual(
              checkpoints.find(cp => cp.id === result.originalId)!.tokenCount
            );
          }
        }
      }),
      { numRuns: 20 }
    );
  });

  it('Property: Aging preserves checkpoint identity', async () => {
    await fc.assert(
      fc.asyncProperty(checkpointsWithAgesArbitrary, async ([checkpoints, currentNumber]) => {
        // Age checkpoints
        const results = await lifecycle.ageCheckpoints(checkpoints, currentNumber);

        // Property: Aged checkpoints maintain original ID and message IDs
        for (const result of results) {
          if (result.success) {
            const original = checkpoints.find(cp => cp.id === result.originalId)!;
            expect(result.agedCheckpoint.id).toBe(original.id);
            expect(result.agedCheckpoint.originalMessageIds).toEqual(
              original.originalMessageIds
            );
          }
        }
      }),
      { numRuns: 20 }
    );
  });

  it('Property: Aging respects age-based level rules', async () => {
    await fc.assert(
      fc.asyncProperty(checkpointsWithAgesArbitrary, async ([checkpoints, currentNumber]) => {
        // Age checkpoints
        const results = await lifecycle.ageCheckpoints(checkpoints, currentNumber);

        // Property: Checkpoints are aged according to age rules
        for (const result of results) {
          if (result.success) {
            const original = checkpoints.find(cp => cp.id === result.originalId)!;
            const age = currentNumber - original.compressionNumber;

            // Verify target level matches age rules
            if (age >= 10) {
              expect(result.newLevel).toBe(1);
            } else if (age >= 5) {
              expect(result.newLevel).toBeLessThanOrEqual(2);
            } else {
              expect(result.newLevel).toBeLessThanOrEqual(3);
            }
          }
        }
      }),
      { numRuns: 20 }
    );
  });

  it('Property: Only checkpoints needing aging are aged', async () => {
    await fc.assert(
      fc.asyncProperty(checkpointsWithAgesArbitrary, async ([checkpoints, currentNumber]) => {
        // Age checkpoints
        const results = await lifecycle.ageCheckpoints(checkpoints, currentNumber);

        // Property: Only checkpoints with level > target level are aged
        for (const checkpoint of checkpoints) {
          const age = currentNumber - checkpoint.compressionNumber;
          const targetLevel =
            age >= 10 ? 1 : age >= 5 ? 2 : 3;

          const wasAged = results.some(r => r.originalId === checkpoint.id);

          if (checkpoint.compressionLevel > targetLevel) {
            // Should be aged
            expect(wasAged).toBe(true);
          } else {
            // Should not be aged
            expect(wasAged).toBe(false);
          }
        }
      }),
      { numRuns: 20 }
    );
  });

  it('Property: tokensFreed is accurate', async () => {
    await fc.assert(
      fc.asyncProperty(checkpointsWithAgesArbitrary, async ([checkpoints, currentNumber]) => {
        // Age checkpoints
        const results = await lifecycle.ageCheckpoints(checkpoints, currentNumber);

        // Property: tokensFreed = original tokens - new tokens
        for (const result of results) {
          if (result.success) {
            const original = checkpoints.find(cp => cp.id === result.originalId)!;
            const expectedFreed = original.tokenCount - result.agedCheckpoint.tokenCount;
            expect(result.tokensFreed).toBe(expectedFreed);
          }
        }
      }),
      { numRuns: 20 }
    );
  });
});

// ============================================================================
// Property 17: Checkpoint Merging
// ============================================================================

describe('Property 17: Checkpoint Merging', () => {
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

  it('Property: Merged checkpoint contains all original message IDs', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(checkpointArbitrary(1, 0), { minLength: 2, maxLength: 5 }),
        async checkpoints => {
          // Merge checkpoints
          const result = await lifecycle.mergeCheckpoints(checkpoints);

          if (result.success) {
            // Property: Merged checkpoint contains all original message IDs
            const allOriginalIds = checkpoints.flatMap(cp => cp.originalMessageIds);
            expect(result.mergedCheckpoint.originalMessageIds).toEqual(allOriginalIds);
          }
        }
      ),
      { numRuns: 20 }
    );
  });

  it('Property: Merged checkpoint has level 1 (Compact)', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(checkpointArbitrary(1, 0), { minLength: 2, maxLength: 5 }),
        async checkpoints => {
          // Merge checkpoints
          const result = await lifecycle.mergeCheckpoints(checkpoints);

          if (result.success) {
            // Property: Merged checkpoints are always Level 1
            expect(result.mergedCheckpoint.compressionLevel).toBe(1);
          }
        }
      ),
      { numRuns: 20 }
    );
  });

  it('Property: Merging reduces total token count', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(checkpointArbitrary(1, 0), { minLength: 2, maxLength: 5 }),
        async checkpoints => {
          // Merge checkpoints
          const result = await lifecycle.mergeCheckpoints(checkpoints);

          if (result.success) {
            // Property: Merged token count < sum of original token counts
            const originalTotal = checkpoints.reduce((sum, cp) => sum + cp.tokenCount, 0);
            expect(result.mergedCheckpoint.tokenCount).toBeLessThan(originalTotal);
          }
        }
      ),
      { numRuns: 20 }
    );
  });

  it('Property: tokensFreed is accurate for merging', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(checkpointArbitrary(1, 0), { minLength: 2, maxLength: 5 }),
        async checkpoints => {
          // Merge checkpoints
          const result = await lifecycle.mergeCheckpoints(checkpoints);

          if (result.success) {
            // Property: tokensFreed = original total - merged total
            const expectedFreed = result.originalTokens - result.mergedTokens;
            expect(result.tokensFreed).toBe(expectedFreed);
          }
        }
      ),
      { numRuns: 20 }
    );
  });

  it('Property: Merging requires at least 2 checkpoints', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(checkpointArbitrary(1, 0), { minLength: 0, maxLength: 1 }),
        async checkpoints => {
          // Merge checkpoints
          const result = await lifecycle.mergeCheckpoints(checkpoints);

          // Property: Merging < 2 checkpoints fails
          expect(result.success).toBe(false);
          expect(result.error).toContain('at least 2 checkpoints');
        }
      ),
      { numRuns: 20 }
    );
  });

  it('Property: Merged checkpoint has latest compression number', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc
            .integer({ min: 0, max: 20 })
            .chain(compressionNumber => checkpointArbitrary(1, compressionNumber)),
          { minLength: 2, maxLength: 5 }
        ),
        async checkpoints => {
          // Merge checkpoints
          const result = await lifecycle.mergeCheckpoints(checkpoints);

          if (result.success) {
            // Property: Merged checkpoint has max compression number
            const maxCompressionNumber = Math.max(
              ...checkpoints.map(cp => cp.compressionNumber)
            );
            expect(result.mergedCheckpoint.compressionNumber).toBe(maxCompressionNumber);
          }
        }
      ),
      { numRuns: 20 }
    );
  });
});
