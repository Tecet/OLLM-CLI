/**
 * Tests for Parameter Validation
 */

import { describe, it, expect, beforeEach } from 'vitest';
import fc from 'fast-check';
import { ParameterValidator, type ValidationError } from '../validation.js';
import type { ToolSchema } from '../types.js';

describe('Parameter Validation', () => {
  let validator: ParameterValidator;

  beforeEach(() => {
    validator = new ParameterValidator();
  });

  describe('Required Fields Validation', () => {
    it('should validate required fields are present', () => {
      const schema: ToolSchema = {
        name: 'test_tool',
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string' },
            content: { type: 'string' },
          },
          required: ['path', 'content'],
        },
      };

      validator.registerSchema('test_tool', schema);

      // Missing required field
      const error1 = validator.validate('test_tool', { path: '/test' });
      expect(error1).not.toBeNull();
      expect(error1?.type).toBe('ValidationError');
      expect(error1?.message).toContain('content');

      // All required fields present
      const error2 = validator.validate('test_tool', {
        path: '/test',
        content: 'hello',
      });
      expect(error2).toBeNull();
    });

    it('should handle multiple missing required fields', () => {
      const schema: ToolSchema = {
        name: 'test_tool',
        parameters: {
          type: 'object',
          properties: {
            field1: { type: 'string' },
            field2: { type: 'string' },
            field3: { type: 'string' },
          },
          required: ['field1', 'field2', 'field3'],
        },
      };

      validator.registerSchema('test_tool', schema);

      const error = validator.validate('test_tool', {});
      expect(error).not.toBeNull();
      expect(error?.details).toHaveLength(3);
    });
  });

  describe('Type Validation', () => {
    it('should validate string types', () => {
      const schema: ToolSchema = {
        name: 'test_tool',
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string' },
          },
          required: ['path'],
        },
      };

      validator.registerSchema('test_tool', schema);

      // Valid string
      expect(validator.validate('test_tool', { path: '/test' })).toBeNull();

      // Invalid type
      const error = validator.validate('test_tool', { path: 123 });
      expect(error).not.toBeNull();
      expect(error?.message).toContain('invalid type');
      expect(error?.message).toContain('string');
    });

    it('should validate number types', () => {
      const schema: ToolSchema = {
        name: 'test_tool',
        parameters: {
          type: 'object',
          properties: {
            count: { type: 'number' },
          },
          required: ['count'],
        },
      };

      validator.registerSchema('test_tool', schema);

      // Valid number
      expect(validator.validate('test_tool', { count: 42 })).toBeNull();
      expect(validator.validate('test_tool', { count: 3.14 })).toBeNull();

      // Invalid type
      const error = validator.validate('test_tool', { count: 'not a number' });
      expect(error).not.toBeNull();
      expect(error?.message).toContain('invalid type');
    });

    it('should validate boolean types', () => {
      const schema: ToolSchema = {
        name: 'test_tool',
        parameters: {
          type: 'object',
          properties: {
            flag: { type: 'boolean' },
          },
          required: ['flag'],
        },
      };

      validator.registerSchema('test_tool', schema);

      // Valid boolean
      expect(validator.validate('test_tool', { flag: true })).toBeNull();
      expect(validator.validate('test_tool', { flag: false })).toBeNull();

      // Invalid type
      const error = validator.validate('test_tool', { flag: 'true' });
      expect(error).not.toBeNull();
      expect(error?.message).toContain('invalid type');
    });

    it('should validate array types', () => {
      const schema: ToolSchema = {
        name: 'test_tool',
        parameters: {
          type: 'object',
          properties: {
            items: { type: 'array' },
          },
          required: ['items'],
        },
      };

      validator.registerSchema('test_tool', schema);

      // Valid array
      expect(validator.validate('test_tool', { items: [] })).toBeNull();
      expect(validator.validate('test_tool', { items: [1, 2, 3] })).toBeNull();

      // Invalid type
      const error = validator.validate('test_tool', { items: 'not an array' });
      expect(error).not.toBeNull();
      expect(error?.message).toContain('invalid type');
    });
  });

  describe('Enum Validation', () => {
    it('should validate enum values', () => {
      const schema: ToolSchema = {
        name: 'test_tool',
        parameters: {
          type: 'object',
          properties: {
            action: {
              type: 'string',
              enum: ['get', 'set', 'delete'],
            },
          },
          required: ['action'],
        },
      };

      validator.registerSchema('test_tool', schema);

      // Valid enum values
      expect(validator.validate('test_tool', { action: 'get' })).toBeNull();
      expect(validator.validate('test_tool', { action: 'set' })).toBeNull();
      expect(validator.validate('test_tool', { action: 'delete' })).toBeNull();

      // Invalid enum value
      const error = validator.validate('test_tool', { action: 'invalid' });
      expect(error).not.toBeNull();
      expect(error?.message).toContain('must be one of');
      expect(error?.message).toContain('get');
      expect(error?.message).toContain('set');
      expect(error?.message).toContain('delete');
    });
  });

  describe('String Constraints', () => {
    it('should validate minLength constraint', () => {
      const schema: ToolSchema = {
        name: 'test_tool',
        parameters: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              minLength: 3,
            },
          },
          required: ['name'],
        },
      };

      validator.registerSchema('test_tool', schema);

      // Valid length
      expect(validator.validate('test_tool', { name: 'abc' })).toBeNull();
      expect(validator.validate('test_tool', { name: 'abcd' })).toBeNull();

      // Too short
      const error = validator.validate('test_tool', { name: 'ab' });
      expect(error).not.toBeNull();
      expect(error?.message).toContain('at least 3 characters');
    });

    it('should validate maxLength constraint', () => {
      const schema: ToolSchema = {
        name: 'test_tool',
        parameters: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              maxLength: 5,
            },
          },
          required: ['name'],
        },
      };

      validator.registerSchema('test_tool', schema);

      // Valid length
      expect(validator.validate('test_tool', { name: 'abc' })).toBeNull();
      expect(validator.validate('test_tool', { name: 'abcde' })).toBeNull();

      // Too long
      const error = validator.validate('test_tool', { name: 'abcdef' });
      expect(error).not.toBeNull();
      expect(error?.message).toContain('at most 5 characters');
    });

    it('should validate pattern constraint', () => {
      const schema: ToolSchema = {
        name: 'test_tool',
        parameters: {
          type: 'object',
          properties: {
            email: {
              type: 'string',
              pattern: '^[a-z]+@[a-z]+\\.[a-z]+$',
            },
          },
          required: ['email'],
        },
      };

      validator.registerSchema('test_tool', schema);

      // Valid pattern
      expect(validator.validate('test_tool', { email: 'test@example.com' })).toBeNull();

      // Invalid pattern
      const error = validator.validate('test_tool', { email: 'not-an-email' });
      expect(error).not.toBeNull();
      expect(error?.message).toContain('does not match required pattern');
    });
  });

  describe('Number Constraints', () => {
    it('should validate minimum constraint', () => {
      const schema: ToolSchema = {
        name: 'test_tool',
        parameters: {
          type: 'object',
          properties: {
            age: {
              type: 'number',
              minimum: 0,
            },
          },
          required: ['age'],
        },
      };

      validator.registerSchema('test_tool', schema);

      // Valid values
      expect(validator.validate('test_tool', { age: 0 })).toBeNull();
      expect(validator.validate('test_tool', { age: 10 })).toBeNull();

      // Too small
      const error = validator.validate('test_tool', { age: -1 });
      expect(error).not.toBeNull();
      expect(error?.message).toContain('at least 0');
    });

    it('should validate maximum constraint', () => {
      const schema: ToolSchema = {
        name: 'test_tool',
        parameters: {
          type: 'object',
          properties: {
            percentage: {
              type: 'number',
              maximum: 100,
            },
          },
          required: ['percentage'],
        },
      };

      validator.registerSchema('test_tool', schema);

      // Valid values
      expect(validator.validate('test_tool', { percentage: 50 })).toBeNull();
      expect(validator.validate('test_tool', { percentage: 100 })).toBeNull();

      // Too large
      const error = validator.validate('test_tool', { percentage: 101 });
      expect(error).not.toBeNull();
      expect(error?.message).toContain('at most 100');
    });
  });

  describe('Array Constraints', () => {
    it('should validate minItems constraint', () => {
      const schema: ToolSchema = {
        name: 'test_tool',
        parameters: {
          type: 'object',
          properties: {
            items: {
              type: 'array',
              minItems: 2,
            },
          },
          required: ['items'],
        },
      };

      validator.registerSchema('test_tool', schema);

      // Valid arrays
      expect(validator.validate('test_tool', { items: [1, 2] })).toBeNull();
      expect(validator.validate('test_tool', { items: [1, 2, 3] })).toBeNull();

      // Too few items
      const error = validator.validate('test_tool', { items: [1] });
      expect(error).not.toBeNull();
      expect(error?.message).toContain('at least 2 items');
    });

    it('should validate maxItems constraint', () => {
      const schema: ToolSchema = {
        name: 'test_tool',
        parameters: {
          type: 'object',
          properties: {
            items: {
              type: 'array',
              maxItems: 3,
            },
          },
          required: ['items'],
        },
      };

      validator.registerSchema('test_tool', schema);

      // Valid arrays
      expect(validator.validate('test_tool', { items: [1, 2] })).toBeNull();
      expect(validator.validate('test_tool', { items: [1, 2, 3] })).toBeNull();

      // Too many items
      const error = validator.validate('test_tool', { items: [1, 2, 3, 4] });
      expect(error).not.toBeNull();
      expect(error?.message).toContain('at most 3 items');
    });

    it('should validate array item types', () => {
      const schema: ToolSchema = {
        name: 'test_tool',
        parameters: {
          type: 'object',
          properties: {
            paths: {
              type: 'array',
              items: { type: 'string' },
            },
          },
          required: ['paths'],
        },
      };

      validator.registerSchema('test_tool', schema);

      // Valid array
      expect(validator.validate('test_tool', { paths: ['a', 'b', 'c'] })).toBeNull();

      // Invalid item type
      const error = validator.validate('test_tool', { paths: ['a', 123, 'c'] });
      expect(error).not.toBeNull();
      expect(error?.message).toContain('invalid type');
    });
  });

  describe('Optional Fields', () => {
    it('should allow optional fields to be omitted', () => {
      const schema: ToolSchema = {
        name: 'test_tool',
        parameters: {
          type: 'object',
          properties: {
            required_field: { type: 'string' },
            optional_field: { type: 'string' },
          },
          required: ['required_field'],
        },
      };

      validator.registerSchema('test_tool', schema);

      // With optional field
      expect(
        validator.validate('test_tool', {
          required_field: 'test',
          optional_field: 'optional',
        })
      ).toBeNull();

      // Without optional field
      expect(
        validator.validate('test_tool', {
          required_field: 'test',
        })
      ).toBeNull();
    });

    it('should validate optional fields when present', () => {
      const schema: ToolSchema = {
        name: 'test_tool',
        parameters: {
          type: 'object',
          properties: {
            required_field: { type: 'string' },
            optional_number: { type: 'number' },
          },
          required: ['required_field'],
        },
      };

      validator.registerSchema('test_tool', schema);

      // Valid optional field
      expect(
        validator.validate('test_tool', {
          required_field: 'test',
          optional_number: 42,
        })
      ).toBeNull();

      // Invalid optional field
      const error = validator.validate('test_tool', {
        required_field: 'test',
        optional_number: 'not a number',
      });
      expect(error).not.toBeNull();
      expect(error?.message).toContain('invalid type');
    });
  });

  describe('No Schema', () => {
    it('should return null when no schema is registered', () => {
      const error = validator.validate('unknown_tool', { any: 'params' });
      expect(error).toBeNull();
    });

    it('should return null when schema has no parameters', () => {
      const schema: ToolSchema = {
        name: 'test_tool',
      };

      validator.registerSchema('test_tool', schema);

      const error = validator.validate('test_tool', { any: 'params' });
      expect(error).toBeNull();
    });
  });

  describe('Property 44: Tool Invocation Parameter Validation', () => {
    it('should validate parameters against tool schema', () => {
      // Feature: stage-03-tools-policy, Property 44: Tool Invocation Parameter Validation
      fc.assert(
        fc.property(
          fc.record({
            path: fc.string({ minLength: 1, maxLength: 100 }),
            content: fc.string({ minLength: 0, maxLength: 1000 }),
          }),
          (params) => {
            const schema: ToolSchema = {
              name: 'write_file',
              parameters: {
                type: 'object',
                properties: {
                  path: { type: 'string' },
                  content: { type: 'string' },
                },
                required: ['path', 'content'],
              },
            };

            validator.registerSchema('write_file', schema);

            // Valid parameters should pass validation
            const error = validator.validate('write_file', params);
            expect(error).toBeNull();

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject invalid parameters', () => {
      // Feature: stage-03-tools-policy, Property 44: Tool Invocation Parameter Validation
      fc.assert(
        fc.property(
          fc.record({
            path: fc.integer(), // Wrong type - should be string
            content: fc.string(),
          }),
          (params) => {
            const schema: ToolSchema = {
              name: 'write_file',
              parameters: {
                type: 'object',
                properties: {
                  path: { type: 'string' },
                  content: { type: 'string' },
                },
                required: ['path', 'content'],
              },
            };

            validator.registerSchema('write_file', schema);

            // Invalid parameters should fail validation
            const error = validator.validate('write_file', params as any);
            expect(error).not.toBeNull();
            expect(error?.type).toBe('ValidationError');

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});

