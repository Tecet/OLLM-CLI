/**
 * Snapshot Migration Tests
 * 
 * Tests for snapshot migration from legacy format to new storage layer format.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

import {
  migrateLegacySnapshot,
  validateMigratedSnapshot,
  migrateAllSnapshots,
  rollbackMigration,
  type SnapshotMigrationOptions,
} from '../snapshotMigration.js';
import type { Message } from '../../types.js';
import type { SnapshotData } from '../../types/storageTypes.js';

// ============================================================================
// Test Fixtures
// ============================================================================

const createLegacySnapshot = () => ({
  id: 'snap-123',
  sessionId: 'session-456',
  timestamp: Date.parse('2024-01-01T10:00:00Z'),
  messages: [
    {
      id: 'msg-1',
      role: 'user' as const,
      content: 'Hello',
      timestamp: new Date('2024-01-01T10:00:00Z'),
    },
    {
      id: 'msg-2',
      role: 'assistant' as const,
      content: 'Hi!',
      timestamp: new Date('2024-01-01T10:00:01Z'),
    },
  ] as Message[],
  userMessages: [
    {
      id: 'msg-1',
      role: 'user' as const,
      content: 'Hello',
      timestamp: new Date('2024-01-01T10:00:00Z'),
    },
  ] as Message[],
  metadata: {
    checkpoints: [
      {
        id: 'ckpt-1',
        timestamp: Date.parse('2024-01-01T10:00:00Z'),
        summary: 'Test checkpoint',
        messageIds: ['msg-1'],
        tokenCount: 25,
        level: 3,
      },
    ],
    goals: [],
  },
  purpose: 'recovery',
});

// ============================================================================
// Unit Tests
// ============================================================================

describe('snapshotMigration - Unit Tests', () => {
  describe('migrateLegacySnapshot', () => {
    it('should migrate a legacy snapshot to new format', () => {
      const legacySnapshot = createLegacySnapshot();
      const result = migrateLegacySnapshot(legacySnapshot);

      expect(result.id).toBe(legacySnapshot.id);
      expect(result.sessionId).toBe(legacySnapshot.sessionId);
      expect(result.timestamp).toBe(legacySnapshot.timestamp);
      expect(result.purpose).toBe('recovery');
      expect(result.conversationState.messages).toHaveLength(2);
      expect(result.conversationState.checkpoints).toHaveLength(1);
    });

    it('should combine messages and userMessages', () => {
      const legacySnapshot = createLegacySnapshot();
      const result = migrateLegacySnapshot(legacySnapshot);

      // Should have 2 messages (msg-1 appears in both but should be deduplicated)
      expect(result.conversationState.messages).toHaveLength(2);
    });

    it('should handle snapshot without userMessages', () => {
      const legacySnapshot = {
        ...createLegacySnapshot(),
        userMessages: undefined,
      };

      const result = migrateLegacySnapshot(legacySnapshot);

      expect(result.conversationState.messages).toHaveLength(2);
    });

    it('should handle snapshot without checkpoints', () => {
      const legacySnapshot = {
        ...createLegacySnapshot(),
        metadata: {
          goals: [],
        },
      };

      const result = migrateLegacySnapshot(legacySnapshot);

      expect(result.conversationState.checkpoints).toHaveLength(0);
    });

    it('should generate ID if missing', () => {
      const legacySnapshot = {
        ...createLegacySnapshot(),
        id: undefined,
      };

      const result = migrateLegacySnapshot(legacySnapshot);

      expect(result.id).toBeDefined();
      expect(result.id).toMatch(/^[0-9a-f-]{36}$/); // UUID format
    });

    it('should default to recovery purpose if not specified', () => {
      const legacySnapshot = {
        ...createLegacySnapshot(),
        purpose: undefined,
      };

      const result = migrateLegacySnapshot(legacySnapshot);

      expect(result.purpose).toBe('recovery');
    });

    it('should preserve valid purpose values', () => {
      const purposes: Array<'recovery' | 'rollback' | 'emergency'> = [
        'recovery',
        'rollback',
        'emergency',
      ];

      for (const purpose of purposes) {
        const legacySnapshot = {
          ...createLegacySnapshot(),
          purpose,
        };

        const result = migrateLegacySnapshot(legacySnapshot);

        expect(result.purpose).toBe(purpose);
      }
    });

    it('should sort messages by timestamp', () => {
      const legacySnapshot = {
        ...createLegacySnapshot(),
        messages: [
          {
            id: 'msg-2',
            role: 'assistant' as const,
            content: 'Second',
            timestamp: new Date('2024-01-01T10:00:02Z'),
          },
          {
            id: 'msg-1',
            role: 'user' as const,
            content: 'First',
            timestamp: new Date('2024-01-01T10:00:01Z'),
          },
        ] as Message[],
      };

      const result = migrateLegacySnapshot(legacySnapshot);

      expect(result.conversationState.messages[0].id).toBe('msg-1');
      expect(result.conversationState.messages[1].id).toBe('msg-2');
    });
  });

  describe('validateMigratedSnapshot', () => {
    it('should validate a correct snapshot', () => {
      const legacySnapshot = createLegacySnapshot();
      const migratedSnapshot = migrateLegacySnapshot(legacySnapshot);
      const errors = validateMigratedSnapshot(migratedSnapshot);

      expect(errors).toHaveLength(0);
    });

    it('should detect missing id', () => {
      const snapshot = {
        ...migrateLegacySnapshot(createLegacySnapshot()),
        id: '',
      };

      const errors = validateMigratedSnapshot(snapshot);

      expect(errors).toContain('Missing id');
    });

    it('should detect missing sessionId', () => {
      const snapshot = {
        ...migrateLegacySnapshot(createLegacySnapshot()),
        sessionId: '',
      };

      const errors = validateMigratedSnapshot(snapshot);

      expect(errors).toContain('Missing sessionId');
    });

    it('should detect invalid timestamp', () => {
      const snapshot = {
        ...migrateLegacySnapshot(createLegacySnapshot()),
        timestamp: 'invalid' as any,
      };

      const errors = validateMigratedSnapshot(snapshot);

      expect(errors).toContain('Invalid timestamp');
    });

    it('should detect missing conversationState', () => {
      const snapshot = {
        ...migrateLegacySnapshot(createLegacySnapshot()),
        conversationState: null as any,
      };

      const errors = validateMigratedSnapshot(snapshot);

      expect(errors).toContain('Missing conversationState');
    });

    it('should detect invalid messages array', () => {
      const snapshot = migrateLegacySnapshot(createLegacySnapshot());
      snapshot.conversationState.messages = null as any;

      const errors = validateMigratedSnapshot(snapshot);

      expect(errors).toContain('conversationState.messages is not an array');
    });

    it('should detect invalid purpose', () => {
      const snapshot = {
        ...migrateLegacySnapshot(createLegacySnapshot()),
        purpose: 'invalid' as any,
      };

      const errors = validateMigratedSnapshot(snapshot);

      expect(errors.some(e => e.includes('Invalid purpose'))).toBe(true);
    });
  });
});

// ============================================================================
// Integration Tests
// ============================================================================

describe('snapshotMigration - Integration Tests', () => {
  let tempDir: string;
  let sourceDir: string;
  let targetDir: string;
  let backupDir: string;

  beforeEach(async () => {
    // Create temporary directories
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'snapshot-migration-test-'));
    sourceDir = path.join(tempDir, 'source');
    targetDir = path.join(tempDir, 'target');
    backupDir = path.join(tempDir, 'backup');

    await fs.mkdir(sourceDir, { recursive: true });
    await fs.mkdir(targetDir, { recursive: true });
    await fs.mkdir(backupDir, { recursive: true });
  });

  afterEach(async () => {
    // Clean up temporary directories
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('migrateAllSnapshots', () => {
    it('should migrate all snapshots in a directory', async () => {
      // Create test snapshots
      const snapshot1 = createLegacySnapshot();
      const snapshot2 = { ...createLegacySnapshot(), id: 'snap-456' };

      await fs.writeFile(
        path.join(sourceDir, 'snapshot1.json'),
        JSON.stringify(snapshot1)
      );
      await fs.writeFile(
        path.join(sourceDir, 'snapshot2.json'),
        JSON.stringify(snapshot2)
      );

      // Run migration
      const result = await migrateAllSnapshots({
        sourceDir,
        targetDir,
        dryRun: false,
        validate: true,
        verbose: true, // Enable verbose to see errors
      });

      // Log errors if any
      if (!result.success) {
        console.log('Migration errors:', result.errors);
      }

      expect(result.success).toBe(true);
      expect(result.snapshotsMigrated).toBe(2);
      expect(result.snapshotsFailed).toBe(0);

      // Verify migrated files exist
      const files = await fs.readdir(targetDir);
      expect(files).toHaveLength(2);
    });

    it('should perform dry run without writing files', async () => {
      const snapshot = createLegacySnapshot();
      await fs.writeFile(
        path.join(sourceDir, 'snapshot.json'),
        JSON.stringify(snapshot)
      );

      const result = await migrateAllSnapshots({
        sourceDir,
        targetDir,
        dryRun: true,
        validate: true,
        verbose: false,
      });

      expect(result.success).toBe(true);
      expect(result.dryRun).toBe(true);
      expect(result.snapshotsMigrated).toBe(1);

      // Verify no files written
      const files = await fs.readdir(targetDir);
      expect(files).toHaveLength(0);
    });

    it('should create backups when requested', async () => {
      const snapshot = createLegacySnapshot();
      await fs.writeFile(
        path.join(sourceDir, 'snapshot.json'),
        JSON.stringify(snapshot)
      );

      const result = await migrateAllSnapshots({
        sourceDir,
        targetDir,
        dryRun: false,
        createBackup: true,
        backupDir,
        validate: true,
        verbose: false,
      });

      expect(result.success).toBe(true);

      // Verify backup exists
      const backupFiles = await fs.readdir(backupDir);
      expect(backupFiles).toHaveLength(1);
    });

    it('should handle validation failures', async () => {
      // Create invalid snapshot
      const invalidSnapshot = {
        id: '',
        sessionId: '',
        timestamp: 'invalid',
      };

      await fs.writeFile(
        path.join(sourceDir, 'invalid.json'),
        JSON.stringify(invalidSnapshot)
      );

      const result = await migrateAllSnapshots({
        sourceDir,
        targetDir,
        dryRun: false,
        validate: true,
        verbose: false,
      });

      expect(result.success).toBe(false);
      expect(result.snapshotsFailed).toBe(1);
      expect(result.errors).toHaveLength(1);
    });

    it('should handle missing source directory', async () => {
      const result = await migrateAllSnapshots({
        sourceDir: '/nonexistent/directory',
        targetDir,
        dryRun: false,
        validate: true,
        verbose: false,
      });

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should skip non-JSON files', async () => {
      const snapshot = createLegacySnapshot();
      await fs.writeFile(
        path.join(sourceDir, 'snapshot.json'),
        JSON.stringify(snapshot)
      );
      await fs.writeFile(
        path.join(sourceDir, 'readme.txt'),
        'This is not a snapshot file'
      );

      const result = await migrateAllSnapshots({
        sourceDir,
        targetDir,
        dryRun: false,
        validate: true,
        verbose: false,
      });

      expect(result.success).toBe(true);
      expect(result.snapshotsMigrated).toBe(1);
    });
  });

  describe('rollbackMigration', () => {
    it('should restore snapshots from backup', async () => {
      // Create backup
      const snapshot = createLegacySnapshot();
      await fs.writeFile(
        path.join(backupDir, 'snapshot.json'),
        JSON.stringify(snapshot)
      );

      // Run rollback
      const result = await rollbackMigration({
        sourceDir,
        targetDir,
        backupDir,
        dryRun: false,
        verbose: false,
      });

      expect(result.success).toBe(true);
      expect(result.snapshotsMigrated).toBe(1);

      // Verify file restored
      const files = await fs.readdir(sourceDir);
      expect(files).toHaveLength(1);
    });

    it('should perform dry run rollback', async () => {
      const snapshot = createLegacySnapshot();
      await fs.writeFile(
        path.join(backupDir, 'snapshot.json'),
        JSON.stringify(snapshot)
      );

      const result = await rollbackMigration({
        sourceDir,
        targetDir,
        backupDir,
        dryRun: true,
        verbose: false,
      });

      expect(result.success).toBe(true);
      expect(result.dryRun).toBe(true);

      // Verify no files restored
      const files = await fs.readdir(sourceDir);
      expect(files).toHaveLength(0);
    });

    it('should handle missing backup directory', async () => {
      const result = await rollbackMigration({
        sourceDir,
        targetDir,
        backupDir: '/nonexistent/backup',
        dryRun: false,
        verbose: false,
      });

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });
});
