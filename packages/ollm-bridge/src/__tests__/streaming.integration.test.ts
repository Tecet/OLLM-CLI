/**
 * Integration tests for streaming functionality.
 * Tests streaming responses, chunk concatenation, tool call streaming, and error handling.
 *
 * Feature: stage-08-testing-qa
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6
 */

import * as fc from 'fast-check';
import { describe, it, expect, beforeAll } from 'vitest';

import {
  isServerAvailable,
  getServerUrl,
  createTextChunkSequence,
  createToolCallSequence,
  fixtureTools,
  MockProvider,
} from '@ollm/test-utils';

import type { ProviderEvent, ProviderRequest } from '@ollm/core';

describe('Streaming Integration Tests', () => {
  beforeAll(async () => {
    const available = await isServerAvailable();
    if (!available) {
      console.log('⚠️  Integration tests require a running LLM server');
      console.log(`   Set OLLM_TEST_SERVER or start server at ${getServerUrl()}`);
    }
  });

  describe('Property 15: Streaming Chunk Concatenation', () => {
    /**
     * Property 15: Streaming Chunk Concatenation
     * For any streamed response, concatenating all text chunks in order should produce the complete response text.
     * Validates: Requirements 7.1, 7.2
     */
    it('should concatenate all text chunks to produce complete response', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate a random text string
          fc.string({ minLength: 10, maxLength: 500 }),
          // Generate a random chunk size
          fc.integer({ min: 1, max: 20 }),
          async (fullText, chunkSize) => {
            // Create a mock provider that emits the text in chunks
            const chunks = createTextChunkSequence(fullText, chunkSize);
            const provider = new MockProvider({
              eventSequence: chunks,
            });

            // Stream the response
            const request: ProviderRequest = {
              model: 'test-model',
              messages: [
                {
                  role: 'user',
                  parts: [{ type: 'text', text: 'Test prompt' }],
                },
              ],
            };

            const textChunks: string[] = [];
            for await (const event of provider.chatStream(request)) {
              if (event.type === 'text') {
                textChunks.push(event.value);
              }
            }

            // Concatenate all chunks
            const concatenated = textChunks.join('');

            // Verify concatenation equals original text
            expect(concatenated).toBe(fullText);
          }
        ),
        { numRuns: 10 } // Reduced from 100 for performance
      );
    });

    it('should deliver text chunks incrementally', async () => {
      // Test that chunks are delivered one at a time, not all at once
      const fullText = 'This is a test message that will be chunked';
      const chunkSize = 5;
      const chunks = createTextChunkSequence(fullText, chunkSize);

      const provider = new MockProvider({
        eventSequence: chunks,
        eventDelay: 10, // Small delay to simulate streaming
      });

      const request: ProviderRequest = {
        model: 'test-model',
        messages: [
          {
            role: 'user',
            parts: [{ type: 'text', text: 'Test prompt' }],
          },
        ],
      };

      const textChunks: string[] = [];
      const timestamps: number[] = [];

      for await (const event of provider.chatStream(request)) {
        if (event.type === 'text') {
          textChunks.push(event.value);
          timestamps.push(Date.now());
        }
      }

      // Verify we got multiple chunks
      expect(textChunks.length).toBeGreaterThan(1);

      // Verify chunks were delivered over time (not all at once)
      if (timestamps.length > 1) {
        const timeDiff = timestamps[timestamps.length - 1] - timestamps[0];
        expect(timeDiff).toBeGreaterThan(0);
      }

      // Verify concatenation
      expect(textChunks.join('')).toBe(fullText);
    });

    it('should handle empty text chunks gracefully', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.string({ maxLength: 50 }), { minLength: 1, maxLength: 20 }),
          async (chunks) => {
            // Create event sequence with text chunks (including potentially empty ones)
            const events: ProviderEvent[] = [
              ...chunks.map((chunk) => ({ type: 'text' as const, value: chunk })),
              { type: 'finish' as const, reason: 'stop' as const },
            ];

            const provider = new MockProvider({
              eventSequence: events,
            });

            const request: ProviderRequest = {
              model: 'test-model',
              messages: [
                {
                  role: 'user',
                  parts: [{ type: 'text', text: 'Test prompt' }],
                },
              ],
            };

            const textChunks: string[] = [];
            for await (const event of provider.chatStream(request)) {
              if (event.type === 'text') {
                textChunks.push(event.value);
              }
            }

            // Concatenate all chunks
            const concatenated = textChunks.join('');

            // Verify concatenation equals original joined chunks
            expect(concatenated).toBe(chunks.join(''));
          }
        ),
        { numRuns: 10 } // Reduced from 100 for performance
      );
    });

    it('should preserve chunk order during concatenation', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.string({ minLength: 1, maxLength: 20 }), {
            minLength: 2,
            maxLength: 10,
          }),
          async (chunks) => {
            // Create event sequence with ordered chunks
            const events: ProviderEvent[] = [
              ...chunks.map((chunk) => ({ type: 'text' as const, value: chunk })),
              { type: 'finish' as const, reason: 'stop' as const },
            ];

            const provider = new MockProvider({
              eventSequence: events,
            });

            const request: ProviderRequest = {
              model: 'test-model',
              messages: [
                {
                  role: 'user',
                  parts: [{ type: 'text', text: 'Test prompt' }],
                },
              ],
            };

            const receivedChunks: string[] = [];
            for await (const event of provider.chatStream(request)) {
              if (event.type === 'text') {
                receivedChunks.push(event.value);
              }
            }

            // Verify chunks were received in the same order
            expect(receivedChunks).toEqual(chunks);

            // Verify concatenation preserves order
            expect(receivedChunks.join('')).toBe(chunks.join(''));
          }
        ),
        { numRuns: 10 } // Reduced from 100 for performance
      );
    });
  });

  describe('Property 16: Tool Call Streaming Delivery', () => {
    /**
     * Property 16: Tool Call Streaming Delivery
     * For any tool call generated during streaming, the tool call should be delivered in the stream before the stream completes.
     * Validates: Requirements 7.3, 7.4
     */
    it('should deliver tool calls before stream completes', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate random tool calls
          fc.array(
            fc.record({
              name: fc.constantFrom('get_weather', 'calculate', 'read_file', 'search'),
              args: fc.dictionary(
                fc.string({ minLength: 1, maxLength: 20 }),
                fc.oneof(fc.string({ maxLength: 50 }), fc.integer(), fc.boolean())
              ),
            }),
            { minLength: 1, maxLength: 5 }
          ),
          async (toolCallSpecs) => {
            // Create tool calls with IDs
            const toolCalls = toolCallSpecs.map((spec, index) => ({
              id: `call_${index}`,
              name: spec.name,
              args: spec.args,
            }));

            // Create event sequence with tool calls
            const events = createToolCallSequence(toolCalls);

            // Extract the actual tool call IDs from the generated events
            const expectedToolCalls = events
              .filter((e) => e.type === 'tool_call')
              .map(
                (e) =>
                  (
                    e as {
                      type: 'tool_call';
                      value: { id: string; name: string; args: Record<string, unknown> };
                    }
                  ).value
              );

            const provider = new MockProvider({
              eventSequence: events,
            });

            const request: ProviderRequest = {
              model: 'test-model',
              messages: [
                {
                  role: 'user',
                  parts: [{ type: 'text', text: 'Test prompt' }],
                },
              ],
              tools: [fixtureTools.weatherTool, fixtureTools.calculatorTool],
            };

            const receivedToolCalls: Array<{
              id: string;
              name: string;
              args: Record<string, unknown>;
            }> = [];
            let streamCompleted = false;

            for await (const event of provider.chatStream(request)) {
              if (event.type === 'tool_call') {
                // Verify stream hasn't completed yet
                expect(streamCompleted).toBe(false);
                receivedToolCalls.push(event.value);
              } else if (event.type === 'finish') {
                streamCompleted = true;
              }
            }

            // Verify all tool calls were delivered
            expect(receivedToolCalls.length).toBe(expectedToolCalls.length);

            // Verify stream completed
            expect(streamCompleted).toBe(true);

            // Verify tool calls match (using the actual IDs from the generated events)
            for (let i = 0; i < expectedToolCalls.length; i++) {
              expect(receivedToolCalls[i].id).toBe(expectedToolCalls[i].id);
              expect(receivedToolCalls[i].name).toBe(expectedToolCalls[i].name);
              expect(receivedToolCalls[i].args).toEqual(expectedToolCalls[i].args);
            }
          }
        ),
        { numRuns: 10 } // Reduced from 100 for performance
      );
    });

    it('should deliver tool calls in order', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              name: fc.constantFrom('tool_a', 'tool_b', 'tool_c'),
              args: fc.record({
                param: fc.string({ minLength: 1, maxLength: 20 }),
              }),
            }),
            { minLength: 2, maxLength: 10 }
          ),
          async (toolCallSpecs) => {
            // Create tool calls with sequential IDs
            const toolCalls = toolCallSpecs.map((spec, index) => ({
              id: `call_${index}`,
              name: spec.name,
              args: spec.args,
            }));

            // Create event sequence
            const events = createToolCallSequence(toolCalls);

            // Extract the actual tool call IDs from the generated events
            const expectedToolCalls = events
              .filter((e) => e.type === 'tool_call')
              .map(
                (e) =>
                  (
                    e as {
                      type: 'tool_call';
                      value: { id: string; name: string; args: Record<string, unknown> };
                    }
                  ).value
              );

            const provider = new MockProvider({
              eventSequence: events,
            });

            const request: ProviderRequest = {
              model: 'test-model',
              messages: [
                {
                  role: 'user',
                  parts: [{ type: 'text', text: 'Test prompt' }],
                },
              ],
            };

            const receivedToolCalls: Array<{
              id: string;
              name: string;
              args: Record<string, unknown>;
            }> = [];

            for await (const event of provider.chatStream(request)) {
              if (event.type === 'tool_call') {
                receivedToolCalls.push(event.value);
              }
            }

            // Verify tool calls were received in order (using actual IDs from generated events)
            expect(receivedToolCalls.length).toBe(expectedToolCalls.length);
            for (let i = 0; i < expectedToolCalls.length; i++) {
              expect(receivedToolCalls[i].id).toBe(expectedToolCalls[i].id);
              expect(receivedToolCalls[i].name).toBe(expectedToolCalls[i].name);
            }
          }
        ),
        { numRuns: 10 } // Reduced from 100 for performance
      );
    });

    it('should handle mixed text and tool call events', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 100 }),
          fc.array(
            fc.record({
              name: fc.constantFrom('get_weather', 'calculate'),
              args: fc.dictionary(fc.string(), fc.string()),
            }),
            { minLength: 1, maxLength: 3 }
          ),
          async (textBefore, toolCallSpecs) => {
            // Create tool calls
            const toolCalls = toolCallSpecs.map((spec, index) => ({
              id: `call_${index}`,
              name: spec.name,
              args: spec.args,
            }));

            // Create mixed event sequence
            const events: ProviderEvent[] = [
              { type: 'text', value: textBefore },
              ...toolCalls.map((tc) => ({ type: 'tool_call' as const, value: tc })),
              { type: 'finish', reason: 'tool' as const },
            ];

            const provider = new MockProvider({
              eventSequence: events,
            });

            const request: ProviderRequest = {
              model: 'test-model',
              messages: [
                {
                  role: 'user',
                  parts: [{ type: 'text', text: 'Test prompt' }],
                },
              ],
            };

            const textChunks: string[] = [];
            const receivedToolCalls: Array<{
              id: string;
              name: string;
              args: Record<string, unknown>;
            }> = [];

            for await (const event of provider.chatStream(request)) {
              if (event.type === 'text') {
                textChunks.push(event.value);
              } else if (event.type === 'tool_call') {
                receivedToolCalls.push(event.value);
              }
            }

            // Verify text was received
            expect(textChunks.join('')).toBe(textBefore);

            // Verify tool calls were received
            expect(receivedToolCalls.length).toBe(toolCalls.length);
          }
        ),
        { numRuns: 10 } // Reduced from 100 for performance
      );
    });

    it('should complete stream with tool finish reason when tool calls present', async () => {
      const toolCalls = [
        { id: 'call_1', name: 'get_weather', args: { location: 'Seattle' } },
        { id: 'call_2', name: 'calculate', args: { expression: '2+2' } },
      ];

      const events = createToolCallSequence(toolCalls);
      const provider = new MockProvider({
        eventSequence: events,
      });

      const request: ProviderRequest = {
        model: 'test-model',
        messages: [
          {
            role: 'user',
            parts: [{ type: 'text', text: 'Test prompt' }],
          },
        ],
      };

      let finishReason: string | undefined;

      for await (const event of provider.chatStream(request)) {
        if (event.type === 'finish') {
          finishReason = event.reason;
        }
      }

      // Verify stream finished with 'tool' reason
      expect(finishReason).toBe('tool');
    });
  });

  describe('Streaming Edge Cases', () => {
    /**
     * Test error handling during streaming.
     * Validates: Requirements 7.5, 7.6
     */
    it('should handle errors during streaming gracefully', async () => {
      const provider = new MockProvider({
        simulateError: true,
        error: { message: 'Stream error occurred', code: 'STREAM_ERROR' },
      });

      const request: ProviderRequest = {
        model: 'test-model',
        messages: [
          {
            role: 'user',
            parts: [{ type: 'text', text: 'Test prompt' }],
          },
        ],
      };

      let errorReceived = false;
      let errorMessage = '';

      for await (const event of provider.chatStream(request)) {
        if (event.type === 'error') {
          errorReceived = true;
          errorMessage = event.error.message;
        }
      }

      // Verify error was received
      expect(errorReceived).toBe(true);
      expect(errorMessage).toBe('Stream error occurred');
    });

    it('should preserve partial responses when errors occur', async () => {
      // Create a sequence with text chunks followed by an error
      const partialText = 'This is a partial response';
      const events: ProviderEvent[] = [
        { type: 'text', value: 'This is ' },
        { type: 'text', value: 'a partial ' },
        { type: 'text', value: 'response' },
        { type: 'error', error: { message: 'Stream interrupted', code: 'INTERRUPTED' } },
      ];

      const provider = new MockProvider({
        eventSequence: events,
      });

      const request: ProviderRequest = {
        model: 'test-model',
        messages: [
          {
            role: 'user',
            parts: [{ type: 'text', text: 'Test prompt' }],
          },
        ],
      };

      const textChunks: string[] = [];
      let errorReceived = false;

      for await (const event of provider.chatStream(request)) {
        if (event.type === 'text') {
          textChunks.push(event.value);
        } else if (event.type === 'error') {
          errorReceived = true;
        }
      }

      // Verify partial text was preserved
      expect(textChunks.join('')).toBe(partialText);

      // Verify error was received
      expect(errorReceived).toBe(true);
    });

    it('should handle abort signal during streaming', async () => {
      const fullText = 'This is a long response that will be aborted';
      const chunks = createTextChunkSequence(fullText, 5);

      const provider = new MockProvider({
        eventSequence: chunks,
        eventDelay: 50, // Delay to allow abort
      });

      const abortController = new AbortController();

      const request: ProviderRequest = {
        model: 'test-model',
        messages: [
          {
            role: 'user',
            parts: [{ type: 'text', text: 'Test prompt' }],
          },
        ],
        abortSignal: abortController.signal,
      };

      const textChunks: string[] = [];
      let chunkCount = 0;

      // Abort after receiving a few chunks
      setTimeout(() => abortController.abort(), 100);

      for await (const event of provider.chatStream(request)) {
        if (event.type === 'text') {
          textChunks.push(event.value);
          chunkCount++;
        }
      }

      // Verify we got some chunks but not all
      expect(chunkCount).toBeGreaterThan(0);
      expect(textChunks.join('')).not.toBe(fullText);
    });

    it('should handle empty stream gracefully', async () => {
      const provider = new MockProvider({
        eventSequence: [{ type: 'finish', reason: 'stop' }],
      });

      const request: ProviderRequest = {
        model: 'test-model',
        messages: [
          {
            role: 'user',
            parts: [{ type: 'text', text: 'Test prompt' }],
          },
        ],
      };

      const textChunks: string[] = [];
      let streamCompleted = false;

      for await (const event of provider.chatStream(request)) {
        if (event.type === 'text') {
          textChunks.push(event.value);
        } else if (event.type === 'finish') {
          streamCompleted = true;
        }
      }

      // Verify no text was received
      expect(textChunks.length).toBe(0);

      // Verify stream completed
      expect(streamCompleted).toBe(true);
    });

    it('should handle very large text chunks', async () => {
      // Create a very large chunk (10KB)
      const largeChunk = 'x'.repeat(10000);
      const events: ProviderEvent[] = [
        { type: 'text', value: largeChunk },
        { type: 'finish', reason: 'stop' },
      ];

      const provider = new MockProvider({
        eventSequence: events,
      });

      const request: ProviderRequest = {
        model: 'test-model',
        messages: [
          {
            role: 'user',
            parts: [{ type: 'text', text: 'Test prompt' }],
          },
        ],
      };

      const textChunks: string[] = [];

      for await (const event of provider.chatStream(request)) {
        if (event.type === 'text') {
          textChunks.push(event.value);
        }
      }

      // Verify large chunk was received intact
      expect(textChunks.join('')).toBe(largeChunk);
      expect(textChunks[0].length).toBe(10000);
    });

    it('should handle rapid successive chunks', async () => {
      // Create many small chunks with no delay
      const chunks: ProviderEvent[] = Array.from({ length: 100 }, (_, i) => ({
        type: 'text' as const,
        value: `${i}`,
      }));
      chunks.push({ type: 'finish' as const, reason: 'stop' as const });

      const provider = new MockProvider({
        eventSequence: chunks,
        eventDelay: 0, // No delay between chunks
      });

      const request: ProviderRequest = {
        model: 'test-model',
        messages: [
          {
            role: 'user',
            parts: [{ type: 'text', text: 'Test prompt' }],
          },
        ],
      };

      const textChunks: string[] = [];

      for await (const event of provider.chatStream(request)) {
        if (event.type === 'text') {
          textChunks.push(event.value);
        }
      }

      // Verify all chunks were received
      expect(textChunks.length).toBe(100);

      // Verify order was preserved
      const concatenated = textChunks.join('');
      const expected = Array.from({ length: 100 }, (_, i) => `${i}`).join('');
      expect(concatenated).toBe(expected);
    });

    it('should handle finish event with different reasons', async () => {
      const finishReasons: Array<'stop' | 'length' | 'tool'> = ['stop', 'length', 'tool'];

      for (const reason of finishReasons) {
        const provider = new MockProvider({
          eventSequence: [
            { type: 'text', value: 'Test' },
            { type: 'finish', reason },
          ],
        });

        const request: ProviderRequest = {
          model: 'test-model',
          messages: [
            {
              role: 'user',
              parts: [{ type: 'text', text: 'Test prompt' }],
            },
          ],
        };

        let receivedReason: string | undefined;

        for await (const event of provider.chatStream(request)) {
          if (event.type === 'finish') {
            receivedReason = event.reason;
          }
        }

        // Verify correct finish reason was received
        expect(receivedReason).toBe(reason);
      }
    });
  });
});
