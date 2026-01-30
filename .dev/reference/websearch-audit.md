# OLLM CLI - Web Search Tool Audit & Recommendations

**Date**: January 22, 2026  
**Version**: 0.1.0  
**Purpose**: Audit web search tool implementation and provide recommendations for enabling search functionality

---

## Executive Summary

The OLLM CLI has a **web search tool infrastructure** in place but **no active search provider**. The tool uses a placeholder implementation that returns empty results. This audit examines the current state and provides multiple options for enabling web search, including MCP integration with Brave Search, Exa AI, and other providers.

### Key Findings

✅ **Infrastructure Ready**:

- `WebSearchTool` class fully implemented with proper interfaces
- Tool registry integration complete
- Policy engine allows web search (low risk)
- Mode system permits web search in planning, execution, and other modes

❌ **No Active Provider**:

- `DefaultSearchProvider` returns empty results (placeholder)
- No API integrations configured
- No MCP search servers installed by default

🎯 **Recommended Solution**: **MCP Integration** (Brave Search or Exa AI)

- Leverages existing MCP infrastructure
- No additional dependencies needed
- Easy to configure and swap providers
- Supports multiple search engines

---

## 1. Current Implementation Status

### 1.1 Web Search Tool

**Location**: `packages/core/src/tools/web-search.ts`

**Status**: ✅ **Fully Implemented** (but inactive)

**Architecture**:

```typescript
interface SearchProvider {
  search(query: string, numResults: number): Promise<SearchResult[]>;
}

class DefaultSearchProvider implements SearchProvider {
  async search(_query: string, _numResults: number): Promise<SearchResult[]> {
    // Placeholder - returns empty array
    return [];
  }
}
```

**Features**:

- Query validation
- Result limiting (default: 5 results)
- Abort signal support
- Formatted output (title, URL, snippet)
- Error handling

**Integration Points**:

- Registered in tool registry ✅
- Allowed in policy engine (low risk) ✅
- Enabled in multiple modes ✅
- No confirmation required ✅

### 1.2 MCP Search Integration

**Location**: `packages/core/src/tools/semantic-tools.ts`

**Status**: ⚠️ **Partially Implemented**

**Architecture**:

```typescript
class MCPSearchProvider implements SearchProvider {
  constructor(
    private router: ToolRouter,
    private capability: ToolCapability.WEB_SEARCH
  ) {}

  async search(query: string, numResults: number): Promise<SearchResult[]> {
    const serverName = this.router.findServerForCapability(this.capability);
    // Calls MCP server's search tool
    // Parses and adapts results to SearchResult[]
  }
}
```

**Features**:

- Routes to MCP servers with search capability
- Flexible result parsing (handles various formats)
- Capability-based server discovery
- Error handling with fallback

**Issues**:

- Requires MCP server to be installed and configured
- No default search server configured
- Router access pattern needs refinement

---

### 1.3 Available MCP Search Servers

**Location**: `packages/cli/src/services/mcpMarketplace.ts`

**Status**: ✅ **Multiple Options Available**

#### Option 1: Brave Search (Official Anthropic)

```json
{
  "id": "brave-search",
  "name": "brave-search",
  "description": "Web search using Brave Search API",
  "command": "npx",
  "args": ["-y", "@modelcontextprotocol/server-brave-search"],
  "env": {
    "BRAVE_API_KEY": ""
  },
  "requiresOAuth": false,
  "requirements": ["Node.js 18+", "Brave Search API Key"]
}
```

**Pros**:

- Official Anthropic MCP server
- Privacy-focused search engine
- Free tier available (2,000 queries/month)
- Well-documented API

**Cons**:

- Requires API key registration
- Rate limits on free tier

---

#### Option 2: Exa AI Search

```json
{
  "id": "ai.exa/exa",
  "name": "exa-search",
  "description": "Exa AI-powered search - Advanced web search with AI understanding",
  "command": "npx",
  "args": ["-y", "@exa/mcp-server"],
  "env": {
    "EXA_API_KEY": ""
  },
  "requiresOAuth": false,
  "requirements": ["Node.js 18+", "Exa API Key"]
}
```

**Pros**:

- AI-powered semantic search
- Better understanding of natural language queries
- High-quality results
- Free tier available (1,000 searches/month)

**Cons**:

- Requires API key
- Newer service (less established)

---

#### Option 3: Smithery Brave Search (Remote)

```json
{
  "id": "ai.smithery/brave",
  "name": "brave-search",
  "description": "Search the web, local businesses, images, and more",
  "command": "mcp-remote",
  "args": ["https://server.smithery.ai/brave/mcp"],
  "transport": "sse",
  "env": {
    "SMITHERY_API_KEY": "",
    "BRAVE_API_KEY": ""
  },
  "requiresOAuth": false
}
```

**Pros**:

- Remote server (no local installation)
- SSE transport (real-time streaming)
- Additional features (images, local businesses)

**Cons**:

- Requires two API keys (Smithery + Brave)
- Depends on external service availability

---

## 2. Integration Options

### Option A: MCP Integration (Recommended)

**Approach**: Use existing MCP infrastructure with Brave Search or Exa AI

**Implementation Steps**:

1. **Install MCP Search Server**

   ```bash
   # Option 1: Brave Search
   npm install -g @modelcontextprotocol/server-brave-search

   # Option 2: Exa AI
   npm install -g @exa/mcp-server
   ```

2. **Configure MCP Server**

   Add to `.kiro/settings/mcp.json`:

   ```json
   {
     "mcpServers": {
       "brave-search": {
         "command": "npx",
         "args": ["-y", "@modelcontextprotocol/server-brave-search"],
         "env": {
           "BRAVE_API_KEY": "your-api-key-here"
         },
         "disabled": false,
         "autoApprove": ["brave_web_search"]
       }
     }
   }
   ```

3. **Update WebSearchTool Registration**

   Modify `packages/core/src/tools/index.ts`:

   ```typescript
   export function registerBuiltInTools(
     registry: ToolRegistry,
     config?: BuiltInToolsConfig,
     toolRouter?: ToolRouter
   ): void {
     // ... existing tools ...

     // Register web search with MCP provider if router available
     if (toolRouter) {
       const mcpSearchProvider = new MCPSearchProvider(toolRouter, ToolCapability.WEB_SEARCH);
       registry.register(new WebSearchTool(mcpSearchProvider));
     } else {
       // Fallback to default (empty) provider
       registry.register(new WebSearchTool());
     }
   }
   ```

4. **Test Integration**
   ```typescript
   // In chat or CLI
   const result = await toolRegistry.get('web_search').execute({
     query: 'latest TypeScript features',
     numResults: 5,
   });
   ```

**Pros**:

- ✅ Uses existing MCP infrastructure
- ✅ No new dependencies
- ✅ Easy to swap providers
- ✅ Supports multiple search engines
- ✅ Consistent with project architecture

**Cons**:

- ⚠️ Requires API key setup
- ⚠️ Depends on external service

**Estimated Effort**: 2-4 hours

---

### Option B: Direct API Integration

**Approach**: Implement search providers directly without MCP

**Implementation Steps**:

1. **Create Brave Search Provider**

   Create `packages/core/src/tools/providers/braveSearchProvider.ts`:

   ```typescript
   import type { SearchProvider, SearchResult } from '../web-search.js';

   export class BraveSearchProvider implements SearchProvider {
     private apiKey: string;
     private baseUrl = 'https://api.search.brave.com/res/v1/web/search';

     constructor(apiKey: string) {
       this.apiKey = apiKey;
     }

     async search(query: string, numResults: number): Promise<SearchResult[]> {
       const response = await fetch(
         `${this.baseUrl}?q=${encodeURIComponent(query)}&count=${numResults}`,
         {
           headers: {
             Accept: 'application/json',
             'X-Subscription-Token': this.apiKey,
           },
         }
       );

       if (!response.ok) {
         throw new Error(`Brave Search API error: ${response.status}`);
       }

       const data = await response.json();

       return (
         data.web?.results?.map((r: any) => ({
           title: r.title,
           url: r.url,
           snippet: r.description,
         })) || []
       );
     }
   }
   ```

2. **Configure Provider**

   Add to configuration system:

   ```typescript
   // In config
   export interface WebSearchConfig {
     provider: 'brave' | 'exa' | 'duckduckgo';
     apiKey?: string;
   }
   ```

3. **Register with Tool**

   ```typescript
   const searchConfig = config.webSearch;
   let searchProvider: SearchProvider;

   switch (searchConfig.provider) {
     case 'brave':
       searchProvider = new BraveSearchProvider(searchConfig.apiKey);
       break;
     case 'exa':
       searchProvider = new ExaSearchProvider(searchConfig.apiKey);
       break;
     default:
       searchProvider = new DefaultSearchProvider();
   }

   registry.register(new WebSearchTool(searchProvider));
   ```

**Pros**:

- ✅ Direct control over implementation
- ✅ No MCP dependency
- ✅ Potentially faster (no MCP overhead)

**Cons**:

- ❌ Requires new dependencies (fetch, API clients)
- ❌ More code to maintain
- ❌ Duplicates MCP functionality
- ❌ Harder to swap providers

**Estimated Effort**: 1-2 days

---

### Option C: SearXNG Self-Hosted

**Approach**: Use self-hosted SearXNG metasearch engine (no API keys needed)

**Implementation Steps**:

1. **Deploy SearXNG**

   ```bash
   # Using Docker
   docker run -d -p 8080:8080 searxng/searxng
   ```

2. **Create SearXNG Provider**

   ```typescript
   export class SearXNGProvider implements SearchProvider {
     private baseUrl: string;

     constructor(baseUrl: string = 'http://localhost:8080') {
       this.baseUrl = baseUrl;
     }

     async search(query: string, numResults: number): Promise<SearchResult[]> {
       const response = await fetch(
         `${this.baseUrl}/search?q=${encodeURIComponent(query)}&format=json`
       );

       const data = await response.json();

       return data.results.slice(0, numResults).map((r: any) => ({
         title: r.title,
         url: r.url,
         snippet: r.content,
       }));
     }
   }
   ```

**Pros**:

- ✅ No API keys required
- ✅ Privacy-focused
- ✅ Aggregates multiple search engines
- ✅ Self-hosted (full control)

**Cons**:

- ❌ Requires infrastructure setup
- ❌ Maintenance overhead
- ❌ Slower than direct APIs
- ❌ Not suitable for all users

**Estimated Effort**: 4-8 hours (including deployment)

---

## 3. Recommended Implementation Plan

### Phase 1: MCP Integration (Week 1)

**Goal**: Enable web search via MCP with Brave Search

**Tasks**:

1. ✅ Audit current implementation (complete)
2. [ ] Fix `MCPSearchProvider` router access pattern
3. [ ] Update `registerBuiltInTools` to accept `ToolRouter`
4. [ ] Add Brave Search to default MCP marketplace
5. [ ] Create setup guide for API key configuration
6. [ ] Test with sample queries
7. [ ] Document usage in README

**Files to Modify**:

- `packages/core/src/tools/semantic-tools.ts` - Fix router access
- `packages/core/src/tools/index.ts` - Add router parameter
- `packages/cli/src/services/mcpMarketplace.ts` - Ensure Brave is prominent
- `docs/` - Add web search setup guide

**Success Criteria**:

- [ ] Web search returns real results
- [ ] Works with Brave Search MCP server
- [ ] Easy to configure API key
- [ ] Documented setup process

---

### Phase 2: Multiple Provider Support (Week 2)

**Goal**: Support multiple search providers (Brave, Exa, SearXNG)

**Tasks**:

1. [ ] Add Exa AI MCP server support
2. [ ] Add SearXNG provider option
3. [ ] Create provider selection UI/config
4. [ ] Add provider health checks
5. [ ] Implement fallback logic (if primary fails, try secondary)
6. [ ] Add provider comparison guide

**Configuration Example**:

```json
{
  "webSearch": {
    "providers": [
      {
        "type": "mcp",
        "server": "brave-search",
        "priority": 1
      },
      {
        "type": "mcp",
        "server": "exa-search",
        "priority": 2
      },
      {
        "type": "searxng",
        "url": "http://localhost:8080",
        "priority": 3
      }
    ]
  }
}
```

---

### Phase 3: Enhanced Features (Week 3)

**Goal**: Add advanced search capabilities

**Tasks**:

1. [ ] Image search support
2. [ ] News search support
3. [ ] Local business search
4. [ ] Search result caching (avoid duplicate queries)
5. [ ] Search history tracking
6. [ ] Result quality scoring
7. [ ] Search suggestions/autocomplete

---

## 4. API Key Setup Guides

### Brave Search API

1. **Sign Up**: https://brave.com/search/api/
2. **Get API Key**: Dashboard → API Keys → Create New Key
3. **Free Tier**: 2,000 queries/month
4. **Pricing**: $5/month for 20,000 queries

**Configuration**:

```bash
# Add to .env or mcp.json
BRAVE_API_KEY=your-api-key-here
```

---

### Exa AI API

1. **Sign Up**: https://exa.ai/
2. **Get API Key**: Dashboard → API Keys
3. **Free Tier**: 1,000 searches/month
4. **Pricing**: $20/month for 10,000 searches

**Configuration**:

```bash
# Add to .env or mcp.json
EXA_API_KEY=your-api-key-here
```

---

## 5. Testing Strategy

### Unit Tests

```typescript
describe('WebSearchTool with MCP Provider', () => {
  it('should return search results from Brave', async () => {
    const provider = new MCPSearchProvider(router, ToolCapability.WEB_SEARCH);
    const results = await provider.search('TypeScript', 5);

    expect(results).toHaveLength(5);
    expect(results[0]).toHaveProperty('title');
    expect(results[0]).toHaveProperty('url');
    expect(results[0]).toHaveProperty('snippet');
  });

  it('should handle API errors gracefully', async () => {
    // Test with invalid API key
    // Should throw descriptive error
  });

  it('should respect numResults parameter', async () => {
    const results = await provider.search('test', 3);
    expect(results.length).toBeLessThanOrEqual(3);
  });
});
```

### Integration Tests

```typescript
describe('Web Search Integration', () => {
  it('should work end-to-end with MCP server', async () => {
    // Start MCP server
    // Execute search tool
    // Verify results
    // Stop MCP server
  });

  it('should fallback to secondary provider on failure', async () => {
    // Simulate primary provider failure
    // Verify fallback to secondary
  });
});
```

---

## 6. Documentation Requirements

### User Documentation

1. **Setup Guide**: How to configure web search
2. **Provider Comparison**: Brave vs Exa vs SearXNG
3. **API Key Guide**: How to get and configure API keys
4. **Usage Examples**: Sample queries and expected results
5. **Troubleshooting**: Common issues and solutions

### Developer Documentation

1. **Architecture**: How search providers work
2. **Adding Providers**: How to implement new search providers
3. **MCP Integration**: How MCP search routing works
4. **Testing**: How to test search functionality

---

## 7. Cost Analysis

### Brave Search

| Tier  | Queries/Month | Cost | Cost per Query |
| ----- | ------------- | ---- | -------------- |
| Free  | 2,000         | $0   | $0             |
| Basic | 20,000        | $5   | $0.00025       |
| Pro   | 100,000       | $20  | $0.0002        |

**Recommendation**: Free tier sufficient for most users

---

### Exa AI

| Tier    | Searches/Month | Cost | Cost per Search |
| ------- | -------------- | ---- | --------------- |
| Free    | 1,000          | $0   | $0              |
| Starter | 10,000         | $20  | $0.002          |
| Pro     | 50,000         | $80  | $0.0016         |

**Recommendation**: Free tier for testing, Starter for regular use

---

### SearXNG (Self-Hosted)

| Component   | Cost              |
| ----------- | ----------------- |
| Server      | $5-10/month (VPS) |
| Bandwidth   | Included          |
| Maintenance | Time investment   |

**Recommendation**: Only for privacy-focused users or organizations

---

## 8. Security Considerations

### API Key Storage

- ✅ Store in environment variables
- ✅ Never commit to git
- ✅ Use `.env` files with `.gitignore`
- ✅ Support encrypted storage (future)

### Rate Limiting

- ✅ Implement client-side rate limiting
- ✅ Cache results to reduce API calls
- ✅ Show rate limit warnings to users

### Privacy

- ⚠️ Search queries sent to third-party APIs
- ✅ Option to use self-hosted SearXNG
- ✅ Document privacy implications
- ✅ Allow disabling web search

---

## 9. Summary & Next Steps

### Current State

- ✅ Tool infrastructure complete
- ❌ No active search provider
- ⚠️ MCP integration partially implemented

### Recommended Action

**Implement MCP Integration with Brave Search** (Option A)

**Rationale**:

1. Leverages existing MCP infrastructure
2. No new dependencies
3. Easy to configure and swap providers
4. Consistent with project architecture
5. Free tier available for testing

### Immediate Next Steps

1. **Fix MCPSearchProvider** (2 hours)
   - Refactor router access pattern
   - Add proper error handling
   - Test with mock MCP server

2. **Update Tool Registration** (1 hour)
   - Add ToolRouter parameter to registerBuiltInTools
   - Wire up MCPSearchProvider
   - Test with tool registry

3. **Create Setup Guide** (2 hours)
   - Document Brave API key setup
   - Add configuration examples
   - Create troubleshooting section

4. **Test End-to-End** (2 hours)
   - Install Brave Search MCP server
   - Configure API key
   - Run sample queries
   - Verify results

**Total Estimated Time**: 1 day

---

## Appendix: Code Examples

### Example 1: Using Web Search in Chat

```typescript
// User query
"Search for latest TypeScript 5.0 features"

// LLM response with tool call
{
  "tool": "web_search",
  "params": {
    "query": "TypeScript 5.0 new features",
    "numResults": 5
  }
}

// Tool result
{
  "results": [
    {
      "title": "TypeScript 5.0 Release Notes",
      "url": "https://devblogs.microsoft.com/typescript/announcing-typescript-5-0/",
      "snippet": "TypeScript 5.0 brings decorators, const type parameters..."
    },
    // ... more results
  ]
}
```

### Example 2: Configuring Multiple Providers

```json
{
  "mcpServers": {
    "brave-search": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-brave-search"],
      "env": {
        "BRAVE_API_KEY": "${BRAVE_API_KEY}"
      },
      "disabled": false,
      "autoApprove": ["brave_web_search"]
    },
    "exa-search": {
      "command": "npx",
      "args": ["-y", "@exa/mcp-server"],
      "env": {
        "EXA_API_KEY": "${EXA_API_KEY}"
      },
      "disabled": true,
      "autoApprove": ["exa_search"]
    }
  }
}
```

---

**End of Audit**
