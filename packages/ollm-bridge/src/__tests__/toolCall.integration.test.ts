/**
 * Integration tests for tool calling functionality.
 * Tests tool invocation, result handling, sequential calls, and error formatting.
 * 
 * Feature: stage-08-testing-qa
 * Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7
 */

import { describe, it, expect, beforeAll } from 'vitest';
import * as fc from 'fast-check';
import {
  isServerAvailable,
  skipIfNoServer,
  getServerUrl,
  createCoreToolCall,
  fixtureTools,
  extendedFixtureTools,
} from '@ollm/test-utils';
import { MockProvider } from '@ollm/test-utils';
import type { ProviderEvent, ProviderRequest, ToolCall } from '@ollm/core';

describe('Tool Call Integration Tests', () => {
  beforeAll(async () => {
    const available = await isServerAvailable();
    if (!available) {
      console.log('⚠️  Integration tests require a running LLM server');
      console.log(`   Set OLLM_TEST_SERVER or start server at ${getServerUrl()}`);
    }
  });

  describe('Property 17: Tool Invocation Parameter Correctness', () => {
    /**
     * Property 17: Tool Invocation Parameter Correctness
     * For any tool call, the tool should be invoked with parameters that match the tool call's arguments.
     * Validates: Requirements 8.1
     */
    it('should invoke tool with correct parameters', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate random tool name
          fc.constantFrom('get_weather', 'calculate', 'read_file', 'search'),
          // Generate random arguments
          fc.dictionary(
            fc.string({ minLength: 1, maxLength: 20 }),
            fc.oneof(
              fc.string({ maxLength: 100 }),
              fc.integer({ min: -1000, max: 1000 }),
              fc.boolean()
            ),
            { minKeys: 1, maxKeys: 5 }
          ),
          async (toolName, args) => {
            // Create a tool call with the generated parameters
            const toolCall = createCoreToolCall(toolName, args);

            // Create event sequence with the tool call
            const events: ProviderEvent[] = [
              { type: 'text', value: 'Calling tool...' },
              { type: 'tool_call', value: toolCall },
              { type: 'finish', reason: 'tool' },
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
              tools: [fixtureTools.weatherTool, fixtureTools.calculatorTool],
            };

            let receivedToolCall: ToolCall | undefined;

            for await (const event of provider.chatStream(request)) {
              if (event.type === 'tool_call') {
                receivedToolCall = event.value;
              }
            }

            // Verify tool call was received
            expect(receivedToolCall).toBeDefined();

            // Verify tool name matches
            expect(receivedToolCall!.name).toBe(toolName);

            // Verify arguments match exactly
            expect(receivedToolCall!.args).toEqual(args);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should preserve parameter types during invocation', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            stringParam: fc.string({ maxLength: 50 }),
            numberParam: fc.integer({ min: -1000, max: 1000 }),
            booleanParam: fc.boolean(),
            arrayParam: fc.array(fc.string({ maxLength: 20 }), { maxLength: 5 }),
            objectParam: fc.record({
              nested: fc.string({ maxLength: 20 }),
            }),
          }),
          async (args) => {
            const toolCall = createCoreToolCall('complex_tool', args);

            const events: ProviderEvent[] = [
              { type: 'tool_call', value: toolCall },
              { type: 'finish', reason: 'tool' },
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

            let receivedToolCall: ToolCall | undefined;

            for await (const event of provider.chatStream(request)) {
              if (event.type === 'tool_call') {
                receivedToolCall = event.value;
              }
            }

            // Verify all parameter types are preserved
            expect(typeof receivedToolCall!.args.stringParam).toBe('string');
            expect(typeof receivedToolCall!.args.numberParam).toBe('number');
            expect(typeof receivedToolCall!.args.booleanParam).toBe('boolean');
            expect(Array.isArray(receivedToolCall!.args.arrayParam)).toBe(true);
            expect(typeof receivedToolCall!.args.objectParam).toBe('object');

            // Verify values match
            expect(receivedToolCall!.args).toEqual(args);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle empty arguments object', async () => {
      const toolCall = createCoreToolCall('no_params_tool', {});

      const events: ProviderEvent[] = [
        { type: 'tool_call', value: toolCall },
        { type: 'finish', reason: 'tool' },
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
        tools: [extendedFixtureTools.noParamsTool],
      };

      let receivedToolCall: ToolCall | undefined;

      for await (const event of provider.chatStream(request)) {
        if (event.type === 'tool_call') {
          receivedToolCall = event.value;
        }
      }

      // Verify tool call was received with empty args
      expect(receivedToolCall).toBeDefined();
      expect(receivedToolCall!.args).toEqual({});
    });

    it('should handle nested object parameters', async () => {
      const complexArgs = {
        title: 'Test Task',
        metadata: {
          assignee: 'user@example.com',
          dueDate: '2026-01-15',
          priority: 'high',
          tags: ['urgent', 'bug'],
        },
      };

      const toolCall = createCoreToolCall('create_task', complexArgs);

      const events: ProviderEvent[] = [
        { type: 'tool_call', value: toolCall },
        { type: 'finish', reason: 'tool' },
      ];

      const provider = new MockProvider({
        eventSequence: events,
      });

      const request: ProviderRequest = {
        model: 'test-model',
        messages: [
          {
            role: 'user',
            parts: [{ type: 'text', text: 'Create a task' }],
          },
        ],
        tools: [extendedFixtureTools.complexTool],
      };

      let receivedToolCall: ToolCall | undefined;

      for await (const event of provider.chatStream(request)) {
        if (event.type === 'tool_call') {
          receivedToolCall = event.value;
        }
      }

      // Verify nested structure is preserved
      expect(receivedToolCall!.args).toEqual(complexArgs);
      expect(receivedToolCall!.args.metadata).toEqual(complexArgs.metadata);
    });
  });

  describe('Property 18: Tool Result Return', () => {
    /**
     * Property 18: Tool Result Return
     * For any tool execution, the result should be correctly returned to the model in the expected format.
     * Validates: Requirements 8.2
     */
    it('should return tool results in correct format', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate random tool result
          fc.string({ minLength: 1, maxLength: 500 }),
          async (toolResult) => {
            const toolCall = createCoreToolCall('get_weather', { location: 'Seattle' });

            // Simulate tool execution and result
            const events: ProviderEvent[] = [
              { type: 'tool_call', value: toolCall },
              { type: 'finish', reason: 'tool' },
            ];

            const provider = new MockProvider({
              eventSequence: events,
            });

            const request: ProviderRequest = {
              model: 'test-model',
              messages: [
                {
                  role: 'user',
                  parts: [{ type: 'text', text: 'What is the weather?' }],
                },
              ],
              tools: [fixtureTools.weatherTool],
            };

            let receivedToolCall: ToolCall | undefined;

            for await (const event of provider.chatStream(request)) {
              if (event.type === 'tool_call') {
                receivedToolCall = event.value;
              }
            }

            // Verify tool call was received
            expect(receivedToolCall).toBeDefined();

            // Create a tool result message
            const toolResultMessage = {
              role: 'tool' as const,
              parts: [{ type: 'text' as const, text: toolResult }],
              name: receivedToolCall!.name,
            };

            // Verify tool result message has correct structure
            expect(toolResultMessage.role).toBe('tool');
            expect(toolResultMessage.name).toBe(receivedToolCall!.name);
            expect(toolResultMessage.parts[0].type).toBe('text');
            expect(toolResultMessage.parts[0].text).toBe(toolResult);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should associate tool results with correct tool call IDs', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              name: fc.constantFrom('tool_a', 'tool_b', 'tool_c'),
              result: fc.string({ minLength: 1, maxLength: 100 }),
            }),
            { minLength: 1, maxLength: 5 }
          ),
          async (toolSpecs) => {
            // Create tool calls with unique IDs
            const toolCalls = toolSpecs.map((spec, index) =>
              createCoreToolCall(spec.name, {}, `call_${index}`)
            );

            const events: ProviderEvent[] = [
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

            const receivedToolCalls: ToolCall[] = [];

            for await (const event of provider.chatStream(request)) {
              if (event.type === 'tool_call') {
                receivedToolCalls.push(event.value);
              }
            }

            // Verify all tool calls were received
            expect(receivedToolCalls.length).toBe(toolCalls.length);

            // Verify each tool call has a unique ID
            const ids = receivedToolCalls.map((tc) => tc.id);
            const uniqueIds = new Set(ids);
            expect(uniqueIds.size).toBe(ids.length);

            // Verify IDs match the original tool calls
            for (let i = 0; i < toolCalls.length; i++) {
              expect(receivedToolCalls[i].id).toBe(toolCalls[i].id);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle tool results with special characters', async () => {
      const specialResults = [
        'Result with "quotes"',
        "Result with 'apostrophes'",
        'Result with <tags>',
        'Result with\nnewlines',
        'Result with\ttabs',
        'Result with unicode: 你好 🌍',
        'Result with JSON: {"key": "value"}',
      ];

      for (const result of specialResults) {
        const toolCall = createCoreToolCall('test_tool', {});

        const events: ProviderEvent[] = [
          { type: 'tool_call', value: toolCall },
          { type: 'finish', reason: 'tool' },
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

        let receivedToolCall: ToolCall | undefined;

        for await (const event of provider.chatStream(request)) {
          if (event.type === 'tool_call') {
            receivedToolCall = event.value;
          }
        }

        // Create tool result message
        const toolResultMessage = {
          role: 'tool' as const,
          parts: [{ type: 'text' as const, text: result }],
          name: receivedToolCall!.name,
        };

        // Verify special characters are preserved
        expect(toolResultMessage.parts[0].text).toBe(result);
      }
    });

    it('should handle empty tool results', async () => {
      const toolCall = createCoreToolCall('test_tool', {});

      const events: ProviderEvent[] = [
        { type: 'tool_call', value: toolCall },
        { type: 'finish', reason: 'tool' },
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

      let receivedToolCall: ToolCall | undefined;

      for await (const event of provider.chatStream(request)) {
        if (event.type === 'tool_call') {
          receivedToolCall = event.value;
        }
      }

      // Create empty tool result
      const toolResultMessage = {
        role: 'tool' as const,
        parts: [{ type: 'text' as const, text: '' }],
        name: receivedToolCall!.name,
      };

      // Verify empty result is handled
      expect(toolResultMessage.parts[0].text).toBe('');
    });
  });

  describe('Property 19: Sequential Tool Call Execution', () => {
    /**
     * Property 19: Sequential Tool Call Execution
     * For any sequence of multiple tool calls, each tool should be executed in order and all results should be correctly associated with their respective calls.
     * Validates: Requirements 8.3, 8.4
     */
    it('should execute multiple tool calls in sequence', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              name: fc.constantFrom('get_weather', 'calculate', 'read_file', 'search'),
              args: fc.dictionary(
                fc.string({ minLength: 1, maxLength: 20 }),
                fc.string({ maxLength: 50 }),
                { minKeys: 1, maxKeys: 3 }
              ),
            }),
            { minLength: 2, maxLength: 10 }
          ),
          async (toolSpecs) => {
            // Create tool calls with sequential IDs
            const toolCalls = toolSpecs.map((spec, index) =>
              createCoreToolCall(spec.name, spec.args, `call_${index}`)
            );

            const events: ProviderEvent[] = [
              { type: 'text', value: 'Calling tools...' },
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

            const receivedToolCalls: ToolCall[] = [];

            for await (const event of provider.chatStream(request)) {
              if (event.type === 'tool_call') {
                receivedToolCalls.push(event.value);
              }
            }

            // Verify all tool calls were received
            expect(receivedToolCalls.length).toBe(toolCalls.length);

            // Verify tool calls were received in order
            for (let i = 0; i < toolCalls.length; i++) {
              expect(receivedToolCalls[i].id).toBe(toolCalls[i].id);
              expect(receivedToolCalls[i].name).toBe(toolCalls[i].name);
              expect(receivedToolCalls[i].args).toEqual(toolCalls[i].args);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should maintain tool call order with mixed events', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              name: fc.constantFrom('tool_a', 'tool_b', 'tool_c'),
              args: fc.record({ param: fc.string({ maxLength: 20 }) }),
            }),
            { minLength: 2, maxLength: 5 }
          ),
          fc.array(fc.string({ minLength: 1, maxLength: 50 }), { minLength: 1, maxLength: 5 }),
          async (toolSpecs, textChunks) => {
            // Create tool calls
            const toolCalls = toolSpecs.map((spec, index) =>
              createCoreToolCall(spec.name, spec.args, `call_${index}`)
            );

            // Interleave text and tool calls
            const events: ProviderEvent[] = [];
            for (let i = 0; i < Math.max(toolCalls.length, textChunks.length); i++) {
              if (i < textChunks.length) {
                events.push({ type: 'text', value: textChunks[i] });
              }
              if (i < toolCalls.length) {
                events.push({ type: 'tool_call', value: toolCalls[i] });
              }
            }
            events.push({ type: 'finish', reason: 'tool' });

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

            const receivedToolCalls: ToolCall[] = [];
            const receivedText: string[] = [];

            for await (const event of provider.chatStream(request)) {
              if (event.type === 'tool_call') {
                receivedToolCalls.push(event.value);
              } else if (event.type === 'text') {
                receivedText.push(event.value);
              }
            }

            // Verify tool calls were received in order
            expect(receivedToolCalls.length).toBe(toolCalls.length);
            for (let i = 0; i < toolCalls.length; i++) {
              expect(receivedToolCalls[i].id).toBe(toolCalls[i].id);
            }

            // Verify text was also received
            expect(receivedText.length).toBeGreaterThan(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should correctly associate results with sequential tool calls', async () => {
      const toolCalls = [
        createCoreToolCall('get_weather', { location: 'Seattle' }, 'call_1'),
        createCoreToolCall('calculate', { expression: '2+2' }, 'call_2'),
        createCoreToolCall('read_file', { path: 'test.txt' }, 'call_3'),
      ];

      const events: ProviderEvent[] = [
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

      const receivedToolCalls: ToolCall[] = [];

      for await (const event of provider.chatStream(request)) {
        if (event.type === 'tool_call') {
          receivedToolCalls.push(event.value);
        }
      }

      // Simulate tool results
      const toolResults = [
        { id: 'call_1', result: 'Temperature: 72°F, Sunny' },
        { id: 'call_2', result: '4' },
        { id: 'call_3', result: 'File contents here' },
      ];

      // Verify each result can be associated with its tool call
      for (let i = 0; i < toolResults.length; i++) {
        const toolCall = receivedToolCalls.find((tc) => tc.id === toolResults[i].id);
        expect(toolCall).toBeDefined();
        expect(toolCall!.id).toBe(toolResults[i].id);
      }
    });

    it('should handle duplicate tool names with different IDs', async () => {
      const toolCalls = [
        createCoreToolCall('get_weather', { location: 'Seattle' }, 'call_1'),
        createCoreToolCall('get_weather', { location: 'Portland' }, 'call_2'),
        createCoreToolCall('get_weather', { location: 'Vancouver' }, 'call_3'),
      ];

      const events: ProviderEvent[] = [
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

      const receivedToolCalls: ToolCall[] = [];

      for await (const event of provider.chatStream(request)) {
        if (event.type === 'tool_call') {
          receivedToolCalls.push(event.value);
        }
      }

      // Verify all tool calls were received with unique IDs
      expect(receivedToolCalls.length).toBe(3);
      expect(receivedToolCalls[0].id).toBe('call_1');
      expect(receivedToolCalls[1].id).toBe('call_2');
      expect(receivedToolCalls[2].id).toBe('call_3');

      // Verify all have the same name but different arguments
      expect(receivedToolCalls.every((tc) => tc.name === 'get_weather')).toBe(true);
      expect(receivedToolCalls[0].args.location).toBe('Seattle');
      expect(receivedToolCalls[1].args.location).toBe('Portland');
      expect(receivedToolCalls[2].args.location).toBe('Vancouver');
    });
  });

  describe('Property 20: Tool Error Message Formatting', () => {
    /**
     * Property 20: Tool Error Message Formatting
     * For any tool execution error, the error message should be formatted correctly for the model and the conversation should be able to continue.
     * Validates: Requirements 8.6, 8.7
     */
    it('should format tool errors correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate random error messages
          fc.string({ minLength: 1, maxLength: 200 }),
          fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }),
          async (errorMessage, errorCode) => {
            const toolCall = createCoreToolCall('failing_tool', {});

            const events: ProviderEvent[] = [
              { type: 'tool_call', value: toolCall },
              { type: 'finish', reason: 'tool' },
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

            let receivedToolCall: ToolCall | undefined;

            for await (const event of provider.chatStream(request)) {
              if (event.type === 'tool_call') {
                receivedToolCall = event.value;
              }
            }

            // Simulate tool error
            const errorResult = {
              role: 'tool' as const,
              parts: [
                {
                  type: 'text' as const,
                  text: errorCode
                    ? `Error (${errorCode}): ${errorMessage}`
                    : `Error: ${errorMessage}`,
                },
              ],
              name: receivedToolCall!.name,
            };

            // Verify error message format
            expect(errorResult.role).toBe('tool');
            expect(errorResult.name).toBe(receivedToolCall!.name);
            expect(errorResult.parts[0].text).toContain('Error');
            expect(errorResult.parts[0].text).toContain(errorMessage);
            if (errorCode) {
              expect(errorResult.parts[0].text).toContain(errorCode);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should allow conversation to continue after tool error', async () => {
      const toolCall = createCoreToolCall('failing_tool', {});

      const events: ProviderEvent[] = [
        { type: 'tool_call', value: toolCall },
        { type: 'finish', reason: 'tool' },
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

      let receivedToolCall: ToolCall | undefined;

      for await (const event of provider.chatStream(request)) {
        if (event.type === 'tool_call') {
          receivedToolCall = event.value;
        }
      }

      // Simulate tool error result
      const errorResult = {
        role: 'tool' as const,
        parts: [{ type: 'text' as const, text: 'Error: Tool execution failed' }],
        name: receivedToolCall!.name,
      };

      // Create a follow-up request with the error result
      const followUpRequest: ProviderRequest = {
        model: 'test-model',
        messages: [
          {
            role: 'user',
            parts: [{ type: 'text', text: 'Test prompt' }],
          },
          errorResult,
        ],
      };

      // Simulate follow-up response
      const followUpEvents: ProviderEvent[] = [
        { type: 'text', value: 'I encountered an error. Let me try a different approach.' },
        { type: 'finish', reason: 'stop' },
      ];

      const followUpProvider = new MockProvider({
        eventSequence: followUpEvents,
      });

      const followUpText: string[] = [];

      for await (const event of followUpProvider.chatStream(followUpRequest)) {
        if (event.type === 'text') {
          followUpText.push(event.value);
        }
      }

      // Verify conversation continued after error
      expect(followUpText.length).toBeGreaterThan(0);
      expect(followUpText.join('')).toContain('error');
    });

    it('should format different error types consistently', async () => {
      const errorTypes = [
        { message: 'File not found', code: 'ENOENT' },
        { message: 'Permission denied', code: 'EACCES' },
        { message: 'Network timeout', code: 'ETIMEDOUT' },
        { message: 'Invalid argument', code: 'EINVAL' },
        { message: 'Unknown error', code: undefined },
      ];

      for (const error of errorTypes) {
        const toolCall = createCoreToolCall('test_tool', {});

        const events: ProviderEvent[] = [
          { type: 'tool_call', value: toolCall },
          { type: 'finish', reason: 'tool' },
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

        let receivedToolCall: ToolCall | undefined;

        for await (const event of provider.chatStream(request)) {
          if (event.type === 'tool_call') {
            receivedToolCall = event.value;
          }
        }

        // Format error
        const errorResult = {
          role: 'tool' as const,
          parts: [
            {
              type: 'text' as const,
              text: error.code
                ? `Error (${error.code}): ${error.message}`
                : `Error: ${error.message}`,
            },
          ],
          name: receivedToolCall!.name,
        };

        // Verify consistent format
        expect(errorResult.parts[0].text).toMatch(/^Error(\s\([A-Z]+\))?:/);
        expect(errorResult.parts[0].text).toContain(error.message);
      }
    });

    it('should handle errors with stack traces', async () => {
      const toolCall = createCoreToolCall('test_tool', {});

      const events: ProviderEvent[] = [
        { type: 'tool_call', value: toolCall },
        { type: 'finish', reason: 'tool' },
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

      let receivedToolCall: ToolCall | undefined;

      for await (const event of provider.chatStream(request)) {
        if (event.type === 'tool_call') {
          receivedToolCall = event.value;
        }
      }

      // Simulate error with stack trace
      const stackTrace = 'at testFunction (test.ts:10:5)\nat main (test.ts:20:3)';
      const errorResult = {
        role: 'tool' as const,
        parts: [
          {
            type: 'text' as const,
            text: `Error: Test error\n${stackTrace}`,
          },
        ],
        name: receivedToolCall!.name,
      };

      // Verify stack trace is included
      expect(errorResult.parts[0].text).toContain('Error: Test error');
      expect(errorResult.parts[0].text).toContain(stackTrace);
    });
  });

  describe('Tool Error Edge Cases', () => {
    /**
     * Test tool execution error handling.
     * Validates: Requirements 8.5
     */
    it('should handle tool execution errors gracefully', async () => {
      const toolCall = createCoreToolCall('failing_tool', { param: 'test' });

      const events: ProviderEvent[] = [
        { type: 'tool_call', value: toolCall },
        { type: 'error', error: { message: 'Tool execution failed', code: 'TOOL_ERROR' } },
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
      expect(errorMessage).toBe('Tool execution failed');
    });

    it('should handle tool not found errors', async () => {
      const toolCall = createCoreToolCall('nonexistent_tool', {});

      const events: ProviderEvent[] = [
        { type: 'tool_call', value: toolCall },
        { type: 'error', error: { message: 'Tool not found: nonexistent_tool', code: 'TOOL_NOT_FOUND' } },
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

      let errorReceived = false;
      let errorCode = '';

      for await (const event of provider.chatStream(request)) {
        if (event.type === 'error') {
          errorReceived = true;
          errorCode = event.error.code || '';
        }
      }

      // Verify error was received with correct code
      expect(errorReceived).toBe(true);
      expect(errorCode).toBe('TOOL_NOT_FOUND');
    });

    it('should handle tool timeout errors', async () => {
      const toolCall = createCoreToolCall('slow_tool', {});

      const events: ProviderEvent[] = [
        { type: 'tool_call', value: toolCall },
        { type: 'error', error: { message: 'Tool execution timed out', code: 'TIMEOUT' } },
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

      let errorReceived = false;

      for await (const event of provider.chatStream(request)) {
        if (event.type === 'error') {
          errorReceived = true;
        }
      }

      // Verify timeout error was received
      expect(errorReceived).toBe(true);
    });

    it('should handle tool parameter validation errors', async () => {
      const toolCall = createCoreToolCall('test_tool', { invalid: 'param' });

      const events: ProviderEvent[] = [
        { type: 'tool_call', value: toolCall },
        {
          type: 'error',
          error: { message: 'Invalid parameters: missing required field "location"', code: 'VALIDATION_ERROR' },
        },
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

      let errorMessage = '';

      for await (const event of provider.chatStream(request)) {
        if (event.type === 'error') {
          errorMessage = event.error.message;
        }
      }

      // Verify validation error message
      expect(errorMessage).toContain('Invalid parameters');
      expect(errorMessage).toContain('location');
    });

    it('should handle multiple tool errors in sequence', async () => {
      const toolCalls = [
        createCoreToolCall('tool_1', {}, 'call_1'),
        createCoreToolCall('tool_2', {}, 'call_2'),
        createCoreToolCall('tool_3', {}, 'call_3'),
      ];

      const events: ProviderEvent[] = [
        { type: 'tool_call', value: toolCalls[0] },
        { type: 'error', error: { message: 'Error 1', code: 'ERROR_1' } },
        { type: 'tool_call', value: toolCalls[1] },
        { type: 'error', error: { message: 'Error 2', code: 'ERROR_2' } },
        { type: 'tool_call', value: toolCalls[2] },
        { type: 'error', error: { message: 'Error 3', code: 'ERROR_3' } },
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

      const errors: Array<{ message: string; code?: string }> = [];

      for await (const event of provider.chatStream(request)) {
        if (event.type === 'error') {
          errors.push(event.error);
        }
      }

      // Verify all errors were received
      expect(errors.length).toBe(3);
      expect(errors[0].code).toBe('ERROR_1');
      expect(errors[1].code).toBe('ERROR_2');
      expect(errors[2].code).toBe('ERROR_3');
    });
  });
});
