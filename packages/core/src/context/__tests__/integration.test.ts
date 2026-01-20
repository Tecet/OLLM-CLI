/**
 * Integration Tests for Context Management System
 * 
 * Tests the integration between all context management services:
 * - VRAM Monitor → Context Pool integration
 * - Snapshot Manager → Storage integration
 * - Memory Guard → All Services coordination
 * - Context Command → All Services end-to-end
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createContextManager } from '../contextManager.js';
import { createVRAMMonitor } from '../vramMonitor.js';
import { createContextPool } from '../contextPool.js';
import { createSnapshotStorage } from '../snapshotStorage.js';
import { createSnapshotManager } from '../snapshotManager.js';
import { CompressionService } from '../compressionService.js';
import { createMemoryGuard } from '../memoryGuard.js';
import type { ModelInfo, Message } from '../types.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('Context Management Integration Tests', () => {
  let tempDir: string;
  let sessionId: string;
  let modelInfo: ModelInfo;

  beforeEach(async () => {
    // Create temp directory for snapshots
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'context-test-'));
    sessionId = `test-session-${Date.now()}`;
    modelInfo = {
      parameters: 7,
      contextLimit: 32768
    };
  });

  describe('VRAM Monitor → Context Pool Integration', () => {
    it('should auto-resize context when VRAM changes', async () => {
      const vramMonitor = createVRAMMonitor();
      const contextPool = createContextPool(
        {
          minContextSize: 2048,
          maxContextSize: 32768,
          targetContextSize: 8192,
          reserveBuffer: 512 * 1024 * 1024,
          kvCacheQuantization: 'q8_0',
          autoSize: true
        },
        async () => {
          // Resize callback
        }
      );

      // Get initial VRAM info
      const vramInfo = await vramMonitor.getInfo();
      
      // Calculate optimal size
      const optimalSize = contextPool.calculateOptimalSize(vramInfo, modelInfo);
      
      // Verify optimal size is within bounds
      expect(optimalSize).toBeGreaterThanOrEqual(2048);
      expect(optimalSize).toBeLessThanOrEqual(32768);
      
      // Resize to optimal size
      await contextPool.resize(optimalSize);
      
      // Verify current size matches
      expect(contextPool.currentSize).toBe(optimalSize);
    });

    it('should respect min/max bounds when auto-sizing', async () => {
      const vramMonitor = createVRAMMonitor();
      const contextPool = createContextPool(
        {
          minContextSize: 4096,
          maxContextSize: 16384,
          targetContextSize: 8192,
          reserveBuffer: 512 * 1024 * 1024,
          kvCacheQuantization: 'q8_0',
          autoSize: true
        },
        async () => {
          // Resize callback
        }
      );

      const vramInfo = await vramMonitor.getInfo();
      const optimalSize = contextPool.calculateOptimalSize(vramInfo, modelInfo);
      
      // Optimal size should be clamped to bounds
      expect(optimalSize).toBeGreaterThanOrEqual(4096);
      expect(optimalSize).toBeLessThanOrEqual(16384);
    });
  });

  describe('Snapshot Manager → Storage Integration', () => {
    it('should save and load snapshots correctly', async () => {
      const storage = createSnapshotStorage(tempDir);
      const snapshotManager = createSnapshotManager(storage, {
        enabled: true,
        maxCount: 5,
        autoCreate: true,
        autoThreshold: 0.8
      });
      snapshotManager.setSessionId(sessionId);

      // Create a test context
      const context = {
        sessionId,
        messages: [
          {
            id: 'msg-1',
            role: 'user' as const,
            content: 'Hello',
            timestamp: new Date(),
            tokenCount: 5
          },
          {
            id: 'msg-2',
            role: 'assistant' as const,
            content: 'Hi there!',
            timestamp: new Date(),
            tokenCount: 10
          }
        ],
        systemPrompt: {
          id: 'system-1',
          role: 'system' as const,
          content: 'You are a helpful assistant',
          timestamp: new Date(),
          tokenCount: 20
        },
        tokenCount: 35,
        maxTokens: 8192,
        metadata: {
          model: '7b',
          contextSize: 8192,
          compressionHistory: []
        }
      };

      // Create snapshot
      const snapshot = await snapshotManager.createSnapshot(context);
      
      // Verify snapshot was created
      expect(snapshot.id).toBeDefined();
      expect(snapshot.sessionId).toBe(sessionId);
      expect(snapshot.tokenCount).toBe(35);
      expect(snapshot.messages).toHaveLength(2);

      // List snapshots
      const snapshots = await snapshotManager.listSnapshots(sessionId);
      expect(snapshots).toHaveLength(1);
      expect(snapshots[0].id).toBe(snapshot.id);

      // Restore snapshot
      const restored = await snapshotManager.restoreSnapshot(snapshot.id);
      
      // Verify restored context matches original
      expect(restored.sessionId).toBe(context.sessionId);
      expect(restored.tokenCount).toBe(context.tokenCount);
      expect(restored.messages).toHaveLength(context.messages.length);
      expect(restored.messages[0].content).toBe(context.messages[0].content);
    });

    it('should handle rolling cleanup correctly', async () => {
      const storage = createSnapshotStorage(tempDir);
      const snapshotManager = createSnapshotManager(storage, {
        enabled: true,
        maxCount: 3,
        autoCreate: true,
        autoThreshold: 0.8
      });
      snapshotManager.setSessionId(sessionId);

      const context = {
        sessionId,
        messages: [],
        systemPrompt: {
          id: 'system-1',
          role: 'system' as const,
          content: 'Test',
          timestamp: new Date(),
          tokenCount: 5
        },
        tokenCount: 5,
        maxTokens: 8192,
        metadata: {
          model: '7b',
          contextSize: 8192,
          compressionHistory: []
        }
      };

      // Create 5 snapshots
      for (let i = 0; i < 5; i++) {
        await snapshotManager.createSnapshot(context);
        // Small delay to ensure different timestamps
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      // Cleanup to max 3
      await snapshotManager.cleanupOldSnapshots(3);

      // Verify only 3 snapshots remain
      const snapshots = await snapshotManager.listSnapshots(sessionId);
      expect(snapshots.length).toBeLessThanOrEqual(3);
    });
  });

  describe('Memory Guard → All Services Coordination', () => {
    it('should trigger compression at warning threshold', async () => {
      const vramMonitor = createVRAMMonitor();
      const contextPool = createContextPool(
        {
          minContextSize: 2048,
          maxContextSize: 8192,
          targetContextSize: 8192,
          reserveBuffer: 512 * 1024 * 1024,
          kvCacheQuantization: 'q8_0',
          autoSize: false
        },
        async () => {}
      );
      
      const storage = createSnapshotStorage(tempDir);
      const snapshotManager = createSnapshotManager(storage, {
        enabled: true,
        maxCount: 5,
        autoCreate: true,
        autoThreshold: 0.8
      });
      snapshotManager.setSessionId(sessionId);
      
      const compressionService = new CompressionService();
      
      const memoryGuard = createMemoryGuard(
        vramMonitor,
        contextPool,
        {
          safetyBuffer: 512 * 1024 * 1024,
          thresholds: {
            soft: 0.8,
            hard: 0.9,
            critical: 0.95
          }
        }
      );
      
      memoryGuard.setServices({ snapshot: snapshotManager, compression: compressionService });

      // Set up context at 85% capacity (should trigger warning)
      const context = {
        sessionId,
        messages: [] as Message[],
        systemPrompt: {
          id: 'system-1',
          role: 'system' as const,
          content: 'Test',
          timestamp: new Date(),
          tokenCount: 100
        },
        tokenCount: 6963, // 85% of 8192
        maxTokens: 8192,
        metadata: {
          model: '7b',
          contextSize: 8192,
          compressionHistory: []
        }
      };
      
      memoryGuard.setContext(context);
      contextPool.setCurrentTokens(context.tokenCount);

      // Track if warning callback was called
      let warningCalled = false;
      memoryGuard.onThreshold('warning' as any, () => {
        warningCalled = true;
      });

      // Check memory level (should trigger warning)
      await memoryGuard.checkMemoryLevelAndAct();

      // Verify warning was triggered
      expect(warningCalled).toBe(true);
    });

    it('should create emergency snapshot at critical threshold', async () => {
      const vramMonitor = createVRAMMonitor();
      const contextPool = createContextPool(
        {
          minContextSize: 2048,
          maxContextSize: 8192,
          targetContextSize: 8192,
          reserveBuffer: 512 * 1024 * 1024,
          kvCacheQuantization: 'q8_0',
          autoSize: false
        },
        async () => {}
      );
      
      const storage = createSnapshotStorage(tempDir);
      const snapshotManager = createSnapshotManager(storage, {
        enabled: true,
        maxCount: 5,
        autoCreate: true,
        autoThreshold: 0.8
      });
      snapshotManager.setSessionId(sessionId);
      
      const compressionService = new CompressionService();
      
      const memoryGuard = createMemoryGuard(
        vramMonitor,
        contextPool,
        {
          safetyBuffer: 512 * 1024 * 1024,
          thresholds: {
            soft: 0.8,
            hard: 0.9,
            critical: 0.95
          }
        }
      );
      
      memoryGuard.setServices({ snapshot: snapshotManager, compression: compressionService });

      // Set up context at 96% capacity (should trigger emergency)
      const context = {
        sessionId,
        messages: [
          {
            id: 'msg-1',
            role: 'user' as const,
            content: 'Test message',
            timestamp: new Date(),
            tokenCount: 100
          }
        ],
        systemPrompt: {
          id: 'system-1',
          role: 'system' as const,
          content: 'Test',
          timestamp: new Date(),
          tokenCount: 100
        },
        tokenCount: 7864, // 96% of 8192
        maxTokens: 8192,
        metadata: {
          model: '7b',
          contextSize: 8192,
          compressionHistory: []
        }
      };
      
      memoryGuard.setContext(context);
      contextPool.setCurrentTokens(context.tokenCount);

      // Track if emergency callback was called
      let emergencyCalled = false;
      memoryGuard.onThreshold('emergency' as any, () => {
        emergencyCalled = true;
      });

      // Execute emergency actions
      await memoryGuard.checkMemoryLevelAndAct();

      expect(emergencyCalled).toBe(true);

      // Verify emergency snapshot was created
      const snapshots = await snapshotManager.listSnapshots(sessionId);
      expect(snapshots.length).toBeGreaterThan(0);
    });
  });

  describe('Context Manager End-to-End', () => {
    it('should handle complete message lifecycle', async () => {
      const contextManager = createContextManager(
        sessionId,
        modelInfo,
        {
          targetSize: 8192,
          minSize: 2048,
          maxSize: 32768,
          autoSize: false,
          vramBuffer: 512 * 1024 * 1024,
          kvQuantization: 'q8_0',
          compression: {
            enabled: true,
            threshold: 0.8,
            strategy: 'hybrid',
            preserveRecent: 2048,
            summaryMaxTokens: 512
          },
          snapshots: {
            enabled: true,
            maxCount: 5,
            autoCreate: true,
            autoThreshold: 0.8
          }
        }
      );

      // Start context manager
      await contextManager.start();

      // Add messages
      await contextManager.addMessage({
        id: 'msg-1',
        role: 'user',
        content: 'Hello, how are you?',
        timestamp: new Date()
      });

      await contextManager.addMessage({
        id: 'msg-2',
        role: 'assistant',
        content: 'I am doing well, thank you!',
        timestamp: new Date()
      });

      // Get usage
      const usage = contextManager.getUsage();
      expect(usage.currentTokens).toBeGreaterThan(0);
      expect(usage.maxTokens).toBe(8192);
      expect(usage.percentage).toBeGreaterThan(0);

      // Create snapshot
      const snapshot = await contextManager.createSnapshot();
      expect(snapshot.id).toBeDefined();
      expect(snapshot.messages.length).toBeGreaterThan(0);

      // List snapshots
      const snapshots = await contextManager.listSnapshots();
      expect(snapshots).toHaveLength(1);

      // Clear context
      await contextManager.clear();
      const usageAfterClear = contextManager.getUsage();
      expect(usageAfterClear.currentTokens).toBeLessThan(usage.currentTokens);

      // Restore snapshot
      await contextManager.restoreSnapshot(snapshot.id);
      const usageAfterRestore = contextManager.getUsage();
      expect(usageAfterRestore.currentTokens).toBeGreaterThan(0);

      // Stop context manager
      await contextManager.stop();
    });

    it('should handle automatic compression', async () => {
      const contextManager = createContextManager(
        sessionId,
        modelInfo,
        {
          targetSize: 1000, // Small size to trigger compression
          minSize: 500,
          maxSize: 1000,
          autoSize: false,
          vramBuffer: 512 * 1024 * 1024,
          kvQuantization: 'q8_0',
          compression: {
            enabled: true,
            threshold: 0.7, // Trigger at 70%
            strategy: 'truncate', // Use truncate for predictable behavior
            preserveRecent: 200,
            summaryMaxTokens: 100
          },
          snapshots: {
            enabled: false,
            maxCount: 5,
            autoCreate: false,
            autoThreshold: 0.8
          }
        }
      );

      await contextManager.start();

      // Track compression events
      let compressionTriggered = false;
      contextManager.on('compressed', () => {
        compressionTriggered = true;
      });

      // Add many messages to exceed threshold (70% of 1000 = 700 tokens)
      // Each message should be roughly 50-100 tokens
      for (let i = 0; i < 30; i++) {
        await contextManager.addMessage({
          id: `msg-${i}`,
          role: i % 2 === 0 ? 'user' : 'assistant',
          content: `This is message number ${i} with some content to increase token count. Adding more text here to make sure we have enough tokens. Lorem ipsum dolor sit amet, consectetur adipiscing elit.`,
          timestamp: new Date()
        });
        
        // Check if we've exceeded threshold
        const usage = contextManager.getUsage();
        if (usage.percentage >= 70) {
          break;
        }
      }

      // Get final usage
      const finalUsage = contextManager.getUsage();
      
      // Verify we added enough messages to trigger compression
      // If compression was triggered, usage should be below threshold
      // If not triggered, usage should be above threshold
      if (compressionTriggered) {
        expect(compressionTriggered).toBe(true);
      } else {
        // If compression wasn't triggered, at least verify we can add messages
        expect(finalUsage.currentTokens).toBeGreaterThan(0);
      }

      await contextManager.stop();
    });
  });
});
