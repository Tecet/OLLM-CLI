/**
 * Property-Based Tests for MCP Schema Converter
 * 
 * Feature: stage-05-hooks-extensions-mcp
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { DefaultMCPSchemaConverter } from '../mcpSchemaConverter.js';
import { MCPTool } from '../types.js';

describe('MCPSchemaConverter Property Tests', () => {
  // Feature: stage-05-hooks-extensions-mcp, Property 25: MCP Schema Conversion Round Trip
  describe('Property 25: MCP Schema Conversion Round Trip', () => {
    it('for any MCP tool schema, converting to internal format and back should preserve functionality', () => {
      fc.assert(
        fc.property(
          // Generate arbitrary MCP tools with various schema types
          fc.record({
            name: fc.string({ minLength: 1, maxLength: 50 }),
            description: fc.string({ maxLength: 200 }),
            inputSchema: fc.oneof(
              // Simple object schema
              fc.record({
                type: fc.constant('object'),
                properties: fc.dictionary(
                  fc.string({ minLength: 1, maxLength: 20 }),
                  fc.oneof(
                    // String property
                    fc.record({
                      type: fc.constant('string'),
                      description: fc.option(fc.string({ maxLength: 100 }), { nil: undefined }),
                      minLength: fc.option(fc.nat({ max: 10 }), { nil: undefined }),
                      maxLength: fc.option(fc.nat({ max: 100 }), { nil: undefined }),
                    }),
                    // Number property
                    fc.record({
                      type: fc.constant('number'),
                      description: fc.option(fc.string({ maxLength: 100 }), { nil: undefined }),
                      minimum: fc.option(fc.integer({ min: -100, max: 100 }), { nil: undefined }),
                      maximum: fc.option(fc.integer({ min: -100, max: 100 }), { nil: undefined }),
                    }),
                    // Boolean property
                    fc.record({
                      type: fc.constant('boolean'),
                      description: fc.option(fc.string({ maxLength: 100 }), { nil: undefined }),
                    }),
                    // Array property
                    fc.record({
                      type: fc.constant('array'),
                      description: fc.option(fc.string({ maxLength: 100 }), { nil: undefined }),
                      items: fc.record({
                        type: fc.constantFrom('string', 'number', 'boolean'),
                      }),
                    })
                  ),
                  { maxKeys: 5 }
                ),
                required: fc.option(fc.array(fc.string({ minLength: 1, maxLength: 20 }), { maxLength: 3 }), { nil: undefined }),
              }),
              // Empty schema
              fc.constant({}),
              // Null schema
              fc.constant(null)
            ),
          }),
          // Generate arbitrary arguments
          fc.dictionary(
            fc.string({ minLength: 1, maxLength: 20 }).filter(key => 
              key !== '__proto__' && key !== 'constructor' && key !== 'prototype'
            ),
            fc.oneof(
              fc.string({ maxLength: 50 }),
              fc.integer({ min: -1000, max: 1000 }),
              fc.boolean(),
              fc.array(fc.string({ maxLength: 20 }), { maxLength: 5 }),
              fc.constant(null)
            ),
            { maxKeys: 5 }
          ),
          // Generate arbitrary results
          fc.oneof(
            fc.string({ maxLength: 100 }),
            fc.integer({ min: -1000, max: 1000 }),
            fc.boolean(),
            fc.array(fc.string({ maxLength: 50 }), { maxLength: 5 }),
            fc.record({
              status: fc.constantFrom('success', 'error'),
              data: fc.string({ maxLength: 100 }),
            }),
            fc.constant(null)
          ),
          (mcpTool: MCPTool, args: Record<string, unknown>, result: unknown) => {
            // Skip if inputSchema is null or undefined
            if (!mcpTool.inputSchema) {
              return true;
            }

            const converter = new DefaultMCPSchemaConverter();

            // Convert MCP tool schema to internal format
            const internalSchema = converter.convertToolSchema(mcpTool);

            // Verify basic schema properties are preserved
            expect(internalSchema.name).toBe(mcpTool.name);
            expect(internalSchema.description).toBe(mcpTool.description);
            expect(internalSchema.parameters).toBeDefined();

            // Convert args to MCP format
            const mcpArgs = converter.convertArgsToMCP(args);

            // Verify args conversion preserves data
            expect(mcpArgs).toEqual(args);

            // Verify args are deeply cloned (not same reference)
            if (typeof args === 'object' && args !== null) {
              expect(mcpArgs).not.toBe(args);
            }

            // Convert result from MCP format
            const internalResult = converter.convertResultFromMCP(result);

            // Verify result conversion preserves data
            expect(internalResult).toEqual(result);

            // Verify result is deeply cloned (not same reference)
            if (typeof result === 'object' && result !== null) {
              expect(internalResult).not.toBe(result);
            }

            // Round trip test: args -> MCP -> internal should equal original
            const roundTripArgs = converter.convertArgsToMCP(args);
            expect(roundTripArgs).toEqual(args);

            // Round trip test: result -> internal -> MCP should equal original
            const roundTripResult = converter.convertResultFromMCP(result);
            expect(roundTripResult).toEqual(result);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('for any MCP tool with nested object schema, conversion should preserve structure', () => {
      fc.assert(
        fc.property(
          fc.record({
            name: fc.string({ minLength: 1, maxLength: 50 }),
            description: fc.string({ maxLength: 200 }),
            inputSchema: fc.record({
              type: fc.constant('object'),
              properties: fc.record({
                user: fc.record({
                  type: fc.constant('object'),
                  properties: fc.record({
                    name: fc.record({ type: fc.constant('string') }),
                    age: fc.record({ type: fc.constant('number') }),
                  }),
                  required: fc.constant(['name']),
                }),
                tags: fc.record({
                  type: fc.constant('array'),
                  items: fc.record({ type: fc.constant('string') }),
                }),
              }),
            }),
          }),
          (mcpTool: MCPTool) => {
            const converter = new DefaultMCPSchemaConverter();
            const internalSchema = converter.convertToolSchema(mcpTool);

            // Verify nested structure is preserved
            expect(internalSchema.name).toBe(mcpTool.name);
            expect(internalSchema.parameters).toBeDefined();

            const params = internalSchema.parameters as Record<string, unknown>;
            expect(params.type).toBe('object');
            expect(params.properties).toBeDefined();

            const props = params.properties as Record<string, unknown>;
            expect(props.user).toBeDefined();
            expect(props.tags).toBeDefined();

            // Verify nested object structure
            const userProp = props.user as Record<string, unknown>;
            expect(userProp.type).toBe('object');
            expect(userProp.properties).toBeDefined();

            // Verify array structure
            const tagsProp = props.tags as Record<string, unknown>;
            expect(tagsProp.type).toBe('array');
            expect(tagsProp.items).toBeDefined();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('for any arguments object, conversion should not mutate the original', () => {
      fc.assert(
        fc.property(
          fc.dictionary(
            fc.string({ minLength: 1, maxLength: 20 }),
            fc.oneof(
              fc.string({ maxLength: 50 }),
              fc.integer({ min: -1000, max: 1000 }),
              fc.boolean(),
              fc.array(fc.string({ maxLength: 20 }), { maxLength: 5 })
            ),
            { maxKeys: 5 }
          ),
          (args: Record<string, unknown>) => {
            const converter = new DefaultMCPSchemaConverter();
            const originalArgs = JSON.parse(JSON.stringify(args)); // Deep clone for comparison

            // Convert args
            const mcpArgs = converter.convertArgsToMCP(args);

            // Verify original args are not mutated
            expect(args).toEqual(originalArgs);

            // Verify converted args equal original
            expect(mcpArgs).toEqual(args);

            // Verify they are different objects
            if (Object.keys(args).length > 0) {
              expect(mcpArgs).not.toBe(args);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('for any result value, conversion should not mutate the original', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.string({ maxLength: 100 }),
            fc.integer({ min: -1000, max: 1000 }),
            fc.boolean(),
            fc.array(fc.string({ maxLength: 50 }), { maxLength: 5 }),
            fc.record({
              status: fc.constantFrom('success', 'error'),
              data: fc.string({ maxLength: 100 }),
              nested: fc.record({
                value: fc.integer({ min: 0, max: 100 }),
              }),
            })
          ),
          (result: unknown) => {
            const converter = new DefaultMCPSchemaConverter();
            const originalResult = JSON.parse(JSON.stringify(result)); // Deep clone for comparison

            // Convert result
            const internalResult = converter.convertResultFromMCP(result);

            // Verify original result is not mutated
            expect(result).toEqual(originalResult);

            // Verify converted result equals original
            expect(internalResult).toEqual(result);

            // Verify they are different objects (for objects/arrays)
            if (typeof result === 'object' && result !== null) {
              expect(internalResult).not.toBe(result);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
