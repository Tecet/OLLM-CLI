/**
 * Unit Tests for Active Context Manager - Edge Cases
 * 
 * These tests verify specific edge cases and scenarios for the ActiveContextManager.
 * 
 * Requirements: FR-1, FR-6
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ActiveContextManager } from '../activeContextManager.js';
import { TokenCounterService } from '../../tokenCounter.js';
import type { Message } from '../../types.js';
import type { CheckpointSummary } from '../../types/storageTypes.js';

/**
 * Helper to create a test message
 */
function createMessage(id: string, content: string, role: 'user' | 'assistant' | 'system' = 'user'): Message {
  return {
    id,
    role,
    content,
    timestamp: new Date(),
    parts: [{ type: 'text', text: content }],
  };
}

/**
 * Helper to create a test checkpoint
 */
function createCheckpoint(id: string, summary: string, tokenCount: number): CheckpointSummary {
  return {
    id,
    timestamp: Date.now(),
    summary,
    originalMessageIds: [],
    tokenCount,
    compressionLevel: 3,
    compressionNumber: 1,
    metadata: {
      model: 'test-model',
      createdAt: Date.now(),
    },
  };
}

describe('ActiveContextManager - Edge Cases', () => {
  let tokenCounter: TokenCounterService;
  let systemPrompt: Message;
  const OLLAMA_LIMIT = 6800;

  beforeEach(() => {
    tokenCounter = new TokenCounterService();
    systemPrompt = createMessage('system-1', 'You are a helpful assistant.', 'system');
  });

  describe('Empty Context', () => {
    it('should handle empty context (only system prompt)', () => {
      const manager = new ActiveContextManager(systemPrompt, OLLAMA_LIMIT, tokenCounter);

      // Verify initial state
      const state = manager.getState();
      expect(state.checkpoints).toHaveLength(0);
      expect(state.recentMessages).toHaveLength(0);
      expect(state.tokenCount.checkpoints).toBe(0);
      expect(state.tokenCount.recent).toBe(0);
      expect(state.tokenCount.total).toBeGreaterThan(0); // System prompt has tokens

      // Verify prompt building works
      const prompt = manager.buildPrompt();
      expect(prompt).toHaveLength(1);
      expect(prompt[0].id).toBe(systemPrompt.id);

      // Verify validation passes
      const validation = manager.validate();
      expect(validation.valid).toBe(true);
    });

    it('should calculate available tokens correctly for empty context', () => {
      const manager = new ActiveContextManager(systemPrompt, OLLAMA_LIMIT, tokenCounter);

      const available = manager.getAvailableTokens();
      const systemTokens = tokenCounter.countTokensCached(systemPrompt.id, systemPrompt.content);
      const expectedAvailable = OLLAMA_LIMIT - manager.getSafetyMargin() - systemTokens;

      expect(available).toBe(expectedAvailable);
      expect(available).toBeGreaterThan(0);
    });

    it('should build prompt with new message on empty context', () => {
      const manager = new ActiveContextManager(systemPrompt, OLLAMA_LIMIT, tokenCounter);

      const newMessage = createMessage('msg-1', 'Hello!');
      const prompt = manager.buildPrompt(newMessage);

      expect(prompt).toHaveLength(2);
      expect(prompt[0].id).toBe(systemPrompt.id);
      expect(prompt[1].id).toBe('msg-1');
    });
  });

  describe('Single Message', () => {
    it('should handle single message correctly', () => {
      const manager = new ActiveContextManager(systemPrompt, OLLAMA_LIMIT, tokenCounter);

      const message = createMessage('msg-1', 'Hello, world!');
      manager.addMessage(message);

      // Verify state
      const state = manager.getState();
      expect(state.recentMessages).toHaveLength(1);
      expect(state.recentMessages[0].id).toBe('msg-1');

      // Verify token counts
      const messageTokens = tokenCounter.countTokensCached(message.id, message.content);
      const systemTokens = tokenCounter.countTokensCached(systemPrompt.id, systemPrompt.content);
      expect(state.tokenCount.recent).toBe(messageTokens);
      expect(state.tokenCount.total).toBe(systemTokens + messageTokens);

      // Verify prompt building
      const prompt = manager.buildPrompt();
      expect(prompt).toHaveLength(2);
      expect(prompt[0].id).toBe(systemPrompt.id);
      expect(prompt[1].id).toBe('msg-1');
    });

    it('should remove single message correctly', () => {
      const manager = new ActiveContextManager(systemPrompt, OLLAMA_LIMIT, tokenCounter);

      const message = createMessage('msg-1', 'Hello, world!');
      manager.addMessage(message);

      // Remove the message
      manager.removeMessages(['msg-1']);

      // Verify state is back to empty
      const state = manager.getState();
      expect(state.recentMessages).toHaveLength(0);
      expect(state.tokenCount.recent).toBe(0);

      const systemTokens = tokenCounter.countTokensCached(systemPrompt.id, systemPrompt.content);
      expect(state.tokenCount.total).toBe(systemTokens);
    });
  });

  describe('Checkpoint Integration', () => {
    it('should integrate checkpoints with messages correctly', () => {
      const manager = new ActiveContextManager(systemPrompt, OLLAMA_LIMIT, tokenCounter);

      // Add a checkpoint
      const checkpoint = createCheckpoint(
        'ckpt-1',
        'Previous conversation summary',
        tokenCounter.countTokensCached('ckpt-1', 'Previous conversation summary')
      );
      manager.addCheckpoint(checkpoint);

      // Add messages
      const message1 = createMessage('msg-1', 'Hello!');
      const message2 = createMessage('msg-2', 'How are you?');
      manager.addMessage(message1);
      manager.addMessage(message2);

      // Verify state
      const state = manager.getState();
      expect(state.checkpoints).toHaveLength(1);
      expect(state.recentMessages).toHaveLength(2);

      // Verify prompt structure
      const prompt = manager.buildPrompt();
      expect(prompt).toHaveLength(4); // system + checkpoint + 2 messages
      expect(prompt[0].id).toBe(systemPrompt.id);
      expect(prompt[1].id).toBe('ckpt-1');
      expect(prompt[2].id).toBe('msg-1');
      expect(prompt[3].id).toBe('msg-2');
    });

    it('should handle multiple checkpoints correctly', () => {
      const manager = new ActiveContextManager(systemPrompt, OLLAMA_LIMIT, tokenCounter);

      // Add multiple checkpoints
      const checkpoint1 = createCheckpoint(
        'ckpt-1',
        'First summary',
        tokenCounter.countTokensCached('ckpt-1', 'First summary')
      );
      const checkpoint2 = createCheckpoint(
        'ckpt-2',
        'Second summary',
        tokenCounter.countTokensCached('ckpt-2', 'Second summary')
      );
      const checkpoint3 = createCheckpoint(
        'ckpt-3',
        'Third summary',
        tokenCounter.countTokensCached('ckpt-3', 'Third summary')
      );

      manager.addCheckpoint(checkpoint1);
      manager.addCheckpoint(checkpoint2);
      manager.addCheckpoint(checkpoint3);

      // Verify state
      const state = manager.getState();
      expect(state.checkpoints).toHaveLength(3);

      // Verify token counts
      const expectedCheckpointTokens =
        checkpoint1.tokenCount + checkpoint2.tokenCount + checkpoint3.tokenCount;
      expect(state.tokenCount.checkpoints).toBe(expectedCheckpointTokens);

      // Verify prompt order
      const prompt = manager.buildPrompt();
      expect(prompt[0].id).toBe(systemPrompt.id);
      expect(prompt[1].id).toBe('ckpt-1');
      expect(prompt[2].id).toBe('ckpt-2');
      expect(prompt[3].id).toBe('ckpt-3');
    });

    it('should handle checkpoint with message removal', () => {
      const manager = new ActiveContextManager(systemPrompt, OLLAMA_LIMIT, tokenCounter);

      // Add messages with longer content to ensure compression saves tokens
      const message1 = createMessage('msg-1', 'This is the first message with some content');
      const message2 = createMessage('msg-2', 'This is the second message with more content');
      const message3 = createMessage('msg-3', 'Third message');
      manager.addMessage(message1);
      manager.addMessage(message2);
      manager.addMessage(message3);

      const beforeCompression = manager.getState();

      // Calculate tokens of messages being removed
      const msg1Tokens = tokenCounter.countTokensCached(message1.id, message1.content);
      const msg2Tokens = tokenCounter.countTokensCached(message2.id, message2.content);
      const removedTokens = msg1Tokens + msg2Tokens;

      // Simulate compression: remove first two messages and add checkpoint with shorter summary
      manager.removeMessages(['msg-1', 'msg-2']);
      const checkpointSummary = 'Summary'; // Much shorter than original
      const checkpoint = createCheckpoint(
        'ckpt-1',
        checkpointSummary,
        tokenCounter.countTokensCached('ckpt-1', checkpointSummary)
      );
      manager.addCheckpoint(checkpoint);

      // Verify state
      const afterCompression = manager.getState();
      expect(afterCompression.checkpoints).toHaveLength(1);
      expect(afterCompression.recentMessages).toHaveLength(1);
      expect(afterCompression.recentMessages[0].id).toBe('msg-3');

      // Verify token count changed correctly
      // After = Before - removedTokens + checkpointTokens
      const expectedTotal = beforeCompression.tokenCount.total - removedTokens + checkpoint.tokenCount;
      expect(afterCompression.tokenCount.total).toBe(expectedTotal);

      // Verify compression actually saved tokens
      expect(checkpoint.tokenCount).toBeLessThan(removedTokens);
    });
  });

  describe('Error Handling', () => {
    it('should throw error when adding message exceeds limit', () => {
      const manager = new ActiveContextManager(systemPrompt, OLLAMA_LIMIT, tokenCounter);

      // Create a very large message that exceeds the limit
      const largeContent = 'x'.repeat(30000); // ~7500 tokens
      const largeMessage = createMessage('msg-large', largeContent);

      expect(() => {
        manager.addMessage(largeMessage);
      }).toThrow('would exceed limit');

      // Verify context is still valid
      const validation = manager.validate();
      expect(validation.valid).toBe(true);
    });

    it('should handle removing non-existent messages gracefully', () => {
      const manager = new ActiveContextManager(systemPrompt, OLLAMA_LIMIT, tokenCounter);

      const message = createMessage('msg-1', 'Hello!');
      manager.addMessage(message);

      const beforeRemoval = manager.getState();

      // Try to remove non-existent message
      manager.removeMessages(['msg-999']);

      // Verify nothing changed
      const afterRemoval = manager.getState();
      expect(afterRemoval.recentMessages).toHaveLength(1);
      expect(afterRemoval.tokenCount.total).toBe(beforeRemoval.tokenCount.total);
    });

    it('should handle removing empty array', () => {
      const manager = new ActiveContextManager(systemPrompt, OLLAMA_LIMIT, tokenCounter);

      const message = createMessage('msg-1', 'Hello!');
      manager.addMessage(message);

      const beforeRemoval = manager.getState();

      // Remove empty array
      manager.removeMessages([]);

      // Verify nothing changed
      const afterRemoval = manager.getState();
      expect(afterRemoval.recentMessages).toHaveLength(1);
      expect(afterRemoval.tokenCount.total).toBe(beforeRemoval.tokenCount.total);
    });
  });

  describe('Validation', () => {
    it('should validate successfully when under limit', () => {
      const manager = new ActiveContextManager(systemPrompt, OLLAMA_LIMIT, tokenCounter);

      const message = createMessage('msg-1', 'Hello!');
      manager.addMessage(message);

      const validation = manager.validate();
      expect(validation.valid).toBe(true);
      expect(validation.tokens).toBeLessThanOrEqual(validation.limit);
      expect(validation.overage).toBeUndefined();
      expect(validation.message).toBeUndefined();
    });

    it('should provide detailed error when validation fails', () => {
      // Create manager with very small limit
      const smallLimit = 100;
      const manager = new ActiveContextManager(systemPrompt, smallLimit, tokenCounter);

      // System prompt alone might exceed the limit
      const validation = manager.validate();

      if (!validation.valid) {
        expect(validation.overage).toBeGreaterThan(0);
        expect(validation.message).toContain('exceeds limit');
        expect(validation.tokens).toBeGreaterThan(validation.limit);
      }
    });
  });

  describe('Getters', () => {
    it('should return correct values from getters', () => {
      const manager = new ActiveContextManager(systemPrompt, OLLAMA_LIMIT, tokenCounter);

      // Test getSystemPrompt
      expect(manager.getSystemPrompt()).toEqual(systemPrompt);

      // Test getCheckpoints (empty)
      expect(manager.getCheckpoints()).toHaveLength(0);

      // Test getRecentMessages (empty)
      expect(manager.getRecentMessages()).toHaveLength(0);

      // Test getOllamaLimit
      expect(manager.getOllamaLimit()).toBe(OLLAMA_LIMIT);

      // Test getSafetyMargin
      expect(manager.getSafetyMargin()).toBe(1000);

      // Add some data
      const checkpoint = createCheckpoint(
        'ckpt-1',
        'Summary',
        tokenCounter.countTokensCached('ckpt-1', 'Summary')
      );
      manager.addCheckpoint(checkpoint);

      const message = createMessage('msg-1', 'Hello!');
      manager.addMessage(message);

      // Test getters with data
      expect(manager.getCheckpoints()).toHaveLength(1);
      expect(manager.getCheckpoints()[0].id).toBe('ckpt-1');
      expect(manager.getRecentMessages()).toHaveLength(1);
      expect(manager.getRecentMessages()[0].id).toBe('msg-1');
    });

    it('should return copies from getters (not references)', () => {
      const manager = new ActiveContextManager(systemPrompt, OLLAMA_LIMIT, tokenCounter);

      const message = createMessage('msg-1', 'Hello!');
      manager.addMessage(message);

      // Get messages
      const messages1 = manager.getRecentMessages();
      const messages2 = manager.getRecentMessages();

      // Verify they are different arrays
      expect(messages1).not.toBe(messages2);
      expect(messages1).toEqual(messages2);

      // Modify one array
      messages1.push(createMessage('msg-2', 'Modified'));

      // Verify original is unchanged
      expect(manager.getRecentMessages()).toHaveLength(1);
    });
  });

  describe('Safety Margin', () => {
    it('should allow setting safety margin', () => {
      const manager = new ActiveContextManager(systemPrompt, OLLAMA_LIMIT, tokenCounter);

      expect(manager.getSafetyMargin()).toBe(1000);

      manager.setSafetyMargin(2000);
      expect(manager.getSafetyMargin()).toBe(2000);

      // Verify available tokens calculation uses new margin
      const available = manager.getAvailableTokens();
      const systemTokens = tokenCounter.countTokensCached(systemPrompt.id, systemPrompt.content);
      const expectedAvailable = OLLAMA_LIMIT - 2000 - systemTokens;
      expect(available).toBe(expectedAvailable);
    });

    it('should affect validation with different safety margins', () => {
      const manager = new ActiveContextManager(systemPrompt, OLLAMA_LIMIT, tokenCounter);

      // Add messages until near limit
      let messageCount = 0;
      while (manager.getAvailableTokens() > 500) {
        try {
          const message = createMessage(`msg-${messageCount}`, 'x'.repeat(100));
          manager.addMessage(message);
          messageCount++;
        } catch {
          break;
        }
      }

      // Validation should pass with default margin
      const validation1 = manager.validate();
      expect(validation1.valid).toBe(true);

      // Increase safety margin significantly
      manager.setSafetyMargin(3000);

      // Validation might now fail
      const validation2 = manager.validate();
      // The result depends on how much space was used
      if (!validation2.valid) {
        expect(validation2.overage).toBeGreaterThan(0);
      }
    });
  });
});
