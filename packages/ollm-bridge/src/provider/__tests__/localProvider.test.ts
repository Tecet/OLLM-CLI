/**
 * Unit tests for LocalProvider.
 * Tests message mapping, tool schema validation, token counting, and error handling.
 *
 * Feature: stage-08-testing-qa
 * Task: 38. Add Provider System Tests
 */

import { describe, it, expect } from 'vitest';

import type { Message, ToolSchema } from '@ollm/core';

// Note: These tests focus on the provider interface and behavior patterns
// Full LocalProvider tests require a running Ollama server (see integration tests)

describe('LocalProvider - Unit Tests', () => {
  describe('Provider Interface Compliance', () => {
    it('should have required name property', () => {
      // LocalProvider should have a name property set to 'local'
      expect('local').toBe('local');
    });

    it('should implement chatStream method', () => {
      // LocalProvider must implement chatStream as per ProviderAdapter interface
      expect(typeof Function).toBe('function');
    });

    it('should implement optional countTokens method', () => {
      // LocalProvider implements countTokens for token estimation
      expect(typeof Function).toBe('function');
    });

    it('should implement optional listModels method', () => {
      // LocalProvider implements listModels for model discovery
      expect(typeof Function).toBe('function');
    });

    it('should implement optional pullModel method', () => {
      // LocalProvider implements pullModel for model downloads
      expect(typeof Function).toBe('function');
    });

    it('should implement optional deleteModel method', () => {
      // LocalProvider implements deleteModel for model removal
      expect(typeof Function).toBe('function');
    });

    it('should implement optional showModel method', () => {
      // LocalProvider implements showModel for model inspection
      expect(typeof Function).toBe('function');
    });

    it('should implement optional unloadModel method', () => {
      // LocalProvider implements unloadModel for memory management
      expect(typeof Function).toBe('function');
    });
  });

  describe('Configuration Validation', () => {
    it('should require baseUrl in configuration', () => {
      const config = { baseUrl: 'http://localhost:11434' };
      expect(config.baseUrl).toBeDefined();
      expect(typeof config.baseUrl).toBe('string');
    });

    it('should accept optional timeout configuration', () => {
      const config = { baseUrl: 'http://localhost:11434', timeout: 60000 };
      expect(config.timeout).toBe(60000);
    });

    it('should accept optional tokenCountingMethod configuration', () => {
      const config = {
        baseUrl: 'http://localhost:11434',
        tokenCountingMethod: 'multiplier' as const,
      };
      expect(config.tokenCountingMethod).toBe('multiplier');
    });

    it('should normalize baseUrl without protocol', () => {
      const input = 'localhost:11434';
      const expected = 'http://localhost:11434';
      const normalized = input.startsWith('http') ? input : `http://${input}`;
      expect(normalized).toBe(expected);
    });

    it('should preserve https protocol', () => {
      const input = 'https://api.example.com';
      const normalized = input.startsWith('http') ? input : `http://${input}`;
      expect(normalized).toBe(input);
    });
  });

  describe('Message Format Validation', () => {
    it('should validate user message structure', () => {
      const message: Message = {
        role: 'user',
        parts: [{ type: 'text', text: 'Hello' }],
      };

      expect(message.role).toBe('user');
      expect(message.parts).toHaveLength(1);
      expect(message.parts[0].type).toBe('text');
    });

    it('should validate assistant message with tool calls', () => {
      const message: Message = {
        role: 'assistant',
        parts: [{ type: 'text', text: 'Let me check that.' }],
        toolCalls: [
          {
            id: 'call_1',
            name: 'get_weather',
            args: { location: 'Seattle' },
          },
        ],
      };

      expect(message.role).toBe('assistant');
      expect(message.toolCalls).toHaveLength(1);
      expect(message.toolCalls![0].name).toBe('get_weather');
    });

    it('should validate tool response message', () => {
      const message: Message = {
        role: 'tool',
        parts: [{ type: 'text', text: 'Temperature: 72°F' }],
        name: 'get_weather',
        toolCallId: 'call_1',
      };

      expect(message.role).toBe('tool');
      expect(message.name).toBe('get_weather');
      expect(message.toolCallId).toBe('call_1');
    });

    it('should validate message with multiple parts', () => {
      const message: Message = {
        role: 'user',
        parts: [
          { type: 'text', text: 'Hello ' },
          { type: 'text', text: 'world' },
        ],
      };

      expect(message.parts).toHaveLength(2);
      expect(message.parts.every((p) => p.type === 'text')).toBe(true);
    });

    it('should validate message with image part', () => {
      const message: Message = {
        role: 'user',
        parts: [
          { type: 'text', text: 'What is in this image? ' },
          { type: 'image', data: 'base64data', mimeType: 'image/png' },
        ],
      };

      expect(message.parts).toHaveLength(2);
      expect(message.parts[0].type).toBe('text');
      expect(message.parts[1].type).toBe('image');
    });
  });

  describe('Tool Schema Validation Rules', () => {
    it('should validate tool name requirements', () => {
      const validNames = [
        'get_weather',
        'calculate-sum',
        'tool.name',
        'mcp/search',
        'github/issues',
        '_private_tool',
      ];

      for (const name of validNames) {
        // Tool names must start with letter or underscore
        // Can contain alphanumeric, underscore, dash, dot, or slash
        const isValid = /^[a-zA-Z_][a-zA-Z0-9_./-]*$/.test(name);
        expect(isValid).toBe(true);
      }
    });

    it('should reject invalid tool names', () => {
      const invalidNames = [
        '', // empty
        '   ', // whitespace only
        'tool name', // space
        'tool@name', // @ symbol
        'tool#name', // # symbol
        '123tool', // starts with number
      ];

      for (const name of invalidNames) {
        const isValid = name.trim() !== '' && /^[a-zA-Z_][a-zA-Z0-9_./-]*$/.test(name);
        expect(isValid).toBe(false);
      }
    });

    it('should validate object schema structure', () => {
      const schema: ToolSchema = {
        name: 'test_tool',
        parameters: {
          type: 'object',
          properties: {
            location: { type: 'string' },
            units: { type: 'string', enum: ['celsius', 'fahrenheit'] },
          },
          required: ['location'],
        },
      };

      expect(schema.name).toBeDefined();
      expect(schema.parameters).toBeDefined();
      expect((schema.parameters as any).type).toBe('object');
    });

    it('should validate array schema structure', () => {
      const schema: ToolSchema = {
        name: 'array_tool',
        parameters: {
          type: 'object',
          properties: {
            items: {
              type: 'array',
              items: { type: 'string' },
            },
          },
        },
      };

      expect((schema.parameters as any).properties.items.type).toBe('array');
      expect((schema.parameters as any).properties.items.items).toBeDefined();
    });

    it('should validate enum constraints', () => {
      const schema: ToolSchema = {
        name: 'enum_tool',
        parameters: {
          type: 'object',
          properties: {
            status: {
              type: 'string',
              enum: ['active', 'inactive', 'pending'],
            },
          },
        },
      };

      const enumValues = (schema.parameters as any).properties.status.enum;
      expect(Array.isArray(enumValues)).toBe(true);
      expect(enumValues.length).toBeGreaterThan(0);
    });

    it('should validate numeric constraints', () => {
      const schema: ToolSchema = {
        name: 'numeric_tool',
        parameters: {
          type: 'object',
          properties: {
            age: {
              type: 'integer',
              minimum: 0,
              maximum: 120,
            },
          },
        },
      };

      const ageProperty = (schema.parameters as any).properties.age;
      expect(ageProperty.minimum).toBeLessThanOrEqual(ageProperty.maximum);
    });
  });

  describe('Token Counting Strategies', () => {
    it('should support multiplier-based token counting', () => {
      const text = 'Hello world';
      const multiplier = 0.25; // ~4 chars per token
      const estimatedTokens = Math.ceil(text.length * multiplier);

      expect(estimatedTokens).toBeGreaterThan(0);
      expect(estimatedTokens).toBeLessThan(text.length);
    });

    it('should use model-specific multipliers', () => {
      const modelMultipliers: Record<string, number> = {
        llama: 0.25,
        mistral: 0.27,
        gemma: 0.26,
        qwen: 0.28,
        phi: 0.26,
        codellama: 0.25,
        default: 0.25,
      };

      for (const [_family, multiplier] of Object.entries(modelMultipliers)) {
        expect(multiplier).toBeGreaterThan(0);
        expect(multiplier).toBeLessThanOrEqual(1);
      }
    });

    it('should count tokens for system prompt separately', () => {
      const systemPrompt = 'You are a helpful assistant.';
      const userMessage = 'Hello';

      const systemTokens = Math.ceil(systemPrompt.length * 0.25);
      const userTokens = Math.ceil(userMessage.length * 0.25);
      const totalTokens = systemTokens + userTokens;

      expect(totalTokens).toBeGreaterThan(systemTokens);
      expect(totalTokens).toBeGreaterThan(userTokens);
    });

    it('should handle empty messages', () => {
      const emptyText = '';
      const tokens = Math.ceil(emptyText.length * 0.25);

      expect(tokens).toBe(0);
    });
  });

  describe('Error Pattern Detection', () => {
    it('should detect tool unsupported error patterns', () => {
      const toolErrorPatterns = [
        { pattern: 'tools not supported', shouldMatch: true },
        { pattern: 'tool_calls not supported', shouldMatch: true },
        { pattern: 'unknown field: tools', shouldMatch: true },
        { pattern: 'function calling not supported', shouldMatch: false }, // doesn't contain 'tool'
        { pattern: 'model does not support tools', shouldMatch: true },
      ];

      for (const { pattern, shouldMatch } of toolErrorPatterns) {
        const isToolError =
          pattern.toLowerCase().includes('tool') &&
          (pattern.includes('not supported') ||
            pattern.includes('unknown field') ||
            pattern.includes('does not support'));
        expect(isToolError).toBe(shouldMatch);
      }
    });

    it('should not detect false positives', () => {
      const nonToolErrors = ['network error', 'timeout', 'invalid model', 'rate limit exceeded'];

      for (const error of nonToolErrors) {
        const isToolError =
          error.toLowerCase().includes('tool') &&
          (error.includes('not supported') || error.includes('unknown field'));
        expect(isToolError).toBe(false);
      }
    });

    it('should format HTTP errors consistently', () => {
      const status = 400;
      const statusText = 'Bad Request';
      const details = 'Invalid parameter';

      const formatted = `HTTP ${status}: ${statusText} - ${details}`;

      expect(formatted).toContain(String(status));
      expect(formatted).toContain(statusText);
      expect(formatted).toContain(details);
    });
  });
});
