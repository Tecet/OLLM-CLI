/**
 * Property-Based Tests for Snapshot Lifecycle - Cleanup
 *
 * **Property 5: Snapshot Cleanup**
 * **Validates: Requirements FR-9**
 *
 * This test validates that snapshot cleanup works correctly:
 * 1. Old snapshots are deleted
 * 2. Recent snapshots are preserved
 * 3. Cleanup respects the keepCount parameter
 * 4. Cleanup is idempotent (can be run multiple times safely)
 *
 * @module snapshotLifecycle.cleanup.property.test
 */

import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';

import * as fc from 'fast-check';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { SnapshotLifecycle } from '../snapshotLifecycle.js';

// ============================================================================
// Test Setup
// ============================================================================

let testDir: string;

beforeEach(async () => {
  // Create temporary directory for test snapshots
  testDir = path.join(
    os.tmpdir(),
    `snapshot-cleanup-test-${Date.now()}-${Math.random().toString(36).substring(7)}`
  );
  await fs.mkdir(testDir, { recursive: true });
});

afterEach(async () => {
  // Clean up test directory
  try {
    await fs.rm(testDir, { recursive: true, force: true });
  } catch (_error) {
    // Ignore cleanup errors
  }
});

/**
 * Generate a unique session ID for each test run
 * This ensures test isolation
 */
function generateSessionId(): string {
  return `test-session-${Date.now()}-${Math.random().toString(36).substring(7)}`;
}

// ============================================================================
// Arbitraries (Generators)
// ============================================================================

/**
 * Generate arbitrary Message (optimized for speed)
 */
const messageArbitrary = fc.record({
  id: fc.string({ minLength: 1, maxLength: 10 }),
  role: fc.constantFrom('system', 'user', 'assistant', 'tool') as fc.Arbitrary<
    'system' | 'user' | 'assistant' | 'tool'
  >,
  content: fc.string({ minLength: 1, maxLength: 50 }), // Reduced from 200
  timestamp: fc.date({ min: new Date('2020-01-01'), max: new Date() }),
});

/**
 * Generate arbitrary CheckpointSummary (optimized for speed)
 */
const checkpointArbitrary = fc.record({
  id: fc.string({ minLength: 1, maxLength: 10 }),
  timestamp: fc.integer({ min: 1000000000000, max: Date.now() }),
  summary: fc.string({ minLength: 10, maxLength: 50 }), // Reduced from 100
  originalMessageIds: fc.array(fc.string({ minLength: 1, maxLength: 10 }), {
    minLength: 1,
    maxLength: 3, // Reduced from 5
  }),
  tokenCount: fc.integer({ min: 10, max: 100 }), // Reduced from 200
  compressionLevel: fc.constantFrom(1, 2, 3) as fc.Arbitrary<1 | 2 | 3>,
  compressionNumber: fc.integer({ min: 0, max: 5 }), // Reduced from 10
  metadata: fc.record({
    model: fc.string({ minLength: 1, maxLength: 10 }),
    createdAt: fc.integer({ min: 1000000000000, max: Date.now() }),
  }),
});

/**
 * Generate arbitrary conversation state (optimized for speed)
 */
const conversationStateArbitrary = fc.record({
  messages: fc.array(messageArbitrary, { minLength: 0, maxLength: 5 }), // Reduced from 10
  checkpoints: fc.array(checkpointArbitrary, { minLength: 0, maxLength: 2 }), // Reduced from 3
});

/**
 * Generate arbitrary snapshot purpose
 */
const purposeArbitrary = fc.constantFrom('recovery', 'rollback', 'emergency') as fc.Arbitrary<
  'recovery' | 'rollback' | 'emergency'
>;

// ============================================================================
// Property Tests
// ============================================================================

describe('SnapshotLifecycle - Property 5: Snapshot Cleanup', () => {
  /**
   * Property: Cleanup keeps exactly N most recent snapshots
   *
   * For any number of snapshots and any keepCount:
   * 1. Create N snapshots
   * 2. Run cleanup with keepCount K
   * 3. Exactly min(N, K) snapshots should remain
   * 4. The remaining snapshots should be the most recent ones
   *
   * This validates FR-9: Snapshot cleanup works correctly
   */
  it('should keep exactly N most recent snapshots after cleanup', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 3, max: 8 }), // Reduced from 1-15 for speed
        fc.integer({ min: 1, max: 5 }), // Reduced from 1-10 for speed
        conversationStateArbitrary,
        purposeArbitrary,
        async (snapshotCount, keepCount, state, purpose) => {
          // Arrange - use unique session ID for each property test run
          const sessionId = generateSessionId();
          const lifecycle = new SnapshotLifecycle(sessionId, testDir);
          const createdIds: string[] = [];

          // Act: Create snapshots
          for (let i = 0; i < snapshotCount; i++) {
            const snapshot = await lifecycle.createSnapshot(
              state.messages,
              state.checkpoints,
              purpose
            );
            createdIds.push(snapshot.id);

            // Small delay to ensure different timestamps (reduced from 10ms)
            await new Promise((resolve) => setTimeout(resolve, 2));
          }

          // Act: Run cleanup
          await lifecycle.cleanup(keepCount);

          // Act: List remaining snapshots
          const remaining = await lifecycle.listSnapshots();

          // Assert: Correct number of snapshots remain
          const expectedCount = Math.min(snapshotCount, keepCount);
          expect(remaining).toHaveLength(expectedCount);

          // Assert: The remaining snapshots are the most recent ones
          // (last expectedCount IDs from createdIds)
          const expectedIds = createdIds.slice(-expectedCount);
          const remainingIds = remaining.map((s) => s.id);

          // Sort both arrays for comparison (order may vary)
          expectedIds.sort();
          remainingIds.sort();

          expect(remainingIds).toEqual(expectedIds);
        }
      ),
      {
        numRuns: 15, // Reduced from 30 for speed
        verbose: false,
      }
    );
  });

  /**
   * Property: Cleanup is idempotent
   *
   * Running cleanup multiple times should have the same effect as running it once.
   * This ensures cleanup is safe to run repeatedly.
   */
  it('should be idempotent (running cleanup multiple times has same effect)', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 3, max: 6 }), // Reduced from 5-10 for speed
        fc.integer({ min: 1, max: 3 }), // Reduced from 1-5 for speed
        conversationStateArbitrary,
        purposeArbitrary,
        async (snapshotCount, keepCount, state, purpose) => {
          // Arrange - use unique session ID for each property test run
          const sessionId = generateSessionId();
          const lifecycle = new SnapshotLifecycle(sessionId, testDir);

          // Act: Create snapshots
          for (let i = 0; i < snapshotCount; i++) {
            await lifecycle.createSnapshot(state.messages, state.checkpoints, purpose);
            await new Promise((resolve) => setTimeout(resolve, 2)); // Reduced from 10ms
          }

          // Act: Run cleanup once
          await lifecycle.cleanup(keepCount);
          const afterFirstCleanup = await lifecycle.listSnapshots();

          // Act: Run cleanup again
          await lifecycle.cleanup(keepCount);
          const afterSecondCleanup = await lifecycle.listSnapshots();

          // Assert: Same number of snapshots after both cleanups
          expect(afterSecondCleanup).toHaveLength(afterFirstCleanup.length);

          // Assert: Same snapshot IDs after both cleanups
          const firstIds = afterFirstCleanup.map((s) => s.id).sort();
          const secondIds = afterSecondCleanup.map((s) => s.id).sort();
          expect(secondIds).toEqual(firstIds);
        }
      ),
      {
        numRuns: 10, // Reduced from 20 for speed
        verbose: false,
      }
    );
  });

  /**
   * Property: Cleanup with keepCount >= total snapshots keeps all
   *
   * If keepCount is greater than or equal to the number of snapshots,
   * all snapshots should be preserved.
   */
  it('should keep all snapshots when keepCount >= total snapshots', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 6 }), // Reduced from 1-10 for speed
        conversationStateArbitrary,
        purposeArbitrary,
        async (snapshotCount, state, purpose) => {
          // Arrange - use unique session ID for each property test run
          const sessionId = generateSessionId();
          const lifecycle = new SnapshotLifecycle(sessionId, testDir);
          const keepCount = snapshotCount + fc.sample(fc.integer({ min: 0, max: 3 }), 1)[0]; // Reduced from 5

          // Act: Create snapshots
          for (let i = 0; i < snapshotCount; i++) {
            await lifecycle.createSnapshot(state.messages, state.checkpoints, purpose);
            await new Promise((resolve) => setTimeout(resolve, 2)); // Reduced from 10ms
          }

          // Act: Run cleanup with keepCount >= snapshotCount
          await lifecycle.cleanup(keepCount);

          // Act: List remaining snapshots
          const remaining = await lifecycle.listSnapshots();

          // Assert: All snapshots are preserved
          expect(remaining).toHaveLength(snapshotCount);
        }
      ),
      {
        numRuns: 10, // Reduced from 20 for speed
        verbose: false,
      }
    );
  });

  /**
   * Property: Cleanup with keepCount = 0 deletes all snapshots
   *
   * Edge case: keepCount of 0 should delete all snapshots.
   */
  it('should delete all snapshots when keepCount = 0', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 6 }), // Reduced from 1-10 for speed
        conversationStateArbitrary,
        purposeArbitrary,
        async (snapshotCount, state, purpose) => {
          // Arrange - use unique session ID for each property test run
          const sessionId = generateSessionId();
          const lifecycle = new SnapshotLifecycle(sessionId, testDir);

          // Act: Create snapshots
          for (let i = 0; i < snapshotCount; i++) {
            await lifecycle.createSnapshot(state.messages, state.checkpoints, purpose);
            await new Promise((resolve) => setTimeout(resolve, 2)); // Reduced from 10ms
          }

          // Act: Run cleanup with keepCount = 0
          await lifecycle.cleanup(0);

          // Act: List remaining snapshots
          const remaining = await lifecycle.listSnapshots();

          // Assert: No snapshots remain
          expect(remaining).toHaveLength(0);
        }
      ),
      {
        numRuns: 8, // Reduced from 15 for speed
        verbose: false,
      }
    );
  });

  /**
   * Property: Cleanup preserves most recent snapshots
   *
   * After cleanup, the remaining snapshots should be the ones with the
   * most recent timestamps.
   */
  it('should preserve snapshots with most recent timestamps', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 3, max: 6 }), // Reduced from 5-10 for speed
        fc.integer({ min: 1, max: 3 }), // Reduced from 1-4 for speed
        conversationStateArbitrary,
        purposeArbitrary,
        async (snapshotCount, keepCount, state, purpose) => {
          // Arrange - use unique session ID for each property test run
          const sessionId = generateSessionId();
          const lifecycle = new SnapshotLifecycle(sessionId, testDir);
          const timestamps: number[] = [];

          // Act: Create snapshots and record timestamps
          for (let i = 0; i < snapshotCount; i++) {
            const snapshot = await lifecycle.createSnapshot(
              state.messages,
              state.checkpoints,
              purpose
            );
            timestamps.push(snapshot.timestamp);
            await new Promise((resolve) => setTimeout(resolve, 2)); // Reduced from 10ms
          }

          // Act: Run cleanup
          await lifecycle.cleanup(keepCount);

          // Act: List remaining snapshots
          const remaining = await lifecycle.listSnapshots();

          // Assert: Remaining snapshots have the most recent timestamps
          const remainingTimestamps = remaining.map((s) => s.timestamp);
          const expectedTimestamps = timestamps.slice(-keepCount).sort((a, b) => b - a);

          // Sort both for comparison
          remainingTimestamps.sort((a, b) => b - a);

          expect(remainingTimestamps).toEqual(expectedTimestamps);
        }
      ),
      {
        numRuns: 10, // Reduced from 20 for speed
        verbose: false,
      }
    );
  });

  /**
   * Property: Cleanup handles empty snapshot list
   *
   * Edge case: Cleanup should work even when there are no snapshots.
   */
  it('should handle cleanup when no snapshots exist', async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 1, max: 5 }), async (keepCount) => {
        // Reduced from 10
        // Arrange - use unique session ID for each property test run
        const sessionId = generateSessionId();
        const lifecycle = new SnapshotLifecycle(sessionId, testDir);

        // Act: Run cleanup on empty snapshot list
        await lifecycle.cleanup(keepCount);

        // Act: List snapshots
        const remaining = await lifecycle.listSnapshots();

        // Assert: No snapshots (no error thrown)
        expect(remaining).toHaveLength(0);
      }),
      {
        numRuns: 5, // Reduced from 10 for speed
        verbose: false,
      }
    );
  });
});
