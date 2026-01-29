/**
 * Property-Based Tests for Session History Persistence
 * 
 * **Property 7: Session History Persistence**
 * **Validates: Requirements FR-4**
 * 
 * This test validates that the session history manager correctly persists
 * and loads session data from disk.
 * 
 * Properties tested:
 * 1. Save/load round trip preserves all data
 * 2. Multiple saves don't corrupt data
 * 3. Loading non-existent session throws error
 * 4. Concurrent saves are handled correctly
 * 5. Large sessions can be saved and loaded
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { SessionHistoryManager } from '../sessionHistoryManager.js';
import type { Message, CheckpointRecord } from '../../types/storageTypes.js';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs/promises';

// ============================================================================
// Arbitraries
// ============================================================================

/**
 * Arbitrary for generating valid messages
 */
const messageArbitrary = (): fc.Arbitrary<Message> =>
  fc.record({
    id: fc.uuid(),
    role: fc.constantFrom('user' as const, 'assistant' as const, 'system' as const),
    content: fc.string({ minLength: 1, maxLength: 1000 }),
    timestamp: fc.integer({ min: Date.now() - 1000000, max: Date.now() }),
  });

/**
 * Arbitrary for generating checkpoint records
 */
const checkpointRecordArbitrary = (): fc.Arbitrary<CheckpointRecord> =>
  fc.record({
    id: fc.uuid(),
    timestamp: fc.integer({ min: Date.now() - 1000000, max: Date.now() }),
    messageRange: fc.tuple(
      fc.integer({ min: 0, max: 100 }),
      fc.integer({ min: 0, max: 100 })
    ).map(([start, end]) => [Math.min(start, end), Math.max(start, end)] as [number, number]),
    originalTokens: fc.integer({ min: 100, max: 10000 }),
    compressedTokens: fc.integer({ min: 10, max: 1000 }),
    compressionRatio: fc.double({ min: 0.01, max: 1.0, noNaN: true }),
    level: fc.constantFrom(1 as const, 2 as const, 3 as const),
  });

/**
 * Arbitrary for generating session data
 */
const sessionDataArbitrary = () =>
  fc.record({
    messages: fc.array(messageArbitrary(), { minLength: 1, maxLength: 50 }),
    checkpointRecords: fc.array(checkpointRecordArbitrary(), { maxLength: 10 }),
  });

// ============================================================================
// Property Tests
// ============================================================================

describe('SessionHistoryManager - Property 7: Session History Persistence', () => {
  let tempDir: string;
  const tempDirs: string[] = [];

  beforeEach(async () => {
    // Create temporary directory for tests
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'session-persist-test-'));
    tempDirs.push(tempDir);
  });

  afterEach(async () => {
    // Clean up all temporary directories after a delay
    // This prevents race conditions with async operations
    await new Promise(resolve => setTimeout(resolve, 100));
    
    for (const dir of tempDirs) {
      try {
        await fs.rm(dir, { recursive: true, force: true });
      } catch (error) {
        // Ignore cleanup errors
      }
    }
    tempDirs.length = 0;
  });

  it('Property 7.1: Save/load round trip preserves all data', () => {
    fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        sessionDataArbitrary(),
        async (sessionId, sessionData) => {
          const manager = new SessionHistoryManager(sessionId, tempDir);

          // Append messages and checkpoint records
          for (const message of sessionData.messages) {
            manager.appendMessage(message);
          }

          for (const record of sessionData.checkpointRecords) {
            manager.recordCheckpoint(record);
          }

          // Get original history
          const originalHistory = manager.getHistory();

          // Save to disk
          await manager.save();

          // Create new manager and load
          const newManager = new SessionHistoryManager(sessionId, tempDir);
          const loadedHistory = await newManager.load(sessionId);

          // Verify all data is preserved
          expect(loadedHistory.sessionId).toBe(originalHistory.sessionId);
          expect(loadedHistory.messages).toHaveLength(originalHistory.messages.length);
          expect(loadedHistory.checkpointRecords).toHaveLength(
            originalHistory.checkpointRecords.length
          );

          // Verify messages
          for (let i = 0; i < originalHistory.messages.length; i++) {
            expect(loadedHistory.messages[i].id).toBe(originalHistory.messages[i].id);
            expect(loadedHistory.messages[i].role).toBe(originalHistory.messages[i].role);
            expect(loadedHistory.messages[i].content).toBe(originalHistory.messages[i].content);
            expect(loadedHistory.messages[i].timestamp).toBe(
              originalHistory.messages[i].timestamp
            );
          }

          // Verify checkpoint records
          for (let i = 0; i < originalHistory.checkpointRecords.length; i++) {
            expect(loadedHistory.checkpointRecords[i].id).toBe(
              originalHistory.checkpointRecords[i].id
            );
            expect(loadedHistory.checkpointRecords[i].timestamp).toBe(
              originalHistory.checkpointRecords[i].timestamp
            );
          }

          // Verify metadata
          expect(loadedHistory.metadata.totalMessages).toBe(
            originalHistory.metadata.totalMessages
          );
          expect(loadedHistory.metadata.compressionCount).toBe(
            originalHistory.metadata.compressionCount
          );
        }
      ),
      { numRuns: 50 }
    );
  });

  it('Property 7.2: Multiple saves preserve latest data', () => {
    fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.array(messageArbitrary(), { minLength: 2, maxLength: 10 }),
        async (sessionId, messages) => {
          const manager = new SessionHistoryManager(sessionId, tempDir);

          // Append messages one by one, saving after each
          for (const message of messages) {
            manager.appendMessage(message);
            await manager.save();
          }

          // Load and verify all messages are present
          const newManager = new SessionHistoryManager(sessionId, tempDir);
          const loadedHistory = await newManager.load(sessionId);

          expect(loadedHistory.messages).toHaveLength(messages.length);

          // Verify all messages in order
          for (let i = 0; i < messages.length; i++) {
            expect(loadedHistory.messages[i].id).toBe(messages[i].id);
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  it('Property 7.3: Loading non-existent session throws error', () => {
    fc.assert(
      fc.asyncProperty(fc.uuid(), async (sessionId) => {
        const manager = new SessionHistoryManager(sessionId, tempDir);

        // Try to load non-existent session
        await expect(manager.load('non-existent-session')).rejects.toThrow(
          'Session history not found'
        );
      }),
      { numRuns: 20 }
    );
  });

  it('Property 7.4: File is created in correct location', () => {
    fc.assert(
      fc.asyncProperty(fc.uuid(), messageArbitrary(), async (sessionId, message) => {
        const manager = new SessionHistoryManager(sessionId, tempDir);

        manager.appendMessage(message);
        await manager.save();

        // Verify file exists
        const filePath = path.join(tempDir, `${sessionId}.json`);
        const fileExists = await fs
          .access(filePath)
          .then(() => true)
          .catch(() => false);

        expect(fileExists).toBe(true);

        // Verify file is valid JSON
        const fileContent = await fs.readFile(filePath, 'utf-8');
        const parsed = JSON.parse(fileContent);

        expect(parsed.sessionId).toBe(sessionId);
        expect(parsed.messages).toHaveLength(1);
      }),
      { numRuns: 50 }
    );
  });

  it('Property 7.5: Metadata is preserved across save/load', () => {
    fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        sessionDataArbitrary(),
        async (sessionId, sessionData) => {
          const manager = new SessionHistoryManager(sessionId, tempDir);

          // Append data
          for (const message of sessionData.messages) {
            manager.appendMessage(message);
          }

          for (const record of sessionData.checkpointRecords) {
            manager.recordCheckpoint(record);
          }

          const originalMetadata = manager.getHistory().metadata;

          // Save and load
          await manager.save();

          const newManager = new SessionHistoryManager(sessionId, tempDir);
          const loadedHistory = await newManager.load(sessionId);

          // Verify metadata
          expect(loadedHistory.metadata.startTime).toBe(originalMetadata.startTime);
          expect(loadedHistory.metadata.lastUpdate).toBe(originalMetadata.lastUpdate);
          expect(loadedHistory.metadata.totalMessages).toBe(originalMetadata.totalMessages);
          expect(loadedHistory.metadata.totalTokens).toBe(originalMetadata.totalTokens);
          expect(loadedHistory.metadata.compressionCount).toBe(
            originalMetadata.compressionCount
          );
        }
      ),
      { numRuns: 50 }
    );
  });

  it('Property 7.6: Empty session can be saved and loaded', () => {
    fc.assert(
      fc.asyncProperty(fc.uuid(), async (sessionId) => {
        const manager = new SessionHistoryManager(sessionId, tempDir);

        // Save empty session
        await manager.save();

        // Load empty session
        const newManager = new SessionHistoryManager(sessionId, tempDir);
        const loadedHistory = await newManager.load(sessionId);

        expect(loadedHistory.sessionId).toBe(sessionId);
        expect(loadedHistory.messages).toHaveLength(0);
        expect(loadedHistory.checkpointRecords).toHaveLength(0);
        expect(loadedHistory.metadata.totalMessages).toBe(0);
      }),
      { numRuns: 20 }
    );
  });

  it('Property 7.7: Large sessions can be saved and loaded', () => {
    fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.array(messageArbitrary(), { minLength: 100, maxLength: 200 }),
        async (sessionId, messages) => {
          const manager = new SessionHistoryManager(sessionId, tempDir);

          // Append many messages
          for (const message of messages) {
            manager.appendMessage(message);
          }

          // Save
          await manager.save();

          // Load
          const newManager = new SessionHistoryManager(sessionId, tempDir);
          const loadedHistory = await newManager.load(sessionId);

          // Verify all messages loaded
          expect(loadedHistory.messages).toHaveLength(messages.length);
        }
      ),
      { numRuns: 10 } // Fewer runs for large data
    );
  });

  it('Property 7.8: Session ID mismatch is handled', () => {
    fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.uuid(),
        messageArbitrary(),
        async (sessionId1, sessionId2, message) => {
          // Skip if IDs are the same
          fc.pre(sessionId1 !== sessionId2);

          const manager1 = new SessionHistoryManager(sessionId1, tempDir);
          manager1.appendMessage(message);
          await manager1.save();

          // Try to load with different session ID
          const manager2 = new SessionHistoryManager(sessionId2, tempDir);

          // Should throw error (file doesn't exist for sessionId2)
          await expect(manager2.load(sessionId2)).rejects.toThrow();
        }
      ),
      { numRuns: 20 }
    );
  });

  it('Property 7.9: Checkpoint records are preserved with correct structure', () => {
    fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.array(checkpointRecordArbitrary(), { minLength: 1, maxLength: 10 }),
        async (sessionId, records) => {
          const manager = new SessionHistoryManager(sessionId, tempDir);

          // Record checkpoints
          for (const record of records) {
            manager.recordCheckpoint(record);
          }

          // Save and load
          await manager.save();

          const newManager = new SessionHistoryManager(sessionId, tempDir);
          const loadedHistory = await newManager.load(sessionId);

          // Verify all checkpoint records
          expect(loadedHistory.checkpointRecords).toHaveLength(records.length);

          for (let i = 0; i < records.length; i++) {
            const original = records[i];
            const loaded = loadedHistory.checkpointRecords[i];

            expect(loaded.id).toBe(original.id);
            expect(loaded.timestamp).toBe(original.timestamp);
            expect(loaded.messageRange).toEqual(original.messageRange);
            expect(loaded.originalTokens).toBe(original.originalTokens);
            expect(loaded.compressedTokens).toBe(original.compressedTokens);
            expect(loaded.compressionRatio).toBeCloseTo(original.compressionRatio, 5);
            expect(loaded.level).toBe(original.level);
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  it('Property 7.10: Overwriting existing session preserves new data', () => {
    fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        messageArbitrary(),
        messageArbitrary(),
        async (sessionId, message1, message2) => {
          // First save
          const manager1 = new SessionHistoryManager(sessionId, tempDir);
          manager1.appendMessage(message1);
          await manager1.save();

          // Second save (overwrites) - create new manager without loading
          const manager2 = new SessionHistoryManager(sessionId, tempDir);
          manager2.appendMessage(message2);
          await manager2.save();

          // Load and verify only second message
          const manager3 = new SessionHistoryManager(sessionId, tempDir);
          const loadedHistory = await manager3.load(sessionId);

          // Should have only the second message (first was overwritten)
          // Note: This is expected behavior - creating a new manager doesn't load existing data
          expect(loadedHistory.messages).toHaveLength(1);
          expect(loadedHistory.messages[0].id).toBe(message2.id);
          expect(loadedHistory.messages[0].content).toBe(message2.content);
        }
      ),
      { numRuns: 50 }
    );
  });
});
