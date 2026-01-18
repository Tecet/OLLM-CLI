/**
 * Tests for Tool Registry
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { ToolRegistry } from '../tool-registry.js';
import type {
  DeclarativeTool,
  ToolInvocation,
  ToolContext,
} from '../types.js';

/**
 * Create a mock tool for testing
 */
function createMockTool(
  name: string,
  displayName?: string,
  description?: string
): DeclarativeTool<any, any> {
  return {
    name,
    displayName: displayName ?? name,
    schema: {
      name,
      description: description ?? `Mock tool ${name}`,
      parameters: {
        type: 'object',
        properties: {},
      },
    },
    createInvocation: (params: any, context: ToolContext) => {
      return {
        params,
        getDescription: () => `Mock invocation of ${name}`,
        toolLocations: () => [],
        shouldConfirmExecute: async () => false,
        execute: async () => ({
          llmContent: 'mock result',
          returnDisplay: 'mock result',
        }),
      } as ToolInvocation<any, any>;
    },
  };
}

describe('Tool Registry', () => {
  describe('Property 1: Tool Registration and Retrieval', () => {
    it('should retrieve the same tool that was registered', () => {
      // Feature: stage-03-tools-policy, Property 1: Tool Registration and Retrieval
      fc.assert(
        fc.property(
          fc
            .string({ minLength: 1, maxLength: 50 })
            .filter((s) => s.trim().length > 0),
          (toolName) => {
            const registry = new ToolRegistry();
            const mockTool = createMockTool(toolName);

            registry.register(mockTool);
            const retrieved = registry.get(toolName);

            // The retrieved tool should be the exact same instance
            expect(retrieved).toBe(mockTool);
            expect(retrieved?.name).toBe(toolName);

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return undefined for non-existent tools', () => {
      // Feature: stage-03-tools-policy, Property 1: Tool Registration and Retrieval
      fc.assert(
        fc.property(
          fc
            .string({ minLength: 1, maxLength: 50 })
            .filter((s) => s.trim().length > 0),
          (toolName) => {
            const registry = new ToolRegistry();

            const retrieved = registry.get(toolName);

            expect(retrieved).toBeUndefined();

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle multiple tool registrations and retrievals', () => {
      // Feature: stage-03-tools-policy, Property 1: Tool Registration and Retrieval
      fc.assert(
        fc.property(
          fc.array(
            fc
              .string({ minLength: 1, maxLength: 50 })
              .filter((s) => s.trim().length > 0),
            { minLength: 1, maxLength: 10 }
          ),
          (toolNames) => {
            const registry = new ToolRegistry();
            const uniqueNames = Array.from(new Set(toolNames));
            const tools = uniqueNames.map((name) => createMockTool(name));

            // Register all tools
            tools.forEach((tool) => registry.register(tool));

            // Verify all tools can be retrieved
            for (let i = 0; i < tools.length; i++) {
              const retrieved = registry.get(uniqueNames[i]);
              expect(retrieved).toBe(tools[i]);
            }

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 2: Tool Replacement', () => {
    it('should replace a tool when registering with the same name', () => {
      // Feature: stage-03-tools-policy, Property 2: Tool Replacement
      fc.assert(
        fc.property(
          fc
            .string({ minLength: 1, maxLength: 50 })
            .filter((s) => s.trim().length > 0),
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.string({ minLength: 1, maxLength: 50 }),
          (toolName, displayName1, displayName2) => {
            const registry = new ToolRegistry();
            const firstTool = createMockTool(toolName, displayName1);
            const secondTool = createMockTool(toolName, displayName2);

            // Register first tool
            registry.register(firstTool);
            const afterFirst = registry.get(toolName);
            expect(afterFirst).toBe(firstTool);

            // Register second tool with same name
            registry.register(secondTool);
            const afterSecond = registry.get(toolName);

            // Should retrieve the second tool, not the first
            expect(afterSecond).toBe(secondTool);
            expect(afterSecond).not.toBe(firstTool);
            expect(afterSecond?.displayName).toBe(displayName2);

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should only have one tool after replacement', () => {
      // Feature: stage-03-tools-policy, Property 2: Tool Replacement
      fc.assert(
        fc.property(
          fc
            .string({ minLength: 1, maxLength: 50 })
            .filter((s) => s.trim().length > 0),
          (toolName) => {
            const registry = new ToolRegistry();
            const firstTool = createMockTool(toolName, 'First');
            const secondTool = createMockTool(toolName, 'Second');

            registry.register(firstTool);
            registry.register(secondTool);

            const allTools = registry.list();

            // Should only have one tool with this name
            const toolsWithName = allTools.filter((t) => t.name === toolName);
            expect(toolsWithName).toHaveLength(1);
            expect(toolsWithName[0]).toBe(secondTool);

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 3: Tool Unregistration', () => {
    it('should remove a tool when unregistered', () => {
      // Feature: stage-03-tools-policy, Property 3: Tool Unregistration
      fc.assert(
        fc.property(
          fc
            .string({ minLength: 1, maxLength: 50 })
            .filter((s) => s.trim().length > 0),
          (toolName) => {
            const registry = new ToolRegistry();
            const mockTool = createMockTool(toolName);

            // Register the tool
            registry.register(mockTool);
            const afterRegister = registry.get(toolName);
            expect(afterRegister).toBe(mockTool);

            // Unregister the tool
            registry.unregister(toolName);
            const afterUnregister = registry.get(toolName);

            // Tool should no longer be retrievable
            expect(afterUnregister).toBeUndefined();

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should not affect other tools when unregistering', () => {
      // Feature: stage-03-tools-policy, Property 3: Tool Unregistration
      fc.assert(
        fc.property(
          fc.array(
            fc
              .string({ minLength: 1, maxLength: 50 })
              .filter((s) => s.trim().length > 0),
            { minLength: 2, maxLength: 10 }
          ),
          (toolNames) => {
            const uniqueNames = Array.from(new Set(toolNames));
            if (uniqueNames.length < 2) return true; // Skip if not enough unique names

            const registry = new ToolRegistry();
            const tools = uniqueNames.map((name) => createMockTool(name));

            // Register all tools
            tools.forEach((tool) => registry.register(tool));

            // Unregister the first tool
            const nameToRemove = uniqueNames[0];
            registry.unregister(nameToRemove);

            // First tool should be gone
            expect(registry.get(nameToRemove)).toBeUndefined();

            // All other tools should still be present
            for (let i = 1; i < uniqueNames.length; i++) {
              const retrieved = registry.get(uniqueNames[i]);
              expect(retrieved).toBe(tools[i]);
            }

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle unregistering non-existent tools gracefully', () => {
      // Feature: stage-03-tools-policy, Property 3: Tool Unregistration
      fc.assert(
        fc.property(
          fc
            .string({ minLength: 1, maxLength: 50 })
            .filter((s) => s.trim().length > 0),
          (toolName) => {
            const registry = new ToolRegistry();

            // Unregister a tool that was never registered
            // Should not throw an error
            expect(() => registry.unregister(toolName)).not.toThrow();

            // Tool should still be undefined
            expect(registry.get(toolName)).toBeUndefined();

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 4: Tool List Ordering and Consistency', () => {
    it('should return tools in alphabetical order by name', () => {
      // Feature: stage-03-tools-policy, Property 4: Tool List Ordering and Consistency
      fc.assert(
        fc.property(
          fc.array(
            fc
              .string({ minLength: 1, maxLength: 50 })
              .filter((s) => s.trim().length > 0),
            { minLength: 1, maxLength: 20 }
          ),
          (toolNames) => {
            const uniqueNames = Array.from(new Set(toolNames));
            const registry = new ToolRegistry();

            // Register all tools
            uniqueNames.forEach((name) => {
              registry.register(createMockTool(name));
            });

            // Get the list
            const toolList = registry.list();

            // Verify alphabetical ordering
            const names = toolList.map((t) => t.name);
            const sortedNames = [...uniqueNames].sort((a, b) =>
              a.localeCompare(b)
            );

            expect(names).toEqual(sortedNames);

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return consistent ordering across multiple calls', () => {
      // Feature: stage-03-tools-policy, Property 4: Tool List Ordering and Consistency
      fc.assert(
        fc.property(
          fc.array(
            fc
              .string({ minLength: 1, maxLength: 50 })
              .filter((s) => s.trim().length > 0),
            { minLength: 1, maxLength: 20 }
          ),
          (toolNames) => {
            const uniqueNames = Array.from(new Set(toolNames));
            const registry = new ToolRegistry();

            // Register all tools
            uniqueNames.forEach((name) => {
              registry.register(createMockTool(name));
            });

            // Call list() multiple times
            const list1 = registry.list();
            const list2 = registry.list();
            const list3 = registry.list();

            // All lists should have the same ordering
            const names1 = list1.map((t) => t.name);
            const names2 = list2.map((t) => t.name);
            const names3 = list3.map((t) => t.name);

            expect(names1).toEqual(names2);
            expect(names2).toEqual(names3);

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return all registered tools', () => {
      // Feature: stage-03-tools-policy, Property 4: Tool List Ordering and Consistency
      fc.assert(
        fc.property(
          fc.array(
            fc
              .string({ minLength: 1, maxLength: 50 })
              .filter((s) => s.trim().length > 0),
            { minLength: 1, maxLength: 20 }
          ),
          (toolNames) => {
            const uniqueNames = Array.from(new Set(toolNames));
            const registry = new ToolRegistry();

            // Register all tools
            uniqueNames.forEach((name) => {
              registry.register(createMockTool(name));
            });

            // Get the list
            const toolList = registry.list();

            // Should have exactly the same number of tools
            expect(toolList).toHaveLength(uniqueNames.length);

            // All registered tools should be in the list
            const listNames = new Set(toolList.map((t) => t.name));
            uniqueNames.forEach((name) => {
              expect(listNames.has(name)).toBe(true);
            });

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 5: Schema Generation Completeness', () => {
    it('should return exactly one schema for each registered tool', () => {
      // Feature: stage-03-tools-policy, Property 5: Schema Generation Completeness
      fc.assert(
        fc.property(
          fc.array(
            fc
              .string({ minLength: 1, maxLength: 50 })
              .filter((s) => s.trim().length > 0),
            { minLength: 1, maxLength: 20 }
          ),
          (toolNames) => {
            const uniqueNames = Array.from(new Set(toolNames));
            const registry = new ToolRegistry();

            // Register all tools
            uniqueNames.forEach((name) => {
              registry.register(createMockTool(name));
            });

            // Get schemas
            const schemas = registry.getFunctionSchemas();

            // Should have exactly one schema per tool
            expect(schemas).toHaveLength(uniqueNames.length);

            // Each schema should correspond to a registered tool
            const schemaNames = schemas.map((s) => s.name);
            const sortedToolNames = [...uniqueNames].sort((a, b) =>
              a.localeCompare(b)
            );

            expect(schemaNames).toEqual(sortedToolNames);

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should preserve all schema fields', () => {
      // Feature: stage-03-tools-policy, Property 5: Schema Generation Completeness
      fc.assert(
        fc.property(
          fc
            .string({ minLength: 1, maxLength: 50 })
            .filter((s) => s.trim().length > 0),
          fc.string({ minLength: 1, maxLength: 100 }),
          (toolName, description) => {
            const registry = new ToolRegistry();
            const mockTool = createMockTool(toolName, toolName, description);

            registry.register(mockTool);

            const schemas = registry.getFunctionSchemas();

            // Should have one schema
            expect(schemas).toHaveLength(1);

            const schema = schemas[0];

            // All fields should be preserved
            expect(schema.name).toBe(toolName);
            expect(schema.description).toBe(description);
            expect(schema.parameters).toBeDefined();
            expect(schema.parameters).toEqual(mockTool.schema.parameters);

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return schemas in alphabetical order', () => {
      // Feature: stage-03-tools-policy, Property 5: Schema Generation Completeness
      fc.assert(
        fc.property(
          fc.array(
            fc
              .string({ minLength: 1, maxLength: 50 })
              .filter((s) => s.trim().length > 0),
            { minLength: 1, maxLength: 20 }
          ),
          (toolNames) => {
            const uniqueNames = Array.from(new Set(toolNames));
            const registry = new ToolRegistry();

            // Register all tools
            uniqueNames.forEach((name) => {
              registry.register(createMockTool(name));
            });

            // Get schemas
            const schemas = registry.getFunctionSchemas();

            // Schema names should be in alphabetical order
            const schemaNames = schemas.map((s) => s.name);
            const sortedNames = [...uniqueNames].sort((a, b) =>
              a.localeCompare(b)
            );

            expect(schemaNames).toEqual(sortedNames);

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Tool Filtering with ToolStateProvider', () => {
    it('should filter tools based on ToolStateProvider in getFunctionSchemas', () => {
      // Feature: stage-06b-tool-support-detection, Task 22.1, 22.2
      fc.assert(
        fc.property(
          fc.array(
            fc
              .string({ minLength: 1, maxLength: 50 })
              .filter((s) => s.trim().length > 0),
            { minLength: 2, maxLength: 10 }
          ),
          (toolNames) => {
            const uniqueNames = Array.from(new Set(toolNames));
            if (uniqueNames.length < 2) return true;

            // Create a mock ToolStateProvider that disables the first tool
            const disabledTool = uniqueNames[0];
            const mockProvider = {
              getToolState: (toolId: string) => toolId !== disabledTool,
            };

            const registry = new ToolRegistry(mockProvider);

            // Register all tools
            uniqueNames.forEach((name) => {
              registry.register(createMockTool(name));
            });

            // Get schemas - should exclude disabled tool
            const schemas = registry.getFunctionSchemas();

            // Should have one less schema than registered tools
            expect(schemas).toHaveLength(uniqueNames.length - 1);

            // Disabled tool should not be in schemas
            const schemaNames = schemas.map((s) => s.name);
            expect(schemaNames).not.toContain(disabledTool);

            // All other tools should be present
            uniqueNames
              .filter((name) => name !== disabledTool)
              .forEach((name) => {
                expect(schemaNames).toContain(name);
              });

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should filter tools based on ToolStateProvider in getEnabledTools', () => {
      // Feature: stage-06b-tool-support-detection, Task 22.3
      fc.assert(
        fc.property(
          fc.array(
            fc
              .string({ minLength: 1, maxLength: 50 })
              .filter((s) => s.trim().length > 0),
            { minLength: 2, maxLength: 10 }
          ),
          (toolNames) => {
            const uniqueNames = Array.from(new Set(toolNames));
            if (uniqueNames.length < 2) return true;

            // Create a mock ToolStateProvider that disables the first tool
            const disabledTool = uniqueNames[0];
            const mockProvider = {
              getToolState: (toolId: string) => toolId !== disabledTool,
            };

            const registry = new ToolRegistry(mockProvider);

            // Register all tools
            uniqueNames.forEach((name) => {
              registry.register(createMockTool(name));
            });

            // Get enabled tools - should exclude disabled tool
            const enabledTools = registry.getEnabledTools();

            // Should have one less tool than registered
            expect(enabledTools).toHaveLength(uniqueNames.length - 1);

            // Disabled tool should not be in enabled tools
            const enabledNames = enabledTools.map((t) => t.name);
            expect(enabledNames).not.toContain(disabledTool);

            // All other tools should be present
            uniqueNames
              .filter((name) => name !== disabledTool)
              .forEach((name) => {
                expect(enabledNames).toContain(name);
              });

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should include all tools when no ToolStateProvider is provided', () => {
      // Feature: stage-06b-tool-support-detection, Task 22.4
      fc.assert(
        fc.property(
          fc.array(
            fc
              .string({ minLength: 1, maxLength: 50 })
              .filter((s) => s.trim().length > 0),
            { minLength: 1, maxLength: 10 }
          ),
          (toolNames) => {
            const uniqueNames = Array.from(new Set(toolNames));

            // Create registry without ToolStateProvider
            const registry = new ToolRegistry();

            // Register all tools
            uniqueNames.forEach((name) => {
              registry.register(createMockTool(name));
            });

            // Get schemas - should include all tools
            const schemas = registry.getFunctionSchemas();
            expect(schemas).toHaveLength(uniqueNames.length);

            // Get enabled tools - should include all tools
            const enabledTools = registry.getEnabledTools();
            expect(enabledTools).toHaveLength(uniqueNames.length);

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should never expose disabled tools to LLM', () => {
      // Feature: stage-06b-tool-support-detection, Task 22.4
      // This property ensures disabled tools are NEVER in the schemas sent to LLM
      fc.assert(
        fc.property(
          fc.array(
            fc
              .string({ minLength: 1, maxLength: 50 })
              .filter((s) => s.trim().length > 0),
            { minLength: 1, maxLength: 10 }
          ),
          fc.array(fc.boolean(), { minLength: 1, maxLength: 10 }),
          (toolNames, enabledStates) => {
            const uniqueNames = Array.from(new Set(toolNames));
            if (uniqueNames.length === 0) return true;

            // Create state map
            const stateMap = new Map<string, boolean>();
            uniqueNames.forEach((name, idx) => {
              stateMap.set(
                name,
                enabledStates[idx % enabledStates.length] ?? true
              );
            });

            // Create mock provider
            const mockProvider = {
              getToolState: (toolId: string) => stateMap.get(toolId) ?? true,
            };

            const registry = new ToolRegistry(mockProvider);

            // Register all tools
            uniqueNames.forEach((name) => {
              registry.register(createMockTool(name));
            });

            // Get schemas
            const schemas = registry.getFunctionSchemas();
            const schemaNames = new Set(schemas.map((s) => s.name));

            // CRITICAL: Verify no disabled tools are in schemas
            uniqueNames.forEach((name) => {
              const isEnabled = stateMap.get(name) ?? true;
              if (!isEnabled) {
                expect(schemaNames.has(name)).toBe(false);
              } else {
                expect(schemaNames.has(name)).toBe(true);
              }
            });

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('createInvocation', () => {
    it('should create a valid invocation for valid parameters', () => {
      const registry = new ToolRegistry();
      const mockTool = createMockTool('test_tool');
      registry.register(mockTool);

      const context = {
        messageBus: {} as MessageBus,
      };

      const result = registry.createInvocation('test_tool', {}, context);

      // Should return an invocation, not an error
      expect(result).toHaveProperty('execute');
      expect(result).toHaveProperty('getDescription');
      expect(result).toHaveProperty('toolLocations');
      expect(result).toHaveProperty('shouldConfirmExecute');
    });

    it('should return validation error for non-existent tool', () => {
      const registry = new ToolRegistry();

      const context = {
        messageBus: {} as MessageBus,
      };

      const result = registry.createInvocation('non_existent', {}, context);

      // Should return a validation error
      expect(result).toHaveProperty('type', 'ValidationError');
      expect(result).toHaveProperty('message');
      expect((result as any).message).toContain('Tool not found');
    });

    it('should return validation error for invalid parameters', () => {
      const registry = new ToolRegistry();
      const mockTool = {
        name: 'test_tool',
        displayName: 'Test Tool',
        schema: {
          name: 'test_tool',
          parameters: {
            type: 'object',
            properties: {
              required_param: { type: 'string' },
            },
            required: ['required_param'],
          },
        },
        createInvocation: (params: any, context: any) => {
          return {
            params,
            getDescription: () => 'Test',
            toolLocations: () => [],
            shouldConfirmExecute: async () => false,
            execute: async () => ({
              llmContent: 'test',
              returnDisplay: 'test',
            }),
          } as any;
        },
      };

      registry.register(mockTool);

      const context = {
        messageBus: {} as MessageBus,
      };

      // Missing required parameter
      const result = registry.createInvocation('test_tool', {}, context);

      // Should return a validation error
      expect(result).toHaveProperty('type', 'ValidationError');
      expect(result).toHaveProperty('message');
      expect((result as any).message).toContain('required_param');
    });

    it('should create invocation when parameters are valid', () => {
      const registry = new ToolRegistry();
      const mockTool = {
        name: 'test_tool',
        displayName: 'Test Tool',
        schema: {
          name: 'test_tool',
          parameters: {
            type: 'object',
            properties: {
              required_param: { type: 'string' },
            },
            required: ['required_param'],
          },
        },
        createInvocation: (params: any, context: any) => {
          return {
            params,
            getDescription: () => 'Test',
            toolLocations: () => [],
            shouldConfirmExecute: async () => false,
            execute: async () => ({
              llmContent: 'test',
              returnDisplay: 'test',
            }),
          } as any;
        },
      };

      registry.register(mockTool);

      const context = {
        messageBus: {} as MessageBus,
      };

      // Valid parameters
      const result = registry.createInvocation(
        'test_tool',
        { required_param: 'value' },
        context
      );

      // Should return an invocation
      expect(result).toHaveProperty('execute');
      expect(result).toHaveProperty('params');
      expect((result as any).params).toEqual({ required_param: 'value' });
    });
  });
});
