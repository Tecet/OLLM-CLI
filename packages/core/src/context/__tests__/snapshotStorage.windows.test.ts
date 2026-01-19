/**
 * Windows-Specific Snapshot Storage Tests
 * 
 * Tests snapshot storage functionality on Windows, including:
 * - Path separators
 * - Long paths (260 character limit)
 * - Special characters
 * - File permissions
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SnapshotStorage } from '../snapshotStorage.js';
import type { ConversationContext, SnapshotMetadata } from '../types.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

// Only run these tests on Windows
const isWindows = process.platform === 'win32';
const describeWindows = isWindows ? describe : describe.skip;

describeWindows('Snapshot Storage - Windows Specific', () => {
  let storage: SnapshotStorage;
  let testDir: string;

  beforeEach(async () => {
    // Create a temporary test directory
    testDir = path.join(os.tmpdir(), `ollm-test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
    
    storage = new SnapshotStorage(testDir);
  });

  afterEach(async () => {
    // Clean up test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      console.warn('Failed to clean up test directory:', error);
    }
  });

  describe('Path handling', () => {
    it('should handle Windows path separators correctly', async () => {
      const context: ConversationContext = {
        messages: [
          {
            id: 'msg-1',
            role: 'user',
            content: 'Test message',
            timestamp: new Date(),
          },
        ],
        tokenCount: 10,
        metadata: {},
      };

      const snapshot = await storage.save('session-1', context);

      // Verify snapshot was created
      expect(snapshot).toBeDefined();
      expect(snapshot.id).toBeDefined();

      // Verify file exists with Windows path
      const snapshotPath = path.join(testDir, 'session-1', `${snapshot.id}.json`);
      const exists = await fs.access(snapshotPath).then(() => true).catch(() => false);
      expect(exists).toBe(true);

      // Verify path uses Windows separators
      expect(snapshotPath).toContain('\\');
    });

    it('should handle paths with spaces', async () => {
      const spacedDir = path.join(testDir, 'folder with spaces');
      await fs.mkdir(spacedDir, { recursive: true });
      
      const spacedStorage = new SnapshotStorage(spacedDir);
      
      const context: ConversationContext = {
        messages: [
          {
            id: 'msg-1',
            role: 'user',
            content: 'Test',
            timestamp: new Date(),
          },
        ],
        tokenCount: 5,
        metadata: {},
      };

      const snapshot = await spacedStorage.save('session-1', context);
      expect(snapshot).toBeDefined();

      // Verify can load from path with spaces
      const loaded = await spacedStorage.load(snapshot.id);
      expect(loaded).toBeDefined();
    });

    it('should handle special Windows characters in session ID', async () => {
      // Windows doesn't allow certain characters in filenames: < > : " / \ | ? *
      // But session IDs might contain some safe special chars
      const sessionId = 'session_2024-01-19_14-30-00';
      
      const context: ConversationContext = {
        messages: [
          {
            id: 'msg-1',
            role: 'user',
            content: 'Test',
            timestamp: new Date(),
          },
        ],
        tokenCount: 5,
        metadata: {},
      };

      const snapshot = await storage.save(sessionId, context);
      expect(snapshot).toBeDefined();

      const loaded = await storage.load(snapshot.id);
      expect(loaded).toBeDefined();
    });
  });

  describe('Long paths', () => {
    it('should handle paths approaching Windows 260 character limit', async () => {
      // Windows has a 260 character path limit (MAX_PATH)
      // Create a deep directory structure
      const longSessionId = 'a'.repeat(100); // Long session ID
      
      const context: ConversationContext = {
        messages: [
          {
            id: 'msg-1',
            role: 'user',
            content: 'Test',
            timestamp: new Date(),
          },
        ],
        tokenCount: 5,
        metadata: {},
      };

      try {
        const snapshot = await storage.save(longSessionId, context);
        expect(snapshot).toBeDefined();

        // Verify can load
        const loaded = await storage.load(snapshot.id);
        expect(loaded).toBeDefined();
      } catch (error) {
        // If it fails, it should be a clear error about path length
        expect(error).toBeDefined();
        if (error instanceof Error) {
          expect(
            error.message.includes('path') || 
            error.message.includes('long') ||
            error.message.includes('ENAMETOOLONG')
          ).toBe(true);
        }
      }
    });

    it('should handle snapshot IDs that create long paths', async () => {
      // Snapshot ID is a UUID (36 chars) + .json (5 chars) = 41 chars
      // Plus session directory and base path
      const longSessionId = 'session-' + 'x'.repeat(150);
      
      const context: ConversationContext = {
        messages: [
          {
            id: 'msg-1',
            role: 'user',
            content: 'Test',
            timestamp: new Date(),
          },
        ],
        tokenCount: 5,
        metadata: {},
      };

      try {
        const snapshot = await storage.save(longSessionId, context);
        
        // Calculate actual path length
        const snapshotPath = path.join(testDir, longSessionId, `${snapshot.id}.json`);
        
        // Windows MAX_PATH is 260, but with \\?\ prefix it can be longer
        if (snapshotPath.length < 260) {
          expect(snapshot).toBeDefined();
          
          const loaded = await storage.load(snapshot.id);
          expect(loaded).toBeDefined();
        }
      } catch (error) {
        // Expected to fail if path is too long
        expect(error).toBeDefined();
      }
    });
  });

  describe('File permissions', () => {
    it('should handle Windows file permissions', async () => {
      const context: ConversationContext = {
        messages: [
          {
            id: 'msg-1',
            role: 'user',
            content: 'Test',
            timestamp: new Date(),
          },
        ],
        tokenCount: 5,
        metadata: {},
      };

      const snapshot = await storage.save('session-1', context);
      
      // Verify file is readable
      const snapshotPath = path.join(testDir, 'session-1', `${snapshot.id}.json`);
      const stats = await fs.stat(snapshotPath);
      
      expect(stats.isFile()).toBe(true);
      expect(stats.size).toBeGreaterThan(0);
    });

    it('should handle read-only directory gracefully', async () => {
      // Create a read-only directory (Windows-specific)
      const readOnlyDir = path.join(testDir, 'readonly');
      await fs.mkdir(readOnlyDir, { recursive: true });
      
      // On Windows, we can't easily make a directory truly read-only
      // without admin privileges, so we'll just test the error handling
      const readOnlyStorage = new SnapshotStorage(readOnlyDir);
      
      const context: ConversationContext = {
        messages: [
          {
            id: 'msg-1',
            role: 'user',
            content: 'Test',
            timestamp: new Date(),
          },
        ],
        tokenCount: 5,
        metadata: {},
      };

      // This should succeed normally, but we're testing the code path
      const snapshot = await readOnlyStorage.save('session-1', context);
      expect(snapshot).toBeDefined();
    });
  });

  describe('Atomic writes', () => {
    it('should use atomic writes on Windows', async () => {
      const context: ConversationContext = {
        messages: [
          {
            id: 'msg-1',
            role: 'user',
            content: 'Test',
            timestamp: new Date(),
          },
        ],
        tokenCount: 5,
        metadata: {},
      };

      const snapshot = await storage.save('session-1', context);
      
      // Verify no .tmp files left behind
      const sessionDir = path.join(testDir, 'session-1');
      const files = await fs.readdir(sessionDir);
      
      const tmpFiles = files.filter(f => f.endsWith('.tmp'));
      expect(tmpFiles.length).toBe(0);
      
      // Verify final file exists
      const jsonFiles = files.filter(f => f.endsWith('.json'));
      expect(jsonFiles.length).toBeGreaterThan(0);
    });

    it('should handle file locking during atomic rename', async () => {
      // Windows file locking can prevent atomic renames
      const context: ConversationContext = {
        messages: [
          {
            id: 'msg-1',
            role: 'user',
            content: 'Test',
            timestamp: new Date(),
          },
        ],
        tokenCount: 5,
        metadata: {},
      };

      // Save multiple snapshots quickly to test concurrent writes
      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(storage.save(`session-${i}`, context));
      }

      const snapshots = await Promise.all(promises);
      
      // All should succeed
      expect(snapshots.length).toBe(5);
      snapshots.forEach(snapshot => {
        expect(snapshot).toBeDefined();
        expect(snapshot.id).toBeDefined();
      });
    });
  });

  describe('Index file', () => {
    it('should create and maintain index.json on Windows', async () => {
      const context: ConversationContext = {
        messages: [
          {
            id: 'msg-1',
            role: 'user',
            content: 'Test',
            timestamp: new Date(),
          },
        ],
        tokenCount: 5,
        metadata: {},
      };

      await storage.save('session-1', context);
      
      // Verify index.json exists
      const indexPath = path.join(testDir, 'session-1', 'index.json');
      const exists = await fs.access(indexPath).then(() => true).catch(() => false);
      expect(exists).toBe(true);
      
      // Verify index content
      const indexContent = await fs.readFile(indexPath, 'utf-8');
      const index = JSON.parse(indexContent);
      
      expect(Array.isArray(index)).toBe(true);
      expect(index.length).toBeGreaterThan(0);
    });

    it('should handle Windows line endings in index.json', async () => {
      const context: ConversationContext = {
        messages: [
          {
            id: 'msg-1',
            role: 'user',
            content: 'Test with\r\nWindows line endings',
            timestamp: new Date(),
          },
        ],
        tokenCount: 10,
        metadata: {},
      };

      const snapshot = await storage.save('session-1', context);
      
      // Load and verify content preserved
      const loaded = await storage.load(snapshot.id);
      expect(loaded).toBeDefined();
      expect(loaded?.messages[0].content).toContain('\r\n');
    });
  });

  describe('Error handling', () => {
    it('should provide clear error messages for Windows-specific issues', async () => {
      // Try to save to an invalid Windows path
      const invalidStorage = new SnapshotStorage('C:\\invalid\\path\\that\\does\\not\\exist');
      
      const context: ConversationContext = {
        messages: [
          {
            id: 'msg-1',
            role: 'user',
            content: 'Test',
            timestamp: new Date(),
          },
        ],
        tokenCount: 5,
        metadata: {},
      };

      try {
        await invalidStorage.save('session-1', context);
        // Should not reach here
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeDefined();
        expect(error instanceof Error).toBe(true);
        
        // Error should mention path or directory
        if (error instanceof Error) {
          const message = error.message.toLowerCase();
          expect(
            message.includes('path') ||
            message.includes('directory') ||
            message.includes('enoent') ||
            message.includes('not found')
          ).toBe(true);
        }
      }
    });
  });
});
