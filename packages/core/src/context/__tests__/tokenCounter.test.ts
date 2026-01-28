/**
 * Property-Based Tests for Token Counter Service
 *
 * Tests token counting functionality including caching, fallback estimation,
 * tool call overhead, and model-specific multipliers.
 *
 * Feature: stage-04b-context-management
 */

import fc from 'fast-check';
import { describe, it, expect, beforeEach } from 'vitest';

import { TokenCounterService } from '../tokenCounter.js';

import type { Message, ToolCall } from '../types.js';

describe('Token Counter - Property-Based Tests', () => {
  /**
   * Arbitrary generators for token counter testing
   */

  // Generator for message IDs
  const arbMessageId = fc.uuid();

  // Generator for text content
  const arbText = fc.string({ minLength: 1, maxLength: 10000 });

  // Generator for model multipliers (excluding NaN and Infinity)
  const arbMultiplier = fc.float({ min: 0.5, max: 2.0, noNaN: true });

  // Generator for tool calls
  const arbToolCall = fc.record({
    id: fc.uuid(),
    name: fc.string({ minLength: 1, maxLength: 50 }),
    arguments: fc.dictionary(fc.string(), fc.anything()),
  }) as fc.Arbitrary<ToolCall>;

  // Generator for messages
  const arbMessage = fc.record({
    id: fc.uuid(),
    role: fc.constantFrom('system', 'user', 'assistant', 'tool') as fc.Arbitrary<
      'system' | 'user' | 'assistant' | 'tool'
    >,
    content: arbText,
    timestamp: fc.date(),
    tokenCount: fc.option(fc.integer({ min: 1, max: 10000 }), { nil: undefined }),
    metadata: fc.option(
      fc.record({
        toolCalls: fc.array(arbToolCall, { minLength: 0, maxLength: 5 }),
      }),
      { nil: undefined }
    ),
  }) as fc.Arbitrary<Message>;

  /**
   * Property 3: Token Count Caching
   * Feature: stage-04b-context-management, Property 3: Token Count Caching
   * Validates: Requirements 2.1, 2.4
   *
   * For any message, counting tokens twice for the same message should return
   * the cached value without recalculation.
   */
  it('Property 3: Token count caching - counting same message twice returns cached value', () => {
    fc.assert(
      fc.property(arbMessageId, arbText, (messageId, text) => {
        const counter = new TokenCounterService();

        // First count
        const count1 = counter.countTokensCached(messageId, text);

        // Second count should return cached value
        const count2 = counter.countTokensCached(messageId, text);

        // Property: Both counts should be identical (cached)
        return count1 === count2 && count1 > 0;
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 4: Fallback Token Estimation
   * Feature: stage-04b-context-management, Property 4: Fallback Token Estimation
   * Validates: Requirements 2.3
   *
   * For any text when provider token counting is unavailable, the estimated
   * token count should equal Math.ceil(text.length / 4) with multiplier applied.
   */
  it('Property 4: Fallback estimation - token count equals Math.ceil(text.length / 4)', () => {
    fc.assert(
      fc.asyncProperty(arbText, async (text) => {
        // Create counter without provider (forces fallback)
        const counter = new TokenCounterService();

        const count = await counter.countTokens(text);
        const expected = Math.ceil(text.length / 4);

        // Property: Count should match fallback formula (with default multiplier 1.0)
        return count === expected;
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 5: Tool Call Overhead Inclusion
   * Feature: stage-04b-context-management, Property 5: Tool Call Overhead Inclusion
   * Validates: Requirements 2.5
   *
   * For any conversation with tool calls, the total token count should include
   * overhead for each tool call.
   */
  it('Property 5: Tool call overhead - total includes overhead for each tool call', () => {
    fc.assert(
      fc.property(fc.array(arbMessage, { minLength: 1, maxLength: 20 }), (messages) => {
        const counter = new TokenCounterService({ toolCallOverhead: 50 });

        // Count tool calls in messages
        let toolCallCount = 0;
        for (const msg of messages) {
          if (msg.metadata?.toolCalls) {
            toolCallCount += msg.metadata.toolCalls.length;
          }
        }

        const totalTokens = counter.countConversationTokens(messages);

        // Calculate expected minimum (content + tool overhead)
        let contentTokens = 0;
        for (const msg of messages) {
          contentTokens += msg.tokenCount ?? Math.ceil(msg.content.length / 4);
        }
        const expectedMinimum = contentTokens + toolCallCount * 50;

        // Property: Total should be at least content + tool overhead
        return totalTokens >= expectedMinimum;
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 6: Model-Specific Multipliers
   * Feature: stage-04b-context-management, Property 6: Model-Specific Multipliers
   * Validates: Requirements 2.6
   *
   * For any configured per-model token adjustment multiplier, the token count
   * should be multiplied by that factor using single rounding operation.
   */
  it('Property 6: Model multipliers - token count scaled by multiplier', () => {
    fc.assert(
      fc.asyncProperty(arbText, arbMultiplier, async (text, multiplier) => {
        const counter = new TokenCounterService({ modelMultiplier: multiplier });

        const count = await counter.countTokens(text);
        // Single rounding operation: Math.ceil((length / 4) * multiplier)
        const expected = Math.ceil((text.length / 4) * multiplier);

        // Property: Count should use single rounding operation
        return count === expected;
      }),
      { numRuns: 100 }
    );
  });
});

/**
 * Unit Tests for Token Counter Service
 *
 * These tests verify specific examples and edge cases
 */
describe('Token Counter - Unit Tests', () => {
  let counter: TokenCounterService;

  beforeEach(() => {
    counter = new TokenCounterService();
  });

  it('should count tokens using fallback estimation', async () => {
    const text = 'Hello, world!'; // 13 characters
    const count = await counter.countTokens(text);
    expect(count).toBe(Math.ceil(13 / 4)); // 4 tokens
  });

  it('should cache token counts by message ID', () => {
    const messageId = 'msg-123';
    const text = 'Test message';

    const count1 = counter.countTokensCached(messageId, text);
    const count2 = counter.countTokensCached(messageId, text);

    expect(count1).toBe(count2);
    expect(count1).toBeGreaterThan(0);
  });

  it('should include tool call overhead in conversation count', () => {
    const messages: Message[] = [
      {
        id: '1',
        role: 'user',
        content: 'Hello',
        timestamp: new Date(),
        metadata: {
          toolCalls: [{ id: 't1', name: 'tool1', arguments: {} }],
        },
      },
    ];

    const total = counter.countConversationTokens(messages);
    const contentTokens = Math.ceil('Hello'.length / 4);
    const expected = contentTokens + 50; // 50 is default tool overhead

    expect(total).toBe(expected);
  });

  it('should apply model multiplier to token counts', async () => {
    const multiplier = 1.5;
    const counterWithMultiplier = new TokenCounterService({ modelMultiplier: multiplier });

    const text = 'Test'; // 4 characters
    const count = await counterWithMultiplier.countTokens(text);
    // Single rounding: Math.ceil((4 / 4) * 1.5) = Math.ceil(1.5) = 2
    const expected = Math.ceil((4 / 4) * multiplier);

    expect(count).toBe(expected);
  });

  it('should clear cache when requested', () => {
    const messageId = 'msg-456';
    const text = 'Cached message';

    // Cache a count
    counter.countTokensCached(messageId, text);

    // Clear cache
    counter.clearCache();

    // Should recalculate (we can't directly verify cache miss, but count should still work)
    const count = counter.countTokensCached(messageId, text);
    expect(count).toBeGreaterThan(0);
  });

  it('should handle empty text', async () => {
    const count = await counter.countTokens('');
    expect(count).toBe(0);
  });

  it('should handle messages without tool calls', () => {
    const messages: Message[] = [
      {
        id: '1',
        role: 'user',
        content: 'Hello',
        timestamp: new Date(),
      },
    ];

    const total = counter.countConversationTokens(messages);
    expect(total).toBeGreaterThan(0);
  });

  it('should use cached tokenCount from message if available', () => {
    const messages: Message[] = [
      {
        id: '1',
        role: 'user',
        content: 'Hello world',
        timestamp: new Date(),
        tokenCount: 100, // Pre-cached count
      },
    ];

    const total = counter.countConversationTokens(messages);
    expect(total).toBe(100); // Should use the cached value
  });

  it('should update multiplier and clear cache', () => {
    const messageId = 'msg-789';
    const text = 'Test';

    // Cache with multiplier 1.0
    const count1 = counter.countTokensCached(messageId, text);

    // Update multiplier
    counter.setModelMultiplier(2.0);

    // Should recalculate with new multiplier
    const count2 = counter.countTokensCached(messageId, text);

    // With multiplier 2.0, count should be different
    expect(count2).not.toBe(count1);
  });
});
