/**
 * DuckDuckGo Search Provider
 * 
 * Provides web search functionality using DuckDuckGo's HTML interface.
 * No API key required - free and unlimited (with reasonable use).
 */

import type { SearchProvider, SearchResult } from '../web-search.js';

/**
 * DuckDuckGo search provider implementation
 * Uses DuckDuckGo's HTML search interface to get results
 */
export class DuckDuckGoSearchProvider implements SearchProvider {
  private readonly baseUrl = 'https://html.duckduckgo.com/html/';
  private readonly userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

  async search(query: string, numResults: number): Promise<SearchResult[]> {
    try {
      console.log(`[DuckDuckGo] Searching for: "${query}" (max ${numResults} results)`);
      
      // Build search URL
      const url = `${this.baseUrl}?q=${encodeURIComponent(query)}`;
      
      // Fetch search results
      const response = await fetch(url, {
        headers: {
          'User-Agent': this.userAgent,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
        },
      });

      if (!response.ok) {
        console.error(`[DuckDuckGo] HTTP error: ${response.status} ${response.statusText}`);
        throw new Error(`DuckDuckGo search failed: ${response.status} ${response.statusText}`);
      }

      const html = await response.text();
      console.log(`[DuckDuckGo] Received HTML response (${html.length} bytes)`);
      
      const results = this.parseResults(html, numResults);
      console.log(`[DuckDuckGo] Parsed ${results.length} results`);
      
      if (results.length > 0) {
        console.log(`[DuckDuckGo] First result: ${results[0].title}`);
      } else {
        console.warn('[DuckDuckGo] No results found - HTML parsing may have failed');
      }
      
      return results;
    } catch (error) {
      console.error('[DuckDuckGo] Search error:', error);
      // Return empty array instead of throwing to allow fallback
      return [];
    }
  }

  /**
   * Parse HTML results from DuckDuckGo
   * Extracts title, URL, and snippet from search result HTML
   */
  private parseResults(html: string, maxResults: number): SearchResult[] {
    const results: SearchResult[] = [];

    try {
      // DuckDuckGo HTML structure (as of 2026):
      // <div class="result">
      //   <h2 class="result__title"><a href="...">Title</a></h2>
      //   <a class="result__snippet">Snippet text</a>
      //   <a class="result__url" href="...">URL</a>
      // </div>

      // Match result blocks
      const resultBlockRegex = /<div[^>]*class="[^"]*result[^"]*"[^>]*>([\s\S]*?)<\/div>/gi;
      let blockMatch;

      while ((blockMatch = resultBlockRegex.exec(html)) !== null && results.length < maxResults) {
        const block = blockMatch[1];

        // Extract title and URL from h2.result__title > a
        const titleMatch = /<h2[^>]*class="[^"]*result__title[^"]*"[^>]*>[\s\S]*?<a[^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>/i.exec(block);
        
        // Extract snippet - try multiple patterns
        let snippetMatch = /<a[^>]*class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>/i.exec(block);
        if (!snippetMatch) {
          // Try alternative: look for any text content after the title
          snippetMatch = /<\/h2>[\s\S]*?<[^>]*>([\s\S]{20,}?)<\//i.exec(block);
        }

        if (titleMatch) {
          const url = this.cleanUrl(titleMatch[1]);
          const title = this.decodeHtml(titleMatch[2].trim());
          const snippet = snippetMatch ? this.decodeHtml(snippetMatch[1].trim()) : '';

          // Filter out DuckDuckGo internal URLs
          if (url && url.startsWith('http') && !url.includes('duckduckgo.com')) {
            results.push({
              title: title || 'No title',
              url,
              snippet: snippet || `Search result for ${title}`,
            });
          }
        }
      }

      // If regex parsing failed, try alternative parsing
      if (results.length === 0) {
        return this.parseResultsAlternative(html, maxResults);
      }

      return results;
    } catch (error) {
      console.error('[DuckDuckGo] Parse error:', error);
      return [];
    }
  }

  /**
   * Alternative parsing method using simpler regex patterns
   * Fallback if main parsing fails
   */
  private parseResultsAlternative(html: string, maxResults: number): SearchResult[] {
    const results: SearchResult[] = [];

    try {
      // Look for any links with titles
      const linkRegex = /<a[^>]*href="(https?:\/\/[^"]+)"[^>]*>([^<]+)<\/a>/gi;
      let match;
      const seen = new Set<string>();

      while ((match = linkRegex.exec(html)) !== null && results.length < maxResults) {
        const url = this.cleanUrl(match[1]);
        const title = this.decodeHtml(match[2].trim());

        // Skip duplicates and invalid URLs
        if (seen.has(url) || !url.startsWith('http') || url.includes('duckduckgo.com')) {
          continue;
        }

        seen.add(url);
        results.push({
          title: title || 'No title',
          url,
          snippet: 'Search result from DuckDuckGo',
        });
      }

      return results;
    } catch (error) {
      console.error('[DuckDuckGo] Alternative parse error:', error);
      return [];
    }
  }

  /**
   * Clean and decode URL from DuckDuckGo redirect
   */
  private cleanUrl(url: string): string {
    try {
      // DuckDuckGo sometimes wraps URLs in redirects
      // Format: //duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com
      if (url.includes('uddg=')) {
        const uddgMatch = /uddg=([^&]+)/.exec(url);
        if (uddgMatch) {
          return decodeURIComponent(uddgMatch[1]);
        }
      }

      // Remove leading // and add https:
      if (url.startsWith('//')) {
        return 'https:' + url;
      }

      return url;
    } catch (_error) {
      return url;
    }
  }

  /**
   * Decode HTML entities
   */
  private decodeHtml(text: string): string {
    return text
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&#x27;/g, "'")
      .replace(/&nbsp;/g, ' ')
      .replace(/<[^>]*>/g, '') // Remove any HTML tags
      .trim();
  }
}
