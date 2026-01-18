/**
 * Tests for Tool Filtering Integration
 * 
 * Tests the two-stage filtering:
 * 1. Model capability check (handled by ChatContext)
 * 2. User preference check (handled by ToolRegistry)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import fc from 'fast-check';
import { ToolRegistry, type ToolStateProvider } from '../tool-registry.js';
import type { DeclarativeTool, ToolInvocation, ToolContext } from '../types.js';

/**
 * Create a mock tool for testing
 */
function createMockTool(name: string): DeclarativeTool<any, any> {
  return {
    name,
    displayName: name,
    schema: {
      name,
      description: `Mock tool ${name}`,
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

/**
 * Mock ToolStateProvider for testing
 */
class MockToolStateProvider implements ToolStateProvider {
  private toolStates: Map<string, boolean> = new Map();

  setToolState(toolId: string, enabled: boolean): void {
    this.toolStates.set(toolId, enabled);
  }

  getToolState(toolId: string): boolean {
    // Default to true if not explicitly set
    return this.toolStates.get(toolId) ?? true;
  }
}

describe('Tool Filtering Integration', () => {
  describe('User Preference Filtering', () => {
    it('should filter out disabled tools from getFunctionSchemas()', () => {
      const stateProvider = new MockToolStateProvider();
      const registry = new ToolRegistry(stateProvider);

      // Register three tools
      registry.register(createMockTool('tool-a'));
      registry.register(createMockTool('tool-b'));
      registry.register(createMockTool('tool-c'));

      // Disable tool-b
      stateProvider.setToolState('tool-b', false);

      const schemas = registry.getFunctionSchemas();

      // Should only have tool-a and tool-c
      expect(schemas).toHaveLength(2);
      expect(schemas.map(s => s.name)).toEqual(['tool-a', 'tool-c']);
    });

    it('should include all tools when all are enabled', () => {
      const stateProvider = new MockToolStateProvider();
      const registry = new ToolRegistry(stateProvider);

      // Register three tools
      registry.register(createMockTool('tool-a'));
      registry.register(createMockTool('tool-b'));
      registry.register(createMockTool('tool-c'));

      // All enabled by default
      const schemas = registry.getFunctionSchemas();

      // Should have all three tools
      expect(schemas).toHaveLength(3);
      expect(schemas.map(s => s.name)).toEqual(['tool-a', 'tool-b', 'tool-c']);
    });

    it('should return empty array when all tools are disabled', () => {
      const stateProvider = new MockToolStateProvider();
      const registry = new ToolRegistry(stateProvider);

      // Register three tools
      registry.register(createMockTool('tool-a'));
      registry.register(createMockTool('tool-b'));
      registry.register(createMockTool('tool-c'));

      // Disable all tools
      stateProvider.setToolState('tool-a', false);
      stateProvider.setToolState('tool-b', false);
      stateProvider.setToolState('tool-c', false);

      const schemas = registry.getFunctionSchemas();

      // Should be empty
      expect(schemas).toHaveLength(0);
    });

    it('should work without a ToolStateProvider (backward compatibility)', () => {
      const registry = new ToolRegistry(); // No provider

      // Register three tools
      registry.register(createMockTool('tool-a'));
      registry.register(createMockTool('tool-b'));
      registry.register(createMockTool('tool-c'));

      const schemas = registry.getFunctionSchemas();

      // Should include all tools
      expect(schemas).toHaveLength(3);
      expect(schemas.map(s => s.name)).toEqual(['tool-a', 'tool-b', 'tool-c']);
    });
  });

  describe('getEnabledTools() Helper', () => {
    it('should return only enabled tools', () => {
      const stateProvider = new MockToolStateProvider();
      const registry = new ToolRegistry(stateProvider);

      // Register three tools
      registry.register(createMockTool('tool-a'));
      registry.register(createMockTool('tool-b'));
      registry.register(createMockTool('tool-c'));

      // Disable tool-b
      stateProvider.setToolState('tool-b', false);

      const enabledTools = registry.getEnabledTools();

      // Should only have tool-a and tool-c
      expect(enabledTools).toHaveLength(2);
      expect(enabledTools.map(t => t.name)).toEqual(['tool-a', 'tool-c']);
    });

    it('should return all tools when no provider is set', () => {
      const registry = new ToolRegistry(); // No provider

      // Register three tools
      registry.register(createMockTool('tool-a'));
      registry.register(createMockTool('tool-b'));
      registry.register(createMockTool('tool-c'));

      const enabledTools = registry.getEnabledTools();

      // Should have all tools
      expect(enabledTools).toHaveLength(3);
      expect(enabledTools.map(t => t.name)).toEqual(['tool-a', 'tool-b', 'tool-c']);
    });
  });

  describe('Property-Based Tests', () => {
    it('Property: Disabled tools never appear in schemas', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0),
            { minLength: 1, maxLength: 10 }
          ),
          fc.array(fc.boolean(), { minLength: 1, maxLength: 10 }),
          (toolNames, enabledStates) => {
            const uniqueNames = Array.from(new Set(toolNames));
            const stateProvider = new MockToolStateProvider();
            const registry = new ToolRegistry(stateProvider);

            // Register tools and set their states
            uniqueNames.forEach((name, index) => {
              registry.register(createMockTool(name));
              const enabled = enabledStates[index % enabledStates.length];
              stateProvider.setToolState(name, enabled);
            });

            const schemas = registry.getFunctionSchemas();
            const schemaNames = new Set(schemas.map(s => s.name));

            // Verify: No disabled tool appears in schemas
            uniqueNames.forEach((name, index) => {
              const enabled = enabledStates[index % enabledStates.length];
              if (!enabled) {
                expect(schemaNames.has(name)).toBe(false);
              }
            });

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Property: Enabled tools always appear in schemas', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0),
            { minLength: 1, maxLength: 10 }
          ),
          fc.array(fc.boolean(), { minLength: 1, maxLength: 10 }),
          (toolNames, enabledStates) => {
            const uniqueNames = Array.from(new Set(toolNames));
            const stateProvider = new MockToolStateProvider();
            const registry = new ToolRegistry(stateProvider);

            // Register tools and set their states
            uniqueNames.forEach((name, index) => {
              registry.register(createMockTool(name));
              const enabled = enabledStates[index % enabledStates.length];
              stateProvider.setToolState(name, enabled);
            });

            const schemas = registry.getFunctionSchemas();
            const schemaNames = new Set(schemas.map(s => s.name));

            // Verify: All enabled tools appear in schemas
            uniqueNames.forEach((name, index) => {
              const enabled = enabledStates[index % enabledStates.length];
              if (enabled) {
                expect(schemaNames.has(name)).toBe(true);
              }
            });

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Property: Schema count equals enabled tool count', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0),
            { minLength: 1, maxLength: 10 }
          ),
          fc.array(fc.boolean(), { minLength: 1, maxLength: 10 }),
          (toolNames, enabledStates) => {
            const uniqueNames = Array.from(new Set(toolNames));
            const stateProvider = new MockToolStateProvider();
            const registry = new ToolRegistry(stateProvider);

            // Register tools and set their states
            uniqueNames.forEach((name, index) => {
              registry.register(createMockTool(name));
              const enabled = enabledStates[index % enabledStates.length];
              stateProvider.setToolState(name, enabled);
            });

            const schemas = registry.getFunctionSchemas();
            const enabledTools = registry.getEnabledTools();

            // Verify: Schema count equals enabled tool count
            expect(schemas.length).toBe(enabledTools.length);

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
