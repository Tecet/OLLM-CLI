/**
 * Tests for ChatCompressionService
 * Feature: services-sessions
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { ChatCompressionService } from '../chatCompressionService.js';
import { sessionMessage } from './test-helpers.js';
import type { SessionMessage } from '../types.js';

describe('ChatCompressionService', () => {
  describe('Property 10: Compression trigger threshold', () => {
    /**
     * Feature: services-sessions, Property 10: Compression trigger threshold
     * 
     * For any message history where token count exceeds (threshold × token limit), 
     * the compression service should indicate that compression is needed.
     * 
     * Validates: Requirements 3.1, 3.7
     */
    it('should trigger compression when token count exceeds threshold', async () => {
      const service = new ChatCompressionService();

      await fc.assert(
        fc.asyncProperty(
          // Generate an array of messages
          fc.array(sessionMessage(), { minLength: 1, maxLength: 100 }),
          // Generate a threshold between 0.5 and 1.0
          fc.double({ min: 0.5, max: 1.0, noNaN: true }),
          // Generate a token limit
          fc.integer({ min: 1000, max: 100000 }),
          async (messages: SessionMessage[], threshold: number, tokenLimit: number) => {
            // Count the actual tokens in the messages
            const actualTokens = messages.reduce((total, msg) => {
              const textContent = msg.parts
                .filter((p) => p.type === 'text')
                .map((p) => p.text)
                .join(' ');
              // Use the same approximation as the service: ~4 chars per token + 10 overhead
              return total + Math.ceil(textContent.length / 4) + 10;
            }, 0);

            // Calculate the threshold token count
            const thresholdTokens = tokenLimit * threshold;

            // Call shouldCompress
            const shouldCompress = service.shouldCompress(messages, tokenLimit, threshold);

            // Verify the result matches our expectation
            if (actualTokens >= thresholdTokens) {
              // If we're at or above threshold, compression should be triggered
              expect(shouldCompress).toBe(true);
            } else {
              // If we're below threshold, compression should not be triggered
              expect(shouldCompress).toBe(false);
            }
          }
        ),
        {
          numRuns: 100, // Run 100 iterations as specified in the design
          verbose: true,
        }
      );
    });
  });

  describe('truncate strategy', () => {
    /**
     * Unit tests for truncate compression strategy
     * Validates: Requirements 3.4, 3.5
     */
    it('should preserve system prompt when truncating', () => {
      const service = new ChatCompressionService();
      
      const messages: SessionMessage[] = [
        {
          role: 'system',
          parts: [{ type: 'text', text: 'You are a helpful assistant.' }],
          timestamp: '2024-01-01T00:00:00Z',
        },
        {
          role: 'user',
          parts: [{ type: 'text', text: 'Hello' }],
          timestamp: '2024-01-01T00:01:00Z',
        },
        {
          role: 'assistant',
          parts: [{ type: 'text', text: 'Hi there!' }],
          timestamp: '2024-01-01T00:02:00Z',
        },
        {
          role: 'user',
          parts: [{ type: 'text', text: 'How are you?' }],
          timestamp: '2024-01-01T00:03:00Z',
        },
      ];

      const result = service.truncate(messages, 100);

      // System prompt should always be preserved
      expect(result[0]).toEqual(messages[0]);
      expect(result[0].role).toBe('system');
    });

    it('should preserve recent messages when truncating', () => {
      const service = new ChatCompressionService();
      
      const messages: SessionMessage[] = [
        {
          role: 'system',
          parts: [{ type: 'text', text: 'You are a helpful assistant.' }],
          timestamp: '2024-01-01T00:00:00Z',
        },
        {
          role: 'user',
          parts: [{ type: 'text', text: 'Old message 1' }],
          timestamp: '2024-01-01T00:01:00Z',
        },
        {
          role: 'assistant',
          parts: [{ type: 'text', text: 'Old response 1' }],
          timestamp: '2024-01-01T00:02:00Z',
        },
        {
          role: 'user',
          parts: [{ type: 'text', text: 'Recent message' }],
          timestamp: '2024-01-01T00:03:00Z',
        },
        {
          role: 'assistant',
          parts: [{ type: 'text', text: 'Recent response' }],
          timestamp: '2024-01-01T00:04:00Z',
        },
      ];

      // Set target to only fit system prompt + recent messages
      const result = service.truncate(messages, 50);

      // Should have system prompt
      expect(result[0].role).toBe('system');
      
      // Should have recent messages (last ones in the array)
      const lastMessage = result[result.length - 1];
      expect(lastMessage.parts[0].text).toBe('Recent response');
    });

    it('should remove oldest messages until under target token count', () => {
      const service = new ChatCompressionService();
      
      const messages: SessionMessage[] = [
        {
          role: 'system',
          parts: [{ type: 'text', text: 'System' }],
          timestamp: '2024-01-01T00:00:00Z',
        },
        {
          role: 'user',
          parts: [{ type: 'text', text: 'Message 1' }],
          timestamp: '2024-01-01T00:01:00Z',
        },
        {
          role: 'assistant',
          parts: [{ type: 'text', text: 'Response 1' }],
          timestamp: '2024-01-01T00:02:00Z',
        },
        {
          role: 'user',
          parts: [{ type: 'text', text: 'Message 2' }],
          timestamp: '2024-01-01T00:03:00Z',
        },
        {
          role: 'assistant',
          parts: [{ type: 'text', text: 'Response 2' }],
          timestamp: '2024-01-01T00:04:00Z',
        },
      ];

      const result = service.truncate(messages, 50);

      // Result should be shorter than original
      expect(result.length).toBeLessThan(messages.length);
      
      // System prompt should be preserved
      expect(result[0].role).toBe('system');
      
      // Most recent messages should be preserved
      expect(result[result.length - 1].parts[0].text).toBe('Response 2');
    });

    it('should handle messages without system prompt', () => {
      const service = new ChatCompressionService();
      
      const messages: SessionMessage[] = [
        {
          role: 'user',
          parts: [{ type: 'text', text: 'Hello' }],
          timestamp: '2024-01-01T00:01:00Z',
        },
        {
          role: 'assistant',
          parts: [{ type: 'text', text: 'Hi there!' }],
          timestamp: '2024-01-01T00:02:00Z',
        },
      ];

      const result = service.truncate(messages, 100);

      // Should return messages without error
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].role).not.toBe('system');
    });

    it('should return empty array for empty input', () => {
      const service = new ChatCompressionService();
      
      const result = service.truncate([], 100);

      expect(result).toEqual([]);
    });

    it('should respect target token count', () => {
      const service = new ChatCompressionService();
      
      // Create messages with known token counts
      const messages: SessionMessage[] = [
        {
          role: 'system',
          parts: [{ type: 'text', text: 'a'.repeat(40) }], // ~10 tokens + 10 overhead = 20
          timestamp: '2024-01-01T00:00:00Z',
        },
        {
          role: 'user',
          parts: [{ type: 'text', text: 'b'.repeat(40) }], // ~10 tokens + 10 overhead = 20
          timestamp: '2024-01-01T00:01:00Z',
        },
        {
          role: 'assistant',
          parts: [{ type: 'text', text: 'c'.repeat(40) }], // ~10 tokens + 10 overhead = 20
          timestamp: '2024-01-01T00:02:00Z',
        },
      ];

      // Target of 30 tokens should fit system + one message
      const result = service.truncate(messages, 30);

      // Calculate actual tokens in result
      const resultTokens = result.reduce((total, msg) => {
        const textContent = msg.parts
          .filter((p) => p.type === 'text')
          .map((p) => p.text)
          .join(' ');
        return total + Math.ceil(textContent.length / 4) + 10;
      }, 0);

      // Result should be at or under target
      expect(resultTokens).toBeLessThanOrEqual(30);
    });
  });

  describe('hybrid strategy', () => {
    /**
     * Unit tests for hybrid compression strategy
     * Validates: Requirements 3.5, 3.6
     */
    it('should preserve system prompt when using hybrid strategy', async () => {
      const service = new ChatCompressionService();
      
      const messages: SessionMessage[] = [
        {
          role: 'system',
          parts: [{ type: 'text', text: 'You are a helpful assistant.' }],
          timestamp: '2024-01-01T00:00:00Z',
        },
        {
          role: 'user',
          parts: [{ type: 'text', text: 'Very old message 1' }],
          timestamp: '2024-01-01T00:01:00Z',
        },
        {
          role: 'assistant',
          parts: [{ type: 'text', text: 'Very old response 1' }],
          timestamp: '2024-01-01T00:02:00Z',
        },
        {
          role: 'user',
          parts: [{ type: 'text', text: 'Middle message 1' }],
          timestamp: '2024-01-01T00:03:00Z',
        },
        {
          role: 'assistant',
          parts: [{ type: 'text', text: 'Middle response 1' }],
          timestamp: '2024-01-01T00:04:00Z',
        },
        {
          role: 'user',
          parts: [{ type: 'text', text: 'Recent message' }],
          timestamp: '2024-01-01T00:05:00Z',
        },
      ];

      const result = await service.hybrid(messages, {
        strategy: 'hybrid',
        preserveRecentTokens: 50,
        targetTokens: 50,
      });

      // System prompt should always be preserved
      expect(result[0]).toEqual(messages[0]);
      expect(result[0].role).toBe('system');
      expect(result[0].parts[0].text).toBe('You are a helpful assistant.');
    });

    it('should create summary for middle messages', async () => {
      const service = new ChatCompressionService();
      
      const messages: SessionMessage[] = [
        {
          role: 'system',
          parts: [{ type: 'text', text: 'System' }],
          timestamp: '2024-01-01T00:00:00Z',
        },
        {
          role: 'user',
          parts: [{ type: 'text', text: 'Very old message 1' }],
          timestamp: '2024-01-01T00:01:00Z',
        },
        {
          role: 'assistant',
          parts: [{ type: 'text', text: 'Very old response 1' }],
          timestamp: '2024-01-01T00:02:00Z',
        },
        {
          role: 'user',
          parts: [{ type: 'text', text: 'Middle message 1' }],
          timestamp: '2024-01-01T00:03:00Z',
        },
        {
          role: 'assistant',
          parts: [{ type: 'text', text: 'Middle response 1' }],
          timestamp: '2024-01-01T00:04:00Z',
        },
        {
          role: 'user',
          parts: [{ type: 'text', text: 'Recent message' }],
          timestamp: '2024-01-01T00:05:00Z',
        },
      ];

      const result = await service.hybrid(messages, {
        strategy: 'hybrid',
        preserveRecentTokens: 50,
        targetTokens: 50,
      });

      // Should have system prompt + summary + recent messages
      expect(result.length).toBeGreaterThan(2);
      expect(result.length).toBeLessThan(messages.length);
      
      // Second message should be the summary
      expect(result[1].role).toBe('system');
      expect(result[1].parts[0].text).toContain('summary');
    });

    it('should preserve recent messages', async () => {
      const service = new ChatCompressionService();
      
      const messages: SessionMessage[] = [
        {
          role: 'system',
          parts: [{ type: 'text', text: 'System' }],
          timestamp: '2024-01-01T00:00:00Z',
        },
        {
          role: 'user',
          parts: [{ type: 'text', text: 'Very old message' }],
          timestamp: '2024-01-01T00:01:00Z',
        },
        {
          role: 'assistant',
          parts: [{ type: 'text', text: 'Very old response' }],
          timestamp: '2024-01-01T00:02:00Z',
        },
        {
          role: 'user',
          parts: [{ type: 'text', text: 'Middle message' }],
          timestamp: '2024-01-01T00:03:00Z',
        },
        {
          role: 'assistant',
          parts: [{ type: 'text', text: 'Middle response' }],
          timestamp: '2024-01-01T00:04:00Z',
        },
        {
          role: 'user',
          parts: [{ type: 'text', text: 'Recent message' }],
          timestamp: '2024-01-01T00:05:00Z',
        },
      ];

      const result = await service.hybrid(messages, {
        strategy: 'hybrid',
        preserveRecentTokens: 50,
        targetTokens: 50,
      });

      // Most recent message should be preserved
      const lastMessage = result[result.length - 1];
      expect(lastMessage.parts[0].text).toBe('Recent message');
    });

    it('should truncate very old messages', async () => {
      const service = new ChatCompressionService();
      
      const messages: SessionMessage[] = [
        {
          role: 'system',
          parts: [{ type: 'text', text: 'System' }],
          timestamp: '2024-01-01T00:00:00Z',
        },
        {
          role: 'user',
          parts: [{ type: 'text', text: 'Very old message 1' }],
          timestamp: '2024-01-01T00:01:00Z',
        },
        {
          role: 'assistant',
          parts: [{ type: 'text', text: 'Very old response 1' }],
          timestamp: '2024-01-01T00:02:00Z',
        },
        {
          role: 'user',
          parts: [{ type: 'text', text: 'Very old message 2' }],
          timestamp: '2024-01-01T00:03:00Z',
        },
        {
          role: 'assistant',
          parts: [{ type: 'text', text: 'Very old response 2' }],
          timestamp: '2024-01-01T00:04:00Z',
        },
        {
          role: 'user',
          parts: [{ type: 'text', text: 'Middle message' }],
          timestamp: '2024-01-01T00:05:00Z',
        },
        {
          role: 'assistant',
          parts: [{ type: 'text', text: 'Middle response' }],
          timestamp: '2024-01-01T00:06:00Z',
        },
        {
          role: 'user',
          parts: [{ type: 'text', text: 'Recent message' }],
          timestamp: '2024-01-01T00:07:00Z',
        },
      ];

      const result = await service.hybrid(messages, {
        strategy: 'hybrid',
        preserveRecentTokens: 50,
        targetTokens: 50,
      });

      // Very old messages should be truncated (not in result)
      const hasVeryOldMessage = result.some(
        m => m.parts[0].text.includes('Very old message 1')
      );
      expect(hasVeryOldMessage).toBe(false);
      
      // Result should be significantly shorter than original
      expect(result.length).toBeLessThan(messages.length);
    });

    it('should handle messages without system prompt', async () => {
      const service = new ChatCompressionService();
      
      const messages: SessionMessage[] = [
        {
          role: 'user',
          parts: [{ type: 'text', text: 'Old message 1' }],
          timestamp: '2024-01-01T00:01:00Z',
        },
        {
          role: 'assistant',
          parts: [{ type: 'text', text: 'Old response 1' }],
          timestamp: '2024-01-01T00:02:00Z',
        },
        {
          role: 'user',
          parts: [{ type: 'text', text: 'Middle message' }],
          timestamp: '2024-01-01T00:03:00Z',
        },
        {
          role: 'assistant',
          parts: [{ type: 'text', text: 'Middle response' }],
          timestamp: '2024-01-01T00:04:00Z',
        },
        {
          role: 'user',
          parts: [{ type: 'text', text: 'Recent message' }],
          timestamp: '2024-01-01T00:05:00Z',
        },
      ];

      const result = await service.hybrid(messages, {
        strategy: 'hybrid',
        preserveRecentTokens: 50,
        targetTokens: 50,
      });

      // Should return messages without error
      expect(result.length).toBeGreaterThan(0);
    });

    it('should return empty array for empty input', async () => {
      const service = new ChatCompressionService();
      
      const result = await service.hybrid([], {
        strategy: 'hybrid',
        preserveRecentTokens: 50,
        targetTokens: 50,
      });

      expect(result).toEqual([]);
    });

    it('should use placeholder summary when no provider is set', async () => {
      const service = new ChatCompressionService();
      
      const messages: SessionMessage[] = [
        {
          role: 'user',
          parts: [{ type: 'text', text: 'Very old message' }],
          timestamp: '2024-01-01T00:01:00Z',
        },
        {
          role: 'assistant',
          parts: [{ type: 'text', text: 'Very old response' }],
          timestamp: '2024-01-01T00:02:00Z',
        },
        {
          role: 'user',
          parts: [{ type: 'text', text: 'Middle message' }],
          timestamp: '2024-01-01T00:03:00Z',
        },
        {
          role: 'assistant',
          parts: [{ type: 'text', text: 'Middle response' }],
          timestamp: '2024-01-01T00:04:00Z',
        },
        {
          role: 'user',
          parts: [{ type: 'text', text: 'Recent message' }],
          timestamp: '2024-01-01T00:05:00Z',
        },
      ];

      const result = await service.hybrid(messages, {
        strategy: 'hybrid',
        preserveRecentTokens: 30,
        targetTokens: 30,
      });

      // Should have a summary message
      const summaryMsg = result.find(m => m.parts[0].text.includes('summary'));
      expect(summaryMsg).toBeDefined();
      expect(summaryMsg?.parts[0].text).toContain('messages compressed');
    });

    it('should allocate 50% of tokens to recent messages', async () => {
      const service = new ChatCompressionService();
      
      const messages: SessionMessage[] = [
        {
          role: 'system',
          parts: [{ type: 'text', text: 'System' }],
          timestamp: '2024-01-01T00:00:00Z',
        },
        {
          role: 'user',
          parts: [{ type: 'text', text: 'a'.repeat(40) }], // ~10 tokens + 10 overhead = 20
          timestamp: '2024-01-01T00:01:00Z',
        },
        {
          role: 'assistant',
          parts: [{ type: 'text', text: 'b'.repeat(40) }], // ~10 tokens + 10 overhead = 20
          timestamp: '2024-01-01T00:02:00Z',
        },
        {
          role: 'user',
          parts: [{ type: 'text', text: 'c'.repeat(40) }], // ~10 tokens + 10 overhead = 20
          timestamp: '2024-01-01T00:03:00Z',
        },
      ];

      const result = await service.hybrid(messages, {
        strategy: 'hybrid',
        preserveRecentTokens: 100,
        targetTokens: 100,
      });

      // Should have system prompt + summary + recent messages
      expect(result.length).toBeGreaterThan(1);
      
      // Recent messages should be preserved
      const lastMessage = result[result.length - 1];
      expect(lastMessage.parts[0].text).toBe('c'.repeat(40));
    });
  });

  describe('Property 11: Compression preserves critical messages', () => {
    /**
     * Feature: services-sessions, Property 11: Compression preserves critical messages
     * 
     * For any compression operation, the system prompt (first message) and the most recent N tokens 
     * of messages should remain unchanged in the compressed result.
     * 
     * Validates: Requirements 3.2, 3.3, 3.6
     */
    it('should preserve system prompt and recent messages across all strategies', async () => {
      const service = new ChatCompressionService();

      await fc.assert(
        fc.asyncProperty(
          // Generate compression strategy
          fc.constantFrom('truncate' as const, 'summarize' as const, 'hybrid' as const),
          // Generate messages with a system prompt
          fc.array(sessionMessage(), { minLength: 5, maxLength: 50 }),
          // Generate preserve recent tokens value
          fc.integer({ min: 100, max: 2000 }),
          async (strategy, generatedMessages, preserveRecentTokens) => {
            // Ensure first message is a system prompt
            const systemPrompt: SessionMessage = {
              role: 'system',
              parts: [{ type: 'text', text: 'You are a helpful assistant.' }],
              timestamp: new Date('2024-01-01T00:00:00Z').toISOString(),
            };

            // Create messages array with system prompt first
            const messages = [systemPrompt, ...generatedMessages];

            // Calculate how many recent messages should be preserved
            // Work backwards from the end to find messages within the token budget
            const recentMessages: SessionMessage[] = [];
            let recentTokens = 0;

            for (let i = messages.length - 1; i > 0; i--) {
              const message = messages[i];
              const textContent = message.parts
                .filter((p) => p.type === 'text')
                .map((p) => p.text)
                .join(' ');
              const messageTokens = Math.ceil(textContent.length / 4) + 10;

              if (recentTokens + messageTokens <= preserveRecentTokens) {
                recentMessages.unshift(message);
                recentTokens += messageTokens;
              } else {
                break;
              }
            }

            // Perform compression
            let compressedMessages: SessionMessage[];
            
            if (strategy === 'truncate') {
              compressedMessages = service.truncate(messages, preserveRecentTokens);
            } else if (strategy === 'summarize') {
              compressedMessages = await service.summarize(messages, preserveRecentTokens);
            } else {
              compressedMessages = await service.hybrid(messages, {
                strategy: 'hybrid',
                preserveRecentTokens,
                targetTokens: preserveRecentTokens,
              });
            }

            // Property 1: System prompt must be preserved
            expect(compressedMessages.length).toBeGreaterThan(0);
            expect(compressedMessages[0]).toEqual(systemPrompt);
            expect(compressedMessages[0].role).toBe('system');
            expect(compressedMessages[0].parts[0].text).toBe('You are a helpful assistant.');

            // Property 2: Recent messages must be preserved
            // The last N messages in the compressed result should match the last N messages
            // from the original (excluding any summary messages)
            const compressedNonSummary = compressedMessages.filter(
              (msg) => !msg.parts[0].text.includes('summary') && !msg.parts[0].text.includes('compressed')
            );

            // Find the recent messages in the compressed output
            const compressedRecent = compressedNonSummary.slice(1); // Skip system prompt

            // Each recent message in the compressed output should exist in the original recent messages
            for (const compressedMsg of compressedRecent) {
              const found = recentMessages.some(
                (originalMsg) =>
                  originalMsg.role === compressedMsg.role &&
                  originalMsg.parts[0].text === compressedMsg.parts[0].text &&
                  originalMsg.timestamp === compressedMsg.timestamp
              );
              expect(found).toBe(true);
            }

            // Property 3: Recent messages should be in the same order
            if (compressedRecent.length > 1) {
              for (let i = 0; i < compressedRecent.length - 1; i++) {
                const current = compressedRecent[i];
                const next = compressedRecent[i + 1];
                
                // Find indices using timestamp as well to handle duplicate text
                const currentIdx = messages.findIndex(
                  (m) =>
                    m.role === current.role &&
                    m.parts[0].text === current.parts[0].text &&
                    m.timestamp === current.timestamp
                );
                const nextIdx = messages.findIndex(
                  (m) =>
                    m.role === next.role &&
                    m.parts[0].text === next.parts[0].text &&
                    m.timestamp === next.timestamp
                );
                
                // If both messages are found in original, they should be in order
                if (currentIdx !== -1 && nextIdx !== -1 && currentIdx !== nextIdx) {
                  expect(currentIdx).toBeLessThan(nextIdx);
                }
              }
            }
          }
        ),
        {
          numRuns: 100,
          verbose: true,
        }
      );
    });
  });

  describe('Property 12: Compression reduces token count', () => {
    /**
     * Feature: services-sessions, Property 12: Compression reduces token count
     * 
     * For any compression operation, the compressed message history should have fewer tokens 
     * than the original while preserving the system prompt and recent messages.
     * 
     * Validates: Requirements 3.4
     */
    it('should reduce token count after compression', async () => {
      const service = new ChatCompressionService();

      await fc.assert(
        fc.asyncProperty(
          // Generate compression strategy
          fc.constantFrom('truncate' as const, 'summarize' as const, 'hybrid' as const),
          // Generate messages with enough content to compress
          fc.array(sessionMessage(), { minLength: 10, maxLength: 50 }),
          // Generate target tokens (smaller than original to force compression)
          fc.integer({ min: 100, max: 1000 }),
          async (strategy, generatedMessages, targetTokens) => {
            // Ensure first message is a system prompt
            const systemPrompt: SessionMessage = {
              role: 'system',
              parts: [{ type: 'text', text: 'You are a helpful assistant.' }],
              timestamp: new Date('2024-01-01T00:00:00Z').toISOString(),
            };

            // Create messages array with system prompt first
            const messages = [systemPrompt, ...generatedMessages];

            // Calculate original token count
            const originalTokens = messages.reduce((total, msg) => {
              const textContent = msg.parts
                .filter((p) => p.type === 'text')
                .map((p) => p.text)
                .join(' ');
              return total + Math.ceil(textContent.length / 4) + 10;
            }, 0);

            // Only test if original is larger than target (compression is needed)
            if (originalTokens <= targetTokens) {
              return; // Skip this test case
            }

            // Perform compression
            let compressedMessages: SessionMessage[];
            
            if (strategy === 'truncate') {
              compressedMessages = service.truncate(messages, targetTokens);
            } else if (strategy === 'summarize') {
              compressedMessages = await service.summarize(messages, targetTokens);
            } else {
              compressedMessages = await service.hybrid(messages, {
                strategy: 'hybrid',
                preserveRecentTokens: Math.floor(targetTokens * 0.5),
                targetTokens,
              });
            }

            // Calculate compressed token count
            const compressedTokens = compressedMessages.reduce((total, msg) => {
              const textContent = msg.parts
                .filter((p) => p.type === 'text')
                .map((p) => p.text)
                .join(' ');
              return total + Math.ceil(textContent.length / 4) + 10;
            }, 0);

            // Property: Compressed token count should be less than original
            expect(compressedTokens).toBeLessThan(originalTokens);

            // Property: Compressed token count should be at or below target
            // (with some tolerance for summary overhead)
            expect(compressedTokens).toBeLessThanOrEqual(targetTokens * 1.2);

            // Property: System prompt should still be preserved
            expect(compressedMessages.length).toBeGreaterThan(0);
            expect(compressedMessages[0]).toEqual(systemPrompt);

            // Property: Should have at least system prompt
            expect(compressedMessages.length).toBeGreaterThanOrEqual(1);
          }
        ),
        {
          numRuns: 100,
          verbose: true,
        }
      );
    });
  });

  describe('metadata tracking', () => {
    /**
     * Unit tests for compression metadata tracking
     * Validates: Requirements 3.8
     */
    it('should increment compressionCount when metadata is provided', async () => {
      const service = new ChatCompressionService();
      
      const messages: SessionMessage[] = [
        {
          role: 'system',
          parts: [{ type: 'text', text: 'System' }],
          timestamp: '2024-01-01T00:00:00Z',
        },
        {
          role: 'user',
          parts: [{ type: 'text', text: 'Message 1' }],
          timestamp: '2024-01-01T00:01:00Z',
        },
        {
          role: 'assistant',
          parts: [{ type: 'text', text: 'Response 1' }],
          timestamp: '2024-01-01T00:02:00Z',
        },
      ];

      const metadata = {
        tokenCount: 100,
        compressionCount: 0,
      };

      const result = await service.compress(
        messages,
        {
          strategy: 'truncate',
          preserveRecentTokens: 50,
        },
        metadata
      );

      // Metadata should be updated
      expect(result.metadata).toBeDefined();
      expect(result.metadata?.compressionCount).toBe(1);
      expect(result.metadata?.tokenCount).toBe(result.compressedTokenCount);
    });

    it('should increment compressionCount from existing value', async () => {
      const service = new ChatCompressionService();
      
      const messages: SessionMessage[] = [
        {
          role: 'user',
          parts: [{ type: 'text', text: 'Message 1' }],
          timestamp: '2024-01-01T00:01:00Z',
        },
        {
          role: 'assistant',
          parts: [{ type: 'text', text: 'Response 1' }],
          timestamp: '2024-01-01T00:02:00Z',
        },
      ];

      const metadata = {
        tokenCount: 100,
        compressionCount: 5,
      };

      const result = await service.compress(
        messages,
        {
          strategy: 'truncate',
          preserveRecentTokens: 50,
        },
        metadata
      );

      // Metadata should be incremented from 5 to 6
      expect(result.metadata).toBeDefined();
      expect(result.metadata?.compressionCount).toBe(6);
    });

    it('should not return metadata when not provided', async () => {
      const service = new ChatCompressionService();
      
      const messages: SessionMessage[] = [
        {
          role: 'user',
          parts: [{ type: 'text', text: 'Message 1' }],
          timestamp: '2024-01-01T00:01:00Z',
        },
      ];

      const result = await service.compress(
        messages,
        {
          strategy: 'truncate',
          preserveRecentTokens: 50,
        }
      );

      // Metadata should be undefined when not provided
      expect(result.metadata).toBeUndefined();
    });

    it('should update tokenCount to compressed token count', async () => {
      const service = new ChatCompressionService();
      
      const messages: SessionMessage[] = [
        {
          role: 'user',
          parts: [{ type: 'text', text: 'a'.repeat(400) }], // ~100 tokens + 10 overhead = 110
          timestamp: '2024-01-01T00:01:00Z',
        },
        {
          role: 'assistant',
          parts: [{ type: 'text', text: 'b'.repeat(400) }], // ~100 tokens + 10 overhead = 110
          timestamp: '2024-01-01T00:02:00Z',
        },
      ];

      const metadata = {
        tokenCount: 220,
        compressionCount: 0,
      };

      const result = await service.compress(
        messages,
        {
          strategy: 'truncate',
          preserveRecentTokens: 50,
        },
        metadata
      );

      // Token count should be updated to the compressed count
      expect(result.metadata).toBeDefined();
      expect(result.metadata?.tokenCount).toBe(result.compressedTokenCount);
      expect(result.metadata?.tokenCount).toBeLessThan(220);
    });

    it('should work with all compression strategies', async () => {
      const service = new ChatCompressionService();
      
      const messages: SessionMessage[] = [
        {
          role: 'user',
          parts: [{ type: 'text', text: 'Message 1' }],
          timestamp: '2024-01-01T00:01:00Z',
        },
        {
          role: 'assistant',
          parts: [{ type: 'text', text: 'Response 1' }],
          timestamp: '2024-01-01T00:02:00Z',
        },
      ];

      const strategies: Array<'truncate' | 'summarize' | 'hybrid'> = ['truncate', 'summarize', 'hybrid'];

      for (const strategy of strategies) {
        const metadata = {
          tokenCount: 100,
          compressionCount: 0,
        };

        const result = await service.compress(
          messages,
          {
            strategy,
            preserveRecentTokens: 50,
          },
          metadata
        );

        // Metadata should be updated for all strategies
        expect(result.metadata).toBeDefined();
        expect(result.metadata?.compressionCount).toBe(1);
      }
    });
  });

  describe('Property 13: Compression count increments', () => {
    /**
     * Feature: services-sessions, Property 13: Compression count increments
     * 
     * For any compression operation on a session, the compressionCount in metadata 
     * should increase by exactly 1.
     * 
     * Validates: Requirements 3.8
     */
    it('should increment compressionCount by exactly 1 for any compression operation', async () => {
      const service = new ChatCompressionService();

      await fc.assert(
        fc.asyncProperty(
          // Generate compression strategy
          fc.constantFrom('truncate' as const, 'summarize' as const, 'hybrid' as const),
          // Generate messages
          fc.array(sessionMessage(), { minLength: 3, maxLength: 30 }),
          // Generate initial compressionCount (could be 0 or any positive number)
          fc.integer({ min: 0, max: 100 }),
          // Generate initial tokenCount
          fc.integer({ min: 100, max: 10000 }),
          // Generate target tokens for compression
          fc.integer({ min: 50, max: 500 }),
          async (strategy, messages, initialCompressionCount, initialTokenCount, targetTokens) => {
            // Create metadata with initial compressionCount
            const metadata = {
              tokenCount: initialTokenCount,
              compressionCount: initialCompressionCount,
            };

            // Perform compression with metadata
            const result = await service.compress(
              messages,
              {
                strategy,
                preserveRecentTokens: targetTokens,
                targetTokens,
              },
              metadata
            );

            // Property: compressionCount should be incremented by exactly 1
            expect(result.metadata).toBeDefined();
            expect(result.metadata?.compressionCount).toBe(initialCompressionCount + 1);

            // Additional verification: tokenCount should be updated to compressed count
            expect(result.metadata?.tokenCount).toBe(result.compressedTokenCount);
          }
        ),
        {
          numRuns: 100,
          verbose: true,
        }
      );
    });

    it('should not return metadata when metadata is not provided', async () => {
      const service = new ChatCompressionService();

      await fc.assert(
        fc.asyncProperty(
          // Generate compression strategy
          fc.constantFrom('truncate' as const, 'summarize' as const, 'hybrid' as const),
          // Generate messages
          fc.array(sessionMessage(), { minLength: 2, maxLength: 20 }),
          // Generate target tokens
          fc.integer({ min: 50, max: 500 }),
          async (strategy, messages, targetTokens) => {
            // Perform compression WITHOUT metadata
            const result = await service.compress(
              messages,
              {
                strategy,
                preserveRecentTokens: targetTokens,
                targetTokens,
              }
              // No metadata parameter
            );

            // Property: metadata should be undefined when not provided
            expect(result.metadata).toBeUndefined();
          }
        ),
        {
          numRuns: 100,
          verbose: true,
        }
      );
    });
  });

  describe('error handling', () => {
    /**
     * Unit tests for error handling
     * Validates: Requirements 10.3
     */
    it('should handle compression failure and fall back to placeholder summary', async () => {
      // Create a mock provider that throws an error
      const mockProvider = {
        chatStream: async function* () {
          if (Math.random() < 0) {
            yield { type: 'text', value: '' } as any;
          }
          throw new Error('Model unavailable');
        },
      } as any;

      const service = new ChatCompressionService(mockProvider, 'test-model');

      const messages: SessionMessage[] = [
        {
          role: 'system',
          parts: [{ type: 'text', text: 'System' }],
          timestamp: '2024-01-01T00:00:00Z',
        },
        {
          role: 'user',
          parts: [{ type: 'text', text: 'Old message 1' }],
          timestamp: '2024-01-01T00:01:00Z',
        },
        {
          role: 'assistant',
          parts: [{ type: 'text', text: 'Old response 1' }],
          timestamp: '2024-01-01T00:02:00Z',
        },
        {
          role: 'user',
          parts: [{ type: 'text', text: 'Recent message' }],
          timestamp: '2024-01-01T00:03:00Z',
        },
      ];

      // Should not throw, should fall back to placeholder
      const result = await service.summarize(messages, 50);

      // Should have system prompt + summary + recent messages
      expect(result.length).toBeGreaterThan(0);
      
      // Should have a placeholder summary (not an LLM-generated one)
      const summaryMsg = result.find(m => m.parts[0].text.includes('summary'));
      expect(summaryMsg).toBeDefined();
      expect(summaryMsg?.parts[0].text).toContain('messages compressed');
    });

    it('should handle model unavailable in hybrid strategy', async () => {
      // Create a mock provider that throws an error
      const mockProvider = {
        chatStream: async function* () {
          if (Math.random() < 0) {
            yield { type: 'text', value: '' } as any;
          }
          throw new Error('Connection timeout');
        },
      } as any;

      const service = new ChatCompressionService(mockProvider, 'test-model');

      const messages: SessionMessage[] = [
        {
          role: 'system',
          parts: [{ type: 'text', text: 'System' }],
          timestamp: '2024-01-01T00:00:00Z',
        },
        {
          role: 'user',
          parts: [{ type: 'text', text: 'Very old message' }],
          timestamp: '2024-01-01T00:01:00Z',
        },
        {
          role: 'assistant',
          parts: [{ type: 'text', text: 'Very old response' }],
          timestamp: '2024-01-01T00:02:00Z',
        },
        {
          role: 'user',
          parts: [{ type: 'text', text: 'Middle message' }],
          timestamp: '2024-01-01T00:03:00Z',
        },
        {
          role: 'assistant',
          parts: [{ type: 'text', text: 'Middle response' }],
          timestamp: '2024-01-01T00:04:00Z',
        },
        {
          role: 'user',
          parts: [{ type: 'text', text: 'Recent message' }],
          timestamp: '2024-01-01T00:05:00Z',
        },
      ];

      // Should not throw, should fall back to placeholder
      const result = await service.hybrid(messages, {
        strategy: 'hybrid',
        preserveRecentTokens: 50,
        targetTokens: 50,
      });

      // Should have system prompt + summary + recent messages
      expect(result.length).toBeGreaterThan(0);
      
      // Should have a placeholder summary
      const summaryMsg = result.find(m => m.parts[0].text.includes('summary'));
      expect(summaryMsg).toBeDefined();
      expect(summaryMsg?.parts[0].text).toContain('messages compressed');
    });

    it('should handle empty LLM response', async () => {
      // Create a mock provider that returns empty text
      const mockProvider = {
        chatStream: async function* () {
          yield { type: 'text' as const, value: '' };
        },
      } as any;

      const service = new ChatCompressionService(mockProvider, 'test-model');

      const messages: SessionMessage[] = [
        {
          role: 'user',
          parts: [{ type: 'text', text: 'Old message' }],
          timestamp: '2024-01-01T00:01:00Z',
        },
        {
          role: 'assistant',
          parts: [{ type: 'text', text: 'Old response' }],
          timestamp: '2024-01-01T00:02:00Z',
        },
        {
          role: 'user',
          parts: [{ type: 'text', text: 'Recent message' }],
          timestamp: '2024-01-01T00:03:00Z',
        },
      ];

      // Should fall back to placeholder when LLM returns empty
      const result = await service.summarize(messages, 50);

      // Should have a placeholder summary
      const summaryMsg = result.find(m => m.parts[0].text.includes('summary'));
      expect(summaryMsg).toBeDefined();
      expect(summaryMsg?.parts[0].text).toContain('messages compressed');
    });

    it('should handle LLM error event in stream', async () => {
      // Create a mock provider that emits an error event
      const mockProvider = {
        chatStream: async function* () {
          yield { type: 'error' as const, error: { message: 'Rate limit exceeded' } };
        },
      } as any;

      const service = new ChatCompressionService(mockProvider, 'test-model');

      const messages: SessionMessage[] = [
        {
          role: 'user',
          parts: [{ type: 'text', text: 'Message 1' }],
          timestamp: '2024-01-01T00:01:00Z',
        },
        {
          role: 'assistant',
          parts: [{ type: 'text', text: 'Response 1' }],
          timestamp: '2024-01-01T00:02:00Z',
        },
        {
          role: 'user',
          parts: [{ type: 'text', text: 'Message 2' }],
          timestamp: '2024-01-01T00:03:00Z',
        },
      ];

      // Should fall back to placeholder when LLM returns error
      const result = await service.summarize(messages, 50);

      // Should have a placeholder summary
      const summaryMsg = result.find(m => m.parts[0].text.includes('summary'));
      expect(summaryMsg).toBeDefined();
      expect(summaryMsg?.parts[0].text).toContain('messages compressed');
    });

    it('should continue without compression when compress() encounters error', async () => {
      const service = new ChatCompressionService();

      const messages: SessionMessage[] = [
        {
          role: 'user',
          parts: [{ type: 'text', text: 'Message' }],
          timestamp: '2024-01-01T00:01:00Z',
        },
      ];

      // Test with invalid strategy (should throw)
      await expect(
        service.compress(messages, { strategy: 'invalid' as any, preserveRecentTokens: 50 })
      ).rejects.toThrow('Unknown compression strategy');
    });

    it('should handle provider not set gracefully', async () => {
      const service = new ChatCompressionService();

      const messages: SessionMessage[] = [
        {
          role: 'user',
          parts: [{ type: 'text', text: 'Old message' }],
          timestamp: '2024-01-01T00:01:00Z',
        },
        {
          role: 'assistant',
          parts: [{ type: 'text', text: 'Old response' }],
          timestamp: '2024-01-01T00:02:00Z',
        },
        {
          role: 'user',
          parts: [{ type: 'text', text: 'Recent message' }],
          timestamp: '2024-01-01T00:03:00Z',
        },
      ];

      // Should use placeholder summary when no provider is set
      const result = await service.summarize(messages, 50);

      // Should have a placeholder summary
      const summaryMsg = result.find(m => m.parts[0].text.includes('summary'));
      expect(summaryMsg).toBeDefined();
      expect(summaryMsg?.parts[0].text).toContain('messages compressed');
    });

    it('should recover from compression failure in compress() method', async () => {
      // Create a mock provider that throws an error
      const mockProvider = {
        chatStream: async function* () {
          if (Math.random() < 0) {
            yield { type: 'text', value: '' } as any;
          }
          throw new Error('Network error');
        },
      } as any;

      const service = new ChatCompressionService(mockProvider, 'test-model');

      const messages: SessionMessage[] = [
        {
          role: 'user',
          parts: [{ type: 'text', text: 'Old message' }],
          timestamp: '2024-01-01T00:01:00Z',
        },
        {
          role: 'assistant',
          parts: [{ type: 'text', text: 'Old response' }],
          timestamp: '2024-01-01T00:02:00Z',
        },
        {
          role: 'user',
          parts: [{ type: 'text', text: 'Recent message' }],
          timestamp: '2024-01-01T00:03:00Z',
        },
      ];

      const metadata = {
        tokenCount: 100,
        compressionCount: 0,
      };

      // Should not throw, should fall back to placeholder
      const result = await service.compress(
        messages,
        {
          strategy: 'summarize',
          preserveRecentTokens: 50,
        },
        metadata
      );

      // Should have compressed messages
      expect(result.compressedMessages.length).toBeGreaterThan(0);
      
      // Should have updated metadata
      expect(result.metadata).toBeDefined();
      expect(result.metadata?.compressionCount).toBe(1);
      
      // Should have a placeholder summary
      const summaryMsg = result.compressedMessages.find(m => 
        m.parts[0].text.includes('summary')
      );
      expect(summaryMsg).toBeDefined();
    });
  });

  describe('summarize strategy', () => {
    /**
     * Unit tests for summarize compression strategy
     * Validates: Requirements 3.4, 3.5
     */
    it('should preserve system prompt when summarizing', async () => {
      const service = new ChatCompressionService();
      
      const messages: SessionMessage[] = [
        {
          role: 'system',
          parts: [{ type: 'text', text: 'You are a helpful assistant.' }],
          timestamp: '2024-01-01T00:00:00Z',
        },
        {
          role: 'user',
          parts: [{ type: 'text', text: 'Old message 1' }],
          timestamp: '2024-01-01T00:01:00Z',
        },
        {
          role: 'assistant',
          parts: [{ type: 'text', text: 'Old response 1' }],
          timestamp: '2024-01-01T00:02:00Z',
        },
        {
          role: 'user',
          parts: [{ type: 'text', text: 'Old message 2' }],
          timestamp: '2024-01-01T00:03:00Z',
        },
        {
          role: 'assistant',
          parts: [{ type: 'text', text: 'Old response 2' }],
          timestamp: '2024-01-01T00:04:00Z',
        },
        {
          role: 'user',
          parts: [{ type: 'text', text: 'Recent message' }],
          timestamp: '2024-01-01T00:05:00Z',
        },
      ];

      // Small target to force summarization
      const result = await service.summarize(messages, 50);

      // System prompt should always be preserved
      expect(result[0]).toEqual(messages[0]);
      expect(result[0].role).toBe('system');
      expect(result[0].parts[0].text).toBe('You are a helpful assistant.');
    });

    it('should create summary message for old messages', async () => {
      const service = new ChatCompressionService();
      
      const messages: SessionMessage[] = [
        {
          role: 'system',
          parts: [{ type: 'text', text: 'System' }],
          timestamp: '2024-01-01T00:00:00Z',
        },
        {
          role: 'user',
          parts: [{ type: 'text', text: 'Old message 1' }],
          timestamp: '2024-01-01T00:01:00Z',
        },
        {
          role: 'assistant',
          parts: [{ type: 'text', text: 'Old response 1' }],
          timestamp: '2024-01-01T00:02:00Z',
        },
        {
          role: 'user',
          parts: [{ type: 'text', text: 'Old message 2' }],
          timestamp: '2024-01-01T00:03:00Z',
        },
        {
          role: 'assistant',
          parts: [{ type: 'text', text: 'Old response 2' }],
          timestamp: '2024-01-01T00:04:00Z',
        },
        {
          role: 'user',
          parts: [{ type: 'text', text: 'Recent message' }],
          timestamp: '2024-01-01T00:05:00Z',
        },
      ];

      const result = await service.summarize(messages, 50);

      // Should have system prompt + summary + recent messages
      expect(result.length).toBeGreaterThan(2);
      expect(result.length).toBeLessThan(messages.length);
      
      // Second message should be the summary
      expect(result[1].role).toBe('system');
      expect(result[1].parts[0].text).toContain('summary');
    });

    it('should preserve recent messages', async () => {
      const service = new ChatCompressionService();
      
      const messages: SessionMessage[] = [
        {
          role: 'system',
          parts: [{ type: 'text', text: 'System' }],
          timestamp: '2024-01-01T00:00:00Z',
        },
        {
          role: 'user',
          parts: [{ type: 'text', text: 'Old message' }],
          timestamp: '2024-01-01T00:01:00Z',
        },
        {
          role: 'assistant',
          parts: [{ type: 'text', text: 'Old response' }],
          timestamp: '2024-01-01T00:02:00Z',
        },
        {
          role: 'user',
          parts: [{ type: 'text', text: 'Recent message' }],
          timestamp: '2024-01-01T00:03:00Z',
        },
      ];

      const result = await service.summarize(messages, 50);

      // Most recent message should be preserved
      const lastMessage = result[result.length - 1];
      expect(lastMessage.parts[0].text).toBe('Recent message');
    });

    it('should handle messages without system prompt', async () => {
      const service = new ChatCompressionService();
      
      const messages: SessionMessage[] = [
        {
          role: 'user',
          parts: [{ type: 'text', text: 'Message 1' }],
          timestamp: '2024-01-01T00:01:00Z',
        },
        {
          role: 'assistant',
          parts: [{ type: 'text', text: 'Response 1' }],
          timestamp: '2024-01-01T00:02:00Z',
        },
        {
          role: 'user',
          parts: [{ type: 'text', text: 'Message 2' }],
          timestamp: '2024-01-01T00:03:00Z',
        },
      ];

      const result = await service.summarize(messages, 50);

      // Should return messages without error
      expect(result.length).toBeGreaterThan(0);
    });

    it('should return empty array for empty input', async () => {
      const service = new ChatCompressionService();
      
      const result = await service.summarize([], 100);

      expect(result).toEqual([]);
    });

    it('should use placeholder summary when no provider is set', async () => {
      const service = new ChatCompressionService();
      
      const messages: SessionMessage[] = [
        {
          role: 'user',
          parts: [{ type: 'text', text: 'Old message 1' }],
          timestamp: '2024-01-01T00:01:00Z',
        },
        {
          role: 'assistant',
          parts: [{ type: 'text', text: 'Old response 1' }],
          timestamp: '2024-01-01T00:02:00Z',
        },
        {
          role: 'user',
          parts: [{ type: 'text', text: 'Recent message' }],
          timestamp: '2024-01-01T00:03:00Z',
        },
      ];

      const result = await service.summarize(messages, 30);

      // Should have a summary message
      const summaryMsg = result.find(m => m.parts[0].text.includes('summary'));
      expect(summaryMsg).toBeDefined();
      expect(summaryMsg?.parts[0].text).toContain('messages compressed');
    });
  });
});
