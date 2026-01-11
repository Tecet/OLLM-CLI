/**
 * Web Search Tool
 *
 * Searches the web and returns formatted search results.
 * Validates: Requirements 6.6, 6.7, 6.8
 */

import type {
  DeclarativeTool,
  ToolInvocation,
  ToolResult,
  ToolCallConfirmationDetails,
  ToolContext,
  ToolSchema,
} from './types.js';

export interface WebSearchParams {
  query: string;
  numResults?: number;
}

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

/**
 * Search provider interface for dependency injection
 */
export interface SearchProvider {
  search(query: string, numResults: number): Promise<SearchResult[]>;
}

/**
 * Default search provider that returns empty results
 * In production, this would be replaced with a real search API
 */
export class DefaultSearchProvider implements SearchProvider {
  async search(_query: string, _numResults: number): Promise<SearchResult[]> {
    // Placeholder - in production, this would call a real search API
    // (e.g., DuckDuckGo, SearXNG, or similar)
    return [];
  }
}

export class WebSearchTool implements DeclarativeTool<WebSearchParams, ToolResult> {
  name = 'web_search';
  displayName = 'Search the Web';
  schema: ToolSchema = {
    name: 'web_search',
    description: 'Search the web for information',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
        numResults: { type: 'number', description: 'Maximum number of results to return (default: 5)' },
      },
      required: ['query'],
    },
  };

  private searchProvider: SearchProvider;

  constructor(searchProvider?: SearchProvider) {
    this.searchProvider = searchProvider ?? new DefaultSearchProvider();
  }

  createInvocation(
    params: WebSearchParams,
    context: ToolContext
  ): ToolInvocation<WebSearchParams, ToolResult> {
    return new WebSearchInvocation(params, this.searchProvider);
  }
}


export class WebSearchInvocation implements ToolInvocation<WebSearchParams, ToolResult> {
  private static readonly DEFAULT_NUM_RESULTS = 5;

  constructor(
    public params: WebSearchParams,
    private searchProvider: SearchProvider
  ) {}

  getDescription(): string {
    return `Search for "${this.params.query}"`;
  }

  toolLocations(): string[] {
    return [];
  }

  async shouldConfirmExecute(
    _abortSignal: AbortSignal
  ): Promise<ToolCallConfirmationDetails | false> {
    return false;
  }

  async execute(
    signal: AbortSignal,
    updateOutput?: (output: string) => void
  ): Promise<ToolResult> {
    const numResults = this.params.numResults ?? WebSearchInvocation.DEFAULT_NUM_RESULTS;

    try {
      // Validate query
      if (!this.params.query || this.params.query.trim().length === 0) {
        return {
          llmContent: '',
          returnDisplay: '',
          error: { message: 'Search query cannot be empty', type: 'ValidationError' },
        };
      }

      // Validate numResults
      if (numResults < 1) {
        return {
          llmContent: '',
          returnDisplay: '',
          error: { message: 'numResults must be at least 1', type: 'ValidationError' },
        };
      }

      // Check for abort before making the request
      if (signal.aborted) {
        return {
          llmContent: '',
          returnDisplay: '',
          error: { message: 'Search cancelled', type: 'CancelledError' },
        };
      }

      // Perform the search
      const results = await this.searchProvider.search(this.params.query, numResults);

      // Ensure we don't return more than numResults
      const limitedResults = results.slice(0, numResults);

      // Format results for display
      const formatted = this.formatResults(limitedResults);

      if (updateOutput) {
        updateOutput(formatted);
      }

      return {
        llmContent: formatted,
        returnDisplay: `Found ${limitedResults.length} result${limitedResults.length !== 1 ? 's' : ''} for "${this.params.query}"`,
      };
    } catch (error) {
      const errorMessage = (error as Error).message || 'Unknown search error';
      return {
        llmContent: '',
        returnDisplay: '',
        error: { message: errorMessage, type: 'SearchError' },
      };
    }
  }

  private formatResults(results: SearchResult[]): string {
    if (results.length === 0) {
      return 'No results found.';
    }

    return results
      .map((r, i) => `${i + 1}. ${r.title}\n   ${r.url}\n   ${r.snippet}`)
      .join('\n\n');
  }
}
