/**
 * Property-Based Tests for Session History Append
 * 
 * **Property 6: Session History Append**
 * **Validates: Requirements FR-4**
 * 
 * This test validates that the session history manager correctly appends messages
 * and maintains the append-only invariant.
 * 
 * Properties tested:
 * 1. Messages are never removed or modified
 * 2. Message order is preserved
 * 3. Metadata is updated correctly
 * 4. Token counts are tracked
 * 5. Timestamps are updated
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { SessionHistoryManager } from '../sessionHistoryManager.js';
import type { Message } from '../../types.js';
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
 * Arbitrary for generating arrays of messages
 */
const messagesArbitrary = (): fc.Arbitrary<Message[]> =>
  fc.array(messageArbitrary(), { minLength: 1, maxLength: 50 });

// ============================================================================
// Property Tests
// ============================================================================

describe('SessionHistoryManager - Property 6: Session History Append', () => {
  let tempDir: string;

  beforeEach(async () => {
    // Create temporary directory for tests
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'session-history-test-'));
  });

  it('Property 6.1: Messages are never removed (append-only)', () => {
    fc.assert(
      fc.property(messagesArbitrary(), (messages) => {
        const manager = new SessionHistoryManager('test-session', tempDir);

        // Append all messages
        for (const message of messages) {
          manager.appendMessage(message);
        }

        const history = manager.getHistory();

        // All messages should be present
        expect(history.messages).toHaveLength(messages.length);

        // Messages should be in the same order
        for (let i = 0; i < messages.length; i++) {
          expect(history.messages[i].id).toBe(messages[i].id);
          expect(history.messages[i].content).toBe(messages[i].content);
          expect(history.messages[i].role).toBe(messages[i].role);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('Property 6.2: Message order is preserved', () => {
    fc.assert(
      fc.property(messagesArbitrary(), (messages) => {
        const manager = new SessionHistoryManager('test-session', tempDir);

        // Append messages
        for (const message of messages) {
          manager.appendMessage(message);
        }

        const history = manager.getHistory();

        // Verify order by checking IDs
        const expectedIds = messages.map((m) => m.id);
        const actualIds = history.messages.map((m) => m.id);

        expect(actualIds).toEqual(expectedIds);
      }),
      { numRuns: 100 }
    );
  });

  it('Property 6.3: Total message count is accurate', () => {
    fc.assert(
      fc.property(messagesArbitrary(), (messages) => {
        const manager = new SessionHistoryManager('test-session', tempDir);

        // Append messages
        for (const message of messages) {
          manager.appendMessage(message);
        }

        const history = manager.getHistory();

        // Metadata should match actual count
        expect(history.metadata.totalMessages).toBe(messages.length);
        expect(history.messages.length).toBe(messages.length);
      }),
      { numRuns: 100 }
    );
  });

  it('Property 6.4: Token count increases monotonically', () => {
    fc.assert(
      fc.property(messagesArbitrary(), (messages) => {
        const manager = new SessionHistoryManager('test-session', tempDir);

        let previousTokenCount = 0;

        // Append messages and verify token count increases
        for (const message of messages) {
          manager.appendMessage(message);

          const history = manager.getHistory();
          const currentTokenCount = history.metadata.totalTokens;

          // Token count should increase (or stay same for empty messages)
          expect(currentTokenCount).toBeGreaterThanOrEqual(previousTokenCount);

          previousTokenCount = currentTokenCount;
        }
      }),
      { numRuns: 100 }
    );
  });

  it('Property 6.5: Last update timestamp increases', () => {
    fc.assert(
      fc.property(messagesArbitrary(), (messages) => {
        const manager = new SessionHistoryManager('test-session', tempDir);

        let previousUpdate = 0;

        // Append messages and verify timestamp increases
        for (const message of messages) {
          // Small delay to ensure timestamp changes
          const beforeAppend = Date.now();

          manager.appendMessage(message);

          const history = manager.getHistory();
          const currentUpdate = history.metadata.lastUpdate;

          // Last update should be >= previous update
          expect(currentUpdate).toBeGreaterThanOrEqual(previousUpdate);

          // Last update should be >= when we appended
          expect(currentUpdate).toBeGreaterThanOrEqual(beforeAppend);

          previousUpdate = currentUpdate;
        }
      }),
      { numRuns: 50 } // Fewer runs due to timing sensitivity
    );
  });

  it('Property 6.6: Messages are immutable after append', () => {
    fc.assert(
      fc.property(messagesArbitrary(), (messages) => {
        const manager = new SessionHistoryManager('test-session', tempDir);

        // Append messages
        for (const message of messages) {
          manager.appendMessage(message);
        }

        // Get history
        const history1 = manager.getHistory();

        // Store original content
        const originalContent = messages.length > 0 ? messages[0].content : '';

        // Modify the returned messages (should not affect internal state)
        if (history1.messages.length > 0) {
          history1.messages[0].content = 'MODIFIED_BY_TEST_' + Date.now();
        }

        // Get history again
        const history2 = manager.getHistory();

        // Original messages should be unchanged
        if (messages.length > 0) {
          expect(history2.messages[0].content).toBe(originalContent);
          expect(history2.messages[0].content).not.toContain('MODIFIED_BY_TEST_');
        }
      }),
      { numRuns: 100 }
    );
  });

  it('Property 6.7: Appending same message multiple times creates duplicates', () => {
    fc.assert(
      fc.property(messageArbitrary(), fc.integer({ min: 2, max: 10 }), (message, count) => {
        const manager = new SessionHistoryManager('test-session', tempDir);

        // Append same message multiple times
        for (let i = 0; i < count; i++) {
          manager.appendMessage(message);
        }

        const history = manager.getHistory();

        // Should have count copies of the message
        expect(history.messages).toHaveLength(count);

        // All should have the same ID and content
        for (const msg of history.messages) {
          expect(msg.id).toBe(message.id);
          expect(msg.content).toBe(message.content);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('Property 6.8: Empty messages are handled correctly', () => {
    fc.assert(
      fc.property(fc.uuid(), fc.constantFrom('user' as const, 'assistant' as const), (id, role) => {
        const manager = new SessionHistoryManager('test-session', tempDir);

        const emptyMessage: Message = {
          id,
          role,
          content: '',
          timestamp: Date.now(),
        };

        manager.appendMessage(emptyMessage);

        const history = manager.getHistory();

        // Empty message should still be recorded
        expect(history.messages).toHaveLength(1);
        expect(history.messages[0].content).toBe('');
        expect(history.metadata.totalMessages).toBe(1);
      }),
      { numRuns: 100 }
    );
  });

  it('Property 6.9: Interleaved user and assistant messages maintain order', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            id: fc.uuid(),
            role: fc.constantFrom('user' as const, 'assistant' as const),
            content: fc.string({ minLength: 1, maxLength: 100 }),
            timestamp: fc.integer({ min: Date.now() - 1000000, max: Date.now() }),
          }),
          { minLength: 2, maxLength: 20 }
        ),
        (messages) => {
          const manager = new SessionHistoryManager('test-session', tempDir);

          // Append messages
          for (const message of messages) {
            manager.appendMessage(message);
          }

          const history = manager.getHistory();

          // Verify exact order and roles
          for (let i = 0; i < messages.length; i++) {
            expect(history.messages[i].id).toBe(messages[i].id);
            expect(history.messages[i].role).toBe(messages[i].role);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 6.10: Metadata consistency after multiple appends', () => {
    fc.assert(
      fc.property(messagesArbitrary(), (messages) => {
        const manager = new SessionHistoryManager('test-session', tempDir);

        // Append messages
        for (const message of messages) {
          manager.appendMessage(message);
        }

        const history = manager.getHistory();

        // Verify metadata consistency
        expect(history.metadata.totalMessages).toBe(history.messages.length);
        expect(history.metadata.totalMessages).toBe(messages.length);

        // Token count should be positive if there are messages
        if (messages.length > 0) {
          expect(history.metadata.totalTokens).toBeGreaterThan(0);
        }

        // Last update should be >= start time
        expect(history.metadata.lastUpdate).toBeGreaterThanOrEqual(
          history.metadata.startTime
        );
      }),
      { numRuns: 100 }
    );
  });
});
