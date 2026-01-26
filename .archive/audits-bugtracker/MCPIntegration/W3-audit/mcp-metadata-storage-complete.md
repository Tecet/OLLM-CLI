# MCP Metadata Storage Implementation - Complete

**Date:** January 19, 2026  
**Status:** ✅ Complete

## Overview

Implemented metadata storage for MCP servers during installation, allowing full server details to be displayed even when offline.

## Changes Made

### 1. Extended MCPServerConfig Interface

**File:** `packages/core/src/mcp/types.ts`

Added `MCPServerMetadata` interface and `metadata` field to `MCPServerConfig`:

```typescript
export interface MCPServerMetadata {
  description?: string;
  author?: string;
  category?: string;
  version?: string;
  homepage?: string;
  repository?: string;
  rating?: number;
  installCount?: number;
  requirements?: string[];
  requiresOAuth?: boolean;
}

export interface MCPServerConfig {
  // ... existing fields
  metadata?: MCPServerMetadata;
}
```

### 2. Updated Installation to Save Metadata

**File:** `packages/cli/src/services/mcpMarketplace.ts`

Modified `installServer()` method to include metadata when saving server configuration:

```typescript
const serverConfig: MCPServerConfig = {
  command: config.command || server.command,
  args: config.args || server.args || [],
  env: { ...server.env, ...config.env },
  transport: config.transport || 'stdio',
  // ... other fields
  metadata: {
    description: server.description,
    author: server.author,
    category: server.category,
    version: server.version,
    homepage: server.homepage,
    repository: server.repository,
    rating: server.rating,
    installCount: server.installCount,
    requirements: server.requirements,
    requiresOAuth: server.requiresOAuth,
  },
};
```

### 3. Updated Server Details Display

**File:** `packages/cli/src/ui/components/tabs/MCPTab.tsx`

Modified `ServerDetailsContent` component to display metadata from config:

- Shows description, version, author, category, rating from stored metadata
- Shows homepage and requirements if available
- Gracefully handles missing metadata (for servers installed before this change)
- Displays in logical order: metadata first, then health/status, then technical details

## Storage Location

Metadata is stored in the MCP configuration file:
- **User-level:** `C:\Users\rad3k\.ollm\settings\mcp.json` (Windows)
- **User-level:** `~/.ollm/settings/mcp.json` (Linux/macOS)
- **Workspace-level:** `.ollm/settings/mcp.json`

## Example Configuration

```json
{
  "mcpServers": {
    "brave-search": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-brave-search"],
      "env": {
        "BRAVE_API_KEY": ""
      },
      "transport": "stdio",
      "metadata": {
        "description": "Web search using Brave Search API",
        "author": "Anthropic",
        "category": "Search",
        "version": "0.1.0",
        "homepage": "https://github.com/modelcontextprotocol/servers",
        "rating": 4.4,
        "installCount": 5500,
        "requirements": ["Node.js 18+", "Brave Search API Key"],
        "requiresOAuth": false
      }
    }
  }
}
```

## Benefits

1. **Offline Access:** Full server details available without internet connection
2. **Consistent Display:** Same information shown whether online or offline
3. **Better UX:** Users can see what a server does even if marketplace is unavailable
4. **Version Tracking:** Know which version of a server is installed
5. **Requirements Visible:** See what's needed to run the server

## Backward Compatibility

- Servers installed before this change will not have metadata
- UI gracefully handles missing metadata by only showing available fields
- No migration needed - metadata will be added on next install/update

## Testing

To test:
1. Install a new server from marketplace
2. Check `~/.ollm/settings/mcp.json` - should contain metadata field
3. View server details in MCP Panel - should show description, author, etc.
4. Disconnect from internet and view details again - should still show all info

## Backup Management

The system automatically creates backups of `mcp.json` before modifications:
- **Location:** `~/.ollm/mcp/backups/`
- **Retention:** Keeps last 10 backups (configurable)
- **Auto-cleanup:** Old backups are automatically deleted

### Manual Cleanup (if needed)

If you want to clean up old backups manually:

```powershell
# Windows PowerShell
Remove-Item C:\Users\rad3k\.ollm\mcp\backups\* -Force

# Or keep only recent ones
Get-ChildItem C:\Users\rad3k\.ollm\mcp\backups\*.json | 
  Sort-Object LastWriteTime -Descending | 
  Select-Object -Skip 5 | 
  Remove-Item -Force
```

```bash
# Linux/macOS
rm -rf ~/.ollm/mcp/backups/*

# Or keep only recent ones
ls -t ~/.ollm/mcp/backups/*.json | tail -n +6 | xargs rm -f
```

## Related Files

- `packages/core/src/mcp/types.ts` - Type definitions
- `packages/cli/src/services/mcpMarketplace.ts` - Installation logic
- `packages/cli/src/services/mcpConfigService.ts` - Config management
- `packages/cli/src/services/mcpConfigBackup.ts` - Backup management
- `packages/cli/src/ui/components/tabs/MCPTab.tsx` - UI display
- `packages/cli/src/ui/contexts/MCPContext.tsx` - State management

## Next Steps

- ✅ Metadata storage implemented
- ✅ UI updated to display metadata
- ✅ Backward compatibility ensured
- 🔄 Consider adding metadata migration tool for existing servers
- 🔄 Consider adding "Update Metadata" action to refresh from marketplace

## Notes

- Metadata is optional and won't break existing installations
- The `disabled` field is separate from metadata and controls server state
- Metadata is only stored during installation, not fetched dynamically
- To update metadata for an existing server, reinstall it from marketplace
