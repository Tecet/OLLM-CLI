/**
 * Tests for Legacy Context Adapter
 */

import { describe, it, expect } from 'vitest';

import { LegacyContextAdapter } from '../adapters/legacyContextAdapter.js';

import type { Session } from '../../services/types.js';
import type { LegacySnapshot } from '../adapters/legacyContextAdapter.js';

describe('LegacyContextAdapter', () => {
  describe('migrateSession', () => {
    it('should convert legacy session to new format', () => {
      const legacySession: Session = {
        sessionId: 'test-session-123',
        startTime: '2026-01-28T10:00:00Z',
        lastActivity: '2026-01-28T11:00:00Z',
        model: 'llama3:8b',
        provider: 'ollama',
        messages: [
          {
            role: 'user',
            parts: [{ type: 'text', text: 'Hello' }],
            timestamp: '2026-01-28T10:00:00Z',
          },
          {
            role: 'assistant',
            parts: [{ type: 'text', text: 'Hi there!' }],
            timestamp: '2026-01-28T10:00:05Z',
          },
        ],
        toolCalls: [],
        metadata: {
          tokenCount: 100,
          compressionCount: 0,
        },
      };

      const newHistory = LegacyContextAdapter.migrateSession(legacySession);

      expect(newHistory.sessionId).toBe('test-session-123');
      expect(newHistory.messages).toHaveLength(2);
      expect(newHistory.messages[0].content).toBe('Hello');
      expect(newHistory.messages[1].content).toBe('Hi there!');
      expect(newHistory.checkpointRecords).toEqual([]);
      expect(newHistory.metadata.totalMessages).toBe(2);
      expect(newHistory.metadata.totalTokens).toBe(100);
      expect(newHistory.metadata.compressionCount).toBe(0);
    });

    it('should handle messages with multiple parts', () => {
      const legacySession: Session = {
        sessionId: 'test-session-456',
        startTime: '2026-01-28T10:00:00Z',
        lastActivity: '2026-01-28T11:00:00Z',
        model: 'llama3:8b',
        provider: 'ollama',
        messages: [
          {
            role: 'user',
            parts: [
              { type: 'text', text: 'Part 1' },
              { type: 'text', text: 'Part 2' },
            ],
            timestamp: '2026-01-28T10:00:00Z',
          },
        ],
        toolCalls: [],
        metadata: {
          tokenCount: 50,
          compressionCount: 0,
        },
      };

      const newHistory = LegacyContextAdapter.migrateSession(legacySession);

      expect(newHistory.messages[0].content).toBe('Part 1\nPart 2');
    });
  });

  describe('migrateSnapshot', () => {
    it('should convert legacy snapshot to new format', () => {
      const legacySnapshot: LegacySnapshot = {
        id: 'snapshot-123',
        sessionId: 'test-session-123',
        timestamp: Date.now(),
        messages: [
          {
            id: 'msg-1',
            role: 'user',
            content: 'Hello',
            timestamp: Date.now(),
          },
        ],
        metadata: {
          compressionCount: 1,
          tokenCount: 50,
        },
      };

      const newSnapshot = LegacyContextAdapter.migrateSnapshot(legacySnapshot);

      expect(newSnapshot.id).toBe('snapshot-123');
      expect(newSnapshot.sessionId).toBe('test-session-123');
      expect(newSnapshot.conversationState.messages).toHaveLength(1);
      expect(newSnapshot.conversationState.checkpoints).toEqual([]);
      expect(newSnapshot.purpose).toBe('recovery');
      expect(newSnapshot.conversationState.metadata.migratedFrom).toBe('legacy');
    });
  });

  describe('toLegacySession', () => {
    it('should convert new session history back to legacy format', () => {
      const newHistory = {
        sessionId: 'test-session-789',
        messages: [
          {
            id: 'msg-1',
            role: 'user' as const,
            content: 'Hello',
            timestamp: Date.now(),
          },
        ],
        checkpointRecords: [],
        metadata: {
          startTime: Date.now(),
          lastUpdate: Date.now(),
          totalMessages: 1,
          totalTokens: 50,
          compressionCount: 0,
        },
      };

      const legacySession = LegacyContextAdapter.toLegacySession(
        newHistory,
        'llama3:8b',
        'ollama'
      );

      expect(legacySession.sessionId).toBe('test-session-789');
      expect(legacySession.model).toBe('llama3:8b');
      expect(legacySession.provider).toBe('ollama');
      expect(legacySession.messages).toHaveLength(1);
      expect(legacySession.messages[0].parts[0].text).toBe('Hello');
      expect(legacySession.metadata.tokenCount).toBe(50);
    });
  });

  describe('validation', () => {
    it('should validate migrated session', () => {
      const validHistory = {
        sessionId: 'test-session-123',
        messages: [],
        checkpointRecords: [],
        metadata: {
          startTime: Date.now(),
          lastUpdate: Date.now(),
          totalMessages: 0,
          totalTokens: 0,
          compressionCount: 0,
        },
      };

      expect(LegacyContextAdapter.validateMigratedSession(validHistory)).toBe(true);
    });

    it('should reject invalid migrated session', () => {
      const invalidHistory = {
        sessionId: 'test-session-123',
        messages: [],
        // Missing checkpointRecords
        metadata: {
          startTime: Date.now(),
          lastUpdate: Date.now(),
          totalMessages: 0,
          totalTokens: 0,
          compressionCount: 0,
        },
      } as any;

      expect(LegacyContextAdapter.validateMigratedSession(invalidHistory)).toBe(false);
    });

    it('should validate migrated snapshot', () => {
      const validSnapshot = {
        id: 'snapshot-123',
        sessionId: 'test-session-123',
        timestamp: Date.now(),
        conversationState: {
          messages: [],
          checkpoints: [],
          metadata: {},
        },
        purpose: 'recovery' as const,
      };

      expect(LegacyContextAdapter.validateMigratedSnapshot(validSnapshot)).toBe(true);
    });

    it('should reject invalid migrated snapshot', () => {
      const invalidSnapshot = {
        id: 'snapshot-123',
        sessionId: 'test-session-123',
        timestamp: Date.now(),
        conversationState: {
          messages: [],
          checkpoints: [],
          metadata: {},
        },
        purpose: 'invalid' as any,
      };

      expect(LegacyContextAdapter.validateMigratedSnapshot(invalidSnapshot)).toBe(false);
    });
  });

  describe('getMigrationStats', () => {
    it('should calculate migration statistics', () => {
      const legacySession: Session = {
        sessionId: 'test-session-123',
        startTime: '2026-01-28T10:00:00Z',
        lastActivity: '2026-01-28T11:00:00Z',
        model: 'llama3:8b',
        provider: 'ollama',
        messages: [
          {
            role: 'user',
            parts: [{ type: 'text', text: 'Hello' }],
            timestamp: '2026-01-28T10:00:00Z',
          },
        ],
        toolCalls: [],
        metadata: {
          tokenCount: 100,
          compressionCount: 2,
        },
      };

      const newHistory = LegacyContextAdapter.migrateSession(legacySession);
      const stats = LegacyContextAdapter.getMigrationStats(legacySession, newHistory);

      expect(stats.messageCount).toBe(1);
      expect(stats.tokenCount).toBe(100);
      expect(stats.compressionCount).toBe(2);
      expect(stats.timeDiff).toBeGreaterThanOrEqual(0);
    });
  });
});
