/**
 * Unit Tests for Session History Manager
 * 
 * Tests specific functionality and edge cases not covered by property tests.
 */

import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { SessionHistoryManager } from '../sessionHistoryManager.js';

import type { Message, CheckpointRecord } from '../../types/storageTypes.js';

describe('SessionHistoryManager - Unit Tests', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'session-unit-test-'));
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (_error) {
      // Ignore cleanup errors
    }
  });

  describe('exportToMarkdown', () => {
    it('should export empty session to markdown', () => {
      const manager = new SessionHistoryManager('test-session', tempDir);

      const markdown = manager.exportToMarkdown();

      expect(markdown).toContain('# Session test-session');
      expect(markdown).toContain('## Session Information');
      expect(markdown).toContain('**Total Messages:** 0');
      expect(markdown).toContain('**Compressions:** 0');
    });

    it('should export session with messages to markdown', () => {
      const manager = new SessionHistoryManager('test-session', tempDir);

      const message1: Message = {
        id: 'msg-1',
        role: 'user',
        content: 'Hello, world!',
        timestamp: Date.now(),
      };

      const message2: Message = {
        id: 'msg-2',
        role: 'assistant',
        content: 'Hi there!',
        timestamp: Date.now(),
      };

      manager.appendMessage(message1);
      manager.appendMessage(message2);

      const markdown = manager.exportToMarkdown();

      expect(markdown).toContain('# Session test-session');
      expect(markdown).toContain('**Total Messages:** 2');
      expect(markdown).toContain('### User');
      expect(markdown).toContain('Hello, world!');
      expect(markdown).toContain('### Assistant');
      expect(markdown).toContain('Hi there!');
    });

    it('should export session with checkpoint records to markdown', () => {
      const manager = new SessionHistoryManager('test-session', tempDir);

      const record: CheckpointRecord = {
        id: 'ckpt-1',
        timestamp: Date.now(),
        messageRange: [0, 10],
        originalTokens: 2500,
        compressedTokens: 300,
        compressionRatio: 0.12,
        level: 3,
      };

      manager.recordCheckpoint(record);

      const markdown = manager.exportToMarkdown();

      expect(markdown).toContain('## Compression History');
      expect(markdown).toContain('### Checkpoint ckpt-1');
      expect(markdown).toContain('**Original Tokens:** 2500');
      expect(markdown).toContain('**Compressed Tokens:** 300');
      expect(markdown).toContain('**Compression Ratio:** 12.0%');
      expect(markdown).toContain('**Level:** 3 (Detailed)');
    });

    it('should format compression levels correctly', () => {
      const manager = new SessionHistoryManager('test-session', tempDir);

      const record1: CheckpointRecord = {
        id: 'ckpt-1',
        timestamp: Date.now(),
        messageRange: [0, 5],
        originalTokens: 1000,
        compressedTokens: 100,
        compressionRatio: 0.1,
        level: 1,
      };

      const record2: CheckpointRecord = {
        id: 'ckpt-2',
        timestamp: Date.now(),
        messageRange: [5, 10],
        originalTokens: 1000,
        compressedTokens: 200,
        compressionRatio: 0.2,
        level: 2,
      };

      manager.recordCheckpoint(record1);
      manager.recordCheckpoint(record2);

      const markdown = manager.exportToMarkdown();

      expect(markdown).toContain('**Level:** 1 (Compact)');
      expect(markdown).toContain('**Level:** 2 (Moderate)');
    });

    it('should include message separators', () => {
      const manager = new SessionHistoryManager('test-session', tempDir);

      const message1: Message = {
        id: 'msg-1',
        role: 'user',
        content: 'First message',
        timestamp: Date.now(),
      };

      const message2: Message = {
        id: 'msg-2',
        role: 'assistant',
        content: 'Second message',
        timestamp: Date.now(),
      };

      manager.appendMessage(message1);
      manager.appendMessage(message2);

      const markdown = manager.exportToMarkdown();

      // Should have separators between messages
      const separatorCount = (markdown.match(/---/g) || []).length;
      expect(separatorCount).toBeGreaterThanOrEqual(2);
    });
  });

  describe('edge cases', () => {
    it('should handle very long message content', () => {
      const manager = new SessionHistoryManager('test-session', tempDir);

      const longContent = 'A'.repeat(100000);
      const message: Message = {
        id: 'msg-1',
        role: 'user',
        content: longContent,
        timestamp: Date.now(),
      };

      manager.appendMessage(message);

      const history = manager.getHistory();
      expect(history.messages[0].content).toBe(longContent);
      expect(history.metadata.totalTokens).toBeGreaterThan(0);
    });

    it('should handle special characters in message content', () => {
      const manager = new SessionHistoryManager('test-session', tempDir);

      const specialContent = 'Special chars: <>&"\'`\n\t\r';
      const message: Message = {
        id: 'msg-1',
        role: 'user',
        content: specialContent,
        timestamp: Date.now(),
      };

      manager.appendMessage(message);

      const history = manager.getHistory();
      expect(history.messages[0].content).toBe(specialContent);
    });

    it('should handle rapid successive appends', () => {
      const manager = new SessionHistoryManager('test-session', tempDir);

      const messages: Message[] = [];
      for (let i = 0; i < 100; i++) {
        const message: Message = {
          id: `msg-${i}`,
          role: i % 2 === 0 ? 'user' : 'assistant',
          content: `Message ${i}`,
          timestamp: Date.now() + i,
        };
        messages.push(message);
        manager.appendMessage(message);
      }

      const history = manager.getHistory();
      expect(history.messages).toHaveLength(100);
      expect(history.metadata.totalMessages).toBe(100);
    });

    it('should handle checkpoint records with edge values', () => {
      const manager = new SessionHistoryManager('test-session', tempDir);

      const record: CheckpointRecord = {
        id: 'ckpt-1',
        timestamp: 0,
        messageRange: [0, 0],
        originalTokens: 1,
        compressedTokens: 1,
        compressionRatio: 1.0,
        level: 1,
      };

      manager.recordCheckpoint(record);

      const history = manager.getHistory();
      expect(history.checkpointRecords).toHaveLength(1);
      expect(history.metadata.compressionCount).toBe(1);
    });

    it('should maintain separate state for different session IDs', () => {
      const manager1 = new SessionHistoryManager('session-1', tempDir);
      const manager2 = new SessionHistoryManager('session-2', tempDir);

      const message1: Message = {
        id: 'msg-1',
        role: 'user',
        content: 'Session 1 message',
        timestamp: Date.now(),
      };

      const message2: Message = {
        id: 'msg-2',
        role: 'user',
        content: 'Session 2 message',
        timestamp: Date.now(),
      };

      manager1.appendMessage(message1);
      manager2.appendMessage(message2);

      const history1 = manager1.getHistory();
      const history2 = manager2.getHistory();

      expect(history1.sessionId).toBe('session-1');
      expect(history2.sessionId).toBe('session-2');
      expect(history1.messages[0].content).toBe('Session 1 message');
      expect(history2.messages[0].content).toBe('Session 2 message');
    });
  });

  describe('token estimation', () => {
    it('should estimate tokens for messages', () => {
      const manager = new SessionHistoryManager('test-session', tempDir);

      const message: Message = {
        id: 'msg-1',
        role: 'user',
        content: 'This is a test message with some content',
        timestamp: Date.now(),
      };

      manager.appendMessage(message);

      const history = manager.getHistory();
      expect(history.metadata.totalTokens).toBeGreaterThan(0);
      // Rough estimate: ~4 chars per token
      expect(history.metadata.totalTokens).toBeGreaterThan(5);
    });

    it('should accumulate token counts correctly', () => {
      const manager = new SessionHistoryManager('test-session', tempDir);

      const message1: Message = {
        id: 'msg-1',
        role: 'user',
        content: 'Short',
        timestamp: Date.now(),
      };

      const message2: Message = {
        id: 'msg-2',
        role: 'assistant',
        content: 'This is a much longer message with more content',
        timestamp: Date.now(),
      };

      manager.appendMessage(message1);
      const tokens1 = manager.getHistory().metadata.totalTokens;

      manager.appendMessage(message2);
      const tokens2 = manager.getHistory().metadata.totalTokens;

      expect(tokens2).toBeGreaterThan(tokens1);
    });
  });
});
