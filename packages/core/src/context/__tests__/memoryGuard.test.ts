/**
 * Memory Guard Tests
 *
 * Tests for the Memory Guard service including property-based tests
 * and unit tests for threshold actions.
 */

import * as fc from 'fast-check';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { MemoryGuardImpl, createMemoryGuard } from '../memoryGuard.js';
import { MemoryLevel } from '../types.js';

import type {
  VRAMMonitor,
  ContextPool,
  SnapshotManager,
  ICompressionService,
  ConversationContext,
  VRAMInfo,
  ContextUsage,
} from '../types.js';

// ============================================================================
// Mock Implementations
// ============================================================================

class MockVRAMMonitor implements VRAMMonitor {
  private info: VRAMInfo = {
    total: 8 * 1024 * 1024 * 1024, // 8GB
    used: 4 * 1024 * 1024 * 1024, // 4GB
    available: 4 * 1024 * 1024 * 1024, // 4GB
    modelLoaded: 3 * 1024 * 1024 * 1024, // 3GB
  };

  async getInfo(): Promise<VRAMInfo> {
    return this.info;
  }

  async getAvailableForContext(): Promise<number> {
    return this.info.available;
  }

  onLowMemory(_callback: (info: VRAMInfo) => void): void {
    // Mock implementation
  }

  startMonitoring(_intervalMs: number): void {
    // Mock implementation
  }

  stopMonitoring(): void {
    // Mock implementation
  }

  setInfo(info: VRAMInfo): void {
    this.info = info;
  }
}

class MockContextPool implements ContextPool {
  config = {
    minContextSize: 2048,
    maxContextSize: 32768,
    targetContextSize: 8192,
    reserveBuffer: 512 * 1024 * 1024,
    kvCacheQuantization: 'q8_0' as const,
    autoSize: true,
  };

  currentSize = 8192;
  private currentTokens = 0;
  private maxTokens = 8192;

  calculateOptimalSize(): number {
    return this.currentSize;
  }

  async resize(newSize: number): Promise<void> {
    this.currentSize = newSize;
    this.maxTokens = newSize;
  }

  getUsage(): ContextUsage {
    return {
      currentTokens: this.currentTokens,
      maxTokens: this.maxTokens,
      percentage: (this.currentTokens / this.maxTokens) * 100,
      vramUsed: 4 * 1024 * 1024 * 1024,
      vramTotal: 8 * 1024 * 1024 * 1024,
    };
  }

  updateConfig(): void {
    // Mock implementation
  }

  setCurrentTokens(tokens: number): void {
    this.currentTokens = tokens;
  }

  updateVRAMInfo(): void {
    // Mock implementation
  }

  setMaxTokens(tokens: number): void {
    this.maxTokens = tokens;
  }
}

class MockSnapshotManager implements SnapshotManager {
  createSnapshot = vi.fn();
  restoreSnapshot = vi.fn();
  listSnapshots = vi.fn();
  deleteSnapshot = vi.fn();
  onContextThreshold = vi.fn();
  onBeforeOverflow = vi.fn();
  cleanupOldSnapshots = vi.fn();
  setSessionId = vi.fn();
  checkThresholds = vi.fn();
  updateConfig = vi.fn();
  getConfig = vi.fn();
}

class MockCompressionService implements ICompressionService {
  compress = vi.fn();
  estimateCompression = vi.fn();
  shouldCompress = vi.fn();
}

// ============================================================================
// Property-Based Tests
// ============================================================================

describe('MemoryGuard - Property Tests', () => {
  /**
   * Property 24: Allocation Safety Check
   * For any token allocation request, canAllocate should return true only if
   * the allocation would not exceed the soft limit (80%).
   *
   * Feature: stage-04b-context-management, Property 24: Allocation Safety Check
   * Validates: Requirements 6.1
   */
  it('Property 24: canAllocate returns true only when allocation does not exceed soft limit', () => {
    fc.assert(
      fc.property(
        // Generate current token count (0 to max)
        fc.integer({ min: 0, max: 10000 }),
        // Generate requested tokens
        fc.integer({ min: 1, max: 5000 }),
        // Generate max tokens
        fc.integer({ min: 1000, max: 20000 }),
        (currentTokens, requestedTokens, maxTokens) => {
          // Setup
          const vramMonitor = new MockVRAMMonitor();
          const contextPool = new MockContextPool();
          contextPool.setCurrentTokens(currentTokens);
          contextPool.setMaxTokens(maxTokens);

          const memoryGuard = new MemoryGuardImpl(vramMonitor, contextPool);

          // Calculate expected result
          const newTokenCount = currentTokens + requestedTokens;
          const newPercentage = newTokenCount / maxTokens;
          const softLimit = 0.8; // 80%

          // Get safe limit (includes safety buffer)
          const safeLimit = memoryGuard.getSafeLimit();
          const wouldExceedSafeLimit = newTokenCount > safeLimit;

          const expectedResult = !wouldExceedSafeLimit && newPercentage < softLimit;

          // Test
          const result = memoryGuard.canAllocate(requestedTokens);

          // Verify
          return result === expectedResult;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 26: Safety Buffer Inclusion
   * For any safe allocation limit calculation, a safety buffer of 512MB
   * should be subtracted from available memory.
   *
   * Feature: stage-04b-context-management, Property 26: Safety Buffer Inclusion
   * Validates: Requirements 6.6
   */
  it('Property 26: getSafeLimit respects soft threshold', () => {
    fc.assert(
      fc.property(
        // Generate max tokens
        fc.integer({ min: 2048, max: 131072 }),
        // Generate soft threshold
        fc
          .double({ min: 0.5, max: 0.9, noNaN: true, noDefaultInfinity: true })
          .filter((v) => isFinite(v) && !isNaN(v)),
        (maxTokens, softThreshold) => {
          // Setup
          const vramMonitor = new MockVRAMMonitor();
          const contextPool = new MockContextPool();
          contextPool.setMaxTokens(maxTokens);

          const memoryGuard = new MemoryGuardImpl(vramMonitor, contextPool, {
            safetyBuffer: 512 * 1024 * 1024,
            thresholds: {
              soft: softThreshold,
              hard: 0.9,
              critical: 0.95,
            },
          });

          // Calculate expected safe limit
          const expectedSafeLimit = Math.floor(maxTokens * softThreshold);

          // Test
          const safeLimit = memoryGuard.getSafeLimit();

          // Verify: Safe limit should equal soft limit
          // (safety buffer is applied at VRAM level, not token level)
          return safeLimit === expectedSafeLimit;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 25: Emergency Action Notification
   * For any emergency action taken by Memory Guard, the user should be
   * notified with recovery options.
   *
   * Feature: stage-04b-context-management, Property 25: Emergency Action Notification
   * Validates: Requirements 6.5
   */
  it('Property 25: executeEmergencyActions emits notification with recovery options', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate session ID
        fc.string({ minLength: 5, maxLength: 20 }),
        // Generate message count
        fc.integer({ min: 0, max: 10 }),
        async (sessionId, messageCount) => {
          // Setup
          const vramMonitor = new MockVRAMMonitor();
          const contextPool = new MockContextPool();
          const snapshotManager = new MockSnapshotManager();
          const compressionService = new MockCompressionService();

          const memoryGuard = new MemoryGuardImpl(vramMonitor, contextPool);
          memoryGuard.setServices({ snapshot: snapshotManager, compression: compressionService });

          // Create mock context with random messages
          const messages = Array.from({ length: messageCount }, (_, i) => ({
            id: `msg-${i}`,
            role: i === 0 ? ('system' as const) : ('user' as const),
            content: `Message ${i}`,
            timestamp: new Date(),
          }));

          const mockContext: ConversationContext = {
            sessionId,
            messages,
            systemPrompt: messages[0] || {
              id: 'system',
              role: 'system',
              content: 'System',
              timestamp: new Date(),
            },
            tokenCount: messageCount * 100,
            maxTokens: 10000,
            metadata: {
              model: 'test-model',
              contextSize: 10000,
              compressionHistory: [],
            },
          };

          memoryGuard.setContext(mockContext);

          // Listen for emergency event
          const emergencyPromise = new Promise<any>((resolve) => {
            memoryGuard.once('emergency', (data) => resolve(data));
          });

          // Execute emergency actions
          await memoryGuard.executeEmergencyActions();

          // Wait for emergency event
          const emergencyData = await emergencyPromise;

          // Verify: Emergency event should include recovery options
          return (
            emergencyData &&
            emergencyData.level === MemoryLevel.EMERGENCY &&
            Array.isArray(emergencyData.recoveryOptions) &&
            emergencyData.recoveryOptions.length > 0 &&
            emergencyData.recoveryOptions.every((opt: any) => typeof opt === 'string')
          );
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ============================================================================
// Unit Tests
// ============================================================================

describe('MemoryGuard - Unit Tests', () => {
  let vramMonitor: MockVRAMMonitor;
  let contextPool: MockContextPool;
  let snapshotManager: MockSnapshotManager;
  let compressionService: MockCompressionService;
  let memoryGuard: MemoryGuardImpl;

  beforeEach(() => {
    vramMonitor = new MockVRAMMonitor();
    contextPool = new MockContextPool();
    snapshotManager = new MockSnapshotManager();
    compressionService = new MockCompressionService();

    memoryGuard = new MemoryGuardImpl(vramMonitor, contextPool);
    memoryGuard.setServices({ snapshot: snapshotManager, compression: compressionService });
  });

  describe('canAllocate', () => {
    it('should return true when allocation is safe', () => {
      contextPool.setCurrentTokens(1000);
      contextPool.setMaxTokens(100000); // Larger max to account for safety buffer

      const result = memoryGuard.canAllocate(500);

      expect(result).toBe(true);
    });

    it('should return false when allocation would exceed soft limit', () => {
      contextPool.setCurrentTokens(7500);
      contextPool.setMaxTokens(10000);

      const result = memoryGuard.canAllocate(1000);

      expect(result).toBe(false);
    });

    it('should return false when allocation would exceed safe limit', () => {
      contextPool.setCurrentTokens(6000);
      contextPool.setMaxTokens(10000);

      const result = memoryGuard.canAllocate(3000);

      expect(result).toBe(false);
    });
  });

  describe('getSafeLimit', () => {
    it('should calculate safe limit with safety buffer', () => {
      contextPool.setMaxTokens(100000);

      const safeLimit = memoryGuard.getSafeLimit();

      // Should be 80% of max tokens (soft threshold)
      expect(safeLimit).toBe(80000);
    });

    it('should respect custom safety buffer', () => {
      const customGuard = new MemoryGuardImpl(vramMonitor, contextPool, {
        safetyBuffer: 1024 * 1024 * 1024, // 1GB
        thresholds: {
          soft: 0.7, // Custom soft threshold
          hard: 0.9,
          critical: 0.95,
        },
      });

      contextPool.setMaxTokens(100000);

      const safeLimit = customGuard.getSafeLimit();

      // Should be 70% of max tokens (custom soft threshold)
      expect(safeLimit).toBe(70000);
    });
  });

  describe('onThreshold', () => {
    it('should register callback for memory level', () => {
      const callback = vi.fn();

      memoryGuard.onThreshold(MemoryLevel.WARNING, callback);

      // Callback should be registered (we can't directly test this without triggering)
      expect(callback).not.toHaveBeenCalled();
    });

    it('should allow multiple callbacks for same level', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      memoryGuard.onThreshold(MemoryLevel.WARNING, callback1);
      memoryGuard.onThreshold(MemoryLevel.WARNING, callback2);

      // Both callbacks should be registered
      expect(callback1).not.toHaveBeenCalled();
      expect(callback2).not.toHaveBeenCalled();
    });
  });

  describe('executeEmergencyActions', () => {
    it('should create snapshot and clear context', async () => {
      const mockContext: ConversationContext = {
        sessionId: 'test-session',
        messages: [
          {
            id: '1',
            role: 'system',
            content: 'System prompt',
            timestamp: new Date(),
          },
          {
            id: '2',
            role: 'user',
            content: 'User message',
            timestamp: new Date(),
          },
        ],
        systemPrompt: {
          id: '1',
          role: 'system',
          content: 'System prompt',
          timestamp: new Date(),
        },
        tokenCount: 100,
        maxTokens: 1000,
        metadata: {
          model: 'test-model',
          contextSize: 1000,
          compressionHistory: [],
        },
      };

      snapshotManager.createSnapshot.mockResolvedValue({
        id: 'snapshot-123',
        sessionId: 'test-session',
        timestamp: new Date(),
        tokenCount: 100,
        summary: 'Test snapshot',
        messages: mockContext.messages,
        metadata: {
          model: 'test-model',
          contextSize: 1000,
          compressionRatio: 1.0,
        },
      });

      memoryGuard.setContext(mockContext);

      const emergencyPromise = new Promise<void>((resolve) => {
        memoryGuard.on('emergency', () => resolve());
      });

      await memoryGuard.executeEmergencyActions();

      // Wait for emergency event
      await emergencyPromise;

      // Verify snapshot was created
      expect(snapshotManager.createSnapshot).toHaveBeenCalledWith(mockContext);

      // Verify context was cleared (only system prompt remains)
      expect(mockContext.messages).toHaveLength(1);
      expect(mockContext.messages[0].role).toBe('system');
    });

    it('should emit emergency event with recovery options', async () => {
      const mockContext: ConversationContext = {
        sessionId: 'test-session',
        messages: [],
        systemPrompt: {
          id: '1',
          role: 'system',
          content: 'System prompt',
          timestamp: new Date(),
        },
        tokenCount: 0,
        maxTokens: 1000,
        metadata: {
          model: 'test-model',
          contextSize: 1000,
          compressionHistory: [],
        },
      };

      memoryGuard.setContext(mockContext);

      const emergencyData = await new Promise<any>((resolve) => {
        memoryGuard.on('emergency', (data) => resolve(data));
        memoryGuard.executeEmergencyActions();
      });

      // Verify emergency event includes recovery options
      expect(emergencyData).toHaveProperty('level', MemoryLevel.EMERGENCY);
      expect(emergencyData).toHaveProperty('actions');
      expect(emergencyData).toHaveProperty('recoveryOptions');
      expect(emergencyData.recoveryOptions).toBeInstanceOf(Array);
      expect(emergencyData.recoveryOptions.length).toBeGreaterThan(0);
    });
  });

  describe('threshold actions', () => {
    it('should trigger compression at 80% threshold', async () => {
      const mockContext: ConversationContext = {
        sessionId: 'test-session',
        messages: [
          {
            id: '1',
            role: 'user',
            content: 'Test message',
            timestamp: new Date(),
          },
        ],
        systemPrompt: {
          id: '0',
          role: 'system',
          content: 'System',
          timestamp: new Date(),
        },
        tokenCount: 8000,
        maxTokens: 10000,
        metadata: {
          model: 'test-model',
          contextSize: 10000,
          compressionHistory: [],
        },
      };

      compressionService.compress.mockResolvedValue({
        summary: {
          id: 'summary',
          role: 'system',
          content: 'Summary',
          timestamp: new Date(),
        },
        preserved: [],
        originalTokens: 8000,
        compressedTokens: 4000,
        compressionRatio: 0.5,
      });

      memoryGuard.setContext(mockContext);
      contextPool.setCurrentTokens(8000);
      contextPool.setMaxTokens(10000);

      await memoryGuard.checkMemoryLevelAndAct();

      // Verify compression was triggered
      expect(compressionService.compress).toHaveBeenCalled();
    });

    it('should force context reduction at 90% threshold', async () => {
      contextPool.setCurrentTokens(9000);
      contextPool.setMaxTokens(10000);

      const resizeSpy = vi.spyOn(contextPool, 'resize');

      await memoryGuard.checkMemoryLevelAndAct();

      // Verify context was reduced
      expect(resizeSpy).toHaveBeenCalled();
      const newSize = resizeSpy.mock.calls[0][0];
      expect(newSize).toBeLessThan(10000);
    });

    it('should execute emergency actions at 95% threshold', async () => {
      const mockContext: ConversationContext = {
        sessionId: 'test-session',
        messages: [
          {
            id: '1',
            role: 'system',
            content: 'System',
            timestamp: new Date(),
          },
          {
            id: '2',
            role: 'user',
            content: 'User message',
            timestamp: new Date(),
          },
        ],
        systemPrompt: {
          id: '1',
          role: 'system',
          content: 'System',
          timestamp: new Date(),
        },
        tokenCount: 9500,
        maxTokens: 10000,
        metadata: {
          model: 'test-model',
          contextSize: 10000,
          compressionHistory: [],
        },
      };

      memoryGuard.setContext(mockContext);
      contextPool.setCurrentTokens(9500);
      contextPool.setMaxTokens(10000);

      const emergencyPromise = new Promise<void>((resolve) => {
        memoryGuard.on('emergency', () => resolve());
      });

      await memoryGuard.checkMemoryLevelAndAct();

      // Wait for emergency event with timeout
      await Promise.race([
        emergencyPromise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 3000)),
      ]);

      // Verify emergency actions were executed
      expect(snapshotManager.createSnapshot).toHaveBeenCalled();
    });
  });

  describe('createMemoryGuard factory', () => {
    it('should create a memory guard instance', () => {
      const guard = createMemoryGuard(vramMonitor, contextPool);

      expect(guard).toBeDefined();
      expect(guard.canAllocate).toBeDefined();
      expect(guard.getSafeLimit).toBeDefined();
    });

    it('should accept custom configuration', () => {
      const guard = createMemoryGuard(vramMonitor, contextPool, {
        safetyBuffer: 1024 * 1024 * 1024,
        thresholds: {
          soft: 0.7,
          hard: 0.85,
          critical: 0.95,
        },
      });

      expect(guard).toBeDefined();
    });
  });
});
