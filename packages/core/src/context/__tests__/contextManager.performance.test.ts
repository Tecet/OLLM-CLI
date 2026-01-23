/**
 * Context Manager Performance Tests
 * 
 * Tests performance characteristics of context management operations:
 * - Message addition
 * - Compression
 * - Snapshot creation
 * - Memory usage
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ConversationContextManager } from '../contextManager.js';
import type { Message, ModelInfo } from '../types.js';

describe('ContextManager Performance', () => {
  let manager: ConversationContextManager;
  const modelInfo: ModelInfo = {
    name: 'test-model',
    parameters: 7000000000,
    contextLength: 8192,
    quantization: 'q4_0'
  };

  beforeEach(() => {
    manager = new ConversationContextManager('test-session', modelInfo, {
      autoSize: false,
      targetSize: 8192,
      compression: {
        enabled: true,
        threshold: 0.85,
        strategy: 'hybrid',
        preserveRecent: 2048,
        summaryMaxTokens: 512
      },
      snapshots: {
        enabled: true,
        maxCount: 5,
        autoCreate: false,
        autoThreshold: 0.85
      }
    });
  });

  describe('Message Addition Performance', () => {
    it('should add 100 messages in <100ms', async () => {
      const start = performance.now();
      
      for (let i = 0; i < 100; i++) {
        const message: Message = {
          id: `msg-${i}`,
          role: i % 2 === 0 ? 'user' : 'assistant',
          content: `Test message ${i}`,
          timestamp: new Date()
        };
        
        await manager.addMessage(message);
      }
      
      const duration = performance.now() - start;
      expect(duration).toBeLessThan(100);
    });

    it('should add 1000 messages in <1000ms', async () => {
      const start = performance.now();
      
      for (let i = 0; i < 1000; i++) {
        const message: Message = {
          id: `msg-${i}`,
          role: i % 2 === 0 ? 'user' : 'assistant',
          content: `Test message ${i}`,
          timestamp: new Date()
        };
        
        await manager.addMessage(message);
      }
      
      const duration = performance.now() - start;
      expect(duration).toBeLessThan(1000);
    });
  });

  describe('Token Counting Performance', () => {
    it('should count tokens for 100 messages in <10ms', async () => {
      // Add messages first
      for (let i = 0; i < 100; i++) {
        const message: Message = {
          id: `msg-${i}`,
          role: i % 2 === 0 ? 'user' : 'assistant',
          content: `Test message ${i} with some content`,
          timestamp: new Date()
        };
        await manager.addMessage(message);
      }
      
      // Measure token counting
      const start = performance.now();
      const usage = manager.getUsage();
      const duration = performance.now() - start;
      
      expect(duration).toBeLessThan(10);
      expect(usage.currentTokens).toBeGreaterThan(0);
    });
  });

  describe('Memory Usage', () => {
    it('should use <5MB for 100 messages', async () => {
      const initialMemory = process.memoryUsage().heapUsed;
      
      for (let i = 0; i < 100; i++) {
        const message: Message = {
          id: `msg-${i}`,
          role: i % 2 === 0 ? 'user' : 'assistant',
          content: `Test message ${i} with some content that is reasonably long`,
          timestamp: new Date()
        };
        await manager.addMessage(message);
      }
      
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryUsed = (finalMemory - initialMemory) / 1024 / 1024; // MB
      
      expect(memoryUsed).toBeLessThan(5);
    });

    it('should use <20MB for 1000 messages', async () => {
      const initialMemory = process.memoryUsage().heapUsed;
      
      for (let i = 0; i < 1000; i++) {
        const message: Message = {
          id: `msg-${i}`,
          role: i % 2 === 0 ? 'user' : 'assistant',
          content: `Test message ${i} with some content that is reasonably long`,
          timestamp: new Date()
        };
        await manager.addMessage(message);
      }
      
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryUsed = (finalMemory - initialMemory) / 1024 / 1024; // MB
      
      expect(memoryUsed).toBeLessThan(20);
    });
  });

  describe('Snapshot Performance', () => {
    it('should create snapshot in <50ms', async () => {
      // Add some messages
      for (let i = 0; i < 50; i++) {
        const message: Message = {
          id: `msg-${i}`,
          role: i % 2 === 0 ? 'user' : 'assistant',
          content: `Test message ${i}`,
          timestamp: new Date()
        };
        await manager.addMessage(message);
      }
      
      const start = performance.now();
      await manager.createSnapshot();
      const duration = performance.now() - start;
      
      expect(duration).toBeLessThan(50);
    });

    it('should restore snapshot in <50ms', async () => {
      // Add messages and create snapshot
      for (let i = 0; i < 50; i++) {
        const message: Message = {
          id: `msg-${i}`,
          role: i % 2 === 0 ? 'user' : 'assistant',
          content: `Test message ${i}`,
          timestamp: new Date()
        };
        await manager.addMessage(message);
      }
      
      const snapshot = await manager.createSnapshot();
      
      const start = performance.now();
      await manager.restoreSnapshot(snapshot.id);
      const duration = performance.now() - start;
      
      expect(duration).toBeLessThan(50);
    });
  });

  describe('Checkpoint Performance', () => {
    it('should enforce checkpoint limit', async () => {
      // Add many messages to trigger multiple compressions
      for (let i = 0; i < 200; i++) {
        const message: Message = {
          id: `msg-${i}`,
          role: i % 2 === 0 ? 'user' : 'assistant',
          content: `Test message ${i} with content`,
          timestamp: new Date()
        };
        await manager.addMessage(message);
      }
      
      // Manually trigger compression multiple times
      for (let i = 0; i < 15; i++) {
        await manager.compress();
      }
      
      const checkpoints = manager.getCheckpoints();
      expect(checkpoints.length).toBeLessThanOrEqual(10);
    });

    it('should compress old checkpoints hierarchically', async () => {
      // Add messages and trigger compressions
      for (let i = 0; i < 100; i++) {
        const message: Message = {
          id: `msg-${i}`,
          role: i % 2 === 0 ? 'user' : 'assistant',
          content: `Test message ${i} with content`,
          timestamp: new Date()
        };
        await manager.addMessage(message);
      }
      
      // Trigger multiple compressions (need at least 6 to trigger compact level)
      for (let i = 0; i < 12; i++) {
        await manager.compress();
        
        // Add a few more messages between compressions
        for (let j = 0; j < 5; j++) {
          const message: Message = {
            id: `msg-extra-${i}-${j}`,
            role: j % 2 === 0 ? 'user' : 'assistant',
            content: `Extra message ${i}-${j}`,
            timestamp: new Date()
          };
          await manager.addMessage(message);
        }
      }
      
      const stats = manager.getCheckpointStats();
      
      // Should have some compact or moderate checkpoints (old ones compressed)
      // After 12 compressions, checkpoints should be hierarchically compressed
      expect(stats.byLevel.compact + stats.byLevel.moderate).toBeGreaterThan(0);
    });
  });

  describe('Usage Tracking', () => {
    it('should track usage accurately', async () => {
      for (let i = 0; i < 50; i++) {
        const message: Message = {
          id: `msg-${i}`,
          role: i % 2 === 0 ? 'user' : 'assistant',
          content: `Test message ${i}`,
          timestamp: new Date()
        };
        await manager.addMessage(message);
      }
      
      const usage = manager.getUsage();
      
      expect(usage.currentTokens).toBeGreaterThan(0);
      expect(usage.maxTokens).toBe(8192);
      expect(usage.percentage).toBeGreaterThan(0);
      expect(usage.percentage).toBeLessThan(100);
    });
  });
});
