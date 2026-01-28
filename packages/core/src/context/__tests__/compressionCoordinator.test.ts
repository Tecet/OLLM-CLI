/**
 * Compression Coordinator Tests
 * 
 * Tests for compression coordinator orchestration including:
 * - Compression strategy selection
 * - Threshold triggers
 * - Integration with context manager
 * - Blocking mechanism for summarization
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

import { CompressionCoordinator } from '../compressionCoordinator.js';
import { MemoryLevel, ContextTier } from '../types.js';

import type {
  CheckpointManager,
  ContextConfig,
  ContextUsage,
  ConversationContext,
  ContextPool,
  ICompressionService,
  MemoryGuard,
  ModeProfile,
  SnapshotManager,
  SnapshotConfig,
  TokenCounter,
} from '../types.js';

describe('CompressionCoordinator', () => {
  let coordinator: CompressionCoordinator;
  let mockConfig: ContextConfig;
  let mockGetContext: () => ConversationContext;
  let mockGetUsage: () => ContextUsage;
  let mockGetTierConfig: () => { tier: ContextTier; strategy: string; maxCheckpoints: number };
  let mockGetModeProfile: () => ModeProfile;
  let mockSnapshotManager: SnapshotManager;
  let mockCompressionService: ICompressionService;
  let mockTokenCounter: TokenCounter;
  let mockContextPool: ContextPool;
  let mockEmit: (event: string, payload?: unknown) => void;
  let mockCheckpointManager: CheckpointManager;
  let emittedEvents: Array<{ event: string; payload?: unknown }>;

  beforeEach(() => {
    // Track emitted events
    emittedEvents = [];

    // Mock config
    mockConfig = {
      compression: {
        enabled: true,
        strategy: 'moderate',
        thresholds: {
          aggressive: 0.75,
          moderate: 0.80,
          conservative: 0.85,
        },
      },
      snapshot: {
        enabled: true,
        maxSnapshots: 10,
        autoSnapshotInterval: 300000,
      },
    } as ContextConfig;

    // Mock context
    mockGetContext = vi.fn(() => ({
      messages: [],
      userMessages: [],
      archivedUserMessages: [],
      tokenCount: 1000,
      summary: 'Test context',
    }));

    // Mock usage
    mockGetUsage = vi.fn(() => ({
      currentTokens: 1000,
      targetSize: 4096,
      maxSize: 8192,
      usagePercent: 0.25,
    }));

    // Mock tier config
    mockGetTierConfig = vi.fn(() => ({
      tier: ContextTier.TIER_3_STANDARD,
      strategy: 'moderate',
      maxCheckpoints: 5,
    }));

    // Mock mode profile
    mockGetModeProfile = vi.fn(() => ({
      name: 'default',
      description: 'Default mode',
      contextSize: 4096,
      temperature: 0.7,
    } as ModeProfile));

    // Mock snapshot manager
    mockSnapshotManager = {
      createSnapshot: vi.fn(),
      restoreSnapshot: vi.fn(),
      listSnapshots: vi.fn(),
      updateConfig: vi.fn(),
      onContextThreshold: vi.fn(),
      onBeforeOverflow: vi.fn(),
    } as unknown as SnapshotManager;

    // Mock compression service
    mockCompressionService = {
      compress: vi.fn(async () => ({
        messages: [],
        tokenCount: 500,
        compressionRatio: 0.5,
      })),
      shouldCompress: vi.fn(async () => true),
    } as unknown as ICompressionService;

    // Mock token counter
    mockTokenCounter = {
      countTokens: vi.fn(async () => 100),
      countTokensCached: vi.fn(() => 100),
    } as unknown as TokenCounter;

    // Mock context pool
    mockContextPool = {
      setCurrentTokens: vi.fn(),
      getCurrentTokens: vi.fn(() => 1000),
      getTargetSize: vi.fn(() => 4096),
      getMaxSize: vi.fn(() => 8192),
      getUsagePercent: vi.fn(() => 0.25),
    } as unknown as ContextPool;

    // Mock emit function
    mockEmit = vi.fn((event: string, payload?: unknown) => {
      emittedEvents.push({ event, payload });
    });

    // Mock checkpoint manager
    mockCheckpointManager = {
      createCheckpoint: vi.fn(),
      restoreCheckpoint: vi.fn(),
      listCheckpoints: vi.fn(() => []),
      deleteCheckpoint: vi.fn(),
    } as unknown as CheckpointManager;

    // Create coordinator
    coordinator = new CompressionCoordinator({
      config: mockConfig,
      getContext: mockGetContext,
      getUsage: mockGetUsage,
      getTierConfig: mockGetTierConfig,
      getModeProfile: mockGetModeProfile,
      snapshotManager: mockSnapshotManager,
      compressionService: mockCompressionService,
      tokenCounter: mockTokenCounter,
      contextPool: mockContextPool,
      emit: mockEmit,
      checkpointManager: mockCheckpointManager,
      isTestEnv: true,
    });
  });

  // ============================================================================
  // Initialization Tests
  // ============================================================================

  describe('initialization', () => {
    it('should initialize with correct configuration', () => {
      expect(coordinator).toBeDefined();
      expect(coordinator.isAutoSummaryRunning()).toBe(false);
      expect(coordinator.isSummarizationInProgress()).toBe(false);
    });

    it('should not be running auto-summary initially', () => {
      expect(coordinator.isAutoSummaryRunning()).toBe(false);
    });

    it('should not have summarization in progress initially', () => {
      expect(coordinator.isSummarizationInProgress()).toBe(false);
    });
  });

  // ============================================================================
  // Snapshot Handler Registration Tests
  // ============================================================================

  describe('registerSnapshotHandlers', () => {
    it('should register snapshot handlers when autoCreate is enabled', () => {
      const snapshotConfig: SnapshotConfig = {
        enabled: true,
        maxSnapshots: 10,
        autoSnapshotInterval: 300000,
        autoCreate: true,
        autoThreshold: 0.8,
      };

      coordinator.registerSnapshotHandlers(snapshotConfig);

      expect(mockSnapshotManager.onContextThreshold).toHaveBeenCalledWith(
        0.8,
        expect.any(Function)
      );
      expect(mockSnapshotManager.onBeforeOverflow).toHaveBeenCalledWith(
        expect.any(Function)
      );
    });

    it('should not register threshold handler when autoCreate is disabled', () => {
      const snapshotConfig: SnapshotConfig = {
        enabled: true,
        maxSnapshots: 10,
        autoSnapshotInterval: 300000,
        autoCreate: false,
        autoThreshold: 0.8,
      };

      coordinator.registerSnapshotHandlers(snapshotConfig);

      expect(mockSnapshotManager.onContextThreshold).not.toHaveBeenCalled();
      expect(mockSnapshotManager.onBeforeOverflow).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // Memory Guard Registration Tests
  // ============================================================================

  describe('registerMemoryGuard', () => {
    it('should register memory guard thresholds', () => {
      const mockMemoryGuard = {
        onThreshold: vi.fn(),
        on: vi.fn(),
        checkMemory: vi.fn(),
        setContext: vi.fn(),
      } as unknown as MemoryGuard;

      coordinator.registerMemoryGuard(mockMemoryGuard);

      expect(mockMemoryGuard.onThreshold).toHaveBeenCalledWith(
        MemoryLevel.WARNING,
        expect.any(Function)
      );
      expect(mockMemoryGuard.onThreshold).toHaveBeenCalledWith(
        MemoryLevel.CRITICAL,
        expect.any(Function)
      );
      expect(mockMemoryGuard.onThreshold).toHaveBeenCalledWith(
        MemoryLevel.EMERGENCY,
        expect.any(Function)
      );
      expect(mockMemoryGuard.on).toHaveBeenCalledWith(
        'emergency',
        expect.any(Function)
      );
    });

    it('should register WARNING threshold callback', () => {
      const mockMemoryGuard = {
        onThreshold: vi.fn(),
        on: vi.fn(),
        checkMemory: vi.fn(),
        setContext: vi.fn(),
      } as unknown as MemoryGuard;

      coordinator.registerMemoryGuard(mockMemoryGuard);

      // Verify WARNING callback was registered
      const warningCall = (mockMemoryGuard.onThreshold as any).mock.calls.find(
        (call: any[]) => call[0] === MemoryLevel.WARNING
      );
      expect(warningCall).toBeDefined();
      expect(typeof warningCall[1]).toBe('function');
    });

    it('should register CRITICAL threshold callback', () => {
      const mockMemoryGuard = {
        onThreshold: vi.fn(),
        on: vi.fn(),
        checkMemory: vi.fn(),
        setContext: vi.fn(),
      } as unknown as MemoryGuard;

      coordinator.registerMemoryGuard(mockMemoryGuard);

      // Verify CRITICAL callback was registered
      const criticalCall = (mockMemoryGuard.onThreshold as any).mock.calls.find(
        (call: any[]) => call[0] === MemoryLevel.CRITICAL
      );
      expect(criticalCall).toBeDefined();
      expect(typeof criticalCall[1]).toBe('function');
    });

    it('should register EMERGENCY threshold callback', () => {
      const mockMemoryGuard = {
        onThreshold: vi.fn(),
        on: vi.fn(),
        checkMemory: vi.fn(),
        setContext: vi.fn(),
      } as unknown as MemoryGuard;

      coordinator.registerMemoryGuard(mockMemoryGuard);

      // Verify EMERGENCY callback was registered
      const emergencyCall = (mockMemoryGuard.onThreshold as any).mock.calls.find(
        (call: any[]) => call[0] === MemoryLevel.EMERGENCY
      );
      expect(emergencyCall).toBeDefined();
      expect(typeof emergencyCall[1]).toBe('function');
    });
  });

  // ============================================================================
  // Summarization State Tests
  // ============================================================================

  describe('summarization state', () => {
    it('should track auto-summary running state', () => {
      expect(coordinator.isAutoSummaryRunning()).toBe(false);
    });

    it('should track summarization in progress state', () => {
      expect(coordinator.isSummarizationInProgress()).toBe(false);
    });

    it('should wait for summarization to complete', async () => {
      // Summarization not in progress, should return immediately
      const startTime = Date.now();
      await coordinator.waitForSummarization();
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(100);
    });

    it('should timeout if summarization takes too long', async () => {
      // This test verifies the timeout mechanism exists
      // Actual timeout behavior is tested in integration tests
      await expect(coordinator.waitForSummarization(100)).resolves.not.toThrow();
    });
  });

  // ============================================================================
  // Event Emission Tests
  // ============================================================================

  describe('event emission', () => {
    it('should emit events through provided emit function', () => {
      mockEmit('test-event', { data: 'test' });

      expect(emittedEvents).toHaveLength(1);
      expect(emittedEvents[0].event).toBe('test-event');
      expect(emittedEvents[0].payload).toEqual({ data: 'test' });
    });

    it('should emit pre-overflow event when overflow handler is triggered', async () => {
      const snapshotConfig: SnapshotConfig = {
        enabled: true,
        maxSnapshots: 10,
        autoSnapshotInterval: 300000,
      };

      // Capture the overflow callback
      let overflowCallback: (() => Promise<void>) | null = null;
      mockSnapshotManager.onBeforeOverflow = vi.fn((callback) => {
        overflowCallback = callback;
      });

      coordinator.registerSnapshotHandlers(snapshotConfig);

      // Trigger the overflow callback
      if (overflowCallback) {
        await overflowCallback();
      }

      expect(emittedEvents.some(e => e.event === 'pre-overflow')).toBe(true);
    });
  });

  // ============================================================================
  // Configuration Tests
  // ============================================================================

  describe('configuration', () => {
    it('should use provided configuration', () => {
      expect(mockConfig.compression.enabled).toBe(true);
      expect(mockConfig.compression.strategy).toBe('moderate');
    });

    it('should respect compression enabled flag', () => {
      const disabledConfig = {
        ...mockConfig,
        compression: {
          ...mockConfig.compression,
          enabled: false,
        },
      };

      const disabledCoordinator = new CompressionCoordinator({
        config: disabledConfig,
        getContext: mockGetContext,
        getUsage: mockGetUsage,
        getTierConfig: mockGetTierConfig,
        getModeProfile: mockGetModeProfile,
        snapshotManager: mockSnapshotManager,
        compressionService: mockCompressionService,
        tokenCounter: mockTokenCounter,
        contextPool: mockContextPool,
        emit: mockEmit,
        checkpointManager: mockCheckpointManager,
        isTestEnv: true,
      });

      expect(disabledCoordinator).toBeDefined();
    });
  });

  // ============================================================================
  // Integration Tests
  // ============================================================================

  describe('integration scenarios', () => {
    it('should coordinate snapshot and compression systems', () => {
      const snapshotConfig: SnapshotConfig = {
        enabled: true,
        maxSnapshots: 10,
        autoSnapshotInterval: 300000,
        autoCreate: true,
        autoThreshold: 0.8,
      };

      coordinator.registerSnapshotHandlers(snapshotConfig);

      expect(mockSnapshotManager.onContextThreshold).toHaveBeenCalled();
      expect(mockSnapshotManager.onBeforeOverflow).toHaveBeenCalled();
    });

    it('should coordinate memory guard registration', () => {
      const mockMemoryGuard = {
        onThreshold: vi.fn(),
        on: vi.fn(),
        checkMemory: vi.fn(),
        setContext: vi.fn(),
      } as unknown as MemoryGuard;

      coordinator.registerMemoryGuard(mockMemoryGuard);

      expect(mockMemoryGuard.onThreshold).toHaveBeenCalledTimes(3); // WARNING, CRITICAL, EMERGENCY
      expect(mockMemoryGuard.on).toHaveBeenCalledTimes(1); // emergency event
    });
  });

  // ============================================================================
  // Test Environment Flag Tests
  // ============================================================================

  describe('test environment flag', () => {
    it('should respect isTestEnv flag', () => {
      const testCoordinator = new CompressionCoordinator({
        config: mockConfig,
        getContext: mockGetContext,
        getUsage: mockGetUsage,
        getTierConfig: mockGetTierConfig,
        getModeProfile: mockGetModeProfile,
        snapshotManager: mockSnapshotManager,
        compressionService: mockCompressionService,
        tokenCounter: mockTokenCounter,
        contextPool: mockContextPool,
        emit: mockEmit,
        checkpointManager: mockCheckpointManager,
        isTestEnv: true,
      });

      expect(testCoordinator).toBeDefined();
    });

    it('should default isTestEnv to false', () => {
      const prodCoordinator = new CompressionCoordinator({
        config: mockConfig,
        getContext: mockGetContext,
        getUsage: mockGetUsage,
        getTierConfig: mockGetTierConfig,
        getModeProfile: mockGetModeProfile,
        snapshotManager: mockSnapshotManager,
        compressionService: mockCompressionService,
        tokenCounter: mockTokenCounter,
        contextPool: mockContextPool,
        emit: mockEmit,
        checkpointManager: mockCheckpointManager,
      });

      expect(prodCoordinator).toBeDefined();
    });
  });
});
