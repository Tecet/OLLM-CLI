/**
 * Property-Based Tests for Storage Type Validation
 *
 * These tests validate the storage type definitions and type guards using property-based testing.
 * Property-based testing generates many random inputs to verify universal properties hold.
 *
 * **Validates: Requirements FR-1, FR-2, FR-3, FR-4**
 *
 * @module storageTypes.test
 */

import * as fc from 'fast-check';
import { describe, it, expect } from 'vitest';

import { isActiveContext, isSnapshotData, isSessionHistory } from '../storageTypes.js';

// ============================================================================
// Arbitraries (Generators for Property-Based Testing)
// ============================================================================

/**
 * Generate a valid Message object
 */
const messageArbitrary = fc.record({
  id: fc.uuid(),
  role: fc.constantFrom('system' as const, 'user' as const, 'assistant' as const, 'tool' as const),
  content: fc.string({ minLength: 1, maxLength: 1000 }),
  timestamp: fc.date().map((d) => d),
  tokenCount: fc.option(fc.integer({ min: 1, max: 1000 }), { nil: undefined }),
});

/**
 * Generate a valid CheckpointSummary object
 */
const checkpointSummaryArbitrary = fc
  .record({
    id: fc.uuid(),
    timestamp: fc.integer({ min: 1, max: Date.now() }),
    summary: fc.string({ minLength: 10, maxLength: 500 }),
    originalMessageIds: fc.array(fc.uuid(), { minLength: 1, maxLength: 20 }),
    tokenCount: fc.integer({ min: 10, max: 1000 }),
    compressionLevel: fc.constantFrom(1 as const, 2 as const, 3 as const),
    compressionNumber: fc.integer({ min: 0, max: 100 }),
    metadata: fc.record({
      model: fc.string({ minLength: 1, maxLength: 50 }),
      createdAt: fc.integer({ min: 1, max: Date.now() }),
    }),
  })
  .chain((partial) => {
    // Ensure compressedAt is after createdAt if it exists
    return fc
      .option(fc.integer({ min: partial.metadata.createdAt, max: Date.now() }), { nil: undefined })
      .map((compressedAt) => ({
        ...partial,
        metadata: {
          ...partial.metadata,
          compressedAt,
        },
      }));
  });

/**
 * Generate a valid ActiveContext object
 */
const activeContextArbitrary = fc
  .record({
    systemPrompt: messageArbitrary,
    checkpoints: fc.array(checkpointSummaryArbitrary, { maxLength: 10 }),
    recentMessages: fc.array(messageArbitrary, { minLength: 0, maxLength: 20 }),
  })
  .chain((partial) => {
    // Calculate token counts based on generated data
    const systemTokens = partial.systemPrompt.tokenCount || 100;
    const checkpointTokens = partial.checkpoints.reduce((sum, cp) => sum + cp.tokenCount, 0);
    const recentTokens = partial.recentMessages.reduce(
      (sum, msg) => sum + (msg.tokenCount || 50),
      0
    );

    return fc.constant({
      ...partial,
      tokenCount: {
        system: systemTokens,
        checkpoints: checkpointTokens,
        recent: recentTokens,
        total: systemTokens + checkpointTokens + recentTokens,
      },
    });
  });

/**
 * Generate a valid SnapshotData object
 */
const snapshotDataArbitrary = fc.record({
  id: fc.uuid(),
  sessionId: fc.uuid(),
  timestamp: fc.integer({ min: 1, max: Date.now() }), // min: 1 to ensure valid timestamps
  conversationState: fc.record({
    messages: fc.array(messageArbitrary, { maxLength: 50 }),
    checkpoints: fc.array(checkpointSummaryArbitrary, { maxLength: 10 }),
    goals: fc.option(
      fc.array(
        fc.record({
          id: fc.uuid(),
          description: fc.string({ minLength: 10, maxLength: 200 }),
        })
      ),
      { nil: undefined }
    ),
    metadata: fc.dictionary(fc.string(), fc.anything()),
  }),
  purpose: fc.constantFrom('recovery' as const, 'rollback' as const, 'emergency' as const),
});

/**
 * Generate a valid CheckpointRecord object
 */
const checkpointRecordArbitrary = fc
  .record({
    id: fc.uuid(),
    timestamp: fc.integer({ min: 1, max: Date.now() }), // min: 1 to ensure valid timestamps
    messageRange: fc
      .tuple(fc.integer({ min: 0, max: 100 }), fc.integer({ min: 0, max: 100 }))
      .map(([start, end]) => [Math.min(start, end), Math.max(start, end)] as [number, number]),
    originalTokens: fc.integer({ min: 100, max: 10000 }),
  })
  .chain((partial) => {
    // Ensure compressed tokens are always <= original tokens (valid compression)
    return fc.integer({ min: 10, max: partial.originalTokens }).map((compressedTokens) => {
      const compressionRatio = compressedTokens / partial.originalTokens;
      return {
        ...partial,
        compressedTokens,
        compressionRatio,
        level: (compressionRatio < 0.1 ? 1 : compressionRatio < 0.3 ? 2 : 3) as 1 | 2 | 3,
      };
    });
  });

/**
 * Generate a valid SessionHistory object
 */
const sessionHistoryArbitrary = fc
  .record({
    sessionId: fc.uuid(),
    messages: fc.array(messageArbitrary, { minLength: 0, maxLength: 100 }),
    checkpointRecords: fc.array(checkpointRecordArbitrary, { maxLength: 20 }),
  })
  .chain((partial) => {
    const totalMessages = partial.messages.length;
    const totalTokens = partial.messages.reduce((sum, msg) => sum + (msg.tokenCount || 50), 0);
    const compressionCount = partial.checkpointRecords.length;

    return fc.constant({
      ...partial,
      metadata: {
        startTime: Date.now() - 3600000, // 1 hour ago
        lastUpdate: Date.now(),
        totalMessages,
        totalTokens,
        compressionCount,
      },
    });
  });

// ============================================================================
// Property 1: Storage Type Validation
// **Validates: Requirements FR-1, FR-2, FR-3, FR-4**
// ============================================================================

describe('Property 1: Storage Type Validation', () => {
  describe('ActiveContext Type Guard', () => {
    it('should accept all valid ActiveContext objects', () => {
      fc.assert(
        fc.property(activeContextArbitrary, (context) => {
          expect(isActiveContext(context)).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('should reject objects missing required fields', () => {
      fc.assert(
        fc.property(
          fc.record({
            systemPrompt: fc.option(messageArbitrary, { nil: undefined }),
            checkpoints: fc.option(fc.array(checkpointSummaryArbitrary), { nil: undefined }),
            recentMessages: fc.option(fc.array(messageArbitrary), { nil: undefined }),
            tokenCount: fc.option(
              fc.record({
                system: fc.integer(),
                checkpoints: fc.integer(),
                recent: fc.integer(),
                total: fc.integer(),
              }),
              { nil: undefined }
            ),
          }),
          (partial) => {
            // If any required field is missing, should return false
            const hasMissingField =
              !partial.systemPrompt ||
              !partial.checkpoints ||
              !partial.recentMessages ||
              !partial.tokenCount;

            if (hasMissingField) {
              expect(isActiveContext(partial)).toBe(false);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject non-object values', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.string(),
            fc.integer(),
            fc.boolean(),
            fc.constant(null),
            fc.constant(undefined),
            fc.array(fc.anything())
          ),
          (value) => {
            expect(isActiveContext(value)).toBe(false);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should validate token count consistency', () => {
      fc.assert(
        fc.property(activeContextArbitrary, (context) => {
          // Token counts should be non-negative
          expect(context.tokenCount.system).toBeGreaterThanOrEqual(0);
          expect(context.tokenCount.checkpoints).toBeGreaterThanOrEqual(0);
          expect(context.tokenCount.recent).toBeGreaterThanOrEqual(0);
          expect(context.tokenCount.total).toBeGreaterThanOrEqual(0);

          // Total should equal sum of parts
          const expectedTotal =
            context.tokenCount.system + context.tokenCount.checkpoints + context.tokenCount.recent;
          expect(context.tokenCount.total).toBe(expectedTotal);
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('SnapshotData Type Guard', () => {
    it('should accept all valid SnapshotData objects', () => {
      fc.assert(
        fc.property(snapshotDataArbitrary, (snapshot) => {
          expect(isSnapshotData(snapshot)).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('should reject objects with invalid purpose', () => {
      fc.assert(
        fc.property(
          snapshotDataArbitrary,
          fc.string().filter((s) => !['recovery', 'rollback', 'emergency'].includes(s)),
          (snapshot, invalidPurpose) => {
            const invalid = { ...snapshot, purpose: invalidPurpose };
            expect(isSnapshotData(invalid)).toBe(false);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should reject objects missing required fields', () => {
      fc.assert(
        fc.property(
          fc.record({
            id: fc.option(fc.uuid(), { nil: undefined }),
            sessionId: fc.option(fc.uuid(), { nil: undefined }),
            timestamp: fc.option(fc.integer(), { nil: undefined }),
            conversationState: fc.option(
              fc.record({
                messages: fc.array(messageArbitrary),
                checkpoints: fc.array(checkpointSummaryArbitrary),
                metadata: fc.dictionary(fc.string(), fc.anything()),
              }),
              { nil: undefined }
            ),
            purpose: fc.option(
              fc.constantFrom('recovery' as const, 'rollback' as const, 'emergency' as const),
              { nil: undefined }
            ),
          }),
          (partial) => {
            const hasMissingField =
              !partial.id ||
              !partial.sessionId ||
              typeof partial.timestamp !== 'number' ||
              !partial.conversationState ||
              !partial.purpose;

            if (hasMissingField) {
              expect(isSnapshotData(partial)).toBe(false);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject non-object values', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.string(),
            fc.integer(),
            fc.boolean(),
            fc.constant(null),
            fc.constant(undefined),
            fc.array(fc.anything())
          ),
          (value) => {
            expect(isSnapshotData(value)).toBe(false);
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('SessionHistory Type Guard', () => {
    it('should accept all valid SessionHistory objects', () => {
      fc.assert(
        fc.property(sessionHistoryArbitrary, (history) => {
          expect(isSessionHistory(history)).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('should reject objects missing required fields', () => {
      fc.assert(
        fc.property(
          fc.record({
            sessionId: fc.option(fc.uuid(), { nil: undefined }),
            messages: fc.option(fc.array(messageArbitrary), { nil: undefined }),
            checkpointRecords: fc.option(fc.array(checkpointRecordArbitrary), { nil: undefined }),
            metadata: fc.option(
              fc.record({
                startTime: fc.integer(),
                lastUpdate: fc.integer(),
                totalMessages: fc.integer(),
                totalTokens: fc.integer(),
                compressionCount: fc.integer(),
              }),
              { nil: undefined }
            ),
          }),
          (partial) => {
            const hasMissingField =
              !partial.sessionId ||
              !partial.messages ||
              !partial.checkpointRecords ||
              !partial.metadata;

            if (hasMissingField) {
              expect(isSessionHistory(partial)).toBe(false);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject non-object values', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.string(),
            fc.integer(),
            fc.boolean(),
            fc.constant(null),
            fc.constant(undefined),
            fc.array(fc.anything())
          ),
          (value) => {
            expect(isSessionHistory(value)).toBe(false);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should validate metadata consistency', () => {
      fc.assert(
        fc.property(sessionHistoryArbitrary, (history) => {
          // Metadata should be consistent with actual data
          expect(history.metadata.totalMessages).toBe(history.messages.length);
          expect(history.metadata.compressionCount).toBe(history.checkpointRecords.length);

          // Timestamps should be valid
          expect(history.metadata.startTime).toBeGreaterThan(0);
          expect(history.metadata.lastUpdate).toBeGreaterThan(0);
          expect(history.metadata.lastUpdate).toBeGreaterThanOrEqual(history.metadata.startTime);

          // Counts should be non-negative
          expect(history.metadata.totalMessages).toBeGreaterThanOrEqual(0);
          expect(history.metadata.totalTokens).toBeGreaterThanOrEqual(0);
          expect(history.metadata.compressionCount).toBeGreaterThanOrEqual(0);
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('CheckpointSummary Validation', () => {
    it('should have valid compression levels', () => {
      fc.assert(
        fc.property(checkpointSummaryArbitrary, (checkpoint) => {
          expect([1, 2, 3]).toContain(checkpoint.compressionLevel);
        }),
        { numRuns: 100 }
      );
    });

    it('should have non-empty summary', () => {
      fc.assert(
        fc.property(checkpointSummaryArbitrary, (checkpoint) => {
          expect(checkpoint.summary.length).toBeGreaterThan(0);
        }),
        { numRuns: 100 }
      );
    });

    it('should have at least one original message ID', () => {
      fc.assert(
        fc.property(checkpointSummaryArbitrary, (checkpoint) => {
          expect(checkpoint.originalMessageIds.length).toBeGreaterThan(0);
        }),
        { numRuns: 100 }
      );
    });

    it('should have positive token count', () => {
      fc.assert(
        fc.property(checkpointSummaryArbitrary, (checkpoint) => {
          expect(checkpoint.tokenCount).toBeGreaterThan(0);
        }),
        { numRuns: 100 }
      );
    });

    it('should have valid timestamps', () => {
      fc.assert(
        fc.property(checkpointSummaryArbitrary, (checkpoint) => {
          expect(checkpoint.timestamp).toBeGreaterThan(0);
          expect(checkpoint.metadata.createdAt).toBeGreaterThan(0);

          if (checkpoint.metadata.compressedAt) {
            expect(checkpoint.metadata.compressedAt).toBeGreaterThanOrEqual(
              checkpoint.metadata.createdAt
            );
          }
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('CheckpointRecord Validation', () => {
    it('should have valid message range', () => {
      fc.assert(
        fc.property(checkpointRecordArbitrary, (record) => {
          const [start, end] = record.messageRange;
          expect(start).toBeGreaterThanOrEqual(0);
          expect(end).toBeGreaterThanOrEqual(start);
        }),
        { numRuns: 100 }
      );
    });

    it('should have valid compression ratio', () => {
      fc.assert(
        fc.property(checkpointRecordArbitrary, (record) => {
          expect(record.compressionRatio).toBeGreaterThan(0);
          expect(record.compressionRatio).toBeLessThanOrEqual(1);

          // Verify ratio calculation
          const expectedRatio = record.compressedTokens / record.originalTokens;
          expect(record.compressionRatio).toBeCloseTo(expectedRatio, 5);
        }),
        { numRuns: 100 }
      );
    });

    it('should have compressed tokens less than original', () => {
      fc.assert(
        fc.property(checkpointRecordArbitrary, (record) => {
          expect(record.compressedTokens).toBeLessThanOrEqual(record.originalTokens);
        }),
        { numRuns: 100 }
      );
    });

    it('should have valid compression level based on ratio', () => {
      fc.assert(
        fc.property(checkpointRecordArbitrary, (record) => {
          const ratio = record.compressionRatio;

          if (ratio < 0.1) {
            expect(record.level).toBe(1); // Compact
          } else if (ratio < 0.3) {
            expect(record.level).toBe(2); // Moderate
          } else {
            expect(record.level).toBe(3); // Detailed
          }
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Storage Layer Separation', () => {
    it('should distinguish between different storage types', () => {
      fc.assert(
        fc.property(
          activeContextArbitrary,
          snapshotDataArbitrary,
          sessionHistoryArbitrary,
          (activeContext, snapshot, history) => {
            // Each type guard should only accept its own type
            expect(isActiveContext(activeContext)).toBe(true);
            expect(isActiveContext(snapshot)).toBe(false);
            expect(isActiveContext(history)).toBe(false);

            expect(isSnapshotData(snapshot)).toBe(true);
            expect(isSnapshotData(activeContext)).toBe(false);
            expect(isSnapshotData(history)).toBe(false);

            expect(isSessionHistory(history)).toBe(true);
            expect(isSessionHistory(activeContext)).toBe(false);
            expect(isSessionHistory(snapshot)).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
