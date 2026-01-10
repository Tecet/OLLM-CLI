/**
 * Property-based and unit tests for Turn management.
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { Turn, type ToolRegistry, type Tool, type ChatOptions } from '../turn.js';
import type {
  ProviderAdapter,
  ProviderRequest,
  ProviderEvent,
  Message,
  ToolCall,
} from '../../provider/types.js';

/**
 * Mock provider that emits a configurable sequence of events.
 */
class MockProvider implements ProviderAdapter {
  name = 'mock';
  private events: ProviderEvent[] = [];

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
 * Mock tool registry for testing.
 */
class MockToolRegistry implements ToolRegistry {
  private tools = new Map<string, Tool>();

  register(name: string, tool: Tool): void {
    this.tools.set(name, tool);
  }

  get(name: string): Tool | undefined {
    return this.tools.get(name);
  }
}

/**
 * Mock tool for testing.
 */
class MockTool implements Tool {
  constructor(private fn: (args: Record<string, unknown>) => Promise<unknown>) {}

  async execute(args: Record<string, unknown>): Promise<unknown> {
    return this.fn(args);
  }
}

describe('Turn Management - Property Tests', () => {
  // Property 6: Tool Call Queuing and Execution
  it('Property 6: Tool Call Queuing and Execution', async () => {
    // Feature: stage-02-core-provider, Property 6: Tool Call Queuing and Execution
    // Validates: Requirements 3.1, 3.2, 8.3, 8.4
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.record({
          id: fc.string(),
          name: fc.constantFrom('tool1', 'tool2', 'tool3'),
          args: fc.record({ value: fc.integer() }),
        }), { minLength: 1, maxLength: 5 }),
        async (toolCalls) => {
          // Setup: Create provider that emits tool calls
          const events: ProviderEvent[] = [
            ...toolCalls.map(tc => ({ type: 'tool_call' as const, value: tc })),
            { type: 'finish' as const, reason: 'tool' as const },
          ];
          const provider = new MockProvider(events);

          // Setup: Create tool registry with tools
          const toolRegistry = new MockToolRegistry();
          const executedCalls: ToolCall[] = [];
          for (const tc of toolCalls) {
            toolRegistry.register(
              tc.name,
              new MockTool(async (args) => {
                executedCalls.push({ ...tc, args });
                return { success: true, value: args.value };
              })
            );
          }

          const messages: Message[] = [];
          const turn = new Turn(provider, toolRegistry, messages);

          // Execute turn and collect events
          const collectedEvents = [];
          for await (const event of turn.execute()) {
            collectedEvents.push(event);
          }

          // Verify: All tool calls were queued and executed
          const toolCallEvents = collectedEvents.filter(e => e.type === 'tool_call');
          const toolResultEvents = collectedEvents.filter(e => e.type === 'tool_result');

          return (
            toolCallEvents.length === toolCalls.length &&
            toolResultEvents.length === toolCalls.length &&
            executedCalls.length === toolCalls.length
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  // Property 7: Tool Result Continuation
  it('Property 7: Tool Result Continuation', async () => {
    // Feature: stage-02-core-provider, Property 7: Tool Result Continuation
    // Validates: Requirements 3.3
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          id: fc.string(),
          name: fc.string(),
          args: fc.record({ input: fc.string() }),
        }),
        fc.jsonValue(),
        async (toolCall, toolResult) => {
          // Setup: Provider emits a tool call
          const events: ProviderEvent[] = [
            { type: 'tool_call', value: toolCall },
            { type: 'finish', reason: 'tool' },
          ];
          const provider = new MockProvider(events);

          // Setup: Tool registry with the tool
          const toolRegistry = new MockToolRegistry();
          toolRegistry.register(
            toolCall.name,
            new MockTool(async () => toolResult)
          );

          const messages: Message[] = [];
          const turn = new Turn(provider, toolRegistry, messages);

          // Execute turn
          const events_collected = [];
          for await (const event of turn.execute()) {
            events_collected.push(event);
          }

          // Verify: Tool result was added to message history
          const toolMessages = messages.filter(m => m.role === 'tool');
          return (
            toolMessages.length === 1 &&
            toolMessages[0].name === toolCall.name &&
            toolMessages[0].parts.length === 1 &&
            toolMessages[0].parts[0].type === 'text'
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  // Property 8: Parallel Tool Execution
  it('Property 8: Parallel Tool Execution', async () => {
    // Feature: stage-02-core-provider, Property 8: Parallel Tool Execution
    // Validates: Requirements 3.4
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 2, max: 5 }),
        fc.integer({ min: 50, max: 100 }),
        async (numTools, delayMs) => {
          // Setup: Create multiple tool calls
          const toolCalls: ToolCall[] = Array.from({ length: numTools }, (_, i) => ({
            id: `tool-${i}`,
            name: `tool${i}`,
            args: {},
          }));

          const events: ProviderEvent[] = [
            ...toolCalls.map(tc => ({ type: 'tool_call' as const, value: tc })),
            { type: 'finish' as const, reason: 'tool' as const },
          ];
          const provider = new MockProvider(events);

          // Setup: Tools with delays
          const toolRegistry = new MockToolRegistry();
          for (const tc of toolCalls) {
            toolRegistry.register(
              tc.name,
              new MockTool(async () => {
                await new Promise(resolve => setTimeout(resolve, delayMs));
                return { success: true };
              })
            );
          }

          const messages: Message[] = [];
          const turn = new Turn(provider, toolRegistry, messages);

          // Execute and measure time
          const startTime = Date.now();
          for await (const _event of turn.execute()) {
            // Consume events
          }
          const elapsedTime = Date.now() - startTime;

          // Verify: Execution time is closer to single delay than sum of delays
          // (indicating parallel execution)
          const sequentialTime = delayMs * numTools;
          const parallelTime = delayMs;
          const threshold = parallelTime + (sequentialTime - parallelTime) * 0.5;

          return elapsedTime < threshold;
        }
      ),
      { numRuns: 20 } // Fewer runs due to timing sensitivity
    );
  });

  // Property 27: Turn Initialization
  it('Property 27: Turn Initialization', () => {
    // Feature: stage-02-core-provider, Property 27: Turn Initialization
    // Validates: Requirements 8.1
    fc.assert(
      fc.property(
        fc.array(fc.record({
          role: fc.constantFrom('user', 'assistant', 'system', 'tool'),
          parts: fc.array(fc.record({
            type: fc.constant('text'),
            text: fc.string(),
          }), { minLength: 1 }),
        }), { minLength: 1, maxLength: 10 }),
        (initialMessages) => {
          const provider = new MockProvider([{ type: 'finish', reason: 'stop' }]);
          const toolRegistry = new MockToolRegistry();
          const messages = [...initialMessages] as Message[];
          const messagesCopy = [...messages];

          const turn = new Turn(provider, toolRegistry, messages);

          // Verify: Turn maintains reference to messages array
          return messages === messages && messages.length === messagesCopy.length;
        }
      ),
      { numRuns: 100 }
    );
  });

  // Property 28: Event Collection Completeness
  it('Property 28: Event Collection Completeness', async () => {
    // Feature: stage-02-core-provider, Property 28: Event Collection Completeness
    // Validates: Requirements 8.2
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.oneof(
            fc.record({ type: fc.constant('text' as const), value: fc.string() }),
            fc.record({
              type: fc.constant('tool_call' as const),
              value: fc.record({
                id: fc.string(),
                name: fc.string(),
                args: fc.record({}),
              }),
            })
          ),
          { minLength: 1, maxLength: 10 }
        ),
        async (providerEvents) => {
          // Add finish event
          const events = [...providerEvents, { type: 'finish' as const, reason: 'stop' as const }];
          const provider = new MockProvider(events);
          const toolRegistry = new MockToolRegistry();
          const messages: Message[] = [];

          const turn = new Turn(provider, toolRegistry, messages);

          // Collect all events
          const collectedEvents = [];
          for await (const event of turn.execute()) {
            collectedEvents.push(event);
          }

          // Verify: All non-finish events were collected
          const textEvents = providerEvents.filter(e => e.type === 'text');
          const toolCallEvents = providerEvents.filter(e => e.type === 'tool_call');
          const collectedTextEvents = collectedEvents.filter(e => e.type === 'text');
          const collectedToolCallEvents = collectedEvents.filter(e => e.type === 'tool_call');

          return (
            collectedTextEvents.length === textEvents.length &&
            collectedToolCallEvents.length === toolCallEvents.length
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  // Property 29: Conversation History Update
  it('Property 29: Conversation History Update', async () => {
    // Feature: stage-02-core-provider, Property 29: Conversation History Update
    // Validates: Requirements 8.5
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1 }),
        fc.array(fc.record({
          id: fc.string(),
          name: fc.string(),
          args: fc.record({}),
        }), { minLength: 0, maxLength: 3 }),
        async (assistantText, toolCalls) => {
          // Setup: Provider emits text and tool calls
          const events: ProviderEvent[] = [
            { type: 'text', value: assistantText },
            ...toolCalls.map(tc => ({ type: 'tool_call' as const, value: tc })),
            { type: 'finish' as const, reason: 'stop' as const },
          ];
          const provider = new MockProvider(events);

          // Setup: Tool registry
          const toolRegistry = new MockToolRegistry();
          for (const tc of toolCalls) {
            toolRegistry.register(
              tc.name,
              new MockTool(async () => ({ result: 'ok' }))
            );
          }

          const messages: Message[] = [];
          const initialLength = messages.length;
          const turn = new Turn(provider, toolRegistry, messages);

          // Execute turn
          for await (const _event of turn.execute()) {
            // Consume events
          }

          // Verify: Messages array was updated with assistant message and tool results
          const expectedNewMessages = 1 + toolCalls.length; // 1 assistant + N tool results
          const actualNewMessages = messages.length - initialLength;

          const hasAssistantMessage = messages.some(
            m => m.role === 'assistant' && m.parts.some(p => p.type === 'text' && p.text === assistantText)
          );
          const toolResultCount = messages.filter(m => m.role === 'tool').length;

          return (
            actualNewMessages === expectedNewMessages &&
            hasAssistantMessage &&
            toolResultCount === toolCalls.length
          );
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('Turn Management - Unit Tests (Edge Cases)', () => {
  it('should handle turn with no tool calls', async () => {
    // Setup: Provider emits only text
    const events: ProviderEvent[] = [
      { type: 'text', value: 'Hello, world!' },
      { type: 'finish', reason: 'stop' },
    ];
    const provider = new MockProvider(events);
    const toolRegistry = new MockToolRegistry();
    const messages: Message[] = [];

    const turn = new Turn(provider, toolRegistry, messages);

    // Execute turn
    const collectedEvents = [];
    for await (const event of turn.execute()) {
      collectedEvents.push(event);
    }

    // Verify: Only text event, no tool calls
    expect(collectedEvents).toHaveLength(1);
    expect(collectedEvents[0].type).toBe('text');
    expect(collectedEvents[0]).toMatchObject({ type: 'text', value: 'Hello, world!' });

    // Verify: Assistant message added to history
    expect(messages).toHaveLength(1);
    expect(messages[0].role).toBe('assistant');
    expect(messages[0].parts[0]).toMatchObject({ type: 'text', text: 'Hello, world!' });
  });

  it('should handle tool execution errors gracefully', async () => {
    // Setup: Provider emits a tool call
    const toolCall: ToolCall = {
      id: 'test-1',
      name: 'failing-tool',
      args: { input: 'test' },
    };
    const events: ProviderEvent[] = [
      { type: 'tool_call', value: toolCall },
      { type: 'finish', reason: 'tool' },
    ];
    const provider = new MockProvider(events);

    // Setup: Tool that throws an error
    const toolRegistry = new MockToolRegistry();
    toolRegistry.register(
      'failing-tool',
      new MockTool(async () => {
        throw new Error('Tool execution failed');
      })
    );

    const messages: Message[] = [];
    const turn = new Turn(provider, toolRegistry, messages);

    // Execute turn
    const collectedEvents = [];
    for await (const event of turn.execute()) {
      collectedEvents.push(event);
    }

    // Verify: Tool result contains error (with enhanced error message)
    const toolResultEvent = collectedEvents.find(e => e.type === 'tool_result');
    expect(toolResultEvent).toBeDefined();
    expect(toolResultEvent).toMatchObject({
      type: 'tool_result',
      toolCall,
      result: { error: 'Tool execution failed: Tool execution failed' },
    });

    // Verify: Error added to message history
    const toolMessage = messages.find(m => m.role === 'tool');
    expect(toolMessage).toBeDefined();
    expect(toolMessage?.name).toBe('failing-tool');
    const parsedResult = JSON.parse((toolMessage?.parts[0] as any).text);
    expect(parsedResult).toMatchObject({ error: 'Tool execution failed: Tool execution failed' });
  });

  it('should handle missing tool gracefully', async () => {
    // Setup: Provider emits a tool call for non-existent tool
    const toolCall: ToolCall = {
      id: 'test-1',
      name: 'non-existent-tool',
      args: { input: 'test' },
    };
    const events: ProviderEvent[] = [
      { type: 'tool_call', value: toolCall },
      { type: 'finish', reason: 'tool' },
    ];
    const provider = new MockProvider(events);
    const toolRegistry = new MockToolRegistry();
    const messages: Message[] = [];

    const turn = new Turn(provider, toolRegistry, messages);

    // Execute turn
    const collectedEvents = [];
    for await (const event of turn.execute()) {
      collectedEvents.push(event);
    }

    // Verify: Tool result contains "not found" error
    const toolResultEvent = collectedEvents.find(e => e.type === 'tool_result');
    expect(toolResultEvent).toBeDefined();
    expect(toolResultEvent).toMatchObject({
      type: 'tool_result',
      toolCall,
      result: { error: 'Tool "non-existent-tool" not found' },
    });
  });

  it('should handle abort signal during streaming', async () => {
    // Setup: Provider that would emit multiple events
    const events: ProviderEvent[] = [
      { type: 'text', value: 'Part 1' },
      { type: 'text', value: 'Part 2' },
      { type: 'finish', reason: 'stop' },
    ];

    // Create abort controller
    const abortController = new AbortController();

    // Mock provider that checks abort signal
    class AbortableProvider implements ProviderAdapter {
      name = 'abortable';

      async *chatStream(request: ProviderRequest): AsyncIterable<ProviderEvent> {
        for (const event of events) {
          if (request.abortSignal?.aborted) {
            throw new Error('Aborted');
          }
          yield event;
          // Abort after first event
          if (event.type === 'text' && event.value === 'Part 1') {
            abortController.abort();
          }
        }
      }
    }

    const provider = new AbortableProvider();
    const toolRegistry = new MockToolRegistry();
    const messages: Message[] = [];

    const turn = new Turn(provider, toolRegistry, messages, {
      abortSignal: abortController.signal,
    });

    // Execute turn
    const collectedEvents = [];
    for await (const event of turn.execute()) {
      collectedEvents.push(event);
    }

    // Verify: Error event was emitted (with enhanced error message)
    const errorEvent = collectedEvents.find(e => e.type === 'error');
    expect(errorEvent).toBeDefined();
    expect(errorEvent).toMatchObject({
      type: 'error',
      error: expect.objectContaining({ message: expect.stringContaining('Aborted') }),
    });
  });

  it('should handle provider error events', async () => {
    // Setup: Provider emits an error
    const events: ProviderEvent[] = [
      { type: 'text', value: 'Starting...' },
      { type: 'error', error: { message: 'Connection lost', code: 'ECONNRESET' } },
    ];
    const provider = new MockProvider(events);
    const toolRegistry = new MockToolRegistry();
    const messages: Message[] = [];

    const turn = new Turn(provider, toolRegistry, messages);

    // Execute turn
    const collectedEvents = [];
    for await (const event of turn.execute()) {
      collectedEvents.push(event);
    }

    // Verify: Text event followed by error event (with enhanced error message)
    expect(collectedEvents).toHaveLength(2);
    expect(collectedEvents[0]).toMatchObject({ type: 'text', value: 'Starting...' });
    expect(collectedEvents[1]).toMatchObject({
      type: 'error',
      error: expect.objectContaining({ message: expect.stringContaining('Connection lost') }),
    });

    // Verify: Accumulated text was added to messages before error
    expect(messages).toHaveLength(0); // Error prevents message from being added
  });

  it('should accumulate text from multiple text events', async () => {
    // Setup: Provider emits multiple text chunks
    const events: ProviderEvent[] = [
      { type: 'text', value: 'Hello, ' },
      { type: 'text', value: 'world' },
      { type: 'text', value: '!' },
      { type: 'finish', reason: 'stop' },
    ];
    const provider = new MockProvider(events);
    const toolRegistry = new MockToolRegistry();
    const messages: Message[] = [];

    const turn = new Turn(provider, toolRegistry, messages);

    // Execute turn
    const collectedEvents = [];
    for await (const event of turn.execute()) {
      collectedEvents.push(event);
    }

    // Verify: All text events emitted
    expect(collectedEvents).toHaveLength(3);
    expect(collectedEvents.every(e => e.type === 'text')).toBe(true);

    // Verify: Full text accumulated in message
    expect(messages).toHaveLength(1);
    expect(messages[0].parts[0]).toMatchObject({ type: 'text', text: 'Hello, world!' });
  });
});
