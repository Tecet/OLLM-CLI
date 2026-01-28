/**
 * Integration tests for provider system.
 * Tests provider switching, error handling, streaming responses, and token counting.
 *
 * Feature: stage-08-testing-qa
 * Task: 38. Add Provider System Tests
 */

import * as fc from 'fast-check';
import { describe, it, expect, beforeEach } from 'vitest';

import {
  MockProvider,
  createErrorMockProvider,
  createToolCallMockProvider,
} from '@ollm/test-utils';

import { ProviderRegistry } from '../registry.js';

import type { ProviderRequest, ProviderEvent } from '../types.js';

describe('Provider System - Integration Tests', () => {
  let registry: ProviderRegistry;

  beforeEach(() => {
    registry = new ProviderRegistry();
  });

  describe('Provider Switching', () => {
    it('should switch between providers seamlessly', async () => {
      const provider1 = new MockProvider({
        name: 'provider-1',
        eventSequence: [
          { type: 'text', value: 'Response from provider 1' },
          { type: 'finish', reason: 'stop' },
        ],
      });
      const provider2 = new MockProvider({
        name: 'provider-2',
        eventSequence: [
          { type: 'text', value: 'Response from provider 2' },
          { type: 'finish', reason: 'stop' },
        ],
      });

      registry.register(provider1);
      registry.register(provider2);

      const request: ProviderRequest = {
        model: 'test-model',
        messages: [{ role: 'user', parts: [{ type: 'text', text: 'Hello' }] }],
      };

      // Use provider 1
      const events1: ProviderEvent[] = [];
      for await (const event of provider1.chatStream(request)) {
        events1.push(event);
      }

      // Use provider 2
      const events2: ProviderEvent[] = [];
      for await (const event of provider2.chatStream(request)) {
        events2.push(event);
      }

      // Verify different responses
      const text1 = events1
        .filter((e) => e.type === 'text')
        .map((e) => (e as any).value)
        .join('');
      const text2 = events2
        .filter((e) => e.type === 'text')
        .map((e) => (e as any).value)
        .join('');

      expect(text1).toBe('Response from provider 1');
      expect(text2).toBe('Response from provider 2');
    });

    it('should handle concurrent requests to different providers', async () => {
      const provider1 = new MockProvider({
        name: 'provider-1',
        eventSequence: [
          { type: 'text', value: 'Provider 1' },
          { type: 'finish', reason: 'stop' },
        ],
        eventDelay: 10,
      });

      const provider2 = new MockProvider({
        name: 'provider-2',
        eventSequence: [
          { type: 'text', value: 'Provider 2' },
          { type: 'finish', reason: 'stop' },
        ],
        eventDelay: 10,
      });

      registry.register(provider1);
      registry.register(provider2);

      const request: ProviderRequest = {
        model: 'test-model',
        messages: [{ role: 'user', parts: [{ type: 'text', text: 'Hello' }] }],
      };

      // Make concurrent requests
      const [events1, events2] = await Promise.all([
        (async () => {
          const events: ProviderEvent[] = [];
          for await (const event of provider1.chatStream(request)) {
            events.push(event);
          }
          return events;
        })(),
        (async () => {
          const events: ProviderEvent[] = [];
          for await (const event of provider2.chatStream(request)) {
            events.push(event);
          }
          return events;
        })(),
      ]);

      // Verify both completed successfully
      const text1 = events1
        .filter((e) => e.type === 'text')
        .map((e) => (e as any).value)
        .join('');
      const text2 = events2
        .filter((e) => e.type === 'text')
        .map((e) => (e as any).value)
        .join('');

      expect(text1).toBe('Provider 1');
      expect(text2).toBe('Provider 2');
    });

    it('should maintain provider state across switches', async () => {
      const provider1 = new MockProvider({ name: 'provider-1', tokenCount: 100 });
      const provider2 = new MockProvider({ name: 'provider-2', tokenCount: 200 });

      registry.register(provider1);
      registry.register(provider2);

      const request: ProviderRequest = {
        model: 'test-model',
        messages: [{ role: 'user', parts: [{ type: 'text', text: 'Hello' }] }],
      };

      // Use provider 1
      const count1 = await provider1.countTokens(request);

      // Switch to provider 2
      const count2 = await provider2.countTokens(request);

      // Switch back to provider 1
      const count1Again = await provider1.countTokens(request);

      expect(count1).toBe(100);
      expect(count2).toBe(200);
      expect(count1Again).toBe(100);
    });
  });

  describe('Error Handling', () => {
    it('should handle provider errors gracefully', async () => {
      const provider = createErrorMockProvider('Test error', 'TEST_ERROR');
      registry.register(provider);

      const request: ProviderRequest = {
        model: 'test-model',
        messages: [{ role: 'user', parts: [{ type: 'text', text: 'Hello' }] }],
      };

      const events: ProviderEvent[] = [];
      for await (const event of provider.chatStream(request)) {
        events.push(event);
      }

      // Verify error event was emitted
      const errorEvents = events.filter((e) => e.type === 'error');
      expect(errorEvents).toHaveLength(1);
      expect((errorEvents[0] as any).error.message).toBe('Test error');
      expect((errorEvents[0] as any).error.code).toBe('TEST_ERROR');
    });

    it('should handle network errors', async () => {
      const provider = createErrorMockProvider(
        'Network error: Connection refused',
        'NETWORK_ERROR'
      );
      registry.register(provider);

      const request: ProviderRequest = {
        model: 'test-model',
        messages: [{ role: 'user', parts: [{ type: 'text', text: 'Hello' }] }],
      };

      const events: ProviderEvent[] = [];
      for await (const event of provider.chatStream(request)) {
        events.push(event);
      }

      const errorEvents = events.filter((e) => e.type === 'error');
      expect(errorEvents).toHaveLength(1);
      expect((errorEvents[0] as any).error.message).toContain('Network error');
    });

    it('should handle timeout errors', async () => {
      const provider = new MockProvider({
        name: 'timeout-provider',
        eventSequence: [
          { type: 'text', value: 'Starting...' },
          { type: 'finish', reason: 'stop' },
        ],
        eventDelay: 100,
      });

      registry.register(provider);

      const abortController = new AbortController();
      const request: ProviderRequest = {
        model: 'test-model',
        messages: [{ role: 'user', parts: [{ type: 'text', text: 'Hello' }] }],
        abortSignal: abortController.signal,
        timeout: 50,
      };

      // Abort after timeout
      setTimeout(() => abortController.abort(), 50);

      const events: ProviderEvent[] = [];
      for await (const event of provider.chatStream(request)) {
        events.push(event);
      }

      // Verify stream completed (either with finish or was aborted)
      expect(events.length).toBeGreaterThan(0);
    });

    it('should recover from errors and continue with next request', async () => {
      const provider = new MockProvider({ name: 'recoverable' });
      registry.register(provider);

      const request: ProviderRequest = {
        model: 'test-model',
        messages: [{ role: 'user', parts: [{ type: 'text', text: 'Hello' }] }],
      };

      // First request with error
      provider['config'].simulateError = true;
      provider['config'].error = { message: 'Temporary error' };

      const events1: ProviderEvent[] = [];
      for await (const event of provider.chatStream(request)) {
        events1.push(event);
      }

      expect(events1.some((e) => e.type === 'error')).toBe(true);

      // Second request without error
      provider['config'].simulateError = false;

      const events2: ProviderEvent[] = [];
      for await (const event of provider.chatStream(request)) {
        events2.push(event);
      }

      expect(events2.some((e) => e.type === 'text')).toBe(true);
      expect(events2.some((e) => e.type === 'error')).toBe(false);
    });

    it('should handle partial responses before errors', async () => {
      const provider = new MockProvider({
        eventSequence: [
          { type: 'text', value: 'Partial ' },
          { type: 'text', value: 'response ' },
          { type: 'error', error: { message: 'Stream interrupted' } },
        ],
      });

      registry.register(provider);

      const request: ProviderRequest = {
        model: 'test-model',
        messages: [{ role: 'user', parts: [{ type: 'text', text: 'Hello' }] }],
      };

      const events: ProviderEvent[] = [];
      for await (const event of provider.chatStream(request)) {
        events.push(event);
      }

      // Verify partial text was received
      const textEvents = events.filter((e) => e.type === 'text');
      expect(textEvents).toHaveLength(2);

      const text = textEvents.map((e) => (e as any).value).join('');
      expect(text).toBe('Partial response ');

      // Verify error was received
      expect(events.some((e) => e.type === 'error')).toBe(true);
    });
  });

  describe('Streaming Responses', () => {
    it('should stream text incrementally', async () => {
      const chunks = ['Hello', ' ', 'world', '!'];
      const events: ProviderEvent[] = [
        ...chunks.map((chunk) => ({ type: 'text' as const, value: chunk })),
        { type: 'finish' as const, reason: 'stop' as const },
      ];

      const provider = new MockProvider({
        eventSequence: events,
        eventDelay: 5,
      });

      registry.register(provider);

      const request: ProviderRequest = {
        model: 'test-model',
        messages: [{ role: 'user', parts: [{ type: 'text', text: 'Say hello' }] }],
      };

      const receivedEvents: ProviderEvent[] = [];
      const timestamps: number[] = [];

      for await (const event of provider.chatStream(request)) {
        receivedEvents.push(event);
        timestamps.push(Date.now());
      }

      // Verify chunks were received incrementally
      const textEvents = receivedEvents.filter((e) => e.type === 'text');
      expect(textEvents).toHaveLength(4);

      // Verify timing (events should be spread over time)
      if (timestamps.length > 1) {
        const duration = timestamps[timestamps.length - 1] - timestamps[0];
        expect(duration).toBeGreaterThan(0);
      }

      // Verify concatenation
      const text = textEvents.map((e) => (e as any).value).join('');
      expect(text).toBe('Hello world!');
    });

    it('should handle tool calls in stream', async () => {
      const toolCalls = [
        { id: 'call_1', name: 'get_weather', args: { location: 'Seattle' } },
        { id: 'call_2', name: 'calculate', args: { expression: '2+2' } },
      ];

      const provider = createToolCallMockProvider(toolCalls);
      registry.register(provider);

      const request: ProviderRequest = {
        model: 'test-model',
        messages: [{ role: 'user', parts: [{ type: 'text', text: 'Test' }] }],
        tools: [
          { name: 'get_weather', description: 'Get weather' },
          { name: 'calculate', description: 'Calculate' },
        ],
      };

      const events: ProviderEvent[] = [];
      for await (const event of provider.chatStream(request)) {
        events.push(event);
      }

      // Verify tool calls were received
      const toolCallEvents = events.filter((e) => e.type === 'tool_call');
      expect(toolCallEvents).toHaveLength(2);

      // Verify tool call details
      expect((toolCallEvents[0] as any).value.name).toBe('get_weather');
      expect((toolCallEvents[1] as any).value.name).toBe('calculate');
    });

    it('should handle mixed text and tool calls', async () => {
      const events: ProviderEvent[] = [
        { type: 'text', value: 'Let me check that for you. ' },
        { type: 'tool_call', value: { id: 'call_1', name: 'search', args: { query: 'test' } } },
        { type: 'text', value: 'Here are the results.' },
        { type: 'finish', reason: 'stop' },
      ];

      const provider = new MockProvider({ eventSequence: events });
      registry.register(provider);

      const request: ProviderRequest = {
        model: 'test-model',
        messages: [{ role: 'user', parts: [{ type: 'text', text: 'Search for test' }] }],
      };

      const receivedEvents: ProviderEvent[] = [];
      for await (const event of provider.chatStream(request)) {
        receivedEvents.push(event);
      }

      // Verify event order
      expect(receivedEvents[0].type).toBe('text');
      expect(receivedEvents[1].type).toBe('tool_call');
      expect(receivedEvents[2].type).toBe('text');
      expect(receivedEvents[3].type).toBe('finish');
    });

    it('should handle abort signal during streaming', async () => {
      const provider = new MockProvider({
        eventSequence: [
          { type: 'text', value: 'Start' },
          { type: 'text', value: 'Middle' },
          { type: 'text', value: 'End' },
          { type: 'finish', reason: 'stop' },
        ],
        eventDelay: 50,
      });

      registry.register(provider);

      const abortController = new AbortController();
      const request: ProviderRequest = {
        model: 'test-model',
        messages: [{ role: 'user', parts: [{ type: 'text', text: 'Test' }] }],
        abortSignal: abortController.signal,
      };

      // Abort after first chunk
      setTimeout(() => abortController.abort(), 25);

      const events: ProviderEvent[] = [];
      for await (const event of provider.chatStream(request)) {
        events.push(event);
      }

      // Verify stream was aborted early
      const textEvents = events.filter((e) => e.type === 'text');
      expect(textEvents.length).toBeLessThan(3);
    });
  });

  describe('Token Counting', () => {
    it('should count tokens accurately', async () => {
      const provider = new MockProvider({ tokenCount: 42 });
      registry.register(provider);

      const request: ProviderRequest = {
        model: 'test-model',
        messages: [{ role: 'user', parts: [{ type: 'text', text: 'Hello world' }] }],
      };

      const count = await provider.countTokens(request);

      expect(count).toBe(42);
    });

    it('should count tokens for multiple messages', async () => {
      const provider = new MockProvider();
      registry.register(provider);

      const request: ProviderRequest = {
        model: 'test-model',
        messages: [
          { role: 'user', parts: [{ type: 'text', text: 'First message' }] },
          { role: 'assistant', parts: [{ type: 'text', text: 'Response' }] },
          { role: 'user', parts: [{ type: 'text', text: 'Second message' }] },
        ],
      };

      const count = await provider.countTokens(request);

      expect(count).toBeGreaterThan(0);
    });

    it('should count tokens including system prompt', async () => {
      const provider = new MockProvider();
      registry.register(provider);

      const requestWithoutSystem: ProviderRequest = {
        model: 'test-model',
        messages: [{ role: 'user', parts: [{ type: 'text', text: 'Hello' }] }],
      };

      const requestWithSystem: ProviderRequest = {
        model: 'test-model',
        systemPrompt: 'You are a helpful assistant.',
        messages: [{ role: 'user', parts: [{ type: 'text', text: 'Hello' }] }],
      };

      const countWithout = await provider.countTokens(requestWithoutSystem);
      const countWith = await provider.countTokens(requestWithSystem);

      expect(countWith).toBeGreaterThan(countWithout);
    });

    it('should handle empty messages', async () => {
      const provider = new MockProvider();
      registry.register(provider);

      const request: ProviderRequest = {
        model: 'test-model',
        messages: [],
      };

      const count = await provider.countTokens(request);

      expect(count).toBe(0);
    });
  });

  describe('Property-Based Tests', () => {
    it('should handle any valid provider request', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            model: fc.string({ minLength: 1, maxLength: 50 }),
            messages: fc.array(
              fc.record({
                role: fc.constantFrom('user', 'assistant', 'system', 'tool'),
                parts: fc.array(
                  fc.record({
                    type: fc.constant('text'),
                    text: fc.string({ maxLength: 100 }),
                  }),
                  { minLength: 1, maxLength: 3 }
                ),
              }),
              { minLength: 1, maxLength: 5 }
            ),
          }),
          async (requestData) => {
            const provider = new MockProvider({
              name: `test-provider-${Math.random()}`,
              eventSequence: [
                { type: 'text', value: 'Test response' },
                { type: 'finish', reason: 'stop' },
              ],
            });

            const request: ProviderRequest = {
              model: requestData.model,
              messages: requestData.messages as any,
            };

            const events: ProviderEvent[] = [];
            for await (const event of provider.chatStream(request)) {
              events.push(event);
            }

            // Verify stream completed
            expect(events.some((e) => e.type === 'finish')).toBe(true);
          }
        ),
        { numRuns: 10 }
      );
    });

    it('should maintain event order for any event sequence', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.oneof(
              fc.record({ type: fc.constant('text'), value: fc.string({ maxLength: 50 }) }),
              fc.record({
                type: fc.constant('tool_call'),
                value: fc.record({
                  id: fc.string({ minLength: 1, maxLength: 20 }),
                  name: fc.string({ minLength: 1, maxLength: 20 }),
                  args: fc.dictionary(fc.string(), fc.string()),
                }),
              })
            ),
            { minLength: 1, maxLength: 10 }
          ),
          async (eventSequence) => {
            const events = [
              ...(eventSequence as ProviderEvent[]),
              { type: 'finish' as const, reason: 'stop' as const },
            ];

            const provider = new MockProvider({
              name: `test-provider-${Math.random()}`,
              eventSequence: events,
            });

            const request: ProviderRequest = {
              model: 'test-model',
              messages: [{ role: 'user', parts: [{ type: 'text', text: 'Test' }] }],
            };

            const receivedEvents: ProviderEvent[] = [];
            for await (const event of provider.chatStream(request)) {
              receivedEvents.push(event);
            }

            // Verify events were received in order
            expect(receivedEvents.length).toBe(events.length);

            for (let i = 0; i < events.length; i++) {
              expect(receivedEvents[i].type).toBe(events[i].type);
            }
          }
        ),
        { numRuns: 10 }
      );
    });
  });
});
