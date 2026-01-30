/**
 * Session Migration Tests
 *
 * Tests for session migration from legacy format to new storage layer format.
 */

import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import {
  migrateLegacySession,
  migrateLegacyCheckpoint,
  validateMigratedSession,
  migrateAllSessions,
  rollbackMigration,
} from '../sessionMigration.js';

import type { Message } from '../../types.js';

// ============================================================================
// Test Fixtures
// ============================================================================

const createLegacySession = () => ({
  sessionId: 'test-session-123',
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
      content: 'Hi there!',
      timestamp: new Date('2024-01-01T10:00:01Z'),
    },
    {
      id: 'msg-3',
      role: 'user' as const,
      content: 'How are you?',
      timestamp: new Date('2024-01-01T10:00:02Z'),
    },
  ] as Message[],
  metadata: {
    checkpoints: [
      {
        id: 'ckpt-1',
        timestamp: Date.parse('2024-01-01T10:00:00Z'),
        summary: 'User greeted, assistant responded',
        messageIds: ['msg-1', 'msg-2'],
        tokenCount: 50,
        level: 3,
      },
    ],
    compressionCount: 1,
    totalTokens: 150,
  },
  startTime: Date.parse('2024-01-01T10:00:00Z'),
  lastUpdate: Date.parse('2024-01-01T10:00:02Z'),
});

const createLegacyCheckpoint = () => ({
  id: 'ckpt-test',
  timestamp: Date.now(),
  summary: 'Test checkpoint summary',
  messageIds: ['msg-1', 'msg-2', 'msg-3'],
  tokenCount: 100,
  level: 2,
});

// ============================================================================
// Unit Tests
// ============================================================================

describe('sessionMigration - Unit Tests', () => {
  describe('migrateLegacySession', () => {
    it('should migrate a legacy session to new format', () => {
      const legacySession = createLegacySession();
      const result = migrateLegacySession(legacySession);

      expect(result.sessionId).toBe(legacySession.sessionId);
      expect(result.messages).toHaveLength(3);
      expect(result.checkpointRecords).toHaveLength(1);
      expect(result.metadata.totalMessages).toBe(3);
      expect(result.metadata.compressionCount).toBe(1);
    });

    it('should handle session without checkpoints', () => {
      const legacySession = {
        ...createLegacySession(),
        metadata: undefined,
      };

      const result = migrateLegacySession(legacySession);

      expect(result.checkpointRecords).toHaveLength(0);
      expect(result.metadata.compressionCount).toBe(0);
    });

    it('should preserve all messages', () => {
      const legacySession = createLegacySession();
      const result = migrateLegacySession(legacySession);

      expect(result.messages).toEqual(legacySession.messages);
    });

    it('should calculate total tokens if not provided', () => {
      const legacySession = {
        ...createLegacySession(),
        metadata: {
          ...createLegacySession().metadata,
          totalTokens: undefined,
        },
      };

      const result = migrateLegacySession(legacySession);

      expect(result.metadata.totalTokens).toBeGreaterThan(0);
    });

    it('should use current time if timestamps missing', () => {
      const legacySession = {
        ...createLegacySession(),
        startTime: undefined,
        lastUpdate: undefined,
      };

      const result = migrateLegacySession(legacySession);

      expect(result.metadata.startTime).toBeGreaterThan(0);
      expect(result.metadata.lastUpdate).toBeGreaterThan(0);
    });
  });

  describe('migrateLegacyCheckpoint', () => {
    it('should migrate a legacy checkpoint to new format', () => {
      const legacyCheckpoint = createLegacyCheckpoint();
      const result = migrateLegacyCheckpoint(legacyCheckpoint, 1);

      expect(result.id).toBe(legacyCheckpoint.id);
      expect(result.summary).toBe(legacyCheckpoint.summary);
      expect(result.tokenCount).toBe(legacyCheckpoint.tokenCount);
      expect(result.compressionLevel).toBe(2);
      expect(result.compressionNumber).toBe(1);
    });

    it('should generate ID if missing', () => {
      const legacyCheckpoint = {
        ...createLegacyCheckpoint(),
        id: undefined,
      };

      const result = migrateLegacyCheckpoint(legacyCheckpoint, 0);

      expect(result.id).toBeDefined();
      expect(result.id).toMatch(/^[0-9a-f-]{36}$/); // UUID format
    });

    it('should use default summary if missing', () => {
      const legacyCheckpoint = {
        ...createLegacyCheckpoint(),
        summary: undefined,
      };

      const result = migrateLegacyCheckpoint(legacyCheckpoint, 0);

      expect(result.summary).toContain('Migrated checkpoint');
    });

    it('should default to level 3 if level missing', () => {
      const legacyCheckpoint = {
        ...createLegacyCheckpoint(),
        level: undefined,
      };

      const result = migrateLegacyCheckpoint(legacyCheckpoint, 0);

      expect(result.compressionLevel).toBe(3);
    });
  });

  describe('validateMigratedSession', () => {
    it('should validate a correct session', () => {
      const legacySession = createLegacySession();
      const migratedSession = migrateLegacySession(legacySession);
      const errors = validateMigratedSession(migratedSession);

      expect(errors).toHaveLength(0);
    });

    it('should detect missing sessionId', () => {
      const session = {
        ...migrateLegacySession(createLegacySession()),
        sessionId: '',
      };

      const errors = validateMigratedSession(session);

      expect(errors).toContain('Missing sessionId');
    });

    it('should detect invalid messages array', () => {
      const session = {
        ...migrateLegacySession(createLegacySession()),
        messages: null as any,
      };

      const errors = validateMigratedSession(session);

      expect(errors).toContain('Messages is not an array');
    });

    it('should detect missing metadata', () => {
      const session = {
        ...migrateLegacySession(createLegacySession()),
        metadata: null as any,
      };

      const errors = validateMigratedSession(session);

      expect(errors).toContain('Missing metadata');
    });

    it('should detect inconsistent message count', () => {
      const session = migrateLegacySession(createLegacySession());
      session.metadata.totalMessages = 999;

      const errors = validateMigratedSession(session);

      expect(errors.some((e) => e.includes('totalMessages'))).toBe(true);
    });
  });
});

// ============================================================================
// Integration Tests
// ============================================================================

describe('sessionMigration - Integration Tests', () => {
  let tempDir: string;
  let sourceDir: string;
  let targetDir: string;
  let backupDir: string;

  beforeEach(async () => {
    // Create temporary directories
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'session-migration-test-'));
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
    } catch (_error) {
      // Ignore cleanup errors
    }
  });

  describe('migrateAllSessions', () => {
    it('should migrate all sessions in a directory', async () => {
      // Create test sessions
      const session1 = createLegacySession();
      const session2 = { ...createLegacySession(), sessionId: 'test-session-456' };

      await fs.writeFile(path.join(sourceDir, 'session1.json'), JSON.stringify(session1));
      await fs.writeFile(path.join(sourceDir, 'session2.json'), JSON.stringify(session2));

      // Run migration
      const result = await migrateAllSessions({
        sourceDir,
        targetDir,
        dryRun: false,
        validate: true,
        verbose: false,
      });

      expect(result.success).toBe(true);
      expect(result.sessionsMigrated).toBe(2);
      expect(result.sessionsFailed).toBe(0);

      // Verify migrated files exist
      const files = await fs.readdir(targetDir);
      expect(files).toHaveLength(2);
    });

    it('should perform dry run without writing files', async () => {
      const session = createLegacySession();
      await fs.writeFile(path.join(sourceDir, 'session.json'), JSON.stringify(session));

      const result = await migrateAllSessions({
        sourceDir,
        targetDir,
        dryRun: true,
        validate: true,
        verbose: false,
      });

      expect(result.success).toBe(true);
      expect(result.dryRun).toBe(true);
      expect(result.sessionsMigrated).toBe(1);

      // Verify no files written
      const files = await fs.readdir(targetDir);
      expect(files).toHaveLength(0);
    });

    it('should create backups when requested', async () => {
      const session = createLegacySession();
      await fs.writeFile(path.join(sourceDir, 'session.json'), JSON.stringify(session));

      const result = await migrateAllSessions({
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
      // Create invalid session (missing required fields)
      const invalidSession = {
        sessionId: '',
        messages: null,
      };

      await fs.writeFile(path.join(sourceDir, 'invalid.json'), JSON.stringify(invalidSession));

      const result = await migrateAllSessions({
        sourceDir,
        targetDir,
        dryRun: false,
        validate: true,
        verbose: false,
      });

      expect(result.success).toBe(false);
      expect(result.sessionsFailed).toBe(1);
      expect(result.errors).toHaveLength(1);
    });

    it('should handle missing source directory', async () => {
      const result = await migrateAllSessions({
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
      const session = createLegacySession();
      await fs.writeFile(path.join(sourceDir, 'session.json'), JSON.stringify(session));
      await fs.writeFile(path.join(sourceDir, 'readme.txt'), 'This is not a session file');

      const result = await migrateAllSessions({
        sourceDir,
        targetDir,
        dryRun: false,
        validate: true,
        verbose: false,
      });

      expect(result.success).toBe(true);
      expect(result.sessionsMigrated).toBe(1);
    });
  });

  describe('rollbackMigration', () => {
    it('should restore sessions from backup', async () => {
      // Create backup
      const session = createLegacySession();
      await fs.writeFile(path.join(backupDir, 'session.json'), JSON.stringify(session));

      // Run rollback
      const result = await rollbackMigration({
        sourceDir,
        targetDir,
        backupDir,
        dryRun: false,
        verbose: false,
      });

      expect(result.success).toBe(true);
      expect(result.sessionsMigrated).toBe(1);

      // Verify file restored
      const files = await fs.readdir(sourceDir);
      expect(files).toHaveLength(1);
    });

    it('should perform dry run rollback', async () => {
      const session = createLegacySession();
      await fs.writeFile(path.join(backupDir, 'session.json'), JSON.stringify(session));

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
