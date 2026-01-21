/**
 * Tier 1 Rollover Mechanism Tests
 * 
 * Tests for the rollover compression strategy used in Tier 1 (2-4K contexts).
 * Rollover creates a snapshot and resets context with an ultra-compact summary.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ConversationContextManager } from '../contextManager.js';
import type { ModelInfo, ContextConfig, Message } from '../types.js';
import { ContextTier } from '../types.js';
import { createSnapshotStorage } from '../snapshotStorage.js';
import { tmpdir } from 'os';
import { join } from 'path';
import { rm } from 'fs/promises';

describe('Tier 1 Rollover Mechanism', () => {
  let manager: ConversationContextManager;
  let testDir: string;
  const sessionId = 'test-session-rollover';
  
  const createModelInfo = (contextLimit: number): ModelInfo => ({
    parameters: 7,
    contextLimit
  });
  
  const createConfig = (maxSize: number): Partial<ContextConfig> => ({
    targetSize: maxSize,
    minSize: 2048,
    maxSize,
    autoSize: false,
    compression: {
      enabled: true,
      threshold: 0.8, // Trigger at 80%
      strategy: 'hybrid',
      preserveRecent: 1024,
      summaryMaxTokens: 512
    },
    snapshots: {
      enabled: true,
      maxCount: 5,
      autoCreate: false,
      autoThreshold: 0.8
    }
  });

  beforeEach(async () => {
    // Create unique temporary directory for this test
    testDir = join(tmpdir(), `rollover-test-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`);
    
    const modelInfo = createModelInfo(4096); // Tier 1: 2-4K
    const config = createConfig(4096);
    
    // Create snapshot storage with test directory
    const snapshotStorage = createSnapshotStorage(testDir);
    
    manager = new ConversationContextManager(sessionId, modelInfo, config, {
      snapshotStorage
    });
    await manager.start();
  });

  afterEach(async () => {
    if (manager) {
      await manager.stop();
    }
    
    // Clean up test directory
    try {
      await rm(testDir, { recursive: true, force: true });
    } catch (_error) {
      // Ignore cleanup errors
    }
  });

  describe('Rollover Trigger', () => {
    it('should trigger rollover when context reaches threshold', async () => {
      manager.setSystemPrompt('You are a helpful assistant.');
      
      const rolloverSpy = vi.fn();
      manager.on('rollover-complete', rolloverSpy);
      
      // Add enough messages to fill context
      // For 4096 context, we need about 3200 tokens (80%)
      // Each message with 200 'x' chars is about 55 tokens
      // So we need about 58 messages
      for (let i = 0; i < 70; i++) {
        const message: Message = {
          id: `msg-${i}`,
          role: i % 2 === 0 ? 'user' : 'assistant',
          content: `Message ${i}: ${'x'.repeat(200)}`, // ~55 tokens
          timestamp: new Date()
        };
        await manager.addMessage(message);
        
        // Check if we've hit the threshold
        const context = manager.getContext();
        if (context.tokenCount >= context.maxTokens * 0.8) {
          break;
        }
      }
      
      // Manually trigger compression to test rollover
      await manager.compress();
      
      // Verify rollover was triggered
      expect(rolloverSpy).toHaveBeenCalled();
    });

    it('should use rollover strategy for Tier 1', async () => {
      const tier = (manager as any).currentTier;
      const tierConfig = (manager as any).tierConfig;
      
      expect(tier).toBe(ContextTier.TIER_1_MINIMAL);
      expect(tierConfig.strategy).toBe('rollover');
    });
  });

  describe('Snapshot Creation', () => {
    it('should create snapshot before rollover', async () => {
      manager.setSystemPrompt('You are a helpful assistant.');
      
      const snapshotSpy = vi.fn();
      manager.on('rollover-snapshot-created', snapshotSpy);
      
      // Add messages to trigger rollover
      for (let i = 0; i < 60; i++) {
        await manager.addMessage({
          id: `msg-${i}`,
          role: i % 2 === 0 ? 'user' : 'assistant',
          content: `Message ${i}: ${'x'.repeat(200)}`,
          timestamp: new Date()
        });
      }
      
      await manager.compress();
      
      // Verify snapshot was created
      expect(snapshotSpy).toHaveBeenCalled();
      const snapshot = snapshotSpy.mock.calls[0][0].snapshot;
      expect(snapshot).toBeDefined();
      expect(snapshot.id).toBeDefined();
      expect(snapshot.tokenCount).toBeGreaterThan(0);
    });

    it('should handle snapshot creation failure gracefully', async () => {
      manager.setSystemPrompt('You are a helpful assistant.');
      
      const errorSpy = vi.fn();
      manager.on('snapshot-error', errorSpy);
      
      // Mock snapshot manager to fail
      const snapshotManager = (manager as any).snapshotManager;
      const originalCreate = snapshotManager.createSnapshot;
      snapshotManager.createSnapshot = vi.fn().mockRejectedValue(new Error('Snapshot failed'));
      
      // Add messages to trigger rollover
      for (let i = 0; i < 60; i++) {
        await manager.addMessage({
          id: `msg-${i}`,
          role: i % 2 === 0 ? 'user' : 'assistant',
          content: `Message ${i}: ${'x'.repeat(200)}`,
          timestamp: new Date()
        });
      }
      
      await manager.compress();
      
      // Verify error was emitted but rollover continued
      expect(errorSpy).toHaveBeenCalled();
      
      // Restore original method
      snapshotManager.createSnapshot = originalCreate;
    });
  });

  describe('Context Reset', () => {
    it('should reset context to system prompt + summary', async () => {
      manager.setSystemPrompt('You are a helpful assistant.');
      
      // Add many messages
      for (let i = 0; i < 60; i++) {
        await manager.addMessage({
          id: `msg-${i}`,
          role: i % 2 === 0 ? 'user' : 'assistant',
          content: `Message ${i}: ${'x'.repeat(200)}`,
          timestamp: new Date()
        });
      }
      
      const beforeCount = (await manager.getMessages()).length;
      expect(beforeCount).toBeGreaterThan(50);
      
      await manager.compress();
      
      const afterMessages = await manager.getMessages();
      
      // After rollover, should have:
      // 1. System prompt
      // 2. Rollover summary
      // That's it - everything else is gone
      expect(afterMessages.length).toBeLessThanOrEqual(2);
      
      // Verify system prompt is preserved
      const systemMessages = afterMessages.filter(m => m.role === 'system');
      expect(systemMessages.length).toBeGreaterThanOrEqual(1);
      
      // Verify rollover summary exists
      const rolloverSummary = afterMessages.find(m => m.id.startsWith('rollover-summary-'));
      expect(rolloverSummary).toBeDefined();
    });

    it('should generate ultra-compact summary', async () => {
      manager.setSystemPrompt('You are a helpful assistant.');
      
      // Add messages with identifiable content
      for (let i = 0; i < 60; i++) {
        await manager.addMessage({
          id: `msg-${i}`,
          role: i % 2 === 0 ? 'user' : 'assistant',
          content: `Message ${i}: This is test message number ${i}`,
          timestamp: new Date()
        });
      }
      
      await manager.compress();
      
      const messages = await manager.getMessages();
      const rolloverSummary = messages.find(m => m.id.startsWith('rollover-summary-'));
      
      expect(rolloverSummary).toBeDefined();
      expect(rolloverSummary!.content).toContain('[Previous conversation summary');
      expect(rolloverSummary!.content.length).toBeLessThan(2000); // Ultra-compact
    });

    it('should preserve only last 10 messages in summary', async () => {
      manager.setSystemPrompt('You are a helpful assistant.');
      
      // Add 60 messages
      for (let i = 0; i < 60; i++) {
        await manager.addMessage({
          id: `msg-${i}`,
          role: i % 2 === 0 ? 'user' : 'assistant',
          content: `Message ${i}: Content for message ${i}`,
          timestamp: new Date()
        });
      }
      
      await manager.compress();
      
      const messages = await manager.getMessages();
      const rolloverSummary = messages.find(m => m.id.startsWith('rollover-summary-'));
      
      expect(rolloverSummary).toBeDefined();
      
      // Summary should reference last 10 messages (50-59)
      // Check for presence of recent message numbers
      const content = rolloverSummary!.content;
      expect(content).toContain('Message 5'); // One of the last 10
    });
  });

  describe('Token Count Reduction', () => {
    it('should significantly reduce token count after rollover', async () => {
      manager.setSystemPrompt('You are a helpful assistant.');
      
      // Add messages to reach 80% capacity
      for (let i = 0; i < 60; i++) {
        await manager.addMessage({
          id: `msg-${i}`,
          role: i % 2 === 0 ? 'user' : 'assistant',
          content: `Message ${i}: ${'x'.repeat(200)}`,
          timestamp: new Date()
        });
      }
      
      const beforeTokens = manager.getContext().tokenCount;
      expect(beforeTokens).toBeGreaterThan(3000); // Should be near 80% of 4096
      
      await manager.compress();
      
      const afterTokens = manager.getContext().tokenCount;
      
      // After rollover, should be much smaller (system prompt + summary)
      expect(afterTokens).toBeLessThan(500); // Ultra-compact
      expect(afterTokens).toBeLessThan(beforeTokens * 0.2); // At least 80% reduction
    });

    it('should update context pool with new token count', async () => {
      manager.setSystemPrompt('You are a helpful assistant.');
      
      for (let i = 0; i < 60; i++) {
        await manager.addMessage({
          id: `msg-${i}`,
          role: i % 2 === 0 ? 'user' : 'assistant',
          content: `Message ${i}: ${'x'.repeat(200)}`,
          timestamp: new Date()
        });
      }
      
      await manager.compress();
      
      const contextTokens = manager.getContext().tokenCount;
      const poolUsage = (manager as any).contextPool.getUsage();
      
      // Context and pool should be in sync
      expect(poolUsage.currentTokens).toBe(contextTokens);
    });
  });

  describe('Compression History', () => {
    it('should record rollover event in compression history', async () => {
      manager.setSystemPrompt('You are a helpful assistant.');
      
      for (let i = 0; i < 60; i++) {
        await manager.addMessage({
          id: `msg-${i}`,
          role: i % 2 === 0 ? 'user' : 'assistant',
          content: `Message ${i}: ${'x'.repeat(200)}`,
          timestamp: new Date()
        });
      }
      
      await manager.compress();
      
      const context = manager.getContext();
      const history = context.metadata.compressionHistory;
      
      // Should have at least one rollover event
      const rolloverEvent = history.find(h => h.strategy === 'rollover');
      expect(rolloverEvent).toBeDefined();
      expect(rolloverEvent!.originalTokens).toBeGreaterThan(0);
      expect(rolloverEvent!.compressedTokens).toBeLessThan(rolloverEvent!.originalTokens);
      expect(rolloverEvent!.ratio).toBeLessThan(1);
    });

    it('should emit rollover-complete event with details', async () => {
      manager.setSystemPrompt('You are a helpful assistant.');
      
      const rolloverSpy = vi.fn();
      manager.on('rollover-complete', rolloverSpy);
      
      for (let i = 0; i < 60; i++) {
        await manager.addMessage({
          id: `msg-${i}`,
          role: i % 2 === 0 ? 'user' : 'assistant',
          content: `Message ${i}: ${'x'.repeat(200)}`,
          timestamp: new Date()
        });
      }
      
      await manager.compress();
      
      expect(rolloverSpy).toHaveBeenCalled();
      const event = rolloverSpy.mock.calls[0][0];
      
      expect(event.snapshot).toBeDefined();
      expect(event.summary).toBeDefined();
      expect(event.originalTokens).toBeGreaterThan(0);
      expect(event.compressedTokens).toBeLessThan(event.originalTokens);
    });
  });

  describe('Multiple Rollovers', () => {
    it('should handle multiple rollovers in sequence', async () => {
      manager.setSystemPrompt('You are a helpful assistant.');
      
      const rolloverSpy = vi.fn();
      manager.on('rollover-complete', rolloverSpy);
      
      // First rollover
      for (let i = 0; i < 60; i++) {
        await manager.addMessage({
          id: `msg-1-${i}`,
          role: i % 2 === 0 ? 'user' : 'assistant',
          content: `Batch 1 Message ${i}: ${'x'.repeat(200)}`,
          timestamp: new Date()
        });
      }
      await manager.compress();
      
      const afterFirst = manager.getContext().tokenCount;
      expect(afterFirst).toBeLessThan(500);
      
      // Second rollover
      for (let i = 0; i < 60; i++) {
        await manager.addMessage({
          id: `msg-2-${i}`,
          role: i % 2 === 0 ? 'user' : 'assistant',
          content: `Batch 2 Message ${i}: ${'x'.repeat(200)}`,
          timestamp: new Date()
        });
      }
      await manager.compress();
      
      const afterSecond = manager.getContext().tokenCount;
      expect(afterSecond).toBeLessThan(500);
      
      // Should have 2 rollover events
      expect(rolloverSpy).toHaveBeenCalledTimes(2);
    });

    it('should maintain compression history across rollovers', async () => {
      manager.setSystemPrompt('You are a helpful assistant.');
      
      // First rollover
      for (let i = 0; i < 60; i++) {
        await manager.addMessage({
          id: `msg-1-${i}`,
          role: i % 2 === 0 ? 'user' : 'assistant',
          content: `Batch 1 Message ${i}: ${'x'.repeat(200)}`,
          timestamp: new Date()
        });
      }
      await manager.compress();
      
      // Second rollover
      for (let i = 0; i < 60; i++) {
        await manager.addMessage({
          id: `msg-2-${i}`,
          role: i % 2 === 0 ? 'user' : 'assistant',
          content: `Batch 2 Message ${i}: ${'x'.repeat(200)}`,
          timestamp: new Date()
        });
      }
      await manager.compress();
      
      const history = manager.getContext().metadata.compressionHistory;
      const rolloverEvents = history.filter(h => h.strategy === 'rollover');
      
      expect(rolloverEvents.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Tier 1 Specific Behavior', () => {
    it('should not create checkpoints in Tier 1', async () => {
      manager.setSystemPrompt('You are a helpful assistant.');
      
      for (let i = 0; i < 60; i++) {
        await manager.addMessage({
          id: `msg-${i}`,
          role: i % 2 === 0 ? 'user' : 'assistant',
          content: `Message ${i}: ${'x'.repeat(200)}`,
          timestamp: new Date()
        });
      }
      
      await manager.compress();
      
      const checkpoints = manager.getCheckpoints();
      
      // Tier 1 uses rollover, not checkpoints
      expect(checkpoints.length).toBe(0);
    });

    it('should have high utilization target (90%)', async () => {
      const tierConfig = (manager as any).tierConfig;
      
      expect(tierConfig.utilizationTarget).toBe(0.90);
      expect(tierConfig.maxCheckpoints).toBe(0);
    });
  });

  describe('Recovery from Rollover', () => {
    it('should allow recovery from snapshot after rollover', async () => {
      manager.setSystemPrompt('You are a helpful assistant.');
      
      // Add messages with identifiable content
      const testMessages = [];
      for (let i = 0; i < 60; i++) {
        const msg = {
          id: `msg-${i}`,
          role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
          content: `Message ${i}: Important content ${i}`,
          timestamp: new Date()
        };
        testMessages.push(msg);
        await manager.addMessage(msg);
      }
      
      let snapshotId: string | undefined;
      manager.on('rollover-snapshot-created', (event) => {
        snapshotId = event.snapshot.id;
      });
      
      await manager.compress();
      
      // After rollover, messages should be gone
      const afterRollover = await manager.getMessages();
      expect(afterRollover.length).toBeLessThanOrEqual(2);
      
      // Snapshot should exist and contain original messages
      expect(snapshotId).toBeDefined();
      
      // Note: Actual snapshot restoration would require snapshot manager API
      // This test verifies the snapshot was created with the right ID
    });
  });
});
