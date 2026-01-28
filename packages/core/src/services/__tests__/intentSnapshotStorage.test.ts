/**
 * Intent Snapshot Storage Tests
 * 
 * Tests for intent snapshot storage including:
 * - Save and load operations
 * - Search functionality
 * - Cleanup and maintenance
 * - Statistics and monitoring
 */

import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { IntentSnapshotStorage, createIntentSnapshotStorage } from '../intentSnapshotStorage.js';

import type { IntentSnapshot } from '../inputPreprocessor.js';

describe('IntentSnapshotStorage', () => {
  let testDir: string;
  let storage: IntentSnapshotStorage;

  beforeEach(async () => {
    // Create temporary test directory
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'intent-snapshot-test-'));
    storage = new IntentSnapshotStorage(testDir);
  });

  afterEach(async () => {
    // Clean up test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  // ============================================================================
  // Helper Functions
  // ============================================================================

  function createTestSnapshot(id: string, intent: string, timestamp?: Date): IntentSnapshot {
    return {
      id,
      timestamp: timestamp || new Date(),
      original: `Original text for ${intent}`,
      extracted: {
        intent,
        keyPoints: [`Point 1 for ${intent}`, `Point 2 for ${intent}`],
        entities: [],
        sentiment: 'neutral',
      },
    };
  }

  // ============================================================================
  // Save and Load Tests
  // ============================================================================

  describe('save and load', () => {
    it('should save and load a snapshot', async () => {
      const snapshot = createTestSnapshot('test-1', 'Test intent');

      await storage.save(snapshot);
      const loaded = await storage.load('test-1');

      expect(loaded).toBeDefined();
      expect(loaded?.id).toBe('test-1');
      expect(loaded?.extracted.intent).toBe('Test intent');
    });

    it('should return null for non-existent snapshot', async () => {
      const loaded = await storage.load('non-existent');

      expect(loaded).toBeNull();
    });

    it('should overwrite existing snapshot with same ID', async () => {
      const snapshot1 = createTestSnapshot('test-1', 'First intent');
      const snapshot2 = createTestSnapshot('test-1', 'Second intent');

      await storage.save(snapshot1);
      await storage.save(snapshot2);

      const loaded = await storage.load('test-1');

      expect(loaded?.extracted.intent).toBe('Second intent');
    });

    it('should preserve all snapshot fields', async () => {
      const snapshot: IntentSnapshot = {
        id: 'test-1',
        timestamp: new Date('2024-01-15T10:00:00Z'),
        original: 'Original text',
        extracted: {
          intent: 'Test intent',
          keyPoints: ['Point 1', 'Point 2', 'Point 3'],
          entities: ['Entity 1', 'Entity 2'],
          sentiment: 'positive',
        },
      };

      await storage.save(snapshot);
      const loaded = await storage.load('test-1');

      expect(loaded?.id).toBe(snapshot.id);
      expect(loaded?.original).toBe(snapshot.original);
      expect(loaded?.extracted).toEqual(snapshot.extracted);
      // Timestamp is serialized as string, so compare as ISO strings
      expect(new Date(loaded!.timestamp).toISOString()).toBe(snapshot.timestamp.toISOString());
    });

    it('should create directory if it does not exist', async () => {
      const newDir = path.join(testDir, 'nested', 'directory');
      const newStorage = new IntentSnapshotStorage(newDir);

      const snapshot = createTestSnapshot('test-1', 'Test intent');
      await newStorage.save(snapshot);

      const loaded = await newStorage.load('test-1');
      expect(loaded).toBeDefined();
    });
  });

  // ============================================================================
  // List Tests
  // ============================================================================

  describe('list', () => {
    it('should list all snapshots', async () => {
      await storage.save(createTestSnapshot('test-1', 'Intent 1'));
      await storage.save(createTestSnapshot('test-2', 'Intent 2'));
      await storage.save(createTestSnapshot('test-3', 'Intent 3'));

      const snapshots = await storage.list();

      expect(snapshots).toHaveLength(3);
      expect(snapshots.map(s => s.id)).toContain('test-1');
      expect(snapshots.map(s => s.id)).toContain('test-2');
      expect(snapshots.map(s => s.id)).toContain('test-3');
    });

    it('should return empty array when no snapshots exist', async () => {
      const snapshots = await storage.list();

      expect(snapshots).toEqual([]);
    });

    it('should sort snapshots by timestamp (newest first)', async () => {
      await storage.save(createTestSnapshot('test-1', 'Intent 1', new Date('2024-01-15T10:00:00Z')));
      await storage.save(createTestSnapshot('test-2', 'Intent 2', new Date('2024-01-15T12:00:00Z')));
      await storage.save(createTestSnapshot('test-3', 'Intent 3', new Date('2024-01-15T11:00:00Z')));

      const snapshots = await storage.list();

      expect(snapshots[0].id).toBe('test-2'); // Newest
      expect(snapshots[1].id).toBe('test-3'); // Middle
      expect(snapshots[2].id).toBe('test-1'); // Oldest
    });

    it('should skip corrupted snapshot files', async () => {
      await storage.save(createTestSnapshot('test-1', 'Intent 1'));
      
      // Create corrupted file
      const corruptedPath = path.join(testDir, 'corrupted.json');
      await fs.writeFile(corruptedPath, 'invalid json {', 'utf-8');

      const snapshots = await storage.list();

      expect(snapshots).toHaveLength(1);
      expect(snapshots[0].id).toBe('test-1');
    });
  });

  // ============================================================================
  // Delete Tests
  // ============================================================================

  describe('delete', () => {
    it('should delete a snapshot', async () => {
      await storage.save(createTestSnapshot('test-1', 'Intent 1'));

      await storage.delete('test-1');

      const loaded = await storage.load('test-1');
      expect(loaded).toBeNull();
    });

    it('should not throw error when deleting non-existent snapshot', async () => {
      await expect(storage.delete('non-existent')).resolves.not.toThrow();
    });

    it('should only delete specified snapshot', async () => {
      await storage.save(createTestSnapshot('test-1', 'Intent 1'));
      await storage.save(createTestSnapshot('test-2', 'Intent 2'));

      await storage.delete('test-1');

      const snapshots = await storage.list();
      expect(snapshots).toHaveLength(1);
      expect(snapshots[0].id).toBe('test-2');
    });
  });

  // ============================================================================
  // Search Tests
  // ============================================================================

  describe('search', () => {
    beforeEach(async () => {
      await storage.save(createTestSnapshot('test-1', 'Create a new user account'));
      await storage.save(createTestSnapshot('test-2', 'Delete user profile'));
      await storage.save(createTestSnapshot('test-3', 'Update user settings'));
    });

    it('should search by intent text', async () => {
      const results = await storage.search('user');

      expect(results).toHaveLength(3);
    });

    it('should search case-insensitively', async () => {
      const results = await storage.search('USER');

      expect(results).toHaveLength(3);
    });

    it('should search by key points', async () => {
      const snapshot = createTestSnapshot('test-4', 'Test intent');
      snapshot.extracted.keyPoints = ['Special keyword here'];
      await storage.save(snapshot);

      const results = await storage.search('special keyword');

      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('test-4');
    });

    it('should return empty array when no matches found', async () => {
      const results = await storage.search('nonexistent');

      expect(results).toEqual([]);
    });

    it('should return partial matches', async () => {
      const results = await storage.search('creat');

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].extracted.intent).toContain('Create');
    });
  });

  // ============================================================================
  // Recent Snapshots Tests
  // ============================================================================

  describe('getRecent', () => {
    it('should return recent snapshots with default limit', async () => {
      for (let i = 0; i < 15; i++) {
        await storage.save(createTestSnapshot(`test-${i}`, `Intent ${i}`, new Date(Date.now() + i * 1000)));
      }

      const recent = await storage.getRecent();

      expect(recent).toHaveLength(10); // Default limit
    });

    it('should return recent snapshots with custom limit', async () => {
      for (let i = 0; i < 10; i++) {
        await storage.save(createTestSnapshot(`test-${i}`, `Intent ${i}`, new Date(Date.now() + i * 1000)));
      }

      const recent = await storage.getRecent(5);

      expect(recent).toHaveLength(5);
    });

    it('should return snapshots in newest-first order', async () => {
      await storage.save(createTestSnapshot('test-1', 'Intent 1', new Date('2024-01-15T10:00:00Z')));
      await storage.save(createTestSnapshot('test-2', 'Intent 2', new Date('2024-01-15T12:00:00Z')));
      await storage.save(createTestSnapshot('test-3', 'Intent 3', new Date('2024-01-15T11:00:00Z')));

      const recent = await storage.getRecent(3);

      expect(recent[0].id).toBe('test-2'); // Newest
      expect(recent[1].id).toBe('test-3');
      expect(recent[2].id).toBe('test-1'); // Oldest
    });

    it('should return all snapshots if limit exceeds count', async () => {
      await storage.save(createTestSnapshot('test-1', 'Intent 1'));
      await storage.save(createTestSnapshot('test-2', 'Intent 2'));

      const recent = await storage.getRecent(10);

      expect(recent).toHaveLength(2);
    });
  });

  // ============================================================================
  // Cleanup Tests
  // ============================================================================

  describe('cleanup', () => {
    it('should keep specified number of snapshots', async () => {
      for (let i = 0; i < 10; i++) {
        await storage.save(createTestSnapshot(`test-${i}`, `Intent ${i}`, new Date(Date.now() + i * 1000)));
      }

      const deleted = await storage.cleanup(5);

      expect(deleted).toBe(5);
      
      const remaining = await storage.list();
      expect(remaining).toHaveLength(5);
    });

    it('should keep newest snapshots', async () => {
      await storage.save(createTestSnapshot('test-1', 'Intent 1', new Date('2024-01-15T10:00:00Z')));
      await storage.save(createTestSnapshot('test-2', 'Intent 2', new Date('2024-01-15T12:00:00Z')));
      await storage.save(createTestSnapshot('test-3', 'Intent 3', new Date('2024-01-15T11:00:00Z')));

      await storage.cleanup(2);

      const remaining = await storage.list();
      expect(remaining).toHaveLength(2);
      expect(remaining.map(s => s.id)).toContain('test-2'); // Newest
      expect(remaining.map(s => s.id)).toContain('test-3'); // Second newest
      expect(remaining.map(s => s.id)).not.toContain('test-1'); // Oldest deleted
    });

    it('should not delete anything if count is below limit', async () => {
      await storage.save(createTestSnapshot('test-1', 'Intent 1'));
      await storage.save(createTestSnapshot('test-2', 'Intent 2'));

      const deleted = await storage.cleanup(5);

      expect(deleted).toBe(0);
      
      const remaining = await storage.list();
      expect(remaining).toHaveLength(2);
    });

    it('should use default keep count of 100', async () => {
      for (let i = 0; i < 150; i++) {
        await storage.save(createTestSnapshot(`test-${i}`, `Intent ${i}`));
      }

      const deleted = await storage.cleanup();

      expect(deleted).toBe(50);
      
      const remaining = await storage.list();
      expect(remaining).toHaveLength(100);
    });
  });

  // ============================================================================
  // Statistics Tests
  // ============================================================================

  describe('getStats', () => {
    it('should return statistics for empty storage', async () => {
      const stats = await storage.getStats();

      expect(stats.totalSnapshots).toBe(0);
      expect(stats.totalSize).toBe(0);
      expect(stats.oldestSnapshot).toBeNull();
      expect(stats.newestSnapshot).toBeNull();
    });

    it('should return correct snapshot count', async () => {
      await storage.save(createTestSnapshot('test-1', 'Intent 1'));
      await storage.save(createTestSnapshot('test-2', 'Intent 2'));
      await storage.save(createTestSnapshot('test-3', 'Intent 3'));

      const stats = await storage.getStats();

      expect(stats.totalSnapshots).toBe(3);
    });

    it('should calculate total size', async () => {
      await storage.save(createTestSnapshot('test-1', 'Intent 1'));
      await storage.save(createTestSnapshot('test-2', 'Intent 2'));

      const stats = await storage.getStats();

      expect(stats.totalSize).toBeGreaterThan(0);
    });

    it('should identify oldest and newest snapshots', async () => {
      const oldest = new Date('2024-01-15T10:00:00Z');
      const middle = new Date('2024-01-15T11:00:00Z');
      const newest = new Date('2024-01-15T12:00:00Z');

      await storage.save(createTestSnapshot('test-1', 'Intent 1', oldest));
      await storage.save(createTestSnapshot('test-2', 'Intent 2', middle));
      await storage.save(createTestSnapshot('test-3', 'Intent 3', newest));

      const stats = await storage.getStats();

      expect(stats.oldestSnapshot).toEqual(oldest);
      expect(stats.newestSnapshot).toEqual(newest);
    });
  });

  // ============================================================================
  // Factory Function Tests
  // ============================================================================

  describe('createIntentSnapshotStorage', () => {
    it('should create storage with default path', () => {
      const storage = createIntentSnapshotStorage();

      expect(storage).toBeInstanceOf(IntentSnapshotStorage);
    });

    it('should create storage with custom path', () => {
      const customPath = path.join(testDir, 'custom');
      const storage = createIntentSnapshotStorage(customPath);

      expect(storage).toBeInstanceOf(IntentSnapshotStorage);
    });
  });

  // ============================================================================
  // Edge Cases and Error Handling
  // ============================================================================

  describe('edge cases', () => {
    it('should handle snapshots with empty key points', async () => {
      const snapshot = createTestSnapshot('test-1', 'Intent 1');
      snapshot.extracted.keyPoints = [];

      await storage.save(snapshot);
      const loaded = await storage.load('test-1');

      expect(loaded?.extracted.keyPoints).toEqual([]);
    });

    it('should handle snapshots with empty entities', async () => {
      const snapshot = createTestSnapshot('test-1', 'Intent 1');
      snapshot.extracted.entities = [];

      await storage.save(snapshot);
      const loaded = await storage.load('test-1');

      expect(loaded?.extracted.entities).toEqual([]);
    });

    it('should handle very long intent text', async () => {
      const longIntent = 'A'.repeat(10000);
      const snapshot = createTestSnapshot('test-1', longIntent);

      await storage.save(snapshot);
      const loaded = await storage.load('test-1');

      expect(loaded?.extracted.intent).toBe(longIntent);
    });

    it('should handle special characters in intent', async () => {
      const specialIntent = 'Intent with "quotes" and \'apostrophes\' and \n newlines';
      const snapshot = createTestSnapshot('test-1', specialIntent);

      await storage.save(snapshot);
      const loaded = await storage.load('test-1');

      expect(loaded?.extracted.intent).toBe(specialIntent);
    });

    it('should handle concurrent save operations', async () => {
      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(storage.save(createTestSnapshot(`test-${i}`, `Intent ${i}`)));
      }

      await Promise.all(promises);

      const snapshots = await storage.list();
      expect(snapshots).toHaveLength(10);
    });
  });
});
