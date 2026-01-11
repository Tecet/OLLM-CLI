/**
 * Tests for core tool type definitions
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import type {
  ToolResult,
  ToolCallConfirmationDetails,
  ToolSchema,
} from '../types.js';

describe('Tool Types', () => {
  describe('ToolResult', () => {
    it('Property 49: Tool Result Format - should have required fields', () => {
      // Feature: stage-03-tools-policy, Property 49: Tool Result Format
      fc.assert(
        fc.property(
          fc.string(),
          fc.string(),
          (llmContent, returnDisplay) => {
            const result: ToolResult = {
              llmContent,
              returnDisplay,
            };

            // Verify required fields exist
            expect(result).toHaveProperty('llmContent');
            expect(result).toHaveProperty('returnDisplay');
            expect(typeof result.llmContent).toBe('string');
            expect(typeof result.returnDisplay).toBe('string');

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Property 49: Tool Result Format - should support optional error field', () => {
      // Feature: stage-03-tools-policy, Property 49: Tool Result Format
      fc.assert(
        fc.property(
          fc.string(),
          fc.string(),
          fc.string(),
          fc.string(),
          (llmContent, returnDisplay, errorMessage, errorType) => {
            const result: ToolResult = {
              llmContent,
              returnDisplay,
              error: {
                message: errorMessage,
                type: errorType,
              },
            };

            // Verify error structure
            expect(result.error).toBeDefined();
            expect(result.error?.message).toBe(errorMessage);
            expect(result.error?.type).toBe(errorType);

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should allow empty strings for content fields', () => {
      const result: ToolResult = {
        llmContent: '',
        returnDisplay: '',
      };

      expect(result.llmContent).toBe('');
      expect(result.returnDisplay).toBe('');
    });

    it('should allow different values for llmContent and returnDisplay', () => {
      const result: ToolResult = {
        llmContent: 'Detailed content for LLM processing',
        returnDisplay: 'Brief summary for user',
      };

      expect(result.llmContent).not.toBe(result.returnDisplay);
    });
  });

  describe('ToolCallConfirmationDetails', () => {
    it('should have required fields', () => {
      const details: ToolCallConfirmationDetails = {
        toolName: 'test_tool',
        description: 'Test operation',
        risk: 'medium',
      };

      expect(details.toolName).toBe('test_tool');
      expect(details.description).toBe('Test operation');
      expect(details.risk).toBe('medium');
    });

    it('should support all risk levels', () => {
      const riskLevels: Array<'low' | 'medium' | 'high'> = [
        'low',
        'medium',
        'high',
      ];

      for (const risk of riskLevels) {
        const details: ToolCallConfirmationDetails = {
          toolName: 'test',
          description: 'test',
          risk,
        };
        expect(details.risk).toBe(risk);
      }
    });

    it('should support optional locations field', () => {
      const details: ToolCallConfirmationDetails = {
        toolName: 'write_file',
        description: 'Write to file',
        risk: 'medium',
        locations: ['/path/to/file.txt', '/path/to/other.txt'],
      };

      expect(details.locations).toHaveLength(2);
      expect(details.locations?.[0]).toBe('/path/to/file.txt');
    });
  });

  describe('ToolSchema', () => {
    it('should have required name field', () => {
      const schema: ToolSchema = {
        name: 'test_tool',
      };

      expect(schema.name).toBe('test_tool');
    });

    it('should support optional description and parameters', () => {
      const schema: ToolSchema = {
        name: 'read_file',
        description: 'Read file content',
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string' },
          },
          required: ['path'],
        },
      };

      expect(schema.description).toBe('Read file content');
      expect(schema.parameters).toBeDefined();
    });

    it('should allow complex parameter schemas', () => {
      const schema: ToolSchema = {
        name: 'complex_tool',
        parameters: {
          type: 'object',
          properties: {
            stringParam: { type: 'string' },
            numberParam: { type: 'number' },
            booleanParam: { type: 'boolean' },
            arrayParam: {
              type: 'array',
              items: { type: 'string' },
            },
            objectParam: {
              type: 'object',
              properties: {
                nested: { type: 'string' },
              },
            },
          },
        },
      };

      expect(schema.parameters).toBeDefined();
      const params = schema.parameters as any;
      expect(params.properties).toHaveProperty('stringParam');
      expect(params.properties).toHaveProperty('arrayParam');
      expect(params.properties).toHaveProperty('objectParam');
    });
  });
});
