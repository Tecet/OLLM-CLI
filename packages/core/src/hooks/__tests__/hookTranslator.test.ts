/**
 * Unit tests for HookTranslator
 * Tests hook input/output translation and validation
 *
 * Feature: v0.1.0 Debugging and Polishing
 * Task: 39. Add Hook System Tests
 */

import { describe, it, expect } from 'vitest';

import { HookTranslator } from '../hookTranslator.js';

import type { HookOutput } from '../types.js';

describe('HookTranslator - Unit Tests', () => {
  let translator: HookTranslator;

  beforeEach(() => {
    translator = new HookTranslator();
  });

  describe('Hook Input Creation', () => {
    it('should create hook input with event and data', () => {
      const input = translator.toHookInput('before_model', { model: 'llama2' });

      expect(input.event).toBe('before_model');
      expect(input.data).toEqual({ model: 'llama2' });
    });

    it('should normalize null data to empty object', () => {
      const input = translator.toHookInput('before_model', null);

      expect(input.data).toEqual({});
    });

    it('should normalize undefined data to empty object', () => {
      const input = translator.toHookInput('before_model', undefined);

      expect(input.data).toEqual({});
    });

    it('should wrap primitive values in object', () => {
      const input = translator.toHookInput('before_model', 'test');

      expect(input.data).toEqual({ value: 'test' });
    });

    it('should wrap arrays in object', () => {
      const input = translator.toHookInput('before_model', [1, 2, 3]);

      expect(input.data).toEqual({ value: [1, 2, 3] });
    });

    it('should preserve object data', () => {
      const data = { key1: 'value1', key2: 'value2' };
      const input = translator.toHookInput('before_model', data);

      expect(input.data).toEqual(data);
    });
  });

  describe('Hook Input Serialization', () => {
    it('should serialize hook input to JSON', () => {
      const input = translator.toHookInput('before_model', { model: 'llama2' });
      const json = translator.serializeInput(input);

      expect(json).toContain('"event": "before_model"');
      expect(json).toContain('"model": "llama2"');
    });

    it('should format JSON with indentation', () => {
      const input = translator.toHookInput('before_model', { model: 'llama2' });
      const json = translator.serializeInput(input);

      expect(json).toContain('\n');
      expect(json).toContain('  ');
    });
  });

  describe('Hook Output Parsing', () => {
    it('should parse valid hook output', () => {
      const json = JSON.stringify({ continue: true, systemMessage: 'Success' });
      const output = translator.parseHookOutput(json);

      expect(output.continue).toBe(true);
      expect(output.systemMessage).toBe('Success');
    });

    it('should parse output with data', () => {
      const json = JSON.stringify({
        continue: true,
        data: { key: 'value' },
      });
      const output = translator.parseHookOutput(json);

      expect(output.data).toEqual({ key: 'value' });
    });

    it('should parse output with error', () => {
      const json = JSON.stringify({
        continue: false,
        error: 'Hook failed',
      });
      const output = translator.parseHookOutput(json);

      expect(output.error).toBe('Hook failed');
    });

    it('should throw error for malformed JSON', () => {
      expect(() => translator.parseHookOutput('not valid json')).toThrow('Malformed JSON');
    });

    it('should throw error for invalid output structure', () => {
      const json = JSON.stringify({ invalid: 'structure' });

      expect(() => translator.parseHookOutput(json)).toThrow('Invalid hook output structure');
    });
  });

  describe('Hook Output Validation', () => {
    it('should validate output with continue field', () => {
      const output = { continue: true };

      expect(translator.validateOutput(output)).toBe(true);
    });

    it('should reject output without continue field', () => {
      const output = { systemMessage: 'test' };

      expect(translator.validateOutput(output)).toBe(false);
    });

    it('should reject output with non-boolean continue', () => {
      const output = { continue: 'true' };

      expect(translator.validateOutput(output)).toBe(false);
    });

    it('should reject non-object output', () => {
      expect(translator.validateOutput('string')).toBe(false);
      expect(translator.validateOutput(123)).toBe(false);
      expect(translator.validateOutput(null)).toBe(false);
      expect(translator.validateOutput(undefined)).toBe(false);
    });

    it('should reject output with non-string systemMessage', () => {
      const output = { continue: true, systemMessage: 123 };

      expect(translator.validateOutput(output)).toBe(false);
    });

    it('should allow null systemMessage', () => {
      const output = { continue: true, systemMessage: null };

      expect(translator.validateOutput(output)).toBe(true);
    });

    it('should reject output with array data', () => {
      const output = { continue: true, data: [1, 2, 3] };

      expect(translator.validateOutput(output)).toBe(false);
    });

    it('should allow object data', () => {
      const output = { continue: true, data: { key: 'value' } };

      expect(translator.validateOutput(output)).toBe(true);
    });

    it('should allow null data', () => {
      const output = { continue: true, data: null };

      expect(translator.validateOutput(output)).toBe(true);
    });

    it('should reject output with non-string error', () => {
      const output = { continue: true, error: 123 };

      expect(translator.validateOutput(output)).toBe(false);
    });

    it('should allow null error', () => {
      const output = { continue: true, error: null };

      expect(translator.validateOutput(output)).toBe(true);
    });
  });

  describe('Event-Specific Input Creation', () => {
    it('should create session_start input with session_id', () => {
      const input = translator.createEventInput('session_start', {
        sessionId: 'test-session',
      });

      expect(input.data.session_id).toBe('test-session');
    });

    it('should create session_end input with session_id and messages', () => {
      const messages = [{ role: 'user', content: 'test' }];
      const input = translator.createEventInput('session_end', {
        sessionId: 'test-session',
        messages,
      });

      expect(input.data.session_id).toBe('test-session');
      expect(input.data.messages).toEqual(messages);
    });

    it('should create before_agent input with prompt and context', () => {
      const input = translator.createEventInput('before_agent', {
        prompt: 'test prompt',
        context: 'test context',
      });

      expect(input.data.prompt).toBe('test prompt');
      expect(input.data.context).toBe('test context');
    });

    it('should create after_agent input with response and tool_calls', () => {
      const toolCalls = [{ name: 'tool1', args: {} }];
      const input = translator.createEventInput('after_agent', {
        response: 'test response',
        toolCalls,
      });

      expect(input.data.response).toBe('test response');
      expect(input.data.tool_calls).toEqual(toolCalls);
    });

    it('should create before_model input with messages and model', () => {
      const messages = [{ role: 'user', content: 'test' }];
      const input = translator.createEventInput('before_model', {
        messages,
        model: 'llama2',
      });

      expect(input.data.messages).toEqual(messages);
      expect(input.data.model).toBe('llama2');
    });

    it('should create after_model input with response and tokens', () => {
      const input = translator.createEventInput('after_model', {
        response: 'test response',
        tokens: 100,
      });

      expect(input.data.response).toBe('test response');
      expect(input.data.tokens).toBe(100);
    });

    it('should create before_tool_selection input with available_tools', () => {
      const tools = ['tool1', 'tool2'];
      const input = translator.createEventInput('before_tool_selection', {
        availableTools: tools,
      });

      expect(input.data.available_tools).toEqual(tools);
    });

    it('should create before_tool input with tool_name and args', () => {
      const input = translator.createEventInput('before_tool', {
        toolName: 'test-tool',
        args: { param: 'value' },
      });

      expect(input.data.tool_name).toBe('test-tool');
      expect(input.data.args).toEqual({ param: 'value' });
    });

    it('should create after_tool input with tool_name and result', () => {
      const input = translator.createEventInput('after_tool', {
        toolName: 'test-tool',
        result: 'success',
      });

      expect(input.data.tool_name).toBe('test-tool');
      expect(input.data.result).toBe('success');
    });

    it('should handle snake_case field names', () => {
      const input = translator.createEventInput('session_start', {
        session_id: 'test-session',
      });

      expect(input.data.session_id).toBe('test-session');
    });

    it('should provide default empty arrays for missing array fields', () => {
      const input = translator.createEventInput('session_end', {
        sessionId: 'test-session',
      });

      expect(input.data.messages).toEqual([]);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty object data', () => {
      const input = translator.toHookInput('before_model', {});

      expect(input.data).toEqual({});
    });

    it('should handle nested object data', () => {
      const data = {
        level1: {
          level2: {
            level3: 'value',
          },
        },
      };
      const input = translator.toHookInput('before_model', data);

      expect(input.data).toEqual(data);
    });

    it('should handle output with all optional fields', () => {
      const output: HookOutput = {
        continue: true,
        systemMessage: 'message',
        data: { key: 'value' },
        error: 'error',
      };

      expect(translator.validateOutput(output)).toBe(true);
    });

    it('should handle output with only continue field', () => {
      const output: HookOutput = {
        continue: false,
      };

      expect(translator.validateOutput(output)).toBe(true);
    });

    it('should serialize and parse round-trip', () => {
      const input = translator.toHookInput('before_model', {
        model: 'llama2',
        messages: [{ role: 'user', content: 'test' }],
      });

      const json = translator.serializeInput(input);
      const parsed = JSON.parse(json);

      expect(parsed).toEqual(input);
    });
  });
});
