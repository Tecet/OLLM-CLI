/**
 * Web Search Tool Tests
 * 
 * Tests for web_search tool and search providers
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

import { WebSearchTool, WebSearchInvocation, type SearchProvider, type SearchResult } from '../web-search.js';

import type { ToolContext } from '../types.js';

// Mock search provider for testing
class MockSearchProvider implements SearchProvider {
  private mockResults: SearchResult[] = [];
  private shouldThrow = false;
  
  setMockResults(results: SearchResult[]) {
    this.mockResults = results;
  }
  
  setShouldThrow(shouldThrow: boolean) {
    this.shouldThrow = shouldThrow;
  }
  
  async search(_query: string, numResults: number): Promise<SearchResult[]> {
    if (this.shouldThrow) {
      throw new Error('Search provider error');
    }
    return this.mockResults.slice(0, numResults);
  }
}

describe('WebSearchTool', () => {
  let tool: WebSearchTool;
  let mockProvider: MockSearchProvider;
  let mockContext: ToolContext;
  
  beforeEach(() => {
    mockProvider = new MockSearchProvider();
    tool = new WebSearchTool(mockProvider);
    mockContext = {
      workingDirectory: '/test',
      sessionId: 'test-session',
    };
  });
  
  describe('Tool Schema', () => {
    it('should have correct name', () => {
      expect(tool.name).toBe('web_search');
    });
    
    it('should have correct display name', () => {
      expect(tool.displayName).toBe('Search the Web');
    });
    
    it('should have query as required parameter', () => {
      expect(tool.schema.parameters.required).toContain('query');
    });
    
    it('should have numResults as optional parameter', () => {
      expect(tool.schema.parameters.required).not.toContain('numResults');
      expect(tool.schema.parameters.properties.numResults).toBeDefined();
    });
    
    it('should emphasize PRIMARY tool in description', () => {
      expect(tool.schema.description).toContain('PRIMARY');
    });
  });
  
  describe('createInvocation', () => {
    it('should create invocation with query', () => {
      const invocation = tool.createInvocation(
        { query: 'test query' },
        mockContext
      );
      
      expect(invocation).toBeInstanceOf(WebSearchInvocation);
      expect(invocation.params.query).toBe('test query');
    });
    
    it('should create invocation with numResults', () => {
      const invocation = tool.createInvocation(
        { query: 'test query', numResults: 10 },
        mockContext
      );
      
      expect(invocation.params.numResults).toBe(10);
    });
  });
});

describe('WebSearchInvocation', () => {
  let mockProvider: MockSearchProvider;
  let abortController: AbortController;
  
  beforeEach(() => {
    mockProvider = new MockSearchProvider();
    abortController = new AbortController();
  });
  
  describe('getDescription', () => {
    it('should return search description', () => {
      const invocation = new WebSearchInvocation(
        { query: 'test query' },
        mockProvider
      );
      
      expect(invocation.getDescription()).toBe('Search for "test query"');
    });
  });
  
  describe('toolLocations', () => {
    it('should return empty array', () => {
      const invocation = new WebSearchInvocation(
        { query: 'test query' },
        mockProvider
      );
      
      expect(invocation.toolLocations()).toEqual([]);
    });
  });
  
  describe('shouldConfirmExecute', () => {
    it('should not require confirmation', async () => {
      const invocation = new WebSearchInvocation(
        { query: 'test query' },
        mockProvider
      );
      
      const result = await invocation.shouldConfirmExecute(abortController.signal);
      expect(result).toBe(false);
    });
  });
  
  describe('execute', () => {
    it('should return search results', async () => {
      const mockResults: SearchResult[] = [
        {
          title: 'Test Result 1',
          url: 'https://example.com/1',
          snippet: 'Test snippet 1',
        },
        {
          title: 'Test Result 2',
          url: 'https://example.com/2',
          snippet: 'Test snippet 2',
        },
      ];
      
      mockProvider.setMockResults(mockResults);
      
      const invocation = new WebSearchInvocation(
        { query: 'test query' },
        mockProvider
      );
      
      const result = await invocation.execute(abortController.signal);
      
      expect(result.error).toBeUndefined();
      expect(result.llmContent).toContain('Test Result 1');
      expect(result.llmContent).toContain('https://example.com/1');
      expect(result.llmContent).toContain('Test snippet 1');
      expect(result.returnDisplay).toContain('Found 2 results');
    });
    
    it('should respect numResults parameter', async () => {
      const mockResults: SearchResult[] = [
        { title: 'Result 1', url: 'https://example.com/1', snippet: 'Snippet 1' },
        { title: 'Result 2', url: 'https://example.com/2', snippet: 'Snippet 2' },
        { title: 'Result 3', url: 'https://example.com/3', snippet: 'Snippet 3' },
      ];
      
      mockProvider.setMockResults(mockResults);
      
      const invocation = new WebSearchInvocation(
        { query: 'test query', numResults: 2 },
        mockProvider
      );
      
      const result = await invocation.execute(abortController.signal);
      
      expect(result.llmContent).toContain('Result 1');
      expect(result.llmContent).toContain('Result 2');
      expect(result.llmContent).not.toContain('Result 3');
      expect(result.returnDisplay).toContain('Found 2 results');
    });
    
    it('should use default numResults of 5', async () => {
      const mockResults: SearchResult[] = Array.from({ length: 10 }, (_, i) => ({
        title: `Result ${i + 1}`,
        url: `https://example.com/${i + 1}`,
        snippet: `Snippet ${i + 1}`,
      }));
      
      mockProvider.setMockResults(mockResults);
      
      const invocation = new WebSearchInvocation(
        { query: 'test query' },
        mockProvider
      );
      
      const result = await invocation.execute(abortController.signal);
      
      expect(result.returnDisplay).toContain('Found 5 results');
    });
    
    it('should handle empty query', async () => {
      const invocation = new WebSearchInvocation(
        { query: '' },
        mockProvider
      );
      
      const result = await invocation.execute(abortController.signal);
      
      expect(result.error).toBeDefined();
      expect(result.error?.type).toBe('ValidationError');
      expect(result.error?.message).toContain('cannot be empty');
    });
    
    it('should handle whitespace-only query', async () => {
      const invocation = new WebSearchInvocation(
        { query: '   ' },
        mockProvider
      );
      
      const result = await invocation.execute(abortController.signal);
      
      expect(result.error).toBeDefined();
      expect(result.error?.type).toBe('ValidationError');
    });
    
    it('should handle invalid numResults', async () => {
      const invocation = new WebSearchInvocation(
        { query: 'test query', numResults: 0 },
        mockProvider
      );
      
      const result = await invocation.execute(abortController.signal);
      
      expect(result.error).toBeDefined();
      expect(result.error?.type).toBe('ValidationError');
      expect(result.error?.message).toContain('must be at least 1');
    });
    
    it('should handle no results', async () => {
      mockProvider.setMockResults([]);
      
      const invocation = new WebSearchInvocation(
        { query: 'test query' },
        mockProvider
      );
      
      const result = await invocation.execute(abortController.signal);
      
      expect(result.error).toBeUndefined();
      expect(result.llmContent).toContain('No results found');
    });
    
    it('should handle search provider errors', async () => {
      mockProvider.setShouldThrow(true);
      
      const invocation = new WebSearchInvocation(
        { query: 'test query' },
        mockProvider
      );
      
      const result = await invocation.execute(abortController.signal);
      
      expect(result.error).toBeDefined();
      expect(result.error?.type).toBe('SearchError');
      expect(result.error?.message).toContain('Search provider error');
    });
    
    it('should handle abort signal', async () => {
      mockProvider.setMockResults([
        { title: 'Result', url: 'https://example.com', snippet: 'Snippet' },
      ]);
      
      abortController.abort();
      
      const invocation = new WebSearchInvocation(
        { query: 'test query' },
        mockProvider
      );
      
      const result = await invocation.execute(abortController.signal);
      
      expect(result.error).toBeDefined();
      expect(result.error?.type).toBe('CancelledError');
    });
    
    it('should call updateOutput callback', async () => {
      const mockResults: SearchResult[] = [
        { title: 'Result', url: 'https://example.com', snippet: 'Snippet' },
      ];
      
      mockProvider.setMockResults(mockResults);
      
      const updateOutput = vi.fn();
      
      const invocation = new WebSearchInvocation(
        { query: 'test query' },
        mockProvider
      );
      
      await invocation.execute(abortController.signal, updateOutput);
      
      expect(updateOutput).toHaveBeenCalledWith(expect.stringContaining('Result'));
    });
    
    it('should format results with DuckDuckGo attribution', async () => {
      const mockResults: SearchResult[] = [
        { title: 'Result', url: 'https://example.com', snippet: 'Snippet' },
      ];
      
      mockProvider.setMockResults(mockResults);
      
      const invocation = new WebSearchInvocation(
        { query: 'test query' },
        mockProvider
      );
      
      const result = await invocation.execute(abortController.signal);
      
      expect(result.llmContent).toContain('Search Results (from DuckDuckGo)');
      expect(result.llmContent).toContain('✓ These are real search results');
    });
    
    it('should handle results without snippets', async () => {
      const mockResults: SearchResult[] = [
        { title: 'Result', url: 'https://example.com', snippet: '' },
      ];
      
      mockProvider.setMockResults(mockResults);
      
      const invocation = new WebSearchInvocation(
        { query: 'test query' },
        mockProvider
      );
      
      const result = await invocation.execute(abortController.signal);
      
      expect(result.llmContent).toContain('Visit the URL for more information');
    });
    
    it('should handle "No description available" snippets', async () => {
      const mockResults: SearchResult[] = [
        { title: 'Result', url: 'https://example.com', snippet: 'No description available' },
      ];
      
      mockProvider.setMockResults(mockResults);
      
      const invocation = new WebSearchInvocation(
        { query: 'test query' },
        mockProvider
      );
      
      const result = await invocation.execute(abortController.signal);
      
      expect(result.llmContent).toContain('Visit the URL for more information');
    });
    
    it('should number results correctly', async () => {
      const mockResults: SearchResult[] = [
        { title: 'First', url: 'https://example.com/1', snippet: 'Snippet 1' },
        { title: 'Second', url: 'https://example.com/2', snippet: 'Snippet 2' },
        { title: 'Third', url: 'https://example.com/3', snippet: 'Snippet 3' },
      ];
      
      mockProvider.setMockResults(mockResults);
      
      const invocation = new WebSearchInvocation(
        { query: 'test query' },
        mockProvider
      );
      
      const result = await invocation.execute(abortController.signal);
      
      expect(result.llmContent).toMatch(/1\.\s+First/);
      expect(result.llmContent).toMatch(/2\.\s+Second/);
      expect(result.llmContent).toMatch(/3\.\s+Third/);
    });
  });
});
