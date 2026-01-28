/**
 * DuckDuckGo Search Provider Tests
 * 
 * Tests for DuckDuckGo HTML search provider
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DuckDuckGoSearchProvider } from '../duckduckgo-search.js';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch as any;

describe('DuckDuckGoSearchProvider', () => {
  let provider: DuckDuckGoSearchProvider;
  
  beforeEach(() => {
    provider = new DuckDuckGoSearchProvider();
    mockFetch.mockClear();
  });
  
  afterEach(() => {
    vi.clearAllMocks();
  });
  
  describe('search', () => {
    it('should make request to DuckDuckGo HTML endpoint', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => '<html></html>',
      });
      
      await provider.search('test query', 5);
      
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('html.duckduckgo.com/html/'),
        expect.objectContaining({
          headers: expect.objectContaining({
            'User-Agent': expect.stringContaining('Mozilla'),
          }),
        })
      );
    });
    
    it('should encode query in URL', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => '<html></html>',
      });
      
      await provider.search('test query with spaces', 5);
      
      const callUrl = mockFetch.mock.calls[0][0];
      expect(callUrl).toContain('test%20query%20with%20spaces');
    });
    
    it('should parse search results from HTML', async () => {
      const mockHtml = `
        <html>
          <div class="result">
            <h2 class="result__title">
              <a href="https://example.com/1">Test Result 1</a>
            </h2>
            <a class="result__snippet">This is a test snippet</a>
          </div>
          <div class="result">
            <h2 class="result__title">
              <a href="https://example.com/2">Test Result 2</a>
            </h2>
            <a class="result__snippet">Another test snippet</a>
          </div>
        </html>
      `;
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => mockHtml,
      });
      
      const results = await provider.search('test query', 5);
      
      expect(results).toHaveLength(2);
      expect(results[0]).toEqual({
        title: 'Test Result 1',
        url: 'https://example.com/1',
        snippet: expect.stringContaining('test snippet'),
      });
    });
    
    it('should respect numResults limit', async () => {
      const mockHtml = `
        <html>
          ${Array.from({ length: 10 }, (_, i) => `
            <div class="result">
              <h2 class="result__title">
                <a href="https://example.com/${i}">Result ${i}</a>
              </h2>
              <a class="result__snippet">Snippet ${i}</a>
            </div>
          `).join('')}
        </html>
      `;
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => mockHtml,
      });
      
      const results = await provider.search('test query', 3);
      
      expect(results.length).toBeLessThanOrEqual(3);
    });
    
    it('should handle HTTP errors gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });
      
      const results = await provider.search('test query', 5);
      
      // Should return empty array instead of throwing
      expect(results).toEqual([]);
    });
    
    it('should handle network errors gracefully', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));
      
      const results = await provider.search('test query', 5);
      
      // Should return empty array instead of throwing
      expect(results).toEqual([]);
    });
    
    it('should handle malformed HTML gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => '<html><body>Invalid HTML</body></html>',
      });
      
      const results = await provider.search('test query', 5);
      
      // Should return empty array if parsing fails
      expect(Array.isArray(results)).toBe(true);
    });
    
    it('should decode HTML entities in titles', async () => {
      const mockHtml = `
        <html>
          <div class="result">
            <h2 class="result__title">
              <a href="https://example.com">Test &amp; Result</a>
            </h2>
            <a class="result__snippet">Snippet</a>
          </div>
        </html>
      `;
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => mockHtml,
      });
      
      const results = await provider.search('test query', 5);
      
      expect(results[0].title).toBe('Test & Result');
    });
    
    it('should clean DuckDuckGo redirect URLs', async () => {
      const mockHtml = `
        <html>
          <div class="result">
            <h2 class="result__title">
              <a href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com">Test Result</a>
            </h2>
            <a class="result__snippet">Snippet</a>
          </div>
        </html>
      `;
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => mockHtml,
      });
      
      const results = await provider.search('test query', 5);
      
      expect(results[0].url).toBe('https://example.com');
    });
    
    it('should handle URLs starting with //', async () => {
      const mockHtml = `
        <html>
          <div class="result">
            <h2 class="result__title">
              <a href="//example.com/page">Test Result</a>
            </h2>
            <a class="result__snippet">Snippet</a>
          </div>
        </html>
      `;
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => mockHtml,
      });
      
      const results = await provider.search('test query', 5);
      
      expect(results[0].url).toBe('https://example.com/page');
    });
    
    it('should filter out DuckDuckGo internal URLs', async () => {
      const mockHtml = `
        <html>
          <div class="result">
            <h2 class="result__title">
              <a href="https://duckduckgo.com/internal">Internal Link</a>
            </h2>
            <a class="result__snippet">Snippet</a>
          </div>
          <div class="result">
            <h2 class="result__title">
              <a href="https://example.com">Valid Result</a>
            </h2>
            <a class="result__snippet">Snippet</a>
          </div>
        </html>
      `;
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => mockHtml,
      });
      
      const results = await provider.search('test query', 5);
      
      // Should only include the valid external result
      expect(results.some(r => r.url.includes('duckduckgo.com'))).toBe(false);
      expect(results.some(r => r.url.includes('example.com'))).toBe(true);
    });
    
    it('should handle results without snippets', async () => {
      const mockHtml = `
        <html>
          <div class="result">
            <h2 class="result__title">
              <a href="https://example.com">Test Result</a>
            </h2>
          </div>
        </html>
      `;
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => mockHtml,
      });
      
      const results = await provider.search('test query', 5);
      
      expect(results[0].snippet).toBeTruthy();
      expect(results[0].snippet).toContain('Search result');
    });
    
    it('should use alternative parsing if main parsing fails', async () => {
      // HTML that doesn't match main regex but has links
      const mockHtml = `
        <html>
          <body>
            <a href="https://example.com/1">First Link</a>
            <a href="https://example.com/2">Second Link</a>
          </body>
        </html>
      `;
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => mockHtml,
      });
      
      const results = await provider.search('test query', 5);
      
      // Should fall back to alternative parsing
      expect(Array.isArray(results)).toBe(true);
    });
    
    it('should remove HTML tags from snippets', async () => {
      const mockHtml = `
        <html>
          <div class="result">
            <h2 class="result__title">
              <a href="https://example.com">Test Result</a>
            </h2>
            <a class="result__snippet">This is <b>bold</b> text</a>
          </div>
        </html>
      `;
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => mockHtml,
      });
      
      const results = await provider.search('test query', 5);
      
      expect(results[0].snippet).not.toContain('<b>');
      expect(results[0].snippet).not.toContain('</b>');
      expect(results[0].snippet).toContain('bold');
    });
    
    it('should handle empty search results', async () => {
      const mockHtml = '<html><body>No results found</body></html>';
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => mockHtml,
      });
      
      const results = await provider.search('test query', 5);
      
      expect(results).toEqual([]);
    });
    
    it('should log search activity', async () => {
      const consoleSpy = vi.spyOn(console, 'log');
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => '<html></html>',
      });
      
      await provider.search('test query', 5);
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[DuckDuckGo]'),
        expect.anything()
      );
      
      consoleSpy.mockRestore();
    });
  });
});
