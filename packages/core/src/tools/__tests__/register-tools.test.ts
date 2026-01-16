/**
 * Tests for built-in tool registration
 */

import { describe, it, expect } from 'vitest';
import { ToolRegistry, registerBuiltInTools } from '../index.js';

describe('registerBuiltInTools', () => {
  it('should register all built-in tools', () => {
    const registry = new ToolRegistry();
    registerBuiltInTools(registry);

    const tools = registry.list();
    const toolNames = tools.map((tool) => tool.name);

    // Verify all expected tools are registered
    expect(toolNames).toContain('read_file');
    expect(toolNames).toContain('read_many_files');
    expect(toolNames).toContain('write_file');
    expect(toolNames).toContain('edit_file');
    expect(toolNames).toContain('glob');
    expect(toolNames).toContain('grep');
    expect(toolNames).toContain('ls');
    expect(toolNames).toContain('shell');
    expect(toolNames).toContain('web_fetch');
    expect(toolNames).toContain('web_search');
    expect(toolNames).toContain('memory');
    expect(toolNames).toContain('write_todos');

    // Verify we have exactly 13 tools
    expect(tools).toHaveLength(13);
  });

  it('should register tools in alphabetical order', () => {
    const registry = new ToolRegistry();
    registerBuiltInTools(registry);

    const tools = registry.list();
    const toolNames = tools.map((tool) => tool.name);

    // Verify alphabetical ordering
    const sortedNames = [...toolNames].sort();
    expect(toolNames).toEqual(sortedNames);
  });

  it('should provide valid schemas for all tools', () => {
    const registry = new ToolRegistry();
    registerBuiltInTools(registry);

    const schemas = registry.getFunctionSchemas();

    // Verify all schemas have required properties
    for (const schema of schemas) {
      expect(schema).toHaveProperty('name');
      expect(schema).toHaveProperty('description');
      expect(schema).toHaveProperty('parameters');
      expect(typeof schema.name).toBe('string');
      expect(typeof schema.description).toBe('string');
      expect(typeof schema.parameters).toBe('object');
    }

    // Verify we have 13 schemas
    expect(schemas).toHaveLength(13);
  });

  it('should allow retrieving individual tools after registration', () => {
    const registry = new ToolRegistry();
    registerBuiltInTools(registry);

    // Test retrieving a few tools
    const readFile = registry.get('read_file');
    expect(readFile).toBeDefined();
    expect(readFile?.name).toBe('read_file');

    const writeFile = registry.get('write_file');
    expect(writeFile).toBeDefined();
    expect(writeFile?.name).toBe('write_file');

    const shell = registry.get('shell');
    expect(shell).toBeDefined();
    expect(shell?.name).toBe('shell');
  });

  it('should allow unregistering tools after registration', () => {
    const registry = new ToolRegistry();
    registerBuiltInTools(registry);

    // Verify tool exists
    expect(registry.get('read_file')).toBeDefined();

    // Unregister it
    registry.unregister('read_file');

    // Verify it's gone
    expect(registry.get('read_file')).toBeUndefined();

    // Verify other tools still exist
    expect(registry.get('write_file')).toBeDefined();
  });
});
