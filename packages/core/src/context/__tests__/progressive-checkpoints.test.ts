/**
 * Progressive Checkpoint Compression Tests
 * 
 * Tests for the additive checkpoint system that prevents concept drift
 * in long, multi-step tasks.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ConversationContextManager } from '../contextManager.js';
import type { ModelInfo, Message } from '../types.js';

describe('Progressive Checkpoint Compression', () => {
  let contextManager: ConversationContextManager;
  const modelInfo: ModelInfo = {
    parameters: 8,
    contextLimit: 8192
  };

  beforeEach(() => {
    contextManager = new ConversationContextManager(
      'test-session',
      modelInfo,
      {
        targetSize: 8192,
        minSize: 2048,
        maxSize: 8192,
        autoSize: false,
        compression: {
          enabled: true,
          threshold: 0.8,
          strategy: 'summarize',
          preserveRecent: 2048,
          summaryMaxTokens: 512
        }
      }
    );
  });

  describe('Checkpoint Creation', () => {
    it('should create checkpoints additively', async () => {
      // Set system prompt
      contextManager.setSystemPrompt('You are a helpful assistant.');

      // Add messages to trigger compression
      for (let i = 0; i < 20; i++) {
        const message: Message = {
          id: `msg-${i}`,
          role: i % 2 === 0 ? 'user' : 'assistant',
          content: `Message ${i}: ${'x'.repeat(200)}`, // ~50 tokens each
          timestamp: new Date()
        };
        await contextManager.addMessage(message);
      }

      // Manually trigger compression
      await contextManager.compress();

      // Verify checkpoint was created
      const checkpoints = contextManager.getCheckpoints();
      expect(checkpoints.length).toBeGreaterThan(0);

      // Verify checkpoint properties
      const checkpoint = checkpoints[0];
      expect(checkpoint).toHaveProperty('id');
      expect(checkpoint).toHaveProperty('level');
      expect(checkpoint).toHaveProperty('range');
      expect(checkpoint).toHaveProperty('summary');
      expect(checkpoint.level).toBe(3); // Should start as DETAILED
    });

    it('should preserve checkpoint history across multiple compressions', async () => {
      contextManager.setSystemPrompt('You are a helpful assistant.');

      // First compression cycle
      for (let i = 0; i < 20; i++) {
        await contextManager.addMessage({
          id: `msg-1-${i}`,
          role: i % 2 === 0 ? 'user' : 'assistant',
          content: `Cycle 1 Message ${i}: ${'x'.repeat(200)}`,
          timestamp: new Date()
        });
      }
      await contextManager.compress();

      const checkpointsAfterFirst = contextManager.getCheckpoints();
      expect(checkpointsAfterFirst.length).toBe(1);

      // Second compression cycle
      for (let i = 0; i < 20; i++) {
        await contextManager.addMessage({
          id: `msg-2-${i}`,
          role: i % 2 === 0 ? 'user' : 'assistant',
          content: `Cycle 2 Message ${i}: ${'x'.repeat(200)}`,
          timestamp: new Date()
        });
      }
      await contextManager.compress();

      const checkpointsAfterSecond = contextManager.getCheckpoints();
      expect(checkpointsAfterSecond.length).toBe(2); // ADDITIVE!

      // Verify both checkpoints exist
      expect(checkpointsAfterSecond[0].id).toBe(checkpointsAfterFirst[0].id);
      expect(checkpointsAfterSecond[1].id).not.toBe(checkpointsAfterFirst[0].id);
    });
  });

  describe('Hierarchical Compression', () => {
    it('should compress old checkpoints to lower levels', async () => {
      contextManager.setSystemPrompt('You are a helpful assistant.');

      // Create multiple checkpoints
      for (let cycle = 0; cycle < 12; cycle++) {
        for (let i = 0; i < 10; i++) {
          await contextManager.addMessage({
            id: `msg-${cycle}-${i}`,
            role: i % 2 === 0 ? 'user' : 'assistant',
            content: `Cycle ${cycle} Message ${i}: ${'x'.repeat(200)}`,
            timestamp: new Date()
          });
        }
        await contextManager.compress();
      }

      const checkpoints = contextManager.getCheckpoints();
      
      // Verify we have checkpoints at different levels
      const levels = checkpoints.map(cp => cp.level);
      expect(levels).toContain(1); // COMPACT
      expect(levels).toContain(2); // MODERATE
      expect(levels).toContain(3); // DETAILED

      // Verify oldest checkpoints are most compressed
      const sortedByAge = [...checkpoints].sort((a, b) => 
        a.createdAt.getTime() - b.createdAt.getTime()
      );
      
      // Oldest should be COMPACT or MODERATE
      expect(sortedByAge[0].level).toBeLessThanOrEqual(2);
      
      // Newest should be DETAILED
      expect(sortedByAge[sortedByAge.length - 1].level).toBe(3);
    });

    it('should reduce token count when compressing checkpoints', async () => {
      contextManager.setSystemPrompt('You are a helpful assistant.');

      // Create a checkpoint
      for (let i = 0; i < 20; i++) {
        await contextManager.addMessage({
          id: `msg-${i}`,
          role: i % 2 === 0 ? 'user' : 'assistant',
          content: `Message ${i}: ${'x'.repeat(200)}`,
          timestamp: new Date()
        });
      }
      await contextManager.compress();

      const checkpointAfterFirst = contextManager.getCheckpoints()[0];
      const tokensAfterFirst = checkpointAfterFirst.currentTokens;

      // Create many more checkpoints to age the first one
      for (let cycle = 0; cycle < 10; cycle++) {
        for (let i = 0; i < 10; i++) {
          await contextManager.addMessage({
            id: `msg-${cycle}-${i}`,
            role: i % 2 === 0 ? 'user' : 'assistant',
            content: `Cycle ${cycle} Message ${i}: ${'x'.repeat(200)}`,
            timestamp: new Date()
          });
        }
        await contextManager.compress();
      }

      // Find the same checkpoint (by ID)
      const checkpoints = contextManager.getCheckpoints();
      const sameCheckpoint = checkpoints.find(cp => cp.id === checkpointAfterFirst.id);

      if (sameCheckpoint) {
        // Should be compressed to lower level
        expect(sameCheckpoint.level).toBeLessThan(3);
        // Should use fewer tokens
        expect(sameCheckpoint.currentTokens).toBeLessThan(tokensAfterFirst);
      }
    });
  });

  describe('Checkpoint Limits', () => {
    it('should merge oldest checkpoints when limit exceeded', async () => {
      contextManager.setSystemPrompt('You are a helpful assistant.');

      // Create more than MAX_CHECKPOINTS (10)
      for (let cycle = 0; cycle < 15; cycle++) {
        for (let i = 0; i < 10; i++) {
          await contextManager.addMessage({
            id: `msg-${cycle}-${i}`,
            role: i % 2 === 0 ? 'user' : 'assistant',
            content: `Cycle ${cycle} Message ${i}: ${'x'.repeat(200)}`,
            timestamp: new Date()
          });
        }
        await contextManager.compress();
      }

      const checkpoints = contextManager.getCheckpoints();
      
      // Should not exceed MAX_CHECKPOINTS
      expect(checkpoints.length).toBeLessThanOrEqual(10);

      // Should have at least one merged checkpoint
      const mergedCheckpoint = checkpoints.find(cp => 
        cp.id.includes('merged') || cp.range.includes('to')
      );
      expect(mergedCheckpoint).toBeDefined();
    });
  });

  describe('Checkpoint Statistics', () => {
    it('should provide accurate checkpoint statistics', async () => {
      contextManager.setSystemPrompt('You are a helpful assistant.');

      // Create several checkpoints
      for (let cycle = 0; cycle < 5; cycle++) {
        for (let i = 0; i < 10; i++) {
          await contextManager.addMessage({
            id: `msg-${cycle}-${i}`,
            role: i % 2 === 0 ? 'user' : 'assistant',
            content: `Cycle ${cycle} Message ${i}: ${'x'.repeat(200)}`,
            timestamp: new Date()
          });
        }
        await contextManager.compress();
      }

      const stats = contextManager.getCheckpointStats();

      // Verify stats structure
      expect(stats).toHaveProperty('total');
      expect(stats).toHaveProperty('byLevel');
      expect(stats).toHaveProperty('totalTokens');
      expect(stats).toHaveProperty('oldestDate');
      expect(stats).toHaveProperty('newestDate');

      // Verify stats values
      // Note: First cycle doesn't create checkpoint (not enough messages to compress)
      // So 5 cycles = 4 checkpoints (cycles 2-5 each create one)
      expect(stats.total).toBe(4);
      expect(stats.byLevel.compact + stats.byLevel.moderate + stats.byLevel.detailed).toBe(4);
      expect(stats.totalTokens).toBeGreaterThan(0);
      expect(stats.oldestDate).toBeInstanceOf(Date);
      expect(stats.newestDate).toBeInstanceOf(Date);
    });
  });

  describe('Context Reconstruction', () => {
    it('should include all checkpoints in reconstructed context', async () => {
      contextManager.setSystemPrompt('You are a helpful assistant.');

      // Create multiple checkpoints
      for (let cycle = 0; cycle < 3; cycle++) {
        for (let i = 0; i < 10; i++) {
          await contextManager.addMessage({
            id: `msg-${cycle}-${i}`,
            role: i % 2 === 0 ? 'user' : 'assistant',
            content: `Cycle ${cycle} Message ${i}: ${'x'.repeat(200)}`,
            timestamp: new Date()
          });
        }
        await contextManager.compress();
      }

      const messages = await contextManager.getMessages();
      const checkpoints = contextManager.getCheckpoints();

      // Context should include:
      // 1. System prompt
      // 2. All checkpoint summaries
      // 3. Recent messages

      // Count system messages
      const systemMessages = messages.filter(m => m.role === 'system');
      
      // Should have system prompt + checkpoint summaries
      expect(systemMessages.length).toBeGreaterThanOrEqual(checkpoints.length + 1);
    });

    it('should maintain chronological order', async () => {
      contextManager.setSystemPrompt('You are a helpful assistant.');

      // Create checkpoints with identifiable content
      for (let cycle = 0; cycle < 3; cycle++) {
        for (let i = 0; i < 10; i++) {
          await contextManager.addMessage({
            id: `msg-${cycle}-${i}`,
            role: i % 2 === 0 ? 'user' : 'assistant',
            content: `Cycle ${cycle} Message ${i}`,
            timestamp: new Date()
          });
        }
        await contextManager.compress();
      }

      const _messages = await contextManager.getMessages();
      const checkpoints = contextManager.getCheckpoints();

      // Verify checkpoints are in chronological order
      for (let i = 1; i < checkpoints.length; i++) {
        expect(checkpoints[i].createdAt.getTime()).toBeGreaterThanOrEqual(
          checkpoints[i - 1].createdAt.getTime()
        );
      }
    });
  });

  describe('Token Budget Management', () => {
    it('should keep total token count within limits', async () => {
      contextManager.setSystemPrompt('You are a helpful assistant.');

      const maxTokens = contextManager.getContext().maxTokens;

      // Create many checkpoints
      for (let cycle = 0; cycle < 20; cycle++) {
        for (let i = 0; i < 10; i++) {
          await contextManager.addMessage({
            id: `msg-${cycle}-${i}`,
            role: i % 2 === 0 ? 'user' : 'assistant',
            content: `Cycle ${cycle} Message ${i}: ${'x'.repeat(200)}`,
            timestamp: new Date()
          });
        }
        
        // Check token count before compression
        const beforeTokens = contextManager.getContext().tokenCount;
        
        if (beforeTokens > maxTokens * 0.8) {
          await contextManager.compress();
        }
      }

      const finalContext = contextManager.getContext();
      
      // Should never exceed max tokens
      expect(finalContext.tokenCount).toBeLessThanOrEqual(maxTokens);
      
      // Should stay at or below compression threshold after compressions
      // Note: Compression triggers at 80%, so we expect to stay around that level
      expect(finalContext.tokenCount).toBeLessThanOrEqual(maxTokens * 0.8);
    });
  });
});
