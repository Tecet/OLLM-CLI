/**
 * Tests for HookTranslator
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { HookTranslator } from '../hookTranslator.js';
import { arbHookEvent, arbHookOutput } from './test-helpers.js';
import type { HookEvent } from '../types.js';

describe('HookTranslator', () => {
  describe('Property-Based Tests', () => {
    // Feature: stage-05-hooks-extensions-mcp, Property 6: Hook Protocol Round Trip
    it('should preserve event type through round trip conversion', () => {
      fc.assert(
        fc.property(
          arbHookEvent(),
          fc.dictionary(fc.string(), fc.anything()),
          (event: HookEvent, data: Record<string, unknown>) => {
            const translator = new HookTranslator();
            
            // Convert system data to hook input
            const hookInput = translator.toHookInput(event, data);
            
            // Verify event is preserved
            expect(hookInput.event).toBe(event);
            
            // Verify data is an object
            expect(typeof hookInput.data).toBe('object');
            expect(hookInput.data).not.toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });

    // Feature: stage-05-hooks-extensions-mcp, Property 27: Hook Event Data Completeness
    it('should include all required event-specific data fields for each event type', () => {
      fc.assert(
        fc.property(
          arbHookEvent(),
          (event: HookEvent) => {
            const translator = new HookTranslator();
            
            // Create appropriate data for each event type
            let data: Record<string, unknown>;
            let expectedFields: string[];
            
            switch (event) {
              case 'session_start':
                data = { session_id: 'test-123' };
                expectedFields = ['session_id'];
                break;
              case 'session_end':
                data = { session_id: 'test-123', messages: [{ role: 'user', content: 'hi' }] };
                expectedFields = ['session_id', 'messages'];
                break;
              case 'before_agent':
                data = { prompt: 'test prompt', context: 'test context' };
                expectedFields = ['prompt', 'context'];
                break;
              case 'after_agent':
                data = { response: 'test response', tool_calls: [] };
                expectedFields = ['response', 'tool_calls'];
                break;
              case 'before_model':
                data = { messages: [], model: 'llama2' };
                expectedFields = ['messages', 'model'];
                break;
              case 'after_model':
                data = { response: 'test', tokens: 100 };
                expectedFields = ['response', 'tokens'];
                break;
              case 'before_tool_selection':
                data = { available_tools: ['tool1', 'tool2'] };
                expectedFields = ['available_tools'];
                break;
              case 'before_tool':
                data = { tool_name: 'read-file', args: { path: 'test.txt' } };
                expectedFields = ['tool_name', 'args'];
                break;
              case 'after_tool':
                data = { tool_name: 'read-file', result: 'file contents' };
                expectedFields = ['tool_name', 'result'];
                break;
              default:
                data = {};
                expectedFields = [];
            }
            
            // Create event input using the event-specific method
            const input = translator.createEventInput(event, data);
            
            // Verify all expected fields are present
            for (const field of expectedFields) {
              expect(input.data).toHaveProperty(field);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    // Feature: stage-05-hooks-extensions-mcp, Property 6: Hook Protocol Round Trip
    it('should preserve event type through round trip conversion', () => {
      fc.assert(
        fc.property(
          arbHookEvent(),
          fc.dictionary(fc.string(), fc.anything()),
          (event: HookEvent, data: Record<string, unknown>) => {
            const translator = new HookTranslator();
            
            // Convert system data to hook input
            const hookInput = translator.toHookInput(event, data);
            
            // Verify event is preserved
            expect(hookInput.event).toBe(event);
            
            // Verify data is an object
            expect(typeof hookInput.data).toBe('object');
            expect(hookInput.data).not.toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });

    // Feature: stage-05-hooks-extensions-mcp, Property 6: Hook Protocol Round Trip
    it('should allow valid hook output to flow through the protocol', () => {
      fc.assert(
        fc.property(
          arbHookOutput(),
          (output) => {
            const translator = new HookTranslator();
            
            // Serialize output to JSON
            const json = JSON.stringify(output);
            
            // Parse it back
            const parsed = translator.parseHookOutput(json);
            
            // Verify structure is preserved
            expect(parsed.continue).toBe(output.continue);
            
            if (output.systemMessage !== undefined) {
              expect(parsed.systemMessage).toBe(output.systemMessage);
            }
            
            if (output.error !== undefined) {
              expect(parsed.error).toBe(output.error);
            }
            
            // Data might not be exactly equal due to JSON serialization
            // but should be present if it was in the original
            if (output.data !== undefined) {
              expect(parsed.data).toBeDefined();
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    // Feature: stage-05-hooks-extensions-mcp, Property 6: Hook Protocol Round Trip
    it('should handle various data types in hook input', () => {
      fc.assert(
        fc.property(
          arbHookEvent(),
          fc.anything(),
          (event: HookEvent, data: unknown) => {
            const translator = new HookTranslator();
            
            // Should not throw for any data type
            const hookInput = translator.toHookInput(event, data);
            
            // Should always produce valid input
            expect(hookInput.event).toBe(event);
            expect(typeof hookInput.data).toBe('object');
            expect(hookInput.data).not.toBeNull();
            
            // Should be serializable
            expect(() => JSON.stringify(hookInput)).not.toThrow();
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Unit Tests', () => {
    describe('toHookInput', () => {
      it('should convert event and data to hook input format', () => {
        const translator = new HookTranslator();
        const event: HookEvent = 'before_model';
        const data = { sessionId: 'test-123', model: 'llama2' };

        const input = translator.toHookInput(event, data);

        expect(input.event).toBe('before_model');
        expect(input.data).toEqual(data);
      });

      it('should handle null data', () => {
        const translator = new HookTranslator();
        const input = translator.toHookInput('session_start', null);

        expect(input.event).toBe('session_start');
        expect(input.data).toEqual({});
      });

      it('should handle undefined data', () => {
        const translator = new HookTranslator();
        const input = translator.toHookInput('session_start', undefined);

        expect(input.event).toBe('session_start');
        expect(input.data).toEqual({});
      });

      it('should wrap primitive data in an object', () => {
        const translator = new HookTranslator();
        const input = translator.toHookInput('before_model', 'test-string');

        expect(input.event).toBe('before_model');
        expect(input.data).toEqual({ value: 'test-string' });
      });

      it('should wrap array data in an object', () => {
        const translator = new HookTranslator();
        const input = translator.toHookInput('before_model', [1, 2, 3]);

        expect(input.event).toBe('before_model');
        expect(input.data).toEqual({ value: [1, 2, 3] });
      });

      it('should handle session_start event data', () => {
        const translator = new HookTranslator();
        const data = { session_id: 'abc-123' };
        const input = translator.toHookInput('session_start', data);

        expect(input.event).toBe('session_start');
        expect(input.data.session_id).toBe('abc-123');
      });

      it('should handle before_model event data', () => {
        const translator = new HookTranslator();
        const data = {
          session_id: 'abc-123',
          messages: [{ role: 'user', content: 'Hello' }],
          model: 'llama2',
        };
        const input = translator.toHookInput('before_model', data);

        expect(input.event).toBe('before_model');
        expect(input.data).toEqual(data);
      });

      it('should handle before_tool event data', () => {
        const translator = new HookTranslator();
        const data = {
          tool_name: 'read-file',
          args: { path: 'test.txt' },
        };
        const input = translator.toHookInput('before_tool', data);

        expect(input.event).toBe('before_tool');
        expect(input.data).toEqual(data);
      });
    });

    describe('parseHookOutput', () => {
      it('should parse valid hook output JSON', () => {
        const translator = new HookTranslator();
        const json = JSON.stringify({
          continue: true,
          systemMessage: 'Test message',
        });

        const output = translator.parseHookOutput(json);

        expect(output.continue).toBe(true);
        expect(output.systemMessage).toBe('Test message');
      });

      it('should parse output with data field', () => {
        const translator = new HookTranslator();
        const json = JSON.stringify({
          continue: true,
          data: { customField: 'value' },
        });

        const output = translator.parseHookOutput(json);

        expect(output.continue).toBe(true);
        expect(output.data).toEqual({ customField: 'value' });
      });

      it('should parse output with error field', () => {
        const translator = new HookTranslator();
        const json = JSON.stringify({
          continue: false,
          error: 'Something went wrong',
        });

        const output = translator.parseHookOutput(json);

        expect(output.continue).toBe(false);
        expect(output.error).toBe('Something went wrong');
      });

      it('should throw on malformed JSON', () => {
        const translator = new HookTranslator();
        const malformedJson = '{ continue: true, invalid }';

        expect(() => translator.parseHookOutput(malformedJson)).toThrow(
          /Malformed JSON/
        );
      });

      it('should throw on invalid output structure (missing continue)', () => {
        const translator = new HookTranslator();
        const json = JSON.stringify({ systemMessage: 'test' });

        expect(() => translator.parseHookOutput(json)).toThrow(
          /Invalid hook output structure/
        );
      });

      it('should throw on invalid output structure (wrong continue type)', () => {
        const translator = new HookTranslator();
        const json = JSON.stringify({ continue: 'yes' });

        expect(() => translator.parseHookOutput(json)).toThrow(
          /Invalid hook output structure/
        );
      });

      it('should throw on invalid systemMessage type', () => {
        const translator = new HookTranslator();
        const json = JSON.stringify({
          continue: true,
          systemMessage: 123,
        });

        expect(() => translator.parseHookOutput(json)).toThrow(
          /Invalid hook output structure/
        );
      });

      it('should throw on invalid data type (array)', () => {
        const translator = new HookTranslator();
        const json = JSON.stringify({
          continue: true,
          data: [1, 2, 3],
        });

        expect(() => translator.parseHookOutput(json)).toThrow(
          /Invalid hook output structure/
        );
      });

      it('should throw on invalid error type', () => {
        const translator = new HookTranslator();
        const json = JSON.stringify({
          continue: false,
          error: { message: 'error' },
        });

        expect(() => translator.parseHookOutput(json)).toThrow(
          /Invalid hook output structure/
        );
      });
    });

    describe('validateOutput', () => {
      it('should validate correct output structure', () => {
        const translator = new HookTranslator();
        const output = {
          continue: true,
          systemMessage: 'test',
          data: { key: 'value' },
        };

        expect(translator.validateOutput(output)).toBe(true);
      });

      it('should reject non-object output', () => {
        const translator = new HookTranslator();
        expect(translator.validateOutput('string')).toBe(false);
        expect(translator.validateOutput(123)).toBe(false);
        expect(translator.validateOutput(null)).toBe(false);
        expect(translator.validateOutput(undefined)).toBe(false);
      });

      it('should reject output without continue field', () => {
        const translator = new HookTranslator();
        const output = { systemMessage: 'test' };

        expect(translator.validateOutput(output)).toBe(false);
      });

      it('should reject output with non-boolean continue', () => {
        const translator = new HookTranslator();
        const output = { continue: 'yes' };

        expect(translator.validateOutput(output)).toBe(false);
      });

      it('should reject output with non-string systemMessage', () => {
        const translator = new HookTranslator();
        const output = { continue: true, systemMessage: 123 };

        expect(translator.validateOutput(output)).toBe(false);
      });

      it('should reject output with non-object data', () => {
        const translator = new HookTranslator();
        const output = { continue: true, data: 'string' };

        expect(translator.validateOutput(output)).toBe(false);
      });

      it('should reject output with array data', () => {
        const translator = new HookTranslator();
        const output = { continue: true, data: [1, 2, 3] };

        expect(translator.validateOutput(output)).toBe(false);
      });

      it('should reject output with non-string error', () => {
        const translator = new HookTranslator();
        const output = { continue: false, error: { message: 'error' } };

        expect(translator.validateOutput(output)).toBe(false);
      });

      it('should accept minimal valid output', () => {
        const translator = new HookTranslator();
        const output = { continue: true };

        expect(translator.validateOutput(output)).toBe(true);
      });

      it('should accept output with all optional fields', () => {
        const translator = new HookTranslator();
        const output = {
          continue: false,
          systemMessage: 'message',
          data: { key: 'value' },
          error: 'error message',
        };

        expect(translator.validateOutput(output)).toBe(true);
      });

      it('should accept output with null optional fields', () => {
        const translator = new HookTranslator();
        const output = {
          continue: true,
          systemMessage: null,
          data: null,
          error: null,
        };

        expect(translator.validateOutput(output)).toBe(true);
      });

      it('should parse output with null optional fields', () => {
        const translator = new HookTranslator();
        const json = JSON.stringify({
          continue: false,
          systemMessage: null,
          data: null,
          error: null,
        });

        const output = translator.parseHookOutput(json);

        expect(output.continue).toBe(false);
        expect(output.systemMessage).toBeNull();
        expect(output.data).toBeNull();
        expect(output.error).toBeNull();
      });
    });

    describe('serializeInput', () => {
      it('should serialize hook input to JSON', () => {
        const translator = new HookTranslator();
        const input = {
          event: 'before_model',
          data: { sessionId: 'test-123' },
        };

        const json = translator.serializeInput(input);
        const parsed = JSON.parse(json);

        expect(parsed).toEqual(input);
      });

      it('should produce formatted JSON', () => {
        const translator = new HookTranslator();
        const input = {
          event: 'before_model',
          data: { sessionId: 'test-123' },
        };

        const json = translator.serializeInput(input);

        // Should be formatted with indentation
        expect(json).toContain('\n');
        expect(json).toContain('  ');
      });
    });

    describe('createEventInput', () => {
      it('should create properly structured event input', () => {
        const translator = new HookTranslator();
        const data = { sessionId: 'test-123', model: 'llama2', messages: [] };

        const input = translator.createEventInput('before_model', data);

        expect(input.event).toBe('before_model');
        // Data should be structured according to before_model requirements
        expect(input.data).toHaveProperty('messages');
        expect(input.data).toHaveProperty('model');
        expect(input.data.model).toBe('llama2');
      });

      it('should handle empty data', () => {
        const translator = new HookTranslator();
        const input = translator.createEventInput('session_start', {});

        expect(input.event).toBe('session_start');
        expect(input.data).toHaveProperty('session_id');
      });
    });

    describe('Event-Specific Data Passing', () => {
      describe('session_start event', () => {
        it('should include session_id', () => {
          const translator = new HookTranslator();
          const data = { session_id: 'abc-123' };
          const input = translator.createEventInput('session_start', data);

          expect(input.data.session_id).toBe('abc-123');
        });

        it('should handle sessionId (camelCase) and convert to session_id', () => {
          const translator = new HookTranslator();
          const data = { sessionId: 'abc-123' };
          const input = translator.createEventInput('session_start', data);

          expect(input.data.session_id).toBe('abc-123');
        });
      });

      describe('session_end event', () => {
        it('should include session_id and messages', () => {
          const translator = new HookTranslator();
          const messages = [{ role: 'user', content: 'Hello' }];
          const data = { session_id: 'abc-123', messages };
          const input = translator.createEventInput('session_end', data);

          expect(input.data.session_id).toBe('abc-123');
          expect(input.data.messages).toEqual(messages);
        });

        it('should default messages to empty array if not provided', () => {
          const translator = new HookTranslator();
          const data = { session_id: 'abc-123' };
          const input = translator.createEventInput('session_end', data);

          expect(input.data.messages).toEqual([]);
        });
      });

      describe('before_agent event', () => {
        it('should include prompt and context', () => {
          const translator = new HookTranslator();
          const data = { prompt: 'User prompt', context: 'Additional context' };
          const input = translator.createEventInput('before_agent', data);

          expect(input.data.prompt).toBe('User prompt');
          expect(input.data.context).toBe('Additional context');
        });
      });

      describe('after_agent event', () => {
        it('should include response and tool_calls', () => {
          const translator = new HookTranslator();
          const toolCalls = [{ name: 'read-file', args: { path: 'test.txt' } }];
          const data = { response: 'Agent response', tool_calls: toolCalls };
          const input = translator.createEventInput('after_agent', data);

          expect(input.data.response).toBe('Agent response');
          expect(input.data.tool_calls).toEqual(toolCalls);
        });

        it('should handle toolCalls (camelCase) and convert to tool_calls', () => {
          const translator = new HookTranslator();
          const toolCalls = [{ name: 'read-file', args: { path: 'test.txt' } }];
          const data = { response: 'Agent response', toolCalls };
          const input = translator.createEventInput('after_agent', data);

          expect(input.data.tool_calls).toEqual(toolCalls);
        });

        it('should default tool_calls to empty array if not provided', () => {
          const translator = new HookTranslator();
          const data = { response: 'Agent response' };
          const input = translator.createEventInput('after_agent', data);

          expect(input.data.tool_calls).toEqual([]);
        });
      });

      describe('before_model event', () => {
        it('should include messages and model', () => {
          const translator = new HookTranslator();
          const messages = [{ role: 'user', content: 'Hello' }];
          const data = { messages, model: 'llama2' };
          const input = translator.createEventInput('before_model', data);

          expect(input.data.messages).toEqual(messages);
          expect(input.data.model).toBe('llama2');
        });

        it('should default messages to empty array if not provided', () => {
          const translator = new HookTranslator();
          const data = { model: 'llama2' };
          const input = translator.createEventInput('before_model', data);

          expect(input.data.messages).toEqual([]);
        });
      });

      describe('after_model event', () => {
        it('should include response and tokens', () => {
          const translator = new HookTranslator();
          const data = { response: 'Model response', tokens: 150 };
          const input = translator.createEventInput('after_model', data);

          expect(input.data.response).toBe('Model response');
          expect(input.data.tokens).toBe(150);
        });

        it('should handle tokens as object with usage details', () => {
          const translator = new HookTranslator();
          const tokens = { prompt: 50, completion: 100, total: 150 };
          const data = { response: 'Model response', tokens };
          const input = translator.createEventInput('after_model', data);

          expect(input.data.tokens).toEqual(tokens);
        });
      });

      describe('before_tool_selection event', () => {
        it('should include available_tools', () => {
          const translator = new HookTranslator();
          const tools = ['read-file', 'write-file', 'shell'];
          const data = { available_tools: tools };
          const input = translator.createEventInput('before_tool_selection', data);

          expect(input.data.available_tools).toEqual(tools);
        });

        it('should handle availableTools (camelCase) and convert to available_tools', () => {
          const translator = new HookTranslator();
          const tools = ['read-file', 'write-file', 'shell'];
          const data = { availableTools: tools };
          const input = translator.createEventInput('before_tool_selection', data);

          expect(input.data.available_tools).toEqual(tools);
        });

        it('should default available_tools to empty array if not provided', () => {
          const translator = new HookTranslator();
          const data = {};
          const input = translator.createEventInput('before_tool_selection', data);

          expect(input.data.available_tools).toEqual([]);
        });
      });

      describe('before_tool event', () => {
        it('should include tool_name and args', () => {
          const translator = new HookTranslator();
          const args = { path: 'test.txt', encoding: 'utf-8' };
          const data = { tool_name: 'read-file', args };
          const input = translator.createEventInput('before_tool', data);

          expect(input.data.tool_name).toBe('read-file');
          expect(input.data.args).toEqual(args);
        });

        it('should handle toolName (camelCase) and convert to tool_name', () => {
          const translator = new HookTranslator();
          const data = { toolName: 'read-file', args: {} };
          const input = translator.createEventInput('before_tool', data);

          expect(input.data.tool_name).toBe('read-file');
        });

        it('should handle arguments as alternative to args', () => {
          const translator = new HookTranslator();
          const args = { path: 'test.txt' };
          const data = { tool_name: 'read-file', arguments: args };
          const input = translator.createEventInput('before_tool', data);

          expect(input.data.args).toEqual(args);
        });
      });

      describe('after_tool event', () => {
        it('should include tool_name and result', () => {
          const translator = new HookTranslator();
          const result = { content: 'File contents', success: true };
          const data = { tool_name: 'read-file', result };
          const input = translator.createEventInput('after_tool', data);

          expect(input.data.tool_name).toBe('read-file');
          expect(input.data.result).toEqual(result);
        });

        it('should handle toolName (camelCase) and convert to tool_name', () => {
          const translator = new HookTranslator();
          const data = { toolName: 'read-file', result: 'success' };
          const input = translator.createEventInput('after_tool', data);

          expect(input.data.tool_name).toBe('read-file');
        });

        it('should handle string result', () => {
          const translator = new HookTranslator();
          const data = { tool_name: 'read-file', result: 'File contents' };
          const input = translator.createEventInput('after_tool', data);

          expect(input.data.result).toBe('File contents');
        });
      });

      describe('Data completeness across all events', () => {
        it('should structure all event types correctly', () => {
          const translator = new HookTranslator();
          
          // Test each event type
          const testCases: Array<{ event: HookEvent; data: Record<string, unknown>; expectedFields: string[] }> = [
            {
              event: 'session_start',
              data: { session_id: 'test' },
              expectedFields: ['session_id'],
            },
            {
              event: 'session_end',
              data: { session_id: 'test', messages: [] },
              expectedFields: ['session_id', 'messages'],
            },
            {
              event: 'before_agent',
              data: { prompt: 'test', context: 'test' },
              expectedFields: ['prompt', 'context'],
            },
            {
              event: 'after_agent',
              data: { response: 'test', tool_calls: [] },
              expectedFields: ['response', 'tool_calls'],
            },
            {
              event: 'before_model',
              data: { messages: [], model: 'test' },
              expectedFields: ['messages', 'model'],
            },
            {
              event: 'after_model',
              data: { response: 'test', tokens: 100 },
              expectedFields: ['response', 'tokens'],
            },
            {
              event: 'before_tool_selection',
              data: { available_tools: [] },
              expectedFields: ['available_tools'],
            },
            {
              event: 'before_tool',
              data: { tool_name: 'test', args: {} },
              expectedFields: ['tool_name', 'args'],
            },
            {
              event: 'after_tool',
              data: { tool_name: 'test', result: 'test' },
              expectedFields: ['tool_name', 'result'],
            },
          ];

          for (const testCase of testCases) {
            const input = translator.createEventInput(testCase.event, testCase.data);
            
            for (const field of testCase.expectedFields) {
              expect(input.data).toHaveProperty(field);
            }
          }
        });
      });
    });
  });
});

