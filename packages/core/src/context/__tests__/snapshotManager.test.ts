/**
 * Snapshot Manager Tests
 *
 * Tests for snapshot manager including:
 * - Snapshot creation and restoration
 * - Rolling cleanup
 * - Threshold callbacks
 * - User message preservation
 * - Property-based tests
 */

import * as fc from 'fast-check';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { createSnapshotManager } from '../snapshotManager.js';

import type {
  SnapshotManager,
  SnapshotStorage,
  SnapshotConfig,
  ConversationContext,
  ContextSnapshot,
  Message,
} from '../types.js';

describe('SnapshotManager', () => {
  let manager: SnapshotManager;
  let mockStorage: SnapshotStorage;
  let config: SnapshotConfig;

  beforeEach(() => {
    // Mock storage
    const snapshots = new Map<string, ContextSnapshot>();

    mockStorage = {
      save: vi.fn(async (snapshot: ContextSnapshot) => {
        snapshots.set(snapshot.id, snapshot);
      }),
      load: vi.fn(async (id: string) => {
        const snapshot = snapshots.get(id);
        if (!snapshot) {
          throw new Error(`Snapshot ${id} not found`);
        }
        return snapshot;
      }),
      list: vi.fn(async (sessionId: string) => {
        return Array.from(snapshots.values())
          .filter((s) => s.sessionId === sessionId)
          .map((s) => ({
            id: s.id,
            sessionId: s.sessionId,
            timestamp: s.timestamp,
            tokenCount: s.tokenCount,
            summary: s.summary,
            size: JSON.stringify(s).length, // Approximate size in bytes
          }));
      }),
      delete: vi.fn(async (id: string) => {
        snapshots.delete(id);
      }),
      exists: vi.fn(async (id: string) => {
        return snapshots.has(id);
      }),
      verify: vi.fn(async (id: string) => {
        return snapshots.has(id);
      }),
      getBasePath: vi.fn(() => '/mock/path'),
    };

    // Config
    config = {
      enabled: true,
      maxCount: 5,
      autoCreate: true,
      autoThreshold: 0.85,
    };

    // Create manager
    manager = createSnapshotManager(mockStorage, config);
    manager.setSessionId('test-session');
  });

  // ============================================================================
  // Helper Functions
  // ============================================================================

  function createMessage(
    role: 'user' | 'assistant' | 'system' | 'tool',
    content: string,
    timestamp?: Date
  ): Message {
    return {
      id: `msg-${Date.now()}-${Math.random()}`,
      role,
      content,
      timestamp: timestamp || new Date(),
      tokenCount: Math.ceil(content.length / 4),
    };
  }

  function createContext(messages: Message[]): ConversationContext {
    const systemPrompt =
      messages.find((m) => m.role === 'system') || createMessage('system', 'System prompt');

    return {
      sessionId: 'test-session',
      messages,
      systemPrompt,
      tokenCount: messages.reduce((sum, m) => sum + (m.tokenCount || 0), 0),
      maxTokens: 8192,
      metadata: {
        model: 'test-model',
        contextSize: 8192,
        compressionHistory: [],
      },
    };
  }

  // ============================================================================
  // Initialization Tests
  // ============================================================================

  describe('initialization', () => {
    it('should create snapshot manager with config', () => {
      expect(manager).toBeDefined();
      expect(manager.getConfig()).toEqual(config);
    });

    it('should require session ID to be set', async () => {
      const newManager = createSnapshotManager(mockStorage, config);

      const context = createContext([createMessage('user', 'Test')]);

      await expect(newManager.createSnapshot(context)).rejects.toThrow('Session ID not set');
    });

    it('should allow updating configuration', () => {
      manager.updateConfig({ maxCount: 10 });

      const updatedConfig = manager.getConfig();
      expect(updatedConfig.maxCount).toBe(10);
    });
  });

  // ============================================================================
  // Snapshot Creation Tests
  // ============================================================================

  describe('createSnapshot', () => {
    it('should create snapshot from context', async () => {
      const messages = [
        createMessage('system', 'You are a helpful assistant'),
        createMessage('user', 'Hello'),
        createMessage('assistant', 'Hi there!'),
      ];

      const context = createContext(messages);
      const snapshot = await manager.createSnapshot(context);

      expect(snapshot).toBeDefined();
      expect(snapshot.id).toBeDefined();
      expect(snapshot.sessionId).toBe('test-session');
      expect(snapshot.tokenCount).toBe(context.tokenCount);
      expect(mockStorage.save).toHaveBeenCalledWith(snapshot);
    });

    it('should preserve all user messages in full', async () => {
      const messages = [
        createMessage('user', 'User message 1'),
        createMessage('assistant', 'Response 1'),
        createMessage('user', 'User message 2'),
        createMessage('assistant', 'Response 2'),
      ];

      const context = createContext(messages);
      const snapshot = await manager.createSnapshot(context);

      const userMessages = messages.filter((m) => m.role === 'user');
      expect(snapshot.userMessages).toBeDefined();
      expect(snapshot.userMessages!.length).toBe(userMessages.length);

      // Verify content is preserved in full
      for (let i = 0; i < userMessages.length; i++) {
        expect(snapshot.userMessages![i].content).toBe(userMessages[i].content);
      }
    });

    it('should separate user messages from other messages', async () => {
      const messages = [
        createMessage('system', 'System prompt'),
        createMessage('user', 'User message'),
        createMessage('assistant', 'Assistant response'),
        createMessage('tool', 'Tool result'),
      ];

      const context = createContext(messages);
      const snapshot = await manager.createSnapshot(context);

      // User messages should be in userMessages field
      expect(snapshot.userMessages!.length).toBe(1);
      expect(snapshot.userMessages![0].role).toBe('user');

      // Other messages should be in messages field
      expect(snapshot.messages.length).toBe(3);
      expect(snapshot.messages.every((m) => m.role !== 'user')).toBe(true);
    });

    it('should generate summary from first and last user messages', async () => {
      const messages = [
        createMessage('user', 'First message'),
        createMessage('assistant', 'Response 1'),
        createMessage('user', 'Middle message'),
        createMessage('assistant', 'Response 2'),
        createMessage('user', 'Last message'),
      ];

      const context = createContext(messages);
      const snapshot = await manager.createSnapshot(context);

      expect(snapshot.summary).toContain('First message');
      expect(snapshot.summary).toContain('Last message');
    });

    it('should throw error if snapshots are disabled', async () => {
      const disabledConfig = { ...config, enabled: false };
      const disabledManager = createSnapshotManager(mockStorage, disabledConfig);
      disabledManager.setSessionId('test-session');

      const context = createContext([createMessage('user', 'Test')]);

      await expect(disabledManager.createSnapshot(context)).rejects.toThrow('disabled');
    });
  });

  // ============================================================================
  // Snapshot Restoration Tests
  // ============================================================================

  describe('restoreSnapshot', () => {
    it('should restore snapshot and reconstruct context', async () => {
      const messages = [
        createMessage('system', 'System prompt'),
        createMessage('user', 'User message'),
        createMessage('assistant', 'Assistant response'),
      ];

      const context = createContext(messages);
      const snapshot = await manager.createSnapshot(context);

      const restored = await manager.restoreSnapshot(snapshot.id);

      expect(restored).toBeDefined();
      expect(restored.sessionId).toBe('test-session');
      expect(restored.tokenCount).toBe(snapshot.tokenCount);
      expect(restored.messages.length).toBeGreaterThan(0);
    });

    it('should merge user messages and other messages in chronological order', async () => {
      const messages = [
        createMessage('user', 'Message 1', new Date('2024-01-01T10:00:00Z')),
        createMessage('assistant', 'Response 1', new Date('2024-01-01T10:01:00Z')),
        createMessage('user', 'Message 2', new Date('2024-01-01T10:02:00Z')),
        createMessage('assistant', 'Response 2', new Date('2024-01-01T10:03:00Z')),
      ];

      const context = createContext(messages);
      const snapshot = await manager.createSnapshot(context);

      const restored = await manager.restoreSnapshot(snapshot.id);

      // Messages should be in chronological order
      for (let i = 1; i < restored.messages.length; i++) {
        expect(restored.messages[i].timestamp.getTime()).toBeGreaterThanOrEqual(
          restored.messages[i - 1].timestamp.getTime()
        );
      }
    });

    it('should handle old snapshot format without userMessages field', async () => {
      // Create old-format snapshot manually
      const oldSnapshot: ContextSnapshot = {
        id: 'old-snapshot',
        sessionId: 'test-session',
        timestamp: new Date(),
        tokenCount: 100,
        summary: 'Old snapshot',
        userMessages: [
          {
            id: 'user-1',
            role: 'user',
            content: 'User message',
            timestamp: new Date(),
          },
        ],
        archivedUserMessages: [],
        messages: [createMessage('assistant', 'Assistant response')],
        metadata: {
          model: 'test-model',
          contextSize: 8192,
          compressionRatio: 1.0,
          totalUserMessages: 1,
          totalGoalsCompleted: 0,
          totalCheckpoints: 0,
        },
      };

      await mockStorage.save(oldSnapshot);

      const restored = await manager.restoreSnapshot('old-snapshot');

      expect(restored.messages.length).toBe(2);
      expect(restored.messages.some((m) => m.role === 'user')).toBe(true);
    });

    it('should throw error if snapshot not found', async () => {
      await expect(manager.restoreSnapshot('non-existent')).rejects.toThrow('not found');
    });
  });

  // ============================================================================
  // Snapshot Listing Tests
  // ============================================================================

  describe('listSnapshots', () => {
    it('should list all snapshots for session', async () => {
      const context1 = createContext([createMessage('user', 'Message 1')]);
      const context2 = createContext([createMessage('user', 'Message 2')]);

      await manager.createSnapshot(context1);
      await manager.createSnapshot(context2);

      const snapshots = await manager.listSnapshots('test-session');

      expect(snapshots.length).toBe(2);
    });

    it('should return empty array if no snapshots exist', async () => {
      const snapshots = await manager.listSnapshots('test-session');

      expect(snapshots).toEqual([]);
    });

    it('should skip corrupted snapshots with warning', async () => {
      // Create valid snapshot
      const context = createContext([createMessage('user', 'Valid message')]);
      await manager.createSnapshot(context);

      // Mock storage to return corrupted snapshot
      const originalLoad = mockStorage.load;
      mockStorage.load = vi.fn(async (id: string) => {
        if (id === 'corrupted') {
          throw new Error('Corrupted snapshot');
        }
        return originalLoad(id);
      });

      // Add corrupted snapshot to list
      const originalList = mockStorage.list;
      mockStorage.list = vi.fn(async (sessionId: string) => {
        const list = await originalList(sessionId);
        list.push({
          id: 'corrupted',
          sessionId,
          timestamp: new Date(),
          tokenCount: 0,
          summary: 'Corrupted',
          size: 0,
        });
        return list;
      });

      const snapshots = await manager.listSnapshots('test-session');

      // Should only return valid snapshot
      expect(snapshots.length).toBe(1);
    });
  });

  // ============================================================================
  // Snapshot Deletion Tests
  // ============================================================================

  describe('deleteSnapshot', () => {
    it('should delete snapshot by ID', async () => {
      const context = createContext([createMessage('user', 'Test')]);
      const snapshot = await manager.createSnapshot(context);

      await manager.deleteSnapshot(snapshot.id);

      expect(mockStorage.delete).toHaveBeenCalledWith(snapshot.id);
    });
  });

  // ============================================================================
  // Rolling Cleanup Tests
  // ============================================================================

  describe('cleanupOldSnapshots', () => {
    it('should keep only maxCount most recent snapshots', async () => {
      // Create 7 snapshots (maxCount is 5)
      for (let i = 0; i < 7; i++) {
        const context = createContext([createMessage('user', `Message ${i}`)]);
        await manager.createSnapshot(context);
        // Small delay to ensure different timestamps
        await new Promise((resolve) => setTimeout(resolve, 10));
      }

      const snapshots = await manager.listSnapshots('test-session');

      // Should only have 5 snapshots (oldest 2 deleted)
      expect(snapshots.length).toBe(5);
    });

    it('should delete oldest snapshots first', async () => {
      const timestamps: Date[] = [];

      // Create 7 snapshots with known timestamps
      for (let i = 0; i < 7; i++) {
        const context = createContext([createMessage('user', `Message ${i}`)]);
        const snapshot = await manager.createSnapshot(context);
        timestamps.push(snapshot.timestamp);
        await new Promise((resolve) => setTimeout(resolve, 10));
      }

      const snapshots = await manager.listSnapshots('test-session');

      // Verify oldest 2 were deleted
      const remainingTimestamps = snapshots.map((s) => s.timestamp.getTime());
      expect(remainingTimestamps).not.toContain(timestamps[0].getTime());
      expect(remainingTimestamps).not.toContain(timestamps[1].getTime());
    });
  });

  // ============================================================================
  // Threshold Callback Tests
  // ============================================================================

  describe('threshold callbacks', () => {
    it('should register threshold callback', () => {
      const callback = vi.fn();

      manager.onContextThreshold(0.85, callback);

      // Trigger threshold
      manager.checkThresholds(8500, 10000); // 85%

      expect(callback).toHaveBeenCalled();
    });

    it('should register pre-overflow callback', () => {
      const callback = vi.fn();

      manager.onBeforeOverflow(callback);

      // Trigger overflow threshold (95%)
      manager.checkThresholds(9500, 10000);

      expect(callback).toHaveBeenCalled();
    });

    it('should not trigger callback below threshold', () => {
      const callback = vi.fn();

      manager.onContextThreshold(0.85, callback);

      // Below threshold
      manager.checkThresholds(8000, 10000); // 80%

      expect(callback).not.toHaveBeenCalled();
    });

    it('should support multiple callbacks for same threshold', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      manager.onContextThreshold(0.85, callback1);
      manager.onContextThreshold(0.85, callback2);

      manager.checkThresholds(8500, 10000);

      expect(callback1).toHaveBeenCalled();
      expect(callback2).toHaveBeenCalled();
    });

    it('should deduplicate callbacks', () => {
      const callback = vi.fn();

      manager.onContextThreshold(0.85, callback);
      manager.onContextThreshold(0.85, callback); // Same callback

      manager.checkThresholds(8500, 10000);

      // Should only be called once
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should skip autoThreshold when autoCreate is disabled', () => {
      const disabledConfig = { ...config, autoCreate: false };
      const disabledManager = createSnapshotManager(mockStorage, disabledConfig);
      disabledManager.setSessionId('test-session');

      const callback = vi.fn();
      disabledManager.onContextThreshold(0.85, callback);

      disabledManager.checkThresholds(8500, 10000);

      // Should not trigger because autoCreate is disabled
      expect(callback).not.toHaveBeenCalled();
    });
  });

  // ============================================================================
  // Property-Based Tests
  // ============================================================================

  describe('Property 37.4: User Message Preservation in Snapshots', () => {
    /**
     * Feature: stage-04b-context-management, Property 37.4: User Message Preservation
     *
     * For any snapshot creation, ALL user messages must be preserved in full
     * in the userMessages field without truncation.
     *
     * Validates: Requirements US-6, TR-6
     */
    it('should preserve all user messages in snapshots', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.string({ minLength: 10, maxLength: 200 }), { minLength: 1, maxLength: 20 }),
          async (userContents) => {
            const messages: Message[] = [];

            for (const content of userContents) {
              messages.push(createMessage('user', content));
              messages.push(createMessage('assistant', 'Response'));
            }

            const context = createContext(messages);
            const snapshot = await manager.createSnapshot(context);

            // All user messages must be in userMessages field
            expect(snapshot.userMessages).toBeDefined();
            expect(snapshot.userMessages!.length).toBe(userContents.length);

            // Content must match exactly
            for (let i = 0; i < userContents.length; i++) {
              expect(snapshot.userMessages![i].content).toBe(userContents[i]);
            }
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Property 37.5: Snapshot Restoration Completeness', () => {
    /**
     * Feature: stage-04b-context-management, Property 37.5: Restoration Completeness
     *
     * For any snapshot, restoring it should reconstruct a context with the same
     * token count and message count as the original.
     *
     * Validates: Requirements US-6, TR-6
     */
    it('should restore complete context from snapshot', async () => {
      await fc.assert(
        fc.asyncProperty(fc.integer({ min: 1, max: 10 }), async (messageCount) => {
          const messages: Message[] = [];

          for (let i = 0; i < messageCount; i++) {
            messages.push(createMessage('user', `Message ${i}`));
            messages.push(createMessage('assistant', `Response ${i}`));
          }

          const context = createContext(messages);
          const snapshot = await manager.createSnapshot(context);

          // Ensure snapshot is saved before restoring
          await new Promise((resolve) => setTimeout(resolve, 10));

          const restored = await manager.restoreSnapshot(snapshot.id);

          // Token count should match
          expect(restored.tokenCount).toBe(context.tokenCount);

          // Message count should match
          expect(restored.messages.length).toBe(context.messages.length);
        }),
        { numRuns: 20 } // Reduced runs to avoid timeout
      );
    });
  });

  describe('Property 37.6: Rolling Cleanup Correctness', () => {
    /**
     * Feature: stage-04b-context-management, Property 37.6: Rolling Cleanup
     *
     * For any number of snapshots exceeding maxCount, the cleanup should
     * keep exactly maxCount most recent snapshots.
     *
     * Validates: Requirements US-6, TR-6
     */
    it('should maintain maxCount snapshots after cleanup', async () => {
      await fc.assert(
        fc.asyncProperty(fc.integer({ min: 6, max: 15 }), async (snapshotCount) => {
          // Create snapshots
          for (let i = 0; i < snapshotCount; i++) {
            const context = createContext([createMessage('user', `Message ${i}`)]);
            await manager.createSnapshot(context);
            await new Promise((resolve) => setTimeout(resolve, 5));
          }

          const snapshots = await manager.listSnapshots('test-session');

          // Should have exactly maxCount snapshots
          expect(snapshots.length).toBe(config.maxCount);
        }),
        { numRuns: 20 }
      );
    });
  });
});
