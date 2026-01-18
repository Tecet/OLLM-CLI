/**
 * Unit tests for LocalProvider adapter.
 * Tests message format conversion, stream event parsing, and error handling.
 * 
 * Feature: stage-08-testing-qa
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as fc from 'fast-check';
import { LocalProvider } from '../localProvider.js';
import type { Message, MessagePart, ToolSchema, ProviderRequest, ProviderEvent } from '@ollm/core';

describe('LocalProvider', () => {
  let provider: LocalProvider;

  beforeEach(() => {
    provider = new LocalProvider({ baseUrl: 'http://localhost:11434' });
  });

  describe('Message Format Conversion', () => {
    /**
     * Property 1: Message Format Conversion Completeness
     * Feature: stage-08-testing-qa, Property 1: Message Format Conversion Completeness
     * 
     * For any message (user, assistant, tool call, or tool result), converting it to 
     * provider format should produce a valid provider message with all required fields 
     * present and correctly populated.
     * 
     * Validates: Requirements 1.1, 1.2, 1.3, 1.4
     */
    it('Property 1: converts all message types with complete fields', () => {
      // Arbitrary for generating messages
      const arbRole = fc.constantFrom('user', 'assistant', 'system', 'tool');
      const arbText = fc.string({ minLength: 1, maxLength: 500 });
      
      const arbMessage = fc.record({
        role: arbRole,
        parts: fc.array(
          fc.record({
            type: fc.constant('text' as const),
            text: arbText,
          }),
          { minLength: 1, maxLength: 3 }
        ),
        name: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }),
      });

      fc.assert(
        fc.property(arbMessage, (message: Message) => {
          // Access private method via type assertion for testing
          const mapped = (provider as any).mapMessages([message], undefined);
          
          // Should produce exactly one mapped message
          expect(mapped).toHaveLength(1);
          
          const mappedMsg = mapped[0];
          
          // Should have role field
          expect(mappedMsg).toHaveProperty('role');
          expect(mappedMsg.role).toBe(message.role);
          
          // Should have content field
          expect(mappedMsg).toHaveProperty('content');
          expect(typeof mappedMsg.content).toBe('string');
          
          // Content should be concatenation of all text parts
          const expectedContent = message.parts
            .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
            .map(p => p.text)
            .join('');
          expect(mappedMsg.content).toBe(expectedContent);
          
          // If message has name, mapped message should have name
          if (message.name) {
            expect(mappedMsg).toHaveProperty('name');
            expect(mappedMsg.name).toBe(message.name);
          }
        }),
        { numRuns: 100 }
      );
    });

    it('converts user messages correctly', () => {
      const message: Message = {
        role: 'user',
        parts: [{ type: 'text', text: 'Hello, world!' }],
      };

      const mapped = (provider as any).mapMessages([message], undefined);

      expect(mapped).toHaveLength(1);
      expect(mapped[0]).toEqual({
        role: 'user',
        content: 'Hello, world!',
      });
    });

    it('converts assistant messages correctly', () => {
      const message: Message = {
        role: 'assistant',
        parts: [{ type: 'text', text: 'Hi there!' }],
      };

      const mapped = (provider as any).mapMessages([message], undefined);

      expect(mapped).toHaveLength(1);
      expect(mapped[0]).toEqual({
        role: 'assistant',
        content: 'Hi there!',
      });
    });

    it('converts tool messages with name correctly', () => {
      const message: Message = {
        role: 'tool',
        parts: [{ type: 'text', text: 'Tool result' }],
        name: 'get_weather',
      };

      const mapped = (provider as any).mapMessages([message], undefined);

      expect(mapped).toHaveLength(1);
      expect(mapped[0]).toEqual({
        role: 'tool',
        content: 'Tool result',
        name: 'get_weather',
      });
    });

    it('includes system prompt when provided', () => {
      const message: Message = {
        role: 'user',
        parts: [{ type: 'text', text: 'Hello' }],
      };

      const mapped = (provider as any).mapMessages([message], 'You are helpful');

      expect(mapped).toHaveLength(2);
      expect(mapped[0]).toEqual({
        role: 'system',
        content: 'You are helpful',
      });
      expect(mapped[1]).toEqual({
        role: 'user',
        content: 'Hello',
      });
    });

    it('handles multi-part messages', () => {
      const message: Message = {
        role: 'user',
        parts: [
          { type: 'text', text: 'Part 1 ' },
          { type: 'text', text: 'Part 2' },
        ],
      };

      const mapped = (provider as any).mapMessages([message], undefined);

      expect(mapped).toHaveLength(1);
      expect(mapped[0].content).toBe('Part 1 Part 2');
    });

    it('handles image parts by replacing with placeholder', () => {
      const message: Message = {
        role: 'user',
        parts: [
          { type: 'text', text: 'What is this? ' },
          { type: 'image', data: 'base64data', mimeType: 'image/png' },
        ],
      };

      const mapped = (provider as any).mapMessages([message], undefined);

      expect(mapped).toHaveLength(1);
      expect(mapped[0].content).toBe('What is this? [image]');
    });
  });

  describe('Tool Schema Mapping', () => {
    it('converts tool schemas to Ollama format', () => {
      const tools: ToolSchema[] = [
        {
          name: 'get_weather',
          description: 'Get weather for a location',
          parameters: {
            type: 'object',
            properties: {
              location: { type: 'string' },
            },
            required: ['location'],
          },
        },
      ];

      const mapped = (provider as any).mapTools(tools);

      expect(mapped).toHaveLength(1);
      expect(mapped[0]).toEqual({
        type: 'function',
        function: {
          name: 'get_weather',
          description: 'Get weather for a location',
          parameters: {
            type: 'object',
            properties: {
              location: { type: 'string' },
            },
            required: ['location'],
          },
        },
      });
    });

    it('handles tools without description', () => {
      const tools: ToolSchema[] = [
        {
          name: 'simple_tool',
          parameters: { type: 'object', properties: {} },
        },
      ];

      const mapped = (provider as any).mapTools(tools);

      expect(mapped).toHaveLength(1);
      expect(mapped[0].function.name).toBe('simple_tool');
      expect(mapped[0].function.description).toBeUndefined();
    });

    it('handles multiple tools', () => {
      const tools: ToolSchema[] = [
        { name: 'tool1', parameters: {} },
        { name: 'tool2', parameters: {} },
        { name: 'tool3', parameters: {} },
      ];

      const mapped = (provider as any).mapTools(tools);

      expect(mapped).toHaveLength(3);
      expect(mapped[0].function.name).toBe('tool1');
      expect(mapped[1].function.name).toBe('tool2');
      expect(mapped[2].function.name).toBe('tool3');
    });
  });
});

  describe('Error Handling', () => {
    /**
     * Tests for error handling edge cases.
     * Validates: Requirements 1.8, 1.9, 1.10
     */

    it('handles network errors gracefully', async () => {
      // Create provider with invalid URL to simulate network error
      const provider = new LocalProvider({ baseUrl: 'http://invalid-host-that-does-not-exist:99999' });

      const request: ProviderRequest = {
        model: 'test-model',
        messages: [{ role: 'user', parts: [{ type: 'text', text: 'Hello' }] }],
      };

      const events: ProviderEvent[] = [];
      for await (const event of provider.chatStream(request)) {
        events.push(event);
      }

      // Should yield an error event
      expect(events.length).toBeGreaterThan(0);
      const errorEvent = events.find(e => e.type === 'error');
      expect(errorEvent).toBeDefined();
      expect(errorEvent?.type).toBe('error');
      if (errorEvent?.type === 'error') {
        expect(errorEvent.error.message).toBeDefined();
        expect(typeof errorEvent.error.message).toBe('string');
      }
    });

    it('handles malformed JSON responses gracefully', async () => {
      // Mock fetch to return malformed JSON
      const originalFetch = global.fetch;
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        body: {
          getReader: () => ({
            read: vi.fn()
              .mockResolvedValueOnce({
                done: false,
                value: new TextEncoder().encode('{"invalid json\n'),
              })
              .mockResolvedValueOnce({
                done: false,
                value: new TextEncoder().encode('{"message":{"content":"valid"},"done":false}\n'),
              })
              .mockResolvedValueOnce({
                done: true,
                value: undefined,
              }),
          }),
        },
      });

      const provider = new LocalProvider({ baseUrl: 'http://localhost:11434' });
      const request: ProviderRequest = {
        model: 'test-model',
        messages: [{ role: 'user', parts: [{ type: 'text', text: 'Hello' }] }],
      };

      const events: ProviderEvent[] = [];
      for await (const event of provider.chatStream(request)) {
        events.push(event);
      }

      // Should skip malformed JSON and process valid chunks
      const textEvents = events.filter(e => e.type === 'text');
      expect(textEvents.length).toBeGreaterThan(0);
      expect(textEvents[0].type).toBe('text');
      if (textEvents[0].type === 'text') {
        expect(textEvents[0].value).toBe('valid');
      }

      // Should have a finish event
      const finishEvent = events.find(e => e.type === 'finish');
      expect(finishEvent).toBeDefined();

      // Restore original fetch
      global.fetch = originalFetch;
    });

    it('handles HTTP error responses gracefully', async () => {
      // Mock fetch to return HTTP error
      const originalFetch = global.fetch;
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: vi.fn().mockResolvedValue('Internal Server Error'),
      });

      const provider = new LocalProvider({ baseUrl: 'http://localhost:11434' });
      const request: ProviderRequest = {
        model: 'test-model',
        messages: [{ role: 'user', parts: [{ type: 'text', text: 'Hello' }] }],
      };

      const events: ProviderEvent[] = [];
      for await (const event of provider.chatStream(request)) {
        events.push(event);
      }

      // Should yield an error event with HTTP status
      expect(events.length).toBeGreaterThan(0);
      const errorEvent = events.find(e => e.type === 'error');
      expect(errorEvent).toBeDefined();
      expect(errorEvent?.type).toBe('error');
      if (errorEvent?.type === 'error') {
        expect(errorEvent.error.message).toContain('500');
        expect(errorEvent.error.message).toContain('Internal Server Error');
        expect(errorEvent.error.code).toBe('500');
      }

      // Restore original fetch
      global.fetch = originalFetch;
    });

    it('handles missing response body gracefully', async () => {
      // Mock fetch to return response without body
      const originalFetch = global.fetch;
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        body: null,
      });

      const provider = new LocalProvider({ baseUrl: 'http://localhost:11434' });
      const request: ProviderRequest = {
        model: 'test-model',
        messages: [{ role: 'user', parts: [{ type: 'text', text: 'Hello' }] }],
      };

      const events: ProviderEvent[] = [];
      for await (const event of provider.chatStream(request)) {
        events.push(event);
      }

      // Should yield an error event
      expect(events.length).toBeGreaterThan(0);
      const errorEvent = events.find(e => e.type === 'error');
      expect(errorEvent).toBeDefined();
      expect(errorEvent?.type).toBe('error');
      if (errorEvent?.type === 'error') {
        expect(errorEvent.error.message).toContain('No response body');
      }

      // Restore original fetch
      global.fetch = originalFetch;
    });

    it('handles timeout errors gracefully', async () => {
      // Mock fetch to simulate timeout via AbortSignal
      const originalFetch = global.fetch;
      global.fetch = vi.fn().mockImplementation(() => {
        return new Promise((_, reject) => {
          const error = new Error('The operation was aborted');
          error.name = 'AbortError';
          reject(error);
        });
      });

      const provider = new LocalProvider({ baseUrl: 'http://localhost:11434' });
      const abortController = new AbortController();
      
      const request: ProviderRequest = {
        model: 'test-model',
        messages: [{ role: 'user', parts: [{ type: 'text', text: 'Hello' }] }],
        abortSignal: abortController.signal,
      };

      // Simulate timeout by aborting
      setTimeout(() => abortController.abort(), 10);

      const events: ProviderEvent[] = [];
      for await (const event of provider.chatStream(request)) {
        events.push(event);
      }

      // Should yield a finish event (graceful termination on abort)
      expect(events.length).toBeGreaterThan(0);
      const finishEvent = events.find(e => e.type === 'finish');
      expect(finishEvent).toBeDefined();
      expect(finishEvent?.type).toBe('finish');
      if (finishEvent?.type === 'finish') {
        expect(finishEvent.reason).toBe('stop');
      }

      // Restore original fetch
      global.fetch = originalFetch;
    });

    it('handles generic errors gracefully', async () => {
      // Mock fetch to throw a generic error
      const originalFetch = global.fetch;
      global.fetch = vi.fn().mockRejectedValue(new Error('Connection refused'));

      const provider = new LocalProvider({ baseUrl: 'http://localhost:11434' });
      const request: ProviderRequest = {
        model: 'test-model',
        messages: [{ role: 'user', parts: [{ type: 'text', text: 'Hello' }] }],
      };

      const events: ProviderEvent[] = [];
      for await (const event of provider.chatStream(request)) {
        events.push(event);
      }

      // Should yield an error event
      expect(events.length).toBeGreaterThan(0);
      const errorEvent = events.find(e => e.type === 'error');
      expect(errorEvent).toBeDefined();
      expect(errorEvent?.type).toBe('error');
      if (errorEvent?.type === 'error') {
        expect(errorEvent.error.message).toContain('Connection refused');
      }

      // Restore original fetch
      global.fetch = originalFetch;
    });

    it('handles tool unsupported errors with retry', async () => {
      // Mock fetch to return tool error on first call, success on retry
      const originalFetch = global.fetch;
      let callCount = 0;
      
      global.fetch = vi.fn().mockImplementation((url, options) => {
        callCount++;
        const body = JSON.parse(options?.body as string);
        
        // First call with tools should fail
        if (callCount === 1 && body.tools) {
          return Promise.resolve({
            ok: false,
            status: 400,
            statusText: 'Bad Request',
            text: vi.fn().mockResolvedValue('error: unknown field: tools'),
          });
        }
        
        // Second call without tools should succeed
        return Promise.resolve({
          ok: true,
          body: {
            getReader: () => ({
              read: vi.fn()
                .mockResolvedValueOnce({
                  done: false,
                  value: new TextEncoder().encode('{"message":{"content":"Success"},"done":false}\n'),
                })
                .mockResolvedValueOnce({
                  done: false,
                  value: new TextEncoder().encode('{"done":true,"done_reason":"stop"}\n'),
                })
                .mockResolvedValueOnce({
                  done: true,
                  value: undefined,
                }),
            }),
          },
        });
      });

      const provider = new LocalProvider({ baseUrl: 'http://localhost:11434' });
      const request: ProviderRequest = {
        model: 'test-model',
        messages: [{ role: 'user', parts: [{ type: 'text', text: 'Hello' }] }],
        tools: [{ name: 'test_tool', description: 'Test tool' }],
      };

      const events: ProviderEvent[] = [];
      for await (const event of provider.chatStream(request)) {
        events.push(event);
      }

      // Should have made 2 fetch calls (initial + retry)
      expect(callCount).toBe(2);

      // Should yield an error event for tool unsupported
      const errorEvents = events.filter(e => e.type === 'error');
      expect(errorEvents.length).toBeGreaterThan(0);
      const toolError = errorEvents.find(e => 
        e.type === 'error' && e.error.code === 'TOOL_UNSUPPORTED'
      );
      expect(toolError).toBeDefined();
      if (toolError?.type === 'error') {
        expect(toolError.error.message).toContain('Tool support error');
        expect(toolError.error.code).toBe('TOOL_UNSUPPORTED');
        expect(toolError.error.httpStatus).toBe(400);
        expect(toolError.error.originalError).toContain('unknown field: tools');
      }

      // Should also yield text from successful retry
      const textEvents = events.filter(e => e.type === 'text');
      expect(textEvents.length).toBeGreaterThan(0);
      expect(textEvents[0].type).toBe('text');
      if (textEvents[0].type === 'text') {
        expect(textEvents[0].value).toBe('Success');
      }

      // Should have a finish event
      const finishEvent = events.find(e => e.type === 'finish');
      expect(finishEvent).toBeDefined();

      // Restore original fetch
      global.fetch = originalFetch;
    });

    it('handles tool error retry failure', async () => {
      // Mock fetch to return tool error on first call, different error on retry
      const originalFetch = global.fetch;
      let callCount = 0;
      
      global.fetch = vi.fn().mockImplementation((url, options) => {
        callCount++;
        const body = JSON.parse(options?.body as string);
        
        // First call with tools should fail
        if (callCount === 1 && body.tools) {
          return Promise.resolve({
            ok: false,
            status: 400,
            statusText: 'Bad Request',
            text: vi.fn().mockResolvedValue('error: unknown field: tools'),
          });
        }
        
        // Second call without tools should also fail
        return Promise.resolve({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
          text: vi.fn().mockResolvedValue('Server error'),
        });
      });

      const provider = new LocalProvider({ baseUrl: 'http://localhost:11434' });
      const request: ProviderRequest = {
        model: 'test-model',
        messages: [{ role: 'user', parts: [{ type: 'text', text: 'Hello' }] }],
        tools: [{ name: 'test_tool', description: 'Test tool' }],
      };

      const events: ProviderEvent[] = [];
      for await (const event of provider.chatStream(request)) {
        events.push(event);
      }

      // Should have made 2 fetch calls (initial + retry)
      expect(callCount).toBe(2);

      // Should yield two error events (tool error + retry error)
      const errorEvents = events.filter(e => e.type === 'error');
      expect(errorEvents.length).toBe(2);
      
      // First error should be tool unsupported
      expect(errorEvents[0].type).toBe('error');
      if (errorEvents[0].type === 'error') {
        expect(errorEvents[0].error.code).toBe('TOOL_UNSUPPORTED');
      }
      
      // Second error should be the retry failure
      expect(errorEvents[1].type).toBe('error');
      if (errorEvents[1].type === 'error') {
        expect(errorEvents[1].error.code).toBe('500');
        expect(errorEvents[1].error.message).toContain('Server error');
      }

      // Restore original fetch
      global.fetch = originalFetch;
    });

    it('handles empty stream chunks gracefully', async () => {
      // Mock fetch to return empty chunks
      const originalFetch = global.fetch;
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        body: {
          getReader: () => ({
            read: vi.fn()
              .mockResolvedValueOnce({
                done: false,
                value: new TextEncoder().encode('\n\n\n'),
              })
              .mockResolvedValueOnce({
                done: false,
                value: new TextEncoder().encode('{"message":{"content":"text"},"done":false}\n'),
              })
              .mockResolvedValueOnce({
                done: true,
                value: undefined,
              }),
          }),
        },
      });

      const provider = new LocalProvider({ baseUrl: 'http://localhost:11434' });
      const request: ProviderRequest = {
        model: 'test-model',
        messages: [{ role: 'user', parts: [{ type: 'text', text: 'Hello' }] }],
      };

      const events: ProviderEvent[] = [];
      for await (const event of provider.chatStream(request)) {
        events.push(event);
      }

      // Should skip empty lines and process valid chunks
      const textEvents = events.filter(e => e.type === 'text');
      expect(textEvents.length).toBeGreaterThan(0);
      expect(textEvents[0].type).toBe('text');
      if (textEvents[0].type === 'text') {
        expect(textEvents[0].value).toBe('text');
      }

      // Restore original fetch
      global.fetch = originalFetch;
    });
  });

  describe('Stream Event Parsing', () => {
    let provider: LocalProvider;

    beforeEach(() => {
      provider = new LocalProvider({ baseUrl: 'http://localhost:11434' });
    });

    /**
     * Property 2: Stream Event Parsing Correctness
     * Feature: stage-08-testing-qa, Property 2: Stream Event Parsing Correctness
     * 
     * For any stream event (text delta, tool call, or completion), parsing it should 
     * correctly extract all event data without loss of information.
     * 
     * Validates: Requirements 1.5, 1.6, 1.7
     */
    it('Property 2: parses all stream event types correctly', () => {
      // Arbitrary for generating stream chunks
      const arbTextChunk = fc.record({
        message: fc.record({
          content: fc.string({ minLength: 0, maxLength: 100 }),
        }),
        done: fc.constant(false),
      });

      const arbToolCallChunk = fc.record({
        message: fc.record({
          tool_calls: fc.array(
            fc.record({
              id: fc.option(fc.string({ minLength: 5, maxLength: 20 }), { nil: undefined }),
              function: fc.record({
                name: fc.string({ minLength: 1, maxLength: 50 }),
                arguments: fc.jsonValue().map(v => JSON.stringify(v)),
              }),
            }),
            { minLength: 1, maxLength: 3 }
          ),
        }),
        done: fc.constant(false),
      });

      const arbCompletionChunk = fc.record({
        done: fc.constant(true),
        done_reason: fc.option(
          fc.constantFrom('stop', 'length', 'tool_calls'),
          { nil: undefined }
        ),
      });

      const arbChunk = fc.oneof(arbTextChunk, arbToolCallChunk, arbCompletionChunk);

      fc.assert(
        fc.property(arbChunk, (chunk: any) => {
          const events = Array.from((provider as any).mapChunkToEvents(chunk));

          // Should produce at least one event
          expect(events.length).toBeGreaterThan(0);

          for (const event of events) {
            // All events should have a type
            expect(event).toHaveProperty('type');
            expect(['text', 'tool_call', 'finish', 'error']).toContain(event.type);

            // Validate event structure based on type
            if (event.type === 'text') {
              expect(event).toHaveProperty('value');
              expect(typeof event.value).toBe('string');
            } else if (event.type === 'tool_call') {
              expect(event).toHaveProperty('value');
              expect(event.value).toHaveProperty('id');
              expect(event.value).toHaveProperty('name');
              expect(event.value).toHaveProperty('args');
              expect(typeof event.value.args).toBe('object');
            } else if (event.type === 'finish') {
              expect(event).toHaveProperty('reason');
              expect(['stop', 'length', 'tool']).toContain(event.reason);
            }
          }
        }),
        { numRuns: 100 }
      );
    });

    it('parses text delta events correctly', () => {
      const chunk = {
        message: { content: 'Hello' },
        done: false,
      };

      const events = Array.from((provider as any).mapChunkToEvents(chunk));

      expect(events).toHaveLength(1);
      expect(events[0]).toEqual({
        type: 'text',
        value: 'Hello',
      });
    });

    it('parses tool call events correctly', () => {
      const chunk = {
        message: {
          tool_calls: [
            {
              id: 'call_123',
              function: {
                name: 'get_weather',
                arguments: '{"location":"Seattle"}',
              },
            },
          ],
        },
        done: false,
      };

      const events = Array.from((provider as any).mapChunkToEvents(chunk));

      expect(events).toHaveLength(1);
      expect(events[0]).toEqual({
        type: 'tool_call',
        value: {
          id: 'call_123',
          name: 'get_weather',
          args: { location: 'Seattle' },
        },
      });
    });

    it('generates ID for tool calls without ID', () => {
      const chunk = {
        message: {
          tool_calls: [
            {
              function: {
                name: 'get_time',
                arguments: '{}',
              },
            },
          ],
        },
        done: false,
      };

      const events = Array.from((provider as any).mapChunkToEvents(chunk));

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('tool_call');
      expect(events[0].value.id).toBeDefined();
      expect(events[0].value.id.length).toBeGreaterThan(0);
    });

    it('parses completion events correctly', () => {
      const chunk = {
        done: true,
        done_reason: 'stop',
      };

      const events = Array.from((provider as any).mapChunkToEvents(chunk));

      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        type: 'finish',
        reason: 'stop',
      });
      // Should also include metrics
      expect(events[0]).toHaveProperty('metrics');
    });

    it('uses default reason when done_reason is missing', () => {
      const chunk = {
        done: true,
      };

      const events = Array.from((provider as any).mapChunkToEvents(chunk));

      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        type: 'finish',
        reason: 'stop',
      });
      // Should also include metrics
      expect(events[0]).toHaveProperty('metrics');
    });

    it('handles multiple tool calls in one chunk', () => {
      const chunk = {
        message: {
          tool_calls: [
            {
              id: 'call_1',
              function: { name: 'tool1', arguments: '{"a":1}' },
            },
            {
              id: 'call_2',
              function: { name: 'tool2', arguments: '{"b":2}' },
            },
          ],
        },
        done: false,
      };

      const events = Array.from((provider as any).mapChunkToEvents(chunk));

      expect(events).toHaveLength(2);
      expect(events[0].type).toBe('tool_call');
      expect(events[0].value.name).toBe('tool1');
      expect(events[1].type).toBe('tool_call');
      expect(events[1].value.name).toBe('tool2');
    });

    it('handles empty tool call arguments', () => {
      const chunk = {
        message: {
          tool_calls: [
            {
              id: 'call_123',
              function: {
                name: 'get_time',
                arguments: '',
              },
            },
          ],
        },
        done: false,
      };

      const events = Array.from((provider as any).mapChunkToEvents(chunk));

      expect(events).toHaveLength(1);
      expect(events[0].value.args).toEqual({});
    });

    it('handles chunk with both content and done', () => {
      const chunk = {
        message: { content: 'Final text' },
        done: true,
        done_reason: 'stop',
      };

      const events = Array.from((provider as any).mapChunkToEvents(chunk));

      expect(events).toHaveLength(2);
      expect(events[0]).toEqual({ type: 'text', value: 'Final text' });
      expect(events[1]).toMatchObject({ type: 'finish', reason: 'stop' });
      // Should also include metrics
      expect(events[1]).toHaveProperty('metrics');
    });
  });
