# MCP Marketplace Integration Audit

**Date:** 2026-01-19  
**Status:** ⚠️ Partially Functional - Marketplace URL is Mock  
**Auditor:** Kiro AI

## Executive Summary

The MCP Panel UI has been successfully developed with all components in place, but the marketplace integration is **not fully functional** because it's pointing to a mock/example URL (`https://mcp-marketplace.example.com/api/servers`) that doesn't exist. The system gracefully falls back to a local registry of 10 popular MCP servers, so the UI works, but users cannot browse or install servers from a real marketplace.

## Current Status

### ✅ What's Working

1. **UI Components** - All MCP panel UI components are implemented and functional:
   - MCPTab with two-column layout (30/70 split)
   - Server list with navigation
   - Server details panel
   - Health indicators
   - Browse Mode / Active Mode navigation
   - All dialogs (config, OAuth, tools, logs, marketplace, etc.)

2. **Local Functionality** - Core MCP operations work:
   - Enable/disable servers
   - Configure servers
   - Restart servers
   - View server tools
   - View server logs
   - OAuth configuration
   - Health monitoring

3. **Fallback Registry** - Local registry with 10 popular servers:
   - filesystem
   - github
   - postgres
   - slack
   - google-drive
   - puppeteer
   - brave-search
   - memory
   - sqlite
   - fetch

4. **Error Handling** - Graceful fallback when marketplace is unavailable:
   - Catches fetch errors
   - Falls back to local registry
   - Caches data for 1 hour
   - Doesn't break UI when marketplace fails

### ⚠️ What's Not Working

1. **Real Marketplace Connection**
   - **Issue**: Marketplace URL is a mock endpoint
   - **Location**: `packages/cli/src/services/mcpMarketplace.ts:57`
   - **Current**: `https://mcp-marketplace.example.com/api/servers`
   - **Impact**: Cannot browse real marketplace servers
   - **Impact**: Cannot discover new servers beyond local registry
   - **Impact**: Install counts and ratings are static/fake

2. **Server Discovery**
   - Users cannot discover new MCP servers beyond the 10 in local registry
   - No way to browse community-contributed servers
   - No way to see updated server information

3. **Dynamic Marketplace Data**
   - Ratings are hardcoded
   - Install counts are hardcoded
   - Server versions are hardcoded
   - No real-time popularity data

## Architecture Analysis

### Data Flow

```
User Opens MCP Tab
       │
       ▼
MCPContext.loadMarketplace()
       │
       ▼
mcpMarketplace.getPopularServers(10)
       │
       ▼
mcpMarketplace.getAllServers()
       │
       ├─> Try fetch(MARKETPLACE_URL)
       │   │
       │   ├─> Success: Cache and return servers
       │   │
       │   └─> Failure: Fall back to getLocalRegistry()
       │
       └─> Return servers (real or local)
              │
              ▼
         UI displays servers
```

### Current Implementation

**File**: `packages/cli/src/services/mcpMarketplace.ts`

```typescript
export class MCPMarketplace {
  private readonly MARKETPLACE_URL = 'https://mcp-marketplace.example.com/api/servers';
  
  async getAllServers(): Promise<MCPMarketplaceServer[]> {
    try {
      const response = await fetch(this.MARKETPLACE_URL, {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(5000),
      });
      
      if (!response.ok) {
        throw new Error(`Marketplace API returned ${response.status}`);
      }
      
      const servers = await response.json();
      this.cache = servers;
      return servers;
    } catch (error) {
      // Falls back to local registry
      return this.getLocalRegistry();
    }
  }
}
```

## Solutions

### Option 1: Use Official MCP Registry (Recommended)

**Pros:**
- Official source of MCP servers
- Maintained by Anthropic
- Up-to-date server information
- Community contributions

**Cons:**
- Need to find/verify the official registry URL
- May require API key or authentication
- Dependent on external service

**Implementation:**
```typescript
// Update MARKETPLACE_URL to official registry
private readonly MARKETPLACE_URL = 'https://registry.modelcontextprotocol.io/api/servers';
// OR
private readonly MARKETPLACE_URL = 'https://api.github.com/repos/modelcontextprotocol/servers/contents/src';
```

### Option 2: Use GitHub as Marketplace

**Pros:**
- GitHub API is reliable and well-documented
- Can parse server information from repository
- No additional infrastructure needed
- Can show real install counts (npm downloads)

**Cons:**
- Requires parsing GitHub repository structure
- May need GitHub API token for rate limits
- More complex data transformation

**Implementation:**
```typescript
private readonly MARKETPLACE_URL = 'https://api.github.com/repos/modelcontextprotocol/servers/contents/src';

async getAllServers(): Promise<MCPMarketplaceServer[]> {
  try {
    const response = await fetch(this.MARKETPLACE_URL, {
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'OLLM-CLI',
      },
    });
    
    const files = await response.json();
    
    // Parse each server directory
    const servers = await Promise.all(
      files
        .filter(f => f.type === 'dir')
        .map(async (dir) => {
          // Fetch package.json for each server
          const pkgResponse = await fetch(
            `https://raw.githubusercontent.com/modelcontextprotocol/servers/main/src/${dir.name}/package.json`
          );
          const pkg = await pkgResponse.json();
          
          return {
            id: dir.name,
            name: pkg.name || dir.name,
            description: pkg.description || '',
            rating: 4.5, // Could fetch from npm
            installCount: 0, // Could fetch from npm
            requiresOAuth: false, // Parse from README
            requirements: ['Node.js 18+'],
            command: 'npx',
            args: ['-y', pkg.name],
            category: 'Utilities',
            author: pkg.author || 'Anthropic',
            version: pkg.version || '0.1.0',
            repository: pkg.repository?.url || '',
          };
        })
    );
    
    return servers;
  } catch (error) {
    return this.getLocalRegistry();
  }
}
```

### Option 3: Create Custom Marketplace Server

**Pros:**
- Full control over marketplace data
- Can add custom features (ratings, reviews, etc.)
- Can curate server list
- Can add analytics

**Cons:**
- Requires hosting infrastructure
- Requires maintenance
- Need to populate initial data
- Additional development effort

**Implementation:**
```typescript
// Deploy a simple marketplace API server
// Update MARKETPLACE_URL to your hosted endpoint
private readonly MARKETPLACE_URL = 'https://your-domain.com/api/mcp/servers';
```

### Option 4: Hybrid Approach (Recommended for MVP)

**Pros:**
- Works offline with local registry
- Can fetch from multiple sources
- Graceful degradation
- Best user experience

**Cons:**
- More complex implementation
- Need to merge data from multiple sources

**Implementation:**
```typescript
async getAllServers(): Promise<MCPMarketplaceServer[]> {
  // Try multiple sources in order
  const sources = [
    'https://registry.modelcontextprotocol.io/api/servers',
    'https://api.github.com/repos/modelcontextprotocol/servers/contents/src',
  ];
  
  for (const source of sources) {
    try {
      const servers = await this.fetchFromSource(source);
      if (servers.length > 0) {
        this.cache = servers;
        return servers;
      }
    } catch (error) {
      console.warn(`Failed to fetch from ${source}:`, error);
    }
  }
  
  // Final fallback to local registry
  return this.getLocalRegistry();
}
```

## Recommended Action Plan

### Phase 1: Research (1 hour)
1. ✅ Audit current implementation (DONE)
2. ⏳ Research official MCP registry URL
3. ⏳ Check if Anthropic provides a marketplace API
4. ⏳ Investigate GitHub API approach
5. ⏳ Check npm registry for MCP servers

### Phase 2: Implementation (2-3 hours)
1. ⏳ Update MARKETPLACE_URL to real endpoint
2. ⏳ Add authentication if required (API keys)
3. ⏳ Update data transformation if needed
4. ⏳ Test marketplace connection
5. ⏳ Update error handling for new endpoint

### Phase 3: Enhancement (2-3 hours)
1. ⏳ Add multiple marketplace sources
2. ⏳ Implement source priority/fallback
3. ⏳ Add npm download counts for install metrics
4. ⏳ Add server version checking
5. ⏳ Add update notifications

### Phase 4: Testing (1-2 hours)
1. ⏳ Test with real marketplace data
2. ⏳ Test fallback scenarios
3. ⏳ Test offline mode
4. ⏳ Test error handling
5. ⏳ Update documentation

## Quick Fix (Immediate)

If you need a working marketplace right now, here's the quickest solution:

### Use GitHub Raw Content

```typescript
// packages/cli/src/services/mcpMarketplace.ts

export class MCPMarketplace {
  // Use GitHub as temporary marketplace
  private readonly MARKETPLACE_URL = 'https://raw.githubusercontent.com/modelcontextprotocol/servers/main/marketplace.json';
  
  // OR use a curated list you host
  private readonly MARKETPLACE_URL = 'https://gist.githubusercontent.com/YOUR_USERNAME/GIST_ID/raw/mcp-servers.json';
  
  // Rest of implementation stays the same
}
```

Then create a `marketplace.json` file with the server list:

```json
[
  {
    "id": "filesystem",
    "name": "filesystem",
    "description": "Secure file system operations",
    "rating": 5,
    "installCount": 10000,
    "requiresOAuth": false,
    "requirements": ["Node.js 18+"],
    "command": "npx",
    "args": ["-y", "@modelcontextprotocol/server-filesystem"],
    "category": "File System",
    "author": "Anthropic",
    "version": "0.1.0"
  }
  // ... more servers
]
```

## Testing Checklist

Once marketplace is connected:

- [ ] Can browse marketplace servers
- [ ] Can search marketplace servers
- [ ] Can view server details
- [ ] Can install servers from marketplace
- [ ] Install counts are accurate
- [ ] Ratings are accurate
- [ ] Server versions are current
- [ ] Fallback to local registry works
- [ ] Offline mode works
- [ ] Error messages are helpful

## Documentation Updates Needed

Once marketplace is functional:

1. Update `docs/MCP/mcp-panel-user-guide.md`:
   - Add marketplace browsing instructions
   - Add server installation guide
   - Add troubleshooting for marketplace connection

2. Update `README.md`:
   - Add marketplace features
   - Add screenshots of marketplace UI

3. Update `.kiro/specs/stage-06d-mcp-panel-ui/tasks.md`:
   - Mark marketplace tasks as complete
   - Document marketplace URL configuration

## Conclusion

The MCP Panel UI is **fully functional** from a UI/UX perspective, but the marketplace integration is **not connected to a real marketplace**. The system works well with the local registry fallback, but users cannot discover or install new servers beyond the 10 hardcoded ones.

**Priority**: Medium-High  
**Effort**: 4-8 hours (depending on approach)  
**Risk**: Low (fallback ensures system keeps working)

**Recommendation**: Implement Option 4 (Hybrid Approach) with GitHub as primary source and local registry as fallback. This provides the best balance of functionality, reliability, and development effort.
