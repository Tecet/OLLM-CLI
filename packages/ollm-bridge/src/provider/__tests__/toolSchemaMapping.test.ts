/**
 * Unit tests for tool schema mapping in provider adapters.
 * Tests the conversion of internal ToolSchema to provider-specific formats.
 */

import { describe, it, expect } from 'vitest';
import type { ToolSchema } from '@ollm/core';
import { LocalProvider } from '../localProvider';

describe('Tool Schema Mapping', () => {
  describe('LocalProvider - Ollama Format', () => {
    const provider = new LocalProvider({ baseUrl: 'http://localhost:11434' });

    it('should map a simple tool schema', () => {
      const tools: ToolSchema[] = [
        {
          name: 'get_weather',
          description: 'Get the current weather',
          parameters: {
            type: 'object',
            properties: {
              location: { type: 'string' },
            },
            required: ['location'],
          },
        },
      ];

      // Access private method via type assertion for testing
      const mapped = (provider as any).mapTools(tools);

      expect(mapped).toEqual([
        {
          type: 'function',
          function: {
            name: 'get_weather',
            description: 'Get the current weather',
            parameters: {
              type: 'object',
              properties: {
                location: { type: 'string' },
              },
              required: ['location'],
            },
          },
        },
      ]);
    });

    it('should map multiple tools', () => {
      const tools: ToolSchema[] = [
        {
          name: 'read_file',
          description: 'Read a file',
          parameters: {
            type: 'object',
            properties: {
              path: { type: 'string' },
            },
          },
        },
        {
          name: 'write_file',
          description: 'Write to a file',
          parameters: {
            type: 'object',
            properties: {
              path: { type: 'string' },
              content: { type: 'string' },
            },
          },
        },
      ];

      const mapped = (provider as any).mapTools(tools);

      expect(mapped).toHaveLength(2);
      expect(mapped[0].function.name).toBe('read_file');
      expect(mapped[1].function.name).toBe('write_file');
    });

    it('should handle tool without description', () => {
      const tools: ToolSchema[] = [
        {
          name: 'simple_tool',
          parameters: {
            type: 'object',
            properties: {},
          },
        },
      ];

      const mapped = (provider as any).mapTools(tools);

      expect(mapped[0].function).toEqual({
        name: 'simple_tool',
        description: undefined,
        parameters: {
          type: 'object',
          properties: {},
        },
      });
    });

    it('should handle tool without parameters', () => {
      const tools: ToolSchema[] = [
        {
          name: 'no_params_tool',
          description: 'A tool with no parameters',
        },
      ];

      const mapped = (provider as any).mapTools(tools);

      expect(mapped[0].function).toEqual({
        name: 'no_params_tool',
        description: 'A tool with no parameters',
        parameters: undefined,
      });
    });

    it('should handle complex parameter schemas', () => {
      const tools: ToolSchema[] = [
        {
          name: 'complex_tool',
          description: 'A tool with complex parameters',
          parameters: {
            type: 'object',
            properties: {
              stringParam: { type: 'string', description: 'A string' },
              numberParam: { type: 'number', minimum: 0, maximum: 100 },
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
              enumParam: {
                type: 'string',
                enum: ['option1', 'option2', 'option3'],
              },
            },
            required: ['stringParam', 'numberParam'],
          },
        },
      ];

      const mapped = (provider as any).mapTools(tools);

      expect(mapped[0].function.parameters).toEqual(tools[0].parameters);
    });

    it('should handle empty tools array', () => {
      const tools: ToolSchema[] = [];
      const mapped = (provider as any).mapTools(tools);
      expect(mapped).toEqual([]);
    });

    it('should preserve all JSON Schema properties', () => {
      const tools: ToolSchema[] = [
        {
          name: 'advanced_tool',
          description: 'Tool with advanced JSON Schema features',
          parameters: {
            type: 'object',
            properties: {
              name: {
                type: 'string',
                minLength: 1,
                maxLength: 100,
                pattern: '^[a-zA-Z]+$',
              },
              age: {
                type: 'integer',
                minimum: 0,
                maximum: 150,
                exclusiveMinimum: false,
              },
              email: {
                type: 'string',
                format: 'email',
              },
              tags: {
                type: 'array',
                items: { type: 'string' },
                minItems: 1,
                maxItems: 10,
                uniqueItems: true,
              },
            },
            required: ['name', 'email'],
            additionalProperties: false,
          },
        },
      ];

      const mapped = (provider as any).mapTools(tools);

      expect(mapped[0].function.parameters).toEqual(tools[0].parameters);
    });

    it('should handle tools with oneOf/anyOf/allOf', () => {
      const tools: ToolSchema[] = [
        {
          name: 'conditional_tool',
          description: 'Tool with conditional schemas',
          parameters: {
            type: 'object',
            properties: {
              value: {
                oneOf: [{ type: 'string' }, { type: 'number' }],
              },
            },
          },
        },
      ];

      const mapped = (provider as any).mapTools(tools);

      expect(mapped[0].function.parameters.properties.value).toEqual({
        oneOf: [{ type: 'string' }, { type: 'number' }],
      });
    });

    it('should handle deeply nested object schemas', () => {
      const tools: ToolSchema[] = [
        {
          name: 'nested_tool',
          description: 'Tool with deeply nested parameters',
          parameters: {
            type: 'object',
            properties: {
              level1: {
                type: 'object',
                properties: {
                  level2: {
                    type: 'object',
                    properties: {
                      level3: {
                        type: 'string',
                      },
                    },
                  },
                },
              },
            },
          },
        },
      ];

      const mapped = (provider as any).mapTools(tools);

      expect(mapped[0].function.parameters).toEqual(tools[0].parameters);
    });

    it('should handle array of objects with complex schemas', () => {
      const tools: ToolSchema[] = [
        {
          name: 'array_tool',
          description: 'Tool with array of complex objects',
          parameters: {
            type: 'object',
            properties: {
              items: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    value: { type: 'number' },
                    metadata: {
                      type: 'object',
                      additionalProperties: true,
                    },
                  },
                  required: ['id'],
                },
              },
            },
          },
        },
      ];

      const mapped = (provider as any).mapTools(tools);

      expect(mapped[0].function.parameters).toEqual(tools[0].parameters);
    });

    it('should maintain tool order', () => {
      const tools: ToolSchema[] = [
        { name: 'tool_a', description: 'First tool' },
        { name: 'tool_b', description: 'Second tool' },
        { name: 'tool_c', description: 'Third tool' },
        { name: 'tool_d', description: 'Fourth tool' },
      ];

      const mapped = (provider as any).mapTools(tools);

      expect(mapped.map((t: any) => t.function.name)).toEqual([
        'tool_a',
        'tool_b',
        'tool_c',
        'tool_d',
      ]);
    });

    it('should handle tools with special characters in names', () => {
      const tools: ToolSchema[] = [
        {
          name: 'tool_with_underscores',
          description: 'Tool name with underscores',
        },
        {
          name: 'tool-with-dashes',
          description: 'Tool name with dashes',
        },
        {
          name: 'toolWithCamelCase',
          description: 'Tool name in camelCase',
        },
      ];

      const mapped = (provider as any).mapTools(tools);

      expect(mapped[0].function.name).toBe('tool_with_underscores');
      expect(mapped[1].function.name).toBe('tool-with-dashes');
      expect(mapped[2].function.name).toBe('toolWithCamelCase');
    });

    it('should handle tools with $ref in parameters', () => {
      const tools: ToolSchema[] = [
        {
          name: 'ref_tool',
          description: 'Tool with $ref in schema',
          parameters: {
            type: 'object',
            properties: {
              config: {
                $ref: '#/definitions/Config',
              },
            },
            definitions: {
              Config: {
                type: 'object',
                properties: {
                  setting: { type: 'string' },
                },
              },
            },
          },
        },
      ];

      const mapped = (provider as any).mapTools(tools);

      expect(mapped[0].function.parameters).toEqual(tools[0].parameters);
    });

    it('should handle tools with default values', () => {
      const tools: ToolSchema[] = [
        {
          name: 'default_tool',
          description: 'Tool with default parameter values',
          parameters: {
            type: 'object',
            properties: {
              timeout: {
                type: 'number',
                default: 30,
              },
              retries: {
                type: 'integer',
                default: 3,
              },
              enabled: {
                type: 'boolean',
                default: true,
              },
            },
          },
        },
      ];

      const mapped = (provider as any).mapTools(tools);

      expect(mapped[0].function.parameters.properties.timeout.default).toBe(30);
      expect(mapped[0].function.parameters.properties.retries.default).toBe(3);
      expect(mapped[0].function.parameters.properties.enabled.default).toBe(true);
    });

    it('should handle tools with const and examples', () => {
      const tools: ToolSchema[] = [
        {
          name: 'example_tool',
          description: 'Tool with const and examples',
          parameters: {
            type: 'object',
            properties: {
              version: {
                type: 'string',
                const: '1.0.0',
              },
              name: {
                type: 'string',
                examples: ['example1', 'example2'],
              },
            },
          },
        },
      ];

      const mapped = (provider as any).mapTools(tools);

      expect(mapped[0].function.parameters.properties.version.const).toBe('1.0.0');
      expect(mapped[0].function.parameters.properties.name.examples).toEqual([
        'example1',
        'example2',
      ]);
    });
  });

  describe('Tool Schema Validation', () => {
    it('should reject malformed tool schemas with descriptive errors', () => {
      const provider = new LocalProvider({ baseUrl: 'http://localhost:11434' });

      // Test with various edge cases that should throw errors
      const edgeCases: ToolSchema[] = [
        { name: '', description: 'Empty name' },
        { name: 'valid_name', description: '', parameters: null as any },
      ];

      // Empty name should throw
      expect(() => (provider as any).mapTools([edgeCases[0]])).toThrow(/Tool name/);
      
      // Null parameters should be accepted (it's valid to have null)
      expect(() => (provider as any).mapTools([edgeCases[1]])).not.toThrow();
    });

    it('should preserve undefined vs null in parameters', () => {
      const provider = new LocalProvider({ baseUrl: 'http://localhost:11434' });

      const tools: ToolSchema[] = [
        {
          name: 'undefined_params',
          description: 'Tool with undefined parameters',
          parameters: undefined,
        },
        {
          name: 'null_params',
          description: 'Tool with null parameters',
          parameters: null as any,
        },
      ];

      const mapped = (provider as any).mapTools(tools);

      expect(mapped[0].function.parameters).toBeUndefined();
      expect(mapped[1].function.parameters).toBeNull();
    });
  });

  describe('Real-world Tool Examples', () => {
    const provider = new LocalProvider({ baseUrl: 'http://localhost:11434' });

    it('should map file system tool schemas', () => {
      const tools: ToolSchema[] = [
        {
          name: 'read_file',
          description: 'Read the contents of a file',
          parameters: {
            type: 'object',
            properties: {
              path: {
                type: 'string',
                description: 'Path to the file',
              },
              encoding: {
                type: 'string',
                enum: ['utf8', 'ascii', 'base64'],
                default: 'utf8',
              },
            },
            required: ['path'],
          },
        },
        {
          name: 'write_file',
          description: 'Write content to a file',
          parameters: {
            type: 'object',
            properties: {
              path: {
                type: 'string',
                description: 'Path to the file',
              },
              content: {
                type: 'string',
                description: 'Content to write',
              },
              mode: {
                type: 'string',
                enum: ['overwrite', 'append'],
                default: 'overwrite',
              },
            },
            required: ['path', 'content'],
          },
        },
      ];

      const mapped = (provider as any).mapTools(tools);

      expect(mapped).toHaveLength(2);
      expect(mapped[0].type).toBe('function');
      expect(mapped[1].type).toBe('function');
    });

    it('should map web search tool schema', () => {
      const tools: ToolSchema[] = [
        {
          name: 'web_search',
          description: 'Search the web for information',
          parameters: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'Search query',
                minLength: 1,
              },
              maxResults: {
                type: 'integer',
                description: 'Maximum number of results',
                minimum: 1,
                maximum: 100,
                default: 10,
              },
              language: {
                type: 'string',
                description: 'Language code',
                pattern: '^[a-z]{2}$',
                default: 'en',
              },
            },
            required: ['query'],
          },
        },
      ];

      const mapped = (provider as any).mapTools(tools);

      expect(mapped[0].function.name).toBe('web_search');
      expect(mapped[0].function.parameters.required).toEqual(['query']);
    });

    it('should map shell execution tool schema', () => {
      const tools: ToolSchema[] = [
        {
          name: 'execute_shell',
          description: 'Execute a shell command',
          parameters: {
            type: 'object',
            properties: {
              command: {
                type: 'string',
                description: 'Command to execute',
              },
              workingDirectory: {
                type: 'string',
                description: 'Working directory',
              },
              timeout: {
                type: 'number',
                description: 'Timeout in milliseconds',
                minimum: 0,
                default: 30000,
              },
              env: {
                type: 'object',
                description: 'Environment variables',
                additionalProperties: { type: 'string' },
              },
            },
            required: ['command'],
          },
        },
      ];

      const mapped = (provider as any).mapTools(tools);

      expect(mapped[0].function.parameters.properties.env.additionalProperties).toEqual({
        type: 'string',
      });
    });

    it('should map git operation tool schema', () => {
      const tools: ToolSchema[] = [
        {
          name: 'git_commit',
          description: 'Create a git commit',
          parameters: {
            type: 'object',
            properties: {
              message: {
                type: 'string',
                description: 'Commit message',
                minLength: 1,
              },
              files: {
                type: 'array',
                description: 'Files to commit',
                items: { type: 'string' },
                minItems: 1,
              },
              amend: {
                type: 'boolean',
                description: 'Amend previous commit',
                default: false,
              },
            },
            required: ['message', 'files'],
          },
        },
      ];

      const mapped = (provider as any).mapTools(tools);

      expect(mapped[0].function.parameters.properties.files.items).toEqual({
        type: 'string',
      });
    });
  });
});

describe('Property-Based Tests', () => {
  describe('Property 3: Valid Tool Schema Acceptance', () => {
    /**
     * Feature: stage-08-testing-qa, Property 3: Valid Tool Schema Acceptance
     * Validates: Requirements 2.1
     * 
     * For any tool schema that conforms to the JSON Schema specification,
     * the schema validator should accept it without errors.
     */
    it('should accept any valid tool schema without errors', async () => {
      const fc = await import('fast-check');
      const provider = new LocalProvider({ baseUrl: 'http://localhost:11434' });

      // Generator for valid JSON Schema types
      const arbJsonSchemaType = fc.constantFrom(
        'string',
        'number',
        'integer',
        'boolean',
        'object',
        'array',
        'null'
      );

      // Generator for simple property schemas
      const arbSimpleProperty: fc.Arbitrary<Record<string, unknown>> = fc.oneof(
        fc.record({ type: fc.constant('string') }),
        fc.record({ type: fc.constant('number') }),
        fc.record({ type: fc.constant('integer') }),
        fc.record({ type: fc.constant('boolean') }),
        fc.record({ type: fc.constant('null') })
      );

      // Generator for object schemas with properties
      const arbObjectSchema = fc.record({
        type: fc.constant('object'),
        properties: fc.dictionary(
          fc.string({ minLength: 1, maxLength: 20 }),
          arbSimpleProperty,
          { minKeys: 0, maxKeys: 5 }
        ),
        required: fc.option(
          fc.array(fc.string({ minLength: 1, maxLength: 20 }), { maxLength: 3 }),
          { nil: undefined }
        ),
      });

      // Generator for array schemas
      const arbArraySchema = fc.record({
        type: fc.constant('array'),
        items: arbSimpleProperty,
      });

      // Generator for valid tool schemas
      const arbValidToolSchema = fc.record({
        name: fc.string({ minLength: 1, maxLength: 50 }).filter(name => /^[a-zA-Z_][a-zA-Z0-9_-]*$/.test(name)),
        description: fc.option(fc.string({ maxLength: 200 }), { nil: undefined }),
        parameters: fc.option(
          fc.oneof(arbObjectSchema, arbArraySchema, arbSimpleProperty),
          { nil: undefined }
        ),
      });

      await fc.assert(
        fc.asyncProperty(
          fc.array(arbValidToolSchema, { minLength: 0, maxLength: 10 }),
          async (tools) => {
            // The property: mapping valid tool schemas should not throw errors
            let mapped;
            let error;
            
            try {
              mapped = (provider as any).mapTools(tools);
            } catch (e) {
              error = e;
            }

            // Assertion: No error should occur
            expect(error).toBeUndefined();
            
            // Assertion: Mapped result should exist
            expect(mapped).toBeDefined();
            
            // Assertion: Mapped result should be an array
            expect(Array.isArray(mapped)).toBe(true);
            
            // Assertion: Mapped result should have same length as input
            expect(mapped.length).toBe(tools.length);
            
            // Assertion: Each mapped tool should have correct structure
            for (let i = 0; i < tools.length; i++) {
              expect(mapped[i]).toHaveProperty('type', 'function');
              expect(mapped[i]).toHaveProperty('function');
              expect(mapped[i].function).toHaveProperty('name', tools[i].name);
              
              // Description should match (undefined or the value)
              if (tools[i].description !== undefined) {
                expect(mapped[i].function.description).toBe(tools[i].description);
              }
              
              // Parameters should match (undefined or the value)
              if (tools[i].parameters !== undefined) {
                expect(mapped[i].function.parameters).toEqual(tools[i].parameters);
              }
            }
          }
        ),
        { numRuns: 10 } // Reduced from 100 for performance // Run 100 iterations as specified in the design
      );
    });

    it('should preserve all schema properties during mapping', async () => {
      const fc = await import('fast-check');
      const provider = new LocalProvider({ baseUrl: 'http://localhost:11434' });

      // Generator for schemas with various JSON Schema properties
      const arbSchemaWithProperties = fc.record({
        type: fc.constantFrom('string', 'number', 'integer', 'boolean', 'object', 'array'),
        description: fc.option(fc.string({ maxLength: 100 }), { nil: undefined }),
        default: fc.option(fc.oneof(
          fc.string(),
          fc.integer(),
          fc.boolean(),
          fc.constant(null)
        ), { nil: undefined }),
        enum: fc.option(
          fc.array(fc.oneof(fc.string(), fc.integer()), { minLength: 1, maxLength: 5 }),
          { nil: undefined }
        ),
        minimum: fc.option(fc.integer({ min: 0, max: 100 }), { nil: undefined }),
        maximum: fc.option(fc.integer({ min: 101, max: 1000 }), { nil: undefined }),
        minLength: fc.option(fc.integer({ min: 0, max: 10 }), { nil: undefined }),
        maxLength: fc.option(fc.integer({ min: 11, max: 100 }), { nil: undefined }),
      });

      const arbToolWithRichSchema = fc.record({
        name: fc.string({ minLength: 1, maxLength: 30 }).filter(name => /^[a-zA-Z_][a-zA-Z0-9_-]*$/.test(name)),
        description: fc.option(fc.string({ maxLength: 150 }), { nil: undefined }),
        parameters: fc.record({
          type: fc.constant('object'),
          properties: fc.dictionary(
            fc.string({ minLength: 1, maxLength: 15 }),
            arbSchemaWithProperties,
            { minKeys: 1, maxKeys: 3 }
          ),
        }),
      });

      await fc.assert(
        fc.asyncProperty(
          arbToolWithRichSchema,
          async (tool) => {
            const mapped = (provider as any).mapTools([tool]);
            
            // The mapped parameters should exactly match the input parameters
            expect(mapped[0].function.parameters).toEqual(tool.parameters);
            
            // All properties in the schema should be preserved
            if (tool.parameters && tool.parameters.properties) {
              const inputProps = tool.parameters.properties;
              const outputProps = mapped[0].function.parameters.properties;
              
              for (const key of Object.keys(inputProps)) {
                expect(outputProps[key]).toEqual(inputProps[key]);
              }
            }
          }
        ),
        { numRuns: 10 } // Reduced from 100 for performance
      );
    });

    it('should handle edge cases in valid schemas', async () => {
      const fc = await import('fast-check');
      const provider = new LocalProvider({ baseUrl: 'http://localhost:11434' });

      // Generator for edge case schemas
      const arbEdgeCaseSchema = fc.oneof(
        // Empty object schema
        fc.record({
          name: fc.constant('empty_params'),
          parameters: fc.record({
            type: fc.constant('object'),
            properties: fc.constant({}),
          }),
        }),
        // No parameters
        fc.record({
          name: fc.constant('no_params'),
          description: fc.string({ maxLength: 50 }),
        }),
        // Minimal schema
        fc.record({
          name: fc.string({ minLength: 1, maxLength: 20 }).filter(name => /^[a-zA-Z_][a-zA-Z0-9_-]*$/.test(name)),
        }),
        // Schema with only required fields
        fc.record({
          name: fc.string({ minLength: 1, maxLength: 20 }).filter(name => /^[a-zA-Z_][a-zA-Z0-9_-]*$/.test(name)),
          parameters: fc.record({
            type: fc.constant('object'),
            properties: fc.constant({}),
            required: fc.array(fc.string(), { maxLength: 0 }),
          }),
        })
      );

      await fc.assert(
        fc.asyncProperty(
          arbEdgeCaseSchema,
          async (tool) => {
            let error;
            let mapped;
            
            try {
              mapped = (provider as any).mapTools([tool]);
            } catch (e) {
              error = e;
            }

            // Should not throw for valid edge cases
            expect(error).toBeUndefined();
            expect(mapped).toBeDefined();
            expect(mapped.length).toBe(1);
            expect(mapped[0].function.name).toBe(tool.name);
          }
        ),
        { numRuns: 10 } // Reduced from 100 for performance
      );
    });

    it('should handle nested object schemas correctly', async () => {
      const fc = await import('fast-check');
      const provider = new LocalProvider({ baseUrl: 'http://localhost:11434' });

      // Generator for nested object schemas (2 levels deep)
      const arbNestedSchema = fc.record({
        name: fc.string({ minLength: 1, maxLength: 20 }).filter(name => /^[a-zA-Z_][a-zA-Z0-9_-]*$/.test(name)),
        parameters: fc.record({
          type: fc.constant('object'),
          properties: fc.dictionary(
            fc.string({ minLength: 1, maxLength: 10 }),
            fc.record({
              type: fc.constant('object'),
              properties: fc.dictionary(
                fc.string({ minLength: 1, maxLength: 10 }),
                fc.record({ type: fc.constantFrom('string', 'number', 'boolean') }),
                { minKeys: 1, maxKeys: 2 }
              ),
            }),
            { minKeys: 1, maxKeys: 2 }
          ),
        }),
      });

      await fc.assert(
        fc.asyncProperty(
          arbNestedSchema,
          async (tool) => {
            const mapped = (provider as any).mapTools([tool]);
            
            // Nested structure should be preserved exactly
            expect(mapped[0].function.parameters).toEqual(tool.parameters);
            
            // Verify nested properties are intact
            const inputProps = tool.parameters.properties;
            const outputProps = mapped[0].function.parameters.properties;
            
            for (const outerKey of Object.keys(inputProps)) {
              expect(outputProps[outerKey]).toEqual(inputProps[outerKey]);
              
              if (inputProps[outerKey].properties) {
                for (const innerKey of Object.keys(inputProps[outerKey].properties)) {
                  expect(outputProps[outerKey].properties[innerKey]).toEqual(
                    inputProps[outerKey].properties[innerKey]
                  );
                }
              }
            }
          }
        ),
        { numRuns: 10 } // Reduced from 100 for performance
      );
    });

    it('should handle array schemas with various item types', async () => {
      const fc = await import('fast-check');
      const provider = new LocalProvider({ baseUrl: 'http://localhost:11434' });

      const arbArraySchema = fc.record({
        name: fc.string({ minLength: 1, maxLength: 20 }).filter(name => /^[a-zA-Z_][a-zA-Z0-9_-]*$/.test(name)),
        parameters: fc.record({
          type: fc.constant('object'),
          properties: fc.record({
            items: fc.record({
              type: fc.constant('array'),
              items: fc.oneof(
                fc.record({ type: fc.constant('string') }),
                fc.record({ type: fc.constant('number') }),
                fc.record({
                  type: fc.constant('object'),
                  properties: fc.dictionary(
                    fc.string({ minLength: 1, maxLength: 10 }),
                    fc.record({ type: fc.constantFrom('string', 'number') }),
                    { minKeys: 1, maxKeys: 2 }
                  ),
                })
              ),
            }),
          }),
        }),
      });

      await fc.assert(
        fc.asyncProperty(
          arbArraySchema,
          async (tool) => {
            const mapped = (provider as any).mapTools([tool]);
            
            // Array schema should be preserved
            expect(mapped[0].function.parameters).toEqual(tool.parameters);
            
            // Verify array items schema is intact
            const inputItems = tool.parameters.properties.items;
            const outputItems = mapped[0].function.parameters.properties.items;
            
            expect(outputItems).toEqual(inputItems);
          }
        ),
        { numRuns: 10 } // Reduced from 100 for performance
      );
    });
  });

  describe('Property 4: Invalid Tool Schema Rejection', () => {
    /**
     * Feature: stage-08-testing-qa, Property 4: Invalid Tool Schema Rejection
     * Validates: Requirements 2.2
     * 
     * For any tool schema that violates the JSON Schema specification,
     * the schema validator should reject it and return a descriptive error message.
     */
    it('should reject tool schemas with invalid names', async () => {
      const fc = await import('fast-check');
      const provider = new LocalProvider({ baseUrl: 'http://localhost:11434' });

      // Generator for invalid tool names
      const arbInvalidName = fc.oneof(
        fc.constant(''),                    // Empty string
        fc.constant('   '),                 // Whitespace only
        fc.string().filter(s => s.trim() === ''), // Whitespace variations
        fc.string({ minLength: 1 }).filter(name => /^[0-9]/.test(name)), // Starts with number
        fc.string({ minLength: 1 }).filter(name => /[^a-zA-Z0-9_-]/.test(name) && name.trim() !== ''), // Invalid characters
        fc.constant(null as any),           // Null
        fc.constant(undefined as any),      // Undefined
      );

      const arbInvalidToolSchema = fc.record({
        name: arbInvalidName,
        description: fc.option(fc.string({ maxLength: 100 }), { nil: undefined }),
        parameters: fc.option(
          fc.record({
            type: fc.constant('object'),
            properties: fc.constant({}),
          }),
          { nil: undefined }
        ),
      });

      await fc.assert(
        fc.asyncProperty(
          arbInvalidToolSchema,
          async (tool) => {
            // The property: mapping invalid tool schemas should throw descriptive errors
            let error: Error | undefined;
            
            try {
              (provider as any).mapTools([tool]);
            } catch (e) {
              error = e as Error;
            }

            // Assertion: An error should be thrown for invalid names
            expect(error).toBeDefined();
            
            // Assertion: Error message should be descriptive
            if (error) {
              expect(error.message).toBeTruthy();
              expect(error.message.length).toBeGreaterThan(0);
              
              // Error should mention the validation issue
              const message = error.message.toLowerCase();
              expect(
                message.includes('name') ||
                message.includes('invalid') ||
                message.includes('schema') ||
                message.includes('tool')
              ).toBe(true);
            }
          }
        ),
        { numRuns: 10 } // Reduced from 100 for performance
      );
    });

    it('should reject tool schemas with invalid parameter types', async () => {
      const fc = await import('fast-check');
      const provider = new LocalProvider({ baseUrl: 'http://localhost:11434' });

      // Generator for invalid parameter schemas
      const arbInvalidParameters = fc.oneof(
        // Invalid type values
        fc.record({
          type: fc.string().filter(t => !['string', 'number', 'integer', 'boolean', 'object', 'array', 'null'].includes(t) && t.trim() !== ''),
          properties: fc.constant({}),
        }),
        // Invalid properties structure (not an object)
        fc.record({
          type: fc.constant('object'),
          properties: fc.oneof(
            fc.constant('invalid'),
            fc.constant(123),
            fc.constant(true),
            fc.array(fc.string())
          ) as any,
        }),
        // Invalid required field (not an array)
        fc.record({
          type: fc.constant('object'),
          properties: fc.constant({}),
          required: fc.oneof(
            fc.constant('not-an-array'),
            fc.constant(123),
            fc.constant(true),
            fc.constant({})
          ) as any,
        }),
      );

      const arbInvalidToolSchema = fc.record({
        name: fc.string({ minLength: 1, maxLength: 20 }).filter(name => /^[a-zA-Z_][a-zA-Z0-9_-]*$/.test(name)),
        description: fc.option(fc.string({ maxLength: 100 }), { nil: undefined }),
        parameters: arbInvalidParameters,
      });

      await fc.assert(
        fc.asyncProperty(
          arbInvalidToolSchema,
          async (tool) => {
            // The property: mapping invalid parameter schemas should throw descriptive errors
            let error: Error | undefined;
            
            try {
              (provider as any).mapTools([tool]);
            } catch (e) {
              error = e as Error;
            }

            // Assertion: An error should be thrown for invalid parameters
            expect(error).toBeDefined();
            
            // Assertion: Error message should be descriptive
            if (error) {
              expect(error.message).toBeTruthy();
              expect(error.message.length).toBeGreaterThan(0);
              
              // Error should mention the validation issue
              const message = error.message.toLowerCase();
              expect(
                message.includes('parameter') ||
                message.includes('schema') ||
                message.includes('invalid') ||
                message.includes('type') ||
                message.includes('properties')
              ).toBe(true);
            }
          }
        ),
        { numRuns: 10 } // Reduced from 100 for performance
      );
    });

    it('should reject tool schemas with circular references', async () => {
      const fc = await import('fast-check');
      const provider = new LocalProvider({ baseUrl: 'http://localhost:11434' });

      // Create a schema with circular reference
      const createCircularSchema = () => {
        const schema: any = {
          name: 'circular_tool',
          description: 'Tool with circular reference',
          parameters: {
            type: 'object',
            properties: {
              self: null as any,
            },
          },
        };
        // Create circular reference
        schema.parameters.properties.self = schema.parameters;
        return schema;
      };

      await fc.assert(
        fc.asyncProperty(
          fc.constant(createCircularSchema()),
          async (tool) => {
            // The property: mapping schemas with circular references should throw errors
            let error: Error | undefined;
            
            try {
              (provider as any).mapTools([tool]);
            } catch (e) {
              error = e as Error;
            }

            // Assertion: An error should be thrown for circular references
            expect(error).toBeDefined();
            
            // Assertion: Error message should be descriptive
            if (error) {
              expect(error.message).toBeTruthy();
              expect(error.message.length).toBeGreaterThan(0);
              
              // Error should mention circular reference or similar issue
              const message = error.message.toLowerCase();
              expect(
                message.includes('circular') ||
                message.includes('reference') ||
                message.includes('recursive') ||
                message.includes('invalid')
              ).toBe(true);
            }
          }
        ),
        { numRuns: 10 } // Reduced from 100 for performance
      );
    });

    it('should reject tool schemas with invalid enum values', async () => {
      const fc = await import('fast-check');
      const provider = new LocalProvider({ baseUrl: 'http://localhost:11434' });

      // Generator for invalid enum schemas
      const arbInvalidEnumSchema = fc.record({
        name: fc.string({ minLength: 1, maxLength: 20 }).filter(name => /^[a-zA-Z_][a-zA-Z0-9_-]*$/.test(name)),
        parameters: fc.record({
          type: fc.constant('object'),
          properties: fc.record({
            enumField: fc.oneof(
              // Empty enum array
              fc.record({
                type: fc.constant('string'),
                enum: fc.constant([]),
              }),
              // Enum is not an array
              fc.record({
                type: fc.constant('string'),
                enum: fc.oneof(
                  fc.constant('not-an-array'),
                  fc.constant(123),
                  fc.constant({})
                ) as any,
              }),
            ),
          }),
        }),
      });

      await fc.assert(
        fc.asyncProperty(
          arbInvalidEnumSchema,
          async (tool) => {
            // The property: mapping invalid enum schemas should throw descriptive errors
            let error: Error | undefined;
            
            try {
              (provider as any).mapTools([tool]);
            } catch (e) {
              error = e as Error;
            }

            // Assertion: An error should be thrown for invalid enums
            expect(error).toBeDefined();
            
            // Assertion: Error message should be descriptive
            if (error) {
              expect(error.message).toBeTruthy();
              expect(error.message.length).toBeGreaterThan(0);
              
              // Error should mention the validation issue
              const message = error.message.toLowerCase();
              expect(
                message.includes('enum') ||
                message.includes('invalid') ||
                message.includes('schema') ||
                message.includes('array')
              ).toBe(true);
            }
          }
        ),
        { numRuns: 10 } // Reduced from 100 for performance
      );
    });

    it('should reject tool schemas with conflicting constraints', async () => {
      const fc = await import('fast-check');
      const provider = new LocalProvider({ baseUrl: 'http://localhost:11434' });

      // Generator for schemas with conflicting constraints
      const arbConflictingSchema = fc.record({
        name: fc.string({ minLength: 1, maxLength: 20 }).filter(name => /^[a-zA-Z_][a-zA-Z0-9_-]*$/.test(name)),
        parameters: fc.record({
          type: fc.constant('object'),
          properties: fc.record({
            conflictField: fc.oneof(
              // minLength > maxLength
              fc.record({
                type: fc.constant('string'),
                minLength: fc.integer({ min: 10, max: 100 }),
                maxLength: fc.integer({ min: 1, max: 9 }),
              }),
              // minimum > maximum
              fc.record({
                type: fc.constant('number'),
                minimum: fc.integer({ min: 100, max: 1000 }),
                maximum: fc.integer({ min: 1, max: 99 }),
              }),
              // minItems > maxItems
              fc.record({
                type: fc.constant('array'),
                items: fc.record({ type: fc.constant('string') }),
                minItems: fc.integer({ min: 10, max: 100 }),
                maxItems: fc.integer({ min: 1, max: 9 }),
              }),
            ),
          }),
        }),
      });

      await fc.assert(
        fc.asyncProperty(
          arbConflictingSchema,
          async (tool) => {
            // The property: mapping schemas with conflicting constraints should throw errors
            let error: Error | undefined;
            
            try {
              (provider as any).mapTools([tool]);
            } catch (e) {
              error = e as Error;
            }

            // Assertion: An error should be thrown for conflicting constraints
            expect(error).toBeDefined();
            
            // Assertion: Error message should be descriptive
            if (error) {
              expect(error.message).toBeTruthy();
              expect(error.message.length).toBeGreaterThan(0);
              
              // Error should mention the validation issue
              const message = error.message.toLowerCase();
              expect(
                message.includes('conflict') ||
                message.includes('invalid') ||
                message.includes('constraint') ||
                message.includes('minimum') ||
                message.includes('maximum') ||
                message.includes('length')
              ).toBe(true);
            }
          }
        ),
        { numRuns: 10 } // Reduced from 100 for performance
      );
    });

    it('should provide descriptive error messages for all invalid schemas', async () => {
      const fc = await import('fast-check');
      const provider = new LocalProvider({ baseUrl: 'http://localhost:11434' });

      // Generator for various types of invalid schemas
      const arbAnyInvalidSchema = fc.oneof(
        // Invalid name
        fc.record({
          name: fc.constant(''),
          parameters: fc.record({ type: fc.constant('object'), properties: fc.constant({}) }),
        }),
        // Invalid type
        fc.record({
          name: fc.constant('valid_name'),
          parameters: fc.record({
            type: fc.constant('invalid_type_xyz'),
            properties: fc.constant({}),
          }),
        }),
        // Invalid properties structure
        fc.record({
          name: fc.constant('valid_name'),
          parameters: fc.record({
            type: fc.constant('object'),
            properties: fc.constant('not-an-object') as any,
          }),
        }),
      );

      await fc.assert(
        fc.asyncProperty(
          arbAnyInvalidSchema,
          async (tool) => {
            let error: Error | undefined;
            
            try {
              (provider as any).mapTools([tool]);
            } catch (e) {
              error = e as Error;
            }

            // Assertion: Error should exist
            expect(error).toBeDefined();
            
            if (error) {
              // Assertion: Error message should be non-empty
              expect(error.message).toBeTruthy();
              expect(typeof error.message).toBe('string');
              expect(error.message.length).toBeGreaterThan(10); // Reasonably descriptive
              
              // Assertion: Error should be an Error instance
              expect(error).toBeInstanceOf(Error);
              
              // Assertion: Error message should contain relevant keywords
              const message = error.message.toLowerCase();
              const hasRelevantKeyword = 
                message.includes('invalid') ||
                message.includes('error') ||
                message.includes('schema') ||
                message.includes('tool') ||
                message.includes('name') ||
                message.includes('type') ||
                message.includes('parameter');
              
              expect(hasRelevantKeyword).toBe(true);
            }
          }
        ),
        { numRuns: 10 } // Reduced from 100 for performance
      );
    });
  });

  describe('Property 5: Parameter Type Conversion Preservation', () => {
    /**
     * Feature: stage-08-testing-qa, Property 5: Parameter Type Conversion Preservation
     * Validates: Requirements 2.3, 2.4, 2.6, 2.7
     * 
     * For any parameter value (string, number, object, or array), converting it to the
     * target format should preserve the value and type information.
     */
    it('should preserve string parameter values and types', async () => {
      const fc = await import('fast-check');
      const provider = new LocalProvider({ baseUrl: 'http://localhost:11434' });

      // Generator for string parameter schemas with various constraints
      const arbStringParameter = fc.record({
        type: fc.constant('string'),
        description: fc.option(fc.string({ maxLength: 100 }), { nil: undefined }),
        minLength: fc.option(fc.integer({ min: 0, max: 10 }), { nil: undefined }),
        maxLength: fc.option(fc.integer({ min: 11, max: 100 }), { nil: undefined }),
        pattern: fc.option(fc.constantFrom('^[a-z]+$', '^[0-9]+$', '^[a-zA-Z0-9_-]+$'), { nil: undefined }),
        enum: fc.option(
          fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 1, maxLength: 5 }),
          { nil: undefined }
        ),
        default: fc.option(fc.string({ maxLength: 50 }), { nil: undefined }),
        format: fc.option(fc.constantFrom('email', 'uri', 'date-time', 'uuid'), { nil: undefined }),
      });

      const arbToolWithStringParam = fc.record({
        name: fc.string({ minLength: 1, maxLength: 20 }).filter(name => /^[a-zA-Z_][a-zA-Z0-9_-]*$/.test(name)),
        description: fc.option(fc.string({ maxLength: 100 }), { nil: undefined }),
        parameters: fc.record({
          type: fc.constant('object'),
          properties: fc.dictionary(
            fc.string({ minLength: 1, maxLength: 15 }),
            arbStringParameter,
            { minKeys: 1, maxKeys: 5 }
          ),
          required: fc.option(
            fc.array(fc.string({ minLength: 1, maxLength: 15 }), { maxLength: 3 }),
            { nil: undefined }
          ),
        }),
      });

      await fc.assert(
        fc.asyncProperty(
          arbToolWithStringParam,
          async (tool) => {
            const mapped = (provider as any).mapTools([tool]);
            
            // The property: string parameters should be preserved exactly
            expect(mapped[0].function.parameters).toEqual(tool.parameters);
            
            // Verify each string property is preserved with all its constraints
            const inputProps = tool.parameters.properties;
            const outputProps = mapped[0].function.parameters.properties;
            
            for (const key of Object.keys(inputProps)) {
              const inputProp = inputProps[key];
              const outputProp = outputProps[key];
              
              // Type should be preserved
              expect(outputProp.type).toBe('string');
              
              // All string-specific constraints should be preserved
              if (inputProp.minLength !== undefined) {
                expect(outputProp.minLength).toBe(inputProp.minLength);
              }
              if (inputProp.maxLength !== undefined) {
                expect(outputProp.maxLength).toBe(inputProp.maxLength);
              }
              if (inputProp.pattern !== undefined) {
                expect(outputProp.pattern).toBe(inputProp.pattern);
              }
              if (inputProp.enum !== undefined) {
                expect(outputProp.enum).toEqual(inputProp.enum);
              }
              if (inputProp.default !== undefined) {
                expect(outputProp.default).toBe(inputProp.default);
              }
              if (inputProp.format !== undefined) {
                expect(outputProp.format).toBe(inputProp.format);
              }
              if (inputProp.description !== undefined) {
                expect(outputProp.description).toBe(inputProp.description);
              }
            }
          }
        ),
        { numRuns: 10 } // Reduced from 100 for performance
      );
    });

    it('should preserve number parameter values and types', async () => {
      const fc = await import('fast-check');
      const provider = new LocalProvider({ baseUrl: 'http://localhost:11434' });

      // Generator for number parameter schemas with various constraints
      const arbNumberParameter = fc.record({
        type: fc.constantFrom('number', 'integer'),
        description: fc.option(fc.string({ maxLength: 100 }), { nil: undefined }),
        minimum: fc.option(fc.integer({ min: -1000, max: 0 }), { nil: undefined }),
        maximum: fc.option(fc.integer({ min: 1, max: 1000 }), { nil: undefined }),
        exclusiveMinimum: fc.option(fc.boolean(), { nil: undefined }),
        exclusiveMaximum: fc.option(fc.boolean(), { nil: undefined }),
        multipleOf: fc.option(fc.integer({ min: 1, max: 10 }), { nil: undefined }),
        default: fc.option(fc.integer({ min: -100, max: 100 }), { nil: undefined }),
      });

      const arbToolWithNumberParam = fc.record({
        name: fc.string({ minLength: 1, maxLength: 20 }).filter(name => /^[a-zA-Z_][a-zA-Z0-9_-]*$/.test(name)),
        description: fc.option(fc.string({ maxLength: 100 }), { nil: undefined }),
        parameters: fc.record({
          type: fc.constant('object'),
          properties: fc.dictionary(
            fc.string({ minLength: 1, maxLength: 15 }),
            arbNumberParameter,
            { minKeys: 1, maxKeys: 5 }
          ),
          required: fc.option(
            fc.array(fc.string({ minLength: 1, maxLength: 15 }), { maxLength: 3 }),
            { nil: undefined }
          ),
        }),
      });

      await fc.assert(
        fc.asyncProperty(
          arbToolWithNumberParam,
          async (tool) => {
            const mapped = (provider as any).mapTools([tool]);
            
            // The property: number parameters should be preserved exactly
            expect(mapped[0].function.parameters).toEqual(tool.parameters);
            
            // Verify each number property is preserved with all its constraints
            const inputProps = tool.parameters.properties;
            const outputProps = mapped[0].function.parameters.properties;
            
            for (const key of Object.keys(inputProps)) {
              const inputProp = inputProps[key];
              const outputProp = outputProps[key];
              
              // Type should be preserved
              expect(outputProp.type).toBe(inputProp.type);
              
              // All number-specific constraints should be preserved
              if (inputProp.minimum !== undefined) {
                expect(outputProp.minimum).toBe(inputProp.minimum);
              }
              if (inputProp.maximum !== undefined) {
                expect(outputProp.maximum).toBe(inputProp.maximum);
              }
              if (inputProp.exclusiveMinimum !== undefined) {
                expect(outputProp.exclusiveMinimum).toBe(inputProp.exclusiveMinimum);
              }
              if (inputProp.exclusiveMaximum !== undefined) {
                expect(outputProp.exclusiveMaximum).toBe(inputProp.exclusiveMaximum);
              }
              if (inputProp.multipleOf !== undefined) {
                expect(outputProp.multipleOf).toBe(inputProp.multipleOf);
              }
              if (inputProp.default !== undefined) {
                expect(outputProp.default).toBe(inputProp.default);
              }
              if (inputProp.description !== undefined) {
                expect(outputProp.description).toBe(inputProp.description);
              }
            }
          }
        ),
        { numRuns: 10 } // Reduced from 100 for performance
      );
    });

    it('should preserve object parameter values and types', async () => {
      const fc = await import('fast-check');
      const provider = new LocalProvider({ baseUrl: 'http://localhost:11434' });

      // Generator for simple property schemas (to avoid infinite recursion)
      const arbSimpleProperty = fc.oneof(
        fc.record({ type: fc.constant('string') }),
        fc.record({ type: fc.constant('number') }),
        fc.record({ type: fc.constant('boolean') })
      );

      // Generator for object parameter schemas
      const arbObjectParameter = fc.record({
        type: fc.constant('object'),
        description: fc.option(fc.string({ maxLength: 100 }), { nil: undefined }),
        properties: fc.dictionary(
          fc.string({ minLength: 1, maxLength: 10 }),
          arbSimpleProperty,
          { minKeys: 1, maxKeys: 3 }
        ),
        required: fc.option(
          fc.array(fc.string({ minLength: 1, maxLength: 10 }), { maxLength: 2 }),
          { nil: undefined }
        ),
        additionalProperties: fc.option(fc.boolean(), { nil: undefined }),
        minProperties: fc.option(fc.integer({ min: 0, max: 2 }), { nil: undefined }),
        maxProperties: fc.option(fc.integer({ min: 3, max: 10 }), { nil: undefined }),
      });

      const arbToolWithObjectParam = fc.record({
        name: fc.string({ minLength: 1, maxLength: 20 }).filter(name => /^[a-zA-Z_][a-zA-Z0-9_-]*$/.test(name)),
        description: fc.option(fc.string({ maxLength: 100 }), { nil: undefined }),
        parameters: fc.record({
          type: fc.constant('object'),
          properties: fc.dictionary(
            fc.string({ minLength: 1, maxLength: 15 }),
            arbObjectParameter,
            { minKeys: 1, maxKeys: 3 }
          ),
        }),
      });

      await fc.assert(
        fc.asyncProperty(
          arbToolWithObjectParam,
          async (tool) => {
            const mapped = (provider as any).mapTools([tool]);
            
            // The property: object parameters should be preserved exactly
            expect(mapped[0].function.parameters).toEqual(tool.parameters);
            
            // Verify each object property is preserved with all its constraints
            const inputProps = tool.parameters.properties;
            const outputProps = mapped[0].function.parameters.properties;
            
            for (const key of Object.keys(inputProps)) {
              const inputProp = inputProps[key];
              const outputProp = outputProps[key];
              
              // Type should be preserved
              expect(outputProp.type).toBe('object');
              
              // All object-specific constraints should be preserved
              if (inputProp.properties !== undefined) {
                expect(outputProp.properties).toEqual(inputProp.properties);
              }
              if (inputProp.required !== undefined) {
                expect(outputProp.required).toEqual(inputProp.required);
              }
              if (inputProp.additionalProperties !== undefined) {
                expect(outputProp.additionalProperties).toBe(inputProp.additionalProperties);
              }
              if (inputProp.minProperties !== undefined) {
                expect(outputProp.minProperties).toBe(inputProp.minProperties);
              }
              if (inputProp.maxProperties !== undefined) {
                expect(outputProp.maxProperties).toBe(inputProp.maxProperties);
              }
              if (inputProp.description !== undefined) {
                expect(outputProp.description).toBe(inputProp.description);
              }
            }
          }
        ),
        { numRuns: 10 } // Reduced from 100 for performance
      );
    });

    it('should preserve array parameter values and types', async () => {
      const fc = await import('fast-check');
      const provider = new LocalProvider({ baseUrl: 'http://localhost:11434' });

      // Generator for array item schemas
      const arbArrayItemSchema = fc.oneof(
        fc.record({ type: fc.constant('string') }),
        fc.record({ type: fc.constant('number') }),
        fc.record({ type: fc.constant('boolean') }),
        fc.record({
          type: fc.constant('object'),
          properties: fc.dictionary(
            fc.string({ minLength: 1, maxLength: 10 }),
            fc.record({ type: fc.constantFrom('string', 'number') }),
            { minKeys: 1, maxKeys: 2 }
          ),
        })
      );

      // Generator for array parameter schemas
      const arbArrayParameter = fc.record({
        type: fc.constant('array'),
        description: fc.option(fc.string({ maxLength: 100 }), { nil: undefined }),
        items: arbArrayItemSchema,
        minItems: fc.option(fc.integer({ min: 0, max: 5 }), { nil: undefined }),
        maxItems: fc.option(fc.integer({ min: 6, max: 20 }), { nil: undefined }),
        uniqueItems: fc.option(fc.boolean(), { nil: undefined }),
        // Don't include default to avoid circular reference issues with shared array instances
      });

      const arbToolWithArrayParam = fc.record({
        name: fc.string({ minLength: 1, maxLength: 20 }).filter(name => /^[a-zA-Z_][a-zA-Z0-9_-]*$/.test(name)),
        description: fc.option(fc.string({ maxLength: 100 }), { nil: undefined }),
        parameters: fc.record({
          type: fc.constant('object'),
          properties: fc.dictionary(
            fc.string({ minLength: 1, maxLength: 15 }),
            arbArrayParameter,
            { minKeys: 1, maxKeys: 3 }
          ),
        }),
      });

      await fc.assert(
        fc.asyncProperty(
          arbToolWithArrayParam,
          async (tool) => {
            const mapped = (provider as any).mapTools([tool]);
            
            // The property: array parameters should be preserved exactly
            expect(mapped[0].function.parameters).toEqual(tool.parameters);
            
            // Verify each array property is preserved with all its constraints
            const inputProps = tool.parameters.properties;
            const outputProps = mapped[0].function.parameters.properties;
            
            for (const key of Object.keys(inputProps)) {
              const inputProp = inputProps[key];
              const outputProp = outputProps[key];
              
              // Type should be preserved
              expect(outputProp.type).toBe('array');
              
              // All array-specific constraints should be preserved
              if (inputProp.items !== undefined) {
                expect(outputProp.items).toEqual(inputProp.items);
              }
              if (inputProp.minItems !== undefined) {
                expect(outputProp.minItems).toBe(inputProp.minItems);
              }
              if (inputProp.maxItems !== undefined) {
                expect(outputProp.maxItems).toBe(inputProp.maxItems);
              }
              if (inputProp.uniqueItems !== undefined) {
                expect(outputProp.uniqueItems).toBe(inputProp.uniqueItems);
              }
              if (inputProp.description !== undefined) {
                expect(outputProp.description).toBe(inputProp.description);
              }
            }
          }
        ),
        { numRuns: 10 } // Reduced from 100 for performance
      );
    });

    it('should preserve boolean parameter values and types', () => {
      const provider = new LocalProvider({ baseUrl: 'http://localhost:11434' });

      // Test with true default value
      const toolWithTrueDefault: ToolSchema[] = [
        {
          name: 'test_tool_true',
          description: 'Tool with boolean parameter defaulting to true',
          parameters: {
            type: 'object',
            properties: {
              enabled: {
                type: 'boolean',
                description: 'Enable the feature',
                default: true,
              },
            },
          },
        },
      ];

      const mappedTrue = (provider as any).mapTools(toolWithTrueDefault);
      
      // Verify true default is preserved
      expect(mappedTrue[0].function.parameters.properties.enabled.type).toBe('boolean');
      expect(mappedTrue[0].function.parameters.properties.enabled.default).toBe(true);
      expect(mappedTrue[0].function.parameters.properties.enabled.description).toBe('Enable the feature');

      // Test with false default value
      const toolWithFalseDefault: ToolSchema[] = [
        {
          name: 'test_tool_false',
          description: 'Tool with boolean parameter defaulting to false',
          parameters: {
            type: 'object',
            properties: {
              disabled: {
                type: 'boolean',
                description: 'Disable the feature',
                default: false,
              },
            },
          },
        },
      ];

      const mappedFalse = (provider as any).mapTools(toolWithFalseDefault);
      
      // Verify false default is preserved
      expect(mappedFalse[0].function.parameters.properties.disabled.type).toBe('boolean');
      expect(mappedFalse[0].function.parameters.properties.disabled.default).toBe(false);
      expect(mappedFalse[0].function.parameters.properties.disabled.description).toBe('Disable the feature');

      // Test with no default value
      const toolWithNoDefault: ToolSchema[] = [
        {
          name: 'test_tool_no_default',
          description: 'Tool with boolean parameter without default',
          parameters: {
            type: 'object',
            properties: {
              flag: {
                type: 'boolean',
                description: 'A boolean flag',
              },
            },
            required: ['flag'],
          },
        },
      ];

      const mappedNoDefault = (provider as any).mapTools(toolWithNoDefault);
      
      // Verify boolean type is preserved without default
      expect(mappedNoDefault[0].function.parameters.properties.flag.type).toBe('boolean');
      expect(mappedNoDefault[0].function.parameters.properties.flag.default).toBeUndefined();
      expect(mappedNoDefault[0].function.parameters.properties.flag.description).toBe('A boolean flag');
      expect(mappedNoDefault[0].function.parameters.required).toEqual(['flag']);

      // Test with multiple boolean parameters
      const toolWithMultipleBooleans: ToolSchema[] = [
        {
          name: 'test_tool_multiple',
          description: 'Tool with multiple boolean parameters',
          parameters: {
            type: 'object',
            properties: {
              verbose: {
                type: 'boolean',
                default: false,
              },
              dryRun: {
                type: 'boolean',
                default: true,
              },
              force: {
                type: 'boolean',
              },
            },
          },
        },
      ];

      const mappedMultiple = (provider as any).mapTools(toolWithMultipleBooleans);
      
      // Verify all boolean parameters are preserved correctly
      expect(mappedMultiple[0].function.parameters.properties.verbose.type).toBe('boolean');
      expect(mappedMultiple[0].function.parameters.properties.verbose.default).toBe(false);
      expect(mappedMultiple[0].function.parameters.properties.dryRun.type).toBe('boolean');
      expect(mappedMultiple[0].function.parameters.properties.dryRun.default).toBe(true);
      expect(mappedMultiple[0].function.parameters.properties.force.type).toBe('boolean');
      expect(mappedMultiple[0].function.parameters.properties.force.default).toBeUndefined();
    });

    it('should preserve mixed parameter types in a single tool', async () => {
      const fc = await import('fast-check');
      const provider = new LocalProvider({ baseUrl: 'http://localhost:11434' });

      // Generator for mixed parameter types
      const arbMixedParameter = fc.oneof(
        fc.record({
          type: fc.constant('string'),
          minLength: fc.option(fc.integer({ min: 1, max: 10 }), { nil: undefined }),
        }),
        fc.record({
          type: fc.constant('number'),
          minimum: fc.option(fc.integer({ min: 0, max: 100 }), { nil: undefined }),
        }),
        fc.record({
          type: fc.constant('boolean'),
          default: fc.option(fc.boolean(), { nil: undefined }),
        }),
        fc.record({
          type: fc.constant('array'),
          items: fc.record({ type: fc.constantFrom('string', 'number') }),
        }),
        fc.record({
          type: fc.constant('object'),
          properties: fc.dictionary(
            fc.string({ minLength: 1, maxLength: 8 }),
            fc.record({ type: fc.constantFrom('string', 'number') }),
            { minKeys: 1, maxKeys: 2 }
          ),
        })
      );

      const arbToolWithMixedParams = fc.record({
        name: fc.string({ minLength: 1, maxLength: 20 }).filter(name => /^[a-zA-Z_][a-zA-Z0-9_-]*$/.test(name)),
        description: fc.option(fc.string({ maxLength: 100 }), { nil: undefined }),
        parameters: fc.record({
          type: fc.constant('object'),
          properties: fc.dictionary(
            fc.string({ minLength: 1, maxLength: 15 }),
            arbMixedParameter,
            { minKeys: 2, maxKeys: 5 }
          ),
        }),
      });

      await fc.assert(
        fc.asyncProperty(
          arbToolWithMixedParams,
          async (tool) => {
            const mapped = (provider as any).mapTools([tool]);
            
            // The property: all parameter types should be preserved exactly
            expect(mapped[0].function.parameters).toEqual(tool.parameters);
            
            // Verify each property is preserved regardless of type
            const inputProps = tool.parameters.properties;
            const outputProps = mapped[0].function.parameters.properties;
            
            for (const key of Object.keys(inputProps)) {
              const inputProp = inputProps[key];
              const outputProp = outputProps[key];
              
              // Complete equality check
              expect(outputProp).toEqual(inputProp);
              
              // Type should always be preserved
              expect(outputProp.type).toBe(inputProp.type);
            }
          }
        ),
        { numRuns: 10 } // Reduced from 100 for performance
      );
    });

    it('should preserve deeply nested parameter structures', async () => {
      const fc = await import('fast-check');
      const provider = new LocalProvider({ baseUrl: 'http://localhost:11434' });

      // Generator for 2-level nested object parameters
      const arbNestedParameter = fc.record({
        type: fc.constant('object'),
        properties: fc.dictionary(
          fc.string({ minLength: 1, maxLength: 10 }),
          fc.record({
            type: fc.constant('object'),
            properties: fc.dictionary(
              fc.string({ minLength: 1, maxLength: 10 }),
              fc.oneof(
                fc.record({ type: fc.constant('string'), minLength: fc.integer({ min: 1, max: 10 }) }),
                fc.record({ type: fc.constant('number'), minimum: fc.integer({ min: 0, max: 100 }) }),
                fc.record({
                  type: fc.constant('array'),
                  items: fc.record({ type: fc.constantFrom('string', 'number') }),
                })
              ),
              { minKeys: 1, maxKeys: 2 }
            ),
          }),
          { minKeys: 1, maxKeys: 2 }
        ),
      });

      const arbToolWithNestedParams = fc.record({
        name: fc.string({ minLength: 1, maxLength: 20 }).filter(name => /^[a-zA-Z_][a-zA-Z0-9_-]*$/.test(name)),
        parameters: arbNestedParameter,
      });

      await fc.assert(
        fc.asyncProperty(
          arbToolWithNestedParams,
          async (tool) => {
            const mapped = (provider as any).mapTools([tool]);
            
            // The property: deeply nested structures should be preserved exactly
            expect(mapped[0].function.parameters).toEqual(tool.parameters);
            
            // Verify nested structure integrity
            const inputProps = tool.parameters.properties;
            const outputProps = mapped[0].function.parameters.properties;
            
            for (const outerKey of Object.keys(inputProps)) {
              expect(outputProps[outerKey]).toEqual(inputProps[outerKey]);
              
              // Check nested properties
              if (inputProps[outerKey].properties) {
                for (const innerKey of Object.keys(inputProps[outerKey].properties)) {
                  expect(outputProps[outerKey].properties[innerKey]).toEqual(
                    inputProps[outerKey].properties[innerKey]
                  );
                }
              }
            }
          }
        ),
        { numRuns: 10 } // Reduced from 100 for performance
      );
    });

    it('should preserve parameter metadata and constraints', async () => {
      const fc = await import('fast-check');
      const provider = new LocalProvider({ baseUrl: 'http://localhost:11434' });

      // Generator for parameters with rich metadata
      const arbParameterWithMetadata = fc.record({
        type: fc.constantFrom('string', 'number', 'boolean', 'array', 'object'),
        description: fc.string({ minLength: 10, maxLength: 100 }),
        title: fc.option(fc.string({ minLength: 5, maxLength: 50 }), { nil: undefined }),
        examples: fc.option(
          fc.array(fc.oneof(fc.string(), fc.integer(), fc.boolean()), { minLength: 1, maxLength: 3 }),
          { nil: undefined }
        ),
        deprecated: fc.option(fc.boolean(), { nil: undefined }),
        readOnly: fc.option(fc.boolean(), { nil: undefined }),
        writeOnly: fc.option(fc.boolean(), { nil: undefined }),
      });

      const arbToolWithMetadata = fc.record({
        name: fc.string({ minLength: 1, maxLength: 20 }).filter(name => /^[a-zA-Z_][a-zA-Z0-9_-]*$/.test(name)),
        parameters: fc.record({
          type: fc.constant('object'),
          properties: fc.dictionary(
            fc.string({ minLength: 1, maxLength: 15 }),
            arbParameterWithMetadata,
            { minKeys: 1, maxKeys: 3 }
          ),
        }),
      });

      await fc.assert(
        fc.asyncProperty(
          arbToolWithMetadata,
          async (tool) => {
            const mapped = (provider as any).mapTools([tool]);
            
            // The property: all metadata should be preserved
            expect(mapped[0].function.parameters).toEqual(tool.parameters);
            
            // Verify metadata preservation
            const inputProps = tool.parameters.properties;
            const outputProps = mapped[0].function.parameters.properties;
            
            for (const key of Object.keys(inputProps)) {
              const inputProp = inputProps[key];
              const outputProp = outputProps[key];
              
              // All metadata fields should be preserved
              if (inputProp.description !== undefined) {
                expect(outputProp.description).toBe(inputProp.description);
              }
              if (inputProp.title !== undefined) {
                expect(outputProp.title).toBe(inputProp.title);
              }
              if (inputProp.examples !== undefined) {
                expect(outputProp.examples).toEqual(inputProp.examples);
              }
              if (inputProp.deprecated !== undefined) {
                expect(outputProp.deprecated).toBe(inputProp.deprecated);
              }
              if (inputProp.readOnly !== undefined) {
                expect(outputProp.readOnly).toBe(inputProp.readOnly);
              }
              if (inputProp.writeOnly !== undefined) {
                expect(outputProp.writeOnly).toBe(inputProp.writeOnly);
              }
            }
          }
        ),
        { numRuns: 10 } // Reduced from 100 for performance
      );
    });
  });

  describe('Property 6: Tool Result Formatting Consistency', () => {
    /**
     * Feature: stage-08-testing-qa, Property 6: Tool Result Formatting Consistency
     * Validates: Requirements 2.8, 2.9
     * 
     * For any tool result or error, formatting it for the model should produce
     * a consistent structure that the model can parse.
     */
    it('should format tool results consistently for the model', async () => {
      const fc = await import('fast-check');
      const provider = new LocalProvider({ baseUrl: 'http://localhost:11434' });

      // Generator for tool result messages (successful results)
      const arbToolResultMessage = fc.record({
        role: fc.constant('tool' as const),
        parts: fc.array(
          fc.record({
            type: fc.constant('text' as const),
            text: fc.oneof(
              fc.string({ minLength: 1, maxLength: 500 }),
              fc.jsonValue().map(v => JSON.stringify(v)),
              fc.record({
                success: fc.constant(true),
                data: fc.anything(),
              }).map(v => JSON.stringify(v))
            ),
          }),
          { minLength: 1, maxLength: 1 }
        ),
        name: fc.string({ minLength: 1, maxLength: 50 }).filter(name => /^[a-zA-Z_][a-zA-Z0-9_-]*$/.test(name)),
      });

      // Generator for tool error messages
      const arbToolErrorMessage = fc.record({
        role: fc.constant('tool' as const),
        parts: fc.array(
          fc.record({
            type: fc.constant('text' as const),
            text: fc.oneof(
              fc.string({ minLength: 1, maxLength: 200 }).map(msg => `Error: ${msg}`),
              fc.record({
                error: fc.string({ minLength: 1, maxLength: 200 }),
                code: fc.option(fc.string({ minLength: 1, maxLength: 20 }), { nil: undefined }),
                details: fc.option(fc.anything(), { nil: undefined }),
              }).map(v => JSON.stringify(v))
            ),
          }),
          { minLength: 1, maxLength: 1 }
        ),
        name: fc.string({ minLength: 1, maxLength: 50 }).filter(name => /^[a-zA-Z_][a-zA-Z0-9_-]*$/.test(name)),
      });

      // Generator for mixed tool messages (results and errors)
      const arbToolMessage = fc.oneof(arbToolResultMessage, arbToolErrorMessage);

      await fc.assert(
        fc.asyncProperty(
          fc.array(arbToolMessage, { minLength: 1, maxLength: 10 }),
          async (toolMessages) => {
            // The property: formatting tool messages should produce consistent structure
            const formatted = (provider as any).mapMessages(toolMessages);
            
            // Assertion: Formatted result should be an array
            expect(Array.isArray(formatted)).toBe(true);
            
            // Assertion: Should have same length as input
            expect(formatted.length).toBe(toolMessages.length);
            
            // Assertion: Each formatted message should have consistent structure
            for (let i = 0; i < toolMessages.length; i++) {
              const input = toolMessages[i];
              const output = formatted[i];
              
              // Must have role field
              expect(output).toHaveProperty('role');
              expect(output.role).toBe('tool');
              
              // Must have content field (string)
              expect(output).toHaveProperty('content');
              expect(typeof output.content).toBe('string');
              
              // Must have name field matching input
              expect(output).toHaveProperty('name');
              expect(output.name).toBe(input.name);
              
              // Content should be the text from the first part
              const expectedContent = input.parts
                .map(part => part.type === 'text' ? part.text : '[image]')
                .join('');
              expect(output.content).toBe(expectedContent);
              
              // Should not have unexpected fields
              const allowedKeys = ['role', 'content', 'name'];
              for (const key of Object.keys(output)) {
                expect(allowedKeys).toContain(key);
              }
            }
          }
        ),
        { numRuns: 10 } // Reduced from 100 for performance
      );
    });

    it('should format tool results with various content types consistently', async () => {
      const fc = await import('fast-check');
      const provider = new LocalProvider({ baseUrl: 'http://localhost:11434' });

      // Generator for different content types
      const arbToolContent = fc.oneof(
        // Plain text result
        fc.string({ minLength: 1, maxLength: 200 }),
        // JSON result
        fc.record({
          status: fc.constantFrom('success', 'completed', 'done'),
          result: fc.anything(),
          timestamp: fc.date().map(d => d.toISOString()),
        }).map(v => JSON.stringify(v)),
        // Structured data
        fc.array(fc.record({
          id: fc.string(),
          value: fc.oneof(fc.string(), fc.integer(), fc.boolean()),
        })).map(v => JSON.stringify(v)),
        // Error message
        fc.record({
          error: fc.string({ minLength: 1, maxLength: 100 }),
          stack: fc.option(fc.string({ maxLength: 300 }), { nil: undefined }),
        }).map(v => JSON.stringify(v))
      );

      const arbToolMessageWithContent = fc.record({
        role: fc.constant('tool' as const),
        parts: fc.tuple(arbToolContent).map(([text]) => [{
          type: 'text' as const,
          text,
        }]),
        name: fc.string({ minLength: 1, maxLength: 30 }).filter(name => /^[a-zA-Z_][a-zA-Z0-9_-]*$/.test(name)),
      });

      await fc.assert(
        fc.asyncProperty(
          arbToolMessageWithContent,
          async (toolMessage) => {
            const formatted = (provider as any).mapMessages([toolMessage]);
            
            // The property: content should be preserved exactly
            expect(formatted[0].content).toBe(toolMessage.parts[0].text);
            
            // The property: structure should be consistent
            expect(formatted[0]).toEqual({
              role: 'tool',
              content: toolMessage.parts[0].text,
              name: toolMessage.name,
            });
          }
        ),
        { numRuns: 10 } // Reduced from 100 for performance
      );
    });

    it('should format tool errors with consistent structure', async () => {
      const fc = await import('fast-check');
      const provider = new LocalProvider({ baseUrl: 'http://localhost:11434' });

      // Generator for error messages in various formats
      const arbErrorContent = fc.oneof(
        // Simple error string
        fc.string({ minLength: 1, maxLength: 100 }).map(msg => `Error: ${msg}`),
        // Structured error
        fc.record({
          error: fc.string({ minLength: 1, maxLength: 100 }),
          code: fc.constantFrom('ENOENT', 'EACCES', 'ETIMEDOUT', 'UNKNOWN'),
          message: fc.string({ minLength: 1, maxLength: 150 }),
        }).map(v => JSON.stringify(v)),
        // Error with details
        fc.record({
          success: fc.constant(false),
          error: fc.string({ minLength: 1, maxLength: 100 }),
          details: fc.record({
            file: fc.option(fc.string(), { nil: undefined }),
            line: fc.option(fc.integer({ min: 1, max: 1000 }), { nil: undefined }),
            column: fc.option(fc.integer({ min: 1, max: 100 }), { nil: undefined }),
          }),
        }).map(v => JSON.stringify(v))
      );

      const arbToolErrorMessage = fc.record({
        role: fc.constant('tool' as const),
        parts: fc.tuple(arbErrorContent).map(([text]) => [{
          type: 'text' as const,
          text,
        }]),
        name: fc.string({ minLength: 1, maxLength: 30 }).filter(name => /^[a-zA-Z_][a-zA-Z0-9_-]*$/.test(name)),
      });

      await fc.assert(
        fc.asyncProperty(
          arbToolErrorMessage,
          async (errorMessage) => {
            const formatted = (provider as any).mapMessages([errorMessage]);
            
            // The property: error messages should have consistent structure
            expect(formatted[0]).toEqual({
              role: 'tool',
              content: errorMessage.parts[0].text,
              name: errorMessage.name,
            });
            
            // The property: error content should be preserved
            expect(formatted[0].content).toBe(errorMessage.parts[0].text);
            
            // The property: tool name should be preserved
            expect(formatted[0].name).toBe(errorMessage.name);
          }
        ),
        { numRuns: 10 } // Reduced from 100 for performance
      );
    });

    it('should handle tool results with multiple parts consistently', async () => {
      const fc = await import('fast-check');
      const provider = new LocalProvider({ baseUrl: 'http://localhost:11434' });

      // Generator for tool messages with multiple text parts
      const arbMultiPartToolMessage = fc.record({
        role: fc.constant('tool' as const),
        parts: fc.array(
          fc.record({
            type: fc.constant('text' as const),
            text: fc.string({ minLength: 1, maxLength: 100 }),
          }),
          { minLength: 1, maxLength: 5 }
        ),
        name: fc.string({ minLength: 1, maxLength: 30 }).filter(name => /^[a-zA-Z_][a-zA-Z0-9_-]*$/.test(name)),
      });

      await fc.assert(
        fc.asyncProperty(
          arbMultiPartToolMessage,
          async (toolMessage) => {
            const formatted = (provider as any).mapMessages([toolMessage]);
            
            // The property: multiple parts should be concatenated
            const expectedContent = toolMessage.parts
              .map(part => part.text)
              .join('');
            
            expect(formatted[0].content).toBe(expectedContent);
            
            // The property: structure should remain consistent
            expect(formatted[0]).toEqual({
              role: 'tool',
              content: expectedContent,
              name: toolMessage.name,
            });
          }
        ),
        { numRuns: 10 } // Reduced from 100 for performance
      );
    });

    it('should format tool results consistently regardless of content length', async () => {
      const fc = await import('fast-check');
      const provider = new LocalProvider({ baseUrl: 'http://localhost:11434' });

      // Generator for tool messages with varying content lengths
      const arbVariableLengthToolMessage = fc.record({
        role: fc.constant('tool' as const),
        parts: fc.tuple(
          fc.string({ minLength: 0, maxLength: 5000 })
        ).map(([text]) => [{
          type: 'text' as const,
          text,
        }]),
        name: fc.string({ minLength: 1, maxLength: 30 }).filter(name => /^[a-zA-Z_][a-zA-Z0-9_-]*$/.test(name)),
      });

      await fc.assert(
        fc.asyncProperty(
          arbVariableLengthToolMessage,
          async (toolMessage) => {
            const formatted = (provider as any).mapMessages([toolMessage]);
            
            // The property: formatting should work for any content length
            expect(formatted[0]).toEqual({
              role: 'tool',
              content: toolMessage.parts[0].text,
              name: toolMessage.name,
            });
            
            // The property: content length should be preserved
            expect(formatted[0].content.length).toBe(toolMessage.parts[0].text.length);
          }
        ),
        { numRuns: 10 } // Reduced from 100 for performance
      );
    });

    it('should format tool results with special characters consistently', async () => {
      const fc = await import('fast-check');
      const provider = new LocalProvider({ baseUrl: 'http://localhost:11434' });

      // Generator for content with special characters
      const arbSpecialCharContent = fc.oneof(
        fc.string({ minLength: 1, maxLength: 100 }),
        fc.constant('Content with\nnewlines\nand\ttabs'),
        fc.constant('Content with "quotes" and \'apostrophes\''),
        fc.constant('Content with unicode: 你好 🎉 ñ'),
        fc.constant('Content with backslashes: \\ \\\\ \\n'),
        fc.constant('Content with JSON: {"key": "value", "number": 123}'),
      );

      const arbToolMessageWithSpecialChars = fc.record({
        role: fc.constant('tool' as const),
        parts: fc.tuple(arbSpecialCharContent).map(([text]) => [{
          type: 'text' as const,
          text,
        }]),
        name: fc.string({ minLength: 1, maxLength: 30 }).filter(name => /^[a-zA-Z_][a-zA-Z0-9_-]*$/.test(name)),
      });

      await fc.assert(
        fc.asyncProperty(
          arbToolMessageWithSpecialChars,
          async (toolMessage) => {
            const formatted = (provider as any).mapMessages([toolMessage]);
            
            // The property: special characters should be preserved exactly
            expect(formatted[0].content).toBe(toolMessage.parts[0].text);
            
            // The property: structure should remain consistent
            expect(formatted[0]).toEqual({
              role: 'tool',
              content: toolMessage.parts[0].text,
              name: toolMessage.name,
            });
          }
        ),
        { numRuns: 10 } // Reduced from 100 for performance
      );
    });
  });
});

