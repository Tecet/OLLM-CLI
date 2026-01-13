/**
 * Tests for MCP Schema Converter
 * 
 * Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { DefaultMCPSchemaConverter } from '../mcpSchemaConverter.js';
import { MCPTool } from '../types.js';

describe('MCPSchemaConverter', () => {
  describe('DefaultMCPSchemaConverter', () => {
    let converter: DefaultMCPSchemaConverter;

    beforeEach(() => {
      converter = new DefaultMCPSchemaConverter();
    });

    it('should be defined', () => {
      expect(converter).toBeDefined();
    });

    describe('convertToolSchema', () => {
      it('should convert basic MCP tool schema to internal format', () => {
        const mcpTool: MCPTool = {
          name: 'test-tool',
          description: 'A test tool',
          inputSchema: {
            type: 'object',
            properties: {
              message: {
                type: 'string',
                description: 'A message',
              },
            },
            required: ['message'],
          },
        };

        const result = converter.convertToolSchema(mcpTool);

        expect(result.name).toBe('test-tool');
        expect(result.description).toBe('A test tool');
        expect(result.parameters).toBeDefined();
        
        const params = result.parameters as Record<string, unknown>;
        expect(params.type).toBe('object');
        expect(params.properties).toBeDefined();
        expect(params.required).toEqual(['message']);
      });

      it('should handle string properties with constraints', () => {
        const mcpTool: MCPTool = {
          name: 'string-tool',
          description: 'Tool with string constraints',
          inputSchema: {
            type: 'object',
            properties: {
              username: {
                type: 'string',
                description: 'Username',
                minLength: 3,
                maxLength: 20,
                pattern: '^[a-zA-Z0-9]+$',
              },
            },
          },
        };

        const result = converter.convertToolSchema(mcpTool);
        const params = result.parameters as Record<string, unknown>;
        const props = params.properties as Record<string, unknown>;
        const username = props.username as Record<string, unknown>;

        expect(username.type).toBe('string');
        expect(username.description).toBe('Username');
        expect(username.minLength).toBe(3);
        expect(username.maxLength).toBe(20);
        expect(username.pattern).toBe('^[a-zA-Z0-9]+$');
      });

      it('should handle number properties with constraints', () => {
        const mcpTool: MCPTool = {
          name: 'number-tool',
          description: 'Tool with number constraints',
          inputSchema: {
            type: 'object',
            properties: {
              age: {
                type: 'number',
                description: 'Age in years',
                minimum: 0,
                maximum: 150,
              },
            },
          },
        };

        const result = converter.convertToolSchema(mcpTool);
        const params = result.parameters as Record<string, unknown>;
        const props = params.properties as Record<string, unknown>;
        const age = props.age as Record<string, unknown>;

        expect(age.type).toBe('number');
        expect(age.description).toBe('Age in years');
        expect(age.minimum).toBe(0);
        expect(age.maximum).toBe(150);
      });

      it('should handle boolean properties', () => {
        const mcpTool: MCPTool = {
          name: 'boolean-tool',
          description: 'Tool with boolean',
          inputSchema: {
            type: 'object',
            properties: {
              enabled: {
                type: 'boolean',
                description: 'Enable feature',
              },
            },
          },
        };

        const result = converter.convertToolSchema(mcpTool);
        const params = result.parameters as Record<string, unknown>;
        const props = params.properties as Record<string, unknown>;
        const enabled = props.enabled as Record<string, unknown>;

        expect(enabled.type).toBe('boolean');
        expect(enabled.description).toBe('Enable feature');
      });

      it('should handle array properties', () => {
        const mcpTool: MCPTool = {
          name: 'array-tool',
          description: 'Tool with array',
          inputSchema: {
            type: 'object',
            properties: {
              tags: {
                type: 'array',
                description: 'List of tags',
                items: {
                  type: 'string',
                },
              },
            },
          },
        };

        const result = converter.convertToolSchema(mcpTool);
        const params = result.parameters as Record<string, unknown>;
        const props = params.properties as Record<string, unknown>;
        const tags = props.tags as Record<string, unknown>;

        expect(tags.type).toBe('array');
        expect(tags.description).toBe('List of tags');
        expect(tags.items).toBeDefined();
      });

      it('should handle nested object properties', () => {
        const mcpTool: MCPTool = {
          name: 'nested-tool',
          description: 'Tool with nested objects',
          inputSchema: {
            type: 'object',
            properties: {
              user: {
                type: 'object',
                description: 'User information',
                properties: {
                  name: {
                    type: 'string',
                    description: 'User name',
                  },
                  email: {
                    type: 'string',
                    description: 'User email',
                  },
                },
                required: ['name'],
              },
            },
          },
        };

        const result = converter.convertToolSchema(mcpTool);
        const params = result.parameters as Record<string, unknown>;
        const props = params.properties as Record<string, unknown>;
        const user = props.user as Record<string, unknown>;

        expect(user.type).toBe('object');
        expect(user.description).toBe('User information');
        expect(user.properties).toBeDefined();
        expect(user.required).toEqual(['name']);

        const userProps = user.properties as Record<string, unknown>;
        expect(userProps.name).toBeDefined();
        expect(userProps.email).toBeDefined();
      });

      it('should handle enum properties', () => {
        const mcpTool: MCPTool = {
          name: 'enum-tool',
          description: 'Tool with enum',
          inputSchema: {
            type: 'object',
            properties: {
              status: {
                type: 'string',
                description: 'Status value',
                enum: ['active', 'inactive', 'pending'],
              },
            },
          },
        };

        const result = converter.convertToolSchema(mcpTool);
        const params = result.parameters as Record<string, unknown>;
        const props = params.properties as Record<string, unknown>;
        const status = props.status as Record<string, unknown>;

        expect(status.type).toBe('string');
        expect(status.enum).toEqual(['active', 'inactive', 'pending']);
      });

      it('should handle default values', () => {
        const mcpTool: MCPTool = {
          name: 'default-tool',
          description: 'Tool with defaults',
          inputSchema: {
            type: 'object',
            properties: {
              timeout: {
                type: 'number',
                description: 'Timeout in seconds',
                default: 30,
              },
            },
          },
        };

        const result = converter.convertToolSchema(mcpTool);
        const params = result.parameters as Record<string, unknown>;
        const props = params.properties as Record<string, unknown>;
        const timeout = props.timeout as Record<string, unknown>;

        expect(timeout.default).toBe(30);
      });

      it('should handle empty schema', () => {
        const mcpTool: MCPTool = {
          name: 'empty-tool',
          description: 'Tool with empty schema',
          inputSchema: {},
        };

        const result = converter.convertToolSchema(mcpTool);

        expect(result.name).toBe('empty-tool');
        expect(result.description).toBe('Tool with empty schema');
        expect(result.parameters).toEqual({});
      });

      it('should handle null schema', () => {
        const mcpTool: MCPTool = {
          name: 'null-tool',
          description: 'Tool with null schema',
          inputSchema: null,
        };

        const result = converter.convertToolSchema(mcpTool);

        expect(result.name).toBe('null-tool');
        expect(result.parameters).toEqual({});
      });

      it('should handle complex nested structures', () => {
        const mcpTool: MCPTool = {
          name: 'complex-tool',
          description: 'Tool with complex schema',
          inputSchema: {
            type: 'object',
            properties: {
              config: {
                type: 'object',
                properties: {
                  server: {
                    type: 'object',
                    properties: {
                      host: { type: 'string' },
                      port: { type: 'number' },
                    },
                  },
                  features: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        name: { type: 'string' },
                        enabled: { type: 'boolean' },
                      },
                    },
                  },
                },
              },
            },
          },
        };

        const result = converter.convertToolSchema(mcpTool);
        const params = result.parameters as Record<string, unknown>;
        const props = params.properties as Record<string, unknown>;
        const config = props.config as Record<string, unknown>;

        expect(config.type).toBe('object');
        expect(config.properties).toBeDefined();

        const configProps = config.properties as Record<string, unknown>;
        expect(configProps.server).toBeDefined();
        expect(configProps.features).toBeDefined();
      });
    });

    describe('convertArgsToMCP', () => {
      it('should convert simple arguments', () => {
        const args = {
          message: 'Hello',
          count: 42,
          enabled: true,
        };

        const result = converter.convertArgsToMCP(args);

        expect(result).toEqual(args);
        expect(result).not.toBe(args); // Should be a clone
      });

      it('should convert nested arguments', () => {
        const args = {
          user: {
            name: 'John',
            age: 30,
          },
          tags: ['tag1', 'tag2'],
        };

        const result = converter.convertArgsToMCP(args);

        expect(result).toEqual(args);
        expect(result).not.toBe(args); // Should be a clone
      });

      it('should handle empty arguments', () => {
        const args = {};

        const result = converter.convertArgsToMCP(args);

        expect(result).toEqual({});
      });

      it('should handle null values', () => {
        const args = {
          value: null,
        };

        const result = converter.convertArgsToMCP(args);

        expect(result).toEqual(args);
      });

      it('should deep clone arrays', () => {
        const args = {
          items: [1, 2, 3],
          nested: [{ id: 1 }, { id: 2 }],
        };

        const result = converter.convertArgsToMCP(args) as Record<string, unknown>;

        expect(result).toEqual(args);
        expect(result.items).not.toBe(args.items);
        expect(result.nested).not.toBe(args.nested);
      });

      it('should not mutate original arguments', () => {
        const args = {
          user: {
            name: 'John',
          },
        };
        const originalArgs = JSON.parse(JSON.stringify(args));

        converter.convertArgsToMCP(args);

        expect(args).toEqual(originalArgs);
      });
    });

    describe('convertResultFromMCP', () => {
      it('should convert string result', () => {
        const result = 'Success';

        const converted = converter.convertResultFromMCP(result);

        expect(converted).toBe('Success');
      });

      it('should convert number result', () => {
        const result = 42;

        const converted = converter.convertResultFromMCP(result);

        expect(converted).toBe(42);
      });

      it('should convert boolean result', () => {
        const result = true;

        const converted = converter.convertResultFromMCP(result);

        expect(converted).toBe(true);
      });

      it('should convert object result', () => {
        const result = {
          status: 'success',
          data: { id: 123 },
        };

        const converted = converter.convertResultFromMCP(result);

        expect(converted).toEqual(result);
        expect(converted).not.toBe(result); // Should be a clone
      });

      it('should convert array result', () => {
        const result = [1, 2, 3, 4, 5];

        const converted = converter.convertResultFromMCP(result);

        expect(converted).toEqual(result);
        expect(converted).not.toBe(result); // Should be a clone
      });

      it('should convert null result', () => {
        const result = null;

        const converted = converter.convertResultFromMCP(result);

        expect(converted).toBeNull();
      });

      it('should handle nested structures', () => {
        const result = {
          users: [
            { name: 'Alice', age: 30 },
            { name: 'Bob', age: 25 },
          ],
          metadata: {
            total: 2,
            page: 1,
          },
        };

        const converted = converter.convertResultFromMCP(result);

        expect(converted).toEqual(result);
        expect(converted).not.toBe(result); // Should be a clone
      });

      it('should not mutate original result', () => {
        const result = {
          data: {
            value: 123,
          },
        };
        const originalResult = JSON.parse(JSON.stringify(result));

        converter.convertResultFromMCP(result);

        expect(result).toEqual(originalResult);
      });
    });

    describe('round trip conversions', () => {
      it('should preserve data through args round trip', () => {
        const args = {
          message: 'Hello',
          count: 42,
          nested: {
            value: true,
          },
        };

        const mcpArgs = converter.convertArgsToMCP(args);
        const backToInternal = converter.convertArgsToMCP(mcpArgs as Record<string, unknown>);

        expect(backToInternal).toEqual(args);
      });

      it('should preserve data through result round trip', () => {
        const result = {
          status: 'success',
          data: [1, 2, 3],
        };

        const internalResult = converter.convertResultFromMCP(result);
        const backToMCP = converter.convertResultFromMCP(internalResult);

        expect(backToMCP).toEqual(result);
      });
    });
  });
});
