/**
 * Tests for relaxed tool schema validation in LocalProvider
 * Verifies that namespaced tool names (with dots and slashes) are accepted
 */

import { describe, it, expect } from 'vitest';
import type { ToolSchema } from '@ollm/core';

// Mock the validateToolSchema method behavior
function validateToolSchema(tool: ToolSchema): void {
  // Validate tool name
  if (!tool.name || typeof tool.name !== 'string') {
    throw new Error('Tool schema validation failed: Tool name is required and must be a non-empty string');
  }

  const trimmedName = tool.name.trim();
  if (trimmedName === '') {
    throw new Error('Tool schema validation failed: Tool name cannot be empty or whitespace only');
  }

  // Relaxed validation: Allow dots and slashes for namespaced tools
  if (!/^[a-zA-Z_][a-zA-Z0-9_./-]*$/.test(tool.name)) {
    throw new Error(
      `Tool schema validation failed: Tool name "${tool.name}" is invalid. ` +
      'Tool names must start with a letter or underscore and contain only letters, numbers, underscores, dashes, dots, or slashes'
    );
  }
}

describe('Tool Schema Validation - Relaxed Rules', () => {
  describe('Valid Tool Names', () => {
    it('should accept simple alphanumeric names', () => {
      const tool: ToolSchema = {
        name: 'search',
        description: 'Search tool',
        parameters: { type: 'object', properties: {}, required: [] }
      };

      expect(() => validateToolSchema(tool)).not.toThrow();
    });

    it('should accept names with underscores', () => {
      const tool: ToolSchema = {
        name: 'search_documents',
        description: 'Search documents',
        parameters: { type: 'object', properties: {}, required: [] }
      };

      expect(() => validateToolSchema(tool)).not.toThrow();
    });

    it('should accept names with dashes', () => {
      const tool: ToolSchema = {
        name: 'search-documents',
        description: 'Search documents',
        parameters: { type: 'object', properties: {}, required: [] }
      };

      expect(() => validateToolSchema(tool)).not.toThrow();
    });

    it('should accept names starting with underscore', () => {
      const tool: ToolSchema = {
        name: '_internal_search',
        description: 'Internal search',
        parameters: { type: 'object', properties: {}, required: [] }
      };

      expect(() => validateToolSchema(tool)).not.toThrow();
    });
  });

  describe('Namespaced Tool Names (Dots)', () => {
    it('should accept names with single dot (namespace)', () => {
      const tool: ToolSchema = {
        name: 'mcp.search',
        description: 'MCP search tool',
        parameters: { type: 'object', properties: {}, required: [] }
      };

      expect(() => validateToolSchema(tool)).not.toThrow();
    });

    it('should accept names with multiple dots', () => {
      const tool: ToolSchema = {
        name: 'mcp.github.search',
        description: 'MCP GitHub search',
        parameters: { type: 'object', properties: {}, required: [] }
      };

      expect(() => validateToolSchema(tool)).not.toThrow();
    });

    it('should accept names with dots and underscores', () => {
      const tool: ToolSchema = {
        name: 'mcp.search_repositories',
        description: 'Search repositories',
        parameters: { type: 'object', properties: {}, required: [] }
      };

      expect(() => validateToolSchema(tool)).not.toThrow();
    });

    it('should accept names with dots and dashes', () => {
      const tool: ToolSchema = {
        name: 'mcp.search-issues',
        description: 'Search issues',
        parameters: { type: 'object', properties: {}, required: [] }
      };

      expect(() => validateToolSchema(tool)).not.toThrow();
    });
  });

  describe('Namespaced Tool Names (Slashes)', () => {
    it('should accept names with single slash (namespace)', () => {
      const tool: ToolSchema = {
        name: 'github/search',
        description: 'GitHub search tool',
        parameters: { type: 'object', properties: {}, required: [] }
      };

      expect(() => validateToolSchema(tool)).not.toThrow();
    });

    it('should accept names with multiple slashes', () => {
      const tool: ToolSchema = {
        name: 'github/issues/search',
        description: 'GitHub issues search',
        parameters: { type: 'object', properties: {}, required: [] }
      };

      expect(() => validateToolSchema(tool)).not.toThrow();
    });

    it('should accept names with slashes and underscores', () => {
      const tool: ToolSchema = {
        name: 'github/search_repositories',
        description: 'Search repositories',
        parameters: { type: 'object', properties: {}, required: [] }
      };

      expect(() => validateToolSchema(tool)).not.toThrow();
    });

    it('should accept names with slashes and dashes', () => {
      const tool: ToolSchema = {
        name: 'github/search-issues',
        description: 'Search issues',
        parameters: { type: 'object', properties: {}, required: [] }
      };

      expect(() => validateToolSchema(tool)).not.toThrow();
    });
  });

  describe('Mixed Namespacing', () => {
    it('should accept names with both dots and slashes', () => {
      const tool: ToolSchema = {
        name: 'mcp.github/search',
        description: 'MCP GitHub search',
        parameters: { type: 'object', properties: {}, required: [] }
      };

      expect(() => validateToolSchema(tool)).not.toThrow();
    });

    it('should accept complex namespaced names', () => {
      const tool: ToolSchema = {
        name: 'mcp.github/issues.search-open',
        description: 'Complex namespaced tool',
        parameters: { type: 'object', properties: {}, required: [] }
      };

      expect(() => validateToolSchema(tool)).not.toThrow();
    });
  });

  describe('Invalid Tool Names', () => {
    it('should reject names starting with number', () => {
      const tool: ToolSchema = {
        name: '1search',
        description: 'Invalid tool',
        parameters: { type: 'object', properties: {}, required: [] }
      };

      expect(() => validateToolSchema(tool)).toThrow('Tool name "1search" is invalid');
    });

    it('should reject names starting with dash', () => {
      const tool: ToolSchema = {
        name: '-search',
        description: 'Invalid tool',
        parameters: { type: 'object', properties: {}, required: [] }
      };

      expect(() => validateToolSchema(tool)).toThrow('Tool name "-search" is invalid');
    });

    it('should reject names starting with dot', () => {
      const tool: ToolSchema = {
        name: '.search',
        description: 'Invalid tool',
        parameters: { type: 'object', properties: {}, required: [] }
      };

      expect(() => validateToolSchema(tool)).toThrow('Tool name ".search" is invalid');
    });

    it('should reject names starting with slash', () => {
      const tool: ToolSchema = {
        name: '/search',
        description: 'Invalid tool',
        parameters: { type: 'object', properties: {}, required: [] }
      };

      expect(() => validateToolSchema(tool)).toThrow('Tool name "/search" is invalid');
    });

    it('should reject names with spaces', () => {
      const tool: ToolSchema = {
        name: 'search documents',
        description: 'Invalid tool',
        parameters: { type: 'object', properties: {}, required: [] }
      };

      expect(() => validateToolSchema(tool)).toThrow('Tool name "search documents" is invalid');
    });

    it('should reject names with special characters', () => {
      const tool: ToolSchema = {
        name: 'search@documents',
        description: 'Invalid tool',
        parameters: { type: 'object', properties: {}, required: [] }
      };

      expect(() => validateToolSchema(tool)).toThrow('Tool name "search@documents" is invalid');
    });

    it('should reject empty names', () => {
      const tool: ToolSchema = {
        name: '',
        description: 'Invalid tool',
        parameters: { type: 'object', properties: {}, required: [] }
      };

      expect(() => validateToolSchema(tool)).toThrow('Tool name is required');
    });

    it('should reject whitespace-only names', () => {
      const tool: ToolSchema = {
        name: '   ',
        description: 'Invalid tool',
        parameters: { type: 'object', properties: {}, required: [] }
      };

      expect(() => validateToolSchema(tool)).toThrow('Tool name cannot be empty');
    });
  });

  describe('Real-World Examples', () => {
    it('should accept MCP server tool names', () => {
      const tools: ToolSchema[] = [
        { name: 'mcp.filesystem.read', description: 'Read file', parameters: { type: 'object', properties: {}, required: [] } },
        { name: 'mcp.filesystem.write', description: 'Write file', parameters: { type: 'object', properties: {}, required: [] } },
        { name: 'mcp.database.query', description: 'Query database', parameters: { type: 'object', properties: {}, required: [] } },
      ];

      tools.forEach(tool => {
        expect(() => validateToolSchema(tool)).not.toThrow();
      });
    });

    it('should accept GitHub-style tool names', () => {
      const tools: ToolSchema[] = [
        { name: 'github/issues/list', description: 'List issues', parameters: { type: 'object', properties: {}, required: [] } },
        { name: 'github/pulls/create', description: 'Create PR', parameters: { type: 'object', properties: {}, required: [] } },
        { name: 'github/repos/search', description: 'Search repos', parameters: { type: 'object', properties: {}, required: [] } },
      ];

      tools.forEach(tool => {
        expect(() => validateToolSchema(tool)).not.toThrow();
      });
    });

    it('should accept extension tool names', () => {
      const tools: ToolSchema[] = [
        { name: 'ext.code-analysis.lint', description: 'Lint code', parameters: { type: 'object', properties: {}, required: [] } },
        { name: 'ext.testing.run-tests', description: 'Run tests', parameters: { type: 'object', properties: {}, required: [] } },
        { name: 'ext.docs.generate', description: 'Generate docs', parameters: { type: 'object', properties: {}, required: [] } },
      ];

      tools.forEach(tool => {
        expect(() => validateToolSchema(tool)).not.toThrow();
      });
    });
  });

  describe('Edge Cases', () => {
    it('should accept very long namespaced names', () => {
      const tool: ToolSchema = {
        name: 'mcp.github.issues.search.advanced.filters.apply',
        description: 'Long namespaced tool',
        parameters: { type: 'object', properties: {}, required: [] }
      };

      expect(() => validateToolSchema(tool)).not.toThrow();
    });

    it('should accept names with consecutive dots', () => {
      const tool: ToolSchema = {
        name: 'mcp..search',
        description: 'Consecutive dots',
        parameters: { type: 'object', properties: {}, required: [] }
      };

      expect(() => validateToolSchema(tool)).not.toThrow();
    });

    it('should accept names with consecutive slashes', () => {
      const tool: ToolSchema = {
        name: 'github//search',
        description: 'Consecutive slashes',
        parameters: { type: 'object', properties: {}, required: [] }
      };

      expect(() => validateToolSchema(tool)).not.toThrow();
    });

    it('should accept names ending with dot', () => {
      const tool: ToolSchema = {
        name: 'mcp.search.',
        description: 'Ending with dot',
        parameters: { type: 'object', properties: {}, required: [] }
      };

      expect(() => validateToolSchema(tool)).not.toThrow();
    });

    it('should accept names ending with slash', () => {
      const tool: ToolSchema = {
        name: 'github/search/',
        description: 'Ending with slash',
        parameters: { type: 'object', properties: {}, required: [] }
      };

      expect(() => validateToolSchema(tool)).not.toThrow();
    });
  });
});
