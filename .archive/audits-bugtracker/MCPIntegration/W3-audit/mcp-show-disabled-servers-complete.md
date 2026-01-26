# MCP Panel - Show Disabled Servers - Complete

**Date:** January 19, 2026  
**Status:** ✅ Complete

## Problem

The MCP Panel left column was only showing **enabled** servers. Disabled servers were hidden from the UI, making it confusing for users who couldn't see servers they had installed but disabled.

## Root Cause

The `loadServers()` function in `MCPContext.tsx` was only adding servers to the state if they appeared in `mcpClient.getAllServerStatuses()`. Since disabled servers are never started, they never appeared in the client's status map, and therefore were excluded from the UI.

## Solution

### 1. Updated Server Loading Logic

**File:** `packages/cli/src/ui/contexts/MCPContext.tsx`

Changed the server loading logic to iterate through **all servers in the config** (not just those with active status):

**Before:**
```typescript
// Only processed servers that were in serverStatuses
for (const [serverName, status] of serverStatuses.entries()) {
  const serverConfig = config.mcpServers[serverName];
  if (!serverConfig) continue;
  // ... add to state
}
```

**After:**
```typescript
// Process ALL servers from config (including disabled ones)
for (const [serverName, serverConfig] of Object.entries(config.mcpServers)) {
  // Get status from client (will be 'disconnected' if not started)
  const status = serverStatuses.get(serverName) || {
    name: serverName,
    status: 'disconnected' as const,
    tools: 0,
    uptime: 0,
  };
  // ... add to state
}
```

### 2. Updated Visual Display

**File:** `packages/cli/src/ui/components/tabs/MCPTab.tsx`

Enhanced the left column to visually distinguish disabled servers:

- **Disabled servers:** Gray text with dimmed appearance
- **Enabled servers:** Normal color based on health status
- **Status indicator:** Shows "○ Disabled" for disabled servers
- **Icon color:** Gray for disabled, health-based color for enabled

**Visual Indicators:**

| Server State | Icon | Text Color | Status Text |
|--------------|------|------------|-------------|
| Enabled + Connected | ● (green) | White/Yellow | ✓ Connected |
| Enabled + Stopped | ○ (yellow) | White/Yellow | ○ Stopped |
| Enabled + Error | ● (red) | White/Yellow | ✗ Error |
| Disabled | ○ (gray) | Gray (dimmed) | ○ Disabled |

## User Experience

### Before
- Only enabled servers visible in left column
- Disabled servers completely hidden
- Confusing - users couldn't see what they had installed

### After
- All servers visible in left column (enabled and disabled)
- Disabled servers clearly marked with gray color and "○ Disabled" status
- Users can see all installed servers at a glance
- Easy to toggle servers on/off without losing track of them

## Example

**Left Column Display:**

```
← Exit

🏪 Marketplace

📦 Installed Servers
● context7
  ✓ Connected
○ brave-search (dimmed gray)
  ○ Disabled
○ test-mcp-server (dimmed gray)
  ○ Disabled
● filesystem
  ✓ Connected
```

## Configuration File

All servers (enabled and disabled) are stored in `~/.ollm/settings/mcp.json`:

```json
{
  "mcpServers": {
    "context7": {
      "command": "npx",
      "args": ["-y", "@upstash/context7-mcp"],
      "disabled": false
    },
    "brave-search": {
      "command": "npx",
      "args": ["-y", "@smithery/brave-search-mcp"],
      "disabled": true
    }
  }
}
```

## Related Changes

This change works together with:
- **Metadata Storage** - Disabled servers now show full metadata in details view
- **Toggle Functionality** - Users can enable/disable servers without removing them
- **Delete Functionality** - Users can permanently remove servers they don't want

## Testing

To test:
1. Install a server from marketplace
2. Disable the server using the toggle in details view
3. Check left column - server should still be visible but grayed out
4. Select the disabled server - details should show "Status: ○ Disabled"
5. Toggle it back on - should turn green and connect

## Files Modified

- `packages/cli/src/ui/contexts/MCPContext.tsx` - Server loading logic
- `packages/cli/src/ui/components/tabs/MCPTab.tsx` - Visual display

## Benefits

1. **Transparency:** Users can see all installed servers
2. **Better UX:** No confusion about "missing" servers
3. **Easy Management:** Toggle servers on/off without losing them
4. **Visual Clarity:** Clear distinction between enabled and disabled states
5. **Consistency:** Matches user expectations from other applications

## Notes

- Disabled servers are not started automatically on app launch
- Disabled servers show status as "disconnected" in the client
- Toggling a server updates the `disabled` field in config
- Deleting a server removes it completely from config
