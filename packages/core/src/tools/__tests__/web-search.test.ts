/**
 * Tests for Web Search Tool
 *
 * Property 32: Web Search Result Count
 * *For any* search query with numResults specified, web_search should return at most numResults results.
 * **Validates: Requirements 6.7**
 */

import { describe, it, expect, beforeEach } from 'vitest';
import fc from 'fast-check';
import {
  WebSearchTool,
  WebSearchInvocation,
  SearchProvider,
  SearchResult,
} from '../web-search.js';
import type { MessageBus, ToolContext } from '../types.js';

/**
 * Create a mock message bus for testing
 */
function createMockMessageBus(): MessageBus {
  return {
    requestConfirmation: async () => true,
  } as MessageBus;
}

/**
 * Create a ToolContext from a MessageBus for testing
 */
function createToolContext(messageBus: MessageBus): ToolContext {
  return { messageBus };
}

/**
 * Generate valid search queries for testing
 */
const validQueryArbitrary = fc.stringOf(
  fc.constantFrom(
    'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm',
    'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z',
    'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M',
    'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z',
    '0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
    ' ', '-', '_'
  ),
  { minLength: 1, maxLength: 50 }
).filter(s => s.trim().length > 0);

/**
 * Generate a search result for testing
 */
const searchResultArbitrary: fc.Arbitrary<SearchResult> = fc.record({
  title: fc.string({ minLength: 1, maxLength: 100 }),
  url: fc.webUrl(),
  snippet: fc.string({ minLength: 1, maxLength: 200 }),
});

/**
 * Mock search provider that returns a configurable number of results
 */
class MockSearchProvider implements SearchProvider {
  private results: SearchResult[];

  constructor(results: SearchResult[]) {
    this.results = results;
  }

  async search(_query: string, numResults: number): Promise<SearchResult[]> {
    // Return up to numResults from the available results
    return this.results.slice(0, numResults);
  }
}

/**
 * Mock search provider that always returns more results than requested
 * This tests that the tool properly limits results
 */
class OverflowSearchProvider implements SearchProvider {
  private results: SearchResult[];

  constructor(results: SearchResult[]) {
    this.results = results;
  }

  async search(_query: string, _numResults: number): Promise<SearchResult[]> {
    // Always return ALL results, ignoring numResults
    // The tool should still limit the output
    return this.results;
  }
}

describe('Web Search Tool', () => {
  let messageBus: MessageBus;

  beforeEach(() => {
    messageBus = createMockMessageBus();
  });

  describe('Property 32: Web Search Result Count', () => {
    /**
     * Property 32: Web Search Result Count
     * *For any* search query with numResults specified, web_search should return at most numResults results.
     * **Validates: Requirements 6.7**
     */

    it('should return at most numResults results for any search query', async () => {
      // Feature: stage-03-tools-policy, Property 32: Web Search Result Count
      // **Validates: Requirements 6.7**
      await fc.assert(
        fc.asyncProperty(
          validQueryArbitrary,
          // Generate numResults between 1 and 20
          fc.integer({ min: 1, max: 20 }),
          // Generate more results than numResults to test limiting
          fc.array(searchResultArbitrary, { minLength: 1, maxLength: 50 }),
          async (query, numResults, availableResults) => {
            // Create a provider that returns all available results
            const provider = new OverflowSearchProvider(availableResults);
            const webSearchTool = new WebSearchTool(provider);

            const invocation = webSearchTool.createInvocation(
              { query, numResults },
              createToolContext(messageBus)
            );

            const abortController = new AbortController();
            const result = await invocation.execute(abortController.signal);

            // Should not have an error
            expect(result.error).toBeUndefined();

            // Count the number of results in the formatted output
            // Results are formatted as "N. Title\n   URL\n   Snippet"
            // So we count the numbered entries
            const resultCount = (result.llmContent.match(/^\d+\./gm) || []).length;

            // The result count should be at most numResults
            expect(resultCount).toBeLessThanOrEqual(numResults);

            // If there were enough available results, we should get exactly numResults
            if (availableResults.length >= numResults) {
              expect(resultCount).toBe(numResults);
            } else {
              // Otherwise, we get all available results
              expect(resultCount).toBe(availableResults.length);
            }

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should respect numResults even when provider returns more', async () => {
      // Feature: stage-03-tools-policy, Property 32: Web Search Result Count
      // **Validates: Requirements 6.7**
      await fc.assert(
        fc.asyncProperty(
          validQueryArbitrary,
          fc.integer({ min: 1, max: 10 }),
          // Generate significantly more results than requested
          fc.integer({ min: 15, max: 30 }),
          async (query, numResults, totalResults) => {
            // Generate results
            const results: SearchResult[] = Array.from({ length: totalResults }, (_, i) => ({
              title: `Result ${i + 1}`,
              url: `https://example.com/result${i + 1}`,
              snippet: `Snippet for result ${i + 1}`,
            }));

            const provider = new OverflowSearchProvider(results);
            const webSearchTool = new WebSearchTool(provider);

            const invocation = webSearchTool.createInvocation(
              { query, numResults },
              createToolContext(messageBus)
            );

            const abortController = new AbortController();
            const result = await invocation.execute(abortController.signal);

            // Should not have an error
            expect(result.error).toBeUndefined();

            // Count results
            const resultCount = (result.llmContent.match(/^\d+\./gm) || []).length;

            // Should be exactly numResults since we have more available
            expect(resultCount).toBe(numResults);

            // Verify the returnDisplay mentions the correct count
            expect(result.returnDisplay).toContain(`${numResults} result`);

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return fewer results when provider has less than numResults', async () => {
      // Feature: stage-03-tools-policy, Property 32: Web Search Result Count
      // **Validates: Requirements 6.7**
      await fc.assert(
        fc.asyncProperty(
          validQueryArbitrary,
          // Request more results than available
          fc.integer({ min: 10, max: 20 }),
          // But only have a few available
          fc.integer({ min: 1, max: 5 }),
          async (query, numResults, availableCount) => {
            // Generate fewer results than requested
            const results: SearchResult[] = Array.from({ length: availableCount }, (_, i) => ({
              title: `Result ${i + 1}`,
              url: `https://example.com/result${i + 1}`,
              snippet: `Snippet for result ${i + 1}`,
            }));

            const provider = new MockSearchProvider(results);
            const webSearchTool = new WebSearchTool(provider);

            const invocation = webSearchTool.createInvocation(
              { query, numResults },
              createToolContext(messageBus)
            );

            const abortController = new AbortController();
            const result = await invocation.execute(abortController.signal);

            // Should not have an error
            expect(result.error).toBeUndefined();

            // Count results
            const resultCount = (result.llmContent.match(/^\d+\./gm) || []).length;

            // Should return all available results (less than numResults)
            expect(resultCount).toBe(availableCount);
            expect(resultCount).toBeLessThanOrEqual(numResults);

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should use default numResults when not specified', async () => {
      // Feature: stage-03-tools-policy, Property 32: Web Search Result Count
      // **Validates: Requirements 6.7**
      const DEFAULT_NUM_RESULTS = 5;

      await fc.assert(
        fc.asyncProperty(
          validQueryArbitrary,
          // Generate more results than default
          fc.integer({ min: 10, max: 20 }),
          async (query, totalResults) => {
            const results: SearchResult[] = Array.from({ length: totalResults }, (_, i) => ({
              title: `Result ${i + 1}`,
              url: `https://example.com/result${i + 1}`,
              snippet: `Snippet for result ${i + 1}`,
            }));

            const provider = new OverflowSearchProvider(results);
            const webSearchTool = new WebSearchTool(provider);

            // Don't specify numResults
            const invocation = webSearchTool.createInvocation(
              { query },
              createToolContext(messageBus)
            );

            const abortController = new AbortController();
            const result = await invocation.execute(abortController.signal);

            // Should not have an error
            expect(result.error).toBeUndefined();

            // Count results
            const resultCount = (result.llmContent.match(/^\d+\./gm) || []).length;

            // Should use default (5)
            expect(resultCount).toBe(DEFAULT_NUM_RESULTS);

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle numResults of 1 correctly', async () => {
      // Feature: stage-03-tools-policy, Property 32: Web Search Result Count
      // **Validates: Requirements 6.7**
      await fc.assert(
        fc.asyncProperty(
          validQueryArbitrary,
          fc.array(searchResultArbitrary, { minLength: 5, maxLength: 10 }),
          async (query, availableResults) => {
            const provider = new OverflowSearchProvider(availableResults);
            const webSearchTool = new WebSearchTool(provider);

            const invocation = webSearchTool.createInvocation(
              { query, numResults: 1 },
              createToolContext(messageBus)
            );

            const abortController = new AbortController();
            const result = await invocation.execute(abortController.signal);

            // Should not have an error
            expect(result.error).toBeUndefined();

            // Count results
            const resultCount = (result.llmContent.match(/^\d+\./gm) || []).length;

            // Should return exactly 1 result
            expect(resultCount).toBe(1);

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Web Search Tool Invocation Interface', () => {
    it('should provide a description of the search operation', () => {
      const provider = new MockSearchProvider([]);
      const webSearchTool = new WebSearchTool(provider);

      const invocation = webSearchTool.createInvocation(
        { query: 'test query' },
        createToolContext(messageBus)
      );

      const description = invocation.getDescription();

      expect(description).toBeDefined();
      expect(description).toContain('test query');
    });

    it('should return empty tool locations', () => {
      const provider = new MockSearchProvider([]);
      const webSearchTool = new WebSearchTool(provider);

      const invocation = webSearchTool.createInvocation(
        { query: 'test query' },
        createToolContext(messageBus)
      );

      const locations = invocation.toolLocations();

      expect(locations).toBeDefined();
      expect(locations).toHaveLength(0);
    });

    it('should not require confirmation by default', async () => {
      const provider = new MockSearchProvider([]);
      const webSearchTool = new WebSearchTool(provider);

      const invocation = webSearchTool.createInvocation(
        { query: 'test query' },
        createToolContext(messageBus)
      );

      const abortController = new AbortController();
      const confirmationDetails = await invocation.shouldConfirmExecute(
        abortController.signal
      );

      expect(confirmationDetails).toBe(false);
    });
  });

  describe('Web Search Result Formatting', () => {
    it('should format results with numbered entries', async () => {
      const results: SearchResult[] = [
        { title: 'First Result', url: 'https://example.com/1', snippet: 'First snippet' },
        { title: 'Second Result', url: 'https://example.com/2', snippet: 'Second snippet' },
      ];

      const provider = new MockSearchProvider(results);
      const webSearchTool = new WebSearchTool(provider);

      const invocation = webSearchTool.createInvocation(
        { query: 'test', numResults: 10 },
        createToolContext(messageBus)
      );

      const abortController = new AbortController();
      const result = await invocation.execute(abortController.signal);

      expect(result.llmContent).toContain('1. First Result');
      expect(result.llmContent).toContain('https://example.com/1');
      expect(result.llmContent).toContain('First snippet');
      expect(result.llmContent).toContain('2. Second Result');
      expect(result.llmContent).toContain('https://example.com/2');
      expect(result.llmContent).toContain('Second snippet');
    });

    it('should return "No results found" for empty results', async () => {
      const provider = new MockSearchProvider([]);
      const webSearchTool = new WebSearchTool(provider);

      const invocation = webSearchTool.createInvocation(
        { query: 'nonexistent query', numResults: 10 },
        createToolContext(messageBus)
      );

      const abortController = new AbortController();
      const result = await invocation.execute(abortController.signal);

      expect(result.llmContent).toBe('No results found.');
      expect(result.returnDisplay).toContain('0 result');
    });
  });

  describe('Web Search Validation', () => {
    it('should return error for empty query', async () => {
      const provider = new MockSearchProvider([]);
      const webSearchTool = new WebSearchTool(provider);

      const invocation = webSearchTool.createInvocation(
        { query: '' },
        createToolContext(messageBus)
      );

      const abortController = new AbortController();
      const result = await invocation.execute(abortController.signal);

      expect(result.error).toBeDefined();
      expect(result.error?.type).toBe('ValidationError');
      expect(result.error?.message).toContain('empty');
    });

    it('should return error for whitespace-only query', async () => {
      const provider = new MockSearchProvider([]);
      const webSearchTool = new WebSearchTool(provider);

      const invocation = webSearchTool.createInvocation(
        { query: '   ' },
        createToolContext(messageBus)
      );

      const abortController = new AbortController();
      const result = await invocation.execute(abortController.signal);

      expect(result.error).toBeDefined();
      expect(result.error?.type).toBe('ValidationError');
    });

    it('should return error for numResults less than 1', async () => {
      const provider = new MockSearchProvider([]);
      const webSearchTool = new WebSearchTool(provider);

      const invocation = webSearchTool.createInvocation(
        { query: 'test', numResults: 0 },
        createToolContext(messageBus)
      );

      const abortController = new AbortController();
      const result = await invocation.execute(abortController.signal);

      expect(result.error).toBeDefined();
      expect(result.error?.type).toBe('ValidationError');
      expect(result.error?.message).toContain('numResults');
    });
  });

  describe('Web Search Error Handling (Requirement 6.8)', () => {
    /**
     * Unit tests for web search error handling
     * **Validates: Requirements 6.8**
     */

    it('should handle search provider errors gracefully', async () => {
      // Create a provider that throws an error
      const errorProvider: SearchProvider = {
        async search(_query: string, _numResults: number): Promise<SearchResult[]> {
          throw new Error('Search service unavailable');
        },
      };

      const webSearchTool = new WebSearchTool(errorProvider);

      const invocation = webSearchTool.createInvocation(
        { query: 'test query' },
        createToolContext(messageBus)
      );

      const abortController = new AbortController();
      const result = await invocation.execute(abortController.signal);

      expect(result.error).toBeDefined();
      expect(result.error?.type).toBe('SearchError');
      expect(result.error?.message).toContain('Search service unavailable');
      expect(result.llmContent).toBe('');
      expect(result.returnDisplay).toBe('');
    });

    it('should handle network errors from search provider gracefully', async () => {
      const networkErrorProvider: SearchProvider = {
        async search(_query: string, _numResults: number): Promise<SearchResult[]> {
          throw new Error('Network request failed: ECONNREFUSED');
        },
      };

      const webSearchTool = new WebSearchTool(networkErrorProvider);

      const invocation = webSearchTool.createInvocation(
        { query: 'test query' },
        createToolContext(messageBus)
      );

      const abortController = new AbortController();
      const result = await invocation.execute(abortController.signal);

      expect(result.error).toBeDefined();
      expect(result.error?.type).toBe('SearchError');
      expect(result.error?.message).toContain('ECONNREFUSED');
    });

    it('should handle timeout errors from search provider gracefully', async () => {
      const timeoutProvider: SearchProvider = {
        async search(_query: string, _numResults: number): Promise<SearchResult[]> {
          throw new Error('Request timed out');
        },
      };

      const webSearchTool = new WebSearchTool(timeoutProvider);

      const invocation = webSearchTool.createInvocation(
        { query: 'test query' },
        createToolContext(messageBus)
      );

      const abortController = new AbortController();
      const result = await invocation.execute(abortController.signal);

      expect(result.error).toBeDefined();
      expect(result.error?.type).toBe('SearchError');
      expect(result.error?.message).toContain('timed out');
    });

    it('should handle rate limiting errors from search provider gracefully', async () => {
      const rateLimitProvider: SearchProvider = {
        async search(_query: string, _numResults: number): Promise<SearchResult[]> {
          throw new Error('Rate limit exceeded. Please try again later.');
        },
      };

      const webSearchTool = new WebSearchTool(rateLimitProvider);

      const invocation = webSearchTool.createInvocation(
        { query: 'test query' },
        createToolContext(messageBus)
      );

      const abortController = new AbortController();
      const result = await invocation.execute(abortController.signal);

      expect(result.error).toBeDefined();
      expect(result.error?.type).toBe('SearchError');
      expect(result.error?.message).toContain('Rate limit');
    });

    it('should handle errors without message gracefully', async () => {
      const emptyErrorProvider: SearchProvider = {
        async search(_query: string, _numResults: number): Promise<SearchResult[]> {
          throw new Error();
        },
      };

      const webSearchTool = new WebSearchTool(emptyErrorProvider);

      const invocation = webSearchTool.createInvocation(
        { query: 'test query' },
        createToolContext(messageBus)
      );

      const abortController = new AbortController();
      const result = await invocation.execute(abortController.signal);

      expect(result.error).toBeDefined();
      expect(result.error?.type).toBe('SearchError');
      // Should have some message even if original error had none
      expect(typeof result.error?.message).toBe('string');
    });

    it('should handle non-Error objects thrown gracefully', async () => {
      const stringErrorProvider: SearchProvider = {
        async search(_query: string, _numResults: number): Promise<SearchResult[]> {
          throw 'string error';
        },
      };

      const webSearchTool = new WebSearchTool(stringErrorProvider);

      const invocation = webSearchTool.createInvocation(
        { query: 'test query' },
        createToolContext(messageBus)
      );

      const abortController = new AbortController();
      const result = await invocation.execute(abortController.signal);

      expect(result.error).toBeDefined();
      expect(result.error?.type).toBe('SearchError');
    });

    it('should return CancelledError when search is aborted', async () => {
      const provider = new MockSearchProvider([]);
      const webSearchTool = new WebSearchTool(provider);

      // Create an already-aborted signal
      const abortController = new AbortController();
      abortController.abort();

      const invocation = webSearchTool.createInvocation(
        { query: 'test query' },
        createToolContext(messageBus)
      );

      const result = await invocation.execute(abortController.signal);

      expect(result.error).toBeDefined();
      expect(result.error?.type).toBe('CancelledError');
      expect(result.error?.message).toContain('cancelled');
    });
  });
});
