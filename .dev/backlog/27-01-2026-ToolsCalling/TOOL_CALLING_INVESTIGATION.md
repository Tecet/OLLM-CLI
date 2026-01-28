# Web Search Tool Implementation

**Date:** January 27, 2026  
**Status:** ⚠️ Needs Implementation  
**Priority:** MEDIUM

---

## Problem Summary

User asked LLM to search the web for NVIDIA stock information. The LLM received the web_search tool but it returned empty results, so:

1. ❌ LLM made up data from its training set
2. ❌ LLM admitted "I don't have direct access to the web or real-time data"
3. ❌ LLM hallucinated creating a file `nvda_report.md` that doesn't exist

**Note:** The bug where tools weren't being passed to the LLM has been fixed (see `.dev/backlog/27-01-2026-Refactoring/BUGS_FIXED.md` #11). This document focuses on implementing a real web search provider.

---

## Root Cause

### Web Search Tool Returns Empty Results

**Problem:** Built-in `web_search` tool has no real implementation

**Location:** `packages/core/src/tools/web-search.ts`

**Current Implementation:**

```typescript
export class DefaultSearchProvider implements SearchProvider {
  async search(_query: string, _numResults: number): Promise<SearchResult[]> {
    // Placeholder - in production, this would call a real search API
    // (e.g., DuckDuckGo, SearXNG, or similar)
    return []; // ❌ Returns empty array!
  }
}
```

**Registration:**

```typescript
// packages/core/src/tools/index.ts line 141
registry.register(new WebSearchTool()); // ❌ Uses DefaultSearchProvider
```

**Result:** LLM sees the tool, but when it calls it, gets no results.

---

## Alternative: Brave Search MCP

**Location:** `.kiro/settings/mcp.json`

**Current Configuration:**

```json
"brave-search": {
  "command": "npx",
  "args": ["-y", "@smithery/brave-search-mcp"],
  "env": {
    "SMITHERY_API_KEY": "your-smithery-api-key-here",
    "BRAVE_API_KEY": "your-brave-api-key-here"  // ❌ Placeholder
  },
  "transport": "stdio",
  "disabled": true,  // ❌ Disabled!
  "autoApprove": []
}
```

**Status:** Configured but disabled, needs API keys

---

## How Multiple Search Tools Work

### Tool Naming

If you have both DuckDuckGo and Brave Search MCP enabled:

1. **Built-in web_search** (DuckDuckGo)
   - Tool name: `web_search`
   - Description: "Search the web for information"

2. **Brave Search MCP**
   - Tool name: `brave-search:web_search` (or similar, prefixed with server name)
   - Description: From MCP server definition

### LLM Behavior

**The LLM will see BOTH tools** and can choose which one to use based on:

- Tool descriptions
- Context of the request
- Previous experience in the conversation

**Example:**

```json
{
  "tools": [
    {
      "name": "web_search",
      "description": "Search the web for information"
    },
    {
      "name": "brave-search:web_search",
      "description": "Search the web using Brave Search API"
    }
  ]
}
```

The LLM will pick one based on the descriptions. If both have similar descriptions, it may pick randomly or prefer the first one listed.

### Recommendation

**Option A: Use Only One (Simpler)**

- Either enable DuckDuckGo OR Brave Search MCP
- Avoids confusion for the LLM
- Clearer behavior

**Option B: Use Both with Different Descriptions (Advanced)**

- Modify descriptions to be distinct:
  - `web_search`: "Quick web search (free, no API key)"
  - `brave-search:web_search`: "Professional web search with Brave API (more accurate)"
- LLM can choose based on needs
- Provides fallback if one fails

**Option C: Implement Fallback Provider (Best)**

- Single `web_search` tool
- Tries Brave first, falls back to DuckDuckGo
- LLM only sees one tool
- Automatic failover

---

## Solutions

### Option 1: Enable Brave Search MCP (Recommended for Testing)

**Requirements:**

- Brave Search API key from https://brave.com/search/api/
- Smithery API key (if required)

**Steps:**

1. Get API keys
2. Update `.kiro/settings/mcp.json`:

```json
"brave-search": {
  "disabled": false,  // ✅ Enable
  "env": {
    "BRAVE_API_KEY": "YOUR_ACTUAL_KEY_HERE"  // ✅ Real key
  }
}
```

**Pros:**

- Real search results
- Free tier available (2000 queries/month)
- Already configured
- Professional API

**Cons:**

- Requires API key
- External dependency
- Rate limits

---

### Option 2: Implement DuckDuckGo Search (Free, No API Key)

**Implementation:**

Create new file: `packages/core/src/tools/providers/duckduckgo-search.ts`

```typescript
import type { SearchProvider, SearchResult } from '../web-search.js';

export class DuckDuckGoSearchProvider implements SearchProvider {
  private readonly baseUrl = 'https://html.duckduckgo.com/html/';

  async search(query: string, numResults: number): Promise<SearchResult[]> {
    try {
      const url = `${this.baseUrl}?q=${encodeURIComponent(query)}`;
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; OLLM-CLI/1.0)',
        },
      });

      if (!response.ok) {
        throw new Error(`DuckDuckGo search failed: ${response.statusText}`);
      }

      const html = await response.text();
      return this.parseResults(html, numResults);
    } catch (error) {
      console.error('DuckDuckGo search error:', error);
      return [];
    }
  }

  private parseResults(html: string, maxResults: number): SearchResult[] {
    const results: SearchResult[] = [];

    // Parse HTML to extract search results
    // DuckDuckGo HTML structure:
    // <div class="result">
    //   <h2 class="result__title"><a href="...">Title</a></h2>
    //   <a class="result__snippet">Snippet text</a>
    // </div>

    const resultRegex =
      /<div class="result[^"]*">[\s\S]*?<h2[^>]*><a[^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>[\s\S]*?<a class="result__snippet[^"]*">([^<]*)<\/a>/g;

    let match;
    while ((match = resultRegex.exec(html)) !== null && results.length < maxResults) {
      const [, url, title, snippet] = match;
      results.push({
        title: this.decodeHtml(title.trim()),
        url: this.decodeHtml(url.trim()),
        snippet: this.decodeHtml(snippet.trim()),
      });
    }

    return results;
  }

  private decodeHtml(text: string): string {
    return text
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");
  }
}
```

Update registration in `packages/core/src/tools/index.ts`:

```typescript
import { DuckDuckGoSearchProvider } from './providers/duckduckgo-search.js';

// In registerBuiltInTools():
registry.register(new WebSearchTool(new DuckDuckGoSearchProvider()));
```

**Pros:**

- No API key needed
- Free unlimited searches
- Simple implementation
- No rate limits (reasonable use)

**Cons:**

- HTML scraping (may break if DDG changes HTML)
- No official API
- Less reliable than official API

---

### Option 3: Use SearXNG Instance (Best for Privacy)

**Implementation:**

Create new file: `packages/core/src/tools/providers/searxng-search.ts`

```typescript
import type { SearchProvider, SearchResult } from '../web-search.js';

export class SearXNGSearchProvider implements SearchProvider {
  private readonly instance: string;

  constructor(instance = 'https://searx.be') {
    this.instance = instance;
  }

  async search(query: string, numResults: number): Promise<SearchResult[]> {
    try {
      const url = `${this.instance}/search?q=${encodeURIComponent(query)}&format=json&pageno=1`;

      const response = await fetch(url, {
        headers: {
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`SearXNG search failed: ${response.statusText}`);
      }

      const data = await response.json();

      return (data.results || []).slice(0, numResults).map((result: any) => ({
        title: result.title || '',
        url: result.url || '',
        snippet: result.content || '',
      }));
    } catch (error) {
      console.error('SearXNG search error:', error);
      return [];
    }
  }
}
```

Update registration:

```typescript
import { SearXNGSearchProvider } from './providers/searxng-search.js';

registry.register(new WebSearchTool(new SearXNGSearchProvider()));
```

**Public SearXNG Instances:**

- https://searx.be
- https://searx.work
- https://search.sapti.me
- https://searx.tiekoetter.com

**Pros:**

- No API key needed
- JSON API (stable)
- Privacy-focused
- Aggregates multiple search engines

**Cons:**

- Depends on public instance availability
- May be slower than direct APIs
- Instance may go down

---

## Recommendation

### Immediate Solution (Testing)

**Enable Brave Search MCP** if you have an API key:

- Quick to set up
- Professional results
- Free tier sufficient for testing

### Long-term Solution (Production)

**Implement DuckDuckGo or SearXNG**:

- No API keys required
- No rate limits
- Free forever
- More reliable for production

### Hybrid Approach (Best)

**Support multiple providers with fallback**:

```typescript
class FallbackSearchProvider implements SearchProvider {
  private providers: SearchProvider[];

  constructor() {
    this.providers = [
      new BraveSearchProvider(), // Try Brave first (if configured)
      new SearXNGSearchProvider(), // Fallback to SearXNG
      new DuckDuckGoSearchProvider(), // Last resort
    ];
  }

  async search(query: string, numResults: number): Promise<SearchResult[]> {
    for (const provider of this.providers) {
      try {
        const results = await provider.search(query, numResults);
        if (results.length > 0) return results;
      } catch (error) {
        console.warn(`Provider failed, trying next:`, error);
      }
    }
    return [];
  }
}
```

---

## Implementation Priority

### Phase 1: Quick Fix (1-2 hours)

1. ⏳ Implement DuckDuckGo provider (simple, no API key)
2. ⏳ Test with real LLM

### Phase 2: Production Ready (1 day)

1. ⏳ Implement SearXNG provider
2. ⏳ Add fallback mechanism
3. ⏳ Add error handling and retries
4. ⏳ Add tests

### Phase 3: Optional Enhancements (2-3 days)

1. ⏳ Add Brave Search MCP support
2. ⏳ Add configuration for preferred provider
3. ⏳ Add caching for search results
4. ⏳ Add search result ranking/filtering

---

## Testing Checklist

### After Implementation:

- [ ] LLM calls web_search tool
- [ ] Tool returns real search results (not empty)
- [ ] LLM uses search results in response
- [ ] No hallucinated files created
- [ ] Error handling works (network failures)
- [ ] Rate limiting handled gracefully

---

## Files to Modify

### Web Search Implementation

- ⏳ `packages/core/src/tools/providers/duckduckgo-search.ts` (NEW)
- ⏳ `packages/core/src/tools/providers/searxng-search.ts` (NEW)
- ⏳ `packages/core/src/tools/index.ts` - Update registration
- ⏳ `packages/core/src/tools/web-search.ts` - Export provider interface

### Configuration (Optional)

- ⏳ `.kiro/settings/mcp.json` - Enable Brave Search if using MCP

---

## Related Issues

- **Bug #11 in BUGS_FIXED.md:** Tools not passed to LLM (RESOLVED)
- **This Issue:** Implement real web search provider (PENDING)

---

## Conclusion

**Current Status:**

- ✅ Tools are now passed to LLM (fixed in refactoring)
- ❌ Web search returns empty results (needs implementation)
- ❌ LLM will still make up data until search is implemented

**Next Steps:**

1. Choose a search provider (recommend DuckDuckGo for quick start)
2. Implement the provider
3. Test with real LLM
4. Verify search results are used

**Estimated Effort:** 2-4 hours for basic implementation

---

**Created:** January 27, 2026  
**Last Updated:** January 27, 2026  
**Status:** Ready for Implementation
