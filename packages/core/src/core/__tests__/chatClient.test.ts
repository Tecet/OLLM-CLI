/**
 * Property-based and unit tests for Chat Client.
 * These tests validate the correctness properties defined in the design document.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import fc from 'fast-check';
import { ChatClient, type ChatEvent } from '../chatClient.js';
import { ProviderRegistry } from '../../provider/registry.js';
import type { ProviderAdapter, ProviderEvent, ProviderRequest } from '../../provider/types.js';
import type { ToolRegistry, Tool } from '../turn.js';

/**
 * Mock provider that emits a configurable sequence of events
 */
class MockProvider implements ProviderAdapter {
  name = 'mock';
  private events: ProviderEvent[];

  constructor(events: ProviderEvent[]) {
    this.events = events;
  }

  async *chatStream(_request: ProviderRequest): AsyncIterable<ProviderEvent> {
    for (const event of this.events) {
      yield event;
    }
  }
}

/**
 * Mock tool registry for testing
 */
class MockToolRegistry implements ToolRegistry {
  private tools: Map<string, Tool> = new Map();

  register(name: string, tool: Tool): void {
    this.tools.set(name, tool);
  }

  get(name: string): Tool | undefined {
    return this.tools.get(name);
  }
}

/**
 * Collect all events from an async iterable
 */
async function collectEvents(iterable: AsyncIterable<ChatEvent>): Promise<ChatEvent[]> {
  const events: ChatEvent[] = [];
  for await (const event of iterable) {
    events.push(event);
  }
  return events;
}

describe('Chat Client - Property-Based Tests', () => {
  let providerRegistry: ProviderRegistry;
  let toolRegistry: MockToolRegistry;

  beforeEach(() => {
    providerRegistry = new ProviderRegistry();
    toolRegistry = new MockToolRegistry();
  });

  describe('Property 4: Event Stream Forwarding', () => {
    it('should forward all provider events in the same order', async () => {
      // Feature: stage-02-core-provider, Property 4: Event Stream Forwarding
      // Validates: Requirements 2.1, 2.2, 2.3, 2.4
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.oneof(
              fc.record({ type: fc.constant('text' as const), value: fc.string() }),
              fc.record({
                type: fc.constant('finish' as const),
                reason: fc.constantFrom('stop' as const, 'length' as const, 'tool' as const),
              })
            ),
            { minLength: 1, maxLength: 10 }
          ),
          async (providerEvents: ProviderEvent[]) => {
            // Ensure we have a finish event at the end
            const eventsWithFinish = [
              ...providerEvents.filter((e) => e.type !== 'finish'),
              { type: 'finish' as const, reason: 'stop' as const },
            ];

            const provider = new MockProvider(eventsWithFinish);
            providerRegistry.register(provider);
            providerRegistry.setDefault('mock');

            const client = new ChatClient(providerRegistry, toolRegistry);
            const events = await collectEvents(client.chat('test prompt'));

            // Extract text events from chat events
            const textEvents = events.filter((e) => e.type === 'text');
            const providerTextEvents = eventsWithFinish.filter((e) => e.type === 'text');

            // Should have the same number of text events
            expect(textEvents.length).toBe(providerTextEvents.length);

            // Text events should be in the same order with same content
            for (let i = 0; i < textEvents.length; i++) {
              expect(textEvents[i].type).toBe('text');
              if (textEvents[i].type === 'text' && providerTextEvents[i].type === 'text') {
                expect(textEvents[i].value).toBe(providerTextEvents[i].value);
              }
            }

            // Should have turn_complete and finish events
            const turnCompleteEvents = events.filter((e) => e.type === 'turn_complete');
            const finishEvents = events.filter((e) => e.type === 'finish');

            expect(turnCompleteEvents.length).toBeGreaterThan(0);
            expect(finishEvents.length).toBe(1);
            expect(finishEvents[0].type).toBe('finish');

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should emit error events when provider emits errors', async () => {
      // Feature: stage-02-core-provider, Property 4: Event Stream Forwarding
      // Validates: Requirements 2.1, 2.2, 2.3, 2.4
      await fc.assert(
        fc.asyncProperty(fc.string(), async (errorMessage: string) => {
          const providerEvents: ProviderEvent[] = [
            { type: 'error', error: { message: errorMessage } },
          ];

          const provider = new MockProvider(providerEvents);
          providerRegistry.register(provider);
          providerRegistry.setDefault('mock');

          const client = new ChatClient(providerRegistry, toolRegistry);
          const events = await collectEvents(client.chat('test prompt'));

          // Should have an error event
          const errorEvents = events.filter((e) => e.type === 'error');
          expect(errorEvents.length).toBeGreaterThan(0);

          if (errorEvents[0].type === 'error') {
            // Error message should contain the original error message
            expect(errorEvents[0].error.message).toContain(errorMessage);
          }

          // Should have finish event with error reason
          const finishEvents = events.filter((e) => e.type === 'finish');
          expect(finishEvents.length).toBe(1);
          if (finishEvents[0].type === 'finish') {
            expect(finishEvents[0].reason).toBe('error');
          }

          return true;
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 5: Abort Signal Cancellation', () => {
    it('should terminate stream when abort signal is triggered', async () => {
      // Feature: stage-02-core-provider, Property 5: Abort Signal Cancellation
      // Validates: Requirements 2.5

      // Create a provider that emits tool calls to trigger multiple turns
      const providerEvents: ProviderEvent[] = [
        { type: 'text', value: 'Calling tool' },
        {
          type: 'tool_call',
          value: { id: '1', name: 'test_tool', args: {} },
        },
        { type: 'finish', reason: 'tool' },
      ];

      const provider = new MockProvider(providerEvents);
      providerRegistry.register(provider);
      providerRegistry.setDefault('mock');

      // Register a mock tool
      toolRegistry.register('test_tool', {
        execute: async () => ({ result: 'success' }),
      });

      const abortController = new AbortController();
      const client = new ChatClient(providerRegistry, toolRegistry);

      const events: ChatEvent[] = [];
      let turnCount = 0;

      // Start chat with abort signal
      const chatIterator = client.chat('test prompt', {
        abortSignal: abortController.signal,
        maxTurns: 10,
      });

      // Collect events and abort after first turn
      for await (const event of chatIterator) {
        events.push(event);

        if (event.type === 'turn_complete') {
          turnCount++;
          if (turnCount === 1) {
            // Abort after first turn
            abortController.abort();
          }
        }
      }

      // Should have stopped after abort
      const finishEvents = events.filter((e) => e.type === 'finish');
      expect(finishEvents.length).toBe(1);

      if (finishEvents[0].type === 'finish') {
        expect(finishEvents[0].reason).toBe('cancelled');
      }

      // Should not have exceeded 2 turns (first turn + partial second turn)
      const turnCompleteEvents = events.filter((e) => e.type === 'turn_complete');
      expect(turnCompleteEvents.length).toBeLessThanOrEqual(2);
    });
  });

  describe('Property 9: Maximum Turn Limit', () => {
    it('should terminate after reaching max turns', async () => {
      // Feature: stage-02-core-provider, Property 9: Maximum Turn Limit
      // Validates: Requirements 3.5
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 5 }),
          async (maxTurns: number) => {
            // Create a provider that always emits tool calls (infinite loop scenario)
            const providerEvents: ProviderEvent[] = [
              { type: 'text', value: 'Calling tool' },
              {
                type: 'tool_call',
                value: { id: '1', name: 'test_tool', args: {} },
              },
              { type: 'finish', reason: 'tool' },
            ];

            const provider = new MockProvider(providerEvents);
            providerRegistry.register(provider);
            providerRegistry.setDefault('mock');

            // Register a mock tool
            toolRegistry.register('test_tool', {
              execute: async () => ({ result: 'success' }),
            });

            const client = new ChatClient(providerRegistry, toolRegistry);
            const events = await collectEvents(
              client.chat('test prompt', { maxTurns })
            );

            // Count turn_complete events
            const turnCompleteEvents = events.filter(
              (e) => e.type === 'turn_complete'
            );
            expect(turnCompleteEvents.length).toBe(maxTurns);

            // Should have finish event with max_turns reason
            const finishEvents = events.filter((e) => e.type === 'finish');
            expect(finishEvents.length).toBe(1);

            if (finishEvents[0].type === 'finish') {
              expect(finishEvents[0].reason).toBe('max_turns');
            }

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should stop before max turns if conversation completes', async () => {
      // Feature: stage-02-core-provider, Property 9: Maximum Turn Limit
      // Validates: Requirements 3.5
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 2, max: 10 }),
          async (maxTurns: number) => {
            // Create a provider that completes without tool calls
            const providerEvents: ProviderEvent[] = [
              { type: 'text', value: 'Final answer' },
              { type: 'finish', reason: 'stop' },
            ];

            const provider = new MockProvider(providerEvents);
            providerRegistry.register(provider);
            providerRegistry.setDefault('mock');

            const client = new ChatClient(providerRegistry, toolRegistry);
            const events = await collectEvents(
              client.chat('test prompt', { maxTurns })
            );

            // Should complete in 1 turn
            const turnCompleteEvents = events.filter(
              (e) => e.type === 'turn_complete'
            );
            expect(turnCompleteEvents.length).toBe(1);

            // Should have finish event with complete reason
            const finishEvents = events.filter((e) => e.type === 'finish');
            expect(finishEvents.length).toBe(1);

            if (finishEvents[0].type === 'finish') {
              expect(finishEvents[0].reason).toBe('complete');
            }

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});

describe('Chat Client - Unit Tests', () => {
  let providerRegistry: ProviderRegistry;
  let toolRegistry: MockToolRegistry;

  beforeEach(() => {
    providerRegistry = new ProviderRegistry();
    toolRegistry = new MockToolRegistry();
  });

  describe('Single Turn Chat', () => {
    it('should complete chat with single turn and no tool calls', async () => {
      const providerEvents: ProviderEvent[] = [
        { type: 'text', value: 'Hello, ' },
        { type: 'text', value: 'world!' },
        { type: 'finish', reason: 'stop' },
      ];

      const provider = new MockProvider(providerEvents);
      providerRegistry.register(provider);
      providerRegistry.setDefault('mock');

      const client = new ChatClient(providerRegistry, toolRegistry);
      const events = await collectEvents(client.chat('Say hello'));

      // Should have text events
      const textEvents = events.filter((e) => e.type === 'text');
      expect(textEvents.length).toBe(2);
      expect(textEvents[0]).toEqual({ type: 'text', value: 'Hello, ' });
      expect(textEvents[1]).toEqual({ type: 'text', value: 'world!' });

      // Should have exactly one turn
      const turnCompleteEvents = events.filter((e) => e.type === 'turn_complete');
      expect(turnCompleteEvents.length).toBe(1);
      expect(turnCompleteEvents[0]).toEqual({ type: 'turn_complete', turnNumber: 1 });

      // Should finish with complete reason
      const finishEvents = events.filter((e) => e.type === 'finish');
      expect(finishEvents.length).toBe(1);
      expect(finishEvents[0]).toEqual({ type: 'finish', reason: 'complete' });
    });
  });

  describe('Multiple Turns with Tool Calls', () => {
    it('should handle multiple turns with tool calls', async () => {
      // First turn: model calls a tool
      const firstTurnEvents: ProviderEvent[] = [
        { type: 'text', value: 'Let me check that' },
        {
          type: 'tool_call',
          value: { id: 'call-1', name: 'get_weather', args: { city: 'NYC' } },
        },
        { type: 'finish', reason: 'tool' },
      ];

      // Second turn: model responds with tool result
      const secondTurnEvents: ProviderEvent[] = [
        { type: 'text', value: 'The weather is sunny' },
        { type: 'finish', reason: 'stop' },
      ];

      let callCount = 0;
      const provider: ProviderAdapter = {
        name: 'mock',
        async *chatStream(_request: ProviderRequest): AsyncIterable<ProviderEvent> {
          callCount++;
          const events = callCount === 1 ? firstTurnEvents : secondTurnEvents;
          for (const event of events) {
            yield event;
          }
        },
      };

      providerRegistry.register(provider);
      providerRegistry.setDefault('mock');

      // Register mock tool
      toolRegistry.register('get_weather', {
        execute: async (args) => ({
          city: args.city,
          temperature: 72,
          condition: 'sunny',
        }),
      });

      const client = new ChatClient(providerRegistry, toolRegistry);
      const events = await collectEvents(client.chat('What is the weather in NYC?'));

      // Should have tool call events
      const toolCallEvents = events.filter((e) => e.type === 'tool_call_start');
      expect(toolCallEvents.length).toBe(1);
      expect(toolCallEvents[0]).toEqual({
        type: 'tool_call_start',
        toolCall: { id: 'call-1', name: 'get_weather', args: { city: 'NYC' } },
      });

      // Should have tool result events
      const toolResultEvents = events.filter((e) => e.type === 'tool_call_result');
      expect(toolResultEvents.length).toBe(1);
      expect(toolResultEvents[0].type).toBe('tool_call_result');
      if (toolResultEvents[0].type === 'tool_call_result') {
        expect(toolResultEvents[0].toolCall.name).toBe('get_weather');
        expect(toolResultEvents[0].result).toEqual({
          city: 'NYC',
          temperature: 72,
          condition: 'sunny',
        });
      }

      // Should have two turns
      const turnCompleteEvents = events.filter((e) => e.type === 'turn_complete');
      expect(turnCompleteEvents.length).toBe(2);
      expect(turnCompleteEvents[0]).toEqual({ type: 'turn_complete', turnNumber: 1 });
      expect(turnCompleteEvents[1]).toEqual({ type: 'turn_complete', turnNumber: 2 });

      // Should finish with complete reason
      const finishEvents = events.filter((e) => e.type === 'finish');
      expect(finishEvents.length).toBe(1);
      expect(finishEvents[0]).toEqual({ type: 'finish', reason: 'complete' });
    });
  });

  describe('Max Turns Exceeded', () => {
    it('should stop after max turns with tool calls', async () => {
      // Provider always returns tool calls (infinite loop scenario)
      const providerEvents: ProviderEvent[] = [
        { type: 'text', value: 'Calling tool' },
        {
          type: 'tool_call',
          value: { id: 'call-1', name: 'infinite_tool', args: {} },
        },
        { type: 'finish', reason: 'tool' },
      ];

      const provider = new MockProvider(providerEvents);
      providerRegistry.register(provider);
      providerRegistry.setDefault('mock');

      // Register mock tool
      toolRegistry.register('infinite_tool', {
        execute: async () => ({ status: 'executed' }),
      });

      const client = new ChatClient(providerRegistry, toolRegistry);
      const events = await collectEvents(
        client.chat('Start infinite loop', { maxTurns: 3 })
      );

      // Should have exactly 3 turns
      const turnCompleteEvents = events.filter((e) => e.type === 'turn_complete');
      expect(turnCompleteEvents.length).toBe(3);

      // Should finish with max_turns reason
      const finishEvents = events.filter((e) => e.type === 'finish');
      expect(finishEvents.length).toBe(1);
      expect(finishEvents[0]).toEqual({ type: 'finish', reason: 'max_turns' });
    });

    it('should use default max turns from config', async () => {
      // Provider always returns tool calls
      const providerEvents: ProviderEvent[] = [
        { type: 'text', value: 'Calling tool' },
        {
          type: 'tool_call',
          value: { id: 'call-1', name: 'test_tool', args: {} },
        },
        { type: 'finish', reason: 'tool' },
      ];

      const provider = new MockProvider(providerEvents);
      providerRegistry.register(provider);
      providerRegistry.setDefault('mock');

      toolRegistry.register('test_tool', {
        execute: async () => ({ result: 'ok' }),
      });

      // Create client with custom default max turns
      const client = new ChatClient(providerRegistry, toolRegistry, {
        defaultMaxTurns: 2,
      });

      const events = await collectEvents(client.chat('Test'));

      // Should have exactly 2 turns (from config)
      const turnCompleteEvents = events.filter((e) => e.type === 'turn_complete');
      expect(turnCompleteEvents.length).toBe(2);

      // Should finish with max_turns reason
      const finishEvents = events.filter((e) => e.type === 'finish');
      expect(finishEvents.length).toBe(1);
      expect(finishEvents[0]).toEqual({ type: 'finish', reason: 'max_turns' });
    });
  });

  describe('Error Handling', () => {
    it('should emit error when provider is not found', async () => {
      const client = new ChatClient(providerRegistry, toolRegistry);
      const events = await collectEvents(
        client.chat('Test', { provider: 'nonexistent' })
      );

      // Should have error event
      const errorEvents = events.filter((e) => e.type === 'error');
      expect(errorEvents.length).toBe(1);
      expect(errorEvents[0].type).toBe('error');
      if (errorEvents[0].type === 'error') {
        expect(errorEvents[0].error.message).toContain('not found');
      }
    });

    it('should emit error when no default provider is set', async () => {
      const client = new ChatClient(providerRegistry, toolRegistry);
      const events = await collectEvents(client.chat('Test'));

      // Should have error event
      const errorEvents = events.filter((e) => e.type === 'error');
      expect(errorEvents.length).toBe(1);
      expect(errorEvents[0].type).toBe('error');
      if (errorEvents[0].type === 'error') {
        expect(errorEvents[0].error.message).toContain('No default provider set');
      }
    });

    it('should handle provider errors gracefully', async () => {
      const providerEvents: ProviderEvent[] = [
        { type: 'text', value: 'Starting...' },
        { type: 'error', error: { message: 'Connection failed', code: 'ECONNREFUSED' } },
      ];

      const provider = new MockProvider(providerEvents);
      providerRegistry.register(provider);
      providerRegistry.setDefault('mock');

      const client = new ChatClient(providerRegistry, toolRegistry);
      const events = await collectEvents(client.chat('Test'));

      // Should have text event before error
      const textEvents = events.filter((e) => e.type === 'text');
      expect(textEvents.length).toBe(1);

      // Should have error event
      const errorEvents = events.filter((e) => e.type === 'error');
      expect(errorEvents.length).toBe(1);
      expect(errorEvents[0].type).toBe('error');
      if (errorEvents[0].type === 'error') {
        expect(errorEvents[0].error.message).toContain('Connection failed');
      }

      // Should finish with error reason
      const finishEvents = events.filter((e) => e.type === 'finish');
      expect(finishEvents.length).toBe(1);
      expect(finishEvents[0]).toEqual({ type: 'finish', reason: 'error' });
    });
  });

  describe('Property 32: Tool Execution Error Handling', () => {
    it('should include errors in tool results and continue conversation', async () => {
      // Feature: stage-02-core-provider, Property 32: Tool Execution Error Handling
      // Validates: Requirements 10.2
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1 }),
          async (errorMessage: string) => {
            // First turn: tool call that will fail
            const firstTurnEvents: ProviderEvent[] = [
              { type: 'text', value: 'Calling tool' },
              {
                type: 'tool_call',
                value: { id: 'call-1', name: 'failing_tool', args: {} },
              },
              { type: 'finish', reason: 'tool' },
            ];

            // Second turn: model responds after seeing error
            const secondTurnEvents: ProviderEvent[] = [
              { type: 'text', value: 'I see there was an error' },
              { type: 'finish', reason: 'stop' },
            ];

            let callCount = 0;
            const provider: ProviderAdapter = {
              name: 'mock',
              async *chatStream(_request: ProviderRequest): AsyncIterable<ProviderEvent> {
                callCount++;
                const events = callCount === 1 ? firstTurnEvents : secondTurnEvents;
                for (const event of events) {
                  yield event;
                }
              },
            };

            providerRegistry.register(provider);
            providerRegistry.setDefault('mock');

            // Register tool that throws error
            toolRegistry.register('failing_tool', {
              execute: async () => {
                throw new Error(errorMessage);
              },
            });

            const client = new ChatClient(providerRegistry, toolRegistry);
            const events = await collectEvents(client.chat('Test'));

            // Should have tool result with error
            const toolResultEvents = events.filter((e) => e.type === 'tool_call_result');
            if (toolResultEvents.length === 0) return false;

            const toolResult = toolResultEvents[0];
            if (toolResult.type !== 'tool_call_result') return false;

            const hasError =
              typeof toolResult.result === 'object' &&
              toolResult.result !== null &&
              'error' in toolResult.result &&
              typeof (toolResult.result as any).error === 'string' &&
              (toolResult.result as any).error.includes(errorMessage);

            // Should continue to second turn (not terminate)
            const turnCompleteEvents = events.filter((e) => e.type === 'turn_complete');
            const continuedAfterError = turnCompleteEvents.length === 2;

            // Should finish with complete reason (not error)
            const finishEvents = events.filter((e) => e.type === 'finish');
            const finishedNormally =
              finishEvents.length === 1 &&
              finishEvents[0].type === 'finish' &&
              finishEvents[0].reason === 'complete';

            return hasError && continuedAfterError && finishedNormally;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 34: Abort Signal Cleanup', () => {
    it('should clean up resources and emit cancellation on abort', async () => {
      // Feature: stage-02-core-provider, Property 34: Abort Signal Cleanup
      // Validates: Requirements 10.4
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 3 }),
          async (abortAfterTurns: number) => {
            // Provider that emits tool calls to trigger multiple turns
            const providerEvents: ProviderEvent[] = [
              { type: 'text', value: 'Calling tool' },
              {
                type: 'tool_call',
                value: { id: '1', name: 'test_tool', args: {} },
              },
              { type: 'finish', reason: 'tool' },
            ];

            const provider = new MockProvider(providerEvents);
            providerRegistry.register(provider);
            providerRegistry.setDefault('mock');

            toolRegistry.register('test_tool', {
              execute: async () => ({ result: 'success' }),
            });

            const abortController = new AbortController();
            const client = new ChatClient(providerRegistry, toolRegistry);

            const events: ChatEvent[] = [];
            let turnCount = 0;

            const chatIterator = client.chat('test prompt', {
              abortSignal: abortController.signal,
              maxTurns: 10,
            });

            for await (const event of chatIterator) {
              events.push(event);

              if (event.type === 'turn_complete') {
                turnCount++;
                if (turnCount === abortAfterTurns) {
                  abortController.abort();
                }
              }
            }

            // Should have finish event with cancelled reason
            const finishEvents = events.filter((e) => e.type === 'finish');
            const wasCancelled =
              finishEvents.length === 1 &&
              finishEvents[0].type === 'finish' &&
              finishEvents[0].reason === 'cancelled';

            // Should not have exceeded the abort turn count by more than 1
            const turnCompleteEvents = events.filter((e) => e.type === 'turn_complete');
            const stoppedQuickly = turnCompleteEvents.length <= abortAfterTurns + 1;

            return wasCancelled && stoppedQuickly;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 35: Unexpected Error Resilience', () => {
    it('should emit error event without crashing on unexpected errors', async () => {
      // Feature: stage-02-core-provider, Property 35: Unexpected Error Resilience
      // Validates: Requirements 10.5
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1 }),
          async (errorMessage: string) => {
            // Provider that throws an unexpected error
            const provider: ProviderAdapter = {
              name: 'mock',
              async *chatStream(_request: ProviderRequest): AsyncIterable<ProviderEvent> {
                yield { type: 'text', value: 'Starting...' };
                throw new Error(errorMessage);
              },
            };

            providerRegistry.register(provider);
            providerRegistry.setDefault('mock');

            const client = new ChatClient(providerRegistry, toolRegistry);

            // Should not throw - should emit error event instead
            let didThrow = false;
            let events: ChatEvent[] = [];

            try {
              events = await collectEvents(client.chat('Test'));
            } catch (error) {
              didThrow = true;
            }

            // Should not have thrown
            if (didThrow) return false;

            // Should have error event
            const errorEvents = events.filter((e) => e.type === 'error');
            const hasErrorEvent =
              errorEvents.length > 0 &&
              errorEvents[0].type === 'error' &&
              errorEvents[0].error.message.includes(errorMessage);

            // Should have finish event
            const finishEvents = events.filter((e) => e.type === 'finish');
            const hasFinishEvent = finishEvents.length === 1;

            return hasErrorEvent && hasFinishEvent;
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
