/**
 * Property-Based Tests for Active Context Manager
 *
 * These tests use fast-check to verify universal properties that should hold
 * for all possible inputs to the ActiveContextManager.
 *
 * Requirements: FR-1, FR-5
 */

import * as fc from 'fast-check';
import { describe, it, expect, beforeEach } from 'vitest';

import { TokenCounterService } from '../../tokenCounter.js';
import { ActiveContextManager } from '../activeContextManager.js';

import type { CheckpointSummary } from '../../types/storageTypes.js';
import type { Message } from '../../types.js';

/**
 * Helper to create a test message
 */
function createMessage(
  id: string,
  content: string,
  role: 'user' | 'assistant' | 'system' = 'user'
): Message {
  return {
    id,
    role,
    content,
    timestamp: new Date(),
    parts: [{ type: 'text', text: content }],
  };
}

/**
 * Helper to create a test checkpoint
 */
function createCheckpoint(id: string, summary: string, tokenCount: number): CheckpointSummary {
  return {
    id,
    timestamp: Date.now(),
    summary,
    originalMessageIds: [],
    tokenCount,
    compressionLevel: 3,
    compressionNumber: 1,
    metadata: {
      model: 'test-model',
      createdAt: Date.now(),
    },
  };
}

describe('ActiveContextManager - Property Tests', () => {
  let tokenCounter: TokenCounterService;
  let systemPrompt: Message;
  const OLLAMA_LIMIT = 6800;

  beforeEach(() => {
    tokenCounter = new TokenCounterService();
    systemPrompt = createMessage('system-1', 'You are a helpful assistant.', 'system');
  });

  describe('Property 2: Active Context Token Limits', () => {
    /**
     * **Property 2: Active Context Token Limits**
     *
     * **Validates: Requirements FR-1, FR-5**
     *
     * **Property Statement:**
     * For any sequence of operations (addMessage, addCheckpoint, removeMessages),
     * the total token count must NEVER exceed the Ollama limit minus safety margin.
     *
     * **Invariants:**
     * 1. Total tokens = system + checkpoints + recent messages
     * 2. Total tokens ≤ ollamaLimit - safetyMargin
     * 3. Adding a message that would exceed limit throws an error
     * 4. Token counts are always non-negative
     * 5. Token count breakdown is always consistent
     */
    it('should never exceed token limit after any sequence of operations', () => {
      fc.assert(
        fc.property(
          // Generate arbitrary sequences of operations
          fc.array(
            fc.oneof(
              // Operation: Add message
              fc.record({
                type: fc.constant('addMessage' as const),
                content: fc.string({ minLength: 1, maxLength: 100 }),
              }),
              // Operation: Add checkpoint
              fc.record({
                type: fc.constant('addCheckpoint' as const),
                summary: fc.string({ minLength: 10, maxLength: 50 }),
              }),
              // Operation: Remove messages
              fc.record({
                type: fc.constant('removeMessages' as const),
                count: fc.integer({ min: 1, max: 5 }),
              })
            ),
            { minLength: 1, maxLength: 20 }
          ),
          (operations) => {
            const manager = new ActiveContextManager(systemPrompt, OLLAMA_LIMIT, tokenCounter);
            const messageIds: string[] = [];
            let operationCount = 0;

            for (const op of operations) {
              operationCount++;

              try {
                if (op.type === 'addMessage') {
                  const message = createMessage(`msg-${operationCount}`, op.content);
                  messageIds.push(message.id);
                  manager.addMessage(message);
                } else if (op.type === 'addCheckpoint') {
                  const checkpoint = createCheckpoint(
                    `ckpt-${operationCount}`,
                    op.summary,
                    tokenCounter.countTokensCached(`ckpt-${operationCount}`, op.summary)
                  );
                  manager.addCheckpoint(checkpoint);
                } else if (op.type === 'removeMessages') {
                  const toRemove = messageIds.slice(0, Math.min(op.count, messageIds.length));
                  if (toRemove.length > 0) {
                    manager.removeMessages(toRemove);
                    // Remove from tracking
                    messageIds.splice(0, toRemove.length);
                  }
                }

                // **Invariant 1:** Total tokens = system + checkpoints + recent
                const state = manager.getState();
                const calculatedTotal =
                  state.tokenCount.system + state.tokenCount.checkpoints + state.tokenCount.recent;
                expect(state.tokenCount.total).toBe(calculatedTotal);

                // **Invariant 2:** Total tokens ≤ limit - safety margin
                const effectiveLimit = OLLAMA_LIMIT - manager.getSafetyMargin();
                expect(state.tokenCount.total).toBeLessThanOrEqual(effectiveLimit);

                // **Invariant 4:** Token counts are non-negative
                expect(state.tokenCount.system).toBeGreaterThanOrEqual(0);
                expect(state.tokenCount.checkpoints).toBeGreaterThanOrEqual(0);
                expect(state.tokenCount.recent).toBeGreaterThanOrEqual(0);
                expect(state.tokenCount.total).toBeGreaterThanOrEqual(0);

                // **Invariant 5:** Validation is consistent
                const validation = manager.validate();
                if (validation.valid) {
                  expect(validation.tokens).toBeLessThanOrEqual(validation.limit);
                } else {
                  expect(validation.tokens).toBeGreaterThan(validation.limit);
                  expect(validation.overage).toBe(validation.tokens - validation.limit);
                }
              } catch (error) {
                // **Invariant 3:** Errors only occur when adding would exceed limit
                if (error instanceof Error && error.message.includes('would exceed limit')) {
                  // This is expected - verify the context is still valid
                  const validation = manager.validate();
                  expect(validation.valid).toBe(true);
                } else {
                  // Unexpected error
                  throw error;
                }
              }
            }
          }
        ),
        { numRuns: 100 } // Run 100 random test cases
      );
    });

    /**
     * **Property 2.1: Token Count Accuracy**
     *
     * The token count breakdown must always be accurate and consistent.
     */
    it('should maintain accurate token count breakdown', () => {
      fc.assert(
        fc.property(
          fc.array(fc.string({ minLength: 1, maxLength: 100 }), { minLength: 1, maxLength: 10 }),
          (contents) => {
            const manager = new ActiveContextManager(systemPrompt, OLLAMA_LIMIT, tokenCounter);

            // Add messages
            for (let i = 0; i < contents.length; i++) {
              try {
                const message = createMessage(`msg-${i}`, contents[i]);
                manager.addMessage(message);
              } catch {
                // Ignore if limit exceeded
                break;
              }
            }

            // Verify token count breakdown
            const state = manager.getState();

            // Calculate expected counts
            const expectedSystem = tokenCounter.countTokensCached(
              systemPrompt.id,
              systemPrompt.content
            );
            const expectedRecent = state.recentMessages.reduce(
              (sum, msg) => sum + tokenCounter.countTokensCached(msg.id, msg.content),
              0
            );
            const expectedCheckpoints = state.checkpoints.reduce(
              (sum, cp) => sum + cp.tokenCount,
              0
            );
            const expectedTotal = expectedSystem + expectedRecent + expectedCheckpoints;

            // Verify
            expect(state.tokenCount.system).toBe(expectedSystem);
            expect(state.tokenCount.recent).toBe(expectedRecent);
            expect(state.tokenCount.checkpoints).toBe(expectedCheckpoints);
            expect(state.tokenCount.total).toBe(expectedTotal);
          }
        ),
        { numRuns: 50 }
      );
    });

    /**
     * **Property 2.2: Available Tokens Calculation**
     *
     * Available tokens should always equal (limit - safety margin - total tokens).
     */
    it('should calculate available tokens correctly', () => {
      fc.assert(
        fc.property(
          fc.array(fc.string({ minLength: 1, maxLength: 50 }), { minLength: 1, maxLength: 10 }),
          (contents) => {
            const manager = new ActiveContextManager(systemPrompt, OLLAMA_LIMIT, tokenCounter);

            // Add messages
            for (let i = 0; i < contents.length; i++) {
              try {
                const message = createMessage(`msg-${i}`, contents[i]);
                manager.addMessage(message);
              } catch {
                break;
              }
            }

            // Verify available tokens calculation
            const available = manager.getAvailableTokens();
            const total = manager.getTokenCount();
            const effectiveLimit = OLLAMA_LIMIT - manager.getSafetyMargin();
            const expectedAvailable = effectiveLimit - total;

            expect(available).toBe(expectedAvailable);
            expect(available).toBeGreaterThanOrEqual(0);
          }
        ),
        { numRuns: 50 }
      );
    });

    /**
     * **Property 2.3: Checkpoint Addition**
     *
     * Adding checkpoints should increase checkpoint token count and total.
     */
    it('should correctly update token counts when adding checkpoints', () => {
      fc.assert(
        fc.property(
          fc.array(fc.string({ minLength: 10, maxLength: 50 }), { minLength: 1, maxLength: 5 }),
          (summaries) => {
            const manager = new ActiveContextManager(systemPrompt, OLLAMA_LIMIT, tokenCounter);

            let expectedCheckpointTokens = 0;
            const initialTotal = manager.getTokenCount();

            // Add checkpoints
            for (let i = 0; i < summaries.length; i++) {
              const checkpoint = createCheckpoint(
                `ckpt-${i}`,
                summaries[i],
                tokenCounter.countTokensCached(`ckpt-${i}`, summaries[i])
              );
              expectedCheckpointTokens += checkpoint.tokenCount;
              manager.addCheckpoint(checkpoint);

              // Verify counts after each addition
              const state = manager.getState();
              expect(state.tokenCount.checkpoints).toBe(expectedCheckpointTokens);
              expect(state.tokenCount.total).toBe(initialTotal + expectedCheckpointTokens);
            }
          }
        ),
        { numRuns: 50 }
      );
    });

    /**
     * **Property 2.4: Message Removal**
     *
     * Removing messages should decrease recent token count and total.
     */
    it('should correctly update token counts when removing messages', () => {
      fc.assert(
        fc.property(
          fc.array(fc.string({ minLength: 1, maxLength: 50 }), { minLength: 5, maxLength: 10 }),
          fc.integer({ min: 1, max: 5 }),
          (contents, removeCount) => {
            const manager = new ActiveContextManager(systemPrompt, OLLAMA_LIMIT, tokenCounter);
            const messageIds: string[] = [];

            // Add messages
            for (let i = 0; i < contents.length; i++) {
              try {
                const message = createMessage(`msg-${i}`, contents[i]);
                messageIds.push(message.id);
                manager.addMessage(message);
              } catch {
                break;
              }
            }

            const beforeRemoval = manager.getState();
            const toRemove = messageIds.slice(0, Math.min(removeCount, messageIds.length));

            if (toRemove.length > 0) {
              // Calculate expected token reduction
              const removedTokens = toRemove.reduce((sum, id) => {
                const msg = beforeRemoval.recentMessages.find((m) => m.id === id);
                return sum + (msg ? tokenCounter.countTokensCached(msg.id, msg.content) : 0);
              }, 0);

              // Remove messages
              manager.removeMessages(toRemove);

              // Verify counts after removal
              const afterRemoval = manager.getState();
              expect(afterRemoval.tokenCount.recent).toBe(
                beforeRemoval.tokenCount.recent - removedTokens
              );
              expect(afterRemoval.tokenCount.total).toBe(
                beforeRemoval.tokenCount.total - removedTokens
              );
              expect(afterRemoval.recentMessages.length).toBe(
                beforeRemoval.recentMessages.length - toRemove.length
              );
            }
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});
