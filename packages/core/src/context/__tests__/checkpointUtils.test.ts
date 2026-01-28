/**
 * Tests for Checkpoint Utilities
 */

import { describe, it, expect } from 'vitest';

import {
  findCheckpointById,
  findCheckpointsAfter,
  findCheckpointsBefore,
  sortCheckpointsByAge,
  sortCheckpointsByAgeDesc,
  filterCheckpointsByLevel,
  getRecentCheckpoints,
  getOldestCheckpoints,
  validateCheckpoint,
  extractCheckpointSummaries,
  calculateTotalCheckpointTokens,
  calculateTotalOriginalTokens,
  splitCheckpointsByAge,
  exceedsMaxCheckpoints,
  getCheckpointsForMerging,
} from '../checkpointUtils.js';

import type { CompressionCheckpoint } from '../types.js';

describe('Checkpoint Utilities', () => {
  // Helper to create test checkpoints
  const createCheckpoint = (
    id: string,
    level: number,
    createdAt: Date,
    originalTokens: number,
    currentTokens: number
  ): CompressionCheckpoint => ({
    id,
    level,
    range: `Messages 1-100`,
    summary: {
      id: `summary-${id}`,
      role: 'system',
      content: `Summary for ${id}`,
      timestamp: createdAt,
    },
    createdAt,
    originalTokens,
    currentTokens,
    compressionCount: 1,
  });

  const checkpoints: CompressionCheckpoint[] = [
    createCheckpoint('cp-1', 1, new Date('2026-01-01'), 1000, 500),
    createCheckpoint('cp-2', 2, new Date('2026-01-02'), 2000, 800),
    createCheckpoint('cp-3', 1, new Date('2026-01-03'), 1500, 600),
    createCheckpoint('cp-4', 3, new Date('2026-01-04'), 3000, 1200),
    createCheckpoint('cp-5', 2, new Date('2026-01-05'), 2500, 1000),
  ];

  describe('findCheckpointById', () => {
    it('should find checkpoint by ID', () => {
      const result = findCheckpointById(checkpoints, 'cp-3');
      expect(result).toBeDefined();
      expect(result?.id).toBe('cp-3');
    });

    it('should return undefined for non-existent ID', () => {
      const result = findCheckpointById(checkpoints, 'cp-999');
      expect(result).toBeUndefined();
    });

    it('should handle empty array', () => {
      const result = findCheckpointById([], 'cp-1');
      expect(result).toBeUndefined();
    });
  });

  describe('findCheckpointsAfter', () => {
    it('should find checkpoints after timestamp', () => {
      const result = findCheckpointsAfter(checkpoints, new Date('2026-01-03'));
      expect(result).toHaveLength(2);
      expect(result.map((cp) => cp.id)).toEqual(['cp-4', 'cp-5']);
    });

    it('should return empty array if none found', () => {
      const result = findCheckpointsAfter(checkpoints, new Date('2026-01-10'));
      expect(result).toHaveLength(0);
    });

    it('should handle empty array', () => {
      const result = findCheckpointsAfter([], new Date('2026-01-01'));
      expect(result).toHaveLength(0);
    });
  });

  describe('findCheckpointsBefore', () => {
    it('should find checkpoints before timestamp', () => {
      const result = findCheckpointsBefore(checkpoints, new Date('2026-01-03'));
      expect(result).toHaveLength(2);
      expect(result.map((cp) => cp.id)).toEqual(['cp-1', 'cp-2']);
    });

    it('should return empty array if none found', () => {
      const result = findCheckpointsBefore(checkpoints, new Date('2025-12-31'));
      expect(result).toHaveLength(0);
    });

    it('should handle empty array', () => {
      const result = findCheckpointsBefore([], new Date('2026-01-01'));
      expect(result).toHaveLength(0);
    });
  });

  describe('sortCheckpointsByAge', () => {
    it('should sort checkpoints oldest first', () => {
      const unsorted = [checkpoints[4], checkpoints[1], checkpoints[0]];
      const result = sortCheckpointsByAge(unsorted);
      expect(result.map((cp) => cp.id)).toEqual(['cp-1', 'cp-2', 'cp-5']);
    });

    it('should not mutate original array', () => {
      const original = [...checkpoints];
      sortCheckpointsByAge(checkpoints);
      expect(checkpoints).toEqual(original);
    });

    it('should handle empty array', () => {
      const result = sortCheckpointsByAge([]);
      expect(result).toHaveLength(0);
    });
  });

  describe('sortCheckpointsByAgeDesc', () => {
    it('should sort checkpoints newest first', () => {
      const unsorted = [checkpoints[0], checkpoints[2], checkpoints[4]];
      const result = sortCheckpointsByAgeDesc(unsorted);
      expect(result.map((cp) => cp.id)).toEqual(['cp-5', 'cp-3', 'cp-1']);
    });

    it('should not mutate original array', () => {
      const original = [...checkpoints];
      sortCheckpointsByAgeDesc(checkpoints);
      expect(checkpoints).toEqual(original);
    });

    it('should handle empty array', () => {
      const result = sortCheckpointsByAgeDesc([]);
      expect(result).toHaveLength(0);
    });
  });

  describe('filterCheckpointsByLevel', () => {
    it('should filter checkpoints by level', () => {
      const result = filterCheckpointsByLevel(checkpoints, 1);
      expect(result).toHaveLength(2);
      expect(result.map((cp) => cp.id)).toEqual(['cp-1', 'cp-3']);
    });

    it('should return empty array if no matches', () => {
      const result = filterCheckpointsByLevel(checkpoints, 99);
      expect(result).toHaveLength(0);
    });

    it('should handle empty array', () => {
      const result = filterCheckpointsByLevel([], 1);
      expect(result).toHaveLength(0);
    });
  });

  describe('getRecentCheckpoints', () => {
    it('should get N most recent checkpoints', () => {
      const result = getRecentCheckpoints(checkpoints, 3);
      expect(result).toHaveLength(3);
      expect(result.map((cp) => cp.id)).toEqual(['cp-5', 'cp-4', 'cp-3']);
    });

    it('should handle count larger than array', () => {
      const result = getRecentCheckpoints(checkpoints, 10);
      expect(result).toHaveLength(5);
    });

    it('should handle empty array', () => {
      const result = getRecentCheckpoints([], 3);
      expect(result).toHaveLength(0);
    });
  });

  describe('getOldestCheckpoints', () => {
    it('should get N oldest checkpoints', () => {
      const result = getOldestCheckpoints(checkpoints, 3);
      expect(result).toHaveLength(3);
      expect(result.map((cp) => cp.id)).toEqual(['cp-1', 'cp-2', 'cp-3']);
    });

    it('should handle count larger than array', () => {
      const result = getOldestCheckpoints(checkpoints, 10);
      expect(result).toHaveLength(5);
    });

    it('should handle empty array', () => {
      const result = getOldestCheckpoints([], 3);
      expect(result).toHaveLength(0);
    });
  });

  describe('validateCheckpoint', () => {
    it('should validate correct checkpoint', () => {
      const result = validateCheckpoint(checkpoints[0]);
      expect(result).toBe(true);
    });

    it('should reject checkpoint with missing id', () => {
      const invalid = { ...checkpoints[0], id: '' };
      const result = validateCheckpoint(invalid);
      expect(result).toBe(false);
    });

    it('should reject checkpoint with negative level', () => {
      const invalid = { ...checkpoints[0], level: -1 };
      const result = validateCheckpoint(invalid);
      expect(result).toBe(false);
    });

    it('should reject checkpoint with missing range', () => {
      const invalid = { ...checkpoints[0], range: '' };
      const result = validateCheckpoint(invalid);
      expect(result).toBe(false);
    });

    it('should reject checkpoint with negative tokens', () => {
      const invalid = { ...checkpoints[0], currentTokens: -1 };
      const result = validateCheckpoint(invalid);
      expect(result).toBe(false);
    });
  });

  describe('extractCheckpointSummaries', () => {
    it('should extract summary messages', () => {
      const result = extractCheckpointSummaries(checkpoints);
      expect(result).toHaveLength(5);
      expect(result[0].role).toBe('system');
      expect(result[0].content).toContain('Summary for cp-1');
    });

    it('should handle empty array', () => {
      const result = extractCheckpointSummaries([]);
      expect(result).toHaveLength(0);
    });
  });

  describe('calculateTotalCheckpointTokens', () => {
    it('should calculate total current tokens', () => {
      const result = calculateTotalCheckpointTokens(checkpoints);
      expect(result).toBe(4100); // 500 + 800 + 600 + 1200 + 1000
    });

    it('should handle empty array', () => {
      const result = calculateTotalCheckpointTokens([]);
      expect(result).toBe(0);
    });
  });

  describe('calculateTotalOriginalTokens', () => {
    it('should calculate total original tokens', () => {
      const result = calculateTotalOriginalTokens(checkpoints);
      expect(result).toBe(10000); // 1000 + 2000 + 1500 + 3000 + 2500
    });

    it('should handle empty array', () => {
      const result = calculateTotalOriginalTokens([]);
      expect(result).toBe(0);
    });
  });

  describe('splitCheckpointsByAge', () => {
    it('should split checkpoints into old and recent', () => {
      const result = splitCheckpointsByAge(checkpoints, 2);
      expect(result.old).toHaveLength(3);
      expect(result.recent).toHaveLength(2);
      expect(result.old.map((cp) => cp.id)).toEqual(['cp-1', 'cp-2', 'cp-3']);
      expect(result.recent.map((cp) => cp.id)).toEqual(['cp-4', 'cp-5']);
    });

    it('should handle keepRecent larger than array', () => {
      const result = splitCheckpointsByAge(checkpoints, 10);
      expect(result.old).toHaveLength(0);
      expect(result.recent).toHaveLength(5);
    });

    it('should handle empty array', () => {
      const result = splitCheckpointsByAge([], 2);
      expect(result.old).toHaveLength(0);
      expect(result.recent).toHaveLength(0);
    });
  });

  describe('exceedsMaxCheckpoints', () => {
    it('should return true when exceeds max', () => {
      const result = exceedsMaxCheckpoints(checkpoints, 3);
      expect(result).toBe(true);
    });

    it('should return false when within max', () => {
      const result = exceedsMaxCheckpoints(checkpoints, 10);
      expect(result).toBe(false);
    });

    it('should return false when equal to max', () => {
      const result = exceedsMaxCheckpoints(checkpoints, 5);
      expect(result).toBe(false);
    });
  });

  describe('getCheckpointsForMerging', () => {
    it('should identify checkpoints to merge', () => {
      const result = getCheckpointsForMerging(checkpoints, 3);
      expect(result.toMerge).toHaveLength(3); // excess (2) + 1
      expect(result.toKeep).toHaveLength(2);
      expect(result.toMerge.map((cp) => cp.id)).toEqual(['cp-1', 'cp-2', 'cp-3']);
      expect(result.toKeep.map((cp) => cp.id)).toEqual(['cp-4', 'cp-5']);
    });

    it('should return empty toMerge when within limit', () => {
      const result = getCheckpointsForMerging(checkpoints, 10);
      expect(result.toMerge).toHaveLength(0);
      expect(result.toKeep).toHaveLength(5);
    });

    it('should handle empty array', () => {
      const result = getCheckpointsForMerging([], 3);
      expect(result.toMerge).toHaveLength(0);
      expect(result.toKeep).toHaveLength(0);
    });
  });
});
