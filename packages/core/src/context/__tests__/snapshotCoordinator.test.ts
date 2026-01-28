/**
 * Snapshot Coordinator Tests
 *
 * Tests for snapshot coordinator orchestration including:
 * - Snapshot creation and restoration
 * - Integration with context manager
 * - Pool and guard state synchronization
 * - Event emission
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { SnapshotCoordinator } from '../snapshotCoordinator.js';

import type {
  ContextSnapshot,
  ConversationContext,
  MemoryGuard,
  SnapshotConfig,
  SnapshotManager,
  SnapshotStorage,
  ContextPool,
} from '../types.js';

describe('SnapshotCoordinator', () => {
  let coordinator: SnapshotCoordinator;
  let mockSnapshotManager: SnapshotManager;
  let mockSnapshotStorage: SnapshotStorage;
  let mockContextPool: ContextPool;
  let mockMemoryGuard: MemoryGuard;
  let mockGetContext: () => ConversationContext;
  let mockSetContext: (context: ConversationContext) => void;
  let mockEmit: (event: string, payload?: unknown) => void;
  let currentContext: ConversationContext;
  let emittedEvents: Array<{ event: string; payload?: unknown }>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Suppress console output during tests
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    // Initialize current context
    currentContext = {
      sessionId: 'session-1',
      systemPrompt: {
        id: 'system-1',
        role: 'system',
        content: 'You are a helpful assistant',
        timestamp: new Date('2024-01-15T10:00:00Z'),
      },
      messages: [
        {
          id: 'msg-1',
          role: 'system',
          content: 'You are a helpful assistant',
          timestamp: new Date('2024-01-15T10:00:00Z'),
        },
        {
          id: 'msg-2',
          role: 'user',
          content: 'Hello',
          timestamp: new Date('2024-01-15T10:15:00Z'),
        },
      ],
      tokenCount: 100,
      maxTokens: 4096,
      metadata: {
        model: 'test-model',
        contextSize: 4096,
        compressionHistory: [],
      },
    };

    // Track emitted events
    emittedEvents = [];

    // Mock snapshot manager
    mockSnapshotManager = {
      createSnapshot: vi.fn(async (context: ConversationContext): Promise<ContextSnapshot> => {
        return {
          id: 'snapshot-1',
          sessionId: 'session-1',
          timestamp: new Date(),
          tokenCount: context.tokenCount,
          summary: 'Test snapshot',
          userMessages: [],
          archivedUserMessages: [],
          messages: context.messages,
          metadata: {
            model: 'test-model',
            contextSize: 4096,
            compressionRatio: 1.0,
            totalUserMessages: 1,
            totalGoalsCompleted: 0,
            totalCheckpoints: 0,
          },
        };
      }),
      restoreSnapshot: vi.fn(async (_snapshotId: string): Promise<ConversationContext> => {
        return {
          sessionId: 'session-1',
          systemPrompt: {
            id: 'system-1',
            role: 'system',
            content: 'Restored system message',
            timestamp: new Date('2024-01-15T09:00:00Z'),
          },
          messages: [
            {
              id: 'restored-msg-1',
              role: 'system',
              content: 'Restored system message',
              timestamp: new Date('2024-01-15T09:00:00Z'),
            },
          ],
          tokenCount: 50,
          maxTokens: 4096,
          metadata: {
            model: 'test-model',
            contextSize: 4096,
            compressionHistory: [],
          },
        };
      }),
      listSnapshots: vi.fn(async (sessionId: string): Promise<ContextSnapshot[]> => {
        return [
          {
            id: 'snapshot-1',
            sessionId,
            timestamp: new Date('2024-01-15T10:00:00Z'),
            tokenCount: 100,
            summary: 'First snapshot',
            userMessages: [],
            archivedUserMessages: [],
            messages: [],
            metadata: {
              model: 'test-model',
              contextSize: 4096,
              compressionRatio: 1.0,
              totalUserMessages: 0,
              totalGoalsCompleted: 0,
              totalCheckpoints: 0,
            },
          },
          {
            id: 'snapshot-2',
            sessionId,
            timestamp: new Date('2024-01-15T11:00:00Z'),
            tokenCount: 200,
            summary: 'Second snapshot',
            userMessages: [],
            archivedUserMessages: [],
            messages: [],
            metadata: {
              model: 'test-model',
              contextSize: 4096,
              compressionRatio: 1.0,
              totalUserMessages: 0,
              totalGoalsCompleted: 0,
              totalCheckpoints: 0,
            },
          },
        ];
      }),
      updateConfig: vi.fn(),
    } as unknown as SnapshotManager;

    // Mock snapshot storage
    mockSnapshotStorage = {
      save: vi.fn(),
      load: vi.fn(async (snapshotId: string): Promise<ContextSnapshot | null> => {
        if (snapshotId === 'snapshot-1') {
          return {
            id: 'snapshot-1',
            sessionId: 'session-1',
            timestamp: new Date('2024-01-15T10:00:00Z'),
            tokenCount: 100,
            summary: 'Test snapshot',
            userMessages: [],
            archivedUserMessages: [],
            messages: [],
            metadata: {
              model: 'test-model',
              contextSize: 4096,
              compressionRatio: 1.0,
              totalUserMessages: 0,
              totalGoalsCompleted: 0,
              totalCheckpoints: 0,
            },
          };
        }
        return null;
      }),
      list: vi.fn(),
      delete: vi.fn(),
    } as unknown as SnapshotStorage;

    // Mock context pool
    mockContextPool = {
      setCurrentTokens: vi.fn(),
      getCurrentTokens: vi.fn(() => 100),
      getTargetSize: vi.fn(() => 4096),
      getMaxSize: vi.fn(() => 8192),
      getUsagePercent: vi.fn(() => 0.5),
    } as unknown as ContextPool;

    // Mock memory guard
    mockMemoryGuard = {
      setContext: vi.fn(),
      checkMemory: vi.fn(() => ({ safe: true, usage: 0.5 })),
    } as unknown as MemoryGuard;

    // Mock context getters/setters
    mockGetContext = vi.fn(() => currentContext);
    mockSetContext = vi.fn((context: ConversationContext) => {
      currentContext = context;
    });

    // Mock emit function
    mockEmit = vi.fn((event: string, payload?: unknown) => {
      emittedEvents.push({ event, payload });
    });

    // Create coordinator
    coordinator = new SnapshotCoordinator({
      snapshotManager: mockSnapshotManager,
      snapshotStorage: mockSnapshotStorage,
      contextPool: mockContextPool,
      memoryGuard: mockMemoryGuard,
      getContext: mockGetContext,
      setContext: mockSetContext,
      emit: mockEmit,
      sessionId: 'session-1',
    });
  });

  afterEach(() => {
    // Restore console methods
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  // ============================================================================
  // Snapshot Creation Tests
  // ============================================================================

  describe('createSnapshot', () => {
    it('should create a snapshot from current context', async () => {
      const snapshot = await coordinator.createSnapshot();

      expect(snapshot).toBeDefined();
      expect(snapshot.id).toBe('snapshot-1');
      expect(snapshot.tokenCount).toBe(100);
      expect(mockSnapshotManager.createSnapshot).toHaveBeenCalledWith(currentContext);
    });

    it('should emit snapshot-created event', async () => {
      const snapshot = await coordinator.createSnapshot();

      expect(mockEmit).toHaveBeenCalledWith('snapshot-created', snapshot);
      expect(emittedEvents).toHaveLength(1);
      expect(emittedEvents[0].event).toBe('snapshot-created');
    });

    it('should call getContext to retrieve current state', async () => {
      await coordinator.createSnapshot();

      expect(mockGetContext).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // Snapshot Restoration Tests
  // ============================================================================

  describe('restoreSnapshot', () => {
    it('should restore a snapshot and update context', async () => {
      await coordinator.restoreSnapshot('snapshot-1');

      expect(mockSnapshotManager.restoreSnapshot).toHaveBeenCalledWith('snapshot-1');
      expect(mockSetContext).toHaveBeenCalled();

      // Verify context was updated
      const updatedContext = (mockSetContext as any).mock.calls[0][0];
      expect(updatedContext.tokenCount).toBe(50);
    });

    it('should synchronize context pool with restored token count', async () => {
      await coordinator.restoreSnapshot('snapshot-1');

      expect(mockContextPool.setCurrentTokens).toHaveBeenCalledWith(50);
    });

    it('should synchronize memory guard with restored context', async () => {
      await coordinator.restoreSnapshot('snapshot-1');

      const restoredContext = (mockSetContext as any).mock.calls[0][0];
      expect(mockMemoryGuard.setContext).toHaveBeenCalledWith(restoredContext);
    });

    it('should emit snapshot-restored event', async () => {
      await coordinator.restoreSnapshot('snapshot-1');

      expect(mockEmit).toHaveBeenCalledWith(
        'snapshot-restored',
        expect.objectContaining({
          snapshotId: 'snapshot-1',
          context: expect.any(Object),
        })
      );
    });

    it('should restore snapshot with correct order of operations', async () => {
      const callOrder: string[] = [];

      mockSnapshotManager.restoreSnapshot = vi.fn(async () => {
        callOrder.push('restore');
        return currentContext;
      });

      mockSetContext = vi.fn(() => {
        callOrder.push('setContext');
      });

      mockContextPool.setCurrentTokens = vi.fn(() => {
        callOrder.push('setTokens');
      });

      mockMemoryGuard.setContext = vi.fn(() => {
        callOrder.push('setGuard');
      });

      mockEmit = vi.fn(() => {
        callOrder.push('emit');
      });

      // Recreate coordinator with new mocks
      coordinator = new SnapshotCoordinator({
        snapshotManager: mockSnapshotManager,
        snapshotStorage: mockSnapshotStorage,
        contextPool: mockContextPool,
        memoryGuard: mockMemoryGuard,
        getContext: mockGetContext,
        setContext: mockSetContext,
        emit: mockEmit,
        sessionId: 'session-1',
      });

      await coordinator.restoreSnapshot('snapshot-1');

      // Verify order: restore → setContext → setTokens → setGuard → emit
      expect(callOrder).toEqual(['restore', 'setContext', 'setTokens', 'setGuard', 'emit']);
    });
  });

  // ============================================================================
  // Snapshot Listing Tests
  // ============================================================================

  describe('listSnapshots', () => {
    it('should list snapshots for current session', async () => {
      const snapshots = await coordinator.listSnapshots();

      expect(snapshots).toHaveLength(2);
      expect(mockSnapshotManager.listSnapshots).toHaveBeenCalledWith('session-1');
    });

    it('should return snapshots in correct order', async () => {
      const snapshots = await coordinator.listSnapshots();

      expect(snapshots[0].id).toBe('snapshot-1');
      expect(snapshots[1].id).toBe('snapshot-2');
    });

    it('should return empty array when no snapshots exist', async () => {
      mockSnapshotManager.listSnapshots = vi.fn(async () => []);

      const snapshots = await coordinator.listSnapshots();

      expect(snapshots).toEqual([]);
    });
  });

  // ============================================================================
  // Snapshot Loading Tests
  // ============================================================================

  describe('getSnapshot', () => {
    it('should load a snapshot by ID', async () => {
      const snapshot = await coordinator.getSnapshot('snapshot-1');

      expect(snapshot).toBeDefined();
      expect(snapshot?.id).toBe('snapshot-1');
      expect(mockSnapshotStorage.load).toHaveBeenCalledWith('snapshot-1');
    });

    it('should return null for non-existent snapshot', async () => {
      const snapshot = await coordinator.getSnapshot('non-existent');

      expect(snapshot).toBeNull();
    });

    it('should handle storage errors gracefully', async () => {
      mockSnapshotStorage.load = vi.fn(async () => {
        throw new Error('Storage error');
      });

      const snapshot = await coordinator.getSnapshot('snapshot-1');

      expect(snapshot).toBeNull();
      // Verify error was logged (but suppressed by mock)
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to load snapshot'),
        expect.any(Error)
      );
    });
  });

  // ============================================================================
  // Configuration Update Tests
  // ============================================================================

  describe('updateConfig', () => {
    it('should update snapshot manager configuration', () => {
      const newConfig: SnapshotConfig = {
        enabled: true,
        maxCount: 50,
        autoCreate: true,
        autoThreshold: 0.8,
      };

      coordinator.updateConfig(newConfig);

      expect(mockSnapshotManager.updateConfig).toHaveBeenCalledWith(newConfig);
    });

    it('should allow partial configuration updates', () => {
      const partialConfig: Partial<SnapshotConfig> = {
        maxCount: 100,
      };

      coordinator.updateConfig(partialConfig as SnapshotConfig);

      expect(mockSnapshotManager.updateConfig).toHaveBeenCalledWith(partialConfig);
    });
  });

  // ============================================================================
  // Integration Tests
  // ============================================================================

  describe('integration scenarios', () => {
    it('should handle create → list → restore workflow', async () => {
      // Create snapshot
      const created = await coordinator.createSnapshot();
      expect(created.id).toBe('snapshot-1');

      // List snapshots
      const snapshots = await coordinator.listSnapshots();
      expect(snapshots).toHaveLength(2);

      // Restore snapshot
      await coordinator.restoreSnapshot('snapshot-1');
      expect(mockSetContext).toHaveBeenCalled();
    });

    it('should maintain state consistency across operations', async () => {
      // Initial state
      expect(currentContext.tokenCount).toBe(100);

      // Create snapshot
      await coordinator.createSnapshot();

      // Restore different snapshot (token count: 50)
      await coordinator.restoreSnapshot('snapshot-1');

      // Verify pool was updated
      expect(mockContextPool.setCurrentTokens).toHaveBeenCalledWith(50);
    });

    it('should emit events in correct sequence', async () => {
      emittedEvents = [];

      await coordinator.createSnapshot();
      await coordinator.restoreSnapshot('snapshot-1');

      expect(emittedEvents).toHaveLength(2);
      expect(emittedEvents[0].event).toBe('snapshot-created');
      expect(emittedEvents[1].event).toBe('snapshot-restored');
    });
  });

  // ============================================================================
  // Error Handling Tests
  // ============================================================================

  describe('error handling', () => {
    it('should propagate snapshot creation errors', async () => {
      mockSnapshotManager.createSnapshot = vi.fn(async () => {
        throw new Error('Creation failed');
      });

      await expect(coordinator.createSnapshot()).rejects.toThrow('Creation failed');
    });

    it('should propagate snapshot restoration errors', async () => {
      mockSnapshotManager.restoreSnapshot = vi.fn(async () => {
        throw new Error('Restoration failed');
      });

      await expect(coordinator.restoreSnapshot('snapshot-1')).rejects.toThrow('Restoration failed');
    });

    it('should handle listing errors gracefully', async () => {
      mockSnapshotManager.listSnapshots = vi.fn(async () => {
        throw new Error('List failed');
      });

      await expect(coordinator.listSnapshots()).rejects.toThrow('List failed');
    });
  });
});
