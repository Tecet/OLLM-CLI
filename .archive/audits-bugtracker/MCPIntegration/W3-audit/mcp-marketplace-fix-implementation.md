# MCP Marketplace Integration - Implementation Fix

**Date:** 2026-01-19  
**Status:** Ready to Implement  
**Priority:** High

## Summary

The official MCP Registry is live at `https://registry.modelcontextprotocol.io` with a stable v0.1 API. We need to update our marketplace service to use this real endpoint instead of the mock URL.

## Official MCP Registry Details

- **Production URL**: `https://registry.modelcontextprotocol.io`
- **API Version**: v0.1 (API freeze - stable, no breaking changes)
- **Status**: Preview (launched 2025-09-08)
- **Documentation**: [GitHub Repository](https://github.com/modelcontextprotocol/registry)
- **API Docs**: Available at the registry URL

### Key API Endpoints

1. **GET /v0/servers** - List all servers with pagination
   - Query params: `limit`, `offset`, `updated_since`, `search`
   - Returns: Array of server objects

2. **GET /v0/servers/{id}** - Get specific server details
   - Returns: Single server object with full details

### API Response Format

Based on the registry documentation, servers are returned in this format:

```json
{
  "id": "io.github.anthropic/filesystem",
  "name": "filesystem",
  "description": "Secure file system operations",
  "vendor": {
    "name": "Anthropic",
    "url": "https://anthropic.com"
  },
  "sourceUrl": "https://github.com/modelcontextprotocol/servers",
  "homepage": "https://github.com/modelcontextprotocol/servers/tree/main/src/filesystem",
  "license": "MIT",
  "runtime": {
    "type": "node",
    "version": ">=18.0.0"
  },
  "installation": {
    "command": "npx",
    "args": ["-y", "@modelcontextprotocol/server-filesystem"]
  },
  "capabilities": {
    "resources": true,
    "tools": true,
    "prompts": false
  },
  "tags": ["filesystem", "files", "storage"],
  "createdAt": "2024-11-25T00:00:00Z",
  "updatedAt": "2025-01-15T00:00:00Z"
}
```

## Implementation Changes

### File: `packages/cli/src/services/mcpMarketplace.ts`

#### Change 1: Update Marketplace URL

```typescript
export class MCPMarketplace {
  // OLD:
  // private readonly MARKETPLACE_URL = 'https://mcp-marketplace.example.com/api/servers';
  
  // NEW:
  private readonly MARKETPLACE_URL = 'https://registry.modelcontextprotocol.io/v0/servers';
  private readonly MARKETPLACE_DETAIL_URL = 'https://registry.modelcontextprotocol.io/v0/servers';
```

#### Change 2: Update Data Transformation

The registry API returns a different format than our internal `MCPMarketplaceServer` interface. We need to transform the data:

```typescript
/**
 * Registry API server response format
 */
interface RegistryServer {
  id: string;
  name: string;
  description: string;
  vendor?: {
    name: string;
    url?: string;
  };
  sourceUrl?: string;
  homepage?: string;
  license?: string;
  runtime?: {
    type: string;
    version?: string;
  };
  installation?: {
    command: string;
    args?: string[];
  };
  capabilities?: {
    resources?: boolean;
    tools?: boolean;
    prompts?: boolean;
  };
  tags?: string[];
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Transform registry server to marketplace server format
 */
private transformRegistryServer(server: RegistryServer): MCPMarketplaceServer {
  // Determine category from tags
  const category = this.getCategoryFromTags(server.tags || []);
  
  // Determine if OAuth is required (heuristic based on tags/description)
  const requiresOAuth = (server.tags || []).some(tag => 
    tag.toLowerCase().includes('oauth') || 
    tag.toLowerCase().includes('auth')
  ) || server.description.toLowerCase().includes('oauth');
  
  // Extract requirements from runtime
  const requirements: string[] = [];
  if (server.runtime?.type === 'node' && server.runtime.version) {
    requirements.push(`Node.js ${server.runtime.version}`);
  }
  if (requiresOAuth) {
    requirements.push('OAuth credentials');
  }
  
  return {
    id: server.id,
    name: server.name,
    description: server.description,
    rating: 4.5, // Default rating (registry doesn't provide this yet)
    installCount: 0, // Default install count (registry doesn't provide this yet)
    requiresOAuth,
    requirements,
    command: server.installation?.command || 'npx',
    args: server.installation?.args || [],
    category,
    author: server.vendor?.name || 'Unknown',
    version: '0.1.0', // Default version (registry doesn't provide this yet)
    homepage: server.homepage,
    repository: server.sourceUrl,
  };
}

/**
 * Determine category from tags
 */
private getCategoryFromTags(tags: string[]): string {
  const categoryMap: Record<string, string> = {
    'filesystem': 'File System',
    'files': 'File System',
    'storage': 'File System',
    'database': 'Database',
    'sql': 'Database',
    'postgres': 'Database',
    'sqlite': 'Database',
    'api': 'Development',
    'github': 'Development',
    'git': 'Development',
    'web': 'Web',
    'http': 'Web',
    'fetch': 'Web',
    'browser': 'Web Automation',
    'puppeteer': 'Web Automation',
    'search': 'Search',
    'communication': 'Communication',
    'slack': 'Communication',
    'email': 'Communication',
    'cloud': 'Cloud Storage',
    'drive': 'Cloud Storage',
    'memory': 'Utilities',
    'utility': 'Utilities',
  };
  
  for (const tag of tags) {
    const category = categoryMap[tag.toLowerCase()];
    if (category) return category;
  }
  
  return 'Utilities';
}
```

#### Change 3: Update getAllServers Method

```typescript
async getAllServers(): Promise<MCPMarketplaceServer[]> {
  // Return cached data if still valid
  if (this.cache.length > 0 && Date.now() < this.cacheExpiry) {
    return this.cache;
  }

  try {
    // Fetch from official MCP Registry
    const response = await fetch(this.MARKETPLACE_URL, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'OLLM-CLI/0.1.0',
      },
      signal: AbortSignal.timeout(10000), // 10 second timeout
    });

    if (!response.ok) {
      throw new Error(`Registry API returned ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    
    // Handle pagination if needed
    let servers: RegistryServer[] = [];
    if (Array.isArray(data)) {
      servers = data;
    } else if (data.servers && Array.isArray(data.servers)) {
      servers = data.servers;
    } else {
      throw new Error('Unexpected API response format');
    }
    
    // Transform to our format
    const transformedServers = servers.map(s => this.transformRegistryServer(s));

    // Update cache
    this.cache = transformedServers;
    this.cacheExpiry = Date.now() + this.CACHE_TTL;

    return transformedServers;
  } catch (error) {
    console.warn('Failed to fetch from MCP Registry, using local registry:', error);
    
    // Fallback to local registry
    const localServers = this.getLocalRegistry();
    
    // Update cache with local registry if empty
    if (this.cache.length === 0) {
      this.cache = localServers;
      this.cacheExpiry = Date.now() + this.CACHE_TTL;
    }
    
    return this.cache.length > 0 ? this.cache : localServers;
  }
}
```

#### Change 4: Update getServerDetails Method

```typescript
async getServerDetails(serverId: string): Promise<MCPMarketplaceServer> {
  try {
    // Try to fetch from registry first
    const response = await fetch(`${this.MARKETPLACE_DETAIL_URL}/${encodeURIComponent(serverId)}`, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'OLLM-CLI/0.1.0',
      },
      signal: AbortSignal.timeout(5000),
    });

    if (response.ok) {
      const server: RegistryServer = await response.json();
      return this.transformRegistryServer(server);
    }
  } catch (error) {
    console.warn(`Failed to fetch server ${serverId} from registry:`, error);
  }

  // Fallback to cached/local data
  const servers = await this.getAllServers();
  const server = servers.find((s) => s.id === serverId);

  if (!server) {
    throw new Error(`Server not found: ${serverId}`);
  }

  return server;
}
```

## Testing Plan

### 1. Unit Tests

Update `packages/cli/src/services/__tests__/mcpMarketplace.test.ts`:

```typescript
describe('MCPMarketplace with real registry', () => {
  it('should fetch servers from official registry', async () => {
    const marketplace = new MCPMarketplace();
    const servers = await marketplace.getAllServers();
    
    expect(servers.length).toBeGreaterThan(0);
    expect(servers[0]).toHaveProperty('id');
    expect(servers[0]).toHaveProperty('name');
    expect(servers[0]).toHaveProperty('description');
  });
  
  it('should transform registry format correctly', async () => {
    const marketplace = new MCPMarketplace();
    const servers = await marketplace.getAllServers();
    
    const server = servers[0];
    expect(server.command).toBeDefined();
    expect(server.category).toBeDefined();
    expect(server.requirements).toBeInstanceOf(Array);
  });
  
  it('should fall back to local registry on error', async () => {
    // Mock fetch to fail
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));
    
    const marketplace = new MCPMarketplace();
    const servers = await marketplace.getAllServers();
    
    // Should return local registry
    expect(servers.length).toBe(10);
    expect(servers[0].id).toBe('filesystem');
  });
});
```

### 2. Integration Tests

Create `packages/cli/src/services/__tests__/mcpMarketplace.integration.test.ts`:

```typescript
describe('MCPMarketplace integration', () => {
  it('should connect to real registry', async () => {
    const marketplace = new MCPMarketplace();
    const servers = await marketplace.getAllServers();
    
    expect(servers.length).toBeGreaterThan(10); // Should have more than local registry
  });
  
  it('should search servers', async () => {
    const marketplace = new MCPMarketplace();
    const results = await marketplace.searchServers('filesystem');
    
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].name.toLowerCase()).toContain('filesystem');
  });
  
  it('should get server details', async () => {
    const marketplace = new MCPMarketplace();
    const servers = await marketplace.getAllServers();
    const serverId = servers[0].id;
    
    const details = await marketplace.getServerDetails(serverId);
    expect(details.id).toBe(serverId);
  });
});
```

### 3. Manual Testing

1. Open MCP tab in OLLM CLI
2. Press 'M' to open marketplace
3. Verify servers are loaded from registry
4. Search for a server
5. Install a server
6. Verify installation works

## Rollout Plan

### Phase 1: Update Code (30 minutes)
1. Update `MARKETPLACE_URL` constant
2. Add `transformRegistryServer` method
3. Update `getAllServers` method
4. Update `getServerDetails` method
5. Add `getCategoryFromTags` helper

### Phase 2: Update Tests (30 minutes)
1. Update existing unit tests
2. Add integration tests
3. Run test suite
4. Fix any failures

### Phase 3: Manual Testing (30 minutes)
1. Test marketplace browsing
2. Test server search
3. Test server installation
4. Test fallback to local registry
5. Test offline mode

### Phase 4: Documentation (30 minutes)
1. Update `docs/MCP/mcp-panel-user-guide.md`
2. Update README.md
3. Add troubleshooting guide
4. Document registry API usage

## Risks & Mitigation

### Risk 1: Registry API Changes
- **Mitigation**: API is in freeze (v0.1), no breaking changes expected
- **Fallback**: Local registry always available

### Risk 2: Registry Downtime
- **Mitigation**: Graceful fallback to local registry
- **Mitigation**: 1-hour cache reduces API calls

### Risk 3: Rate Limiting
- **Mitigation**: Cache responses for 1 hour
- **Mitigation**: Only fetch on demand (marketplace open, search)
- **Future**: Add User-Agent header for identification

### Risk 4: Data Format Mismatch
- **Mitigation**: Comprehensive transformation layer
- **Mitigation**: Extensive testing
- **Fallback**: Local registry if transformation fails

## Success Criteria

- [ ] Marketplace connects to official registry
- [ ] Servers are displayed correctly
- [ ] Search works with registry data
- [ ] Installation works with registry servers
- [ ] Fallback to local registry works
- [ ] All tests pass
- [ ] Documentation updated
- [ ] No breaking changes to UI

## Timeline

**Total Estimated Time**: 2-3 hours

- Phase 1 (Code): 30 minutes
- Phase 2 (Tests): 30 minutes
- Phase 3 (Manual Testing): 30 minutes
- Phase 4 (Documentation): 30 minutes
- Buffer: 30-60 minutes

## Next Steps

1. Review this implementation plan
2. Get approval to proceed
3. Create feature branch: `feature/mcp-registry-integration`
4. Implement changes
5. Run tests
6. Manual testing
7. Create pull request
8. Merge to main

## References

- [Official MCP Registry](https://registry.modelcontextprotocol.io)
- [Registry GitHub Repository](https://github.com/modelcontextprotocol/registry)
- [Registry API Documentation](https://github.com/modelcontextprotocol/registry/blob/main/docs/use-rest-api.md)
- [MCP Registry Announcement](https://blog.modelcontextprotocol.io/posts/2025-09-08-mcp-registry-preview/)
