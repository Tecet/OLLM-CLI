/**
 * Property-Based Tests for Storage Boundaries
 * 
 * **Property 8: Storage Boundary Enforcement**
 * **Validates: Requirements FR-1, FR-2, FR-3, FR-4**
 * 
 * Tests that storage boundaries are enforced correctly:
 * - Type guards correctly identify storage types
 * - Validation catches all invalid structures
 * - Enforcement prevents cross-contamination
 * - Boundaries are maintained under all conditions
 */

import * as fc from 'fast-check';
import { describe, it, expect } from 'vitest';

import { StorageBoundariesImpl } from '../storageBoundaries.js';

import type {
  ActiveContext,
  SnapshotData,
  SessionHistory,
  CheckpointSummary,
  CheckpointRecord,
} from '../../types/storageTypes.js';
import type { Message } from '../../types.js';

describe('Property 8: Storage Boundary Enforcement', () => {
  const boundaries = new StorageBoundariesImpl();

  // ============================================================================
  // Arbitraries (Test Data Generators)
  // ============================================================================

  const messageArb = fc.record({
    role: fc.constantFrom('system', 'user', 'assistant'),
    content: fc.string({ minLength: 1, maxLength: 1000 }),
    id: fc.uuid(),
    timestamp: fc.date({ min: new Date('2020-01-01'), max: new Date() }),
  }) as fc.Arbitrary<Message>;

  const checkpointSummaryArb = fc.record({
    id: fc.uuid(),
    timestamp: fc.integer({ min: 1000000000000, max: Date.now() }),
    summary: fc.string({ minLength: 10, maxLength: 500 }),
    originalMessageIds: fc.array(fc.uuid(), { minLength: 1, maxLength: 20 }),
    tokenCount: fc.integer({ min: 10, max: 1000 }),
    compressionLevel: fc.constantFrom(1, 2, 3) as fc.Arbitrary<1 | 2 | 3>,
    compressionNumber: fc.integer({ min: 0, max: 20 }),
    metadata: fc.record({
      model: fc.string({ minLength: 1 }),
      createdAt: fc.integer({ min: 1000000000000, max: Date.now() }),
      compressedAt: fc.option(fc.integer({ min: 1000000000000, max: Date.now() })),
    }),
  }) as fc.Arbitrary<CheckpointSummary>;

  const activeContextArb = fc.record({
    systemPrompt: messageArb.filter(m => m.role === 'system'),
    checkpoints: fc.array(checkpointSummaryArb, { maxLength: 10 }),
    recentMessages: fc.array(messageArb, { maxLength: 20 }),
  }).chain(partial => {
    const systemTokens = Math.floor(partial.systemPrompt.content.length / 4);
    const checkpointsTokens = partial.checkpoints.reduce((sum, cp) => sum + cp.tokenCount, 0);
    const recentTokens = partial.recentMessages.reduce(
      (sum, m) => sum + Math.floor(m.content.length / 4),
      0
    );

    return fc.constant({
      ...partial,
      tokenCount: {
        system: systemTokens,
        checkpoints: checkpointsTokens,
        recent: recentTokens,
        total: systemTokens + checkpointsTokens + recentTokens,
      },
    });
  }) as fc.Arbitrary<ActiveContext>;

  const snapshotDataArb = fc.record({
    id: fc.uuid(),
    sessionId: fc.uuid(),
    timestamp: fc.integer({ min: 1000000000000, max: Date.now() }),
    conversationState: fc.record({
      messages: fc.array(messageArb, { maxLength: 50 }),
      checkpoints: fc.array(checkpointSummaryArb, { maxLength: 10 }),
      goals: fc.option(fc.array(fc.record({
        id: fc.uuid(),
        description: fc.string({ minLength: 1 }),
      }))),
      metadata: fc.dictionary(fc.string(), fc.anything()),
    }),
    purpose: fc.constantFrom('recovery', 'rollback', 'emergency') as fc.Arbitrary<'recovery' | 'rollback' | 'emergency'>,
  }) as fc.Arbitrary<SnapshotData>;

  const checkpointRecordArb = fc.record({
    id: fc.uuid(),
    timestamp: fc.integer({ min: 1000000000000, max: Date.now() }),
    messageRange: fc.tuple(
      fc.integer({ min: 0, max: 100 }),
      fc.integer({ min: 0, max: 100 })
    ).map(([a, b]) => [Math.min(a, b), Math.max(a, b)] as [number, number]),
    originalTokens: fc.integer({ min: 100, max: 5000 }),
  }).chain(partial => {
    // Ensure compressedTokens is always less than originalTokens for valid compression ratio
    return fc.integer({ min: 10, max: partial.originalTokens - 1 }).map(compressedTokens => {
      const ratio = compressedTokens / partial.originalTokens;
      return {
        ...partial,
        compressedTokens,
        compressionRatio: ratio,
        level: (ratio < 0.2 ? 1 : ratio < 0.4 ? 2 : 3) as 1 | 2 | 3,
      };
    });
  }) as fc.Arbitrary<CheckpointRecord>;

  const sessionHistoryArb = fc.record({
    sessionId: fc.uuid(),
    messages: fc.array(messageArb, { minLength: 0, maxLength: 100 }),
    checkpointRecords: fc.array(checkpointRecordArb, { maxLength: 10 }),
  }).chain(partial => {
    const totalTokens = partial.messages.reduce(
      (sum, m) => sum + Math.floor(m.content.length / 4),
      0
    );

    return fc.constant({
      ...partial,
      metadata: {
        startTime: Date.now() - 3600000,
        lastUpdate: Date.now(),
        totalMessages: partial.messages.length,
        totalTokens,
        compressionCount: partial.checkpointRecords.length,
      },
    });
  }) as fc.Arbitrary<SessionHistory>;

  // ============================================================================
  // Property Tests
  // ============================================================================

  describe('Type Guard Properties', () => {
    it('should correctly identify valid ActiveContext', () => {
      fc.assert(
        fc.property(activeContextArb, (context) => {
          expect(boundaries.isActiveContext(context)).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('should correctly identify valid SnapshotData', () => {
      fc.assert(
        fc.property(snapshotDataArb, (snapshot) => {
          expect(boundaries.isSnapshotData(snapshot)).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('should correctly identify valid SessionHistory', () => {
      fc.assert(
        fc.property(sessionHistoryArb, (history) => {
          expect(boundaries.isSessionHistory(history)).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('should reject invalid data types', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.constant(null),
            fc.constant(undefined),
            fc.string(),
            fc.integer(),
            fc.boolean(),
            fc.array(fc.anything()),
          ),
          (invalidData) => {
            expect(boundaries.isActiveContext(invalidData)).toBe(false);
            expect(boundaries.isSnapshotData(invalidData)).toBe(false);
            expect(boundaries.isSessionHistory(invalidData)).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should not confuse storage types', () => {
      fc.assert(
        fc.property(
          fc.oneof(activeContextArb, snapshotDataArb, sessionHistoryArb),
          (data) => {
            const isActive = boundaries.isActiveContext(data);
            const isSnapshot = boundaries.isSnapshotData(data);
            const isHistory = boundaries.isSessionHistory(data);

            // Exactly one should be true
            const trueCount = [isActive, isSnapshot, isHistory].filter(Boolean).length;
            expect(trueCount).toBe(1);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Validation Properties', () => {
    it('should validate correct ActiveContext', () => {
      fc.assert(
        fc.property(activeContextArb, (context) => {
          const result = boundaries.validateActiveContext(context);
          expect(result.valid).toBe(true);
          expect(result.errors).toBeUndefined();
        }),
        { numRuns: 100 }
      );
    });

    it('should validate correct SnapshotData', () => {
      fc.assert(
        fc.property(snapshotDataArb, (snapshot) => {
          const result = boundaries.validateSnapshotData(snapshot);
          expect(result.valid).toBe(true);
          expect(result.errors).toBeUndefined();
        }),
        { numRuns: 100 }
      );
    });

    it('should validate correct SessionHistory', () => {
      fc.assert(
        fc.property(sessionHistoryArb, (history) => {
          const result = boundaries.validateSessionHistory(history);
          expect(result.valid).toBe(true);
          expect(result.errors).toBeUndefined();
        }),
        { numRuns: 100 }
      );
    });

    it('should detect invalid ActiveContext token counts', () => {
      fc.assert(
        fc.property(activeContextArb, (context) => {
          // Corrupt token count
          const corrupted = {
            ...context,
            tokenCount: {
              ...context.tokenCount,
              total: context.tokenCount.total + 1000, // Wrong total
            },
          };

          const result = boundaries.validateActiveContext(corrupted);
          expect(result.valid).toBe(false);
          expect(result.errors).toBeDefined();
          expect(result.errors!.some(e => e.includes('does not match sum'))).toBe(true);
        }),
        { numRuns: 50 }
      );
    });

    it('should detect invalid SessionHistory metadata', () => {
      fc.assert(
        fc.property(sessionHistoryArb, (history) => {
          // Corrupt metadata
          const corrupted = {
            ...history,
            metadata: {
              ...history.metadata,
              totalMessages: history.messages.length + 10, // Wrong count
            },
          };

          const result = boundaries.validateSessionHistory(corrupted);
          expect(result.valid).toBe(false);
          expect(result.errors).toBeDefined();
          expect(result.errors!.some(e => e.includes('does not match messages array length'))).toBe(true);
        }),
        { numRuns: 50 }
      );
    });
  });

  describe('Enforcement Properties', () => {
    it('should allow clean prompts', () => {
      fc.assert(
        fc.property(fc.array(messageArb, { maxLength: 20 }), (messages) => {
          expect(() => boundaries.preventSnapshotInPrompt(messages)).not.toThrow();
          expect(() => boundaries.preventHistoryInPrompt(messages)).not.toThrow();
        }),
        { numRuns: 100 }
      );
    });

    it('should detect snapshot markers in metadata', () => {
      fc.assert(
        fc.property(messageArb, (message) => {
          const contaminated = {
            ...message,
            metadata: {
              snapshotId: 'snap_123',
            },
          };

          expect(() => boundaries.preventSnapshotInPrompt([contaminated])).toThrow(/CRITICAL.*Snapshot/);
        }),
        { numRuns: 50 }
      );
    });

    it('should detect history markers in metadata', () => {
      fc.assert(
        fc.property(messageArb, (message) => {
          const contaminated = {
            ...message,
            metadata: {
              sessionHistory: true,
            },
          };

          expect(() => boundaries.preventHistoryInPrompt([contaminated])).toThrow(/CRITICAL.*Session history/);
        }),
        { numRuns: 50 }
      );
    });

    it('should detect snapshot purpose markers', () => {
      fc.assert(
        fc.property(
          messageArb,
          fc.constantFrom('recovery', 'rollback', 'emergency'),
          (message, purpose) => {
            const contaminated = {
              ...message,
              metadata: {
                purpose,
              },
            };

            expect(() => boundaries.preventSnapshotInPrompt([contaminated])).toThrow(/CRITICAL.*Snapshot purpose/);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should detect checkpoint records in metadata', () => {
      fc.assert(
        fc.property(messageArb, (message) => {
          const contaminated = {
            ...message,
            metadata: {
              checkpointRecords: [],
            },
          };

          expect(() => boundaries.preventHistoryInPrompt([contaminated])).toThrow(/CRITICAL.*Checkpoint records/);
        }),
        { numRuns: 50 }
      );
    });
  });

  describe('Boundary Invariants', () => {
    it('should maintain type exclusivity', () => {
      fc.assert(
        fc.property(
          fc.oneof(activeContextArb, snapshotDataArb, sessionHistoryArb),
          (data) => {
            const checks = [
              boundaries.isActiveContext(data),
              boundaries.isSnapshotData(data),
              boundaries.isSessionHistory(data),
            ];

            // Exactly one should be true
            expect(checks.filter(Boolean).length).toBe(1);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should validate what type guards accept', () => {
      fc.assert(
        fc.property(activeContextArb, (context) => {
          if (boundaries.isActiveContext(context)) {
            const result = boundaries.validateActiveContext(context);
            expect(result.valid).toBe(true);
          }
        }),
        { numRuns: 100 }
      );

      fc.assert(
        fc.property(snapshotDataArb, (snapshot) => {
          if (boundaries.isSnapshotData(snapshot)) {
            const result = boundaries.validateSnapshotData(snapshot);
            expect(result.valid).toBe(true);
          }
        }),
        { numRuns: 100 }
      );

      fc.assert(
        fc.property(sessionHistoryArb, (history) => {
          if (boundaries.isSessionHistory(history)) {
            const result = boundaries.validateSessionHistory(history);
            expect(result.valid).toBe(true);
          }
        }),
        { numRuns: 100 }
      );
    });

    it('should enforce boundaries consistently', () => {
      fc.assert(
        fc.property(fc.array(messageArb, { maxLength: 20 }), (messages) => {
          // Multiple calls should have same result
          let firstCallThrew = false;
          let secondCallThrew = false;

          try {
            boundaries.preventSnapshotInPrompt(messages);
          } catch {
            firstCallThrew = true;
          }

          try {
            boundaries.preventSnapshotInPrompt(messages);
          } catch {
            secondCallThrew = true;
          }

          // Both calls should have same behavior
          expect(firstCallThrew).toBe(secondCallThrew);
        }),
        { numRuns: 100 }
      );
    });
  });
});
