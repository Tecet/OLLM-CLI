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

describe('Chat Client - Session Recording Integration', () => {
  let providerRegistry: ProviderRegistry;
  let toolRegistry: MockToolRegistry;

  beforeEach(() => {
    providerRegistry = new ProviderRegistry();
    toolRegistry = new MockToolRegistry();
  });

  describe('Session Recording', () => {
    it('should create session and record messages when recording service is provided', async () => {
      // Mock recording service
      const recordedSessions: string[] = [];
      const recordedMessages: Array<{ sessionId: string; message: any }> = [];
      const recordedToolCalls: Array<{ sessionId: string; toolCall: any }> = [];
      const savedSessions: string[] = [];

      const mockRecordingService = {
        createSession: async (model: string, provider: string) => {
          const sessionId = `session-${Date.now()}`;
          recordedSessions.push(sessionId);
          return sessionId;
        },
        recordMessage: async (sessionId: string, message: any) => {
          recordedMessages.push({ sessionId, message });
        },
        recordToolCall: async (sessionId: string, toolCall: any) => {
          recordedToolCalls.push({ sessionId, toolCall });
        },
        saveSession: async (sessionId: string) => {
          savedSessions.push(sessionId);
        },
      };

      const providerEvents: ProviderEvent[] = [
        { type: 'text', value: 'Hello, world!' },
        { type: 'finish', reason: 'stop' },
      ];

      const provider = new MockProvider(providerEvents);
      providerRegistry.register(provider);
      providerRegistry.setDefault('mock');

      const client = new ChatClient(providerRegistry, toolRegistry, {
        recordingService: mockRecordingService as any,
      });

      const events = await collectEvents(client.chat('Say hello'));

      // Should have created a session
      expect(recordedSessions.length).toBe(1);

      // Should have recorded user message
      const userMessages = recordedMessages.filter((m) => m.message.role === 'user');
      expect(userMessages.length).toBe(1);
      expect(userMessages[0].message.parts[0].text).toBe('Say hello');

      // Should have recorded assistant message
      const assistantMessages = recordedMessages.filter(
        (m) => m.message.role === 'assistant'
      );
      expect(assistantMessages.length).toBe(1);
      expect(assistantMessages[0].message.parts[0].text).toBe('Hello, world!');

      // Should have saved session on exit
      expect(savedSessions.length).toBe(1);
      expect(savedSessions[0]).toBe(recordedSessions[0]);
    });

    it('should record tool calls during conversation', async () => {
      const recordedToolCalls: Array<{ sessionId: string; toolCall: any }> = [];

      const mockRecordingService = {
        createSession: async () => 'test-session',
        recordMessage: async () => {},
        recordToolCall: async (sessionId: string, toolCall: any) => {
          recordedToolCalls.push({ sessionId, toolCall });
        },
        saveSession: async () => {},
      };

      // First turn: model calls a tool
      const firstTurnEvents: ProviderEvent[] = [
        { type: 'text', value: 'Let me check' },
        {
          type: 'tool_call',
          value: { id: 'call-1', name: 'get_data', args: { key: 'value' } },
        },
        { type: 'finish', reason: 'tool' },
      ];

      // Second turn: model responds
      const secondTurnEvents: ProviderEvent[] = [
        { type: 'text', value: 'Here is the data' },
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

      toolRegistry.register('get_data', {
        execute: async (args) => ({ data: 'test-data', key: args.key }),
      });

      const client = new ChatClient(providerRegistry, toolRegistry, {
        recordingService: mockRecordingService as any,
      });

      await collectEvents(client.chat('Get some data'));

      // Should have recorded the tool call
      expect(recordedToolCalls.length).toBe(1);
      expect(recordedToolCalls[0].sessionId).toBe('test-session');
      expect(recordedToolCalls[0].toolCall.name).toBe('get_data');
      expect(recordedToolCalls[0].toolCall.args).toEqual({ key: 'value' });
      expect(recordedToolCalls[0].toolCall.result).toBeDefined();
    });

    it('should continue without recording if service is not provided', async () => {
      const providerEvents: ProviderEvent[] = [
        { type: 'text', value: 'Hello' },
        { type: 'finish', reason: 'stop' },
      ];

      const provider = new MockProvider(providerEvents);
      providerRegistry.register(provider);
      providerRegistry.setDefault('mock');

      // Create client without recording service
      const client = new ChatClient(providerRegistry, toolRegistry);

      // Should not throw - should work normally without recording
      const events = await collectEvents(client.chat('Test'));

      const textEvents = events.filter((e) => e.type === 'text');
      expect(textEvents.length).toBe(1);

      const finishEvents = events.filter((e) => e.type === 'finish');
      expect(finishEvents.length).toBe(1);
    });

    it('should continue if recording service throws errors', async () => {
      const mockRecordingService = {
        createSession: async () => {
          throw new Error('Session creation failed');
        },
        recordMessage: async () => {
          throw new Error('Recording failed');
        },
        recordToolCall: async () => {
          throw new Error('Tool recording failed');
        },
        saveSession: async () => {
          throw new Error('Save failed');
        },
      };

      const providerEvents: ProviderEvent[] = [
        { type: 'text', value: 'Hello' },
        { type: 'finish', reason: 'stop' },
      ];

      const provider = new MockProvider(providerEvents);
      providerRegistry.register(provider);
      providerRegistry.setDefault('mock');

      const client = new ChatClient(providerRegistry, toolRegistry, {
        recordingService: mockRecordingService as any,
      });

      // Should not throw - should continue despite recording errors
      const events = await collectEvents(client.chat('Test'));

      const textEvents = events.filter((e) => e.type === 'text');
      expect(textEvents.length).toBe(1);

      const finishEvents = events.filter((e) => e.type === 'finish');
      expect(finishEvents.length).toBe(1);
      expect(finishEvents[0]).toEqual({ type: 'finish', reason: 'complete' });
    });
  });

  describe('Compression Service Integration', () => {
    it('should check compression threshold before each turn', async () => {
      let compressionChecked = false;
      
      const mockCompressionService = {
        shouldCompress: (messages: any[], tokenLimit: number, threshold: number) => {
          compressionChecked = true;
          expect(tokenLimit).toBe(8192);
          expect(threshold).toBe(0.8);
          return false; // Don't actually compress
        },
        compress: async () => {
          throw new Error('Should not be called');
        },
      };

      const providerEvents: ProviderEvent[] = [
        { type: 'text', value: 'Response' },
        { type: 'finish', reason: 'stop' },
      ];

      const provider = new MockProvider(providerEvents);
      providerRegistry.register(provider);
      providerRegistry.setDefault('mock');

      const client = new ChatClient(providerRegistry, toolRegistry, {
        compressionService: mockCompressionService as any,
        tokenLimit: 8192,
        servicesConfig: {
          compression: {
            enabled: true,
            threshold: 0.8,
            strategy: 'hybrid',
            preserveRecent: 4096,
          },
        },
      });

      await collectEvents(client.chat('Test'));

      expect(compressionChecked).toBe(true);
    });

    it('should trigger compression when threshold is exceeded', async () => {
      let compressionTriggered = false;
      const compressedMessages = [
        {
          role: 'system' as const,
          parts: [{ type: 'text' as const, text: '[Summary of previous messages]' }],
          timestamp: new Date().toISOString(),
        },
        {
          role: 'user' as const,
          parts: [{ type: 'text' as const, text: 'Test' }],
          timestamp: new Date().toISOString(),
        },
      ];

      const mockCompressionService = {
        shouldCompress: () => true, // Always trigger compression
        compress: async (messages: any[], options: any) => {
          compressionTriggered = true;
          expect(options.strategy).toBe('truncate');
          expect(options.preserveRecentTokens).toBe(2048);
          return {
            compressedMessages,
            originalTokenCount: 10000,
            compressedTokenCount: 2000,
            strategy: 'truncate' as const,
          };
        },
      };

      const providerEvents: ProviderEvent[] = [
        { type: 'text', value: 'Response' },
        { type: 'finish', reason: 'stop' },
      ];

      const provider = new MockProvider(providerEvents);
      providerRegistry.register(provider);
      providerRegistry.setDefault('mock');

      const client = new ChatClient(providerRegistry, toolRegistry, {
        compressionService: mockCompressionService as any,
        tokenLimit: 4096,
        servicesConfig: {
          compression: {
            enabled: true,
            threshold: 0.8,
            strategy: 'truncate',
            preserveRecent: 2048,
          },
        },
      });

      await collectEvents(client.chat('Test'));

      expect(compressionTriggered).toBe(true);
    });

    it('should update message history with compressed messages', async () => {
      const compressedMessages = [
        {
          role: 'system' as const,
          parts: [{ type: 'text' as const, text: '[Compressed summary]' }],
          timestamp: new Date().toISOString(),
        },
        {
          role: 'user' as const,
          parts: [{ type: 'text' as const, text: 'Recent message' }],
          timestamp: new Date().toISOString(),
        },
      ];

      const mockCompressionService = {
        shouldCompress: () => true,
        compress: async () => ({
          compressedMessages,
          originalTokenCount: 10000,
          compressedTokenCount: 1000,
          strategy: 'hybrid' as const,
        }),
      };

      // Track the messages sent to the provider
      let providerMessages: any[] = [];
      
      const providerEvents: ProviderEvent[] = [
        { type: 'text', value: 'Response' },
        { type: 'finish', reason: 'stop' },
      ];

      const provider = new MockProvider(providerEvents);
      const originalChatStream = provider.chatStream.bind(provider);
      provider.chatStream = async function* (request: any) {
        providerMessages = request.messages;
        yield* originalChatStream(request);
      };

      providerRegistry.register(provider);
      providerRegistry.setDefault('mock');

      const client = new ChatClient(providerRegistry, toolRegistry, {
        compressionService: mockCompressionService as any,
        tokenLimit: 4096,
      });

      await collectEvents(client.chat('Recent message'));

      // Verify that compressed messages were used
      expect(providerMessages.length).toBeGreaterThan(0);
      // The first message should be the compressed summary
      expect(providerMessages[0].parts[0].text).toContain('[Compressed summary]');
    });

    it('should continue without compression if service is not provided', async () => {
      const providerEvents: ProviderEvent[] = [
        { type: 'text', value: 'Response' },
        { type: 'finish', reason: 'stop' },
      ];

      const provider = new MockProvider(providerEvents);
      providerRegistry.register(provider);
      providerRegistry.setDefault('mock');

      // Create client without compression service
      const client = new ChatClient(providerRegistry, toolRegistry, {
        tokenLimit: 4096,
      });

      // Should work normally without compression
      const events = await collectEvents(client.chat('Test'));

      const textEvents = events.filter((e) => e.type === 'text');
      expect(textEvents.length).toBe(1);

      const finishEvents = events.filter((e) => e.type === 'finish');
      expect(finishEvents.length).toBe(1);
    });

    it('should continue if compression service throws errors', async () => {
      const mockCompressionService = {
        shouldCompress: () => {
          throw new Error('Compression check failed');
        },
        compress: async () => {
          throw new Error('Compression failed');
        },
      };

      const providerEvents: ProviderEvent[] = [
        { type: 'text', value: 'Response' },
        { type: 'finish', reason: 'stop' },
      ];

      const provider = new MockProvider(providerEvents);
      providerRegistry.register(provider);
      providerRegistry.setDefault('mock');

      const client = new ChatClient(providerRegistry, toolRegistry, {
        compressionService: mockCompressionService as any,
        tokenLimit: 4096,
      });

      // Should not throw - should continue despite compression errors
      const events = await collectEvents(client.chat('Test'));

      const textEvents = events.filter((e) => e.type === 'text');
      expect(textEvents.length).toBe(1);

      const finishEvents = events.filter((e) => e.type === 'finish');
      expect(finishEvents.length).toBe(1);
    });

    it('should respect compression enabled flag', async () => {
      let compressionChecked = false;

      const mockCompressionService = {
        shouldCompress: () => {
          compressionChecked = true;
          return false;
        },
        compress: async () => {
          throw new Error('Should not be called');
        },
      };

      const providerEvents: ProviderEvent[] = [
        { type: 'text', value: 'Response' },
        { type: 'finish', reason: 'stop' },
      ];

      const provider = new MockProvider(providerEvents);
      providerRegistry.register(provider);
      providerRegistry.setDefault('mock');

      const client = new ChatClient(providerRegistry, toolRegistry, {
        compressionService: mockCompressionService as any,
        tokenLimit: 4096,
        servicesConfig: {
          compression: {
            enabled: false, // Disabled
          },
        },
      });

      await collectEvents(client.chat('Test'));

      // Compression should not be checked when disabled
      expect(compressionChecked).toBe(false);
    });
  });
});

describe('Chat Client - Loop Detection Integration', () => {
  let providerRegistry: ProviderRegistry;
  let toolRegistry: MockToolRegistry;

  beforeEach(() => {
    providerRegistry = new ProviderRegistry();
    toolRegistry = new MockToolRegistry();
  });

  describe('Loop Detection Service Integration', () => {
    it('should detect repeated tool calls and stop execution', async () => {
      // Create a provider that repeatedly calls the same tool
      const providerEvents: ProviderEvent[] = [
        { type: 'text', value: 'Calling tool' },
        {
          type: 'tool_call',
          value: { id: '1', name: 'test_tool', args: { param: 'value' } },
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

      // Create loop detection service with low threshold
      const { LoopDetectionService } = await import('../../services/loopDetectionService.js');
      const loopDetectionService = new LoopDetectionService({
        enabled: true,
        maxTurns: 50,
        repeatThreshold: 3,
      });

      const client = new ChatClient(providerRegistry, toolRegistry, {
        loopDetectionService,
        defaultMaxTurns: 10,
      });

      const events = await collectEvents(client.chat('test prompt'));

      // Should have loop_detected event
      const loopEvents = events.filter((e) => e.type === 'loop_detected');
      expect(loopEvents.length).toBe(1);

      // Should have finish event with loop_detected reason
      const finishEvents = events.filter((e) => e.type === 'finish');
      expect(finishEvents.length).toBe(1);
      if (finishEvents[0].type === 'finish') {
        expect(finishEvents[0].reason).toBe('loop_detected');
      }

      // Should have exactly 3 turn_complete events (threshold is 3)
      const turnCompleteEvents = events.filter((e) => e.type === 'turn_complete');
      expect(turnCompleteEvents.length).toBe(3);
    });

    it('should detect turn limit and stop execution', async () => {
      // Create a provider that always has tool calls
      const providerEvents: ProviderEvent[] = [
        { type: 'text', value: 'Response' },
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

      // Create loop detection service with low maxTurns
      const { LoopDetectionService } = await import('../../services/loopDetectionService.js');
      const loopDetectionService = new LoopDetectionService({
        enabled: true,
        maxTurns: 5,
        repeatThreshold: 10,
      });

      const client = new ChatClient(providerRegistry, toolRegistry, {
        loopDetectionService,
        defaultMaxTurns: 20, // Higher than loop detection maxTurns
      });

      const events = await collectEvents(client.chat('test prompt'));

      // Should have loop_detected event
      const loopEvents = events.filter((e) => e.type === 'loop_detected');
      expect(loopEvents.length).toBe(1);
      if (loopEvents[0].type === 'loop_detected') {
        expect(loopEvents[0].pattern.type).toBe('turn-limit');
      }

      // Should have finish event with loop_detected reason
      const finishEvents = events.filter((e) => e.type === 'finish');
      expect(finishEvents.length).toBe(1);
      if (finishEvents[0].type === 'finish') {
        expect(finishEvents[0].reason).toBe('loop_detected');
      }

      // Should have exactly 4 turn_complete events (loop detected at turn 5, before turn executes)
      const turnCompleteEvents = events.filter((e) => e.type === 'turn_complete');
      expect(turnCompleteEvents.length).toBe(4);
    });

    it('should detect repeated outputs and stop execution', async () => {
      // Create a provider that repeatedly outputs the same text WITHOUT tool calls
      const providerEvents: ProviderEvent[] = [
        { type: 'text', value: 'Same output every time' },
        { type: 'finish', reason: 'stop' }, // No tool calls, so conversation would normally end
      ];

      let turnCount = 0;
      const provider: ProviderAdapter = {
        name: 'mock',
        async *chatStream(_request: ProviderRequest): AsyncIterable<ProviderEvent> {
          turnCount++;
          // After first turn, add a tool call to keep the conversation going
          if (turnCount > 1) {
            yield { type: 'text', value: 'Same output every time' };
            yield {
              type: 'tool_call',
              value: { id: String(turnCount), name: 'test_tool', args: { different: turnCount } },
            };
            yield { type: 'finish', reason: 'tool' };
          } else {
            yield { type: 'text', value: 'Same output every time' };
            yield {
              type: 'tool_call',
              value: { id: '1', name: 'test_tool', args: { different: 1 } },
            };
            yield { type: 'finish', reason: 'tool' };
          }
        },
      };

      providerRegistry.register(provider);
      providerRegistry.setDefault('mock');

      // Register a mock tool
      toolRegistry.register('test_tool', {
        execute: async () => ({ result: 'success' }),
      });

      // Create loop detection service with low threshold
      const { LoopDetectionService } = await import('../../services/loopDetectionService.js');
      const loopDetectionService = new LoopDetectionService({
        enabled: true,
        maxTurns: 50,
        repeatThreshold: 3,
      });

      const client = new ChatClient(providerRegistry, toolRegistry, {
        loopDetectionService,
        defaultMaxTurns: 10,
      });

      const events = await collectEvents(client.chat('test prompt'));

      // Should have loop_detected event
      const loopEvents = events.filter((e) => e.type === 'loop_detected');
      expect(loopEvents.length).toBe(1);
      if (loopEvents[0].type === 'loop_detected') {
        expect(loopEvents[0].pattern.type).toBe('repeated-output');
      }

      // Should have finish event with loop_detected reason
      const finishEvents = events.filter((e) => e.type === 'finish');
      expect(finishEvents.length).toBe(1);
      if (finishEvents[0].type === 'finish') {
        expect(finishEvents[0].reason).toBe('loop_detected');
      }
    });

    it('should continue without loop detection if service is not provided', async () => {
      // Create a provider that would trigger loop detection if it were enabled
      const providerEvents: ProviderEvent[] = [
        { type: 'text', value: 'Same output' },
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

      // No loop detection service provided
      const client = new ChatClient(providerRegistry, toolRegistry, {
        defaultMaxTurns: 10, // Use default maxTurns
      });

      const events = await collectEvents(client.chat('test prompt'));

      // Should NOT have loop_detected event
      const loopEvents = events.filter((e) => e.type === 'loop_detected');
      expect(loopEvents.length).toBe(0);

      // Should have finish event with max_turns reason (not loop_detected)
      const finishEvents = events.filter((e) => e.type === 'finish');
      expect(finishEvents.length).toBe(1);
      if (finishEvents[0].type === 'finish') {
        expect(finishEvents[0].reason).toBe('max_turns');
      }

      // Should have exactly 10 turn_complete events
      const turnCompleteEvents = events.filter((e) => e.type === 'turn_complete');
      expect(turnCompleteEvents.length).toBe(10);
    });

    it('should track tool calls with different arguments separately', async () => {
      let callCount = 0;
      
      // Create a provider that calls the same tool with different arguments
      const provider: ProviderAdapter = {
        name: 'mock',
        async *chatStream(_request: ProviderRequest): AsyncIterable<ProviderEvent> {
          callCount++;
          yield { type: 'text', value: `Call ${callCount}` }; // Different output each time
          yield {
            type: 'tool_call',
            value: { id: String(callCount), name: 'test_tool', args: { count: callCount } },
          };
          yield { type: 'finish', reason: 'tool' };
        },
      };

      providerRegistry.register(provider);
      providerRegistry.setDefault('mock');

      // Register a mock tool
      toolRegistry.register('test_tool', {
        execute: async () => ({ result: 'success' }),
      });

      // Create loop detection service
      const { LoopDetectionService } = await import('../../services/loopDetectionService.js');
      const loopDetectionService = new LoopDetectionService({
        enabled: true,
        maxTurns: 50,
        repeatThreshold: 3,
      });

      const client = new ChatClient(providerRegistry, toolRegistry, {
        loopDetectionService,
        defaultMaxTurns: 5,
      });

      const events = await collectEvents(client.chat('test prompt'));

      // Should NOT have loop_detected event (different arguments and outputs each time)
      const loopEvents = events.filter((e) => e.type === 'loop_detected');
      expect(loopEvents.length).toBe(0);

      // Should have finish event with max_turns reason
      const finishEvents = events.filter((e) => e.type === 'finish');
      expect(finishEvents.length).toBe(1);
      if (finishEvents[0].type === 'finish') {
        expect(finishEvents[0].reason).toBe('max_turns');
      }

      // Should have exactly 5 turn_complete events
      const turnCompleteEvents = events.filter((e) => e.type === 'turn_complete');
      expect(turnCompleteEvents.length).toBe(5);
    });
  });
});

describe('Chat Client - Context Manager Integration', () => {
  let providerRegistry: ProviderRegistry;
  let toolRegistry: MockToolRegistry;

  beforeEach(() => {
    providerRegistry = new ProviderRegistry();
    toolRegistry = new MockToolRegistry();
  });

  describe('Context Injection', () => {
    it('should inject context additions into system prompt', async () => {
      // Track the messages sent to the provider
      let providerMessages: any[] = [];
      
      const providerEvents: ProviderEvent[] = [
        { type: 'text', value: 'Response with context' },
        { type: 'finish', reason: 'stop' },
      ];

      const provider = new MockProvider(providerEvents);
      const originalChatStream = provider.chatStream.bind(provider);
      provider.chatStream = async function* (request: any) {
        providerMessages = request.messages;
        yield* originalChatStream(request);
      };

      providerRegistry.register(provider);
      providerRegistry.setDefault('mock');

      // Create context manager with some context
      const { ContextManager } = await import('../../services/contextManager.js');
      const contextManager = new ContextManager();
      contextManager.addContext('test-context', 'This is test context', {
        priority: 100,
        source: 'user',
      });

      const client = new ChatClient(providerRegistry, toolRegistry, {
        contextManager,
      });

      await collectEvents(client.chat('Test prompt'));

      // Verify that context was injected into system prompt
      expect(providerMessages.length).toBeGreaterThan(0);
      
      // Should have a system message with context
      const systemMessages = providerMessages.filter((m) => m.role === 'system');
      expect(systemMessages.length).toBe(1);
      
      // System message should contain the context
      const systemText = systemMessages[0].parts.map((p: any) => p.text).join('');
      expect(systemText).toContain('This is test context');
      expect(systemText).toContain('Context: test-context');
    });

    it('should inject context from multiple sources in priority order', async () => {
      let providerMessages: any[] = [];
      
      const providerEvents: ProviderEvent[] = [
        { type: 'text', value: 'Response' },
        { type: 'finish', reason: 'stop' },
      ];

      const provider = new MockProvider(providerEvents);
      const originalChatStream = provider.chatStream.bind(provider);
      provider.chatStream = async function* (request: any) {
        providerMessages = request.messages;
        yield* originalChatStream(request);
      };

      providerRegistry.register(provider);
      providerRegistry.setDefault('mock');

      // Create context manager with multiple contexts
      const { ContextManager } = await import('../../services/contextManager.js');
      const contextManager = new ContextManager();
      contextManager.addContext('low-priority', 'Low priority context', {
        priority: 10,
        source: 'system',
      });
      contextManager.addContext('high-priority', 'High priority context', {
        priority: 100,
        source: 'user',
      });
      contextManager.addContext('medium-priority', 'Medium priority context', {
        priority: 50,
        source: 'hook',
      });

      const client = new ChatClient(providerRegistry, toolRegistry, {
        contextManager,
      });

      await collectEvents(client.chat('Test prompt'));

      // Verify that context was injected in priority order
      const systemMessages = providerMessages.filter((m) => m.role === 'system');
      expect(systemMessages.length).toBe(1);
      
      const systemText = systemMessages[0].parts.map((p: any) => p.text).join('');
      
      // High priority should appear before medium, medium before low
      const highIndex = systemText.indexOf('High priority context');
      const mediumIndex = systemText.indexOf('Medium priority context');
      const lowIndex = systemText.indexOf('Low priority context');
      
      expect(highIndex).toBeGreaterThan(-1);
      expect(mediumIndex).toBeGreaterThan(-1);
      expect(lowIndex).toBeGreaterThan(-1);
      expect(highIndex).toBeLessThan(mediumIndex);
      expect(mediumIndex).toBeLessThan(lowIndex);
    });

    it('should append context to existing system prompt', async () => {
      let providerMessages: any[] = [];
      
      const providerEvents: ProviderEvent[] = [
        { type: 'text', value: 'Response' },
        { type: 'finish', reason: 'stop' },
      ];

      const provider = new MockProvider(providerEvents);
      const originalChatStream = provider.chatStream.bind(provider);
      provider.chatStream = async function* (request: any) {
        providerMessages = request.messages;
        yield* originalChatStream(request);
      };

      providerRegistry.register(provider);
      providerRegistry.setDefault('mock');

      // Create context manager
      const { ContextManager } = await import('../../services/contextManager.js');
      const contextManager = new ContextManager();
      contextManager.addContext('additional-context', 'Additional context', {
        priority: 50,
        source: 'extension',
      });

      const client = new ChatClient(providerRegistry, toolRegistry, {
        contextManager,
      });

      await collectEvents(
        client.chat('Test prompt', {
          systemPrompt: 'Original system prompt',
        })
      );

      // Verify that context was appended to existing system prompt
      const systemMessages = providerMessages.filter((m) => m.role === 'system');
      expect(systemMessages.length).toBe(1);
      
      const systemText = systemMessages[0].parts.map((p: any) => p.text).join('');
      
      // Should contain both original prompt and context
      expect(systemText).toContain('Original system prompt');
      expect(systemText).toContain('Additional context');
    });

    it('should work without context manager', async () => {
      const providerEvents: ProviderEvent[] = [
        { type: 'text', value: 'Response' },
        { type: 'finish', reason: 'stop' },
      ];

      const provider = new MockProvider(providerEvents);
      providerRegistry.register(provider);
      providerRegistry.setDefault('mock');

      // Create client without context manager
      const client = new ChatClient(providerRegistry, toolRegistry);

      // Should work normally without context manager
      const events = await collectEvents(client.chat('Test'));

      const textEvents = events.filter((e) => e.type === 'text');
      expect(textEvents.length).toBe(1);

      const finishEvents = events.filter((e) => e.type === 'finish');
      expect(finishEvents.length).toBe(1);
    });

    it('should inject context on every turn', async () => {
      let turnCount = 0;
      const capturedMessages: any[][] = [];
      
      // First turn: model calls a tool
      const firstTurnEvents: ProviderEvent[] = [
        { type: 'text', value: 'Calling tool' },
        {
          type: 'tool_call',
          value: { id: 'call-1', name: 'test_tool', args: {} },
        },
        { type: 'finish', reason: 'tool' },
      ];

      // Second turn: model responds
      const secondTurnEvents: ProviderEvent[] = [
        { type: 'text', value: 'Final response' },
        { type: 'finish', reason: 'stop' },
      ];

      const provider: ProviderAdapter = {
        name: 'mock',
        async *chatStream(request: ProviderRequest): AsyncIterable<ProviderEvent> {
          turnCount++;
          capturedMessages.push([...request.messages]);
          const events = turnCount === 1 ? firstTurnEvents : secondTurnEvents;
          for (const event of events) {
            yield event;
          }
        },
      };

      providerRegistry.register(provider);
      providerRegistry.setDefault('mock');

      // Register mock tool
      toolRegistry.register('test_tool', {
        execute: async () => ({ result: 'success' }),
      });

      // Create context manager
      const { ContextManager } = await import('../../services/contextManager.js');
      const contextManager = new ContextManager();
      contextManager.addContext('persistent-context', 'Context for all turns', {
        priority: 100,
        source: 'system',
      });

      const client = new ChatClient(providerRegistry, toolRegistry, {
        contextManager,
      });

      await collectEvents(client.chat('Test prompt'));

      // Should have captured messages from both turns
      expect(capturedMessages.length).toBe(2);

      // Both turns should have system message with context
      for (const messages of capturedMessages) {
        const systemMessages = messages.filter((m) => m.role === 'system');
        expect(systemMessages.length).toBe(1);
        
        const systemText = systemMessages[0].parts.map((p: any) => p.text).join('');
        expect(systemText).toContain('Context for all turns');
      }
    });
  });
});
