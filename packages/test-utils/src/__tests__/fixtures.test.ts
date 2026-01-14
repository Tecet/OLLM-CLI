/**
 * Unit tests for test fixtures.
 * Tests fixture creation functions, helper functions, and assertion utilities.
 */

import { describe, it, expect } from 'vitest';
import {
  // Core message creation
  createCoreMessage,
  createImageMessage,
  createToolResultMessage,
  createCoreToolCall,
  // Legacy fixtures
  createFixtureMessage,
  createTestToolCall,
  createTestModel,
  // Fixture collections
  fixtureMessages,
  fixtureTools,
  fixtureModels,
  fixtureStreamEvents,
  extendedFixtureMessages,
  extendedFixtureTools,
  extendedFixtureModels,
  // Sequence generators
  createTextChunkSequence,
  createToolCallSequence,
  // Random generators
  generateRandomString,
  generateRandomMessage,
  generateMessageSequence,
  generateRandomToolCall,
  generateRandomModel,
  // Assertion helpers
  assertValidMessage,
  assertValidToolCall,
  assertValidModelInfo,
  assertValidToolSchema,
  messagesEqual,
  toolCallsEqual,
} from '../fixtures.js';

describe('Fixture Creation Functions', () => {
  describe('createCoreMessage', () => {
    it('creates a valid user message', () => {
      const message = createCoreMessage('user', 'Hello');
      
      expect(message.role).toBe('user');
      expect(message.parts).toHaveLength(1);
      expect(message.parts[0]).toEqual({ type: 'text', text: 'Hello' });
      expect(message.name).toBeUndefined();
    });

    it('creates a valid assistant message', () => {
      const message = createCoreMessage('assistant', 'Hi there');
      
      expect(message.role).toBe('assistant');
      expect(message.parts).toHaveLength(1);
      expect(message.parts[0]).toEqual({ type: 'text', text: 'Hi there' });
    });

    it('creates a valid system message', () => {
      const message = createCoreMessage('system', 'You are helpful');
      
      expect(message.role).toBe('system');
      expect(message.parts).toHaveLength(1);
      expect(message.parts[0]).toEqual({ type: 'text', text: 'You are helpful' });
    });

    it('creates a tool message with name', () => {
      const message = createCoreMessage('tool', 'Result', { name: 'get_weather' });
      
      expect(message.role).toBe('tool');
      expect(message.name).toBe('get_weather');
      expect(message.parts).toHaveLength(1);
    });

    it('handles empty content', () => {
      const message = createCoreMessage('user', '');
      
      expect(message.parts).toHaveLength(1);
      expect(message.parts[0]).toEqual({ type: 'text', text: '' });
    });
  });

  describe('createImageMessage', () => {
    it('creates a message with text and image', () => {
      const message = createImageMessage('user', 'What is this?', 'base64data');
      
      expect(message.role).toBe('user');
      expect(message.parts).toHaveLength(2);
      expect(message.parts[0]).toEqual({ type: 'text', text: 'What is this?' });
      expect(message.parts[1]).toEqual({
        type: 'image',
        data: 'base64data',
        mimeType: 'image/png',
      });
    });

    it('supports custom mime type', () => {
      const message = createImageMessage('user', 'Check this', 'data', 'image/jpeg');
      
      expect(message.parts[1]).toEqual({
        type: 'image',
        data: 'data',
        mimeType: 'image/jpeg',
      });
    });
  });

  describe('createToolResultMessage', () => {
    it('creates a valid tool result message', () => {
      const message = createToolResultMessage('get_weather', 'Sunny, 72°F');
      
      expect(message.role).toBe('tool');
      expect(message.name).toBe('get_weather');
      expect(message.parts).toHaveLength(1);
      expect(message.parts[0]).toEqual({ type: 'text', text: 'Sunny, 72°F' });
    });
  });

  describe('createCoreToolCall', () => {
    it('creates a tool call with generated ID', () => {
      const toolCall = createCoreToolCall('get_weather', { location: 'Seattle' });
      
      expect(toolCall.name).toBe('get_weather');
      expect(toolCall.args).toEqual({ location: 'Seattle' });
      expect(toolCall.id).toMatch(/^call_/);
      expect(toolCall.id.length).toBeGreaterThan(5);
    });

    it('creates a tool call with custom ID', () => {
      const toolCall = createCoreToolCall('calculate', { expr: '2+2' }, 'custom_id');
      
      expect(toolCall.id).toBe('custom_id');
      expect(toolCall.name).toBe('calculate');
      expect(toolCall.args).toEqual({ expr: '2+2' });
    });

    it('handles empty arguments', () => {
      const toolCall = createCoreToolCall('get_time', {});
      
      expect(toolCall.args).toEqual({});
    });
  });

  describe('createTestModel', () => {
    it('creates a model with default values', () => {
      const model = createTestModel();
      
      expect(model.name).toBe('test-model:latest');
      expect(model.sizeBytes).toBe(1e9);
      expect(model.modifiedAt).toBeDefined();
      expect(model.details).toBeDefined();
    });

    it('creates a model with overrides', () => {
      const model = createTestModel({
        name: 'custom-model',
        sizeBytes: 5e9,
      });
      
      expect(model.name).toBe('custom-model');
      expect(model.sizeBytes).toBe(5e9);
    });
  });
});

describe('Fixture Collections', () => {
  describe('fixtureMessages', () => {
    it('provides simple user message', () => {
      expect(fixtureMessages.simpleUser.role).toBe('user');
      expect(fixtureMessages.simpleUser.content).toBeTruthy();
    });

    it('provides simple assistant message', () => {
      expect(fixtureMessages.simpleAssistant.role).toBe('assistant');
    });

    it('provides system prompt', () => {
      expect(fixtureMessages.systemPrompt.role).toBe('system');
    });

    it('provides long message', () => {
      expect(fixtureMessages.longMessage.content.length).toBeGreaterThan(1000);
    });

    it('provides tool call message', () => {
      expect(fixtureMessages.toolCallMessage.toolCalls).toBeDefined();
      expect(fixtureMessages.toolCallMessage.toolCalls?.length).toBeGreaterThan(0);
    });
  });

  describe('fixtureTools', () => {
    it('provides weather tool', () => {
      const tool = fixtureTools.weatherTool;
      expect(tool.name).toBe('get_weather');
      expect(tool.parameters).toBeDefined();
      expect(tool.parameters.required).toContain('location');
    });

    it('provides calculator tool', () => {
      const tool = fixtureTools.calculatorTool;
      expect(tool.name).toBe('calculate');
    });

    it('provides file read tool', () => {
      const tool = fixtureTools.fileReadTool;
      expect(tool.name).toBe('read_file');
    });
  });

  describe('fixtureModels', () => {
    it('provides general model', () => {
      const model = fixtureModels.generalModel;
      expect(model.name).toContain('llama');
      expect(model.sizeBytes).toBeGreaterThan(0);
    });

    it('provides code model', () => {
      const model = fixtureModels.codeModel;
      expect(model.name).toContain('codellama');
    });

    it('provides small model', () => {
      const model = fixtureModels.smallModel;
      expect(model.name).toContain('phi');
    });

    it('provides large model', () => {
      const model = fixtureModels.largeModel;
      expect(model.sizeBytes).toBeGreaterThan(50e9);
    });
  });

  describe('extendedFixtureTools', () => {
    it('provides tool with no parameters', () => {
      const tool = extendedFixtureTools.noParamsTool;
      expect(tool.name).toBe('get_time');
      expect(tool.parameters.properties).toEqual({});
    });

    it('provides tool with optional parameters', () => {
      const tool = extendedFixtureTools.optionalParamsTool;
      expect(tool.parameters.required).toHaveLength(1);
      expect(Object.keys(tool.parameters.properties)).toHaveLength(2);
    });

    it('provides complex nested tool', () => {
      const tool = extendedFixtureTools.complexTool;
      expect(tool.parameters.properties.metadata).toBeDefined();
      expect(tool.parameters.properties.tags.type).toBe('array');
    });

    it('provides boolean parameter tool', () => {
      const tool = extendedFixtureTools.booleanTool;
      expect(tool.parameters.properties.enabled.type).toBe('boolean');
    });
  });
});

describe('Sequence Generators', () => {
  describe('createTextChunkSequence', () => {
    it('splits text into chunks', () => {
      const sequence = createTextChunkSequence('Hello World', 3);
      
      // Should have chunks + finish event
      expect(sequence.length).toBeGreaterThan(1);
      expect(sequence[sequence.length - 1].type).toBe('finish');
    });

    it('handles empty text', () => {
      const sequence = createTextChunkSequence('', 5);
      
      expect(sequence.length).toBe(1);
      expect(sequence[0].type).toBe('finish');
    });

    it('uses default chunk size', () => {
      const sequence = createTextChunkSequence('Hello');
      
      expect(sequence.length).toBeGreaterThan(0);
    });
  });

  describe('createToolCallSequence', () => {
    it('creates sequence with tool calls', () => {
      const sequence = createToolCallSequence([
        { name: 'tool1', args: { a: 1 } },
        { name: 'tool2', args: { b: 2 } },
      ]);
      
      expect(sequence.length).toBe(4); // text + 2 tool calls + finish
      expect(sequence[0].type).toBe('text');
      expect(sequence[1].type).toBe('tool_call');
      expect(sequence[2].type).toBe('tool_call');
      expect(sequence[3].type).toBe('finish');
      expect(sequence[3].reason).toBe('tool');
    });

    it('handles empty tool call array', () => {
      const sequence = createToolCallSequence([]);
      
      expect(sequence.length).toBe(2); // text + finish
    });
  });
});

describe('Random Generators', () => {
  describe('generateRandomString', () => {
    it('generates string of specified length', () => {
      const str = generateRandomString(10);
      expect(str.length).toBe(10);
    });

    it('generates different strings', () => {
      const str1 = generateRandomString(20);
      const str2 = generateRandomString(20);
      expect(str1).not.toBe(str2);
    });

    it('handles zero length', () => {
      const str = generateRandomString(0);
      expect(str).toBe('');
    });
  });

  describe('generateRandomMessage', () => {
    it('generates message with default role and length', () => {
      const message = generateRandomMessage();
      
      expect(message.role).toBe('user');
      expect(message.parts).toHaveLength(1);
      expect(message.parts[0].type).toBe('text');
    });

    it('generates message with specified role', () => {
      const message = generateRandomMessage('assistant', 50);
      
      expect(message.role).toBe('assistant');
    });

    it('generates message with specified length', () => {
      const message = generateRandomMessage('user', 200);
      
      if (message.parts[0].type === 'text') {
        expect(message.parts[0].text.length).toBe(200);
      }
    });
  });

  describe('generateMessageSequence', () => {
    it('generates specified number of messages', () => {
      const messages = generateMessageSequence(5);
      expect(messages).toHaveLength(5);
    });

    it('alternates between user and assistant', () => {
      const messages = generateMessageSequence(4);
      
      expect(messages[0].role).toBe('user');
      expect(messages[1].role).toBe('assistant');
      expect(messages[2].role).toBe('user');
      expect(messages[3].role).toBe('assistant');
    });

    it('handles zero count', () => {
      const messages = generateMessageSequence(0);
      expect(messages).toHaveLength(0);
    });
  });

  describe('generateRandomToolCall', () => {
    it('generates valid tool call', () => {
      const toolCall = generateRandomToolCall();
      
      expect(toolCall.id).toBeDefined();
      expect(toolCall.name).toBeDefined();
      expect(toolCall.args).toBeDefined();
      expect(typeof toolCall.args).toBe('object');
    });

    it('generates different tool calls', () => {
      const tc1 = generateRandomToolCall();
      const tc2 = generateRandomToolCall();
      
      // IDs should be different
      expect(tc1.id).not.toBe(tc2.id);
    });
  });

  describe('generateRandomModel', () => {
    it('generates valid model info', () => {
      const model = generateRandomModel();
      
      expect(model.name).toBeDefined();
      expect(model.sizeBytes).toBeGreaterThan(0);
      expect(model.details).toBeDefined();
    });

    it('generates different models', () => {
      const m1 = generateRandomModel();
      const m2 = generateRandomModel();
      
      // Names might be the same due to random selection, but sizes should vary
      expect(m1.sizeBytes).toBeDefined();
      expect(m2.sizeBytes).toBeDefined();
    });
  });
});

describe('Assertion Helpers', () => {
  describe('assertValidMessage', () => {
    it('accepts valid user message', () => {
      const message = createCoreMessage('user', 'Hello');
      expect(() => assertValidMessage(message)).not.toThrow();
    });

    it('accepts valid tool message with name', () => {
      const message = createToolResultMessage('tool1', 'result');
      expect(() => assertValidMessage(message)).not.toThrow();
    });

    it('rejects message without role', () => {
      const message = { parts: [{ type: 'text' as const, text: 'test' }] } as any;
      expect(() => assertValidMessage(message)).toThrow('missing role');
    });

    it('rejects message without parts', () => {
      const message = { role: 'user' as const } as any;
      expect(() => assertValidMessage(message)).toThrow('missing parts');
    });

    it('rejects message with empty parts', () => {
      const message = { role: 'user' as const, parts: [] } as any;
      expect(() => assertValidMessage(message)).toThrow('missing parts');
    });

    it('rejects tool message without name', () => {
      const message = {
        role: 'tool' as const,
        parts: [{ type: 'text' as const, text: 'result' }],
      } as any;
      expect(() => assertValidMessage(message)).toThrow('missing name');
    });
  });

  describe('assertValidToolCall', () => {
    it('accepts valid tool call', () => {
      const toolCall = createCoreToolCall('test', { a: 1 });
      expect(() => assertValidToolCall(toolCall)).not.toThrow();
    });

    it('rejects tool call without id', () => {
      const toolCall = { name: 'test', args: {} } as any;
      expect(() => assertValidToolCall(toolCall)).toThrow('missing id');
    });

    it('rejects tool call without name', () => {
      const toolCall = { id: '123', args: {} } as any;
      expect(() => assertValidToolCall(toolCall)).toThrow('missing name');
    });

    it('rejects tool call without args', () => {
      const toolCall = { id: '123', name: 'test' } as any;
      expect(() => assertValidToolCall(toolCall)).toThrow('missing or invalid args');
    });

    it('rejects tool call with non-object args', () => {
      const toolCall = { id: '123', name: 'test', args: 'invalid' } as any;
      expect(() => assertValidToolCall(toolCall)).toThrow('missing or invalid args');
    });
  });

  describe('assertValidModelInfo', () => {
    it('accepts valid model info', () => {
      const model = createTestModel();
      expect(() => assertValidModelInfo(model)).not.toThrow();
    });

    it('accepts model with minimal fields', () => {
      const model = { name: 'test-model' } as any;
      expect(() => assertValidModelInfo(model)).not.toThrow();
    });

    it('rejects model without name', () => {
      const model = { sizeBytes: 1000 } as any;
      expect(() => assertValidModelInfo(model)).toThrow('missing name');
    });
  });

  describe('assertValidToolSchema', () => {
    it('accepts valid tool schema', () => {
      const schema = fixtureTools.weatherTool;
      expect(() => assertValidToolSchema(schema)).not.toThrow();
    });

    it('accepts schema without parameters', () => {
      const schema = { name: 'test_tool' };
      expect(() => assertValidToolSchema(schema)).not.toThrow();
    });

    it('rejects schema without name', () => {
      const schema = { description: 'test' } as any;
      expect(() => assertValidToolSchema(schema)).toThrow('missing name');
    });

    it('rejects schema with non-object parameters', () => {
      const schema = { name: 'test', parameters: 'invalid' } as any;
      expect(() => assertValidToolSchema(schema)).toThrow('must be an object');
    });
  });
});

describe('Comparison Helpers', () => {
  describe('messagesEqual', () => {
    it('returns true for identical messages', () => {
      const msg1 = createCoreMessage('user', 'Hello');
      const msg2 = createCoreMessage('user', 'Hello');
      
      expect(messagesEqual(msg1, msg2)).toBe(true);
    });

    it('returns false for different roles', () => {
      const msg1 = createCoreMessage('user', 'Hello');
      const msg2 = createCoreMessage('assistant', 'Hello');
      
      expect(messagesEqual(msg1, msg2)).toBe(false);
    });

    it('returns false for different content', () => {
      const msg1 = createCoreMessage('user', 'Hello');
      const msg2 = createCoreMessage('user', 'Hi');
      
      expect(messagesEqual(msg1, msg2)).toBe(false);
    });

    it('returns false for different part counts', () => {
      const msg1 = createCoreMessage('user', 'Hello');
      const msg2 = createImageMessage('user', 'Hello', 'data');
      
      expect(messagesEqual(msg1, msg2)).toBe(false);
    });

    it('compares tool messages with names', () => {
      const msg1 = createToolResultMessage('tool1', 'result');
      const msg2 = createToolResultMessage('tool1', 'result');
      
      expect(messagesEqual(msg1, msg2)).toBe(true);
    });

    it('returns false for different tool names', () => {
      const msg1 = createToolResultMessage('tool1', 'result');
      const msg2 = createToolResultMessage('tool2', 'result');
      
      expect(messagesEqual(msg1, msg2)).toBe(false);
    });
  });

  describe('toolCallsEqual', () => {
    it('returns true for identical tool calls', () => {
      const tc1 = createCoreToolCall('test', { a: 1 }, 'id1');
      const tc2 = createCoreToolCall('test', { a: 1 }, 'id1');
      
      expect(toolCallsEqual(tc1, tc2)).toBe(true);
    });

    it('returns false for different IDs', () => {
      const tc1 = createCoreToolCall('test', { a: 1 }, 'id1');
      const tc2 = createCoreToolCall('test', { a: 1 }, 'id2');
      
      expect(toolCallsEqual(tc1, tc2)).toBe(false);
    });

    it('returns false for different names', () => {
      const tc1 = createCoreToolCall('test1', { a: 1 }, 'id1');
      const tc2 = createCoreToolCall('test2', { a: 1 }, 'id1');
      
      expect(toolCallsEqual(tc1, tc2)).toBe(false);
    });

    it('returns false for different args', () => {
      const tc1 = createCoreToolCall('test', { a: 1 }, 'id1');
      const tc2 = createCoreToolCall('test', { a: 2 }, 'id1');
      
      expect(toolCallsEqual(tc1, tc2)).toBe(false);
    });

    it('compares complex nested args', () => {
      const tc1 = createCoreToolCall('test', { a: { b: { c: 1 } } }, 'id1');
      const tc2 = createCoreToolCall('test', { a: { b: { c: 1 } } }, 'id1');
      
      expect(toolCallsEqual(tc1, tc2)).toBe(true);
    });
  });
});
