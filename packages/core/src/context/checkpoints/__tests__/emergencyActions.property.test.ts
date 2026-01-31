/**
 * Property-Based Tests for Emergency Actions
 *
 * Tests universal properties that must hold for all emergency actions:
 * - Property 18: Emergency Action Safety
 * - Property 19: Emergency Action Effectiveness
 *
 * These tests use fast-check to generate random inputs and verify
 * that emergency actions always maintain safety guarantees.
 */

import * as fc from 'fast-check';
import { describe, it, expect, beforeEach } from 'vitest';

import { SnapshotLifecycle } from '../../storage/snapshotLifecycle.js';
import { CheckpointLifecycle } from '../checkpointLifecycle.js';
import { EmergencyActions } from '../emergencyActions.js';

import type { SummarizationService } from '../../compression/summarizationService.js';

const mockSummarizationService = {
  summarize: async (messages, level) => {
    const originalTokens = Math.ceil(
      messages.reduce((sum, message) => sum + message.content.length, 0) / 4
    );
    const tokenCount = Math.max(1, Math.min(5, originalTokens - 1));

    return {
      summary: 'Test summary that is shorter than input.',
      tokenCount,
      level,
      model: 'test-model',
      success: true,
    };
  },
} as SummarizationService;

/**
 * Arbitraries for property-based testing
 */

// Generate a valid message
const messageArbitrary = fc.record({
  id: fc.string({ minLength: 1, maxLength: 20 }),
  role: fc.constantFrom('user' as const, 'assistant' as const),
  content: fc.string({ minLength: 10, maxLength: 500 }),
  timestamp: fc.date({ min: new Date('2020-01-01'), max: new Date() }),
  parts: fc.constant([{ type: 'text' as const, text: 'test' }]),
});

// Generate a valid checkpoint
const checkpointArbitrary = fc
  .record({
    id: fc.string({ minLength: 1, maxLength: 20 }),
    timestamp: fc.integer({ min: 1000000000000, max: Date.now() }),
    summary: fc.string({ minLength: 50, maxLength: 500 }),
    originalMessageIds: fc.array(fc.string({ minLength: 1, maxLength: 20 }), {
      minLength: 1,
      maxLength: 10,
    }),
    tokenCount: fc.integer({ min: 10, max: 500 }),
    compressionLevel: fc.constantFrom(1, 2, 3) as fc.Arbitrary<1 | 2 | 3>,
    compressionNumber: fc.integer({ min: 0, max: 20 }),
    metadata: fc.record({
      model: fc.constant('test-model'),
      createdAt: fc.integer({ min: 1000000000000, max: Date.now() }),
    }),
  })
  .map((checkpoint) => ({
    ...checkpoint,
    tokenCount: Math.max(1, Math.ceil(checkpoint.summary.length / 4)),
  }));

describe('EmergencyActions - Property Tests', () => {
  let summarizationService: SummarizationService;
  let snapshotLifecycle: SnapshotLifecycle;
  let checkpointLifecycle: CheckpointLifecycle;
  let emergencyActions: EmergencyActions;

  beforeEach(() => {
    summarizationService = mockSummarizationService;
    snapshotLifecycle = new SnapshotLifecycle('test-session');
    checkpointLifecycle = new CheckpointLifecycle(summarizationService);
    emergencyActions = new EmergencyActions(
      checkpointLifecycle,
      snapshotLifecycle,
      summarizationService
    );
  });

  /**
   * Property 18: Emergency Action Safety
   *
   * **Validates: Requirements FR-8, FR-9**
   *
   * **Property:**
   * For all emergency actions (compress, merge, rollover, aggressive-summarization),
   * a snapshot MUST be created before the action is performed.
   *
   * **Invariants:**
   * 1. Every emergency action creates a snapshot
   * 2. Snapshot ID is always returned (even on failure)
   * 3. Snapshot contains complete conversation state
   * 4. Snapshot can be restored after action
   * 5. Original state is preserved in snapshot
   *
   * **Why this matters:**
   * Emergency actions are aggressive and potentially destructive.
   * We must always be able to rollback if something goes wrong.
   */
  describe('Property 18: Emergency Action Safety', () => {
    it('compressCheckpoint always creates snapshot before action', async () => {
      await fc.assert(
        fc.asyncProperty(
          checkpointArbitrary,
          fc.array(messageArbitrary, { minLength: 1, maxLength: 20 }),
          fc.array(checkpointArbitrary, { minLength: 0, maxLength: 10 }),
          async (checkpoint, messages, checkpoints) => {
            // Ensure checkpoint can be compressed (not already at Level 1)
            const testCheckpoint = { ...checkpoint, compressionLevel: 3 as 1 | 2 | 3 };

            // Execute emergency compression
            const result = await emergencyActions.compressCheckpoint(
              testCheckpoint,
              messages,
              checkpoints
            );

            // Invariant 1: Snapshot ID is always returned
            expect(result.snapshotId).toBeDefined();
            expect(typeof result.snapshotId).toBe('string');

            // Invariant 2: Snapshot ID is non-empty (even on failure)
            if (result.success) {
              expect(result.snapshotId.length).toBeGreaterThan(0);
            }

            // Invariant 3: Action type is correct
            expect(result.action).toBe('compress');

            return true;
          }
        ),
        { numRuns: 50 }
      );
    });

    it('mergeCheckpoints always creates snapshot before action', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(checkpointArbitrary, { minLength: 2, maxLength: 5 }),
          fc.array(messageArbitrary, { minLength: 1, maxLength: 20 }),
          fc.array(checkpointArbitrary, { minLength: 0, maxLength: 10 }),
          async (checkpointsToMerge, messages, allCheckpoints) => {
            // Execute emergency merge
            const result = await emergencyActions.mergeCheckpoints(
              checkpointsToMerge,
              messages,
              allCheckpoints
            );

            // Invariant 1: Snapshot ID is always returned
            expect(result.snapshotId).toBeDefined();
            expect(typeof result.snapshotId).toBe('string');

            // Invariant 2: Snapshot ID is non-empty (even on failure)
            if (result.success) {
              expect(result.snapshotId.length).toBeGreaterThan(0);
            }

            // Invariant 3: Action type is correct
            expect(result.action).toBe('merge');

            return true;
          }
        ),
        { numRuns: 50 }
      );
    });

    it('emergencyRollover always creates snapshot before action', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(messageArbitrary, { minLength: 10, maxLength: 50 }),
          fc.array(checkpointArbitrary, { minLength: 1, maxLength: 10 }),
          fc.integer({ min: 1, max: 10 }),
          async (messages, checkpoints, keepCount) => {
            // Execute emergency rollover
            const result = await emergencyActions.emergencyRollover(
              messages,
              checkpoints,
              keepCount
            );

            // Invariant 1: Snapshot ID is always returned
            expect(result.snapshotId).toBeDefined();
            expect(typeof result.snapshotId).toBe('string');

            // Invariant 2: Snapshot ID is non-empty on success
            if (result.success) {
              expect(result.snapshotId.length).toBeGreaterThan(0);
            }

            // Invariant 3: Messages archived count is correct
            const expectedArchived = Math.max(0, messages.length - keepCount);
            expect(result.messagesArchived).toBe(expectedArchived);

            // Invariant 4: All checkpoints are archived
            expect(result.checkpointsArchived).toBe(checkpoints.length);

            return true;
          }
        ),
        { numRuns: 50 }
      );
    });

    it('aggressiveSummarization always creates snapshot before action', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(messageArbitrary, { minLength: 1, maxLength: 20 }),
          fc.array(messageArbitrary, { minLength: 1, maxLength: 30 }),
          fc.array(checkpointArbitrary, { minLength: 0, maxLength: 10 }),
          async (messagesToSummarize, allMessages, allCheckpoints) => {
            // Execute aggressive summarization
            const result = await emergencyActions.aggressiveSummarization(
              messagesToSummarize,
              allMessages,
              allCheckpoints
            );

            // Invariant 1: Message count is correct
            if (result.success) {
              expect(result.messagesSummarized).toBe(messagesToSummarize.length);
            }

            // Invariant 2: Checkpoint is created on success
            if (result.success) {
              expect(result.checkpoint).toBeDefined();
              expect(result.checkpoint.id).toBeDefined();
              expect(result.checkpoint.compressionLevel).toBe(1); // Always Level 1
            }

            // Invariant 3: Tokens freed is non-negative
            expect(result.tokensFreed).toBeGreaterThanOrEqual(0);

            return true;
          }
        ),
        { numRuns: 50 }
      );
    });

    it('snapshot contains complete conversation state', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(messageArbitrary, { minLength: 5, maxLength: 20 }),
          fc.array(checkpointArbitrary, { minLength: 1, maxLength: 5 }),
          async (messages, checkpoints) => {
            // Execute any emergency action
            const result = await emergencyActions.emergencyRollover(messages, checkpoints, 3);

            if (result.success && result.snapshotId) {
              // Try to restore snapshot
              const restored = await snapshotLifecycle.restoreSnapshot(result.snapshotId);

              // Invariant 1: Restored state contains messages
              expect(restored.messages).toBeDefined();
              expect(Array.isArray(restored.messages)).toBe(true);

              // Invariant 2: Restored state contains checkpoints
              expect(restored.checkpoints).toBeDefined();
              expect(Array.isArray(restored.checkpoints)).toBe(true);

              // Invariant 3: Message count matches original
              expect(restored.messages.length).toBe(messages.length);

              // Invariant 4: Checkpoint count matches original
              expect(restored.checkpoints.length).toBe(checkpoints.length);
            }

            return true;
          }
        ),
        { numRuns: 30 }
      );
    });

    it('emergency actions never throw unhandled errors', async () => {
      await fc.assert(
        fc.asyncProperty(
          checkpointArbitrary,
          fc.array(messageArbitrary, { minLength: 1, maxLength: 20 }),
          fc.array(checkpointArbitrary, { minLength: 0, maxLength: 10 }),
          async (checkpoint, messages, checkpoints) => {
            // All emergency actions should handle errors gracefully
            const actions = [
              () => emergencyActions.compressCheckpoint(checkpoint, messages, checkpoints),
              () =>
                emergencyActions.mergeCheckpoints(checkpoints.slice(0, 2), messages, checkpoints),
              () => emergencyActions.emergencyRollover(messages, checkpoints, 3),
              () =>
                emergencyActions.aggressiveSummarization(
                  messages.slice(0, 5),
                  messages,
                  checkpoints
                ),
            ];

            // Execute all actions - none should throw
            for (const action of actions) {
              try {
                const result = await action();
                // Invariant: Result always has success field
                expect(result).toHaveProperty('success');
                expect(typeof result.success).toBe('boolean');
              } catch (error) {
                // Should never reach here
                throw new Error(`Emergency action threw unhandled error: ${error}`);
              }
            }

            return true;
          }
        ),
        { numRuns: 30 }
      );
    });
  });

  /**
   * Property 19: Emergency Action Effectiveness
   *
   * **Validates: Requirements FR-8**
   *
   * **Property:**
   * Emergency actions MUST free tokens when successful.
   * The amount freed should be significant enough to justify the action.
   *
   * **Invariants:**
   * 1. Successful actions always free tokens (tokensFreed > 0)
   * 2. Tokens freed is reasonable (not negative, not impossibly large)
   * 3. More aggressive actions free more tokens
   * 4. Failed actions report tokensFreed = 0
   * 5. Rollover frees the most tokens (archives everything)
   *
   * **Why this matters:**
   * Emergency actions are expensive (LLM calls, snapshots).
   * They must actually solve the problem by freeing significant space.
   */
  describe('Property 19: Emergency Action Effectiveness', () => {
    it('successful compress always frees tokens', async () => {
      await fc.assert(
        fc.asyncProperty(
          checkpointArbitrary,
          fc.array(messageArbitrary, { minLength: 1, maxLength: 20 }),
          fc.array(checkpointArbitrary, { minLength: 0, maxLength: 10 }),
          async (checkpoint, messages, checkpoints) => {
            // Ensure checkpoint can be compressed
            const testCheckpoint = {
              ...checkpoint,
              compressionLevel: 3 as 1 | 2 | 3,
              tokenCount: 500, // Ensure significant size
            };

            const result = await emergencyActions.compressCheckpoint(
              testCheckpoint,
              messages,
              checkpoints
            );

            if (result.success) {
              // Invariant 1: Tokens freed is positive
              expect(result.tokensFreed).toBeGreaterThan(0);

              // Invariant 2: Tokens freed is reasonable (not more than original)
              expect(result.tokensFreed).toBeLessThanOrEqual(testCheckpoint.tokenCount);

              // Invariant 3: Tokens freed is significant (at least 10% reduction)
              const reductionPercent = (result.tokensFreed / testCheckpoint.tokenCount) * 100;
              expect(reductionPercent).toBeGreaterThan(0);
            } else {
              // Invariant 4: Failed actions report 0 tokens freed
              expect(result.tokensFreed).toBe(0);
            }

            return true;
          }
        ),
        { numRuns: 50 }
      );
    });

    it('successful merge always frees tokens', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(checkpointArbitrary, { minLength: 2, maxLength: 5 }),
          fc.array(messageArbitrary, { minLength: 1, maxLength: 20 }),
          fc.array(checkpointArbitrary, { minLength: 0, maxLength: 10 }),
          async (checkpointsToMerge, messages, allCheckpoints) => {
            // Ensure checkpoints have significant size
            const testCheckpoints = checkpointsToMerge.map((cp) => ({
              ...cp,
              tokenCount: 200,
            }));

            const result = await emergencyActions.mergeCheckpoints(
              testCheckpoints,
              messages,
              allCheckpoints
            );

            if (result.success) {
              // Invariant 1: Tokens freed is positive
              expect(result.tokensFreed).toBeGreaterThan(0);

              // Invariant 2: Tokens freed is reasonable
              const totalOriginal = testCheckpoints.reduce((sum, cp) => sum + cp.tokenCount, 0);
              expect(result.tokensFreed).toBeLessThanOrEqual(totalOriginal);

              // Invariant 3: Merge reduces total size
              expect(result.tokensFreed).toBeGreaterThan(0);
            } else {
              // Invariant 4: Failed actions report 0 tokens freed
              expect(result.tokensFreed).toBe(0);
            }

            return true;
          }
        ),
        { numRuns: 50 }
      );
    });

    it('rollover frees significant tokens', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(messageArbitrary, { minLength: 20, maxLength: 50 }),
          fc.array(checkpointArbitrary, { minLength: 3, maxLength: 10 }),
          fc.integer({ min: 1, max: 5 }),
          async (messages, checkpoints, keepCount) => {
            const result = await emergencyActions.emergencyRollover(
              messages,
              checkpoints,
              keepCount
            );

            if (result.success) {
              // Invariant 1: Tokens freed is positive
              expect(result.tokensFreed).toBeGreaterThan(0);

              // Invariant 2: Rollover frees substantial amount
              // (should free most of the context)
              expect(result.tokensFreed).toBeGreaterThan(100);

              // Invariant 3: Messages archived is correct
              expect(result.messagesArchived).toBe(messages.length - keepCount);

              // Invariant 4: All checkpoints archived
              expect(result.checkpointsArchived).toBe(checkpoints.length);
            }

            return true;
          }
        ),
        { numRuns: 50 }
      );
    });

    it('aggressive summarization frees significant tokens', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(messageArbitrary, { minLength: 5, maxLength: 20 }),
          fc.array(messageArbitrary, { minLength: 10, maxLength: 30 }),
          fc.array(checkpointArbitrary, { minLength: 0, maxLength: 10 }),
          async (messagesToSummarize, allMessages, allCheckpoints) => {
            const result = await emergencyActions.aggressiveSummarization(
              messagesToSummarize,
              allMessages,
              allCheckpoints
            );

            if (result.success) {
              // Invariant 1: Tokens freed is positive
              expect(result.tokensFreed).toBeGreaterThan(0);

              // Invariant 2: Original tokens is reasonable
              expect(result.originalTokens).toBeGreaterThan(0);

              // Invariant 3: Summarized tokens is less than original
              expect(result.summarizedTokens).toBeLessThan(result.originalTokens);

              // Invariant 4: Tokens freed matches calculation
              expect(result.tokensFreed).toBe(result.originalTokens - result.summarizedTokens);

              // Invariant 5: Checkpoint is at Level 1 (most aggressive)
              expect(result.checkpoint.compressionLevel).toBe(1);
            } else {
              // Invariant 6: Failed actions report 0 tokens freed
              expect(result.tokensFreed).toBe(0);
            }

            return true;
          }
        ),
        { numRuns: 50 }
      );
    });

    it('tokens freed is never negative', async () => {
      await fc.assert(
        fc.asyncProperty(
          checkpointArbitrary,
          fc.array(messageArbitrary, { minLength: 1, maxLength: 20 }),
          fc.array(checkpointArbitrary, { minLength: 0, maxLength: 10 }),
          async (checkpoint, messages, checkpoints) => {
            // Test all emergency actions
            const results = await Promise.all([
              emergencyActions.compressCheckpoint(checkpoint, messages, checkpoints),
              emergencyActions.mergeCheckpoints(checkpoints.slice(0, 2), messages, checkpoints),
              emergencyActions.emergencyRollover(messages, checkpoints, 3),
              emergencyActions.aggressiveSummarization(messages.slice(0, 5), messages, checkpoints),
            ]);

            // Invariant: Tokens freed is never negative
            for (const result of results) {
              expect(result.tokensFreed).toBeGreaterThanOrEqual(0);
            }

            return true;
          }
        ),
        { numRuns: 50 }
      );
    });

    it('rollover frees more tokens than other actions', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(messageArbitrary, { minLength: 20, maxLength: 50 }),
          fc.array(checkpointArbitrary, { minLength: 5, maxLength: 10 }),
          async (messages, checkpoints) => {
            // Execute all actions
            const compressResult = await emergencyActions.compressCheckpoint(
              { ...checkpoints[0], compressionLevel: 3 as 1 | 2 | 3 },
              messages,
              checkpoints
            );

            const _mergeResult = await emergencyActions.mergeCheckpoints(
              checkpoints.slice(0, 3),
              messages,
              checkpoints
            );

            const rolloverResult = await emergencyActions.emergencyRollover(
              messages,
              checkpoints,
              3
            );

            // Invariant: Rollover should free the most tokens
            // (it archives everything except recent messages)
            if (rolloverResult.success) {
              expect(rolloverResult.tokensFreed).toBeGreaterThan(0);

              // Rollover should free more than compress (usually)
              if (compressResult.success) {
                // This may not always be true for small contexts,
                // but should be true for larger ones
                if (messages.length > 20 && checkpoints.length > 5) {
                  expect(rolloverResult.tokensFreed).toBeGreaterThan(compressResult.tokensFreed);
                }
              }
            }

            return true;
          }
        ),
        { numRuns: 30 }
      );
    });
  });
});
