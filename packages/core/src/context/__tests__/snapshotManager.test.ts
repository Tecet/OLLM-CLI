/**
 * Snapshot Manager Tests
 * 
 * Tests for snapshot creation, restoration, listing, deletion,
 * threshold triggers, and rolling cleanup.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as fc from 'fast-check';
import { randomUUID } from 'crypto';
import { createSnapshotManager } from '../snapshotManager.js';
import { createSnapshotStorage } from '../snapshotStorage.js';
import type {
  ConversationContext,
  SnapshotConfig,
  Message,
  SnapshotStorage
} from '../types.js';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs/promises';

// Test helpers
function createTestContext(overrides?: Partial<ConversationContext>): ConversationContext {
  const systemPrompt: Message = {
    id: randomUUID(),
    role: 'system',
    content: 'You are a helpful assistant',
    timestamp: new Date()
  };

  return {
    sessionId: 'test-session',
    messages: [systemPrompt],
    systemPrompt,
    tokenCount: 100,
    maxTokens: 4096,
    metadata: {
      model: 'test-model',
      contextSize: 4096,
      compressionHistory: []
    },
    ...overrides
  };
}

function createTestConfig(overrides?: Partial<SnapshotConfig>): SnapshotConfig {
  return {
    enabled: true,
    maxCount: 5,
    autoCreate: true,
    autoThreshold: 0.8,
    ...overrides
  };
}

// Arbitraries for property-based testing
const arbMessage = fc.record({
  id: fc.uuid(),
  role: fc.constantFrom('system' as const, 'user' as const, 'assistant' as const, 'tool' as const),
  content: fc.string({ minLength: 1, maxLength: 500 }),
  timestamp: fc.date(),
  tokenCount: fc.option(fc.integer({ min: 1, max: 1000 }), { nil: undefined })
});

const arbConversationContext = fc.record({
  sessionId: fc.uuid(),
  messages: fc.array(arbMessage, { minLength: 1, maxLength: 20 }),
  tokenCount: fc.integer({ min: 100, max: 100000 }),
  maxTokens: fc.integer({ min: 4096, max: 131072 }),
  metadata: fc.record({
    model: fc.constantFrom('llama3.1:8b', 'mistral:7b', 'qwen2.5:14b'),
    contextSize: fc.integer({ min: 4096, max: 131072 }),
    compressionHistory: fc.array(fc.record({
      timestamp: fc.date(),
      strategy: fc.constantFrom('summarize', 'truncate', 'hybrid'),
      originalTokens: fc.integer({ min: 1000, max: 50000 }),
      compressedTokens: fc.integer({ min: 500, max: 25000 }),
      ratio: fc.float({ min: Math.fround(0.1), max: Math.fround(1.0) })
    }), { maxLength: 5 })
  })
}).map(ctx => ({
  ...ctx,
  systemPrompt: ctx.messages.find(m => m.role === 'system') || {
    id: randomUUID(),
    role: 'system' as const,
    content: 'System prompt',
    timestamp: new Date()
  }
}));

describe('SnapshotManager', () => {
  let tempDir: string;
  let storage: SnapshotStorage;

  beforeEach(async () => {
    // Create temporary directory for tests
    tempDir = path.join(os.tmpdir(), `snapshot-test-${randomUUID()}`);
    await fs.mkdir(tempDir, { recursive: true });
    storage = createSnapshotStorage(tempDir);
  });

  describe('Unit Tests', () => {
    it('should create a snapshot with all required fields', async () => {
      const config = createTestConfig();
      const manager = createSnapshotManager(storage, config);
      manager.setSessionId('test-session');

      const context = createTestContext();
      const snapshot = await manager.createSnapshot(context);

      expect(snapshot.id).toBeDefined();
      expect(snapshot.sessionId).toBe('test-session');
      expect(snapshot.timestamp).toBeInstanceOf(Date);
      expect(snapshot.tokenCount).toBe(100);
      expect(snapshot.summary).toBeDefined();
      expect(snapshot.messages).toHaveLength(1);
      expect(snapshot.metadata.model).toBe('test-model');
      expect(snapshot.metadata.contextSize).toBe(4096);
    });

    it('should restore context from snapshot', async () => {
      const config = createTestConfig();
      const manager = createSnapshotManager(storage, config);
      manager.setSessionId('test-session');

      const originalContext = createTestContext({
        messages: [
          { id: '1', role: 'system', content: 'System', timestamp: new Date() },
          { id: '2', role: 'user', content: 'Hello', timestamp: new Date() },
          { id: '3', role: 'assistant', content: 'Hi', timestamp: new Date() }
        ]
      });

      const snapshot = await manager.createSnapshot(originalContext);
      const restoredContext = await manager.restoreSnapshot(snapshot.id);

      expect(restoredContext.sessionId).toBe(originalContext.sessionId);
      expect(restoredContext.messages).toHaveLength(3);
      expect(restoredContext.tokenCount).toBe(originalContext.tokenCount);
    });

    it('should list snapshots for a session', async () => {
      const config = createTestConfig();
      const manager = createSnapshotManager(storage, config);
      manager.setSessionId('test-session');

      const context1 = createTestContext();
      const context2 = createTestContext();

      await manager.createSnapshot(context1);
      await manager.createSnapshot(context2);

      const snapshots = await manager.listSnapshots('test-session');
      expect(snapshots).toHaveLength(2);
    });

    it('should delete a snapshot', async () => {
      const config = createTestConfig();
      const manager = createSnapshotManager(storage, config);
      manager.setSessionId('test-session');

      const context = createTestContext();
      const snapshot = await manager.createSnapshot(context);

      await manager.deleteSnapshot(snapshot.id);

      const snapshots = await manager.listSnapshots('test-session');
      expect(snapshots).toHaveLength(0);
    });

    it('should trigger threshold callback at 80%', async () => {
      const config = createTestConfig({ autoThreshold: 0.8 });
      const manager = createSnapshotManager(storage, config);
      manager.setSessionId('test-session');

      const callback = vi.fn();
      manager.onContextThreshold(0.8, callback);

      // Trigger at 80%
      manager.checkThresholds(3277, 4096); // 80%
      expect(callback).toHaveBeenCalled();
    });

    it('should trigger pre-overflow callback at 95%', async () => {
      const config = createTestConfig();
      const manager = createSnapshotManager(storage, config);
      manager.setSessionId('test-session');

      const callback = vi.fn();
      manager.onBeforeOverflow(callback);

      // Trigger at 95%
      manager.checkThresholds(3892, 4096); // 95.02%
      expect(callback).toHaveBeenCalled();
    });

    it('should cleanup old snapshots when maxCount is exceeded', async () => {
      const config = createTestConfig({ maxCount: 3 });
      const manager = createSnapshotManager(storage, config);
      manager.setSessionId('test-session');

      // Create 5 snapshots
      for (let i = 0; i < 5; i++) {
        const context = createTestContext();
        await manager.createSnapshot(context);
        // Small delay to ensure different timestamps
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      const snapshots = await manager.listSnapshots('test-session');
      expect(snapshots.length).toBeLessThanOrEqual(3);
    });

    it('should throw error when snapshots are disabled', async () => {
      const config = createTestConfig({ enabled: false });
      const manager = createSnapshotManager(storage, config);
      manager.setSessionId('test-session');

      const context = createTestContext();
      await expect(manager.createSnapshot(context)).rejects.toThrow('disabled');
    });

    it('should throw error when session ID is not set', async () => {
      const config = createTestConfig();
      const manager = createSnapshotManager(storage, config);

      await expect(manager.cleanupOldSnapshots(5)).rejects.toThrow('Session ID not set');
    });
  });

  describe('Property-Based Tests', () => {
    /**
     * Feature: stage-04b-context-management, Property 11: Snapshot Data Completeness
     * 
     * For any created snapshot, it should contain all required fields:
     * messages, token count, and metadata.
     * 
     * Validates: Requirements 4.1
     */
    it('Property 11: Snapshot Data Completeness', async () => {
      await fc.assert(
        fc.asyncProperty(arbConversationContext, async (context) => {
          const config = createTestConfig();
          const manager = createSnapshotManager(storage, config);
          manager.setSessionId(context.sessionId);

          const snapshot = await manager.createSnapshot(context);

          // Check all required fields are present
          expect(snapshot.id).toBeDefined();
          expect(typeof snapshot.id).toBe('string');
          expect(snapshot.id.length).toBeGreaterThan(0);

          expect(snapshot.sessionId).toBeDefined();
          expect(snapshot.sessionId).toBe(context.sessionId);

          expect(snapshot.timestamp).toBeInstanceOf(Date);

          expect(snapshot.tokenCount).toBeDefined();
          expect(typeof snapshot.tokenCount).toBe('number');
          expect(snapshot.tokenCount).toBe(context.tokenCount);

          expect(snapshot.summary).toBeDefined();
          expect(typeof snapshot.summary).toBe('string');

          expect(snapshot.messages).toBeDefined();
          expect(Array.isArray(snapshot.messages)).toBe(true);
          expect(snapshot.messages.length).toBeGreaterThan(0);

          expect(snapshot.metadata).toBeDefined();
          expect(snapshot.metadata.model).toBeDefined();
          expect(snapshot.metadata.contextSize).toBeDefined();
          expect(snapshot.metadata.compressionRatio).toBeDefined();

          // Cleanup
          await manager.deleteSnapshot(snapshot.id);
        }),
        { numRuns: 100 }
      );
    });

    /**
     * Feature: stage-04b-context-management, Property 12: Snapshot Round Trip
     * 
     * For any conversation context, creating a snapshot and then restoring it
     * should produce an equivalent context with the same messages and metadata.
     * 
     * Validates: Requirements 4.3
     */
    it('Property 12: Snapshot Round Trip', async () => {
      await fc.assert(
        fc.asyncProperty(arbConversationContext, async (originalContext) => {
          const config = createTestConfig();
          const manager = createSnapshotManager(storage, config);
          manager.setSessionId(originalContext.sessionId);

          // Create snapshot
          const snapshot = await manager.createSnapshot(originalContext);

          // Restore from snapshot
          const restoredContext = await manager.restoreSnapshot(snapshot.id);

          // Verify equivalence
          expect(restoredContext.sessionId).toBe(originalContext.sessionId);
          expect(restoredContext.tokenCount).toBe(originalContext.tokenCount);
          expect(restoredContext.messages.length).toBe(originalContext.messages.length);

          // Check each message
          for (let i = 0; i < originalContext.messages.length; i++) {
            const original = originalContext.messages[i];
            const restored = restoredContext.messages[i];

            expect(restored.id).toBe(original.id);
            expect(restored.role).toBe(original.role);
            expect(restored.content).toBe(original.content);
            expect(restored.timestamp.getTime()).toBe(original.timestamp.getTime());
            expect(restored.tokenCount).toBe(original.tokenCount);
          }

          // Check metadata
          expect(restoredContext.metadata.model).toBe(originalContext.metadata.model);
          expect(restoredContext.metadata.contextSize).toBe(originalContext.metadata.contextSize);

          // Cleanup
          await manager.deleteSnapshot(snapshot.id);
        }),
        { numRuns: 100 }
      );
    });

    /**
     * Feature: stage-04b-context-management, Property 13: Snapshot List Metadata
     * 
     * For any session with snapshots, listing snapshots should return all snapshots
     * with their IDs, timestamps, and token counts.
     * 
     * Validates: Requirements 4.4
     */
    it('Property 13: Snapshot List Metadata', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(arbConversationContext, { minLength: 1, maxLength: 5 }),
          async (contexts) => {
            // Use the same session ID for all contexts
            const sessionId = contexts[0].sessionId;
            const normalizedContexts = contexts.map(ctx => ({ ...ctx, sessionId }));

            const config = createTestConfig();
            const manager = createSnapshotManager(storage, config);
            manager.setSessionId(sessionId);

            // Create snapshots
            const createdSnapshots = [];
            for (const context of normalizedContexts) {
              const snapshot = await manager.createSnapshot(context);
              createdSnapshots.push(snapshot);
              // Small delay to ensure different timestamps
              await new Promise(resolve => setTimeout(resolve, 5));
            }

            // List snapshots
            const listedSnapshots = await manager.listSnapshots(sessionId);

            // Verify all snapshots are listed
            expect(listedSnapshots.length).toBe(createdSnapshots.length);

            // Verify each snapshot has required metadata
            for (const snapshot of listedSnapshots) {
              expect(snapshot.id).toBeDefined();
              expect(typeof snapshot.id).toBe('string');

              expect(snapshot.sessionId).toBe(sessionId);

              expect(snapshot.timestamp).toBeInstanceOf(Date);

              expect(snapshot.tokenCount).toBeDefined();
              expect(typeof snapshot.tokenCount).toBe('number');

              // Find corresponding created snapshot
              const created = createdSnapshots.find(s => s.id === snapshot.id);
              expect(created).toBeDefined();
              expect(snapshot.tokenCount).toBe(created!.tokenCount);
            }

            // Cleanup
            for (const snapshot of createdSnapshots) {
              await manager.deleteSnapshot(snapshot.id);
            }
          }
        ),
        { numRuns: 100 }
      );
    }, 10000); // Increase timeout to 10 seconds

    /**
     * Feature: stage-04b-context-management, Property 14: Snapshot Deletion Effect
     * 
     * For any snapshot, after deletion, the snapshot should no longer appear
     * in the list of snapshots.
     * 
     * Validates: Requirements 4.5
     */
    it('Property 14: Snapshot Deletion Effect', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(arbConversationContext, { minLength: 2, maxLength: 5 }),
          async (contexts) => {
            // Use the same session ID for all contexts
            const sessionId = contexts[0].sessionId;
            const normalizedContexts = contexts.map(ctx => ({ ...ctx, sessionId }));

            const config = createTestConfig();
            const manager = createSnapshotManager(storage, config);
            manager.setSessionId(sessionId);

            // Create snapshots
            const createdSnapshots = [];
            for (const context of normalizedContexts) {
              const snapshot = await manager.createSnapshot(context);
              createdSnapshots.push(snapshot);
              // Minimal delay to ensure different timestamps
              await new Promise(resolve => setTimeout(resolve, 1));
            }

            // Pick a random snapshot to delete
            const toDelete = createdSnapshots[Math.floor(Math.random() * createdSnapshots.length)];

            // Delete the snapshot
            await manager.deleteSnapshot(toDelete.id);

            // List remaining snapshots
            const remainingSnapshots = await manager.listSnapshots(sessionId);

            // Verify deleted snapshot is not in the list
            const deletedSnapshot = remainingSnapshots.find(s => s.id === toDelete.id);
            expect(deletedSnapshot).toBeUndefined();

            // Verify count is correct
            expect(remainingSnapshots.length).toBe(createdSnapshots.length - 1);

            // Cleanup remaining snapshots
            for (const snapshot of remainingSnapshots) {
              await manager.deleteSnapshot(snapshot.id);
            }
          }
        ),
        { numRuns: 100 }
      );
    }, 10000); // 10 second timeout

    /**
     * Feature: stage-04b-context-management, Property 15: Auto-Snapshot Threshold
     * 
     * For any context usage level, when usage reaches 80% capacity,
     * a snapshot should be automatically created.
     * 
     * Validates: Requirements 4.6
     */
    it('Property 15: Auto-Snapshot Threshold', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1000, max: 100000 }),
          fc.float({ min: Math.fround(0.7), max: Math.fround(0.99) }),
          async (maxTokens, usageRatio) => {
            const config = createTestConfig({ autoCreate: true, autoThreshold: 0.8 });
            const manager = createSnapshotManager(storage, config);
            manager.setSessionId('test-session');

            let callbackTriggered = false;
            manager.onContextThreshold(0.8, () => {
              callbackTriggered = true;
            });

            const currentTokens = Math.floor(maxTokens * usageRatio);
            manager.checkThresholds(currentTokens, maxTokens);

            // Callback should be triggered if and only if usage >= 80%
            if (usageRatio >= 0.8) {
              expect(callbackTriggered).toBe(true);
            } else {
              expect(callbackTriggered).toBe(false);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Feature: stage-04b-context-management, Property 16: Pre-Overflow Event
     * 
     * For any context approaching overflow (>95%), a pre-overflow event
     * should be emitted.
     * 
     * Validates: Requirements 4.7
     */
    it('Property 16: Pre-Overflow Event', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1000, max: 100000 }),
          fc.float({ min: Math.fround(0.9), max: Math.fround(0.99) }),
          async (maxTokens, usageRatio) => {
            const config = createTestConfig();
            const manager = createSnapshotManager(storage, config);
            manager.setSessionId('test-session');

            let overflowCallbackTriggered = false;
            manager.onBeforeOverflow(() => {
              overflowCallbackTriggered = true;
            });

            const currentTokens = Math.floor(maxTokens * usageRatio);
            manager.checkThresholds(currentTokens, maxTokens);

            // Calculate the actual percentage that checkThresholds will see
            const actualPercentage = (currentTokens / maxTokens) * 100;
            
            // Callback should be triggered if and only if usage >= 95%
            // Use the same calculation as checkThresholds to avoid floating point issues
            if (actualPercentage >= 95) {
              expect(overflowCallbackTriggered).toBe(true);
            } else {
              expect(overflowCallbackTriggered).toBe(false);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Feature: stage-04b-context-management, Property 17: Rolling Snapshot Cleanup
     * 
     * For any configured maximum snapshot count, the number of snapshots should
     * never exceed that maximum, with oldest deleted first.
     * 
     * Validates: Requirements 4.8, 8.9
     */
    it('Property 17: Rolling Snapshot Cleanup', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 2, max: 10 }),
          fc.integer({ min: 3, max: 15 }),
          async (maxCount, snapshotsToCreate) => {
            const sessionId = randomUUID();
            const config = createTestConfig({ maxCount });
            const manager = createSnapshotManager(storage, config);
            manager.setSessionId(sessionId);

            // Create more snapshots than maxCount
            const createdSnapshots = [];
            for (let i = 0; i < snapshotsToCreate; i++) {
              const context = createTestContext({ sessionId });
              const snapshot = await manager.createSnapshot(context);
              createdSnapshots.push(snapshot);
              // Small delay to ensure different timestamps
              await new Promise(resolve => setTimeout(resolve, 1));
            }

            // List snapshots
            const remainingSnapshots = await manager.listSnapshots(sessionId);

            // Verify count does not exceed maxCount
            expect(remainingSnapshots.length).toBeLessThanOrEqual(maxCount);

            // If we created more than maxCount, verify we have exactly maxCount
            if (snapshotsToCreate > maxCount) {
              expect(remainingSnapshots.length).toBe(maxCount);

              // Verify the remaining snapshots are the most recent ones
              const expectedSnapshots = createdSnapshots.slice(-maxCount);
              const remainingIds = new Set(remainingSnapshots.map(s => s.id));

              for (const expected of expectedSnapshots) {
                expect(remainingIds.has(expected.id)).toBe(true);
              }

              // Verify oldest snapshots were deleted
              const oldestSnapshots = createdSnapshots.slice(0, snapshotsToCreate - maxCount);
              for (const oldest of oldestSnapshots) {
                expect(remainingIds.has(oldest.id)).toBe(false);
              }
            }

            // Cleanup
            for (const snapshot of remainingSnapshots) {
              await manager.deleteSnapshot(snapshot.id);
            }
          }
        ),
        { numRuns: 100 }
      );
    }, 15000); // 15 second timeout
  });
});
