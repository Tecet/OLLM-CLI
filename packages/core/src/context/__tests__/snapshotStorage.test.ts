/**
 * Snapshot Storage Tests
 * 
 * Tests for snapshot storage service including property-based tests
 * for JSON format, corruption detection, and recovery.
 */

import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';

import fc from 'fast-check';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { createSnapshotStorage } from '../snapshotStorage.js';

import type { ContextSnapshot, Message } from '../types.js';

describe('SnapshotStorage', () => {
  let testDir: string;
  let storage: ReturnType<typeof createSnapshotStorage>;

  beforeEach(async () => {
    // Create temporary test directory
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'snapshot-test-'));
    storage = createSnapshotStorage(testDir);
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
  // Arbitraries for Property-Based Testing
  // ============================================================================

  // Generator for message role
  const arbRole = fc.constantFrom('system', 'user', 'assistant', 'tool') as fc.Arbitrary<'system' | 'user' | 'assistant' | 'tool'>;

  // Generator for message
  const arbMessage = fc.record({
    id: fc.uuid(),
    role: arbRole,
    content: fc.string({ minLength: 1, maxLength: 1000 }),
    timestamp: fc.date({ min: new Date('2020-01-01'), max: new Date('2030-01-01') }),
    tokenCount: fc.option(fc.integer({ min: 1, max: 10000 }), { nil: undefined })
  }) as fc.Arbitrary<Message>;

  // Generator for context snapshot
  const arbSnapshot = fc.record({
    id: fc.uuid(),
    sessionId: fc.uuid(),
    timestamp: fc.date({ min: new Date('2020-01-01'), max: new Date('2030-01-01') }),
    tokenCount: fc.integer({ min: 0, max: 100000 }),
    summary: fc.string({ minLength: 10, maxLength: 200 }),
    messages: fc.array(arbMessage, { minLength: 1, maxLength: 50 }),
    metadata: fc.record({
      model: fc.constantFrom('llama3.1:8b', 'mistral:7b', 'codellama:13b'),
      contextSize: fc.integer({ min: 2048, max: 131072 }),
      compressionRatio: fc.double({ min: 0.1, max: 1.0 })
    })
  }) as fc.Arbitrary<ContextSnapshot>;

  // ============================================================================
  // Unit Tests
  // ============================================================================

  describe('save and load', () => {
    it('should save and load a snapshot', async () => {
      const snapshot: ContextSnapshot = {
        id: 'test-snapshot-1',
        sessionId: 'test-session-1',
        timestamp: new Date('2024-01-15T10:30:00Z'),
        tokenCount: 5000,
        summary: 'Test snapshot summary',
        userMessages: [],
        archivedUserMessages: [],
        messages: [
          {
            id: 'msg-1',
            role: 'system',
            content: 'You are a helpful assistant',
            timestamp: new Date('2024-01-15T10:00:00Z')
          },
          {
            id: 'msg-2',
            role: 'user',
            content: 'Hello',
            timestamp: new Date('2024-01-15T10:15:00Z')
          }
        ],
        metadata: {
          model: 'llama3.1:8b',
          contextSize: 8192,
          compressionRatio: 0.8,
          totalUserMessages: 1,
          totalGoalsCompleted: 0,
          totalCheckpoints: 0
        }
      };

      await storage.save(snapshot);
      const loaded = await storage.load('test-snapshot-1');

      expect(loaded.id).toBe(snapshot.id);
      expect(loaded.sessionId).toBe(snapshot.sessionId);
      expect(loaded.tokenCount).toBe(snapshot.tokenCount);
      expect(loaded.summary).toBe(snapshot.summary);
      expect(loaded.messages).toHaveLength(2);
      expect(loaded.messages[0].content).toBe('You are a helpful assistant');
    });

    it('should throw error when loading non-existent snapshot', async () => {
      await expect(storage.load('non-existent')).rejects.toThrow('Snapshot not found');
    });
  });

  describe('list', () => {
    it('should list all snapshots for a session', async () => {
      const snapshot1: ContextSnapshot = {
        id: 'snap-1',
        sessionId: 'session-1',
        timestamp: new Date('2024-01-15T10:00:00Z'),
        tokenCount: 1000,
        summary: 'First snapshot',
        userMessages: [],
        archivedUserMessages: [],
        messages: [
          {
            id: 'msg-1',
            role: 'user',
            content: 'Test',
            timestamp: new Date()
          }
        ],
        metadata: {
          model: 'llama3.1:8b',
          contextSize: 8192,
          compressionRatio: 1.0,
          totalUserMessages: 1,
          totalGoalsCompleted: 0,
          totalCheckpoints: 0
        }
      };

      const snapshot2: ContextSnapshot = {
        ...snapshot1,
        id: 'snap-2',
        timestamp: new Date('2024-01-15T11:00:00Z'),
        summary: 'Second snapshot'
      };

      await storage.save(snapshot1);
      await storage.save(snapshot2);

      const list = await storage.list('session-1');
      expect(list).toHaveLength(2);
      expect(list.map(s => s.id)).toContain('snap-1');
      expect(list.map(s => s.id)).toContain('snap-2');
    });

    it('should return empty list for session with no snapshots', async () => {
      const list = await storage.list('empty-session');
      expect(list).toHaveLength(0);
    });
  });

  describe('delete', () => {
    it('should delete a snapshot', async () => {
      const snapshot: ContextSnapshot = {
        id: 'snap-to-delete',
        sessionId: 'session-1',
        timestamp: new Date(),
        tokenCount: 1000,
        summary: 'To be deleted',
        userMessages: [],
        archivedUserMessages: [],
        messages: [
          {
            id: 'msg-1',
            role: 'user',
            content: 'Test',
            timestamp: new Date()
          }
        ],
        metadata: {
          model: 'llama3.1:8b',
          contextSize: 8192,
          compressionRatio: 1.0,
          totalUserMessages: 1,
          totalGoalsCompleted: 0,
          totalCheckpoints: 0
        }
      };

      await storage.save(snapshot);
      expect(await storage.exists('snap-to-delete')).toBe(true);

      await storage.delete('snap-to-delete');
      expect(await storage.exists('snap-to-delete')).toBe(false);
    });

    it('should handle deleting non-existent snapshot', async () => {
      await expect(storage.delete('non-existent')).rejects.toThrow();
    });
  });

  describe('exists', () => {
    it('should return true for existing snapshot', async () => {
      const snapshot: ContextSnapshot = {
        id: 'exists-test',
        sessionId: 'session-1',
        timestamp: new Date(),
        tokenCount: 1000,
        summary: 'Exists test',
        userMessages: [],
        archivedUserMessages: [],
        messages: [
          {
            id: 'msg-1',
            role: 'user',
            content: 'Test',
            timestamp: new Date()
          }
        ],
        metadata: {
          model: 'llama3.1:8b',
          contextSize: 8192,
          compressionRatio: 1.0,
          totalUserMessages: 1,
          totalGoalsCompleted: 0,
          totalCheckpoints: 0
        }
      };

      await storage.save(snapshot);
      expect(await storage.exists('exists-test')).toBe(true);
    });

    it('should return false for non-existent snapshot', async () => {
      expect(await storage.exists('non-existent')).toBe(false);
    });
  });

  describe('verify', () => {
    it('should verify valid snapshot', async () => {
      const snapshot: ContextSnapshot = {
        id: 'verify-test',
        sessionId: 'session-1',
        timestamp: new Date(),
        tokenCount: 1000,
        summary: 'Verify test',
        userMessages: [],
        archivedUserMessages: [],
        messages: [
          {
            id: 'msg-1',
            role: 'user',
            content: 'Test',
            timestamp: new Date()
          }
        ],
        metadata: {
          model: 'llama3.1:8b',
          contextSize: 8192,
          compressionRatio: 1.0,
          totalUserMessages: 1,
          totalGoalsCompleted: 0,
          totalCheckpoints: 0
        }
      };

      await storage.save(snapshot);
      expect(await storage.verify('verify-test')).toBe(true);
    });

    it('should return false for corrupted snapshot', async () => {
      // Create a corrupted snapshot file
      const sessionDir = path.join(testDir, 'session-1', 'snapshots');
      await fs.mkdir(sessionDir, { recursive: true });
      await fs.writeFile(
        path.join(sessionDir, 'snapshot-corrupted.json'),
        '{ invalid json',
        'utf-8'
      );

      expect(await storage.verify('corrupted')).toBe(false);
    });
  });

  // ============================================================================
  // Property-Based Tests
  // ============================================================================

  describe('Property Tests', () => {
    /**
     * Property 39: Snapshot JSON Format
     * Feature: stage-04b-context-management, Property 39: Snapshot JSON Format
     * Validates: Requirements 10.1
     * 
     * For any saved snapshot, the file should be valid JSON with the expected structure
     */
    it('Property 39: saved snapshots should have valid JSON format', async () => {
      await fc.assert(
        fc.asyncProperty(arbSnapshot, async (snapshot) => {
          // Save the snapshot
          await storage.save(snapshot);

          // Read the file directly
          const snapshotPath = path.join(
            testDir,
            snapshot.sessionId,
            'snapshots',
            `snapshot-${snapshot.id}.json`
          );
          const content = await fs.readFile(snapshotPath, 'utf-8');

          // Parse JSON (should not throw)
          const parsed = JSON.parse(content);

          // Verify structure
          return (
            parsed.version !== undefined &&
            parsed.id === snapshot.id &&
            parsed.sessionId === snapshot.sessionId &&
            parsed.tokenCount === snapshot.tokenCount &&
            parsed.summary === snapshot.summary &&
            Array.isArray(parsed.messages) &&
            parsed.messages.length === snapshot.messages.length &&
            parsed.metadata !== undefined &&
            parsed.metadata.model === snapshot.metadata.model &&
            parsed.metadata.contextSize === snapshot.metadata.contextSize
          );
        }),
        { numRuns: 100 }
      );
    });

    /**
     * Property 40: Corruption Detection
     * Feature: stage-04b-context-management, Property 40: Corruption Detection
     * Validates: Requirements 10.3
     * 
     * For any corrupted snapshot file, loading should detect the corruption
     */
    it('Property 40: should detect corrupted snapshot files', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          fc.uuid(),
          fc.constantFrom(
            '{ invalid json',
            '{}',
            '{ "id": "test" }',
            '{ "id": "test", "sessionId": "test" }',
            '{ "id": "test", "sessionId": "test", "messages": null }'
          ),
          async (snapshotId, sessionId, corruptedContent) => {
            // Create corrupted snapshot file
            const sessionDir = path.join(testDir, sessionId, 'snapshots');
            await fs.mkdir(sessionDir, { recursive: true });
            const snapshotPath = path.join(sessionDir, `snapshot-${snapshotId}.json`);
            await fs.writeFile(snapshotPath, corruptedContent, 'utf-8');

            // Update index to include this snapshot
            const indexPath = path.join(sessionDir, 'snapshots-index.json');
            await fs.writeFile(
              indexPath,
              JSON.stringify({
                version: '1.0',
                snapshots: [
                  {
                    id: snapshotId,
                    sessionId: sessionId,
                    timestamp: new Date().toISOString(),
                    tokenCount: 1000,
                    summary: 'Test',
                    size: corruptedContent.length
                  }
                ]
              }),
              'utf-8'
            );

            // Try to load - should either throw or verify should return false
            try {
              await storage.load(snapshotId);
              // If load succeeds, verify should still detect corruption
              const isValid = await storage.verify(snapshotId);
              return !isValid; // Should be invalid
            } catch {
              // Load threw error - corruption detected
              return true;
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property 41: Corrupted File Recovery
     * Feature: stage-04b-context-management, Property 41: Corrupted File Recovery
     * Validates: Requirements 10.6
     * 
     * For any set of snapshots including corrupted files, the system should
     * skip corrupted files and successfully load valid snapshots
     */
    it('Property 41: should skip corrupted files and load valid snapshots', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(), // sessionId
          fc.array(arbSnapshot, { minLength: 2, maxLength: 5 }), // valid snapshots
          fc.integer({ min: 0, max: 2 }), // number of corrupted files to add
          async (sessionId, validSnapshots, numCorrupted) => {
            // Save valid snapshots
            for (const snapshot of validSnapshots) {
              const modifiedSnapshot = { ...snapshot, sessionId };
              await storage.save(modifiedSnapshot);
            }

            // Add corrupted files
            const sessionDir = path.join(testDir, sessionId, 'snapshots');
            for (let i = 0; i < numCorrupted; i++) {
              const corruptedPath = path.join(sessionDir, `snapshot-corrupted-${i}.json`);
              await fs.writeFile(corruptedPath, '{ invalid json', 'utf-8');
            }

            // List snapshots - should return only valid ones
            const list = await storage.list(sessionId);

            // Should have all valid snapshots
            return list.length === validSnapshots.length;
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
