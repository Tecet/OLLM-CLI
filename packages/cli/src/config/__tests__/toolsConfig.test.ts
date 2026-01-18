import { describe, it, expect } from 'vitest';
import {
  DEFAULT_TOOLS,
  getToolMetadata,
  getToolsByCategory,
  getAllCategories,
  getCategoryDisplayName,
  type ToolCategory,
} from '../toolsConfig.js';

describe('toolsConfig', () => {
  describe('DEFAULT_TOOLS', () => {
    it('should have exactly 15 tools', () => {
      expect(DEFAULT_TOOLS).toHaveLength(15);
    });

    it('should have all required metadata fields', () => {
      DEFAULT_TOOLS.forEach(tool => {
        expect(tool).toHaveProperty('id');
        expect(tool).toHaveProperty('displayName');
        expect(tool).toHaveProperty('category');
        expect(tool).toHaveProperty('description');
        expect(tool).toHaveProperty('risk');
        expect(tool.id).toBeTruthy();
        expect(tool.displayName).toBeTruthy();
        expect(tool.description).toBeTruthy();
      });
    });

    it('should have unique tool IDs', () => {
      const ids = DEFAULT_TOOLS.map(t => t.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('should have valid risk levels', () => {
      const validRisks = ['low', 'medium', 'high'];
      DEFAULT_TOOLS.forEach(tool => {
        expect(validRisks).toContain(tool.risk);
      });
    });

    it('should have valid categories', () => {
      const validCategories = [
        'file-operations',
        'file-discovery',
        'shell',
        'web',
        'memory',
        'context',
      ];
      DEFAULT_TOOLS.forEach(tool => {
        expect(validCategories).toContain(tool.category);
      });
    });
  });

  describe('getToolMetadata', () => {
    it('should return tool metadata for valid ID', () => {
      const tool = getToolMetadata('read-file');
      expect(tool).toBeDefined();
      expect(tool?.id).toBe('read-file');
      expect(tool?.displayName).toBe('Read File');
    });

    it('should return undefined for invalid ID', () => {
      const tool = getToolMetadata('non-existent-tool');
      expect(tool).toBeUndefined();
    });
  });

  describe('getToolsByCategory', () => {
    it('should return all tools in file-operations category', () => {
      const tools = getToolsByCategory('file-operations');
      expect(tools.length).toBeGreaterThan(0);
      tools.forEach(tool => {
        expect(tool.category).toBe('file-operations');
      });
    });

    it('should return all tools in file-discovery category', () => {
      const tools = getToolsByCategory('file-discovery');
      expect(tools.length).toBeGreaterThan(0);
      tools.forEach(tool => {
        expect(tool.category).toBe('file-discovery');
      });
    });

    it('should return empty array for category with no tools', () => {
      // This shouldn't happen with our current config, but test the behavior
      const tools = getToolsByCategory('non-existent' as ToolCategory);
      expect(tools).toEqual([]);
    });
  });

  describe('getAllCategories', () => {
    it('should return all 6 categories', () => {
      const categories = getAllCategories();
      expect(categories).toHaveLength(6);
      expect(categories).toContain('file-operations');
      expect(categories).toContain('file-discovery');
      expect(categories).toContain('shell');
      expect(categories).toContain('web');
      expect(categories).toContain('memory');
      expect(categories).toContain('context');
    });
  });

  describe('getCategoryDisplayName', () => {
    it('should return correct display names', () => {
      expect(getCategoryDisplayName('file-operations')).toBe('File Operations');
      expect(getCategoryDisplayName('file-discovery')).toBe('File Discovery');
      expect(getCategoryDisplayName('shell')).toBe('Shell');
      expect(getCategoryDisplayName('web')).toBe('Web');
      expect(getCategoryDisplayName('memory')).toBe('Memory');
      expect(getCategoryDisplayName('context')).toBe('Context');
    });
  });

  describe('Tool distribution', () => {
    it('should have tools in all categories', () => {
      const categories = getAllCategories();
      categories.forEach(category => {
        const tools = getToolsByCategory(category);
        expect(tools.length).toBeGreaterThan(0);
      });
    });

    it('should have expected tool counts per category', () => {
      expect(getToolsByCategory('file-operations')).toHaveLength(3);
      expect(getToolsByCategory('file-discovery')).toHaveLength(4);
      expect(getToolsByCategory('shell')).toHaveLength(1);
      expect(getToolsByCategory('web')).toHaveLength(2);
      expect(getToolsByCategory('memory')).toHaveLength(3);
      expect(getToolsByCategory('context')).toHaveLength(2);
    });
  });
});
