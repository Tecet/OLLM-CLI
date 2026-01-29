/**
 * Property-Based Tests for Active Context Manager - Message Ordering
 * 
 * These tests verify that message ordering is preserved correctly
 * across all operations.
 * 
 * Requirements: FR-1
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { ActiveContextManager } from '../activeContextManager.js';
import { TokenCounterService } from '../../tokenCounter.js';
import type { Message } from '../../types.js';

/**
 * Helper to create a test message
 */
function createMessage(id: string, content: string, role: 'user' | 'assistant' | 'system' = 'user'): Message {
  return {
    id,
    role,
    content,
    timestamp: new Date(),
    parts: [{ type: 'text', text: content }],
  };
}

describe('ActiveContextManager - Message Ordering Property Tests', () => {
  let tokenCounter: TokenCounterService;
  let systemPrompt: Message;
  const OLLAMA_LIMIT = 6800;

  beforeEach(() => {
    tokenCounter = new TokenCounterService();
    systemPrompt = createMessage('system-1', 'You are a helpful assistant.', 'system');
  });

  describe('Property 3: Active Context Message Ordering', () => {
    /**
     * **Property 3: Active Context Message Ordering**
     * 
     * **Validates: Requirements FR-1**
     * 
     * **Property Statement:**
     * Messages must always be ordered chronologically (oldest to newest) in:
     * 1. Recent messages array
     * 2. Checkpoints array
     * 3. Built prompts
     * 
     * **Invariants:**
     * 1. Recent messages maintain insertion order
     * 2. Checkpoints maintain insertion order
     * 3. Prompt structure: [system, checkpoints (oldest→newest), recent (oldest→newest), new]
     * 4. Removing messages preserves order of remaining messages
     * 5. Message IDs in prompt match expected order
     */
    it('should maintain chronological order in recent messages', () => {
      fc.assert(
        fc.property(
          fc.array(fc.string({ minLength: 1, maxLength: 50 }), { minLength: 1, maxLength: 10 }),
          (contents) => {
            const manager = new ActiveContextManager(systemPrompt, OLLAMA_LIMIT, tokenCounter);
            const addedIds: string[] = [];

            // Add messages in sequence
            for (let i = 0; i < contents.length; i++) {
              try {
                const message = createMessage(`msg-${i}`, contents[i]);
                addedIds.push(message.id);
                manager.addMessage(message);
              } catch {
                // Stop if limit exceeded
                break;
              }
            }

            // **Invariant 1:** Recent messages maintain insertion order
            const state = manager.getState();
            const actualIds = state.recentMessages.map(m => m.id);

            // Verify order matches insertion order
            const expectedIds = addedIds.slice(0, actualIds.length);
            expect(actualIds).toEqual(expectedIds);

            // Verify messages are in chronological order by index
            for (let i = 1; i < actualIds.length; i++) {
              const prevIndex = parseInt(actualIds[i - 1].split('-')[1]);
              const currIndex = parseInt(actualIds[i].split('-')[1]);
              expect(currIndex).toBeGreaterThan(prevIndex);
            }
          }
        ),
        { numRuns: 50 }
      );
    });

    /**
     * **Property 3.1: Checkpoint Ordering**
     * 
     * Checkpoints must maintain insertion order (oldest to newest).
     */
    it('should maintain chronological order in checkpoints', () => {
      fc.assert(
        fc.property(
          fc.array(fc.string({ minLength: 10, maxLength: 50 }), { minLength: 1, maxLength: 5 }),
          (summaries) => {
            const manager = new ActiveContextManager(systemPrompt, OLLAMA_LIMIT, tokenCounter);
            const addedIds: string[] = [];

            // Add checkpoints in sequence
            for (let i = 0; i < summaries.length; i++) {
              const checkpoint = {
                id: `ckpt-${i}`,
                timestamp: Date.now() + i, // Ensure increasing timestamps
                summary: summaries[i],
                originalMessageIds: [],
                tokenCount: tokenCounter.countTokensCached(`ckpt-${i}`, summaries[i]),
                compressionLevel: 3 as const,
                compressionNumber: i,
                metadata: {
                  model: 'test-model',
                  createdAt: Date.now() + i,
                },
              };
              addedIds.push(checkpoint.id);
              manager.addCheckpoint(checkpoint);
            }

            // **Invariant 2:** Checkpoints maintain insertion order
            const state = manager.getState();
            const actualIds = state.checkpoints.map(cp => cp.id);

            // Verify order matches insertion order
            expect(actualIds).toEqual(addedIds);

            // Verify checkpoints are in chronological order by timestamp
            for (let i = 1; i < state.checkpoints.length; i++) {
              expect(state.checkpoints[i].timestamp).toBeGreaterThanOrEqual(
                state.checkpoints[i - 1].timestamp
              );
            }

            // Verify checkpoints are in chronological order by compression number
            for (let i = 1; i < state.checkpoints.length; i++) {
              expect(state.checkpoints[i].compressionNumber).toBeGreaterThanOrEqual(
                state.checkpoints[i - 1].compressionNumber
              );
            }
          }
        ),
        { numRuns: 50 }
      );
    });

    /**
     * **Property 3.2: Prompt Structure Order**
     * 
     * Built prompts must follow the structure:
     * [system, checkpoints (oldest→newest), recent (oldest→newest), new]
     */
    it('should build prompts with correct message order', () => {
      fc.assert(
        fc.property(
          fc.record({
            checkpoints: fc.array(fc.string({ minLength: 10, maxLength: 30 }), { minLength: 0, maxLength: 3 }),
            messages: fc.array(fc.string({ minLength: 1, maxLength: 30 }), { minLength: 1, maxLength: 5 }),
            newMessage: fc.option(fc.string({ minLength: 1, maxLength: 30 }), { nil: undefined }),
          }),
          ({ checkpoints, messages, newMessage }) => {
            const manager = new ActiveContextManager(systemPrompt, OLLAMA_LIMIT, tokenCounter);

            // Add checkpoints
            const checkpointIds: string[] = [];
            for (let i = 0; i < checkpoints.length; i++) {
              const checkpoint = {
                id: `ckpt-${i}`,
                timestamp: Date.now() + i,
                summary: checkpoints[i],
                originalMessageIds: [],
                tokenCount: tokenCounter.countTokensCached(`ckpt-${i}`, checkpoints[i]),
                compressionLevel: 3 as const,
                compressionNumber: i,
                metadata: {
                  model: 'test-model',
                  createdAt: Date.now() + i,
                },
              };
              checkpointIds.push(checkpoint.id);
              manager.addCheckpoint(checkpoint);
            }

            // Add messages
            const messageIds: string[] = [];
            for (let i = 0; i < messages.length; i++) {
              try {
                const message = createMessage(`msg-${i}`, messages[i]);
                messageIds.push(message.id);
                manager.addMessage(message);
              } catch {
                break;
              }
            }

            // Build prompt
            const newMsg = newMessage ? createMessage('new-msg', newMessage) : undefined;
            const prompt = manager.buildPrompt(newMsg);

            // **Invariant 3:** Prompt structure is correct
            let index = 0;

            // 1. System prompt (always first)
            expect(prompt[index].id).toBe(systemPrompt.id);
            expect(prompt[index].role).toBe('system');
            index++;

            // 2. Checkpoints (oldest to newest)
            for (let i = 0; i < checkpointIds.length; i++) {
              expect(prompt[index].id).toBe(checkpointIds[i]);
              expect(prompt[index].role).toBe('assistant');
              index++;
            }

            // 3. Recent messages (oldest to newest)
            const actualMessageIds = messageIds.slice(0, manager.getRecentMessages().length);
            for (let i = 0; i < actualMessageIds.length; i++) {
              expect(prompt[index].id).toBe(actualMessageIds[i]);
              index++;
            }

            // 4. New message (if provided)
            if (newMsg) {
              expect(prompt[index].id).toBe('new-msg');
              index++;
            }

            // Verify we've accounted for all messages
            expect(index).toBe(prompt.length);
          }
        ),
        { numRuns: 50 }
      );
    });

    /**
     * **Property 3.3: Order Preservation After Removal**
     * 
     * Removing messages should preserve the order of remaining messages.
     */
    it('should preserve order of remaining messages after removal', () => {
      fc.assert(
        fc.property(
          fc.array(fc.string({ minLength: 1, maxLength: 30 }), { minLength: 5, maxLength: 10 }),
          fc.array(fc.integer({ min: 0, max: 4 }), { minLength: 1, maxLength: 3 }),
          (contents, removeIndices) => {
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
            const beforeIds = beforeRemoval.recentMessages.map(m => m.id);

            // Remove messages at specified indices
            const toRemove = removeIndices
              .filter(idx => idx < beforeIds.length)
              .map(idx => beforeIds[idx]);

            if (toRemove.length > 0) {
              manager.removeMessages(toRemove);

              // **Invariant 4:** Order of remaining messages is preserved
              const afterRemoval = manager.getState();
              const afterIds = afterRemoval.recentMessages.map(m => m.id);

              // Build expected remaining IDs (in original order)
              const expectedIds = beforeIds.filter(id => !toRemove.includes(id));

              expect(afterIds).toEqual(expectedIds);

              // Verify chronological order is maintained
              for (let i = 1; i < afterIds.length; i++) {
                const prevIndex = parseInt(afterIds[i - 1].split('-')[1]);
                const currIndex = parseInt(afterIds[i].split('-')[1]);
                expect(currIndex).toBeGreaterThan(prevIndex);
              }
            }
          }
        ),
        { numRuns: 50 }
      );
    });

    /**
     * **Property 3.4: Message ID Uniqueness in Prompt**
     * 
     * All message IDs in a prompt should be unique.
     */
    it('should have unique message IDs in built prompts', () => {
      fc.assert(
        fc.property(
          fc.record({
            checkpoints: fc.array(fc.string({ minLength: 10, maxLength: 30 }), { minLength: 0, maxLength: 3 }),
            messages: fc.array(fc.string({ minLength: 1, maxLength: 30 }), { minLength: 1, maxLength: 5 }),
          }),
          ({ checkpoints, messages }) => {
            const manager = new ActiveContextManager(systemPrompt, OLLAMA_LIMIT, tokenCounter);

            // Add checkpoints
            for (let i = 0; i < checkpoints.length; i++) {
              const checkpoint = {
                id: `ckpt-${i}`,
                timestamp: Date.now() + i,
                summary: checkpoints[i],
                originalMessageIds: [],
                tokenCount: tokenCounter.countTokensCached(`ckpt-${i}`, checkpoints[i]),
                compressionLevel: 3 as const,
                compressionNumber: i,
                metadata: {
                  model: 'test-model',
                  createdAt: Date.now() + i,
                },
              };
              manager.addCheckpoint(checkpoint);
            }

            // Add messages
            for (let i = 0; i < messages.length; i++) {
              try {
                const message = createMessage(`msg-${i}`, messages[i]);
                manager.addMessage(message);
              } catch {
                break;
              }
            }

            // Build prompt
            const prompt = manager.buildPrompt();

            // **Invariant 5:** All message IDs are unique
            const ids = prompt.map(m => m.id);
            const uniqueIds = new Set(ids);
            expect(uniqueIds.size).toBe(ids.length);
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});
