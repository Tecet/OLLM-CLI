/**
 * Tests for Snapshot Utilities
 */

import { describe, it, expect } from 'vitest';
import type { SnapshotMetadata, ContextSnapshot, Message } from '../types.js';
import {
  findSnapshotById,
  findSnapshotsBySession,
  findSnapshotsAfter,
  findSnapshotsBefore,
  sortSnapshotsByAge,
  sortSnapshotsByAgeDesc,
  getRecentSnapshots,
  getOldestSnapshots,
  validateSnapshotMetadata,
  validateContextSnapshot,
  calculateTotalSnapshotSize,
  calculateTotalMessageCount,
  groupSnapshotsBySession,
  filterSnapshotsAboveThreshold,
  filterSnapshotsBelowThreshold,
  getSnapshotsForCleanup,
  extractUserMessages,
  extractNonUserMessages,
  exceedsMaxSnapshots,
} from '../snapshotUtils.js';

describe('Snapshot Utilities', () => {
  // Helper to create test snapshot metadata
  const createMetadata = (
    id: string,
    sessionId: string,
    timestamp: Date,
    messageCount: number,
    tokenCount: number
  ): SnapshotMetadata => ({
    id,
    sessionId,
    timestamp,
    messageCount,
    tokenCount,
    summary: `Summary for ${id}`,
  });

  const snapshots: SnapshotMetadata[] = [
    createMetadata('snap-1', 'session-a', new Date('2026-01-01'), 10, 1000),
    createMetadata('snap-2', 'session-a', new Date('2026-01-02'), 15, 1500),
    createMetadata('snap-3', 'session-b', new Date('2026-01-03'), 20, 2000),
    createMetadata('snap-4', 'session-b', new Date('2026-01-04'), 25, 2500),
    createMetadata('snap-5', 'session-c', new Date('2026-01-05'), 30, 3000),
  ];

  describe('findSnapshotById', () => {
    it('should find snapshot by ID', () => {
      const result = findSnapshotById(snapshots, 'snap-3');
      expect(result).toBeDefined();
      expect(result?.id).toBe('snap-3');
    });

    it('should return undefined for non-existent ID', () => {
      const result = findSnapshotById(snapshots, 'snap-999');
      expect(result).toBeUndefined();
    });

    it('should handle empty array', () => {
      const result = findSnapshotById([], 'snap-1');
      expect(result).toBeUndefined();
    });
  });

  describe('findSnapshotsBySession', () => {
    it('should find snapshots by session ID', () => {
      const result = findSnapshotsBySession(snapshots, 'session-a');
      expect(result).toHaveLength(2);
      expect(result.map(s => s.id)).toEqual(['snap-1', 'snap-2']);
    });

    it('should return empty array for non-existent session', () => {
      const result = findSnapshotsBySession(snapshots, 'session-z');
      expect(result).toHaveLength(0);
    });

    it('should handle empty array', () => {
      const result = findSnapshotsBySession([], 'session-a');
      expect(result).toHaveLength(0);
    });
  });

  describe('findSnapshotsAfter', () => {
    it('should find snapshots after timestamp', () => {
      const result = findSnapshotsAfter(snapshots, new Date('2026-01-03'));
      expect(result).toHaveLength(2);
      expect(result.map(s => s.id)).toEqual(['snap-4', 'snap-5']);
    });

    it('should return empty array if none found', () => {
      const result = findSnapshotsAfter(snapshots, new Date('2026-01-10'));
      expect(result).toHaveLength(0);
    });
  });

  describe('findSnapshotsBefore', () => {
    it('should find snapshots before timestamp', () => {
      const result = findSnapshotsBefore(snapshots, new Date('2026-01-03'));
      expect(result).toHaveLength(2);
      expect(result.map(s => s.id)).toEqual(['snap-1', 'snap-2']);
    });

    it('should return empty array if none found', () => {
      const result = findSnapshotsBefore(snapshots, new Date('2025-12-31'));
      expect(result).toHaveLength(0);
    });
  });

  describe('sortSnapshotsByAge', () => {
    it('should sort snapshots oldest first', () => {
      const unsorted = [snapshots[4], snapshots[1], snapshots[0]];
      const result = sortSnapshotsByAge(unsorted);
      expect(result.map(s => s.id)).toEqual(['snap-1', 'snap-2', 'snap-5']);
    });

    it('should not mutate original array', () => {
      const original = [...snapshots];
      sortSnapshotsByAge(snapshots);
      expect(snapshots).toEqual(original);
    });
  });

  describe('sortSnapshotsByAgeDesc', () => {
    it('should sort snapshots newest first', () => {
      const unsorted = [snapshots[0], snapshots[2], snapshots[4]];
      const result = sortSnapshotsByAgeDesc(unsorted);
      expect(result.map(s => s.id)).toEqual(['snap-5', 'snap-3', 'snap-1']);
    });

    it('should not mutate original array', () => {
      const original = [...snapshots];
      sortSnapshotsByAgeDesc(snapshots);
      expect(snapshots).toEqual(original);
    });
  });

  describe('getRecentSnapshots', () => {
    it('should get N most recent snapshots', () => {
      const result = getRecentSnapshots(snapshots, 3);
      expect(result).toHaveLength(3);
      expect(result.map(s => s.id)).toEqual(['snap-5', 'snap-4', 'snap-3']);
    });

    it('should handle count larger than array', () => {
      const result = getRecentSnapshots(snapshots, 10);
      expect(result).toHaveLength(5);
    });
  });

  describe('getOldestSnapshots', () => {
    it('should get N oldest snapshots', () => {
      const result = getOldestSnapshots(snapshots, 3);
      expect(result).toHaveLength(3);
      expect(result.map(s => s.id)).toEqual(['snap-1', 'snap-2', 'snap-3']);
    });

    it('should handle count larger than array', () => {
      const result = getOldestSnapshots(snapshots, 10);
      expect(result).toHaveLength(5);
    });
  });

  describe('validateSnapshotMetadata', () => {
    it('should validate correct metadata', () => {
      const result = validateSnapshotMetadata(snapshots[0]);
      expect(result).toBe(true);
    });

    it('should reject metadata with missing id', () => {
      const invalid = { ...snapshots[0], id: '' };
      const result = validateSnapshotMetadata(invalid);
      expect(result).toBe(false);
    });

    it('should reject metadata with negative message count', () => {
      const invalid = { ...snapshots[0], messageCount: -1 };
      const result = validateSnapshotMetadata(invalid);
      expect(result).toBe(false);
    });
  });

  describe('validateContextSnapshot', () => {
    const validSnapshot: ContextSnapshot = {
      id: 'snap-1',
      sessionId: 'session-a',
      timestamp: new Date(),
      tokenCount: 1000,
      userMessages: [],
      messages: [],
      metadata: {
        model: 'test-model',
        contextSize: 4096,
        compressionRatio: 1.0,
        totalUserMessages: 0,
      },
    };

    it('should validate correct context snapshot', () => {
      const result = validateContextSnapshot(validSnapshot);
      expect(result).toBe(true);
    });

    it('should reject snapshot with missing id', () => {
      const invalid = { ...validSnapshot, id: '' };
      const result = validateContextSnapshot(invalid);
      expect(result).toBe(false);
    });

    it('should reject snapshot with non-array messages', () => {
      const invalid = { ...validSnapshot, messages: null as any };
      const result = validateContextSnapshot(invalid);
      expect(result).toBe(false);
    });
  });

  describe('calculateTotalSnapshotSize', () => {
    it('should calculate total token count', () => {
      const result = calculateTotalSnapshotSize(snapshots);
      expect(result).toBe(10000); // 1000 + 1500 + 2000 + 2500 + 3000
    });

    it('should handle empty array', () => {
      const result = calculateTotalSnapshotSize([]);
      expect(result).toBe(0);
    });
  });

  describe('calculateTotalMessageCount', () => {
    it('should calculate total message count', () => {
      const result = calculateTotalMessageCount(snapshots);
      expect(result).toBe(100); // 10 + 15 + 20 + 25 + 30
    });

    it('should handle empty array', () => {
      const result = calculateTotalMessageCount([]);
      expect(result).toBe(0);
    });
  });

  describe('groupSnapshotsBySession', () => {
    it('should group snapshots by session ID', () => {
      const result = groupSnapshotsBySession(snapshots);
      expect(result.size).toBe(3);
      expect(result.get('session-a')).toHaveLength(2);
      expect(result.get('session-b')).toHaveLength(2);
      expect(result.get('session-c')).toHaveLength(1);
    });

    it('should handle empty array', () => {
      const result = groupSnapshotsBySession([]);
      expect(result.size).toBe(0);
    });
  });

  describe('filterSnapshotsAboveThreshold', () => {
    it('should filter snapshots above threshold', () => {
      const result = filterSnapshotsAboveThreshold(snapshots, 2000);
      expect(result).toHaveLength(2);
      expect(result.map(s => s.id)).toEqual(['snap-4', 'snap-5']);
    });

    it('should return empty array if none above threshold', () => {
      const result = filterSnapshotsAboveThreshold(snapshots, 10000);
      expect(result).toHaveLength(0);
    });
  });

  describe('filterSnapshotsBelowThreshold', () => {
    it('should filter snapshots below threshold', () => {
      const result = filterSnapshotsBelowThreshold(snapshots, 2000);
      expect(result).toHaveLength(2);
      expect(result.map(s => s.id)).toEqual(['snap-1', 'snap-2']);
    });

    it('should return empty array if none below threshold', () => {
      const result = filterSnapshotsBelowThreshold(snapshots, 100);
      expect(result).toHaveLength(0);
    });
  });

  describe('getSnapshotsForCleanup', () => {
    it('should identify snapshots to delete', () => {
      const result = getSnapshotsForCleanup(snapshots, 3);
      expect(result.toKeep).toHaveLength(3);
      expect(result.toDelete).toHaveLength(2);
      expect(result.toKeep.map(s => s.id)).toEqual(['snap-5', 'snap-4', 'snap-3']);
      expect(result.toDelete.map(s => s.id)).toEqual(['snap-2', 'snap-1']);
    });

    it('should return empty toDelete when within limit', () => {
      const result = getSnapshotsForCleanup(snapshots, 10);
      expect(result.toKeep).toHaveLength(5);
      expect(result.toDelete).toHaveLength(0);
    });
  });

  describe('extractUserMessages', () => {
    const createMessage = (id: string, role: 'user' | 'assistant' | 'system'): Message => ({
      id,
      role,
      content: `Message ${id}`,
      timestamp: new Date(),
    });

    it('should extract user messages from userMessages field', () => {
      const snapshot: ContextSnapshot = {
        id: 'snap-1',
        sessionId: 'session-a',
        timestamp: new Date(),
        tokenCount: 1000,
        userMessages: [createMessage('msg-1', 'user'), createMessage('msg-2', 'user')],
        messages: [createMessage('msg-3', 'assistant')],
        metadata: {
          model: 'test-model',
          contextSize: 4096,
          compressionRatio: 1.0,
          totalUserMessages: 2,
        },
      };

      const result = extractUserMessages(snapshot);
      expect(result).toHaveLength(2);
      expect(result.every(m => m.role === 'user')).toBe(true);
    });

    it('should fall back to filtering messages', () => {
      const snapshot: ContextSnapshot = {
        id: 'snap-1',
        sessionId: 'session-a',
        timestamp: new Date(),
        tokenCount: 1000,
        userMessages: [],
        messages: [
          createMessage('msg-1', 'user'),
          createMessage('msg-2', 'assistant'),
          createMessage('msg-3', 'user'),
        ],
        metadata: {
          model: 'test-model',
          contextSize: 4096,
          compressionRatio: 1.0,
          totalUserMessages: 2,
        },
      };

      const result = extractUserMessages(snapshot);
      expect(result).toHaveLength(2);
      expect(result.every(m => m.role === 'user')).toBe(true);
    });
  });

  describe('extractNonUserMessages', () => {
    const createMessage = (id: string, role: 'user' | 'assistant' | 'system'): Message => ({
      id,
      role,
      content: `Message ${id}`,
      timestamp: new Date(),
    });

    it('should extract non-user messages', () => {
      const snapshot: ContextSnapshot = {
        id: 'snap-1',
        sessionId: 'session-a',
        timestamp: new Date(),
        tokenCount: 1000,
        userMessages: [],
        messages: [
          createMessage('msg-1', 'user'),
          createMessage('msg-2', 'assistant'),
          createMessage('msg-3', 'system'),
        ],
        metadata: {
          model: 'test-model',
          contextSize: 4096,
          compressionRatio: 1.0,
          totalUserMessages: 1,
        },
      };

      const result = extractNonUserMessages(snapshot);
      expect(result).toHaveLength(2);
      expect(result.every(m => m.role !== 'user')).toBe(true);
    });
  });

  describe('exceedsMaxSnapshots', () => {
    it('should return true when exceeds max', () => {
      const result = exceedsMaxSnapshots(snapshots, 3);
      expect(result).toBe(true);
    });

    it('should return false when within max', () => {
      const result = exceedsMaxSnapshots(snapshots, 10);
      expect(result).toBe(false);
    });

    it('should return false when equal to max', () => {
      const result = exceedsMaxSnapshots(snapshots, 5);
      expect(result).toBe(false);
    });
  });
});
